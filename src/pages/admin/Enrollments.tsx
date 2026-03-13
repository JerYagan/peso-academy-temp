import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Plus, Search, Trash2, Eye, Loader2, Clock3, Award, CheckCircle2, AlertCircle, FileQuestion } from "lucide-react";
import { Enrollment, Course, EnrollmentProgressDetail, Module } from "@/types";
import { enrollmentService, courseService } from "@/services/supabaseDatabaseService";
import { BulkEnrollmentDialog } from "@/components/enrollment/BulkEnrollmentDialog";
import { toast } from "sonner";
import { assessmentService, type AssessmentReviewQueueItem } from "@/services/assessmentService";
import { moduleSessionService, type ModuleSession } from "@/services/moduleSessionService";

type EnrollmentWithDetails = Enrollment & {
  userName?: string;
  userEmail?: string;
  courseTitle?: string;
  lastActivityAt?: string;
};

type RecentSessionCard = {
  id: string;
  moduleTitle: string | null;
  lastSeenAt: string;
  durationSeconds: number;
  sessionStatus: ModuleSession["sessionStatus"];
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

const formatSessionStatus = (status: ModuleSession["sessionStatus"]) => {
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

const AdminEnrollments = () => {
  const [enrollments, setEnrollments] = useState<EnrollmentWithDetails[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bulkEnrollOpen, setBulkEnrollOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [unenrollId, setUnenrollId] = useState<string | null>(null);
  const [preserveProgress, setPreserveProgress] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<EnrollmentWithDetails | null>(null);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressDetail, setProgressDetail] = useState<EnrollmentProgressDetail | null>(null);
  const [manualReviews, setManualReviews] = useState<AssessmentReviewQueueItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSessionCard[]>([]);

  useEffect(() => {
    void initializePage();
  }, []);

  const initializePage = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCourses(), loadEnrollments()]);
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const allCourses = await courseService.getCourses();
      setCourses(allCourses);
    } catch (error) {
      console.error("Error loading courses:", error);
    }
  };

  const loadEnrollments = async () => {
    try {
      const enrollmentRows = await enrollmentService.getEnrollmentsWithDetails();
      setEnrollments(enrollmentRows);
    } catch (error) {
      console.error("Error loading enrollments:", error);
      toast.error("Failed to load enrollments");
    }
  };

  const filteredEnrollments = enrollments.filter((enrollment) => {
    const matchesSearch =
      enrollment.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.courseTitle?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = courseFilter === "all" || enrollment.courseId === courseFilter;
    const matchesStatus = statusFilter === "all" || enrollment.status === statusFilter;
    return matchesSearch && matchesCourse && matchesStatus;
  });

  const moduleLookup = useMemo(() => {
    return new Map(progressDetail?.modules.map((entry) => [entry.module.id, entry.module]) || []);
  }, [progressDetail]);

  const assessmentsByModule = useMemo(() => {
    return (progressDetail?.assessments || []).reduce<Record<string, EnrollmentProgressDetail["assessments"]>>((acc, assessment) => {
      const current = acc[assessment.moduleId] || [];
      current.push(assessment);
      acc[assessment.moduleId] = current;
      return acc;
    }, {});
  }, [progressDetail]);

  const reviewsByModule = useMemo(() => {
    return manualReviews.reduce<Record<string, AssessmentReviewQueueItem[]>>((acc, review) => {
      const current = acc[review.moduleId] || [];
      current.push(review);
      acc[review.moduleId] = current;
      return acc;
    }, {});
  }, [manualReviews]);

  const handleUnenroll = async () => {
    if (!unenrollId) return;

    try {
      const enrollmentId = unenrollId;
      await enrollmentService.unenroll(unenrollId, preserveProgress);
      setEnrollments((current) => {
        if (preserveProgress) {
          return current.map((enrollment) =>
            enrollment.id === enrollmentId
              ? { ...enrollment, status: "dropped" }
              : enrollment,
          );
        }

        return current.filter((enrollment) => enrollment.id !== enrollmentId);
      });
      toast.success(preserveProgress ? "Enrollment marked as dropped" : "User unenrolled successfully");
      setUnenrollId(null);
      setPreserveProgress(false);
      await loadEnrollments();
    } catch (error) {
      console.error("Error unenrolling:", error);
      toast.error("Failed to unenroll user");
    }
  };

  const getStatusBadge = (status: Enrollment["status"]) => {
    const variants: Record<Enrollment["status"], "default" | "secondary" | "outline" | "destructive"> = {
      enrolled: "default",
      "in-progress": "secondary",
      completed: "default",
      dropped: "destructive",
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getLastActiveLabel = (lastActivityAt?: string) => {
    if (!lastActivityAt) return { text: "—", color: "text-muted-foreground" };
    const at = new Date(lastActivityAt).getTime();
    const now = Date.now();
    const hours = (now - at) / (1000 * 60 * 60);
    const days = hours / 24;
    if (hours < 6) return { text: "Active (within 6h)", color: "text-green-600 font-medium" };
    if (hours < 24) return { text: `${Math.round(hours)}h ago`, color: "text-green-600" };
    if (days < 7) return { text: `${Math.round(days)} day(s) ago`, color: "text-yellow-600 dark:text-yellow-500" };
    if (days < 14) return { text: `${Math.round(days)} days ago`, color: "text-orange-600 dark:text-orange-500" };
    return { text: `${Math.round(days / 7)} week(s) ago`, color: "text-red-600 font-medium" };
  };

  const getCompletionBadge = (enrollment: Enrollment) => {
    if (enrollment.completionApprovalStatus === "approved") {
      return <Badge>Completion Approved</Badge>;
    }

    if (enrollment.completionApprovalStatus === "pending") {
      return <Badge variant="secondary">Awaiting Trainer Approval</Badge>;
    }

    if (enrollment.completionApprovalStatus === "needs_revision") {
      return <Badge variant="outline">Needs Follow-up</Badge>;
    }

    return <Badge variant="outline">Not Ready</Badge>;
  };

  const getAssessmentStatusBadge = (assessment: EnrollmentProgressDetail["assessments"][number]) => {
    if (!assessment.latestAttemptId) {
      return <Badge variant="outline">Awaiting submission</Badge>;
    }

    if (assessment.requiresManualReview) {
      if (assessment.reviewStatus === "approved") {
        return <Badge>Essay approved</Badge>;
      }

      if (assessment.reviewStatus === "needs_revision") {
        return <Badge variant="outline">Needs learner follow-up</Badge>;
      }

      if (assessment.reviewStatus === "under_review") {
        return <Badge variant="secondary">Under trainer review</Badge>;
      }

      return <Badge variant="secondary">Pending trainer review</Badge>;
    }

    if (assessment.passed === true) {
      return <Badge>Passed</Badge>;
    }

    if (assessment.passed === false) {
      return <Badge variant="outline">Last attempt did not pass</Badge>;
    }

    return <Badge variant="secondary">Submitted</Badge>;
  };

  const handleViewProgress = async (enrollment: EnrollmentWithDetails) => {
    setSelectedEnrollment(enrollment);
    setProgressDialogOpen(true);
    setProgressLoading(true);

    try {
      const [detail, reviewRows, sessionRows] = await Promise.all([
        enrollmentService.getEnrollmentProgressDetail(enrollment.id),
        assessmentService.getManualReviewQueue({
          learnerId: enrollment.userId,
          enrollmentId: enrollment.id,
          statuses: ["submitted", "under_review", "needs_revision", "approved"],
        }),
        moduleSessionService.getTrainerAccessibleSessions({
          learnerId: enrollment.userId,
          courseId: enrollment.courseId,
          limit: 8,
        }),
      ]);

      if (!detail) {
        throw new Error("Enrollment progress details are not available.");
      }

      const detailModuleLookup = new Map(detail.modules.map((entry) => [entry.module.id, entry.module]));
      setProgressDetail(detail);
      setManualReviews(reviewRows);
      setRecentSessions(
        sessionRows.map((session) => ({
          id: session.id,
          moduleTitle: detailModuleLookup.get(session.moduleId)?.title || null,
          lastSeenAt: session.lastSeenAt,
          durationSeconds: session.durationSeconds,
          sessionStatus: session.sessionStatus,
        })),
      );
    } catch (error) {
      console.error("Error loading enrollment progress:", error);
      toast.error("Failed to load enrollment progress");
      setProgressDetail(null);
      setManualReviews([]);
      setRecentSessions([]);
      setProgressDialogOpen(false);
    } finally {
      setProgressLoading(false);
    }
  };

  const handleProgressDialogChange = (open: boolean) => {
    setProgressDialogOpen(open);
    if (!open) {
      setSelectedEnrollment(null);
      setProgressDetail(null);
      setManualReviews([]);
      setRecentSessions([]);
      setProgressLoading(false);
    }
  };

  const completedModuleCount = progressDetail?.modules.filter((entry) => entry.completed).length || 0;
  const blockedModuleCount = progressDetail?.modules.filter((entry) => !entry.completed && entry.blockedByModuleIds.length > 0).length || 0;
  const pendingReviewCount = manualReviews.filter((review) => review.reviewStatus !== "approved").length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Enrollment Management</h1>
            <p className="text-muted-foreground mt-2">Manage course enrollments</p>
          </div>
          <Button onClick={() => {
            if (courses.length > 0) {
              setSelectedCourse(courses[0]);
              setBulkEnrollOpen(true);
            } else {
              toast.error("Please wait for courses to load");
            }
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Bulk Enroll
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, email, or course..."
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={courseFilter} onValueChange={setCourseFilter}>
                  <SelectTrigger>
                    <SelectValue />
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
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="enrolled">Enrolled</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="dropped">Dropped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enrollments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollments ({filteredEnrollments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading enrollments...</div>
            ) : filteredEnrollments.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No enrollments found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                        <TableHead>Workflow</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnrollments.map((enrollment) => {
                    const lastActive = getLastActiveLabel(enrollment.lastActivityAt || enrollment.enrolledAt);
                    return (
                      <TableRow key={enrollment.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{enrollment.userName || "Unknown"}</div>
                            <div className="text-sm text-muted-foreground">{enrollment.userEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell>{enrollment.courseTitle || "Unknown Course"}</TableCell>
                        <TableCell>{getStatusBadge(enrollment.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${enrollment.progress}%` }}
                              />
                            </div>
                            <span className="text-sm">{enrollment.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {getCompletionBadge(enrollment)}
                            {enrollment.certificateId ? <Badge variant="secondary">Certificate released</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={lastActive.color}>{lastActive.text}</span>
                        </TableCell>
                        <TableCell>
                          {new Date(enrollment.enrolledAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleViewProgress(enrollment)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Progress
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setUnenrollId(enrollment.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bulk Enrollment Dialog */}
      {selectedCourse && (
        <BulkEnrollmentDialog
          open={bulkEnrollOpen}
          onOpenChange={(open) => {
            setBulkEnrollOpen(open);
            if (!open) setSelectedCourse(null);
          }}
          course={selectedCourse}
          onSuccess={loadEnrollments}
        />
      )}

      <Dialog open={progressDialogOpen} onOpenChange={handleProgressDialogChange}>
        <DialogContent className="flex h-[calc(100vh-1.5rem)] min-h-0 w-[calc(100vw-1.5rem)] max-w-5xl flex-col overflow-hidden p-0 sm:h-[90vh] sm:w-full">
          <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
            <DialogTitle>
              {selectedEnrollment?.userName || "Learner"} • {progressDetail?.course?.title || selectedEnrollment?.courseTitle || "Enrollment Progress"}
            </DialogTitle>
            <DialogDescription>
              Admin visibility includes summary progress, module-by-module progression, assessment status, essay review status, and recent course activity.
            </DialogDescription>
          </DialogHeader>

          {progressLoading ? (
            <div className="flex items-center justify-center px-4 py-16 sm:px-6">
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading enrollment progress...</p>
            </div>
          ) : !progressDetail ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground sm:px-6">
              Enrollment progress details are not available.
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 px-4 py-4 pb-6 sm:px-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">{progressDetail.enrollment.progress}%</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Modules Completed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">{completedModuleCount}/{progressDetail.modules.length}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">{pendingReviewCount}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Blocked Modules</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">{blockedModuleCount}</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Enrollment Workflow</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {getStatusBadge(progressDetail.enrollment.status)}
                        {getCompletionBadge(progressDetail.enrollment)}
                        <Badge variant={progressDetail.enrollment.certificateId ? "default" : "secondary"}>
                          {progressDetail.enrollment.certificateId ? "Certificate released" : "Certificate not released"}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Course Progress</span>
                          <span className="font-medium">{progressDetail.enrollment.progress}%</span>
                        </div>
                        <Progress value={progressDetail.enrollment.progress} />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 text-sm">
                        <div className="rounded-lg border p-3">
                          <p className="text-muted-foreground">Last activity</p>
                          <p className="mt-1 font-medium">{getLastActiveLabel(progressDetail.enrollment.lastActivityAt).text}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-muted-foreground">Completion queue</p>
                          <p className="mt-1 font-medium">
                            {progressDetail.enrollment.completionApprovalStatus === "pending"
                              ? "Waiting on trainer approval"
                              : progressDetail.enrollment.completionApprovalStatus === "approved"
                              ? "Approved"
                              : progressDetail.enrollment.completionApprovalStatus === "needs_revision"
                              ? "Returned for follow-up"
                              : "Not yet ready"}
                          </p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-muted-foreground">Credited hours</p>
                          <p className="mt-1 font-medium">{progressDetail.enrollment.creditedDurationHours ?? "—"}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-muted-foreground">Actual learning minutes</p>
                          <p className="mt-1 font-medium">{progressDetail.enrollment.actualLearningMinutes ?? "—"}</p>
                        </div>
                      </div>
                      {progressDetail.enrollment.completionFeedback ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          <p className="font-medium">Latest trainer feedback</p>
                          <p className="mt-1 whitespace-pre-wrap">{progressDetail.enrollment.completionFeedback}</p>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Recent Course Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {recentSessions.length > 0 ? (
                        recentSessions.map((session) => (
                          <div key={session.id} className="rounded-lg border p-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="font-medium">{session.moduleTitle || "Untitled module"}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Last opened {getLastActiveLabel(session.lastSeenAt).text}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">{formatSessionDuration(session.durationSeconds)}</Badge>
                                <Badge variant="outline">{formatSessionStatus(session.sessionStatus)}</Badge>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No recent module session activity is available for this enrollment yet.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {manualReviews.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Essay Review Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {manualReviews.map((review) => (
                        <div key={review.attemptId} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium">{review.assessmentTitle}</p>
                            <p className="text-sm text-muted-foreground">{review.moduleTitle}</p>
                            <p className="text-xs text-muted-foreground">
                              {review.submittedAt
                                ? `Submitted ${new Date(review.submittedAt).toLocaleString()}`
                                : "Awaiting submission timestamp"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={review.reviewStatus === "approved" ? "default" : review.reviewStatus === "needs_revision" ? "outline" : "secondary"}>
                              {review.reviewStatus.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Module and Assessment Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {progressDetail.modules.length > 0 ? (
                      progressDetail.modules.map((entry, index) => {
                        const blockingModules = entry.blockedByModuleIds
                          .map((moduleId) => moduleLookup.get(moduleId) || null)
                          .filter((candidate): candidate is Module => Boolean(candidate));
                        const moduleAssessments = assessmentsByModule[entry.module.id] || [];
                        const moduleReviews = reviewsByModule[entry.module.id] || [];

                        return (
                          <div key={entry.module.id} className="rounded-lg border p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="font-medium">Module {index + 1}: {entry.module.title}</p>
                                <p className="text-sm text-muted-foreground">{entry.module.description}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={entry.completed ? "default" : entry.blockedByModuleIds.length > 0 ? "outline" : "secondary"}>
                                  {entry.completed ? (
                                    <>
                                      <CheckCircle2 className="mr-1 h-3 w-3" />
                                      Completed
                                    </>
                                  ) : entry.blockedByModuleIds.length > 0 ? "Blocked by prerequisites" : "Ready / In progress"}
                                </Badge>
                                {moduleAssessments.length > 0 ? getAssessmentStatusBadge(moduleAssessments[0]) : <Badge variant="outline">No assessment required</Badge>}
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
                              <div className="rounded-lg border p-3">
                                <p className="text-muted-foreground">Time tracked</p>
                                <p className="mt-1 font-medium">{entry.timeSpent ? `${entry.timeSpent} min` : "No time tracked"}</p>
                              </div>
                              <div className="rounded-lg border p-3">
                                <p className="text-muted-foreground">Completion</p>
                                <p className="mt-1 font-medium">
                                  {entry.completedAt
                                    ? `Completed ${new Date(entry.completedAt).toLocaleDateString()}`
                                    : "Not completed yet"}
                                </p>
                              </div>
                              <div className="rounded-lg border p-3">
                                <p className="text-muted-foreground">Pending trainer review</p>
                                <p className="mt-1 font-medium">{moduleReviews.filter((review) => review.reviewStatus !== "approved").length}</p>
                              </div>
                            </div>

                            {blockingModules.length > 0 ? (
                              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="mt-0.5 h-4 w-4" />
                                  <div>
                                    <p className="font-medium">Blocked prerequisite state</p>
                                    <p className="mt-1">
                                      Waiting on {blockingModules.map((module) => module.title).join(", ")}.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {moduleAssessments.length > 0 ? (
                              <div className="mt-3 space-y-2">
                                {moduleAssessments.map((assessment) => (
                                  <div key={assessment.assessmentId} className="rounded-lg border bg-muted/30 p-3 text-sm">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                      <div className="flex items-center gap-2">
                                        <FileQuestion className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{assessment.assessmentTitle}</span>
                                      </div>
                                      {getAssessmentStatusBadge(assessment)}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                                      <span>Latest score: {assessment.score ?? "—"}</span>
                                      <span>
                                        {assessment.submittedAt
                                          ? `Submitted ${new Date(assessment.submittedAt).toLocaleString()}`
                                          : "No submitted attempt yet"}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">No modules are available for this course yet.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-base">Reserved Enrollment Extensions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-primary">
                    <p>Face-to-face enlistment request, approval, and attendance fields remain intentionally reserved for a later phase.</p>
                    <p>Audience-filtered enrollment eligibility is also reserved so future admin gating can extend this screen without replacing the current progress model.</p>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Unenroll Confirmation Dialog */}
      <AlertDialog open={!!unenrollId} onOpenChange={(open) => !open && setUnenrollId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unenroll User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unenroll this user from the course?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="preserve"
                checked={preserveProgress}
                onCheckedChange={(checked) => setPreserveProgress(checked === true)}
              />
              <Label htmlFor="preserve" className="cursor-pointer">
                Preserve progress (mark as dropped instead of deleting)
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenroll}
              className="bg-destructive text-destructive-foreground"
            >
              Unenroll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminEnrollments;

