import type { Assessment, AssessmentAttempt, AssessmentQuestion } from "@/services/assessmentService";

export interface AssessmentAttemptAccess {
  activeAttempt: AssessmentAttempt | null;
  latestCompletedAttempt: AssessmentAttempt | null;
  completedAttempts: AssessmentAttempt[];
  effectiveMaxAttempts: number;
  attemptsRemaining: number;
  shouldStartNewAttempt: boolean;
  isRevisionAttempt: boolean;
  seedAnswers: Record<string, string>;
  attemptBlockMessage: string | null;
}

export const hasEssayQuestions = (questions: AssessmentQuestion[]) =>
  questions.some((question) => question.questionType === "essay");

export const deriveAssessmentAttemptAccess = (
  assessment: Assessment,
  questions: AssessmentQuestion[],
  attempts: AssessmentAttempt[],
): AssessmentAttemptAccess => {
  const hasFinalApproval = (candidate: AssessmentAttempt | null | undefined) =>
    candidate?.reviewStatus === "approved" && Boolean(candidate.reviewedAt || candidate.reviewedBy);

  const activeAttempt = attempts.find((candidate) => !candidate.submittedAt) || null;
  const completedAttempts = attempts.filter((candidate) => candidate.submittedAt);
  const passedAttempt = completedAttempts.find((candidate) => hasFinalApproval(candidate) && candidate.passed) || null;
  const latestCompletedAttempt = completedAttempts
    .slice()
    .sort((left, right) => {
      const leftTime = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
      const rightTime = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
      return rightTime - leftTime;
    })[0] || null;
  const effectiveMaxAttempts = hasEssayQuestions(questions) ? 1 : assessment.maxAttempts;
  const attemptsRemaining = Math.max(effectiveMaxAttempts - completedAttempts.length, 0);
  const isRevisionAttempt = latestCompletedAttempt?.reviewStatus === "needs_revision";

  if (activeAttempt) {
    return {
      activeAttempt,
      latestCompletedAttempt,
      completedAttempts,
      effectiveMaxAttempts,
      attemptsRemaining,
      shouldStartNewAttempt: false,
      isRevisionAttempt,
      seedAnswers: activeAttempt.answers || {},
      attemptBlockMessage: null,
    };
  }

  if (
    latestCompletedAttempt &&
    !hasFinalApproval(latestCompletedAttempt) &&
    latestCompletedAttempt.reviewStatus !== "needs_revision"
  ) {
    return {
      activeAttempt: null,
      latestCompletedAttempt,
      completedAttempts,
      effectiveMaxAttempts,
      attemptsRemaining,
      shouldStartNewAttempt: false,
      isRevisionAttempt: false,
      seedAnswers: {},
      attemptBlockMessage: "Your latest assessment submission is waiting for trainer review before another attempt can start.",
    };
  }

  if (isRevisionAttempt) {
    return {
      activeAttempt: null,
      latestCompletedAttempt,
      completedAttempts,
      effectiveMaxAttempts,
      attemptsRemaining,
      shouldStartNewAttempt: true,
      isRevisionAttempt: true,
      seedAnswers: latestCompletedAttempt?.answers || {},
      attemptBlockMessage: null,
    };
  }

  if (passedAttempt && !assessment.allowRetryAfterPassing) {
    return {
      activeAttempt: null,
      latestCompletedAttempt,
      completedAttempts,
      effectiveMaxAttempts,
      attemptsRemaining,
      shouldStartNewAttempt: false,
      isRevisionAttempt: false,
      seedAnswers: {},
      attemptBlockMessage: `You already passed this assessment${passedAttempt.score !== undefined ? ` with ${passedAttempt.score}%` : ""}. Retries after passing are disabled for this module.`,
    };
  }

  if (completedAttempts.length >= effectiveMaxAttempts) {
    return {
      activeAttempt: null,
      latestCompletedAttempt,
      completedAttempts,
      effectiveMaxAttempts,
      attemptsRemaining,
      shouldStartNewAttempt: false,
      isRevisionAttempt: false,
      seedAnswers: {},
      attemptBlockMessage: hasEssayQuestions(questions)
        ? "Essay assessments allow one learner submission per attempt cycle. A trainer can still keep a higher configured attempt limit for later workflow handling."
        : `You have reached the maximum number of attempts (${assessment.maxAttempts}).`,
    };
  }

  return {
    activeAttempt: null,
    latestCompletedAttempt,
    completedAttempts,
    effectiveMaxAttempts,
    attemptsRemaining,
    shouldStartNewAttempt: true,
    isRevisionAttempt: false,
    seedAnswers: {},
    attemptBlockMessage: null,
  };
};