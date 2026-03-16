import { getQuizBlocks, parseModuleContentBlocks, type ContentBlock } from "@/lib/contentBlocks";
import type { PracticeQuizSessionSummary } from "@/services/moduleSessionService";
import type { Module, PracticeQuizEssayResponse } from "@/types";

export type PracticeQuizEssayQuestionMeta = {
  blockId: string;
  title: string;
  promptText: string;
  points: number;
  order: number;
};

export type PracticeQuizModuleReviewSummary = {
  objectiveQuestionCount: number;
  objectiveTotalPoints: number;
  objectiveEarnedPoints: number | null;
  objectiveSubmittedQuestions: number;
  objectiveCorrectQuestions: number;
  objectivePercentageScore: number | null;
  essayQuestionCount: number;
  essayAnsweredCount: number;
  essayReviewedCount: number;
  essayTotalPoints: number;
  essayAwardedPoints: number;
  pendingEssayReviewCount: number;
  combinedTotalPoints: number;
  combinedEarnedPoints: number | null;
  combinedPercentageScore: number | null;
};

const getEssayQuizBlocks = (module: Module): ContentBlock[] => {
  return getQuizBlocks(parseModuleContentBlocks(module.content)).filter((block) => block.questionType === "essay");
};

const getObjectiveQuizBlocks = (module: Module): ContentBlock[] => {
  return getQuizBlocks(parseModuleContentBlocks(module.content)).filter((block) => block.questionType !== "essay");
};

const toQuestionMeta = (block: ContentBlock, index: number): PracticeQuizEssayQuestionMeta => ({
  blockId: block.id,
  title: block.title?.trim() || `Essay Question ${index + 1}`,
  promptText: block.content.trim(),
  points: Math.max(1, Number(block.points) || 1),
  order: index,
});

const buildEssayQuestionCandidates = (block: ContentBlock, index: number) => {
  const meta = toQuestionMeta(block, index);
  return [block.id, block.sourceQuestionKey].filter((value): value is string => Boolean(value)).map((candidate) => [candidate, meta] as const);
};

export const getPracticeQuizEssayQuestionMetaMap = (module: Module) => {
  const questionMap = new Map<string, PracticeQuizEssayQuestionMeta>();

  getEssayQuizBlocks(module).forEach((block, index) => {
    buildEssayQuestionCandidates(block, index).forEach(([candidate, meta]) => {
      questionMap.set(candidate, meta);
    });
  });

  return questionMap;
};

export const getPracticeQuizEssayQuestions = (module: Module): PracticeQuizEssayQuestionMeta[] => {
  return getEssayQuizBlocks(module).map((block, index) => toQuestionMeta(block, index));
};

export const getPracticeQuizEssayQuestionMetaForResponse = (
  module: Module,
  response: Pick<PracticeQuizEssayResponse, "block_id" | "prompt_title" | "prompt_text">,
): PracticeQuizEssayQuestionMeta => {
  const questionMap = getPracticeQuizEssayQuestionMetaMap(module);
  const matched = questionMap.get(response.block_id);

  if (matched) {
    return matched;
  }

  return {
    blockId: response.block_id,
    title: response.prompt_title?.trim() || "Essay Question",
    promptText: response.prompt_text,
    points: 1,
    order: Number.MAX_SAFE_INTEGER,
  };
};

export const getPracticeQuizModuleReviewSummary = (options: {
  module: Module;
  responses: PracticeQuizEssayResponse[];
  latestPracticeQuizSummary?: PracticeQuizSessionSummary | null;
}): PracticeQuizModuleReviewSummary => {
  const objectiveQuizBlocks = getObjectiveQuizBlocks(options.module);
  const essayQuizBlocks = getEssayQuizBlocks(options.module);
  const questionMap = getPracticeQuizEssayQuestionMetaMap(options.module);
  const objectiveTotalPoints = objectiveQuizBlocks.reduce((sum, block) => sum + Math.max(1, Number(block.points) || 1), 0);
  const essayTotalPoints = essayQuizBlocks.reduce((sum, block) => sum + Math.max(1, Number(block.points) || 1), 0);
  const essayAnsweredCount = options.responses.filter((response) => response.response_text.trim().length > 0).length;
  const essayReviewedCount = options.responses.filter((response) => Number.isFinite(response.review_score_points)).length;
  const essayAwardedPoints = options.responses.reduce((sum, response) => {
    const maxPoints = questionMap.get(response.block_id)?.points ?? 1;
    const rawScore = Number(response.review_score_points);

    if (!Number.isFinite(rawScore)) {
      return sum;
    }

    return sum + Math.max(0, Math.min(maxPoints, rawScore));
  }, 0);
  const combinedTotalPoints = objectiveTotalPoints + essayTotalPoints;
  const objectiveEarnedPoints = options.latestPracticeQuizSummary?.earnedPoints ?? null;
  const combinedEarnedPoints = objectiveEarnedPoints === null ? null : objectiveEarnedPoints + essayAwardedPoints;

  return {
    objectiveQuestionCount: objectiveQuizBlocks.length,
    objectiveTotalPoints,
    objectiveEarnedPoints,
    objectiveSubmittedQuestions: options.latestPracticeQuizSummary?.submittedQuestions || 0,
    objectiveCorrectQuestions: options.latestPracticeQuizSummary?.correctQuestions || 0,
    objectivePercentageScore: options.latestPracticeQuizSummary?.percentageScore ?? null,
    essayQuestionCount: essayQuizBlocks.length,
    essayAnsweredCount,
    essayReviewedCount,
    essayTotalPoints,
    essayAwardedPoints,
    pendingEssayReviewCount: Math.max(0, essayAnsweredCount - essayReviewedCount),
    combinedTotalPoints,
    combinedEarnedPoints,
    combinedPercentageScore:
      combinedEarnedPoints !== null && combinedTotalPoints > 0
        ? Math.round((combinedEarnedPoints / combinedTotalPoints) * 100)
        : null,
  };
};