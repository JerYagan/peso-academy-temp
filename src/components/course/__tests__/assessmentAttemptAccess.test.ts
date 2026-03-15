import { describe, expect, it } from "vitest";
import { deriveAssessmentAttemptAccess } from "@/components/course/assessmentAttemptAccess";
import type { Assessment, AssessmentAttempt, AssessmentQuestion } from "@/services/assessmentService";

const assessmentFixture: Assessment = {
  id: "assessment-1",
  moduleId: "module-1",
  title: "Assessment",
  description: "",
  timeLimit: 30,
  passingScore: 70,
  maxAttempts: 3,
  allowRetryAfterPassing: false,
  isActive: true,
  skillTags: [],
  topicTags: [],
  createdAt: "2026-03-13T00:00:00.000Z",
  updatedAt: "2026-03-13T00:00:00.000Z",
};

const essayQuestionsFixture: AssessmentQuestion[] = [
  {
    id: "question-1",
    assessmentId: "assessment-1",
    question: "Explain your answer",
    questionType: "essay",
    points: 10,
    order: 1,
  },
];

const quizQuestionsFixture: AssessmentQuestion[] = [
  {
    id: "question-1",
    assessmentId: "assessment-1",
    question: "Pick one",
    questionType: "multiple_choice",
    options: ["A", "B"],
    correctAnswer: "A",
    points: 5,
    order: 1,
  },
];

const createAttempt = (overrides: Partial<AssessmentAttempt>): AssessmentAttempt => ({
  id: overrides.id || "attempt-1",
  assessmentId: "assessment-1",
  enrollmentId: "enrollment-1",
  userId: "user-1",
  startedAt: "2026-03-13T00:00:00.000Z",
  answers: {},
  ...overrides,
});

describe("deriveAssessmentAttemptAccess", () => {
  it("blocks new attempts while manual review is still pending", () => {
    const access = deriveAssessmentAttemptAccess(assessmentFixture, essayQuestionsFixture, [
      createAttempt({
        submittedAt: "2026-03-13T00:05:00.000Z",
        reviewStatus: "submitted",
        requiresManualReview: true,
      }),
    ]);

    expect(access.shouldStartNewAttempt).toBe(false);
    expect(access.attemptBlockMessage).toContain("waiting for trainer review");
  });

  it("blocks new attempts for auto-scored submissions until approval is finished", () => {
    const access = deriveAssessmentAttemptAccess(assessmentFixture, quizQuestionsFixture, [
      createAttempt({
        submittedAt: "2026-03-13T00:05:00.000Z",
        reviewStatus: "submitted",
        requiresManualReview: true,
        score: 100,
      }),
    ]);

    expect(access.shouldStartNewAttempt).toBe(false);
    expect(access.attemptBlockMessage).toContain("waiting for trainer review");
  });

  it("creates a seeded revision attempt when trainer requests changes", () => {
    const previousAnswers = {
      "question-1": "Original draft answer",
    };

    const access = deriveAssessmentAttemptAccess(assessmentFixture, essayQuestionsFixture, [
      createAttempt({
        submittedAt: "2026-03-13T00:05:00.000Z",
        reviewStatus: "needs_revision",
        requiresManualReview: true,
        reviewFeedback: "Add more detail",
        answers: previousAnswers,
      }),
    ]);

    expect(access.shouldStartNewAttempt).toBe(true);
    expect(access.isRevisionAttempt).toBe(true);
    expect(access.seedAnswers).toEqual(previousAnswers);
    expect(access.attemptBlockMessage).toBeNull();
  });

  it("still blocks retries after a passing score when retries are disabled", () => {
    const access = deriveAssessmentAttemptAccess(assessmentFixture, quizQuestionsFixture, [
      createAttempt({
        submittedAt: "2026-03-13T00:05:00.000Z",
        reviewStatus: "approved",
        requiresManualReview: true,
        passed: true,
        score: 92,
      }),
    ]);

    expect(access.shouldStartNewAttempt).toBe(false);
    expect(access.isRevisionAttempt).toBe(false);
    expect(access.attemptBlockMessage).toContain("already passed this assessment");
  });
});