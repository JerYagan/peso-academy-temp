import { supabase, handleSupabaseError } from "@/lib/supabase";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, differenceInDays } from "date-fns";
import type { User } from "@/types/auth";
import type { Course, Enrollment } from "@/types";

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
}

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

export const buildLearnerCourseRecommendations = (
  user: User | null,
  courses: Course[],
  enrollments: Enrollment[],
  performanceSummary?: LearnerPerformanceSummary | null,
  limit = 3,
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
  const learnerSkills = new Set((user.skills || []).map((skill) => skill.toLowerCase()));
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

  const levelRank: Record<Course["level"], number> = {
    Beginner: 1,
    Intermediate: 2,
    Advanced: 3,
  };

  return courses
    .filter((course) => !enrolledCourseIds.has(course.id) && course.published !== false)
    .map((course) => {
      let score = 0;
      const reasons: string[] = [];
      const normalizedCategory = course.category.toLowerCase();
      const courseSkills = (course.skills || []).map((skill) => skill.toLowerCase());
      const skillOverlap = courseSkills.filter((skill) => learnerSkills.has(skill)).length;

      if (skillOverlap > 0) {
        score += skillOverlap * 22;
        reasons.push(`Matches ${skillOverlap} of your profile skills`);
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
        reasons.push("Popular among PESO Academy trainees");
      }

      if (course.isTESDAAccredited) {
        score += 4;
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

        if (needsFoundationalSupport && course.level === "Beginner") {
          score += 9;
          reasons.push("Provides a lower-risk step while you build confidence");
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

      const [coursesResult, modulesResult, moduleCompletionsResult, assessmentAttemptsResult] = await Promise.all([
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

      if (assessmentAttemptsResult.error) {
        handleSupabaseError(assessmentAttemptsResult.error);
        return null;
      }

      const courses = coursesResult.data || [];
      const modules = modulesResult.data || [];
      const moduleCompletions = moduleCompletionsResult.data || [];
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
          const timeSpentMinutes = completion.time_spent || 0;

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
      const totalModuleMinutes = moduleCompletions.reduce((sum, completion) => sum + (completion.time_spent || 0), 0);
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
          timeSpentMinutes: 0,
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
          .from("assessment_attempts")
          .select("enrollment_id, score, submitted_at")
          .not("score", "is", null)
          .gte("submitted_at", trendStart.toISOString()),
        supabase.from("certificates").select("id", { count: "exact", head: true }),
        supabase.from("module_completions").select("time_spent"),
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

      let totalLearningMinutes = 0;
      for (const completion of moduleCompletions) {
        const minutes = completion.time_spent || 0;
        totalLearningMinutes += minutes;

        const enrollment = enrollmentMap.get(completion.enrollment_id);
        const monthKey = getMonthKey(completion.completed_at || undefined);
        if (monthKey && trendMap.has(monthKey)) {
          const trendPoint = trendMap.get(monthKey)!;
          trendPoint.timeSpentMinutes += minutes;
          if (enrollment?.user_id) {
            trendPoint.activeLearnerIds.add(enrollment.user_id);
          }
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
        timeSpentHours: Math.round((point.timeSpentMinutes / 60) * 10) / 10,
      }));

      const totalEnrollments = enrollments.length;
      const completedEnrollments = enrollments.filter(
        (enrollment) => enrollment.status === "completed" || (enrollment.progress || 0) === 100
      ).length;
      const progressValues = enrollments.map((enrollment) => enrollment.progress || 0);
      const scoredAttempts = totalAssessmentAttempts
        .map((attempt) => Number(attempt.score))
        .filter((score) => !Number.isNaN(score));
      const totalLearningMinutesAllTime = totalModuleCompletions.reduce(
        (sum, completion) => sum + (completion.time_spent || 0),
        0
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

