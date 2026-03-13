import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import TraineeOnboardingModal from "@/components/trainee/TraineeOnboardingModal";
import TraineeVerificationBadge from "@/components/trainee/TraineeVerificationBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Users, Award, TrendingUp, ArrowRight, Shield, FileText, FileSpreadsheet, Loader2, CheckCircle2, ArrowUpRight, ArrowDownRight, Brain, Clock3, Target, BarChart3, Sparkles, Eye, AlertCircle, ImageIcon } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import {
  enrollmentService,
  certificateService,
  courseService,
  getEnrollmentErrorFeedback,
  getTraineeEnrollmentVerificationFeedback,
  isTraineeEnrollmentBlocked,
} from "@/services/supabaseDatabaseService";
import { dataService } from "@/services/mockData"; // TODO: Replace with Supabase services for admin/training officer dashboards
import { useEffect, useMemo, useState } from "react";
import { Course, Enrollment } from "@/types";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User } from "@/types/auth";
import { formatDistanceToNow, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { buildAssessmentOnlyCourseRecommendations, buildLearnerCourseRecommendations, deriveAssessmentOnlyRecommendationEvidence, reportingService, type AssessmentOnlyRecommendationEvidence, type CollaborativeRecommendationSignal, type LearnerCourseRecommendation, type LearnerPerformanceSummary, type LearnerPerformanceTopicResult } from "@/services/reportingService";
import { analyticsService, type PersistedLearnerRecommendation } from "@/services/analyticsService";
import { moduleSessionService, type EnrichedModuleSession, type ModuleSessionAggregate } from "@/services/moduleSessionService";
import { getDashboardRoute } from "@/lib/roles";
import { getOfficialHoursCreditLabel } from "@/lib/courseDuration";
import { TRAINEE_ONBOARDING_MODAL_PENDING_KEY, type TraineeOnboardingSummary } from "@/lib/onboarding";

interface TraineeDashboardProps {
  user: User;
  stats: {
    enrolledCourses: number;
    completedCourses: number;
    certificates: number;
  };
}

const TraineeDashboard = ({ user, stats }: TraineeDashboardProps) => {
  const { updateUser } = useAuth();
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [completedCourses, setCompletedCourses] = useState<Array<Course & { enrollment: Enrollment }>>([]);
  const [myCourses, setMyCourses] = useState<Array<Course & { enrollment: Enrollment }>>([]);
  const [allEnrollments, setAllEnrollments] = useState<Enrollment[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState<LearnerPerformanceSummary | null>(null);
  const [persistedRecommendations, setPersistedRecommendations] = useState<PersistedLearnerRecommendation[]>([]);
  const [persistedAssessmentOnlyRecommendations, setPersistedAssessmentOnlyRecommendations] = useState<PersistedLearnerRecommendation[]>([]);
  const [lastAccessedModule, setLastAccessedModule] = useState<EnrichedModuleSession | null>(null);
  const [sessionAggregates, setSessionAggregates] = useState<ModuleSessionAggregate[]>([]);
  const [collaborativeSignals, setCollaborativeSignals] = useState<Record<string, CollaborativeRecommendationSignal>>({});
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingPerformance, setLoadingPerformance] = useState(true);
  const [loadingSessionHistory, setLoadingSessionHistory] = useState(true);
  const [enrollingRecommendationCourseId, setEnrollingRecommendationCourseId] = useState<string | null>(null);
  const [recommendationRecovery, setRecommendationRecovery] = useState<{
    courseId: string;
    courseTitle: string;
    feedback: ReturnType<typeof getEnrollmentErrorFeedback>;
  } | null>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [savingOnboardingModal, setSavingOnboardingModal] = useState(false);
  const [latestOnboardingSummary, setLatestOnboardingSummary] = useState<TraineeOnboardingSummary | null>(null);
  const hasCompletedOnboarding = Boolean(user.onboardingCompletedAt);

  useEffect(() => {
    void loadDashboardData();
  }, [user]);

  useEffect(() => {
    const onFocus = () => {
      void loadDashboardData();
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user]);

  useEffect(() => {
    if (user.role !== "trainee" || hasCompletedOnboarding) {
      setShowOnboardingModal(false);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const hasPendingModalFlag = window.sessionStorage.getItem(TRAINEE_ONBOARDING_MODAL_PENDING_KEY) === "1";
    if (!user.onboardingModalSeenAt || hasPendingModalFlag) {
      setShowOnboardingModal(true);
    }
  }, [hasCompletedOnboarding, user.onboardingModalSeenAt, user.role]);

  const handleDismissOnboardingModal = async () => {
    if (savingOnboardingModal) {
      return;
    }

    setShowOnboardingModal(false);

    if (user.onboardingModalSeenAt) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(TRAINEE_ONBOARDING_MODAL_PENDING_KEY);
      }
      return;
    }

    try {
      setSavingOnboardingModal(true);
      await updateUser({ onboardingModalSeenAt: new Date().toISOString() });
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(TRAINEE_ONBOARDING_MODAL_PENDING_KEY);
      }
    } catch (error) {
      console.error("Failed to persist trainee onboarding modal state:", error);
      toast.error("We could not save your onboarding modal state. It may appear again until that save succeeds.");
    } finally {
      setSavingOnboardingModal(false);
    }
  };

  const handleOnboardingCompleted = async (summary: TraineeOnboardingSummary) => {
    setLatestOnboardingSummary(summary);
    setShowOnboardingModal(false);
    await loadDashboardData();
  };

  const loadDashboardData = async () => {
    if (!user) return;

    setLoadingCourses(true);
    setLoadingPerformance(true);
    setLoadingSessionHistory(true);

    const courseLoad = (async () => {
      try {
        const [enrollments, allCourses] = await Promise.all([
          enrollmentService.getEnrollments(user.id),
          courseService.getCourses(),
        ]);

        const coursesWithEnrollments = enrollments
          .map((enrollment) => {
            const course = allCourses.find((candidate) => candidate.id === enrollment.courseId);
            return course ? { ...course, enrollment } : null;
          })
          .filter((course): course is Course & { enrollment: Enrollment } => course !== null);

        const completed = coursesWithEnrollments.filter((course) => course.enrollment.status === "completed");
        const inProgress = coursesWithEnrollments.filter((course) => course.enrollment.status !== "completed").slice(0, 3);

        setAllCourses(allCourses);
        setAllEnrollments(enrollments);
        setCompletedCourses(completed);
        setMyCourses(inProgress);
      } catch (error) {
        console.error("Error loading trainee courses:", error);
        toast.error("Failed to load your course dashboard");
      } finally {
        setLoadingCourses(false);
      }
    })();

    const performanceLoad = (async () => {
      try {
        const [summary, collaborative] = await Promise.all([
          reportingService.getLearnerPerformanceSummary(user.id),
          reportingService.getCollaborativeRecommendationSignals(user.id),
        ]);
        setPerformanceSummary(summary);
        setCollaborativeSignals(collaborative);
      } catch (error) {
        console.error("Error loading learner performance summary:", error);
        toast.error("Failed to load learner performance summary");
      } finally {
        setLoadingPerformance(false);
      }
    })();

    const sessionHistoryLoad = (async () => {
      try {
        const [session, aggregates] = await Promise.all([
          moduleSessionService.getLastAccessedModuleCard(user.id),
          moduleSessionService.getSessionAggregatesByModule(user.id),
        ]);
        setLastAccessedModule(session);
        setSessionAggregates(aggregates);
      } catch (error) {
        console.error("Error loading trainee session history:", error);
      } finally {
        setLoadingSessionHistory(false);
      }
    })();

    await Promise.allSettled([courseLoad, performanceLoad, sessionHistoryLoad]);
  };

  const formatLearningTime = (minutes: number) => {
    if (minutes <= 0) return "0m";
    if (minutes < 60) return `${minutes}m`;

    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
  };

  const formatActivityTime = (value: string | null) => {
    if (!value) return "No recent activity";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No recent activity";

    return formatDistanceToNow(date, { addSuffix: true });
  };

  const formatSessionDuration = (seconds: number) => {
    if (seconds <= 0) return "0m";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours === 0) {
      return `${Math.max(1, minutes)}m`;
    }

    if (minutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${minutes}m`;
  };

  const formatSessionStatus = (status: EnrichedModuleSession["sessionStatus"]) => {
    switch (status) {
      case "completed":
        return "Completed";
      case "timed_out":
        return "Timed out";
      case "abandoned":
        return "Left mid-session";
      default:
        return "In progress";
    }
  };

  const handleRecommendationEnroll = async (
    course: Course,
    recommendation?: PersistedLearnerRecommendation,
  ) => {
    setEnrollingRecommendationCourseId(course.id);
    setRecommendationRecovery(null);

    try {
      await enrollmentService.enrollInCourse(
        user.id,
        course.id,
        analyticsService.getOriginatingRecommendationOptions(recommendation, "dashboard_recommendations"),
      );
      toast.success("Successfully enrolled in course!");
      await loadDashboardData();
    } catch (error) {
      console.error("Failed to enroll from dashboard recommendation:", error);
      const feedback = getEnrollmentErrorFeedback(error, course.title);
      if (feedback.code === "already_enrolled") {
        await loadDashboardData();
      }
      setRecommendationRecovery({
        courseId: course.id,
        courseTitle: course.title,
        feedback,
      });
      toast.error(feedback.toastMessage);
    } finally {
      setEnrollingRecommendationCourseId(null);
    }
  };

  const recommendedCourses = useMemo<LearnerCourseRecommendation[]>(() => {
    return buildLearnerCourseRecommendations(
      user,
      allCourses,
      allEnrollments,
      performanceSummary,
      3,
      sessionAggregates,
      collaborativeSignals,
    );
  }, [allCourses, allEnrollments, collaborativeSignals, performanceSummary, sessionAggregates, user]);

  const assessmentOnlyEvidence = useMemo<AssessmentOnlyRecommendationEvidence | null>(
    () => deriveAssessmentOnlyRecommendationEvidence(performanceSummary),
    [performanceSummary],
  );

  const assessmentOnlyRecommendedCourses = useMemo<LearnerCourseRecommendation[]>(() => {
    return buildAssessmentOnlyCourseRecommendations(
      allCourses,
      allEnrollments,
      performanceSummary,
      3,
    );
  }, [allCourses, allEnrollments, performanceSummary]);

  const recommendationCards = useMemo(
    () => analyticsService.hydrateRecommendationCards(recommendedCourses, persistedRecommendations),
    [persistedRecommendations, recommendedCourses],
  );

  const assessmentOnlyRecommendationCards = useMemo(
    () => analyticsService.hydrateRecommendationCards(assessmentOnlyRecommendedCourses, persistedAssessmentOnlyRecommendations),
    [assessmentOnlyRecommendedCourses, persistedAssessmentOnlyRecommendations],
  );

  useEffect(() => {
    if (user.role !== "trainee" || !hasCompletedOnboarding || recommendedCourses.length === 0) {
      setPersistedRecommendations([]);
      return;
    }

    let cancelled = false;

    const syncRecommendations = async () => {
      try {
        const syncedRecommendations = await analyticsService.syncLearnerRecommendations(
          user.id,
          recommendedCourses,
          "dashboard_recommendations",
          {
            hasPerformanceSummary: Boolean(performanceSummary),
            modulesCompleted: performanceSummary?.modulesCompleted || 0,
            assessmentsTaken: performanceSummary?.assessmentsTaken || 0,
            completedCourses: completedCourses.length,
            industryInterestCount: user.industryInterests?.length || 0,
            preferredCategoryCount: user.preferredCategories?.length || 0,
            onboardingSkillLevel: user.onboardingSkillLevel || null,
            onboardingConfidenceLevel: user.onboardingConfidenceLevel || null,
            onboardingWeeklyCommitment: user.onboardingWeeklyCommitment || null,
            onboardingDigitalComfort: user.onboardingDigitalComfort || null,
            onboardingCompletedAt: user.onboardingCompletedAt || null,
            hasProfileSkills: Boolean(user.skills && user.skills.length > 0),
            recentSessionCount: sessionAggregates.reduce((sum, aggregate) => sum + aggregate.sessionCount, 0),
            repeatedIncompleteModules: sessionAggregates.filter((aggregate) => aggregate.lastSessionStatus !== "completed" && aggregate.sessionCount >= 2).length,
            collaborativeCandidateCount: Object.keys(collaborativeSignals).length,
            hybridRecommendationEngine: true,
          },
        );

        if (cancelled) {
          return;
        }

        setPersistedRecommendations(syncedRecommendations);
        await analyticsService.logRecommendationImpressions(
          user.id,
          syncedRecommendations,
          "dashboard_recommendations",
        );
      } catch (error) {
        console.error("Failed to sync dashboard recommendations:", error);
      }
    };

    void syncRecommendations();

    return () => {
      cancelled = true;
    };
  }, [collaborativeSignals, completedCourses.length, hasCompletedOnboarding, performanceSummary, recommendedCourses, sessionAggregates, user.id, user.role]);

  useEffect(() => {
    if (user.role !== "trainee" || !hasCompletedOnboarding || assessmentOnlyRecommendedCourses.length === 0 || !assessmentOnlyEvidence) {
      setPersistedAssessmentOnlyRecommendations([]);
      return;
    }

    let cancelled = false;

    const syncAssessmentOnlyRecommendations = async () => {
      try {
        const syncedRecommendations = await analyticsService.syncLearnerRecommendations(
          user.id,
          assessmentOnlyRecommendedCourses,
          "dashboard_assessment_recommendations",
          {
            recommendationMode: "assessment_only",
            excludesOnboardingSignals: true,
            excludesCollaborativeSignals: true,
            excludesSessionSignals: true,
            scoredAssessments: assessmentOnlyEvidence.scoredAssessments,
            scoreBand: assessmentOnlyEvidence.scoreBand,
            strongestTopic: assessmentOnlyEvidence.strongestTopic?.topic || null,
            weakestTopic: assessmentOnlyEvidence.weakestTopic?.topic || null,
            failedCompetencies: assessmentOnlyEvidence.failedCompetencies.map((topic) => topic.topic),
            assessedTopics: assessmentOnlyEvidence.assessedTopics,
          },
        );

        if (cancelled) {
          return;
        }

        setPersistedAssessmentOnlyRecommendations(syncedRecommendations);
        await analyticsService.logRecommendationImpressions(
          user.id,
          syncedRecommendations,
          "dashboard_assessment_recommendations",
        );
      } catch (error) {
        console.error("Failed to sync assessment-only recommendations:", error);
      }
    };

    void syncAssessmentOnlyRecommendations();

    return () => {
      cancelled = true;
    };
  }, [assessmentOnlyEvidence, assessmentOnlyRecommendedCourses, hasCompletedOnboarding, user.id, user.role]);

  useEffect(() => {
    if (user.role !== "trainee" || !hasCompletedOnboarding || recommendedCourses.length === 0 || assessmentOnlyRecommendedCourses.length === 0) {
      return;
    }

    void analyticsService.trackEvent({
      eventName: "recommendation_mode_compare_view",
      userId: user.id,
      surface: "dashboard_recommendation_modes",
      metadata: {
        hybridRecommendationCount: recommendedCourses.length,
        assessmentOnlyRecommendationCount: assessmentOnlyRecommendedCourses.length,
        hybridModelVersion: recommendedCourses[0]?.modelVersion || null,
        assessmentOnlyModelVersion: assessmentOnlyRecommendedCourses[0]?.modelVersion || null,
      },
    });
  }, [assessmentOnlyRecommendedCourses, hasCompletedOnboarding, recommendedCourses, user.id, user.role]);

  const hasRecommendationContext = Boolean(hasCompletedOnboarding && recommendedCourses.length > 0);

  const hasAssessmentOnlyRecommendationContext = Boolean(
    hasCompletedOnboarding && assessmentOnlyRecommendedCourses.length > 0 && assessmentOnlyEvidence,
  );

  const hasLearningHistory = Boolean(
    performanceSummary &&
      (performanceSummary.modulesCompleted > 0 ||
        performanceSummary.assessmentsTaken > 0 ||
        performanceSummary.totalLearningMinutes > 0 ||
        completedCourses.length > 0),
  );

  const hasOnboardingSignals = Boolean(
    (user.industryInterests && user.industryInterests.length > 0) ||
      (user.preferredCategories && user.preferredCategories.length > 0) ||
      user.onboardingSkillLevel ||
      (user.skills && user.skills.length > 0),
  );

  const recommendationHeadline = (() => {
    if (!hasLearningHistory) {
      return hasOnboardingSignals
        ? "Starter courses based on your onboarding profile"
        : "Starter courses for new trainees";
    }

    if (!performanceSummary) {
      return "Courses picked from your profile and learning path";
    }

    if (performanceSummary.recentAssessments.length > 0) {
      const latestAssessment = performanceSummary.recentAssessments[0];
      if ((latestAssessment.score || 0) >= 70) {
        return `Recommended next steps after ${latestAssessment.assessmentTitle}`;
      }
      return `Support courses based on ${latestAssessment.assessmentTitle}`;
    }

    if (performanceSummary.recentModules.length > 0) {
      return `Recommended next steps after ${performanceSummary.recentModules[0].moduleTitle}`;
    }

    return "Courses picked from your profile and learning path";
  })();

  const recommendationDescription = (() => {
    if (!hasLearningHistory) {
      return hasOnboardingSignals
        ? "These starter picks use the interests, preferred categories, starting level, existing skills, and onboarding readiness answers you shared before entering the dashboard."
        : "These starter picks use beginner-friendly defaults, curated entry pathways, and popular trainee choices so you can begin immediately.";
    }

    if (!performanceSummary) {
      return "We blend your profile skills and platform demand signals to suggest relevant courses.";
    }

    if (performanceSummary.needsImprovementTopic?.topic && performanceSummary.strongestTopic?.topic) {
      return `These picks balance your strong ${performanceSummary.strongestTopic.topic} results with support for ${performanceSummary.needsImprovementTopic.topic}.`;
    }

    if (performanceSummary.strongestTopic?.topic) {
      return `These picks extend the momentum you are building in ${performanceSummary.strongestTopic.topic}.`;
    }

    return "These picks use your profile skills, completed courses, and popular trainee pathways.";
  })();

  const assessmentOnlyHeadline = (() => {
    if (!assessmentOnlyEvidence) {
      return "Assessment-only recommendations unlock after scored assessments";
    }

    if (assessmentOnlyEvidence.weakestTopic?.topic) {
      return `Assessment-only support for ${assessmentOnlyEvidence.weakestTopic.topic}`;
    }

    if (assessmentOnlyEvidence.strongestTopic?.topic) {
      return `Assessment-only next steps after ${assessmentOnlyEvidence.strongestTopic.topic}`;
    }

    return "Recommendations based only on your assessment evidence";
  })();

  const assessmentOnlyDescription = (() => {
    if (!assessmentOnlyEvidence) {
      return "Complete at least one scored assessment to unlock a recommendation view that ignores onboarding, collaborative, and session-behavior signals.";
    }

    const weakestTopic = assessmentOnlyEvidence.weakestTopic?.topic;
    const strongestTopic = assessmentOnlyEvidence.strongestTopic?.topic;

    if (weakestTopic && strongestTopic) {
      return `This advisory mode uses only your assessment score band, strongest topic (${strongestTopic}), weakest topic (${weakestTopic}), and failed competencies. It excludes onboarding answers, collaborative behavior, and session activity.`;
    }

    return "This advisory mode uses only scored assessment outcomes, assessed topics, and score bands. It excludes onboarding answers, collaborative behavior, and session activity.";
  })();

  const progressIndicators = useMemo(() => {
    if (!performanceSummary) {
      return [] as Array<{
        label: string;
        value: string;
        helper: string;
        icon: typeof TrendingUp;
      }>;
    }

    const latestActivity = [
      ...performanceSummary.recentAssessments.map((assessment) => assessment.submittedAt).filter(Boolean),
      ...performanceSummary.recentModules.map((module) => module.completedAt).filter(Boolean),
    ]
      .map((value) => new Date(value as string))
      .filter((value) => !Number.isNaN(value.getTime()))
      .sort((left, right) => right.getTime() - left.getTime())[0];

    const recentActivityLabel = latestActivity
      ? formatDistanceToNow(latestActivity, { addSuffix: true })
      : "No recent activity";

    return [
      {
        label: "Course Completion Rate",
        value: `${stats.enrolledCourses > 0 ? Math.round((stats.completedCourses / stats.enrolledCourses) * 100) : 0}%`,
        helper: `${stats.completedCourses} of ${stats.enrolledCourses} enrolled courses completed`,
        icon: TrendingUp,
      },
      {
        label: "Module Progress",
        value: `${performanceSummary.overallModuleCompletionRate}%`,
        helper: `${performanceSummary.modulesCompleted} of ${performanceSummary.totalModules} modules completed`,
        icon: BarChart3,
      },
      {
        label: "Assessment Pass Rate",
        value: `${performanceSummary.assessmentsTaken > 0 ? Math.round((performanceSummary.passedAssessments / performanceSummary.assessmentsTaken) * 100) : 0}%`,
        helper: `${performanceSummary.passedAssessments} of ${performanceSummary.assessmentsTaken} assessments passed`,
        icon: Target,
      },
      {
        label: "Recent Activity",
        value: recentActivityLabel,
        helper: performanceSummary.totalLearningMinutes > 0
          ? `${formatLearningTime(performanceSummary.totalLearningMinutes)} tracked across modules and assessments`
          : "Complete learning activities to build your analytics profile",
        icon: Clock3,
      },
    ];
  }, [performanceSummary, stats.completedCourses, stats.enrolledCourses]);

  const profileSignalCoverage = Math.round(
    ([
      Boolean(user.onboardingSkillLevel),
      Boolean(user.industryInterests && user.industryInterests.length > 0),
      Boolean(user.preferredCategories && user.preferredCategories.length > 0),
      Boolean(user.skills && user.skills.length > 0),
    ].filter(Boolean).length / 4) * 100,
  );
  const verificationBlocked = isTraineeEnrollmentBlocked(user);
  const verificationFeedback = verificationBlocked
    ? getTraineeEnrollmentVerificationFeedback(user.verificationStatus)
    : null;
  const primaryCourse = myCourses[0] || null;
  const primaryAction = verificationBlocked
    ? {
        title: user.verificationStatus === "rejected" ? "Verification was rejected" : "Verification is in progress",
        description: verificationFeedback?.description || "Your trainee account must be verified before course enrollment opens.",
        href: "/courses",
        label: "Browse courses",
        state: undefined,
      }
    : lastAccessedModule
    ? {
        title: "Resume your latest module",
        description: `${lastAccessedModule.moduleTitle || "Latest module"} in ${lastAccessedModule.courseTitle || "your course"} was last opened ${formatActivityTime(lastAccessedModule.lastSeenAt)}.`,
        href: `/courses/${lastAccessedModule.courseId}`,
        label: "Resume learning",
        state: {
          entrySource: "dashboard_primary_resume",
          moduleId: lastAccessedModule.moduleId,
        },
      }
    : primaryCourse
      ? {
          title: "Continue your active course",
          description: `${primaryCourse.title} is ${primaryCourse.enrollment.progress}% complete and ready for your next lesson.`,
          href: `/courses/${primaryCourse.id}`,
          label: "Continue course",
          state: {
            entrySource: "dashboard_primary_course",
          },
        }
      : {
          title: "Start your first course",
          description:
            "You do not have an active course yet. Browse training paths and begin with a course that matches your goals.",
          href: "/courses",
          label: "Browse courses",
          state: undefined,
        };

  const nextStepCards = [
    !hasCompletedOnboarding
      ? {
          title: "Complete your onboarding profile",
          description:
            "Finish the dashboard onboarding flow to unlock recommendation cards, starter course pathways, and stronger cold-start guidance.",
          href: "#",
          label: "Open onboarding",
          onClick: () => setShowOnboardingModal(true),
        }
      : verificationBlocked
      ? {
          title: user.verificationStatus === "rejected" ? "Review rejected verification details" : "Prepare while approval is pending",
          description: verificationFeedback?.description || "Keep your profile accurate while the training team reviews your account.",
          href: "/profile",
          label: user.verificationStatus === "rejected" ? "Update profile" : "Open profile",
        }
      : {
          title: profileSignalCoverage < 100 ? "Complete your learner profile" : "Profile is recommendation-ready",
          description:
            profileSignalCoverage < 100
              ? "Add interests, preferred categories, stage, and skills so recommendations stay aligned with your goals."
              : "Your profile has the core signals needed for stronger recommendation and predictive insights.",
          href: "/profile",
          label: profileSignalCoverage < 100 ? "Update profile" : "Review profile",
        },
    {
      title: stats.enrolledCourses > 0 ? "Review progress details" : "See how progress will appear",
      description:
        stats.enrolledCourses > 0
          ? "Open the progress dashboard for course-by-course history, recent sessions, and completion detail."
          : "Your progress dashboard becomes more useful after you enroll and begin module activity.",
      href: "/progress",
      label: stats.enrolledCourses > 0 ? "View progress" : "Open progress dashboard",
    },
    {
      title: completedCourses.length > 0 ? "Claim your completed work" : "Explore another course",
      description:
        completedCourses.length > 0
          ? "Review your certificates and completed training records whenever you need proof of completion."
          : "Browse the course library to find another starting point or a follow-on course.",
      href: completedCourses.length > 0 ? "/certificates" : "/courses",
      label: completedCourses.length > 0 ? "View certificates" : "Browse courses",
    },
  ];

  const renderRecommendedCourses = () => {
    if (loadingCourses || loadingPerformance) {
      return (
        <section className="space-y-4 rounded-[1.5rem] border border-border bg-[linear-gradient(135deg,rgba(15,118,110,0.06)_0%,rgba(29,78,216,0.06)_100%)] p-5 sm:p-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-80 max-w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="overflow-hidden border-border/80 bg-background/95">
                <Skeleton className="aspect-[16/10] w-full rounded-none" />
                <CardHeader className="space-y-3">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      );
    }

    if (!hasCompletedOnboarding) {
      return (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <Sparkles className="h-10 w-10 text-primary/70 mx-auto" />
            <div>
              <p className="font-medium">Complete onboarding to unlock recommendations.</p>
              <p className="text-sm text-muted-foreground">
                Your dashboard recommendations now wait for your post-login onboarding answers so cold-start suggestions use current interests, category choices, readiness, and skill signals.
              </p>
            </div>
            <div className="flex justify-center">
              <Button onClick={() => setShowOnboardingModal(true)}>Complete onboarding</Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!hasRecommendationContext) {
      return (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <Sparkles className="h-10 w-10 text-primary/70 mx-auto" />
            <div>
              <p className="font-medium">Personalized recommendations unlock after learning activity.</p>
              <p className="text-sm text-muted-foreground">
                Complete your onboarding preferences or start a module and your dashboard will surface next-step course suggestions here.
              </p>
            </div>
            <Button asChild>
              <Link to="/courses">Browse Courses</Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (recommendedCourses.length === 0) {
      return null;
    }

    return (
      <section className="space-y-4 rounded-[1.5rem] border border-border bg-[linear-gradient(135deg,rgba(15,118,110,0.06)_0%,rgba(29,78,216,0.06)_100%)] p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-[0.18em]">Personalized Recommendations</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">{recommendationHeadline}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{recommendationDescription}</p>
          </div>
          <Badge variant="outline" className="w-fit rounded-full bg-background/80 px-3 py-1 text-xs font-semibold">
            {hasLearningHistory ? "Triggered by your dashboard activity" : hasOnboardingSignals ? "Driven by your onboarding profile" : "Using beginner-friendly defaults"}
          </Badge>
        </div>

        {recommendationRecovery ? (
          <Alert variant={recommendationRecovery.feedback.code === "unknown" ? "destructive" : "default"}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{recommendationRecovery.feedback.title}</AlertTitle>
            <AlertDescription>
              <div className="space-y-3">
                <p>{recommendationRecovery.feedback.description}</p>
                <div className="flex flex-wrap gap-2">
                  {recommendationRecovery.feedback.canRetry ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        const card = [...recommendationCards, ...assessmentOnlyRecommendationCards].find(
                          (item) => item.course.id === recommendationRecovery.courseId,
                        );
                        if (card) {
                          void handleRecommendationEnroll(card.course, card.persisted);
                        }
                      }}
                    >
                      Retry enrollment
                    </Button>
                  ) : null}
                  {recommendationRecovery.feedback.suggestedActions.includes("profile") ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/profile">Update profile</Link>
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setRecommendationRecovery(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {recommendationCards.map(({ course, reasons, persisted }) => (
            <Card key={course.id} className="overflow-hidden border-border/80 bg-background/95 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.4)]">
              <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-muted">
                {course.thumbnail ? (
                  <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#eef2ff_0%,#dbeafe_45%,#ecfeff_100%)]">
                    <ImageIcon className="h-10 w-10 text-slate-500" />
                  </div>
                )}
                <div className="absolute left-4 top-4 flex items-center gap-2">
                  <Badge className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary">
                    {course.level}
                  </Badge>
                  {course.isTESDAAccredited ? (
                    <Badge variant="outline" className="rounded-full bg-background/90 px-3 py-1 text-[11px] font-semibold backdrop-blur">
                      <Award className="mr-1 h-3 w-3" />
                      TESDA
                    </Badge>
                  ) : null}
                </div>
              </div>
              <CardHeader className="space-y-3">
                <div>
                  <CardTitle className="line-clamp-2 text-xl">{course.title}</CardTitle>
                  <CardDescription className="mt-2 line-clamp-3">{course.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4" />
                    <span>{getOfficialHoursCreditLabel(course.duration)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{course.enrolledCount || 0} learners enrolled</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span>{course.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Assigned trainer: {course.assignedTrainer?.displayName || course.instructor || "PESO Training Team"}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {reasons.map((reason) => (
                    <Badge key={reason} variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                      {reason}
                    </Badge>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={() => void handleRecommendationEnroll(course, persisted)}
                    disabled={verificationBlocked || enrollingRecommendationCourseId === course.id}
                  >
                    {verificationBlocked ? (
                      user.verificationStatus === "rejected" ? "Verification rejected" : "Awaiting verification"
                    ) : enrollingRecommendationCourseId === course.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enrolling...
                      </>
                    ) : (
                      "Enroll Now"
                    )}
                  </Button>
                  <Button variant="outline" asChild>
                    <Link
                      to={`/courses/${course.id}`}
                      state={{ entrySource: "dashboard_recommendations" }}
                      onClick={() => {
                        if (persisted) {
                          void analyticsService.logRecommendationClick(user.id, persisted, "dashboard_recommendations");
                        }
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  };

  const renderAssessmentOnlyRecommendations = () => {
    if (loadingCourses || loadingPerformance) {
      return null;
    }

    if (!hasCompletedOnboarding) {
      return null;
    }

    if (!performanceSummary || performanceSummary.scoredAssessments === 0) {
      return (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <Brain className="h-10 w-10 text-primary/70 mx-auto" />
            <div>
              <p className="font-medium">Assessment-only recommendations need scored assessment evidence.</p>
              <p className="text-sm text-muted-foreground">
                Finish a graded assessment and this advisory mode will suggest courses using only score bands, strongest topics, weakest topics, and failed competencies.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!hasAssessmentOnlyRecommendationContext) {
      return null;
    }

    return (
      <section className="space-y-4 rounded-[1.5rem] border border-border bg-[linear-gradient(135deg,rgba(14,116,144,0.06)_0%,rgba(245,158,11,0.10)_100%)] p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Brain className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-[0.18em]">Assessment-Only Advisory</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">{assessmentOnlyHeadline}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{assessmentOnlyDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="w-fit rounded-full bg-background/80 px-3 py-1 text-xs font-semibold">
              {assessmentOnlyEvidence?.scoreBand || "assessment_only"} score band
            </Badge>
            <Badge variant="outline" className="w-fit rounded-full bg-background/80 px-3 py-1 text-xs font-semibold">
              {assessmentOnlyEvidence?.scoredAssessments || 0} scored assessment{assessmentOnlyEvidence?.scoredAssessments === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>

        {assessmentOnlyEvidence ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-background/85 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Strongest topic</p>
              <p className="mt-2 font-semibold">{assessmentOnlyEvidence.strongestTopic?.topic || "Not enough evidence yet"}</p>
            </div>
            <div className="rounded-lg border bg-background/85 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weakest topic</p>
              <p className="mt-2 font-semibold">{assessmentOnlyEvidence.weakestTopic?.topic || "No clear focus area yet"}</p>
            </div>
            <div className="rounded-lg border bg-background/85 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Failed competencies</p>
              <p className="mt-2 font-semibold">
                {assessmentOnlyEvidence.failedCompetencies.length > 0
                  ? assessmentOnlyEvidence.failedCompetencies.map((topic) => topic.topic).join(", ")
                  : "No failed competency clusters"}
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {assessmentOnlyRecommendationCards.map(({ course, reasons, persisted }) => (
            <Card key={course.id} className="overflow-hidden border-border/80 bg-background/95 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.4)]">
              <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-muted">
                {course.thumbnail ? (
                  <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#fef3c7_0%,#dbeafe_50%,#ecfeff_100%)]">
                    <ImageIcon className="h-10 w-10 text-slate-500" />
                  </div>
                )}
                <div className="absolute left-4 top-4 flex items-center gap-2">
                  <Badge className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary">
                    {course.level}
                  </Badge>
                  <Badge variant="outline" className="rounded-full bg-background/90 px-3 py-1 text-[11px] font-semibold backdrop-blur">
                    Assessment only
                  </Badge>
                </div>
              </div>
              <CardHeader className="space-y-3">
                <div>
                  <CardTitle className="line-clamp-2 text-xl">{course.title}</CardTitle>
                  <CardDescription className="mt-2 line-clamp-3">{course.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4" />
                    <span>{getOfficialHoursCreditLabel(course.duration)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span>{course.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Assigned trainer: {course.assignedTrainer?.displayName || course.instructor || "PESO Training Team"}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {reasons.map((reason) => (
                    <Badge key={reason} variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                      {reason}
                    </Badge>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={() => void handleRecommendationEnroll(course, persisted)}
                    disabled={verificationBlocked || enrollingRecommendationCourseId === course.id}
                  >
                    {verificationBlocked ? (
                      user.verificationStatus === "rejected" ? "Verification rejected" : "Awaiting verification"
                    ) : enrollingRecommendationCourseId === course.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enrolling...
                      </>
                    ) : (
                      "Enroll Now"
                    )}
                  </Button>
                  <Button variant="outline" asChild>
                    <Link
                      to={`/courses/${course.id}`}
                      state={{ entrySource: "dashboard_assessment_recommendations" }}
                      onClick={() => {
                        if (persisted) {
                          void analyticsService.logRecommendationClick(user.id, persisted, "dashboard_assessment_recommendations");
                        }
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  };

  const getTopicTone = (
    topic: LearnerPerformanceTopicResult,
    summary: LearnerPerformanceSummary
  ): { label: string; className: string } => {
    if (summary.strongestTopic?.topic === topic.topic) {
      return {
        label: "Strength",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300",
      };
    }

    if (
      summary.needsImprovementTopic?.topic === topic.topic &&
      topic.averageScore !== null &&
      summary.topicPerformance.filter((item) => item.averageScore !== null).length > 1
    ) {
      return {
        label: "Focus Area",
        className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
      };
    }

    return {
      label: "Active Topic",
      className: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300",
    };
  };

  const renderPerformanceSummary = () => {
    if (loadingPerformance) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Loader2 className="w-7 h-7 text-muted-foreground animate-spin mb-3" />
            <p className="text-muted-foreground">Loading learner performance summary...</p>
          </CardContent>
        </Card>
      );
    }

    if (!performanceSummary) {
      return null;
    }

    const hasPerformanceData =
      performanceSummary.assessmentsTaken > 0 ||
      performanceSummary.modulesCompleted > 0 ||
      performanceSummary.totalLearningMinutes > 0;

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Learning Performance Summary
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              Assessment scores, module completion activity, tracked learning time, and topic-level results from your enrolled courses.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">
            Live dashboard learning analytics
          </Badge>
        </div>

        {!hasPerformanceData ? (
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <p className="font-medium">Your learning summary will appear here as you progress.</p>
                <p className="text-sm text-muted-foreground">
                  Complete modules and submit assessments to unlock score trends, topic insights, and time-spent analytics.
                </p>
              </div>
              <Button asChild>
                <Link to="/courses">Continue Learning</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Assessment Score</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{performanceSummary.averageAssessmentScore}%</div>
                  <p className="text-xs text-muted-foreground">
                    {performanceSummary.scoredAssessments > 0
                      ? `Across ${performanceSummary.scoredAssessments} graded attempt${performanceSummary.scoredAssessments === 1 ? "" : "s"}`
                      : "No graded assessments yet"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Modules Completed</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {performanceSummary.modulesCompleted}
                    <span className="text-base font-medium text-muted-foreground">/{performanceSummary.totalModules}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {performanceSummary.overallModuleCompletionRate}% completion across your enrolled courses
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Learning Time</CardTitle>
                  <Clock3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatLearningTime(performanceSummary.totalLearningMinutes)}</div>
                  <p className="text-xs text-muted-foreground">Combined module and assessment time tracked</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Assessment Outcomes</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{performanceSummary.passedAssessments}/{performanceSummary.assessmentsTaken}</div>
                  <p className="text-xs text-muted-foreground">
                    {performanceSummary.bestAssessmentScore > 0
                      ? `Best score: ${performanceSummary.bestAssessmentScore}%`
                      : "Pass results will appear after submission"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Overall Learning Progress</CardTitle>
                <CardDescription>
                  Broader progress signals that show how consistently you are moving through courses, modules, and assessments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {progressIndicators.map((indicator) => {
                    const Icon = indicator.icon;

                    return (
                      <div key={indicator.label} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-muted-foreground">{indicator.label}</p>
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <p className="mt-3 text-2xl font-semibold">{indicator.value}</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{indicator.helper}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Topic-Level Performance</CardTitle>
                  <CardDescription>
                    Topics are derived from your enrolled course skill tags so you can see where you are strongest and where to focus next.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                      <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Strongest Topic</p>
                      <p className="mt-2 font-semibold text-emerald-900 dark:text-emerald-100">
                        {performanceSummary.strongestTopic?.topic || "Build more history"}
                      </p>
                      <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-200/80">
                        {performanceSummary.strongestTopic?.averageScore !== null && performanceSummary.strongestTopic
                          ? `${performanceSummary.strongestTopic.averageScore}% average score`
                          : "Complete scored assessments to surface your top-performing topic."}
                      </p>
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                      <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">Needs Improvement</p>
                      <p className="mt-2 font-semibold text-amber-900 dark:text-amber-100">
                        {performanceSummary.needsImprovementTopic?.topic || "No focus area yet"}
                      </p>
                      <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">
                        {performanceSummary.needsImprovementTopic?.averageScore !== null && performanceSummary.needsImprovementTopic
                          ? `${performanceSummary.needsImprovementTopic.averageScore}% average score`
                          : "Finish more than one scored topic to identify a reliable focus area."}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {performanceSummary.topicPerformance.length > 0 ? (
                      performanceSummary.topicPerformance.map((topic) => {
                        const tone = getTopicTone(topic, performanceSummary);

                        return (
                          <div key={topic.topic} className="rounded-lg border p-4 space-y-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="font-semibold">{topic.topic}</p>
                                <p className="text-sm text-muted-foreground">
                                  {topic.assessmentsTaken} assessment{topic.assessmentsTaken === 1 ? "" : "s"} and {topic.modulesCompleted} module completion{topic.modulesCompleted === 1 ? "" : "s"}
                                </p>
                              </div>
                              <Badge variant="outline" className={tone.className}>
                                {tone.label}
                              </Badge>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3 text-sm">
                              <div>
                                <p className="text-muted-foreground">Assessment result</p>
                                <p className="font-medium">
                                  {topic.averageScore !== null ? `${topic.averageScore}% average` : "No graded result yet"}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Learning time</p>
                                <p className="font-medium">{formatLearningTime(topic.totalTimeSpentMinutes)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Completion record</p>
                                <p className="font-medium">{topic.modulesCompleted} modules completed</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">Topic results will appear after you complete modules and assessments.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Assessment Scores</CardTitle>
                  <CardDescription>Your latest scored or submitted assessments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {performanceSummary.recentAssessments.length > 0 ? (
                    performanceSummary.recentAssessments.map((assessment) => (
                      <div key={assessment.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium leading-tight">{assessment.assessmentTitle}</p>
                            <p className="text-sm text-muted-foreground">{assessment.moduleTitle} • {assessment.courseTitle}</p>
                          </div>
                          <Badge variant={assessment.score !== null && assessment.score >= 70 ? "default" : "secondary"}>
                            {assessment.score !== null ? `${assessment.score}%` : "Pending"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground gap-3">
                          <span>{assessment.passed === true ? "Passed" : assessment.passed === false ? "Needs review" : "Awaiting result"}</span>
                          <span>{assessment.timeSpentMinutes > 0 ? formatLearningTime(assessment.timeSpentMinutes) : "No time tracked"}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatActivityTime(assessment.submittedAt)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Submit an assessment to populate score history here.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Module Completion Records</CardTitle>
                  <CardDescription>Your most recent completed learning modules.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {performanceSummary.recentModules.length > 0 ? (
                    performanceSummary.recentModules.map((module) => (
                      <div key={`${module.moduleId}-${module.completedAt || "pending"}`} className="rounded-lg border p-3 space-y-2">
                        <div>
                          <p className="font-medium leading-tight">{module.moduleTitle}</p>
                          <p className="text-sm text-muted-foreground">{module.courseTitle}</p>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground gap-3">
                          <span>{formatLearningTime(module.timeSpentMinutes)}</span>
                          <span>{formatActivityTime(module.completedAt)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Complete modules to see your latest completion records.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <TraineeOnboardingModal
          open={showOnboardingModal}
          user={user}
          onDismiss={() => {
            void handleDismissOnboardingModal();
          }}
          onCompleted={(summary) => {
            void handleOnboardingCompleted(summary);
          }}
        />

        {!hasCompletedOnboarding ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Post-login onboarding required for recommendations</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Registration is intentionally shorter now. Finish your dashboard onboarding to unlock recommendation cards, starter guidance, and profile-driven analytics context.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setShowOnboardingModal(true)}>Complete onboarding</Button>
                <Button asChild variant="outline">
                  <Link to="/courses">Browse courses</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : latestOnboardingSummary ? (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>Onboarding completed</AlertTitle>
            <AlertDescription>
              Your dashboard now has {latestOnboardingSummary.generatedRecommendationCount} starter recommendation{latestOnboardingSummary.generatedRecommendationCount === 1 ? "" : "s"} based on your onboarding profile.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card">
            <CardContent className="p-6 sm:p-7">
              <div className="flex flex-col gap-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="w-fit rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                      Trainee workspace
                    </Badge>
                    <TraineeVerificationBadge status={user.verificationStatus} />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user.name}!</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                      Keep moving with one clear next step: resume learning, sharpen your profile signals, or review your progress in detail.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Enrolled</p>
                    <p className="mt-2 text-3xl font-semibold">{stats.enrolledCourses}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Active courses in your dashboard</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Completed</p>
                    <p className="mt-2 text-3xl font-semibold">{stats.completedCourses}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Finished courses on record</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Profile signals</p>
                    <p className="mt-2 text-3xl font-semibold">{profileSignalCoverage}%</p>
                    <p className="mt-1 text-xs text-muted-foreground">Recommendation inputs completed</p>
                  </div>
                </div>

                {verificationFeedback ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{verificationFeedback.title}</AlertTitle>
                    <AlertDescription>{verificationFeedback.description}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="rounded-3xl border border-primary/15 bg-background/80 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Primary next step</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{primaryAction.title}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{primaryAction.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button asChild>
                      <Link to={primaryAction.href} state={primaryAction.state}>
                        {primaryAction.label}
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to={verificationBlocked ? "/profile" : "/progress"}>
                        {verificationBlocked ? (user.verificationStatus === "rejected" ? "Update profile" : "Open profile") : "View progress"}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next-step shortcuts</CardTitle>
              <CardDescription>Keep your next action distinct so learning, browsing, and profile updates do not compete.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {nextStepCards.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border/70 p-4">
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  {item.href === "#" ? (
                    <Button variant="outline" size="sm" className="mt-4" onClick={item.onClick}>
                      {item.label}
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm" className="mt-4">
                      <Link to={item.href}>{item.label}</Link>
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock3 className="h-5 w-5 text-primary" />
                Last Accessed Module
              </CardTitle>
              <CardDescription>
                Resume from the most recent module session stored in your learning history.
              </CardDescription>
            </div>
            {lastAccessedModule && !loadingSessionHistory ? (
              <Badge variant="secondary" className="w-fit">
                {formatSessionStatus(lastAccessedModule.sessionStatus)}
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent>
            {loadingSessionHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : lastAccessedModule ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-lg font-semibold leading-tight">
                    {lastAccessedModule.moduleTitle || "Untitled module"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {lastAccessedModule.courseTitle || "Untitled course"}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Last opened</p>
                    <p className="mt-2 text-sm font-medium">{formatActivityTime(lastAccessedModule.lastSeenAt)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest session</p>
                    <p className="mt-2 text-sm font-medium">{formatSessionDuration(lastAccessedModule.durationSeconds)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Resume point</p>
                    <p className="mt-2 text-sm font-medium">
                      {typeof lastAccessedModule.resumePositionSeconds === "number" && lastAccessedModule.resumePositionSeconds > 0
                        ? formatSessionDuration(lastAccessedModule.resumePositionSeconds)
                        : "Start from current module"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link
                      to={`/courses/${lastAccessedModule.courseId}`}
                      state={{
                        entrySource: "dashboard_last_accessed_module",
                        moduleId: lastAccessedModule.moduleId,
                      }}
                    >
                      Continue Module
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/progress">View Session History</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Your recent module activity will appear here after you open a learning module.
                </p>
                <Button asChild variant="outline">
                  <Link to="/courses">Browse Courses</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current dashboard focus</CardTitle>
            <CardDescription>Use one destination at a time depending on whether you need to resume, explore, or review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Resume learning</p>
              <p className="mt-2 font-medium">
                {lastAccessedModule
                  ? `${lastAccessedModule.moduleTitle || "Latest module"} is ready to continue.`
                  : primaryCourse
                    ? `${primaryCourse.title} is your current in-progress course.`
                    : "No active module yet. Start with the course catalog."}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Recommendation strength</p>
              <p className="mt-2 font-medium">
                {profileSignalCoverage >= 75
                  ? "Your dashboard has enough profile context to keep recommendations specific."
                  : "Complete more profile signals to make recommendations more specific and actionable."}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Progress review</p>
              <p className="mt-2 font-medium">
                {stats.enrolledCourses > 0
                  ? "Use the progress dashboard when you want course-by-course detail, not when you are trying to resume quickly."
                  : "Progress detail becomes useful after you enroll and start learning activity."}
              </p>
            </div>
          </CardContent>
        </Card>
        </div>

    {renderRecommendedCourses()}

      {renderAssessmentOnlyRecommendations()}

        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">My Courses</h2>
              <p className="mt-1 text-sm text-muted-foreground">Continue active courses first before shifting into detailed analytics or completed-history review.</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/courses">View All</Link>
            </Button>
          </div>
          {loadingCourses ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={index}>
                  <CardHeader>
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myCourses.length > 0 ? (
                myCourses.map((course) => {
                  const isCompleted = course.enrollment.status === "completed";
                  const isAwaitingApproval = course.enrollment.progress >= 100 && course.enrollment.completionApprovalStatus !== "approved";
                  return (
                    <Card key={course.id} className={isCompleted ? "border-green-200 dark:border-green-900/30" : ""}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                            <CardDescription>
                              {course.category} • {course.level} • {course.assignedTrainer?.displayName || course.instructor || "PESO Training Team"}
                            </CardDescription>
                          </div>
                          {isCompleted && (
                            <Badge variant="outline" className="shrink-0 text-green-600 border-green-300">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Completed
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{course.enrollment.progress}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isCompleted ? "bg-green-600" : "bg-primary"}`}
                              style={{ width: `${course.enrollment.progress}%` }}
                            />
                          </div>
                          {isAwaitingApproval ? (
                            <p className="text-xs text-muted-foreground">
                              Waiting for trainer approval before the course is marked complete.
                            </p>
                          ) : null}
                          {isCompleted ? (
                            <Button asChild className="w-full mt-4" variant="secondary">
                              <Link to="/certificates">View Certificate</Link>
                            </Button>
                          ) : (
                            <Button asChild className="w-full mt-4">
                              <Link to={`/courses/${course.id}`} state={{ entrySource: "dashboard_continue_learning" }}>
                                Continue Learning
                              </Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="col-span-full">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
                    {completedCourses.length > 0 || stats.enrolledCourses > 0 ? (
                      <>
                        <p className="text-muted-foreground mb-2">You have no active in-progress courses right now.</p>
                        <p className="text-sm text-muted-foreground mb-4 max-w-xl">
                          Review released certificates or enroll in another course if you want a new next step on the dashboard.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Button asChild variant="outline">
                            <Link to="/certificates">View Certificates</Link>
                          </Button>
                          <Button asChild>
                            <Link to="/courses">Browse Courses</Link>
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-muted-foreground mb-2">You have not enrolled in any courses yet.</p>
                        <p className="text-sm text-muted-foreground mb-4 max-w-xl">
                          Start with the course catalog, then come back here to resume modules and review progress.
                        </p>
                        <Button asChild>
                          <Link to="/courses">Browse Courses</Link>
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {renderPerformanceSummary()}

        {/* Completed Courses - on Dashboard per user request */}
        {completedCourses.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Completed Courses
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedCourses.map((course) => (
                <Card key={course.id} className="flex flex-col border-green-200 dark:border-green-900/30">
                  <CardHeader>
                    <Badge variant="outline" className="w-fit text-green-600 border-green-300">
                      Completed
                    </Badge>
                    <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {course.description}
                    </CardDescription>
                    <p className="text-sm text-muted-foreground">
                      Assigned trainer: {course.assignedTrainer?.displayName || course.instructor || "PESO Training Team"}
                    </p>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Button asChild variant="default" className="w-full gap-2">
                      <Link to="/certificates">
                        <Award className="h-4 w-4" />
                        View Released Certificate
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

interface TrainingOfficerDashboardProps {
  user: User;
}

const TrainingOfficerDashboard = ({ user }: TrainingOfficerDashboardProps) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [certificatesIssued, setCertificatesIssued] = useState<{ courseId: string; issuedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const [allCourses, allEnrollments, allCerts] = await Promise.all([
          courseService.getCourses(),
          enrollmentService.getEnrollments(),
          certificateService.getCertificates(),
        ]);
        if (cancelled) return;
        const myCourses = allCourses;
        const myCourseIds = new Set(myCourses.map((c) => c.id));
        const myEnrollments = allEnrollments.filter((e) => myCourseIds.has(e.courseId));
        setCourses(myCourses);
        setEnrollments(myEnrollments);
        setCertificatesIssued(
          allCerts.filter((c) => myCourseIds.has(c.courseId)).map((c) => ({ courseId: c.courseId, issuedAt: c.issuedAt }))
        );
      } catch (e) {
        if (!cancelled) toast.error("Failed to load dashboard data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const inThisMonth = (dateStr: string) =>
    isWithinInterval(new Date(dateStr), { start: monthStart, end: monthEnd });

  const joinedThisMonth = enrollments.filter((e) => inThisMonth(e.enrolledAt)).length;
  const droppedThisMonth = enrollments.filter((e) => e.status === "dropped").length; // all-time dropped; could narrow to month if we had updated_at
  const completedThisMonth = enrollments.filter(
    (e) => e.status === "completed" && e.completedAt && inThisMonth(e.completedAt)
  ).length;
  const certificatesThisMonth = certificatesIssued.filter((c) => inThisMonth(c.issuedAt)).length;

  const completedTotal = enrollments.filter((e) => e.status === "completed").length;
  const completionRate = enrollments.length > 0 ? Math.round((completedTotal / enrollments.length) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Training Officer Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage all courses and learners</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Courses</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{courses.length}</div>
                  <p className="text-xs text-muted-foreground">Courses you manage</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Learners</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{enrollments.length}</div>
                  <p className="text-xs text-muted-foreground">Total learners</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completionRate}%</div>
                  <p className="text-xs text-muted-foreground">Course completion</p>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Monthly Report</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {now.toLocaleString("default", { month: "long", year: "numeric" })}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Joined</CardTitle>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{joinedThisMonth}</div>
                    <p className="text-xs text-muted-foreground">Learners this month</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Dropped</CardTitle>
                    <ArrowDownRight className="h-4 w-4 text-muted-foreground text-amber-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{droppedThisMonth}</div>
                    <p className="text-xs text-muted-foreground">Dropped (all time)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completed</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{completedThisMonth}</div>
                    <p className="text-xs text-muted-foreground">Completed this month</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Certificates</CardTitle>
                    <Award className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{certificatesThisMonth}</div>
                    <p className="text-xs text-muted-foreground">Issued this month</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Shortcuts to manage courses and learners</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link to="/trainer/courses">
                    <BookOpen className="mr-2 h-4 w-4" />
                    My Courses
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/trainer/learners">
                    <Users className="mr-2 h-4 w-4" />
                    Learners
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/admin/reports">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Reports
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    enrolledCourses: 0,
    completedCourses: 0,
    certificates: 0,
  });

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    if (!user) return;
    
    try {
      const enrollments = await enrollmentService.getEnrollments(user.id);
      const certificates = await certificateService.getCertificates(user.id);
      setStats({
        enrolledCourses: enrollments.length,
        completedCourses: enrollments.filter((e) => e.status === "completed").length,
        certificates: certificates.length,
      });
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    }
  };

  if (!user) return null;

  const canonicalDashboardRoute = getDashboardRoute(user.role);
  if (canonicalDashboardRoute !== "/dashboard") {
    return <Navigate to={canonicalDashboardRoute} replace />;
  }

  // Trainee Dashboard (replaces old "jobseeker" role)
  if (user.role === "trainee") {
    return <TraineeDashboard user={user} stats={stats} />;
  }

  // Admin Dashboard
  if (user.role === "admin") {
    const courses = dataService.getCourses();
    const enrollments = dataService.getEnrollments();
    const totalUsers = 4; // Mock data

    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-2">Manage PESO Academy platform</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUsers}</div>
                <p className="text-xs text-muted-foreground">Registered users</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Courses</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{courses.length}</div>
                <p className="text-xs text-muted-foreground">Available courses</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Enrollments</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{enrollments.length}</div>
                <p className="text-xs text-muted-foreground">Total enrollments</p>
              </CardContent>
            </Card>

          </div>

          {/* Quick Actions - informative cards */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Manage Users
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="mb-4">
                    Manage registered users, assign/change roles, and oversee account status.
                  </CardDescription>
                  <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                    <Link to="/admin/users">Open</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Manage Courses
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="mb-4">
                    Create and edit courses, manage modules, and control course visibility.
                  </CardDescription>
                  <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                    <Link to="/admin/courses">Open</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Manage Roles
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="mb-4">
                    Define user roles, job functions, and system access permissions.
                  </CardDescription>
                  <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                    <Link to="/admin/roles">Open</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Audit Logs
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="mb-4">
                    Track system activities and review user actions for security and accountability.
                  </CardDescription>
                  <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                    <Link to="/admin/audit-logs">Open</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Manage Enrollments
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="mb-4">
                    Monitor trainee enrollments and manage course participation.
                  </CardDescription>
                  <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                    <Link to="/admin/enrollments">Open</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Reports & Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="mb-4">
                    Access summarized data and insights on users, courses, and system performance.
                  </CardDescription>
                  <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                    <Link to="/admin/reports">Open</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Trainer dashboard (real data from Supabase; no redundant My Courses section)
  if (user.role === "trainer") {
    return <TrainingOfficerDashboard user={user} />;
  }

  // Fallback: If role doesn't match any dashboard, show a default message
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {user.name}!</h1>
          <p className="text-muted-foreground mt-2">Your dashboard is being set up</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-muted-foreground">Role: {user.role}</p>
            <p className="text-sm text-muted-foreground mt-2">If you believe this is an error, please contact an administrator.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;

