import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CheckCircle2, AlertCircle, Clock, FileQuestion } from "lucide-react";
import { toast } from "sonner";
import { assessmentService, AssessmentQuestion, Assessment, AssessmentAttempt } from "@/services/assessmentService";
import { useAuth } from "@/contexts/AuthContext";

interface AssessmentResultSummary {
  score: number;
  passed: boolean;
  passingScore: number;
  attemptsRemaining: number;
  canRetry: boolean;
}

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

  const loadAssessment = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      setAttempt(null);
      setAnswers({});
      setAttemptBlockMessage(null);
      setCompletedAttemptCount(0);
      setLatestResult(null);

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
      const activeAttempt = attempts.find((candidate) => !candidate.submittedAt) || null;
      const completedAttempts = attempts.filter((candidate) => candidate.submittedAt);
      const passedAttempt = completedAttempts.find((candidate) => candidate.passed) || null;
      const latestCompletedAttempt = completedAttempts
        .slice()
        .sort((left, right) => {
          const leftTime = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
          const rightTime = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
          return rightTime - leftTime;
        })[0] || null;
      const attemptsRemaining = Math.max(assessmentData.maxAttempts - completedAttempts.length, 0);

      setCompletedAttemptCount(completedAttempts.length);

      if (latestCompletedAttempt && latestCompletedAttempt.score !== undefined && latestCompletedAttempt.passed !== undefined) {
        setLatestResult({
          score: latestCompletedAttempt.score,
          passed: latestCompletedAttempt.passed,
          passingScore: assessmentData.passingScore,
          attemptsRemaining,
          canRetry:
            !latestCompletedAttempt.passed &&
            completedAttempts.length < assessmentData.maxAttempts,
        });
      }

      if (activeAttempt) {
        setAttempt(activeAttempt);
        setAnswers(activeAttempt.answers || {});
        setTimeSpent(activeAttempt.timeSpent || 0);
        return;
      }

      if (passedAttempt && !assessmentData.allowRetryAfterPassing) {
        setAttemptBlockMessage(
          `You already passed this assessment${passedAttempt.score !== undefined ? ` with ${passedAttempt.score}%` : ""}. Retries after passing are disabled for this module.`,
        );
        return;
      }

      if (completedAttempts.length >= assessmentData.maxAttempts) {
        setAttemptBlockMessage(`You have reached the maximum number of attempts (${assessmentData.maxAttempts}).`);
        return;
      }

      const newAttempt = await assessmentService.startAttempt(
        assessmentData.id,
        enrollmentId,
        user.id
      );
      setAttempt(newAttempt);
      setAnswers(newAttempt.answers || {});
      setTimeSpent(newAttempt.timeSpent || 0);
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

  const handleSubmit = async () => {
    if (!attempt || !assessment) return;

    // Check if all required questions are answered
    const requiredQuestions = questions.filter((q) => q.questionType !== "essay");
    const unanswered = requiredQuestions.filter((q) => !answers[q.id]);

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

      setSubmissionStatus("success");
      const nextCompletedAttemptCount = completedAttemptCount + 1;
      const attemptsRemaining = Math.max(assessment.maxAttempts - nextCompletedAttemptCount, 0);
      setLatestResult({
        score: result.score,
        passed: result.passed,
        passingScore: assessment.passingScore,
        attemptsRemaining,
        canRetry: !result.passed && nextCompletedAttemptCount < assessment.maxAttempts,
      });
      const message = result.passed
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
          <Card className={latestResult.passed ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-amber-500 bg-amber-50 dark:bg-amber-950"}>
            <CardContent className="pt-6">
              <div className={`flex items-center gap-2 ${latestResult.passed ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
                <CheckCircle2 className="w-5 h-5" />
                <p className="text-sm font-medium">
                  {latestResult.passed
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
  const answeredCount = Object.keys(answers).length;
  const showLatestResult = latestResult && submissionStatus !== "error";

  return (
    <div className="space-y-6">
      {showLatestResult && (
        <Card className={latestResult.passed ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-amber-500 bg-amber-50 dark:bg-amber-950"}>
          <CardContent className="pt-6">
            <div className={`flex items-center gap-2 ${latestResult.passed ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
              <CheckCircle2 className="w-5 h-5" />
              <p className="text-sm font-medium">
                {latestResult.passed
                  ? latestResult.attemptsRemaining > 0 && assessment.allowRetryAfterPassing
                    ? `Assessment passed with ${latestResult.score}%. You may retry again if needed.`
                    : `Assessment passed with ${latestResult.score}%.`
                  : latestResult.canRetry
                    ? `Assessment not passed. You scored ${latestResult.score}%. You can retry below.`
                    : `Assessment not passed. You scored ${latestResult.score}%. No retries remain.`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
                Attempts Left: {Math.max(assessment.maxAttempts - completedAttemptCount, 0)}
              </span>
              <span className="text-muted-foreground">
                {assessment.allowRetryAfterPassing ? "Retry after pass: allowed" : "Retry after pass: locked"}
              </span>
              <span className="font-medium">Total Points: {totalPoints}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((question, index) => (
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
                  {question.options.map((option, optIndex) => (
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
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="True" id={`${question.id}-true`} />
                    <Label htmlFor={`${question.id}-true`} className="cursor-pointer flex-1">
                      True
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="False" id={`${question.id}-false`} />
                    <Label htmlFor={`${question.id}-false`} className="cursor-pointer flex-1">
                      False
                    </Label>
                  </div>
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
                <Textarea
                  value={answers[question.id] || ""}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  placeholder="Enter your detailed answer"
                  rows={6}
                />
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
                  Submit Assessment
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

