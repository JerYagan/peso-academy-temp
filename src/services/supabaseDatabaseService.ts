import { supabase, handleSupabaseError } from "@/lib/supabase";
import { Course, Enrollment, Job, Certificate, Module } from "@/types";
import { User } from "@/types/auth";
import { notificationHelpers } from "@/services/notificationService";

if (!supabase) {
  console.warn("Supabase client not initialized. Please set up environment variables.");
}

/**
 * Supabase Database Service
 * Handles all database operations using Supabase
 */

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

    return (
      data?.map((course) => ({
        id: course.id,
        title: course.title,
        description: course.description,
        category: course.category,
        level: course.level,
        duration: course.duration,
        instructor: "", // Will be populated via join if needed
        instructorId: course.instructor_id,
        thumbnail: course.thumbnail || undefined,
        isTESDAAccredited: course.is_tesda_accredited,
        skills: course.skills,
        enrolledCount: course.enrolled_count,
        rating: course.rating,
        createdAt: course.created_at,
      })) || []
    );
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

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category,
      level: data.level,
      duration: data.duration,
      instructor: "", // Will be populated via join if needed
      instructorId: data.instructor_id,
      thumbnail: data.thumbnail || undefined,
      isTESDAAccredited: data.is_tesda_accredited,
      skills: data.skills,
      enrolledCount: data.enrolled_count,
      rating: data.rating,
      createdAt: data.created_at,
    };
  },

  /**
   * Create a new course
   */
  createCourse: async (course: Omit<Course, "id" | "createdAt" | "enrolledCount" | "rating">): Promise<Course> => {
    const { data, error } = await supabase
      .from("courses")
      .insert({
        title: course.title,
        description: course.description,
        category: course.category,
        level: course.level,
        duration: course.duration,
        instructor_id: course.instructorId,
        thumbnail: course.thumbnail || null,
        is_tesda_accredited: course.isTESDAAccredited,
        skills: course.skills,
        enrolled_count: 0,
        rating: 0,
        certificate_type: "completion",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category,
      level: data.level,
      duration: data.duration,
      instructor: course.instructor,
      instructorId: data.instructor_id,
      thumbnail: data.thumbnail || undefined,
      isTESDAAccredited: data.is_tesda_accredited,
      skills: data.skills,
      enrolledCount: data.enrolled_count,
      rating: data.rating,
      createdAt: data.created_at,
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
    if (updates.isTESDAAccredited !== undefined) updateData.is_tesda_accredited = updates.isTESDAAccredited;
    if (updates.skills !== undefined) updateData.skills = updates.skills;

    const { data, error } = await supabase
      .from("courses")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category,
      level: data.level,
      duration: data.duration,
      instructor: updates.instructor || "",
      instructorId: data.instructor_id,
      thumbnail: data.thumbnail || undefined,
      isTESDAAccredited: data.is_tesda_accredited,
      skills: data.skills,
      enrolledCount: data.enrolled_count,
      rating: data.rating,
      createdAt: data.created_at,
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
      .select("*")
      .eq("course_id", courseId)
      .order("order", { ascending: true });

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (
      data?.map((module) => ({
        id: module.id,
        course_id: module.course_id,
        title: module.title,
        description: module.description,
        order: module.order,
        content: module.content || undefined,
        materials: module.materials || [],
        prerequisites: module.prerequisites || [],
        created_at: module.created_at,
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
      materials: data.materials || [],
      prerequisites: data.prerequisites || [],
      created_at: data.created_at,
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
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return {
      id: data.id,
      course_id: data.course_id,
      title: data.title,
      description: data.description,
      order: data.order,
      content: data.content || undefined,
      materials: data.materials || [],
      prerequisites: data.prerequisites || [],
      created_at: data.created_at,
    };
  },

  /**
   * Update a module
   */
  updateModule: async (id: string, updates: Partial<Module>): Promise<Module> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const updateData: any = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.order !== undefined) updateData.order = updates.order;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.materials !== undefined) updateData.materials = updates.materials;
    if (updates.prerequisites !== undefined) updateData.prerequisites = updates.prerequisites;

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

    return {
      id: data.id,
      course_id: data.course_id,
      title: data.title,
      description: data.description,
      order: data.order,
      content: data.content || undefined,
      materials: data.materials || [],
      prerequisites: data.prerequisites || [],
      created_at: data.created_at,
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
      .select("id")
      .eq("enrollment_id", enrollmentId)
      .eq("module_id", moduleId)
      .single();

    if (existing) {
      // Update time spent if provided
      if (timeSpent !== undefined) {
        await supabase
          .from("module_completions")
          .update({ time_spent: timeSpent })
          .eq("id", existing.id);
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
      .eq("enrollment_id", enrollmentId);

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
    let query = supabase.from("enrollments").select("*").order("enrolled_at", { ascending: false });

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (
      data?.map((enrollment) => ({
        id: enrollment.id,
        userId: enrollment.user_id,
        courseId: enrollment.course_id,
        progress: enrollment.progress,
        status: enrollment.status,
        enrolledAt: enrollment.enrolled_at,
        completedAt: enrollment.completed_at || undefined,
        certificateId: enrollment.certificate_id || undefined,
      })) || []
    );
  },

  /**
   * Enroll a user in a course
   */
  enrollInCourse: async (userId: string, courseId: string): Promise<Enrollment> => {
    const { data, error } = await supabase
      .from("enrollments")
      .insert({
        user_id: userId,
        course_id: courseId,
        progress: 0,
        status: "enrolled",
        enrolled_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
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

    return {
      id: data.id,
      userId: data.user_id,
      courseId: data.course_id,
      progress: data.progress,
      status: data.status,
      enrolledAt: data.enrolled_at,
      completedAt: data.completed_at || undefined,
      certificateId: data.certificate_id || undefined,
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
      .select("course_id, user_id, progress")
      .eq("id", enrollmentId)
      .single();

    if (!enrollment) {
      throw new Error("Enrollment not found");
    }

    // If not preserving progress, delete the enrollment
    // Otherwise, mark as dropped but keep the record
    if (preserveProgress) {
      await supabase
        .from("enrollments")
        .update({ status: "dropped" })
        .eq("id", enrollmentId);
    } else {
      // Delete the enrollment
      const { error } = await supabase
        .from("enrollments")
        .delete()
        .eq("id", enrollmentId);

      if (error) {
        handleSupabaseError(error);
        throw error;
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
      data?.map((item) => ({
        id: item.id,
        userId: item.user_id,
        courseId: item.course_id,
        progress: item.progress,
        status: item.status,
        enrolledAt: item.enrolled_at,
        completedAt: item.completed_at || undefined,
        certificateId: item.certificate_id || undefined,
        userName: item.users?.name,
        userEmail: item.users?.email,
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
      .select("*, courses(title)")
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
      data?.map((cert) => ({
        id: cert.id,
        userId: cert.user_id,
        courseId: cert.course_id,
        courseTitle: (cert.courses as any)?.title || "",
        issuedAt: cert.issued_at,
        certificateNumber: cert.certificate_number,
        certificateType: cert.certificate_type,
        verificationCode: cert.verification_code,
      })) || []
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

// Job operations
export const jobService = {
  /**
   * Get all jobs
   */
  getJobs: async (): Promise<Job[]> => {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("posted_at", { ascending: false });

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (
      data?.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        type: job.type,
        salary: job.salary || undefined,
        description: job.description,
        requirements: job.requirements,
        skills: job.skills,
        postedBy: job.posted_by,
        postedAt: job.posted_at,
        status: job.status,
      })) || []
    );
  },

  /**
   * Get a single job by ID
   */
  getJob: async (id: string): Promise<Job | null> => {
    const { data, error } = await supabase.from("jobs").select("*").eq("id", id).single();

    if (error) {
      handleSupabaseError(error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      title: data.title,
      company: data.company,
      location: data.location,
      type: data.type,
      salary: data.salary || undefined,
      description: data.description,
      requirements: data.requirements,
      skills: data.skills,
      postedBy: data.posted_by,
      postedAt: data.posted_at,
      status: data.status,
    };
  },

  /**
   * Create a new job posting
   */
  createJob: async (job: Omit<Job, "id" | "postedAt">): Promise<Job> => {
    const { data, error } = await supabase
      .from("jobs")
      .insert({
        title: job.title,
        company: job.company,
        location: job.location,
        type: job.type,
        salary: job.salary || null,
        description: job.description,
        requirements: job.requirements,
        skills: job.skills,
        posted_by: job.postedBy,
        posted_at: new Date().toISOString(),
        status: job.status || "open",
      })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return {
      id: data.id,
      title: data.title,
      company: data.company,
      location: data.location,
      type: data.type,
      salary: data.salary || undefined,
      description: data.description,
      requirements: data.requirements,
      skills: data.skills,
      postedBy: data.posted_by,
      postedAt: data.posted_at,
      status: data.status,
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
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (
      data?.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as User["role"],
        avatar: user.avatar || undefined,
        phone: user.phone || undefined,
        address: user.address || undefined,
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
      .single();

    if (error) {
      handleSupabaseError(error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as User["role"],
      avatar: data.avatar || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      skills: data.skills || undefined,
      createdAt: data.created_at,
    };
  },

  /**
   * Update user role and details
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
    if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
    if (updates.skills !== undefined) updateData.skills = updates.skills;
    if (updates.role !== undefined) updateData.role = updates.role;

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
      role: data.role as User["role"],
      avatar: data.avatar || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      skills: data.skills || undefined,
      createdAt: data.created_at,
    };
  },
};

