import { supabase, handleSupabaseError } from "@/lib/supabase";
import { resolveCourseMaterialUrl, resolveCourseMaterialUrls } from "@/lib/courseAssets";
import { buildCanonicalCourseTaxonomy, canonicalizeCourseCategory, deriveSkillTags, deriveTopicTags } from "@/lib/taxonomy";
import { analyticsService } from "@/services/analyticsService";
import {
  Course,
  Enrollment,
  Certificate,
  CourseTrainerSummary,
  Module,
  Program,
  EnrollmentProgressDetail,
} from "@/types";
import { User, normalizeUserRole } from "@/types/auth";
import { notificationHelpers, notificationService } from "@/services/notificationService";
import { getBlockingModules } from "@/lib/moduleProgress";

if (!supabase) {
  console.warn("Supabase client not initialized. Please set up environment variables.");
}

export type EnrollmentErrorCode =
  | "already_enrolled"
  | "course_unavailable"
  | "verification_pending"
  | "verification_rejected"
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

type EnrollmentCompletionState = {
  progress: number;
  totalModules: number;
  completedModules: number;
  requiredAssessmentCount: number;
  passedAssessmentCount: number;
  isCourseComplete: boolean;
};

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const REQUEST_CACHE_TTL_MS = 60_000;
const COURSE_SELECT_FIELDS = "id, title, description, program_id, category, level, duration, instructor, instructor_id, thumbnail, course_document, is_tesda_accredited, skills, skill_tags, topic_tags, industry_tags, career_paths, enrolled_count, rating, created_at, published";
const MODULE_SUMMARY_SELECT_FIELDS = "id, course_id, title, description, order, materials, prerequisites, skill_tags, topic_tags, module_thumbnail, module_document, created_at, updated_at, status";
const MODULE_FULL_SELECT_FIELDS = `${MODULE_SUMMARY_SELECT_FIELDS}, content`;

const unsupportedCourseReadColumns = new Set<string>();
const unsupportedModuleReadColumns = new Set<string>();

let courseListCache: CacheEntry<Course[]> | null = null;
let pendingCourseListRequest: Promise<Course[]> | null = null;
const courseCacheById = new Map<string, CacheEntry<Course | null>>();
const pendingCourseRequests = new Map<string, Promise<Course | null>>();
const moduleListCacheByKey = new Map<string, CacheEntry<Module[]>>();
const pendingModuleListRequests = new Map<string, Promise<Module[]>>();
const moduleCacheById = new Map<string, CacheEntry<Module | null>>();
const pendingModuleRequests = new Map<string, Promise<Module | null>>();
const moduleCountCacheByCourseId = new Map<string, CacheEntry<number>>();
const pendingModuleCountRequests = new Map<string, Promise<number>>();

const getCachedEntry = <T>(entry: CacheEntry<T> | null | undefined): T | null => {
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }

  return entry.data;
};

const setCacheEntry = <T>(data: T): CacheEntry<T> => ({
  data,
  expiresAt: Date.now() + REQUEST_CACHE_TTL_MS,
});

const invalidateCourseCaches = (courseId?: string) => {
  courseListCache = null;
  pendingCourseListRequest = null;

  if (courseId) {
    courseCacheById.delete(courseId);
    pendingCourseRequests.delete(courseId);
    return;
  }

  courseCacheById.clear();
  pendingCourseRequests.clear();
};

const invalidateModuleCaches = (courseId?: string, moduleId?: string) => {
  if (courseId) {
    moduleListCacheByKey.delete(`${courseId}:full`);
    moduleListCacheByKey.delete(`${courseId}:summary`);
    pendingModuleListRequests.delete(`${courseId}:full`);
    pendingModuleListRequests.delete(`${courseId}:summary`);
    moduleCountCacheByCourseId.delete(courseId);
    pendingModuleCountRequests.delete(courseId);
  } else {
    moduleListCacheByKey.clear();
    pendingModuleListRequests.clear();
    moduleCountCacheByCourseId.clear();
    pendingModuleCountRequests.clear();
  }

  if (moduleId) {
    moduleCacheById.delete(moduleId);
    pendingModuleRequests.delete(moduleId);
  } else if (!courseId) {
    moduleCacheById.clear();
    pendingModuleRequests.clear();
  }
};

const createEnrollmentError = (feedback: EnrollmentErrorFeedback): EnrollmentErrorWithFeedback => {
  const error = new Error(feedback.description) as EnrollmentErrorWithFeedback;
  error.name = "EnrollmentError";
  error.code = feedback.code;
  error.feedback = feedback;
  return error;
};

export const isTraineeEnrollmentBlocked = (
  user?: Pick<User, "role" | "verificationStatus"> | null,
): boolean => user?.role === "trainee" && (user.verificationStatus ?? "pending") !== "verified";

export const getTraineeEnrollmentVerificationFeedback = (
  status?: User["verificationStatus"],
  courseTitle?: string,
): EnrollmentErrorFeedback => buildEnrollmentErrorFeedback(
  status === "rejected" ? "verification_rejected" : "verification_pending",
  courseTitle,
);

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
    case "verification_pending":
      return {
        code,
        title: "Verification pending",
        description: `Your trainee account is still waiting for admin or trainer approval, so enrollment stays locked${courseLabel}. You can keep browsing courses and update your profile while verification is in progress.`,
        toastMessage: "Your account is pending verification. Enrollment is still locked.",
        canRetry: false,
        suggestedActions: ["profile", "browse"],
      };
    case "verification_rejected":
      return {
        code,
        title: "Verification rejected",
        description: `Your trainee verification was rejected, so enrollment stays locked${courseLabel}. Review your profile details or contact the training team before trying again.`,
        toastMessage: "Your verification was rejected. Update your details before enrolling.",
        canRetry: false,
        suggestedActions: ["profile", "browse"],
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
    code === "verification_pending" ||
    normalizedMessage.includes("pending verification") ||
    normalizedMessage.includes("pending approval")
  ) {
    return buildEnrollmentErrorFeedback("verification_pending", courseTitle);
  }

  if (
    code === "verification_rejected" ||
    normalizedMessage.includes("verification rejected") ||
    normalizedMessage.includes("verification was rejected")
  ) {
    return buildEnrollmentErrorFeedback("verification_rejected", courseTitle);
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

  const { data: aggregatedCounts, error: aggregateError } = await supabase.rpc("get_course_enrollment_counts", {
    course_ids: courseIds,
  });

  if (!aggregateError && Array.isArray(aggregatedCounts)) {
    const counts = new Map<string, number>();

    for (const row of aggregatedCounts as Array<{ course_id: string | null; enrollment_count: number | string | null }>) {
      if (!row.course_id) {
        continue;
      }

      const parsedCount = typeof row.enrollment_count === "number"
        ? row.enrollment_count
        : Number(row.enrollment_count || 0);

      counts.set(row.course_id, Number.isFinite(parsedCount) ? parsedCount : 0);
    }

    return counts;
  }

  const { data, error } = await supabase
    .from("enrollments")
    .select("course_id")
    .in("course_id", courseIds)
    .neq("status", "dropped");

  if (error) {
    console.warn("Failed to load live enrollment counts for courses:", aggregateError || error);
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

const resolveCurrentProfileId = async (): Promise<string | null> => {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc("get_current_user_profile_id");

    if (error) {
      return null;
    }

    return typeof data === "string" && data.length > 0 ? data : null;
  } catch {
    return null;
  }
};

const isMissingRpcDefinitionError = (error: { code?: string; message?: string } | null | undefined): boolean => {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() || "";

  return error.code === "PGRST202"
    || error.code === "42883"
    || message.includes("could not find the function")
    || message.includes("function public.delete_course")
    || message.includes("undefined function");
};

const isPermissionPolicyError = (error: { code?: string; message?: string } | null | undefined): boolean => {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() || "";

  return error.code === "42501"
    || message.includes("row-level security")
    || message.includes("permission")
    || message.includes("policy")
    || message.includes("forbidden")
    || message.includes("unauthorized");
};

const loadProgramsById = async (programIds: string[]): Promise<Map<string, Program>> => {
  if (!supabase || programIds.length === 0) {
    return new Map();
  }

  const uniqueProgramIds = Array.from(new Set(programIds.filter(Boolean)));
  if (uniqueProgramIds.length === 0) {
    return new Map();
  }

  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select("id, title, description, category, created_by, created_at, updated_at")
    .in("id", uniqueProgramIds);

  if (programsError) {
    console.warn("Failed to load programs for courses:", programsError);
    return new Map();
  }

  const { data: courseRows, error: courseRowsError } = await supabase
    .from("courses")
    .select("program_id")
    .in("program_id", uniqueProgramIds as string[]);

  if (courseRowsError) {
    console.warn("Failed to load course counts for programs:", courseRowsError);
  }

  const courseCountByProgramId = new Map<string, number>();
  for (const row of courseRows || []) {
    const programId = row.program_id;
    if (!programId) continue;
    courseCountByProgramId.set(programId, (courseCountByProgramId.get(programId) || 0) + 1);
  }

  return new Map(
    (programs || []).map((program) => [
      program.id,
      {
        id: program.id,
        title: program.title,
        description: program.description || "",
        category: program.category || null,
        createdBy: program.created_by || null,
        courseCount: courseCountByProgramId.get(program.id) || 0,
        createdAt: program.created_at,
        updatedAt: program.updated_at,
      } satisfies Program,
    ]),
  );
};

const buildCourseTrainerSummary = (
  trainerRecord?: { id: string; name: string | null; email: string | null; role?: string | null } | null,
  fallbackInstructor?: string | null,
): CourseTrainerSummary => {
  const normalizedRole = normalizeUserRole(trainerRecord?.role);
  const roleLabel = normalizedRole === "trainer" ? "Trainer" : "Training Team";
  const profileName = trainerRecord?.name?.trim() || "";
  const fallbackName = fallbackInstructor?.trim() || "";

  return {
    id: trainerRecord?.id || null,
    displayName: profileName || fallbackName || "PESO Training Team",
    roleLabel,
    email: trainerRecord?.email || null,
  };
};

const loadCourseTrainersById = async (trainerIds: string[], fallbackNames?: Map<string, string>): Promise<Map<string, CourseTrainerSummary>> => {
  if (!supabase || trainerIds.length === 0) {
    return new Map();
  }

  const uniqueTrainerIds = Array.from(new Set(trainerIds.filter(Boolean)));
  if (uniqueTrainerIds.length === 0) {
    return new Map();
  }

  const { data: trainerRows, error } = await supabase
    .from("users")
    .select("id, name, email, role")
    .in("id", uniqueTrainerIds);

  if (error) {
    console.warn("Failed to load trainer profiles for courses:", error);
    return new Map(
      uniqueTrainerIds.map((id) => [id, buildCourseTrainerSummary(null, fallbackNames?.get(id) || null)]),
    );
  }

  const trainerMap = new Map<string, CourseTrainerSummary>();
  for (const trainer of trainerRows || []) {
    trainerMap.set(
      trainer.id,
      buildCourseTrainerSummary(trainer, fallbackNames?.get(trainer.id) || null),
    );
  }

  for (const trainerId of uniqueTrainerIds) {
    if (!trainerMap.has(trainerId)) {
      trainerMap.set(trainerId, buildCourseTrainerSummary(null, fallbackNames?.get(trainerId) || null));
    }
  }

  return trainerMap;
};

const mapModuleRecord = (module: any, includeContent = true): Module => ({
  id: module.id,
  course_id: module.course_id,
  title: module.title,
  description: module.description,
  order: module.order,
  content: includeContent ? module.content || undefined : undefined,
  materials: resolveCourseMaterialUrls(module.materials),
  prerequisites: module.prerequisites || [],
  skillTags: module.skill_tags || [],
  topicTags: module.topic_tags || [],
  module_thumbnail: resolveCourseMaterialUrl(module.module_thumbnail),
  module_document: resolveCourseMaterialUrl(module.module_document),
  created_at: module.created_at,
  updated_at: module.updated_at || module.created_at,
  status: (module.status === "finalized" ? "finalized" : "draft") as Module["status"],
});

const mapCourseRecord = (
  course: any,
  liveEnrollmentCounts?: Map<string, number>,
  programsById?: Map<string, Program>,
  trainersById?: Map<string, CourseTrainerSummary>,
): Course => ({
  id: course.id,
  title: course.title,
  description: course.description,
  programId: course.program_id || null,
  programTitle: programsById?.get(course.program_id || "")?.title || null,
  category: canonicalizeCourseCategory(course.category) || course.category,
  level: course.level,
  duration: course.duration,
  instructor: trainersById?.get(course.instructor_id || "")?.displayName || course.instructor || "PESO Training Team",
  instructorId: course.instructor_id,
  assignedTrainer: trainersById?.get(course.instructor_id || "") || buildCourseTrainerSummary(null, course.instructor || null),
  thumbnail: resolveCourseMaterialUrl(course.thumbnail),
  courseDocument: resolveCourseMaterialUrl(course.course_document),
  isTESDAAccredited: course.is_tesda_accredited,
  skills: deriveSkillTags(course.category, course.skill_tags || course.skills),
  topicTags: deriveTopicTags(course.category, course.skill_tags || course.skills, course.topic_tags || []),
  industryTags: course.industry_tags || [],
  careerPaths: course.career_paths || [],
  enrolledCount: liveEnrollmentCounts?.get(course.id) ?? course.enrolled_count ?? 0,
  rating: course.rating,
  createdAt: course.created_at,
  published: course.published ?? true,
});

const unsupportedCourseColumns = new Set<string>();
const unsupportedModuleColumns = new Set<string>();

const normalizeMissingColumnName = (columnName: string | null | undefined): string | null => {
  const normalized = String(columnName || "")
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/^'|'$/g, "");

  if (!normalized) {
    return null;
  }

  const segments = normalized.split(".").filter(Boolean);
  return segments[segments.length - 1] || normalized;
};

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
    return normalizeMissingColumnName(schemaCacheMatch[1]);
  }

  const postgresMatch = haystack.match(/column\s+"([^"]+)"\s+does not exist/i);
  if (postgresMatch?.[1]) {
    return normalizeMissingColumnName(postgresMatch[1]);
  }

  const unquotedPostgresMatch = haystack.match(/column\s+([a-zA-Z0-9_.]+)\s+does not exist/i);
  if (unquotedPostgresMatch?.[1]) {
    return normalizeMissingColumnName(unquotedPostgresMatch[1]);
  }

  return null;
};

const buildSelectWithFallback = (baseSelect: string, unsupportedColumns: Set<string>) => {
  const fields = baseSelect
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean)
    .filter((field) => !unsupportedColumns.has(field));

  return fields.length > 0 ? fields.join(", ") : "*";
};

const executeCourseReadWithFallback = async <T>(
  execute: (selectClause: string) => Promise<{ data: T | null; error: any }>,
  selectClause: string,
): Promise<{ data: T | null; error: any }> => {
  let nextSelect = buildSelectWithFallback(selectClause, unsupportedCourseReadColumns);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await execute(nextSelect);
    if (!result.error) {
      return result;
    }

    const missingColumn = getMissingCourseColumn(result.error);
    if (!missingColumn) {
      return result;
    }

    unsupportedCourseReadColumns.add(missingColumn);
    nextSelect = buildSelectWithFallback(selectClause, unsupportedCourseReadColumns);
  }

  return execute("*");
};

const getMissingModuleColumn = (error: unknown): string | null => {
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: string }).message || "")
    : "";
  const details = typeof error === "object" && error !== null && "details" in error
    ? String((error as { details?: string }).details || "")
    : "";
  const haystack = `${message} ${details}`;

  const schemaCacheMatch = haystack.match(/'([^']+)' column of 'modules'/i);
  if (schemaCacheMatch?.[1]) {
    return normalizeMissingColumnName(schemaCacheMatch[1]);
  }

  const postgresMatch = haystack.match(/column\s+"([^"]+)"\s+does not exist/i);
  if (postgresMatch?.[1]) {
    return normalizeMissingColumnName(postgresMatch[1]);
  }

  const unquotedPostgresMatch = haystack.match(/column\s+([a-zA-Z0-9_.]+)\s+does not exist/i);
  if (unquotedPostgresMatch?.[1]) {
    return normalizeMissingColumnName(unquotedPostgresMatch[1]);
  }

  return null;
};

const executeModuleReadWithFallback = async <T>(
  execute: (selectClause: string) => Promise<{ data: T | null; error: any }>,
  selectClause: string,
): Promise<{ data: T | null; error: any }> => {
  let nextSelect = buildSelectWithFallback(selectClause, unsupportedModuleReadColumns);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await execute(nextSelect);
    if (!result.error) {
      return result;
    }

    const missingColumn = getMissingModuleColumn(result.error);
    if (!missingColumn) {
      return result;
    }

    unsupportedModuleReadColumns.add(missingColumn);
    nextSelect = buildSelectWithFallback(selectClause, unsupportedModuleReadColumns);
  }

  return execute("*");
};

const sanitizeCourseWritePayload = (payload: Record<string, unknown>) => {
  const nextPayload = { ...payload };

  for (const column of unsupportedCourseColumns) {
    delete nextPayload[column];
  }

  return nextPayload;
};

const sanitizeModuleWritePayload = (payload: Record<string, unknown>) => {
  const nextPayload = { ...payload };

  for (const column of unsupportedModuleColumns) {
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

const executeModuleWriteWithFallback = async <T>(
  execute: (payload: Record<string, unknown>) => Promise<{ data: T | null; error: any }>,
  payload: Record<string, unknown>,
): Promise<{ data: T | null; error: any }> => {
  let nextPayload = sanitizeModuleWritePayload(payload);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await execute(nextPayload);
    if (!result.error) {
      return result;
    }

    const missingColumn = getMissingModuleColumn(result.error);
    if (!missingColumn || !(missingColumn in nextPayload)) {
      return result;
    }

    unsupportedModuleColumns.add(missingColumn);
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

    const cachedCourses = getCachedEntry(courseListCache);
    if (cachedCourses) {
      return cachedCourses;
    }

    if (pendingCourseListRequest) {
      return pendingCourseListRequest;
    }

    pendingCourseListRequest = (async () => {
      const { data, error } = await executeCourseReadWithFallback(
        (selectClause) => supabase
          .from("courses")
          .select(selectClause)
          .order("created_at", { ascending: false }),
        COURSE_SELECT_FIELDS,
      );

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      const courseRows = data || [];
      const trainerFallbackNames = new Map(
        courseRows
          .filter((course) => course.instructor_id)
          .map((course) => [course.instructor_id, String(course.instructor || "")]),
      );

      const [liveEnrollmentCounts, programsById, trainersById] = await Promise.all([
        loadActiveEnrollmentCounts(courseRows.map((course) => course.id)),
        loadProgramsById(courseRows.map((course) => course.program_id).filter(Boolean)),
        loadCourseTrainersById(courseRows.map((course) => course.instructor_id).filter(Boolean), trainerFallbackNames),
      ]);

      const mappedCourses = courseRows.map((course) => mapCourseRecord(course, liveEnrollmentCounts, programsById, trainersById));
      courseListCache = setCacheEntry(mappedCourses);
      for (const mappedCourse of mappedCourses) {
        courseCacheById.set(mappedCourse.id, setCacheEntry(mappedCourse));
      }

      return mappedCourses;
    })();

    try {
      return await pendingCourseListRequest;
    } finally {
      pendingCourseListRequest = null;
    }
  },

  /**
   * Get a single course by ID
   */
  getCourse: async (id: string): Promise<Course | null> => {
    const cachedCourse = getCachedEntry(courseCacheById.get(id));
    if (cachedCourse) {
      return cachedCourse;
    }

    const pendingRequest = pendingCourseRequests.get(id);
    if (pendingRequest) {
      return pendingRequest;
    }

    const request = (async () => {
      const { data, error } = await executeCourseReadWithFallback(
        (selectClause) => supabase
          .from("courses")
          .select(selectClause)
          .eq("id", id)
          .single(),
        COURSE_SELECT_FIELDS,
      );

      if (error) {
        handleSupabaseError(error);
        return null;
      }

      if (!data) return null;

      const [liveEnrollmentCounts, programsById, trainersById] = await Promise.all([
        loadActiveEnrollmentCounts([data.id]),
        loadProgramsById(data.program_id ? [data.program_id] : []),
        loadCourseTrainersById(
          data.instructor_id ? [data.instructor_id] : [],
          new Map(data.instructor_id ? [[data.instructor_id, String(data.instructor || "")]] : []),
        ),
      ]);
      const enrolledCount = liveEnrollmentCounts.get(data.id) ?? data.enrolled_count ?? 0;
      const mappedCourse = mapCourseRecord({ ...data, enrolled_count: enrolledCount }, undefined, programsById, trainersById);
      courseCacheById.set(id, setCacheEntry(mappedCourse));
      return mappedCourse;
    })();

    pendingCourseRequests.set(id, request);

    try {
      return await request;
    } finally {
      pendingCourseRequests.delete(id);
    }
  },

  /**
   * Create a new course
   */
  createCourse: async (course: Omit<Course, "id" | "createdAt" | "enrolledCount" | "rating">): Promise<Course> => {
    const canonicalTaxonomy = buildCanonicalCourseTaxonomy({
      category: course.category,
      skills: course.skills,
      topicTags: course.topicTags,
    });

    const insertPayload = {
      title: course.title,
      description: course.description,
      category: canonicalTaxonomy.category || course.category,
      level: course.level,
      duration: course.duration,
      instructor_id: course.instructorId,
      thumbnail: course.thumbnail || null,
      course_document: course.courseDocument || null,
      is_tesda_accredited: course.isTESDAAccredited,
      skills: canonicalTaxonomy.skillTags,
      skill_tags: canonicalTaxonomy.skillTags,
      topic_tags: canonicalTaxonomy.topicTags,
      industry_tags: course.industryTags || [],
      career_paths: course.careerPaths || [],
      enrolled_count: 0,
      rating: 0,
      certificate_type: "completion",
      published: course.published ?? true,
      program_id: course.programId || null,
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

    const trainersById = await loadCourseTrainersById(
      data.instructor_id ? [data.instructor_id] : [],
      new Map(data.instructor_id ? [[data.instructor_id, course.instructor || ""]] : []),
    );

    invalidateCourseCaches();

    return {
      ...mapCourseRecord(data, undefined, undefined, trainersById),
      instructor: course.instructor || trainersById.get(data.instructor_id || "")?.displayName || "PESO Training Team",
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
    if (updates.category !== undefined) updateData.category = canonicalizeCourseCategory(updates.category) || updates.category;
    if (updates.level !== undefined) updateData.level = updates.level;
    if (updates.duration !== undefined) updateData.duration = updates.duration;
    if (updates.instructorId !== undefined) updateData.instructor_id = updates.instructorId;
    if (updates.thumbnail !== undefined) updateData.thumbnail = updates.thumbnail;
    if (updates.courseDocument !== undefined) updateData.course_document = updates.courseDocument;
    if (updates.isTESDAAccredited !== undefined) updateData.is_tesda_accredited = updates.isTESDAAccredited;
    if (updates.skills !== undefined) {
      const canonicalSkillTags = deriveSkillTags(updates.category, updates.skills);
      updateData.skills = canonicalSkillTags;
      updateData.skill_tags = canonicalSkillTags;
    }
    if (updates.topicTags !== undefined) {
      updateData.topic_tags = deriveTopicTags(updates.category, updates.skills, updates.topicTags);
    }
    if (updates.industryTags !== undefined) updateData.industry_tags = updates.industryTags;
    if (updates.careerPaths !== undefined) updateData.career_paths = updates.careerPaths;
    if (updates.published !== undefined) updateData.published = updates.published;
    if (updates.programId !== undefined) updateData.program_id = updates.programId;

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

    const trainersById = await loadCourseTrainersById(
      data.instructor_id ? [data.instructor_id] : [],
      new Map(data.instructor_id ? [[data.instructor_id, updates.instructor || ""]] : []),
    );

    invalidateCourseCaches(id);

    return {
      ...mapCourseRecord(data, undefined, undefined, trainersById),
      instructor: updates.instructor || trainersById.get(data.instructor_id || "")?.displayName || "PESO Training Team",
    };
  },

  /**
   * Delete a course
   */
  deleteCourse: async (id: string): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { error: rpcError } = await supabase.rpc("delete_course", {
      p_course_id: id,
    });

    if (rpcError && !isMissingRpcDefinitionError(rpcError)) {
      handleSupabaseError(rpcError);
      throw rpcError;
    }

    if (rpcError) {
      const { error } = await supabase.from("courses").delete().eq("id", id);

      if (error) {
        if (isPermissionPolicyError(error)) {
          throw new Error("Course deletion is blocked by Supabase policies. Apply supabase/manual_fixes/055_add_delete_course_rpc.sql in the Supabase SQL Editor, then try again.");
        }

        handleSupabaseError(error);
        throw error;
      }
    }

    invalidateCourseCaches(id);
    invalidateModuleCaches();
  },
};

export const programService = {
  getPrograms: async (): Promise<Program[]> => {
    if (!supabase) return [];

    const { data: programs, error } = await supabase
      .from("programs")
      .select("id, title, description, category, created_by, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Failed to load programs:", error);
      return [];
    }

    const courseCountsByProgramId = await loadProgramsById((programs || []).map((program) => program.id));

    return (programs || []).map((program) => ({
      id: program.id,
      title: program.title,
      description: program.description || "",
      category: program.category || null,
      createdBy: program.created_by || null,
      courseCount: courseCountsByProgramId.get(program.id)?.courseCount || 0,
      createdAt: program.created_at,
      updatedAt: program.updated_at,
    }));
  },

  createProgram: async (program: Omit<Program, "id" | "courseCount" | "createdAt" | "updatedAt">): Promise<Program> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { data, error } = await supabase
      .from("programs")
      .insert({
        title: program.title,
        description: program.description,
        category: program.category || null,
        created_by: program.createdBy || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, title, description, category, created_by, created_at, updated_at")
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return {
      id: data.id,
      title: data.title,
      description: data.description || "",
      category: data.category || null,
      createdBy: data.created_by || null,
      courseCount: 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  updateProgram: async (id: string, updates: Partial<Program>): Promise<Program> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) updatePayload.title = updates.title;
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.category !== undefined) updatePayload.category = updates.category || null;

    const { data, error } = await supabase
      .from("programs")
      .update(updatePayload)
      .eq("id", id)
      .select("id, title, description, category, created_by, created_at, updated_at")
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    const programsById = await loadProgramsById([data.id]);
    return programsById.get(data.id) || {
      id: data.id,
      title: data.title,
      description: data.description || "",
      category: data.category || null,
      createdBy: data.created_by || null,
      courseCount: 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  deleteProgram: async (id: string): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { error } = await supabase.from("programs").delete().eq("id", id);
    if (error) {
      handleSupabaseError(error);
      throw error;
    }
  },
};

// Module operations
export const moduleService = {
  getModulesByCourseSummary: async (courseId: string): Promise<Module[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    const cacheKey = `${courseId}:summary`;
    const cachedModules = getCachedEntry(moduleListCacheByKey.get(cacheKey));
    if (cachedModules) {
      return cachedModules;
    }

    const pendingRequest = pendingModuleListRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    const request = (async () => {
      const { data, error } = await executeModuleReadWithFallback(
        (selectClause) => supabase
          .from("modules")
          .select(selectClause)
          .eq("course_id", courseId)
          .order("order", { ascending: true }),
        MODULE_SUMMARY_SELECT_FIELDS,
      );

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      const mappedModules = (data || []).map((module: any) => mapModuleRecord(module, false));
      moduleListCacheByKey.set(cacheKey, setCacheEntry(mappedModules));
      return mappedModules;
    })();

    pendingModuleListRequests.set(cacheKey, request);

    try {
      return await request;
    } finally {
      pendingModuleListRequests.delete(cacheKey);
    }
  },

  getModuleCountByCourse: async (courseId: string): Promise<number> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return 0;
    }

    const cachedCount = getCachedEntry(moduleCountCacheByCourseId.get(courseId));
    if (cachedCount !== null) {
      return cachedCount;
    }

    const pendingRequest = pendingModuleCountRequests.get(courseId);
    if (pendingRequest) {
      return pendingRequest;
    }

    const request = (async () => {
      const { count, error } = await supabase
        .from("modules")
        .select("id", { count: "exact", head: true })
        .eq("course_id", courseId);

      if (error) {
        handleSupabaseError(error);
        return 0;
      }

      const total = count || 0;
      moduleCountCacheByCourseId.set(courseId, setCacheEntry(total));
      return total;
    })();

    pendingModuleCountRequests.set(courseId, request);

    try {
      return await request;
    } finally {
      pendingModuleCountRequests.delete(courseId);
    }
  },

  /**
   * Get all modules for a course
   */
  getModulesByCourse: async (courseId: string): Promise<Module[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    const cacheKey = `${courseId}:full`;
    const cachedModules = getCachedEntry(moduleListCacheByKey.get(cacheKey));
    if (cachedModules) {
      return cachedModules;
    }

    const pendingRequest = pendingModuleListRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    const request = (async () => {
      const { data, error } = await executeModuleReadWithFallback(
        (selectClause) => supabase
          .from("modules")
          .select(selectClause)
          .eq("course_id", courseId)
          .order("order", { ascending: true }),
        MODULE_FULL_SELECT_FIELDS,
      );

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      const mappedModules = (data || []).map((module: any) => mapModuleRecord(module));
      moduleListCacheByKey.set(cacheKey, setCacheEntry(mappedModules));
      moduleListCacheByKey.set(
        `${courseId}:summary`,
        setCacheEntry(mappedModules.map((module) => ({ ...module, content: undefined }))),
      );
      for (const module of mappedModules) {
        moduleCacheById.set(module.id, setCacheEntry(module));
      }
      moduleCountCacheByCourseId.set(courseId, setCacheEntry(mappedModules.length));

      return mappedModules;
    })();

    pendingModuleListRequests.set(cacheKey, request);

    try {
      return await request;
    } finally {
      pendingModuleListRequests.delete(cacheKey);
    }
  },

  /**
   * Get a single module by ID
   */
  getModule: async (id: string): Promise<Module | null> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return null;
    }

    const cachedModule = getCachedEntry(moduleCacheById.get(id));
    if (cachedModule) {
      return cachedModule;
    }

    const pendingRequest = pendingModuleRequests.get(id);
    if (pendingRequest) {
      return pendingRequest;
    }

    const request = (async () => {
      const { data, error } = await executeModuleReadWithFallback(
        (selectClause) => supabase
          .from("modules")
          .select(selectClause)
          .eq("id", id)
          .single(),
        MODULE_FULL_SELECT_FIELDS,
      );

      if (error) {
        handleSupabaseError(error);
        return null;
      }

      if (!data) return null;

      const mappedModule = mapModuleRecord(data);
      moduleCacheById.set(id, setCacheEntry(mappedModule));
      return mappedModule;
    })();

    pendingModuleRequests.set(id, request);

    try {
      return await request;
    } finally {
      pendingModuleRequests.delete(id);
    }
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

    const canonicalSkillTags = deriveSkillTags(undefined, module.skillTags);
    const canonicalTopicTags = deriveTopicTags(undefined, canonicalSkillTags, module.topicTags);

    const insertPayload = {
      course_id: module.course_id,
      title: module.title,
      description: module.description,
      order: order,
      content: module.content || null,
      materials: module.materials || [],
      prerequisites: module.prerequisites || [],
      skill_tags: canonicalSkillTags,
      topic_tags: canonicalTopicTags,
      module_thumbnail: (module as any).module_thumbnail || null,
      module_document: (module as any).module_document || null,
      status: (module as any).status || "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>;

    const { data, error } = await executeModuleWriteWithFallback(
      (payload) => supabase
        .from("modules")
        .insert(payload)
        .select()
        .single(),
      insertPayload,
    );

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    invalidateModuleCaches(data.course_id, data.id);

    return mapModuleRecord(data);
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
    if (updates.skillTags !== undefined) updateData.skill_tags = deriveSkillTags(undefined, updates.skillTags);
    if (updates.topicTags !== undefined) updateData.topic_tags = deriveTopicTags(undefined, updates.skillTags, updates.topicTags);

    const { data, error } = await executeModuleWriteWithFallback(
      (payload) => supabase
        .from("modules")
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

    invalidateModuleCaches(data.course_id, data.id);

    return mapModuleRecord(data);
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

    invalidateModuleCaches(undefined, id);
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

    invalidateModuleCaches(courseId);
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

async function getEnrollmentCompletionState(
  enrollmentId: string,
  courseId: string,
): Promise<EnrollmentCompletionState | null> {
  if (!supabase) {
    return null;
  }

  const { data: modules, error: modulesError } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", courseId);

  if (modulesError) {
    handleSupabaseError(modulesError);
    throw modulesError;
  }

  const moduleIds = (modules || []).map((module) => module.id);
  if (moduleIds.length === 0) {
    return {
      progress: 0,
      totalModules: 0,
      completedModules: 0,
      requiredAssessmentCount: 0,
      passedAssessmentCount: 0,
      isCourseComplete: false,
    };
  }

  const [{ data: completions, error: completionsError }, { data: assessments, error: assessmentsError }] = await Promise.all([
    supabase
      .from("module_completions")
      .select("module_id, completed_at")
      .eq("enrollment_id", enrollmentId)
      .not("completed_at", "is", null),
    supabase
      .from("assessments")
      .select("id")
      .eq("is_active", true)
      .in("module_id", moduleIds),
  ]);

  if (completionsError) {
    handleSupabaseError(completionsError);
    throw completionsError;
  }

  if (assessmentsError) {
    handleSupabaseError(assessmentsError);
    throw assessmentsError;
  }

  const completedModules = new Set((completions || []).map((completion) => completion.module_id)).size;
  const requiredAssessmentIds = Array.from(new Set((assessments || []).map((assessment) => assessment.id)));

  let passedAssessmentCount = 0;
  if (requiredAssessmentIds.length > 0) {
    const { data: passedAttempts, error: attemptsError } = await supabase
      .from("assessment_attempts")
      .select("assessment_id")
      .eq("enrollment_id", enrollmentId)
      .eq("passed", true)
      .in("assessment_id", requiredAssessmentIds)
      .not("submitted_at", "is", null);

    if (attemptsError) {
      handleSupabaseError(attemptsError);
      throw attemptsError;
    }

    passedAssessmentCount = new Set((passedAttempts || []).map((attempt) => attempt.assessment_id)).size;
  }

  const totalModules = moduleIds.length;
  const requiredAssessmentCount = requiredAssessmentIds.length;
  const totalUnits = totalModules + requiredAssessmentCount;
  const completedUnits = completedModules + passedAssessmentCount;
  const progress = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
  const isCourseComplete = completedModules === totalModules && passedAssessmentCount === requiredAssessmentCount;

  return {
    progress,
    totalModules,
    completedModules,
    requiredAssessmentCount,
    passedAssessmentCount,
    isCourseComplete,
  };
}

export async function refreshEnrollmentProgress(enrollmentId: string): Promise<void> {
  await updateEnrollmentProgress(enrollmentId);
}

const mapEnrollmentRecord = (enrollment: any): Enrollment => ({
  id: enrollment.id,
  userId: enrollment.user_id,
  courseId: enrollment.course_id,
  progress: enrollment.progress,
  status: enrollment.status,
  enrolledAt: enrollment.enrolled_at,
  completedAt: enrollment.completed_at || undefined,
  certificateId: enrollment.certificate_id || undefined,
  sourceRecommendationId: enrollment.originating_recommendation_id || undefined,
  completionApprovalStatus: enrollment.completion_approval_status || undefined,
  completionRequestedAt: enrollment.completion_requested_at || undefined,
  completionReviewedAt: enrollment.completion_reviewed_at || undefined,
  completionReviewedBy: enrollment.completion_reviewed_by || undefined,
  completionFeedback: enrollment.completion_feedback || undefined,
  creditedDurationHours:
    enrollment.credited_duration_hours === null || enrollment.credited_duration_hours === undefined
      ? undefined
      : Number(enrollment.credited_duration_hours),
  actualLearningMinutes:
    enrollment.actual_learning_minutes === null || enrollment.actual_learning_minutes === undefined
      ? undefined
      : Number(enrollment.actual_learning_minutes),
  lastActivityAt: enrollment.updated_at || enrollment.enrolled_at,
});

async function getEnrollmentLearningSnapshot(
  enrollmentId: string,
  courseId: string,
  includeCreditHours: boolean,
): Promise<{ creditedDurationHours: number | null; actualLearningMinutes: number | null }> {
  if (!supabase) {
    return {
      creditedDurationHours: null,
      actualLearningMinutes: null,
    };
  }

  const [
    { data: course },
    { data: sessionRows, error: sessionError },
    { data: completionRows, error: completionError },
    { data: assessmentRows, error: assessmentError },
  ] = await Promise.all([
    supabase.from("courses").select("duration").eq("id", courseId).maybeSingle(),
    supabase.from("module_sessions").select("duration_seconds").eq("enrollment_id", enrollmentId),
    supabase.from("module_completions").select("time_spent").eq("enrollment_id", enrollmentId),
    supabase.from("assessment_attempts").select("time_spent").eq("enrollment_id", enrollmentId).not("submitted_at", "is", null),
  ]);

  if (sessionError) {
    handleSupabaseError(sessionError);
    throw sessionError;
  }

  if (completionError) {
    handleSupabaseError(completionError);
    throw completionError;
  }

  if (assessmentError) {
    handleSupabaseError(assessmentError);
    throw assessmentError;
  }

  const sessionMinutes = (sessionRows || []).reduce((sum, session) => {
    return sum + Math.round(Number(session.duration_seconds || 0) / 60);
  }, 0);
  const moduleCompletionMinutes = (completionRows || []).reduce((sum, completion) => {
    return sum + Number(completion.time_spent || 0);
  }, 0);
  const assessmentMinutes = (assessmentRows || []).reduce((sum, attempt) => {
    return sum + Math.round(Number(attempt.time_spent || 0) / 60);
  }, 0);

  const actualLearningMinutes = Math.max(
    sessionMinutes,
    moduleCompletionMinutes + assessmentMinutes,
  );
  const creditedDurationHours = includeCreditHours ? Math.max(Number(course?.duration || 0), 0) : null;

  return {
    creditedDurationHours: creditedDurationHours > 0 ? creditedDurationHours : null,
    actualLearningMinutes: actualLearningMinutes > 0 ? actualLearningMinutes : null,
  };
}

/**
 * Helper function to update enrollment progress based on completed modules
 */
async function updateEnrollmentProgress(enrollmentId: string): Promise<void> {
  if (!supabase) return;

  // Get enrollment
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("course_id, user_id, status, completed_at, completion_approval_status, completion_requested_at")
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) return;

  const completionState = await getEnrollmentCompletionState(enrollmentId, enrollment.course_id);
  if (!completionState || completionState.totalModules === 0) {
    return;
  }

  const learningSnapshot = completionState.isCourseComplete
    ? await getEnrollmentLearningSnapshot(
        enrollmentId,
        enrollment.course_id,
        enrollment.completion_approval_status === "approved",
      )
    : {
        creditedDurationHours: null,
        actualLearningMinutes: null,
      };

  // Update enrollment progress and status
  const updateData: any = { progress: completionState.progress };
  if (completionState.isCourseComplete) {
    if (enrollment.completion_approval_status === "approved") {
      updateData.status = "completed";
      updateData.completed_at = enrollment.completed_at || new Date().toISOString();
    } else {
      updateData.status = "in-progress";
      updateData.completed_at = null;
      updateData.completion_approval_status = "pending";
      updateData.completion_requested_at = enrollment.completion_requested_at || new Date().toISOString();
      updateData.credited_duration_hours = null;
    }
    updateData.actual_learning_minutes = learningSnapshot.actualLearningMinutes;
    if (enrollment.completion_approval_status === "approved") {
      updateData.credited_duration_hours = learningSnapshot.creditedDurationHours;
    }
  } else if (completionState.progress > 0) {
    updateData.status = "in-progress";
    updateData.completed_at = null;
    updateData.completion_approval_status = "not_ready";
    updateData.completion_requested_at = null;
    updateData.completion_reviewed_at = null;
    updateData.completion_reviewed_by = null;
    updateData.completion_feedback = null;
    updateData.credited_duration_hours = null;
    updateData.actual_learning_minutes = null;
  } else {
    updateData.status = "enrolled";
    updateData.completed_at = null;
    updateData.completion_approval_status = "not_ready";
    updateData.completion_requested_at = null;
    updateData.completion_reviewed_at = null;
    updateData.completion_reviewed_by = null;
    updateData.completion_feedback = null;
    updateData.credited_duration_hours = null;
    updateData.actual_learning_minutes = null;
  }

  await supabase.from("enrollments").update(updateData).eq("id", enrollmentId);
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
    const roleFromMetadata = normalizeUserRole(authUser.user_metadata?.role);
    const isTrainerOrAdmin = roleFromMetadata === "admin" || roleFromMetadata === "trainer";
    const resolvedProfileId = await resolveCurrentProfileId();
    const effectiveOwnUserId = resolvedProfileId || authUser.id;
    
    console.log("User role:", roleFromMetadata);
    console.log("Is trainer/admin:", isTrainerOrAdmin);
    console.log("Resolved profile ID:", resolvedProfileId);
    console.log("Effective own user ID:", effectiveOwnUserId);

    // Build query - RLS policies will handle filtering:
    // - For trainees: RLS filters by auth.uid() = user_id
    // - For trainers/admins: RLS allows viewing enrollments for their courses
    let query = supabase.from("enrollments").select("*");

    // Only filter by user_id if:
    // 1. userId is explicitly provided (for specific user lookup)
    // 2. User is a trainee (not trainer/admin)
    if (userId) {
      // Explicit userId provided - use it (but verify it matches auth.uid() for trainees)
      const matchesOwnIdentity = userId === authUser.id || userId === effectiveOwnUserId;
      if (!isTrainerOrAdmin && !matchesOwnIdentity) {
        console.warn("Warning: Trainee requested different userId. Using resolved own profile ID instead.");
        query = query.eq("user_id", effectiveOwnUserId);
      } else {
        query = query.eq("user_id", userId);
      }
      console.log("Filtering by explicit user_id:", userId);
    } else if (!isTrainerOrAdmin) {
      // Trainee without explicit userId - filter by their own ID
      query = query.eq("user_id", effectiveOwnUserId);
      console.log("Trainee - filtering by own user_id:", effectiveOwnUserId);
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

    const mappedEnrollments = (data?.map((enrollment: any) => mapEnrollmentRecord(enrollment)) || []);

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

    const resolvedProfileId = await resolveCurrentProfileId();
    const learnerUserId = resolvedProfileId || userId;

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
      .eq("user_id", learnerUserId)
      .eq("course_id", courseId)
      .neq("status", "dropped")
      .maybeSingle();

    if (existingEnrollmentError) {
      throw createEnrollmentError(getEnrollmentErrorFeedback(existingEnrollmentError, courseRow.title));
    }

    if (existingEnrollment) {
      throw createEnrollmentError(buildEnrollmentErrorFeedback("already_enrolled", courseRow.title));
    }

    const { data: learnerProfile, error: learnerProfileError } = await supabase
      .from("users")
      .select("role, verification_status")
      .eq("id", learnerUserId)
      .maybeSingle();

    if (learnerProfileError) {
      throw createEnrollmentError(getEnrollmentErrorFeedback(learnerProfileError, courseRow.title));
    }

    if (!learnerProfile) {
      throw createEnrollmentError(buildEnrollmentErrorFeedback("access_restricted", courseRow.title));
    }

    const learnerRole = normalizeUserRole(learnerProfile.role);
    const verificationStatus = (learnerProfile.verification_status as User["verificationStatus"] | null) || "pending";

    if (learnerRole === "trainee" && verificationStatus !== "verified") {
      throw createEnrollmentError(getTraineeEnrollmentVerificationFeedback(verificationStatus, courseRow.title));
    }

    const { data, error } = await supabase
      .from("enrollments")
      .insert({
        user_id: learnerUserId,
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
    await supabase.rpc("increment_enrolled_count", {
      course_id: courseId,
      increment_by: 1,
    });

    // Notify user about enrollment confirmation
    try {
      const { data: course } = await supabase
        .from("courses")
        .select("title")
        .eq("id", courseId)
        .single();
      
      if (course) {
        await notificationHelpers.notifyEnrollmentConfirmed(
          learnerUserId,
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
        userId: learnerUserId,
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
      userId: learnerUserId,
      courseId,
      enrollmentId: data.id,
      recommendationId: options?.originatingRecommendationId,
      surface: options?.sourceSurface || "course_catalog",
      metadata: {
        fromRecommendation: Boolean(options?.originatingRecommendationId),
      },
    });
    await analyticsService.refreshPhase1Analytics(learnerUserId);

    return mapEnrollmentRecord(data);
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
    if (updates.completionApprovalStatus !== undefined) updateData.completion_approval_status = updates.completionApprovalStatus;
    if (updates.completionRequestedAt !== undefined) updateData.completion_requested_at = updates.completionRequestedAt;
    if (updates.completionReviewedAt !== undefined) updateData.completion_reviewed_at = updates.completionReviewedAt;
    if (updates.completionReviewedBy !== undefined) updateData.completion_reviewed_by = updates.completionReviewedBy;
    if (updates.completionFeedback !== undefined) updateData.completion_feedback = updates.completionFeedback;
    if (updates.creditedDurationHours !== undefined) updateData.credited_duration_hours = updates.creditedDurationHours;
    if (updates.actualLearningMinutes !== undefined) updateData.actual_learning_minutes = updates.actualLearningMinutes;

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

    return mapEnrollmentRecord(data);
  },

  reviewCompletion: async (
    enrollmentId: string,
    reviewerId: string,
    decision: "approved" | "needs_revision",
    feedback?: string,
  ): Promise<Enrollment> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("id, user_id, course_id, progress, certificate_id")
      .eq("id", enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      if (enrollmentError) {
        handleSupabaseError(enrollmentError);
      }
      throw enrollmentError || new Error("Enrollment not found");
    }

    if (decision === "approved" && enrollment.progress < 100) {
      throw new Error("This course is not yet ready for completion approval.");
    }

    const learningSnapshot = await getEnrollmentLearningSnapshot(
      enrollmentId,
      enrollment.course_id,
      decision === "approved",
    );

    const reviewedAt = new Date().toISOString();
    const updateData = {
      completion_approval_status: decision,
      completion_reviewed_at: reviewedAt,
      completion_reviewed_by: reviewerId,
      completion_feedback: feedback?.trim() || null,
      status: decision === "approved" ? "completed" : enrollment.progress > 0 ? "in-progress" : "enrolled",
      completed_at: decision === "approved" ? reviewedAt : null,
      credited_duration_hours: decision === "approved" ? learningSnapshot.creditedDurationHours : null,
      actual_learning_minutes: learningSnapshot.actualLearningMinutes,
    };

    const { data: updated, error: updateError } = await supabase
      .from("enrollments")
      .update(updateData)
      .eq("id", enrollmentId)
      .select()
      .single();

    if (updateError) {
      handleSupabaseError(updateError);
      throw updateError;
    }

    const { data: course } = await supabase
      .from("courses")
      .select("title")
      .eq("id", enrollment.course_id)
      .single();

    if (decision === "approved") {
      await notificationHelpers.notifyCourseCompleted(
        enrollment.user_id,
        course?.title || "your course",
        enrollment.course_id,
      );
    } else {
      await notificationService.createNotification(
        enrollment.user_id,
        "feedback_received",
        `Your course completion request for "${course?.title || "your course"}" needs follow-up from you. Check your trainer's feedback.`,
        {
          courseId: enrollment.course_id,
          enrollmentId,
        },
      );
    }

    return mapEnrollmentRecord(updated);
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
        ...mapEnrollmentRecord(item),
        userName: item.users?.name,
        userEmail: item.users?.email,
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
        ...mapEnrollmentRecord(item),
        userName: item.users?.name || undefined,
        userEmail: item.users?.email || undefined,
        courseTitle: item.courses?.title || undefined,
      })) || []
    );
  },

  getEnrollmentProgressDetail: async (enrollmentId: string): Promise<EnrollmentProgressDetail | null> => {
    if (!supabase) {
      return null;
    }

    const { data: enrollmentRow, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("*")
      .eq("id", enrollmentId)
      .single();

    if (enrollmentError || !enrollmentRow) {
      if (enrollmentError) {
        handleSupabaseError(enrollmentError);
      }
      return null;
    }

    const enrollment = mapEnrollmentRecord(enrollmentRow);
    const [course, modules] = await Promise.all([
      courseService.getCourse(enrollment.courseId),
      moduleService.getModulesByCourse(enrollment.courseId),
    ]);

    const moduleIds = modules.map((module) => module.id);
    const [{ data: completionRows, error: completionError }, { data: assessmentRows, error: assessmentError }] = await Promise.all([
      supabase
        .from("module_completions")
        .select("module_id, completed_at, time_spent")
        .eq("enrollment_id", enrollmentId),
      moduleIds.length > 0
        ? supabase
            .from("assessments")
            .select("id, module_id, title, derived_from_module_quiz")
            .eq("is_active", true)
            .in("module_id", moduleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (completionError) {
      handleSupabaseError(completionError);
      throw completionError;
    }

    if (assessmentError) {
      handleSupabaseError(assessmentError);
      throw assessmentError;
    }

    const assessmentIds = (assessmentRows || []).map((assessment: any) => assessment.id).filter(Boolean);
    const { data: attemptRows, error: attemptError } = assessmentIds.length > 0
      ? await supabase
          .from("assessment_attempts")
          .select("id, assessment_id, submitted_at, started_at, review_status, passed, score, requires_manual_review")
          .eq("enrollment_id", enrollmentId)
          .in("assessment_id", assessmentIds)
      : { data: [], error: null };

    if (attemptError) {
      handleSupabaseError(attemptError);
      throw attemptError;
    }

    const completionMap = new Map<string, { completedAt?: string; timeSpent?: number }>();
    for (const row of completionRows || []) {
      completionMap.set(row.module_id, {
        completedAt: row.completed_at || undefined,
        timeSpent: row.time_spent || undefined,
      });
    }

    const completedModuleIds = Array.from(completionMap.keys());
    const latestAttemptByAssessmentId = new Map<string, any>();
    for (const attempt of attemptRows || []) {
      const current = latestAttemptByAssessmentId.get(attempt.assessment_id);
      const attemptTime = new Date(attempt.submitted_at || attempt.started_at || 0).getTime();
      const currentTime = current ? new Date(current.submitted_at || current.started_at || 0).getTime() : -1;
      if (!current || attemptTime > currentTime) {
        latestAttemptByAssessmentId.set(attempt.assessment_id, attempt);
      }
    }

    return {
      enrollment,
      course,
      modules: modules.map((module) => {
        const completion = completionMap.get(module.id);
        return {
          module,
          completed: Boolean(completion),
          completedAt: completion?.completedAt,
          timeSpent: completion?.timeSpent,
          blockedByModuleIds: getBlockingModules(module, modules, completedModuleIds).map((candidate) => candidate.id),
        };
      }),
      assessments: (assessmentRows || []).map((assessment: any) => {
        const latestAttempt = latestAttemptByAssessmentId.get(assessment.id);
        return {
          assessmentId: assessment.id,
          moduleId: assessment.module_id,
          assessmentTitle: assessment.title || "Module Assessment",
          latestAttemptId: latestAttempt?.id || undefined,
          requiresManualReview: Boolean(latestAttempt?.requires_manual_review),
          submittedAt: latestAttempt?.submitted_at || undefined,
          reviewStatus: latestAttempt?.review_status || undefined,
          passed: typeof latestAttempt?.passed === "boolean" ? latestAttempt.passed : undefined,
          score: latestAttempt?.score === null || latestAttempt?.score === undefined ? undefined : Number(latestAttempt.score),
        };
      }),
    };
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
      const resolvedProfileId = await resolveCurrentProfileId();
      query = query.eq("user_id", resolvedProfileId || userId);
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
          issuedBy: cert.issued_by || undefined,
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
    certificateType: "completion" | "participation" = "completion",
    issuedBy?: string,
  ): Promise<Certificate> => {
    const { data: existingCertificate, error: existingCertificateError } = await supabase
      .from("certificates")
      .select("id, user_id, course_id, issued_at, certificate_number, certificate_type, verification_code, issued_by")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .order("issued_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingCertificateError) {
      handleSupabaseError(existingCertificateError);
      throw existingCertificateError;
    }

    if (existingCertificate) {
      return {
        id: existingCertificate.id,
        userId: existingCertificate.user_id,
        courseId: existingCertificate.course_id,
        courseTitle,
        issuedAt: existingCertificate.issued_at,
        certificateNumber: existingCertificate.certificate_number,
        certificateType: existingCertificate.certificate_type,
        verificationCode: existingCertificate.verification_code,
        issuedBy: existingCertificate.issued_by || undefined,
      };
    }

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
        issued_by: issuedBy || null,
      })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    const { data: matchingCertificates, error: matchingCertificatesError } = await supabase
      .from("certificates")
      .select("id, user_id, course_id, issued_at, certificate_number, certificate_type, verification_code, issued_by")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .order("issued_at", { ascending: true });

    if (matchingCertificatesError) {
      handleSupabaseError(matchingCertificatesError);
      throw matchingCertificatesError;
    }

    const orderedCertificates = matchingCertificates || [];
    const canonicalCertificate = orderedCertificates[0] || data;
    const duplicateCertificateIds = orderedCertificates
      .slice(1)
      .map((certificate) => certificate.id)
      .filter((certificateId) => certificateId !== canonicalCertificate.id);

    if (duplicateCertificateIds.length > 0) {
      const { error: deleteDuplicatesError } = await supabase
        .from("certificates")
        .delete()
        .in("id", duplicateCertificateIds);

      if (deleteDuplicatesError) {
        handleSupabaseError(deleteDuplicatesError);
        throw deleteDuplicatesError;
      }
    }

    const certificate = {
      id: canonicalCertificate.id,
      userId: canonicalCertificate.user_id,
      courseId: canonicalCertificate.course_id,
      courseTitle,
      issuedAt: canonicalCertificate.issued_at,
      certificateNumber: canonicalCertificate.certificate_number,
      certificateType: canonicalCertificate.certificate_type,
      verificationCode: canonicalCertificate.verification_code,
      issuedBy: canonicalCertificate.issued_by || undefined,
    };

    if (certificate.id === data.id) {
      try {
        await notificationHelpers.notifyCertificateIssued(
          userId,
          courseTitle,
          certificate.id,
          certificateType
        );
      } catch (error) {
        console.error("Error sending certificate notification:", error);
      }
    }

    return certificate;
  },

  issueCertificateForEnrollment: async (
    enrollmentId: string,
    issuedBy: string,
  ): Promise<Certificate> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select(`
        id,
        user_id,
        course_id,
        certificate_id,
        completion_approval_status,
        courses:course_id (title, certificate_type)
      `)
      .eq("id", enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      if (enrollmentError) {
        handleSupabaseError(enrollmentError);
      }
      throw enrollmentError || new Error("Enrollment not found");
    }

    if (enrollment.completion_approval_status !== "approved") {
      throw new Error("Completion must be approved before issuing a certificate.");
    }

    const course = enrollment.courses as { title?: string; certificate_type?: "completion" | "participation" } | null;
    const certificate = await certificateService.issueCertificate(
      enrollment.user_id,
      enrollment.course_id,
      course?.title || "Course",
      course?.certificate_type || "completion",
      issuedBy,
    );

    const { error: updateEnrollmentError } = await supabase
      .from("enrollments")
      .update({ certificate_id: certificate.id })
      .eq("id", enrollmentId);

    if (updateEnrollmentError) {
      handleSupabaseError(updateEnrollmentError);
      throw updateEnrollmentError;
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
        traineeType: (user.trainee_type as User["traineeType"] | undefined) || undefined,
        verificationStatus: (user.verification_status as User["verificationStatus"] | undefined) || undefined,
        employeeId: user.employee_id || undefined,
        physicalId: user.physical_id || undefined,
        verificationSubmittedAt: user.verification_submitted_at || undefined,
        verifiedAt: user.verified_at || undefined,
        verifiedBy: user.verified_by || undefined,
        verificationNotes: user.verification_notes || undefined,
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
        onboardingModalSeenAt: user.onboarding_modal_seen_at || undefined,
        skills: user.skills || undefined,
        createdAt: user.created_at,
      })) || []
    );
  },

  getTraineesForVerification: async (): Promise<User[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    const { data, error } = await supabase.rpc("get_trainees_for_verification");

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return (
      (data as any[] | null)?.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: normalizeUserRole(user.role),
        traineeType: (user.trainee_type as User["traineeType"] | undefined) || undefined,
        verificationStatus: (user.verification_status as User["verificationStatus"] | undefined) || undefined,
        employeeId: user.employee_id || undefined,
        physicalId: user.physical_id || undefined,
        verificationSubmittedAt: user.verification_submitted_at || undefined,
        verifiedAt: user.verified_at || undefined,
        verifiedBy: user.verified_by || undefined,
        verificationNotes: user.verification_notes || undefined,
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
        onboardingModalSeenAt: user.onboarding_modal_seen_at || undefined,
        skills: user.skills || undefined,
        createdAt: user.created_at,
      })) || []
    );
  },

  updateTraineeVerification: async (
    traineeId: string,
    verificationStatus: NonNullable<User["verificationStatus"]>,
    verificationNotes?: string,
    _reviewerId?: string,
  ): Promise<User> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { data, error } = await supabase.rpc("update_trainee_verification", {
      p_trainee_id: traineeId,
      p_verification_status: verificationStatus,
      p_verification_notes: verificationNotes || null,
    });

    if (error || !data) {
      handleSupabaseError(error);
      throw error || new Error("Failed to update trainee verification");
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: normalizeUserRole(data.role),
      traineeType: (data.trainee_type as User["traineeType"] | undefined) || undefined,
      verificationStatus: (data.verification_status as User["verificationStatus"] | undefined) || undefined,
      employeeId: data.employee_id || undefined,
      physicalId: data.physical_id || undefined,
      verificationSubmittedAt: data.verification_submitted_at || undefined,
      verifiedAt: data.verified_at || undefined,
      verifiedBy: data.verified_by || undefined,
      verificationNotes: data.verification_notes || undefined,
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
      onboardingModalSeenAt: data.onboarding_modal_seen_at || undefined,
      skills: data.skills || undefined,
      createdAt: data.created_at,
    };
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
      traineeType: (data.trainee_type as User["traineeType"] | undefined) || undefined,
      verificationStatus: (data.verification_status as User["verificationStatus"] | undefined) || undefined,
      employeeId: data.employee_id || undefined,
      physicalId: data.physical_id || undefined,
      verificationSubmittedAt: data.verification_submitted_at || undefined,
      verifiedAt: data.verified_at || undefined,
      verifiedBy: data.verified_by || undefined,
      verificationNotes: data.verification_notes || undefined,
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
      onboardingModalSeenAt: data.onboarding_modal_seen_at || undefined,
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
    if (updates.traineeType !== undefined) updateData.trainee_type = updates.traineeType || null;
    if (updates.verificationStatus !== undefined) updateData.verification_status = updates.verificationStatus || null;
    if (updates.employeeId !== undefined) updateData.employee_id = updates.employeeId || null;
    if (updates.physicalId !== undefined) updateData.physical_id = updates.physicalId || null;
    if (updates.verificationSubmittedAt !== undefined) updateData.verification_submitted_at = updates.verificationSubmittedAt || null;
    if (updates.verifiedAt !== undefined) updateData.verified_at = updates.verifiedAt || null;
    if (updates.verifiedBy !== undefined) updateData.verified_by = updates.verifiedBy || null;
    if (updates.verificationNotes !== undefined) updateData.verification_notes = updates.verificationNotes || null;
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
    if (updates.onboardingModalSeenAt !== undefined) updateData.onboarding_modal_seen_at = updates.onboardingModalSeenAt || null;
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
      traineeType: (data.trainee_type as User["traineeType"] | undefined) || undefined,
      verificationStatus: (data.verification_status as User["verificationStatus"] | undefined) || undefined,
      employeeId: data.employee_id || undefined,
      physicalId: data.physical_id || undefined,
      verificationSubmittedAt: data.verification_submitted_at || undefined,
      verifiedAt: data.verified_at || undefined,
      verifiedBy: data.verified_by || undefined,
      verificationNotes: data.verification_notes || undefined,
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
      onboardingModalSeenAt: data.onboarding_modal_seen_at || undefined,
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

