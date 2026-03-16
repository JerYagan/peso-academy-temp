import { handleSupabaseError, supabase } from "@/lib/supabase";
import { PracticeQuizCompletionEssayResponseSnapshot, PracticeQuizCompletionSummary, PracticeQuizDraftSnapshot, PracticeQuizEssayResponse, Submission } from "@/types";
import { practiceQuizEssayReviewService } from "@/services/practiceQuizEssayReviewService";
import { submissionService } from "@/services/submissionService";

const MODULE_VIEWER_STATE_CACHE_TTL_MS = 15_000;
const MODULE_STATE_SNAPSHOT_UNAVAILABLE_PATTERNS = [
  "module_state_snapshots",
  "does not exist",
  "schema cache",
];

const pendingModuleViewerStateRequests = new Map<string, Promise<ModuleViewerState>>();
const moduleViewerStateCache = new Map<string, { data: ModuleViewerState; expiresAt: number }>();
let moduleStateSnapshotsUnavailable = false;

export interface ModuleViewerState {
  timeSpentMinutes: number | null;
  submissions: Submission[];
  essayResponses: PracticeQuizEssayResponse[];
  practiceQuizDraftSnapshot: PracticeQuizDraftSnapshot | null;
}

type ModuleViewerStateQuery = {
  enrollmentId: string;
  courseId: string;
  moduleId: string;
  userId: string;
};

const getCachedEntry = (key: string) => {
  const entry = moduleViewerStateCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }

  return entry.data;
};

const setCachedEntry = (key: string, data: ModuleViewerState) => {
  moduleViewerStateCache.set(key, {
    data,
    expiresAt: Date.now() + MODULE_VIEWER_STATE_CACHE_TTL_MS,
  });
};

const buildCacheKey = (query: ModuleViewerStateQuery) =>
  `${query.userId}:${query.enrollmentId}:${query.moduleId}`;

const isMissingModuleStateSnapshotTableError = (error: unknown) => {
  const message = [
    typeof error === "object" && error !== null && "message" in error ? String((error as { message?: string }).message || "") : "",
    typeof error === "object" && error !== null && "details" in error ? String((error as { details?: string }).details || "") : "",
  ]
    .join(" ")
    .toLowerCase();

  return MODULE_STATE_SNAPSHOT_UNAVAILABLE_PATTERNS.every((pattern) => message.includes(pattern));
};

const parseOptionalNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizePracticeQuizSummary = (value: unknown): PracticeQuizCompletionSummary | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const updatedAt = typeof source.updatedAt === "string" && source.updatedAt.trim() ? source.updatedAt : null;
  const totalQuestions = parseOptionalNumber(source.totalQuestions);
  const scoredQuestions = parseOptionalNumber(source.scoredQuestions);
  const submittedQuestions = parseOptionalNumber(source.submittedQuestions);
  const correctQuestions = parseOptionalNumber(source.correctQuestions);
  const totalPoints = parseOptionalNumber(source.totalPoints);
  const earnedPoints = parseOptionalNumber(source.earnedPoints);
  const percentageScore = source.percentageScore === null ? null : parseOptionalNumber(source.percentageScore);
  const essayQuestionCount = parseOptionalNumber(source.essayQuestionCount);
  const essayAnsweredCount = parseOptionalNumber(source.essayAnsweredCount);

  if (
    !updatedAt
    || totalQuestions === null
    || scoredQuestions === null
    || submittedQuestions === null
    || correctQuestions === null
    || totalPoints === null
    || earnedPoints === null
    || essayQuestionCount === null
    || essayAnsweredCount === null
  ) {
    return null;
  }

  return {
    totalQuestions,
    scoredQuestions,
    submittedQuestions,
    correctQuestions,
    totalPoints,
    earnedPoints,
    percentageScore,
    essayQuestionCount,
    essayAnsweredCount,
    updatedAt,
  };
};

const normalizeEssayResponseSnapshots = (value: unknown): PracticeQuizCompletionEssayResponseSnapshot[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const source = entry as Record<string, unknown>;
    if (typeof source.blockId !== "string" || typeof source.responseText !== "string") {
      return [];
    }

    return [{
      blockId: source.blockId,
      responseId: typeof source.responseId === "string" ? source.responseId : undefined,
      responseText: source.responseText,
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : undefined,
    }];
  });
};

const normalizeStringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((accumulator, [key, recordValue]) => {
    if (typeof recordValue === "string") {
      accumulator[key] = recordValue;
    }

    return accumulator;
  }, {});
};

const normalizePracticeQuizDraftSnapshot = (value: unknown): PracticeQuizDraftSnapshot | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const summary = normalizePracticeQuizSummary(source.summary);
  const updatedAt = typeof source.updatedAt === "string" && source.updatedAt.trim() ? source.updatedAt : summary?.updatedAt || null;

  if (!summary || !updatedAt) {
    return null;
  }

  const selections = normalizeStringRecord(source.selections);
  const submittedAnswers = normalizeStringRecord(source.submittedAnswers);

  return {
    summary,
    selections,
    submittedAnswers,
    essayResponses: normalizeEssayResponseSnapshots(source.essayResponses),
    updatedAt,
  };
};

const emptyModuleViewerState: ModuleViewerState = {
  timeSpentMinutes: null,
  submissions: [],
  essayResponses: [],
  practiceQuizDraftSnapshot: null,
};

const getPracticeQuizDraftSnapshot = async (query: ModuleViewerStateQuery): Promise<PracticeQuizDraftSnapshot | null> => {
  if (!supabase || moduleStateSnapshotsUnavailable) {
    return null;
  }

  const { data, error } = await supabase
    .from("module_state_snapshots")
    .select("practice_quiz_draft_snapshot")
    .eq("user_id", query.userId)
    .eq("enrollment_id", query.enrollmentId)
    .eq("module_id", query.moduleId)
    .maybeSingle();

  if (error) {
    if (isMissingModuleStateSnapshotTableError(error)) {
      moduleStateSnapshotsUnavailable = true;
      return null;
    }

    handleSupabaseError(error);
    return null;
  }

  return normalizePracticeQuizDraftSnapshot(data?.practice_quiz_draft_snapshot);
};

export const moduleViewerStateService = {
  invalidate(query: Pick<ModuleViewerStateQuery, "userId" | "enrollmentId" | "moduleId">) {
    moduleViewerStateCache.delete(`${query.userId}:${query.enrollmentId}:${query.moduleId}`);
  },

  async getModuleViewerState(query: ModuleViewerStateQuery): Promise<ModuleViewerState> {
    const cacheKey = buildCacheKey(query);
    const cached = getCachedEntry(cacheKey);
    if (cached) {
      return cached;
    }

    const pending = pendingModuleViewerStateRequests.get(cacheKey);
    if (pending) {
      return pending;
    }

    const request = (async () => {
      const [timeSpentResult, submissions, essayResponses, practiceQuizDraftSnapshot] = await Promise.all([
        supabase
          ? supabase
              .from("module_completions")
              .select("time_spent")
              .eq("enrollment_id", query.enrollmentId)
              .eq("module_id", query.moduleId)
              .limit(1)
          : Promise.resolve({ data: null, error: null }),
        submissionService.getModuleSubmissions({
          enrollmentId: query.enrollmentId,
          moduleId: query.moduleId,
          userId: query.userId,
        }),
        practiceQuizEssayReviewService.getModuleResponses({
          enrollmentId: query.enrollmentId,
          moduleId: query.moduleId,
          userId: query.userId,
        }),
        getPracticeQuizDraftSnapshot(query),
      ]);

      if (timeSpentResult?.error) {
        handleSupabaseError(timeSpentResult.error);
      }

      const completionRow = Array.isArray(timeSpentResult?.data) ? timeSpentResult.data[0] : null;
      const result: ModuleViewerState = {
        timeSpentMinutes: typeof completionRow?.time_spent === "number" ? completionRow.time_spent : null,
        submissions,
        essayResponses,
        practiceQuizDraftSnapshot,
      };

      setCachedEntry(cacheKey, result);
      return result;
    })();

    pendingModuleViewerStateRequests.set(cacheKey, request);

    try {
      return await request;
    } catch (error) {
      console.error("Error loading module viewer state:", error);
      return emptyModuleViewerState;
    } finally {
      pendingModuleViewerStateRequests.delete(cacheKey);
    }
  },

  async savePracticeQuizDraftSnapshot(input: ModuleViewerStateQuery & { snapshot: PracticeQuizDraftSnapshot | null }) {
    if (!supabase || moduleStateSnapshotsUnavailable) {
      return;
    }

    const payload = {
      user_id: input.userId,
      enrollment_id: input.enrollmentId,
      course_id: input.courseId,
      module_id: input.moduleId,
      practice_quiz_draft_snapshot: input.snapshot,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("module_state_snapshots")
      .upsert(payload, {
        onConflict: "user_id,enrollment_id,module_id",
      });

    if (error) {
      if (isMissingModuleStateSnapshotTableError(error)) {
        moduleStateSnapshotsUnavailable = true;
        return;
      }

      handleSupabaseError(error);
      throw error;
    }

    const cacheKey = buildCacheKey(input);
    const cached = getCachedEntry(cacheKey);
    if (cached) {
      setCachedEntry(cacheKey, {
        ...cached,
        practiceQuizDraftSnapshot: input.snapshot,
      });
    }
  },
};
