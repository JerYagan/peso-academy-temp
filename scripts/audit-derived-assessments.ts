/// <reference types="node" />

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getGradableQuizBlocks,
  getQuizBlocks,
  parseModuleContentBlocks,
  validateQuizAssessmentBlocks,
  type ContentBlock,
} from "../src/lib/contentBlocks";

type AuditClassification =
  | "no_assessment_source"
  | "practice_quizzes_only"
  | "standalone_graded_assessments_only"
  | "both_present"
  | "legacy_derived_assessments";

type MigrationDecision = "none" | "convert_to_course_level" | "trainer_review";

type AssessmentQuestionType = "multiple_choice" | "true_false" | "short_answer" | "essay";

type ModuleRow = {
  id: string;
  course_id: string;
  title: string;
  order: number;
  content: string | null;
};

type CourseRow = {
  id: string;
  title: string;
  category: string | null;
};

type AssessmentRow = {
  id: string;
  course_id: string;
  module_id: string | null;
  title: string;
  description: string | null;
  time_limit: number | null;
  passing_score: number;
  max_attempts: number;
  is_active: boolean;
  prerequisite_module_ids?: string[] | null;
  derived_from_module_quiz?: boolean | null;
  display_order?: number | null;
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
  moduleOrder: number;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  courseCategory: string | null;
  classification: AuditClassification;
  quizBlockCount: number;
  gradableQuizBlockCount: number;
  standaloneAssessmentCount: number;
  legacyDerivedAssessmentCount: number;
  linkedAssessmentIds: string[];
  invalidQuizIssues: string[];
  mismatchReasons: string[];
  migrationDecision: MigrationDecision;
  decisionReasons: string[];
  actionTaken?: string;
};

type AuditSummary = {
  totalModules: number;
  counts: Record<AuditClassification, number>;
  conversionCandidateCount: number;
  trainerReviewCount: number;
  convertedCount: number;
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

const columnCache = new Map<string, boolean>();

async function columnExists(supabase: SupabaseClient, table: string, column: string) {
  const cacheKey = `${table}.${column}`;
  if (columnCache.has(cacheKey)) {
    return columnCache.get(cacheKey) as boolean;
  }

  const { error } = await supabase.from(table).select(column).limit(1);
  const exists = !error;
  columnCache.set(cacheKey, exists);
  return exists;
}

async function withExistingColumns<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  values: T,
) {
  const payload: Record<string, unknown> = {};

  for (const [column, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (await columnExists(supabase, table, column)) {
      payload[column] = value;
    }
  }

  return payload;
}

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
    questionType: block.questionType === "true_false" ? "true_false" : block.questionType === "essay" ? "essay" : "multiple_choice",
    options,
    correctAnswer:
      block.correctAnswer !== undefined && options[block.correctAnswer] !== undefined ? options[block.correctAnswer] : null,
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
  const shouldApplyConversion = args.includes("--apply-conversion") || args.includes("--apply-backfill");
  const reportFlagIndex = args.findIndex((arg: string) => arg === "--report");
  const reportPath = reportFlagIndex >= 0 && args[reportFlagIndex + 1]
    ? path.resolve(process.cwd(), args[reportFlagIndex + 1])
    : DEFAULT_REPORT_PATH;

  return {
    shouldApplyConversion,
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

const getLinkedAssessmentsForModule = (moduleId: string, assessments: AssessmentRow[]) => {
  return assessments.filter((assessment) => {
    if (!assessment.is_active) {
      return false;
    }

    if (assessment.module_id === moduleId) {
      return true;
    }

    return (assessment.prerequisite_module_ids || []).includes(moduleId);
  });
};

const decideLegacyMigration = (
  legacyAssessments: AssessmentRow[],
  standaloneAssessments: AssessmentRow[],
  activeLegacyQuestions: AssessmentQuestionRow[],
  invalidQuizIssues: string[],
  mismatchReasons: string[],
): { decision: MigrationDecision; reasons: string[] } => {
  if (legacyAssessments.length === 0) {
    return { decision: "none", reasons: [] };
  }

  const reasons: string[] = [];

  if (legacyAssessments.length > 1) {
    reasons.push("More than one legacy derived assessment is linked to this module.");
  }

  if (standaloneAssessments.length > 0) {
    reasons.push("A standalone graded assessment is already linked to this module.");
  }

  if (activeLegacyQuestions.length === 0) {
    reasons.push("The legacy derived assessment has no active assessment questions.");
  }

  if (invalidQuizIssues.length > 0) {
    reasons.push("The linked practice quiz blocks still have validation issues.");
  }

  if (mismatchReasons.length > 0) {
    reasons.push("The legacy derived assessment no longer matches the module quiz content.");
  }

  if (reasons.length > 0) {
    return {
      decision: "trainer_review",
      reasons,
    };
  }

  return {
    decision: "convert_to_course_level",
    reasons: [
      "The legacy derived assessment is internally consistent and can be promoted to a standalone course-level assessment.",
      "The converted assessment should unlock after the source module is completed.",
    ],
  };
};

const convertLegacyAssessment = async (
  supabase: SupabaseClient,
  assessment: AssessmentRow,
  moduleRow: ModuleRow,
) => {
  const now = new Date().toISOString();
  const assessmentPayload = await withExistingColumns(supabase, "assessments", {
    course_id: moduleRow.course_id,
    module_id: null,
    prerequisite_module_ids: [moduleRow.id],
    derived_from_module_quiz: false,
    display_order: assessment.display_order ?? moduleRow.order,
    updated_at: now,
  });

  const { error: assessmentUpdateError } = await supabase
    .from("assessments")
    .update(assessmentPayload)
    .eq("id", assessment.id);

  if (assessmentUpdateError) {
    throw assessmentUpdateError;
  }

  const questionPayload = await withExistingColumns(supabase, "assessment_questions", {
    derived_from_module_quiz: false,
  });

  if (Object.keys(questionPayload).length > 0) {
    const { error: questionUpdateError } = await supabase
      .from("assessment_questions")
      .update(questionPayload)
      .eq("assessment_id", assessment.id);

    if (questionUpdateError) {
      throw questionUpdateError;
    }
  }

  return `Converted legacy derived assessment ${assessment.id} to a course-level graded assessment with prerequisite module ${moduleRow.id}.`;
};

const buildReport = (summary: AuditSummary, records: AuditRecord[]) => {
  const timestamp = new Date().toISOString();
  const conversionCandidates = records.filter((record) => record.migrationDecision === "convert_to_course_level");
  const reviewQueue = records.filter((record) => record.migrationDecision === "trainer_review");

  return [
    "# Legacy Assessment Migration Audit Report",
    "",
    `Generated: ${timestamp}`,
    "",
    "## Summary",
    "",
    `- Total modules scanned: ${summary.totalModules}`,
    `- Practice quizzes only: ${summary.counts.practice_quizzes_only}`,
    `- Standalone graded assessments only: ${summary.counts.standalone_graded_assessments_only}`,
    `- Both practice quizzes and standalone graded assessments present: ${summary.counts.both_present}`,
    `- Legacy derived assessments: ${summary.counts.legacy_derived_assessments}`,
    `- No assessment source: ${summary.counts.no_assessment_source}`,
    `- Legacy conversion candidates: ${summary.conversionCandidateCount}`,
    `- Legacy trainer-review items: ${summary.trainerReviewCount}`,
    `- Converted in this run: ${summary.convertedCount}`,
    "",
    "## Legacy Conversion Candidates",
    "",
    ...(conversionCandidates.length > 0
      ? conversionCandidates.flatMap((record) => [
          `### ${record.courseTitle} / ${record.moduleTitle}`,
          `- Module ID: ${record.moduleId}`,
          `- Linked legacy assessment IDs: ${record.linkedAssessmentIds.join(", ")}`,
          `- Quiz blocks: ${record.quizBlockCount}`,
          `- Gradable quiz blocks: ${record.gradableQuizBlockCount}`,
          `- Decision: convert to course-level graded assessment`,
          `- Reasons: ${record.decisionReasons.join("; ")}`,
          `- Action: ${record.actionTaken || "Audit only"}`,
          "",
        ])
      : ["No legacy derived assessments qualified for automatic conversion.", ""]),
    "## Trainer Review Queue",
    "",
    ...(reviewQueue.length > 0
      ? reviewQueue.flatMap((record) => [
          `### ${record.courseTitle} / ${record.moduleTitle}`,
          `- Module ID: ${record.moduleId}`,
          `- Linked legacy assessment IDs: ${record.linkedAssessmentIds.join(", ")}`,
          `- Quiz blocks: ${record.quizBlockCount}`,
          `- Standalone assessments: ${record.standaloneAssessmentCount}`,
          ...(record.mismatchReasons.length > 0 ? [`- Mismatch reasons: ${record.mismatchReasons.join("; ")}`] : []),
          ...(record.invalidQuizIssues.length > 0 ? [`- Practice quiz issues: ${record.invalidQuizIssues.join("; ")}`] : []),
          `- Decision: trainer review`,
          `- Reasons: ${record.decisionReasons.join("; ")}`,
          `- Action: ${record.actionTaken || "Manual review required"}`,
          "",
        ])
      : ["No legacy derived assessments require trainer review.", ""]),
    "## Module State Inventory",
    "",
    ...records.flatMap((record) => [
      `### ${record.courseTitle} / ${record.moduleTitle}`,
      `- Classification: ${record.classification}`,
      `- Module ID: ${record.moduleId}`,
      `- Quiz blocks: ${record.quizBlockCount}`,
      `- Standalone assessments: ${record.standaloneAssessmentCount}`,
      `- Legacy derived assessments: ${record.legacyDerivedAssessmentCount}`,
      `- Linked assessment IDs: ${record.linkedAssessmentIds.length > 0 ? record.linkedAssessmentIds.join(", ") : "none"}`,
      ...(record.decisionReasons.length > 0 ? [`- Migration decision: ${record.migrationDecision} (${record.decisionReasons.join("; ")})`] : []),
      "",
    ]),
  ].join("\n");
};

const main = async () => {
  const { shouldApplyConversion, reportPath } = parseArgs();
  const supabase = getSupabaseAdmin();

  const [modules, courses, assessments, questions] = await Promise.all([
    fetchAllRows<ModuleRow>(supabase, "modules", "id, course_id, title, order, content"),
    fetchAllRows<CourseRow>(supabase, "courses", "id, title, category"),
    fetchAllRows<AssessmentRow>(
      supabase,
      "assessments",
      "id, course_id, module_id, title, description, time_limit, passing_score, max_attempts, is_active, prerequisite_module_ids, derived_from_module_quiz, display_order",
    ),
    fetchAllRows<AssessmentQuestionRow>(
      supabase,
      "assessment_questions",
      "id, assessment_id, question, question_type, options, correct_answer, points, order, explanation, source_question_key, is_active, derived_from_module_quiz",
    ),
  ]);

  const courseById = new Map(courses.map((course) => [course.id, course]));
  const questionsByAssessmentId = new Map<string, AssessmentQuestionRow[]>();

  for (const question of questions) {
    const existing = questionsByAssessmentId.get(question.assessment_id) || [];
    existing.push(question);
    questionsByAssessmentId.set(question.assessment_id, existing);
  }

  const records: AuditRecord[] = [];
  let convertedCount = 0;

  for (const moduleRow of modules.sort((left, right) => left.course_id.localeCompare(right.course_id) || left.order - right.order)) {
    const courseRow = courseById.get(moduleRow.course_id);
    const blocks = parseModuleContentBlocks(moduleRow.content);
    const quizBlocks = getQuizBlocks(blocks);
    const gradableQuizBlocks = getGradableQuizBlocks(blocks);
    const invalidQuizIssues = validateQuizAssessmentBlocks(blocks).map((issue) => `${issue.blockLabel}: ${issue.message}`);
    const linkedAssessments = getLinkedAssessmentsForModule(moduleRow.id, assessments);
    const legacyDerivedAssessments = linkedAssessments.filter((assessment) => assessment.derived_from_module_quiz === true);
    const standaloneAssessments = linkedAssessments.filter((assessment) => assessment.derived_from_module_quiz !== true);
    const primaryLegacyAssessment = legacyDerivedAssessments[0] || null;
    const activeLegacyQuestions = primaryLegacyAssessment
      ? ((questionsByAssessmentId.get(primaryLegacyAssessment.id) || []) as AssessmentQuestionRow[])
          .filter((question) => question.is_active !== false)
          .sort((left, right) => left.order - right.order)
      : [];
    const derivedQuestions = gradableQuizBlocks.map(toDerivedQuestionPayload);
    const storedQuestions = activeLegacyQuestions.map(toComparableQuestion);
    const mismatchReasons =
      primaryLegacyAssessment && gradableQuizBlocks.length > 0
        ? compareQuestionSets(derivedQuestions, storedQuestions).reasons
        : [];

    let classification: AuditClassification = "no_assessment_source";
    if (legacyDerivedAssessments.length > 0) {
      classification = "legacy_derived_assessments";
    } else if (quizBlocks.length > 0 && standaloneAssessments.length > 0) {
      classification = "both_present";
    } else if (quizBlocks.length > 0) {
      classification = "practice_quizzes_only";
    } else if (standaloneAssessments.length > 0) {
      classification = "standalone_graded_assessments_only";
    }

    const migration = decideLegacyMigration(
      legacyDerivedAssessments,
      standaloneAssessments,
      activeLegacyQuestions,
      invalidQuizIssues,
      mismatchReasons,
    );

    let actionTaken: string | undefined;
    if (shouldApplyConversion && migration.decision === "convert_to_course_level" && primaryLegacyAssessment) {
      actionTaken = await convertLegacyAssessment(supabase, primaryLegacyAssessment, moduleRow);
      convertedCount += 1;
    }

    records.push({
      moduleId: moduleRow.id,
      moduleOrder: moduleRow.order,
      moduleTitle: moduleRow.title,
      courseId: moduleRow.course_id,
      courseTitle: courseRow?.title || "Unknown Course",
      courseCategory: courseRow?.category || null,
      classification,
      quizBlockCount: quizBlocks.length,
      gradableQuizBlockCount: gradableQuizBlocks.length,
      standaloneAssessmentCount: standaloneAssessments.length,
      legacyDerivedAssessmentCount: legacyDerivedAssessments.length,
      linkedAssessmentIds: linkedAssessments.map((assessment) => assessment.id),
      invalidQuizIssues,
      mismatchReasons,
      migrationDecision: migration.decision,
      decisionReasons: migration.reasons,
      actionTaken,
    });
  }

  const summary: AuditSummary = {
    totalModules: records.length,
    counts: {
      no_assessment_source: records.filter((record) => record.classification === "no_assessment_source").length,
      practice_quizzes_only: records.filter((record) => record.classification === "practice_quizzes_only").length,
      standalone_graded_assessments_only: records.filter((record) => record.classification === "standalone_graded_assessments_only").length,
      both_present: records.filter((record) => record.classification === "both_present").length,
      legacy_derived_assessments: records.filter((record) => record.classification === "legacy_derived_assessments").length,
    },
    conversionCandidateCount: records.filter((record) => record.migrationDecision === "convert_to_course_level").length,
    trainerReviewCount: records.filter((record) => record.migrationDecision === "trainer_review").length,
    convertedCount,
  };

  const report = buildReport(summary, records);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, report, "utf8");

  console.log(`Legacy assessment migration audit complete. Report written to ${reportPath}`);
  console.log(JSON.stringify(summary, null, 2));
};

void main().catch((error) => {
  console.error("Legacy assessment migration audit failed:", error);
  process.exitCode = 1;
});
