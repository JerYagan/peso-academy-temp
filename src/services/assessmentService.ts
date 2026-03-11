import { supabase, handleSupabaseError } from "@/lib/supabase";
import {
  getGradableQuizBlocks,
  parseModuleContentBlocks,
  validateQuizAssessmentBlocks,
  type ContentBlock,
} from "@/lib/contentBlocks";
import { analyticsService } from "@/services/analyticsService";
import { notificationHelpers } from "@/services/notificationService";
import { refreshEnrollmentProgress } from "@/services/supabaseDatabaseService";
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

const toDerivedQuestionPayload = (block: ContentBlock, index: number) => ({
  sourceQuestionKey: block.sourceQuestionKey || block.id,
  question: block.content.trim(),
  questionType: block.questionType === "true_false" ? "true_false" : "multiple_choice",
  options: block.options || [],
  correctAnswer:
    block.correctAnswer !== undefined && (block.options || [])[block.correctAnswer] !== undefined
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
    .single();

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
}

export const assessmentService = {
  /**
   * Get assessment for a module
   */
  getAssessmentByModule: async (moduleId: string): Promise<Assessment | null> => {
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
      (selectClause) => {
        let query = supabase
          .from("assessment_questions")
          .select(selectClause)
          .eq("assessment_id", assessmentId)
          .order("order", { ascending: true });

        if (!unsupportedAssessmentQuestionColumns.has("is_active")) {
          query = query.eq("is_active", true);
        }

        return query;
      },
      "*",
      "assessment_questions",
      unsupportedAssessmentQuestionColumns,
    );

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return data?.map(mapAssessmentQuestionRow) || [];
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

    return (
      data?.map((a) => ({
        id: a.id,
        assessmentId: a.assessment_id,
        enrollmentId: a.enrollment_id,
        userId: a.user_id,
        startedAt: a.started_at,
        submittedAt: a.submitted_at || undefined,
        score: a.score === null || a.score === undefined ? undefined : a.score,
        passed: a.passed === null || a.passed === undefined ? undefined : a.passed,
        answers: a.answers || {},
        timeSpent: a.time_spent === null || a.time_spent === undefined ? undefined : a.time_spent,
      })) || []
    );
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

    return {
      id: data.id,
      assessmentId: data.assessment_id,
      enrollmentId: data.enrollment_id,
      userId: data.user_id,
      startedAt: data.started_at,
      submittedAt: data.submitted_at || undefined,
      score: data.score === null || data.score === undefined ? undefined : data.score,
      passed: data.passed === null || data.passed === undefined ? undefined : data.passed,
      answers: data.answers || {},
      timeSpent: data.time_spent === null || data.time_spent === undefined ? undefined : data.time_spent,
    };
  },

  /**
   * Submit assessment attempt
   */
  submitAttempt: async (
    attemptId: string,
    answers: Record<string, string>,
    timeSpent: number,
    questions: AssessmentQuestion[]
  ): Promise<{ score: number; passed: boolean }> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    // Calculate score
    let totalPoints = 0;
    let earnedPoints = 0;

    questions.forEach((question) => {
      totalPoints += question.points;
      const userAnswer = answers[question.id];
      const normalizedCorrectAnswer = normalizeStoredCorrectAnswer(question.correctAnswer, question.options);

      if (question.questionType === "multiple_choice" || question.questionType === "true_false") {
        if (userAnswer === normalizedCorrectAnswer) {
          earnedPoints += question.points;
        }
      }
      // Short answer and essay need manual grading, so we don't count them here
    });

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    // Get assessment and enrollment details to check passing score and get course info
    const { data: attemptData } = await supabase
      .from("assessment_attempts")
      .select(`
        assessment_id,
        user_id,
        enrollment_id,
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
    const passed = score >= passingScore;

    // Update attempt
    const { error: updateError } = await executeWriteWithFallback(
      (payload) => supabase
        .from("assessment_attempts")
        .update(payload)
        .eq("id", attemptId),
      {
        submitted_at: new Date().toISOString(),
        answers,
        score,
        passed,
        time_spent: timeSpent,
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
      
      if (userId && courseTitle) {
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
        },
      });

      await analyticsService.refreshPhase1Analytics(userId);
    } catch (analyticsError) {
      console.error("Error tracking assessment analytics:", analyticsError);
    }

    return { score, passed };
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
      .single();

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

