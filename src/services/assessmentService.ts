import { supabase, handleSupabaseError } from "@/lib/supabase";
import {
  getGradableQuizBlocks,
  parseModuleContentBlocks,
  validateQuizAssessmentBlocks,
  type ContentBlock,
} from "@/lib/contentBlocks";
import { analyticsService } from "@/services/analyticsService";
import { notificationHelpers } from "@/services/notificationService";
import { notificationService } from "@/services/notificationService";
import { moduleCompletionService, refreshEnrollmentProgress } from "@/services/supabaseDatabaseService";
import { deriveSkillTags, deriveTopicTags } from "@/lib/taxonomy";

export interface Assessment {
  id: string;
  moduleId: string;
  title: string;
  description?: string;
  timeLimit?: number; // in minutes
  passingScore: number;
  maxAttempts: number;
  allowRetryAfterPassing: boolean;
  isActive: boolean;
  skillTags?: string[];
  topicTags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentQuestion {
  id: string;
  assessmentId: string;
  question: string;
  questionType: "multiple_choice" | "true_false" | "short_answer" | "essay";
  options?: string[];
  correctAnswer?: string;
  points: number;
  order: number;
  explanation?: string;
  sourceQuestionKey?: string;
  isActive?: boolean;
  derivedFromModuleQuiz?: boolean;
}

export type AssessmentReviewStatus = "submitted" | "under_review" | "needs_revision" | "approved";

interface AssessmentSyncSettings {
  title?: string;
  description?: string;
  timeLimit?: number;
  passingScore?: number;
  maxAttempts?: number;
  allowRetryAfterPassing?: boolean;
  isActive?: boolean;
  skillTags?: string[];
  topicTags?: string[];
}

const unsupportedAssessmentColumns = new Set<string>();
const unsupportedAssessmentQuestionColumns = new Set<string>();
const unsupportedAssessmentModuleColumns = new Set<string>();
const unsupportedAssessmentAttemptColumns = new Set<string>();
const unsupportedAssessmentAnswerColumns = new Set<string>();
const MANUAL_REVIEW_QUESTION_TYPES = new Set<AssessmentQuestion["questionType"]>(["short_answer", "essay"]);

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

const getMissingColumnName = (error: unknown, tableName: string): string | null => {
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: string }).message || "")
    : "";
  const details = typeof error === "object" && error !== null && "details" in error
    ? String((error as { details?: string }).details || "")
    : "";
  const haystack = `${message} ${details}`;

  const schemaCacheMatch = haystack.match(new RegExp(`'([^']+)' column of '${tableName}'`, "i"));
  if (schemaCacheMatch?.[1]) {
    return normalizeMissingColumnName(schemaCacheMatch[1]);
  }

  const quotedPostgresMatch = haystack.match(/column\s+"([^"]+)"\s+does not exist/i);
  if (quotedPostgresMatch?.[1]) {
    return normalizeMissingColumnName(quotedPostgresMatch[1]);
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

const sanitizeWritePayload = (payload: Record<string, unknown>, unsupportedColumns: Set<string>) => {
  const nextPayload = { ...payload };

  for (const column of unsupportedColumns) {
    delete nextPayload[column];
  }

  return nextPayload;
};

const executeReadWithFallback = async <T>(
  execute: (selectClause: string) => Promise<{ data: T | null; error: any }>,
  selectClause: string,
  tableName: string,
  unsupportedColumns: Set<string>,
): Promise<{ data: T | null; error: any }> => {
  let nextSelect = buildSelectWithFallback(selectClause, unsupportedColumns);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await execute(nextSelect);
    if (!result.error) {
      return result;
    }

    const missingColumn = getMissingColumnName(result.error, tableName);
    if (!missingColumn) {
      return result;
    }

    unsupportedColumns.add(missingColumn);
    nextSelect = buildSelectWithFallback(selectClause, unsupportedColumns);
  }

  return execute("*");
};

const executeWriteWithFallback = async <T>(
  execute: (payload: Record<string, unknown>) => Promise<{ data: T | null; error: any }>,
  payload: Record<string, unknown>,
  tableName: string,
  unsupportedColumns: Set<string>,
): Promise<{ data: T | null; error: any }> => {
  let nextPayload = sanitizeWritePayload(payload, unsupportedColumns);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await execute(nextPayload);
    if (!result.error) {
      return result;
    }

    const missingColumn = getMissingColumnName(result.error, tableName);
    if (!missingColumn || !(missingColumn in nextPayload)) {
      return result;
    }

    unsupportedColumns.add(missingColumn);
    delete nextPayload[missingColumn];
  }

  return execute(nextPayload);
};

const mapAssessmentRow = (data: any): Assessment => ({
  id: data.id,
  moduleId: data.module_id,
  title: data.title,
  description: data.description || undefined,
  timeLimit: data.time_limit || undefined,
  passingScore: data.passing_score,
  maxAttempts: data.max_attempts,
  allowRetryAfterPassing: data.allow_retry_after_passing ?? false,
  isActive: data.is_active,
  skillTags: data.skill_tags || [],
  topicTags: data.topic_tags || [],
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

const mapAssessmentQuestionRow = (row: any): AssessmentQuestion => ({
  id: row.id,
  assessmentId: row.assessment_id,
  question: row.question,
  questionType: row.question_type,
  options: row.options ? (Array.isArray(row.options) ? row.options : JSON.parse(row.options)) : undefined,
  correctAnswer: row.correct_answer || undefined,
  points: row.points,
  order: row.order,
  explanation: row.explanation || undefined,
  sourceQuestionKey: row.source_question_key || undefined,
  isActive: row.is_active ?? true,
  derivedFromModuleQuiz: row.derived_from_module_quiz ?? false,
});

const mapAssessmentAttemptRow = (row: any): AssessmentAttempt => ({
  id: row.id,
  assessmentId: row.assessment_id,
  enrollmentId: row.enrollment_id,
  userId: row.user_id,
  startedAt: row.started_at,
  submittedAt: row.submitted_at || undefined,
  score: row.score === null || row.score === undefined ? undefined : row.score,
  passed: row.passed === null || row.passed === undefined ? undefined : row.passed,
  answers: row.answers || {},
  timeSpent: row.time_spent === null || row.time_spent === undefined ? undefined : row.time_spent,
  reviewStatus: row.review_status || undefined,
  reviewedAt: row.reviewed_at || undefined,
  reviewedBy: row.reviewed_by || undefined,
  reviewFeedback: row.review_feedback || undefined,
  requiresManualReview: row.requires_manual_review ?? false,
});

const buildDerivedAssessmentDefaults = (moduleTitle: string, settings?: AssessmentSyncSettings): Required<AssessmentSyncSettings> => ({
  title: settings?.title?.trim() || `${moduleTitle.trim() || "Module"} Assessment`,
  description: settings?.description || "",
  timeLimit: settings?.timeLimit,
  passingScore: settings?.passingScore ?? 70,
  maxAttempts: settings?.maxAttempts ?? 3,
  allowRetryAfterPassing: settings?.allowRetryAfterPassing ?? false,
  isActive: settings?.isActive ?? true,
  skillTags: settings?.skillTags || [],
  topicTags: settings?.topicTags || [],
});

const normalizeStoredCorrectAnswer = (
  correctAnswer: string | null | undefined,
  options?: string[],
): string | null => {
  if (!correctAnswer) {
    return null;
  }

  const trimmed = correctAnswer.trim();
  if (!trimmed) {
    return null;
  }

  const numericValue = Number.parseInt(trimmed, 10);
  if (String(numericValue) === trimmed && Number.isInteger(numericValue) && options?.[numericValue]) {
    return options[numericValue];
  }

  return trimmed;
};

const requiresManualReview = (questionType: AssessmentQuestion["questionType"] | ContentBlock["questionType"] | undefined) => {
  return questionType !== undefined && MANUAL_REVIEW_QUESTION_TYPES.has(questionType as AssessmentQuestion["questionType"]);
};

const toDerivedQuestionPayload = (block: ContentBlock, index: number) => ({
  sourceQuestionKey: block.sourceQuestionKey || block.id,
  question: block.content.trim(),
  questionType: block.questionType === "essay" ? "essay" : block.questionType === "true_false" ? "true_false" : "multiple_choice",
  options: block.questionType === "essay" ? [] : block.options || [],
  correctAnswer:
    block.questionType !== "essay" && block.correctAnswer !== undefined && (block.options || [])[block.correctAnswer] !== undefined
      ? (block.options || [])[block.correctAnswer]
      : null,
  points: block.points || 1,
  order: index + 1,
  explanation: block.explanation || null,
});

const deactivateDerivedAssessmentForModule = async (moduleId: string): Promise<void> => {
  if (!supabase) {
    throw new Error("Supabase not initialized");
  }

  const { data: assessmentRow, error: assessmentLookupError } = await supabase
    .from("assessments")
    .select("id")
    .eq("module_id", moduleId)
    .maybeSingle();

  if (assessmentLookupError) {
    if (assessmentLookupError.code === "PGRST116") {
      return;
    }

    handleSupabaseError(assessmentLookupError);
    throw assessmentLookupError;
  }

  const { error: assessmentUpdateError } = await executeWriteWithFallback(
    (payload) => supabase
      .from("assessments")
      .update(payload)
      .eq("id", assessmentRow.id),
    {
      is_active: false,
      derived_from_module_quiz: true,
      updated_at: new Date().toISOString(),
    },
    "assessments",
    unsupportedAssessmentColumns,
  );

  if (assessmentUpdateError) {
    handleSupabaseError(assessmentUpdateError);
    throw assessmentUpdateError;
  }

  const { error: questionUpdateError } = await executeWriteWithFallback(
    (payload) => supabase
      .from("assessment_questions")
      .update(payload)
      .eq("assessment_id", assessmentRow.id)
      .neq("is_active", false),
    {
      is_active: false,
      derived_from_module_quiz: true,
    },
    "assessment_questions",
    unsupportedAssessmentQuestionColumns,
  );

  if (questionUpdateError) {
    handleSupabaseError(questionUpdateError);
    throw questionUpdateError;
  }
};

const syncDerivedAssessmentFromModuleContent = async (
  moduleId: string,
  existingAssessment?: Assessment | null,
): Promise<Assessment | null> => {
  if (!supabase) {
    return existingAssessment || null;
  }

  const { data: moduleRow, error: moduleError } = await executeReadWithFallback(
    (selectClause) => supabase
      .from("modules")
      .select(selectClause)
      .eq("id", moduleId)
      .maybeSingle(),
    "id, title, content, skill_tags, topic_tags",
    "modules",
    unsupportedAssessmentModuleColumns,
  );

  if (moduleError) {
    handleSupabaseError(moduleError);
    return existingAssessment || null;
  }

  if (!moduleRow) {
    return existingAssessment || null;
  }

  const blocks = parseModuleContentBlocks(moduleRow.content);
  const gradableQuizBlocks = getGradableQuizBlocks(blocks);

  if (gradableQuizBlocks.length === 0) {
    return existingAssessment || null;
  }

  if (validateQuizAssessmentBlocks(blocks).length > 0) {
    return existingAssessment || null;
  }

  return assessmentService.syncDerivedAssessmentFromQuizBlocks(moduleRow.id, moduleRow.title, blocks, {
    title: existingAssessment?.title,
    description: existingAssessment?.description,
    timeLimit: existingAssessment?.timeLimit,
    passingScore: existingAssessment?.passingScore,
    maxAttempts: existingAssessment?.maxAttempts,
    allowRetryAfterPassing: existingAssessment?.allowRetryAfterPassing,
    isActive: existingAssessment?.isActive,
    skillTags: existingAssessment?.skillTags || moduleRow.skill_tags || [],
    topicTags: existingAssessment?.topicTags || moduleRow.topic_tags || [],
  });
};

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  enrollmentId: string;
  userId: string;
  startedAt: string;
  submittedAt?: string;
  score?: number;
  passed?: boolean;
  answers: Record<string, string>;
  timeSpent?: number;
  reviewStatus?: AssessmentReviewStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewFeedback?: string;
  requiresManualReview?: boolean;
}

export type AssessmentReviewDecision = "approved" | "needs_revision";

export interface AssessmentReviewQueueItem {
  attemptId: string;
  assessmentId: string;
  assessmentTitle: string;
  moduleId: string;
  moduleTitle: string;
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  learnerId: string;
  learnerName: string;
  learnerEmail?: string;
  submittedAt?: string;
  reviewStatus: AssessmentReviewStatus;
  reviewFeedback?: string;
}

export interface AssessmentReviewAnswer {
  questionId: string;
  question: string;
  questionType: AssessmentQuestion["questionType"];
  answer: string;
  points: number;
  explanation?: string;
  reviewStatus?: AssessmentReviewStatus;
}

export interface AssessmentReviewDetail extends AssessmentReviewQueueItem {
  reviewedAt?: string;
  reviewedBy?: string;
  questions: AssessmentReviewAnswer[];
}

export const assessmentService = {
  /**
   * Get assessment for a module
   */
  getAssessmentByModule: async (
    moduleId: string,
    options?: { syncDerivedFromModuleContent?: boolean },
  ): Promise<Assessment | null> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return null;
    }

    const { data, error } = await executeReadWithFallback(
      (selectClause) => {
        let query = supabase
          .from("assessments")
          .select(selectClause)
          .eq("module_id", moduleId);

        if (!unsupportedAssessmentColumns.has("is_active")) {
          query = query.eq("is_active", true);
        }

        return query.maybeSingle();
      },
      "*",
      "assessments",
      unsupportedAssessmentColumns,
    );

    if (error) {
      handleSupabaseError(error);
      return null;
    }

    const mappedAssessment = data ? mapAssessmentRow(data) : null;

    if (!options?.syncDerivedFromModuleContent) {
      return mappedAssessment;
    }

    try {
      return await syncDerivedAssessmentFromModuleContent(moduleId, mappedAssessment);
    } catch (syncError) {
      console.error("Error syncing derived assessment from module content:", syncError);
      return mappedAssessment;
    }
  },

  /**
   * Get questions for an assessment
   */
  getAssessmentQuestions: async (assessmentId: string): Promise<AssessmentQuestion[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    const { data, error } = await executeReadWithFallback(
      (selectClause) => supabase
        .from("assessment_questions")
        .select(selectClause)
        .eq("assessment_id", assessmentId)
        .order("order", { ascending: true }),
      "*",
      "assessment_questions",
      unsupportedAssessmentQuestionColumns,
    );

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (data || [])
      .filter((row) => row.is_active !== false)
      .map(mapAssessmentQuestionRow);
  },

  /**
   * Get user's attempts for an assessment
   */
  getAssessmentAttempts: async (
    assessmentId: string,
    userId: string
  ): Promise<AssessmentAttempt[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    const { data, error } = await supabase
      .from("assessment_attempts")
      .select("*")
      .eq("assessment_id", assessmentId)
      .eq("user_id", userId)
      .order("started_at", { ascending: false });

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return data?.map(mapAssessmentAttemptRow) || [];
  },

  getManualReviewQueue: async (options?: {
    learnerId?: string;
    enrollmentId?: string;
    courseId?: string;
    statuses?: AssessmentReviewStatus[];
  }): Promise<AssessmentReviewQueueItem[]> => {
    if (!supabase) {
      return [];
    }

    let query = supabase
      .from("assessment_attempts")
      .select(`
        id,
        assessment_id,
        enrollment_id,
        user_id,
        submitted_at,
        review_status,
        review_feedback,
        assessments:assessment_id (
          id,
          title,
          module_id,
          modules:module_id (
            id,
            title,
            course_id,
            courses:course_id (title)
          )
        ),
        users:user_id (name, email)
      `)
      .eq("requires_manual_review", true)
      .order("submitted_at", { ascending: false });

    if (options?.learnerId) {
      query = query.eq("user_id", options.learnerId);
    }

    if (options?.enrollmentId) {
      query = query.eq("enrollment_id", options.enrollmentId);
    }

    if (options?.statuses && options.statuses.length > 0) {
      query = query.in("review_status", options.statuses);
    } else {
      query = query.in("review_status", ["submitted", "under_review", "needs_revision"]);
    }

    const { data, error } = await query;

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    const items = (data || []).map((row: any) => {
      const assessment = row.assessments || {};
      const module = assessment.modules || {};
      const course = module.courses || {};
      const learner = row.users || {};

      return {
        attemptId: row.id,
        assessmentId: row.assessment_id,
        assessmentTitle: assessment.title || "Module Assessment",
        moduleId: module.id,
        moduleTitle: module.title || "Module",
        enrollmentId: row.enrollment_id,
        courseId: module.course_id,
        courseTitle: course.title || "Course",
        learnerId: row.user_id,
        learnerName: learner.name || "Learner",
        learnerEmail: learner.email || undefined,
        submittedAt: row.submitted_at || undefined,
        reviewStatus: row.review_status || "submitted",
        reviewFeedback: row.review_feedback || undefined,
      } satisfies AssessmentReviewQueueItem;
    });

    if (!options?.courseId) {
      return items;
    }

    return items.filter((item) => item.courseId === options.courseId);
  },

  getAssessmentAttemptReviewDetail: async (attemptId: string): Promise<AssessmentReviewDetail | null> => {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from("assessment_attempts")
      .select(`
        id,
        assessment_id,
        enrollment_id,
        user_id,
        submitted_at,
        review_status,
        review_feedback,
        reviewed_at,
        reviewed_by,
        assessments:assessment_id (
          id,
          title,
          module_id,
          modules:module_id (
            id,
            title,
            course_id,
            courses:course_id (title)
          )
        ),
        users:user_id (name, email)
      `)
      .eq("id", attemptId)
      .single();

    if (error) {
      handleSupabaseError(error);
      return null;
    }

    const reviewQueueItem = await assessmentService.getManualReviewQueue({
      learnerId: data.user_id,
      enrollmentId: data.enrollment_id,
      statuses: ["submitted", "under_review", "needs_revision", "approved"],
    });

    const baseItem = reviewQueueItem.find((item) => item.attemptId === attemptId);
    if (!baseItem) {
      const assessment = (data as any).assessments || {};
      const module = assessment.modules || {};
      const course = module.courses || {};
      const learner = (data as any).users || {};
      const fallbackItem: AssessmentReviewQueueItem = {
        attemptId: data.id,
        assessmentId: data.assessment_id,
        assessmentTitle: assessment.title || "Module Assessment",
        moduleId: module.id,
        moduleTitle: module.title || "Module",
        enrollmentId: data.enrollment_id,
        courseId: module.course_id,
        courseTitle: course.title || "Course",
        learnerId: data.user_id,
        learnerName: learner.name || "Learner",
        learnerEmail: learner.email || undefined,
        submittedAt: data.submitted_at || undefined,
        reviewStatus: data.review_status || "submitted",
        reviewFeedback: data.review_feedback || undefined,
      };

      const questions = await assessmentService.getAssessmentQuestions(data.assessment_id);
      const { data: answers } = await supabase
        .from("assessment_answers")
        .select("question_id, answer, review_status")
        .eq("attempt_id", attemptId);
      const answerMap = new Map((answers || []).map((answer: any) => [answer.question_id, answer]));

      return {
        ...fallbackItem,
        reviewedAt: data.reviewed_at || undefined,
        reviewedBy: data.reviewed_by || undefined,
        questions: questions
          .filter((question) => requiresManualReview(question.questionType))
          .map((question) => {
            const answer = answerMap.get(question.id);
            return {
              questionId: question.id,
              question: question.question,
              questionType: question.questionType,
              answer: answer?.answer || "",
              points: question.points,
              explanation: question.explanation,
              reviewStatus: answer?.review_status || undefined,
            };
          }),
      };
    }

    const questions = await assessmentService.getAssessmentQuestions(baseItem.assessmentId);
    const { data: answers, error: answersError } = await supabase
      .from("assessment_answers")
      .select("question_id, answer, review_status")
      .eq("attempt_id", attemptId);

    if (answersError) {
      handleSupabaseError(answersError);
      return null;
    }

    const answerMap = new Map((answers || []).map((answer: any) => [answer.question_id, answer]));

    return {
      ...baseItem,
      reviewedAt: data.reviewed_at || undefined,
      reviewedBy: data.reviewed_by || undefined,
      questions: questions
        .filter((question) => requiresManualReview(question.questionType))
        .map((question) => {
          const answer = answerMap.get(question.id);
          return {
            questionId: question.id,
            question: question.question,
            questionType: question.questionType,
            answer: answer?.answer || "",
            points: question.points,
            explanation: question.explanation,
            reviewStatus: answer?.review_status || undefined,
          } satisfies AssessmentReviewAnswer;
        }),
    };
  },

  beginManualReview: async (attemptId: string): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const reviewedAt = new Date().toISOString();

    const { error } = await executeWriteWithFallback(
      (payload) => supabase
        .from("assessment_attempts")
        .update(payload)
        .eq("id", attemptId)
        .eq("review_status", "submitted"),
      {
        review_status: "under_review",
        reviewed_at: reviewedAt,
      },
      "assessment_attempts",
      unsupportedAssessmentAttemptColumns,
    );

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    await supabase
      .from("assessment_answers")
      .update({ review_status: "under_review" })
      .eq("attempt_id", attemptId)
      .eq("review_status", "submitted");
  },

  reviewManualAttempt: async (
    attemptId: string,
    options: {
      reviewerId: string;
      decision: AssessmentReviewDecision;
      feedback: string;
    },
  ): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const detail = await assessmentService.getAssessmentAttemptReviewDetail(attemptId);
    if (!detail) {
      throw new Error("Assessment attempt not found");
    }

    const finalStatus: AssessmentReviewStatus = options.decision === "approved" ? "approved" : "needs_revision";
    const reviewedAt = new Date().toISOString();
    const passed = options.decision === "approved";

    const { error: updateAttemptError } = await executeWriteWithFallback(
      (payload) => supabase
        .from("assessment_attempts")
        .update(payload)
        .eq("id", attemptId),
      {
        review_status: finalStatus,
        reviewed_at: reviewedAt,
        reviewed_by: options.reviewerId,
        review_feedback: options.feedback.trim() || null,
        passed,
        score: passed ? 100 : 0,
      },
      "assessment_attempts",
      unsupportedAssessmentAttemptColumns,
    );

    if (updateAttemptError) {
      handleSupabaseError(updateAttemptError);
      throw updateAttemptError;
    }

    const { error: updateAnswersError } = await executeWriteWithFallback(
      (payload) => supabase
        .from("assessment_answers")
        .update(payload)
        .eq("attempt_id", attemptId),
      {
        review_status: finalStatus,
        reviewed_at: reviewedAt,
        reviewed_by: options.reviewerId,
      },
      "assessment_answers",
      unsupportedAssessmentAnswerColumns,
    );

    if (updateAnswersError) {
      handleSupabaseError(updateAnswersError);
      throw updateAnswersError;
    }

    if (passed) {
      await moduleCompletionService.markModuleComplete(detail.enrollmentId, detail.moduleId);
    }

    await refreshEnrollmentProgress(detail.enrollmentId);

    if (passed) {
      await notificationHelpers.notifyAssessmentGraded(detail.learnerId, detail.courseTitle, 100, true);
    } else {
      await notificationService.createNotification(
        detail.learnerId,
        "feedback_received",
        `Your essay assessment for "${detail.courseTitle}" needs revision. Check your trainer's feedback before requesting completion approval.`,
        {
          courseId: detail.courseId,
          courseTitle: detail.courseTitle,
          assessmentAttemptId: attemptId,
          moduleId: detail.moduleId,
        },
      );
    }
  },

  /**
   * Start a new assessment attempt
   */
  startAttempt: async (
    assessmentId: string,
    enrollmentId: string,
    userId: string
  ): Promise<AssessmentAttempt> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { data, error } = await executeWriteWithFallback(
      (payload) => supabase
        .from("assessment_attempts")
        .insert(payload)
        .select()
        .single(),
      {
        assessment_id: assessmentId,
        enrollment_id: enrollmentId,
        user_id: userId,
        started_at: new Date().toISOString(),
        answers: {},
      },
      "assessment_attempts",
      unsupportedAssessmentAttemptColumns,
    );

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return mapAssessmentAttemptRow(data);
  },

  /**
   * Submit assessment attempt
   */
  submitAttempt: async (
    attemptId: string,
    answers: Record<string, string>,
    timeSpent: number,
    questions: AssessmentQuestion[]
  ): Promise<{ score?: number; passed?: boolean; reviewStatus: AssessmentReviewStatus; requiresManualReview: boolean }> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    // Calculate score
    let totalPoints = 0;
    let earnedPoints = 0;
    const hasManualReviewQuestions = questions.some((question) => requiresManualReview(question.questionType));

    questions.forEach((question) => {
      if (requiresManualReview(question.questionType)) {
        return;
      }

      totalPoints += question.points;
      const userAnswer = answers[question.id];
      const normalizedCorrectAnswer = normalizeStoredCorrectAnswer(question.correctAnswer, question.options);

      if (question.questionType === "multiple_choice" || question.questionType === "true_false") {
        if (userAnswer === normalizedCorrectAnswer) {
          earnedPoints += question.points;
        }
      }
    });

    const score = hasManualReviewQuestions
      ? undefined
      : totalPoints > 0
        ? Math.round((earnedPoints / totalPoints) * 100)
        : 0;

    // Get assessment and enrollment details to check passing score and get course info
    const { data: attemptData } = await supabase
      .from("assessment_attempts")
      .select(`
        assessment_id,
        user_id,
        enrollment_id,
        assessments:assessment_id (
          module_id
        ),
        enrollments:enrollment_id (
          course_id,
          courses:course_id (title)
        )
      `)
      .eq("id", attemptId)
      .single();

    if (!attemptData) {
      throw new Error("Attempt not found");
    }

    const { data: assessmentData } = await supabase
      .from("assessments")
      .select("passing_score")
      .eq("id", attemptData.assessment_id)
      .single();

    const passingScore = assessmentData?.passing_score || 70;
    const passed = score !== undefined ? score >= passingScore : undefined;
    const reviewStatus: AssessmentReviewStatus = hasManualReviewQuestions ? "submitted" : "approved";

    // Update attempt
    const { error: updateError } = await executeWriteWithFallback(
      (payload) => supabase
        .from("assessment_attempts")
        .update(payload)
        .eq("id", attemptId),
      {
        submitted_at: new Date().toISOString(),
        answers,
        score: score ?? null,
        passed: passed ?? null,
        time_spent: timeSpent,
        review_status: reviewStatus,
        requires_manual_review: hasManualReviewQuestions,
      },
      "assessment_attempts",
      unsupportedAssessmentAttemptColumns,
    );

    if (updateError) {
      handleSupabaseError(updateError);
      throw updateError;
    }

    // Save individual answers
    const answerInserts = questions.map((question) => {
      const userAnswer = answers[question.id];
      const normalizedCorrectAnswer = normalizeStoredCorrectAnswer(question.correctAnswer, question.options);
      const answerNeedsManualReview = requiresManualReview(question.questionType);
      const isCorrect =
        question.questionType === "multiple_choice" || question.questionType === "true_false"
          ? userAnswer === normalizedCorrectAnswer
          : null;
      const pointsEarned =
        isCorrect === true ? question.points : isCorrect === false ? 0 : null;

      return {
        attempt_id: attemptId,
        question_id: question.id,
        answer: userAnswer || "",
        is_correct: isCorrect,
        points_earned: pointsEarned,
        review_status: answerNeedsManualReview ? "submitted" : "approved",
      };
    });

    if (answerInserts.length > 0) {
      const insertableAnswers = answerInserts.map((answer) => ({ ...answer })) as Array<Record<string, unknown>>;
      let insertError: any = null;

      for (const answerPayload of insertableAnswers) {
        const result = await executeWriteWithFallback(
          (payload) => supabase
            .from("assessment_answers")
            .insert(payload),
          answerPayload,
          "assessment_answers",
          unsupportedAssessmentAnswerColumns,
        );

        if (result.error) {
          insertError = result.error;
          break;
        }
      }

      if (insertError) {
        console.error("Error saving answers:", insertError);
        // Don't throw, as the attempt is already saved
      }
    }

    // Notify user about assessment grading
    try {
      const courseTitle = (attemptData as any).enrollments?.courses?.title || "the course";
      const userId = (attemptData as any).user_id;
      
      if (!hasManualReviewQuestions && userId && courseTitle && score !== undefined && passed !== undefined) {
        await notificationHelpers.notifyAssessmentGraded(
          userId,
          courseTitle,
          score,
          passed
        );
      }
    } catch (notifError) {
      console.error("Error sending assessment notification:", notifError);
      // Don't throw - notification failure shouldn't block assessment submission
    }

    try {
      const enrollmentId = (attemptData as any).enrollment_id;
      const courseId = (attemptData as any).enrollments?.course_id;
      const userId = (attemptData as any).user_id;
      const moduleId = (attemptData as any).assessments?.module_id;

      if (!hasManualReviewQuestions && passed && enrollmentId && moduleId) {
        await moduleCompletionService.markModuleComplete(
          enrollmentId,
          moduleId,
          Math.max(1, Math.ceil(timeSpent / 60)),
        );
      }

      if (enrollmentId) {
        await refreshEnrollmentProgress(enrollmentId);
      }

      await analyticsService.trackEvent({
        eventName: "assessment_submit",
        userId,
        courseId,
        assessmentId: attemptData.assessment_id,
        enrollmentId,
        surface: "assessment_interface",
        metadata: {
          attemptId,
          score,
          passed,
          reviewStatus,
          requiresManualReview: hasManualReviewQuestions,
        },
      });

      await analyticsService.refreshPhase1Analytics(userId);
    } catch (analyticsError) {
      console.error("Error tracking assessment analytics:", analyticsError);
    }

    return { score, passed, reviewStatus, requiresManualReview: hasManualReviewQuestions };
  },

  syncDerivedAssessmentFromQuizBlocks: async (
    moduleId: string,
    moduleTitle: string,
    blocks: ContentBlock[],
    settings?: AssessmentSyncSettings,
  ): Promise<Assessment | null> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const gradableQuizBlocks = getGradableQuizBlocks(blocks);
    if (gradableQuizBlocks.length === 0) {
      await deactivateDerivedAssessmentForModule(moduleId);
      return null;
    }

    const defaults = buildDerivedAssessmentDefaults(moduleTitle, settings);
    const canonicalSkillTags = deriveSkillTags(undefined, defaults.skillTags);
    const canonicalTopicTags = deriveTopicTags(undefined, canonicalSkillTags, defaults.topicTags);

    const { data: existingAssessmentRow, error: assessmentLookupError } = await supabase
      .from("assessments")
      .select("*")
      .eq("module_id", moduleId)
      .maybeSingle();

    if (assessmentLookupError && assessmentLookupError.code !== "PGRST116") {
      handleSupabaseError(assessmentLookupError);
      throw assessmentLookupError;
    }

    let assessmentRow = existingAssessmentRow;

    if (!assessmentRow) {
      const { data: insertedAssessment, error: insertAssessmentError } = await executeWriteWithFallback(
        (payload) => supabase
          .from("assessments")
          .insert(payload)
          .select("*")
          .single(),
        {
          module_id: moduleId,
          title: defaults.title,
          description: defaults.description || null,
          time_limit: defaults.timeLimit || null,
          passing_score: defaults.passingScore,
          max_attempts: defaults.maxAttempts,
          allow_retry_after_passing: defaults.allowRetryAfterPassing,
          is_active: defaults.isActive,
          derived_from_module_quiz: true,
          skill_tags: canonicalSkillTags,
          topic_tags: canonicalTopicTags,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        "assessments",
        unsupportedAssessmentColumns,
      );

      if (insertAssessmentError) {
        handleSupabaseError(insertAssessmentError);
        throw insertAssessmentError;
      }

      assessmentRow = insertedAssessment;
    } else {
      const { data: updatedAssessment, error: updateAssessmentError } = await executeWriteWithFallback(
        (payload) => supabase
          .from("assessments")
          .update(payload)
          .eq("id", existingAssessmentRow.id)
          .select("*")
          .single(),
        {
          title: defaults.title,
          description: defaults.description || null,
          time_limit: defaults.timeLimit || null,
          passing_score: defaults.passingScore,
          max_attempts: defaults.maxAttempts,
          allow_retry_after_passing: defaults.allowRetryAfterPassing,
          is_active: defaults.isActive,
          derived_from_module_quiz: true,
          skill_tags: canonicalSkillTags,
          topic_tags: canonicalTopicTags,
          updated_at: new Date().toISOString(),
        },
        "assessments",
        unsupportedAssessmentColumns,
      );

      if (updateAssessmentError) {
        handleSupabaseError(updateAssessmentError);
        throw updateAssessmentError;
      }

      assessmentRow = updatedAssessment;
    }

    const { data: existingQuestionRows, error: questionLookupError } = await supabase
      .from("assessment_questions")
      .select("*")
      .eq("assessment_id", assessmentRow.id)
      .order("order", { ascending: true });

    if (questionLookupError) {
      handleSupabaseError(questionLookupError);
      throw questionLookupError;
    }

    const existingRows = existingQuestionRows || [];
    const matchedQuestionIds = new Set<string>();
    const fallbackRows = [...existingRows.filter((row) => !row.source_question_key && row.is_active !== false)];

    for (const [index, block] of gradableQuizBlocks.entries()) {
      const payload = toDerivedQuestionPayload(block, index);
      let matchedRow = existingRows.find((row) => row.source_question_key === payload.sourceQuestionKey);

      if (!matchedRow) {
        matchedRow = fallbackRows.find((row) => row.order === payload.order) || fallbackRows.shift();
      }

      if (matchedRow) {
        matchedQuestionIds.add(matchedRow.id);
        const { error: updateQuestionError } = await executeWriteWithFallback(
          (questionPayload) => supabase
            .from("assessment_questions")
            .update(questionPayload)
            .eq("id", matchedRow.id),
          {
            question: payload.question,
            question_type: payload.questionType,
            options: JSON.stringify(payload.options),
            correct_answer: payload.correctAnswer,
            points: payload.points,
            order: payload.order,
            explanation: payload.explanation,
            source_question_key: payload.sourceQuestionKey,
            derived_from_module_quiz: true,
            is_active: true,
          },
          "assessment_questions",
          unsupportedAssessmentQuestionColumns,
        );

        if (updateQuestionError) {
          handleSupabaseError(updateQuestionError);
          throw updateQuestionError;
        }
      } else {
        const { error: insertQuestionError } = await executeWriteWithFallback(
          (questionPayload) => supabase
            .from("assessment_questions")
            .insert(questionPayload),
          {
            assessment_id: assessmentRow.id,
            question: payload.question,
            question_type: payload.questionType,
            options: JSON.stringify(payload.options),
            correct_answer: payload.correctAnswer,
            points: payload.points,
            order: payload.order,
            explanation: payload.explanation,
            source_question_key: payload.sourceQuestionKey,
            derived_from_module_quiz: true,
            is_active: true,
            created_at: new Date().toISOString(),
          },
          "assessment_questions",
          unsupportedAssessmentQuestionColumns,
        );

        if (insertQuestionError) {
          handleSupabaseError(insertQuestionError);
          throw insertQuestionError;
        }
      }
    }

    const staleQuestionIds = existingRows
      .filter((row) => !matchedQuestionIds.has(row.id) && row.is_active !== false)
      .map((row) => row.id);

    if (staleQuestionIds.length > 0) {
      const { error: deactivateQuestionsError } = await executeWriteWithFallback(
        (payload) => supabase
          .from("assessment_questions")
          .update(payload)
          .in("id", staleQuestionIds),
        { is_active: false },
        "assessment_questions",
        unsupportedAssessmentQuestionColumns,
      );

      if (deactivateQuestionsError) {
        handleSupabaseError(deactivateQuestionsError);
        throw deactivateQuestionsError;
      }
    }

    return mapAssessmentRow(assessmentRow);
  },
};

