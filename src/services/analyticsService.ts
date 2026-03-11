import { supabase, handleSupabaseError } from "@/lib/supabase";
import type { Course, Enrollment } from "@/types";
import type { LearnerCourseRecommendation } from "@/services/reportingService";

const ANALYTICS_SESSION_KEY = "peso.analytics.session-id";
const ANALYTICS_IMPRESSION_CACHE_PREFIX = "peso.analytics.impressions";

export interface PersistedLearnerRecommendation {
  id: string;
  userId: string;
  courseId: string;
  sourceSurface: string;
  rank: number;
  score: number;
  acceptanceProbability?: number;
  reasons: string[];
  generatedAt: string;
  modelVersion: string;
}

type AnalyticsEventInput = {
  eventName: string;
  userId?: string;
  courseId?: string;
  moduleId?: string;
  assessmentId?: string;
  enrollmentId?: string;
  recommendationId?: string;
  surface?: string;
  metadata?: Record<string, unknown>;
};

const isBrowser = typeof window !== "undefined";

const createClientSideId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getAnalyticsSessionId = () => {
  if (!isBrowser) {
    return createClientSideId();
  }

  const existing = window.sessionStorage.getItem(ANALYTICS_SESSION_KEY);
  if (existing) {
    return existing;
  }

  const nextSessionId = createClientSideId();
  window.sessionStorage.setItem(ANALYTICS_SESSION_KEY, nextSessionId);
  return nextSessionId;
};

const getImpressionCacheKey = (userId: string, surface: string) => {
  return `${ANALYTICS_IMPRESSION_CACHE_PREFIX}:${userId}:${surface}:${getAnalyticsSessionId()}`;
};

const getImpressionCache = (userId: string, surface: string) => {
  if (!isBrowser) {
    return new Set<string>();
  }

  try {
    const raw = window.sessionStorage.getItem(getImpressionCacheKey(userId, surface));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
};

const setImpressionCache = (userId: string, surface: string, values: Set<string>) => {
  if (!isBrowser) {
    return;
  }

  window.sessionStorage.setItem(getImpressionCacheKey(userId, surface), JSON.stringify(Array.from(values)));
};

export const analyticsService = {
  getSessionId: getAnalyticsSessionId,

  trackEvent: async ({
    eventName,
    userId,
    courseId,
    moduleId,
    assessmentId,
    enrollmentId,
    recommendationId,
    surface,
    metadata,
  }: AnalyticsEventInput): Promise<string | null> => {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.rpc("track_analytics_event", {
      p_event_name: eventName,
      p_user_id: userId || null,
      p_course_id: courseId || null,
      p_module_id: moduleId || null,
      p_assessment_id: assessmentId || null,
      p_enrollment_id: enrollmentId || null,
      p_recommendation_id: recommendationId || null,
      p_surface: surface || null,
      p_session_id: getAnalyticsSessionId(),
      p_metadata: metadata || {},
      p_occurred_at: new Date().toISOString(),
    });

    if (error) {
      handleSupabaseError(error);
      return null;
    }

    return typeof data === "string" ? data : null;
  },

  refreshPhase1Analytics: async (userId?: string) => {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.rpc("refresh_phase1_analytics_rollups", {
      p_user_id: userId || null,
    });

    if (error) {
      console.error("Failed to refresh Phase 1 analytics rollups:", error);
    }
  },

  syncLearnerRecommendations: async (
    userId: string,
    recommendations: LearnerCourseRecommendation[],
    sourceSurface: string,
    recommendationContext?: Record<string, unknown>,
  ): Promise<PersistedLearnerRecommendation[]> => {
    if (!supabase || recommendations.length === 0) {
      return [];
    }

    const rows = recommendations.map((recommendation, index) => ({
      user_id: userId,
      course_id: recommendation.course.id,
      source_surface: sourceSurface,
      rank: index + 1,
      score: recommendation.score,
      acceptance_probability: recommendation.acceptanceProbability || 0,
      acceptance_band:
        (recommendation.acceptanceProbability || 0) >= 70
          ? "high"
          : (recommendation.acceptanceProbability || 0) >= 40
            ? "medium"
            : "low",
      reasons: recommendation.reasons,
      source_mix: recommendation.sourceMix || {
        contentBased: true,
        popularityWeighted: true,
        collaborative: false,
        sessionBehavior: true,
        assessmentPerformance: true,
      },
      recommendation_context: recommendationContext || {},
      model_version: recommendation.modelVersion || "phase3-hybrid-v1",
      generated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("learner_recommendations")
      .upsert(rows, { onConflict: "user_id,course_id,source_surface" })
      .select("id, user_id, course_id, source_surface, rank, score, acceptance_probability, reasons, generated_at, model_version");

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    const persistedRecommendations = (data || [])
      .map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        courseId: row.course_id,
        sourceSurface: row.source_surface,
        rank: row.rank,
        score: Number(row.score || 0),
        acceptanceProbability: Number(row.acceptance_probability || 0),
        reasons: Array.isArray(row.reasons) ? row.reasons : [],
        generatedAt: row.generated_at,
        modelVersion: row.model_version,
      }))
      .sort((left, right) => left.rank - right.rank);

    await Promise.all(
      persistedRecommendations.map((recommendation) =>
        analyticsService.trackEvent({
          eventName: "recommendation_refresh",
          userId,
          courseId: recommendation.courseId,
          recommendationId: recommendation.id,
          surface: sourceSurface,
          metadata: {
            rank: recommendation.rank,
            score: recommendation.score,
            modelVersion: recommendation.modelVersion,
            recommendationCount: persistedRecommendations.length,
            recommendationContext: recommendationContext || {},
          },
        }),
      ),
    );

    void analyticsService.refreshPhase1Analytics(userId);

    return persistedRecommendations;
  },

  logRecommendationImpressions: async (
    userId: string,
    recommendations: PersistedLearnerRecommendation[],
    surface: string,
  ) => {
    if (!supabase || recommendations.length === 0) {
      return;
    }

    const cache = getImpressionCache(userId, surface);
    const unseenRecommendations = recommendations.filter((recommendation) => !cache.has(recommendation.id));

    if (unseenRecommendations.length === 0) {
      return;
    }

    await Promise.all(
      unseenRecommendations.map((recommendation) =>
        analyticsService.trackEvent({
          eventName: "recommendation_impression",
          userId,
          courseId: recommendation.courseId,
          recommendationId: recommendation.id,
          surface,
          metadata: {
            rank: recommendation.rank,
            score: recommendation.score,
            modelVersion: recommendation.modelVersion,
          },
        }),
      ),
    );

    unseenRecommendations.forEach((recommendation) => cache.add(recommendation.id));
    setImpressionCache(userId, surface, cache);
  },

  logRecommendationClick: async (
    userId: string,
    recommendation: Pick<PersistedLearnerRecommendation, "id" | "courseId" | "rank" | "score" | "modelVersion">,
    surface: string,
  ) => {
    await analyticsService.trackEvent({
      eventName: "recommendation_click",
      userId,
      courseId: recommendation.courseId,
      recommendationId: recommendation.id,
      surface,
      metadata: {
        rank: recommendation.rank,
        score: recommendation.score,
        modelVersion: recommendation.modelVersion,
      },
    });
  },

  hydrateRecommendationCards: (
    recommendations: LearnerCourseRecommendation[],
    persistedRecommendations: PersistedLearnerRecommendation[],
  ) => {
    const persistedMap = new Map(
      persistedRecommendations.map((recommendation) => [recommendation.courseId, recommendation]),
    );

    return recommendations.map((recommendation) => ({
      ...recommendation,
      persisted: persistedMap.get(recommendation.course.id),
    }));
  },

  getOriginatingRecommendationOptions: (
    recommendation: PersistedLearnerRecommendation | undefined,
    sourceSurface: string,
  ): { originatingRecommendationId?: string; sourceSurface: string } => {
    return recommendation?.id
      ? {
          originatingRecommendationId: recommendation.id,
          sourceSurface,
        }
      : { sourceSurface };
  },
};

export const getEnrollmentRecommendation = (
  enrollment: Enrollment,
  recommendations: PersistedLearnerRecommendation[],
  courses: Course[],
) => {
  const recommendation = recommendations.find((candidate) => candidate.id === enrollment.sourceRecommendationId);
  if (!recommendation) {
    return null;
  }

  return {
    ...recommendation,
    course: courses.find((course) => course.id === recommendation.courseId) || null,
  };
};