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
  RefreshCw,
  ShieldCheck,
  Sparkles,
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AdminDashboardAnalytics,
  CollaborativeRecommendationDebugData,
  reportingService,
} from "@/services/reportingService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface AdminLearnerOption {
  id: string;
  name: string | null;
  email: string | null;
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

const dedupeLearnerOptions = (learners: AdminLearnerOption[]) => {
  const learnerMap = new Map<string, AdminLearnerOption>();

  for (const learner of learners) {
    if (!learner.id) {
      continue;
    }

    learnerMap.set(learner.id, learner);
  }

  return Array.from(learnerMap.values()).sort((left, right) => {
    const leftLabel = left.name || left.email || left.id;
    const rightLabel = right.name || right.email || right.id;
    return leftLabel.localeCompare(rightLabel);
  });
};

const AdminDashboardPlaceholder = () => {
  const [analytics, setAnalytics] = useState<AdminDashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentSessionActivity, setRecentSessionActivity] = useState<AdminRecentSessionCard[]>([]);
  const [learnerOptions, setLearnerOptions] = useState<AdminLearnerOption[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [collaborativeDebug, setCollaborativeDebug] = useState<CollaborativeRecommendationDebugData | null>(null);
  const [collaborativeLoading, setCollaborativeLoading] = useState(false);
  const [collaborativeRefreshKey, setCollaborativeRefreshKey] = useState(0);

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
        let learners: AdminLearnerOption[] = [];

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

              learners = (users || []).map((user) => ({
                id: user.id,
                name: user.name || null,
                email: user.email || null,
              }));
            }
          }

          const { data: learnerRows, error: learnerRowsError } = await supabase
            .from("users")
            .select("id, name, email")
            .eq("role", "trainee")
            .order("name", { ascending: true });

          if (learnerRowsError) {
            console.warn("Failed to load full learner selector for admin dashboard:", learnerRowsError);
          } else {
            learners = dedupeLearnerOptions([
              ...learners,
              ...(learnerRows || []).map((learner) => ({
                id: learner.id,
                name: learner.name || null,
                email: learner.email || null,
              })),
            ]);
          }
        }

        setAnalytics(dashboardAnalytics);
        setLearnerOptions(learners);
        setSelectedLearnerId((currentLearnerId) => {
          if (currentLearnerId && learners.some((learner) => learner.id === currentLearnerId)) {
            return currentLearnerId;
          }

          return learners[0]?.id || "";
        });
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

  useEffect(() => {
    const loadCollaborativeDebug = async () => {
      if (!selectedLearnerId) {
        setCollaborativeDebug(null);
        return;
      }

      try {
        setCollaborativeLoading(true);
        const debugData = await reportingService.getCollaborativeRecommendationDebugData(selectedLearnerId);
        setCollaborativeDebug(debugData);
      } catch (error) {
        console.error("Failed to load collaborative recommendation evidence:", error);
        toast.error("Failed to load collaborative recommendation evidence");
      } finally {
        setCollaborativeLoading(false);
      }
    };

    void loadCollaborativeDebug();
  }, [selectedLearnerId, collaborativeRefreshKey]);

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
  const selectedLearner = learnerOptions.find((learner) => learner.id === selectedLearnerId) || null;
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

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Predictive oversight</CardTitle>
              <CardDescription>Stored course-risk and learner-disengagement scores refreshed from current platform activity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
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
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Highest course risk</CardTitle>
              <CardDescription>Stored course-risk snapshots ordered by urgency.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.riskCourseInsights.length > 0 ? (
                analytics.riskCourseInsights.map((course) => (
                  <div key={course.courseId} className="rounded-2xl border border-border/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{course.courseTitle}</p>
                        <p className="text-sm text-muted-foreground">
                          {course.activeEnrollments} active enrollments • {course.completionRate}% completion
                        </p>
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
                        <Link to={`/admin/courses`} className="mt-1 inline-flex text-sm font-medium text-primary">
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
              {analytics.disengagementInsights.length > 0 ? (
                analytics.disengagementInsights.map((learner) => (
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

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Recent Session Activity</CardTitle>
            <CardDescription>
              Platform-wide recent module sessions for learner monitoring, with quick flags for repeated short-session patterns.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSessionActivity.length > 0 ? (
              recentSessionActivity.map((session) => (
                <div key={`${session.learnerId}-${session.courseId}-${session.moduleId}`} className="rounded-2xl border border-border/70 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold">
                          {session.learnerName || "Unknown learner"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {session.learnerEmail || session.learnerId}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{session.moduleTitle || "Untitled module"}</p>
                        <p className="text-sm text-muted-foreground">{session.courseTitle || "Untitled course"}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Last opened {formatRelativeActivity(session.lastSeenAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{formatSessionDuration(session.totalDurationSeconds)}</Badge>
                      <Badge variant="outline">{session.totalSessions} sessions</Badge>
                      <Badge variant="outline">{formatSessionStatus(session.latestSessionStatus)}</Badge>
                      {session.needsAttention ? (
                        <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">Needs review</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent session activity is available yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle>Hybrid recommendation evidence</CardTitle>
                </div>
                <CardDescription>
                  Inspect the collaborative-filtering evidence behind learner recommendations before the final hybrid scorer blends it with content and performance signals.
                </CardDescription>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                <Select value={selectedLearnerId} onValueChange={setSelectedLearnerId}>
                  <SelectTrigger className="min-w-[260px]">
                    <SelectValue placeholder="Select a learner" />
                  </SelectTrigger>
                  <SelectContent>
                    {learnerOptions.map((learner) => (
                      <SelectItem key={learner.id} value={learner.id}>
                        {learner.name || learner.email || learner.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => setCollaborativeRefreshKey((currentValue) => currentValue + 1)}
                  disabled={!selectedLearnerId || collaborativeLoading}
                >
                  <RefreshCw className={collaborativeLoading ? "animate-spin" : ""} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {learnerOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No learners are available for collaborative recommendation inspection yet.</p>
            ) : collaborativeLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Loading collaborative recommendation evidence...
              </div>
            ) : !collaborativeDebug ? (
              <p className="text-sm text-muted-foreground">Select a learner to inspect recommendation evidence.</p>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">Selected learner</p>
                    <p className="mt-2 text-lg font-semibold">{selectedLearner?.name || selectedLearner?.email || selectedLearnerId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedLearner?.email || "Learner record loaded from the admin directory"}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">Compared enrolled courses</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">{collaborativeDebug.targetCourseCount}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">Similar learners / candidates</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">
                      {collaborativeDebug.similarLearnerCount} / {collaborativeDebug.candidates.length}
                    </p>
                  </div>
                </div>

                {collaborativeDebug.targetCourseCount === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/80 p-5 text-sm text-muted-foreground">
                    This learner does not have enough enrollment history yet. Collaborative filtering starts once the learner has active or completed course history to compare against other trainees.
                  </div>
                ) : collaborativeDebug.candidates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/80 p-5 text-sm text-muted-foreground">
                    No collaborative candidates were produced for this learner yet. The learner may have unique course history, or the current dataset may not have enough overlapping paths.
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-base font-semibold">Collaborative candidate courses</h3>
                        <p className="text-sm text-muted-foreground">
                          These are the courses contributed by similar-learner behavior before the full hybrid ranker blends them with profile, content, and performance signals.
                        </p>
                      </div>
                      {collaborativeDebug.candidates.map((candidate) => (
                        <div key={candidate.courseId} className="rounded-2xl border border-border/70 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div>
                                <p className="font-semibold">{candidate.courseTitle}</p>
                                <p className="text-sm text-muted-foreground">{candidate.reason}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">{Math.round(candidate.normalizedScore * 100)}% collaborative score</Badge>
                                <Badge variant="outline">Raw {candidate.rawScore.toFixed(2)}</Badge>
                                <Badge variant="outline">{candidate.supportCount} similar learners</Badge>
                                <Badge variant="outline">{candidate.completedBySimilarLearners} completions</Badge>
                              </div>
                            </div>
                            <div className="rounded-xl bg-primary/10 px-3 py-2 text-right text-sm text-primary">
                              <p className="font-semibold">{candidate.supportingLearnerIds.length}</p>
                              <p className="text-xs uppercase tracking-[0.16em]">Supporters</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h3 className="text-base font-semibold">Top similar learners</h3>
                        <p className="text-sm text-muted-foreground">Similarity is based on shared course history, overlap completions, and progress closeness.</p>
                      </div>
                      {collaborativeDebug.neighbors.map((neighbor) => (
                        <div key={neighbor.learnerId} className="rounded-2xl border border-border/70 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{neighbor.learnerName || "Unknown learner"}</p>
                              <p className="text-sm text-muted-foreground">{neighbor.learnerEmail || neighbor.learnerId}</p>
                            </div>
                            <Badge variant="secondary">Similarity {neighbor.similarityScore.toFixed(2)}</Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant="outline">{neighbor.overlapCount} shared courses</Badge>
                            <Badge variant="outline">{neighbor.completedOverlapCount} completed overlaps</Badge>
                            <Badge variant="outline">{Math.round(neighbor.averageProgressCloseness * 100)}% progress match</Badge>
                          </div>
                          <div className="mt-4 space-y-2">
                            {neighbor.sharedCourses.map((course) => (
                              <div key={`${neighbor.learnerId}-${course.courseId}`} className="rounded-xl bg-muted/30 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium">{course.courseTitle}</p>
                                    <p className="text-xs text-muted-foreground">Neighbor status: {formatEnrollmentStatus(course.neighborStatus)}</p>
                                  </div>
                                  <div className="text-right text-xs text-muted-foreground">
                                    <p>Learner {Math.round(course.learnerProgress)}%</p>
                                    <p>Neighbor {Math.round(course.neighborProgress)}%</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

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