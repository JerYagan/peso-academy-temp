import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Loader2,
  MessageSquareText,
} from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import {
  assessmentService,
  type AssessmentReviewDecision,
  type AssessmentReviewDetail,
  type AssessmentReviewQueueItem,
} from "@/services/assessmentService";
import { certificateService, enrollmentService } from "@/services/supabaseDatabaseService";
import { EnrollmentProgressDetail } from "@/types";

type AssessmentReviewPageProps = {
  portal: "admin" | "trainer";
};

const PAGE_SIZE = 15;

const formatDateTime = (value?: string) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
};

const getReviewStatusBadge = (status?: string) => {
  if (status === "approved") {
    return <Badge>Approved</Badge>;
  }

  if (status === "needs_revision") {
    return <Badge variant="outline">Needs follow-up</Badge>;
  }

  if (status === "under_review") {
    return <Badge variant="secondary">Under review</Badge>;
  }

  return <Badge variant="secondary">Submitted</Badge>;
};

const buildReviewScore = (detail: AssessmentReviewDetail) => {
  if (detail.reviewablePoints <= 0 || detail.score === undefined || detail.totalPoints <= 0) {
    return "0";
  }

  return String(
    Math.max(
      0,
      Math.min(detail.reviewablePoints, Math.round((detail.score / 100) * detail.totalPoints) - detail.autoEarnedPoints),
    ),
  );
};

const AssessmentReviewPage = ({ portal }: AssessmentReviewPageProps) => {
  const { attemptId } = useParams<{ attemptId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [queue, setQueue] = useState<AssessmentReviewQueueItem[]>([]);
  const [selectedReview, setSelectedReview] = useState<AssessmentReviewDetail | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<AssessmentReviewDecision>("approved");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewScore, setReviewScore] = useState("0");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [followUpDetail, setFollowUpDetail] = useState<EnrollmentProgressDetail | null>(null);
  const [followUpFeedback, setFollowUpFeedback] = useState("");
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);

  const learnerId = searchParams.get("learnerId") || undefined;
  const enrollmentId = searchParams.get("enrollmentId") || undefined;
  const courseId = searchParams.get("courseId") || undefined;
  const reviewFilter = searchParams.get("filter") === "approved" ? "approved" : "pending";
  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const basePath = portal === "admin" ? "/admin/assessment-reviews" : "/trainer/assessment-reviews";

  const backPath = useMemo(() => {
    if (portal === "admin") {
      if (learnerId) {
        return `/admin/learners/${learnerId}`;
      }

      if (enrollmentId) {
        return "/admin/enrollments";
      }

      return "/admin/enrollments";
    }

    if (learnerId) {
      return `/trainer/learners/${learnerId}`;
    }

    return "/trainer/learners";
  }, [portal, enrollmentId, learnerId]);

  const buildPath = (options?: { attemptId?: string | null; page?: number; filter?: "pending" | "approved" }) => {
    const params = new URLSearchParams(searchParams);
    const nextPage = options?.page ?? page;
    const nextFilter = options?.filter ?? reviewFilter;

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    } else {
      params.delete("page");
    }

    if (nextFilter === "approved") {
      params.set("filter", "approved");
    } else {
      params.delete("filter");
    }

    const path = options?.attemptId ? `${basePath}/${options.attemptId}` : basePath;
    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
  };

  const loadReviewDetail = async (nextAttemptId: string) => {
    setDetailLoading(true);

    try {
      let detail = await assessmentService.getAssessmentAttemptReviewDetail(nextAttemptId);
      if (!detail) {
        throw new Error("Assessment review details are not available.");
      }

      if (detail.reviewStatus === "submitted") {
        await assessmentService.beginManualReview(nextAttemptId);
        detail = await assessmentService.getAssessmentAttemptReviewDetail(nextAttemptId);
        if (!detail) {
          throw new Error("Assessment review details are not available.");
        }
      }

      setSelectedReview(detail);
      setReviewDecision(detail.reviewStatus === "needs_revision" ? "needs_revision" : "approved");
      setReviewFeedback(detail.reviewFeedback || "");
      setReviewScore(buildReviewScore(detail));
    } catch (error) {
      console.error("Error loading assessment review detail:", error);
      toast.error("Failed to load assessment review");
      setSelectedReview(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadQueue = async () => {
    setQueueLoading(true);

    try {
      const reviewQueue = await assessmentService.getManualReviewQueue({
        learnerId,
        enrollmentId,
        courseId,
        statuses: ["submitted", "under_review", "needs_revision", "approved"],
      });
      setQueue(reviewQueue);
    } catch (error) {
      console.error("Error loading assessment review queue:", error);
      toast.error("Failed to load assessment review queue");
      setQueue([]);
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [learnerId, enrollmentId, courseId]);

  useEffect(() => {
    if (!attemptId) {
      setSelectedReview(null);
      return;
    }

    void loadReviewDetail(attemptId);
  }, [attemptId]);

  const pendingCount = queue.filter((item) => item.reviewStatus !== "approved").length;
  const filteredQueue = queue.filter((item) =>
    reviewFilter === "approved" ? item.reviewStatus === "approved" : item.reviewStatus !== "approved",
  );
  const approvedCount = queue.length - pendingCount;
  const totalPages = Math.max(1, Math.ceil(filteredQueue.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedQueue = filteredQueue.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const dialogOpen = Boolean(attemptId);

  useEffect(() => {
    if (page !== safePage) {
      navigate(buildPath({ attemptId, page: safePage }), { replace: true });
    }
  }, [page, safePage, attemptId]);

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === safePage) {
      return;
    }

    navigate(buildPath({ attemptId, page: nextPage }));
  };

  const handleFilterChange = (nextFilter: string) => {
    if (nextFilter !== "pending" && nextFilter !== "approved") {
      return;
    }

    navigate(buildPath({ attemptId: null, page: 1, filter: nextFilter }));
  };

  const handleQueueSelect = (reviewItem: AssessmentReviewQueueItem) => {
    navigate(buildPath({ attemptId: reviewItem.attemptId, page: safePage }));
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      navigate(buildPath({ attemptId: null, page: safePage }));
    }
  };

  const openFollowUpDialog = async (targetEnrollmentId: string) => {
    try {
      const detail = await enrollmentService.getEnrollmentProgressDetail(targetEnrollmentId);
      if (!detail) {
        return;
      }

      const canApproveCompletion = detail.enrollment.progress >= 100 && detail.enrollment.completionApprovalStatus !== "approved";
      const canReleaseCertificate = detail.enrollment.completionApprovalStatus === "approved" && !detail.enrollment.certificateId;

      if (!canApproveCompletion && !canReleaseCertificate) {
        return;
      }

      setFollowUpDetail(detail);
      setFollowUpFeedback(detail.enrollment.completionFeedback || "");
      setFollowUpDialogOpen(true);
    } catch (error) {
      console.error("Error loading follow-up workflow:", error);
      toast.error("Assessment was reviewed, but the completion workflow could not be opened.");
    }
  };

  const handleFollowUpAction = async (options: { approveCompletion: boolean; releaseCertificate: boolean }) => {
    if (!user || !followUpDetail) {
      return;
    }

    if (!options.approveCompletion && !options.releaseCertificate) {
      setFollowUpDialogOpen(false);
      return;
    }

    setFollowUpSubmitting(true);

    try {
      if (options.approveCompletion && followUpDetail.enrollment.completionApprovalStatus !== "approved") {
        await enrollmentService.reviewCompletion(
          followUpDetail.enrollment.id,
          user.id,
          "approved",
          followUpFeedback,
        );
      }

      if (options.releaseCertificate) {
        await certificateService.issueCertificateForEnrollment(followUpDetail.enrollment.id, user.id);
      }

      toast.success(
        options.approveCompletion && options.releaseCertificate
          ? "Completion approved and certificate released"
          : options.approveCompletion
          ? "Completion approved"
          : "Certificate released",
      );

      setFollowUpDialogOpen(false);
      setFollowUpDetail(null);
      setFollowUpFeedback("");
      await loadQueue();
      if (selectedReview) {
        await loadReviewDetail(selectedReview.attemptId);
      }
    } catch (error: any) {
      console.error("Error completing follow-up workflow:", error);
      toast.error(error?.message || "Failed to complete the follow-up workflow");
    } finally {
      setFollowUpSubmitting(false);
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
      const reviewedAttemptId = selectedReview.attemptId;
      const targetEnrollmentId = selectedReview.enrollmentId;
      const didApproveReview = reviewDecision === "approved";

      await assessmentService.reviewManualAttempt(reviewedAttemptId, {
        reviewerId: user.id,
        decision: reviewDecision,
        feedback: reviewFeedback,
        score: parsedScore,
      });
      toast.success(reviewDecision === "approved" ? "Assessment approved" : "Assessment returned for follow-up");
      await loadQueue();
      await loadReviewDetail(reviewedAttemptId);
      if (didApproveReview && targetEnrollmentId) {
        await openFollowUpDialog(targetEnrollmentId);
      }
    } catch (error) {
      console.error("Error submitting assessment review:", error);
      toast.error("Failed to submit assessment review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Assessment Reviews</h1>
            <p className="mt-2 text-muted-foreground">
              Review learner answers before approving course completion or releasing certificates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{pendingCount} pending</Badge>
            <Badge variant="outline">{approvedCount} approved</Badge>
            <Badge variant="outline">{queue.length} total in scope</Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Queue</CardTitle>
            <CardDescription>
              {learnerId || enrollmentId || courseId
                ? "Filtered to the current learner or enrollment context."
                : "All reviewable assessment submissions visible to your account."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={reviewFilter} onValueChange={handleFilterChange}>
              <TabsList>
                <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({approvedCount})</TabsTrigger>
              </TabsList>
            </Tabs>

            {queueLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading review queue...
              </div>
            ) : paginatedQueue.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                {reviewFilter === "approved"
                  ? "No approved assessment submissions are available in this review scope."
                  : "No pending assessment submissions are waiting in this review scope."}
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedQueue.map((item) => (
                  <button
                    key={item.attemptId}
                    type="button"
                    onClick={() => handleQueueSelect(item)}
                    className="w-full rounded-2xl border p-4 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.assessmentTitle}</p>
                          {getReviewStatusBadge(item.reviewStatus)}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{item.learnerName} • {item.learnerEmail || "No email available"}</p>
                        <p className="text-sm text-muted-foreground">{item.courseTitle} • {item.moduleTitle}</p>
                      </div>
                      <div className="text-sm text-muted-foreground lg:text-right">
                        <p>Submitted</p>
                        <p className="font-medium text-foreground">{formatDateTime(item.submittedAt)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {filteredQueue.length > PAGE_SIZE ? (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        handlePageChange(safePage - 1);
                      }}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href="#"
                        isActive={pageNumber === safePage}
                        onClick={(event) => {
                          event.preventDefault();
                          handlePageChange(pageNumber);
                        }}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        handlePageChange(safePage + 1);
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className="left-4 top-4 h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none translate-x-0 translate-y-0 overflow-x-auto overflow-y-auto rounded-2xl p-0"
          hideCloseButton={false}
        >
          <div className="flex min-h-full flex-col">
            <DialogHeader className="border-b px-8 py-6">
              <DialogTitle className="text-2xl">Assessment Review</DialogTitle>
              <DialogDescription>
                Inspect the learner&apos;s answers and finalize the assessment before course completion approval.
              </DialogDescription>
            </DialogHeader>

            {detailLoading || !selectedReview ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading assessment review...
              </div>
            ) : (
              <div className="flex flex-1 flex-col">
                <div className="border-b px-8 py-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-primary">
                        <FileQuestion className="h-5 w-5" />
                        <span className="text-xs font-semibold uppercase tracking-[0.2em]">Assessment Review</span>
                      </div>
                      <h2 className="mt-2 text-3xl font-semibold">{selectedReview.assessmentTitle}</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {selectedReview.learnerName} • {selectedReview.courseTitle} • {selectedReview.moduleTitle}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {getReviewStatusBadge(selectedReview.reviewStatus)}
                      <Badge variant="outline">Passing score {selectedReview.passingScore}%</Badge>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 xl:grid-cols-5">
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Learner</p>
                      <p className="mt-2 font-medium">{selectedReview.learnerName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{selectedReview.learnerEmail || "No email available"}</p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Submitted</p>
                      <p className="mt-2 font-medium">{formatDateTime(selectedReview.submittedAt)}</p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current score</p>
                      <p className="mt-2 font-medium">{selectedReview.score !== undefined ? `${selectedReview.score}%` : "Awaiting final result"}</p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Auto-scored points</p>
                      <p className="mt-2 font-medium">{selectedReview.autoEarnedPoints} / {selectedReview.totalPoints}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Computed from objective questions</p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Manual review</p>
                      <p className="mt-2 font-medium">
                        {selectedReview.reviewablePoints > 0 ? `${selectedReview.reviewablePoints} pts pending review` : "No manual scoring required"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedReview.reviewablePoints > 0 ? "Score this portion before approval" : "Approval finalizes the auto-scored result"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="grid min-w-[1180px] gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="overflow-hidden px-8 py-6">
                      <div className="space-y-4">
                        {selectedReview.questions.map((question, index) => (
                          <div key={question.questionId} className="rounded-2xl border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                Question {index + 1} • {question.questionType.replace(/_/g, " ")}
                              </p>
                              <p className="mt-2 font-medium">{question.question}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{question.points} pts</Badge>
                              {question.needsManualReview ? (
                                <Badge variant="secondary">Manual review</Badge>
                              ) : question.isCorrect === true ? (
                                <Badge>Correct</Badge>
                              ) : question.isCorrect === false ? (
                                <Badge variant="outline">Incorrect</Badge>
                              ) : (
                                <Badge variant="secondary">Submitted</Badge>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <div className="rounded-xl border bg-muted/20 p-3">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Learner answer</p>
                              <p className="mt-2 whitespace-pre-wrap text-sm">{question.answer || "No response submitted."}</p>
                            </div>

                            <div className="rounded-xl border bg-muted/20 p-3">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                {question.needsManualReview ? "Review notes" : "Answer reference"}
                              </p>
                              <div className="mt-2 space-y-2 text-sm">
                                {!question.needsManualReview ? (
                                  <>
                                    <p>
                                      <span className="font-medium">Correct answer:</span> {question.correctAnswer || "—"}
                                    </p>
                                    <p>
                                      <span className="font-medium">Points earned:</span> {question.pointsEarned ?? 0} / {question.points}
                                    </p>
                                  </>
                                ) : (
                                  <p>This response needs staff review before the final assessment result is approved.</p>
                                )}
                                {question.explanation ? (
                                  <p>
                                    <span className="font-medium">Explanation:</span> {question.explanation}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {question.options && question.options.length > 0 ? (
                            <div className="mt-4 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">Options:</span> {question.options.join(", ")}
                            </div>
                          ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t bg-background px-8 py-6 xl:sticky xl:top-0 xl:self-start xl:border-l xl:border-t-0">
                      <div className="space-y-4">
                      <div className="rounded-xl border p-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock3 className="h-4 w-4" />
                          <span>Status</span>
                        </div>
                        <p className="mt-2 font-medium capitalize">{selectedReview.reviewStatus?.replace(/_/g, " ") || "Submitted"}</p>
                        {selectedReview.reviewedAt ? (
                          <p className="mt-1 text-xs text-muted-foreground">Last reviewed {formatDateTime(selectedReview.reviewedAt)}</p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">Decision</p>
                        <div className="flex gap-2">
                          <Button variant={reviewDecision === "approved" ? "default" : "outline"} onClick={() => setReviewDecision("approved")}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                          <Button variant={reviewDecision === "needs_revision" ? "default" : "outline"} onClick={() => setReviewDecision("needs_revision")}>
                            Needs follow-up
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          {selectedReview.reviewablePoints > 0 ? "Manual score" : "Auto-scored result"}
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max={selectedReview.reviewablePoints}
                          step="1"
                          value={reviewScore}
                          onChange={(event) => setReviewScore(event.target.value)}
                          disabled={selectedReview.reviewablePoints === 0}
                        />
                        <p className="text-xs text-muted-foreground">
                          {selectedReview.reviewablePoints > 0
                            ? `Enter a score from 0 to ${selectedReview.reviewablePoints} for the manual-review portion.`
                            : `This assessment is fully auto-scored. Approving it will finalize the computed result of ${selectedReview.autoEarnedPoints} points.`}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Feedback</label>
                        <Textarea
                          value={reviewFeedback}
                          onChange={(event) => setReviewFeedback(event.target.value)}
                          rows={8}
                          placeholder="Add feedback the learner will see after this review."
                        />
                      </div>

                      {selectedReview.reviewFeedback ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
                            <MessageSquareText className="h-3.5 w-3.5" />
                            Existing feedback
                          </div>
                          <p className="mt-2 whitespace-pre-wrap">{selectedReview.reviewFeedback}</p>
                        </div>
                      ) : null}

                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" className="flex-1" onClick={() => handleDialogOpenChange(false)}>
                            Close
                          </Button>
                          <Button className="flex-1" onClick={() => void handleSubmitReview()} disabled={reviewSubmitting}>
                            {reviewSubmitting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : selectedReview.reviewStatus === "approved" ? (
                              "Update Review"
                            ) : (
                              "Submit Review"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={followUpDialogOpen}
        onOpenChange={(open) => {
          setFollowUpDialogOpen(open);
          if (!open) {
            setFollowUpDetail(null);
            setFollowUpFeedback("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Next Workflow Step</DialogTitle>
            <DialogDescription>
              Continue directly from the approved assessment into course completion approval and certificate release.
            </DialogDescription>
          </DialogHeader>

          {!followUpDetail ? (
            <div className="py-6 text-sm text-muted-foreground">No follow-up action is currently available for this enrollment.</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border p-4">
                <p className="font-medium">{followUpDetail.course?.title || "Course"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Progress {followUpDetail.enrollment.progress}% • Completion {followUpDetail.enrollment.completionApprovalStatus || "not_ready"}
                  {followUpDetail.enrollment.certificateId ? " • Certificate already released" : " • Certificate pending"}
                </p>
              </div>

              {followUpDetail.enrollment.progress >= 100 && followUpDetail.enrollment.completionApprovalStatus !== "approved" ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Completion approval note</p>
                  <Textarea
                    value={followUpFeedback}
                    onChange={(event) => setFollowUpFeedback(event.target.value)}
                    placeholder="Optional note saved with the completion approval"
                    rows={4}
                  />
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setFollowUpDialogOpen(false)} disabled={followUpSubmitting}>
                  Close for now
                </Button>
                {followUpDetail.enrollment.completionApprovalStatus === "approved" && !followUpDetail.enrollment.certificateId ? (
                  <Button onClick={() => void handleFollowUpAction({ approveCompletion: false, releaseCertificate: true })} disabled={followUpSubmitting}>
                    {followUpSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Release Certificate
                  </Button>
                ) : null}
                {followUpDetail.enrollment.progress >= 100 && followUpDetail.enrollment.completionApprovalStatus !== "approved" ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => void handleFollowUpAction({ approveCompletion: true, releaseCertificate: false })}
                      disabled={followUpSubmitting}
                    >
                      {followUpSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Approve Completion Only
                    </Button>
                    <Button
                      onClick={() => void handleFollowUpAction({ approveCompletion: true, releaseCertificate: true })}
                      disabled={followUpSubmitting}
                    >
                      {followUpSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Approve and Release Certificate
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AssessmentReviewPage;
