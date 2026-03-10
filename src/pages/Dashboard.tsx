import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, Award, TrendingUp, ArrowRight, Shield, FileText, FileSpreadsheet, Loader2, CheckCircle2, ArrowUpRight, ArrowDownRight, Brain, Clock3, Target, BarChart3, Sparkles, Eye } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { enrollmentService, certificateService, courseService } from "@/services/supabaseDatabaseService";
import { dataService } from "@/services/mockData"; // TODO: Replace with Supabase services for admin/training officer dashboards
import { useEffect, useMemo, useState } from "react";
import { Course, Enrollment } from "@/types";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User } from "@/types/auth";
import { formatDistanceToNow, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { resolveTrainerOwnership } from "@/lib/trainerOwnership";
import { buildLearnerCourseRecommendations, reportingService, type LearnerCourseRecommendation, type LearnerPerformanceSummary, type LearnerPerformanceTopicResult } from "@/services/reportingService";
import { analyticsService, type PersistedLearnerRecommendation } from "@/services/analyticsService";
import { getDashboardRoute } from "@/lib/roles";

interface TraineeDashboardProps {
  user: User;
  stats: {
    enrolledCourses: number;
    completedCourses: number;
    certificates: number;
  };
}

const TraineeDashboard = ({ user, stats }: TraineeDashboardProps) => {
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [completedCourses, setCompletedCourses] = useState<Array<Course & { enrollment: Enrollment }>>([]);
  const [myCourses, setMyCourses] = useState<Array<Course & { enrollment: Enrollment }>>([]);
  const [allEnrollments, setAllEnrollments] = useState<Enrollment[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState<LearnerPerformanceSummary | null>(null);
  const [persistedRecommendations, setPersistedRecommendations] = useState<PersistedLearnerRecommendation[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingPerformance, setLoadingPerformance] = useState(true);

  useEffect(() => {
    void loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    setLoadingCourses(true);
    setLoadingPerformance(true);

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
        const summary = await reportingService.getLearnerPerformanceSummary(user.id);
        setPerformanceSummary(summary);
      } catch (error) {
        console.error("Error loading learner performance summary:", error);
        toast.error("Failed to load learner performance summary");
      } finally {
        setLoadingPerformance(false);
      }
    })();

    await Promise.allSettled([courseLoad, performanceLoad]);
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

  const recommendedCourses = useMemo<LearnerCourseRecommendation[]>(() => {
    return buildLearnerCourseRecommendations(user, allCourses, allEnrollments, performanceSummary, 3);
  }, [allCourses, allEnrollments, performanceSummary, user]);

  const recommendationCards = useMemo(
    () => analyticsService.hydrateRecommendationCards(recommendedCourses, persistedRecommendations),
    [persistedRecommendations, recommendedCourses],
  );

  useEffect(() => {
    if (user.role !== "trainee" || recommendedCourses.length === 0) {
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
  }, [completedCourses.length, performanceSummary, recommendedCourses, user.id, user.role]);

  const hasRecommendationContext = Boolean(
    performanceSummary &&
      (performanceSummary.modulesCompleted > 0 ||
        performanceSummary.assessmentsTaken > 0 ||
        completedCourses.length > 0),
  );

  const recommendationHeadline = (() => {
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

  const renderRecommendedCourses = () => {
    if (loadingCourses || loadingPerformance) {
      return null;
    }

    if (!hasRecommendationContext) {
      return (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <Sparkles className="h-10 w-10 text-primary/70 mx-auto" />
            <div>
              <p className="font-medium">Personalized recommendations unlock after learning activity.</p>
              <p className="text-sm text-muted-foreground">
                Complete a module or submit an assessment and your dashboard will surface next-step course suggestions here.
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
            Triggered by your dashboard activity
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {recommendationCards.map(({ course, reasons, persisted }) => (
            <Card key={course.id} className="overflow-hidden border-border/80 bg-background/95 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.4)]">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary">
                    {course.level}
                  </Badge>
                  {course.isTESDAAccredited && (
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold">
                      <Award className="mr-1 h-3 w-3" />
                      TESDA
                    </Badge>
                  )}
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
                    <span>{course.duration} learning hours</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{course.enrolledCount || 0} learners enrolled</span>
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
                    <Link
                      to="/courses"
                      onClick={() => {
                        if (persisted) {
                          void analyticsService.logRecommendationClick(user.id, persisted, "dashboard_recommendations");
                        }
                      }}
                    >
                      Enroll from Browse
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link
                      to={`/courses/${course.id}`}
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
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {user.name}!</h1>
          <p className="text-muted-foreground mt-2">Continue your learning journey</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enrolled Courses</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enrolledCourses}</div>
              <p className="text-xs text-muted-foreground">Active enrollments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedCourses}</div>
              <p className="text-xs text-muted-foreground">Courses finished</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Certificates</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.certificates}</div>
              <p className="text-xs text-muted-foreground">Certifications earned</p>
            </CardContent>
          </Card>

          {/* Job Matches card hidden - Future Phase */}
          {/* <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Job Matches</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Available positions</p>
            </CardContent>
          </Card> */}
        </div>

  {renderRecommendedCourses()}

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
                    <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Button asChild variant="default" className="w-full gap-2">
                      <Link to="/certificates">
                        <Award className="h-4 w-4" />
                        View Certificate
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* My Courses (in progress) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">My Courses</h2>
            <Button asChild variant="outline">
              <Link to="/courses">View All</Link>
            </Button>
          </div>
          {loadingCourses ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <Loader2 className="w-7 h-7 text-muted-foreground animate-spin mb-3" />
                <p className="text-muted-foreground">Loading courses...</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myCourses.length > 0 ? (
                myCourses.map((course) => {
                  const isCompleted = course.enrollment.status === "completed";
                  return (
                    <Card key={course.id} className={isCompleted ? "border-green-200 dark:border-green-900/30" : ""}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                            <CardDescription>{course.category} • {course.level}</CardDescription>
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
                          {isCompleted ? (
                            <Button asChild className="w-full mt-4" variant="secondary">
                              <Link to="/certificates">View Certificate</Link>
                            </Button>
                          ) : (
                            <Button asChild className="w-full mt-4">
                              <Link to={`/courses/${course.id}`}>Continue Learning</Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="col-span-full">
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
                    {completedCourses.length > 0 || stats.enrolledCourses > 0 ? (
                      <>
                        <p className="text-muted-foreground mb-2 text-center">You have no active in-progress courses right now.</p>
                        <p className="text-sm text-muted-foreground mb-4 text-center">
                          You can review certificates or enroll in another course to continue learning.
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
                        <p className="text-muted-foreground mb-4">You haven't enrolled in any courses yet</p>
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
  const [showingAllCoursesFallback, setShowingAllCoursesFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const ownership = await resolveTrainerOwnership(user);
        const [allCourses, allEnrollments, allCerts] = await Promise.all([
          courseService.getCourses(),
          enrollmentService.getEnrollments(),
          certificateService.getCertificates(),
        ]);
        if (cancelled) return;
        const ownedCourses = allCourses.filter((course) => ownership.ownerIds.includes(course.instructorId));
        const myCourses = ownedCourses.length > 0 ? ownedCourses : allCourses;
        const myCourseIds = new Set(myCourses.map((c) => c.id));
        const myEnrollments = allEnrollments.filter((e) => myCourseIds.has(e.courseId));
        setCourses(myCourses);
        setEnrollments(myEnrollments);
        setShowingAllCoursesFallback(ownedCourses.length === 0 && allCourses.length > 0);
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
          <p className="text-muted-foreground mt-2">
            {showingAllCoursesFallback
              ? "Showing all manageable course data because no direct trainer ownership match was found."
              : "Manage your courses and learners"}
          </p>
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
                  <p className="text-xs text-muted-foreground">Courses you teach</p>
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

  // Training Officer / Trainer Dashboard (real data from Supabase; no redundant My Courses section)
  if (user.role === "training_officer" || user.role === "trainer") {
    return <TrainingOfficerDashboard user={user} />;
  }

  // Validator Dashboard
  if (user.role === "validator") {
    // Redirect to validator dashboard page instead
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Validator Dashboard</h1>
            <p className="text-muted-foreground mt-2">Review and validate submissions</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">Awaiting validation</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">Validated submissions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">Reviews completed</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild className="w-full justify-start" variant="outline">
                <Link to="/validator/submissions">
                  <FileText className="mr-2 h-4 w-4" />
                  Review Submissions
                </Link>
                      </Button>
              <Button asChild className="w-full justify-start" variant="outline">
                <Link to="/validator/dashboard">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  View Dashboard
                </Link>
                  </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
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

