import { useState, useEffect } from "react";
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
} from "lucide-react";
import { reportingService } from "@/services/reportingService";
import {
  CompletionReport,
  UserActivityReport,
  CertificateReport,
  ComplianceReportData,
  EnrollmentReport,
} from "@/services/reportingService";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { courseService } from "@/services/supabaseDatabaseService";
import { Course } from "@/types";
import jsPDF from "jspdf";

const COLORS = ["#1e40af", "#059669", "#dc2626", "#ea580c", "#7c3aed", "#be185d"];

const Reports = () => {
  const [activeTab, setActiveTab] = useState("completion");
  const [loading, setLoading] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState<string>(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [compliancePeriod, setCompliancePeriod] = useState<"month" | "quarter" | "year">("month");

  // Data
  const [completionReports, setCompletionReports] = useState<CompletionReport[]>([]);
  const [userActivityReports, setUserActivityReports] = useState<UserActivityReport[]>([]);
  const [certificateReports, setCertificateReports] = useState<CertificateReport[]>([]);
  const [complianceReport, setComplianceReport] = useState<ComplianceReportData | null>(null);
  const [enrollmentReports, setEnrollmentReports] = useState<EnrollmentReport[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    loadCourses();
  }, []);

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
    }
  }, [activeTab, startDate, endDate, selectedCourseId, selectedRole, compliancePeriod]);

  const loadCourses = async () => {
    try {
      const allCourses = await courseService.getCourses();
      setCourses(allCourses);
    } catch (error) {
      console.error("Error loading courses:", error);
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
              {activeTab === "completion" || activeTab === "enrollments" ? (
                <div className="space-y-2">
                  <Label htmlFor="course">Course</Label>
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
                      <SelectItem value="learner">Learner</SelectItem>
                      <SelectItem value="trainer">Trainer</SelectItem>
                      <SelectItem value="validator">Validator</SelectItem>
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
          <TabsList className="grid w-full grid-cols-5">
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
          </TabsList>

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
                        <ResponsiveContainer width="100%" height={300}>
                          <RechartsPieChart>
                            <Tooltip />
                            <Legend />
                            <RechartsPieChart
                              data={Object.entries(
                                userActivityReports.reduce((acc, r) => {
                                  acc[r.role] = (acc[r.role] || 0) + 1;
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
                                userActivityReports.reduce((acc, r) => {
                                  acc[r.role] = (acc[r.role] || 0) + 1;
                                  return acc;
                                }, {} as Record<string, number>)
                              ).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </RechartsPieChart>
                          </RechartsPieChart>
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
                            <RechartsPieChart
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
                            </RechartsPieChart>
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
                                <td className="p-3 text-sm font-mono text-xs">
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
                            <RechartsPieChart
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
                            </RechartsPieChart>
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

