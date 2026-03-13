import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Plus, Search, Trash2, Eye, Loader2, Clock3, Award, CheckCircle2, AlertCircle, FileQuestion, MessageSquareText } from "lucide-react";
import { Enrollment, Course, EnrollmentProgressDetail, Module } from "@/types";
import { enrollmentService, courseService, certificateService, moduleCompletionService } from "@/services/supabaseDatabaseService";
import { BulkEnrollmentDialog } from "@/components/enrollment/BulkEnrollmentDialog";
import { toast } from "sonner";
import { assessmentService, type AssessmentReviewDecision, type AssessmentReviewDetail, type AssessmentReviewQueueItem } from "@/services/assessmentService";
import { moduleSessionService, type ModuleSession } from "@/services/moduleSessionService";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();
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
  const [courseActionEnrollmentId, setCourseActionEnrollmentId] = useState<string | null>(null);
  const [moduleActionKey, setModuleActionKey] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<AssessmentReviewDetail | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<AssessmentReviewDecision>("approved");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewScore, setReviewScore] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionDecision, setCompletionDecision] = useState<"approved" | "needs_revision">("approved");
  const [completionFeedback, setCompletionFeedback] = useState("");
  const [completionSubmitting, setCompletionSubmitting] = useState(false);

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

  const enrollmentStatusSummary = useMemo(() => {
    return filteredEnrollments.reduce(
      (summary, enrollment) => {
        summary.total += 1;
        summary[enrollment.status] += 1;
        return summary;
      },
      {
        total: 0,
        enrolled: 0,
        "in-progress": 0,
        completed: 0,
        dropped: 0,
      } as Record<"total" | Enrollment["status"], number>,
    );
  }, [filteredEnrollments]);

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

  const formatTimeSpent = (minutes?: number) => {
    if (!minutes || minutes <= 0) return "No time tracked";
    if (minutes < 60) return `${minutes} min`;
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
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
      setSelectedReview(null);
      setReviewFeedback("");
      setReviewScore("");
      setReviewDialogOpen(false);
      setCompletionDialogOpen(false);
      setCompletionFeedback("");
      setModuleActionKey(null);
    }
  };

  const refreshSelectedEnrollmentProgress = async () => {
    if (selectedEnrollment) {
      await handleViewProgress(selectedEnrollment);
    }
  };

  const handleOpenReview = async (reviewItem: AssessmentReviewQueueItem) => {
    setReviewLoading(true);
    setReviewDialogOpen(true);
    setReviewDecision(reviewItem.reviewStatus === "needs_revision" ? "needs_revision" : "approved");
    setReviewFeedback(reviewItem.reviewFeedback || "");
    setReviewScore("");

    try {
      if (reviewItem.reviewStatus === "submitted") {
        await assessmentService.beginManualReview(reviewItem.attemptId);
      }

      const detail = await assessmentService.getAssessmentAttemptReviewDetail(reviewItem.attemptId);
      if (!detail) {
        throw new Error("Review details are not available.");
      }

      setSelectedReview(detail);
      setReviewFeedback(detail.reviewFeedback || "");
      setReviewScore(detail.reviewablePoints > 0 && detail.score !== undefined && detail.totalPoints > 0
        ? String(Math.max(0, Math.min(detail.reviewablePoints, Math.round((detail.score / 100) * detail.totalPoints) - detail.autoEarnedPoints)))
        : "");
      setReviewDecision(detail.reviewStatus === "needs_revision" ? "needs_revision" : "approved");
      await refreshSelectedEnrollmentProgress();
    } catch (error) {
      console.error("Error opening assessment review:", error);
      toast.error("Failed to load assessment review");
      setReviewDialogOpen(false);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedReview || !user) {
      return;
    }

    if (!reviewFeedback.trim()) {
      toast.error("Feedback is required before you finish this review.");
      return;
    }

    const parsedScore = Number(reviewScore);
    const maxScore = selectedReview.reviewablePoints || 100;
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > maxScore) {
      toast.error(`Enter a score from 0 to ${maxScore} before submitting this review.`);
      return;
    }

    setReviewSubmitting(true);

    try {
      await assessmentService.reviewManualAttempt(selectedReview.attemptId, {
        reviewerId: user.id,
        decision: reviewDecision,
        feedback: reviewFeedback,
        score: parsedScore,
      });
      toast.success(reviewDecision === "approved" ? "Essay review approved" : "Essay review returned for follow-up");
      setReviewDialogOpen(false);
      setSelectedReview(null);
      await refreshSelectedEnrollmentProgress();
      await loadEnrollments();
    } catch (error) {
      console.error("Error submitting assessment review:", error);
      toast.error("Failed to submit assessment review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openCompletionReviewDialog = (decision: "approved" | "needs_revision") => {
    if (!progressDetail) {
      return;
    }

    setCompletionDecision(decision);
    setCompletionFeedback(progressDetail.enrollment.completionFeedback || "");
    setCompletionDialogOpen(true);
  };

  const handleSubmitCompletionReview = async () => {
    if (!user || !progressDetail) {
      return;
    }

    if (completionDecision === "needs_revision" && !completionFeedback.trim()) {
      toast.error("Feedback is required when returning a course for follow-up.");
      return;
    }

    setCompletionSubmitting(true);
    setCourseActionEnrollmentId(progressDetail.enrollment.id);

    try {
      await enrollmentService.reviewCompletion(
        progressDetail.enrollment.id,
        user.id,
        completionDecision,
        completionFeedback,
      );
      toast.success(completionDecision === "approved" ? "Completion approved" : "Completion returned for follow-up");
      setCompletionDialogOpen(false);
      await refreshSelectedEnrollmentProgress();
      await loadEnrollments();
    } catch (error: any) {
      console.error("Error reviewing completion:", error);
      toast.error(error?.message || "Failed to review completion");
    } finally {
      setCourseActionEnrollmentId(null);
      setCompletionSubmitting(false);
    }
  };

  const handleMarkModuleComplete = async (enrollmentId: string, moduleId: string) => {
    const actionKey = `${enrollmentId}:${moduleId}`;
    setModuleActionKey(actionKey);

    try {
      await moduleCompletionService.markModuleComplete(enrollmentId, moduleId);
      toast.success("Module marked complete");
      await refreshSelectedEnrollmentProgress();
      await loadEnrollments();
    } catch (error: any) {
      console.error("Error marking module complete:", error);
      toast.error(error?.message || "Failed to mark module complete");
    } finally {
      setModuleActionKey(null);
    }
  };

  const handleIssueCertificate = async (enrollmentId: string) => {
    if (!user) {
      return;
    }

    setCourseActionEnrollmentId(enrollmentId);

    try {
      await certificateService.issueCertificateForEnrollment(enrollmentId, user.id);
      toast.success("Certificate released manually");
      await refreshSelectedEnrollmentProgress();
      await loadEnrollments();
    } catch (error: any) {
      console.error("Error issuing certificate:", error);
      toast.error(error?.message || "Failed to release certificate");
    } finally {
      setCourseActionEnrollmentId(null);
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

        {/* Enrollments List */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollments ({filteredEnrollments.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading enrollments...</div>
            ) : filteredEnrollments.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No enrollments found</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Shown</p>
                    <p className="mt-2 text-2xl font-semibold">{enrollmentStatusSummary.total}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Enrolled</p>
                    <p className="mt-2 text-2xl font-semibold">{enrollmentStatusSummary.enrolled}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">In progress</p>
                    <p className="mt-2 text-2xl font-semibold">{enrollmentStatusSummary["in-progress"]}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Completed</p>
                    <p className="mt-2 text-2xl font-semibold">{enrollmentStatusSummary.completed}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredEnrollments.map((enrollment) => {
                    const lastActive = getLastActiveLabel(enrollment.lastActivityAt || enrollment.enrolledAt);

                    return (
                      <div key={enrollment.id} className="grid gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]">
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-lg font-semibold leading-tight">{enrollment.userName || "Unknown"}</p>
                                <p className="text-sm text-muted-foreground">{enrollment.userEmail || "No email available"}</p>
                              </div>
                              {getStatusBadge(enrollment.status)}
                            </div>
                            <p className="text-sm font-medium text-foreground">{enrollment.courseTitle || "Unknown Course"}</p>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium text-foreground">{enrollment.progress}%</span>
                            </div>
                            <Progress value={enrollment.progress} />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {getCompletionBadge(enrollment)}
                            {enrollment.certificateId ? <Badge variant="secondary">Certificate released</Badge> : null}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                          <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Last active</p>
                            <p className={`mt-2 text-sm ${lastActive.color}`}>{lastActive.text}</p>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Enrolled</p>
                            <p className="mt-2 text-sm font-medium text-foreground">{new Date(enrollment.enrolledAt).toLocaleDateString()}</p>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-background/50 p-3 sm:col-span-2 xl:col-span-1">
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Workflow</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {getCompletionBadge(enrollment)}
                              {enrollment.certificateId ? <Badge variant="secondary">Certificate released</Badge> : <Badge variant="outline">Certificate pending</Badge>}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 xl:items-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full xl:w-auto"
                            onClick={() => void handleViewProgress(enrollment)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Progress
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full xl:w-auto"
                            onClick={() => setUnenrollId(enrollment.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Unenroll
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
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
        <DialogContent className="flex h-[calc(100vh-1rem)] min-h-0 w-[calc(100vw-1rem)] max-w-6xl flex-col overflow-hidden p-0 sm:h-[92vh] sm:w-full">
          <DialogHeader className="shrink-0 border-b bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
            <DialogTitle>
              {selectedEnrollment?.userName || "Learner"} • {progressDetail?.course?.title || selectedEnrollment?.courseTitle || "Enrollment Progress"}
            </DialogTitle>
            <DialogDescription>
              Review learner evidence, manually verify quiz outcomes, leave guidance, and confirm each module or course completion from one place.
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
                <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-5">
                  <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Progress Review</p>
                          <h3 className="mt-2 text-2xl font-semibold text-foreground">
                            {selectedEnrollment?.userName || "Learner"}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {progressDetail.course?.title || selectedEnrollment?.courseTitle || "Enrollment Progress"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {getStatusBadge(progressDetail.enrollment.status)}
                          {getCompletionBadge(progressDetail.enrollment)}
                          <Badge variant={progressDetail.enrollment.certificateId ? "default" : "secondary"}>
                            {progressDetail.enrollment.certificateId ? "Certificate released" : "Certificate pending"}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Progress</p>
                          <p className="mt-2 text-3xl font-semibold">{progressDetail.enrollment.progress}%</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Modules cleared</p>
                          <p className="mt-2 text-3xl font-semibold">{completedModuleCount}/{progressDetail.modules.length}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Pending reviews</p>
                          <p className="mt-2 text-3xl font-semibold">{pendingReviewCount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Admin actions</p>
                      <div className="mt-3 space-y-3 text-sm">
                        <div className="rounded-xl border border-border/60 p-3">
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
                        <div className="rounded-xl border border-border/60 p-3">
                          <p className="text-muted-foreground">Last activity</p>
                          <p className="mt-1 font-medium">{getLastActiveLabel(progressDetail.enrollment.lastActivityAt).text}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 p-3">
                          <p className="text-muted-foreground">Learning time</p>
                          <p className="mt-1 font-medium">{progressDetail.enrollment.actualLearningMinutes ?? "—"} min actual</p>
                          <p className="mt-1 text-xs text-muted-foreground">{progressDetail.enrollment.creditedDurationHours ?? "—"} credited hours</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

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
                      {progressDetail.enrollment.progress >= 100 ? (
                        <div className="flex flex-wrap gap-2">
                          {progressDetail.enrollment.completionApprovalStatus !== "approved" ? (
                            <>
                              <Button
                                onClick={() => openCompletionReviewDialog("approved")}
                                disabled={courseActionEnrollmentId === progressDetail.enrollment.id || pendingReviewCount > 0}
                              >
                                Approve Completion
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => openCompletionReviewDialog("needs_revision")}
                                disabled={courseActionEnrollmentId === progressDetail.enrollment.id}
                              >
                                Mark For Follow-up
                              </Button>
                            </>
                          ) : null}
                          {progressDetail.enrollment.completionApprovalStatus === "approved" && !progressDetail.enrollment.certificateId ? (
                            <Button
                              variant="secondary"
                              onClick={() => void handleIssueCertificate(progressDetail.enrollment.id)}
                              disabled={courseActionEnrollmentId === progressDetail.enrollment.id}
                            >
                              Release Certificate
                            </Button>
                          ) : null}
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
                            <Button variant="outline" onClick={() => void handleOpenReview(review)}>
                              Review Essay
                            </Button>
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
                      <Accordion type="multiple" className="space-y-3">
                      {progressDetail.modules.map((entry, index) => {
                        const blockingModules = entry.blockedByModuleIds
                          .map((moduleId) => moduleLookup.get(moduleId) || null)
                          .filter((candidate): candidate is Module => Boolean(candidate));
                        const moduleAssessments = assessmentsByModule[entry.module.id] || [];
                        const moduleReviews = reviewsByModule[entry.module.id] || [];
                        const actionKey = `${progressDetail.enrollment.id}:${entry.module.id}`;
                        const hasPendingManualScore = moduleAssessments.some((assessment) => assessment.requiresManualReview && assessment.score === undefined);
                        const latestAssessment = moduleAssessments.reduce<EnrollmentProgressDetail["assessments"][number] | null>((current, assessment) => {
                          if (!current) {
                            return assessment;
                          }

                          const assessmentTime = new Date(assessment.submittedAt || 0).getTime();
                          const currentTime = new Date(current.submittedAt || 0).getTime();
                          return assessmentTime > currentTime ? assessment : current;
                        }, null);

                        return (
                          <AccordionItem key={entry.module.id} value={entry.module.id} className="overflow-hidden rounded-2xl border border-border/70 bg-background px-4">
                            <AccordionTrigger className="py-4 hover:no-underline">
                              <div className="flex w-full flex-col gap-3 pr-3 text-left md:flex-row md:items-start md:justify-between">
                                <div>
                                  <p className="font-medium">Module {index + 1}: {entry.module.title}</p>
                                  <p className="mt-1 text-sm text-muted-foreground">{entry.module.description}</p>
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
                            </AccordionTrigger>
                            <AccordionContent className="pb-4">
                              <div className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-4 text-sm">
                                  <div className="rounded-xl border p-3">
                                    <p className="text-muted-foreground">Learner score</p>
                                    <p className="mt-1 font-medium">
                                      {latestAssessment?.earnedPoints !== undefined && latestAssessment?.totalPoints
                                        ? `${latestAssessment.earnedPoints} / ${latestAssessment.totalPoints}`
                                        : latestAssessment?.requiresManualReview
                                        ? "Pending score"
                                        : "No score yet"}
                                    </p>
                                  </div>
                                  <div className="rounded-xl border p-3">
                                    <p className="text-muted-foreground">Assessment items</p>
                                    <p className="mt-1 font-medium">
                                      {moduleAssessments.length}
                                    </p>
                                  </div>
                                  <div className="rounded-xl border p-3">
                                    <p className="text-muted-foreground">Latest submission</p>
                                    <p className="mt-1 font-medium">
                                      {latestAssessment?.submittedAt
                                        ? new Date(latestAssessment.submittedAt).toLocaleString()
                                        : latestAssessment?.latestAttemptId
                                        ? "Attempt recorded"
                                        : "No submitted attempt yet"}
                                    </p>
                                  </div>
                                  <div className="rounded-xl border p-3">
                                    <p className="text-muted-foreground">Latest result</p>
                                    <p className="mt-1 font-medium">
                                      {latestAssessment?.score !== undefined
                                        ? `${latestAssessment.score}%`
                                        : latestAssessment?.reviewStatus
                                        ? latestAssessment.reviewStatus.replace(/_/g, " ")
                                        : "Awaiting result"}
                                    </p>
                                  </div>
                                </div>

                                {!entry.completed ? (
                                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 p-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-foreground">Manual completion override</p>
                                      <p className="mt-1 text-sm text-muted-foreground">
                                        Use this after verifying the learner finished the module outside the standard completion flow.
                                      </p>
                                    </div>
                                    <Button
                                      variant="outline"
                                      onClick={() => void handleMarkModuleComplete(progressDetail.enrollment.id, entry.module.id)}
                                      disabled={moduleActionKey === actionKey || blockingModules.length > 0 || hasPendingManualScore}
                                    >
                                      {moduleActionKey === actionKey ? "Saving..." : "Mark Module Complete"}
                                    </Button>
                                  </div>
                                ) : null}

                                {hasPendingManualScore ? (
                                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                    <p className="font-medium">Essay score required</p>
                                    <p className="mt-1">Finalize the manual review score before marking this module complete.</p>
                                  </div>
                                ) : null}

                                {blockingModules.length > 0 ? (
                                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
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
                                  <div className="space-y-2">
                                    {moduleAssessments.map((assessment) => {
                                      const linkedReview = moduleReviews.find((review) => review.assessmentId === assessment.assessmentId);

                                      return (
                                        <div key={assessment.assessmentId} className="rounded-xl border bg-muted/30 p-3 text-sm">
                                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <FileQuestion className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{assessment.assessmentTitle}</span>
                                              </div>
                                              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                                                <span>Total score: {assessment.earnedPoints !== undefined && assessment.totalPoints ? `${assessment.earnedPoints} / ${assessment.totalPoints}` : assessment.requiresManualReview ? "Pending manual review" : "—"}</span>
                                                <span>
                                                  {assessment.submittedAt
                                                    ? `Submitted ${new Date(assessment.submittedAt).toLocaleString()}`
                                                    : assessment.latestAttemptId
                                                    ? "Attempt recorded"
                                                    : "No submitted attempt yet"}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                              {getAssessmentStatusBadge(assessment)}
                                              {linkedReview ? (
                                                <Button variant="outline" size="sm" onClick={() => void handleOpenReview(linkedReview)}>
                                                  Review Essay
                                                </Button>
                                              ) : null}
                                            </div>
                                          </div>
                                          {assessment.reviewFeedback ? (
                                            <div className="mt-3 rounded-lg border border-border/60 bg-background/80 p-3">
                                              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                <MessageSquareText className="h-3.5 w-3.5" />
                                                Reviewer feedback
                                              </div>
                                              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{assessment.reviewFeedback}</p>
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-dashed border-border/80 p-3 text-sm text-muted-foreground">
                                    No assessment is attached to this module.
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                      </Accordion>
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

      <Dialog
        open={reviewDialogOpen}
        onOpenChange={(open) => {
          setReviewDialogOpen(open);
          if (!open) {
            setSelectedReview(null);
            setReviewFeedback("");
            setReviewScore("");
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedReview ? `Review: ${selectedReview.assessmentTitle}` : "Review assessment"}</DialogTitle>
            <DialogDescription>
              Evaluate the learner&apos;s essay response, provide feedback, and decide whether the assessment is approved or needs follow-up.
            </DialogDescription>
          </DialogHeader>

          {reviewLoading || !selectedReview ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading assessment review...
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-4 pb-4">
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{selectedReview.learnerName}</p>
                <p className="text-muted-foreground">{selectedReview.courseTitle} • {selectedReview.moduleTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedReview.submittedAt ? `Submitted ${new Date(selectedReview.submittedAt).toLocaleString()}` : "Submission time unavailable"}
                </p>
              </div>

              <div className="space-y-3">
                {selectedReview.questions.map((question, index) => (
                  <div key={question.questionId} className="rounded-lg border p-4">
                    <p className="text-sm font-medium text-muted-foreground">Question {index + 1}</p>
                    <p className="mt-1 font-medium">{question.question}</p>
                    <div className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">
                      {question.answer || "No answer submitted"}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Decision</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={reviewDecision === "approved" ? "default" : "outline"}
                    onClick={() => setReviewDecision("approved")}
                  >
                    Approve Essay
                  </Button>
                  <Button
                    type="button"
                    variant={reviewDecision === "needs_revision" ? "default" : "outline"}
                    onClick={() => setReviewDecision("needs_revision")}
                  >
                    Needs Follow-up
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Feedback</p>
                <Textarea
                  value={reviewFeedback}
                  onChange={(event) => setReviewFeedback(event.target.value)}
                  placeholder="Add feedback that the learner will see after this review."
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Essay score</p>
                <Input
                  type="number"
                  min="0"
                  max={selectedReview?.reviewablePoints || 100}
                  step="1"
                  value={reviewScore}
                  onChange={(event) => setReviewScore(event.target.value)}
                  placeholder="Enter score"
                />
                {selectedReview ? (
                  <p className="text-xs text-muted-foreground">Essay portion: {selectedReview.reviewablePoints} points. Assessment total: {selectedReview.totalPoints} points. Passing score: {selectedReview.passingScore}%.</p>
                ) : null}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setReviewDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void handleSubmitReview()} disabled={reviewSubmitting}>
                  {reviewSubmitting ? "Submitting..." : "Submit Review"}
                </Button>
              </div>
            </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={completionDialogOpen}
        onOpenChange={(open) => {
          setCompletionDialogOpen(open);
          if (!open) {
            setCompletionFeedback("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{completionDecision === "approved" ? "Approve Course Completion" : "Return Course For Follow-up"}</DialogTitle>
            <DialogDescription>
              {completionDecision === "approved"
                ? "Add optional guidance for the learner before finalizing the course completion review."
                : "Explain what the learner still needs to address before the course can be marked complete."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{selectedEnrollment?.userName || "Learner"}</p>
              <p className="text-muted-foreground">{progressDetail?.course?.title || selectedEnrollment?.courseTitle || "Course"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="completion-feedback">Guidance and feedback</Label>
              <Textarea
                id="completion-feedback"
                rows={6}
                value={completionFeedback}
                onChange={(event) => setCompletionFeedback(event.target.value)}
                placeholder={completionDecision === "approved" ? "Optional note for the learner." : "Required follow-up guidance for the learner."}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCompletionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSubmitCompletionReview()}
                disabled={completionSubmitting || (progressDetail ? courseActionEnrollmentId === progressDetail.enrollment.id : false)}
              >
                {completionSubmitting ? "Submitting..." : completionDecision === "approved" ? "Approve Completion" : "Send Follow-up"}
              </Button>
            </div>
          </div>
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

