import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  PieChart,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { courseService, enrollmentService } from "@/services/supabaseDatabaseService";
import { progressTrackingService, type CourseProgress, type ProgressStats } from "@/services/progressTrackingService";
import { moduleSessionService, type EnrichedModuleSession } from "@/services/moduleSessionService";
import { filterCoursesForUser } from "@/lib/courseAudience";
import { Course, Enrollment } from "@/types";
import {
  buildLearnerCareerPathRecommendations,
  reportingService,
  type LearnerCareerPathRecommendation,
  type LearnerPerformanceSummary,
} from "@/services/reportingService";

const COLORS = ["#1e40af", "#059669"];

const ProgressDashboard = () => {
  const { user } = useAuth();
  const { language } = useLocale();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [allSessionsModalOpen, setAllSessionsModalOpen] = useState(false);
  const [detailedStats, setDetailedStats] = useState<ProgressStats | null>(null);
  const [performanceSummary, setPerformanceSummary] = useState<LearnerPerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [recentSessions, setRecentSessions] = useState<EnrichedModuleSession[]>([]);
  const copy = language === "tl"
    ? {
        never: "Hindi pa",
        noRecentActivity: "Wala pang kamakailang activity",
        progressDashboard: "Progress dashboard",
        heroTitle: "Suriin ang progreso nang hindi iniiwan ang susunod mong hakbang",
        heroBody: "Ang page na ito ay para na ngayon sa review: official course hours, kamakailang learning activity, at detalye ng completion bawat kurso. Gamitin ang course page kapag handa ka nang magpatuloy sa pag-aaral.",
        primaryNextStep: "Pangunahing susunod na hakbang",
        backToDashboard: "Bumalik sa dashboard",
        whatThisPageShows: "Ano ang ipinapakita ng page na ito ngayon",
        whatThisPageShowsBody: "Ginagamit ang official course duration para sa learner-facing totals para manatiling outcome-focused ang completion sa halip na time-pressure focused.",
        officialHours: "Opisyal na oras",
        officialHoursBody: "Ang kabuuang oras sa page na ito ay sumusunod sa course duration na itinakda ng training team.",
        detailedReview: "Detalyadong review",
        detailedReviewBody: "Gamitin ang View Details sa anumang course card para magbukas ng modal na may module-level progress at tracked session history.",
        totalCourses: "Kabuuang Kurso",
        enrolledCourses: "Mga naka-enroll na kurso",
        completed: "Natapos",
        coursesFinished: "Mga natapos na kurso",
        officialHoursStatBody: "Nakasaad na course hours sa lahat ng iyong enrollment",
        averageProgress: "Karaniwang Progreso",
        averageCompletion: "Karaniwang completion",
        courseProgress: "Progreso ng Kurso",
        courseProgressBody: "Gamitin ang malinaw na progress bars sa halip na chart kapag kailangan mo ng mabilis na status bawat kurso.",
        modulesCompleted: (done: number, total: number) => `${done}/${total} modules completed`,
        progress: "Progreso",
        emptyProgressBody: "Lalabas dito ang progress bars pagkatapos mong mag-enroll sa mga kurso at magsimulang tapusin ang mga module.",
        browseCourses: "Tingnan ang mga kurso",
        completionStatus: "Estado ng Completion",
        completionStatusBody: "Mga natapos kumpara sa mga enrollment na kasalukuyang ginagawa",
        completionStatusEmptyBody: "Lalabas ang completion status pagkatapos mong mag-enroll sa mga kurso at magsimulang bumuo ng progress history.",
        recentLearningSessions: "Kamakailang Learning Sessions",
        recentLearningSessionsBody: "Ang pinakabago mong mga pagbisita sa module, kasama ang tracked session duration at direktang resume action.",
        seeAll: "Tingnan lahat",
        lastOpened: "Huling binuksan",
        resumeModule: "Ipagpatuloy ang Module",
        recentSessionEmpty: "Lalabas dito ang kamakailang session history pagkatapos mong magbukas ng mga module mula sa iyong mga enrolled na kurso.",
        openDashboard: "Buksan ang dashboard",
        courses: "Mga Kurso",
        coursesBody: "Magbukas ng detail modal kapag kailangan mo ng breakdown ng progreso bawat kurso.",
        modules: "modules",
        lastActive: "Huling aktibo",
        viewDetails: "Tingnan ang Detalye",
        noCoursesEnrolledYet: "Wala ka pang naka-enroll na kurso",
        noCoursesEnrolledBody: "Mag-enroll muna sa isang kurso. Pagkatapos nito, ang page na ito ang magsisilbing review surface mo para sa opisyal na oras, recent activity, at detalyadong progreso ng kurso.",
        updateProfile: "I-update ang profile",
        courseProgressDetails: "Mga detalye ng progreso ng kurso",
        courseProgressDetailsBody: "Ipinapakita na ngayon ang detalyadong progreso sa isang modal para masuri mo ang breakdown ng module nang hindi umaalis sa page.",
        trackedSessionTime: "Tracked Session Time",
        averageTimePerModule: "Karaniwang Oras bawat Module",
        lastActivity: "Huling Activity",
        trackedSessionTimeByModule: "Tracked Session Time bawat Module",
        trackedTimeLegend: "Tracked time (minutes)",
        moduleProgress: "Progreso ng Module",
        inProgress: "Kasalukuyang ginagawa",
        done: "Tapos",
        noDetailedProgress: "Wala pang available na detalyadong progress data para sa kursong ito.",
        learningSessionHistory: "Kasaysayan ng Learning Session",
        learningSessionHistoryBody: "Suriin ang iyong mga kamakailang learning session sa iisang lugar, pagkatapos ay bumalik sa alinmang module kapag handa ka na.",
        noSessionHistory: "Wala pang available na session history.",
        untitledModule: "Walang pamagat na module",
        untitledCourse: "Walang pamagat na kurso",
        continueLearning: "Ipagpatuloy ang Pag-aaral",
      }
    : {
        never: "Never",
        noRecentActivity: "No recent activity",
        progressDashboard: "Progress dashboard",
        heroTitle: "Review progress without leaving your next step",
        heroBody: "This page is now for review: official course hours, recent learning activity, and course-by-course completion detail. Use the course page when you are ready to continue learning.",
        primaryNextStep: "Primary next step",
        backToDashboard: "Back to dashboard",
        whatThisPageShows: "What this page shows now",
        whatThisPageShowsBody: "Official course duration is used for learner-facing totals so completion stays outcome-focused instead of time-pressure focused.",
        officialHours: "Official hours",
        officialHoursBody: "Total hours on this page follow the course duration set by the training team.",
        detailedReview: "Detailed review",
        detailedReviewBody: "Use View Details on any course card to open a modal with module-level progress and tracked session history.",
        totalCourses: "Total Courses",
        enrolledCourses: "Enrolled courses",
        completed: "Completed",
        coursesFinished: "Courses finished",
        officialHoursStatBody: "Stated course hours across your enrollments",
        averageProgress: "Avg Progress",
        averageCompletion: "Average completion",
        courseProgress: "Course Progress",
        courseProgressBody: "Use readable progress bars instead of a chart when you need quick course-by-course status.",
        modulesCompleted: (done: number, total: number) => `${done}/${total} modules completed`,
        progress: "Progress",
        emptyProgressBody: "Progress bars appear here after you enroll in courses and start completing modules.",
        browseCourses: "Browse courses",
        completionStatus: "Completion Status",
        completionStatusBody: "Completed versus in-progress enrollments",
        completionStatusEmptyBody: "Completion status will appear after you enroll in courses and begin building progress history.",
        recentLearningSessions: "Recent Learning Sessions",
        recentLearningSessionsBody: "Your latest module visits, including tracked session duration and a direct resume action.",
        seeAll: "See all",
        lastOpened: "Last opened",
        resumeModule: "Resume Module",
        recentSessionEmpty: "Recent session history will appear here after you open modules from your enrolled courses.",
        openDashboard: "Open dashboard",
        courses: "Courses",
        coursesBody: "Open a detail modal when you need course-by-course progress breakdown.",
        modules: "modules",
        lastActive: "Last active",
        viewDetails: "View Details",
        noCoursesEnrolledYet: "No courses enrolled yet",
        noCoursesEnrolledBody: "Enroll in a course first. Then this page becomes your review surface for official hours, recent activity, and course progress detail.",
        updateProfile: "Update profile",
        courseProgressDetails: "Course progress details",
        courseProgressDetailsBody: "Detailed progress is shown in a modal now so you can review module breakdown without leaving the page.",
        trackedSessionTime: "Tracked Session Time",
        averageTimePerModule: "Average Time per Module",
        lastActivity: "Last Activity",
        trackedSessionTimeByModule: "Tracked Session Time by Module",
        trackedTimeLegend: "Tracked time (minutes)",
        moduleProgress: "Module Progress",
        inProgress: "In Progress",
        done: "Done",
        noDetailedProgress: "No detailed progress data is available for this course yet.",
        learningSessionHistory: "Learning Session History",
        learningSessionHistoryBody: "Review your recent learning sessions in one place, then jump back into any module when you are ready.",
        noSessionHistory: "No session history is available yet.",
        untitledModule: "Untitled module",
        untitledCourse: "Untitled course",
        continueLearning: "Continue Learning",
      };

  useEffect(() => {
    if (user) {
      void loadProgress();
    }
  }, [user]);

  useEffect(() => {
    if (!selectedEnrollment || !detailModalOpen) {
      return;
    }

    void loadDetailedStats(selectedEnrollment);
  }, [detailModalOpen, selectedEnrollment]);

  const loadProgress = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [myEnrollments, progress, sessionCards, courses, learnerPerformanceSummary] = await Promise.all([
        enrollmentService.getEnrollments(user.id),
        progressTrackingService.getUserCourseProgress(user.id),
        moduleSessionService.getUserRecentSessionCards(user.id, 20),
        courseService.getCourses(),
        reportingService.getLearnerPerformanceSummary(user.id),
      ]);

      setEnrollments(myEnrollments);
      setAllCourses(filterCoursesForUser(courses, user));
      setCourseProgress(progress);
      setPerformanceSummary(learnerPerformanceSummary);
      setRecentSessions(sessionCards);

      if (myEnrollments.length > 0 && !selectedEnrollment) {
        setSelectedEnrollment(myEnrollments[0].id);
      }
    } catch (error) {
      console.error("Error loading progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadDetailedStats = async (enrollmentId: string) => {
    setLoadingDetail(true);
    try {
      const stats = await progressTrackingService.getProgressStats(enrollmentId);
      setDetailedStats(stats);
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatTrackedTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  };

  const formatOfficialHours = (hours: number) => {
    if (hours <= 0) return "0h";
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return copy.never;
    return new Date(dateString).toLocaleDateString(language === "tl" ? "fil-PH" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatRelativeDateTime = (dateString: string | null) => {
    if (!dateString) return copy.noRecentActivity;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return copy.noRecentActivity;

    const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
    const absoluteSeconds = Math.abs(diffSeconds);
    const formatter = new Intl.RelativeTimeFormat(language === "tl" ? "fil" : "en", { numeric: "auto" });

    if (absoluteSeconds < 60) {
      return formatter.format(Math.round(diffSeconds), "second");
    }

    if (absoluteSeconds < 3600) {
      return formatter.format(Math.round(diffSeconds / 60), "minute");
    }

    if (absoluteSeconds < 86400) {
      return formatter.format(Math.round(diffSeconds / 3600), "hour");
    }

    if (absoluteSeconds < 604800) {
      return formatter.format(Math.round(diffSeconds / 86400), "day");
    }

    return formatter.format(Math.round(diffSeconds / 604800), "week");
  };

  const overallStats = useMemo(() => ({
    totalCourses: courseProgress.length,
    completedCourses: courseProgress.filter((course) => course.progress === 100).length,
    totalOfficialHours: courseProgress.reduce((sum, course) => sum + course.officialDurationHours, 0),
    averageProgress:
      courseProgress.length > 0
        ? Math.round(courseProgress.reduce((sum, course) => sum + course.progress, 0) / courseProgress.length)
        : 0,
  }), [courseProgress]);

  const progressChartData = useMemo(() => courseProgress.map((course) => ({
    name: course.courseTitle.length > 20 ? `${course.courseTitle.substring(0, 20)}...` : course.courseTitle,
    progress: course.progress,
    officialHours: course.officialDurationHours,
  })), [courseProgress]);

  const completionPieData = useMemo(() => [
    { name: copy.completed, value: overallStats.completedCourses, color: COLORS[1] },
    { name: copy.inProgress, value: overallStats.totalCourses - overallStats.completedCourses, color: COLORS[0] },
  ], [copy.completed, copy.inProgress, overallStats.completedCourses, overallStats.totalCourses]);

  const selectedCourseProgress = useMemo(() => {
    const enrollment = enrollments.find((item) => item.id === selectedEnrollment);
    if (!enrollment) return null;
    return courseProgress.find((item) => item.courseId === enrollment.courseId) || null;
  }, [courseProgress, enrollments, selectedEnrollment]);

  const learnerPathRecommendations = useMemo<LearnerCareerPathRecommendation[]>(() => {
    return buildLearnerCareerPathRecommendations(user, allCourses, enrollments, performanceSummary, 3);
  }, [allCourses, enrollments, performanceSummary, user]);

  const visibleRecentSessions = recentSessions.slice(0, 5);

  const primaryAction = recentSessions[0]
    ? {
        title: "Resume your most recent module",
        description: `${recentSessions[0].moduleTitle || "Latest module"} in ${recentSessions[0].courseTitle || "your course"} was opened ${formatRelativeDateTime(recentSessions[0].lastSeenAt)}.`,
        href: `/courses/${recentSessions[0].courseId}`,
        label: "Resume module",
        state: { entrySource: "progress_dashboard_primary_resume", moduleId: recentSessions[0].moduleId },
      }
    : courseProgress[0]
      ? {
          title: language === "tl" ? "Ipagpatuloy ang kasalukuyan mong kurso" : "Continue your current course",
          description: language === "tl"
            ? `${courseProgress[0].courseTitle} ay ${courseProgress[0].progress}% nang tapos. Gamitin ang detailed view kapag kailangan mo ng history, hindi kapag gusto mo lang magpatuloy.`
            : `${courseProgress[0].courseTitle} is ${courseProgress[0].progress}% complete. Use the detailed view when you need history, not when you just need to continue.`,
          href: `/courses/${courseProgress[0].courseId}`,
          label: copy.continueLearning,
          state: { entrySource: "progress_dashboard_primary_course" },
        }
      : {
          title: language === "tl" ? "Simulan ang pagbuo ng iyong progress history" : "Start building your progress history",
          description: language === "tl"
            ? "Mag-enroll sa una mong kurso para maipakita ng page na ito ang detalye ng completion, official course hours, at recent activity."
            : "Enroll in your first course so this page can show completion detail, official course hours, and recent activity.",
          href: "/courses",
          label: copy.browseCourses,
          state: undefined,
        };

  const openDetailModal = (enrollmentId: string) => {
    setSelectedEnrollment(enrollmentId);
    setDetailModalOpen(true);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardContent className="space-y-4 p-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-72 max-w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-3 p-6">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="space-y-3 p-6">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden border-primary/15 bg-card">
            <CardContent className="space-y-5 p-6 sm:p-7">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{copy.progressDashboard}</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight">{copy.heroTitle}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  {copy.heroBody}
                </p>
              </div>

              <div className="rounded-3xl border border-primary/15 bg-background/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{copy.primaryNextStep}</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{primaryAction.title}</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{primaryAction.description}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to={primaryAction.href} state={primaryAction.state}>{primaryAction.label}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/dashboard">{copy.backToDashboard}</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{copy.whatThisPageShows}</CardTitle>
              <CardDescription>{copy.whatThisPageShowsBody}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="font-medium">{copy.officialHours}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.officialHoursBody}</p>
              </div>
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="font-medium">{copy.detailedReview}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.detailedReviewBody}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{copy.totalCourses}</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.totalCourses}</div>
              <p className="text-xs text-muted-foreground">{copy.enrolledCourses}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{copy.completed}</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.completedCourses}</div>
              <p className="text-xs text-muted-foreground">{copy.coursesFinished}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{copy.officialHours}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatOfficialHours(overallStats.totalOfficialHours)}</div>
              <p className="text-xs text-muted-foreground">{copy.officialHoursStatBody}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{copy.averageProgress}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.averageProgress}%</div>
              <p className="text-xs text-muted-foreground">{copy.averageCompletion}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{language === "tl" ? "Mga lakas, kahinaan, at susunod na direksyon" : "Strengths, focus areas, and next directions"}</CardTitle>
            <CardDescription>
              {language === "tl"
                ? "Pinagsasama rito ang assessment performance, learner interests, at recommended course matches para makita mo kung saan ka malakas at kung anong industry o career path ang puwedeng sundan."
                : "This combines assessment performance, learner interests, and recommended course matches so you can see where you are strongest and which industries or career paths fit next."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <p className="text-sm text-emerald-700 dark:text-emerald-300">{language === "tl" ? "Mga lakas" : "Strengths"}</p>
                <p className="mt-3 text-xl font-semibold text-emerald-950 dark:text-emerald-100">
                  {performanceSummary?.strongestTopic?.topic || (language === "tl" ? "Wala pang malinaw na lakas" : "No clear strength yet")}
                </p>
                <p className="mt-2 text-sm leading-6 text-emerald-800/80 dark:text-emerald-200/80">
                  {performanceSummary?.strongestTopic?.averageScore !== null && performanceSummary?.strongestTopic
                    ? (language === "tl"
                      ? `${performanceSummary.strongestTopic.averageScore}% ang average score mo sa topic na ito, kaya magandang pundasyon ito para sa susunod mong learning step.`
                      : `Your ${performanceSummary.strongestTopic.averageScore}% average score in this topic makes it a strong foundation for your next learning step.`)
                    : (language === "tl"
                      ? "Tapusin ang mas marami pang scored assessments para lumitaw ang pinakamalakas mong skill area."
                      : "Complete more scored assessments to surface your strongest skill area.")}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-sm text-amber-700 dark:text-amber-300">{language === "tl" ? "Mga kailangang pagbutihin" : "Areas to improve"}</p>
                <p className="mt-3 text-xl font-semibold text-amber-950 dark:text-amber-100">
                  {performanceSummary?.needsImprovementTopic?.topic || (language === "tl" ? "Wala pang focus area" : "No focus area yet")}
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-800/80 dark:text-amber-200/80">
                  {performanceSummary?.needsImprovementTopic?.averageScore !== null && performanceSummary?.needsImprovementTopic
                    ? (language === "tl"
                      ? `${performanceSummary.needsImprovementTopic.averageScore}% ang average score mo rito. Unahin ito kung gusto mong mas mabilis na bumuti ang assessment results mo.`
                      : `Your ${performanceSummary.needsImprovementTopic.averageScore}% average score here makes it the best area to prioritize if you want faster assessment improvement.`)
                    : (language === "tl"
                      ? "Kapag may sapat nang scored topics, dito lalabas ang pangunahing area na dapat mong tutukan."
                      : "Once you have enough scored topics, your highest-priority support area will appear here.")}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="font-semibold">{language === "tl" ? "Mga rekomendadong industry at career path" : "Recommended industries and career paths"}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {language === "tl"
                    ? "Batay ang mga rekomendasyong ito sa learner profile mo, sa topic performance, at sa mga kursong pinakamalapit sa kasalukuyan mong direksyon."
                    : "These recommendations are based on your learner profile, topic performance, and the courses that best match your current direction."}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {learnerPathRecommendations.map((recommendation) => (
                  <div key={`${recommendation.type}-${recommendation.title}`} className="rounded-2xl border border-border/70 p-4">
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
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{copy.courseProgress}</CardTitle>
              <CardDescription>{copy.courseProgressBody}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {courseProgress.length > 0 ? (
                courseProgress.map((course) => (
                  <div key={course.courseId} className="rounded-2xl border border-border/70 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">{course.courseTitle}</p>
                        <p className="text-sm text-muted-foreground">
                          {copy.modulesCompleted(course.modulesCompleted, course.totalModules)}
                        </p>
                      </div>
                      <Badge variant={course.progress === 100 ? "default" : "secondary"}>{course.progress}%</Badge>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{copy.progress}</span>
                        <span className="font-medium">{course.progress}%</span>
                      </div>
                      <Progress value={course.progress} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <BarChart3 className="h-8 w-8 opacity-60" />
                  <p className="max-w-sm text-sm leading-6">{copy.emptyProgressBody}</p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/courses">{copy.browseCourses}</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{copy.completionStatus}</CardTitle>
              <CardDescription>{copy.completionStatusBody}</CardDescription>
            </CardHeader>
            <CardContent>
              {completionPieData[0].value + completionPieData[1].value > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Tooltip />
                    <Legend />
                    <Pie
                      data={completionPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {completionPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <PieChart className="h-8 w-8 opacity-60" />
                  <p className="max-w-sm text-sm leading-6">{copy.completionStatusEmptyBody}</p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/courses">{copy.browseCourses}</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{copy.recentLearningSessions}</CardTitle>
                  <CardDescription>{copy.recentLearningSessionsBody}</CardDescription>
                </div>
                {recentSessions.length > 5 ? (
                  <Button variant="outline" size="sm" onClick={() => setAllSessionsModalOpen(true)}>
                    {copy.seeAll}
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleRecentSessions.length > 0 ? (
                visibleRecentSessions.map((session) => (
                  <div key={session.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div>
                          <p className="font-semibold leading-tight">{session.moduleTitle || copy.untitledModule}</p>
                          <p className="text-sm text-muted-foreground">{session.courseTitle || copy.untitledCourse}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{copy.lastOpened} {formatRelativeDateTime(session.lastSeenAt)}</span>
                          <span>•</span>
                          <span>{formatDate(session.lastSeenAt)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{formatTrackedTime(Math.round(session.durationSeconds / 60))}</Badge>
                          <Badge variant="outline">{session.sessionStatus.replace("_", " ")}</Badge>
                        </div>
                      </div>
                      <Button asChild size="sm">
                        <Link
                          to={`/courses/${session.courseId}`}
                          state={{ entrySource: "progress_dashboard_recent_sessions", moduleId: session.moduleId }}
                        >
                          {copy.resumeModule}
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="mb-3 h-10 w-10 text-muted-foreground opacity-60" />
                  <p className="text-sm text-muted-foreground">{copy.recentSessionEmpty}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/dashboard">{copy.openDashboard}</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link to="/courses">{copy.browseCourses}</Link>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{copy.courses}</CardTitle>
              <CardDescription>{copy.coursesBody}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {courseProgress.length > 0 ? (
                courseProgress.map((course) => {
                  const enrollment = enrollments.find((item) => item.courseId === course.courseId);
                  const isCompleted = enrollment?.status === "completed";

                  return (
                    <Card
                      key={course.courseId}
                      className={`${selectedEnrollment === enrollment?.id ? "ring-2 ring-primary" : ""} ${isCompleted ? "border-green-200 dark:border-green-900/30" : ""}`}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <CardTitle className="flex items-center gap-2">
                              {course.courseTitle}
                              {isCompleted ? (
                                <Badge variant="outline" className="shrink-0 border-green-300 text-green-600">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Completed
                                </Badge>
                              ) : null}
                            </CardTitle>
                            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <BookOpen className="h-4 w-4" />
                                {course.modulesCompleted}/{course.totalModules} {copy.modules}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatOfficialHours(course.officialDurationHours)} {copy.officialHours.toLowerCase()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {copy.lastActive}: {formatDate(course.lastActivityAt)}
                              </span>
                            </div>
                          </div>
                          <Badge variant={course.progress === 100 ? "default" : "secondary"}>{course.progress}%</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{copy.progress}</span>
                            <span className="font-medium">{course.progress}%</span>
                          </div>
                          <Progress value={course.progress} />
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => enrollment && openDetailModal(enrollment.id)} disabled={!enrollment}>
                            {copy.viewDetails}
                          </Button>
                          {isCompleted ? (
                            <Button asChild variant="secondary" size="sm">
                              <Link to="/certificates">View Certificate</Link>
                            </Button>
                          ) : (
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/courses/${course.courseId}`} state={{ entrySource: "progress_dashboard_continue_learning" }}>
                                {copy.continueLearning}
                              </Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <BookOpen className="mb-4 h-16 w-16 text-muted-foreground opacity-50" />
                    <p className="mb-2 text-muted-foreground">{copy.noCoursesEnrolledYet}</p>
                    <p className="mb-4 max-w-lg text-sm text-muted-foreground">{copy.noCoursesEnrolledBody}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button asChild>
                        <Link to="/courses">{copy.browseCourses}</Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link to="/profile">{copy.updateProfile}</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedCourseProgress?.courseTitle || copy.courseProgressDetails}</DialogTitle>
              <DialogDescription>
                {copy.courseProgressDetailsBody}
              </DialogDescription>
            </DialogHeader>

            {loadingDetail ? (
              <div className="space-y-4 py-2">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-72 w-full rounded-2xl" />
                <Skeleton className="h-52 w-full rounded-2xl" />
              </div>
            ) : detailedStats && selectedCourseProgress ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-sm text-muted-foreground">{copy.officialHours}</p>
                    <p className="mt-2 text-2xl font-bold">{formatOfficialHours(selectedCourseProgress.officialDurationHours)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-sm text-muted-foreground">{copy.trackedSessionTime}</p>
                    <p className="mt-2 text-2xl font-bold">{formatTrackedTime(detailedStats.totalTimeSpent)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-sm text-muted-foreground">{copy.averageTimePerModule}</p>
                    <p className="mt-2 text-2xl font-bold">{formatTrackedTime(detailedStats.averageTimePerModule)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-sm text-muted-foreground">{copy.lastActivity}</p>
                    <p className="mt-2 text-sm font-semibold">{formatDate(detailedStats.lastActivityAt)}</p>
                  </div>
                </div>

                {detailedStats.timeSpentByModule.length > 0 ? (
                  <div>
                    <h3 className="mb-4 font-semibold">{copy.trackedSessionTimeByModule}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={detailedStats.timeSpentByModule.map((module) => ({
                          name: module.moduleTitle.length > 15 ? `${module.moduleTitle.substring(0, 15)}...` : module.moduleTitle,
                          time: module.timeSpent,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip formatter={(value) => formatTrackedTime(value as number)} />
                        <Legend />
                        <Bar dataKey="time" fill="#1e40af" name={copy.trackedTimeLegend} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}

                <div>
                  <h3 className="mb-4 font-semibold">{copy.moduleProgress}</h3>
                  <div className="space-y-2">
                    {detailedStats.timeSpentByModule.map((module, index) => (
                      <div key={module.moduleId} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex flex-1 items-center gap-3">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <div className="flex-1">
                            <p className="font-medium">{module.moduleTitle}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatTrackedTime(module.timeSpent)} • {module.completedAt ? <span className="text-green-600">{copy.completed}</span> : <span>{copy.inProgress}</span>}
                            </p>
                          </div>
                        </div>
                        {module.completedAt ? (
                          <Badge variant="default">
                            <Award className="mr-1 h-3 w-3" />
                            {copy.done}
                          </Badge>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                {copy.noDetailedProgress}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={allSessionsModalOpen} onOpenChange={setAllSessionsModalOpen}>
          <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{copy.learningSessionHistory}</DialogTitle>
              <DialogDescription>{copy.learningSessionHistoryBody}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {recentSessions.map((session) => (
                <div key={session.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold leading-tight">{session.moduleTitle || copy.untitledModule}</p>
                        <p className="text-sm text-muted-foreground">{session.courseTitle || copy.untitledCourse}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{copy.lastOpened} {formatRelativeDateTime(session.lastSeenAt)}</span>
                        <span>•</span>
                        <span>{formatDate(session.lastSeenAt)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{formatTrackedTime(Math.round(session.durationSeconds / 60))}</Badge>
                        <Badge variant="outline">{session.sessionStatus.replace("_", " ")}</Badge>
                      </div>
                    </div>
                    <Button asChild size="sm">
                      <Link
                        to={`/courses/${session.courseId}`}
                        state={{ entrySource: "progress_dashboard_recent_sessions_modal", moduleId: session.moduleId }}
                        onClick={() => setAllSessionsModalOpen(false)}
                      >
                        {copy.resumeModule}
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}

              {recentSessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                  {copy.noSessionHistory}
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ProgressDashboard;