import { describe, expect, it } from "vitest";

import type { ContentBlock } from "@/lib/contentBlocks";
import { calculatePracticeQuizSummary, finalizeObjectivePracticeQuizAnswers } from "@/lib/practiceQuizProgress";

const practiceQuizBlocks: ContentBlock[] = [
  {
    id: "mc-1",
    type: "quiz",
    content: "Question 1",
    questionType: "multiple_choice",
    options: ["A", "B"],
    correctAnswer: 1,
    points: 2,
  },
  {
    id: "tf-1",
    type: "quiz",
    content: "Question 2",
    questionType: "true_false",
    options: ["True", "False"],
    correctAnswer: 0,
    points: 3,
  },
  {
    id: "essay-1",
    type: "quiz",
    content: "Reflect",
    questionType: "essay",
    points: 5,
  },
];

describe("practiceQuizProgress", () => {
  it("finalizes pending objective selections when completion is triggered", () => {
    expect(
      finalizeObjectivePracticeQuizAnswers(
        practiceQuizBlocks.filter((block) => block.questionType !== "essay"),
        { "mc-1": "1", "tf-1": "0", "essay-1": "Draft" },
        { "mc-1": "1" },
      ),
    ).toEqual({ "mc-1": "1", "tf-1": "0" });
  });

  it("scores only objective answers and excludes essays from automatic scoring", () => {
    expect(
      calculatePracticeQuizSummary(
        practiceQuizBlocks,
        { "mc-1": "1", "tf-1": "0", "essay-1": "Reflection draft" },
        { "mc-1": "1", "tf-1": "0" },
      ),
    ).toEqual({
      totalQuestions: 3,
      scoredQuestions: 2,
      submittedQuestions: 2,
      correctQuestions: 2,
      totalPoints: 5,
      earnedPoints: 5,
      percentageScore: 100,
      essayQuestionCount: 1,
      essayAnsweredCount: 1,
    });
  });
});