import { handleSupabaseError, supabase } from "@/lib/supabase";
import { PracticeQuizEssayResponse } from "@/types";

const unsupportedPracticeQuizEssayFeedbackColumns = new Set<string>();

type PracticeQuizEssayResponseRow = {
  id: string;
  enrollment_id: string;
  course_id: string;
  module_id: string;
  user_id: string;
  block_id: string;
  prompt_title: string | null;
  prompt_text: string;
  guidance_text: string | null;
  response_text: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

type PracticeQuizEssayFeedbackRow = {
  id: string;
  response_id: string;
  feedback_text: string;
  score_points?: number | null;
  reviewed_at: string;
  reviewed_by: string | null;
  reviewers?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

const practiceQuizEssayFeedbackSelect = `
  id,
  response_id,
  feedback_text,
  score_points,
  reviewed_at,
  reviewed_by,
  reviewers:reviewed_by (name, email)
`;

const practiceQuizEssayFeedbackLegacySelect = `
  id,
  response_id,
  feedback_text,
  reviewed_at,
  reviewed_by,
  reviewers:reviewed_by (name, email)
`;

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

const getPracticeQuizEssayFeedbackSelect = () =>
  unsupportedPracticeQuizEssayFeedbackColumns.has("score_points")
    ? practiceQuizEssayFeedbackLegacySelect
    : practiceQuizEssayFeedbackSelect;

const executePracticeQuizEssayFeedbackReadWithFallback = async <T>(
  execute: (selectClause: string) => Promise<{ data: T | null; error: any }>,
): Promise<{ data: T | null; error: any }> => {
  let nextSelect = getPracticeQuizEssayFeedbackSelect();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await execute(nextSelect);
    if (!result.error) {
      return result;
    }

    const missingColumn = getMissingColumnName(result.error, "practice_quiz_essay_feedback");
    if (missingColumn !== "score_points") {
      return result;
    }

    unsupportedPracticeQuizEssayFeedbackColumns.add("score_points");
    nextSelect = practiceQuizEssayFeedbackLegacySelect;
  }

  return execute(nextSelect);
};

const sanitizePracticeQuizEssayFeedbackPayload = (payload: Record<string, unknown>) => {
  const nextPayload = { ...payload };

  for (const column of unsupportedPracticeQuizEssayFeedbackColumns) {
    delete nextPayload[column];
  }

  return nextPayload;
};

const executePracticeQuizEssayFeedbackWriteWithFallback = async (
  execute: (payload: Record<string, unknown>) => Promise<{ error: any }>,
  payload: Record<string, unknown>,
): Promise<{ error: any }> => {
  let nextPayload = sanitizePracticeQuizEssayFeedbackPayload(payload);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await execute(nextPayload);
    if (!result.error) {
      return result;
    }

    const missingColumn = getMissingColumnName(result.error, "practice_quiz_essay_feedback");
    if (missingColumn !== "score_points" || !(missingColumn in nextPayload)) {
      return result;
    }

    unsupportedPracticeQuizEssayFeedbackColumns.add("score_points");
    delete nextPayload.score_points;
  }

  return execute(nextPayload);
};

const mapPracticeQuizEssayResponse = (
  row: PracticeQuizEssayResponseRow,
  feedback?: PracticeQuizEssayFeedbackRow | null,
): PracticeQuizEssayResponse => {
  return {
    id: row.id,
    enrollment_id: row.enrollment_id,
    course_id: row.course_id,
    module_id: row.module_id,
    user_id: row.user_id,
    block_id: row.block_id,
    prompt_title: row.prompt_title,
    prompt_text: row.prompt_text,
    guidance_text: row.guidance_text,
    response_text: row.response_text,
    submitted_at: row.submitted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    review_feedback: feedback?.feedback_text || null,
    review_score_points: typeof feedback?.score_points === "number" ? feedback.score_points : null,
    reviewed_at: feedback?.reviewed_at || null,
    reviewed_by: feedback?.reviewed_by || null,
    reviewer_name: feedback?.reviewers?.name || null,
    reviewer_email: feedback?.reviewers?.email || null,
  };
};

const fetchFeedbackByResponseIds = async (responseIds: string[]) => {
  if (!supabase || responseIds.length === 0) {
    return new Map<string, PracticeQuizEssayFeedbackRow>();
  }

  const { data, error } = await executePracticeQuizEssayFeedbackReadWithFallback((selectClause) =>
    supabase
      .from("practice_quiz_essay_feedback")
      .select(selectClause)
      .in("response_id", responseIds),
  );

  if (error) {
    handleSupabaseError(error);
    return new Map<string, PracticeQuizEssayFeedbackRow>();
  }

  return new Map(
    ((data || []) as PracticeQuizEssayFeedbackRow[]).map((row) => [row.response_id, row]),
  );
};

const mergeResponsesWithFeedback = async (rows: PracticeQuizEssayResponseRow[]) => {
  const feedbackByResponseId = await fetchFeedbackByResponseIds(rows.map((row) => row.id));
  return rows.map((row) => mapPracticeQuizEssayResponse(row, feedbackByResponseId.get(row.id) || null));
};

export const practiceQuizEssayReviewService = {
  getModuleResponses: async (options: {
    enrollmentId: string;
    moduleId: string;
    userId?: string;
  }): Promise<PracticeQuizEssayResponse[]> => {
    if (!supabase) {
      return [];
    }

    let query = supabase
      .from("practice_quiz_essay_responses")
      .select("*")
      .eq("enrollment_id", options.enrollmentId)
      .eq("module_id", options.moduleId)
      .order("submitted_at", { ascending: false });

    if (options.userId) {
      query = query.eq("user_id", options.userId);
    }

    const { data, error } = await query;

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return mergeResponsesWithFeedback((data || []) as PracticeQuizEssayResponseRow[]);
  },

  getEnrollmentResponses: async (enrollmentId: string): Promise<PracticeQuizEssayResponse[]> => {
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from("practice_quiz_essay_responses")
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .order("submitted_at", { ascending: false });

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return mergeResponsesWithFeedback((data || []) as PracticeQuizEssayResponseRow[]);
  },

  upsertLearnerResponse: async (input: {
    enrollmentId: string;
    courseId: string;
    moduleId: string;
    userId: string;
    blockId: string;
    promptTitle?: string | null;
    promptText: string;
    guidanceText?: string | null;
    responseText: string;
  }): Promise<PracticeQuizEssayResponse> => {
    if (!supabase) {
      throw new Error("Supabase client is not available.");
    }

    const timestamp = new Date().toISOString();
    const { data, error } = await supabase
      .from("practice_quiz_essay_responses")
      .upsert(
        {
          enrollment_id: input.enrollmentId,
          course_id: input.courseId,
          module_id: input.moduleId,
          user_id: input.userId,
          block_id: input.blockId,
          prompt_title: input.promptTitle || null,
          prompt_text: input.promptText,
          guidance_text: input.guidanceText || null,
          response_text: input.responseText,
          submitted_at: timestamp,
          updated_at: timestamp,
        },
        {
          onConflict: "enrollment_id,module_id,user_id,block_id",
        },
      )
      .select("*")
      .single();

    if (error || !data) {
      handleSupabaseError(error);
      throw error || new Error("Failed to save practice quiz essay response.");
    }

    const feedbackByResponseId = await fetchFeedbackByResponseIds([data.id]);
    return mapPracticeQuizEssayResponse(
      data as PracticeQuizEssayResponseRow,
      feedbackByResponseId.get(data.id) || null,
    );
  },

  saveFeedback: async (input: {
    responseId: string;
    reviewerId: string;
    feedbackText: string;
    scorePoints?: number | null;
  }): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase client is not available.");
    }

    const timestamp = new Date().toISOString();
    const { error } = await executePracticeQuizEssayFeedbackWriteWithFallback(
      (payload) =>
        supabase
          .from("practice_quiz_essay_feedback")
          .upsert(payload, {
            onConflict: "response_id",
          }),
      {
        response_id: input.responseId,
        feedback_text: input.feedbackText,
        score_points: typeof input.scorePoints === "number" && Number.isFinite(input.scorePoints)
          ? Math.max(0, input.scorePoints)
          : null,
        reviewed_by: input.reviewerId,
        reviewed_at: timestamp,
        updated_at: timestamp,
      },
    );

    if (error) {
      handleSupabaseError(error);
      throw error;
    }
  },
};