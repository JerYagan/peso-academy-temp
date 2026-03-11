import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";

type CheckResult = {
  name: string;
  passed: boolean;
  file: string;
  details: string;
};

const ROOT = process.cwd();
const DEFAULT_REPORT_PATH = path.join(ROOT, "temp_markdowns", "assessment_reporting_regression_report.md");

const fileContents = new Map<string, string>();

const readWorkspaceFile = (relativePath: string) => {
  if (!fileContents.has(relativePath)) {
    const absolutePath = path.join(ROOT, relativePath);
    fileContents.set(relativePath, readFileSync(absolutePath, "utf8"));
  }

  return fileContents.get(relativePath) || "";
};

const hasPattern = (relativePath: string, pattern: RegExp) => {
  const content = readWorkspaceFile(relativePath);
  return pattern.test(content);
};

const check = (
  name: string,
  relativePath: string,
  predicate: boolean,
  details: string,
): CheckResult => ({
  name,
  passed: predicate,
  file: relativePath,
  details,
});

const parseArgs = () => {
  const args = process.argv.slice(2);
  const reportFlagIndex = args.findIndex((arg) => arg === "--report");
  const reportPath = reportFlagIndex >= 0 && args[reportFlagIndex + 1]
    ? path.resolve(ROOT, args[reportFlagIndex + 1])
    : DEFAULT_REPORT_PATH;

  return { reportPath };
};

const buildReport = (results: CheckResult[]) => {
  const passed = results.filter((result) => result.passed);
  const failed = results.filter((result) => !result.passed);

  return [
    "# Assessment Reporting Regression Check",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Total checks: ${results.length}`,
    `- Passed: ${passed.length}`,
    `- Failed: ${failed.length}`,
    "",
    "## Checks",
    "",
    ...results.flatMap((result) => [
      `### ${result.passed ? "PASS" : "FAIL"}: ${result.name}`,
      `- File: ${result.file}`,
      `- Detail: ${result.details}`,
      "",
    ]),
  ].join("\n");
};

const main = () => {
  const { reportPath } = parseArgs();

  const results: CheckResult[] = [
    check(
      "Assessment submission persists score and pass/fail to attempts",
      "src/services/assessmentService.ts",
      hasPattern("src/services/assessmentService.ts", /from\("assessment_attempts"\)[\s\S]*?update\([\s\S]*?score,[\s\S]*?passed,[\s\S]*?time_spent/s),
      "`submitAttempt` should continue writing `score` and `passed` onto `assessment_attempts`.",
    ),
    check(
      "Assessment submission still emits assessment_submit analytics",
      "src/services/assessmentService.ts",
      hasPattern("src/services/assessmentService.ts", /eventName:\s*"assessment_submit"/),
      "The assessment runtime should keep sending the `assessment_submit` analytics event.",
    ),
    check(
      "Assessment submission still refreshes phase 1 rollups",
      "src/services/assessmentService.ts",
      hasPattern("src/services/assessmentService.ts", /refreshPhase1Analytics\(userId\)/),
      "Learner/reporting rollups should still refresh immediately after assessment submission.",
    ),
    check(
      "Learner performance summary averages scored attempts",
      "src/services/reportingService.ts",
      hasPattern("src/services/reportingService.ts", /averageAssessmentScore:[\s\S]*?scoredAttempts\.reduce\(\(sum, attempt\) => sum \+ attempt\.score/s),
      "Learner-facing summaries should continue computing average assessment score from scored attempts.",
    ),
    check(
      "Trainer/admin visible attempt loading still uses assessment_attempts score fields",
      "src/services/reportingService.ts",
      hasPattern("src/services/reportingService.ts", /from\("assessment_attempts"\)[\s\S]*?select\("assessment_id, enrollment_id, score, passed, submitted_at"\)/s),
      "Staff reporting fallback queries should still read `score` and `passed` from `assessment_attempts`.",
    ),
    check(
      "Trainer attempt RPC remains in place",
      "src/services/reportingService.ts",
      hasPattern("src/services/reportingService.ts", /get_course_manager_assessment_attempts/),
      "Trainer-visible reporting should keep using the course-manager assessment attempt RPC when available.",
    ),
    check(
      "Analytics SQL rollups still aggregate average assessment score from assessment_attempts.score",
      "supabase/migrations/040_add_session_rollup_metrics.sql",
      hasPattern("supabase/migrations/040_add_session_rollup_metrics.sql", /AVG\(COALESCE\(aa\.score, 0\)\) FILTER \(WHERE aa\.score IS NOT NULL\)/),
      "Phase 1 analytics SQL should still derive average assessment score directly from `assessment_attempts.score`.",
    ),
    check(
      "Analytics SQL still joins from assessment_attempts for learner/topic rollups",
      "supabase/migrations/040_add_session_rollup_metrics.sql",
      hasPattern("supabase/migrations/040_add_session_rollup_metrics.sql", /LEFT JOIN public\.assessment_attempts aa ON aa\.enrollment_id = e\.id AND aa\.submitted_at IS NOT NULL/),
      "Rollups should continue using submitted assessment attempts as the source of learner assessment evidence.",
    ),
    check(
      "Admin/course-manager attempt visibility policies exist",
      "supabase/migrations/050_fix_course_manager_visibility_and_profile_rls.sql",
      hasPattern("supabase/migrations/050_fix_course_manager_visibility_and_profile_rls.sql", /Course managers can view assessment attempts/) &&
        hasPattern("supabase/migrations/048_fix_staff_visibility_for_certificates_and_assessment_attempts.sql", /Admins can view all assessment attempts/),
      "Phase 6 should preserve staff visibility to `assessment_attempts` so analytics do not silently zero out.",
    ),
  ];

  const report = buildReport(results);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, report, "utf8");

  const failed = results.filter((result) => !result.passed);
  console.log(`Assessment reporting regression check complete. Report written to ${reportPath}`);
  console.log(JSON.stringify({ total: results.length, failed: failed.length }, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

main();