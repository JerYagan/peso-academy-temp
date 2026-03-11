import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading progress...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Progress Dashboard</h1>
          <p className="text-muted-foreground mt-2">Track your learning progress and statistics</p>
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
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No data available
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
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No courses enrolled
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
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BookOpen className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-muted-foreground mb-4">No courses enrolled yet</p>
                    <Button asChild>
                      <Link to="/courses">Browse Courses</Link>
                    </Button>
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

