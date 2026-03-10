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
import { AdminDashboardAnalytics, reportingService } from "@/services/reportingService";
import { toast } from "sonner";

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

const AdminDashboardPlaceholder = () => {
  const [analytics, setAnalytics] = useState<AdminDashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardMetrics = async () => {
      try {
        setLoading(true);
        const dashboardAnalytics = await reportingService.getAdminDashboardAnalytics();
        setAnalytics(dashboardAnalytics);
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
                Review organization-wide enrollments, completion outcomes, certificate issuance, trainee performance, and learning engagement from one dashboard.
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
                    <defs>
                      <linearGradient id="certificateTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartPalette.warm} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={chartPalette.warm} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="certificatesIssued"
                      name="Certificates"
                      stroke={chartPalette.warm}
                      fill="url(#certificateTrend)"
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
                    <Line
                      type="monotone"
                      dataKey="averageProgress"
                      name="Avg progress"
                      stroke={chartPalette.primary}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="averageAssessmentScore"
                      name="Avg assessment score"
                      stroke={chartPalette.rose}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
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
                    <Line
                      type="monotone"
                      dataKey="activeLearners"
                      name="Active learners"
                      stroke={chartPalette.accent}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="timeSpentHours"
                      name="Learning hours"
                      stroke={chartPalette.slate}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

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
              {analytics.topCourses.length > 0 ? (
                analytics.topCourses.map((course, index) => (
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
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Quick links</CardTitle>
            <CardDescription>
              Use the core admin tools after reviewing the analytics above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboardPlaceholder;