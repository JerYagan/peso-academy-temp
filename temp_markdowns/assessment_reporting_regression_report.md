# Phase 6 Reporting And Recommendation Regression Check

Generated: 2026-03-15T17:44:34.410Z

## Summary

- Total checks: 32
- Passed: 32
- Failed: 0

## Checks

### PASS: Assessment submission persists score and pass/fail to attempts
- File: src/services/assessmentService.ts
- Detail: `submitAttempt` should continue writing `score` and a pass-state field onto `assessment_attempts`, including the manual-review path that leaves `passed` as null until review completes.

### PASS: Assessment submission still writes per-question answer rows
- File: src/services/assessmentService.ts
- Detail: Graded assessments should keep persisting `assessment_answers` rows for downstream review and analytics consumers.

### PASS: Assessment submission still emits assessment_submit analytics
- File: src/services/assessmentService.ts
- Detail: The assessment runtime should keep sending the `assessment_submit` analytics event.

### PASS: Enrollment progress combines completed modules and required graded assessments
- File: src/services/supabaseDatabaseService.ts
- Detail: Learner progress should include both completed modules and required graded-assessment completion so 100 percent only appears when both paths are done.

### PASS: Course completion still requires both modules and graded assessments
- File: src/services/supabaseDatabaseService.ts
- Detail: Completion approval should only begin after all modules and all required graded assessments are done.

### PASS: Completion approval stays pending until a trainer or admin approves
- File: src/services/supabaseDatabaseService.ts
- Detail: Course completion should stay in the approval queue until completion approval is explicitly granted.

### PASS: Assessment submission still refreshes phase 1 rollups
- File: src/services/assessmentService.ts
- Detail: Learner/reporting rollups should still refresh immediately after assessment submission.

### PASS: Learner performance summary averages scored attempts
- File: src/services/reportingService.ts
- Detail: Learner-facing summaries should continue computing average assessment score from scored attempts.

### PASS: Reporting completion logic no longer treats 100 percent progress as completion
- File: src/services/reportingService.ts
- Detail: Staff reporting and collaborative recommendation logic should rely on enrollment completion state, not raw progress alone.

### PASS: Trainer/admin visible attempt loading still uses assessment_attempts score fields
- File: src/services/reportingService.ts
- Detail: Staff reporting fallback queries should still read `score` and `passed` from `assessment_attempts`.

### PASS: Trainer attempt RPC remains in place
- File: src/services/reportingService.ts
- Detail: Trainer-visible reporting should keep using the course-manager assessment attempt RPC when available.

### PASS: Analytics SQL rollups still aggregate average assessment score from assessment_attempts.score
- File: supabase/migrations/040_add_session_rollup_metrics.sql
- Detail: Phase 1 analytics SQL should still derive average assessment score directly from `assessment_attempts.score`.

### PASS: Analytics SQL still joins from assessment_attempts for learner/topic rollups
- File: supabase/migrations/040_add_session_rollup_metrics.sql
- Detail: Rollups should continue using submitted assessment attempts as the source of learner assessment evidence.

### PASS: Course-scoped assessment attempt RLS no longer depends on module_id joins
- File: supabase/migrations/072_fix_course_scoped_assessment_attempt_rls.sql
- Detail: Learners should be able to start attempts for course-level graded assessments whose `module_id` is null.

### PASS: Learner performance summary preserves course-scoped assessment fallback
- File: src/services/reportingService.ts
- Detail: Recommendation evidence should still derive topics from course-scoped assessments even when `module_id` is null.

### PASS: Assessment titles and course context in learner summaries can fall back from assessment course_id
- File: src/services/reportingService.ts
- Detail: Learner-facing assessment summaries should still resolve course context for course-level assessments.

### PASS: Practice quiz interactions are not treated as analytics scoring events
- File: src/components/course/ModuleContentViewer.tsx
- Detail: Inline practice quizzes should not emit score-bearing analytics events from the module content viewer.

### PASS: Practice quizzes do not write graded assessment attempts or answer rows
- File: src/components/course/ModuleContentViewer.tsx
- Detail: Inline practice quizzes should stay separate from graded attempt persistence tables.

### PASS: Learner course page only opens completion review after approval queue starts
- File: src/pages/CourseDetail.tsx
- Detail: Learner completion messaging should wait for the approval queue instead of triggering from raw progress alone.

### PASS: Learner dashboard approval messaging keys off pending review state
- File: src/pages/Dashboard.tsx
- Detail: Dashboard course cards should only show the waiting-for-approval state when the completion queue is active.

### PASS: Trainer completion actions are tied to review state instead of progress percentage
- File: src/pages/trainer/Learners.tsx
- Detail: Trainer learner lists should offer completion actions only for enrollments already in the review workflow.

### PASS: Trainer learner progress page is tied to review state instead of progress percentage
- File: src/pages/trainer/LearnerProgressPage.tsx
- Detail: Trainer learner progress detail should use the completion review state when deciding whether to expose approval actions.

### PASS: Admin completion actions are tied to review state instead of progress percentage
- File: src/pages/admin/EnrollmentProgressPage.tsx
- Detail: Admin completion controls should only appear for enrollments that have entered the completion workflow.

### PASS: Assessment-only recommendations still require scored graded assessments
- File: src/services/reportingService.ts
- Detail: Assessment-only recommendation mode should stay anchored to scored graded assessments, not practice-quiz activity.

### PASS: Hybrid recommendations still blend assessment results with module and session momentum
- File: src/services/reportingService.ts
- Detail: The hybrid recommendation model should keep combining module progress signals with scored assessment performance.

### PASS: Admin reports still load the full staff-visible course catalog
- File: src/pages/admin/Reports.tsx
- Detail: The admin reports catalog should keep using the raw staff-visible course list so reporting filters remain complete across all courses.

### PASS: Learner browse catalog keeps filtering courses by audience before display
- File: src/pages/Courses.tsx
- Detail: The learner catalog should continue narrowing course cards to audience-allowed rows even if a stale cache or mixed session slips past RLS.

### PASS: Learner dashboard recommendation inputs stay limited to visible courses
- File: src/pages/Dashboard.tsx
- Detail: Dashboard recommendations and learner summary cards should continue deriving from the already-filtered visible course list.

### PASS: Recommendation sync persists only learner-visible course candidates
- File: src/services/recommendationSyncService.ts
- Detail: Profile-driven recommendation refresh should only persist courses the learner is allowed to see.

### PASS: Admin analytics still count all staff-visible courses and map chart labels from course titles
- File: src/services/reportingService.ts
- Detail: Staff analytics should remain complete across all courses, and the added trainee audience field must not disrupt existing chart title hydration.

### PASS: Trainer analytics still summarize the full trainer-visible course set
- File: src/services/reportingService.ts
- Detail: Trainer-facing analytics should continue covering every course in the trainer-visible catalog instead of being narrowed by learner audience rules.

### PASS: Admin/course-manager attempt visibility policies exist
- File: supabase/migrations/050_fix_course_manager_visibility_and_profile_rls.sql
- Detail: Phase 6 should preserve staff visibility to `assessment_attempts` so analytics do not silently zero out.
