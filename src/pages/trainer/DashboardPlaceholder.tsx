import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  BarChart3,
  BookOpen,
  Brain,
  Clock3,
  GraduationCap,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { reportingService, type TrainerDashboardAnalytics } from "@/services/reportingService";
import { toast } from "sonner";

const chartPalette = {
  primary: "#0f766e",
  accent: "#1d4ed8",
  warm: "#ea580c",
  rose: "#be123c",
  slate: "#475569",
  warning: "#d97706",
  critical: "#dc2626",
};

const cohortColors = [chartPalette.accent, chartPalette.primary, chartPalette.warm, chartPalette.rose];

const formatLearningHours = (hours: number) => {
  if (hours <= 0) return "0h";
  return `${hours.toFixed(1)}h`;
};

const TrainerDashboardPlaceholder = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<TrainerDashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const dashboardAnalytics = await reportingService.getTrainerDashboardAnalytics(user);
        if (cancelled) {
          return;
        }
        setAnalytics(dashboardAnalytics);
      } catch (error) {
        console.error("Error loading trainer dashboard:", error);
        if (!cancelled) {
          toast.error("Failed to load trainer dashboard");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, user]);

  const cohortData = useMemo(() => {
    if (!analytics) return [];

    return [
      { name: "Not Started", value: analytics.cohortSegments.notStarted },
      { name: "In Progress", value: analytics.cohortSegments.inProgress },
      { name: "Completed", value: analytics.cohortSegments.completed },
      { name: "At Risk", value: analytics.cohortSegments.atRisk },
    ].filter((item) => item.value > 0);
  }, [analytics]);

  const attentionModules = analytics?.moduleInsights.slice(0, 5) || [];
  const coursePerformanceData = analytics?.courseInsights.slice(0, 6).map((course) => ({
    name: course.courseTitle.length > 18 ? `${course.courseTitle.slice(0, 18)}...` : course.courseTitle,
    completionRate: course.completionRate,
    averageAssessmentScore: course.averageAssessmentScore,
  })) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
              Trainer portal
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Analytics workspace
            </Badge>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Trainer dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                Monitor learner cohorts, average assessment outcomes, course completion performance, and module-level content friction across the courses you manage.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
                <RefreshCw className={loading ? "animate-spin" : ""} />
                Refresh
              </Button>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <GraduationCap className="h-7 w-7" />
              </div>
            </div>
          </div>
          {analytics ? (
            <p className="text-sm text-muted-foreground">
              {analytics.showingAllCoursesFallback
                ? "Showing all manageable courses because no direct trainer ownership match was found for the current account."
                : "Showing analytics for your owned course portfolio."}
            </p>
          ) : null}
        </div>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading trainer dashboard...</p>
            </CardContent>
          </Card>
        ) : !analytics ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-base font-medium">Trainer analytics are not available right now.</p>
              <p className="mt-2 text-sm text-muted-foreground">Check ownership resolution and reporting queries, then refresh this dashboard.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">Managed courses</CardTitle>
                    <div className="mt-2 text-3xl font-semibold tracking-tight">{analytics.totalCourses}</div>
                  </div>
                  <BookOpen className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Courses currently included in your training analytics scope.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">Unique learners</CardTitle>
                    <div className="mt-2 text-3xl font-semibold tracking-tight">{analytics.totalLearners}</div>
                  </div>
                  <Users className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Distinct trainees enrolled across your visible courses.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">Completion rate</CardTitle>
                    <div className="mt-2 text-3xl font-semibold tracking-tight">{analytics.completionRate}%</div>
                  </div>
                  <TrendingUp className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Completion performance across all tracked enrollments.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">Average assessment score</CardTitle>
                    <div className="mt-2 text-3xl font-semibold tracking-tight">{analytics.averageAssessmentScore}%</div>
                  </div>
                  <Target className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Average scored attempts across assessments tied to your courses.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">Avg learning time per course</CardTitle>
                    <div className="mt-2 text-3xl font-semibold tracking-tight">{formatLearningHours(analytics.averageLearningHoursPerCourse)}</div>
                  </div>
                  <Clock3 className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Tracked session time averaged across your course portfolio.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">Certificates issued</CardTitle>
                    <div className="mt-2 text-3xl font-semibold tracking-tight">{analytics.certificatesIssued}</div>
                  </div>
                  <Award className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Certificates released for your managed courses.</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Joined this month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{analytics.joinedThisMonth}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Completed this month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{analytics.completedThisMonth}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Avg completion per course</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{analytics.averageCompletionRatePerCourse}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">At-risk enrollments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-amber-600">{analytics.cohortSegments.atRisk}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Training performance trends</CardTitle>
                  <CardDescription>Recent enrollment volume, completions, learning time, and assessment score patterns across your course portfolio.</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.monthlyTrends.length > 0 ? (
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analytics.monthlyTrends}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="newEnrollments" name="New enrollments" stroke={chartPalette.accent} strokeWidth={3} dot={{ r: 4 }} />
                          <Line type="monotone" dataKey="completedEnrollments" name="Completions" stroke={chartPalette.primary} strokeWidth={3} dot={{ r: 4 }} />
                          <Line type="monotone" dataKey="averageAssessmentScore" name="Avg score" stroke={chartPalette.warm} strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No monthly trend data is available yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cohort overview</CardTitle>
                  <CardDescription>Enrollment-state distribution for the learners assigned to your courses.</CardDescription>
                </CardHeader>
                <CardContent>
                  {cohortData.length > 0 ? (
                    <>
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={cohortData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={4}>
                              {cohortData.map((entry, index) => (
                                <Cell key={entry.name} fill={cohortColors[index % cohortColors.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid gap-2">
                        {cohortData.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cohortColors[index % cohortColors.length] }} />
                              <span>{item.name}</span>
                            </div>
                            <span className="font-medium">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No cohort data is available yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Course performance comparison</CardTitle>
                  <CardDescription>Average completion and assessment score across your most active courses.</CardDescription>
                </CardHeader>
                <CardContent>
                  {coursePerformanceData.length > 0 ? (
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={coursePerformanceData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="completionRate" name="Completion rate" fill={chartPalette.primary} radius={[6, 6, 0, 0]} />
                          <Bar dataKey="averageAssessmentScore" name="Avg assessment score" fill={chartPalette.accent} radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No course comparison data is available yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cohort-level insights</CardTitle>
                  <CardDescription>Quick summary cards for learner workload and intervention priority.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">Total enrollments</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.totalEnrollments}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">In-progress cohort</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.cohortSegments.inProgress}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">Not started</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.cohortSegments.notStarted}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-amber-50 p-4 text-amber-900">
                    <p className="text-sm text-amber-700">Needs intervention</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.cohortSegments.atRisk}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Content improvement insights</CardTitle>
                  <CardDescription>Modules flagged for low scores, high failure rate, slow completion, or weak completion coverage.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {attentionModules.length > 0 ? (
                    attentionModules.map((module) => (
                      <div key={module.moduleId} className="rounded-2xl border border-border/70 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div>
                              <p className="font-semibold">{module.moduleTitle}</p>
                              <p className="text-sm text-muted-foreground">{module.courseTitle}</p>
                            </div>
                            <p className="text-sm text-muted-foreground">{module.insight}</p>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{module.completionRate}% complete</Badge>
                              <Badge variant="outline">{module.averageAssessmentScore}% avg score</Badge>
                              <Badge variant="outline">{module.failureRate}% failure rate</Badge>
                              <Badge variant="outline">{module.averageLearningMinutes.toFixed(1)} min avg time</Badge>
                            </div>
                          </div>
                          <Badge
                            className={
                              module.attentionLevel === "critical"
                                ? "bg-red-50 text-red-700 hover:bg-red-50"
                                : module.attentionLevel === "watch"
                                  ? "bg-amber-50 text-amber-700 hover:bg-amber-50"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                            }
                          >
                            {module.attentionLevel === "critical"
                              ? "Critical"
                              : module.attentionLevel === "watch"
                                ? "Watch"
                                : "Healthy"}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No module diagnostics are available yet.</p>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Top course insights</CardTitle>
                    <CardDescription>Best current snapshot of learner and assessment performance by course.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analytics.courseInsights.length > 0 ? (
                      analytics.courseInsights.map((course) => (
                        <div key={course.courseId} className="rounded-2xl border border-border/70 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{course.courseTitle}</p>
                              <p className="text-sm text-muted-foreground">{course.category} • {course.level}</p>
                            </div>
                            <Badge variant="outline">{course.learnerCount} learners</Badge>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Completion</p>
                              <p className="mt-1 text-lg font-semibold">{course.completionRate}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Avg score</p>
                              <p className="mt-1 text-lg font-semibold">{course.averageAssessmentScore}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Avg progress</p>
                              <p className="mt-1 text-lg font-semibold">{course.averageProgress}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Avg learning time</p>
                              <p className="mt-1 text-lg font-semibold">{formatLearningHours(course.averageLearningHours)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No course insights are available yet.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quick actions</CardTitle>
                    <CardDescription>Jump from analytics into course and learner operations.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button asChild className="w-full justify-start">
                      <Link to="/trainer/courses">
                        <BookOpen className="mr-2 h-4 w-4" />
                        Manage courses
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link to="/trainer/learners">
                        <Users className="mr-2 h-4 w-4" />
                        View learners
                      </Link>
                    </Button>
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <Brain className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">Analytics focus</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Use the module insights above to identify lessons that need clearer instruction, shorter content segments, or assessment redesign.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                          <ShieldAlert className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-amber-900">Intervention priority</p>
                          <p className="mt-1 text-sm text-amber-800">
                            {analytics.cohortSegments.atRisk > 0
                              ? `${analytics.cohortSegments.atRisk} enrollments are currently flagged as at risk based on low progress after two weeks.`
                              : "No enrollments are currently flagged as at risk under the current threshold."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TrainerDashboardPlaceholder;
