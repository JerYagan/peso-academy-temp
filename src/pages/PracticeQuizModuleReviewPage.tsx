import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileQuestion, Loader2, MessageSquareText, PenSquare } from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { getPracticeQuizEssayQuestionMetaForResponse, getPracticeQuizModuleReviewSummary } from "@/lib/practiceQuizReview";
import { practiceQuizEssayReviewService } from "@/services/practiceQuizEssayReviewService";
import { enrollmentService } from "@/services/supabaseDatabaseService";
import { moduleSessionService } from "@/services/moduleSessionService";
import { PracticeQuizEssayResponse } from "@/types";

type PracticeQuizModuleReviewPageProps = {
  portal: "admin" | "trainer";
};

const PracticeQuizModuleReviewPage = ({ portal }: PracticeQuizModuleReviewPageProps) => {
  const { enrollmentId, moduleId } = useParams<{ enrollmentId?: string; moduleId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<PracticeQuizEssayResponse[]>([]);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [savingResponseId, setSavingResponseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof enrollmentService.getEnrollmentProgressDetail>> | null>(null);
  const [headerDetail, setHeaderDetail] = useState<Awaited<ReturnType<typeof enrollmentService.getEnrollmentWithDetails>> | null>(null);
  const [latestSummary, setLatestSummary] = useState<ReturnType<typeof moduleSessionService.getPracticeQuizSummaryFromMetadata> | null>(null);

  const learnerId = searchParams.get("learnerId") || undefined;

  const backPath = useMemo(() => {
    if (portal === "admin") {
      if (learnerId) {
        return `/admin/learners/${learnerId}`;
      }

      return enrollmentId ? `/admin/enrollments/${enrollmentId}` : "/admin/enrollments";
    }

    if (learnerId) {
      return `/trainer/learners/${learnerId}`;
    }

    return "/trainer/learners";
  }, [enrollmentId, learnerId, portal]);

  const targetModule = useMemo(
    () => detail?.modules.find((entry) => entry.module.id === moduleId)?.module || null,
    [detail, moduleId],
  );

  const targetModuleProgress = useMemo(
    () => detail?.modules.find((entry) => entry.module.id === moduleId) || null,
    [detail, moduleId],
  );

  const reviewSummary = useMemo(() => {
    if (!targetModule) {
      return null;
    }

    return getPracticeQuizModuleReviewSummary({
      module: targetModule,
      responses,
      latestPracticeQuizSummary: latestSummary,
    });
  }, [latestSummary, responses, targetModule]);

  useEffect(() => {
    const loadPage = async () => {
      if (!enrollmentId || !moduleId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [nextHeaderDetail, nextDetail, nextResponses] = await Promise.all([
          enrollmentService.getEnrollmentWithDetails(enrollmentId),
          enrollmentService.getEnrollmentProgressDetail(enrollmentId),
          practiceQuizEssayReviewService.getModuleResponses({ enrollmentId, moduleId }),
        ]);

        if (!nextDetail) {
          throw new Error("Module review details are not available.");
        }

        const sessionRows = nextHeaderDetail.user?.id
          ? await moduleSessionService.getTrainerAccessibleSessions({
              learnerId: nextHeaderDetail.user.id,
              courseId: nextDetail.enrollment.courseId,
              limit: 100,
            })
          : [];

        const latestModuleSession = sessionRows
          .filter((session) => session.moduleId === moduleId)
          .sort((left, right) => new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime())[0];

        setHeaderDetail(nextHeaderDetail);
        setDetail(nextDetail);
        setResponses(nextResponses);
        setFeedbackDrafts(Object.fromEntries(nextResponses.map((response) => [response.id, response.review_feedback || ""])));
        setScoreDrafts(
          Object.fromEntries(
            nextResponses.map((response) => [response.id, response.review_score_points == null ? "" : String(response.review_score_points)]),
          ),
        );
        setLatestSummary(
          moduleSessionService.getPracticeQuizSummaryFromMetadata(latestModuleSession?.metadata)
          || nextDetail.modules.find((entry) => entry.module.id === moduleId)?.practiceQuizSnapshot?.summary
          || null,
        );
      } catch (error) {
        console.error("Error loading practice quiz module review:", error);
        toast.error("Failed to load module review");
        setDetail(null);
        setHeaderDetail(null);
        setResponses([]);
        setLatestSummary(null);
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [enrollmentId, moduleId]);

  const handleSaveResponseReview = async (response: PracticeQuizEssayResponse) => {
    if (!user || !targetModule) {
      return;
    }

    const meta = getPracticeQuizEssayQuestionMetaForResponse(targetModule, response);
    const rawScore = scoreDrafts[response.id]?.trim() || "";
    const parsedScore = rawScore === "" ? null : Number(rawScore);

    if (parsedScore !== null && (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > meta.points)) {
      toast.error(`Enter a score from 0 to ${meta.points}.`);
      return;
    }

    setSavingResponseId(response.id);

    try {
      await practiceQuizEssayReviewService.saveFeedback({
        responseId: response.id,
        reviewerId: user.id,
        feedbackText: feedbackDrafts[response.id] || "",
        scorePoints: parsedScore,
      });

      setResponses((current) =>
        current.map((candidate) =>
          candidate.id === response.id
            ? {
                ...candidate,
                review_feedback: feedbackDrafts[response.id] || "",
                review_score_points: parsedScore,
                reviewed_at: new Date().toISOString(),
              }
            : candidate,
        ),
      );
      toast.success("Practice quiz essay review saved");
    } catch (error) {
      console.error("Error saving practice quiz essay review:", error);
      toast.error("Failed to save practice quiz essay review");
    } finally {
      setSavingResponseId(null);
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
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Module Reviews</h1>
            <p className="mt-2 text-muted-foreground">
              Score formative practice-quiz essays separately from graded assessment reviews.
            </p>
          </div>
          {reviewSummary ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{reviewSummary.pendingEssayReviewCount} awaiting score</Badge>
              <Badge variant="outline">{reviewSummary.essayReviewedCount}/{reviewSummary.essayAnsweredCount} essays scored</Badge>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading module review...
          </div>
        ) : !detail || !targetModule ? (
          <Card>
            <CardContent className="py-12 text-sm text-muted-foreground">
              Module review details are not available.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{targetModule.title}</CardTitle>
                  <CardDescription>
                    {headerDetail?.course?.title || detail.course?.title || "Course"}
                    {headerDetail?.user?.name ? ` • ${headerDetail.user.name}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Objective auto-score</p>
                    <p className="mt-1 font-medium">
                      {reviewSummary?.objectiveEarnedPoints != null
                        ? `${reviewSummary.objectiveEarnedPoints} / ${reviewSummary.objectiveTotalPoints} pts`
                        : `Awaiting learner submit • ${reviewSummary?.objectiveTotalPoints || 0} pts total`}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Essay manual score</p>
                    <p className="mt-1 font-medium">
                      {reviewSummary ? `${reviewSummary.essayAwardedPoints} / ${reviewSummary.essayTotalPoints} pts` : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Combined formative score</p>
                    <p className="mt-1 font-medium">
                      {reviewSummary?.combinedEarnedPoints != null
                        ? `${reviewSummary.combinedEarnedPoints} / ${reviewSummary.combinedTotalPoints} pts`
                        : "Waiting for objective auto-score"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Review Coverage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Essay responses</p>
                    <p className="mt-1 font-medium">{reviewSummary?.essayAnsweredCount || 0} / {reviewSummary?.essayQuestionCount || 0}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Auto-scored questions</p>
                    <p className="mt-1 font-medium">
                      {reviewSummary?.objectiveCorrectQuestions || 0} / {reviewSummary?.objectiveSubmittedQuestions || 0}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Combined percentage</p>
                    <p className="mt-1 font-medium">
                      {reviewSummary?.combinedPercentageScore != null
                        ? `${reviewSummary.combinedPercentageScore}%`
                        : reviewSummary?.objectivePercentageScore != null
                        ? `Objective only: ${reviewSummary.objectivePercentageScore}%`
                        : "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Practice Quiz Essay Responses</CardTitle>
                <CardDescription>
                  This page only covers formative practice-quiz essays. Use assessment review pages for graded assessments.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {responses.length > 0 ? (
                  responses
                    .slice()
                    .sort((left, right) => {
                      const leftMeta = getPracticeQuizEssayQuestionMetaForResponse(targetModule, left);
                      const rightMeta = getPracticeQuizEssayQuestionMetaForResponse(targetModule, right);
                      return leftMeta.order - rightMeta.order;
                    })
                    .map((response) => {
                      const meta = getPracticeQuizEssayQuestionMetaForResponse(targetModule, response);
                      const hasScore = Number.isFinite(response.review_score_points);

                      return (
                        <div key={response.id} className="rounded-2xl border p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <PenSquare className="h-4 w-4 text-muted-foreground" />
                                <p className="font-medium">{meta.title}</p>
                                <Badge variant="outline">{meta.points} pts</Badge>
                                <Badge variant={hasScore ? "default" : "secondary"}>{hasScore ? "Scored" : "Awaiting score"}</Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Submitted {new Date(response.submitted_at).toLocaleString()}
                                {response.reviewer_name && response.reviewed_at
                                  ? ` • Last reviewed by ${response.reviewer_name} on ${new Date(response.reviewed_at).toLocaleString()}`
                                  : ""}
                              </p>
                            </div>
                            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                              <span className="text-muted-foreground">Formative score</span>
                              <p className="font-medium">{response.review_score_points ?? "—"} / {meta.points}</p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
                            <div className="rounded-xl border bg-muted/20 p-3">
                              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                                <FileQuestion className="h-4 w-4" />
                                Prompt
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm">{meta.promptText}</p>
                            </div>
                            <div className="rounded-xl border p-3">
                              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                                <MessageSquareText className="h-4 w-4" />
                                Learner response
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm">{response.response_text || "No response submitted."}</p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 xl:grid-cols-[220px_1fr]">
                            <div className="space-y-2">
                              <Label htmlFor={`module-review-score-${response.id}`}>Essay score</Label>
                              <Input
                                id={`module-review-score-${response.id}`}
                                value={scoreDrafts[response.id] ?? ""}
                                onChange={(event) => setScoreDrafts((current) => ({ ...current, [response.id]: event.target.value }))}
                                placeholder={`0 - ${meta.points}`}
                                inputMode="decimal"
                              />
                              <p className="text-xs text-muted-foreground">
                                Enter up to {meta.points} point{meta.points === 1 ? "" : "s"}. Leave blank if you only want to save feedback.
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`module-review-feedback-${response.id}`}>Feedback comment</Label>
                              <Textarea
                                id={`module-review-feedback-${response.id}`}
                                value={feedbackDrafts[response.id] ?? ""}
                                onChange={(event) =>
                                  setFeedbackDrafts((current) => ({
                                    ...current,
                                    [response.id]: event.target.value,
                                  }))
                                }
                                rows={5}
                                placeholder="Optional formative feedback for the learner."
                              />
                            </div>
                          </div>

                          <div className="mt-4 flex justify-end">
                            <Button
                              variant="outline"
                              onClick={() => void handleSaveResponseReview(response)}
                              disabled={savingResponseId === response.id}
                            >
                              {savingResponseId === response.id ? "Saving..." : "Save Module Review"}
                            </Button>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                    No practice-quiz essay responses have been submitted for this module yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PracticeQuizModuleReviewPage;