import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, BookOpen, Download, ExternalLink, FileQuestion, Loader2, Search, Users } from "lucide-react";
import { Course, Enrollment, EnrollmentProgressDetail, Module } from "@/types";
import { User } from "@/types/auth";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { assessmentService, type AssessmentReviewDecision, type AssessmentReviewDetail, type AssessmentReviewQueueItem } from "@/services/assessmentService";
import { certificateService, courseService, enrollmentService, moduleCompletionService, userService } from "@/services/supabaseDatabaseService";
import { moduleSessionService, type ModuleSession, type PracticeQuizSessionSummary, type TrainerLearnerSessionSummary } from "@/services/moduleSessionService";
import { supabase } from "@/lib/supabase";
import { submissionService } from "@/services/submissionService";
import { PracticeQuizEssayResponse, Submission } from "@/types";
import { createSubmissionAccessUrl, downloadSubmissionFile, getSubmissionAttachmentName } from "@/lib/submissionFiles";
import { practiceQuizEssayReviewService } from "@/services/practiceQuizEssayReviewService";
import { getPracticeQuizModuleReviewSummary } from "@/lib/practiceQuizReview";

interface LearnerData extends User {
  enrollments: Enrollment[];
}

interface LearnerCourseProgress {
  enrollment: Enrollment;
  course: Course | null;
  certificateReleased: boolean;
  certificateIssuedAt?: string;
  pendingReviews: AssessmentReviewQueueItem[];
  modules: Array<{
    module: Module;
    completed: boolean;
    completedAt?: string;
    timeSpent?: number;
    blockedByModuleIds: string[];
    assessments: EnrollmentProgressDetail["assessments"];
    submissions: Submission[];
    essayResponses: PracticeQuizEssayResponse[];
  }>;
}

interface LearnerSessionInsight {
  learnerId: string;
  totalSessions: number;
  totalDurationSeconds: number;
  lastSeenAt: string | null;
  lastCourseTitle: string | null;
  lastModuleTitle: string | null;
  repeatedShortSessionCount: number;
  needsAttention: boolean;
}

interface RecentLearnerSessionCard {
  id: string;
  courseId: string;
  moduleId: string;
  courseTitle: string | null;
  moduleTitle: string | null;
  lastSeenAt: string;
  durationSeconds: number;
  sessionStatus: ModuleSession["sessionStatus"];
  practiceQuizSummary: PracticeQuizSessionSummary | null;
}

const SHORT_SESSION_SECONDS = 5 * 60;
const SHORT_SESSION_REPEAT_THRESHOLD = 3;

const hasCompletionReviewState = (enrollment: Pick<Enrollment, "status" | "completionApprovalStatus">) => {
  const status = enrollment.completionApprovalStatus;
  return status === "pending" || status === "approved" || status === "needs_revision" || enrollment.status === "completed";
};

const formatRelativeActivity = (value: string | null) => {
  if (!value) return "No recent activity";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent activity";

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

const loadManagerEnrollments = async (courseIds: string[], learnerId?: string): Promise<Enrollment[]> => {
  if (!supabase || courseIds.length === 0) {
    return [];
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_course_manager_enrollments", {
    p_course_ids: courseIds,
    p_user_id: learnerId || null,
  });

  const rows = Array.isArray(rpcData) && !rpcError
    ? rpcData
    : (await supabase
        .from("enrollments")
        .select("id, user_id, course_id, progress, status, enrolled_at, completed_at, certificate_id, completion_approval_status, completion_requested_at, completion_reviewed_at, completion_reviewed_by, completion_feedback, updated_at")
        .in("course_id", courseIds)
        .order("enrolled_at", { ascending: false })).data || [];

  const enrollmentIds = rows.map((enrollment: any) => enrollment.id).filter(Boolean);
  const detailMap = new Map<string, any>();

  if (enrollmentIds.length > 0) {
    const { data: enrollmentDetails } = await supabase
      .from("enrollments")
      .select("id, completion_approval_status, completion_requested_at, completion_reviewed_at, completion_reviewed_by, completion_feedback, updated_at")
      .in("id", enrollmentIds);

    for (const enrollmentDetail of enrollmentDetails || []) {
      detailMap.set(enrollmentDetail.id, enrollmentDetail);
    }
  }

  return rows.map((enrollment: any) => {
    const details = detailMap.get(enrollment.id) || {};
    return {
      id: enrollment.id,
      userId: enrollment.user_id,
      courseId: enrollment.course_id,
      progress: enrollment.progress,
      status: enrollment.status,
      enrolledAt: enrollment.enrolled_at,
      completedAt: enrollment.completed_at || undefined,
      certificateId: enrollment.certificate_id || undefined,
      completionApprovalStatus: details.completion_approval_status || enrollment.completion_approval_status || undefined,
      completionRequestedAt: details.completion_requested_at || undefined,
      completionReviewedAt: details.completion_reviewed_at || undefined,
      completionReviewedBy: details.completion_reviewed_by || undefined,
      completionFeedback: details.completion_feedback || undefined,
      lastActivityAt: details.updated_at || enrollment.updated_at || enrollment.enrolled_at,
    } satisfies Enrollment;
  });
};

const loadManagerCertificates = async (courseIds: string[], learnerId: string) => {
  if (!supabase || courseIds.length === 0) {
    return [] as Array<{ id: string; user_id: string; course_id: string; issued_at: string | null }>;
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_course_manager_certificates", {
    p_course_ids: courseIds,
    p_user_id: learnerId,
  });

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData as Array<{ id: string; user_id: string; course_id: string; issued_at: string | null }>;
  }

  const { data } = await supabase
    .from("certificates")
    .select("id, user_id, course_id, issued_at")
    .eq("user_id", learnerId)
    .in("course_id", courseIds)
    .order("issued_at", { ascending: false });

  return data || [];
};

const LearnerProgressPage = () => {
  const { learnerId } = useParams<{ learnerId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [learner, setLearner] = useState<LearnerData | null>(null);
  const [learnerProgress, setLearnerProgress] = useState<LearnerCourseProgress[]>([]);
  const [learnerSessionInsight, setLearnerSessionInsight] = useState<LearnerSessionInsight | null>(null);
  const [selectedLearnerSessionSummaries, setSelectedLearnerSessionSummaries] = useState<Record<string, TrainerLearnerSessionSummary>>({});
  const [selectedLearnerRecentSessions, setSelectedLearnerRecentSessions] = useState<RecentLearnerSessionCard[]>([]);
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
  const [completionTarget, setCompletionTarget] = useState<{ enrollmentId: string; courseTitle: string } | null>(null);
  const [courseSearchTerm, setCourseSearchTerm] = useState("");
  const [courseFilter, setCourseFilter] = useState<"all" | "needs-review" | "active" | "completed">("all");
  const portal = location.pathname.startsWith("/admin") ? "admin" : "trainer";
  const learnersRouteBase = portal === "admin" ? "/admin/learners" : "/trainer/learners";
  const assessmentReviewRouteBase = portal === "admin" ? "/admin/assessment-reviews" : "/trainer/assessment-reviews";
  const moduleReviewRouteBase = portal === "admin" ? "/admin/module-reviews" : "/trainer/module-reviews";

  const completedCourses = learnerProgress.filter((item) => item.enrollment.status === "completed").length;
  const releasedCertificates = learnerProgress.filter((item) => item.certificateReleased).length;
  const averageProgress = learnerProgress.length > 0
    ? Math.round(learnerProgress.reduce((sum, item) => sum + item.enrollment.progress, 0) / learnerProgress.length)
    : 0;

  const filteredLearnerProgress = useMemo(() => {
    const normalizedQuery = courseSearchTerm.trim().toLowerCase();

    return learnerProgress.filter((item) => {
      const needsReview =
        item.pendingReviews.some((review) => review.reviewStatus !== "approved")
        || item.modules.some((moduleItem) =>
          getPracticeQuizModuleReviewSummary({
            module: moduleItem.module,
            responses: moduleItem.essayResponses,
          }).pendingEssayReviewCount > 0,
        );
      const isCompleted = item.enrollment.status === "completed" || item.enrollment.completionApprovalStatus === "approved";

      if (courseFilter === "needs-review" && !needsReview) {
        return false;
      }

      if (courseFilter === "active" && isCompleted) {
        return false;
      }

      if (courseFilter === "completed" && !isCompleted) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        item.course?.title,
        item.course?.category,
        ...item.modules.map((moduleItem) => moduleItem.module.title),
        ...item.modules.flatMap((moduleItem) => moduleItem.assessments.map((assessment) => assessment.assessmentTitle)),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [courseFilter, courseSearchTerm, learnerProgress]);

  const loadPage = async () => {
    if (!learnerId || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [learnerProfile, visibleCourses] = await Promise.all([
        userService.getUserById(learnerId),
        courseService.getCourses(),
      ]);

      if (!learnerProfile) {
        throw new Error("Learner not found");
      }

      const managerCourseIds = visibleCourses.map((course) => course.id);
      const [learnerEnrollments, learnerCertificates, allCourses, trainerSessionSummaries, recentSessions, pendingReviewQueue] = await Promise.all([
        loadManagerEnrollments(managerCourseIds, learnerId),
        loadManagerCertificates(managerCourseIds, learnerId),
        courseService.getCourses(),
        moduleSessionService.getTrainerLearnerSessionSummaries({ learnerId, limit: 50 }),
        moduleSessionService.getLearnerSessionsForTrainer(user.id, learnerId, 8),
        assessmentService.getManualReviewQueue({ learnerId }),
      ]);

      const detailResults = await Promise.allSettled(
        learnerEnrollments.map((enrollment) => enrollmentService.getEnrollmentProgressDetail(enrollment.id)),
      );
      const detailByEnrollment = new Map<string, EnrollmentProgressDetail>();

      detailResults.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value) {
          detailByEnrollment.set(learnerEnrollments[index].id, result.value);
        }
      });

      const courseLookup = new Map([...visibleCourses, ...allCourses].map((course) => [course.id, course]));
      const modulesByCourse = new Map<string, Module[]>();
      for (const detail of detailByEnrollment.values()) {
        modulesByCourse.set(detail.enrollment.courseId, detail.modules.map((entry) => entry.module));
      }

      const pendingReviewsByEnrollment = pendingReviewQueue.reduce<Record<string, AssessmentReviewQueueItem[]>>((acc, reviewItem) => {
        const current = acc[reviewItem.enrollmentId] || [];
        current.push(reviewItem);
        acc[reviewItem.enrollmentId] = current;
        return acc;
      }, {});

      const normalizedLearnerCertificates = learnerCertificates.map((certificate) => ({
        id: certificate.id,
        userId: certificate.user_id,
        courseId: certificate.course_id,
        issuedAt: certificate.issued_at,
      }));

      const progressRows = learnerEnrollments
        .map((enrollment) => {
          const detail = detailByEnrollment.get(enrollment.id);
          const course = detail?.course || courseLookup.get(enrollment.courseId) || null;
          const certificate = normalizedLearnerCertificates.find((item) => item.courseId === enrollment.courseId);
          const modules = (detail?.modules || []).map((moduleEntry) => ({
            module: moduleEntry.module,
            completed: moduleEntry.completed,
            completedAt: moduleEntry.completedAt,
            timeSpent: moduleEntry.timeSpent,
            blockedByModuleIds: moduleEntry.blockedByModuleIds,
            assessments: (detail?.assessments || []).filter((assessment) => assessment.moduleId === moduleEntry.module.id),
          }));
          return {
            enrollment,
            course,
            certificateReleased: Boolean(enrollment.certificateId || certificate),
            certificateIssuedAt: certificate?.issuedAt,
            pendingReviews: pendingReviewsByEnrollment[enrollment.id] || [],
            modules,
          } satisfies LearnerCourseProgress;
        })
        .sort((left, right) => new Date(right.enrollment.enrolledAt).getTime() - new Date(left.enrollment.enrolledAt).getTime());

      const submissionsByEnrollmentModule = new Map<string, Submission[]>();
      const allSubmissions = await Promise.all(
        learnerEnrollments.map((enrollment) => submissionService.getEnrollmentSubmissions(enrollment.id)),
      );
      const essayResponsesByEnrollmentModule = new Map<string, PracticeQuizEssayResponse[]>();
      const allEssayResponses = await Promise.all(
        learnerEnrollments.map((enrollment) => practiceQuizEssayReviewService.getEnrollmentResponses(enrollment.id)),
      );

      allSubmissions.flat().forEach((submission) => {
        const enrollmentModuleKey = `${submission.enrollment_id}:${submission.module_id || ""}`;
        const existing = submissionsByEnrollmentModule.get(enrollmentModuleKey) || [];
        existing.push(submission);
        submissionsByEnrollmentModule.set(enrollmentModuleKey, existing);
      });

      allEssayResponses.flat().forEach((response) => {
        const enrollmentModuleKey = `${response.enrollment_id}:${response.module_id}`;
        const existing = essayResponsesByEnrollmentModule.get(enrollmentModuleKey) || [];
        existing.push(response);
        essayResponsesByEnrollmentModule.set(enrollmentModuleKey, existing);
      });

      const progressRowsWithSubmissions = progressRows.map((item) => ({
        ...item,
        modules: item.modules.map((moduleItem) => ({
          ...moduleItem,
          submissions: submissionsByEnrollmentModule.get(`${item.enrollment.id}:${moduleItem.module.id}`) || [],
          essayResponses: essayResponsesByEnrollmentModule.get(`${item.enrollment.id}:${moduleItem.module.id}`) || [],
        })),
      }));

      let nextInsight: LearnerSessionInsight | null = null;
      for (const summary of trainerSessionSummaries) {
        const matchingEnrollment = learnerEnrollments.find((enrollment) => enrollment.courseId === summary.courseId);
        const courseNeedsAttention =
          summary.totalSessions >= SHORT_SESSION_REPEAT_THRESHOLD &&
          summary.totalDurationSeconds / summary.totalSessions <= SHORT_SESSION_SECONDS &&
          matchingEnrollment?.status !== "completed";

        if (!nextInsight) {
          nextInsight = {
            learnerId,
            totalSessions: summary.totalSessions,
            totalDurationSeconds: summary.totalDurationSeconds,
            lastSeenAt: summary.lastSeenAt,
            lastCourseTitle: summary.courseTitle,
            lastModuleTitle: summary.lastModuleTitle,
            repeatedShortSessionCount: courseNeedsAttention ? 1 : 0,
            needsAttention: courseNeedsAttention,
          };
          continue;
        }

        nextInsight.totalSessions += summary.totalSessions;
        nextInsight.totalDurationSeconds += summary.totalDurationSeconds;
        nextInsight.repeatedShortSessionCount += courseNeedsAttention ? 1 : 0;
        nextInsight.needsAttention = nextInsight.needsAttention || courseNeedsAttention;

        if (!nextInsight.lastSeenAt || summary.lastSeenAt > nextInsight.lastSeenAt) {
          nextInsight.lastSeenAt = summary.lastSeenAt;
          nextInsight.lastCourseTitle = summary.courseTitle;
          nextInsight.lastModuleTitle = summary.lastModuleTitle;
        }
      }

      setLearner({ ...learnerProfile, enrollments: learnerEnrollments });
      setLearnerProgress(progressRowsWithSubmissions);
      setSelectedLearnerSessionSummaries(Object.fromEntries(trainerSessionSummaries.map((summary) => [summary.courseId, summary])));
      setSelectedLearnerRecentSessions(
        recentSessions.map((session) => ({
          id: session.id,
          courseId: session.courseId,
          moduleId: session.moduleId,
          courseTitle: courseLookup.get(session.courseId)?.title || null,
          moduleTitle: (modulesByCourse.get(session.courseId) || []).find((module) => module.id === session.moduleId)?.title || null,
          lastSeenAt: session.lastSeenAt,
          durationSeconds: session.durationSeconds,
          sessionStatus: session.sessionStatus,
          practiceQuizSummary: moduleSessionService.getPracticeQuizSummaryFromMetadata(session.metadata),
        })),
      );
      setLearnerSessionInsight(nextInsight);
    } catch (error) {
      console.error("Error loading learner progress:", error);
      toast.error("Failed to load learner progress");
      setLearner(null);
      setLearnerProgress([]);
      setLearnerSessionInsight(null);
      setSelectedLearnerSessionSummaries({});
      setSelectedLearnerRecentSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, [learnerId, user?.id]);

  const refreshPage = async () => {
    await loadPage();
  };

  const handleViewSubmission = async (filePath?: string | null) => {
    try {
      const accessUrl = await createSubmissionAccessUrl(filePath);
      if (!accessUrl) {
        throw new Error("No file available.");
      }

      window.open(accessUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error opening submission:", error);
      toast.error("Failed to open learner file");
    }
  };

  const handleDownloadSubmission = async (filePath?: string | null) => {
    try {
      await downloadSubmissionFile(filePath, getSubmissionAttachmentName(filePath));
    } catch (error) {
      console.error("Error downloading submission:", error);
      toast.error("Failed to download learner file");
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
        : "0");
      setReviewDecision(detail.reviewStatus === "needs_revision" ? "needs_revision" : "approved");
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

  const openCompletionReviewDialog = (item: LearnerCourseProgress, decision: "approved" | "needs_revision") => {
    setCompletionTarget({
      enrollmentId: item.enrollment.id,
      courseTitle: item.course?.title || "Course",
    });
    setCompletionDecision(decision);
    setCompletionFeedback(item.enrollment.completionFeedback || "");
    setCompletionDialogOpen(true);
  };

  const handleSubmitCompletionReview = async () => {
    if (!user || !completionTarget) {
      return;
    }

    if (completionDecision === "needs_revision" && !completionFeedback.trim()) {
      toast.error("Feedback is required when returning a course for follow-up.");
      return;
    }

    setCompletionSubmitting(true);
    setCourseActionEnrollmentId(completionTarget.enrollmentId);

    try {
      await enrollmentService.reviewCompletion(
        completionTarget.enrollmentId,
        user.id,
        completionDecision,
        completionFeedback,
      );
      toast.success(completionDecision === "approved" ? "Course completion approved" : "Course returned for follow-up");
      setCompletionDialogOpen(false);
      await refreshPage();
    } catch (error: any) {
      console.error("Error reviewing course completion:", error);
      toast.error(error?.message || "Failed to review course completion");
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
      await refreshPage();
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
      toast.success("Certificate issued manually");
      await refreshPage();
    } catch (error: any) {
      console.error("Error issuing certificate:", error);
      toast.error(error?.message || "Failed to issue certificate");
    } finally {
      setCourseActionEnrollmentId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(learnersRouteBase)}> 
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Learners
          </Button>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Learner Progress Review</h1>
          <p className="mt-2 text-muted-foreground">
            Review the learner&apos;s course activity, module completion, graded assessment status, and approval readiness in a full-page workspace.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-3 h-6 w-6 animate-spin" />
            Loading learner progress...
          </div>
        ) : !learner ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">Learner progress is not available.</CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-5">
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Learner Summary</p>
                      <h2 className="mt-2 text-2xl font-semibold">{learner.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{learner.email}</p>
                    </div>
                    {learnerSessionInsight?.needsAttention ? (
                      <Badge variant="secondary" className="border-amber-300 bg-amber-50 text-amber-700">
                        Repeated short sessions
                      </Badge>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Courses</p>
                      <p className="mt-2 text-3xl font-semibold">{learnerProgress.length}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Completed</p>
                      <p className="mt-2 text-3xl font-semibold">{completedCourses}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Certificates</p>
                      <p className="mt-2 text-3xl font-semibold">{releasedCertificates}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Avg Progress</p>
                      <p className="mt-2 text-3xl font-semibold">{averageProgress}%</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p className="font-medium">{learnerSessionInsight?.lastModuleTitle || "No tracked module"}</p>
                      <p className="text-muted-foreground">{learnerSessionInsight?.lastCourseTitle || "No tracked course context"}</p>
                      <p className="text-muted-foreground">{formatRelativeActivity(learnerSessionInsight?.lastSeenAt || null)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Session Signal</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      {learnerSessionInsight?.needsAttention
                        ? `${learnerSessionInsight.repeatedShortSessionCount} course signal(s) need review.`
                        : "No repeated short-session pattern detected."}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Session History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedLearnerRecentSessions.length > 0 ? (
                    selectedLearnerRecentSessions.map((session) => (
                      <div key={session.id} className="rounded-lg border p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-medium">{session.moduleTitle || "Untitled module"}</p>
                            <p className="text-sm text-muted-foreground">{session.courseTitle || "Untitled course"}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{formatSessionDuration(session.durationSeconds)}</Badge>
                            <Badge variant="outline">{formatSessionStatus(session.sessionStatus)}</Badge>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Last opened {formatRelativeActivity(session.lastSeenAt)}</p>
                        {session.practiceQuizSummary ? (
                          <div className="mt-3 rounded-lg border border-dashed bg-muted/20 p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <FileQuestion className="h-4 w-4 text-muted-foreground" />
                              <p className="font-medium">Practice quiz snapshot</p>
                              <Badge variant="outline">
                                {session.practiceQuizSummary.earnedPoints} / {session.practiceQuizSummary.totalPoints} pts
                              </Badge>
                              <Badge variant="secondary">
                                {session.practiceQuizSummary.percentageScore !== null ? `${session.practiceQuizSummary.percentageScore}%` : "No auto-score"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Auto-scored {session.practiceQuizSummary.correctQuestions} / {session.practiceQuizSummary.submittedQuestions}
                              {session.practiceQuizSummary.essayQuestionCount > 0
                                ? ` • Essay reflections ${session.practiceQuizSummary.essayAnsweredCount} / ${session.practiceQuizSummary.essayQuestionCount}`
                                : ""}
                              {` • Updated ${formatRelativeActivity(session.practiceQuizSummary.updatedAt)}`}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent staff-visible session history is available for this learner yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Course Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {filteredLearnerProgress.map((item) => (
                    <div key={item.enrollment.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{item.course?.title || "Unknown Course"}</p>
                          <p className="text-xs text-muted-foreground">{item.modules.filter((moduleItem) => moduleItem.completed).length}/{item.modules.length} modules</p>
                        </div>
                        <Badge variant={item.enrollment.completionApprovalStatus === "approved" ? "default" : item.enrollment.completionApprovalStatus === "pending" ? "secondary" : "outline"}>
                          {item.enrollment.progress}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Review Workspace</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full lg:max-w-md">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={courseSearchTerm}
                        onChange={(event) => setCourseSearchTerm(event.target.value)}
                        placeholder="Search courses, modules, or assessments"
                        className="pl-9"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant={courseFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setCourseFilter("all")}>All</Button>
                      <Button variant={courseFilter === "needs-review" ? "default" : "outline"} size="sm" onClick={() => setCourseFilter("needs-review")}>Needs Review</Button>
                      <Button variant={courseFilter === "active" ? "default" : "outline"} size="sm" onClick={() => setCourseFilter("active")}>Active</Button>
                      <Button variant={courseFilter === "completed" ? "default" : "outline"} size="sm" onClick={() => setCourseFilter("completed")}>Completed</Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Assessment reviews stay on the dedicated assessment review page. Module reviews now open a dedicated workspace for formative practice-quiz essays.
                  </p>
                </CardContent>
              </Card>

              {filteredLearnerProgress.map((item) => (
                <Card key={item.enrollment.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle className="text-lg">{item.course?.title || "Unknown Course"}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.course?.category || "Course"} • Enrolled {new Date(item.enrollment.enrolledAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{item.enrollment.status}</Badge>
                        <Badge variant={item.enrollment.completionApprovalStatus === "approved" ? "default" : item.enrollment.completionApprovalStatus === "pending" ? "secondary" : "outline"}>
                          {item.enrollment.completionApprovalStatus === "approved"
                            ? "Completion Approved"
                            : item.enrollment.completionApprovalStatus === "pending"
                            ? "Awaiting Approval"
                            : item.enrollment.completionApprovalStatus === "needs_revision"
                            ? "Needs Follow-up"
                            : "Not Ready"}
                        </Badge>
                        <Badge variant={item.certificateReleased ? "default" : "secondary"}>
                          {item.certificateReleased ? "Certificate Released" : "Certificate Not Released"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedLearnerSessionSummaries[item.enrollment.courseId] ? (
                      <div className="grid gap-3 md:grid-cols-4 text-sm">
                        <div className="rounded-lg border p-3">
                          <p className="text-muted-foreground">Last accessed module</p>
                          <p className="mt-1 font-medium">{selectedLearnerSessionSummaries[item.enrollment.courseId].lastModuleTitle || "No tracked module"}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-muted-foreground">Last activity</p>
                          <p className="mt-1 font-medium">{formatRelativeActivity(selectedLearnerSessionSummaries[item.enrollment.courseId].lastSeenAt)}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-muted-foreground">Session depth</p>
                          <p className="mt-1 font-medium">
                            {selectedLearnerSessionSummaries[item.enrollment.courseId].totalSessions} sessions • {formatSessionDuration(selectedLearnerSessionSummaries[item.enrollment.courseId].totalDurationSeconds)}
                          </p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-muted-foreground">Attention flag</p>
                          <p className="mt-1 font-medium">
                            {selectedLearnerSessionSummaries[item.enrollment.courseId].totalSessions >= SHORT_SESSION_REPEAT_THRESHOLD &&
                            selectedLearnerSessionSummaries[item.enrollment.courseId].totalDurationSeconds / selectedLearnerSessionSummaries[item.enrollment.courseId].totalSessions <= SHORT_SESSION_SECONDS &&
                            item.enrollment.status !== "completed"
                              ? "Repeated short sessions"
                              : "No issue detected"}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Course Progress</span>
                        <span className="font-medium">{item.enrollment.progress}%</span>
                      </div>
                      <Progress value={item.enrollment.progress} />
                    </div>

                    <div className="grid gap-3 md:grid-cols-4 text-sm">
                      <div className="rounded-lg border p-3">
                        <p className="text-muted-foreground">Modules Completed</p>
                        <p className="mt-1 font-medium">{item.modules.filter((moduleItem) => moduleItem.completed).length}/{item.modules.length}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-muted-foreground">Assessment Completion</p>
                        <p className="mt-1 font-medium">
                          {item.modules.flatMap((moduleItem) => moduleItem.assessments).filter((assessment) => Boolean(assessment.submittedAt)).length}/
                          {item.modules.flatMap((moduleItem) => moduleItem.assessments).length}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-muted-foreground">Certificate Status</p>
                        <p className="mt-1 font-medium">
                          {item.certificateReleased
                            ? item.certificateIssuedAt
                              ? `Released ${new Date(item.certificateIssuedAt).toLocaleDateString()}`
                              : "Released"
                            : "Not released"}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-muted-foreground">Completion Status</p>
                        <p className="mt-1 font-medium">
                          {item.enrollment.completionApprovalStatus === "approved"
                            ? "Approved"
                            : item.enrollment.completionApprovalStatus === "pending"
                            ? "Pending staff approval"
                            : item.enrollment.completionApprovalStatus === "needs_revision"
                            ? "Needs follow-up"
                            : item.enrollment.status}
                        </p>
                      </div>
                    </div>

                    {item.enrollment.completionFeedback ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <p className="font-medium">Latest review feedback</p>
                        <p className="mt-1 whitespace-pre-wrap">{item.enrollment.completionFeedback}</p>
                      </div>
                    ) : null}

                    {hasCompletionReviewState(item.enrollment) ? (
                      <div className="flex flex-wrap gap-2">
                        {item.enrollment.completionApprovalStatus !== "approved" ? (
                          <>
                            <Button
                              onClick={() => openCompletionReviewDialog(item, "approved")}
                              disabled={courseActionEnrollmentId === item.enrollment.id || item.pendingReviews.length > 0}
                            >
                              Approve Completion
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => openCompletionReviewDialog(item, "needs_revision")}
                              disabled={courseActionEnrollmentId === item.enrollment.id}
                            >
                              Mark For Follow-up
                            </Button>
                          </>
                        ) : null}
                        {item.enrollment.completionApprovalStatus === "approved" && !item.certificateReleased ? (
                          <Button
                            variant="secondary"
                            onClick={() => void handleIssueCertificate(item.enrollment.id)}
                            disabled={courseActionEnrollmentId === item.enrollment.id}
                          >
                            Release Certificate
                          </Button>
                        ) : null}
                      </div>
                    ) : null}

                    <Accordion type="multiple" className="space-y-2">
                      {item.modules.map((moduleItem) => {
                        const actionKey = `${item.enrollment.id}:${moduleItem.module.id}`;
                        const moduleReviews = item.pendingReviews.filter((review) => review.moduleId === moduleItem.module.id);
                        const hasPendingManualScore = moduleItem.assessments.some((assessment) => assessment.requiresManualReview && assessment.score === undefined);
                        const latestModuleSession = selectedLearnerRecentSessions.find(
                          (session) => session.courseId === item.enrollment.courseId && session.moduleId === moduleItem.module.id,
                        );
                        const modulePracticeReview = getPracticeQuizModuleReviewSummary({
                          module: moduleItem.module,
                          responses: moduleItem.essayResponses,
                          latestPracticeQuizSummary: latestModuleSession?.practiceQuizSummary || moduleItem.practiceQuizSnapshot?.summary || null,
                        });
                        const showModuleReviewLink = modulePracticeReview.essayQuestionCount > 0;

                        return (
                          <AccordionItem key={moduleItem.module.id} value={moduleItem.module.id} className="rounded-lg border px-4">
                            <AccordionTrigger>
                              <div className="flex flex-1 flex-col items-start gap-2 text-left md:flex-row md:items-center md:justify-between md:pr-4">
                                <div>
                                  <p className="font-medium">{moduleItem.module.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {moduleItem.completed
                                      ? `Completed ${moduleItem.completedAt ? new Date(moduleItem.completedAt).toLocaleDateString() : ""}`
                                      : moduleItem.blockedByModuleIds.length > 0
                                      ? "Blocked by prerequisites"
                                      : "Ready for learner"}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant={moduleItem.completed ? "default" : moduleItem.blockedByModuleIds.length > 0 ? "outline" : "secondary"}>
                                    {moduleItem.completed ? "Completed" : moduleItem.blockedByModuleIds.length > 0 ? "Blocked" : "Pending"}
                                  </Badge>
                                  <Badge variant="outline">{formatTimeSpent(moduleItem.timeSpent)}</Badge>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pb-4">
                              {moduleItem.assessments.length > 0 ? (
                                <div className="space-y-3">
                                  <p className="text-sm font-medium">Assessments</p>
                                  {moduleItem.assessments.map((assessment) => (
                                    <div key={assessment.assessmentId} className="rounded-lg border p-3 text-sm">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                          <p className="font-medium">{assessment.assessmentTitle}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {assessment.submittedAt ? `Submitted ${new Date(assessment.submittedAt).toLocaleString()}` : "Awaiting learner submission"}
                                          </p>
                                        </div>
                                        <Badge variant={assessment.reviewStatus === "approved" || assessment.passed ? "default" : assessment.reviewStatus === "needs_revision" ? "outline" : "secondary"}>
                                          {assessment.reviewStatus?.replace(/_/g, " ") || assessment.passed === false ? "Completed" : assessment.submittedAt ? "Submitted" : "Awaiting submission"}
                                        </Badge>
                                      </div>
                                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                        <span>Score: {assessment.score ?? "—"}</span>
                                        <span>Total score: {assessment.earnedPoints !== undefined && assessment.totalPoints ? `${assessment.earnedPoints} / ${assessment.totalPoints}` : assessment.requiresManualReview ? "Pending manual review" : "—"}</span>
                                        <span>Time: {formatTimeSpent(assessment.timeSpent)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              {moduleReviews.length > 0 ? (
                                <div className="space-y-2">
                                  {moduleReviews.map((reviewItem) => (
                                    <div key={reviewItem.attemptId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                                      <div>
                                        <p className="font-medium">{reviewItem.assessmentTitle}</p>
                                        <p className="text-xs text-muted-foreground">{reviewItem.reviewStatus.replace(/_/g, " ")}</p>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate(`${assessmentReviewRouteBase}/${reviewItem.attemptId}?learnerId=${learnerId}&enrollmentId=${item.enrollment.id}`)}
                                      >
                                        Review Assessment
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              {showModuleReviewLink ? (
                                <div className="space-y-3">
                                  <div className="rounded-2xl border bg-muted/20 p-4 text-sm">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                      <div>
                                        <p className="font-medium">Module review workspace</p>
                                        <p className="mt-1 text-muted-foreground">
                                          Practice-quiz essay reviews live on a separate page so module feedback stays distinct from graded assessment reviews.
                                        </p>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate(`${moduleReviewRouteBase}/${item.enrollment.id}/${moduleItem.module.id}?learnerId=${learnerId}`)}
                                      >
                                        Open Module Review
                                      </Button>
                                    </div>
                                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                                      <div className="rounded-lg border bg-background p-3">
                                        <p className="text-muted-foreground">Essay coverage</p>
                                        <p className="mt-1 font-medium">{modulePracticeReview.essayAnsweredCount} / {modulePracticeReview.essayQuestionCount}</p>
                                      </div>
                                      <div className="rounded-lg border bg-background p-3">
                                        <p className="text-muted-foreground">Manual scoring</p>
                                        <p className="mt-1 font-medium">{modulePracticeReview.essayReviewedCount} reviewed</p>
                                      </div>
                                      <div className="rounded-lg border bg-background p-3">
                                        <p className="text-muted-foreground">Essay points</p>
                                        <p className="mt-1 font-medium">{modulePracticeReview.essayAwardedPoints} / {modulePracticeReview.essayTotalPoints}</p>
                                      </div>
                                      <div className="rounded-lg border bg-background p-3">
                                        <p className="text-muted-foreground">Combined formative score</p>
                                        <p className="mt-1 font-medium">
                                          {modulePracticeReview.combinedEarnedPoints != null
                                            ? `${modulePracticeReview.combinedEarnedPoints} / ${modulePracticeReview.combinedTotalPoints}`
                                            : "Awaiting objective auto-score"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : null}

                              {moduleItem.submissions.length > 0 ? (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">Learner uploads</p>
                                  {moduleItem.submissions.map((submission) => (
                                    <div key={submission.id} className="rounded-lg border p-3 text-sm">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                          <p className="font-medium">{submission.title}</p>
                                          <p className="text-xs text-muted-foreground">
                                            Submitted {new Date(submission.submitted_at).toLocaleString()} • {submission.status.replace(/_/g, " ")}
                                          </p>
                                        </div>
                                        <Badge variant="outline">{submission.submission_type}</Badge>
                                      </div>
                                      {submission.description ? (
                                        <p className="mt-2 text-xs text-muted-foreground">{submission.description}</p>
                                      ) : null}
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <Button variant="outline" size="sm" onClick={() => void handleViewSubmission(submission.file_path)}>
                                          <ExternalLink className="mr-2 h-4 w-4" />
                                          View File
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => void handleDownloadSubmission(submission.file_path)}>
                                          <Download className="mr-2 h-4 w-4" />
                                          Download File
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              {!moduleItem.completed ? (
                                <Button
                                  variant="outline"
                                  onClick={() => void handleMarkModuleComplete(item.enrollment.id, moduleItem.module.id)}
                                  disabled={moduleActionKey === actionKey || moduleItem.blockedByModuleIds.length > 0 || hasPendingManualScore}
                                >
                                  Mark Module Complete
                                </Button>
                              ) : null}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
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
                  <label className="text-sm font-medium">Review score</label>
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
              <p className="font-medium">{learner?.name || "Learner"}</p>
              <p className="text-muted-foreground">{completionTarget?.courseTitle || "Course"}</p>
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

export default LearnerProgressPage;