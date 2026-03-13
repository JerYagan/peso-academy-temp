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
import { enrollmentService } from "@/services/supabaseDatabaseService";
import { progressTrackingService, type CourseProgress, type ProgressStats } from "@/services/progressTrackingService";
import { moduleSessionService, type EnrichedModuleSession } from "@/services/moduleSessionService";

const COLORS = ["#1e40af", "#059669"];

const ProgressDashboard = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Array<{ id: string; courseId: string; status: string }>>([]);
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailedStats, setDetailedStats] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [recentSessions, setRecentSessions] = useState<EnrichedModuleSession[]>([]);

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
      const [myEnrollments, progress, sessionCards] = await Promise.all([
        enrollmentService.getEnrollments(user.id),
        progressTrackingService.getUserCourseProgress(user.id),
        moduleSessionService.getUserRecentSessionCards(user.id, 6),
      ]);

      setEnrollments(myEnrollments.map((item) => ({ id: item.id, courseId: item.courseId, status: item.status })));
      setCourseProgress(progress);
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
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatRelativeDateTime = (dateString: string | null) => {
    if (!dateString) return "No recent activity";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "No recent activity";
    return formatDistanceToNow(date, { addSuffix: true });
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
    { name: "Completed", value: overallStats.completedCourses, color: COLORS[1] },
    { name: "In Progress", value: overallStats.totalCourses - overallStats.completedCourses, color: COLORS[0] },
  ], [overallStats.completedCourses, overallStats.totalCourses]);

  const selectedCourseProgress = useMemo(() => {
    const enrollment = enrollments.find((item) => item.id === selectedEnrollment);
    if (!enrollment) return null;
    return courseProgress.find((item) => item.courseId === enrollment.courseId) || null;
  }, [courseProgress, enrollments, selectedEnrollment]);

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
          title: "Continue your current course",
          description: `${courseProgress[0].courseTitle} is ${courseProgress[0].progress}% complete. Use the detailed view when you need history, not when you just need to continue.`,
          href: `/courses/${courseProgress[0].courseId}`,
          label: "Continue learning",
          state: { entrySource: "progress_dashboard_primary_course" },
        }
      : {
          title: "Start building your progress history",
          description: "Enroll in your first course so this page can show completion detail, official course hours, and recent activity.",
          href: "/courses",
          label: "Browse courses",
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
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Progress dashboard</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight">Review progress without leaving your next step</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  This page is now for review: official course hours, recent learning activity, and course-by-course completion detail. Use the course page when you are ready to continue learning.
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
              <CardTitle>What this page shows now</CardTitle>
              <CardDescription>Official course duration is used for trainee-facing totals so completion stays outcome-focused instead of time-pressure focused.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="font-medium">Official hours</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Total hours on this page follow the course duration set by the training team.</p>
              </div>
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="font-medium">Detailed review</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Use View Details on any course card to open a modal with module-level progress and tracked session history.</p>
              </div>
            </CardContent>
          </Card>
        </div>

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
              <CardTitle className="text-sm font-medium">Official Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatOfficialHours(overallStats.totalOfficialHours)}</div>
              <p className="text-xs text-muted-foreground">Stated course hours across your enrollments</p>
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

        <div className="grid gap-4 xl:grid-cols-2">
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
                  <p className="max-w-sm text-sm leading-6">Progress bars appear here after you enroll in courses and start completing modules.</p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/courses">Browse courses</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Completion Status</CardTitle>
              <CardDescription>Completed versus in-progress enrollments</CardDescription>
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
                  <p className="max-w-sm text-sm leading-6">Completion status will appear after you enroll in courses and begin building progress history.</p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/courses">Browse courses</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Recent Learning Sessions</CardTitle>
              <CardDescription>Your latest module visits, including tracked session duration and a direct resume action.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentSessions.length > 0 ? (
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
                          Resume Module
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="mb-3 h-10 w-10 text-muted-foreground opacity-60" />
                  <p className="text-sm text-muted-foreground">Recent session history will appear here after you open modules from your enrolled courses.</p>
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

          <Card>
            <CardHeader>
              <CardTitle>Courses</CardTitle>
              <CardDescription>Open a detail modal when you need course-by-course progress breakdown.</CardDescription>
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
                                {course.modulesCompleted}/{course.totalModules} modules
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatOfficialHours(course.officialDurationHours)} official hours
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                Last active: {formatDate(course.lastActivityAt)}
                              </span>
                            </div>
                          </div>
                          <Badge variant={course.progress === 100 ? "default" : "secondary"}>{course.progress}%</Badge>
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
                        <div className="mt-4 flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => enrollment && openDetailModal(enrollment.id)} disabled={!enrollment}>
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
                    <BookOpen className="mb-4 h-16 w-16 text-muted-foreground opacity-50" />
                    <p className="mb-2 text-muted-foreground">No courses enrolled yet</p>
                    <p className="mb-4 max-w-lg text-sm text-muted-foreground">Enroll in a course first. Then this page becomes your review surface for official hours, recent activity, and course progress detail.</p>
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
            </CardContent>
          </Card>
        </div>

        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedCourseProgress?.courseTitle || "Course progress details"}</DialogTitle>
              <DialogDescription>
                Detailed progress is shown in a modal now so you can review module breakdown without leaving the page.
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
                    <p className="text-sm text-muted-foreground">Official Hours</p>
                    <p className="mt-2 text-2xl font-bold">{formatOfficialHours(selectedCourseProgress.officialDurationHours)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-sm text-muted-foreground">Tracked Session Time</p>
                    <p className="mt-2 text-2xl font-bold">{formatTrackedTime(detailedStats.totalTimeSpent)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-sm text-muted-foreground">Average Time per Module</p>
                    <p className="mt-2 text-2xl font-bold">{formatTrackedTime(detailedStats.averageTimePerModule)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-sm text-muted-foreground">Last Activity</p>
                    <p className="mt-2 text-sm font-semibold">{formatDate(detailedStats.lastActivityAt)}</p>
                  </div>
                </div>

                {detailedStats.timeSpentByModule.length > 0 ? (
                  <div>
                    <h3 className="mb-4 font-semibold">Tracked Session Time by Module</h3>
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
                        <Bar dataKey="time" fill="#1e40af" name="Tracked time (minutes)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}

                <div>
                  <h3 className="mb-4 font-semibold">Module Progress</h3>
                  <div className="space-y-2">
                    {detailedStats.timeSpentByModule.map((module, index) => (
                      <div key={module.moduleId} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex flex-1 items-center gap-3">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <div className="flex-1">
                            <p className="font-medium">{module.moduleTitle}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatTrackedTime(module.timeSpent)} • {module.completedAt ? <span className="text-green-600">Completed</span> : <span>In Progress</span>}
                            </p>
                          </div>
                        </div>
                        {module.completedAt ? (
                          <Badge variant="default">
                            <Award className="mr-1 h-3 w-3" />
                            Done
                          </Badge>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                No detailed progress data is available for this course yet.
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ProgressDashboard;