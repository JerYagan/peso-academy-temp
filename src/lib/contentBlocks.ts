export type ContentBlockType = "text" | "code" | "video" | "image" | "quiz" | "document" | "learning_material";

export type QuizBlockQuestionType = "multiple_choice" | "true_false" | "essay";

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  content: string;
  language?: string;
  title?: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  videoUrl?: string;
  imageUrl?: string;
  altText?: string;
  caption?: string;
  documentUrl?: string;
  materialUrl?: string;
  questionType?: QuizBlockQuestionType;
  points?: number;
  sourceQuestionKey?: string;
  isGradable?: boolean;
}

export interface QuizAssessmentValidationIssue {
  blockId: string;
  blockLabel: string;
  message: string;
}

export interface QuizAssessmentSummary {
  quizBlockCount: number;
  gradableQuizBlockCount: number;
  totalPoints: number;
  questionTypeCounts: Record<QuizBlockQuestionType, number>;
  invalidIssues: QuizAssessmentValidationIssue[];
  readyForAssessment: boolean;
}

export interface ImportedAssessmentQuestionDraft {
  question: string;
  questionType: QuizBlockQuestionType;
  options?: string[];
  correctAnswer?: string;
  points: number;
  explanation?: string;
}

const VALID_CONTENT_BLOCK_TYPES = new Set<ContentBlockType>([
  "text",
  "code",
  "video",
  "image",
  "quiz",
  "document",
  "learning_material",
]);

export const DEFAULT_QUIZ_BLOCK_POINTS = 1;
export const DEFAULT_QUIZ_BLOCK_QUESTION_TYPE: QuizBlockQuestionType = "multiple_choice";
export const TRUE_FALSE_QUIZ_OPTIONS = ["True", "False"];

const normalizeContentBlockType = (type: unknown): ContentBlockType => {
  return typeof type === "string" && VALID_CONTENT_BLOCK_TYPES.has(type as ContentBlockType)
    ? (type as ContentBlockType)
    : "text";
};

const normalizeQuizQuestionType = (block: Partial<ContentBlock>): QuizBlockQuestionType => {
  if (block.questionType === "multiple_choice" || block.questionType === "true_false" || block.questionType === "essay") {
    return block.questionType;
  }

  const normalizedOptions = (block.options || []).map((option) => option.trim().toLowerCase());
  return normalizedOptions.length === 2 && normalizedOptions[0] === "true" && normalizedOptions[1] === "false"
    ? "true_false"
    : DEFAULT_QUIZ_BLOCK_QUESTION_TYPE;
};

const normalizeQuizOptions = (options: unknown, questionType: QuizBlockQuestionType): string[] => {
  if (questionType === "essay") {
    return [];
  }

  if (questionType === "true_false") {
    return [...TRUE_FALSE_QUIZ_OPTIONS];
  }

  const normalized = Array.isArray(options)
    ? options.map((option) => (typeof option === "string" ? option : String(option ?? "")))
    : [];

  if (normalized.length >= 2) {
    return normalized;
  }

  return [...normalized, ...Array.from({ length: 2 - normalized.length }, () => "")];
};

const normalizeCorrectAnswer = (correctAnswer: unknown, optionCount: number): number | undefined => {
  const numericValue = typeof correctAnswer === "number"
    ? correctAnswer
    : typeof correctAnswer === "string" && correctAnswer.trim() !== ""
      ? Number.parseInt(correctAnswer, 10)
      : Number.NaN;

  if (!Number.isInteger(numericValue)) {
    return undefined;
  }

  if (numericValue < 0 || numericValue >= optionCount) {
    return undefined;
  }

  return numericValue;
};

export const createDefaultContentBlock = (type: ContentBlockType, id: string): ContentBlock => {
  const base: ContentBlock = {
    id,
    type,
    content: "",
  };

  switch (type) {
    case "code":
      return { ...base, language: "javascript" };
    case "video":
      return { ...base, videoUrl: "" };
    case "quiz":
      return {
        ...base,
        title: "",
        options: ["", ""],
        correctAnswer: 0,
        questionType: DEFAULT_QUIZ_BLOCK_QUESTION_TYPE,
        points: DEFAULT_QUIZ_BLOCK_POINTS,
        sourceQuestionKey: id,
        isGradable: false,
      };
    default:
      return base;
  }
};

export const normalizeContentBlock = (block: Partial<ContentBlock>, index = 0): ContentBlock => {
  const type = normalizeContentBlockType(block.type);
  const id = typeof block.id === "string" && block.id.trim() ? block.id : `content-block-${index + 1}`;

  if (type !== "quiz") {
    return {
      ...block,
      id,
      type,
      content: typeof block.content === "string" ? block.content : "",
    } as ContentBlock;
  }

  const questionType = normalizeQuizQuestionType(block);
  const options = normalizeQuizOptions(block.options, questionType);
  const normalizedCorrectAnswer = questionType === "essay"
    ? undefined
    : normalizeCorrectAnswer(block.correctAnswer, options.length);
  const parsedPoints = typeof block.points === "number" ? block.points : Number(block.points);

  return {
    ...block,
    id,
    type,
    content: typeof block.content === "string" ? block.content : "",
    title: typeof block.title === "string" ? block.title : "",
    options,
    correctAnswer: normalizedCorrectAnswer,
    questionType,
    points: Number.isFinite(parsedPoints) && parsedPoints > 0 ? parsedPoints : DEFAULT_QUIZ_BLOCK_POINTS,
    sourceQuestionKey:
      typeof block.sourceQuestionKey === "string" && block.sourceQuestionKey.trim().length > 0
        ? block.sourceQuestionKey
        : id,
    isGradable: block.isGradable ?? true,
  };
};

export const normalizeContentBlocks = (blocks: unknown): ContentBlock[] => {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks.map((block, index) => normalizeContentBlock((block || {}) as Partial<ContentBlock>, index));
};

export const parseModuleContentBlocks = (content?: string | null): ContentBlock[] => {
  if (!content) {
    return [];
  }

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return normalizeContentBlocks(parsed);
    }
  } catch {
    return [
      {
        id: "content-block-1",
        type: "text",
        content,
      },
    ];
  }

  return [];
};

export const getQuizBlocks = (blocks: ContentBlock[]): ContentBlock[] => {
  return blocks.filter((block) => block.type === "quiz");
};

export const getGradableQuizBlocks = (blocks: ContentBlock[]): ContentBlock[] => {
  return getQuizBlocks(blocks).filter((block) => block.isGradable !== false);
};

export const validateQuizAssessmentBlocks = (blocks: ContentBlock[]): QuizAssessmentValidationIssue[] => {
  return getGradableQuizBlocks(blocks).flatMap((block, index) => {
    const issues: QuizAssessmentValidationIssue[] = [];
    const blockLabel = block.title?.trim() || `Quiz Block ${index + 1}`;
    const trimmedOptions = (block.options || []).map((option) => option.trim());

    if (!block.content.trim()) {
      issues.push({ blockId: block.id, blockLabel, message: "Question text is required." });
    }

    if (!Number.isFinite(block.points) || (block.points || 0) <= 0) {
      issues.push({ blockId: block.id, blockLabel, message: "Points must be greater than 0." });
    }

    if (block.questionType === "essay") {
      return issues;
    }

    if (block.questionType === "true_false") {
      if (trimmedOptions.length !== 2) {
        issues.push({ blockId: block.id, blockLabel, message: "True/false questions must have exactly two options." });
      }
    } else if (trimmedOptions.filter(Boolean).length < 2) {
      issues.push({ blockId: block.id, blockLabel, message: "Multiple-choice questions need at least two non-empty options." });
    }

    if (block.correctAnswer === undefined) {
      issues.push({ blockId: block.id, blockLabel, message: "A correct answer must be selected." });
    } else if (!trimmedOptions[block.correctAnswer]?.trim()) {
      issues.push({ blockId: block.id, blockLabel, message: "The selected correct answer must point to a non-empty option." });
    }

    return issues;
  });
};

export const getQuizAssessmentSummary = (blocks: ContentBlock[]): QuizAssessmentSummary => {
  const quizBlocks = getQuizBlocks(blocks);
  const gradableQuizBlocks = getGradableQuizBlocks(blocks);
  const invalidIssues = validateQuizAssessmentBlocks(blocks);

  return {
    quizBlockCount: quizBlocks.length,
    gradableQuizBlockCount: gradableQuizBlocks.length,
    totalPoints: gradableQuizBlocks.reduce((sum, block) => sum + (block.points || 0), 0),
    questionTypeCounts: {
      multiple_choice: gradableQuizBlocks.filter((block) => block.questionType === "multiple_choice").length,
      true_false: gradableQuizBlocks.filter((block) => block.questionType === "true_false").length,
      essay: gradableQuizBlocks.filter((block) => block.questionType === "essay").length,
    },
    invalidIssues,
    readyForAssessment: gradableQuizBlocks.length > 0 && invalidIssues.length === 0,
  };
};

export const importPracticeQuizQuestions = (blocks: ContentBlock[]): ImportedAssessmentQuestionDraft[] => {
  return getQuizBlocks(blocks)
    .filter((block) => block.content.trim())
    .map((block) => {
      const options = block.questionType === "essay"
        ? undefined
        : block.questionType === "true_false"
          ? [...TRUE_FALSE_QUIZ_OPTIONS]
          : (block.options || []).map((option) => option.trim()).filter(Boolean);
      const correctAnswer =
        options && block.correctAnswer !== undefined && options[block.correctAnswer] !== undefined
          ? options[block.correctAnswer]
          : undefined;

      return {
        question: block.content.trim(),
        questionType: block.questionType || DEFAULT_QUIZ_BLOCK_QUESTION_TYPE,
        options,
        correctAnswer,
        points: Number.isFinite(block.points) && (block.points || 0) > 0 ? Number(block.points) : DEFAULT_QUIZ_BLOCK_POINTS,
        explanation: block.explanation?.trim() || undefined,
      } satisfies ImportedAssessmentQuestionDraft;
    });
};