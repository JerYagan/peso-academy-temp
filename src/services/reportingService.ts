import { supabase, handleSupabaseError } from "@/lib/supabase";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, differenceInDays } from "date-fns";
import type { User } from "@/types/auth";
import type { Course, Enrollment } from "@/types";
import { CURATED_STARTER_CATEGORIES } from "@/lib/onboarding";
import type { ModuleSessionAggregate } from "@/services/moduleSessionService";
import { resolveTrainerOwnership } from "@/lib/trainerOwnership";

if (!supabase) {
  console.warn("Supabase client not initialized. Please set up environment variables.");
}

/**
 * Reporting Service
 * Handles all reporting and analytics data aggregation
 */

export interface CompletionReport {
  courseId: string;
  courseTitle: string;
  totalEnrollments: number;
  completedEnrollments: number;
  completionRate: number;
  averageProgress: number;
  averageTimeSpent: number; // in minutes
  completionTrends: Array<{
    date: string;
    completions: number;
  }>;
}

export interface UserActivityReport {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  totalEnrollments: number;
  completedCourses: number;
  totalTimeSpent: number; // in minutes
  lastActivityDate: string | null;
  certificatesEarned: number;
}

export interface CertificateReport {
  certificateId: string;
  certificateNumber: string;
  userId: string;
  userName: string;
  courseTitle: string;
  certificateType: string;
  issuedDate: string;
  verificationCode: string | null;
}

export interface ComplianceReportData {
  period: string;
  totalTrainings: number;
  totalParticipants: number;
  totalCompletions: number;
  completionRate: number;
  tesdaAccreditedTrainings: number;
  certificatesIssued: number;
  averageTrainingDuration: number;
  courses: Array<{
    courseTitle: string;
    participants: number;
    completions: number;
    completionRate: number;
  }>;
}

export interface EnrollmentReport {
  enrollmentId: string;
  userId: string;
  userName: string;
  courseId: string;
  courseTitle: string;
  enrolledDate: string;
  completedDate: string | null;
  progress: number;
  status: string;
  timeSpent: number; // in minutes
}

export interface AdminDashboardTrendPoint {
  month: string;
  label: string;
  totalEnrollments: number;
  completedEnrollments: number;
  completionRate: number;
  certificatesIssued: number;
  averageProgress: number;
  averageAssessmentScore: number;
  activeLearners: number;
  timeSpentHours: number;
}

export interface AdminDashboardCourseInsight {
  courseId: string;
  courseTitle: string;
  enrollments: number;
  completionRate: number;
  certificatesIssued: number;
  averageProgress: number;
}

export interface AdminDashboardAnalytics {
  totalUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  completionRate: number;
  certificatesIssued: number;
  activeLearners7Days: number;
  activeLearners30Days: number;
  averageProgress: number;
  averageAssessmentScore: number;
  totalLearningHours: number;
  monthlyTrends: AdminDashboardTrendPoint[];
  topCourses: AdminDashboardCourseInsight[];
}

export interface TrainerDashboardTrendPoint {
  month: string;
  label: string;
  newEnrollments: number;
  completedEnrollments: number;
  certificatesIssued: number;
  averageAssessmentScore: number;
  learningHours: number;
}

export interface TrainerDashboardCourseInsight {
  courseId: string;
  courseTitle: string;
  category: string;
  level: Course["level"];
  enrollments: number;
  learnerCount: number;
  completionRate: number;
  averageProgress: number;
  averageAssessmentScore: number;
  averageLearningHours: number;
  certificatesIssued: number;
}

export interface TrainerDashboardModuleInsight {
  moduleId: string;
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  learnerCount: number;
  completedLearners: number;
  completionRate: number;
  averageLearningMinutes: number;
  averageAssessmentScore: number;
  failureRate: number;
  attentionLevel: "healthy" | "watch" | "critical";
  insight: string;
}

export interface TrainerDashboardAnalytics {
  showingAllCoursesFallback: boolean;
  totalCourses: number;
  totalLearners: number;
  totalEnrollments: number;
  completionRate: number;
  averageAssessmentScore: number;
  averageLearningHoursPerCourse: number;
  certificatesIssued: number;
  joinedThisMonth: number;
  completedThisMonth: number;
  averageCompletionRatePerCourse: number;
  cohortSegments: {
    notStarted: number;
    inProgress: number;
    completed: number;
    atRisk: number;
  };
  monthlyTrends: TrainerDashboardTrendPoint[];
  courseInsights: TrainerDashboardCourseInsight[];
  moduleInsights: TrainerDashboardModuleInsight[];
}

export interface LearnerPerformanceAssessmentRecord {
  id: string;
  assessmentTitle: string;
  moduleTitle: string;
  courseTitle: string;
  score: number | null;
  passed: boolean | null;
  submittedAt: string | null;
  timeSpentMinutes: number;
}

export interface LearnerPerformanceModuleRecord {
  moduleId: string;
  moduleTitle: string;
  courseTitle: string;
  completedAt: string | null;
  timeSpentMinutes: number;
}

export interface LearnerPerformanceTopicResult {
  topic: string;
  averageScore: number | null;
  assessmentsTaken: number;
  modulesCompleted: number;
  totalTimeSpentMinutes: number;
}

export interface LearnerPerformanceSummary {
  assessmentsTaken: number;
  scoredAssessments: number;
  passedAssessments: number;
  averageAssessmentScore: number;
  bestAssessmentScore: number;
  modulesCompleted: number;
  totalModules: number;
  overallModuleCompletionRate: number;
  totalLearningMinutes: number;
  topicPerformance: LearnerPerformanceTopicResult[];
  strongestTopic: LearnerPerformanceTopicResult | null;
  needsImprovementTopic: LearnerPerformanceTopicResult | null;
  recentAssessments: LearnerPerformanceAssessmentRecord[];
  recentModules: LearnerPerformanceModuleRecord[];
}

export interface LearnerCourseRecommendation {
  course: Course;
  score: number;
  reasons: string[];
  sourceMix?: {
    contentBased: boolean;
    popularityWeighted: boolean;
    collaborative: boolean;
    sessionBehavior: boolean;
    assessmentPerformance: boolean;
  };
  modelVersion?: string;
}

export interface CollaborativeRecommendationSignal {
  courseId: string;
  normalizedScore: number;
  supportCount: number;
  completedBySimilarLearners: number;
  similarLearnerCount: number;
  reason: string;
}

export interface CollaborativeRecommendationNeighbor {
  learnerId: string;
  learnerName: string | null;
  learnerEmail: string | null;
  similarityScore: number;
  overlapCount: number;
  completedOverlapCount: number;
  averageProgressCloseness: number;
  sharedCourses: Array<{
    courseId: string;
    courseTitle: string;
    learnerProgress: number;
    neighborProgress: number;
    neighborStatus: string;
  }>;
}

export interface CollaborativeRecommendationCandidate {
  courseId: string;
  courseTitle: string;
  normalizedScore: number;
  rawScore: number;
  supportCount: number;
  completedBySimilarLearners: number;
  similarLearnerCount: number;
  supportingLearnerIds: string[];
  reason: string;
}

export interface CollaborativeRecommendationDebugData {
  learnerId: string;
  targetCourseCount: number;
  similarLearnerCount: number;
  neighbors: CollaborativeRecommendationNeighbor[];
  candidates: CollaborativeRecommendationCandidate[];
}

interface CollaborativeRecommendationComputation {
  learnerId: string;
  targetCourseCount: number;
  similarLearnerCount: number;
  signalsByCourseId: Record<string, CollaborativeRecommendationSignal>;
  neighbors: CollaborativeRecommendationNeighbor[];
  candidates: CollaborativeRecommendationCandidate[];
}

interface LearnerRecommendationBehaviorSignals {
  recentSessionCount: number;
  recentSessionDurationSeconds: number;
  recentActiveCategories: string[];
  struggleCategories: string[];
  revisitedModuleTitles: string[];
  healthyEngagement: boolean;
  repeatedIncompleteCount: number;
  latestSessionAt: string | null;
}

const RECOMMENDATION_RECENT_WINDOW_DAYS = 14;
const RECOMMENDATION_STRUGGLE_MIN_SESSION_COUNT = 4;
const RECOMMENDATION_STRUGGLE_MAX_AVERAGE_MINUTES = 12;
const RECOMMENDATION_HEALTHY_ENGAGEMENT_MIN_MODULES = 3;
const RECOMMENDATION_HEALTHY_ENGAGEMENT_MIN_MINUTES = 60;
const RECOMMENDATION_MOMENTUM_MIN_SESSION_COUNT = 4;
const RECOMMENDATION_REPEAT_INCOMPLETE_MIN_COUNT = 2;
const COLLABORATIVE_MIN_SHARED_COURSES = 1;
const COLLABORATIVE_MAX_NEIGHBORS = 12;
const COLLABORATIVE_MAX_CANDIDATES = 40;

const createEmptyLearnerPerformanceSummary = (): LearnerPerformanceSummary => ({
  assessmentsTaken: 0,
  scoredAssessments: 0,
  passedAssessments: 0,
  averageAssessmentScore: 0,
  bestAssessmentScore: 0,
  modulesCompleted: 0,
  totalModules: 0,
  overallModuleCompletionRate: 0,
  totalLearningMinutes: 0,
  topicPerformance: [],
  strongestTopic: null,
  needsImprovementTopic: null,
  recentAssessments: [],
  recentModules: [],
});

const normalizeSet = (values: string[] | undefined) =>
  new Set((values || []).map((value) => value.toLowerCase().trim()).filter(Boolean));

const isStarterFriendlyCourse = (course: Course) => {
  const normalizedCategory = course.category.toLowerCase();
  return course.level === "Beginner" || CURATED_STARTER_CATEGORIES.includes(normalizedCategory as (typeof CURATED_STARTER_CATEGORIES)[number]);
};

const buildBehaviorSignals = (
  courses: Course[],
  sessionAggregates: ModuleSessionAggregate[],
): LearnerRecommendationBehaviorSignals => {
  if (sessionAggregates.length === 0) {
    return {
      recentSessionCount: 0,
      recentSessionDurationSeconds: 0,
      recentActiveCategories: [],
      struggleCategories: [],
      revisitedModuleTitles: [],
      healthyEngagement: false,
      repeatedIncompleteCount: 0,
      latestSessionAt: null,
    };
  }

  const courseMap = new Map(courses.map((course) => [course.id, course]));
  const now = Date.now();
  const recentWindowMs = RECOMMENDATION_RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentAggregates = sessionAggregates.filter((aggregate) => {
    const lastSeen = new Date(aggregate.lastSeenAt).getTime();
    return !Number.isNaN(lastSeen) && now - lastSeen <= recentWindowMs;
  });
  const struggleAggregates = sessionAggregates.filter(
    (aggregate) =>
      aggregate.sessionCount >= RECOMMENDATION_STRUGGLE_MIN_SESSION_COUNT &&
      aggregate.lastSessionStatus !== "completed" &&
      aggregate.totalDurationSeconds / Math.max(aggregate.sessionCount, 1) <=
        RECOMMENDATION_STRUGGLE_MAX_AVERAGE_MINUTES * 60,
  );

  return {
    recentSessionCount: recentAggregates.reduce((sum, aggregate) => sum + aggregate.sessionCount, 0),
    recentSessionDurationSeconds: recentAggregates.reduce((sum, aggregate) => sum + aggregate.totalDurationSeconds, 0),
    recentActiveCategories: Array.from(
      new Set(
        recentAggregates
          .map((aggregate) => courseMap.get(aggregate.courseId)?.category.toLowerCase().trim() || "")
          .filter(Boolean),
      ),
    ),
    struggleCategories: Array.from(
      new Set(
        struggleAggregates
          .map((aggregate) => courseMap.get(aggregate.courseId)?.category.toLowerCase().trim() || "")
          .filter(Boolean),
      ),
    ),
    revisitedModuleTitles: struggleAggregates
      .map((aggregate) => aggregate.moduleTitle?.trim() || "")
      .filter(Boolean)
      .slice(0, 3),
    healthyEngagement:
      recentAggregates.length >= RECOMMENDATION_HEALTHY_ENGAGEMENT_MIN_MODULES &&
      recentAggregates.reduce((sum, aggregate) => sum + aggregate.totalDurationSeconds, 0) >=
        RECOMMENDATION_HEALTHY_ENGAGEMENT_MIN_MINUTES * 60,
    repeatedIncompleteCount: struggleAggregates.length,
    latestSessionAt: sessionAggregates[0]?.lastSeenAt || null,
  };
};

const buildCollaborativeReason = (signal: {
  supportCount: number;
  completedBySimilarLearners: number;
  similarLearnerCount: number;
}) => {
  if (signal.completedBySimilarLearners >= 2) {
    return `${signal.completedBySimilarLearners} similar learners completed this course`;
  }

  if (signal.supportCount >= 2) {
    return `${signal.supportCount} learners with similar histories also chose this course`;
  }

  if (signal.similarLearnerCount > 0) {
    return "Matches learning paths taken by similar trainees";
  }

  return "Suggested from similar trainee enrollment patterns";
};

const buildCollaborativeRecommendationComputation = async (
  userId: string,
): Promise<CollaborativeRecommendationComputation> => {
  if (!supabase) {
    return {
      learnerId: userId,
      targetCourseCount: 0,
      similarLearnerCount: 0,
      signalsByCourseId: {},
      neighbors: [],
      candidates: [],
    };
  }

  try {
    const { data: targetEnrollmentRows, error: targetEnrollmentsError } = await supabase
      .from("enrollments")
      .select("course_id, status, progress")
      .eq("user_id", userId)
      .neq("status", "dropped");

    if (targetEnrollmentsError) {
      handleSupabaseError(targetEnrollmentsError);
      return {
        learnerId: userId,
        targetCourseCount: 0,
        similarLearnerCount: 0,
        signalsByCourseId: {},
        neighbors: [],
        candidates: [],
      };
    }

    const targetEnrollments = targetEnrollmentRows || [];
    if (targetEnrollments.length === 0) {
      return {
        learnerId: userId,
        targetCourseCount: 0,
        similarLearnerCount: 0,
        signalsByCourseId: {},
        neighbors: [],
        candidates: [],
      };
    }

    const targetCourseIds = Array.from(new Set(targetEnrollments.map((row) => row.course_id).filter(Boolean)));
    if (targetCourseIds.length === 0) {
      return {
        learnerId: userId,
        targetCourseCount: 0,
        similarLearnerCount: 0,
        signalsByCourseId: {},
        neighbors: [],
        candidates: [],
      };
    }

    const targetProgressByCourseId = new Map(
      targetEnrollments.map((row) => [row.course_id, Number(row.progress || 0)]),
    );

    const { data: overlappingEnrollmentsRows, error: overlapsError } = await supabase
      .from("enrollments")
      .select("user_id, course_id, status, progress")
      .in("course_id", targetCourseIds)
      .neq("user_id", userId)
      .neq("status", "dropped");

    if (overlapsError) {
      handleSupabaseError(overlapsError);
      return {
        learnerId: userId,
        targetCourseCount: targetCourseIds.length,
        similarLearnerCount: 0,
        signalsByCourseId: {},
        neighbors: [],
        candidates: [],
      };
    }

    const neighborStats = new Map<string, {
      overlapCount: number;
      completedOverlapCount: number;
      progressClosenessSum: number;
      sharedCourses: Array<{
        courseId: string;
        targetProgress: number;
        neighborProgress: number;
        neighborStatus: string;
        progressCloseness: number;
      }>;
    }>();

    for (const row of overlappingEnrollmentsRows || []) {
      if (!row.user_id || !row.course_id) {
        continue;
      }

      const neighborId = row.user_id;
      const targetProgress = targetProgressByCourseId.get(row.course_id) || 0;
      const candidateProgress = Number(row.progress || 0);
      const progressCloseness = Math.max(0, 1 - Math.abs(targetProgress - candidateProgress) / 100);

      const existing = neighborStats.get(neighborId) || {
        overlapCount: 0,
        completedOverlapCount: 0,
        progressClosenessSum: 0,
        sharedCourses: [],
      };

      existing.overlapCount += 1;
      if (row.status === "completed" || candidateProgress >= 100) {
        existing.completedOverlapCount += 1;
      }
      existing.progressClosenessSum += progressCloseness;
      existing.sharedCourses.push({
        courseId: row.course_id,
        targetProgress,
        neighborProgress: candidateProgress,
        neighborStatus: row.status || "in_progress",
        progressCloseness,
      });
      neighborStats.set(neighborId, existing);
    }

    const rankedNeighbors = Array.from(neighborStats.entries())
      .filter(([, stats]) => stats.overlapCount >= COLLABORATIVE_MIN_SHARED_COURSES)
      .map(([neighborId, stats]) => {
        const averageProgressCloseness = stats.progressClosenessSum / Math.max(stats.overlapCount, 1);
        const similarityScore =
          stats.overlapCount * 1.6 +
          stats.completedOverlapCount * 1.25 +
          averageProgressCloseness * 1.4;

        return {
          neighborId,
          similarityScore,
          overlapCount: stats.overlapCount,
          completedOverlapCount: stats.completedOverlapCount,
          averageProgressCloseness,
          sharedCourses: stats.sharedCourses,
        };
      })
      .sort((left, right) => right.similarityScore - left.similarityScore)
      .slice(0, COLLABORATIVE_MAX_NEIGHBORS);

    if (rankedNeighbors.length === 0) {
      return {
        learnerId: userId,
        targetCourseCount: targetCourseIds.length,
        similarLearnerCount: 0,
        signalsByCourseId: {},
        neighbors: [],
        candidates: [],
      };
    }

    const topNeighborIds = rankedNeighbors.map((neighbor) => neighbor.neighborId);
    const neighborWeightMap = new Map(rankedNeighbors.map((neighbor) => [neighbor.neighborId, neighbor.similarityScore]));

    const { data: neighborCandidateRows, error: neighborCandidatesError } = await supabase
      .from("enrollments")
      .select("user_id, course_id, status, progress")
      .in("user_id", topNeighborIds)
      .neq("status", "dropped");

    if (neighborCandidatesError) {
      handleSupabaseError(neighborCandidatesError);
      return {
        learnerId: userId,
        targetCourseCount: targetCourseIds.length,
        similarLearnerCount: rankedNeighbors.length,
        signalsByCourseId: {},
        neighbors: [],
        candidates: [],
      };
    }

    const candidateSignals = new Map<string, {
      rawScore: number;
      supportUserIds: Set<string>;
      completedBySimilarLearners: number;
      supportingLearnerIds: Set<string>;
    }>();

    for (const row of neighborCandidateRows || []) {
      if (!row.user_id || !row.course_id || targetCourseIds.includes(row.course_id)) {
        continue;
      }

      const neighborWeight = neighborWeightMap.get(row.user_id) || 0;
      if (neighborWeight <= 0) {
        continue;
      }

      const progress = Number(row.progress || 0);
      const interactionWeight =
        row.status === "completed" || progress >= 100
          ? 1.25
          : progress >= 60
            ? 1
            : progress >= 25
              ? 0.7
              : 0.45;

      const existing = candidateSignals.get(row.course_id) || {
        rawScore: 0,
        supportUserIds: new Set<string>(),
        completedBySimilarLearners: 0,
        supportingLearnerIds: new Set<string>(),
      };

      existing.rawScore += neighborWeight * interactionWeight;
      existing.supportUserIds.add(row.user_id);
      existing.supportingLearnerIds.add(row.user_id);
      if (row.status === "completed" || progress >= 100) {
        existing.completedBySimilarLearners += 1;
      }
      candidateSignals.set(row.course_id, existing);
    }

    const rankedCandidates = Array.from(candidateSignals.entries())
      .map(([courseId, signal]) => ({
        courseId,
        rawScore: signal.rawScore,
        supportCount: signal.supportUserIds.size,
        completedBySimilarLearners: signal.completedBySimilarLearners,
        supportingLearnerIds: Array.from(signal.supportingLearnerIds),
      }))
      .filter((signal) => signal.supportCount > 0)
      .sort((left, right) => right.rawScore - left.rawScore)
      .slice(0, COLLABORATIVE_MAX_CANDIDATES);

    if (rankedCandidates.length === 0) {
      return {
        learnerId: userId,
        targetCourseCount: targetCourseIds.length,
        similarLearnerCount: rankedNeighbors.length,
        signalsByCourseId: {},
        neighbors: [],
        candidates: [],
      };
    }

    const maxRawScore = Math.max(...rankedCandidates.map((signal) => signal.rawScore), 1);

    const courseIdsForLookup = Array.from(
      new Set([
        ...targetCourseIds,
        ...rankedCandidates.map((signal) => signal.courseId),
        ...rankedNeighbors.flatMap((neighbor) => neighbor.sharedCourses.map((course) => course.courseId)),
      ]),
    );
    const courseTitleMap = new Map<string, string>();
    const learnerDirectory = new Map<string, { name: string | null; email: string | null }>();

    const [courseLookupResult, learnerLookupResult] = await Promise.all([
      courseIdsForLookup.length > 0
        ? supabase.from("courses").select("id, title").in("id", courseIdsForLookup)
        : Promise.resolve({ data: [], error: null }),
      topNeighborIds.length > 0
        ? supabase.from("users").select("id, name, email").in("id", topNeighborIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (courseLookupResult.error) {
      console.error("Failed to load collaborative recommendation course titles:", courseLookupResult.error);
    } else {
      for (const course of courseLookupResult.data || []) {
        courseTitleMap.set(course.id, course.title || "Untitled course");
      }
    }

    if (learnerLookupResult.error) {
      console.error("Failed to load collaborative recommendation learner directory:", learnerLookupResult.error);
    } else {
      for (const learner of learnerLookupResult.data || []) {
        learnerDirectory.set(learner.id, {
          name: learner.name || null,
          email: learner.email || null,
        });
      }
    }

    const signalsByCourseId = rankedCandidates.reduce<Record<string, CollaborativeRecommendationSignal>>((accumulator, signal) => {
      accumulator[signal.courseId] = {
        courseId: signal.courseId,
        normalizedScore: Math.max(0, Math.min(1, signal.rawScore / maxRawScore)),
        supportCount: signal.supportCount,
        completedBySimilarLearners: signal.completedBySimilarLearners,
        similarLearnerCount: rankedNeighbors.length,
        reason: buildCollaborativeReason({
          supportCount: signal.supportCount,
          completedBySimilarLearners: signal.completedBySimilarLearners,
          similarLearnerCount: rankedNeighbors.length,
        }),
      };
      return accumulator;
    }, {});

    return {
      learnerId: userId,
      targetCourseCount: targetCourseIds.length,
      similarLearnerCount: rankedNeighbors.length,
      signalsByCourseId,
      neighbors: rankedNeighbors.map((neighbor) => {
        const learner = learnerDirectory.get(neighbor.neighborId);

        return {
          learnerId: neighbor.neighborId,
          learnerName: learner?.name || null,
          learnerEmail: learner?.email || null,
          similarityScore: Number(neighbor.similarityScore.toFixed(3)),
          overlapCount: neighbor.overlapCount,
          completedOverlapCount: neighbor.completedOverlapCount,
          averageProgressCloseness: Number(neighbor.averageProgressCloseness.toFixed(3)),
          sharedCourses: [...neighbor.sharedCourses]
            .sort((left, right) => right.progressCloseness - left.progressCloseness)
            .slice(0, 4)
            .map((course) => ({
              courseId: course.courseId,
              courseTitle: courseTitleMap.get(course.courseId) || "Untitled course",
              learnerProgress: course.targetProgress,
              neighborProgress: course.neighborProgress,
              neighborStatus: course.neighborStatus,
            })),
        } satisfies CollaborativeRecommendationNeighbor;
      }),
      candidates: rankedCandidates.map((candidate) => ({
        courseId: candidate.courseId,
        courseTitle: courseTitleMap.get(candidate.courseId) || "Untitled course",
        normalizedScore: Number(Math.max(0, Math.min(1, candidate.rawScore / maxRawScore)).toFixed(3)),
        rawScore: Number(candidate.rawScore.toFixed(3)),
        supportCount: candidate.supportCount,
        completedBySimilarLearners: candidate.completedBySimilarLearners,
        similarLearnerCount: rankedNeighbors.length,
        supportingLearnerIds: candidate.supportingLearnerIds,
        reason: signalsByCourseId[candidate.courseId]?.reason || buildCollaborativeReason({
          supportCount: candidate.supportCount,
          completedBySimilarLearners: candidate.completedBySimilarLearners,
          similarLearnerCount: rankedNeighbors.length,
        }),
      } satisfies CollaborativeRecommendationCandidate)),
    };
  } catch (error) {
    console.error("Error building collaborative recommendation signals:", error);
    return {
      learnerId: userId,
      targetCourseCount: 0,
      similarLearnerCount: 0,
      signalsByCourseId: {},
      neighbors: [],
      candidates: [],
    };
  }
};

export const buildLearnerCourseRecommendations = (
  user: User | null,
  courses: Course[],
  enrollments: Enrollment[],
  performanceSummary?: LearnerPerformanceSummary | null,
  limit = 3,
  sessionAggregates: ModuleSessionAggregate[] = [],
  collaborativeSignals: Record<string, CollaborativeRecommendationSignal> = {},
): LearnerCourseRecommendation[] => {
  if (!user || user.role !== "trainee") {
    return [];
  }

  const enrolledCourseIds = new Set(enrollments.map((enrollment) => enrollment.courseId));
  const completedCourseIds = new Set(
    enrollments
      .filter((enrollment) => enrollment.status === "completed")
      .map((enrollment) => enrollment.courseId),
  );

  const completedCourses = courses.filter((course) => completedCourseIds.has(course.id));
  const learnerSkills = normalizeSet(user.skills);
  const preferredCategories = normalizeSet(user.preferredCategories);
  const industryInterests = Array.from(normalizeSet(user.industryInterests));
  const completedCategoryCounts = new Map<string, number>();
  completedCourses.forEach((course) => {
    const key = course.category.toLowerCase();
    completedCategoryCounts.set(key, (completedCategoryCounts.get(key) || 0) + 1);
  });

  const strongestTopic = performanceSummary?.strongestTopic?.topic?.toLowerCase() || null;
  const needsImprovementTopic = performanceSummary?.needsImprovementTopic?.topic?.toLowerCase() || null;
  const averageAssessmentScore = performanceSummary?.averageAssessmentScore || 0;
  const overallModuleCompletionRate = performanceSummary?.overallModuleCompletionRate || 0;
  const modulesCompleted = performanceSummary?.modulesCompleted || 0;
  const totalLearningMinutes = performanceSummary?.totalLearningMinutes || 0;
  const hasHistoricalSignals =
    completedCourses.length > 0 ||
    modulesCompleted > 0 ||
    (performanceSummary?.assessmentsTaken || 0) > 0 ||
    totalLearningMinutes > 0;
  const hasOnboardingSignals =
    learnerSkills.size > 0 ||
    preferredCategories.size > 0 ||
    industryInterests.length > 0 ||
    Boolean(user.onboardingSkillLevel);
  const behaviorSignals = buildBehaviorSignals(courses, sessionAggregates);

  const levelRank: Record<Course["level"], number> = {
    Beginner: 1,
    Intermediate: 2,
    Advanced: 3,
  };

  const recommendedLevelRank = (() => {
    switch (user.onboardingSkillLevel) {
      case "beginner":
        return 1;
      case "intermediate":
        return 2;
      case "advanced":
        return 3;
      case "exploring":
      default:
        return 1;
    }
  })();

  return courses
    .filter((course) => !enrolledCourseIds.has(course.id) && course.published !== false)
    .map((course) => {
      let score = 0;
      const reasons: string[] = [];
      let usedPopularityWeight = false;
      const normalizedCategory = course.category.toLowerCase();
      const courseSkills = (course.skills || []).map((skill) => skill.toLowerCase());
      const courseIndustryTags = (course.industryTags || []).map((tag) => tag.toLowerCase());
      const courseCareerPaths = (course.careerPaths || []).map((path) => path.toLowerCase());
      const collaborativeSignal = collaborativeSignals[course.id];
      const skillOverlap = courseSkills.filter((skill) => learnerSkills.has(skill)).length;
      const searchableCourseText = [course.title, course.description, course.category, ...(course.skills || [])]
        .join(" ")
        .toLowerCase();
      const matchingIndustryInterest = industryInterests.find(
        (interest) => searchableCourseText.includes(interest) || courseIndustryTags.includes(interest),
      );

      if (skillOverlap > 0) {
        score += skillOverlap * 22;
        reasons.push(`Matches ${skillOverlap} of your profile skills`);
      }

      if (preferredCategories.has(normalizedCategory)) {
        score += 26;
        reasons.push(`Matches your preferred ${course.category} category`);
      }

      if (matchingIndustryInterest) {
        score += 18;
        reasons.push(`Aligned with your ${matchingIndustryInterest} interest`);
      }

      if (courseCareerPaths.length > 0 && course.level !== "Beginner") {
        score += 3;
      }

      const categoryAffinity = completedCategoryCounts.get(normalizedCategory) || 0;
      if (categoryAffinity > 0) {
        score += categoryAffinity * 18;
        reasons.push(`Builds on your completed ${course.category} training`);
      }

      const matchingCompletedCourse = completedCourses.find(
        (completedCourse) => completedCourse.category.toLowerCase() === normalizedCategory,
      );

      if (
        matchingCompletedCourse &&
        levelRank[course.level] >= levelRank[matchingCompletedCourse.level]
      ) {
        score += 14;
        reasons.push(`Natural next step after ${matchingCompletedCourse.title}`);
      }

      if (strongestTopic && courseSkills.some((skill) => skill.includes(strongestTopic) || strongestTopic.includes(skill))) {
        score += 12;
        reasons.push(`Extends your strong ${performanceSummary?.strongestTopic?.topic} results`);
      }

      if (needsImprovementTopic && courseSkills.some((skill) => skill.includes(needsImprovementTopic) || needsImprovementTopic.includes(skill))) {
        score += 10;
        reasons.push(`Helps improve ${performanceSummary?.needsImprovementTopic?.topic}`);
      }

      const popularityScore = Math.min(20, Math.round((course.enrolledCount || 0) / 15));
      if (popularityScore > 0) {
        score += popularityScore;
        usedPopularityWeight = true;
        reasons.push("Popular among PESO Academy trainees");
      }

      if (collaborativeSignal) {
        const collaborativeBoost = Math.round(collaborativeSignal.normalizedScore * 28);
        if (collaborativeBoost > 0) {
          score += collaborativeBoost;
          reasons.push(collaborativeSignal.reason);
        }
      }

      if (course.isTESDAAccredited) {
        score += 4;
      }

      if (behaviorSignals.recentActiveCategories.includes(normalizedCategory)) {
        score += 12;
        reasons.push(`Builds on your recent ${course.category} learning sessions`);
      }

      if (behaviorSignals.latestSessionAt && behaviorSignals.recentSessionCount >= RECOMMENDATION_MOMENTUM_MIN_SESSION_COUNT) {
        score += 4;
        reasons.push("Matches your recent learning momentum");
      }

      if (behaviorSignals.struggleCategories.includes(normalizedCategory) && course.level === "Beginner") {
        score += 14;
        reasons.push(`Supports areas where recent ${course.category} modules were revisited without completion`);
      }

      if (
        behaviorSignals.revisitedModuleTitles.length > 0 &&
        behaviorSignals.revisitedModuleTitles.some((moduleTitle) => searchableCourseText.includes(moduleTitle.toLowerCase()))
      ) {
        score += 10;
        reasons.push(`Targets content related to modules you revisited recently`);
      }

      if (!hasHistoricalSignals) {
        const levelGap = Math.abs(levelRank[course.level] - recommendedLevelRank);

        if (user.onboardingSkillLevel) {
          if (levelGap === 0) {
            score += 16;
            reasons.push(
              user.onboardingSkillLevel === "exploring"
                ? "Fits the starter level you selected at signup"
                : `Fits your ${user.onboardingSkillLevel} starting level`,
            );
          } else if (levelGap === 1) {
            score += 8;
          }
        }

        if (!hasOnboardingSignals) {
          if (isStarterFriendlyCourse(course)) {
            score += 20;
            reasons.push("Curated starter course for new trainees");
          }

          if (course.level === "Beginner") {
            score += 10;
            reasons.push("Beginner-friendly while your learning profile is still new");
          }
        } else if (course.level === "Beginner" && preferredCategories.size === 0 && industryInterests.length === 0) {
          score += 8;
          reasons.push("Good starter fit based on your onboarding profile");
        }

        if (course.isTESDAAccredited) {
          score += 6;
          reasons.push("Recognized training path to start with");
        }
      }

      if (performanceSummary) {
        const learningMomentum = modulesCompleted >= 3 || totalLearningMinutes >= 180;
        const performingStrongly = averageAssessmentScore >= 85 && overallModuleCompletionRate >= 60;
        const needsFoundationalSupport =
          (performanceSummary.scoredAssessments > 0 && averageAssessmentScore > 0 && averageAssessmentScore < 70) ||
          overallModuleCompletionRate < 40;

        if (performingStrongly && levelRank[course.level] >= 2) {
          score += 12;
          reasons.push("Matches your strong recent assessment and completion momentum");
        }

        if (performingStrongly && behaviorSignals.healthyEngagement && levelRank[course.level] >= 2) {
          score += 14;
          reasons.push("Strong scores and healthy session engagement point to a progression-ready next step");
        }

        if (
          performingStrongly &&
          behaviorSignals.healthyEngagement &&
          (behaviorSignals.recentActiveCategories.includes(normalizedCategory) ||
            courseCareerPaths.length > 0 ||
            courseIndustryTags.some((tag) => industryInterests.includes(tag)))
        ) {
          score += 10;
          reasons.push(
            courseCareerPaths[0]
              ? `Extends your progress toward ${courseCareerPaths[0]}`
              : "Builds on the direction of your strongest recent learning activity",
          );
        }

        if (needsFoundationalSupport && course.level === "Beginner") {
          score += 9;
          reasons.push("Provides a lower-risk step while you build confidence");
        }

        if (
          needsFoundationalSupport &&
          behaviorSignals.repeatedIncompleteCount >= RECOMMENDATION_REPEAT_INCOMPLETE_MIN_COUNT &&
          course.level === "Beginner"
        ) {
          score += 12;
          reasons.push("Lower recent scores plus repeated unfinished sessions suggest a stronger foundational fit");
        }

        if (
          needsFoundationalSupport &&
          behaviorSignals.struggleCategories.includes(normalizedCategory) &&
          course.level === "Beginner"
        ) {
          score += 12;
          reasons.push(`Reinforces fundamentals in a category where recent sessions suggest struggle`);
        }

        if (learningMomentum && course.duration >= 10) {
          score += 6;
          reasons.push("Fits the steady learning time you are already sustaining");
        }
      }

      return {
        course,
        score,
        reasons: Array.from(new Set(reasons)).slice(0, 3),
        sourceMix: {
          contentBased: true,
          popularityWeighted: usedPopularityWeight,
          collaborative: Boolean(collaborativeSignal),
          sessionBehavior: behaviorSignals.recentSessionCount > 0,
          assessmentPerformance: Boolean(performanceSummary),
        },
        modelVersion: "phase3-hybrid-v1",
      } satisfies LearnerCourseRecommendation;
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.course.enrolledCount !== left.course.enrolledCount) {
        return right.course.enrolledCount - left.course.enrolledCount;
      }
      return left.course.title.localeCompare(right.course.title);
    })
    .slice(0, limit);
};

export const reportingService = {
  getCollaborativeRecommendationSignals: async (userId: string) => {
    const computation = await buildCollaborativeRecommendationComputation(userId);
    return computation.signalsByCourseId;
  },

  getCollaborativeRecommendationDebugData: async (userId: string): Promise<CollaborativeRecommendationDebugData> => {
    const computation = await buildCollaborativeRecommendationComputation(userId);

    return {
      learnerId: computation.learnerId,
      targetCourseCount: computation.targetCourseCount,
      similarLearnerCount: computation.similarLearnerCount,
      neighbors: computation.neighbors,
      candidates: computation.candidates,
    };
  },

  /**
   * Get a learner-facing summary of assessment, module, time, and topic performance.
   */
  getLearnerPerformanceSummary: async (userId: string): Promise<LearnerPerformanceSummary | null> => {
    if (!supabase) return null;

    try {
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("enrollments")
        .select("id, course_id")
        .eq("user_id", userId);

      if (enrollmentsError) {
        handleSupabaseError(enrollmentsError);
        return null;
      }

      if (!enrollments || enrollments.length === 0) {
        return createEmptyLearnerPerformanceSummary();
      }

      const enrollmentIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.id)));
      const courseIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.course_id)));

      const [coursesResult, modulesResult, moduleCompletionsResult, moduleSessionsResult, assessmentAttemptsResult] = await Promise.all([
        supabase
          .from("courses")
          .select("id, title, category, skills")
          .in("id", courseIds),
        supabase
          .from("modules")
          .select("id, course_id, title")
          .in("course_id", courseIds),
        supabase
          .from("module_completions")
          .select("enrollment_id, module_id, time_spent, completed_at")
          .in("enrollment_id", enrollmentIds),
        supabase
          .from("module_sessions")
          .select("enrollment_id, module_id, duration_seconds, session_status, last_seen_at")
          .in("enrollment_id", enrollmentIds),
        supabase
          .from("assessment_attempts")
          .select("id, assessment_id, enrollment_id, score, passed, submitted_at, time_spent")
          .eq("user_id", userId)
          .in("enrollment_id", enrollmentIds)
          .not("submitted_at", "is", null),
      ]);

      if (coursesResult.error) {
        handleSupabaseError(coursesResult.error);
        return null;
      }

      if (modulesResult.error) {
        handleSupabaseError(modulesResult.error);
        return null;
      }

      if (moduleCompletionsResult.error) {
        handleSupabaseError(moduleCompletionsResult.error);
        return null;
      }

      if (moduleSessionsResult.error) {
        handleSupabaseError(moduleSessionsResult.error);
        return null;
      }

      if (assessmentAttemptsResult.error) {
        handleSupabaseError(assessmentAttemptsResult.error);
        return null;
      }

      const courses = coursesResult.data || [];
      const modules = modulesResult.data || [];
      const moduleCompletions = moduleCompletionsResult.data || [];
      const moduleSessions = moduleSessionsResult.data || [];
      const assessmentAttempts = assessmentAttemptsResult.data || [];

      const assessmentIds = Array.from(
        new Set(assessmentAttempts.map((attempt) => attempt.assessment_id).filter(Boolean))
      );

      let assessments: Array<{ id: string; title: string; module_id: string }> = [];
      if (assessmentIds.length > 0) {
        const { data: assessmentRows, error: assessmentsError } = await supabase
          .from("assessments")
          .select("id, title, module_id")
          .in("id", assessmentIds);

        if (assessmentsError) {
          handleSupabaseError(assessmentsError);
          return null;
        }

        assessments = assessmentRows || [];
      }

      const enrollmentMap = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]));
      const courseMap = new Map(courses.map((course) => [course.id, course]));
      const moduleMap = new Map(modules.map((module) => [module.id, module]));
      const assessmentMap = new Map(assessments.map((assessment) => [assessment.id, assessment]));
      const buildModuleKey = (enrollmentId: string, moduleId: string) => `${enrollmentId}:${moduleId}`;
      const sessionMinutesByModuleKey = new Map<string, number>();
      const completionMinutesByModuleKey = new Map<string, number>();

      for (const session of moduleSessions) {
        if (!session.enrollment_id || !session.module_id) {
          continue;
        }

        const key = buildModuleKey(session.enrollment_id, session.module_id);
        const minutes = Math.round((session.duration_seconds || 0) / 60);
        sessionMinutesByModuleKey.set(key, (sessionMinutesByModuleKey.get(key) || 0) + minutes);
      }

      for (const completion of moduleCompletions) {
        const key = buildModuleKey(completion.enrollment_id, completion.module_id);
        completionMinutesByModuleKey.set(key, (completionMinutesByModuleKey.get(key) || 0) + (completion.time_spent || 0));
      }

      const getTopicsForCourse = (courseId: string): string[] => {
        const course = courseMap.get(courseId);
        if (!course) return ["General Learning"];

        const normalizedSkills = (course.skills || []).map((skill) => skill.trim()).filter(Boolean);
        if (normalizedSkills.length > 0) {
          return normalizedSkills;
        }

        return [course.category || "General Learning"];
      };

      const topicStats = new Map<string, {
        scoreSum: number;
        scoreCount: number;
        assessmentsTaken: number;
        modulesCompleted: number;
        totalTimeSpentMinutes: number;
      }>();

      const addTopicActivity = (
        courseId: string,
        activity: {
          score?: number | null;
          moduleCompleted?: boolean;
          timeSpentMinutes?: number;
          assessmentTaken?: boolean;
        }
      ) => {
        for (const topic of getTopicsForCourse(courseId)) {
          const existing = topicStats.get(topic) || {
            scoreSum: 0,
            scoreCount: 0,
            assessmentsTaken: 0,
            modulesCompleted: 0,
            totalTimeSpentMinutes: 0,
          };

          if (typeof activity.score === "number" && !Number.isNaN(activity.score)) {
            existing.scoreSum += activity.score;
            existing.scoreCount += 1;
          }

          if (activity.assessmentTaken) {
            existing.assessmentsTaken += 1;
          }

          if (activity.moduleCompleted) {
            existing.modulesCompleted += 1;
          }

          if (activity.timeSpentMinutes) {
            existing.totalTimeSpentMinutes += activity.timeSpentMinutes;
          }

          topicStats.set(topic, existing);
        }
      };

      const recentModules = moduleCompletions
        .filter((completion) => Boolean(completion.completed_at))
        .map((completion) => {
          const module = moduleMap.get(completion.module_id);
          const enrollment = enrollmentMap.get(completion.enrollment_id);
          const course = enrollment ? courseMap.get(enrollment.course_id) : null;
          const timeSpentMinutes = Math.max(
            sessionMinutesByModuleKey.get(buildModuleKey(completion.enrollment_id, completion.module_id)) || 0,
            completion.time_spent || 0,
          );

          if (enrollment?.course_id) {
            addTopicActivity(enrollment.course_id, {
              moduleCompleted: true,
              timeSpentMinutes,
            });
          }

          return {
            moduleId: completion.module_id,
            moduleTitle: module?.title || "Module",
            courseTitle: course?.title || "Course",
            completedAt: completion.completed_at,
            timeSpentMinutes,
          } satisfies LearnerPerformanceModuleRecord;
        })
        .sort((left, right) => {
          const leftTime = left.completedAt ? new Date(left.completedAt).getTime() : 0;
          const rightTime = right.completedAt ? new Date(right.completedAt).getTime() : 0;
          return rightTime - leftTime;
        });

      const completedModuleKeys = new Set(
        moduleCompletions.map((completion) => buildModuleKey(completion.enrollment_id, completion.module_id)),
      );

      for (const [moduleKey, timeSpentMinutes] of sessionMinutesByModuleKey.entries()) {
        if (!timeSpentMinutes || completedModuleKeys.has(moduleKey)) {
          continue;
        }

        const [enrollmentId] = moduleKey.split(":");
        const enrollment = enrollmentMap.get(enrollmentId);
        if (enrollment?.course_id) {
          addTopicActivity(enrollment.course_id, {
            timeSpentMinutes,
          });
        }
      }

      const recentAssessments = assessmentAttempts
        .map((attempt) => {
          const assessment = assessmentMap.get(attempt.assessment_id);
          const module = assessment ? moduleMap.get(assessment.module_id) : null;
          const enrollment = enrollmentMap.get(attempt.enrollment_id);
          const courseId = module?.course_id || enrollment?.course_id;
          const course = courseId ? courseMap.get(courseId) : null;
          const numericScore = attempt.score === null || attempt.score === undefined ? null : Number(attempt.score);
          const timeSpentMinutes = attempt.time_spent || 0;

          if (courseId) {
            addTopicActivity(courseId, {
              score: numericScore,
              assessmentTaken: true,
              timeSpentMinutes,
            });
          }

          return {
            id: attempt.id,
            assessmentTitle: assessment?.title || "Assessment",
            moduleTitle: module?.title || "Module",
            courseTitle: course?.title || "Course",
            score: numericScore,
            passed: attempt.passed,
            submittedAt: attempt.submitted_at,
            timeSpentMinutes,
          } satisfies LearnerPerformanceAssessmentRecord;
        })
        .sort((left, right) => {
          const leftTime = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
          const rightTime = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
          return rightTime - leftTime;
        });

      const topicPerformance = Array.from(topicStats.entries())
        .map(([topic, stats]) => ({
          topic,
          averageScore: stats.scoreCount > 0 ? Math.round(stats.scoreSum / stats.scoreCount) : null,
          assessmentsTaken: stats.assessmentsTaken,
          modulesCompleted: stats.modulesCompleted,
          totalTimeSpentMinutes: stats.totalTimeSpentMinutes,
        }))
        .sort((left, right) => {
          const leftScore = left.averageScore ?? -1;
          const rightScore = right.averageScore ?? -1;
          if (rightScore !== leftScore) return rightScore - leftScore;
          if (right.modulesCompleted !== left.modulesCompleted) return right.modulesCompleted - left.modulesCompleted;
          return right.totalTimeSpentMinutes - left.totalTimeSpentMinutes;
        });

      const topicsWithScores = topicPerformance.filter((topic) => topic.averageScore !== null);
      const scoredAttempts = recentAssessments.filter(
        (attempt): attempt is LearnerPerformanceAssessmentRecord & { score: number } => attempt.score !== null
      );
      const moduleLearningKeys = new Set<string>([
        ...Array.from(sessionMinutesByModuleKey.keys()),
        ...Array.from(completionMinutesByModuleKey.keys()),
      ]);
      const totalModuleMinutes = Array.from(moduleLearningKeys).reduce((sum, key) => {
        return sum + Math.max(sessionMinutesByModuleKey.get(key) || 0, completionMinutesByModuleKey.get(key) || 0);
      }, 0);
      const totalAssessmentMinutes = assessmentAttempts.reduce((sum, attempt) => sum + (attempt.time_spent || 0), 0);

      return {
        assessmentsTaken: recentAssessments.length,
        scoredAssessments: scoredAttempts.length,
        passedAssessments: recentAssessments.filter((attempt) => attempt.passed === true).length,
        averageAssessmentScore:
          scoredAttempts.length > 0
            ? Math.round(scoredAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / scoredAttempts.length)
            : 0,
        bestAssessmentScore:
          scoredAttempts.length > 0
            ? Math.max(...scoredAttempts.map((attempt) => attempt.score))
            : 0,
        modulesCompleted: recentModules.length,
        totalModules: modules.length,
        overallModuleCompletionRate:
          modules.length > 0 ? Math.round((recentModules.length / modules.length) * 100) : 0,
        totalLearningMinutes: totalModuleMinutes + totalAssessmentMinutes,
        topicPerformance: topicPerformance.slice(0, 6),
        strongestTopic: topicPerformance[0] || null,
        needsImprovementTopic:
          topicsWithScores.length > 1
            ? topicsWithScores[topicsWithScores.length - 1]
            : topicsWithScores[0] || null,
        recentAssessments: recentAssessments.slice(0, 5),
        recentModules: recentModules.slice(0, 5),
      };
    } catch (error) {
      console.error("Error getting learner performance summary:", error);
      return null;
    }
  },

  /**
   * Get organization-wide analytics for the admin dashboard
   */
  getAdminDashboardAnalytics: async (): Promise<AdminDashboardAnalytics | null> => {
    if (!supabase) return null;

    try {
      const now = new Date();
      const trendStart = startOfMonth(subMonths(now, 5));
      const trendMonths = Array.from({ length: 6 }, (_, index) => {
        const date = startOfMonth(subMonths(now, 5 - index));
        const key = format(date, "yyyy-MM");

        return {
          month: key,
          label: format(date, "MMM"),
          totalEnrollments: 0,
          completedEnrollments: 0,
          completionRate: 0,
          certificatesIssued: 0,
          averageProgress: 0,
          averageAssessmentScore: 0,
          activeLearners: 0,
          timeSpentHours: 0,
        } satisfies AdminDashboardTrendPoint;
      });

      const trendMap = new Map(
        trendMonths.map((point) => [point.month, {
          ...point,
          progressSum: 0,
          progressCount: 0,
          scoreSum: 0,
          scoreCount: 0,
          activeLearnerIds: new Set<string>(),
          completionTimeSpentMinutes: 0,
          sessionTimeSpentMinutes: 0,
        }])
      );

      const enrollmentsQueryWithActivity = supabase
        .from("enrollments")
        .select("id, user_id, course_id, progress, status, enrolled_at, completed_at, updated_at")
        .order("enrolled_at", { ascending: false });

      let enrollmentsResult: {
        data: Array<{
          id: string;
          user_id: string;
          course_id: string;
          progress: number | null;
          status: string;
          enrolled_at: string;
          completed_at: string | null;
          updated_at?: string | null;
        }> | null;
        error: { message: string } | null;
      } = await enrollmentsQueryWithActivity;
      if (enrollmentsResult.error && enrollmentsResult.error.message.toLowerCase().includes("updated_at")) {
        enrollmentsResult = await supabase
          .from("enrollments")
          .select("id, user_id, course_id, progress, status, enrolled_at, completed_at")
          .order("enrolled_at", { ascending: false });
      }

      const [
        usersResult,
        coursesResult,
        certificatesResult,
        moduleCompletionsResult,
        moduleSessionsResult,
        assessmentAttemptsResult,
        totalCertificatesResult,
        totalModuleCompletionsResult,
        totalAssessmentAttemptsResult,
      ] = await Promise.all([
        supabase.from("users").select("id", { count: "exact" }),
        supabase.from("courses").select("id, title"),
        supabase
          .from("certificates")
          .select("id, course_id, issued_at")
          .gte("issued_at", trendStart.toISOString()),
        supabase
          .from("module_completions")
          .select("enrollment_id, time_spent, completed_at")
          .gte("completed_at", trendStart.toISOString()),
        supabase
          .from("module_sessions")
          .select("user_id, duration_seconds, started_at, last_seen_at"),
        supabase
          .from("assessment_attempts")
          .select("enrollment_id, score, submitted_at")
          .not("score", "is", null)
          .gte("submitted_at", trendStart.toISOString()),
        supabase.from("certificates").select("id", { count: "exact", head: true }),
        supabase.from("module_completions").select("time_spent, completed_at"),
        supabase
          .from("assessment_attempts")
          .select("score")
          .not("score", "is", null),
      ]);

      if (coursesResult.error) {
        handleSupabaseError(coursesResult.error);
        return null;
      }

      if (enrollmentsResult.error) {
        handleSupabaseError(enrollmentsResult.error);
        return null;
      }

      if (certificatesResult.error) {
        handleSupabaseError(certificatesResult.error);
        return null;
      }

      if (moduleCompletionsResult.error) {
        handleSupabaseError(moduleCompletionsResult.error);
        return null;
      }

      if (moduleSessionsResult.error) {
        handleSupabaseError(moduleSessionsResult.error);
        return null;
      }

      if (assessmentAttemptsResult.error) {
        handleSupabaseError(assessmentAttemptsResult.error);
        return null;
      }

      if (totalCertificatesResult.error) {
        handleSupabaseError(totalCertificatesResult.error);
        return null;
      }

      if (totalModuleCompletionsResult.error) {
        handleSupabaseError(totalModuleCompletionsResult.error);
        return null;
      }

      if (totalAssessmentAttemptsResult.error) {
        handleSupabaseError(totalAssessmentAttemptsResult.error);
        return null;
      }

      const courses = coursesResult.data || [];
      const enrollments = (enrollmentsResult.data || []) as Array<{
        id: string;
        user_id: string;
        course_id: string;
        progress: number | null;
        status: string;
        enrolled_at: string;
        completed_at: string | null;
        updated_at?: string | null;
      }>;
      const certificates = certificatesResult.data || [];
      const moduleCompletions = moduleCompletionsResult.data || [];
      const moduleSessions = moduleSessionsResult.data || [];
      const assessmentAttempts = assessmentAttemptsResult.data || [];
      const totalModuleCompletions = totalModuleCompletionsResult.data || [];
      const totalAssessmentAttempts = totalAssessmentAttemptsResult.data || [];

      const courseTitleMap = new Map(courses.map((course) => [course.id, course.title]));
      const enrollmentMap = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]));
      const courseStats = new Map<string, {
        enrollments: number;
        completedEnrollments: number;
        progressSum: number;
        progressCount: number;
        certificatesIssued: number;
      }>();
      const activeLearners7Days = new Set<string>();
      const activeLearners30Days = new Set<string>();

      const getMonthKey = (value: string | null | undefined) => {
        if (!value) return null;

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;

        return format(date, "yyyy-MM");
      };

      for (const enrollment of enrollments) {
        const progress = enrollment.progress || 0;
        const lastActivity = enrollment.updated_at || enrollment.completed_at || enrollment.enrolled_at;
        const lastActivityDate = new Date(lastActivity);

        if (!Number.isNaN(lastActivityDate.getTime())) {
          const daysSinceActivity = differenceInDays(now, lastActivityDate);
          if (daysSinceActivity <= 30) activeLearners30Days.add(enrollment.user_id);
          if (daysSinceActivity <= 7) activeLearners7Days.add(enrollment.user_id);
        }

        const enrolledMonthKey = getMonthKey(enrollment.enrolled_at);
        if (enrolledMonthKey && trendMap.has(enrolledMonthKey)) {
          const trendPoint = trendMap.get(enrolledMonthKey)!;
          trendPoint.totalEnrollments += 1;
          trendPoint.progressSum += progress;
          trendPoint.progressCount += 1;
        }

        const completedMonthKey = getMonthKey(enrollment.completed_at);
        if ((enrollment.status === "completed" || progress === 100) && completedMonthKey && trendMap.has(completedMonthKey)) {
          const trendPoint = trendMap.get(completedMonthKey)!;
          trendPoint.completedEnrollments += 1;
        }

        const existingCourseStats = courseStats.get(enrollment.course_id) || {
          enrollments: 0,
          completedEnrollments: 0,
          progressSum: 0,
          progressCount: 0,
          certificatesIssued: 0,
        };

        existingCourseStats.enrollments += 1;
        existingCourseStats.progressSum += progress;
        existingCourseStats.progressCount += 1;
        if (enrollment.status === "completed" || progress === 100) {
          existingCourseStats.completedEnrollments += 1;
        }
        courseStats.set(enrollment.course_id, existingCourseStats);
      }

      for (const certificate of certificates) {
        const monthKey = getMonthKey(certificate.issued_at);
        if (monthKey && trendMap.has(monthKey)) {
          trendMap.get(monthKey)!.certificatesIssued += 1;
        }

        const existingCourseStats = courseStats.get(certificate.course_id) || {
          enrollments: 0,
          completedEnrollments: 0,
          progressSum: 0,
          progressCount: 0,
          certificatesIssued: 0,
        };
        existingCourseStats.certificatesIssued += 1;
        courseStats.set(certificate.course_id, existingCourseStats);
      }

      for (const completion of moduleCompletions) {
        const minutes = completion.time_spent || 0;

        const enrollment = enrollmentMap.get(completion.enrollment_id);
        const monthKey = getMonthKey(completion.completed_at || undefined);
        if (monthKey && trendMap.has(monthKey)) {
          const trendPoint = trendMap.get(monthKey)!;
          trendPoint.completionTimeSpentMinutes += minutes;
          if (enrollment?.user_id) {
            trendPoint.activeLearnerIds.add(enrollment.user_id);
          }
        }
      }

      for (const session of moduleSessions) {
        const activityAt = session.last_seen_at || session.started_at;
        const activityDate = activityAt ? new Date(activityAt) : null;
        const minutes = Math.round((session.duration_seconds || 0) / 60);

        if (activityDate && !Number.isNaN(activityDate.getTime())) {
          const daysSinceActivity = differenceInDays(now, activityDate);
          if (daysSinceActivity <= 30) activeLearners30Days.add(session.user_id);
          if (daysSinceActivity <= 7) activeLearners7Days.add(session.user_id);
        }

        const monthKey = getMonthKey(activityAt || undefined);
        if (monthKey && trendMap.has(monthKey)) {
          const trendPoint = trendMap.get(monthKey)!;
          trendPoint.sessionTimeSpentMinutes += minutes;
          trendPoint.activeLearnerIds.add(session.user_id);
        }
      }

      for (const attempt of assessmentAttempts) {
        const score = Number(attempt.score);
        const monthKey = getMonthKey(attempt.submitted_at || undefined);
        if (!Number.isNaN(score) && monthKey && trendMap.has(monthKey)) {
          const trendPoint = trendMap.get(monthKey)!;
          trendPoint.scoreSum += score;
          trendPoint.scoreCount += 1;
        }
      }

      const monthlyTrends = Array.from(trendMap.values()).map((point) => ({
        month: point.month,
        label: point.label,
        totalEnrollments: point.totalEnrollments,
        completedEnrollments: point.completedEnrollments,
        completionRate:
          point.totalEnrollments > 0
            ? Math.round((point.completedEnrollments / point.totalEnrollments) * 100)
            : 0,
        certificatesIssued: point.certificatesIssued,
        averageProgress:
          point.progressCount > 0 ? Math.round(point.progressSum / point.progressCount) : 0,
        averageAssessmentScore:
          point.scoreCount > 0 ? Math.round(point.scoreSum / point.scoreCount) : 0,
        activeLearners: point.activeLearnerIds.size,
        timeSpentHours:
          Math.round((Math.max(point.sessionTimeSpentMinutes, point.completionTimeSpentMinutes) / 60) * 10) / 10,
      }));

      const totalEnrollments = enrollments.length;
      const completedEnrollments = enrollments.filter(
        (enrollment) => enrollment.status === "completed" || (enrollment.progress || 0) === 100
      ).length;
      const progressValues = enrollments.map((enrollment) => enrollment.progress || 0);
      const scoredAttempts = totalAssessmentAttempts
        .map((attempt) => Number(attempt.score))
        .filter((score) => !Number.isNaN(score));
      const allTimeLearningByMonth = new Map<string, { completionMinutes: number; sessionMinutes: number }>();

      for (const completion of totalModuleCompletions) {
        const monthKey = getMonthKey(completion.completed_at || undefined) || "legacy";
        const current = allTimeLearningByMonth.get(monthKey) || { completionMinutes: 0, sessionMinutes: 0 };
        current.completionMinutes += completion.time_spent || 0;
        allTimeLearningByMonth.set(monthKey, current);
      }

      for (const session of moduleSessions) {
        const monthKey = getMonthKey(session.last_seen_at || session.started_at || undefined) || "legacy";
        const current = allTimeLearningByMonth.get(monthKey) || { completionMinutes: 0, sessionMinutes: 0 };
        current.sessionMinutes += Math.round((session.duration_seconds || 0) / 60);
        allTimeLearningByMonth.set(monthKey, current);
      }

      const totalLearningMinutesAllTime = Array.from(allTimeLearningByMonth.values()).reduce(
        (sum, month) => sum + Math.max(month.sessionMinutes, month.completionMinutes),
        0,
      );

      const topCourses = Array.from(courseStats.entries())
        .map(([courseId, stats]) => ({
          courseId,
          courseTitle: courseTitleMap.get(courseId) || "Unknown Course",
          enrollments: stats.enrollments,
          completionRate: stats.enrollments > 0 ? Math.round((stats.completedEnrollments / stats.enrollments) * 100) : 0,
          certificatesIssued: stats.certificatesIssued,
          averageProgress: stats.progressCount > 0 ? Math.round(stats.progressSum / stats.progressCount) : 0,
        }))
        .sort((left, right) => {
          if (right.enrollments !== left.enrollments) return right.enrollments - left.enrollments;
          return right.completionRate - left.completionRate;
        })
        .slice(0, 5);

      return {
        totalUsers: usersResult.count || 0,
        totalCourses: courses.length,
        totalEnrollments,
        completionRate: totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0,
        certificatesIssued: totalCertificatesResult.count || 0,
        activeLearners7Days: activeLearners7Days.size,
        activeLearners30Days: activeLearners30Days.size,
        averageProgress:
          progressValues.length > 0
            ? Math.round(progressValues.reduce((sum, progress) => sum + progress, 0) / progressValues.length)
            : 0,
        averageAssessmentScore:
          scoredAttempts.length > 0
            ? Math.round(scoredAttempts.reduce((sum, score) => sum + score, 0) / scoredAttempts.length)
            : 0,
        totalLearningHours: Math.round((totalLearningMinutesAllTime / 60) * 10) / 10,
        monthlyTrends,
        topCourses,
      };
    } catch (error) {
      console.error("Error getting admin dashboard analytics:", error);
      return null;
    }
  },

  /**
   * Get trainer-scoped analytics for owned courses and learners.
   */
  getTrainerDashboardAnalytics: async (user: User | null): Promise<TrainerDashboardAnalytics | null> => {
    if (!supabase || !user) return null;

    try {
      const ownership = await resolveTrainerOwnership(user);
      const { data: courseRows, error: coursesError } = await supabase
        .from("courses")
        .select("id, title, category, level, instructor_id")
        .order("created_at", { ascending: false });

      if (coursesError) {
        handleSupabaseError(coursesError);
        return null;
      }

      const ownedCourses = (courseRows || []).filter((course) => ownership.ownerIds.includes(course.instructor_id || ""));
      const visibleCourses = ownedCourses.length > 0 ? ownedCourses : (courseRows || []);
      const showingAllCoursesFallback = ownedCourses.length === 0 && (courseRows || []).length > 0;
      const courseIds = visibleCourses.map((course) => course.id);

      if (courseIds.length === 0) {
        return {
          showingAllCoursesFallback,
          totalCourses: 0,
          totalLearners: 0,
          totalEnrollments: 0,
          completionRate: 0,
          averageAssessmentScore: 0,
          averageLearningHoursPerCourse: 0,
          certificatesIssued: 0,
          joinedThisMonth: 0,
          completedThisMonth: 0,
          averageCompletionRatePerCourse: 0,
          cohortSegments: {
            notStarted: 0,
            inProgress: 0,
            completed: 0,
            atRisk: 0,
          },
          monthlyTrends: [],
          courseInsights: [],
          moduleInsights: [],
        };
      }

      const now = new Date();
      const currentMonthStart = startOfMonth(now);
      const currentMonthEnd = endOfMonth(now);
      const trendPoints = Array.from({ length: 6 }, (_, index) => {
        const date = startOfMonth(subMonths(now, 5 - index));
        return {
          month: format(date, "yyyy-MM"),
          label: format(date, "MMM"),
          newEnrollments: 0,
          completedEnrollments: 0,
          certificatesIssued: 0,
          averageAssessmentScore: 0,
          learningHours: 0,
        } satisfies TrainerDashboardTrendPoint;
      });

      const trendMap = new Map(
        trendPoints.map((point) => [point.month, {
          ...point,
          scoreSum: 0,
          scoreCount: 0,
          sessionMinutes: 0,
        }]),
      );

      const getMonthKey = (value: string | null | undefined) => {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return format(parsed, "yyyy-MM");
      };

      const isCurrentMonth = (value: string | null | undefined) => {
        if (!value) return false;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return false;
        return parsed >= currentMonthStart && parsed <= currentMonthEnd;
      };

      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from("enrollments")
        .select("id, user_id, course_id, progress, status, enrolled_at, completed_at")
        .in("course_id", courseIds)
        .order("enrolled_at", { ascending: false });

      if (enrollmentsError) {
        handleSupabaseError(enrollmentsError);
        return null;
      }

      const enrollments = enrollmentsData || [];
      const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
      const learnerIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.user_id)));

      const [certificatesResult, modulesResult, moduleCompletionsResult, moduleSessionsResult, assessmentAttemptsResult] = await Promise.all([
        supabase
          .from("certificates")
          .select("id, course_id, issued_at")
          .in("course_id", courseIds),
        supabase
          .from("modules")
          .select("id, course_id, title")
          .in("course_id", courseIds)
          .order("order", { ascending: true }),
        enrollmentIds.length > 0
          ? supabase
              .from("module_completions")
              .select("enrollment_id, module_id, time_spent, completed_at")
              .in("enrollment_id", enrollmentIds)
          : Promise.resolve({ data: [], error: null }),
        enrollmentIds.length > 0
          ? supabase
              .from("module_sessions")
              .select("enrollment_id, module_id, duration_seconds, started_at")
              .in("enrollment_id", enrollmentIds)
          : Promise.resolve({ data: [], error: null }),
        enrollmentIds.length > 0
          ? supabase
              .from("assessment_attempts")
              .select("assessment_id, enrollment_id, score, passed, submitted_at")
              .in("enrollment_id", enrollmentIds)
              .not("submitted_at", "is", null)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (certificatesResult.error) {
        handleSupabaseError(certificatesResult.error);
        return null;
      }

      if (modulesResult.error) {
        handleSupabaseError(modulesResult.error);
        return null;
      }

      if (moduleCompletionsResult.error) {
        handleSupabaseError(moduleCompletionsResult.error);
        return null;
      }

      if (moduleSessionsResult.error) {
        handleSupabaseError(moduleSessionsResult.error);
        return null;
      }

      if (assessmentAttemptsResult.error) {
        handleSupabaseError(assessmentAttemptsResult.error);
        return null;
      }

      const assessmentAttempts = assessmentAttemptsResult.data || [];
      const assessmentIds = Array.from(new Set(assessmentAttempts.map((attempt) => attempt.assessment_id).filter(Boolean)));
      let assessmentRows: Array<{ id: string; module_id: string | null }> = [];

      if (assessmentIds.length > 0) {
        const { data, error } = await supabase
          .from("assessments")
          .select("id, module_id")
          .in("id", assessmentIds);

        if (error) {
          handleSupabaseError(error);
          return null;
        }

        assessmentRows = data || [];
      }

      const certificates = certificatesResult.data || [];
      const modules = modulesResult.data || [];
      const moduleCompletions = moduleCompletionsResult.data || [];
      const moduleSessions = moduleSessionsResult.data || [];
      const assessmentMap = new Map(assessmentRows.map((assessment) => [assessment.id, assessment]));
      const enrollmentMap = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]));
      const courseMap = new Map(visibleCourses.map((course) => [course.id, course]));
      const moduleMap = new Map(modules.map((module) => [module.id, module]));

      const courseStats = new Map<string, {
        learnerIds: Set<string>;
        enrollments: number;
        completed: number;
        progressSum: number;
        scoreSum: number;
        scoreCount: number;
        sessionMinutes: number;
        certificatesIssued: number;
      }>();

      const moduleStats = new Map<string, {
        learnerIds: Set<string>;
        completedLearnerIds: Set<string>;
        completionMinutes: number;
        sessionMinutes: number;
        scoreSum: number;
        scoreCount: number;
        failedAttempts: number;
        totalAttempts: number;
      }>();

      const cohortSegments = {
        notStarted: 0,
        inProgress: 0,
        completed: 0,
        atRisk: 0,
      };

      for (const enrollment of enrollments) {
        const progress = Number(enrollment.progress || 0);
        const stats = courseStats.get(enrollment.course_id) || {
          learnerIds: new Set<string>(),
          enrollments: 0,
          completed: 0,
          progressSum: 0,
          scoreSum: 0,
          scoreCount: 0,
          sessionMinutes: 0,
          certificatesIssued: 0,
        };

        stats.enrollments += 1;
        stats.learnerIds.add(enrollment.user_id);
        stats.progressSum += progress;

        if (enrollment.status === "completed" || progress >= 100) {
          stats.completed += 1;
          cohortSegments.completed += 1;
        } else if (progress <= 0 || enrollment.status === "enrolled") {
          cohortSegments.notStarted += 1;
        } else {
          cohortSegments.inProgress += 1;
        }

        const enrolledDate = new Date(enrollment.enrolled_at);
        if (!Number.isNaN(enrolledDate.getTime()) && differenceInDays(now, enrolledDate) >= 14 && progress < 30 && enrollment.status !== "completed") {
          cohortSegments.atRisk += 1;
        }

        const enrolledMonthKey = getMonthKey(enrollment.enrolled_at);
        if (enrolledMonthKey && trendMap.has(enrolledMonthKey)) {
          trendMap.get(enrolledMonthKey)!.newEnrollments += 1;
        }

        const completedMonthKey = getMonthKey(enrollment.completed_at);
        if ((enrollment.status === "completed" || progress >= 100) && completedMonthKey && trendMap.has(completedMonthKey)) {
          trendMap.get(completedMonthKey)!.completedEnrollments += 1;
        }

        courseStats.set(enrollment.course_id, stats);
      }

      for (const certificate of certificates) {
        const stats = courseStats.get(certificate.course_id);
        if (stats) {
          stats.certificatesIssued += 1;
        }

        const monthKey = getMonthKey(certificate.issued_at);
        if (monthKey && trendMap.has(monthKey)) {
          trendMap.get(monthKey)!.certificatesIssued += 1;
        }
      }

      for (const completion of moduleCompletions) {
        const enrollment = enrollmentMap.get(completion.enrollment_id);
        if (!enrollment) {
          continue;
        }

        const stats = moduleStats.get(completion.module_id) || {
          learnerIds: new Set<string>(),
          completedLearnerIds: new Set<string>(),
          completionMinutes: 0,
          sessionMinutes: 0,
          scoreSum: 0,
          scoreCount: 0,
          failedAttempts: 0,
          totalAttempts: 0,
        };

        stats.learnerIds.add(enrollment.user_id);
        stats.completedLearnerIds.add(enrollment.user_id);
        stats.completionMinutes += Number(completion.time_spent || 0);
        moduleStats.set(completion.module_id, stats);
      }

      for (const session of moduleSessions) {
        const enrollment = enrollmentMap.get(session.enrollment_id);
        if (!enrollment) {
          continue;
        }

        const sessionMinutes = Number(session.duration_seconds || 0) / 60;
        const courseStatsRow = courseStats.get(enrollment.course_id);
        if (courseStatsRow) {
          courseStatsRow.sessionMinutes += sessionMinutes;
        }

        const moduleStatsRow = moduleStats.get(session.module_id) || {
          learnerIds: new Set<string>(),
          completedLearnerIds: new Set<string>(),
          completionMinutes: 0,
          sessionMinutes: 0,
          scoreSum: 0,
          scoreCount: 0,
          failedAttempts: 0,
          totalAttempts: 0,
        };

        moduleStatsRow.learnerIds.add(enrollment.user_id);
        moduleStatsRow.sessionMinutes += sessionMinutes;
        moduleStats.set(session.module_id, moduleStatsRow);

        const monthKey = getMonthKey(session.started_at);
        if (monthKey && trendMap.has(monthKey)) {
          trendMap.get(monthKey)!.sessionMinutes += sessionMinutes;
        }
      }

      for (const attempt of assessmentAttempts) {
        const enrollment = enrollmentMap.get(attempt.enrollment_id);
        if (!enrollment) {
          continue;
        }

        const score = Number(attempt.score || 0);
        if (score > 0) {
          const courseStatsRow = courseStats.get(enrollment.course_id);
          if (courseStatsRow) {
            courseStatsRow.scoreSum += score;
            courseStatsRow.scoreCount += 1;
          }

          const monthKey = getMonthKey(attempt.submitted_at);
          if (monthKey && trendMap.has(monthKey)) {
            trendMap.get(monthKey)!.scoreSum += score;
            trendMap.get(monthKey)!.scoreCount += 1;
          }
        }

        const assessment = assessmentMap.get(attempt.assessment_id);
        if (!assessment?.module_id) {
          continue;
        }

        const moduleStatsRow = moduleStats.get(assessment.module_id) || {
          learnerIds: new Set<string>(),
          completedLearnerIds: new Set<string>(),
          completionMinutes: 0,
          sessionMinutes: 0,
          scoreSum: 0,
          scoreCount: 0,
          failedAttempts: 0,
          totalAttempts: 0,
        };

        moduleStatsRow.learnerIds.add(enrollment.user_id);
        moduleStatsRow.totalAttempts += 1;
        if (score > 0) {
          moduleStatsRow.scoreSum += score;
          moduleStatsRow.scoreCount += 1;
        }
        if (attempt.passed === false || (score > 0 && score < 75)) {
          moduleStatsRow.failedAttempts += 1;
        }
        moduleStats.set(assessment.module_id, moduleStatsRow);
      }

      const courseInsights = visibleCourses
        .map((course) => {
          const stats = courseStats.get(course.id) || {
            learnerIds: new Set<string>(),
            enrollments: 0,
            completed: 0,
            progressSum: 0,
            scoreSum: 0,
            scoreCount: 0,
            sessionMinutes: 0,
            certificatesIssued: 0,
          };

          return {
            courseId: course.id,
            courseTitle: course.title,
            category: course.category,
            level: course.level as Course["level"],
            enrollments: stats.enrollments,
            learnerCount: stats.learnerIds.size,
            completionRate: stats.enrollments > 0 ? Math.round((stats.completed / stats.enrollments) * 100) : 0,
            averageProgress: stats.enrollments > 0 ? Math.round(stats.progressSum / stats.enrollments) : 0,
            averageAssessmentScore: stats.scoreCount > 0 ? Math.round(stats.scoreSum / stats.scoreCount) : 0,
            averageLearningHours: stats.learnerIds.size > 0 ? Number((stats.sessionMinutes / stats.learnerIds.size / 60).toFixed(1)) : 0,
            certificatesIssued: stats.certificatesIssued,
          } satisfies TrainerDashboardCourseInsight;
        })
        .sort((left, right) => {
          if (right.learnerCount !== left.learnerCount) return right.learnerCount - left.learnerCount;
          if (right.completionRate !== left.completionRate) return right.completionRate - left.completionRate;
          return left.courseTitle.localeCompare(right.courseTitle);
        });

      const moduleInsights = modules
        .map((module) => {
          const stats = moduleStats.get(module.id) || {
            learnerIds: new Set<string>(),
            completedLearnerIds: new Set<string>(),
            completionMinutes: 0,
            sessionMinutes: 0,
            scoreSum: 0,
            scoreCount: 0,
            failedAttempts: 0,
            totalAttempts: 0,
          };
          const course = courseMap.get(module.course_id);
          const courseEnrollmentCount = courseStats.get(module.course_id)?.enrollments || 0;
          const averageLearningMinutes = stats.learnerIds.size > 0
            ? Number(((stats.sessionMinutes > 0 ? stats.sessionMinutes : stats.completionMinutes) / stats.learnerIds.size).toFixed(1))
            : 0;
          const averageAssessmentScore = stats.scoreCount > 0 ? Math.round(stats.scoreSum / stats.scoreCount) : 0;
          const failureRate = stats.totalAttempts > 0 ? Math.round((stats.failedAttempts / stats.totalAttempts) * 100) : 0;
          const completionRate = courseEnrollmentCount > 0
            ? Math.round((stats.completedLearnerIds.size / courseEnrollmentCount) * 100)
            : 0;

          const issueFlags = [
            averageAssessmentScore > 0 && averageAssessmentScore < 70,
            failureRate >= 35,
            averageLearningMinutes >= 45,
            completionRate > 0 && completionRate < 45,
          ];
          const issueCount = issueFlags.filter(Boolean).length;
          const attentionLevel = issueCount >= 2 ? "critical" : issueCount === 1 ? "watch" : "healthy";

          let insight = "Healthy completion and assessment patterns";
          if (averageAssessmentScore > 0 && averageAssessmentScore < 70) {
            insight = "Low assessment scores suggest this module needs reinforcement or content review";
          } else if (failureRate >= 35) {
            insight = "High failure rate suggests quiz difficulty or instruction clarity needs review";
          } else if (averageLearningMinutes >= 45) {
            insight = "Learners are spending longer than expected here, which may indicate friction";
          } else if (completionRate > 0 && completionRate < 45) {
            insight = "Completion is lagging for this module compared with course enrollment volume";
          }

          return {
            moduleId: module.id,
            courseId: module.course_id,
            courseTitle: course?.title || "Untitled course",
            moduleTitle: module.title,
            learnerCount: stats.learnerIds.size,
            completedLearners: stats.completedLearnerIds.size,
            completionRate,
            averageLearningMinutes,
            averageAssessmentScore,
            failureRate,
            attentionLevel,
            insight,
          } satisfies TrainerDashboardModuleInsight;
        })
        .filter((module) => module.learnerCount > 0 || module.completedLearners > 0)
        .sort((left, right) => {
          const severityRank = { critical: 2, watch: 1, healthy: 0 };
          if (severityRank[right.attentionLevel] !== severityRank[left.attentionLevel]) {
            return severityRank[right.attentionLevel] - severityRank[left.attentionLevel];
          }
          if (right.failureRate !== left.failureRate) return right.failureRate - left.failureRate;
          if (right.averageLearningMinutes !== left.averageLearningMinutes) return right.averageLearningMinutes - left.averageLearningMinutes;
          return left.moduleTitle.localeCompare(right.moduleTitle);
        })
        .slice(0, 8);

      const totalEnrollments = enrollments.length;
      const completedEnrollments = enrollments.filter(
        (enrollment) => enrollment.status === "completed" || Number(enrollment.progress || 0) >= 100,
      ).length;
      const scoredAttempts = assessmentAttempts
        .map((attempt) => Number(attempt.score || 0))
        .filter((score) => score > 0);
      const totalLearningHours = Array.from(courseStats.values()).reduce((sum, stats) => sum + stats.sessionMinutes, 0) / 60;
      const averageLearningHoursPerCourse = visibleCourses.length > 0 ? Number((totalLearningHours / visibleCourses.length).toFixed(1)) : 0;

      return {
        showingAllCoursesFallback,
        totalCourses: visibleCourses.length,
        totalLearners: learnerIds.length,
        totalEnrollments,
        completionRate: totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0,
        averageAssessmentScore:
          scoredAttempts.length > 0
            ? Math.round(scoredAttempts.reduce((sum, score) => sum + score, 0) / scoredAttempts.length)
            : 0,
        averageLearningHoursPerCourse,
        certificatesIssued: certificates.length,
        joinedThisMonth: enrollments.filter((enrollment) => isCurrentMonth(enrollment.enrolled_at)).length,
        completedThisMonth: enrollments.filter((enrollment) => isCurrentMonth(enrollment.completed_at)).length,
        averageCompletionRatePerCourse:
          courseInsights.length > 0
            ? Math.round(courseInsights.reduce((sum, course) => sum + course.completionRate, 0) / courseInsights.length)
            : 0,
        cohortSegments,
        monthlyTrends: Array.from(trendMap.values()).map((point) => ({
          month: point.month,
          label: point.label,
          newEnrollments: point.newEnrollments,
          completedEnrollments: point.completedEnrollments,
          certificatesIssued: point.certificatesIssued,
          averageAssessmentScore: point.scoreCount > 0 ? Math.round(point.scoreSum / point.scoreCount) : 0,
          learningHours: Number((point.sessionMinutes / 60).toFixed(1)),
        })),
        courseInsights: courseInsights.slice(0, 6),
        moduleInsights,
      };
    } catch (error) {
      console.error("Error getting trainer dashboard analytics:", error);
      return null;
    }
  },

  /**
   * Get training completion reports
   */
  getCompletionReports: async (
    startDate?: Date,
    endDate?: Date,
    courseId?: string
  ): Promise<CompletionReport[]> => {
    if (!supabase) return [];

    try {
      // Build date filter
      let enrollmentsQuery = supabase
        .from("enrollments")
        .select(`
          id,
          course_id,
          progress,
          status,
          completed_at,
          courses:course_id (
            id,
            title
          )
        `);

      if (startDate) {
        enrollmentsQuery = enrollmentsQuery.gte("enrolled_at", startDate.toISOString());
      }
      if (endDate) {
        enrollmentsQuery = enrollmentsQuery.lte("enrolled_at", endDate.toISOString());
      }
      if (courseId) {
        enrollmentsQuery = enrollmentsQuery.eq("course_id", courseId);
      }

      const { data: enrollments, error } = await enrollmentsQuery;

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      if (!enrollments) return [];

      // Group by course
      const courseMap = new Map<string, CompletionReport>();

      for (const enrollment of enrollments) {
        const course = enrollment.courses as any;
        if (!course) continue;

        const courseId = course.id;
        const courseTitle = course.title;

        if (!courseMap.has(courseId)) {
          courseMap.set(courseId, {
            courseId,
            courseTitle,
            totalEnrollments: 0,
            completedEnrollments: 0,
            completionRate: 0,
            averageProgress: 0,
            averageTimeSpent: 0,
            completionTrends: [],
          });
        }

        const report = courseMap.get(courseId)!;
        report.totalEnrollments++;
        if (enrollment.status === "completed" || enrollment.progress === 100) {
          report.completedEnrollments++;
        }
      }

      // Calculate averages and get time spent data
      for (const [courseId, report] of courseMap.entries()) {
        report.completionRate =
          report.totalEnrollments > 0
            ? Math.round((report.completedEnrollments / report.totalEnrollments) * 100)
            : 0;

        // Get average progress
        const courseEnrollments = enrollments.filter((e) => e.course_id === courseId);
        const totalProgress = courseEnrollments.reduce((sum, e) => sum + (e.progress || 0), 0);
        report.averageProgress =
          courseEnrollments.length > 0 ? Math.round(totalProgress / courseEnrollments.length) : 0;

        // Get time spent data
        const { data: completions } = await supabase
          .from("module_completions")
          .select("time_spent, enrollment_id")
          .in(
            "enrollment_id",
            courseEnrollments.map((e) => e.id)
          );

        const totalTimeSpent = completions?.reduce((sum, c) => sum + (c.time_spent || 0), 0) || 0;
        const uniqueEnrollments = new Set(completions?.map((c) => c.enrollment_id) || []).size;
        report.averageTimeSpent =
          uniqueEnrollments > 0 ? Math.round(totalTimeSpent / uniqueEnrollments) : 0;

        // Get completion trends (last 30 days)
        const trendStartDate = subDays(new Date(), 30);
        const completedEnrollments = courseEnrollments.filter(
          (e) => e.status === "completed" && e.completed_at
        );

        const trendsMap = new Map<string, number>();
        completedEnrollments.forEach((e) => {
          if (e.completed_at) {
            const date = format(new Date(e.completed_at), "yyyy-MM-dd");
            trendsMap.set(date, (trendsMap.get(date) || 0) + 1);
          }
        });

        report.completionTrends = Array.from(trendsMap.entries())
          .map(([date, completions]) => ({ date, completions }))
          .sort((a, b) => a.date.localeCompare(b.date));
      }

      return Array.from(courseMap.values());
    } catch (error) {
      console.error("Error getting completion reports:", error);
      return [];
    }
  },

  /**
   * Get user activity reports
   */
  getUserActivityReports: async (
    startDate?: Date,
    endDate?: Date,
    role?: string
  ): Promise<UserActivityReport[]> => {
    if (!supabase) return [];

    try {
      let usersQuery = supabase.from("users").select("id, name, email, role, created_at");

      if (role) {
        usersQuery = usersQuery.eq("role", role);
      }

      const { data: users, error: usersError } = await usersQuery;

      if (usersError) {
        handleSupabaseError(usersError);
        return [];
      }

      if (!users) return [];

      const reports: UserActivityReport[] = [];

      for (const user of users) {
        // Get enrollments
        let enrollmentsQuery = supabase
          .from("enrollments")
          .select("id, progress, status, completed_at, updated_at")
          .eq("user_id", user.id);

        if (startDate) {
          enrollmentsQuery = enrollmentsQuery.gte("enrolled_at", startDate.toISOString());
        }
        if (endDate) {
          enrollmentsQuery = enrollmentsQuery.lte("enrolled_at", endDate.toISOString());
        }

        const { data: enrollments } = await enrollmentsQuery;

        const totalEnrollments = enrollments?.length || 0;
        const completedCourses = enrollments?.filter((e) => e.status === "completed").length || 0;

        // Get time spent
        const enrollmentIds = enrollments?.map((e) => e.id) || [];
        let totalTimeSpent = 0;
        if (enrollmentIds.length > 0) {
          const { data: completions } = await supabase
            .from("module_completions")
            .select("time_spent")
            .in("enrollment_id", enrollmentIds);

          totalTimeSpent = completions?.reduce((sum, c) => sum + (c.time_spent || 0), 0) || 0;
        }

        // Get last activity
        const lastActivityDates = enrollments
          ?.map((e) => e.updated_at)
          .filter((d) => d !== null) || [];
        const lastActivityDate =
          lastActivityDates.length > 0
            ? lastActivityDates.sort().reverse()[0]
            : user.created_at;

        // Get certificates
        const { data: certificates } = await supabase
          .from("certificates")
          .select("id")
          .eq("user_id", user.id);

        reports.push({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          role: user.role,
          totalEnrollments,
          completedCourses,
          totalTimeSpent,
          lastActivityDate,
          certificatesEarned: certificates?.length || 0,
        });
      }

      return reports;
    } catch (error) {
      console.error("Error getting user activity reports:", error);
      return [];
    }
  },

  /**
   * Get certificate issuance reports
   */
  getCertificateReports: async (
    startDate?: Date,
    endDate?: Date,
    certificateType?: string
  ): Promise<CertificateReport[]> => {
    if (!supabase) return [];

    try {
      let certificatesQuery = supabase
        .from("certificates")
        .select(`
          id,
          certificate_number,
          user_id,
          course_title,
          certificate_type,
          issued_at,
          verification_code,
          users:user_id (name)
        `)
        .order("issued_at", { ascending: false });

      if (startDate) {
        certificatesQuery = certificatesQuery.gte("issued_at", startDate.toISOString());
      }
      if (endDate) {
        certificatesQuery = certificatesQuery.lte("issued_at", endDate.toISOString());
      }
      if (certificateType) {
        certificatesQuery = certificatesQuery.eq("certificate_type", certificateType);
      }

      const { data: certificates, error } = await certificatesQuery;

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      if (!certificates) return [];

      return certificates.map((cert: any) => ({
        certificateId: cert.id,
        certificateNumber: cert.certificate_number,
        userId: cert.user_id,
        userName: cert.users?.name || "Unknown",
        courseTitle: cert.course_title,
        certificateType: cert.certificate_type,
        issuedDate: cert.issued_at,
        verificationCode: cert.verification_code,
      }));
    } catch (error) {
      console.error("Error getting certificate reports:", error);
      return [];
    }
  },

  /**
   * Get compliance reports (DOLE/LGU format)
   */
  getComplianceReport: async (
    period: "month" | "quarter" | "year",
    periodStart?: Date
  ): Promise<ComplianceReportData | null> => {
    if (!supabase) return null;

    try {
      let startDate: Date;
      let endDate: Date;
      let periodLabel: string;

      const now = periodStart || new Date();

      if (period === "month") {
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        periodLabel = format(now, "MMMM yyyy");
      } else if (period === "quarter") {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        periodLabel = `Q${quarter + 1} ${now.getFullYear()}`;
      } else {
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        periodLabel = format(now, "yyyy");
      }

      // Get enrollments in period (include user_id so Total Participants = unique users)
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`
          id,
          user_id,
          course_id,
          status,
          completed_at,
          courses:course_id (
            id,
            title,
            is_tesda_accredited,
            duration
          )
        `)
        .gte("enrolled_at", startDate.toISOString())
        .lte("enrolled_at", endDate.toISOString());

      if (!enrollments) return null;

      // Exclude dropped so summary and course breakdown match active participants only
      const activeEnrollments = enrollments.filter((e: any) => e.status !== "dropped");

      const uniqueUsers = new Set(activeEnrollments.map((e: any) => e.user_id));
      const completedEnrollments = activeEnrollments.filter((e: any) => e.status === "completed");

      // Get courses data (from active enrollments only)
      const courseMap = new Map<string, any>();
      activeEnrollments.forEach((e: any) => {
        const course = e.courses as any;
        if (!course) return;

        if (!courseMap.has(course.id)) {
          courseMap.set(course.id, {
            courseTitle: course.title,
            participants: 0,
            completions: 0,
            completionRate: 0,
          });
        }

        const courseData = courseMap.get(course.id)!;
        courseData.participants++;
        if (e.status === "completed") {
          courseData.completions++;
        }
      });

      // Calculate completion rates
      courseMap.forEach((courseData) => {
        courseData.completionRate =
          courseData.participants > 0
            ? Math.round((courseData.completions / courseData.participants) * 100)
            : 0;
      });

      // Get TESDA supported courses (from active enrollments)
      const tesdaCourses = activeEnrollments.filter(
        (e: any) => (e.courses as any)?.is_tesda_accredited === true
      );
      const uniqueTesdaCourses = new Set(tesdaCourses.map((e) => e.course_id));

      // Get certificates issued
      const { data: certificates } = await supabase
        .from("certificates")
        .select("id")
        .gte("issued_at", startDate.toISOString())
        .lte("issued_at", endDate.toISOString());

      // Calculate average duration (from courses in active enrollments)
      const coursesWithDuration = activeEnrollments
        .map((e: any) => (e.courses as any)?.duration)
        .filter((d) => d !== null && d !== undefined);
      const averageDuration =
        coursesWithDuration.length > 0
          ? Math.round(
              coursesWithDuration.reduce((sum, d) => sum + Number(d), 0) /
                coursesWithDuration.length
            )
          : 0;

      return {
        period: periodLabel,
        totalTrainings: courseMap.size,
        totalParticipants: uniqueUsers.size,
        totalCompletions: completedEnrollments.length,
        completionRate:
          activeEnrollments.length > 0
            ? Math.round((completedEnrollments.length / activeEnrollments.length) * 100)
            : 0,
        tesdaAccreditedTrainings: uniqueTesdaCourses.size,
        certificatesIssued: certificates?.length || 0,
        averageTrainingDuration: averageDuration,
        courses: Array.from(courseMap.values()),
      };
    } catch (error) {
      console.error("Error getting compliance report:", error);
      return null;
    }
  },

  /**
   * Get enrollment reports
   */
  getEnrollmentReports: async (
    startDate?: Date,
    endDate?: Date,
    courseId?: string,
    status?: string
  ): Promise<EnrollmentReport[]> => {
    if (!supabase) return [];

    try {
      let enrollmentsQuery = supabase
        .from("enrollments")
        .select(`
          id,
          user_id,
          course_id,
          progress,
          status,
          enrolled_at,
          completed_at,
          courses:course_id (title),
          users:user_id (name)
        `)
        .order("enrolled_at", { ascending: false });

      if (startDate) {
        enrollmentsQuery = enrollmentsQuery.gte("enrolled_at", startDate.toISOString());
      }
      if (endDate) {
        enrollmentsQuery = enrollmentsQuery.lte("enrolled_at", endDate.toISOString());
      }
      if (courseId) {
        enrollmentsQuery = enrollmentsQuery.eq("course_id", courseId);
      }
      if (status) {
        enrollmentsQuery = enrollmentsQuery.eq("status", status);
      }

      const { data: enrollments, error } = await enrollmentsQuery;

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      if (!enrollments) return [];

      const reports: EnrollmentReport[] = [];

      for (const enrollment of enrollments) {
        const course = enrollment.courses as any;
        const user = enrollment.users as any;

        // Get time spent
        const { data: completions } = await supabase
          .from("module_completions")
          .select("time_spent")
          .eq("enrollment_id", enrollment.id);

        const timeSpent =
          completions?.reduce((sum, c) => sum + (c.time_spent || 0), 0) || 0;

        reports.push({
          enrollmentId: enrollment.id,
          userId: enrollment.user_id,
          userName: user?.name || "Unknown",
          courseId: enrollment.course_id,
          courseTitle: course?.title || "Unknown Course",
          enrolledDate: enrollment.enrolled_at,
          completedDate: enrollment.completed_at || null,
          progress: enrollment.progress || 0,
          status: enrollment.status,
          timeSpent,
        });
      }

      return reports;
    } catch (error) {
      console.error("Error getting enrollment reports:", error);
      return [];
    }
  },
};

