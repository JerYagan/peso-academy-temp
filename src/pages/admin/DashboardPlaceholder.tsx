import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  ClipboardList,
  FileSearch,
  FileSpreadsheet,
  Gauge,
  Loader2,
  ShieldCheck,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AdminDashboardAnalytics,
  reportingService,
} from "@/services/reportingService";
import { toast } from "sonner";
import { moduleSessionService, type AdminRecentSessionSummary } from "@/services/moduleSessionService";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";

const adminActions = [
  {
    title: "Manage users",
    description: "Review accounts, role assignments, and access setup.",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Manage courses",
    description: "Open the course library to publish, update, or archive content.",
    href: "/admin/courses",
    icon: BookOpen,
  },
  {
    title: "Manage roles",
    description: "Maintain system roles, permission mappings, and dashboard routes.",
    href: "/admin/roles",
    icon: ShieldCheck,
  },
  {
    title: "Manage enrollments",
    description: "Review learner enrollments and course assignment activity.",
    href: "/admin/enrollments",
    icon: ClipboardList,
  },
  {
    title: "Manage certificates",
    description: "Release certificates and monitor what is pending or already issued.",
    href: "/admin/certificates",
    icon: Award,
  },
  {
    title: "View audit logs",
    description: "Inspect admin activity and critical platform events.",
    href: "/admin/audit-logs",
    icon: FileSearch,
  },
  {
    title: "View reports and analytics",
    description: "Open the reporting workspace for exports, analytics, and performance summaries.",
    href: "/admin/reports",
    icon: FileSpreadsheet,
  },
];

const chartPalette = {
  primary: "#0f766e",
  primarySoft: "#99f6e4",
  accent: "#1d4ed8",
  accentSoft: "#bfdbfe",
  warm: "#ea580c",
  warmSoft: "#fdba74",
  rose: "#be123c",
  slate: "#475569",
};

const formatHours = (hours: number) => {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }

  return `${hours.toFixed(1)}h`;
};

interface AdminRecentSessionCard extends AdminRecentSessionSummary {
  learnerName: string | null;
  learnerEmail: string | null;
  needsAttention: boolean;
}

const SHORT_SESSION_SECONDS = 5 * 60;
const SHORT_SESSION_REPEAT_THRESHOLD = 3;

const formatRelativeActivity = (value: string) => {
  const date = new Date(value);
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

const formatSessionStatus = (status: AdminRecentSessionSummary["latestSessionStatus"]) => {
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

const formatEnrollmentStatus = (status: string) => {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "not_started":
      return "Not started";
    case "dropped":
      return "Dropped";
    default:
      return status.replace(/_/g, " ");
  }
};

const AdminDashboardPlaceholder = () => {
  const [analytics, setAnalytics] = useState<AdminDashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentSessionActivity, setRecentSessionActivity] = useState<AdminRecentSessionCard[]>([]);

  useEffect(() => {
    const loadDashboardMetrics = async () => {
      try {
        setLoading(true);
        const [dashboardAnalytics, sessionActivity] = await Promise.all([
          reportingService.getAdminDashboardAnalytics(),
          moduleSessionService.getAdminRecentSessionActivity(8),
        ]);

        let learnerDirectory = new Map<string, { name: string | null; email: string | null }>();
        const learnerIds = Array.from(new Set(sessionActivity.map((session) => session.learnerId)));
        if (supabase) {
          if (learnerIds.length > 0) {
            const { data: users, error } = await supabase
              .from("users")
              .select("id, name, email")
              .in("id", learnerIds);

            if (error) {
              console.warn("Failed to hydrate recent session learners for admin dashboard:", error);
            } else {
              learnerDirectory = new Map(
                (users || []).map((user) => [user.id, { name: user.name || null, email: user.email || null }])
              );
            }
          }
        }

        setAnalytics(dashboardAnalytics);
        setRecentSessionActivity(
          sessionActivity.map((session) => {
            const learner = learnerDirectory.get(session.learnerId);
            const needsAttention =
              session.totalSessions >= SHORT_SESSION_REPEAT_THRESHOLD &&
              session.totalDurationSeconds / session.totalSessions <= SHORT_SESSION_SECONDS &&
              session.latestSessionStatus !== "completed";

            return {
              ...session,
              learnerName: learner?.name || null,
              learnerEmail: learner?.email || null,
              needsAttention,
            } satisfies AdminRecentSessionCard;
          })
        );
      } catch (error) {
        console.error("Failed to load admin dashboard metrics:", error);
        toast.error("Failed to load admin dashboard metrics");
      } finally {
        setLoading(false);
      }
    };

    void loadDashboardMetrics();
  }, []);

  const statCards = useMemo(() => {
    if (!analytics) return [];

    return [
      {
        title: "Total users",
        value: analytics.totalUsers.toLocaleString(),
        description: "Registered trainees, internal users, and partners",
        icon: Users,
      },
      {
        title: "Available courses",
        value: analytics.totalCourses.toLocaleString(),
        description: "Courses currently tracked by platform analytics",
        icon: BookOpen,
      },
      {
        title: "Total enrollments",
        value: analytics.totalEnrollments.toLocaleString(),
        description: "Organization-wide training participation volume",
        icon: UserCog,
      },
      {
        title: "Completion rate",
        value: `${analytics.completionRate}%`,
        description: "Current completion performance across enrollments",
        icon: TrendingUp,
      },
      {
        title: "Certificates issued",
        value: analytics.certificatesIssued.toLocaleString(),
        description: "Released certificates across all tracked courses",
        icon: Award,
      },
      {
        title: "Active learners (30d)",
        value: analytics.activeLearners30Days.toLocaleString(),
        description: "Learners with recent progress or completion activity",
        icon: Activity,
      },
    ];
  }, [analytics]);

  const latestTrend = analytics?.monthlyTrends.at(-1);
  const previousTrend = analytics?.monthlyTrends.at(-2);
  const completionDelta = latestTrend && previousTrend
    ? latestTrend.completionRate - previousTrend.completionRate
    : 0;
  const certificateDelta = latestTrend && previousTrend
    ? latestTrend.certificatesIssued - previousTrend.certificatesIssued
    : 0;
  const engagementDelta = latestTrend && previousTrend
    ? latestTrend.activeLearners - previousTrend.activeLearners
    : 0;
  const courseRiskChartData = analytics?.riskCourseInsights.map((course) => ({
    name: course.courseTitle.length > 18 ? `${course.courseTitle.slice(0, 18)}...` : course.courseTitle,
    riskScore: course.riskScore,
    acceptanceRate: course.recommendationAcceptanceRate,
  })) || [];
  const recommendationPerformanceData = analytics?.recommendationAnalytics.topRecommendedCourses.map((course) => ({
    name: course.courseTitle.length > 18 ? `${course.courseTitle.slice(0, 18)}...` : course.courseTitle,
    acceptRate: course.acceptRate,
    acceptanceProbability: course.acceptanceProbability,
  })) || [];
  const topCourses = analytics?.topCourses.slice(0, 5) || [];
  const highestRiskCourses = analytics?.riskCourseInsights.slice(0, 5) || [];
  const disengagementWatchlist = analytics?.disengagementInsights.slice(0, 6) || [];
  const recentSessions = recentSessionActivity.slice(0, 6);

  return (
    <DashboardLayout>
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
              Admin portal
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Analytics overview
            </Badge>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">Admin dashboard</h1>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                Review organization-wide enrollments, completion outcomes, certificate issuance, trainee performance, learning engagement, and predictive oversight from one dashboard.
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-7 w-7" />
            </div>
          </div>
        </div>

        {loading ? (
          <Card className="border-border/80">
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading organization-wide analytics...</p>
            </CardContent>
          </Card>
        ) : !analytics ? (
          <Card className="border-border/80">
            <CardContent className="py-16 text-center">
              <p className="text-base font-medium">Analytics data is not available right now.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Check Supabase connectivity or reporting tables, then refresh this dashboard.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="overflow-hidden border-primary/15 bg-card">
                <CardContent className="p-6 sm:p-7">
                  <div className="flex flex-col gap-6">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Platform snapshot</p>
                      <h2 className="text-2xl font-semibold tracking-tight text-foreground">A cleaner read on organization performance, learner activity, and intervention pressure.</h2>
                      <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                        Start with the summary below, then switch into the tab that matches the task you are handling instead of scanning one long dashboard.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total users</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.totalUsers}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Across trainees and internal roles</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Completion rate</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.completionRate}%</p>
                        <p className="mt-1 text-xs text-muted-foreground">Organization-wide tracked completion</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">High-risk learners</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight text-amber-700">{analytics.predictiveOverview.highRiskLearners}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Needing closer review now</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardHeader>
                  <CardTitle>Priority signals</CardTitle>
                  <CardDescription>Start with the highest-leverage platform actions based on the latest admin analytics.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">Platform momentum</p>
                    <p className="mt-2 font-medium text-foreground">
                      {completionDelta >= 0
                        ? `Completion is up by ${completionDelta}% compared with last month.`
                        : `Completion is down by ${Math.abs(completionDelta)}% compared with last month.`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">Predictive oversight</p>
                    <p className="mt-2 font-medium text-foreground">
                      {analytics.predictiveOverview.highRiskCourses} high-risk courses and {analytics.predictiveOverview.highRiskLearners} high-risk learners are currently surfaced by predictive scoring.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">Recommendation health</p>
                    <p className="mt-2 font-medium text-foreground">
                      {analytics.recommendationAnalytics.averageAcceptRate}% average accept rate with {analytics.recommendationAnalytics.averageAcceptanceProbability}% predicted acceptance across surfaced recommendations.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
              <div className="rounded-3xl border border-border/70 bg-background/80 p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-sm font-medium text-foreground">Focused admin workspaces</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Switch between high-level performance, learner activity, predictive risk, and recommendation tooling so each admin task has a smaller surface area.
                    </p>
                  </div>
                  <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl bg-muted/60 p-1 sm:grid-cols-2 xl:grid-cols-4">
                    <TabsTrigger value="overview" className="w-full rounded-xl px-4 py-3 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Overview</TabsTrigger>
                    <TabsTrigger value="activity" className="w-full rounded-xl px-4 py-3 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Learner activity</TabsTrigger>
                    <TabsTrigger value="risk" className="w-full rounded-xl px-4 py-3 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Predictive risk</TabsTrigger>
                    <TabsTrigger value="recommendations" className="w-full rounded-xl px-4 py-3 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Recommendations</TabsTrigger>
                  </TabsList>
                </div>
              </div>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {statCards.map((stat) => {
                    const Icon = stat.icon;

                    return (
                      <Card key={stat.title} className="border-border/80">
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                          <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                            <div className="text-3xl font-semibold tracking-tight">{stat.value}</div>
                          </div>
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">{stat.description}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="border-border/80">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>Completion trends</CardTitle>
                          <CardDescription>Monthly enrollment intake and completions across the platform.</CardDescription>
                        </div>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          {completionDelta >= 0 ? `+${completionDelta}` : completionDelta}% vs last month
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.monthlyTrends}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="totalEnrollments" name="Enrollments" fill={chartPalette.accent} radius={[6, 6, 0, 0]} />
                            <Bar dataKey="completedEnrollments" name="Completions" fill={chartPalette.primary} radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/80">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>Certificate issuance</CardTitle>
                          <CardDescription>Monthly certificate release volume across completed training.</CardDescription>
                        </div>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          {certificateDelta >= 0 ? `+${certificateDelta}` : certificateDelta} this month
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analytics.monthlyTrends}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Area
                              type="monotone"
                              dataKey="certificatesIssued"
                              name="Certificates"
                              stroke={chartPalette.warm}
                              fill={chartPalette.warm}
                              fillOpacity={0.14}
                              strokeWidth={3}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/80">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>Trainee performance trends</CardTitle>
                          <CardDescription>Average progress and assessment score trends across recent months.</CardDescription>
                        </div>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          Avg score {analytics.averageAssessmentScore}%
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analytics.monthlyTrends}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="averageProgress" name="Avg progress" stroke={chartPalette.primary} strokeWidth={3} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="averageAssessmentScore" name="Avg assessment score" stroke={chartPalette.rose} strokeWidth={3} dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/80">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>System-wide engagement</CardTitle>
                          <CardDescription>Recent activity and learning time trends across the platform.</CardDescription>
                        </div>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          {engagementDelta >= 0 ? `+${engagementDelta}` : engagementDelta} active learners
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analytics.monthlyTrends}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="activeLearners" name="Active learners" stroke={chartPalette.accent} strokeWidth={3} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="timeSpentHours" name="Learning hours" stroke={chartPalette.slate} strokeWidth={3} dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                  <Card className="border-border/80">
                    <CardHeader>
                      <CardTitle>Engagement snapshot</CardTitle>
                      <CardDescription>Key learning engagement indicators surfaced directly on the dashboard.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                        <p className="text-sm text-muted-foreground">Active learners, last 7 days</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.activeLearners7Days}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                        <p className="text-sm text-muted-foreground">Active learners, last 30 days</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.activeLearners30Days}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                        <p className="text-sm text-muted-foreground">Average progress</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.averageProgress}%</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                        <p className="text-sm text-muted-foreground">Average assessment score</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.averageAssessmentScore}%</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 sm:col-span-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Total learning time captured</p>
                            <p className="mt-2 text-3xl font-semibold tracking-tight">{formatHours(analytics.totalLearningHours)}</p>
                          </div>
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Gauge className="h-6 w-6" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/80">
                    <CardHeader>
                      <CardTitle>Top course insights</CardTitle>
                      <CardDescription>Highest-volume courses with completion and certification context.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {topCourses.length > 0 ? (
                        topCourses.map((course, index) => (
                          <div key={course.courseId} className="rounded-2xl border border-border/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Top {index + 1}</p>
                                <h3 className="mt-1 text-base font-semibold">{course.courseTitle}</h3>
                              </div>
                              <Badge variant="outline" className="rounded-full px-3 py-1">
                                {course.completionRate}% complete
                              </Badge>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                              <div>
                                <p className="text-xs text-muted-foreground">Enrollments</p>
                                <p className="mt-1 text-lg font-semibold">{course.enrollments}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Certificates</p>
                                <p className="mt-1 text-lg font-semibold">{course.certificatesIssued}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Avg progress</p>
                                <p className="mt-1 text-lg font-semibold">{course.averageProgress}%</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No course analytics are available yet.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle>Recent session activity</CardTitle>
                    <CardDescription>
                      Platform-wide recent module sessions for learner monitoring, with quick flags for repeated short-session patterns.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recentSessions.length > 0 ? (
                      recentSessions.map((session) => (
                        <div key={`${session.learnerId}-${session.courseId}-${session.moduleId}`} className="rounded-2xl border border-border/70 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div>
                                <p className="font-semibold">{session.learnerName || "Unknown learner"}</p>
                                <p className="text-sm text-muted-foreground">{session.learnerEmail || session.learnerId}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium">{session.moduleTitle || "Untitled module"}</p>
                                <p className="text-sm text-muted-foreground">{session.courseTitle || "Untitled course"}</p>
                              </div>
                              <p className="text-xs text-muted-foreground">Last opened {formatRelativeActivity(session.lastSeenAt)}</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary">{formatSessionDuration(session.totalDurationSeconds)}</Badge>
                              <Badge variant="outline">{session.totalSessions} sessions</Badge>
                              <Badge variant="outline">{formatSessionStatus(session.latestSessionStatus)}</Badge>
                              {session.needsAttention ? <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">Needs review</Badge> : null}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent session activity is available yet.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="risk" className="space-y-4">
                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle>Predictive oversight</CardTitle>
                    <CardDescription>Stored course-risk and learner-disengagement scores refreshed from current platform activity.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                      <p className="text-sm font-medium text-foreground">How to use Predictive Oversight</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Treat this as an early-warning view. High-risk counts and score trends help you spot courses with slipping completion or learners showing disengagement patterns so you can follow up in enrollments, learner activity, or reports before the issue spreads.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                        <p className="text-sm text-muted-foreground">High-risk courses</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.predictiveOverview.highRiskCourses}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                        <p className="text-sm text-muted-foreground">High-risk learners</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.predictiveOverview.highRiskLearners}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                        <p className="text-sm text-muted-foreground">Avg course risk score</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.predictiveOverview.averageCourseRiskScore}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                        <p className="text-sm text-muted-foreground">Avg disengagement score</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.predictiveOverview.averageDisengagementScore}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      A 0% recommendation acceptance rate does not cancel out a high risk score. Predictive risk still weighs completion decline, inactive enrollments, and disengagement signals, so courses can rank high-risk before recommendation clicks and accepts accumulate.
                    </div>
                    {courseRiskChartData.length > 0 ? (
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={courseRiskChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} />
                            <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="riskScore" name="Risk score" fill={chartPalette.rose} radius={[6, 6, 0, 0]} />
                            <Bar dataKey="acceptanceRate" name="Rec accept rate" fill={chartPalette.accent} radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Predictive course-risk scores will appear after analytics rollups populate the stored snapshots.</p>
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <Card className="border-border/80">
                    <CardHeader>
                      <CardTitle>Highest course risk</CardTitle>
                      <CardDescription>Stored course-risk snapshots ordered by urgency.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {highestRiskCourses.length > 0 ? (
                        highestRiskCourses.map((course) => (
                          <div key={course.courseId} className="rounded-2xl border border-border/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold">{course.courseTitle}</p>
                                <p className="text-sm text-muted-foreground">{course.activeEnrollments} active enrollments • {course.completionRate}% completion</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={course.riskLevel === "high" ? "border-red-200 text-red-700" : course.riskLevel === "medium" ? "border-amber-200 text-amber-700" : "border-emerald-200 text-emerald-700"}
                              >
                                {course.riskLevel} risk
                              </Badge>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                              <div>
                                <p className="text-xs text-muted-foreground">Risk score</p>
                                <p className="mt-1 text-lg font-semibold">{course.riskScore}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Rec accept rate</p>
                                <p className="mt-1 text-lg font-semibold">{course.recommendationAcceptanceRate}%</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Course link</p>
                                <Link to="/admin/courses" className="mt-1 inline-flex text-sm font-medium text-primary">
                                  Open library
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No stored course-risk insights are available yet.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/80">
                    <CardHeader>
                      <CardTitle>Learner disengagement watchlist</CardTitle>
                      <CardDescription>Stored disengagement scores highlight learners with inactivity and short-session risk signals.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {disengagementWatchlist.length > 0 ? (
                        disengagementWatchlist.map((learner) => (
                          <div key={learner.userId} className="rounded-2xl border border-border/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold">{learner.userName || learner.userEmail || learner.userId}</p>
                                <p className="text-sm text-muted-foreground">{learner.userEmail || "Learner record from predictive snapshot"}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={learner.riskLevel === "high" ? "border-red-200 text-red-700" : learner.riskLevel === "medium" ? "border-amber-200 text-amber-700" : "border-emerald-200 text-emerald-700"}
                              >
                                {learner.riskLevel} risk
                              </Badge>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Score</p>
                                <p className="mt-1 text-lg font-semibold">{learner.disengagementScore}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Inactive days</p>
                                <p className="mt-1 text-lg font-semibold">{learner.inactiveDays}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Incomplete enrollments</p>
                                <p className="mt-1 text-lg font-semibold">{learner.incompleteEnrollments}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Short sessions</p>
                                <p className="mt-1 text-lg font-semibold">{learner.repeatedShortSessionCount}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No disengagement watchlist entries are available yet.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="recommendations" className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <Card className="border-border/80">
                    <CardHeader>
                      <CardTitle>Recommendation performance</CardTitle>
                      <CardDescription>Acceptance probability, recommendation response, and downstream outcomes across the platform.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                          <p className="text-sm text-muted-foreground">Impressions</p>
                          <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.recommendationAnalytics.totalImpressions}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                          <p className="text-sm text-muted-foreground">Accept rate</p>
                          <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.recommendationAnalytics.averageAcceptRate}%</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                          <p className="text-sm text-muted-foreground">Avg acceptance probability</p>
                          <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.recommendationAnalytics.averageAcceptanceProbability}%</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                          <p className="text-sm text-muted-foreground">Recommended completion rate</p>
                          <p className="mt-2 text-3xl font-semibold tracking-tight">{analytics.recommendationAnalytics.recommendedEnrollmentCompletionRate}%</p>
                        </div>
                      </div>
                      {recommendationPerformanceData.length > 0 ? (
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={recommendationPerformanceData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" tickLine={false} axisLine={false} />
                              <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="acceptRate" name="Accept rate" stroke={chartPalette.primary} strokeWidth={3} dot={{ r: 4 }} />
                              <Line type="monotone" dataKey="acceptanceProbability" name="Predicted acceptance" stroke={chartPalette.warm} strokeWidth={3} dot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Recommendation-performance charts will appear after learner recommendation rows accumulate interaction data.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/80">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg">Quick links</CardTitle>
                      <CardDescription>Use the core admin tools after reviewing the recommendation and analytics signals.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {adminActions.map((action) => {
                          const Icon = action.icon;

                          return (
                            <Link
                              key={action.title}
                              to={action.href}
                              className="group flex min-h-[120px] flex-col justify-between rounded-2xl border border-border/80 bg-background px-4 py-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
                            >
                              <div className="space-y-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div className="space-y-1.5">
                                  <h2 className="text-sm font-semibold text-foreground">{action.title}</h2>
                                  <p className="text-xs leading-5 text-muted-foreground">{action.description}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex items-center gap-2 text-sm font-medium text-primary">
                                Open
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboardPlaceholder;