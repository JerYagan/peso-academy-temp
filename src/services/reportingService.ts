import { supabase, handleSupabaseError } from "@/lib/supabase";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, differenceInDays } from "date-fns";
import type { User } from "@/types/auth";
import type { Course, Enrollment } from "@/types";
import { CURATED_STARTER_CATEGORIES } from "@/lib/onboarding";
import { canonicalizeCourseCategory, canonicalizeTopicTag, deriveTopicTags, normalizeCourseCategories, normalizeSkillTags, normalizeTopicTags } from "@/lib/taxonomy";
import type { ModuleSessionAggregate } from "@/services/moduleSessionService";
import { moduleSessionService } from "@/services/moduleSessionService";

if (!supabase) {
  console.warn("Supabase client not initialized. Please set up environment variables.");
}

const loadTrainerVisibleEnrollments = async (courseIds: string[]) => {
  if (!supabase || courseIds.length === 0) {
    return [] as Array<any>;
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_course_manager_enrollments", {
    p_course_ids: courseIds,
    p_user_id: null,
  });

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData as Array<any>;
  }

  const { data, error } = await supabase
    .from("enrollments")
    .select("id, user_id, course_id, progress, status, enrolled_at, completed_at, updated_at")
    .in("course_id", courseIds)
    .order("enrolled_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
};

const loadTrainerVisibleCertificates = async (courseIds: string[]) => {
  if (!supabase || courseIds.length === 0) {
    return [] as Array<any>;
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_course_manager_certificates", {
    p_course_ids: courseIds,
    p_user_id: null,
  });

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData as Array<any>;
  }

  const { data, error } = await supabase
    .from("certificates")
    .select("id, course_id, issued_at")
    .in("course_id", courseIds);

  if (error) {
    throw error;
  }

  return data || [];
};

const loadTrainerVisibleAssessmentAttempts = async (courseIds: string[], enrollmentIds: string[]) => {
  if (!supabase || courseIds.length === 0 || enrollmentIds.length === 0) {
    return [] as Array<any>;
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_course_manager_assessment_attempts", {
    p_course_ids: courseIds,
    p_enrollment_ids: enrollmentIds,
  });

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData as Array<any>;
  }

  const { data, error } = await supabase
    .from("assessment_attempts")
    .select("assessment_id, enrollment_id, score, passed, submitted_at")
    .in("enrollment_id", enrollmentIds)
    .not("submitted_at", "is", null);

  if (error) {
    throw error;
  }

  return data || [];
};

const isEnrollmentCompleted = (status?: string | null) => status === "completed";

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

export interface ModuleContentCompletenessCheck {
  moduleId: string;
  moduleTitle: string;
  status: "draft" | "finalized";
  hasContentBody: boolean;
  hasMediaAsset: boolean;
  hasAssessmentOrActivity: boolean;
  hasTags: boolean;
  isPublishReady: boolean;
  missingItems: string[];
}

export interface CourseContentCompletenessReport {
  courseId: string;
  courseTitle: string;
  courseCategory: string;
  published: boolean;
  hasTrainerOwnership: boolean;
  totalModules: number;
  finalizedModules: number;
  draftModules: number;
  publishReadyModules: number;
  modulesWithoutContent: number;
  modulesWithoutMedia: number;
  modulesWithoutAssessmentOrActivity: number;
  modulesWithoutTags: number;
  completenessRate: number;
  readyToPublish: boolean;
  missingSummary: string[];
  publishReadyChecklist: string[];
  moduleChecks: ModuleContentCompletenessCheck[];
}

export interface StaffPerformanceFactorScore {
  rawScore: number;
  weightedScore: number;
  weight: number;
  explanation: string;
}

export interface StaffPerformanceInformationalMetrics {
  managedCourses: number;
  activeLearners: number;
  totalEnrollments: number;
  certificatesIssued: number;
  averageLearningHoursPerLearner: number;
  publishReadyCourses: number;
}

export interface StaffPerformanceScorecard {
  staffId: string;
  staffName: string;
  staffEmail: string;
  role: "trainer";
  managedCourseIds: string[];
  managedCourseTitles: string[];
  generatedAt: string;
  compositeScore: number;
  evaluationBand: "exemplary" | "strong" | "watch" | "intervention";
  courseOutcomeMetrics: {
    completionRate: number;
    averageAssessmentScore: number | null;
    learnerEngagementRate: number;
    atRiskRate: number;
    recommendationConversionRate: number;
    contentQualityRate: number;
  };
  factorScores: {
    completionRate: StaffPerformanceFactorScore;
    assessmentQuality: StaffPerformanceFactorScore;
    learnerEngagement: StaffPerformanceFactorScore;
    riskManagement: StaffPerformanceFactorScore;
    recommendationConversion: StaffPerformanceFactorScore;
    contentQuality: StaffPerformanceFactorScore;
  };
  informationalMetrics: StaffPerformanceInformationalMetrics;
  notes: string[];
}

export interface LearnerRankingWeights {
  completion: number;
  assessment: number;
  learningTime: number;
  certificate: number;
  recency: number;
}

export interface LearnerRankingFactorScore {
  rawScore: number;
  weightedScore: number;
  weight: number;
  explanation: string;
}

export type LearnerLeaderboardScope = "course" | "program";

export interface LearnerLeaderboardEntry {
  rank: number;
  entryId: string;
  learnerId: string;
  learnerName: string;
  learnerEmailMasked: string | null;
  status: Enrollment["status"];
  progress: number;
  completedUnits: number;
  totalUnits: number;
  unitsLabel: "modules" | "courses";
  averageAssessmentScore: number | null;
  assessmentAttempts: number;
  learningMinutes: number;
  expectedLearningMinutes: number;
  certificatesEarned: number;
  expectedCertificates: number;
  lastActivityAt: string | null;
  recencyDays: number | null;
  compositeScore: number;
  factorScores: {
    completion: LearnerRankingFactorScore;
    assessment: LearnerRankingFactorScore;
    learningTime: LearnerRankingFactorScore;
    certificate: LearnerRankingFactorScore;
    recency: LearnerRankingFactorScore;
  };
  scoringExplanation: string[];
}

export interface LearnerLeaderboard {
  scope: LearnerLeaderboardScope;
  scopeId: string;
  scopeTitle: string;
  scopeCategory: string;
  generatedAt: string;
  includeIncompleteLearners: boolean;
  excludedStatuses: Enrollment["status"][];
  privacyMode: "staff_only_masked";
  weights: LearnerRankingWeights;
  fairnessNotes: string[];
  tieBreakerRules: string[];
  entries: LearnerLeaderboardEntry[];
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

export interface AdminCourseRiskInsight {
  courseId: string;
  courseTitle: string;
  activeEnrollments: number;
  completionRate: number;
  recommendationAcceptanceRate: number;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
}

export interface AdminLearnerDisengagementInsight {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  incompleteEnrollments: number;
  repeatedShortSessionCount: number;
  inactiveDays: number;
  disengagementScore: number;
  riskLevel: "low" | "medium" | "high";
}

export interface AdminRecommendationCourseInsight {
  courseId: string;
  courseTitle: string;
  recommendationsDelivered: number;
  impressions: number;
  clicks: number;
  accepts: number;
  enrollments: number;
  completions: number;
  acceptanceProbability: number;
  ctr: number;
  acceptRate: number;
  completionRate: number;
}

export interface AdminRecommendationAnalytics {
  totalRecommendationsDelivered: number;
  totalImpressions: number;
  totalClicks: number;
  totalAccepts: number;
  totalRecommendationEnrollments: number;
  totalRecommendationCompletions: number;
  averageCtr: number;
  averageAcceptRate: number;
  averageAcceptanceProbability: number;
  recommendedEnrollmentCompletionRate: number;
  topRecommendedCourses: AdminRecommendationCourseInsight[];
  mostAcceptedCourses: AdminRecommendationCourseInsight[];
}

export interface AdminPredictiveOverview {
  highRiskCourses: number;
  mediumRiskCourses: number;
  highRiskLearners: number;
  mediumRiskLearners: number;
  averageCourseRiskScore: number;
  averageDisengagementScore: number;
  averageAcceptanceProbability: number;
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
  predictiveOverview: AdminPredictiveOverview;
  riskCourseInsights: AdminCourseRiskInsight[];
  disengagementInsights: AdminLearnerDisengagementInsight[];
  recommendationAnalytics: AdminRecommendationAnalytics;
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

export interface TrainerRecommendationCourseInsight {
  courseId: string;
  courseTitle: string;
  recommendationsDelivered: number;
  impressions: number;
  clicks: number;
  accepts: number;
  enrollments: number;
  completions: number;
  acceptanceProbability: number;
  ctr: number;
  acceptRate: number;
  enrollmentConversionRate: number;
  completionRate: number;
}

export interface TrainerRecommendationAnalytics {
  totalRecommendationsDelivered: number;
  totalImpressions: number;
  totalClicks: number;
  totalAccepts: number;
  totalRecommendationEnrollments: number;
  totalRecommendationCompletions: number;
  averageCtr: number;
  averageAcceptRate: number;
  averageAcceptanceProbability: number;
  recommendedEnrollmentCompletionRate: number;
  topRecommendedCourses: TrainerRecommendationCourseInsight[];
  mostAcceptedCourses: TrainerRecommendationCourseInsight[];
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
  atRiskSignals: {
    stalledProgress: number;
    repeatedShortSessions: number;
    inactiveIncomplete: number;
    problematicSessionStatus: number;
  };
  monthlyTrends: TrainerDashboardTrendPoint[];
  courseInsights: TrainerDashboardCourseInsight[];
  moduleInsights: TrainerDashboardModuleInsight[];
  recommendationAnalytics: TrainerRecommendationAnalytics;
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

export interface AssessmentOnlyRecommendationEvidence {
  scoredAssessments: number;
  scoreBand: "support" | "developing" | "proficient" | "advanced";
  strongestTopic: LearnerPerformanceTopicResult | null;
  weakestTopic: LearnerPerformanceTopicResult | null;
  failedCompetencies: LearnerPerformanceTopicResult[];
  assessedTopics: string[];
}

const SHORT_SESSION_SECONDS = 5 * 60;
const LEARNER_RANKING_WEIGHTS: LearnerRankingWeights = {
  completion: 35,
  assessment: 30,
  learningTime: 15,
  certificate: 10,
  recency: 10,
};
const LEADERBOARD_EXCLUDED_STATUSES: Enrollment["status"][] = ["dropped"];
const LEADERBOARD_TIEBREAKER_RULES = [
  "Higher completion score wins first.",
  "Then higher assessment score wins.",
  "Then the most recent activity wins.",
  "Then earlier enrollment date wins for stable ordering.",
  "Then learner name is used alphabetically.",
] as const;

const clampPercentage = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const toRoundedTenth = (value: number) => Number(value.toFixed(1));

type RecommendationAnalyticsRow = {
  course_id: string;
  impression_count?: number | null;
  click_count?: number | null;
  accept_count?: number | null;
  enrollment_count?: number | null;
  completion_count?: number | null;
  acceptance_probability?: number | null;
};

interface SharedRecommendationCourseInsight {
  courseId: string;
  courseTitle: string;
  recommendationsDelivered: number;
  impressions: number;
  clicks: number;
  accepts: number;
  enrollments: number;
  completions: number;
  acceptanceProbability: number;
  ctr: number;
  acceptRate: number;
  enrollmentConversionRate: number;
  completionRate: number;
}

interface SharedRecommendationAnalytics {
  totalRecommendationsDelivered: number;
  totalImpressions: number;
  totalClicks: number;
  totalAccepts: number;
  totalRecommendationEnrollments: number;
  totalRecommendationCompletions: number;
  averageCtr: number;
  averageAcceptRate: number;
  averageAcceptanceProbability: number;
  recommendedEnrollmentCompletionRate: number;
  topRecommendedCourses: SharedRecommendationCourseInsight[];
  mostAcceptedCourses: SharedRecommendationCourseInsight[];
}

const buildRecommendationAnalytics = (
  recommendationRows: RecommendationAnalyticsRow[],
  resolveCourseTitle: (courseId: string) => string,
): SharedRecommendationAnalytics => {
  const recommendationCourseMap = new Map<string, SharedRecommendationCourseInsight & {
    acceptanceProbabilitySum: number;
    acceptanceProbabilityCount: number;
  }>();

  for (const row of recommendationRows) {
    const existing = recommendationCourseMap.get(row.course_id) || {
      courseId: row.course_id,
      courseTitle: resolveCourseTitle(row.course_id),
      recommendationsDelivered: 0,
      impressions: 0,
      clicks: 0,
      accepts: 0,
      enrollments: 0,
      completions: 0,
      acceptanceProbability: 0,
      ctr: 0,
      acceptRate: 0,
      enrollmentConversionRate: 0,
      completionRate: 0,
      acceptanceProbabilitySum: 0,
      acceptanceProbabilityCount: 0,
    };

    existing.recommendationsDelivered += 1;
    existing.impressions += Number(row.impression_count || 0);
    existing.clicks += Number(row.click_count || 0);
    existing.accepts += Number(row.accept_count || 0);
    existing.enrollments += Number(row.enrollment_count || 0);
    existing.completions += Number(row.completion_count || 0);
    existing.acceptanceProbabilitySum += Number(row.acceptance_probability || 0);
    existing.acceptanceProbabilityCount += 1;
    recommendationCourseMap.set(row.course_id, existing);
  }

  const recommendationCourseInsights = Array.from(recommendationCourseMap.values()).map((course) => ({
    courseId: course.courseId,
    courseTitle: course.courseTitle,
    recommendationsDelivered: course.recommendationsDelivered,
    impressions: course.impressions,
    clicks: course.clicks,
    accepts: course.accepts,
    enrollments: course.enrollments,
    completions: course.completions,
    acceptanceProbability:
      course.acceptanceProbabilityCount > 0
        ? Number((course.acceptanceProbabilitySum / course.acceptanceProbabilityCount).toFixed(1))
        : 0,
    ctr: course.impressions > 0 ? Number(((course.clicks / course.impressions) * 100).toFixed(1)) : 0,
    acceptRate: course.clicks > 0 ? Number(((course.accepts / course.clicks) * 100).toFixed(1)) : 0,
    enrollmentConversionRate: course.clicks > 0 ? Number(((course.enrollments / course.clicks) * 100).toFixed(1)) : 0,
    completionRate: course.enrollments > 0 ? Number(((course.completions / course.enrollments) * 100).toFixed(1)) : 0,
  }));

  const totalRecommendationsDelivered = recommendationCourseInsights.reduce((sum, course) => sum + course.recommendationsDelivered, 0);
  const totalRecommendationImpressions = recommendationCourseInsights.reduce((sum, course) => sum + course.impressions, 0);
  const totalRecommendationClicks = recommendationCourseInsights.reduce((sum, course) => sum + course.clicks, 0);
  const totalRecommendationAccepts = recommendationCourseInsights.reduce((sum, course) => sum + course.accepts, 0);
  const totalRecommendationEnrollments = recommendationCourseInsights.reduce((sum, course) => sum + course.enrollments, 0);
  const totalRecommendationCompletions = recommendationCourseInsights.reduce((sum, course) => sum + course.completions, 0);
  const averageAcceptanceProbability = recommendationCourseInsights.length > 0
    ? Number((recommendationCourseInsights.reduce((sum, course) => sum + course.acceptanceProbability, 0) / recommendationCourseInsights.length).toFixed(1))
    : 0;

  return {
    totalRecommendationsDelivered,
    totalImpressions: totalRecommendationImpressions,
    totalClicks: totalRecommendationClicks,
    totalAccepts: totalRecommendationAccepts,
    totalRecommendationEnrollments,
    totalRecommendationCompletions,
    averageCtr: totalRecommendationImpressions > 0 ? Number(((totalRecommendationClicks / totalRecommendationImpressions) * 100).toFixed(1)) : 0,
    averageAcceptRate: totalRecommendationClicks > 0 ? Number(((totalRecommendationAccepts / totalRecommendationClicks) * 100).toFixed(1)) : 0,
    averageAcceptanceProbability,
    recommendedEnrollmentCompletionRate:
      totalRecommendationEnrollments > 0
        ? Number(((totalRecommendationCompletions / totalRecommendationEnrollments) * 100).toFixed(1))
        : 0,
    topRecommendedCourses: [...recommendationCourseInsights]
      .sort((left, right) => {
        if (right.recommendationsDelivered !== left.recommendationsDelivered) {
          return right.recommendationsDelivered - left.recommendationsDelivered;
        }
        if (right.impressions !== left.impressions) {
          return right.impressions - left.impressions;
        }
        return right.acceptanceProbability - left.acceptanceProbability;
      })
      .slice(0, 5),
    mostAcceptedCourses: [...recommendationCourseInsights]
      .sort((left, right) => {
        if (right.accepts !== left.accepts) {
          return right.accepts - left.accepts;
        }
        if (right.enrollments !== left.enrollments) {
          return right.enrollments - left.enrollments;
        }
        if (right.acceptanceProbability !== left.acceptanceProbability) {
          return right.acceptanceProbability - left.acceptanceProbability;
        }
        return right.ctr - left.ctr;
      })
      .slice(0, 5),
  };
};

const buildWeightedFactorScore = (
  rawScore: number,
  weight: number,
  explanation: string,
): LearnerRankingFactorScore => ({
  rawScore: toRoundedTenth(clampPercentage(rawScore)),
  weightedScore: toRoundedTenth((clampPercentage(rawScore) * weight) / 100),
  weight,
  explanation,
});

const maskEmailAddress = (email: string | null | undefined) => {
  if (!email || !email.includes("@")) return null;
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return null;
  if (localPart.length <= 2) {
    return `${localPart[0] || "*"}*@${domain}`;
  }
  return `${localPart.slice(0, 2)}${"*".repeat(Math.max(2, localPart.length - 2))}@${domain}`;
};

const getRecencyScore = (lastActivityAt: string | null | undefined) => {
  if (!lastActivityAt) {
    return { rawScore: 0, recencyDays: null };
  }

  const parsed = new Date(lastActivityAt);
  if (Number.isNaN(parsed.getTime())) {
    return { rawScore: 0, recencyDays: null };
  }

  const recencyDays = Math.max(0, differenceInDays(new Date(), parsed));

  if (recencyDays <= 3) return { rawScore: 100, recencyDays };
  if (recencyDays <= 7) return { rawScore: 90, recencyDays };
  if (recencyDays <= 14) return { rawScore: 75, recencyDays };
  if (recencyDays <= 30) return { rawScore: 55, recencyDays };
  if (recencyDays <= 45) return { rawScore: 35, recencyDays };
  return { rawScore: 15, recencyDays };
};

const getLatestTimestamp = (...values: Array<string | null | undefined>) => {
  const validValues = values
    .map((value) => {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : { value, time: parsed.getTime() };
    })
    .filter(Boolean) as Array<{ value: string; time: number }>;

  if (validValues.length === 0) return null;
  return validValues.sort((left, right) => right.time - left.time)[0].value;
};

const buildLearnerLeaderboardMetadata = (
  scope: LearnerLeaderboardScope,
  scopeId: string,
  scopeTitle: string,
  scopeCategory: string,
  includeIncompleteLearners: boolean,
  entries: LearnerLeaderboardEntry[],
): LearnerLeaderboard => ({
  scope,
  scopeId,
  scopeTitle,
  scopeCategory,
  generatedAt: new Date().toISOString(),
  includeIncompleteLearners,
  excludedStatuses: LEADERBOARD_EXCLUDED_STATUSES,
  privacyMode: "staff_only_masked",
  weights: LEARNER_RANKING_WEIGHTS,
  fairnessNotes: [
    scope === "course"
      ? "Ranking is course-scoped and compares learners within this course only."
      : "Ranking is program-scoped and aggregates learner progress across all courses linked to this program.",
    includeIncompleteLearners
      ? "Incomplete learners are included so trainers and admins can monitor active cohorts, but completion and certificates carry the strongest weight."
      : "Only completed learners are included in this ranking.",
    "Dropped enrollments are excluded from the leaderboard.",
    "This leaderboard stays staff-only and masks learner email addresses in the UI.",
  ],
  tieBreakerRules: [...LEADERBOARD_TIEBREAKER_RULES],
  entries,
});

const buildLeaderboardEntries = (entries: Array<LearnerLeaderboardEntry & { enrolledAt: string }>, limit: number) =>
  entries
    .sort((left, right) => {
      if (right.compositeScore !== left.compositeScore) return right.compositeScore - left.compositeScore;
      if (right.factorScores.completion.rawScore !== left.factorScores.completion.rawScore) {
        return right.factorScores.completion.rawScore - left.factorScores.completion.rawScore;
      }
      if (right.factorScores.assessment.rawScore !== left.factorScores.assessment.rawScore) {
        return right.factorScores.assessment.rawScore - left.factorScores.assessment.rawScore;
      }
      if ((right.lastActivityAt || "") !== (left.lastActivityAt || "")) {
        return (right.lastActivityAt || "").localeCompare(left.lastActivityAt || "");
      }
      if (left.enrolledAt !== right.enrolledAt) {
        return left.enrolledAt.localeCompare(right.enrolledAt);
      }
      return left.learnerName.localeCompare(right.learnerName);
    })
    .slice(0, limit)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))
    .map(({ enrolledAt, ...entry }) => entry);

const buildLearnerLeaderboardFromCourses = async ({
  scope,
  scopeId,
  scopeTitle,
  scopeCategory,
  courses,
  includeIncompleteLearners,
  limit,
}: {
  scope: LearnerLeaderboardScope;
  scopeId: string;
  scopeTitle: string;
  scopeCategory: string;
  courses: Array<{ id: string; title: string; category: string | null; duration: number | null }>;
  includeIncompleteLearners: boolean;
  limit: number;
}): Promise<LearnerLeaderboard | null> => {
  if (!supabase) return null;

  const courseIds = courses.map((course) => course.id);

  let enrollmentsQuery = supabase
    .from("enrollments")
    .select("id, user_id, course_id, progress, status, enrolled_at, completed_at")
    .in("course_id", courseIds)
    .neq("status", "dropped")
    .order("enrolled_at", { ascending: true });

  if (!includeIncompleteLearners) {
    enrollmentsQuery = enrollmentsQuery.eq("status", "completed");
  }

  const { data: enrollmentsData, error: enrollmentsError } = await enrollmentsQuery;
  if (enrollmentsError) {
    handleSupabaseError(enrollmentsError);
    return null;
  }

  const enrollments = (enrollmentsData || []) as Array<{
    id: string;
    user_id: string;
    course_id: string;
    progress: number | null;
    status: Enrollment["status"];
    enrolled_at: string;
    completed_at: string | null;
  }>;

  if (enrollments.length === 0) {
    return buildLearnerLeaderboardMetadata(scope, scopeId, scopeTitle, scopeCategory, includeIncompleteLearners, []);
  }

  const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
  const learnerIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.user_id)));
  const courseMap = new Map(courses.map((course) => [course.id, course]));

  const [usersResult, modulesResult, certificatesResult, moduleCompletionsResult, moduleSessionsResult, assessmentAttemptsResult] = await Promise.all([
    supabase.from("users").select("id, name, email").in("id", learnerIds),
    supabase.from("modules").select("id, course_id").in("course_id", courseIds),
    supabase.from("certificates").select("id, user_id, course_id, issued_at").in("course_id", courseIds),
    supabase.from("module_completions").select("enrollment_id, module_id, time_spent, completed_at").in("enrollment_id", enrollmentIds),
    supabase.from("module_sessions").select("enrollment_id, module_id, duration_seconds, last_seen_at, started_at").in("enrollment_id", enrollmentIds),
    supabase.from("assessment_attempts").select("id, assessment_id, enrollment_id, score, submitted_at, time_spent").in("enrollment_id", enrollmentIds).not("submitted_at", "is", null),
  ]);

  if (usersResult.error) {
    handleSupabaseError(usersResult.error);
    return null;
  }
  if (modulesResult.error) {
    handleSupabaseError(modulesResult.error);
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

  const users = usersResult.data || [];
  const modules = modulesResult.data || [];
  const certificates = certificatesResult.data || [];
  const moduleCompletions = moduleCompletionsResult.data || [];
  const moduleSessions = moduleSessionsResult.data || [];
  const assessmentAttempts = assessmentAttemptsResult.data || [];

  const moduleCountByCourseId = new Map<string, number>();
  for (const module of modules) {
    moduleCountByCourseId.set(module.course_id, (moduleCountByCourseId.get(module.course_id) || 0) + 1);
  }

  const userMap = new Map(users.map((row) => [row.id, row]));
  const certificatesByLearnerCourse = new Map(
    certificates.map((row) => [`${row.user_id}:${row.course_id}`, row]),
  );

  const completionStatsByEnrollment = new Map<string, {
    completedModuleIds: Set<string>;
    completionMinutesByModule: Map<string, number>;
    lastCompletionAt: string | null;
  }>();

  for (const completion of moduleCompletions) {
    const existing = completionStatsByEnrollment.get(completion.enrollment_id) || {
      completedModuleIds: new Set<string>(),
      completionMinutesByModule: new Map<string, number>(),
      lastCompletionAt: null,
    };

    existing.completedModuleIds.add(completion.module_id);
    existing.completionMinutesByModule.set(
      completion.module_id,
      (existing.completionMinutesByModule.get(completion.module_id) || 0) + Number(completion.time_spent || 0),
    );
    existing.lastCompletionAt = getLatestTimestamp(existing.lastCompletionAt, completion.completed_at);
    completionStatsByEnrollment.set(completion.enrollment_id, existing);
  }

  const sessionStatsByEnrollment = new Map<string, {
    sessionMinutesByModule: Map<string, number>;
    lastSeenAt: string | null;
  }>();

  for (const session of moduleSessions) {
    const existing = sessionStatsByEnrollment.get(session.enrollment_id) || {
      sessionMinutesByModule: new Map<string, number>(),
      lastSeenAt: null,
    };

    const sessionMinutes = Number(session.duration_seconds || 0) / 60;
    existing.sessionMinutesByModule.set(
      session.module_id,
      (existing.sessionMinutesByModule.get(session.module_id) || 0) + sessionMinutes,
    );
    existing.lastSeenAt = getLatestTimestamp(existing.lastSeenAt, session.last_seen_at, session.started_at);
    sessionStatsByEnrollment.set(session.enrollment_id, existing);
  }

  const latestAssessmentAttemptByKey = new Map<string, {
    assessment_id: string;
    enrollment_id: string;
    score: number | null;
    submitted_at: string | null;
    time_spent: number | null;
  }>();

  for (const attempt of assessmentAttempts) {
    const key = `${attempt.enrollment_id}:${attempt.assessment_id}`;
    const existing = latestAssessmentAttemptByKey.get(key);
    if (!existing || (attempt.submitted_at || "") > (existing.submitted_at || "")) {
      latestAssessmentAttemptByKey.set(key, {
        assessment_id: attempt.assessment_id,
        enrollment_id: attempt.enrollment_id,
        score: attempt.score === null || attempt.score === undefined ? null : Number(attempt.score),
        submitted_at: attempt.submitted_at,
        time_spent: attempt.time_spent === null || attempt.time_spent === undefined ? null : Number(attempt.time_spent),
      });
    }
  }

  const assessmentStatsByEnrollment = new Map<string, {
    attemptCount: number;
    scoreSum: number;
    scoreCount: number;
    timeSpentMinutes: number;
    lastSubmittedAt: string | null;
  }>();

  for (const attempt of latestAssessmentAttemptByKey.values()) {
    const existing = assessmentStatsByEnrollment.get(attempt.enrollment_id) || {
      attemptCount: 0,
      scoreSum: 0,
      scoreCount: 0,
      timeSpentMinutes: 0,
      lastSubmittedAt: null,
    };

    existing.attemptCount += 1;
    if (typeof attempt.score === "number" && !Number.isNaN(attempt.score)) {
      existing.scoreSum += attempt.score;
      existing.scoreCount += 1;
    }
    existing.timeSpentMinutes += Number(attempt.time_spent || 0);
    existing.lastSubmittedAt = getLatestTimestamp(existing.lastSubmittedAt, attempt.submitted_at);
    assessmentStatsByEnrollment.set(attempt.enrollment_id, existing);
  }

  if (scope === "course") {
    const course = courses[0];
    const totalModules = moduleCountByCourseId.get(course.id) || 0;
    const expectedLearningMinutes = Math.max(Number(course.duration || 0) * 60, totalModules * 30, 60);

    const entries = buildLeaderboardEntries(
      enrollments.map((enrollment) => {
        const userRow = userMap.get(enrollment.user_id);
        const completionStats = completionStatsByEnrollment.get(enrollment.id);
        const sessionStats = sessionStatsByEnrollment.get(enrollment.id);
        const assessmentStats = assessmentStatsByEnrollment.get(enrollment.id);
        const certificate = certificatesByLearnerCourse.get(`${enrollment.user_id}:${enrollment.course_id}`);
        const progress = clampPercentage(Number(enrollment.progress || 0));
        const completedUnits = completionStats?.completedModuleIds.size || 0;
        const completionCoverage = totalModules > 0 ? clampPercentage((completedUnits / totalModules) * 100) : progress;
        const moduleIds = new Set<string>([
          ...(completionStats ? Array.from(completionStats.completionMinutesByModule.keys()) : []),
          ...(sessionStats ? Array.from(sessionStats.sessionMinutesByModule.keys()) : []),
        ]);
        const trackedModuleMinutes = Array.from(moduleIds).reduce((sum, moduleId) => {
          const completionMinutes = completionStats?.completionMinutesByModule.get(moduleId) || 0;
          const sessionMinutes = sessionStats?.sessionMinutesByModule.get(moduleId) || 0;
          return sum + Math.max(completionMinutes, sessionMinutes);
        }, 0);
        const learningMinutes = Math.round(trackedModuleMinutes + (assessmentStats?.timeSpentMinutes || 0));
        const averageAssessmentScore = assessmentStats && assessmentStats.scoreCount > 0
          ? toRoundedTenth(assessmentStats.scoreSum / assessmentStats.scoreCount)
          : null;
        const completionRawScore = Math.max(enrollment.status === "completed" ? 100 : 0, progress, completionCoverage);
        const assessmentRawScore = averageAssessmentScore ?? 0;
        const learningTimeRawScore = clampPercentage((learningMinutes / expectedLearningMinutes) * 100);
        const certificateRawScore = certificate ? 100 : 0;
        const lastActivityAt = getLatestTimestamp(
          enrollment.completed_at,
          completionStats?.lastCompletionAt,
          sessionStats?.lastSeenAt,
          assessmentStats?.lastSubmittedAt,
          certificate?.issued_at,
          enrollment.enrolled_at,
        );
        const { rawScore: recencyRawScore, recencyDays } = getRecencyScore(lastActivityAt);

        const factorScores = {
          completion: buildWeightedFactorScore(completionRawScore, LEARNER_RANKING_WEIGHTS.completion, `${Math.round(completionRawScore)}% completion coverage based on course progress and completed modules.`),
          assessment: buildWeightedFactorScore(assessmentRawScore, LEARNER_RANKING_WEIGHTS.assessment, averageAssessmentScore !== null ? `Assessment average is ${averageAssessmentScore}% from ${assessmentStats?.attemptCount || 0} latest attempts.` : "No scored assessments yet, so the assessment contribution is 0."),
          learningTime: buildWeightedFactorScore(learningTimeRawScore, LEARNER_RANKING_WEIGHTS.learningTime, `${learningMinutes} tracked learning minutes against an expected ${expectedLearningMinutes} minutes for this course.`),
          certificate: buildWeightedFactorScore(certificateRawScore, LEARNER_RANKING_WEIGHTS.certificate, certificate ? "Completion certificate released for this learner." : "No certificate released yet."),
          recency: buildWeightedFactorScore(recencyRawScore, LEARNER_RANKING_WEIGHTS.recency, recencyDays === null ? "No recent learner activity captured yet." : `Most recent activity was ${recencyDays} day${recencyDays === 1 ? "" : "s"} ago.`),
        };

        const compositeScore = toRoundedTenth(Object.values(factorScores).reduce((sum, factor) => sum + factor.weightedScore, 0));
        const learnerName = userRow?.name || userRow?.email?.split("@")[0] || "Learner";
        const scoringExplanation = Object.values(factorScores)
          .sort((left, right) => right.weightedScore - left.weightedScore)
          .filter((factor) => factor.weightedScore > 0)
          .slice(0, 3)
          .map((factor) => `${factor.explanation} (${factor.weightedScore.toFixed(1)} pts)`);

        return {
          rank: 0,
          entryId: enrollment.id,
          learnerId: enrollment.user_id,
          learnerName,
          learnerEmailMasked: maskEmailAddress(userRow?.email),
          status: enrollment.status,
          progress: Math.round(progress),
          completedUnits,
          totalUnits: totalModules,
          unitsLabel: "modules" as const,
          averageAssessmentScore,
          assessmentAttempts: assessmentStats?.attemptCount || 0,
          learningMinutes,
          expectedLearningMinutes,
          certificatesEarned: certificate ? 1 : 0,
          expectedCertificates: 1,
          lastActivityAt,
          recencyDays,
          compositeScore,
          factorScores,
          scoringExplanation,
          enrolledAt: enrollment.enrolled_at,
        };
      }),
      limit,
    );

    return buildLearnerLeaderboardMetadata(scope, scopeId, scopeTitle, scopeCategory, includeIncompleteLearners, entries);
  }

  const totalProgramCourses = courses.length;
  const expectedLearningMinutesByCourseId = new Map(
    courses.map((course) => [
      course.id,
      Math.max(Number(course.duration || 0) * 60, (moduleCountByCourseId.get(course.id) || 0) * 30, 60),
    ]),
  );
  const enrollmentsByLearnerId = new Map<string, typeof enrollments>();

  for (const enrollment of enrollments) {
    const existing = enrollmentsByLearnerId.get(enrollment.user_id) || [];
    existing.push(enrollment);
    enrollmentsByLearnerId.set(enrollment.user_id, existing);
  }

  const entries = buildLeaderboardEntries(
    Array.from(enrollmentsByLearnerId.entries()).map(([learnerId, learnerEnrollments]) => {
      const userRow = userMap.get(learnerId);
      let completedUnits = 0;
      let progressSum = 0;
      let assessmentAttemptCount = 0;
      let assessmentScoreSum = 0;
      let assessmentScoreCount = 0;
      let learningMinutes = 0;
      let certificatesEarned = 0;
      let lastActivityAt: string | null = null;
      let earliestEnrollmentAt = learnerEnrollments[0]?.enrolled_at || new Date().toISOString();

      for (const enrollment of learnerEnrollments) {
        const completionStats = completionStatsByEnrollment.get(enrollment.id);
        const sessionStats = sessionStatsByEnrollment.get(enrollment.id);
        const assessmentStats = assessmentStatsByEnrollment.get(enrollment.id);
        const certificate = certificatesByLearnerCourse.get(`${learnerId}:${enrollment.course_id}`);
        const progress = clampPercentage(Number(enrollment.progress || 0));
        progressSum += progress;
        if (isEnrollmentCompleted(enrollment.status)) {
          completedUnits += 1;
        }

        const moduleIds = new Set<string>([
          ...(completionStats ? Array.from(completionStats.completionMinutesByModule.keys()) : []),
          ...(sessionStats ? Array.from(sessionStats.sessionMinutesByModule.keys()) : []),
        ]);

        const trackedModuleMinutes = Array.from(moduleIds).reduce((sum, moduleId) => {
          const completionMinutes = completionStats?.completionMinutesByModule.get(moduleId) || 0;
          const sessionMinutes = sessionStats?.sessionMinutesByModule.get(moduleId) || 0;
          return sum + Math.max(completionMinutes, sessionMinutes);
        }, 0);

        learningMinutes += Math.round(trackedModuleMinutes + (assessmentStats?.timeSpentMinutes || 0));
        assessmentAttemptCount += assessmentStats?.attemptCount || 0;
        assessmentScoreSum += assessmentStats?.scoreSum || 0;
        assessmentScoreCount += assessmentStats?.scoreCount || 0;
        if (certificate) {
          certificatesEarned += 1;
        }
        lastActivityAt = getLatestTimestamp(
          lastActivityAt,
          enrollment.completed_at,
          completionStats?.lastCompletionAt,
          sessionStats?.lastSeenAt,
          assessmentStats?.lastSubmittedAt,
          certificate?.issued_at,
          enrollment.enrolled_at,
        );

        if (enrollment.enrolled_at < earliestEnrollmentAt) {
          earliestEnrollmentAt = enrollment.enrolled_at;
        }
      }

      const progress = totalProgramCourses > 0 ? clampPercentage(progressSum / totalProgramCourses) : 0;
      const averageAssessmentScore = assessmentScoreCount > 0 ? toRoundedTenth(assessmentScoreSum / assessmentScoreCount) : null;
      const expectedLearningMinutes = Array.from(expectedLearningMinutesByCourseId.values()).reduce((sum, minutes) => sum + minutes, 0);
      const completionRawScore = Math.max(progress, totalProgramCourses > 0 ? clampPercentage((completedUnits / totalProgramCourses) * 100) : 0);
      const assessmentRawScore = averageAssessmentScore ?? 0;
      const learningTimeRawScore = clampPercentage((learningMinutes / Math.max(expectedLearningMinutes, 60)) * 100);
      const certificateRawScore = totalProgramCourses > 0 ? clampPercentage((certificatesEarned / totalProgramCourses) * 100) : 0;
      const { rawScore: recencyRawScore, recencyDays } = getRecencyScore(lastActivityAt);
      const factorScores = {
        completion: buildWeightedFactorScore(completionRawScore, LEARNER_RANKING_WEIGHTS.completion, `${completedUnits} of ${totalProgramCourses} program courses completed with ${Math.round(progress)}% aggregate progress.`),
        assessment: buildWeightedFactorScore(assessmentRawScore, LEARNER_RANKING_WEIGHTS.assessment, averageAssessmentScore !== null ? `Assessment average is ${averageAssessmentScore}% from ${assessmentAttemptCount} latest attempts across the program.` : "No scored assessments yet across this program, so the assessment contribution is 0."),
        learningTime: buildWeightedFactorScore(learningTimeRawScore, LEARNER_RANKING_WEIGHTS.learningTime, `${learningMinutes} tracked learning minutes against an expected ${expectedLearningMinutes} minutes across the program.`),
        certificate: buildWeightedFactorScore(certificateRawScore, LEARNER_RANKING_WEIGHTS.certificate, certificatesEarned > 0 ? `${certificatesEarned} of ${totalProgramCourses} course certificates earned in this program.` : "No course certificates earned in this program yet."),
        recency: buildWeightedFactorScore(recencyRawScore, LEARNER_RANKING_WEIGHTS.recency, recencyDays === null ? "No recent learner activity captured yet." : `Most recent activity was ${recencyDays} day${recencyDays === 1 ? "" : "s"} ago.`),
      };
      const compositeScore = toRoundedTenth(Object.values(factorScores).reduce((sum, factor) => sum + factor.weightedScore, 0));
      const learnerName = userRow?.name || userRow?.email?.split("@")[0] || "Learner";
      const scoringExplanation = Object.values(factorScores)
        .sort((left, right) => right.weightedScore - left.weightedScore)
        .filter((factor) => factor.weightedScore > 0)
        .slice(0, 3)
        .map((factor) => `${factor.explanation} (${factor.weightedScore.toFixed(1)} pts)`);
      const overallStatus: Enrollment["status"] = completedUnits >= totalProgramCourses && totalProgramCourses > 0
        ? "completed"
        : progress > 0
          ? "in-progress"
          : "enrolled";

      return {
        rank: 0,
        entryId: `program:${scopeId}:${learnerId}`,
        learnerId,
        learnerName,
        learnerEmailMasked: maskEmailAddress(userRow?.email),
        status: overallStatus,
        progress: Math.round(progress),
        completedUnits,
        totalUnits: totalProgramCourses,
        unitsLabel: "courses" as const,
        averageAssessmentScore,
        assessmentAttempts: assessmentAttemptCount,
        learningMinutes,
        expectedLearningMinutes,
        certificatesEarned,
        expectedCertificates: totalProgramCourses,
        lastActivityAt,
        recencyDays,
        compositeScore,
        factorScores,
        scoringExplanation,
        enrolledAt: earliestEnrollmentAt,
      };
    }),
    limit,
  );

  return buildLearnerLeaderboardMetadata(scope, scopeId, scopeTitle, scopeCategory, includeIncompleteLearners, entries);
};

export interface LearnerCourseRecommendation {
  course: Course;
  score: number;
  acceptanceProbability?: number;
  reasons: string[];
  recommendationMode?: "hybrid" | "assessment_only";
  sourceMix?: {
    contentBased: boolean;
    popularityWeighted: boolean;
    collaborative: boolean;
    sessionBehavior: boolean;
    assessmentPerformance: boolean;
  };
  modelVersion?: string;
}

export interface LearnerCareerPathRecommendation {
  title: string;
  type: "industry" | "career_path";
  description: string;
  rationale: string;
  supportingCourses: string[];
}

const finalizeRecommendationSentence = (parts: string[]) => {
  const text = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, index, array) => array.indexOf(part) === index)
    .slice(0, 2)
    .join(". ");

  if (!text) {
    return "Built from your saved learner signals and recent course matches.";
  }

  return /[.!?]$/.test(text) ? text : `${text}.`;
};

export const buildLearnerCareerPathRecommendations = (
  user: User | null,
  courses: Course[],
  enrollments: Enrollment[],
  performanceSummary?: LearnerPerformanceSummary | null,
  limit = 3,
): LearnerCareerPathRecommendation[] => {
  if (!user || user.role !== "trainee") {
    return [];
  }

  const rankedCourses = buildLearnerCourseRecommendations(
    user,
    courses,
    enrollments,
    performanceSummary,
    Math.max(limit * 4, 8),
  );
  const strongestTopic = performanceSummary?.strongestTopic?.topic || null;
  const needsImprovementTopic = performanceSummary?.needsImprovementTopic?.topic || null;
  const normalizedStrongestTopic = canonicalizeTopicTag(strongestTopic || "")?.toLowerCase() || null;
  const normalizedNeedsImprovementTopic = canonicalizeTopicTag(needsImprovementTopic || "")?.toLowerCase() || null;
  const preferredCategories = new Set(normalizeCourseCategories(user.preferredCategories).map((value) => value.toLowerCase()));
  const learnerIndustryInterests = Array.from(normalizeSet(user.industryInterests));
  const originalIndustryInterests = user.industryInterests || [];

  type Candidate = LearnerCareerPathRecommendation & {
    score: number;
    rationaleParts: string[];
  };

  const candidates = new Map<string, Candidate>();

  const registerCandidate = (
    type: LearnerCareerPathRecommendation["type"],
    title: string,
    score: number,
    rationaleParts: string[],
    supportingCourseTitle?: string,
  ) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return;
    }

    const key = `${type}:${normalizedTitle.toLowerCase()}`;
    const existing = candidates.get(key);
    const description = type === "industry"
      ? `${normalizedTitle} keeps surfacing in the courses and skill signals that best match your learner profile.`
      : `${normalizedTitle} fits the course themes and skill signals already appearing in your learner record.`;

    if (existing) {
      existing.score += score;
      existing.rationaleParts.push(...rationaleParts);
      if (supportingCourseTitle && !existing.supportingCourses.includes(supportingCourseTitle) && existing.supportingCourses.length < 2) {
        existing.supportingCourses.push(supportingCourseTitle);
      }
      return;
    }

    candidates.set(key, {
      title: normalizedTitle,
      type,
      description,
      rationale: "",
      supportingCourses: supportingCourseTitle ? [supportingCourseTitle] : [],
      score,
      rationaleParts: [...rationaleParts],
    });
  };

  rankedCourses.forEach((recommendation, index) => {
    const { course, reasons } = recommendation;
    const weightedScore = Math.max(1, recommendation.score) + Math.max(0, 18 - (index * 2));
    const normalizedCategory = normalizeCategoryKey(course.category);
    const courseTopics = deriveTopicTags(course.category, course.skills, course.topicTags).map((topic) => topic.toLowerCase());
    const courseIndustries = Array.from(new Set((course.industryTags || []).map((tag) => tag.trim()).filter(Boolean)));
    const courseCareerPaths = Array.from(new Set((course.careerPaths || []).map((path) => path.trim()).filter(Boolean)));
    const rationaleParts: string[] = [];
    const matchingInterest = courseIndustries.find((tag) => learnerIndustryInterests.includes(tag.toLowerCase()));

    if (matchingInterest) {
      rationaleParts.push(`Matches your ${matchingInterest} interest`);
    }

    if (preferredCategories.has(normalizedCategory)) {
      rationaleParts.push(`Connected to your preferred ${course.category} learning track`);
    }

    if (normalizedStrongestTopic && courseTopics.includes(normalizedStrongestTopic) && strongestTopic) {
      rationaleParts.push(`Builds on your strong ${strongestTopic} assessment results`);
    }

    if (normalizedNeedsImprovementTopic && courseTopics.includes(normalizedNeedsImprovementTopic) && needsImprovementTopic) {
      rationaleParts.push(`Gives you more guided practice in ${needsImprovementTopic}`);
    }

    if (rationaleParts.length === 0 && reasons[0]) {
      rationaleParts.push(reasons[0]);
    }

    courseIndustries.forEach((industryTag) => {
      registerCandidate("industry", industryTag, weightedScore, rationaleParts, course.title);
    });

    courseCareerPaths.forEach((careerPath) => {
      registerCandidate("career_path", careerPath, weightedScore + 4, [...rationaleParts, `Supported by ${course.title}`], course.title);
    });
  });

  originalIndustryInterests.forEach((interest, index) => {
    if (candidates.size >= limit + 2) {
      return;
    }

    registerCandidate(
      "industry",
      interest,
      36 - (index * 2),
      [
        `Directly matches your saved ${interest} interest`,
        strongestTopic ? `Can build on your ${strongestTopic} learning momentum` : "Useful for shaping your next training direction",
      ],
    );
  });

  return Array.from(candidates.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ score: _score, rationaleParts, ...candidate }) => ({
      ...candidate,
      rationale: finalizeRecommendationSentence(rationaleParts),
    }));
};

export const deriveAssessmentOnlyRecommendationEvidence = (
  performanceSummary?: LearnerPerformanceSummary | null,
): AssessmentOnlyRecommendationEvidence | null => {
  if (!performanceSummary || performanceSummary.scoredAssessments <= 0) {
    return null;
  }

  const scoredTopics = performanceSummary.topicPerformance.filter(
    (topic) => topic.assessmentsTaken > 0 && topic.averageScore !== null,
  );
  const assessedTopics = scoredTopics
    .map((topic) => canonicalizeTopicTag(topic.topic) || topic.topic)
    .filter(Boolean);

  const scoreBand: AssessmentOnlyRecommendationEvidence["scoreBand"] =
    performanceSummary.averageAssessmentScore >= 90
      ? "advanced"
      : performanceSummary.averageAssessmentScore >= 75
        ? "proficient"
        : performanceSummary.averageAssessmentScore >= 60
          ? "developing"
          : "support";

  return {
    scoredAssessments: performanceSummary.scoredAssessments,
    scoreBand,
    strongestTopic: performanceSummary.strongestTopic,
    weakestTopic: performanceSummary.needsImprovementTopic,
    failedCompetencies: scoredTopics.filter((topic) => Number(topic.averageScore || 0) < 70),
    assessedTopics,
  };
};

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

const normalizeCategoryKey = (value: string | undefined | null) => {
  const canonical = canonicalizeCourseCategory(value);
  return (canonical || value || "").toLowerCase().trim();
};

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const STAFF_PERFORMANCE_WEIGHTS = {
  completionRate: 25,
  assessmentQuality: 20,
  learnerEngagement: 15,
  riskManagement: 15,
  recommendationConversion: 10,
  contentQuality: 15,
} as const;

const hasMeaningfulModuleContent = (content: string | null | undefined) => {
  if (!content || !content.trim()) return false;

  const objectHasMeaningfulValue = (value: unknown): boolean => {
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number" || typeof value === "boolean") return true;
    if (Array.isArray(value)) return value.some((item) => objectHasMeaningfulValue(item));
    if (value && typeof value === "object") {
      return Object.values(value).some((item) => objectHasMeaningfulValue(item));
    }
    return false;
  };

  try {
    const parsed = JSON.parse(content);
    return objectHasMeaningfulValue(parsed);
  } catch {
    return content.trim().length > 0;
  }
};

const isStarterFriendlyCourse = (course: Course) => {
  const normalizedCategory = normalizeCategoryKey(course.category);
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
    return "Matches learning paths taken by similar learners";
  }

  return "Suggested from similar learner enrollment patterns";
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
      if (isEnrollmentCompleted(row.status)) {
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
        isEnrollmentCompleted(row.status)
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
      if (isEnrollmentCompleted(row.status)) {
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
  const learnerSkills = new Set(normalizeSkillTags(user.skills).map((value) => value.toLowerCase()));
  const preferredCategories = new Set(normalizeCourseCategories(user.preferredCategories).map((value) => value.toLowerCase()));
  const industryInterests = Array.from(normalizeSet(user.industryInterests));
  const completedCategoryCounts = new Map<string, number>();
  completedCourses.forEach((course) => {
    const key = normalizeCategoryKey(course.category);
    completedCategoryCounts.set(key, (completedCategoryCounts.get(key) || 0) + 1);
  });

  const strongestTopic = canonicalizeTopicTag(performanceSummary?.strongestTopic?.topic || "")?.toLowerCase() || null;
  const needsImprovementTopic = canonicalizeTopicTag(performanceSummary?.needsImprovementTopic?.topic || "")?.toLowerCase() || null;
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
  const prefersGuidedStart = user.onboardingConfidenceLevel === "needs_guidance";
  const hasSomeExposure = user.onboardingConfidenceLevel === "some_exposure";
  const isProgressionReadyFromOnboarding = user.onboardingConfidenceLevel === "ready_for_projects";
  const prefersShorterWeeklyCommitment = user.onboardingWeeklyCommitment === "under_2";
  const canHandleSteadyCommitment = user.onboardingWeeklyCommitment === "2_to_4";
  const canHandleHeavierCommitment = user.onboardingWeeklyCommitment === "5_plus";
  const needsDigitalSupport = user.onboardingDigitalComfort === "needs_support";
  const comfortableWithDigitalTools = user.onboardingDigitalComfort === "comfortable";
  const advancedDigitalComfort = user.onboardingDigitalComfort === "advanced_tools";
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
      const normalizedCategory = normalizeCategoryKey(course.category);
      const courseSkills = normalizeSkillTags(course.skills).map((skill) => skill.toLowerCase());
      const courseTopics = deriveTopicTags(course.category, course.skills, course.topicTags).map((topic) => topic.toLowerCase());
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
        (completedCourse) => normalizeCategoryKey(completedCourse.category) === normalizedCategory,
      );

      if (
        matchingCompletedCourse &&
        levelRank[course.level] >= levelRank[matchingCompletedCourse.level]
      ) {
        score += 14;
        reasons.push(`Natural next step after ${matchingCompletedCourse.title}`);
      }

      if (strongestTopic && (courseTopics.includes(strongestTopic) || courseSkills.includes(strongestTopic))) {
        score += 12;
        reasons.push(`Extends your strong ${performanceSummary?.strongestTopic?.topic} results`);
      }

      if (needsImprovementTopic && (courseTopics.includes(needsImprovementTopic) || courseSkills.includes(needsImprovementTopic))) {
        score += 10;
        reasons.push(`Helps improve ${performanceSummary?.needsImprovementTopic?.topic}`);
      }

      const popularityScore = Math.min(20, Math.round((course.enrolledCount || 0) / 15));
      if (popularityScore > 0) {
        score += popularityScore;
        usedPopularityWeight = true;
        reasons.push("Popular among PESO Academy learners");
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
            reasons.push("Curated starter course for new learners");
          }

          if (course.level === "Beginner") {
            score += 10;
            reasons.push("Beginner-friendly while your learning profile is still new");
          }
        } else if (course.level === "Beginner" && preferredCategories.size === 0 && industryInterests.length === 0) {
          score += 8;
          reasons.push("Good starter fit based on your onboarding profile");
        }

        if (prefersGuidedStart && course.level === "Beginner") {
          score += 14;
          reasons.push("Matches the guided start you selected during onboarding");
        }

        if (hasSomeExposure && levelRank[course.level] <= 2) {
          score += 8;
          reasons.push("Fits the moderate starting pace from your onboarding assessment");
        }

        if (isProgressionReadyFromOnboarding && levelRank[course.level] >= 2) {
          score += 14;
          reasons.push("Matches the progression-ready confidence you shared during onboarding");
        }

        if (prefersShorterWeeklyCommitment && course.duration <= 10) {
          score += 10;
          reasons.push("Fits the lighter weekly schedule you chose during onboarding");
        }

        if (canHandleSteadyCommitment && course.duration > 8 && course.duration <= 20) {
          score += 6;
          reasons.push("Matches the steady weekly pace from your onboarding plan");
        }

        if (canHandleHeavierCommitment && course.duration >= 12) {
          score += 8;
          reasons.push("Fits the heavier learning commitment you said you can handle");
        }

        if (needsDigitalSupport && course.level === "Beginner") {
          score += 10;
          reasons.push("Beginner-friendly for the digital support level you selected");
        }

        if (comfortableWithDigitalTools && course.level !== "Advanced") {
          score += 4;
        }

        if (advancedDigitalComfort && levelRank[course.level] >= 2) {
          score += 8;
          reasons.push("Aligned with the stronger digital comfort you reported at onboarding");
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
          (performanceSummary.scoredAssessments > 0 && averageAssessmentScore < 70) ||
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

      const acceptanceProbability = Math.round(
        clampNumber(
          12 +
            Math.min(score, 140) * 0.38 +
            (preferredCategories.has(normalizedCategory) ? 8 : 0) +
            Math.min(skillOverlap * 4, 12) +
            (collaborativeSignal ? 9 : 0) +
            (behaviorSignals.recentActiveCategories.includes(normalizedCategory) ? 6 : 0) +
            (!hasHistoricalSignals && course.level === "Beginner" ? 5 : 0),
          5,
          95,
        ),
      );

      return {
        course,
        score,
        acceptanceProbability,
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

export const buildAssessmentOnlyCourseRecommendations = (
  courses: Course[],
  enrollments: Enrollment[],
  performanceSummary?: LearnerPerformanceSummary | null,
  limit = 3,
): LearnerCourseRecommendation[] => {
  const evidence = deriveAssessmentOnlyRecommendationEvidence(performanceSummary);
  if (!evidence || !performanceSummary) {
    return [];
  }

  const enrolledCourseIds = new Set(enrollments.map((enrollment) => enrollment.courseId));
  const strongestTopic = canonicalizeTopicTag(evidence.strongestTopic?.topic || "")?.toLowerCase() || null;
  const weakestTopic = canonicalizeTopicTag(evidence.weakestTopic?.topic || "")?.toLowerCase() || null;
  const failedCompetencyTopics = new Set(
    evidence.failedCompetencies
      .map((topic) => canonicalizeTopicTag(topic.topic)?.toLowerCase() || topic.topic.toLowerCase())
      .filter(Boolean),
  );
  const assessedTopics = new Set(evidence.assessedTopics.map((topic) => topic.toLowerCase()));

  return courses
    .filter((course) => !enrolledCourseIds.has(course.id) && course.published !== false)
    .map((course) => {
      let score = 0;
      const reasons: string[] = [];
      const courseSkills = normalizeSkillTags(course.skills).map((skill) => skill.toLowerCase());
      const courseTopics = deriveTopicTags(course.category, course.skills, course.topicTags).map((topic) => topic.toLowerCase());
      const matchedAssessedTopics = [...assessedTopics].filter(
        (topic) => courseTopics.includes(topic) || courseSkills.includes(topic),
      );
      const matchedFailedCompetencies = [...failedCompetencyTopics].filter(
        (topic) => courseTopics.includes(topic) || courseSkills.includes(topic),
      );

      if (matchedFailedCompetencies.length > 0) {
        score += matchedFailedCompetencies.length * 28;
        reasons.push(`Targets assessment gaps in ${matchedFailedCompetencies.slice(0, 2).join(" and ")}`);
      }

      if (weakestTopic && (courseTopics.includes(weakestTopic) || courseSkills.includes(weakestTopic))) {
        score += 26;
        reasons.push(`Builds support around your lowest assessment topic: ${performanceSummary.needsImprovementTopic?.topic}`);
      }

      if (strongestTopic && (courseTopics.includes(strongestTopic) || courseSkills.includes(strongestTopic))) {
        score += evidence.scoreBand === "advanced" || evidence.scoreBand === "proficient" ? 20 : 8;
        reasons.push(`Extends your strongest assessed topic: ${performanceSummary.strongestTopic?.topic}`);
      }

      if (matchedAssessedTopics.length > 0) {
        score += matchedAssessedTopics.length * 10;
        reasons.push(`Matches ${matchedAssessedTopics.length} topic${matchedAssessedTopics.length === 1 ? "" : "s"} already measured in your assessments`);
      }

      if (evidence.scoreBand === "support" && course.level === "Beginner") {
        score += 24;
        reasons.push("Assessment results point to a lower-risk beginner course next");
      }

      if (evidence.scoreBand === "developing" && (course.level === "Beginner" || course.level === "Intermediate")) {
        score += 18;
        reasons.push("Fits the developing score band from your assessment results");
      }

      if (evidence.scoreBand === "proficient" && course.level === "Intermediate") {
        score += 16;
        reasons.push("Matches the progression level suggested by your assessment scores");
      }

      if (evidence.scoreBand === "advanced" && (course.level === "Intermediate" || course.level === "Advanced")) {
        score += 18;
        reasons.push("Offers a stronger challenge based on your high assessment performance");
      }

      if (
        performanceSummary.recentAssessments.length > 0 &&
        (performanceSummary.recentAssessments[0].score || 0) < 70 &&
        course.level === "Beginner"
      ) {
        score += 10;
        reasons.push(`Responds to your recent ${performanceSummary.recentAssessments[0].assessmentTitle} result`);
      }

      const acceptanceProbability = Math.round(
        clampNumber(
          18 + Math.min(score, 140) * 0.42 + matchedFailedCompetencies.length * 6 + matchedAssessedTopics.length * 3,
          5,
          95,
        ),
      );

      return {
        course,
        score,
        acceptanceProbability,
        reasons: Array.from(new Set(reasons)).slice(0, 3),
        recommendationMode: "assessment_only",
        sourceMix: {
          contentBased: false,
          popularityWeighted: false,
          collaborative: false,
          sessionBehavior: false,
          assessmentPerformance: true,
        },
        modelVersion: "phase8-assessment-only-v1",
      } satisfies LearnerCourseRecommendation;
    })
    .filter((recommendation) => recommendation.score > 0 && recommendation.reasons.length > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.course.title.localeCompare(right.course.title);
    })
    .slice(0, limit);
};

export const reportingService = {
  getCourseContentCompletenessReports: async (
    courseId?: string,
  ): Promise<CourseContentCompletenessReport[]> => {
    if (!supabase) return [];

    try {
      let coursesQuery = supabase
        .from("courses")
        .select("id, title, category, published, instructor_id")
        .order("created_at", { ascending: false });

      if (courseId) {
        coursesQuery = coursesQuery.eq("id", courseId);
      }

      const { data: courseRows, error: coursesError } = await coursesQuery;

      if (coursesError) {
        handleSupabaseError(coursesError);
        return [];
      }

      if (!courseRows || courseRows.length === 0) {
        return [];
      }

      const courseIds = courseRows.map((course) => course.id);

      const [modulesResult, assessmentsResult, assessmentQuestionsResult] = await Promise.all([
        supabase
          .from("modules")
          .select("id, course_id, title, status, content, materials, module_thumbnail, module_document, skill_tags, topic_tags")
          .in("course_id", courseIds)
          .order("order", { ascending: true }),
        supabase
          .from("assessments")
          .select("id, module_id, is_active")
          .in("module_id", (
            await supabase
              .from("modules")
              .select("id")
              .in("course_id", courseIds)
          ).data?.map((module) => module.id) || []),
        supabase
          .from("assessment_questions")
          .select("id, assessment_id"),
      ]);

      if (modulesResult.error) {
        handleSupabaseError(modulesResult.error);
        return [];
      }
      if (assessmentsResult.error) {
        handleSupabaseError(assessmentsResult.error);
        return [];
      }
      if (assessmentQuestionsResult.error) {
        handleSupabaseError(assessmentQuestionsResult.error);
        return [];
      }

      const moduleRows = modulesResult.data || [];
      const assessmentRows = (assessmentsResult.data || []).filter((assessment) => assessment.is_active);
      const questionRows = assessmentQuestionsResult.data || [];

      const questionCountByAssessmentId = new Map<string, number>();
      for (const question of questionRows) {
        questionCountByAssessmentId.set(
          question.assessment_id,
          (questionCountByAssessmentId.get(question.assessment_id) || 0) + 1,
        );
      }

      const hasAssessmentByModuleId = new Map<string, boolean>();
      for (const assessment of assessmentRows) {
        const questionCount = questionCountByAssessmentId.get(assessment.id) || 0;
        if (questionCount > 0) {
          hasAssessmentByModuleId.set(assessment.module_id, true);
        }
      }

      return courseRows.map((course) => {
        const courseModules = moduleRows.filter((module) => module.course_id === course.id);
        const moduleChecks = courseModules.map((module) => {
          const hasContentBody = hasMeaningfulModuleContent(module.content);
          const hasMediaAsset = Boolean(module.module_thumbnail || module.module_document);
          const hasAssessmentOrActivity = Boolean(hasAssessmentByModuleId.get(module.id) || (module.materials || []).length > 0);
          const hasTags = (module.skill_tags || []).length > 0 && (module.topic_tags || []).length > 0;
          const status = module.status === "finalized" ? "finalized" : "draft";
          const missingItems: string[] = [];

          if (status !== "finalized") missingItems.push("Finalize module status");
          if (!hasContentBody) missingItems.push("Add content body");
          if (!hasMediaAsset) missingItems.push("Attach media asset");
          if (!hasAssessmentOrActivity) missingItems.push("Add assessment or learning activity");
          if (!hasTags) missingItems.push("Assign skill and topic tags");

          return {
            moduleId: module.id,
            moduleTitle: module.title,
            status,
            hasContentBody,
            hasMediaAsset,
            hasAssessmentOrActivity,
            hasTags,
            isPublishReady: missingItems.length === 0,
            missingItems,
          } satisfies ModuleContentCompletenessCheck;
        });

        const totalModules = moduleChecks.length;
        const finalizedModules = moduleChecks.filter((module) => module.status === "finalized").length;
        const draftModules = totalModules - finalizedModules;
        const publishReadyModules = moduleChecks.filter((module) => module.isPublishReady).length;
        const modulesWithoutContent = moduleChecks.filter((module) => !module.hasContentBody).length;
        const modulesWithoutMedia = moduleChecks.filter((module) => !module.hasMediaAsset).length;
        const modulesWithoutAssessmentOrActivity = moduleChecks.filter((module) => !module.hasAssessmentOrActivity).length;
        const modulesWithoutTags = moduleChecks.filter((module) => !module.hasTags).length;
        const hasTrainerOwnership = Boolean(course.instructor_id);
        const metRequirementCount =
          (hasTrainerOwnership ? 1 : 0) +
          moduleChecks.reduce(
            (sum, module) =>
              sum +
              Number(module.status === "finalized") +
              Number(module.hasContentBody) +
              Number(module.hasMediaAsset) +
              Number(module.hasAssessmentOrActivity) +
              Number(module.hasTags),
            0,
          );
        const totalRequirementCount = 1 + totalModules * 5;
        const completenessRate = totalModules > 0
          ? Math.round((metRequirementCount / totalRequirementCount) * 100)
          : hasTrainerOwnership
            ? 50
            : 0;
        const missingSummary: string[] = [];

        if (!hasTrainerOwnership) missingSummary.push("Assign a trainer owner to the course.");
        if (totalModules === 0) missingSummary.push("Create at least one module.");
        if (draftModules > 0) missingSummary.push(`${draftModules} module${draftModules === 1 ? " is" : "s are"} still in draft status.`);
        if (modulesWithoutContent > 0) missingSummary.push(`${modulesWithoutContent} module${modulesWithoutContent === 1 ? " is" : "s are"} missing content body.`);
        if (modulesWithoutMedia > 0) missingSummary.push(`${modulesWithoutMedia} module${modulesWithoutMedia === 1 ? " is" : "s are"} missing media assets.`);
        if (modulesWithoutAssessmentOrActivity > 0) missingSummary.push(`${modulesWithoutAssessmentOrActivity} module${modulesWithoutAssessmentOrActivity === 1 ? " is" : "s are"} missing an assessment or learning activity.`);
        if (modulesWithoutTags > 0) missingSummary.push(`${modulesWithoutTags} module${modulesWithoutTags === 1 ? " is" : "s are"} missing required skill/topic tags.`);

        return {
          courseId: course.id,
          courseTitle: course.title,
          courseCategory: course.category || "Uncategorized",
          published: course.published !== false,
          hasTrainerOwnership,
          totalModules,
          finalizedModules,
          draftModules,
          publishReadyModules,
          modulesWithoutContent,
          modulesWithoutMedia,
          modulesWithoutAssessmentOrActivity,
          modulesWithoutTags,
          completenessRate,
          readyToPublish: hasTrainerOwnership && totalModules > 0 && moduleChecks.every((module) => module.isPublishReady),
          missingSummary,
          publishReadyChecklist: [
            "Each module must be finalized.",
            "Each module must include content body.",
            "Each module must include at least one media asset such as a thumbnail or attached document.",
            "Each module must include an assessment with questions or a learning activity resource.",
            "Each module must include both skill and topic tags.",
            "Each course must have a trainer owner before publishing.",
          ],
          moduleChecks,
        } satisfies CourseContentCompletenessReport;
      });
    } catch (error) {
      console.error("Error getting course content completeness reports:", error);
      return [];
    }
  },

  getStaffPerformanceScorecards: async (
    startDate?: Date,
    endDate?: Date,
  ): Promise<StaffPerformanceScorecard[]> => {
    if (!supabase) return [];

    try {
      const startIso = startDate ? startDate.toISOString() : null;
      const endIso = endDate ? endDate.toISOString() : null;
      const startDateValue = startDate ? format(startDate, "yyyy-MM-dd") : null;
      const endDateValue = endDate ? format(endDate, "yyyy-MM-dd") : null;

      const { data: courseRows, error: coursesError } = await supabase
        .from("courses")
        .select("id, title, instructor_id")
        .not("instructor_id", "is", null)
        .order("title", { ascending: true });

      if (coursesError) {
        handleSupabaseError(coursesError);
        return [];
      }

      const managedCourses = (courseRows || []).filter((course) => Boolean(course.instructor_id));
      if (managedCourses.length === 0) {
        return [];
      }

      const courseIds = managedCourses.map((course) => course.id);
      const trainerIds = Array.from(new Set(managedCourses.map((course) => course.instructor_id).filter(Boolean)));

      let trainerUsersQuery = supabase
        .from("users")
        .select("id, name, email, role")
        .in("id", trainerIds);

      const enrollmentsQueryBase = supabase
        .from("enrollments")
        .select("id, user_id, course_id, status, enrolled_at, completed_at")
        .in("course_id", courseIds);

      let enrollmentsQuery = enrollmentsQueryBase;
      if (startIso) {
        enrollmentsQuery = enrollmentsQuery.gte("enrolled_at", startIso);
      }
      if (endIso) {
        enrollmentsQuery = enrollmentsQuery.lte("enrolled_at", endIso);
      }

      let certificatesQuery = supabase
        .from("certificates")
        .select("course_id, user_id, issued_at")
        .in("course_id", courseIds);
      if (startIso) {
        certificatesQuery = certificatesQuery.gte("issued_at", startIso);
      }
      if (endIso) {
        certificatesQuery = certificatesQuery.lte("issued_at", endIso);
      }

      let recommendationsQuery = supabase
        .from("learner_recommendations")
        .select("course_id, impression_count, enrollment_count, generated_at")
        .in("course_id", courseIds);
      if (startIso) {
        recommendationsQuery = recommendationsQuery.gte("generated_at", startIso);
      }
      if (endIso) {
        recommendationsQuery = recommendationsQuery.lte("generated_at", endIso);
      }

      let courseRiskQuery = supabase
        .from("course_risk_scores")
        .select("course_id, snapshot_date, active_enrollments, risk_score, risk_level")
        .in("course_id", courseIds)
        .order("snapshot_date", { ascending: false });
      if (startDateValue) {
        courseRiskQuery = courseRiskQuery.gte("snapshot_date", startDateValue);
      }
      if (endDateValue) {
        courseRiskQuery = courseRiskQuery.lte("snapshot_date", endDateValue);
      }

      const [trainerUsersResult, enrollmentsResult, certificatesResult, recommendationsResult, courseRiskResult, contentReports] = await Promise.all([
        trainerUsersQuery,
        enrollmentsQuery,
        certificatesQuery,
        recommendationsQuery,
        courseRiskQuery,
        reportingService.getCourseContentCompletenessReports(),
      ]);

      if (trainerUsersResult.error) {
        handleSupabaseError(trainerUsersResult.error);
        return [];
      }
      if (enrollmentsResult.error) {
        handleSupabaseError(enrollmentsResult.error);
        return [];
      }
      if (certificatesResult.error) {
        handleSupabaseError(certificatesResult.error);
        return [];
      }
      if (recommendationsResult.error) {
        handleSupabaseError(recommendationsResult.error);
        return [];
      }
      if (courseRiskResult.error) {
        handleSupabaseError(courseRiskResult.error);
        return [];
      }

      const enrollments = enrollmentsResult.data || [];
      const enrollmentIds = enrollments.map((enrollment) => enrollment.id);

      const [moduleCompletionsResult, moduleSessionsResult, assessmentAttemptsResult] = enrollmentIds.length > 0
        ? await Promise.all([
            (() => {
              let query = supabase
                .from("module_completions")
                .select("enrollment_id, time_spent, completed_at")
                .in("enrollment_id", enrollmentIds);
              if (startIso) {
                query = query.gte("completed_at", startIso);
              }
              if (endIso) {
                query = query.lte("completed_at", endIso);
              }
              return query;
            })(),
            (() => {
              let query = supabase
                .from("module_sessions")
                .select("enrollment_id, duration_seconds, started_at, last_seen_at")
                .in("enrollment_id", enrollmentIds);
              if (startIso) {
                query = query.gte("started_at", startIso);
              }
              if (endIso) {
                query = query.lte("started_at", endIso);
              }
              return query;
            })(),
            (() => {
              let query = supabase
                .from("assessment_attempts")
                .select("enrollment_id, score, submitted_at")
                .in("enrollment_id", enrollmentIds)
                .not("score", "is", null);
              if (startIso) {
                query = query.gte("submitted_at", startIso);
              }
              if (endIso) {
                query = query.lte("submitted_at", endIso);
              }
              return query;
            })(),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
          ];

      if (moduleCompletionsResult.error) {
        handleSupabaseError(moduleCompletionsResult.error);
        return [];
      }
      if (moduleSessionsResult.error) {
        handleSupabaseError(moduleSessionsResult.error);
        return [];
      }
      if (assessmentAttemptsResult.error) {
        handleSupabaseError(assessmentAttemptsResult.error);
        return [];
      }

      const trainerMap = new Map((trainerUsersResult.data || []).map((trainer) => [trainer.id, trainer]));
      const coursesByTrainerId = new Map<string, Array<{ id: string; title: string }>>();
      managedCourses.forEach((course) => {
        const trainerId = course.instructor_id as string;
        const existing = coursesByTrainerId.get(trainerId) || [];
        existing.push({ id: course.id, title: course.title });
        coursesByTrainerId.set(trainerId, existing);
      });

      const trainerIdByCourseId = new Map(managedCourses.map((course) => [course.id, course.instructor_id as string]));
      const trainerIdByEnrollmentId = new Map(
        enrollments.map((enrollment) => [enrollment.id, trainerIdByCourseId.get(enrollment.course_id) || ""]),
      );

      const contentReportByCourseId = new Map(
        contentReports
          .filter((report) => trainerIdByCourseId.has(report.courseId))
          .map((report) => [report.courseId, report]),
      );

      const latestRiskByCourseId = new Map<string, (typeof courseRiskResult.data extends Array<infer T> ? T : never)>();
      (courseRiskResult.data || []).forEach((row) => {
        if (!latestRiskByCourseId.has(row.course_id)) {
          latestRiskByCourseId.set(row.course_id, row);
        }
      });

      const totalCompletionMinutesByTrainerId = new Map<string, number>();
      const totalSessionMinutesByTrainerId = new Map<string, number>();
      const activeLearnersByTrainerId = new Map<string, Set<string>>();
      const assessmentStatsByTrainerId = new Map<string, { totalScore: number; count: number }>();

      (moduleCompletionsResult.data || []).forEach((completion) => {
        const trainerId = trainerIdByEnrollmentId.get(completion.enrollment_id);
        if (!trainerId) return;
        totalCompletionMinutesByTrainerId.set(
          trainerId,
          (totalCompletionMinutesByTrainerId.get(trainerId) || 0) + Number(completion.time_spent || 0),
        );
      });

      (moduleSessionsResult.data || []).forEach((session) => {
        const trainerId = trainerIdByEnrollmentId.get(session.enrollment_id);
        if (!trainerId) return;
        totalSessionMinutesByTrainerId.set(
          trainerId,
          (totalSessionMinutesByTrainerId.get(trainerId) || 0) + Math.round(Number(session.duration_seconds || 0) / 60),
        );
      });

      const enrollmentUserIdById = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment.user_id]));

      (moduleSessionsResult.data || []).forEach((session) => {
        const trainerId = trainerIdByEnrollmentId.get(session.enrollment_id);
        const learnerId = enrollmentUserIdById.get(session.enrollment_id);
        if (!trainerId || !learnerId) return;
        const existing = activeLearnersByTrainerId.get(trainerId) || new Set<string>();
        existing.add(learnerId);
        activeLearnersByTrainerId.set(trainerId, existing);
      });

      (moduleCompletionsResult.data || []).forEach((completion) => {
        const trainerId = trainerIdByEnrollmentId.get(completion.enrollment_id);
        const learnerId = enrollmentUserIdById.get(completion.enrollment_id);
        if (!trainerId || !learnerId) return;
        const existing = activeLearnersByTrainerId.get(trainerId) || new Set<string>();
        existing.add(learnerId);
        activeLearnersByTrainerId.set(trainerId, existing);
      });

      (assessmentAttemptsResult.data || []).forEach((attempt) => {
        const trainerId = trainerIdByEnrollmentId.get(attempt.enrollment_id);
        if (!trainerId) return;
        const existing = assessmentStatsByTrainerId.get(trainerId) || { totalScore: 0, count: 0 };
        existing.totalScore += Number(attempt.score || 0);
        existing.count += 1;
        assessmentStatsByTrainerId.set(trainerId, existing);
      });

      return Array.from(coursesByTrainerId.entries())
        .map(([trainerId, trainerCourses]) => {
          const trainer = trainerMap.get(trainerId);
          const trainerCourseIds = trainerCourses.map((course) => course.id);
          const trainerEnrollments = enrollments.filter((enrollment) => trainerCourseIds.includes(enrollment.course_id));
          const uniqueLearnerIds = new Set(trainerEnrollments.map((enrollment) => enrollment.user_id));
          const completedEnrollments = trainerEnrollments.filter((enrollment) => enrollment.status === "completed").length;
          const completionRate = trainerEnrollments.length > 0
            ? Math.round((completedEnrollments / trainerEnrollments.length) * 100)
            : 0;

          const assessmentStats = assessmentStatsByTrainerId.get(trainerId);
          const averageAssessmentScore = assessmentStats && assessmentStats.count > 0
            ? Math.round((assessmentStats.totalScore / assessmentStats.count) * 10) / 10
            : null;

          const engagedLearners = activeLearnersByTrainerId.get(trainerId)?.size || 0;
          const learnerEngagementRate = uniqueLearnerIds.size > 0
            ? Math.round((engagedLearners / uniqueLearnerIds.size) * 100)
            : 0;

          const latestRiskRows = trainerCourseIds
            .map((courseId) => latestRiskByCourseId.get(courseId))
            .filter(Boolean);
          const atRiskCourses = latestRiskRows.filter((row) => row && (row.risk_level === "medium" || row.risk_level === "high")).length;
          const atRiskRate = latestRiskRows.length > 0
            ? Math.round((atRiskCourses / latestRiskRows.length) * 100)
            : 0;

          const trainerRecommendationRows = (recommendationsResult.data || []).filter((row) => trainerCourseIds.includes(row.course_id));
          const recommendationImpressions = trainerRecommendationRows.reduce((sum, row) => sum + Number(row.impression_count || 0), 0);
          const recommendationEnrollments = trainerRecommendationRows.reduce((sum, row) => sum + Number(row.enrollment_count || 0), 0);
          const recommendationConversionRate = recommendationImpressions > 0
            ? Math.round((recommendationEnrollments / recommendationImpressions) * 100)
            : 0;

          const trainerContentReports = trainerCourseIds
            .map((courseId) => contentReportByCourseId.get(courseId))
            .filter(Boolean);
          const contentQualityRate = trainerContentReports.length > 0
            ? Math.round(
                trainerContentReports.reduce((sum, report) => sum + (report?.completenessRate || 0), 0) /
                trainerContentReports.length,
              )
            : 0;

          const completionScore = clampNumber(completionRate, 0, 100);
          const assessmentScore = clampNumber(averageAssessmentScore ?? 0, 0, 100);
          const engagementScore = clampNumber(learnerEngagementRate, 0, 100);
          const riskManagementScore = clampNumber(100 - atRiskRate, 0, 100);
          const recommendationScore = clampNumber(recommendationConversionRate, 0, 100);
          const contentScore = clampNumber(contentQualityRate, 0, 100);

          const factorScores = {
            completionRate: {
              rawScore: completionScore,
              weightedScore: Math.round(completionScore * STAFF_PERFORMANCE_WEIGHTS.completionRate) / 100,
              weight: STAFF_PERFORMANCE_WEIGHTS.completionRate,
              explanation: `${completedEnrollments} of ${trainerEnrollments.length} managed enrollments completed successfully.`,
            },
            assessmentQuality: {
              rawScore: assessmentScore,
              weightedScore: Math.round(assessmentScore * STAFF_PERFORMANCE_WEIGHTS.assessmentQuality) / 100,
              weight: STAFF_PERFORMANCE_WEIGHTS.assessmentQuality,
              explanation: averageAssessmentScore !== null
                ? `Learners averaged ${averageAssessmentScore}% across submitted assessments.`
                : "No scored assessments were recorded in the selected period.",
            },
            learnerEngagement: {
              rawScore: engagementScore,
              weightedScore: Math.round(engagementScore * STAFF_PERFORMANCE_WEIGHTS.learnerEngagement) / 100,
              weight: STAFF_PERFORMANCE_WEIGHTS.learnerEngagement,
              explanation: `${engagedLearners} of ${uniqueLearnerIds.size} learners showed module activity in the selected period.`,
            },
            riskManagement: {
              rawScore: riskManagementScore,
              weightedScore: Math.round(riskManagementScore * STAFF_PERFORMANCE_WEIGHTS.riskManagement) / 100,
              weight: STAFF_PERFORMANCE_WEIGHTS.riskManagement,
              explanation: latestRiskRows.length > 0
                ? `${atRiskCourses} of ${latestRiskRows.length} managed courses are currently flagged medium or high risk.`
                : "No predictive course-risk snapshots were available for the selected period.",
            },
            recommendationConversion: {
              rawScore: recommendationScore,
              weightedScore: Math.round(recommendationScore * STAFF_PERFORMANCE_WEIGHTS.recommendationConversion) / 100,
              weight: STAFF_PERFORMANCE_WEIGHTS.recommendationConversion,
              explanation: recommendationImpressions > 0
                ? `${recommendationEnrollments} recommendation-attributed enrollments were generated from ${recommendationImpressions} impressions.`
                : "No recommendation impressions were logged for managed courses in the selected period.",
            },
            contentQuality: {
              rawScore: contentScore,
              weightedScore: Math.round(contentScore * STAFF_PERFORMANCE_WEIGHTS.contentQuality) / 100,
              weight: STAFF_PERFORMANCE_WEIGHTS.contentQuality,
              explanation: trainerContentReports.length > 0
                ? `${trainerContentReports.filter((report) => report?.readyToPublish).length} of ${trainerContentReports.length} managed courses currently meet the publish-ready checklist.`
                : "No content completeness audits were available for managed courses.",
            },
          } satisfies StaffPerformanceScorecard["factorScores"];

          const compositeScore = Math.round(
            factorScores.completionRate.weightedScore +
            factorScores.assessmentQuality.weightedScore +
            factorScores.learnerEngagement.weightedScore +
            factorScores.riskManagement.weightedScore +
            factorScores.recommendationConversion.weightedScore +
            factorScores.contentQuality.weightedScore,
          );

          const certificatesIssued = (certificatesResult.data || []).filter((certificate) => trainerCourseIds.includes(certificate.course_id)).length;
          const publishReadyCourses = trainerContentReports.filter((report) => report?.readyToPublish).length;
          const totalLearningMinutes = Math.max(
            totalCompletionMinutesByTrainerId.get(trainerId) || 0,
            totalSessionMinutesByTrainerId.get(trainerId) || 0,
          );
          const averageLearningHoursPerLearner = uniqueLearnerIds.size > 0
            ? Math.round(((totalLearningMinutes / uniqueLearnerIds.size) / 60) * 10) / 10
            : 0;

          const notes: string[] = [];
          if (averageAssessmentScore === null) {
            notes.push("Assessment-quality scoring is informationally incomplete because there were no scored attempts in the selected period.");
          }
          if (recommendationImpressions === 0) {
            notes.push("Recommendation conversion stayed informational only because managed courses had no logged recommendation impressions in the selected period.");
          }
          if (publishReadyCourses < trainerCourseIds.length) {
            notes.push(`${trainerCourseIds.length - publishReadyCourses} managed course${trainerCourseIds.length - publishReadyCourses === 1 ? " is" : "s are"} still below the publish-ready content checklist.`);
          }
          if (atRiskCourses > 0) {
            notes.push(`${atRiskCourses} managed course${atRiskCourses === 1 ? " remains" : "s remain"} in a medium or high predictive risk state.`);
          }

          return {
            staffId: trainerId,
            staffName: trainer?.name || "Unknown Trainer",
            staffEmail: trainer?.email || "No email on file",
            role: "trainer",
            managedCourseIds: trainerCourseIds,
            managedCourseTitles: trainerCourses.map((course) => course.title),
            generatedAt: new Date().toISOString(),
            compositeScore,
            evaluationBand:
              compositeScore >= 85
                ? "exemplary"
                : compositeScore >= 70
                  ? "strong"
                  : compositeScore >= 55
                    ? "watch"
                    : "intervention",
            courseOutcomeMetrics: {
              completionRate,
              averageAssessmentScore,
              learnerEngagementRate,
              atRiskRate,
              recommendationConversionRate,
              contentQualityRate,
            },
            factorScores,
            informationalMetrics: {
              managedCourses: trainerCourseIds.length,
              activeLearners: engagedLearners,
              totalEnrollments: trainerEnrollments.length,
              certificatesIssued,
              averageLearningHoursPerLearner,
              publishReadyCourses,
            },
            notes,
          } satisfies StaffPerformanceScorecard;
        })
        .sort((left, right) => {
          if (right.compositeScore !== left.compositeScore) {
            return right.compositeScore - left.compositeScore;
          }
          return left.staffName.localeCompare(right.staffName);
        });
    } catch (error) {
      console.error("Error getting staff performance scorecards:", error);
      return [];
    }
  },

  getLearnerCourseLeaderboard: async (
    courseId: string,
    options?: { limit?: number; includeIncomplete?: boolean },
  ): Promise<LearnerLeaderboard | null> => {
    if (!supabase) return null;

    const limit = options?.limit ?? 10;
    const includeIncompleteLearners = options?.includeIncomplete ?? true;

    try {
      const { data: courseRow, error: courseError } = await supabase
        .from("courses")
        .select("id, title, category, duration")
        .eq("id", courseId)
        .single();

      if (courseError) {
        handleSupabaseError(courseError);
        return null;
      }

      if (!courseRow) {
        return null;
      }

      return await buildLearnerLeaderboardFromCourses({
        scope: "course",
        scopeId: courseRow.id,
        scopeTitle: courseRow.title,
        scopeCategory: courseRow.category || "Uncategorized",
        courses: [{ id: courseRow.id, title: courseRow.title, category: courseRow.category, duration: courseRow.duration }],
        includeIncompleteLearners,
        limit,
      });
    } catch (error) {
      console.error("Error getting learner course leaderboard:", error);
      return null;
    }
  },

  getLearnerProgramLeaderboard: async (
    programId: string,
    options?: { limit?: number; includeIncomplete?: boolean },
  ): Promise<LearnerLeaderboard | null> => {
    if (!supabase) return null;

    const limit = options?.limit ?? 10;
    const includeIncompleteLearners = options?.includeIncomplete ?? true;

    try {
      const { data: programRow, error: programError } = await supabase
        .from("programs")
        .select("id, title, description, category")
        .eq("id", programId)
        .single();

      if (programError) {
        handleSupabaseError(programError);
        return null;
      }

      if (!programRow) {
        return null;
      }

      const { data: courseRows, error: courseRowsError } = await supabase
        .from("courses")
        .select("id, title, category, duration")
        .eq("program_id", programId)
        .order("created_at", { ascending: true });

      if (courseRowsError) {
        handleSupabaseError(courseRowsError);
        return null;
      }

      return await buildLearnerLeaderboardFromCourses({
        scope: "program",
        scopeId: programRow.id,
        scopeTitle: programRow.title,
        scopeCategory: programRow.category || "Mixed Program",
        courses: (courseRows || []) as Array<{ id: string; title: string; category: string | null; duration: number | null }>,
        includeIncompleteLearners,
        limit,
      });
    } catch (error) {
      console.error("Error getting learner program leaderboard:", error);
      return null;
    }
  },

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
          .select("id, title, category, skills, skill_tags, topic_tags")
          .in("id", courseIds),
        supabase
          .from("modules")
          .select("id, course_id, title, skill_tags, topic_tags")
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

      let assessments: Array<{ id: string; title: string; module_id: string | null; course_id: string | null; skill_tags?: string[]; topic_tags?: string[] }> = [];
      if (assessmentIds.length > 0) {
        const { data: assessmentRows, error: assessmentsError } = await supabase
          .from("assessments")
          .select("id, title, module_id, course_id, skill_tags, topic_tags")
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

        const canonicalTopics = deriveTopicTags(course.category, (course as any).skill_tags || course.skills, (course as any).topic_tags || []);
        return canonicalTopics.length > 0 ? canonicalTopics : [canonicalizeCourseCategory(course.category) || course.category || "General Learning"];
      };

      const getTopicsForModule = (moduleId: string): string[] => {
        const module = moduleMap.get(moduleId) as ({ topic_tags?: string[]; skill_tags?: string[]; course_id?: string } & Record<string, any>) | undefined;
        if (!module) return [];
        const directTopics = deriveTopicTags(undefined, module.skill_tags || [], module.topic_tags || []);
        return directTopics.length > 0 ? directTopics : getTopicsForCourse(module.course_id);
      };

      const getTopicsForAssessment = (assessmentId: string): string[] => {
        const assessment = assessmentMap.get(assessmentId);
        if (!assessment) return [];
        const directTopics = deriveTopicTags(undefined, assessment.skill_tags || [], assessment.topic_tags || []);
        if (directTopics.length > 0) {
          return directTopics;
        }

        if (assessment.module_id) {
          const moduleTopics = getTopicsForModule(assessment.module_id);
          if (moduleTopics.length > 0) {
            return moduleTopics;
          }
        }

        return assessment.course_id ? getTopicsForCourse(assessment.course_id) : [];
      };

      const topicStats = new Map<string, {
        scoreSum: number;
        scoreCount: number;
        assessmentsTaken: number;
        modulesCompleted: number;
        totalTimeSpentMinutes: number;
      }>();

      const addTopicActivity = (
        topics: string[],
        activity: {
          score?: number | null;
          moduleCompleted?: boolean;
          timeSpentMinutes?: number;
          assessmentTaken?: boolean;
        }
      ) => {
        for (const topic of (normalizeTopicTags(topics).length > 0 ? normalizeTopicTags(topics) : ["General Learning"])) {
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

          if (module?.id) {
            addTopicActivity(getTopicsForModule(module.id), {
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

        const moduleId = moduleKey.split(":")[1];
        if (moduleId) {
          addTopicActivity(getTopicsForModule(moduleId), {
            timeSpentMinutes,
          });
        }
      }

      const recentAssessments = assessmentAttempts
        .map((attempt) => {
          const assessment = assessmentMap.get(attempt.assessment_id);
          const module = assessment?.module_id ? moduleMap.get(assessment.module_id) : null;
          const enrollment = enrollmentMap.get(attempt.enrollment_id);
          const courseId = module?.course_id || assessment?.course_id || enrollment?.course_id;
          const course = courseId ? courseMap.get(courseId) : null;
          const numericScore = attempt.score === null || attempt.score === undefined ? null : Number(attempt.score);
          const timeSpentMinutes = attempt.time_spent || 0;

          if (attempt.assessment_id) {
            addTopicActivity(getTopicsForAssessment(attempt.assessment_id), {
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
      void Promise.allSettled([
        supabase.rpc("refresh_phase1_analytics_rollups", { p_user_id: null }),
      ]).then((refreshResults) => {
        refreshResults.forEach((result) => {
          if (result.status === "fulfilled" && result.value.error) {
            console.warn("Failed to refresh phase1 analytics rollups:", result.value.error);
          }
          if (result.status === "rejected") {
            console.warn("Failed to refresh phase1 analytics rollups:", result.reason);
          }
        });
      });

      // The predictive-score refresh RPC is currently blocked by a backend enum mismatch.
      // Skip invoking it from the UI until the Supabase function is repaired server-side.

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

      const [courseRiskResult, learnerDisengagementResult, recommendationRowsResult] = await Promise.all([
        supabase
          .from("course_risk_scores")
          .select("course_id, snapshot_date, active_enrollments, completion_rate, recommendation_acceptance_rate, risk_score, risk_level")
          .order("snapshot_date", { ascending: false }),
        supabase
          .from("learner_disengagement_scores")
          .select("user_id, snapshot_date, incomplete_enrollments, repeated_short_session_count, inactive_days, disengagement_score, risk_level")
          .order("snapshot_date", { ascending: false }),
        supabase
          .from("learner_recommendations")
          .select("course_id, impression_count, click_count, accept_count, enrollment_count, completion_count, acceptance_probability"),
      ]);

      const courseRiskRows = courseRiskResult.error ? [] : (courseRiskResult.data || []);
      const learnerDisengagementRows = learnerDisengagementResult.error ? [] : (learnerDisengagementResult.data || []);
      const recommendationRows = recommendationRowsResult.error ? [] : (recommendationRowsResult.data || []);

      if (courseRiskResult.error) {
        console.warn("Failed to load course risk scores for admin analytics:", courseRiskResult.error);
      }

      if (learnerDisengagementResult.error) {
        console.warn("Failed to load learner disengagement scores for admin analytics:", learnerDisengagementResult.error);
      }

      if (recommendationRowsResult.error) {
        console.warn("Failed to load recommendation acceptance analytics for admin dashboard:", recommendationRowsResult.error);
      }

      const latestCourseRiskByCourseId = new Map<string, (typeof courseRiskRows)[number]>();
      for (const row of courseRiskRows) {
        if (!latestCourseRiskByCourseId.has(row.course_id)) {
          latestCourseRiskByCourseId.set(row.course_id, row);
        }
      }

      const riskCourseInsights = Array.from(latestCourseRiskByCourseId.values())
        .map((row) => ({
          courseId: row.course_id,
          courseTitle: courseTitleMap.get(row.course_id) || "Unknown Course",
          activeEnrollments: Number(row.active_enrollments || 0),
          completionRate: Number(row.completion_rate || 0),
          recommendationAcceptanceRate: Number(row.recommendation_acceptance_rate || 0),
          riskScore: Number(row.risk_score || 0),
          riskLevel: (row.risk_level || "low") as "low" | "medium" | "high",
        }))
        .sort((left, right) => {
          const severityRank = { high: 2, medium: 1, low: 0 };
          if (severityRank[right.riskLevel] !== severityRank[left.riskLevel]) {
            return severityRank[right.riskLevel] - severityRank[left.riskLevel];
          }
          return right.riskScore - left.riskScore;
        })
        .slice(0, 5);

      const latestDisengagementByUserId = new Map<string, (typeof learnerDisengagementRows)[number]>();
      for (const row of learnerDisengagementRows) {
        if (!latestDisengagementByUserId.has(row.user_id)) {
          latestDisengagementByUserId.set(row.user_id, row);
        }
      }

      const riskyLearners = Array.from(latestDisengagementByUserId.values())
        .sort((left, right) => Number(right.disengagement_score || 0) - Number(left.disengagement_score || 0))
        .slice(0, 6);
      const riskyLearnerIds = riskyLearners.map((row) => row.user_id);
      const learnerDirectory = new Map<string, { name: string | null; email: string | null }>();

      if (riskyLearnerIds.length > 0) {
        const { data: learnerRows, error: learnerRowsError } = await supabase
          .from("users")
          .select("id, name, email")
          .in("id", riskyLearnerIds);

        if (learnerRowsError) {
          console.warn("Failed to hydrate disengagement learner names for admin dashboard:", learnerRowsError);
        } else {
          (learnerRows || []).forEach((learner) => {
            learnerDirectory.set(learner.id, {
              name: learner.name || null,
              email: learner.email || null,
            });
          });
        }
      }

      const disengagementInsights = riskyLearners.map((row) => ({
        userId: row.user_id,
        userName: learnerDirectory.get(row.user_id)?.name || null,
        userEmail: learnerDirectory.get(row.user_id)?.email || null,
        incompleteEnrollments: Number(row.incomplete_enrollments || 0),
        repeatedShortSessionCount: Number(row.repeated_short_session_count || 0),
        inactiveDays: Number(row.inactive_days || 0),
        disengagementScore: Number(row.disengagement_score || 0),
        riskLevel: (row.risk_level || "low") as "low" | "medium" | "high",
      }));

      const recommendationAnalytics = buildRecommendationAnalytics(
        recommendationRows as RecommendationAnalyticsRow[],
        (courseId) => courseTitleMap.get(courseId) || "Unknown Course",
      );

      const predictiveOverview = {
        highRiskCourses: Array.from(latestCourseRiskByCourseId.values()).filter((row) => row.risk_level === "high").length,
        mediumRiskCourses: Array.from(latestCourseRiskByCourseId.values()).filter((row) => row.risk_level === "medium").length,
        highRiskLearners: Array.from(latestDisengagementByUserId.values()).filter((row) => row.risk_level === "high").length,
        mediumRiskLearners: Array.from(latestDisengagementByUserId.values()).filter((row) => row.risk_level === "medium").length,
        averageCourseRiskScore:
          latestCourseRiskByCourseId.size > 0
            ? Number((Array.from(latestCourseRiskByCourseId.values()).reduce((sum, row) => sum + Number(row.risk_score || 0), 0) / latestCourseRiskByCourseId.size).toFixed(1))
            : 0,
        averageDisengagementScore:
          latestDisengagementByUserId.size > 0
            ? Number((Array.from(latestDisengagementByUserId.values()).reduce((sum, row) => sum + Number(row.disengagement_score || 0), 0) / latestDisengagementByUserId.size).toFixed(1))
            : 0,
        averageAcceptanceProbability: recommendationAnalytics.averageAcceptanceProbability,
      };

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
        predictiveOverview,
        riskCourseInsights,
        disengagementInsights,
        recommendationAnalytics,
      };
    } catch (error) {
      console.error("Error getting admin dashboard analytics:", error);
      return null;
    }
  },

  /**
   * Get trainer-scoped analytics across all manageable courses and learners.
   */
  getTrainerDashboardAnalytics: async (user: User | null): Promise<TrainerDashboardAnalytics | null> => {
    if (!supabase || !user) return null;

    try {
      const { data: courseRows, error: coursesError } = await supabase
        .from("courses")
        .select("id, title, category, level, instructor_id")
        .order("created_at", { ascending: false });

      if (coursesError) {
        handleSupabaseError(coursesError);
        return null;
      }

      const visibleCourses = courseRows || [];
      const showingAllCoursesFallback = false;
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
          atRiskSignals: {
            stalledProgress: 0,
            repeatedShortSessions: 0,
            inactiveIncomplete: 0,
            problematicSessionStatus: 0,
          },
          monthlyTrends: [],
          courseInsights: [],
          moduleInsights: [],
          recommendationAnalytics: {
            totalRecommendationsDelivered: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalAccepts: 0,
            totalRecommendationEnrollments: 0,
            totalRecommendationCompletions: 0,
            averageCtr: 0,
            averageAcceptRate: 0,
            recommendedEnrollmentCompletionRate: 0,
            topRecommendedCourses: [],
            mostAcceptedCourses: [],
          },
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

      const enrollments = await loadTrainerVisibleEnrollments(courseIds);
      const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
      const learnerIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.user_id)));

      const [certificatesData, modulesResult, moduleCompletionsResult, trainerSessions, assessmentAttemptsData, recommendationRowsResult] = await Promise.all([
        loadTrainerVisibleCertificates(courseIds),
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
          ? moduleSessionService.getTrainerAccessibleSessions({ limit: Math.max(enrollmentIds.length * 8, 500) })
          : Promise.resolve([]),
        loadTrainerVisibleAssessmentAttempts(courseIds, enrollmentIds),
        supabase
          .from("learner_recommendations")
          .select("id, course_id, source_surface, impression_count, click_count, accept_count, enrollment_count, completion_count")
          .in("course_id", courseIds),
      ]);

      if (modulesResult.error) {
        handleSupabaseError(modulesResult.error);
        return null;
      }

      if (moduleCompletionsResult.error) {
        handleSupabaseError(moduleCompletionsResult.error);
        return null;
      }

      if (recommendationRowsResult.error) {
        handleSupabaseError(recommendationRowsResult.error);
        return null;
      }

      const assessmentAttempts = assessmentAttemptsData || [];
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

      const certificates = certificatesData || [];
      const modules = modulesResult.data || [];
      const moduleCompletions = moduleCompletionsResult.data || [];
      const moduleSessions = trainerSessions
        .filter((session) => enrollmentIds.includes(session.enrollmentId))
        .map((session) => ({
          enrollment_id: session.enrollmentId,
          module_id: session.moduleId,
          duration_seconds: session.durationSeconds,
          started_at: session.startedAt,
          last_seen_at: session.lastSeenAt,
          session_status: session.sessionStatus,
        }));
      const recommendationRows = recommendationRowsResult.data || [];
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
      const atRiskSignals = {
        stalledProgress: 0,
        repeatedShortSessions: 0,
        inactiveIncomplete: 0,
        problematicSessionStatus: 0,
      };
      const enrollmentSessionStats = new Map<string, {
        totalSessions: number;
        shortSessions: number;
        problematicStatuses: number;
        lastSeenAt: string | null;
      }>();

      for (const session of moduleSessions) {
        const sessionMinutes = Number(session.duration_seconds || 0) / 60;
        const current = enrollmentSessionStats.get(session.enrollment_id) || {
          totalSessions: 0,
          shortSessions: 0,
          problematicStatuses: 0,
          lastSeenAt: null,
        };
        current.totalSessions += 1;
        if (sessionMinutes > 0 && sessionMinutes <= SHORT_SESSION_SECONDS / 60) {
          current.shortSessions += 1;
        }
        const sessionStatus = (session as { session_status?: string | null }).session_status || null;
        if (sessionStatus === "abandoned" || sessionStatus === "timed_out") {
          current.problematicStatuses += 1;
        }
        const lastSeenAt = (session as { last_seen_at?: string | null }).last_seen_at || session.started_at || null;
        if (!current.lastSeenAt || (lastSeenAt && lastSeenAt > current.lastSeenAt)) {
          current.lastSeenAt = lastSeenAt;
        }
        enrollmentSessionStats.set(session.enrollment_id, current);
      }

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

        if (isEnrollmentCompleted(enrollment.status)) {
          stats.completed += 1;
          cohortSegments.completed += 1;
        } else if (progress <= 0 || enrollment.status === "enrolled") {
          cohortSegments.notStarted += 1;
        } else {
          cohortSegments.inProgress += 1;
        }

        const enrolledDate = new Date(enrollment.enrolled_at);
        const sessionStats = enrollmentSessionStats.get(enrollment.id);
        const lastSeenDate = sessionStats?.lastSeenAt ? new Date(sessionStats.lastSeenAt) : null;
        const repeatedShortSessionPattern = (sessionStats?.shortSessions || 0) >= 2;
        const problematicSessionPattern = (sessionStats?.problematicStatuses || 0) >= 2;
        const inactiveIncomplete =
          progress > 0 &&
          progress < 100 &&
          Boolean(lastSeenDate && !Number.isNaN(lastSeenDate.getTime()) && differenceInDays(now, lastSeenDate) >= 10);
        const stalledProgress =
          !Number.isNaN(enrolledDate.getTime()) &&
          differenceInDays(now, enrolledDate) >= 14 &&
          progress < 30 &&
          enrollment.status !== "completed";

        if (enrollment.status !== "completed" && (stalledProgress || repeatedShortSessionPattern || inactiveIncomplete || problematicSessionPattern)) {
          cohortSegments.atRisk += 1;
          if (stalledProgress) atRiskSignals.stalledProgress += 1;
          if (repeatedShortSessionPattern) atRiskSignals.repeatedShortSessions += 1;
          if (inactiveIncomplete) atRiskSignals.inactiveIncomplete += 1;
          if (problematicSessionPattern) atRiskSignals.problematicSessionStatus += 1;
        }

        const enrolledMonthKey = getMonthKey(enrollment.enrolled_at);
        if (enrolledMonthKey && trendMap.has(enrolledMonthKey)) {
          trendMap.get(enrolledMonthKey)!.newEnrollments += 1;
        }

        const completedMonthKey = getMonthKey(enrollment.completed_at);
        if (isEnrollmentCompleted(enrollment.status) && completedMonthKey && trendMap.has(completedMonthKey)) {
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

        const score = attempt.score === null || attempt.score === undefined ? null : Number(attempt.score);
        const hasNumericScore = score !== null && !Number.isNaN(score);

        if (hasNumericScore) {
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
        if (hasNumericScore) {
          moduleStatsRow.scoreSum += score;
          moduleStatsRow.scoreCount += 1;
        }
        if (attempt.passed === false || (hasNumericScore && score < 75)) {
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
            stats.scoreCount > 0 && averageAssessmentScore < 70,
            failureRate >= 35,
            averageLearningMinutes >= 45,
            completionRate > 0 && completionRate < 45,
          ];
          const issueCount = issueFlags.filter(Boolean).length;
          const attentionLevel = issueCount >= 2 ? "critical" : issueCount === 1 ? "watch" : "healthy";

          let insight = "Healthy completion and assessment patterns";
          if (stats.scoreCount > 0 && averageAssessmentScore < 70) {
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
        (enrollment) => isEnrollmentCompleted(enrollment.status),
      ).length;
      const scoredAttempts = assessmentAttempts
        .map((attempt) => (attempt.score === null || attempt.score === undefined ? null : Number(attempt.score)))
        .filter((score): score is number => score !== null && !Number.isNaN(score));
      const totalLearningHours = Array.from(courseStats.values()).reduce((sum, stats) => sum + stats.sessionMinutes, 0) / 60;
      const averageLearningHoursPerCourse = visibleCourses.length > 0 ? Number((totalLearningHours / visibleCourses.length).toFixed(1)) : 0;
      const recommendationAnalytics = buildRecommendationAnalytics(
        recommendationRows as RecommendationAnalyticsRow[],
        (courseId) => courseMap.get(courseId)?.title || "Untitled course",
      );

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
        atRiskSignals,
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
        recommendationAnalytics,
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
          course_id,
          certificate_type,
          issued_at,
          verification_code,
          users:user_id (name),
          courses:course_id (title)
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
        courseTitle: cert.courses?.title || "Unknown Course",
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

