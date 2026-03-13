import { useState, useEffect, useCallback, useMemo, useRef, type ClipboardEvent, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CheckCircle2, AlertCircle, Clock, FileQuestion } from "lucide-react";
import { toast } from "sonner";
import { assessmentService, AssessmentQuestion, Assessment, AssessmentAttempt, type AssessmentReviewStatus } from "@/services/assessmentService";
import { useAuth } from "@/contexts/AuthContext";
import { deriveAssessmentAttemptAccess, hasEssayQuestions } from "@/components/course/assessmentAttemptAccess";

interface AssessmentResultSummary {
  score?: number;
  passed?: boolean;
  passingScore: number;
  attemptsRemaining: number;
  canRetry: boolean;
  reviewStatus?: AssessmentReviewStatus;
  requiresManualReview: boolean;
  reviewFeedback?: string;
}

const ASSESSMENT_DRAFT_STORAGE_PREFIX = "assessment-draft";

const buildAssessmentDraftKey = (attemptId: string) => `${ASSESSMENT_DRAFT_STORAGE_PREFIX}:${attemptId}`;

const hasAnswerValue = (question: AssessmentQuestion, answer: string | undefined) => {
  if (question.questionType === "essay" || question.questionType === "short_answer") {
    return Boolean(answer?.trim());
  }

  return Boolean(answer);
};

const getResultCardClasses = (result: AssessmentResultSummary) => {
  if (result.reviewStatus && result.reviewStatus !== "approved") {
    return "border-sky-500 bg-sky-50 dark:bg-sky-950";
  }

  return result.passed ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-amber-500 bg-amber-50 dark:bg-amber-950";
};

const getResultTextClasses = (result: AssessmentResultSummary) => {
  if (result.reviewStatus && result.reviewStatus !== "approved") {
    return "text-sky-700 dark:text-sky-300";
  }

  return result.passed ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400";
};

const getLatestResultMessage = (result: AssessmentResultSummary, assessment: Assessment) => {
  if (result.reviewStatus === "submitted") {
    return "Assessment submitted. Your responses are now waiting for trainer review.";
  }

  if (result.reviewStatus === "under_review") {
    return "Assessment is currently under trainer review.";
  }

  if (result.reviewStatus === "needs_revision") {
    return "Trainer feedback requested changes before this assessment can be approved.";
  }

  if (result.passed) {
    return result.attemptsRemaining > 0 && assessment.allowRetryAfterPassing
      ? `Assessment passed with ${result.score}%. You may retry again if needed.`
      : `Assessment passed with ${result.score}%.`;
  }

  return result.canRetry
    ? `Assessment not passed. You scored ${result.score}%. You can retry below.`
    : `Assessment not passed. You scored ${result.score}%. No retries remain.`;
};

const createDeterministicSeed = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const deterministicShuffle = <T,>(items: T[], seedSource: string): T[] => {
  const clone = [...items];
  let seed = createDeterministicSeed(seedSource);

  for (let index = clone.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }

  return clone;
};

interface AssessmentInterfaceProps {
  enrollmentId: string;
  moduleId: string;
  courseId: string;
}

const AssessmentInterface = ({
  enrollmentId,
  moduleId,
  courseId,
}: AssessmentInterfaceProps) => {
  const { user } = useAuth();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null); // in seconds
  const [timeSpent, setTimeSpent] = useState(0); // in seconds
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "success" | "error">("idle");
  const [attemptBlockMessage, setAttemptBlockMessage] = useState<string | null>(null);
  const [completedAttemptCount, setCompletedAttemptCount] = useState(0);
  const [latestResult, setLatestResult] = useState<AssessmentResultSummary | null>(null);
  const [attemptMode, setAttemptMode] = useState<"standard" | "revision">("standard");
  const clipboardNoticeAtRef = useRef(0);

  const loadAssessment = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      setAttempt(null);
      setAnswers({});
      setAttemptBlockMessage(null);
      setCompletedAttemptCount(0);
      setLatestResult(null);
      setAttemptMode("standard");

      // Load assessment
      const assessmentData = await assessmentService.getAssessmentByModule(moduleId);
      
      if (!assessmentData) {
        // No assessment for this module
        setIsLoading(false);
        return;
      }

      setAssessment(assessmentData);

      // Load questions
      const questionsData = await assessmentService.getAssessmentQuestions(assessmentData.id);
      setQuestions(questionsData);

      // Check for existing attempts
      const attempts = await assessmentService.getAssessmentAttempts(assessmentData.id, user.id);
      const attemptAccess = deriveAssessmentAttemptAccess(assessmentData, questionsData, attempts);

      setCompletedAttemptCount(attemptAccess.completedAttempts.length);

      if (attemptAccess.latestCompletedAttempt) {
        setLatestResult({
          score: attemptAccess.latestCompletedAttempt.score,
          passed: attemptAccess.latestCompletedAttempt.passed,
          passingScore: assessmentData.passingScore,
          attemptsRemaining: attemptAccess.attemptsRemaining,
          canRetry:
            attemptAccess.latestCompletedAttempt.reviewStatus === "approved" &&
            !attemptAccess.latestCompletedAttempt.passed &&
            attemptAccess.completedAttempts.length < attemptAccess.effectiveMaxAttempts,
          reviewStatus: attemptAccess.latestCompletedAttempt.reviewStatus,
          requiresManualReview: attemptAccess.latestCompletedAttempt.requiresManualReview ?? false,
          reviewFeedback: attemptAccess.latestCompletedAttempt.reviewFeedback,
        });
      }

      if (attemptAccess.activeAttempt) {
        setAttemptMode(attemptAccess.isRevisionAttempt ? "revision" : "standard");
        setAttempt(attemptAccess.activeAttempt);
        setAnswers(attemptAccess.activeAttempt.answers || {});
        setTimeSpent(attemptAccess.activeAttempt.timeSpent || 0);
        return;
      }

      if (attemptAccess.attemptBlockMessage) {
        setAttemptBlockMessage(attemptAccess.attemptBlockMessage);
        return;
      }

      if (attemptAccess.shouldStartNewAttempt) {
        const newAttempt = await assessmentService.startAttempt(
          assessmentData.id,
          enrollmentId,
          user.id,
        );
        setAttemptMode(attemptAccess.isRevisionAttempt ? "revision" : "standard");
        setAttempt(newAttempt);
        setAnswers(attemptAccess.isRevisionAttempt ? attemptAccess.seedAnswers : (newAttempt.answers || {}));
        setTimeSpent(newAttempt.timeSpent || 0);
      }
    } catch (error) {
      console.error("Error loading assessment:", error);
      toast.error("Failed to load assessment");
    } finally {
      setIsLoading(false);
    }
  }, [moduleId, user, enrollmentId]);

  // Load assessment and questions
  useEffect(() => {
    loadAssessment();
  }, [loadAssessment]);

  useEffect(() => {
    if (!attempt?.id || attempt.submittedAt) {
      return;
    }

    try {
      const savedDraft = window.localStorage.getItem(buildAssessmentDraftKey(attempt.id));
      if (!savedDraft) {
        return;
      }

      const parsedDraft = JSON.parse(savedDraft) as { answers?: Record<string, string>; timeSpent?: number };
      if (parsedDraft.answers) {
        setAnswers((current) => ({ ...current, ...parsedDraft.answers }));
      }
      if (typeof parsedDraft.timeSpent === "number") {
        setTimeSpent((current) => Math.max(current, parsedDraft.timeSpent || 0));
      }
    } catch (error) {
      console.error("Error restoring assessment draft:", error);
    }
  }, [attempt?.id, attempt?.submittedAt]);

  useEffect(() => {
    if (!attempt?.id || attempt.submittedAt || submissionStatus === "success") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          buildAssessmentDraftKey(attempt.id),
          JSON.stringify({
            answers,
            timeSpent,
          }),
        );
      } catch (error) {
        console.error("Error saving assessment draft:", error);
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [attempt?.id, attempt?.submittedAt, answers, timeSpent, submissionStatus]);

  // Timer effect
  useEffect(() => {
    if (!assessment || !assessment.timeLimit) {
      setTimeRemaining(null);
      return;
    }

    const timer = assessment.timeLimit * 60; // Convert minutes to seconds
    setTimeRemaining(timer);

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
      setTimeSpent((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [assessment]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const notifyClipboardRestriction = useCallback((message: string) => {
    const now = Date.now();
    if (now - clipboardNoticeAtRef.current < 1500) {
      return;
    }

    clipboardNoticeAtRef.current = now;
    toast.info(message);
  }, []);

  const handleRestrictedClipboardEvent = (event: ClipboardEvent<HTMLElement>, action: "copy" | "cut" | "paste") => {
    event.preventDefault();

    const messageByAction = {
      copy: "Copy is limited during assessments to discourage answer sharing.",
      cut: "Cut is limited during assessments to keep answer handling inside the active attempt.",
      paste: "Paste is disabled during assessments. Please enter responses manually.",
    } as const;

    notifyClipboardRestriction(`${messageByAction[action]} Client-side controls are a deterrent only.`);
  };

  const handleRestrictedContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    notifyClipboardRestriction("Right-click actions are limited during assessments. Client-side controls are a deterrent only.");
  };

  const presentedQuestions = useMemo(() => {
    if (!attempt?.id) {
      return questions;
    }

    return deterministicShuffle(questions, `${attempt.id}:question-order`);
  }, [questions, attempt?.id]);

  const getPresentedOptions = useCallback(
    (question: AssessmentQuestion) => {
      const baseOptions = question.questionType === "true_false"
        ? ["True", "False"]
        : question.options || [];

      if (!attempt?.id || baseOptions.length <= 1) {
        return baseOptions;
      }

      return deterministicShuffle(baseOptions, `${attempt.id}:${question.id}:option-order`);
    },
    [attempt?.id],
  );

  const handleSubmit = async () => {
    if (!attempt || !assessment) return;

    // Check if all questions are answered, including long-form responses.
    const unanswered = questions.filter((question) => !hasAnswerValue(question, answers[question.id]));

    if (unanswered.length > 0) {
      toast.error(`Please answer all required questions. ${unanswered.length} remaining.`);
      return;
    }

    setIsSubmitting(true);
    setSubmissionStatus("idle");

    try {
      const result = await assessmentService.submitAttempt(
        attempt.id,
        answers,
        timeSpent,
        questions
      );

      window.localStorage.removeItem(buildAssessmentDraftKey(attempt.id));

      setSubmissionStatus("success");
      const nextCompletedAttemptCount = completedAttemptCount + 1;
      const effectiveMaxAttempts = hasEssayQuestions(questions) ? 1 : assessment.maxAttempts;
      const attemptsRemaining = Math.max(effectiveMaxAttempts - nextCompletedAttemptCount, 0);
      setLatestResult({
        score: result.score,
        passed: result.passed,
        passingScore: assessment.passingScore,
        attemptsRemaining,
        canRetry: result.reviewStatus === "approved" && !result.passed && nextCompletedAttemptCount < effectiveMaxAttempts,
        reviewStatus: result.reviewStatus,
        requiresManualReview: result.requiresManualReview,
        reviewFeedback: undefined,
      });
      const message = result.reviewStatus !== "approved"
        ? "Assessment submitted for trainer review. Your final result will appear after review."
        : result.passed
          ? `Assessment passed! Your score: ${result.score}%`
          : `Assessment not passed. Your score: ${result.score}% (Passing: ${assessment.passingScore}%)`;
      toast.success(message);
      
      // Reload to show results
      await loadAssessment();
    } catch (error) {
      console.error("Error submitting assessment:", error);
      setSubmissionStatus("error");
      const errorMessage = error instanceof Error ? error.message : "Failed to submit assessment";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading assessment...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!assessment || questions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileQuestion className="w-16 h-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No assessment available for this module</p>
        </CardContent>
      </Card>
    );
  }

  if (!attempt) {
    return (
      <div className="space-y-6">
        {latestResult && submissionStatus !== "error" && (
          <Card className={getResultCardClasses(latestResult)}>
            <CardContent className="pt-6">
              <div className={`flex items-center gap-2 ${getResultTextClasses(latestResult)}`}>
                <CheckCircle2 className="w-5 h-5" />
                <p className="text-sm font-medium">
                  {latestResult.reviewStatus && latestResult.reviewStatus !== "approved"
                    ? getLatestResultMessage(latestResult, assessment)
                    : latestResult.passed
                      ? `Assessment passed. Final score: ${latestResult.score}%`
                      : latestResult.canRetry
                        ? `Assessment not passed. Score: ${latestResult.score}%. You can retry.`
                        : `Assessment not passed. Score: ${latestResult.score}%. No attempts remain.`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          {latestResult?.passed ? (
            <CheckCircle2 className="w-16 h-16 text-green-600 dark:text-green-400 mb-4" />
          ) : (
            <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
          )}
          <p className="text-center text-muted-foreground">{attemptBlockMessage || "No assessment attempt is currently available."}</p>
        </CardContent>
        </Card>
      </div>
    );
  }

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const answeredCount = questions.filter((question) => hasAnswerValue(question, answers[question.id])).length;
  const essayAttemptPolicy = hasEssayQuestions(questions);
  const effectiveMaxAttempts = essayAttemptPolicy ? 1 : assessment.maxAttempts;
  const showLatestResult = latestResult && submissionStatus !== "error";
  const revisionFeedback = latestResult?.reviewStatus === "needs_revision"
    ? latestResult.reviewFeedback?.trim() || "Review your trainer's comments, update any answers that need work, and submit the revision when you are ready."
    : null;

  return (
    <div className="space-y-6">
      {showLatestResult && (
        <Card className={getResultCardClasses(latestResult)}>
          <CardContent className="pt-6">
            <div className={`flex items-center gap-2 ${getResultTextClasses(latestResult)}`}>
              <CheckCircle2 className="w-5 h-5" />
              <p className="text-sm font-medium">
                {getLatestResultMessage(latestResult, assessment)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {attemptMode === "revision" && revisionFeedback ? (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="text-base">Trainer Feedback</CardTitle>
            <CardDescription>Use this feedback to revise your previous submission before sending it back for review.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-amber-900 dark:text-amber-100">{revisionFeedback}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Assessment Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileQuestion className="w-5 h-5" />
                {assessment.title}
              </CardTitle>
              {assessment.description && (
                <CardDescription className="mt-2">{assessment.description}</CardDescription>
              )}
            </div>
            {timeRemaining !== null && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
                timeRemaining < 300 ? "bg-red-100 dark:bg-red-950" : "bg-muted"
              }`}>
                <Clock className={`w-4 h-4 ${timeRemaining < 300 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
                <span className={`text-sm font-medium ${
                  timeRemaining < 300 ? "text-red-600 dark:text-red-400" : ""
                }`}>
                  {timeRemaining > 0 ? formatTime(timeRemaining) : "Time's up!"}
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {answeredCount} of {questions.length} questions answered
            </span>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                Passing Score: {assessment.passingScore}%
              </span>
              <span className="text-muted-foreground">
                {attemptMode === "revision"
                  ? "Trainer requested a revision"
                  : `Attempts Left: ${Math.max(effectiveMaxAttempts - completedAttemptCount, 0)}`}
              </span>
              <span className="text-muted-foreground">
                {assessment.allowRetryAfterPassing ? "Retry after pass: allowed" : "Retry after pass: locked"}
              </span>
              <span className="font-medium">Total Points: {totalPoints}</span>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {attemptMode === "revision"
              ? "Your previous answers were copied into this revision attempt. Draft responses continue to save automatically on this device while you update them."
              : "Draft responses save automatically on this device while you work."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Question order and answer choices are shuffled for each attempt. Copy, paste, and similar browser shortcuts are limited to discourage casual sharing, but client-side controls are not a full security boundary.
          </p>
          {essayAttemptPolicy && (
            <p className="mt-2 text-sm text-muted-foreground">
              Essay and other manual-review responses go to a trainer before a final result is issued. If your trainer requests changes, you can revise the returned work and resubmit it without losing the earlier review history.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Questions */}
      <div
        className="space-y-6"
        onCopyCapture={(event) => handleRestrictedClipboardEvent(event, "copy")}
        onCutCapture={(event) => handleRestrictedClipboardEvent(event, "cut")}
        onPasteCapture={(event) => handleRestrictedClipboardEvent(event, "paste")}
        onContextMenuCapture={handleRestrictedContextMenu}
      >
        {presentedQuestions.map((question, index) => (
          <Card key={question.id}>
            <CardHeader>
              <CardTitle className="text-lg">
                Question {index + 1}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({question.points} points)
                </span>
              </CardTitle>
              <CardDescription>{question.question}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {question.questionType === "multiple_choice" && question.options && (
                <RadioGroup
                  value={answers[question.id] || ""}
                  onValueChange={(value) => handleAnswerChange(question.id, value)}
                >
                  {getPresentedOptions(question).map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`${question.id}-${optIndex}`} />
                      <Label
                        htmlFor={`${question.id}-${optIndex}`}
                        className="cursor-pointer flex-1"
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {question.questionType === "true_false" && (
                <RadioGroup
                  value={answers[question.id] || ""}
                  onValueChange={(value) => handleAnswerChange(question.id, value)}
                >
                  {getPresentedOptions(question).map((option, optIndex) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`${question.id}-tf-${optIndex}`} />
                      <Label htmlFor={`${question.id}-tf-${optIndex}`} className="cursor-pointer flex-1">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {question.questionType === "short_answer" && (
                <Input
                  value={answers[question.id] || ""}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  placeholder="Enter your answer"
                />
              )}

              {question.questionType === "essay" && (
                <div className="space-y-2">
                  <Textarea
                    value={answers[question.id] || ""}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="Enter your detailed answer"
                    rows={8}
                  />
                  <p className="text-sm text-muted-foreground">
                    Essay responses are reviewed by a trainer before a final assessment result is issued.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submit Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {answeredCount === questions.length
                  ? "All questions answered. Ready to submit!"
                  : `${questions.length - answeredCount} question(s) remaining`}
              </p>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || answeredCount < questions.length || (timeRemaining !== null && timeRemaining <= 0)}
              className="gap-2"
            >
              {isSubmitting ? (
                <>Submitting...</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {attemptMode === "revision" ? "Submit Revision" : "Submit Assessment"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {submissionStatus === "error" && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-medium">
                Failed to submit assessment. Please try again.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AssessmentInterface;

