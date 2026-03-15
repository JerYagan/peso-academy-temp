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

const lacksPattern = (relativePath: string, pattern: RegExp) => {
  const content = readWorkspaceFile(relativePath);
  return !pattern.test(content);
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
    "# Phase 6 Reporting And Recommendation Regression Check",
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
      hasPattern("src/services/assessmentService.ts", /from\("assessment_attempts"\)[\s\S]*?update\(payload\)[\s\S]*?submitted_at:[\s\S]*?score:\s*score\s*\?\?\s*null,[\s\S]*?passed:\s*(?:passed\s*\?\?\s*null|null),[\s\S]*?time_spent:\s*timeSpent/s),
      "`submitAttempt` should continue writing `score` and a pass-state field onto `assessment_attempts`, including the manual-review path that leaves `passed` as null until review completes.",
    ),
    check(
      "Assessment submission still writes per-question answer rows",
      "src/services/assessmentService.ts",
      hasPattern("src/services/assessmentService.ts", /from\("assessment_answers"\)[\s\S]*?insert\(payload\)/s),
      "Graded assessments should keep persisting `assessment_answers` rows for downstream review and analytics consumers.",
    ),
    check(
      "Assessment submission still emits assessment_submit analytics",
      "src/services/assessmentService.ts",
      hasPattern("src/services/assessmentService.ts", /eventName:\s*"assessment_submit"/),
      "The assessment runtime should keep sending the `assessment_submit` analytics event.",
    ),
    check(
      "Enrollment progress combines completed modules and required graded assessments",
      "src/services/supabaseDatabaseService.ts",
      hasPattern("src/services/supabaseDatabaseService.ts", /const totalUnits = totalModules \+ requiredAssessmentCount;/) &&
        hasPattern("src/services/supabaseDatabaseService.ts", /const completedUnits = completedModules \+ completedAssessmentCount;/) &&
        hasPattern("src/services/supabaseDatabaseService.ts", /const progress = totalUnits > 0 \? Math\.round\(\(completedUnits \/ totalUnits\) \* 100\) : 0;/),
      "Learner progress should include both completed modules and required graded-assessment completion so 100 percent only appears when both paths are done.",
    ),
    check(
      "Course completion still requires both modules and graded assessments",
      "src/services/supabaseDatabaseService.ts",
      hasPattern("src/services/supabaseDatabaseService.ts", /const isCourseComplete = completedModules === totalModules && completedAssessmentCount === requiredAssessmentCount;/),
      "Completion approval should only begin after all modules and all required graded assessments are done.",
    ),
    check(
      "Completion approval stays pending until a trainer or admin approves",
      "src/services/supabaseDatabaseService.ts",
      hasPattern("src/services/supabaseDatabaseService.ts", /if \(completionState\.isCourseComplete\) \{[\s\S]*?if \(enrollment\.completion_approval_status === "approved"\) \{[\s\S]*?updateData\.status = "completed";[\s\S]*?\} else \{[\s\S]*?updateData\.status = "in-progress";[\s\S]*?updateData\.completion_approval_status = "pending";/s),
      "Course completion should stay in the approval queue until completion approval is explicitly granted.",
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
      "Reporting completion logic no longer treats 100 percent progress as completion",
      "src/services/reportingService.ts",
      lacksPattern("src/services/reportingService.ts", /progress >= 100|candidateProgress >= 100/),
      "Staff reporting and collaborative recommendation logic should rely on enrollment completion state, not raw progress alone.",
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
      "Course-scoped assessment attempt RLS no longer depends on module_id joins",
      "supabase/migrations/072_fix_course_scoped_assessment_attempt_rls.sql",
      hasPattern("supabase/migrations/072_fix_course_scoped_assessment_attempt_rls.sql", /JOIN public\.enrollments e ON e\.id = assessment_attempts\.enrollment_id/) &&
        hasPattern("supabase/migrations/072_fix_course_scoped_assessment_attempt_rls.sql", /e\.course_id = a\.course_id/) &&
        lacksPattern("supabase/migrations/072_fix_course_scoped_assessment_attempt_rls.sql", /JOIN public\.modules m ON m\.id = a\.module_id/),
      "Learners should be able to start attempts for course-level graded assessments whose `module_id` is null.",
    ),
    check(
      "Learner performance summary preserves course-scoped assessment fallback",
      "src/services/reportingService.ts",
      hasPattern("src/services/reportingService.ts", /select\("id, title, module_id, course_id, skill_tags, topic_tags"\)/) &&
        hasPattern("src/services/reportingService.ts", /return assessment\.course_id \? getTopicsForCourse\(assessment\.course_id\) : \[\];/),
      "Recommendation evidence should still derive topics from course-scoped assessments even when `module_id` is null.",
    ),
    check(
      "Assessment titles and course context in learner summaries can fall back from assessment course_id",
      "src/services/reportingService.ts",
      hasPattern("src/services/reportingService.ts", /const courseId = module\?\.course_id \|\| assessment\?\.course_id \|\| enrollment\?\.course_id;/),
      "Learner-facing assessment summaries should still resolve course context for course-level assessments.",
    ),
    check(
      "Practice quiz interactions are not treated as analytics scoring events",
      "src/components/course/ModuleContentViewer.tsx",
      lacksPattern("src/components/course/ModuleContentViewer.tsx", /analyticsService\.trackEvent|eventName:\s*"quiz/i),
      "Inline practice quizzes should not emit score-bearing analytics events from the module content viewer.",
    ),
    check(
      "Practice quizzes do not write graded assessment attempts or answer rows",
      "src/components/course/ModuleContentViewer.tsx",
      lacksPattern("src/components/course/ModuleContentViewer.tsx", /assessment_attempts|assessment_answers/),
      "Inline practice quizzes should stay separate from graded attempt persistence tables.",
    ),
    check(
      "Learner course page only opens completion review after approval queue starts",
      "src/pages/CourseDetail.tsx",
      hasPattern("src/pages/CourseDetail.tsx", /updatedEnrollment\.completionApprovalStatus === "pending"/) &&
        hasPattern("src/pages/CourseDetail.tsx", /enrollment\.completionApprovalStatus === "pending"/),
      "Learner completion messaging should wait for the approval queue instead of triggering from raw progress alone.",
    ),
    check(
      "Learner dashboard approval messaging keys off pending review state",
      "src/pages/Dashboard.tsx",
      hasPattern("src/pages/Dashboard.tsx", /const isAwaitingApproval = course\.enrollment\.completionApprovalStatus === "pending"(?:\s*&&\s*!isCompleted)?;/),
      "Dashboard course cards should only show the waiting-for-approval state when the completion queue is active.",
    ),
    check(
      "Trainer completion actions are tied to review state instead of progress percentage",
      "src/pages/trainer/Learners.tsx",
      hasPattern("src/pages/trainer/Learners.tsx", /const hasCompletionReviewState =/) &&
        lacksPattern("src/pages/trainer/Learners.tsx", /progress >= 100/),
      "Trainer learner lists should offer completion actions only for enrollments already in the review workflow.",
    ),
    check(
      "Trainer learner progress page is tied to review state instead of progress percentage",
      "src/pages/trainer/LearnerProgressPage.tsx",
      hasPattern("src/pages/trainer/LearnerProgressPage.tsx", /const hasCompletionReviewState =/) &&
        lacksPattern("src/pages/trainer/LearnerProgressPage.tsx", /progress >= 100/),
      "Trainer learner progress detail should use the completion review state when deciding whether to expose approval actions.",
    ),
    check(
      "Admin completion actions are tied to review state instead of progress percentage",
      "src/pages/admin/EnrollmentProgressPage.tsx",
      hasPattern("src/pages/admin/EnrollmentProgressPage.tsx", /const hasCompletionReviewState =/) &&
        lacksPattern("src/pages/admin/EnrollmentProgressPage.tsx", /progress >= 100/),
      "Admin completion controls should only appear for enrollments that have entered the completion workflow.",
    ),
    check(
      "Assessment-only recommendations still require scored graded assessments",
      "src/services/reportingService.ts",
      hasPattern("src/services/reportingService.ts", /if \(!performanceSummary \|\| performanceSummary\.scoredAssessments <= 0\) \{/),
      "Assessment-only recommendation mode should stay anchored to scored graded assessments, not practice-quiz activity.",
    ),
    check(
      "Hybrid recommendations still blend assessment results with module and session momentum",
      "src/services/reportingService.ts",
      hasPattern("src/services/reportingService.ts", /const learningMomentum = modulesCompleted >= 3 \|\| totalLearningMinutes >= 180;/) &&
        hasPattern("src/services/reportingService.ts", /const performingStrongly = averageAssessmentScore >= 85 && overallModuleCompletionRate >= 60;/),
      "The hybrid recommendation model should keep combining module progress signals with scored assessment performance.",
    ),
    check(
      "Admin reports still load the full staff-visible course catalog",
      "src/pages/admin/Reports.tsx",
      hasPattern("src/pages/admin/Reports.tsx", /const \[allCourses, allPrograms\] = await Promise\.all\(\[[\s\S]*?courseService\.getCourses\(\)[\s\S]*?programService\.getPrograms\(\)[\s\S]*?\]\);/s) &&
        hasPattern("src/pages/admin/Reports.tsx", /setCourses\(allCourses\);/) &&
        lacksPattern("src/pages/admin/Reports.tsx", /filterCoursesForUser/),
      "The admin reports catalog should keep using the raw staff-visible course list so reporting filters remain complete across all courses.",
    ),
    check(
      "Learner browse catalog keeps filtering courses by audience before display",
      "src/pages/Courses.tsx",
      hasPattern("src/pages/Courses.tsx", /const allCourses = await courseService\.getCourses\(\);/) &&
        hasPattern("src/pages/Courses.tsx", /setCourses\(filterCoursesForUser\(allCourses, user\)\);/),
      "The learner catalog should continue narrowing course cards to audience-allowed rows even if a stale cache or mixed session slips past RLS.",
    ),
    check(
      "Learner dashboard recommendation inputs stay limited to visible courses",
      "src/pages/Dashboard.tsx",
      hasPattern("src/pages/Dashboard.tsx", /const visibleCourses = filterCoursesForUser\(allCourses, user\);/) &&
        hasPattern("src/pages/Dashboard.tsx", /setAllCourses\(visibleCourses\);/),
      "Dashboard recommendations and learner summary cards should continue deriving from the already-filtered visible course list.",
    ),
    check(
      "Recommendation sync persists only learner-visible course candidates",
      "src/services/recommendationSyncService.ts",
      hasPattern("src/services/recommendationSyncService.ts", /const visibleCourses = filterCoursesForUser\(courses, normalizedUser\);/) &&
        hasPattern("src/services/recommendationSyncService.ts", /buildLearnerCourseRecommendations\([\s\S]*?visibleCourses,[\s\S]*?\)/s),
      "Profile-driven recommendation refresh should only persist courses the learner is allowed to see.",
    ),
    check(
      "Admin analytics still count all staff-visible courses and map chart labels from course titles",
      "src/services/reportingService.ts",
      hasPattern("src/services/reportingService.ts", /const courseTitleMap = new Map\(courses\.map\(\(course\) => \[course\.id, course\.title\]\)\);/) &&
        hasPattern("src/services/reportingService.ts", /totalCourses: courses\.length,/) &&
        hasPattern("src/services/reportingService.ts", /const recommendationCourseMap = new Map<string, AdminRecommendationCourseInsight/),
      "Staff analytics should remain complete across all courses, and the added trainee audience field must not disrupt existing chart title hydration.",
    ),
    check(
      "Trainer analytics still summarize the full trainer-visible course set",
      "src/services/reportingService.ts",
      hasPattern("src/services/reportingService.ts", /const courseMap = new Map\(visibleCourses\.map\(\(course\) => \[course\.id, course\]\)\);/) &&
        hasPattern("src/services/reportingService.ts", /totalCourses: visibleCourses\.length,/),
      "Trainer-facing analytics should continue covering every course in the trainer-visible catalog instead of being narrowed by learner audience rules.",
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
  console.log(`Phase 6 reporting and recommendation regression check complete. Report written to ${reportPath}`);
  console.log(JSON.stringify({ total: results.length, failed: failed.length }, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

main();