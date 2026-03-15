import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Award, BookOpen, CheckCircle2, Clock3, FileQuestion, Loader2, MessageSquareText } from "lucide-react";
import { Enrollment, EnrollmentProgressDetail, Module } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { assessmentService, type AssessmentReviewDecision, type AssessmentReviewDetail, type AssessmentReviewQueueItem } from "@/services/assessmentService";
import { certificateService, enrollmentService, moduleCompletionService } from "@/services/supabaseDatabaseService";
import { moduleSessionService, type ModuleSession } from "@/services/moduleSessionService";

type EnrollmentHeaderDetail = {
  enrollment: Enrollment;
  user?: {
    id?: string;
    name?: string;
    email?: string;
  } | null;
  course?: {
    id?: string;
    title?: string;
    category?: string;
  } | null;
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

const formatTimeSpent = (minutes?: number) => {
  if (!minutes || minutes <= 0) return "No time tracked";
  if (minutes < 60) return `${minutes} min`;

  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
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

const hasCompletionReviewState = (enrollment: Pick<Enrollment, "status" | "completionApprovalStatus">) => {
  const status = enrollment.completionApprovalStatus;
  return status === "pending" || status === "approved" || status === "needs_revision" || enrollment.status === "completed";
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
    return <Badge variant="outline">Completed</Badge>;
  }

  return <Badge variant="secondary">Submitted</Badge>;
};

const AdminEnrollmentProgressPage = () => {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [headerDetail, setHeaderDetail] = useState<EnrollmentHeaderDetail | null>(null);
  const [progressDetail, setProgressDetail] = useState<EnrollmentProgressDetail | null>(null);
  const [manualReviews, setManualReviews] = useState<AssessmentReviewQueueItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSessionCard[]>([]);
  const [selectedReview, setSelectedReview] = useState<AssessmentReviewDetail | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<AssessmentReviewDecision>("approved");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewScore, setReviewScore] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [courseActionEnrollmentId, setCourseActionEnrollmentId] = useState<string | null>(null);
  const [moduleActionKey, setModuleActionKey] = useState<string | null>(null);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionDecision, setCompletionDecision] = useState<"approved" | "needs_revision">("approved");
  const [completionFeedback, setCompletionFeedback] = useState("");
  const [completionSubmitting, setCompletionSubmitting] = useState(false);

  const assessmentsByModule = useMemo(() => {
    return (progressDetail?.assessments || []).reduce<Record<string, EnrollmentProgressDetail["assessments"]>>((acc, assessment) => {
      const current = acc[assessment.moduleId || "course"] || [];
      current.push(assessment);
      acc[assessment.moduleId || "course"] = current;
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

  const completedModuleCount = progressDetail?.modules.filter((entry) => entry.completed).length || 0;
  const blockedModuleCount = progressDetail?.modules.filter((entry) => !entry.completed && entry.blockedByModuleIds.length > 0).length || 0;
  const pendingReviewCount = manualReviews.filter((review) => review.reviewStatus !== "approved").length;
  const completedAssessmentCount = progressDetail?.assessments.filter((assessment) => Boolean(assessment.submittedAt)).length || 0;

  const loadPage = async () => {
    if (!enrollmentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [detailHeader, detail] = await Promise.all([
        enrollmentService.getEnrollmentWithDetails(enrollmentId),
        enrollmentService.getEnrollmentProgressDetail(enrollmentId),
      ]);

      if (!detail) {
        throw new Error("Enrollment progress details are not available.");
      }

      const [reviewRows, sessionRows] = await Promise.all([
        assessmentService.getManualReviewQueue({
          learnerId: detailHeader.user?.id,
          enrollmentId,
          statuses: ["submitted", "under_review", "needs_revision", "approved"],
        }),
        moduleSessionService.getTrainerAccessibleSessions({
          learnerId: detailHeader.user?.id || "",
          courseId: detail.enrollment.courseId,
          limit: 8,
        }),
      ]);

      const moduleLookup = new Map(detail.modules.map((entry) => [entry.module.id, entry.module]));
      setHeaderDetail(detailHeader as EnrollmentHeaderDetail);
      setProgressDetail(detail);
      setManualReviews(reviewRows);
      setRecentSessions(
        sessionRows.map((session) => ({
          id: session.id,
          moduleTitle: moduleLookup.get(session.moduleId)?.title || null,
          lastSeenAt: session.lastSeenAt,
          durationSeconds: session.durationSeconds,
          sessionStatus: session.sessionStatus,
        })),
      );
    } catch (error) {
      console.error("Error loading enrollment progress:", error);
      toast.error("Failed to load enrollment progress");
      setHeaderDetail(null);
      setProgressDetail(null);
      setManualReviews([]);
      setRecentSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, [enrollmentId]);

  const refreshPage = async () => {
    await loadPage();
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
        : "0");
      setReviewDecision(detail.reviewStatus === "needs_revision" ? "needs_revision" : "approved");
      await refreshPage();
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

    const parsedScore = selectedReview.reviewablePoints > 0 ? Number(reviewScore) : 0;
    const maxScore = selectedReview.reviewablePoints;
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
      await refreshPage();
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
      await refreshPage();
    } catch (error: any) {
      console.error("Error reviewing completion:", error);
      toast.error(error?.message || "Failed to review completion");
    } finally {
      setCourseActionEnrollmentId(null);
      setCompletionSubmitting(false);
    }
  };

  const handleMarkModuleComplete = async (moduleId: string) => {
    if (!progressDetail) {
      return;
    }

    const actionKey = `${progressDetail.enrollment.id}:${moduleId}`;
    setModuleActionKey(actionKey);

    try {
      await moduleCompletionService.markModuleComplete(progressDetail.enrollment.id, moduleId);
      toast.success("Module marked complete");
      await refreshPage();
    } catch (error: any) {
      console.error("Error marking module complete:", error);
      toast.error(error?.message || "Failed to mark module complete");
    } finally {
      setModuleActionKey(null);
    }
  };

  const handleIssueCertificate = async () => {
    if (!user || !progressDetail) {
      return;
    }

    setCourseActionEnrollmentId(progressDetail.enrollment.id);

    try {
      await certificateService.issueCertificateForEnrollment(progressDetail.enrollment.id, user.id);
      toast.success("Certificate released manually");
      await refreshPage();
    } catch (error: any) {
      console.error("Error issuing certificate:", error);
      toast.error(error?.message || "Failed to release certificate");
    } finally {
      setCourseActionEnrollmentId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/enrollments")}> 
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Enrollments
            </Button>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Enrollment Progress Review</h1>
            <p className="mt-2 text-muted-foreground">
              Review learner evidence, completion readiness, and certificate release from a full-page workflow.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-3 h-6 w-6 animate-spin" />
            Loading enrollment progress...
          </div>
        ) : !progressDetail ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Enrollment progress details are not available.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-5">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Progress Review</p>
                      <h2 className="mt-2 text-2xl font-semibold">{headerDetail?.user?.name || "Learner"}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{headerDetail?.user?.email || "No email available"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{progressDetail.course?.title || headerDetail?.course?.title || "Enrollment Progress"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {getStatusBadge(progressDetail.enrollment.status)}
                      {getCompletionBadge(progressDetail.enrollment)}
                      <Badge variant={progressDetail.enrollment.certificateId ? "default" : "secondary"}>
                        {progressDetail.enrollment.certificateId ? "Certificate released" : "Certificate pending"}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Progress</p>
                      <p className="mt-2 text-3xl font-semibold">{progressDetail.enrollment.progress}%</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Modules</p>
                      <p className="mt-2 text-3xl font-semibold">{completedModuleCount}/{progressDetail.modules.length}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Assessments</p>
                      <p className="mt-2 text-3xl font-semibold">{completedAssessmentCount}/{progressDetail.assessments.length}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Pending reviews</p>
                      <p className="mt-2 text-3xl font-semibold">{pendingReviewCount}</p>
                    </div>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Admin Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-xl border p-3">
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
                    <div className="rounded-xl border p-3">
                      <p className="text-muted-foreground">Last activity</p>
                      <p className="mt-1 font-medium">{getLastActiveLabel(progressDetail.enrollment.lastActivityAt).text}</p>
                    </div>
                    <div className="rounded-xl border p-3">
                      <p className="text-muted-foreground">Tracked learning time</p>
                      <p className="mt-1 font-medium">{progressDetail.enrollment.actualLearningMinutes ?? "—"} min actual</p>
                      <p className="mt-1 text-xs text-muted-foreground">{progressDetail.enrollment.creditedDurationHours ?? "—"} credited hours</p>
                    </div>
                    {hasCompletionReviewState(progressDetail.enrollment) ? (
                      <div className="flex flex-wrap gap-2 pt-1">
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
                            onClick={() => void handleIssueCertificate()}
                            disabled={courseActionEnrollmentId === progressDetail.enrollment.id}
                          >
                            Release Certificate
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </div>

            {manualReviews.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assessment Reviews</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {manualReviews.map((reviewItem) => (
                    <div key={reviewItem.attemptId} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">{reviewItem.assessmentTitle}</p>
                        <p className="text-sm text-muted-foreground">{reviewItem.moduleTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {reviewItem.submittedAt ? `Submitted ${new Date(reviewItem.submittedAt).toLocaleString()}` : "Awaiting submission timestamp"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{reviewItem.reviewStatus.replace(/_/g, " ")}</Badge>
                        <Button variant="outline" onClick={() => navigate(`/admin/assessment-reviews/${reviewItem.attemptId}?enrollmentId=${progressDetail.enrollment.id}`)}>
                          Review Assessment
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Module Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="space-y-2">
                    {progressDetail.modules.map((moduleEntry) => {
                      const actionKey = `${progressDetail.enrollment.id}:${moduleEntry.module.id}`;
                      const moduleAssessments = assessmentsByModule[moduleEntry.module.id] || [];
                      const moduleReviews = reviewsByModule[moduleEntry.module.id] || [];
                      const hasPendingManualScore = moduleAssessments.some((assessment) => assessment.requiresManualReview && !assessment.submittedAt);

                      return (
                        <AccordionItem key={moduleEntry.module.id} value={moduleEntry.module.id} className="rounded-lg border px-4">
                          <AccordionTrigger>
                            <div className="flex flex-1 flex-col items-start gap-2 text-left md:flex-row md:items-center md:justify-between md:pr-4">
                              <div>
                                <p className="font-medium">{moduleEntry.module.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {moduleEntry.completed
                                    ? `Completed ${moduleEntry.completedAt ? new Date(moduleEntry.completedAt).toLocaleDateString() : ""}`
                                    : moduleEntry.blockedByModuleIds.length > 0
                                    ? "Blocked by prerequisites"
                                    : "Ready for learner"}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={moduleEntry.completed ? "default" : moduleEntry.blockedByModuleIds.length > 0 ? "outline" : "secondary"}>
                                  {moduleEntry.completed ? "Completed" : moduleEntry.blockedByModuleIds.length > 0 ? "Blocked" : "Pending"}
                                </Badge>
                                <Badge variant="outline">{formatTimeSpent(moduleEntry.timeSpent)}</Badge>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 pb-4">
                            {moduleEntry.blockedByModuleIds.length > 0 ? (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                Learner still needs earlier module completions before this module should unlock.
                              </div>
                            ) : null}

                            {moduleAssessments.length > 0 ? (
                              <div className="space-y-3">
                                <p className="text-sm font-medium">Linked assessments</p>
                                {moduleAssessments.map((assessment) => (
                                  <div key={assessment.assessmentId} className="rounded-lg border p-3 text-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <p className="font-medium">{assessment.assessmentTitle}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {assessment.submittedAt ? `Submitted ${new Date(assessment.submittedAt).toLocaleString()}` : "Awaiting learner submission"}
                                        </p>
                                      </div>
                                      {getAssessmentStatusBadge(assessment)}
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                      <span>Score: {assessment.score ?? "—"}</span>
                                      <span>Points: {assessment.earnedPoints !== undefined && assessment.totalPoints ? `${assessment.earnedPoints}/${assessment.totalPoints}` : "—"}</span>
                                      <span>Time: {formatTimeSpent(assessment.timeSpent)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            {moduleReviews.length > 0 ? (
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Pending review work</p>
                                {moduleReviews.map((reviewItem) => (
                                  <div key={reviewItem.attemptId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                                    <div>
                                      <p className="font-medium">{reviewItem.assessmentTitle}</p>
                                      <p className="text-xs text-muted-foreground">{reviewItem.reviewStatus.replace(/_/g, " ")}</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => navigate(`/admin/assessment-reviews/${reviewItem.attemptId}?enrollmentId=${progressDetail.enrollment.id}`)}>
                                      Review Assessment
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            {!moduleEntry.completed ? (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => void handleMarkModuleComplete(moduleEntry.module.id)}
                                  disabled={moduleActionKey === actionKey || moduleEntry.blockedByModuleIds.length > 0 || hasPendingManualScore}
                                >
                                  Mark Module Complete
                                </Button>
                              </div>
                            ) : null}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Course Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recentSessions.length > 0 ? (
                      recentSessions.map((session) => (
                        <div key={session.id} className="rounded-lg border p-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="font-medium">{session.moduleTitle || "Untitled module"}</p>
                              <p className="mt-1 text-xs text-muted-foreground">Last opened {getLastActiveLabel(session.lastSeenAt).text}</p>
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

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Completion Readiness</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground">Progress formula</p>
                      <p className="mt-1 font-medium">Modules and required assessment submissions both count toward the 100% readiness threshold.</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground">Blocked modules</p>
                      <p className="mt-1 font-medium">{blockedModuleCount}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground">Last activity</p>
                      <p className={`mt-1 font-medium ${getLastActiveLabel(progressDetail.enrollment.lastActivityAt).color}`}>
                        {getLastActiveLabel(progressDetail.enrollment.lastActivityAt).text}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Review Assessment</DialogTitle>
            <DialogDescription>
              Evaluate the learner&apos;s essay response, provide feedback, and decide whether the assessment is approved or needs follow-up.
            </DialogDescription>
          </DialogHeader>

          {reviewLoading || !selectedReview ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading review details...
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Question</p>
                <p className="mt-2 font-medium">{selectedReview.question}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Learner response</p>
                <p className="mt-2 whitespace-pre-wrap">{selectedReview.answer || "No response submitted."}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Review decision</p>
                  <div className="flex gap-2">
                    <Button variant={reviewDecision === "approved" ? "default" : "outline"} onClick={() => setReviewDecision("approved")}>
                      Approve
                    </Button>
                    <Button variant={reviewDecision === "needs_revision" ? "default" : "outline"} onClick={() => setReviewDecision("needs_revision")}>
                      Needs follow-up
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{selectedReview.reviewablePoints > 0 ? "Review score" : "Auto-scored result"}</label>
                  <Input value={reviewScore} onChange={(event) => setReviewScore(event.target.value)} disabled={selectedReview.reviewablePoints === 0} />
                  <p className="text-xs text-muted-foreground">
                    {selectedReview.reviewablePoints > 0
                      ? `Enter a score from 0 to ${selectedReview.reviewablePoints}.`
                      : `This assessment has no manual-score portion. The auto-scored total of ${selectedReview.autoEarnedPoints} out of ${selectedReview.totalPoints} will be finalized when you approve it.`}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Feedback</label>
                <Textarea value={reviewFeedback} onChange={(event) => setReviewFeedback(event.target.value)} rows={5} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => void handleSubmitReview()} disabled={reviewSubmitting}>
                  {reviewSubmitting ? "Submitting..." : "Submit Review"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={completionDialogOpen} onOpenChange={setCompletionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{completionDecision === "approved" ? "Approve Course Completion" : "Return Course For Follow-up"}</DialogTitle>
            <DialogDescription>
              {completionDecision === "approved"
                ? "Confirm the learner has completed the required modules and graded assessments before approving completion."
                : "Return the course to the learner with specific guidance before approval."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{headerDetail?.user?.name || "Learner"}</p>
              <p className="text-muted-foreground">{progressDetail?.course?.title || "Course"}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Feedback</label>
              <Textarea
                value={completionFeedback}
                onChange={(event) => setCompletionFeedback(event.target.value)}
                rows={5}
                placeholder={completionDecision === "approved" ? "Optional note for the learner." : "Required follow-up guidance for the learner."}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCompletionDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleSubmitCompletionReview()} disabled={completionSubmitting}>
                {completionSubmitting ? "Submitting..." : completionDecision === "approved" ? "Approve Completion" : "Send Follow-up"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminEnrollmentProgressPage;