import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getGradableQuizBlocks,
  parseModuleContentBlocks,
  validateQuizAssessmentBlocks,
  type ContentBlock,
} from "../src/lib/contentBlocks";
import { deriveSkillTags, deriveTopicTags } from "../src/lib/taxonomy";

type AuditClassification =
  | "no_assessment_source"
  | "quiz_blocks_only"
  | "assessment_tables_only"
  | "both_in_sync"
  | "both_mismatched";

type AssessmentQuestionType = "multiple_choice" | "true_false" | "short_answer" | "essay";

type ModuleRow = {
  id: string;
  course_id: string;
  title: string;
  content: string | null;
  skill_tags?: string[] | null;
  topic_tags?: string[] | null;
};

type CourseRow = {
  id: string;
  title: string;
  category: string | null;
};

type AssessmentRow = {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  time_limit: number | null;
  passing_score: number;
  max_attempts: number;
  is_active: boolean;
  skill_tags?: string[] | null;
  topic_tags?: string[] | null;
  derived_from_module_quiz?: boolean | null;
};

type AssessmentQuestionRow = {
  id: string;
  assessment_id: string;
  question: string;
  question_type: AssessmentQuestionType;
  options: string[] | string | null;
  correct_answer: string | null;
  points: number;
  order: number;
  explanation: string | null;
  source_question_key?: string | null;
  is_active?: boolean | null;
  derived_from_module_quiz?: boolean | null;
};

type ComparableQuestion = {
  sourceQuestionKey: string;
  question: string;
  questionType: AssessmentQuestionType;
  options: string[];
  correctAnswer: string | null;
  points: number;
  order: number;
  explanation: string | null;
};

type AuditRecord = {
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  courseCategory: string | null;
  classification: AuditClassification;
  quizBlockCount: number;
  gradableQuizBlockCount: number;
  activeAssessmentQuestionCount: number;
  assessmentId: string | null;
  derivedAssessment: boolean;
  invalidQuizIssues: string[];
  backfillEligible: boolean;
  mismatchReasons: string[];
  actionTaken?: string;
};

type AuditSummary = {
  totalModules: number;
  counts: Record<AuditClassification, number>;
  backfillEligibleCount: number;
  backfilledCount: number;
  mismatchedCount: number;
};

const DEFAULT_REPORT_PATH = path.join(process.cwd(), "temp_markdowns", "derived_assessment_audit_report.md");

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const normalizeQuestionOptions = (options: AssessmentQuestionRow["options"]): string[] => {
  if (!options) {
    return [];
  }

  if (Array.isArray(options)) {
    return options.map((option) => (typeof option === "string" ? option : String(option ?? "")));
  }

  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed.map((option) => String(option ?? "")) : [];
  } catch {
    return [];
  }
};

const normalizeStoredCorrectAnswer = (correctAnswer: string | null | undefined, options: string[]): string | null => {
  if (!correctAnswer) {
    return null;
  }

  const trimmed = correctAnswer.trim();
  if (!trimmed) {
    return null;
  }

  const numericValue = Number.parseInt(trimmed, 10);
  if (String(numericValue) === trimmed && Number.isInteger(numericValue) && options[numericValue] !== undefined) {
    return options[numericValue];
  }

  return trimmed;
};

const toDerivedQuestionPayload = (block: ContentBlock, index: number): ComparableQuestion => {
  const options = block.options || [];
  return {
    sourceQuestionKey: block.sourceQuestionKey || block.id,
    question: block.content.trim(),
    questionType: block.questionType === "true_false" ? "true_false" : "multiple_choice",
    options,
    correctAnswer: block.correctAnswer !== undefined && options[block.correctAnswer] !== undefined ? options[block.correctAnswer] : null,
    points: block.points || 1,
    order: index + 1,
    explanation: block.explanation?.trim() || null,
  };
};

const toComparableQuestion = (row: AssessmentQuestionRow): ComparableQuestion => {
  const options = normalizeQuestionOptions(row.options);
  return {
    sourceQuestionKey: row.source_question_key || row.id,
    question: row.question.trim(),
    questionType: row.question_type,
    options,
    correctAnswer: normalizeStoredCorrectAnswer(row.correct_answer, options),
    points: row.points || 1,
    order: row.order,
    explanation: row.explanation?.trim() || null,
  };
};

const compareQuestionSets = (
  expected: ComparableQuestion[],
  actual: ComparableQuestion[],
): { inSync: boolean; reasons: string[] } => {
  const reasons: string[] = [];

  if (expected.length !== actual.length) {
    reasons.push(`Question count differs: expected ${expected.length}, found ${actual.length}.`);
  }

  const maxLength = Math.max(expected.length, actual.length);
  for (let index = 0; index < maxLength; index += 1) {
    const expectedQuestion = expected[index];
    const actualQuestion = actual[index];

    if (!expectedQuestion || !actualQuestion) {
      continue;
    }

    if (expectedQuestion.sourceQuestionKey !== actualQuestion.sourceQuestionKey) {
      reasons.push(`Question ${index + 1} source key differs.`);
    }
    if (expectedQuestion.order !== actualQuestion.order) {
      reasons.push(`Question ${index + 1} order differs.`);
    }
    if (expectedQuestion.question !== actualQuestion.question) {
      reasons.push(`Question ${index + 1} text differs.`);
    }
    if (expectedQuestion.questionType !== actualQuestion.questionType) {
      reasons.push(`Question ${index + 1} type differs.`);
    }
    if (expectedQuestion.points !== actualQuestion.points) {
      reasons.push(`Question ${index + 1} points differ.`);
    }
    if (expectedQuestion.correctAnswer !== actualQuestion.correctAnswer) {
      reasons.push(`Question ${index + 1} correct answer differs.`);
    }
    if (JSON.stringify(expectedQuestion.options) !== JSON.stringify(actualQuestion.options)) {
      reasons.push(`Question ${index + 1} options differ.`);
    }
  }

  return {
    inSync: reasons.length === 0,
    reasons: Array.from(new Set(reasons)),
  };
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const shouldApplyBackfill = args.includes("--apply-backfill");
  const reportFlagIndex = args.findIndex((arg) => arg === "--report");
  const reportPath = reportFlagIndex >= 0 && args[reportFlagIndex + 1]
    ? path.resolve(process.cwd(), args[reportFlagIndex + 1])
    : DEFAULT_REPORT_PATH;

  return {
    shouldApplyBackfill,
    reportPath,
  };
};

const fetchAllRows = async <T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
): Promise<T[]> => {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) {
    throw error;
  }
  return (data || []) as T[];
};

const syncModuleAssessment = async (
  supabase: SupabaseClient,
  moduleRow: ModuleRow,
  courseRow: CourseRow | undefined,
  blocks: ContentBlock[],
  existingAssessment: AssessmentRow | null,
) => {
  const gradableQuizBlocks = getGradableQuizBlocks(blocks);
  if (gradableQuizBlocks.length === 0) {
    return null;
  }

  const canonicalSkillTags = deriveSkillTags(courseRow?.category, moduleRow.skill_tags || existingAssessment?.skill_tags || []);
  const canonicalTopicTags = deriveTopicTags(
    courseRow?.category,
    canonicalSkillTags,
    moduleRow.topic_tags || existingAssessment?.topic_tags || [],
  );

  const assessmentPayload = {
    title: existingAssessment?.title?.trim() || `${moduleRow.title.trim() || "Module"} Assessment`,
    description: existingAssessment?.description || null,
    time_limit: existingAssessment?.time_limit || null,
    passing_score: existingAssessment?.passing_score ?? 70,
    max_attempts: existingAssessment?.max_attempts ?? 3,
    is_active: existingAssessment?.is_active ?? true,
    derived_from_module_quiz: true,
    skill_tags: canonicalSkillTags,
    topic_tags: canonicalTopicTags,
    updated_at: new Date().toISOString(),
  };

  let assessmentRow = existingAssessment;

  if (!assessmentRow) {
    const { data, error } = await supabase
      .from("assessments")
      .insert({
        module_id: moduleRow.id,
        created_at: new Date().toISOString(),
        ...assessmentPayload,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    assessmentRow = data as AssessmentRow;
  } else {
    const { data, error } = await supabase
      .from("assessments")
      .update(assessmentPayload)
      .eq("id", assessmentRow.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    assessmentRow = data as AssessmentRow;
  }

  const { data: existingQuestions, error: questionLookupError } = await supabase
    .from("assessment_questions")
    .select("*")
    .eq("assessment_id", assessmentRow.id)
    .order("order", { ascending: true });

  if (questionLookupError) {
    throw questionLookupError;
  }

  const existingRows = (existingQuestions || []) as AssessmentQuestionRow[];
  const fallbackRows = [...existingRows.filter((row) => !row.source_question_key && row.is_active !== false)];
  const matchedIds = new Set<string>();

  for (const [index, block] of gradableQuizBlocks.entries()) {
    const payload = toDerivedQuestionPayload(block, index);
    let matchedRow = existingRows.find((row) => row.source_question_key === payload.sourceQuestionKey);

    if (!matchedRow) {
      matchedRow = fallbackRows.find((row) => row.order === payload.order) || fallbackRows.shift();
    }

    const questionPayload = {
      question: payload.question,
      question_type: payload.questionType,
      options: JSON.stringify(payload.options),
      correct_answer: payload.correctAnswer,
      points: payload.points,
      order: payload.order,
      explanation: payload.explanation,
      source_question_key: payload.sourceQuestionKey,
      derived_from_module_quiz: true,
      is_active: true,
    };

    if (matchedRow) {
      matchedIds.add(matchedRow.id);
      const { error } = await supabase
        .from("assessment_questions")
        .update(questionPayload)
        .eq("id", matchedRow.id);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("assessment_questions")
        .insert({
          assessment_id: assessmentRow.id,
          created_at: new Date().toISOString(),
          ...questionPayload,
        });

      if (error) {
        throw error;
      }
    }
  }

  const staleQuestionIds = existingRows
    .filter((row) => row.is_active !== false && !matchedIds.has(row.id))
    .map((row) => row.id);

  if (staleQuestionIds.length > 0) {
    const { error } = await supabase
      .from("assessment_questions")
      .update({ is_active: false })
      .in("id", staleQuestionIds);

    if (error) {
      throw error;
    }
  }

  return assessmentRow.id;
};

const buildReport = (summary: AuditSummary, records: AuditRecord[]) => {
  const timestamp = new Date().toISOString();
  const cleanupModules = records.filter(
    (record) => record.classification === "assessment_tables_only" || record.classification === "both_mismatched",
  );
  const backfillModules = records.filter((record) => record.backfillEligible);

  return [
    "# Derived Assessment Audit Report",
    "",
    `Generated: ${timestamp}`,
    "",
    "## Summary",
    "",
    `- Total modules scanned: ${summary.totalModules}`,
    `- Quiz blocks only: ${summary.counts.quiz_blocks_only}`,
    `- Assessment tables only: ${summary.counts.assessment_tables_only}`,
    `- Both in sync: ${summary.counts.both_in_sync}`,
    `- Both mismatched: ${summary.counts.both_mismatched}`,
    `- No assessment source: ${summary.counts.no_assessment_source}`,
    `- Backfill eligible: ${summary.backfillEligibleCount}`,
    `- Backfilled in this run: ${summary.backfilledCount}`,
    "",
    "## Backfill Candidates",
    "",
    ...(backfillModules.length > 0
      ? backfillModules.flatMap((record) => [
          `### ${record.courseTitle} / ${record.moduleTitle}`,
          `- Module ID: ${record.moduleId}`,
          `- Quiz blocks: ${record.gradableQuizBlockCount}`,
          `- Assessment ID: ${record.assessmentId || "none"}`,
          `- Action: ${record.actionTaken || "Audit only"}`,
          ...(record.invalidQuizIssues.length > 0 ? [`- Validation issues: ${record.invalidQuizIssues.join("; ")}`] : []),
          "",
        ])
      : ["No safe quiz-block-only modules were found for automatic backfill.", ""]),
    "## Cleanup Report",
    "",
    ...(cleanupModules.length > 0
      ? cleanupModules.flatMap((record) => [
          `### ${record.courseTitle} / ${record.moduleTitle}`,
          `- Classification: ${record.classification}`,
          `- Module ID: ${record.moduleId}`,
          `- Assessment ID: ${record.assessmentId || "none"}`,
          `- Derived assessment: ${record.derivedAssessment ? "yes" : "no"}`,
          `- Quiz blocks: ${record.gradableQuizBlockCount}`,
          `- Assessment questions: ${record.activeAssessmentQuestionCount}`,
          ...(record.mismatchReasons.length > 0 ? [`- Reasons: ${record.mismatchReasons.join("; ")}`] : []),
          ...(record.invalidQuizIssues.length > 0 ? [`- Quiz validation issues: ${record.invalidQuizIssues.join("; ")}`] : []),
          "",
        ])
      : ["No mismatches or assessment-table-only modules were found.", ""]),
  ].join("\n");
};

const main = async () => {
  const { shouldApplyBackfill, reportPath } = parseArgs();
  const supabase = getSupabaseAdmin();

  const [modules, courses, assessments, questions] = await Promise.all([
    fetchAllRows<ModuleRow>(supabase, "modules", "id, course_id, title, content, skill_tags, topic_tags"),
    fetchAllRows<CourseRow>(supabase, "courses", "id, title, category"),
    fetchAllRows<AssessmentRow>(
      supabase,
      "assessments",
      "id, module_id, title, description, time_limit, passing_score, max_attempts, is_active, skill_tags, topic_tags, derived_from_module_quiz",
    ),
    fetchAllRows<AssessmentQuestionRow>(
      supabase,
      "assessment_questions",
      "id, assessment_id, question, question_type, options, correct_answer, points, order, explanation, source_question_key, is_active, derived_from_module_quiz",
    ),
  ]);

  const courseById = new Map(courses.map((course) => [course.id, course]));
  const assessmentByModuleId = new Map(assessments.map((assessment) => [assessment.module_id, assessment]));
  const questionsByAssessmentId = new Map<string, AssessmentQuestionRow[]>();

  for (const question of questions) {
    const existing = questionsByAssessmentId.get(question.assessment_id) || [];
    existing.push(question);
    questionsByAssessmentId.set(question.assessment_id, existing);
  }

  const records: AuditRecord[] = [];
  let backfilledCount = 0;

  for (const moduleRow of modules) {
    const courseRow = courseById.get(moduleRow.course_id);
    const assessmentRow = assessmentByModuleId.get(moduleRow.id) || null;
    const assessmentQuestions = assessmentRow ? questionsByAssessmentId.get(assessmentRow.id) || [] : [];
    const activeQuestions = assessmentQuestions
      .filter((question) => question.is_active !== false)
      .sort((left, right) => left.order - right.order);

    const blocks = parseModuleContentBlocks(moduleRow.content);
    const gradableQuizBlocks = getGradableQuizBlocks(blocks);
    const invalidQuizIssues = validateQuizAssessmentBlocks(blocks).map((issue) => `${issue.blockLabel}: ${issue.message}`);
    const derivedQuestions = gradableQuizBlocks.map(toDerivedQuestionPayload);
    const storedQuestions = activeQuestions.map(toComparableQuestion);

    let classification: AuditClassification = "no_assessment_source";
    let mismatchReasons: string[] = [];

    if (gradableQuizBlocks.length > 0 && activeQuestions.length === 0) {
      classification = "quiz_blocks_only";
      if (invalidQuizIssues.length > 0) {
        mismatchReasons = ["Quiz blocks exist but are not yet valid for assessment sync."];
      }
    } else if (gradableQuizBlocks.length === 0 && activeQuestions.length > 0) {
      classification = "assessment_tables_only";
      mismatchReasons = ["Assessment questions exist without gradable quiz blocks in module content."];
    } else if (gradableQuizBlocks.length > 0 && activeQuestions.length > 0) {
      const comparison = compareQuestionSets(derivedQuestions, storedQuestions);
      classification = comparison.inSync ? "both_in_sync" : "both_mismatched";
      mismatchReasons = comparison.reasons;
    }

    const backfillEligible = classification === "quiz_blocks_only" && invalidQuizIssues.length === 0;
    let actionTaken: string | undefined;

    if (shouldApplyBackfill && backfillEligible) {
      const assessmentId = await syncModuleAssessment(supabase, moduleRow, courseRow, blocks, assessmentRow);
      actionTaken = assessmentId ? `Backfilled derived assessment ${assessmentId}` : "Skipped";
      if (assessmentId) {
        backfilledCount += 1;
      }
    }

    records.push({
      moduleId: moduleRow.id,
      moduleTitle: moduleRow.title,
      courseId: moduleRow.course_id,
      courseTitle: courseRow?.title || "Unknown Course",
      courseCategory: courseRow?.category || null,
      classification,
      quizBlockCount: blocks.filter((block) => block.type === "quiz").length,
      gradableQuizBlockCount: gradableQuizBlocks.length,
      activeAssessmentQuestionCount: activeQuestions.length,
      assessmentId: assessmentRow?.id || null,
      derivedAssessment: Boolean(assessmentRow?.derived_from_module_quiz),
      invalidQuizIssues,
      backfillEligible,
      mismatchReasons,
      actionTaken,
    });
  }

  const summary: AuditSummary = {
    totalModules: records.length,
    counts: {
      no_assessment_source: records.filter((record) => record.classification === "no_assessment_source").length,
      quiz_blocks_only: records.filter((record) => record.classification === "quiz_blocks_only").length,
      assessment_tables_only: records.filter((record) => record.classification === "assessment_tables_only").length,
      both_in_sync: records.filter((record) => record.classification === "both_in_sync").length,
      both_mismatched: records.filter((record) => record.classification === "both_mismatched").length,
    },
    backfillEligibleCount: records.filter((record) => record.backfillEligible).length,
    backfilledCount,
    mismatchedCount: records.filter((record) => record.classification === "both_mismatched").length,
  };

  const report = buildReport(summary, records);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, report, "utf8");

  console.log(`Derived assessment audit complete. Report written to ${reportPath}`);
  console.log(JSON.stringify(summary, null, 2));
};

void main().catch((error) => {
  console.error("Derived assessment audit failed:", error);
  process.exitCode = 1;
});