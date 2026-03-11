import { supabase, handleSupabaseError } from "@/lib/supabase";
import { resolveCourseMaterialUrl, resolveCourseMaterialUrls } from "@/lib/courseAssets";
import { analyticsService } from "@/services/analyticsService";
import { Course, Enrollment, Certificate, Module } from "@/types";
import { User, normalizeUserRole } from "@/types/auth";
import { notificationHelpers } from "@/services/notificationService";

if (!supabase) {
  console.warn("Supabase client not initialized. Please set up environment variables.");
}

export type EnrollmentErrorCode =
  | "already_enrolled"
  | "course_unavailable"
  | "access_restricted"
  | "unknown";

export interface EnrollmentErrorFeedback {
  code: EnrollmentErrorCode;
  title: string;
  description: string;
  toastMessage: string;
  canRetry: boolean;
  suggestedActions: Array<"retry" | "browse" | "profile">;
}

type EnrollmentErrorWithFeedback = Error & {
  code?: EnrollmentErrorCode;
  feedback?: EnrollmentErrorFeedback;
};

const createEnrollmentError = (feedback: EnrollmentErrorFeedback): EnrollmentErrorWithFeedback => {
  const error = new Error(feedback.description) as EnrollmentErrorWithFeedback;
  error.name = "EnrollmentError";
  error.code = feedback.code;
  error.feedback = feedback;
  return error;
};

const buildEnrollmentErrorFeedback = (
  code: EnrollmentErrorCode,
  courseTitle?: string,
): EnrollmentErrorFeedback => {
  const courseLabel = courseTitle ? ` for ${courseTitle}` : "";

  switch (code) {
    case "already_enrolled":
      return {
        code,
        title: "Already enrolled",
        description: `You already have an active enrollment${courseLabel}. Open the course and continue learning instead of enrolling again.`,
        toastMessage: "You are already enrolled in this course.",
        canRetry: false,
        suggestedActions: ["browse"],
      };
    case "course_unavailable":
      return {
        code,
        title: "Course unavailable",
        description: `This course is not currently available for trainee enrollment${courseLabel}. It may be unpublished, archived, or missing required access setup.`,
        toastMessage: "This course is not available for enrollment right now.",
        canRetry: false,
        suggestedActions: ["browse"],
      };
    case "access_restricted":
      return {
        code,
        title: "Enrollment blocked",
        description: `Your account could not enroll${courseLabel} because access is currently restricted. Refresh your profile details or try again later after permissions are updated.`,
        toastMessage: "Enrollment is currently blocked for your account.",
        canRetry: true,
        suggestedActions: ["retry", "profile", "browse"],
      };
    default:
      return {
        code: "unknown",
        title: "Enrollment failed",
        description: `We could not complete your enrollment${courseLabel}. You can retry now or choose another course while the issue is investigated.`,
        toastMessage: "Enrollment failed. You can retry now or pick another course.",
        canRetry: true,
        suggestedActions: ["retry", "browse"],
      };
  }
};

export const getEnrollmentErrorFeedback = (
  error: unknown,
  courseTitle?: string,
): EnrollmentErrorFeedback => {
  if (error && typeof error === "object" && "feedback" in error) {
    const feedback = (error as EnrollmentErrorWithFeedback).feedback;
    if (feedback) {
      return feedback;
    }
  }

  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: string }).code || "")
    : "";
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: string }).message || "")
    : String(error || "");
  const normalizedMessage = message.toLowerCase();

  if (
    code === "already_enrolled" ||
    code === "23505" ||
    normalizedMessage.includes("duplicate key") ||
    normalizedMessage.includes("already enrolled") ||
    normalizedMessage.includes("already have an active enrollment")
  ) {
    return buildEnrollmentErrorFeedback("already_enrolled", courseTitle);
  }

  if (
    code === "course_unavailable" ||
    normalizedMessage.includes("not available") ||
    normalizedMessage.includes("not currently available") ||
    normalizedMessage.includes("unpublished") ||
    normalizedMessage.includes("not found") ||
    normalizedMessage.includes("violates foreign key")
  ) {
    return buildEnrollmentErrorFeedback("course_unavailable", courseTitle);
  }

  if (
    code === "access_restricted" ||
    code === "42501" ||
    normalizedMessage.includes("row-level security") ||
    normalizedMessage.includes("permission") ||
    normalizedMessage.includes("policy") ||
    normalizedMessage.includes("not allowed") ||
    normalizedMessage.includes("access is currently restricted")
  ) {
    return buildEnrollmentErrorFeedback("access_restricted", courseTitle);
  }

  return buildEnrollmentErrorFeedback("unknown", courseTitle);
};

/**
 * Supabase Database Service
 * Handles all database operations using Supabase
 */

const loadActiveEnrollmentCounts = async (courseIds: string[]): Promise<Map<string, number>> => {
  if (!supabase || courseIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("enrollments")
    .select("course_id")
    .in("course_id", courseIds)
    .neq("status", "dropped");

  if (error) {
    console.warn("Failed to load live enrollment counts for courses:", error);
    return new Map();
  }

  const counts = new Map<string, number>();
  for (const row of data || []) {
    const courseId = row.course_id;
    if (!courseId) {
      continue;
    }

    counts.set(courseId, (counts.get(courseId) || 0) + 1);
  }

  return counts;
};

const mapCourseRecord = (
  course: any,
  liveEnrollmentCounts?: Map<string, number>,
): Course => ({
  id: course.id,
  title: course.title,
  description: course.description,
  category: course.category,
  level: course.level,
  duration: course.duration,
  instructor: "",
  instructorId: course.instructor_id,
  thumbnail: resolveCourseMaterialUrl(course.thumbnail),
  courseDocument: resolveCourseMaterialUrl(course.course_document),
  isTESDAAccredited: course.is_tesda_accredited,
  skills: course.skills,
  industryTags: course.industry_tags || [],
  careerPaths: course.career_paths || [],
  enrolledCount: liveEnrollmentCounts?.get(course.id) ?? course.enrolled_count ?? 0,
  rating: course.rating,
  createdAt: course.created_at,
  published: course.published ?? true,
});

const unsupportedCourseColumns = new Set<string>();

const getMissingCourseColumn = (error: unknown): string | null => {
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: string }).message || "")
    : "";
  const details = typeof error === "object" && error !== null && "details" in error
    ? String((error as { details?: string }).details || "")
    : "";
  const haystack = `${message} ${details}`;

  const schemaCacheMatch = haystack.match(/'([^']+)' column of 'courses'/i);
  if (schemaCacheMatch?.[1]) {
    return schemaCacheMatch[1];
  }

  const postgresMatch = haystack.match(/column\s+"([^"]+)"\s+does not exist/i);
  if (postgresMatch?.[1]) {
    return postgresMatch[1];
  }

  return null;
};

const sanitizeCourseWritePayload = (payload: Record<string, unknown>) => {
  const nextPayload = { ...payload };

  for (const column of unsupportedCourseColumns) {
    delete nextPayload[column];
  }

  return nextPayload;
};

const executeCourseWriteWithFallback = async <T>(
  execute: (payload: Record<string, unknown>) => Promise<{ data: T | null; error: any }>,
  payload: Record<string, unknown>,
): Promise<{ data: T | null; error: any }> => {
  let nextPayload = sanitizeCourseWritePayload(payload);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await execute(nextPayload);
    if (!result.error) {
      return result;
    }

    const missingColumn = getMissingCourseColumn(result.error);
    if (!missingColumn || !(missingColumn in nextPayload)) {
      return result;
    }

    unsupportedCourseColumns.add(missingColumn);
    delete nextPayload[missingColumn];
  }

  return execute(nextPayload);
};

// Course operations
export const courseService = {
  /**
   * Get all courses
   */
  getCourses: async (): Promise<Course[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    const liveEnrollmentCounts = await loadActiveEnrollmentCounts((data || []).map((course) => course.id));

    return data?.map((course) => mapCourseRecord(course, liveEnrollmentCounts)) || [];
  },

  /**
   * Get a single course by ID
   */
  getCourse: async (id: string): Promise<Course | null> => {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      handleSupabaseError(error);
      return null;
    }

    if (!data) return null;

    let enrolledCount = data.enrolled_count ?? 0;
    const liveEnrollmentCounts = await loadActiveEnrollmentCounts([data.id]);
    if (liveEnrollmentCounts.has(data.id)) {
      enrolledCount = liveEnrollmentCounts.get(data.id) || 0;
    }

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category,
      level: data.level,
      duration: data.duration,
      instructor: "", // Will be populated via join if needed
      instructorId: data.instructor_id,
      thumbnail: resolveCourseMaterialUrl(data.thumbnail),
      courseDocument: resolveCourseMaterialUrl(data.course_document),
      isTESDAAccredited: data.is_tesda_accredited,
      skills: data.skills,
      industryTags: data.industry_tags || [],
      careerPaths: data.career_paths || [],
      enrolledCount,
      rating: data.rating,
      createdAt: data.created_at,
      published: data.published ?? true,
    };
  },

  /**
   * Create a new course
   */
  createCourse: async (course: Omit<Course, "id" | "createdAt" | "enrolledCount" | "rating">): Promise<Course> => {
    const insertPayload = {
      title: course.title,
      description: course.description,
      category: course.category,
      level: course.level,
      duration: course.duration,
      instructor_id: course.instructorId,
      thumbnail: course.thumbnail || null,
      course_document: course.courseDocument || null,
      is_tesda_accredited: course.isTESDAAccredited,
      skills: course.skills,
      industry_tags: course.industryTags || [],
      career_paths: course.careerPaths || [],
      enrolled_count: 0,
      rating: 0,
      certificate_type: "completion",
      published: course.published ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await executeCourseWriteWithFallback(
      (payload) => supabase
        .from("courses")
        .insert(payload)
        .select()
        .single(),
      insertPayload,
    );

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return {
      ...mapCourseRecord(data),
      instructor: course.instructor,
    };
  },

  /**
   * Update a course
   */
  updateCourse: async (id: string, updates: Partial<Course>): Promise<Course> => {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.level !== undefined) updateData.level = updates.level;
    if (updates.duration !== undefined) updateData.duration = updates.duration;
    if (updates.instructorId !== undefined) updateData.instructor_id = updates.instructorId;
    if (updates.thumbnail !== undefined) updateData.thumbnail = updates.thumbnail;
    if (updates.courseDocument !== undefined) updateData.course_document = updates.courseDocument;
    if (updates.isTESDAAccredited !== undefined) updateData.is_tesda_accredited = updates.isTESDAAccredited;
    if (updates.skills !== undefined) updateData.skills = updates.skills;
    if (updates.industryTags !== undefined) updateData.industry_tags = updates.industryTags;
    if (updates.careerPaths !== undefined) updateData.career_paths = updates.careerPaths;
    if (updates.published !== undefined) updateData.published = updates.published;

    const { data, error } = await executeCourseWriteWithFallback(
      (payload) => supabase
        .from("courses")
        .update(payload)
        .eq("id", id)
        .select()
        .single(),
      updateData,
    );

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return {
      ...mapCourseRecord(data),
      instructor: updates.instructor || "",
    };
  },

  /**
   * Delete a course
   */
  deleteCourse: async (id: string): Promise<void> => {
    const { error } = await supabase.from("courses").delete().eq("id", id);

    if (error) {
      handleSupabaseError(error);
      throw error;
    }
  },
};

// Module operations
export const moduleService = {
  /**
   * Get all modules for a course
   */
  getModulesByCourse: async (courseId: string): Promise<Module[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    const { data, error } = await supabase
      .from("modules")
      .select("*, module_document")
      .eq("course_id", courseId)
      .order("order", { ascending: true });

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (
      data?.map((module: any) => ({
        id: module.id,
        course_id: module.course_id,
        title: module.title,
        description: module.description,
        order: module.order,
        content: module.content || undefined,
        materials: resolveCourseMaterialUrls(module.materials),
        prerequisites: module.prerequisites || [],
        module_thumbnail: resolveCourseMaterialUrl((module as any).module_thumbnail),
        module_document: resolveCourseMaterialUrl(module.module_document),
        created_at: module.created_at,
        updated_at: module.updated_at || module.created_at,
        status: (module.status === "finalized" ? "finalized" : "draft") as "draft" | "finalized",
      })) || []
    );
  },

  /**
   * Get a single module by ID
   */
  getModule: async (id: string): Promise<Module | null> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return null;
    }

    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      handleSupabaseError(error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      course_id: data.course_id,
      title: data.title,
      description: data.description,
      order: data.order,
      content: data.content || undefined,
      materials: resolveCourseMaterialUrls(data.materials),
      prerequisites: data.prerequisites || [],
      module_thumbnail: resolveCourseMaterialUrl((data as any).module_thumbnail),
      module_document: resolveCourseMaterialUrl((data as any).module_document),
      created_at: data.created_at,
      updated_at: (data as any).updated_at || data.created_at,
      status: ((data as any).status === "finalized" ? "finalized" : "draft") as Module["status"],
    };
  },

  /**
   * Create a new module
   */
  createModule: async (module: Omit<Module, "id" | "created_at">): Promise<Module> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    // Get the next order number if not provided
    let order = module.order;
    if (!order) {
      const { data: existingModules } = await supabase
        .from("modules")
        .select("order")
        .eq("course_id", module.course_id)
        .order("order", { ascending: false })
        .limit(1);

      order = existingModules && existingModules.length > 0 
        ? existingModules[0].order + 1 
        : 1;
    }

    const { data, error } = await supabase
      .from("modules")
      .insert({
        course_id: module.course_id,
        title: module.title,
        description: module.description,
        order: order,
        content: module.content || null,
        materials: module.materials || [],
        prerequisites: module.prerequisites || [],
        module_thumbnail: (module as any).module_thumbnail || null,
        module_document: (module as any).module_document || null,
        status: (module as any).status || "draft",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    const row = data as any;
    return {
      id: data.id,
      course_id: data.course_id,
      title: data.title,
      description: data.description,
      order: data.order,
      content: data.content || undefined,
      materials: resolveCourseMaterialUrls(data.materials),
      prerequisites: data.prerequisites || [],
      module_thumbnail: resolveCourseMaterialUrl((data as any).module_thumbnail),
      module_document: resolveCourseMaterialUrl(data.module_document),
      created_at: data.created_at,
      updated_at: row.updated_at || data.created_at,
      status: (row.status === "finalized" ? "finalized" : "draft") as Module["status"],
    };
  },

  /**
   * Update a module
   */
  updateModule: async (id: string, updates: Partial<Module>): Promise<Module> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const updateData: any = { updated_at: new Date().toISOString() };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.order !== undefined) updateData.order = updates.order;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.module_thumbnail !== undefined) updateData.module_thumbnail = updates.module_thumbnail;
    if (updates.module_document !== undefined) updateData.module_document = updates.module_document;
    if (updates.materials !== undefined) updateData.materials = updates.materials;
    if (updates.prerequisites !== undefined) updateData.prerequisites = updates.prerequisites;
    if (updates.status !== undefined) updateData.status = updates.status;

    const { data, error } = await supabase
      .from("modules")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    const row = data as any;
    return {
      id: data.id,
      course_id: data.course_id,
      title: data.title,
      description: data.description,
      order: data.order,
      content: data.content || undefined,
      materials: resolveCourseMaterialUrls(data.materials),
      prerequisites: data.prerequisites || [],
      module_thumbnail: resolveCourseMaterialUrl((data as any).module_thumbnail),
      module_document: resolveCourseMaterialUrl(data.module_document),
      created_at: data.created_at,
      updated_at: row.updated_at || data.created_at,
      status: (row.status === "finalized" ? "finalized" : "draft") as Module["status"],
    };
  },

  /**
   * Delete a module
   */
  deleteModule: async (id: string): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { error } = await supabase
      .from("modules")
      .delete()
      .eq("id", id);

    if (error) {
      handleSupabaseError(error);
      throw error;
    }
  },

  /**
   * Reorder modules (update order for multiple modules)
   */
  reorderModules: async (courseId: string, moduleOrders: { id: string; order: number }[]): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    // Update each module's order
    for (const { id, order } of moduleOrders) {
      const { error } = await supabase
        .from("modules")
        .update({ order })
        .eq("id", id)
        .eq("course_id", courseId);

      if (error) {
        handleSupabaseError(error);
        throw error;
      }
    }
  },
};

// Module completion operations
export const moduleCompletionService = {
  /**
   * Mark a module as completed for an enrollment
   */
  markModuleComplete: async (
    enrollmentId: string,
    moduleId: string,
    timeSpent?: number
  ): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    // Check if already completed
    const { data: existing } = await supabase
      .from("module_completions")
      .select("id, completed_at, time_spent")
      .eq("enrollment_id", enrollmentId)
      .eq("module_id", moduleId)
      .single();

    if (existing) {
      const nextTimeSpent =
        timeSpent !== undefined
          ? Math.max(existing.time_spent || 0, timeSpent)
          : existing.time_spent;

      const { error: updateError } = await supabase
        .from("module_completions")
        .update({
          time_spent: nextTimeSpent,
          completed_at: existing.completed_at || new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) {
        handleSupabaseError(updateError);
        throw updateError;
      }

      await updateEnrollmentProgress(enrollmentId);

      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("user_id, course_id")
        .eq("id", enrollmentId)
        .single();

      if (enrollment) {
        await analyticsService.trackEvent({
          eventName: "module_complete",
          userId: enrollment.user_id,
          courseId: enrollment.course_id,
          moduleId,
          enrollmentId,
          surface: "course_module_viewer",
          metadata: {
            timeSpent: nextTimeSpent || 0,
          },
        });
        await analyticsService.refreshPhase1Analytics(enrollment.user_id);
      }

      return;
    }

    // Insert new completion
    const { error } = await supabase.from("module_completions").insert({
      enrollment_id: enrollmentId,
      module_id: moduleId,
      completed_at: new Date().toISOString(),
      time_spent: timeSpent || null,
    });

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    // Calculate and update enrollment progress
    await updateEnrollmentProgress(enrollmentId);

    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("user_id, course_id")
      .eq("id", enrollmentId)
      .single();

    if (enrollment) {
      await analyticsService.trackEvent({
        eventName: "module_complete",
        userId: enrollment.user_id,
        courseId: enrollment.course_id,
        moduleId,
        enrollmentId,
        surface: "course_module_viewer",
        metadata: {
          timeSpent: timeSpent || 0,
        },
      });
      await analyticsService.refreshPhase1Analytics(enrollment.user_id);
    }
  },

  /**
   * Get completed modules for an enrollment
   */
  getCompletedModules: async (enrollmentId: string): Promise<string[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    const { data, error } = await supabase
      .from("module_completions")
      .select("module_id")
      .eq("enrollment_id", enrollmentId)
      .not("completed_at", "is", null);

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return data?.map((item) => item.module_id) || [];
  },

  /**
   * Check if a module is completed for an enrollment
   */
  isModuleCompleted: async (
    enrollmentId: string,
    moduleId: string
  ): Promise<boolean> => {
    if (!supabase) {
      return false;
    }

    const { data } = await supabase
      .from("module_completions")
      .select("id")
      .eq("enrollment_id", enrollmentId)
      .eq("module_id", moduleId)
      .not("completed_at", "is", null)
      .single();

    return !!data;
  },
};

/**
 * Helper function to update enrollment progress based on completed modules
 */
async function updateEnrollmentProgress(enrollmentId: string): Promise<void> {
  if (!supabase) return;

  // Get enrollment
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("course_id, user_id")
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) return;

  // Get total modules for the course
  const { data: modules } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", enrollment.course_id);

  if (!modules || modules.length === 0) return;

  // Get completed modules
  const { data: completions } = await supabase
    .from("module_completions")
    .select("module_id")
    .eq("enrollment_id", enrollmentId);

  const completedCount = completions?.length || 0;
  const totalModules = modules.length;
  const progress = Math.round((completedCount / totalModules) * 100);

  // Update enrollment progress and status
  const updateData: any = { progress };
  if (progress === 100) {
    updateData.status = "completed";
    updateData.completed_at = new Date().toISOString();
    
    // Notify user about course completion
    try {
      const { data: course } = await supabase
        .from("courses")
        .select("title")
        .eq("id", enrollment.course_id)
        .single();
      
      if (course) {
        await notificationHelpers.notifyCourseCompleted(
          enrollment.user_id,
          course.title,
          enrollment.course_id
        );
      }
    } catch (error) {
      console.error("Error sending course completion notification:", error);
      // Don't throw - notification failure shouldn't block progress update
    }
    
    // Auto-generate certificate if course is completed
    try {
      await autoGenerateCertificate(enrollmentId);
    } catch (error) {
      console.error("Error auto-generating certificate:", error);
      // Don't throw - certificate generation failure shouldn't block progress update
    }
  } else if (progress > 0 && progress < 100) {
    updateData.status = "in-progress";
  }

  await supabase.from("enrollments").update(updateData).eq("id", enrollmentId);
}

/**
 * Auto-generate certificate when course is completed
 */
async function autoGenerateCertificate(enrollmentId: string): Promise<void> {
  if (!supabase) return;

  // Get enrollment details
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("user_id, course_id, certificate_id")
    .eq("id", enrollmentId)
    .single();

  if (!enrollment || enrollment.certificate_id) {
    // Already has a certificate
    return;
  }

  // Get course details
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, certificate_type")
    .eq("id", enrollment.course_id)
    .single();

  if (!course) return;

  // Issue certificate
  const certificate = await certificateService.issueCertificate(
    enrollment.user_id,
    enrollment.course_id,
    course.title,
    course.certificate_type || "completion"
  );

  // Notify user about certificate issuance
  try {
    await notificationHelpers.notifyCertificateIssued(
      enrollment.user_id,
      course.title,
      certificate.id,
      course.certificate_type || "completion"
    );
  } catch (error) {
    console.error("Error sending certificate notification:", error);
    // Don't throw - notification failure shouldn't block certificate issuance
  }

  // Update enrollment with certificate ID
  await supabase
    .from("enrollments")
    .update({ certificate_id: certificate.id })
    .eq("id", enrollmentId);
}

// Enrollment operations
export const enrollmentService = {
  /**
   * Get enrollments (optionally filtered by user ID)
   */
  getEnrollments: async (userId?: string): Promise<Enrollment[]> => {
    if (!supabase) {
      console.error("Supabase client not initialized");
      return [];
    }

    // Get current authenticated user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    console.log("=== ENROLLMENT DEBUG ===");
    console.log("Auth user ID (auth.uid()):", authUser?.id);
    console.log("Requested userId filter:", userId);
    console.log("Auth user email:", authUser?.email);
    console.log("Auth error:", authError);

    if (authError || !authUser) {
      console.error("User not authenticated:", authError);
      console.log("=== END ENROLLMENT DEBUG ===");
      return [];
    }

    // Get user role to determine query strategy
    const roleFromMetadata = authUser.user_metadata?.role || 'trainee';
    const isTrainerOrAdmin = ['training_officer', 'admin', 'trainer', 'spd'].includes(roleFromMetadata);
    
    console.log("User role:", roleFromMetadata);
    console.log("Is trainer/admin:", isTrainerOrAdmin);

    // Build query - RLS policies will handle filtering:
    // - For trainees: RLS filters by auth.uid() = user_id
    // - For trainers/admins: RLS allows viewing enrollments for their courses
    let query = supabase.from("enrollments").select("*");

    // Only filter by user_id if:
    // 1. userId is explicitly provided (for specific user lookup)
    // 2. User is a trainee (not trainer/admin)
    if (userId) {
      // Explicit userId provided - use it (but verify it matches auth.uid() for trainees)
      if (!isTrainerOrAdmin && userId !== authUser.id) {
        console.warn("Warning: Trainee requested different userId. Using auth.uid() instead.");
        query = query.eq("user_id", authUser.id);
      } else {
        query = query.eq("user_id", userId);
      }
      console.log("Filtering by explicit user_id:", userId);
    } else if (!isTrainerOrAdmin) {
      // Trainee without explicit userId - filter by their own ID
      query = query.eq("user_id", authUser.id);
      console.log("Trainee - filtering by own user_id:", authUser.id);
    } else {
      // Trainer/Admin without explicit userId - let RLS handle filtering
      // Don't add user_id filter, RLS will show enrollments for their courses
      console.log("Trainer/Admin - letting RLS handle filtering (no user_id filter)");
    }

    query = query.order("enrolled_at", { ascending: false });

    const { data, error } = await query;

    console.log("Query result - data count:", data?.length || 0);
    console.log("Query result - error:", error);
    console.log("Raw data:", data);

    if (error) {
      console.error("Enrollment query error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      handleSupabaseError(error);
      console.log("=== END ENROLLMENT DEBUG ===");
      return [];
    }

    const mappedEnrollments = (
      data?.map((enrollment: any) => ({
        id: enrollment.id,
        userId: enrollment.user_id,
        courseId: enrollment.course_id,
        progress: enrollment.progress,
        status: enrollment.status,
        enrolledAt: enrollment.enrolled_at,
        completedAt: enrollment.completed_at || undefined,
        certificateId: enrollment.certificate_id || undefined,
        sourceRecommendationId: enrollment.originating_recommendation_id || undefined,
        lastActivityAt: enrollment.updated_at || enrollment.enrolled_at,
      })) || []
    );

    console.log("Mapped enrollments:", mappedEnrollments);
    console.log("=== END ENROLLMENT DEBUG ===");

    return mappedEnrollments;
  },

  /**
   * Enroll a user in a course
   */
  enrollInCourse: async (
    userId: string,
    courseId: string,
    options?: {
      originatingRecommendationId?: string;
      sourceSurface?: string;
    },
  ): Promise<Enrollment> => {
    if (!supabase) {
      throw createEnrollmentError(buildEnrollmentErrorFeedback("unknown"));
    }

    const { data: courseRow, error: courseError } = await supabase
      .from("courses")
      .select("id, title, published")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) {
      throw createEnrollmentError(getEnrollmentErrorFeedback(courseError));
    }

    if (!courseRow) {
      throw createEnrollmentError(buildEnrollmentErrorFeedback("course_unavailable"));
    }

    if (courseRow.published === false) {
      throw createEnrollmentError(buildEnrollmentErrorFeedback("course_unavailable", courseRow.title));
    }

    const { data: existingEnrollment, error: existingEnrollmentError } = await supabase
      .from("enrollments")
      .select("id, status")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .neq("status", "dropped")
      .maybeSingle();

    if (existingEnrollmentError) {
      throw createEnrollmentError(getEnrollmentErrorFeedback(existingEnrollmentError, courseRow.title));
    }

    if (existingEnrollment) {
      throw createEnrollmentError(buildEnrollmentErrorFeedback("already_enrolled", courseRow.title));
    }

    const { data, error } = await supabase
      .from("enrollments")
      .insert({
        user_id: userId,
        course_id: courseId,
        progress: 0,
        status: "enrolled",
        enrolled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        originating_recommendation_id: options?.originatingRecommendationId || null,
      })
      .select()
      .single();

    if (error) {
      throw createEnrollmentError(getEnrollmentErrorFeedback(error, courseRow.title));
    }

    // Update course enrolled count
    await supabase.rpc("increment_enrolled_count", { course_id: courseId });

    // Notify user about enrollment confirmation
    try {
      const { data: course } = await supabase
        .from("courses")
        .select("title")
        .eq("id", courseId)
        .single();
      
      if (course) {
        await notificationHelpers.notifyEnrollmentConfirmed(
          userId,
          course.title,
          data.id
        );
      }
    } catch (error) {
      console.error("Error sending enrollment notification:", error);
      // Don't throw - notification failure shouldn't block enrollment
    }

    if (options?.originatingRecommendationId) {
      await analyticsService.trackEvent({
        eventName: "recommendation_accept",
        userId,
        courseId,
        enrollmentId: data.id,
        recommendationId: options.originatingRecommendationId,
        surface: options.sourceSurface || "course_recommendations",
        metadata: {
          action: "direct_enroll",
        },
      });
    }

    await analyticsService.trackEvent({
      eventName: "course_enroll",
      userId,
      courseId,
      enrollmentId: data.id,
      recommendationId: options?.originatingRecommendationId,
      surface: options?.sourceSurface || "course_catalog",
      metadata: {
        fromRecommendation: Boolean(options?.originatingRecommendationId),
      },
    });
    await analyticsService.refreshPhase1Analytics(userId);

    return {
      id: data.id,
      userId: data.user_id,
      courseId: data.course_id,
      progress: data.progress,
      status: data.status,
      enrolledAt: data.enrolled_at,
      completedAt: data.completed_at || undefined,
      certificateId: data.certificate_id || undefined,
      sourceRecommendationId: data.originating_recommendation_id || undefined,
    };
  },

  /**
   * Update enrollment
   */
  updateEnrollment: async (enrollmentId: string, updates: Partial<Enrollment>): Promise<Enrollment> => {
    const updateData: any = {};

    if (updates.progress !== undefined) updateData.progress = updates.progress;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;
    if (updates.certificateId !== undefined) updateData.certificate_id = updates.certificateId;

    const { data, error } = await supabase
      .from("enrollments")
      .update(updateData)
      .eq("id", enrollmentId)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return {
      id: data.id,
      userId: data.user_id,
      courseId: data.course_id,
      progress: data.progress,
      status: data.status,
      enrolledAt: data.enrolled_at,
      completedAt: data.completed_at || undefined,
      certificateId: data.certificate_id || undefined,
      sourceRecommendationId: data.originating_recommendation_id || undefined,
    };
  },

  /**
   * Bulk enroll multiple users in a course
   */
  bulkEnroll: async (userIds: string[], courseId: string): Promise<{ success: number; failed: number; errors: string[] }> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // Check for existing enrollments first
    const { data: existing } = await supabase
      .from("enrollments")
      .select("user_id")
      .eq("course_id", courseId)
      .in("user_id", userIds);

    const existingUserIds = new Set(existing?.map(e => e.user_id) || []);
    const newUserIds = userIds.filter(id => !existingUserIds.has(id));

    if (newUserIds.length === 0) {
      return { success: 0, failed: userIds.length, errors: ["All users are already enrolled in this course"] };
    }

    // Insert new enrollments
    const enrollmentsToInsert = newUserIds.map(userId => ({
      user_id: userId,
      course_id: courseId,
      progress: 0,
      status: "enrolled" as const,
      enrolled_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("enrollments")
      .insert(enrollmentsToInsert)
      .select();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    success = data?.length || 0;
    failed = userIds.length - success;

      // Update course enrolled count
      if (success > 0) {
        try {
          await supabase.rpc("increment_enrolled_count", { 
            course_id: courseId,
            increment_by: success 
          });
        } catch (err) {
          console.error("Error updating enrolled count:", err);
        }
      }

    // Notify users about enrollment confirmation
    if (success > 0 && data) {
      try {
        const { data: course } = await supabase
          .from("courses")
          .select("title")
          .eq("id", courseId)
          .single();
        
        if (course) {
          // Send notifications to all successfully enrolled users
          const notificationPromises = data.map((enrollment: any) =>
            notificationHelpers.notifyEnrollmentConfirmed(
              enrollment.user_id,
              course.title,
              enrollment.id
            ).catch((err) => {
              console.error(`Error sending notification to user ${enrollment.user_id}:`, err);
            })
          );
          
          await Promise.all(notificationPromises);
        }
      } catch (error) {
        console.error("Error sending bulk enrollment notifications:", error);
        // Don't throw - notification failure shouldn't block enrollment
        }
      }

    return { success, failed, errors };
  },

  /**
   * Unenroll a user from a course
   */
  unenroll: async (enrollmentId: string, preserveProgress: boolean = false): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    // Get enrollment details before deletion
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("course_id, user_id, progress, status")
      .eq("id", enrollmentId)
      .single();

    if (!enrollment) {
      throw new Error("Enrollment not found");
    }

    const markAsDropped = async () => {
      const { error: updateError } = await supabase
        .from("enrollments")
        .update({ status: "dropped", updated_at: new Date().toISOString() })
        .eq("id", enrollmentId);

      if (updateError) {
        handleSupabaseError(updateError);
        throw updateError;
      }

      if (enrollment.status !== "dropped") {
        try {
          await supabase.rpc("decrement_enrolled_count", {
            course_id: enrollment.course_id,
          });
        } catch (err) {
          console.error("Error decrementing enrolled count for dropped enrollment:", err);
        }
      }
    };

    // If not preserving progress, delete the enrollment.
    // If delete is blocked by RLS, fall back to marking the enrollment as dropped.
    if (preserveProgress) {
      await markAsDropped();
    } else {
      // Delete the enrollment
      const { error } = await supabase
        .from("enrollments")
        .delete()
        .eq("id", enrollmentId);

      if (error) {
        const message = error.message?.toLowerCase() || "";
        const shouldFallbackToDrop =
          message.includes("row-level security") ||
          message.includes("permission") ||
          message.includes("policy") ||
          message.includes("forbidden") ||
          message.includes("unauthorized");

        if (!shouldFallbackToDrop) {
          handleSupabaseError(error);
          throw error;
        }

        await markAsDropped();
        return;
      }

      // Decrement course enrolled count
      try {
        await supabase.rpc("decrement_enrolled_count", { 
          course_id: enrollment.course_id 
        });
      } catch (err) {
        console.error("Error decrementing enrolled count:", err);
      }
    }
  },

  /**
   * Get enrollment with user and course details
   */
  getEnrollmentWithDetails: async (enrollmentId: string) => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        *,
        users:user_id (id, name, email),
        courses:course_id (id, title, category)
      `)
      .eq("id", enrollmentId)
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return {
      enrollment: {
        id: data.id,
        userId: data.user_id,
        courseId: data.course_id,
        progress: data.progress,
        status: data.status,
        enrolledAt: data.enrolled_at,
        completedAt: data.completed_at || undefined,
        certificateId: data.certificate_id || undefined,
        sourceRecommendationId: data.originating_recommendation_id || undefined,
      },
      user: data.users,
      course: data.courses,
    };
  },

  /**
   * Get enrollments for a course with user details
   */
  getCourseEnrollments: async (courseId: string): Promise<Array<Enrollment & { userName?: string; userEmail?: string }>> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        *,
        users:user_id (name, email)
      `)
      .eq("course_id", courseId)
      .order("enrolled_at", { ascending: false });

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (
      data?.map((item: any) => ({
        id: item.id,
        userId: item.user_id,
        courseId: item.course_id,
        progress: item.progress,
        status: item.status,
        enrolledAt: item.enrolled_at,
        completedAt: item.completed_at || undefined,
        certificateId: item.certificate_id || undefined,
        sourceRecommendationId: item.originating_recommendation_id || undefined,
        userName: item.users?.name,
        userEmail: item.users?.email,
        lastActivityAt: item.updated_at || item.enrolled_at,
      })) || []
    );
  },

  /**
   * Get enrollments with joined user and course details.
   */
  getEnrollmentsWithDetails: async (filters?: {
    userId?: string;
    courseId?: string;
  }): Promise<Array<Enrollment & {
    userName?: string;
    userEmail?: string;
    courseTitle?: string;
    lastActivityAt?: string;
  }>> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    let query = supabase
      .from("enrollments")
      .select(`
        *,
        users:user_id (name, email),
        courses:course_id (title)
      `)
      .order("enrolled_at", { ascending: false });

    if (filters?.userId) {
      query = query.eq("user_id", filters.userId);
    }

    if (filters?.courseId) {
      query = query.eq("course_id", filters.courseId);
    }

    const { data, error } = await query;

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (
      data?.map((item: any) => ({
        id: item.id,
        userId: item.user_id,
        courseId: item.course_id,
        progress: item.progress,
        status: item.status,
        enrolledAt: item.enrolled_at,
        completedAt: item.completed_at || undefined,
        certificateId: item.certificate_id || undefined,
        sourceRecommendationId: item.originating_recommendation_id || undefined,
        userName: item.users?.name || undefined,
        userEmail: item.users?.email || undefined,
        courseTitle: item.courses?.title || undefined,
        lastActivityAt: item.updated_at || item.enrolled_at,
      })) || []
    );
  },
};

// Certificate operations
export const certificateService = {
  /**
   * Get certificates (optionally filtered by user ID)
   */
  getCertificates: async (userId?: string): Promise<Certificate[]> => {
    let query = supabase
      .from("certificates")
      .select("*, courses(title, category, thumbnail)")
      .order("issued_at", { ascending: false });

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (
      data?.map((cert) => {
        const course = cert.courses as { title?: string; category?: string; thumbnail?: string } | null;
        return {
          id: cert.id,
          userId: cert.user_id,
          courseId: cert.course_id,
          courseTitle: course?.title || "",
          issuedAt: cert.issued_at,
          certificateNumber: cert.certificate_number,
          certificateType: cert.certificate_type,
          verificationCode: cert.verification_code,
          courseCategory: course?.category,
          courseThumbnail: resolveCourseMaterialUrl(course?.thumbnail),
        };
      }) || []
    );
  },

  /**
   * Issue a new certificate
   */
  issueCertificate: async (
    userId: string,
    courseId: string,
    courseTitle: string,
    certificateType: "completion" | "participation" = "completion"
  ): Promise<Certificate> => {
    const certificateNumber = `TESDA-${courseId.toUpperCase()}-${Date.now()}`;
    const verificationCode = `VER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const { data, error } = await supabase
      .from("certificates")
      .insert({
        user_id: userId,
        course_id: courseId,
        certificate_number: certificateNumber,
        certificate_type: certificateType,
        issued_at: new Date().toISOString(),
        verification_code: verificationCode,
      })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    const certificate = {
      id: data.id,
      userId: data.user_id,
      courseId: data.course_id,
      courseTitle,
      issuedAt: data.issued_at,
      certificateNumber: data.certificate_number,
      certificateType: data.certificate_type,
      verificationCode: data.verification_code,
    };

    // Notify user about certificate issuance (if not already notified by autoGenerateCertificate)
    try {
      await notificationHelpers.notifyCertificateIssued(
        userId,
        courseTitle,
        certificate.id,
        certificateType
      );
    } catch (error) {
      console.error("Error sending certificate notification:", error);
      // Don't throw - notification failure shouldn't block certificate issuance
    }

    return certificate;
  },

  /**
   * Get a single certificate by ID (for viewing)
   */
  getCertificateById: async (id: string, userId?: string): Promise<Certificate | null> => {
    if (!supabase) return null;
    let query = supabase
      .from("certificates")
      .select("*, courses(title, category, thumbnail)")
      .eq("id", id);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query.single();
    if (error || !data) return null;
    const course = data.courses as { title?: string; category?: string; thumbnail?: string } | null;
    return {
      id: data.id,
      userId: data.user_id,
      courseId: data.course_id,
      courseTitle: course?.title || "",
      issuedAt: data.issued_at,
      certificateNumber: data.certificate_number,
      certificateType: data.certificate_type,
      verificationCode: data.verification_code,
      courseCategory: course?.category,
      courseThumbnail: resolveCourseMaterialUrl(course?.thumbnail),
    };
  },

  /**
   * Get certificate by verification code (for public verification)
   */
  getCertificateByVerificationCode: async (verificationCode: string): Promise<Certificate | null> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return null;
    }

    const { data, error } = await supabase
      .from("certificates")
      .select("*, courses(title), users(name)")
      .eq("verification_code", verificationCode)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      handleSupabaseError(error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      courseId: data.course_id,
      courseTitle: (data.courses as any)?.title || "",
      issuedAt: data.issued_at,
      certificateNumber: data.certificate_number,
      certificateType: data.certificate_type,
      verificationCode: data.verification_code,
    };
  },

  /**
   * Get certificate by certificate number
   */
  getCertificateByNumber: async (certificateNumber: string): Promise<Certificate | null> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return null;
    }

    const { data, error } = await supabase
      .from("certificates")
      .select("*, courses(title)")
      .eq("certificate_number", certificateNumber)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      handleSupabaseError(error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      courseId: data.course_id,
      courseTitle: (data.courses as any)?.title || "",
      issuedAt: data.issued_at,
      certificateNumber: data.certificate_number,
      certificateType: data.certificate_type,
      verificationCode: data.verification_code,
    };
  },
};

// User operations
export const userService = {
  /**
   * Get all users (admin only)
   */
  getAllUsers: async (): Promise<User[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }
    
    console.log("🔍 getAllUsers: Starting query to fetch users...");
    console.log("🔍 getAllUsers: Current user ID:", (await supabase.auth.getUser()).data.user?.id);
    
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    console.log("🔍 getAllUsers: Query completed", { 
      dataCount: data?.length || 0, 
      hasError: !!error,
      error: error ? {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      } : null
    });

    if (error) {
      console.error("❌ Error fetching users:", error);
      console.error("Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      handleSupabaseError(error);
      throw error; // Throw error so the component can handle it
    }
    
    console.log("✅ getAllUsers: Successfully fetched", data?.length || 0, "users");

    return (
      data?.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: normalizeUserRole(user.role),
        avatar: user.avatar || undefined,
        phone: user.phone || undefined,
        address: user.address || undefined,
        dateOfBirth: user.date_of_birth || undefined,
        gender: user.gender || undefined,
        civilStatus: user.civil_status || undefined,
        employmentStatus: user.employment_status || undefined,
        occupation: user.occupation || undefined,
        educationLevel: user.education_level || undefined,
        barangay: user.barangay || undefined,
        cityMunicipality: user.city_municipality || undefined,
        province: user.province || undefined,
        postalCode: user.postal_code || undefined,
        industryInterests: user.industry_interests || undefined,
        preferredCategories: user.preferred_categories || undefined,
        onboardingSkillLevel: user.onboarding_skill_level || undefined,
        skills: user.skills || undefined,
        createdAt: user.created_at,
      })) || []
    );
  },

  /**
   * Get a single user by ID
   */
  getUserById: async (userId: string): Promise<User | null> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return null;
    }
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows gracefully

    if (error) {
      // Check if error is "no rows" (PGRST116) - this is expected if user doesn't exist
      if (error.code === 'PGRST116') {
        console.warn(`User not found or not accessible: ${userId}`);
        return null;
      }
      console.error(`Error fetching user ${userId}:`, error);
      handleSupabaseError(error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: normalizeUserRole(data.role),
      avatar: data.avatar || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      dateOfBirth: data.date_of_birth || undefined,
      gender: data.gender || undefined,
      civilStatus: data.civil_status || undefined,
      employmentStatus: data.employment_status || undefined,
      occupation: data.occupation || undefined,
      educationLevel: data.education_level || undefined,
      barangay: data.barangay || undefined,
      cityMunicipality: data.city_municipality || undefined,
      province: data.province || undefined,
      postalCode: data.postal_code || undefined,
      industryInterests: data.industry_interests || undefined,
      preferredCategories: data.preferred_categories || undefined,
      onboardingSkillLevel: data.onboarding_skill_level || undefined,
      skills: data.skills || undefined,
      createdAt: data.created_at,
    };
  },

  /**
   * Update user role and details
   * IMPORTANT: When updating role, this also syncs it to Supabase auth metadata
   */
  updateUser: async (userId: string, updates: Partial<User>): Promise<User> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.dateOfBirth !== undefined) updateData.date_of_birth = updates.dateOfBirth || null;
    if (updates.gender !== undefined) updateData.gender = updates.gender || null;
    if (updates.civilStatus !== undefined) updateData.civil_status = updates.civilStatus || null;
    if (updates.employmentStatus !== undefined) updateData.employment_status = updates.employmentStatus || null;
    if (updates.occupation !== undefined) updateData.occupation = updates.occupation || null;
    if (updates.educationLevel !== undefined) updateData.education_level = updates.educationLevel || null;
    if (updates.barangay !== undefined) updateData.barangay = updates.barangay || null;
    if (updates.cityMunicipality !== undefined) updateData.city_municipality = updates.cityMunicipality || null;
    if (updates.province !== undefined) updateData.province = updates.province || null;
    if (updates.postalCode !== undefined) updateData.postal_code = updates.postalCode || null;
    if (updates.industryInterests !== undefined) updateData.industry_interests = updates.industryInterests;
    if (updates.preferredCategories !== undefined) updateData.preferred_categories = updates.preferredCategories;
    if (updates.onboardingSkillLevel !== undefined) updateData.onboarding_skill_level = updates.onboardingSkillLevel || null;
    if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
    if (updates.skills !== undefined) updateData.skills = updates.skills;
    if (updates.role !== undefined) updateData.role = updates.role;

    // If role is being updated, sync it to auth metadata FIRST
    if (updates.role !== undefined) {
      const { error: roleError } = await supabase.rpc('set_user_role_by_id', {
        user_id: userId,
        user_role: updates.role
      });

      if (roleError) {
        console.error("Error updating role in auth metadata:", roleError);
        // Don't throw here - continue with database update
        // The role might still be updated in the database table
      }
    }

    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: normalizeUserRole(data.role),
      avatar: data.avatar || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      dateOfBirth: data.date_of_birth || undefined,
      gender: data.gender || undefined,
      civilStatus: data.civil_status || undefined,
      employmentStatus: data.employment_status || undefined,
      occupation: data.occupation || undefined,
      educationLevel: data.education_level || undefined,
      barangay: data.barangay || undefined,
      cityMunicipality: data.city_municipality || undefined,
      province: data.province || undefined,
      postalCode: data.postal_code || undefined,
      industryInterests: data.industry_interests || undefined,
      preferredCategories: data.preferred_categories || undefined,
      onboardingSkillLevel: data.onboarding_skill_level || undefined,
      skills: data.skills || undefined,
      createdAt: data.created_at,
    };
  },

  /**
   * Delete a user account (admin only)
   * Uses the delete_user_account RPC function which prevents deleting yourself
   */
  deleteUser: async (userId: string): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return { error: new Error("Supabase not initialized") };
    }

    try {
      const { error } = await supabase.rpc('delete_user_account', {
        user_id: userId,
      });

      if (error) {
        console.error("Error deleting user:", error);
        return { error: error as Error };
      }

      return { error: null };
    } catch (error) {
      console.error("Error deleting user:", error);
      return {
        error: error instanceof Error ? error : new Error("Failed to delete user"),
      };
    }
  },
};

