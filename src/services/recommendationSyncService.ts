import { analyticsService, type PersistedLearnerRecommendation } from "@/services/analyticsService";
import { filterCoursesForUser } from "@/lib/courseAudience";
import { supabase } from "@/lib/supabase";
import { moduleSessionService } from "@/services/moduleSessionService";
import { notificationHelpers } from "@/services/notificationService";
import {
  buildLearnerCourseRecommendations,
  reportingService,
} from "@/services/reportingService";
import { courseService, enrollmentService } from "@/services/supabaseDatabaseService";
import { normalizeUserRole, type User } from "@/types/auth";

export type LearnerRecommendationSurface = "dashboard_recommendations" | "browse_recommendations";

type RecommendationRefreshOptions = {
  trigger?: "profile_update" | "onboarding_completion";
  extraContext?: Record<string, unknown>;
};

const DEFAULT_SURFACES: LearnerRecommendationSurface[] = [
  "dashboard_recommendations",
  "browse_recommendations",
];

export const recommendationSyncService = {
  refreshProfileDrivenRecommendations: async (
    user: User,
    surfaces: LearnerRecommendationSurface[] = DEFAULT_SURFACES,
    options: RecommendationRefreshOptions = {},
  ): Promise<PersistedLearnerRecommendation[]> => {
    const normalizedUser: User = {
      ...user,
      role: normalizeUserRole(user.role),
    };

    if (normalizedUser.role !== "trainee") {
      return [];
    }

    const previousDashboardCourseIds = supabase
      ? await (async () => {
          const { data, error } = await supabase
            .from("learner_recommendations")
            .select("course_id, rank")
            .eq("user_id", normalizedUser.id)
            .eq("source_surface", "dashboard_recommendations")
            .order("rank", { ascending: true })
            .limit(3);

          if (error) {
            console.warn("Failed to read existing dashboard recommendations before refresh:", error);
            return [] as string[];
          }

          return (data || []).map((row: any) => String(row.course_id)).filter(Boolean);
        })()
      : [];

    const [courses, enrollments, performanceSummary, collaborativeSignals, sessionAggregates] = await Promise.all([
      courseService.getCourses(),
      enrollmentService.getEnrollments(normalizedUser.id),
      reportingService.getLearnerPerformanceSummary(normalizedUser.id),
      reportingService.getCollaborativeRecommendationSignals(normalizedUser.id),
      moduleSessionService.getSessionAggregatesByModule(normalizedUser.id),
    ]);

    const visibleCourses = filterCoursesForUser(courses, normalizedUser);

    const recommendations = buildLearnerCourseRecommendations(
      normalizedUser,
      visibleCourses,
      enrollments,
      performanceSummary,
      3,
      sessionAggregates,
      collaborativeSignals,
    );

    if (recommendations.length === 0) {
      return [];
    }

    const recommendationContext = {
      trigger: options.trigger || "profile_update",
      totalEnrollments: enrollments.length,
      industryInterestCount: normalizedUser.industryInterests?.length || 0,
      preferredCategoryCount: normalizedUser.preferredCategories?.length || 0,
      onboardingSkillLevel: normalizedUser.onboardingSkillLevel || null,
      onboardingConfidenceLevel: normalizedUser.onboardingConfidenceLevel || null,
      onboardingWeeklyCommitment: normalizedUser.onboardingWeeklyCommitment || null,
      onboardingDigitalComfort: normalizedUser.onboardingDigitalComfort || null,
      onboardingCompletedAt: normalizedUser.onboardingCompletedAt || null,
      hasProfileSkills: Boolean(normalizedUser.skills && normalizedUser.skills.length > 0),
      hasPerformanceSummary: Boolean(performanceSummary),
      recentSessionCount: sessionAggregates.reduce((sum, aggregate) => sum + aggregate.sessionCount, 0),
      repeatedIncompleteModules: sessionAggregates.filter(
        (aggregate) => aggregate.lastSessionStatus !== "completed" && aggregate.sessionCount >= 2,
      ).length,
      collaborativeCandidateCount: Object.keys(collaborativeSignals).length,
      hybridRecommendationEngine: true,
      ...(options.extraContext || {}),
    };

    const persistedBySurface = await Promise.all(
      surfaces.map((surface) =>
        analyticsService.syncLearnerRecommendations(
          normalizedUser.id,
          recommendations,
          surface,
          recommendationContext,
        ),
      ),
    );

    const persistedDashboardRecommendations = persistedBySurface
      .flat()
      .filter((recommendation) => recommendation.sourceSurface === "dashboard_recommendations")
      .sort((left, right) => left.rank - right.rank)
      .slice(0, 3);

    const nextDashboardCourseIds = persistedDashboardRecommendations.map((recommendation) => recommendation.courseId);
    const recommendationsChanged = nextDashboardCourseIds.length > 0 && (
      nextDashboardCourseIds.length !== previousDashboardCourseIds.length
      || nextDashboardCourseIds.some((courseId, index) => courseId !== previousDashboardCourseIds[index])
    );

    if (recommendationsChanged) {
      try {
        const topRecommendations = persistedDashboardRecommendations
          .map((recommendation) => {
            const matchingCourse = recommendations.find((entry) => entry.course.id === recommendation.courseId)?.course;
            return matchingCourse
              ? { courseId: matchingCourse.id, courseTitle: matchingCourse.title }
              : null;
          })
          .filter((entry): entry is { courseId: string; courseTitle: string } => Boolean(entry));

        if (topRecommendations.length > 0) {
          await notificationHelpers.notifyRecommendationsReady(
            normalizedUser.id,
            topRecommendations,
            options.trigger || "profile_update",
          );
        }
      } catch (notificationError) {
        console.warn("Failed to create recommendation refresh notification:", notificationError);
      }
    }

    return persistedBySurface.flat();
  },
};