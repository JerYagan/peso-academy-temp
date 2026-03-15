import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import DashboardLayout from "@/components/DashboardLayout";
import TraineeOnboardingModal from "@/components/trainee/TraineeOnboardingModal";
import TraineeVerificationBadge from "@/components/trainee/TraineeVerificationBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Users, Award, TrendingUp, ArrowRight, Shield, FileText, FileSpreadsheet, Loader2, CheckCircle2, ArrowUpRight, ArrowDownRight, Brain, Clock3, Target, BarChart3, Sparkles, AlertCircle } from "lucide-react";
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
import {
  buildLearnerCareerPathRecommendations,
  buildLearnerCourseRecommendations,
  reportingService,
  type LearnerCareerPathRecommendation,
  type CollaborativeRecommendationSignal,
  type LearnerCourseRecommendation,
  type LearnerPerformanceSummary,
  type LearnerPerformanceTopicResult,
} from "@/services/reportingService";
import { moduleSessionService, type EnrichedModuleSession, type ModuleSessionAggregate } from "@/services/moduleSessionService";
import { getDashboardRoute } from "@/lib/roles";
import { filterCoursesForUser } from "@/lib/courseAudience";
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

type DashboardTab = "continue" | "review";

const TraineeDashboard = ({ user, stats }: TraineeDashboardProps) => {
  const { language } = useLocale();
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [completedCourses, setCompletedCourses] = useState<Array<Course & { enrollment: Enrollment }>>([]);
  const [myCourses, setMyCourses] = useState<Array<Course & { enrollment: Enrollment }>>([]);
  const [allEnrollments, setAllEnrollments] = useState<Enrollment[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState<LearnerPerformanceSummary | null>(null);
  const [lastAccessedModule, setLastAccessedModule] = useState<EnrichedModuleSession | null>(null);
  const [sessionAggregates, setSessionAggregates] = useState<ModuleSessionAggregate[]>([]);
  const [collaborativeSignals, setCollaborativeSignals] = useState<Record<string, CollaborativeRecommendationSignal>>({});
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingPerformance, setLoadingPerformance] = useState(true);
  const [loadingSessionHistory, setLoadingSessionHistory] = useState(true);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("continue");
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [latestOnboardingSummary, setLatestOnboardingSummary] = useState<TraineeOnboardingSummary | null>(null);
  const hasCompletedOnboarding = Boolean(user.onboardingCompletedAt);
  const copy = language === "tl"
    ? {
        defaultTrainer: "PESO Training Team",
        browseCourses: "Tingnan ang mga kurso",
        completeOnboarding: "Tapusin ang onboarding",
        updateProfile: "I-update ang profile",
        openProfile: "Buksan ang profile",
        reviewProfile: "Suriin ang profile",
        viewProgress: "Tingnan ang progreso",
        openProgressDashboard: "Buksan ang progress dashboard",
        viewCertificates: "Tingnan ang certificates",
        viewAll: "Tingnan Lahat",
        resumeLearning: "Ipagpatuloy ang pag-aaral",
        continueCourse: "Ipagpatuloy ang kurso",
        openOnboarding: "Buksan ang onboarding",
        continueModule: "Ipagpatuloy ang Module",
        viewSessionHistory: "Tingnan ang Session History",
        dismiss: "Isara",
        retryEnrollment: "Subukan muli ang enrollment",
        preview: "Preview",
        enrollNow: "Mag-enroll Ngayon",
        enrolling: "Nag-e-enroll...",
        blockedPending: "Naghihintay ng verification",
        blockedRejected: "Tinanggihan ang verification",
        postLoginTitle: "Kailangan ang post-login onboarding para sa recommendations",
        postLoginBody: "Mas maikli na ngayon ang registration. Tapusin ang dashboard onboarding para ma-unlock ang personalized course picks sa iyong dashboard at mas relevant na guidance.",
        onboardingCompletedTitle: "Tapos na ang onboarding",
        onboardingCompletedBody: (count: number) => `Mayroon ka nang ${count} starter recommendation${count === 1 ? "" : "s"} sa iyong dashboard batay sa onboarding profile mo.`,
        workspaceBadge: "Learner workspace",
        welcome: (name: string) => `Maligayang pagbabalik, ${name}!`,
        welcomeBody: "Magpatuloy sa iisang malinaw na susunod na hakbang: ipagpatuloy ang pag-aaral, patibayin ang iyong profile signals, o suriin nang detalyado ang iyong progreso.",
        enrolled: "Enrolled",
        enrolledBody: "Mga aktibong kurso sa iyong dashboard",
        completed: "Completed",
        completedBody: "Mga natapos na kursong nasa record",
        profileSignals: "Profile signals",
        profileSignalsBody: "Mga natapos na recommendation inputs",
        primaryNextStep: "Pangunahing susunod na hakbang",
        tabs: {
          continue: "Magpatuloy",
          discover: "Recommendations",
          review: "Review",
        },
        discoverTitle: "Personalized recommendations para sa susunod mong kurso",
        discoverBody: "Nakabase ang listahang ito sa iyong onboarding profile, progreso, at learning activity para manatiling relevant ang susunod mong learning step.",
        discoverReadyTitle: "Nakahanda na ang iyong personalized course list.",
        discoverReadyBody: "Suriin ang mga rekomendasyong naka-rank batay sa iyong onboarding answers, progreso, at recent learning activity.",
        discoverLockedTitle: "Tapusin muna ang onboarding para ma-unlock ang personalized recommendations.",
        discoverLockedBody: "Kapag natapos mo ang onboarding, lalabas dito sa dashboard ang iyong recommended courses.",
        reviewActionsTitle: "Review at records",
        reviewActionsBody: "Buksan ang progress at certificates kapag review mode ang pakay mo, hindi kapag gusto mo lang mabilis na magpatuloy.",
        lastAccessedTitle: "Huling Binuksang Module",
        lastAccessedBody: "Magpatuloy mula sa pinakahuling module session na na-save sa iyong learning history.",
        lastOpened: "Huling binuksan",
        latestSession: "Pinakabagong session",
        resumePoint: "Resume point",
        startCurrentModule: "Magsimula sa kasalukuyang module",
        recentActivityEmpty: "Lalabas dito ang iyong kamakailang module activity pagkatapos mong magbukas ng learning module.",
        currentFocusTitle: "Kasalukuyang dashboard focus",
        currentFocusBody: "Gumamit ng iisang destination depende kung kailangan mong magpatuloy, mag-explore, o mag-review.",
        resumeLearningTitle: "Ipagpatuloy ang pag-aaral",
        recommendationStrength: "Lakas ng recommendation",
        progressReview: "Pagsusuri ng progreso",
        myCourses: "Aking Mga Kurso",
        myCoursesBody: "Ipagpatuloy muna ang mga aktibong kurso bago lumipat sa detalyadong analytics o review ng natapos na history.",
        waitingApproval: "Pino-finalize na ang course completion.",
        finalizing: "Pino-finalize",
        completedLabel: "Completed",
        inProgressLabel: "In Progress",
        viewCertificate: "Tingnan ang Certificate",
        noRecentModule: "Wala pang active module. Magsimula sa course catalog.",
        recommendationGateTitle: "Tapusin ang onboarding para ma-unlock ang recommendations.",
        recommendationGateBody: "Ang dashboard recommendations mo ay naghihintay muna ng iyong post-login onboarding answers para magamit ang kasalukuyang interests, category choices, readiness, at skill signals.",
        recommendationActivityTitle: "Magbubukas ang personalized recommendations pagkatapos ng learning activity.",
        recommendationActivityBody: "Tapusin ang onboarding preferences o magsimula ng module at magpapakita rito ang mga susunod na course suggestion.",
        personalizedRecommendations: "Personalized Recommendations",
        triggeredByActivity: "Na-trigger ng iyong dashboard activity",
        drivenByProfile: "Batay sa iyong onboarding profile",
        beginnerDefaults: "Gumagamit ng beginner-friendly defaults",
        learnersEnrolled: (count: number) => `${count || 0} learner ang naka-enroll`,
        assignedTrainer: (name: string) => `Nakatalagang trainer: ${name}`,
        assessmentNeedEvidenceTitle: "Kailangan ng assessment-only recommendations ng scored assessment evidence.",
        assessmentNeedEvidenceBody: "Tapusin ang graded assessment at magsa-suggest ang advisory mode na ito ng mga kurso gamit lang ang score bands, strongest topics, weakest topics, at failed competencies.",
        assessmentOnlyAdvisory: "Assessment-Only Advisory",
        strongestTopic: "Pinakamalakas na topic",
        weakestTopic: "Pinakamahinang topic",
        failedCompetencies: "Failed competencies",
        notEnoughEvidence: "Hindi pa sapat ang ebidensya",
        noClearFocus: "Wala pang malinaw na focus area",
        noFailedClusters: "Walang failed competency clusters",
        learningPerformanceSummary: "Buod ng Learning Performance",
        learningPerformanceSummaryBody: "Assessment scores, module completion activity, tracked learning time, at topic-level results mula sa iyong mga enrolled na kurso.",
        liveLearningAnalytics: "Live na learning analytics sa dashboard",
        learningSummaryEmptyTitle: "Lalabas dito ang buod ng iyong pag-aaral habang umuusad ka.",
        learningSummaryEmptyBody: "Tapusin ang mga module at magsumite ng assessments para ma-unlock ang score trends, topic insights, at time-spent analytics.",
        noGradedResultYet: "Wala pang graded na resulta",
        continueLearningButton: "Ipagpatuloy ang Pag-aaral",
        noActiveCoursesTitle: "Wala kang aktibong kursong kasalukuyang ginagawa.",
        noActiveCoursesBody: "Suriin ang mga na-release na certificate o mag-enroll sa ibang kurso kung gusto mo ng bagong susunod na hakbang sa dashboard.",
        noEnrollmentsTitle: "Hindi ka pa naka-enroll sa anumang kurso.",
        noEnrollmentsBody: "Magsimula sa course catalog, pagkatapos ay bumalik dito para ipagpatuloy ang mga module at suriin ang progreso.",
      }
    : {
        defaultTrainer: "PESO Training Team",
        browseCourses: "Browse courses",
        completeOnboarding: "Complete onboarding",
        updateProfile: "Update profile",
        openProfile: "Open profile",
        reviewProfile: "Review profile",
        viewProgress: "View progress",
        openProgressDashboard: "Open progress dashboard",
        viewCertificates: "View certificates",
        viewAll: "View All",
        resumeLearning: "Resume learning",
        continueCourse: "Continue course",
        openOnboarding: "Open onboarding",
        continueModule: "Continue Module",
        viewSessionHistory: "View Session History",
        dismiss: "Dismiss",
        retryEnrollment: "Retry enrollment",
        preview: "Preview",
        enrollNow: "Enroll Now",
        enrolling: "Enrolling...",
        blockedPending: "Awaiting verification",
        blockedRejected: "Verification rejected",
        postLoginTitle: "Post-login onboarding required for recommendations",
        postLoginBody: "Registration is intentionally shorter now. Finish your dashboard onboarding to unlock personalized course picks on your dashboard and more relevant guidance.",
        onboardingCompletedTitle: "Onboarding completed",
        onboardingCompletedBody: (count: number) => `Your dashboard now has ${count} starter recommendation${count === 1 ? "" : "s"} based on your onboarding profile.`,
        workspaceBadge: "Learner workspace",
        welcome: (name: string) => `Welcome back, ${name}!`,
        welcomeBody: "Keep moving with one clear next step: resume learning, sharpen your profile signals, or review your progress in detail.",
        enrolled: "Enrolled",
        enrolledBody: "Active courses in your dashboard",
        completed: "Completed",
        completedBody: "Finished courses on record",
        profileSignals: "Profile signals",
        profileSignalsBody: "Recommendation inputs completed",
        primaryNextStep: "Primary next step",
        tabs: {
          continue: "Continue Learning",
          discover: "Recommendations",
          review: "Review",
        },
        discoverTitle: "Personalized recommendations for your next course",
        discoverBody: "This list is ranked from your onboarding profile, progress, and learning activity so the next step stays relevant to you.",
        discoverReadyTitle: "Your personalized course list is ready.",
        discoverReadyBody: "Review the recommendations ranked from your onboarding answers, progress, and recent learning activity.",
        discoverLockedTitle: "Complete onboarding first to unlock your personalized recommendations.",
        discoverLockedBody: "Once onboarding is complete, your recommended courses appear here on the dashboard.",
        reviewActionsTitle: "Review and records",
        reviewActionsBody: "Use progress and certificates when you are reviewing outcomes, not when you just need the fastest path back into learning.",
        lastAccessedTitle: "Last Accessed Module",
        lastAccessedBody: "Resume from the most recent module session stored in your learning history.",
        lastOpened: "Last opened",
        latestSession: "Latest session",
        resumePoint: "Resume point",
        startCurrentModule: "Start from current module",
        recentActivityEmpty: "Your recent module activity will appear here after you open a learning module.",
        currentFocusTitle: "Current dashboard focus",
        currentFocusBody: "Use one destination at a time depending on whether you need to resume, explore, or review.",
        resumeLearningTitle: "Resume learning",
        recommendationStrength: "Recommendation strength",
        progressReview: "Progress review",
        myCourses: "My Courses",
        myCoursesBody: "Continue active courses first before shifting into detailed analytics or completed-history review.",
        waitingApproval: "Course completion is being finalized.",
        finalizing: "Finalizing",
        completedLabel: "Completed",
        inProgressLabel: "In Progress",
        viewCertificate: "View Certificate",
        noRecentModule: "No active module yet. Start with the course catalog.",
        recommendationGateTitle: "Complete onboarding to unlock recommendations.",
        recommendationGateBody: "Your dashboard recommendations now wait for your post-login onboarding answers so cold-start suggestions use current interests, category choices, readiness, and skill signals.",
        recommendationActivityTitle: "Personalized recommendations unlock after learning activity.",
        recommendationActivityBody: "Complete your onboarding preferences or start a module and your dashboard will surface next-step course suggestions here.",
        personalizedRecommendations: "Personalized Recommendations",
        triggeredByActivity: "Triggered by your dashboard activity",
        drivenByProfile: "Driven by your onboarding profile",
        beginnerDefaults: "Using beginner-friendly defaults",
        learnersEnrolled: (count: number) => `${count || 0} learners enrolled`,
        assignedTrainer: (name: string) => `Assigned trainer: ${name}`,
        assessmentNeedEvidenceTitle: "Assessment-only recommendations need scored assessment evidence.",
        assessmentNeedEvidenceBody: "Finish a graded assessment and this advisory mode will suggest courses using only score bands, strongest topics, weakest topics, and failed competencies.",
        assessmentOnlyAdvisory: "Assessment-Only Advisory",
        strongestTopic: "Strongest topic",
        weakestTopic: "Weakest topic",
        failedCompetencies: "Failed competencies",
        notEnoughEvidence: "Not enough evidence yet",
        noClearFocus: "No clear focus area yet",
        noFailedClusters: "No failed competency clusters",
        learningPerformanceSummary: "Learning Performance Summary",
        learningPerformanceSummaryBody: "Assessment scores, module completion activity, tracked learning time, and topic-level results from your enrolled courses.",
        liveLearningAnalytics: "Live dashboard learning analytics",
        learningSummaryEmptyTitle: "Your learning summary will appear here as you progress.",
        learningSummaryEmptyBody: "Complete modules and submit assessments to unlock score trends, topic insights, and time-spent analytics.",
        noGradedResultYet: "No graded result yet",
        continueLearningButton: "Continue Learning",
        noActiveCoursesTitle: "You have no active in-progress courses right now.",
        noActiveCoursesBody: "Review released certificates or enroll in another course if you want a new next step on the dashboard.",
        noEnrollmentsTitle: "You have not enrolled in any courses yet.",
        noEnrollmentsBody: "Start with the course catalog, then come back here to resume modules and review progress.",
      };

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
        const visibleCourses = filterCoursesForUser(allCourses, user);

        const coursesWithEnrollments = enrollments
          .map((enrollment) => {
            const course = visibleCourses.find((candidate) => candidate.id === enrollment.courseId);
            return course ? { ...course, enrollment } : null;
          })
          .filter((course): course is Course & { enrollment: Enrollment } => course !== null);

        const completed = coursesWithEnrollments.filter((course) => course.enrollment.status === "completed");
        const inProgress = coursesWithEnrollments.filter((course) => course.enrollment.status !== "completed").slice(0, 3);

        setAllCourses(visibleCourses);
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
        setCollaborativeSignals({});
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

  const learnerPathRecommendations = useMemo<LearnerCareerPathRecommendation[]>(() => {
    return buildLearnerCareerPathRecommendations(user, allCourses, allEnrollments, performanceSummary, 3);
  }, [allCourses, allEnrollments, performanceSummary, user]);

  const hasRecommendationContext = hasOnboardingSignals || hasLearningHistory;

  const recommendationHeadline = (() => {
    if (!performanceSummary) {
      return copy.discoverTitle;
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

    return copy.discoverTitle;
  })();

  const recommendationDescription = (() => {
    if (!performanceSummary) {
      return copy.discoverBody;
    }

    if (performanceSummary.needsImprovementTopic?.topic && performanceSummary.strongestTopic?.topic) {
      return `These picks balance your strong ${performanceSummary.strongestTopic.topic} results with support for ${performanceSummary.needsImprovementTopic.topic}.`;
    }

    if (performanceSummary.strongestTopic?.topic) {
      return `These picks extend the momentum you are building in ${performanceSummary.strongestTopic.topic}.`;
    }

    return copy.discoverBody;
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
        description: verificationFeedback?.description || "Your learner account must be verified before course enrollment opens.",
        href: "/courses",
        label: copy.browseCourses,
        state: undefined,
      }
    : lastAccessedModule
    ? {
        title: "Resume your latest module",
        description: `${lastAccessedModule.moduleTitle || "Latest module"} in ${lastAccessedModule.courseTitle || "your course"} was last opened ${formatActivityTime(lastAccessedModule.lastSeenAt)}.`,
        href: `/courses/${lastAccessedModule.courseId}`,
        label: copy.resumeLearning,
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
          label: copy.continueCourse,
          state: {
            entrySource: "dashboard_primary_course",
          },
        }
      : {
          title: "Start your first course",
          description:
            "You do not have an active course yet. Browse training paths and begin with a course that matches your goals.",
          href: "/courses",
          label: copy.browseCourses,
          state: undefined,
        };

  const renderRecommendedCourses = () => {
    if (loadingCourses || loadingPerformance) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      );
    }

    if (!hasCompletedOnboarding) {
      return (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">{copy.discoverLockedTitle}</p>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{copy.recommendationGateBody}</p>
            </div>
            <Button onClick={() => setShowOnboardingModal(true)} className="h-12 rounded-xl px-6 text-base font-semibold">
              {copy.completeOnboarding}
            </Button>
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
              <p className="font-medium">{copy.recommendationActivityTitle}</p>
              <p className="text-sm text-muted-foreground">{copy.recommendationActivityBody}</p>
            </div>
            <Button asChild>
              <Link to="/courses">{copy.browseCourses}</Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (recommendedCourses.length === 0) {
      return (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <Sparkles className="h-10 w-10 text-primary/70 mx-auto" />
            <div>
              <p className="font-medium">{copy.notEnoughEvidence}</p>
              <p className="text-sm text-muted-foreground">{copy.assessmentNeedEvidenceBody}</p>
            </div>
            <Button asChild>
              <Link to="/courses">{copy.browseCourses}</Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <section className="space-y-4 rounded-[1.5rem] border border-border bg-[linear-gradient(135deg,rgba(15,118,110,0.06)_0%,rgba(29,78,216,0.06)_100%)] p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-[0.18em]">{copy.personalizedRecommendations}</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">{recommendationHeadline}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{recommendationDescription}</p>
          </div>
          <Badge variant="outline" className="w-fit rounded-full bg-background/80 px-3 py-1 text-xs font-semibold">
            {hasLearningHistory ? copy.triggeredByActivity : copy.drivenByProfile}
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {recommendedCourses.map(({ course, reasons }) => (
            <Card key={course.id} className="overflow-hidden border-border/80 bg-background/95 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.4)]">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary">
                    {course.level}
                  </Badge>
                  {course.isTESDAAccredited ? (
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold">
                      <Award className="mr-1 h-3 w-3" />
                      TESDA
                    </Badge>
                  ) : null}
                </div>
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
                    <span>{copy.learnersEnrolled(course.enrolledCount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span>{course.category}</span>
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
                  <Button className="flex-1" asChild>
                    <Link to="/courses">{copy.browseCourses}</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to={`/courses/${course.id}`}>{copy.preview}</Link>
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
              {copy.learningPerformanceSummary}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              {copy.learningPerformanceSummaryBody}
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">
            {copy.liveLearningAnalytics}
          </Badge>
        </div>

        {!hasPerformanceData ? (
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <p className="font-medium">{copy.learningSummaryEmptyTitle}</p>
                <p className="text-sm text-muted-foreground">
                  {copy.learningSummaryEmptyBody}
                </p>
              </div>
              <Button asChild>
                <Link to="/courses">{copy.continueLearningButton}</Link>
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
                  <CardTitle className="text-sm font-medium">{copy.totalLearningTime}</CardTitle>
                  <Clock3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatLearningTime(performanceSummary.totalLearningMinutes)}</div>
                  <p className="text-xs text-muted-foreground">{language === "tl" ? "Pinagsamang tracked time ng module at assessment" : "Combined module and assessment time tracked"}</p>
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
                                <p className="text-muted-foreground">{language === "tl" ? "Resulta ng assessment" : "Assessment result"}</p>
                                <p className="font-medium">
                                  {topic.averageScore !== null ? `${topic.averageScore}% average` : copy.noGradedResultYet}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">{language === "tl" ? "Oras ng pag-aaral" : "Learning time"}</p>
                                <p className="font-medium">{formatLearningTime(topic.totalTimeSpentMinutes)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">{language === "tl" ? "Record ng completion" : "Completion record"}</p>
                                <p className="font-medium">{language === "tl" ? `${topic.modulesCompleted} modules ang natapos` : `${topic.modulesCompleted} modules completed`}</p>
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
                  <CardTitle>{language === "tl" ? "Mga Record ng Natapos na Module" : "Module Completion Records"}</CardTitle>
                  <CardDescription>{language === "tl" ? "Ang pinakabago mong natapos na learning modules." : "Your most recent completed learning modules."}</CardDescription>
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
                    <p className="text-sm text-muted-foreground">{language === "tl" ? "Tapusin ang mga module para makita ang pinakabago mong completion records." : "Complete modules to see your latest completion records."}</p>
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
          onDismiss={() => undefined}
          onCompleted={(summary) => {
            void handleOnboardingCompleted(summary);
          }}
        />

        {!hasCompletedOnboarding ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">{copy.postLoginTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {copy.postLoginBody}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setShowOnboardingModal(true)}>{copy.completeOnboarding}</Button>
                <Button asChild variant="outline">
                  <Link to="/courses">{copy.browseCourses}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : latestOnboardingSummary ? (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>{copy.onboardingCompletedTitle}</AlertTitle>
            <AlertDescription>
              {copy.onboardingCompletedBody(latestOnboardingSummary.generatedRecommendationCount)}
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="overflow-hidden border-primary/15 bg-card">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col gap-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="w-fit rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                    {copy.workspaceBadge}
                  </Badge>
                  <TraineeVerificationBadge status={user.verificationStatus} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{copy.welcome(user.name)}</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                    {copy.welcomeBody}
                  </p>
                </div>
              </div>

              {verificationFeedback ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{verificationFeedback.title}</AlertTitle>
                  <AlertDescription>{verificationFeedback.description}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={primaryAction.href} state={primaryAction.state}>
                    {primaryAction.label}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={verificationBlocked ? "/profile" : "/progress"}>
                    {verificationBlocked ? (user.verificationStatus === "rejected" ? copy.updateProfile : copy.openProfile) : copy.viewProgress}
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={dashboardTab} onValueChange={(value) => setDashboardTab(value as DashboardTab)} className="space-y-6">
          <div className="rounded-3xl border border-border/70 bg-card p-2">
            <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-2">
              <TabsTrigger value="continue" className="rounded-2xl px-4 py-3 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {copy.tabs.continue}
              </TabsTrigger>
              <TabsTrigger value="review" className="rounded-2xl px-4 py-3 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {copy.tabs.review}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="continue" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Clock3 className="h-5 w-5 text-primary" />
                    {copy.lastAccessedTitle}
                  </CardTitle>
                  <CardDescription>
                    {copy.lastAccessedBody}
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
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{copy.lastOpened}</p>
                        <p className="mt-2 text-sm font-medium">{formatActivityTime(lastAccessedModule.lastSeenAt)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{copy.latestSession}</p>
                        <p className="mt-2 text-sm font-medium">{formatSessionDuration(lastAccessedModule.durationSeconds)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{copy.resumePoint}</p>
                        <p className="mt-2 text-sm font-medium">
                          {typeof lastAccessedModule.resumePositionSeconds === "number" && lastAccessedModule.resumePositionSeconds > 0
                            ? formatSessionDuration(lastAccessedModule.resumePositionSeconds)
                            : copy.startCurrentModule}
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
                          {copy.continueModule}
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link to="/progress">{copy.viewSessionHistory}</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 py-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      {copy.recentActivityEmpty}
                    </p>
                    <Button asChild variant="outline">
                      <Link to="/courses">{copy.browseCourses}</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{copy.myCourses}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{copy.myCoursesBody}</p>
                </div>
                <Button asChild variant="outline">
                  <Link to="/courses">{copy.viewAll}</Link>
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
                      const isAwaitingApproval = course.enrollment.completionApprovalStatus === "pending" && !isCompleted;
                      return (
                        <Card
                          key={course.id}
                          className={`flex h-full flex-col overflow-hidden border-border/80 bg-background/95 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.4)] ${
                            isCompleted ? "border-green-200 dark:border-green-900/30" : ""
                          }`}
                        >
                          <div className="aspect-[16/9] overflow-hidden border-b bg-muted/40">
                            {course.thumbnail ? (
                              <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(15,118,110,0.12)_0%,rgba(29,78,216,0.12)_100%)] text-muted-foreground">
                                <div className="flex flex-col items-center gap-2">
                                  <BookOpen className="h-8 w-8" />
                                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">{course.category}</span>
                                </div>
                              </div>
                            )}
                          </div>
                          <CardHeader className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <Badge className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary">
                                {course.level}
                              </Badge>
                              {isCompleted ? (
                                <Badge variant="outline" className="shrink-0 rounded-full border-green-300 px-3 py-1 text-[11px] font-semibold text-green-600">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  {copy.completedLabel}
                                </Badge>
                              ) : isAwaitingApproval ? (
                                <Badge variant="secondary" className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold">
                                  {copy.finalizing}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold">
                                  {copy.inProgressLabel}
                                </Badge>
                              )}
                            </div>
                            <div>
                              <CardTitle className="line-clamp-2 text-xl">{course.title}</CardTitle>
                              <CardDescription className="mt-2 line-clamp-3">
                                {course.description || `${course.category} • ${getOfficialHoursCreditLabel(course.duration)}`}
                              </CardDescription>
                            </div>
                          </CardHeader>
                          <CardContent className="flex flex-1 flex-col space-y-4">
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
                                <TrendingUp className="h-4 w-4" />
                                <span>{course.enrollment.progress}% complete</span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-medium">{course.enrollment.progress}%</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full transition-all ${isCompleted ? "bg-green-600" : "bg-primary"}`}
                                  style={{ width: `${course.enrollment.progress}%` }}
                                />
                              </div>
                            </div>

                            {isAwaitingApproval ? (
                              <p className="rounded-full bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                                {copy.waitingApproval}
                              </p>
                            ) : null}

                            <div className="mt-auto flex gap-3 pt-2">
                              {isCompleted ? (
                                <Button className="flex-1" asChild variant="secondary">
                                  <Link to="/certificates">{copy.viewCertificate}</Link>
                                </Button>
                              ) : (
                                <Button className="flex-1" asChild>
                                  <Link to={`/courses/${course.id}`} state={{ entrySource: "dashboard_continue_learning" }}>
                                    {copy.continueLearningButton}
                                  </Link>
                                </Button>
                              )}
                              <Button variant="outline" asChild>
                                <Link to="/progress">{copy.viewProgress}</Link>
                              </Button>
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
                            <p className="text-muted-foreground mb-2">{copy.noActiveCoursesTitle}</p>
                            <p className="text-sm text-muted-foreground mb-4 max-w-xl">
                              {copy.noActiveCoursesBody}
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <Button asChild variant="outline">
                                <Link to="/certificates">View Certificates</Link>
                              </Button>
                              <Button asChild>
                                <Link to="/courses">{copy.browseCourses}</Link>
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-muted-foreground mb-2">{copy.noEnrollmentsTitle}</p>
                            <p className="text-sm text-muted-foreground mb-4 max-w-xl">
                              {copy.noEnrollmentsBody}
                            </p>
                            <Button asChild>
                              <Link to="/courses">{copy.browseCourses}</Link>
                            </Button>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="review" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{copy.reviewActionsTitle}</CardTitle>
                <CardDescription>{copy.reviewActionsBody}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/progress">{copy.viewProgress}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={completedCourses.length > 0 ? "/certificates" : "/courses"}>
                    {completedCourses.length > 0 ? copy.viewCertificates : copy.browseCourses}
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-3 md:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.enrolled}</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.enrolledCourses}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.enrolledBody}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.completed}</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.completedCourses}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.completedBody}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.profileSignals}</p>
                  <p className="mt-2 text-3xl font-semibold">{profileSignalCoverage}%</p>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.profileSignalsBody}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Learning Snapshot</CardTitle>
                <CardDescription>Keep the top-level review lightweight, then open the deeper detail only when you need it.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  {progressIndicators.slice(0, 3).map((indicator) => {
                    const Icon = indicator.icon;

                    return (
                      <div key={indicator.label} className="rounded-2xl border border-border/70 bg-background/60 p-4">
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

                <Accordion type="single" collapsible className="rounded-2xl border border-border/70 px-4">
                  <AccordionItem value="detail" className="border-none">
                    <AccordionTrigger className="py-4 text-left text-base font-semibold hover:no-underline">
                      {language === "tl" ? "Buksan ang Detalyadong Learning Insights" : "Open Detailed Learning Insights"}
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-5">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                          <p className="text-sm text-muted-foreground">Recent activity</p>
                          <p className="mt-3 text-2xl font-semibold">{progressIndicators[3]?.value || (language === "tl" ? "Wala pang kamakailang activity" : "No recent activity")}</p>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">{progressIndicators[3]?.helper || (language === "tl" ? "Tapusin ang learning activities para mabuo ang history mo." : "Complete learning activities to build your history.")}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                          <p className="text-sm text-muted-foreground">{language === "tl" ? "Topic signals" : "Topic signals"}</p>
                          <p className="mt-3 text-lg font-semibold">{performanceSummary?.strongestTopic?.topic || (language === "tl" ? "Magdagdag pa ng history" : "Build more history")}</p>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            {performanceSummary?.needsImprovementTopic?.topic
                              ? (language === "tl" ? `Kasalukuyang focus area: ${performanceSummary.needsImprovementTopic.topic}` : `Current focus area: ${performanceSummary.needsImprovementTopic.topic}`)
                              : (language === "tl" ? "Tapusin pa ang learning activity para lumitaw ang isang maaasahang focus area." : "Finish more learning activity to surface a reliable focus area.")}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                          <p className="text-sm text-emerald-700 dark:text-emerald-300">
                            {language === "tl" ? "Mga lakas" : "Strengths"}
                          </p>
                          <p className="mt-3 text-lg font-semibold text-emerald-950 dark:text-emerald-100">
                            {performanceSummary?.strongestTopic?.topic || (language === "tl" ? "Wala pang malinaw na lakas" : "No clear strength yet")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-emerald-800/80 dark:text-emerald-200/80">
                            {performanceSummary?.strongestTopic?.averageScore !== null && performanceSummary?.strongestTopic
                              ? (language === "tl"
                                ? `${performanceSummary.strongestTopic.averageScore}% ang average score mo rito, kaya magandang pundasyon ito para sa susunod mong kurso.`
                                : `Your ${performanceSummary.strongestTopic.averageScore}% average score here makes this a solid foundation for your next course.`)
                              : (language === "tl"
                                ? "Tapusin ang mas marami pang scored assessments para lumitaw ang pinaka-malakas mong skill area."
                                : "Complete more scored assessments to surface your strongest skill area.")}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            {language === "tl" ? "Mga kailangang pagbutihin" : "Areas to improve"}
                          </p>
                          <p className="mt-3 text-lg font-semibold text-amber-950 dark:text-amber-100">
                            {performanceSummary?.needsImprovementTopic?.topic || (language === "tl" ? "Wala pang focus area" : "No focus area yet")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-amber-800/80 dark:text-amber-200/80">
                            {performanceSummary?.needsImprovementTopic?.averageScore !== null && performanceSummary?.needsImprovementTopic
                              ? (language === "tl"
                                ? `${performanceSummary.needsImprovementTopic.averageScore}% ang average score mo rito. Magandang unahin ito sa susunod mong practice at assessment review.`
                                : `Your ${performanceSummary.needsImprovementTopic.averageScore}% average score here makes this the best area to prioritize in your next practice and assessment review.`)
                              : (language === "tl"
                                ? "Kapag may sapat nang scored topics, dito lalabas ang skill area na dapat mong tutukan."
                                : "Once you have enough scored topics, this is where your highest-priority support area will appear.")}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {language === "tl" ? "Mga rekomendadong industry at career path" : "Recommended industries and career paths"}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {language === "tl"
                              ? "Nakabatay ang mga direksyong ito sa iyong interests, topic performance, at mga kursong pinakamalapit sa kasalukuyan mong learner profile."
                              : "These directions are based on your interests, topic performance, and the courses that currently match your learner profile most closely."}
                          </p>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-3">
                          {learnerPathRecommendations.map((recommendation) => (
                            <div key={`${recommendation.type}-${recommendation.title}`} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold">
                                {recommendation.type === "industry"
                                  ? (language === "tl" ? "Industry" : "Industry")
                                  : (language === "tl" ? "Career path" : "Career path")}
                              </Badge>
                              <p className="mt-3 font-semibold">{recommendation.title}</p>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.description}</p>
                              <p className="mt-3 text-xs leading-5 text-muted-foreground">{recommendation.rationale}</p>
                              {recommendation.supportingCourses.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {recommendation.supportingCourses.map((courseTitle) => (
                                    <Badge key={courseTitle} variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
                                      {courseTitle}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {(performanceSummary?.topicPerformance || []).slice(0, 4).map((topic) => (
                          <div key={topic.topic} className="rounded-xl border border-border/60 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-semibold">{topic.topic}</p>
                                <p className="text-sm text-muted-foreground">
                                  {language === "tl"
                                    ? `${topic.assessmentsTaken} assessment${topic.assessmentsTaken === 1 ? "" : "s"} at ${topic.modulesCompleted} natapos na module${topic.modulesCompleted === 1 ? "" : "s"}`
                                    : `${topic.assessmentsTaken} assessment${topic.assessmentsTaken === 1 ? "" : "s"} and ${topic.modulesCompleted} module completion${topic.modulesCompleted === 1 ? "" : "s"}`}
                                </p>
                              </div>
                              <Badge variant="outline">
                                {topic.averageScore !== null
                                  ? (language === "tl" ? `${topic.averageScore}% average` : `${topic.averageScore}% average`)
                                  : copy.noGradedResultYet}
                              </Badge>
                            </div>
                          </div>
                        ))}

                        {!performanceSummary?.topicPerformance?.length ? (
                          <p className="text-sm text-muted-foreground">
                            {language === "tl"
                              ? "Lalabas ang topic-level insights pagkatapos mong makumpleto ang mas marami pang learning activity."
                              : "Topic-level insights will appear after you complete more learning activity."}
                          </p>
                        ) : null}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

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
          </TabsContent>
        </Tabs>

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

