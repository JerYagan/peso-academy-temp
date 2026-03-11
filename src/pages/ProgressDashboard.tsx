import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  BookOpen,
  TrendingUp,
  Calendar,
  Award,
  BarChart3,
  PieChart,
  Activity,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { progressTrackingService, ProgressStats, CourseProgress } from "@/services/progressTrackingService";
import { enrollmentService } from "@/services/supabaseDatabaseService";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { moduleSessionService, type EnrichedModuleSession } from "@/services/moduleSessionService";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#1e40af", "#059669", "#dc2626", "#ea580c", "#7c3aed", "#be185d"];

const ProgressDashboard = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState<string | null>(null);
  const [detailedStats, setDetailedStats] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentSessions, setRecentSessions] = useState<EnrichedModuleSession[]>([]);
  const [loadingSessionHistory, setLoadingSessionHistory] = useState(true);

  useEffect(() => {
    if (user) {
      loadProgress();
    }
  }, [user]);

  useEffect(() => {
    if (selectedEnrollment) {
      loadDetailedStats(selectedEnrollment);
    }
  }, [selectedEnrollment]);

  const loadProgress = async () => {
    if (!user) return;

    setLoading(true);
    setLoadingSessionHistory(true);
    try {
      const [myEnrollments, progress, sessionCards] = await Promise.all([
        enrollmentService.getEnrollments(user.id),
        progressTrackingService.getUserCourseProgress(user.id),
        moduleSessionService.getUserRecentSessionCards(user.id, 6),
      ]);
      setEnrollments(myEnrollments);
      setCourseProgress(progress);
      setRecentSessions(sessionCards);

      if (myEnrollments.length > 0 && !selectedEnrollment) {
        setSelectedEnrollment(myEnrollments[0].id);
      }
    } catch (error) {
      console.error("Error loading progress:", error);
    } finally {
      setLoading(false);
      setLoadingSessionHistory(false);
    }
  };

  const loadDetailedStats = async (enrollmentId: string) => {
    const stats = await progressTrackingService.getProgressStats(enrollmentId);
    setDetailedStats(stats);
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "Never";

    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatRelativeDateTime = (dateString: string | null) => {
    if (!dateString) return "No recent activity";

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return "No recent activity";
    }

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

  // Calculate overall statistics
  const overallStats = {
    totalCourses: courseProgress.length,
    completedCourses: courseProgress.filter((c) => c.progress === 100).length,
    totalTimeSpent: courseProgress.reduce((sum, c) => sum + c.timeSpent, 0),
    averageProgress:
      courseProgress.length > 0
        ? Math.round(courseProgress.reduce((sum, c) => sum + c.progress, 0) / courseProgress.length)
        : 0,
  };

  // Prepare chart data
  const progressChartData = courseProgress.map((course) => ({
    name: course.courseTitle.length > 20 ? course.courseTitle.substring(0, 20) + "..." : course.courseTitle,
    progress: course.progress,
    timeSpent: course.timeSpent,
  }));

  const timeSpentChartData = detailedStats?.timeSpentByModule.map((module) => ({
    name: module.moduleTitle.length > 15 ? module.moduleTitle.substring(0, 15) + "..." : module.moduleTitle,
    time: module.timeSpent,
    completed: module.completedAt ? 1 : 0,
  })) || [];

  const completionPieData = [
    { name: "Completed", value: overallStats.completedCourses, color: COLORS[1] },
    { name: "In Progress", value: overallStats.totalCourses - overallStats.completedCourses, color: COLORS[0] },
  ];

  const profileSignalCoverage = Math.round(
    ([
      Boolean(user?.onboardingSkillLevel),
      Boolean(user?.industryInterests && user.industryInterests.length > 0),
      Boolean(user?.preferredCategories && user.preferredCategories.length > 0),
      Boolean(user?.skills && user.skills.length > 0),
    ].filter(Boolean).length / 4) * 100,
  );

  const primaryAction = recentSessions[0]
    ? {
        title: "Resume your most recent module",
        description: `${recentSessions[0].moduleTitle || "Latest module"} in ${recentSessions[0].courseTitle || "your course"} was opened ${formatRelativeDateTime(recentSessions[0].lastSeenAt)}.`,
        href: `/courses/${recentSessions[0].courseId}`,
        label: "Resume module",
        state: {
          entrySource: "progress_dashboard_primary_resume",
          moduleId: recentSessions[0].moduleId,
        },
      }
    : courseProgress[0]
      ? {
          title: "Continue your current course",
          description: `${courseProgress[0].courseTitle} is ${courseProgress[0].progress}% complete. Use the course view when you want to keep moving, and return here when you need detail.`,
          href: `/courses/${courseProgress[0].courseId}`,
          label: "Continue learning",
          state: {
            entrySource: "progress_dashboard_primary_course",
          },
        }
      : {
          title: "Start building your progress history",
          description: "Enroll in your first course so this page can track progress, session activity, and completion trends.",
          href: "/courses",
          label: "Browse courses",
          state: undefined,
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
          <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card">
            <CardContent className="space-y-5 p-6 sm:p-7">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Progress dashboard</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight">Track progress without losing your next step</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Use this page when you need detail: session history, completion patterns, and course-by-course progress. Return to course view when you are ready to continue learning.
                </p>
              </div>

              <div className="rounded-3xl border border-primary/15 bg-background/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Primary next step</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{primaryAction.title}</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{primaryAction.description}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to={primaryAction.href} state={primaryAction.state}>{primaryAction.label}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/dashboard">Back to dashboard</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next-step shortcuts</CardTitle>
              <CardDescription>Keep the next action obvious whether you need to resume, browse, or sharpen recommendations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="font-medium">Recommendation readiness</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {profileSignalCoverage >= 75
                    ? "Your profile already has strong recommendation signals."
                    : "Complete more profile signals so recommendations and predictive insights stay specific."}
                </p>
                <Button asChild size="sm" variant="outline" className="mt-4">
                  <Link to="/profile">Open profile</Link>
                </Button>
              </div>
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="font-medium">Course catalog</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {overallStats.totalCourses > 0
                    ? "Browse the catalog when you want a new course, not when you are deciding what to resume next."
                    : "Start with the catalog to create your first progress data and learning history."}
                </p>
                <Button asChild size="sm" variant="outline" className="mt-4">
                  <Link to="/courses">Browse courses</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overall Statistics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.totalCourses}</div>
              <p className="text-xs text-muted-foreground">Enrolled courses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.completedCourses}</div>
              <p className="text-xs text-muted-foreground">Courses finished</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTime(overallStats.totalTimeSpent)}</div>
              <p className="text-xs text-muted-foreground">Time spent learning</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.averageProgress}%</div>
              <p className="text-xs text-muted-foreground">Average completion</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Detailed View */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="courses">
              <BookOpen className="w-4 h-4 mr-2" />
              Courses
            </TabsTrigger>
            {selectedEnrollment && (
              <TabsTrigger value="detailed">
                <Activity className="w-4 h-4 mr-2" />
                Detailed View
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Learning Sessions</CardTitle>
                  <CardDescription>
                    Your latest module visits, including the last opened time, tracked duration, and a direct resume action.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingSessionHistory ? (
                    <div className="space-y-3 py-2">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="rounded-lg border p-4 space-y-3">
                          <Skeleton className="h-5 w-1/2" />
                          <Skeleton className="h-4 w-2/3" />
                          <div className="flex gap-2">
                            <Skeleton className="h-6 w-20 rounded-full" />
                            <Skeleton className="h-6 w-24 rounded-full" />
                          </div>
                          <Skeleton className="h-9 w-32" />
                        </div>
                      ))}
                    </div>
                  ) : recentSessions.length > 0 ? (
                    recentSessions.map((session) => (
                      <div key={session.id} className="rounded-lg border p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div>
                              <p className="font-semibold leading-tight">{session.moduleTitle || "Untitled module"}</p>
                              <p className="text-sm text-muted-foreground">{session.courseTitle || "Untitled course"}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>Last opened {formatRelativeDateTime(session.lastSeenAt)}</span>
                              <span>•</span>
                              <span>{formatDateTime(session.lastSeenAt)}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary">{formatSessionDuration(session.durationSeconds)}</Badge>
                              <Badge variant="outline">{formatSessionStatus(session.sessionStatus)}</Badge>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button asChild size="sm">
                              <Link
                                to={`/courses/${session.courseId}`}
                                state={{
                                  entrySource: "progress_dashboard_recent_sessions",
                                  moduleId: session.moduleId,
                                }}
                              >
                                Resume Module
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Clock className="mb-3 h-10 w-10 text-muted-foreground opacity-60" />
                      <p className="text-sm text-muted-foreground">
                        Recent session history will appear here after you open modules from your enrolled courses.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/dashboard">Open dashboard</Link>
                        </Button>
                        <Button asChild size="sm">
                          <Link to="/courses">Browse courses</Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Progress Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Course Progress</CardTitle>
                  <CardDescription>Progress percentage by course</CardDescription>
                </CardHeader>
                <CardContent>
                  {progressChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={progressChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Bar dataKey="progress" fill="#1e40af" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                      <BarChart3 className="h-8 w-8 opacity-60" />
                      <p className="max-w-sm text-sm leading-6">
                        Progress bars appear here after you enroll in courses and start completing modules.
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/courses">Browse courses</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Completion Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Completion Status</CardTitle>
                  <CardDescription>Completed vs In Progress</CardDescription>
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
                          fill="#8884d8"
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
                      <p className="max-w-sm text-sm leading-6">
                        Completion status will appear after you enroll in courses and begin building progress history.
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/courses">Browse courses</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="courses" className="space-y-4">
            <div className="space-y-4">
              {courseProgress.length > 0 ? (
                courseProgress.map((course) => {
                  const enrollment = enrollments.find((e) => e.courseId === course.courseId);
                  const isCompleted = enrollment?.status === "completed";
                  return (
                    <Card
                      key={course.courseId}
                      className={`${selectedEnrollment === enrollment?.id ? "ring-2 ring-primary" : ""} ${isCompleted ? "border-green-200 dark:border-green-900/30" : ""}`}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="flex items-center gap-2">
                              {course.courseTitle}
                              {isCompleted && (
                                <Badge variant="outline" className="text-green-600 border-green-300 shrink-0">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Completed
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="mt-2">
                              <div className="flex items-center gap-4 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-4 h-4" />
                                  {course.modulesCompleted}/{course.totalModules} modules
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {formatTime(course.timeSpent)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  Last active: {formatDate(course.lastActivityAt)}
                                </span>
                              </div>
                            </CardDescription>
                          </div>
                          <Badge variant={course.progress === 100 ? "default" : "secondary"}>
                            {course.progress}%
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{course.progress}%</span>
                          </div>
                          <Progress value={course.progress} />
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedEnrollment(enrollment?.id || null)}
                          >
                            View Details
                          </Button>
                          {isCompleted ? (
                            <Button asChild variant="secondary" size="sm">
                              <Link to="/certificates">View Certificate</Link>
                            </Button>
                          ) : (
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/courses/${course.courseId}`} state={{ entrySource: "progress_dashboard_continue_learning" }}>
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
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <BookOpen className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-muted-foreground mb-2">No courses enrolled yet</p>
                    <p className="mb-4 max-w-lg text-sm text-muted-foreground">
                      Enroll in a course first. Then this tab becomes your course-by-course control panel for viewing details and continuing modules.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button asChild>
                        <Link to="/courses">Browse Courses</Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link to="/profile">Update profile</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {selectedEnrollment && detailedStats && (
            <TabsContent value="detailed" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Progress Statistics</CardTitle>
                  <CardDescription>Module-by-module breakdown</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total Time Spent</p>
                      <p className="text-2xl font-bold">{formatTime(detailedStats.totalTimeSpent)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Average Time per Module</p>
                      <p className="text-2xl font-bold">{formatTime(detailedStats.averageTimePerModule)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Last Activity</p>
                      <p className="text-sm font-bold">
                        {formatDate(detailedStats.lastActivityAt)}
                      </p>
                    </div>
                  </div>

                  {/* Time Spent Chart */}
                  {timeSpentChartData.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-4">Time Spent by Module</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={timeSpentChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                          <YAxis />
                          <Tooltip formatter={(value) => formatTime(value as number)} />
                          <Legend />
                          <Bar dataKey="time" fill="#1e40af" name="Time Spent (minutes)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Module List */}
                  <div>
                    <h3 className="font-semibold mb-4">Module Progress</h3>
                    <div className="space-y-2">
                      {detailedStats.timeSpentByModule.map((module, idx) => (
                        <div
                          key={module.moduleId}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Badge variant="outline">#{idx + 1}</Badge>
                            <div className="flex-1">
                              <p className="font-medium">{module.moduleTitle}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatTime(module.timeSpent)} •{" "}
                                {module.completedAt ? (
                                  <span className="text-green-600">Completed</span>
                                ) : (
                                  <span className="text-muted-foreground">In Progress</span>
                                )}
                              </p>
                            </div>
                          </div>
                          {module.completedAt && (
                            <Badge variant="default">
                              <Award className="w-3 h-3 mr-1" />
                              Done
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ProgressDashboard;

