/**
 * Seed modules and graded assessments for an existing course.
 *
 * Usage:
 * 1. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
 * 2. Run: npm run seed:course-modules -- <course-id>
 *
 * If no CLI course id is provided, the default target is the
 * Introduction to Data Analytics Using Excel course used in local QA.
 */

import { createClient } from "@supabase/supabase-js";

type ContentBlockType = "text" | "code" | "video" | "image" | "quiz" | "document" | "learning_material";
type QuestionType = "multiple_choice" | "true_false" | "short_answer" | "essay";

type ContentBlockSeed = {
  id: string;
  type: ContentBlockType;
  content: string;
  title?: string;
  language?: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  videoUrl?: string;
  imageUrl?: string;
  altText?: string;
  caption?: string;
  documentUrl?: string;
  materialUrl?: string;
};

type AssessmentQuestionSeed = {
  question: string;
  questionType: QuestionType;
  options?: string[];
  correctAnswer?: string;
  points: number;
  explanation?: string;
};

type AssessmentSeed = {
  title: string;
  description?: string;
  timeLimit?: number;
  passingScore: number;
  maxAttempts: number;
  questions: AssessmentQuestionSeed[];
};

type ModuleSeed = {
  title: string;
  description: string;
  order: number;
  status?: "draft" | "finalized";
  materials: string[];
  moduleThumbnail?: string;
  moduleDocument?: string;
  skillTags?: string[];
  topicTags?: string[];
  prerequisiteOrders?: number[];
  contentBlocks: ContentBlockSeed[];
  gradedAssessment: AssessmentSeed;
};

const DEFAULT_COURSE_ID = "5a4cbdef-cbd4-428c-a1d5-dd6a68188794";
const SAMPLE_PDF = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
const SAMPLE_VIDEO = "https://www.youtube.com/watch?v=DAU0qqh_I-A";

const MODULE_SEEDS: ModuleSeed[] = [
  {
    title: "Excel Fundamentals for Clean Worksheets",
    description: "Set up structured worksheets, apply consistent formatting, and prepare spreadsheets for analysis.",
    order: 1,
    status: "finalized",
    materials: [SAMPLE_PDF, SAMPLE_VIDEO],
    moduleDocument: SAMPLE_PDF,
    skillTags: ["excel-basics", "worksheet-setup", "data-preparation"],
    topicTags: ["spreadsheets", "formatting", "tables"],
    contentBlocks: [
      {
        id: "excel-fundamentals-text",
        type: "text",
        title: "Build a worksheet that stays readable",
        content:
          "<p>Good analysis starts with a clean worksheet. Use one header row, avoid merged cells inside your dataset, and keep each column limited to one data type. Structured worksheets reduce formula errors and make sorting, filtering, and charting more reliable.</p><p>Convert raw ranges into Excel tables when possible so formulas and filters stay aligned as the dataset grows.</p>",
      },
      {
        id: "excel-fundamentals-video",
        type: "video",
        title: "Worksheet setup walkthrough",
        content: "",
        videoUrl: SAMPLE_VIDEO,
      },
      {
        id: "excel-fundamentals-material",
        type: "learning_material",
        title: "Worksheet cleanup checklist",
        content: "",
        materialUrl: SAMPLE_PDF,
      },
      {
        id: "excel-fundamentals-quiz",
        type: "quiz",
        title: "Quick quiz",
        content: "Which worksheet design choice best supports accurate sorting and filtering?",
        options: [
          "A single header row with consistent column types",
          "Merged cells inside the data table",
          "Multiple blank rows between records",
          "Several unrelated values in one column",
        ],
        correctAnswer: 0,
        explanation: "Sorting and filtering work best when each column has a clear header and a consistent value type.",
      },
    ],
    gradedAssessment: {
      title: "Worksheet Setup Assessment",
      description: "Validate the learner's understanding of spreadsheet structure and data-ready worksheet design.",
      timeLimit: 12,
      passingScore: 75,
      maxAttempts: 3,
      questions: [
        {
          question: "Why should each column contain a single type of information?",
          questionType: "multiple_choice",
          options: [
            "It keeps formulas, filters, and analysis consistent",
            "It makes charts impossible to build",
            "It removes the need for headers",
            "It allows every cell to use a different meaning",
          ],
          correctAnswer: "It keeps formulas, filters, and analysis consistent",
          points: 2,
          explanation: "Consistent columns make the dataset predictable for Excel tools.",
        },
        {
          question: "True or false: Blank rows inside the middle of a dataset can interfere with analysis workflows.",
          questionType: "true_false",
          correctAnswer: "true",
          points: 1,
          explanation: "Blank rows can break selections and reduce reliability when sorting or summarizing data.",
        },
        {
          question: "Which Excel feature helps keep filters and formulas aligned when new rows are added?",
          questionType: "multiple_choice",
          options: ["Excel Table", "Text box", "Comment thread", "Frozen pane only"],
          correctAnswer: "Excel Table",
          points: 2,
          explanation: "Excel Tables expand with the dataset and preserve structure-aware behavior.",
        },
      ],
    },
  },
  {
    title: "Clean and Prepare Data in Excel",
    description: "Standardize values, remove duplicates, and handle incomplete records before analysis.",
    order: 2,
    status: "finalized",
    materials: [SAMPLE_PDF],
    moduleDocument: SAMPLE_PDF,
    skillTags: ["data-cleaning", "quality-control", "excel-functions"],
    topicTags: ["duplicates", "missing-data", "standardization"],
    prerequisiteOrders: [1],
    contentBlocks: [
      {
        id: "data-cleaning-text",
        type: "text",
        title: "Prepare data before drawing conclusions",
        content:
          "<p>Data cleaning reduces the risk of misleading summaries. Standardize capitalization, align date formats, and remove exact duplicates when appropriate. Before deleting anything, inspect the rows and confirm whether duplicates are truly redundant records.</p><p>Flag missing values intentionally so the next analyst knows whether the gap means unavailable, not applicable, or not yet collected.</p>",
      },
      {
        id: "data-cleaning-code",
        type: "code",
        title: "Useful Excel functions",
        language: "plaintext",
        content: "=TRIM(A2)\n=UPPER(B2)\n=TEXT(C2, \"yyyy-mm-dd\")\n=IF(D2=\"\", \"Missing\", D2)",
      },
      {
        id: "data-cleaning-document",
        type: "document",
        title: "Data cleaning reference",
        content: "",
        documentUrl: SAMPLE_PDF,
      },
      {
        id: "data-cleaning-quiz",
        type: "quiz",
        title: "Quick quiz",
        content: "What is the best first step before removing duplicate rows from a spreadsheet?",
        options: [
          "Review whether the duplicate records are actually redundant",
          "Delete all repeated names immediately",
          "Replace the whole sheet with a screenshot",
          "Ignore duplicates until after charting",
        ],
        correctAnswer: 0,
        explanation: "Some repeated values may represent legitimate repeated transactions rather than bad data.",
      },
    ],
    gradedAssessment: {
      title: "Data Cleaning Assessment",
      description: "Measure whether the learner can identify practical data-cleaning steps in Excel.",
      timeLimit: 15,
      passingScore: 75,
      maxAttempts: 3,
      questions: [
        {
          question: "Why is standardizing date format useful before analysis?",
          questionType: "multiple_choice",
          options: [
            "It helps Excel sort and compare dates correctly",
            "It removes the need for validation",
            "It turns every value into plain text on purpose",
            "It prevents filtering by month",
          ],
          correctAnswer: "It helps Excel sort and compare dates correctly",
          points: 2,
          explanation: "Inconsistent date formats can break chronological sorting and aggregation.",
        },
        {
          question: "True or false: Missing values should be interpreted the same way in every dataset without review.",
          questionType: "true_false",
          correctAnswer: "false",
          points: 1,
          explanation: "Missing values can mean different things depending on the data collection context.",
        },
        {
          question: "Which function helps remove extra spaces from imported text data?",
          questionType: "multiple_choice",
          options: ["TRIM", "RAND", "NOW", "COUNTIF"],
          correctAnswer: "TRIM",
          points: 2,
          explanation: "TRIM removes extra spaces that often appear in copied or imported data.",
        },
      ],
    },
  },
  {
    title: "Analyze Data with Formulas and Functions",
    description: "Use core Excel formulas to summarize values, compare categories, and build quick calculations.",
    order: 3,
    status: "finalized",
    materials: [SAMPLE_PDF, SAMPLE_VIDEO],
    moduleDocument: SAMPLE_PDF,
    skillTags: ["excel-formulas", "aggregation", "analysis"],
    topicTags: ["sumifs", "countifs", "averages"],
    prerequisiteOrders: [1, 2],
    contentBlocks: [
      {
        id: "formulas-functions-text",
        type: "text",
        title: "Move from raw values to useful summaries",
        content:
          "<p>Excel formulas help answer focused questions quickly. Use functions like SUM, AVERAGE, COUNTIF, and SUMIFS to summarize data by condition. Clear cell references and labeled helper columns make formulas easier to audit and reuse.</p><p>Always verify whether you should use relative or absolute references when copying formulas across rows and columns.</p>",
      },
      {
        id: "formulas-functions-material",
        type: "learning_material",
        title: "Formula cheat sheet",
        content: "",
        materialUrl: SAMPLE_PDF,
      },
      {
        id: "formulas-functions-quiz",
        type: "quiz",
        title: "Quick quiz",
        content: "Which Excel function is most useful when you need to total sales for one specific region only?",
        options: ["SUMIFS", "LEFT", "TODAY", "TRIM"],
        correctAnswer: 0,
        explanation: "SUMIFS is designed for conditional summation based on one or more criteria.",
      },
    ],
    gradedAssessment: {
      title: "Formula Analysis Assessment",
      description: "Check whether the learner can match common analysis needs with the right Excel functions.",
      timeLimit: 15,
      passingScore: 75,
      maxAttempts: 3,
      questions: [
        {
          question: "When should SUMIFS be preferred over SUM?",
          questionType: "multiple_choice",
          options: [
            "When the total must match one or more conditions",
            "When no numeric values exist",
            "When a chart title needs editing",
            "When removing duplicates only",
          ],
          correctAnswer: "When the total must match one or more conditions",
          points: 2,
          explanation: "SUMIFS adds conditional filtering to the summation process.",
        },
        {
          question: "True or false: Absolute references help keep a fixed cell reference while formulas are copied.",
          questionType: "true_false",
          correctAnswer: "true",
          points: 1,
          explanation: "Absolute references lock the referenced row, column, or both.",
        },
        {
          question: "Which function is most appropriate for counting rows that meet a condition?",
          questionType: "multiple_choice",
          options: ["COUNTIF", "CONCAT", "MID", "UPPER"],
          correctAnswer: "COUNTIF",
          points: 2,
          explanation: "COUNTIF returns the number of values matching a criterion.",
        },
      ],
    },
  },
  {
    title: "Summarize Insights with PivotTables and Charts",
    description: "Turn spreadsheet data into summary tables and charts that support reporting and decisions.",
    order: 4,
    status: "finalized",
    materials: [SAMPLE_PDF, SAMPLE_VIDEO],
    moduleDocument: SAMPLE_PDF,
    skillTags: ["pivot-tables", "data-visualization", "reporting"],
    topicTags: ["charts", "summaries", "dashboards"],
    prerequisiteOrders: [2, 3],
    contentBlocks: [
      {
        id: "pivots-charts-text",
        type: "text",
        title: "Choose the right summary view",
        content:
          "<p>PivotTables help summarize large datasets without rewriting formulas for every view. They are useful for grouping results by category, date, or location. Charts then turn those summaries into visuals that support quick interpretation.</p><p>Select chart types that match the question. Bar and column charts compare categories well, while line charts are better for trends over time.</p>",
      },
      {
        id: "pivots-charts-image",
        type: "image",
        title: "Reporting snapshot",
        content: "",
        imageUrl: "/images/logo.png",
        altText: "Placeholder visual for an Excel reporting dashboard",
        caption: "Replace with a branded chart sample if needed.",
      },
      {
        id: "pivots-charts-quiz",
        type: "quiz",
        title: "Quick quiz",
        content: "Which chart type is usually best for showing month-by-month performance trends?",
        options: ["Line chart", "Pie chart", "Scatter plot for one value", "Text box"],
        correctAnswer: 0,
        explanation: "Line charts are effective for showing direction and change over time.",
      },
    ],
    gradedAssessment: {
      title: "PivotTable and Chart Assessment",
      description: "Assess the learner's ability to choose useful summaries and visuals in Excel.",
      timeLimit: 15,
      passingScore: 75,
      maxAttempts: 3,
      questions: [
        {
          question: "Why are PivotTables useful for reporting?",
          questionType: "multiple_choice",
          options: [
            "They let the analyst reorganize and summarize data quickly",
            "They permanently delete source records",
            "They replace every formula in Excel",
            "They stop users from filtering data",
          ],
          correctAnswer: "They let the analyst reorganize and summarize data quickly",
          points: 2,
          explanation: "PivotTables make exploration and grouping faster without manual recalculation for every view.",
        },
        {
          question: "True or false: Pie charts are always the best choice for showing trends over time.",
          questionType: "true_false",
          correctAnswer: "false",
          points: 1,
          explanation: "Line charts usually communicate trends over time more clearly than pie charts.",
        },
        {
          question: "Which visualization is usually strongest for comparing values across categories?",
          questionType: "multiple_choice",
          options: ["Bar or column chart", "Freehand drawing", "Comment box", "Merged header row"],
          correctAnswer: "Bar or column chart",
          points: 2,
          explanation: "Bar and column charts make category comparisons easier to read.",
        },
      ],
    },
  },
  {
    title: "Build a Basic Data Analytics Report in Excel",
    description: "Combine cleaned data, formulas, and visuals into a simple report with actionable findings.",
    order: 5,
    status: "finalized",
    materials: [SAMPLE_PDF],
    moduleDocument: SAMPLE_PDF,
    skillTags: ["reporting", "decision-support", "data-storytelling"],
    topicTags: ["insights", "recommendations", "stakeholder-reporting"],
    prerequisiteOrders: [1, 2, 3, 4],
    contentBlocks: [
      {
        id: "reporting-text",
        type: "text",
        title: "Turn analysis into decisions",
        content:
          "<p>A basic analytics report should explain what data was reviewed, what patterns were found, and what action the reader should consider next. Use a short summary, one or two supporting tables or charts, and a clear recommendation tied to the numbers.</p><p>Keep the audience in mind. Decision-makers usually want concise findings, not every calculation step.</p>",
      },
      {
        id: "reporting-code",
        type: "code",
        title: "Simple report outline",
        language: "plaintext",
        content:
          "1. Objective\n2. Dataset scope\n3. Key metrics\n4. Chart or table summary\n5. Main finding\n6. Recommendation\n7. Next step",
      },
      {
        id: "reporting-quiz",
        type: "quiz",
        title: "Quick quiz",
        content: "What makes an analytics report useful to a manager or stakeholder?",
        options: [
          "It connects findings to a clear recommendation",
          "It lists formulas without any interpretation",
          "It avoids showing any evidence",
          "It uses as many decorative colors as possible",
        ],
        correctAnswer: 0,
        explanation: "Reports are most useful when they translate analysis into practical action.",
      },
    ],
    gradedAssessment: {
      title: "Excel Reporting Assessment",
      description: "Evaluate whether the learner can frame an Excel analysis as a concise decision-support report.",
      timeLimit: 20,
      passingScore: 80,
      maxAttempts: 3,
      questions: [
        {
          question: "What is the strongest purpose of a report recommendation?",
          questionType: "multiple_choice",
          options: [
            "To show what action the findings support",
            "To hide the analysis from stakeholders",
            "To replace all evidence with opinion",
            "To avoid summarizing the results",
          ],
          correctAnswer: "To show what action the findings support",
          points: 2,
          explanation: "A recommendation connects evidence to a decision or next step.",
        },
        {
          question: "True or false: A report should be tailored to what the audience needs to know and act on.",
          questionType: "true_false",
          correctAnswer: "true",
          points: 1,
          explanation: "Audience-aware reporting improves clarity and usefulness.",
        },
        {
          question: "Which section helps explain the boundaries of what the analysis covered?",
          questionType: "multiple_choice",
          options: ["Dataset scope", "Color palette", "Font choice", "File name only"],
          correctAnswer: "Dataset scope",
          points: 2,
          explanation: "Scope clarifies what data and period the findings are based on.",
        },
      ],
    },
  },
];

const envUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const envServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!envUrl || !envServiceKey) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(envUrl, envServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const columnCache = new Map<string, boolean>();

async function columnExists(table: string, column: string) {
  const cacheKey = `${table}.${column}`;
  if (columnCache.has(cacheKey)) {
    return columnCache.get(cacheKey) as boolean;
  }

  const { error } = await supabase.from(table).select(column).limit(1);
  const exists = !error;
  columnCache.set(cacheKey, exists);
  return exists;
}

async function withExistingColumns<T extends Record<string, unknown>>(table: string, values: T) {
  const payload: Record<string, unknown> = {};

  for (const [column, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (await columnExists(table, column)) {
      payload[column] = value;
    }
  }

  return payload;
}

async function ensureCourseExists(courseId: string) {
  const { data, error } = await supabase.from("courses").select("id, title").eq("id", courseId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(`Course ${courseId} was not found.`);
  }

  return data;
}

async function upsertModule(courseId: string, module: ModuleSeed) {
  const now = new Date().toISOString();
  const basePayload = {
    course_id: courseId,
    title: module.title,
    description: module.description,
    order: module.order,
    content: JSON.stringify(module.contentBlocks),
    materials: module.materials,
    prerequisites: [],
    module_thumbnail: module.moduleThumbnail,
    module_document: module.moduleDocument,
    status: module.status,
    skill_tags: module.skillTags,
    topic_tags: module.topicTags,
    updated_at: now,
  };

  const { data: existingModules, error: existingModulesError } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", courseId)
    .eq("title", module.title)
    .limit(1);

  if (existingModulesError) {
    throw existingModulesError;
  }

  const payload = await withExistingColumns("modules", basePayload);

  if (existingModules && existingModules.length > 0) {
    const moduleId = existingModules[0].id;
    const { error: updateError } = await supabase.from("modules").update(payload).eq("id", moduleId);
    if (updateError) {
      throw updateError;
    }
    return moduleId;
  }

  const { data: insertedModule, error: insertError } = await supabase
    .from("modules")
    .insert({
      ...payload,
      created_at: now,
    })
    .select("id")
    .single();

  if (insertError || !insertedModule) {
    throw insertError || new Error(`Failed to insert module ${module.title}.`);
  }

  return insertedModule.id;
}

async function updateModulePrerequisites(moduleId: string, prerequisiteIds: string[]) {
  const payload = await withExistingColumns("modules", {
    prerequisites: prerequisiteIds,
    updated_at: new Date().toISOString(),
  });

  const { error } = await supabase.from("modules").update(payload).eq("id", moduleId);
  if (error) {
    throw error;
  }
}

async function upsertAssessment(courseId: string, moduleId: string, moduleOrder: number, assessment: AssessmentSeed) {
  const now = new Date().toISOString();
  const { data: existingCourseLevelAssessment, error: existingCourseLevelAssessmentError } = await supabase
    .from("assessments")
    .select("id")
    .eq("course_id", courseId)
    .eq("title", assessment.title)
    .limit(1);

  if (existingCourseLevelAssessmentError) {
    throw existingCourseLevelAssessmentError;
  }

  const { data: existingModuleLinkedAssessment, error: existingModuleLinkedAssessmentError } = await supabase
    .from("assessments")
    .select("id")
    .eq("module_id", moduleId)
    .limit(1);

  if (existingModuleLinkedAssessmentError) {
    throw existingModuleLinkedAssessmentError;
  }

  const basePayload = {
    course_id: courseId,
    module_id: null,
    title: assessment.title,
    description: assessment.description || null,
    time_limit: assessment.timeLimit || null,
    passing_score: assessment.passingScore,
    max_attempts: assessment.maxAttempts,
    is_active: true,
    prerequisite_module_ids: [moduleId],
    derived_from_module_quiz: false,
    display_order: moduleOrder,
    updated_at: now,
  };

  const payload = await withExistingColumns("assessments", basePayload);

  let assessmentId: string;
  const existingAssessmentRow = existingCourseLevelAssessment?.[0] || existingModuleLinkedAssessment?.[0];

  if (existingAssessmentRow) {
    assessmentId = existingAssessmentRow.id;
    const { error: updateError } = await supabase.from("assessments").update(payload).eq("id", assessmentId);
    if (updateError) {
      throw updateError;
    }
  } else {
    const { data: insertedAssessment, error: insertError } = await supabase
      .from("assessments")
      .insert({
        ...payload,
        created_at: now,
      })
      .select("id")
      .single();

    if (insertError || !insertedAssessment) {
      throw insertError || new Error(`Failed to insert assessment ${assessment.title}.`);
    }

    assessmentId = insertedAssessment.id;
  }

  const { error: deleteQuestionsError } = await supabase.from("assessment_questions").delete().eq("assessment_id", assessmentId);
  if (deleteQuestionsError) {
    throw deleteQuestionsError;
  }

  const questionRows = assessment.questions.map((question, index) => ({
    assessment_id: assessmentId,
    question: question.question,
    question_type: question.questionType,
    options: question.options || null,
    correct_answer: question.correctAnswer || null,
    points: question.points,
    order: index + 1,
    explanation: question.explanation || null,
    created_at: now,
  }));

  if (questionRows.length > 0) {
    const { error: questionInsertError } = await supabase.from("assessment_questions").insert(questionRows);
    if (questionInsertError) {
      throw questionInsertError;
    }
  }

  return assessmentId;
}

async function main() {
  const courseId = process.argv[2] || DEFAULT_COURSE_ID;
  const course = await ensureCourseExists(courseId);

  const moduleIdsByOrder = new Map<number, string>();
  let moduleCount = 0;
  let assessmentCount = 0;
  let questionCount = 0;

  for (const module of MODULE_SEEDS) {
    const moduleId = await upsertModule(courseId, module);
    moduleIdsByOrder.set(module.order, moduleId);
    moduleCount += 1;
  }

  for (const module of MODULE_SEEDS) {
    const moduleId = moduleIdsByOrder.get(module.order);
    if (!moduleId) {
      throw new Error(`Missing module id for ${module.title}.`);
    }

    const prerequisiteIds = (module.prerequisiteOrders || [])
      .map((order) => moduleIdsByOrder.get(order))
      .filter((value): value is string => Boolean(value));

    await updateModulePrerequisites(moduleId, prerequisiteIds);
    await upsertAssessment(courseId, moduleId, module.order, module.gradedAssessment);

    assessmentCount += 1;
    questionCount += module.gradedAssessment.questions.length;
  }

  console.log(`Seed complete for course: ${course.title} (${course.id})`);
  console.log(`Modules upserted: ${moduleCount}`);
  console.log(`Assessments upserted: ${assessmentCount}`);
  console.log(`Questions upserted: ${questionCount}`);
}

main().catch((error) => {
  console.error("Existing course module seed failed:", error);
  process.exit(1);
});