import { useState, useEffect } from "react";
import { LearnerLeaderboardCard } from "@/components/course/LearnerLeaderboardCard";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Download,
  Users,
  Award,
  BookOpen,
  TrendingUp,
  Calendar,
  BarChart3,
  PieChart,
  FileSpreadsheet,
  Trophy,
  ClipboardCheck,
} from "lucide-react";
import { reportingService } from "@/services/reportingService";
import {
  CompletionReport,
  CourseContentCompletenessReport,
  UserActivityReport,
  CertificateReport,
  ComplianceReportData,
  EnrollmentReport,
  LearnerLeaderboard,
  StaffPerformanceScorecard,
} from "@/services/reportingService";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { courseService, programService } from "@/services/supabaseDatabaseService";
import { Course, Program } from "@/types";
import jsPDF from "jspdf";

const COLORS = ["#1e40af", "#059669", "#dc2626", "#ea580c", "#7c3aed", "#be185d"];

const Reports = () => {
  const [activeTab, setActiveTab] = useState("completion");
  const [loading, setLoading] = useState(false);

  // Filters – default to last 12 months so Total Enrollments and other stats show existing data
  const [startDate, setStartDate] = useState<string>(
    format(subDays(new Date(), 365), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [selectedProgramId, setSelectedProgramId] = useState<string>("all");
  const [rankingScope, setRankingScope] = useState<"course" | "program">("course");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [compliancePeriod, setCompliancePeriod] = useState<"month" | "quarter" | "year">("month");

  // Data
  const [completionReports, setCompletionReports] = useState<CompletionReport[]>([]);
  const [userActivityReports, setUserActivityReports] = useState<UserActivityReport[]>([]);
  const [certificateReports, setCertificateReports] = useState<CertificateReport[]>([]);
  const [complianceReport, setComplianceReport] = useState<ComplianceReportData | null>(null);
  const [enrollmentReports, setEnrollmentReports] = useState<EnrollmentReport[]>([]);
  const [courseLeaderboard, setCourseLeaderboard] = useState<LearnerLeaderboard | null>(null);
  const [contentCompletenessReports, setContentCompletenessReports] = useState<CourseContentCompletenessReport[]>([]);
  const [staffPerformanceScorecards, setStaffPerformanceScorecards] = useState<StaffPerformanceScorecard[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => {
    void loadCatalog();
  }, []);

  useEffect(() => {
    if (activeTab !== "rankings") {
      return;
    }

    if (rankingScope === "course" && selectedCourseId === "all" && courses.length > 0) {
      setSelectedCourseId(courses[0].id);
      return;
    }

    if (rankingScope === "program" && selectedProgramId === "all" && programs.length > 0) {
      setSelectedProgramId(programs[0].id);
    }
  }, [activeTab, courses, programs, rankingScope, selectedCourseId, selectedProgramId]);

  useEffect(() => {
    if (activeTab === "completion") {
      loadCompletionReports();
    } else if (activeTab === "users") {
      loadUserActivityReports();
    } else if (activeTab === "certificates") {
      loadCertificateReports();
    } else if (activeTab === "compliance") {
      loadComplianceReport();
    } else if (activeTab === "enrollments") {
      loadEnrollmentReports();
    } else if (activeTab === "rankings") {
      loadCourseLeaderboard();
    } else if (activeTab === "content") {
      loadContentCompletenessReports();
    } else if (activeTab === "staff") {
      loadStaffPerformanceScorecards();
    }
  }, [activeTab, startDate, endDate, selectedCourseId, selectedProgramId, rankingScope, selectedRole, compliancePeriod]);

  const loadCatalog = async () => {
    try {
      const [allCourses, allPrograms] = await Promise.all([
        courseService.getCourses(),
        programService.getPrograms(),
      ]);
      setCourses(allCourses);
      setPrograms(allPrograms);
    } catch (error) {
      console.error("Error loading report catalog:", error);
    }
  };

  const loadCompletionReports = async () => {
    setLoading(true);
    try {
      const reports = await reportingService.getCompletionReports(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
        selectedCourseId !== "all" ? selectedCourseId : undefined
      );
      setCompletionReports(reports);
    } catch (error) {
      console.error("Error loading completion reports:", error);
      toast.error("Failed to load completion reports");
    } finally {
      setLoading(false);
    }
  };

  const loadUserActivityReports = async () => {
    setLoading(true);
    try {
      const reports = await reportingService.getUserActivityReports(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
        selectedRole !== "all" ? selectedRole : undefined
      );
      setUserActivityReports(reports);
    } catch (error) {
      console.error("Error loading user activity reports:", error);
      toast.error("Failed to load user activity reports");
    } finally {
      setLoading(false);
    }
  };

  const loadCertificateReports = async () => {
    setLoading(true);
    try {
      const reports = await reportingService.getCertificateReports(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );
      setCertificateReports(reports);
    } catch (error) {
      console.error("Error loading certificate reports:", error);
      toast.error("Failed to load certificate reports");
    } finally {
      setLoading(false);
    }
  };

  const loadComplianceReport = async () => {
    setLoading(true);
    try {
      const report = await reportingService.getComplianceReport(compliancePeriod);
      setComplianceReport(report);
    } catch (error) {
      console.error("Error loading compliance report:", error);
      toast.error("Failed to load compliance report");
    } finally {
      setLoading(false);
    }
  };

  const loadEnrollmentReports = async () => {
    setLoading(true);
    try {
      const reports = await reportingService.getEnrollmentReports(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
        selectedCourseId !== "all" ? selectedCourseId : undefined
      );
      setEnrollmentReports(reports);
    } catch (error) {
      console.error("Error loading enrollment reports:", error);
      toast.error("Failed to load enrollment reports");
    } finally {
      setLoading(false);
    }
  };

  const loadCourseLeaderboard = async () => {
    if (rankingScope === "course" && selectedCourseId === "all") {
      setCourseLeaderboard(null);
      setLoading(false);
      return;
    }

    if (rankingScope === "program" && selectedProgramId === "all") {
      setCourseLeaderboard(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const leaderboard = rankingScope === "course"
        ? await reportingService.getLearnerCourseLeaderboard(selectedCourseId, {
            includeIncomplete: true,
            limit: 15,
          })
        : await reportingService.getLearnerProgramLeaderboard(selectedProgramId, {
            includeIncomplete: true,
            limit: 15,
          });
      setCourseLeaderboard(leaderboard);
    } catch (error) {
      console.error("Error loading learner leaderboard:", error);
      toast.error("Failed to load learner leaderboard");
      setCourseLeaderboard(null);
    } finally {
      setLoading(false);
    }
  };

  const loadContentCompletenessReports = async () => {
    setLoading(true);
    try {
      const reports = await reportingService.getCourseContentCompletenessReports(
        selectedCourseId !== "all" ? selectedCourseId : undefined,
      );
      setContentCompletenessReports(reports);
    } catch (error) {
      console.error("Error loading content completeness reports:", error);
      toast.error("Failed to load content completeness reports");
    } finally {
      setLoading(false);
    }
  };

  const loadStaffPerformanceScorecards = async () => {
    setLoading(true);
    try {
      const scorecards = await reportingService.getStaffPerformanceScorecards(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
      );
      setStaffPerformanceScorecards(scorecards);
    } catch (error) {
      console.error("Error loading staff performance scorecards:", error);
      toast.error("Failed to load staff performance scorecards");
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = (content: string, filename: string) => {
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text("PESO Academy - Report", 20, 20);
    pdf.setFontSize(12);
    const lines = pdf.splitTextToSize(content, 170);
    pdf.text(lines, 20, 40);
    pdf.save(filename);
  };

  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header] || "";
            return typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : value;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const getStaffBandClasses = (band: StaffPerformanceScorecard["evaluationBand"]) => {
    switch (band) {
      case "exemplary":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "strong":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "watch":
        return "bg-amber-100 text-amber-700 border-amber-200";
      default:
        return "bg-rose-100 text-rose-700 border-rose-200";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-2">
              Generate comprehensive reports and analytics
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              {activeTab === "completion" || activeTab === "enrollments" || activeTab === "rankings" || activeTab === "content" ? (
                <div className="space-y-2">
                    <Label htmlFor="course">{activeTab === "rankings" ? "Ranking scope" : "Course"}</Label>
                    {activeTab === "rankings" ? (
                      <Select value={rankingScope} onValueChange={(value) => setRankingScope(value as "course" | "program")}>
                        <SelectTrigger id="ranking-scope">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="course">Course</SelectItem>
                          <SelectItem value="program">Program</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                        <SelectTrigger id="course">
                          <SelectValue placeholder="All Courses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Courses</SelectItem>
                          {courses.map((course) => (
                            <SelectItem key={course.id} value={course.id}>
                              {course.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                </div>
              ) : null}
                {activeTab === "rankings" ? (
                  <div className="space-y-2">
                    <Label htmlFor="ranking-entity">{rankingScope === "course" ? "Course" : "Program"}</Label>
                    <Select
                      value={rankingScope === "course" ? selectedCourseId : selectedProgramId}
                      onValueChange={rankingScope === "course" ? setSelectedCourseId : setSelectedProgramId}
                    >
                      <SelectTrigger id="ranking-entity">
                        <SelectValue placeholder={rankingScope === "course" ? "Select a course" : "Select a program"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{rankingScope === "course" ? "All Courses" : "All Programs"}</SelectItem>
                        {(rankingScope === "course" ? courses : programs).map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              {activeTab === "users" ? (
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="trainee">Trainee</SelectItem>
                      <SelectItem value="trainer">Trainer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {activeTab === "compliance" ? (
                <div className="space-y-2">
                  <Label htmlFor="period">Period</Label>
                  <Select
                    value={compliancePeriod}
                    onValueChange={(v) => setCompliancePeriod(v as "month" | "quarter" | "year")}
                  >
                    <SelectTrigger id="period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="quarter">Quarter</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Reports Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="completion">
              <BarChart3 className="w-4 h-4 mr-2" />
              Completion
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="certificates">
              <Award className="w-4 h-4 mr-2" />
              Certificates
            </TabsTrigger>
            <TabsTrigger value="compliance">
              <FileText className="w-4 h-4 mr-2" />
              Compliance
            </TabsTrigger>
            <TabsTrigger value="enrollments">
              <BookOpen className="w-4 h-4 mr-2" />
              Enrollments
            </TabsTrigger>
            <TabsTrigger value="rankings">
              <Trophy className="w-4 h-4 mr-2" />
              Rankings
            </TabsTrigger>
            <TabsTrigger value="content">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Content
            </TabsTrigger>
            <TabsTrigger value="staff">
              <TrendingUp className="w-4 h-4 mr-2" />
              Staff
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 text-sm text-primary">
                Publish-ready modules require finalized status, content body, a media asset, an assessment or learning activity, skill/topic tags, and trainer ownership.
              </CardContent>
            </Card>

            <div className="flex items-center justify-end">
              <Button
                variant="outline"
                disabled={contentCompletenessReports.length === 0}
                onClick={() => {
                  const csvData = contentCompletenessReports.map((report) => ({
                    "Course Title": report.courseTitle,
                    Category: report.courseCategory,
                    Published: report.published ? "Yes" : "No",
                    "Trainer Ownership": report.hasTrainerOwnership ? "Yes" : "No",
                    "Total Modules": report.totalModules,
                    Finalized: report.finalizedModules,
                    Drafts: report.draftModules,
                    "Publish-ready Modules": report.publishReadyModules,
                    "Completeness (%)": report.completenessRate,
                    "Missing Content": report.modulesWithoutContent,
                    "Missing Media": report.modulesWithoutMedia,
                    "Missing Assessment Or Activity": report.modulesWithoutAssessmentOrActivity,
                    "Missing Tags": report.modulesWithoutTags,
                    "Ready To Publish": report.readyToPublish ? "Yes" : "No",
                    "Missing Summary": report.missingSummary.join(" | "),
                  }));

                  exportToCSV(
                    csvData,
                    `content-completeness-report-${format(new Date(), "yyyy-MM-dd")}.csv`,
                    [
                      "Course Title",
                      "Category",
                      "Published",
                      "Trainer Ownership",
                      "Total Modules",
                      "Finalized",
                      "Drafts",
                      "Publish-ready Modules",
                      "Completeness (%)",
                      "Missing Content",
                      "Missing Media",
                      "Missing Assessment Or Activity",
                      "Missing Tags",
                      "Ready To Publish",
                      "Missing Summary",
                    ],
                  );
                }}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {loading ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">Loading content completeness report...</CardContent>
              </Card>
            ) : contentCompletenessReports.length > 0 ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Courses Audited</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{contentCompletenessReports.length}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Ready To Publish</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-emerald-600">{contentCompletenessReports.filter((report) => report.readyToPublish).length}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Draft Modules</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-600">{contentCompletenessReports.reduce((sum, report) => sum + report.draftModules, 0)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Avg Completeness</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {Math.round(contentCompletenessReports.reduce((sum, report) => sum + report.completenessRate, 0) / contentCompletenessReports.length)}%
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Production Content Completeness</CardTitle>
                    <CardDescription>
                      Courses are blocked from publishing until every module meets the publish-ready checklist.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[980px]">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 text-left text-sm font-medium">Course</th>
                            <th className="p-3 text-left text-sm font-medium">Readiness</th>
                            <th className="p-3 text-left text-sm font-medium">Modules</th>
                            <th className="p-3 text-left text-sm font-medium">Drafts</th>
                            <th className="p-3 text-left text-sm font-medium">Missing Content</th>
                            <th className="p-3 text-left text-sm font-medium">Missing Media</th>
                            <th className="p-3 text-left text-sm font-medium">Missing Activity</th>
                            <th className="p-3 text-left text-sm font-medium">Missing Tags</th>
                            <th className="p-3 text-left text-sm font-medium">Summary</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...contentCompletenessReports]
                            .sort((left, right) => {
                              if (left.readyToPublish !== right.readyToPublish) {
                                return Number(left.readyToPublish) - Number(right.readyToPublish);
                              }
                              return left.completenessRate - right.completenessRate;
                            })
                            .map((report) => (
                              <tr key={report.courseId} className="border-t align-top">
                                <td className="p-3 text-sm">
                                  <div>
                                    <p className="font-medium">{report.courseTitle}</p>
                                    <p className="text-muted-foreground">{report.courseCategory}</p>
                                  </div>
                                </td>
                                <td className="p-3 text-sm">
                                  <Badge variant={report.readyToPublish ? "default" : "secondary"}>
                                    {report.readyToPublish ? `Ready (${report.completenessRate}%)` : `Blocked (${report.completenessRate}%)`}
                                  </Badge>
                                  {!report.hasTrainerOwnership ? <p className="mt-2 text-xs text-destructive">Missing trainer owner</p> : null}
                                </td>
                                <td className="p-3 text-sm">{report.publishReadyModules}/{report.totalModules}</td>
                                <td className="p-3 text-sm">{report.draftModules}</td>
                                <td className="p-3 text-sm">{report.modulesWithoutContent}</td>
                                <td className="p-3 text-sm">{report.modulesWithoutMedia}</td>
                                <td className="p-3 text-sm">{report.modulesWithoutAssessmentOrActivity}</td>
                                <td className="p-3 text-sm">{report.modulesWithoutTags}</td>
                                <td className="p-3 text-sm text-muted-foreground">{report.missingSummary.join(" ") || "All requirements satisfied."}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">No content completeness data available.</CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="rankings" className="space-y-4">
            <div className="flex items-center justify-end">
              <Button
                variant="outline"
                disabled={!courseLeaderboard || courseLeaderboard.entries.length === 0}
                onClick={() => {
                  if (!courseLeaderboard) return;
                  const csvData = courseLeaderboard.entries.map((entry) => ({
                    Rank: entry.rank,
                    Learner: entry.learnerName,
                    "Masked Email": entry.learnerEmailMasked || "",
                    Status: entry.status,
                    "Composite Score": entry.compositeScore,
                    "Progress (%)": entry.progress,
                    [`${courseLeaderboard.unitsLabel} Completed`]: `${entry.completedUnits}/${entry.totalUnits}`,
                    "Average Assessment (%)": entry.averageAssessmentScore ?? "",
                    "Learning Minutes": entry.learningMinutes,
                    Certificates: `${entry.certificatesEarned}/${entry.expectedCertificates}`,
                    "Last Activity": entry.lastActivityAt || "",
                  }));
                  exportToCSV(
                    csvData,
                    `learner-${courseLeaderboard.scope}-leaderboard-${format(new Date(), "yyyy-MM-dd")}.csv`,
                    [
                      "Rank",
                      "Learner",
                      "Masked Email",
                      "Status",
                      "Composite Score",
                      "Progress (%)",
                      `${courseLeaderboard.unitsLabel} Completed`,
                      "Average Assessment (%)",
                      "Learning Minutes",
                      "Certificates",
                      "Last Activity",
                    ],
                  );
                }}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            <LearnerLeaderboardCard
              leaderboard={courseLeaderboard}
              loading={loading}
              emptyMessage={rankingScope === "course"
                ? "Select a specific course to view ranked learner standings."
                : "Select a specific program to view ranked learner standings."}
            />
          </TabsContent>

          <TabsContent value="staff" className="space-y-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 text-sm text-primary">
                Staff scorecards are trainer-only and separate evaluative factors from informational operational metrics so admins can compare managed-course outcomes without hiding data gaps.
              </CardContent>
            </Card>

            <div className="flex items-center justify-end">
              <Button
                variant="outline"
                disabled={staffPerformanceScorecards.length === 0}
                onClick={() => {
                  const csvData = staffPerformanceScorecards.map((scorecard) => ({
                    Trainer: scorecard.staffName,
                    Email: scorecard.staffEmail,
                    "Composite Score": scorecard.compositeScore,
                    Band: scorecard.evaluationBand,
                    "Managed Courses": scorecard.informationalMetrics.managedCourses,
                    "Active Learners": scorecard.informationalMetrics.activeLearners,
                    "Total Enrollments": scorecard.informationalMetrics.totalEnrollments,
                    "Certificates Issued": scorecard.informationalMetrics.certificatesIssued,
                    "Avg Learning Hours Per Learner": scorecard.informationalMetrics.averageLearningHoursPerLearner,
                    "Publish-ready Courses": scorecard.informationalMetrics.publishReadyCourses,
                    "Completion Rate (%)": scorecard.courseOutcomeMetrics.completionRate,
                    "Average Assessment (%)": scorecard.courseOutcomeMetrics.averageAssessmentScore ?? "",
                    "Engagement Rate (%)": scorecard.courseOutcomeMetrics.learnerEngagementRate,
                    "At-risk Rate (%)": scorecard.courseOutcomeMetrics.atRiskRate,
                    "Recommendation Conversion (%)": scorecard.courseOutcomeMetrics.recommendationConversionRate,
                    "Content Quality (%)": scorecard.courseOutcomeMetrics.contentQualityRate,
                    Notes: scorecard.notes.join(" | "),
                  }));

                  exportToCSV(
                    csvData,
                    `staff-performance-scorecard-${format(new Date(), "yyyy-MM-dd")}.csv`,
                    [
                      "Trainer",
                      "Email",
                      "Composite Score",
                      "Band",
                      "Managed Courses",
                      "Active Learners",
                      "Total Enrollments",
                      "Certificates Issued",
                      "Avg Learning Hours Per Learner",
                      "Publish-ready Courses",
                      "Completion Rate (%)",
                      "Average Assessment (%)",
                      "Engagement Rate (%)",
                      "At-risk Rate (%)",
                      "Recommendation Conversion (%)",
                      "Content Quality (%)",
                      "Notes",
                    ],
                  );
                }}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {loading ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">Loading staff performance scorecards...</CardContent>
              </Card>
            ) : staffPerformanceScorecards.length > 0 ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Trainers Scored</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{staffPerformanceScorecards.length}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {Math.round(staffPerformanceScorecards.reduce((sum, scorecard) => sum + scorecard.compositeScore, 0) / staffPerformanceScorecards.length)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Managed Courses</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {staffPerformanceScorecards.reduce((sum, scorecard) => sum + scorecard.informationalMetrics.managedCourses, 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Avg Content Quality</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-emerald-600">
                        {Math.round(staffPerformanceScorecards.reduce((sum, scorecard) => sum + scorecard.courseOutcomeMetrics.contentQualityRate, 0) / staffPerformanceScorecards.length)}%
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Staff Performance Assessment Scorecard</CardTitle>
                    <CardDescription>
                      Composite score = completion, assessment quality, learner engagement, risk management, recommendation conversion, and content quality across trainer-managed courses.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[1200px]">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 text-left text-sm font-medium">Trainer</th>
                            <th className="p-3 text-left text-sm font-medium">Score</th>
                            <th className="p-3 text-left text-sm font-medium">Managed Courses</th>
                            <th className="p-3 text-left text-sm font-medium">Completion</th>
                            <th className="p-3 text-left text-sm font-medium">Assessment</th>
                            <th className="p-3 text-left text-sm font-medium">Engagement</th>
                            <th className="p-3 text-left text-sm font-medium">Risk</th>
                            <th className="p-3 text-left text-sm font-medium">Recommendation</th>
                            <th className="p-3 text-left text-sm font-medium">Content</th>
                            <th className="p-3 text-left text-sm font-medium">Operational Metrics</th>
                            <th className="p-3 text-left text-sm font-medium">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffPerformanceScorecards.map((scorecard) => (
                            <tr key={scorecard.staffId} className="border-t align-top">
                              <td className="p-3 text-sm">
                                <div>
                                  <p className="font-medium">{scorecard.staffName}</p>
                                  <p className="text-muted-foreground">{scorecard.staffEmail}</p>
                                </div>
                              </td>
                              <td className="p-3 text-sm">
                                <div className="space-y-2">
                                  <p className="text-lg font-semibold">{scorecard.compositeScore}</p>
                                  <Badge variant="outline" className={getStaffBandClasses(scorecard.evaluationBand)}>
                                    {scorecard.evaluationBand}
                                  </Badge>
                                </div>
                              </td>
                              <td className="p-3 text-sm text-muted-foreground">
                                <p>{scorecard.informationalMetrics.managedCourses} course(s)</p>
                                <p>{scorecard.managedCourseTitles.join(", ")}</p>
                              </td>
                              <td className="p-3 text-sm">
                                <p>{scorecard.courseOutcomeMetrics.completionRate}%</p>
                                <p className="text-xs text-muted-foreground">{scorecard.factorScores.completionRate.explanation}</p>
                              </td>
                              <td className="p-3 text-sm">
                                <p>{scorecard.courseOutcomeMetrics.averageAssessmentScore ?? "N/A"}{scorecard.courseOutcomeMetrics.averageAssessmentScore !== null ? "%" : ""}</p>
                                <p className="text-xs text-muted-foreground">{scorecard.factorScores.assessmentQuality.explanation}</p>
                              </td>
                              <td className="p-3 text-sm">
                                <p>{scorecard.courseOutcomeMetrics.learnerEngagementRate}%</p>
                                <p className="text-xs text-muted-foreground">{scorecard.factorScores.learnerEngagement.explanation}</p>
                              </td>
                              <td className="p-3 text-sm">
                                <p>{scorecard.courseOutcomeMetrics.atRiskRate}% at risk</p>
                                <p className="text-xs text-muted-foreground">{scorecard.factorScores.riskManagement.explanation}</p>
                              </td>
                              <td className="p-3 text-sm">
                                <p>{scorecard.courseOutcomeMetrics.recommendationConversionRate}%</p>
                                <p className="text-xs text-muted-foreground">{scorecard.factorScores.recommendationConversion.explanation}</p>
                              </td>
                              <td className="p-3 text-sm">
                                <p>{scorecard.courseOutcomeMetrics.contentQualityRate}%</p>
                                <p className="text-xs text-muted-foreground">{scorecard.factorScores.contentQuality.explanation}</p>
                              </td>
                              <td className="p-3 text-sm text-muted-foreground">
                                <p>{scorecard.informationalMetrics.activeLearners} active learners</p>
                                <p>{scorecard.informationalMetrics.totalEnrollments} enrollments</p>
                                <p>{scorecard.informationalMetrics.certificatesIssued} certificates</p>
                                <p>{scorecard.informationalMetrics.averageLearningHoursPerLearner} avg hrs/learner</p>
                                <p>{scorecard.informationalMetrics.publishReadyCourses} publish-ready course(s)</p>
                              </td>
                              <td className="p-3 text-sm text-muted-foreground">
                                {scorecard.notes.length > 0 ? scorecard.notes.join(" ") : "All score dimensions have data coverage."}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">No staff performance scorecards are available for the selected period.</CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Completion Reports */}
          <TabsContent value="completion" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Training Completion Reports</CardTitle>
                    <CardDescription>
                      Course completion rates and training effectiveness
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const csvData = completionReports.map((r) => ({
                        "Course Title": r.courseTitle,
                        "Total Enrollments": r.totalEnrollments,
                        "Completed": r.completedEnrollments,
                        "Completion Rate (%)": r.completionRate,
                        "Average Progress (%)": r.averageProgress,
                        "Average Time Spent": formatTime(r.averageTimeSpent),
                      }));
                      exportToCSV(
                        csvData,
                        `completion-report-${format(new Date(), "yyyy-MM-dd")}.csv`,
                        [
                          "Course Title",
                          "Total Enrollments",
                          "Completed",
                          "Completion Rate (%)",
                          "Average Progress (%)",
                          "Average Time Spent",
                        ]
                      );
                    }}
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : completionReports.length > 0 ? (
                  <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid gap-4 md:grid-cols-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{completionReports.length}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {completionReports.reduce((sum, r) => sum + r.totalEnrollments, 0)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Completions</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {completionReports.reduce((sum, r) => sum + r.completedEnrollments, 0)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Avg Completion Rate</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {completionReports.length > 0
                              ? Math.round(
                                  completionReports.reduce((sum, r) => sum + r.completionRate, 0) /
                                    completionReports.length
                                )
                              : 0}
                            %
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Completion Rate Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Completion Rates by Course</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={completionReports}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="courseTitle"
                              angle={-45}
                              textAnchor="end"
                              height={100}
                            />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Bar dataKey="completionRate" fill="#1e40af" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Reports Table */}
                    <div className="space-y-2">
                      <h3 className="font-semibold">Detailed Report</h3>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted">
                            <tr>
                              <th className="p-3 text-left text-sm font-medium">Course</th>
                              <th className="p-3 text-left text-sm font-medium">Enrollments</th>
                              <th className="p-3 text-left text-sm font-medium">Completed</th>
                              <th className="p-3 text-left text-sm font-medium">Completion Rate</th>
                              <th className="p-3 text-left text-sm font-medium">Avg Progress</th>
                              <th className="p-3 text-left text-sm font-medium">Avg Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {completionReports.map((report) => (
                              <tr key={report.courseId} className="border-t">
                                <td className="p-3 text-sm">{report.courseTitle}</td>
                                <td className="p-3 text-sm">{report.totalEnrollments}</td>
                                <td className="p-3 text-sm">{report.completedEnrollments}</td>
                                <td className="p-3 text-sm">
                                  <Badge variant={report.completionRate >= 70 ? "default" : "secondary"}>
                                    {report.completionRate}%
                                  </Badge>
                                </td>
                                <td className="p-3 text-sm">{report.averageProgress}%</td>
                                <td className="p-3 text-sm">{formatTime(report.averageTimeSpent)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <BarChart3 className="w-16 h-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No completion data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Activity Reports */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Activity Reports</CardTitle>
                    <CardDescription>User engagement and activity statistics</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const csvData = userActivityReports.map((r) => ({
                        Name: r.userName,
                        Email: r.userEmail,
                        Role: r.role,
                        "Total Enrollments": r.totalEnrollments,
                        "Completed Courses": r.completedCourses,
                        "Total Time Spent": formatTime(r.totalTimeSpent),
                        "Certificates Earned": r.certificatesEarned,
                        "Last Activity": r.lastActivityDate
                          ? format(new Date(r.lastActivityDate), "yyyy-MM-dd")
                          : "Never",
                      }));
                      exportToCSV(
                        csvData,
                        `user-activity-report-${format(new Date(), "yyyy-MM-dd")}.csv`,
                        [
                          "Name",
                          "Email",
                          "Role",
                          "Total Enrollments",
                          "Completed Courses",
                          "Total Time Spent",
                          "Certificates Earned",
                          "Last Activity",
                        ]
                      );
                    }}
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : userActivityReports.length > 0 ? (
                  <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid gap-4 md:grid-cols-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{userActivityReports.length}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {userActivityReports.reduce((sum, r) => sum + r.totalEnrollments, 0)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Certificates</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {userActivityReports.reduce((sum, r) => sum + r.certificatesEarned, 0)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Time Spent</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {formatTime(
                              userActivityReports.reduce((sum, r) => sum + r.totalTimeSpent, 0)
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Role Distribution Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Users by Role</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const roleData = Object.entries(
                            userActivityReports.reduce((acc, r) => {
                              const role = r.role || "Unknown";
                              acc[role] = (acc[role] || 0) + 1;
                              return acc;
                            }, {} as Record<string, number>)
                          ).map(([name, value]) => ({ name, value }));
                          return roleData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                              <RechartsPieChart>
                                <Tooltip />
                                <Legend />
                                <Pie
                                  data={roleData}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  {roleData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                              </RechartsPieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                              <Users className="w-12 h-12 mb-2" />
                              <p>No role distribution data</p>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>

                    {/* Reports Table */}
                    <div className="space-y-2">
                      <h3 className="font-semibold">Detailed Report</h3>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted">
                            <tr>
                              <th className="p-3 text-left text-sm font-medium">Name</th>
                              <th className="p-3 text-left text-sm font-medium">Email</th>
                              <th className="p-3 text-left text-sm font-medium">Role</th>
                              <th className="p-3 text-left text-sm font-medium">Enrollments</th>
                              <th className="p-3 text-left text-sm font-medium">Completed</th>
                              <th className="p-3 text-left text-sm font-medium">Time Spent</th>
                              <th className="p-3 text-left text-sm font-medium">Certificates</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userActivityReports.map((report) => (
                              <tr key={report.userId} className="border-t">
                                <td className="p-3 text-sm">{report.userName}</td>
                                <td className="p-3 text-sm">{report.userEmail}</td>
                                <td className="p-3 text-sm">
                                  <Badge variant="outline">{report.role}</Badge>
                                </td>
                                <td className="p-3 text-sm">{report.totalEnrollments}</td>
                                <td className="p-3 text-sm">{report.completedCourses}</td>
                                <td className="p-3 text-sm">{formatTime(report.totalTimeSpent)}</td>
                                <td className="p-3 text-sm">{report.certificatesEarned}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Users className="w-16 h-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No user activity data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certificate Reports */}
          <TabsContent value="certificates" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Certificate Issuance Reports</CardTitle>
                    <CardDescription>Certificates issued and verification statistics</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const csvData = certificateReports.map((r) => ({
                        "Certificate Number": r.certificateNumber,
                        "Recipient": r.userName,
                        "Course": r.courseTitle,
                        "Type": r.certificateType,
                        "Issued Date": format(new Date(r.issuedDate), "yyyy-MM-dd"),
                        "Verification Code": r.verificationCode || "N/A",
                      }));
                      exportToCSV(
                        csvData,
                        `certificate-report-${format(new Date(), "yyyy-MM-dd")}.csv`,
                        [
                          "Certificate Number",
                          "Recipient",
                          "Course",
                          "Type",
                          "Issued Date",
                          "Verification Code",
                        ]
                      );
                    }}
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : certificateReports.length > 0 ? (
                  <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid gap-4 md:grid-cols-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Certificates</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{certificateReports.length}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Completion Certificates</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {
                              certificateReports.filter((r) => r.certificateType === "completion")
                                .length
                            }
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Participation Certificates</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {
                              certificateReports.filter((r) => r.certificateType === "participation")
                                .length
                            }
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Unique Recipients</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {new Set(certificateReports.map((r) => r.userId)).size}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Certificate Type Distribution */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Certificate Type Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <RechartsPieChart>
                            <Tooltip />
                            <Legend />
                            <Pie
                              data={[
                                {
                                  name: "Completion",
                                  value: certificateReports.filter(
                                    (r) => r.certificateType === "completion"
                                  ).length,
                                },
                                {
                                  name: "Participation",
                                  value: certificateReports.filter(
                                    (r) => r.certificateType === "participation"
                                  ).length,
                                },
                              ]}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              <Cell fill={COLORS[0]} />
                              <Cell fill={COLORS[1]} />
                            </Pie>
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Reports Table */}
                    <div className="space-y-2">
                      <h3 className="font-semibold">Detailed Report</h3>
                      <div className="border rounded-lg overflow-hidden max-h-[600px] overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              <th className="p-3 text-left text-sm font-medium">Certificate #</th>
                              <th className="p-3 text-left text-sm font-medium">Recipient</th>
                              <th className="p-3 text-left text-sm font-medium">Course</th>
                              <th className="p-3 text-left text-sm font-medium">Type</th>
                              <th className="p-3 text-left text-sm font-medium">Issued Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {certificateReports.map((report) => (
                              <tr key={report.certificateId} className="border-t">
                                <td className="p-3 font-mono text-xs">
                                  {report.certificateNumber}
                                </td>
                                <td className="p-3 text-sm">{report.userName}</td>
                                <td className="p-3 text-sm">{report.courseTitle}</td>
                                <td className="p-3 text-sm">
                                  <Badge variant="outline">{report.certificateType}</Badge>
                                </td>
                                <td className="p-3 text-sm">
                                  {format(new Date(report.issuedDate), "MMM dd, yyyy")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Award className="w-16 h-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No certificate data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance Reports */}
          <TabsContent value="compliance" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Compliance Reports (DOLE/LGU)</CardTitle>
                    <CardDescription>
                      Training compliance and accreditation reports
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!complianceReport) return;
                        const pdf = new jsPDF();
                        pdf.setFontSize(16);
                        pdf.text("PESO Academy - Compliance Report", 20, 20);
                        pdf.setFontSize(12);
                        pdf.text(`Period: ${complianceReport.period}`, 20, 30);
                        pdf.text(`Total Trainings: ${complianceReport.totalTrainings}`, 20, 40);
                        pdf.text(
                          `Total Participants: ${complianceReport.totalParticipants}`,
                          20,
                          50
                        );
                        pdf.text(
                          `Total Completions: ${complianceReport.totalCompletions}`,
                          20,
                          60
                        );
                        pdf.text(
                          `Completion Rate: ${complianceReport.completionRate}%`,
                          20,
                          70
                        );
                        pdf.text(
                          `TESDA Supported: ${complianceReport.tesdaAccreditedTrainings}`,
                          20,
                          80
                        );
                        pdf.text(
                          `Certificates Issued: ${complianceReport.certificatesIssued}`,
                          20,
                          90
                        );
                        pdf.save(`compliance-report-${complianceReport.period}.pdf`);
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!complianceReport) return;
                        const csvData = complianceReport.courses.map((c) => ({
                          "Course Title": c.courseTitle,
                          Participants: c.participants,
                          Completions: c.completions,
                          "Completion Rate (%)": c.completionRate,
                        }));
                        exportToCSV(
                          csvData,
                          `compliance-report-${complianceReport.period}.csv`,
                          ["Course Title", "Participants", "Completions", "Completion Rate (%)"]
                        );
                      }}
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : complianceReport ? (
                  <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid gap-4 md:grid-cols-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Period</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{complianceReport.period}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Trainings</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {complianceReport.totalTrainings}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {complianceReport.totalParticipants}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {complianceReport.completionRate}%
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Completions</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {complianceReport.totalCompletions}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">TESDA Supported</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {complianceReport.tesdaAccreditedTrainings}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Certificates Issued</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {complianceReport.certificatesIssued}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Avg Duration (hours)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {complianceReport.averageTrainingDuration}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Course Breakdown */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Course Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-muted">
                              <tr>
                                <th className="p-3 text-left text-sm font-medium">Course</th>
                                <th className="p-3 text-left text-sm font-medium">Participants</th>
                                <th className="p-3 text-left text-sm font-medium">Completions</th>
                                <th className="p-3 text-left text-sm font-medium">Completion Rate</th>
                              </tr>
                            </thead>
                            <tbody>
                              {complianceReport.courses.map((course, idx) => (
                                <tr key={idx} className="border-t">
                                  <td className="p-3 text-sm">{course.courseTitle}</td>
                                  <td className="p-3 text-sm">{course.participants}</td>
                                  <td className="p-3 text-sm">{course.completions}</td>
                                  <td className="p-3 text-sm">
                                    <Badge
                                      variant={course.completionRate >= 70 ? "default" : "secondary"}
                                    >
                                      {course.completionRate}%
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No compliance data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Enrollment Reports */}
          <TabsContent value="enrollments" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Enrollment Reports</CardTitle>
                    <CardDescription>Detailed enrollment and progress tracking</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const csvData = enrollmentReports.map((r) => ({
                        "Learner": r.userName,
                        "Course": r.courseTitle,
                        "Enrolled Date": format(new Date(r.enrolledDate), "yyyy-MM-dd"),
                        "Completed Date": r.completedDate
                          ? format(new Date(r.completedDate), "yyyy-MM-dd")
                          : "N/A",
                        "Progress (%)": r.progress,
                        Status: r.status,
                        "Time Spent": formatTime(r.timeSpent),
                      }));
                      exportToCSV(
                        csvData,
                        `enrollment-report-${format(new Date(), "yyyy-MM-dd")}.csv`,
                        [
                          "Learner",
                          "Course",
                          "Enrolled Date",
                          "Completed Date",
                          "Progress (%)",
                          "Status",
                          "Time Spent",
                        ]
                      );
                    }}
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : enrollmentReports.length > 0 ? (
                  <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid gap-4 md:grid-cols-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{enrollmentReports.length}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {enrollmentReports.filter((r) => r.status === "completed").length}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {enrollmentReports.filter((r) => r.status === "in-progress").length}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Time Spent</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {formatTime(
                              enrollmentReports.reduce((sum, r) => sum + r.timeSpent, 0)
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Status Distribution Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Enrollment Status Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <RechartsPieChart>
                            <Tooltip />
                            <Legend />
                            <Pie
                              data={Object.entries(
                                enrollmentReports.reduce((acc, r) => {
                                  acc[r.status] = (acc[r.status] || 0) + 1;
                                  return acc;
                                }, {} as Record<string, number>)
                              ).map(([name, value]) => ({ name, value }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {Object.entries(
                                enrollmentReports.reduce((acc, r) => {
                                  acc[r.status] = (acc[r.status] || 0) + 1;
                                  return acc;
                                }, {} as Record<string, number>)
                              ).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Reports Table */}
                    <div className="space-y-2">
                      <h3 className="font-semibold">Detailed Report</h3>
                      <div className="border rounded-lg overflow-hidden max-h-[600px] overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              <th className="p-3 text-left text-sm font-medium">Learner</th>
                              <th className="p-3 text-left text-sm font-medium">Course</th>
                              <th className="p-3 text-left text-sm font-medium">Enrolled</th>
                              <th className="p-3 text-left text-sm font-medium">Completed</th>
                              <th className="p-3 text-left text-sm font-medium">Progress</th>
                              <th className="p-3 text-left text-sm font-medium">Status</th>
                              <th className="p-3 text-left text-sm font-medium">Time Spent</th>
                            </tr>
                          </thead>
                          <tbody>
                            {enrollmentReports.map((report) => (
                              <tr key={report.enrollmentId} className="border-t">
                                <td className="p-3 text-sm">{report.userName}</td>
                                <td className="p-3 text-sm">{report.courseTitle}</td>
                                <td className="p-3 text-sm">
                                  {format(new Date(report.enrolledDate), "MMM dd, yyyy")}
                                </td>
                                <td className="p-3 text-sm">
                                  {report.completedDate
                                    ? format(new Date(report.completedDate), "MMM dd, yyyy")
                                    : "-"}
                                </td>
                                <td className="p-3 text-sm">{report.progress}%</td>
                                <td className="p-3 text-sm">
                                  <Badge
                                    variant={
                                      report.status === "completed"
                                        ? "default"
                                        : report.status === "in-progress"
                                          ? "secondary"
                                          : "outline"
                                    }
                                  >
                                    {report.status}
                                  </Badge>
                                </td>
                                <td className="p-3 text-sm">{formatTime(report.timeSpent)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No enrollment data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reports;

