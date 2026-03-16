import type { PracticeQuizCompletionSummary } from "@/types";
import type { ContentBlock } from "@/lib/contentBlocks";

export type PracticeQuizComputedSummary = Omit<PracticeQuizCompletionSummary, "updatedAt">;

export const finalizeObjectivePracticeQuizAnswers = (
  objectivePracticeQuizBlocks: ContentBlock[],
  selections: Record<string, string>,
  submittedAnswers: Record<string, string>,
) => {
  const objectiveBlockIds = new Set(
    objectivePracticeQuizBlocks
      .map((block) => block.id)
      .filter((blockId): blockId is string => Boolean(blockId)),
  );

  const finalizedAnswers = Object.fromEntries(
    Object.entries(submittedAnswers).filter(([blockId]) => objectiveBlockIds.has(blockId)),
  ) as Record<string, string>;

  for (const block of objectivePracticeQuizBlocks) {
    if (!block.id || finalizedAnswers[block.id] !== undefined) {
      continue;
    }

    const selectedAnswer = selections[block.id];
    if (typeof selectedAnswer === "string" && selectedAnswer.length > 0) {
      finalizedAnswers[block.id] = selectedAnswer;
    }
  }

  return finalizedAnswers;
};

export const calculatePracticeQuizSummary = (
  practiceQuizBlocks: ContentBlock[],
  selections: Record<string, string>,
  submittedAnswers: Record<string, string>,
): PracticeQuizComputedSummary => {
  let totalQuestions = 0;
  let scoredQuestions = 0;
  let submittedQuestions = 0;
  let correctQuestions = 0;
  let totalPoints = 0;
  let earnedPoints = 0;
  let essayQuestionCount = 0;
  let essayAnsweredCount = 0;

  for (const block of practiceQuizBlocks) {
    if (!block.id) {
      continue;
    }

    totalQuestions += 1;

    const points = Math.max(1, Number(block.points) || 1);
    const isEssayQuestion = block.questionType === "essay";

    if (isEssayQuestion) {
      essayQuestionCount += 1;
      if ((selections[block.id] || "").trim()) {
        essayAnsweredCount += 1;
      }
      continue;
    }

    scoredQuestions += 1;
    totalPoints += points;

    const submittedAnswer = submittedAnswers[block.id];
    if (submittedAnswer === undefined) {
      continue;
    }

    submittedQuestions += 1;
    if (submittedAnswer === block.correctAnswer?.toString()) {
      correctQuestions += 1;
      earnedPoints += points;
    }
  }

  return {
    totalQuestions,
    scoredQuestions,
    submittedQuestions,
    correctQuestions,
    totalPoints,
    earnedPoints,
    percentageScore: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : null,
    essayQuestionCount,
    essayAnsweredCount,
  };
};