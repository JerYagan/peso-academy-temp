import { analyticsService, type PersistedLearnerRecommendation } from "@/services/analyticsService";
import { moduleSessionService } from "@/services/moduleSessionService";
import {
  buildLearnerCourseRecommendations,
  reportingService,
} from "@/services/reportingService";
import { courseService, enrollmentService } from "@/services/supabaseDatabaseService";
import type { User } from "@/types/auth";

export type LearnerRecommendationSurface = "dashboard_recommendations" | "browse_recommendations";

const DEFAULT_SURFACES: LearnerRecommendationSurface[] = [
  "dashboard_recommendations",
  "browse_recommendations",
];

export const recommendationSyncService = {
  refreshProfileDrivenRecommendations: async (
    user: User,
    surfaces: LearnerRecommendationSurface[] = DEFAULT_SURFACES,
  ): Promise<PersistedLearnerRecommendation[]> => {
    const normalizedUser: User = {
      ...user,
      role: user.role === "jobseeker" ? "trainee" : user.role,
    };

    if (normalizedUser.role !== "trainee") {
      return [];
    }

    const [courses, enrollments, performanceSummary, collaborativeSignals, sessionAggregates] = await Promise.all([
      courseService.getCourses(),
      enrollmentService.getEnrollments(normalizedUser.id),
      reportingService.getLearnerPerformanceSummary(normalizedUser.id),
      reportingService.getCollaborativeRecommendationSignals(normalizedUser.id),
      moduleSessionService.getSessionAggregatesByModule(normalizedUser.id),
    ]);

    const recommendations = buildLearnerCourseRecommendations(
      normalizedUser,
      courses,
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
      trigger: "profile_update",
      totalEnrollments: enrollments.length,
      industryInterestCount: normalizedUser.industryInterests?.length || 0,
      preferredCategoryCount: normalizedUser.preferredCategories?.length || 0,
      onboardingSkillLevel: normalizedUser.onboardingSkillLevel || null,
      hasProfileSkills: Boolean(normalizedUser.skills && normalizedUser.skills.length > 0),
      hasPerformanceSummary: Boolean(performanceSummary),
      recentSessionCount: sessionAggregates.reduce((sum, aggregate) => sum + aggregate.sessionCount, 0),
      repeatedIncompleteModules: sessionAggregates.filter(
        (aggregate) => aggregate.lastSessionStatus !== "completed" && aggregate.sessionCount >= 2,
      ).length,
      collaborativeCandidateCount: Object.keys(collaborativeSignals).length,
      hybridRecommendationEngine: true,
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

    return persistedBySurface.flat();
  },
};