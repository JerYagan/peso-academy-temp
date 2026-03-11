# Assessment Reporting Regression Check

Generated: 2026-03-11T20:11:47.020Z

## Summary

- Total checks: 9
- Passed: 9
- Failed: 0

## Checks

### PASS: Assessment submission persists score and pass/fail to attempts
- File: src/services/assessmentService.ts
- Detail: `submitAttempt` should continue writing `score` and `passed` onto `assessment_attempts`.

### PASS: Assessment submission still emits assessment_submit analytics
- File: src/services/assessmentService.ts
- Detail: The assessment runtime should keep sending the `assessment_submit` analytics event.

### PASS: Assessment submission still refreshes phase 1 rollups
- File: src/services/assessmentService.ts
- Detail: Learner/reporting rollups should still refresh immediately after assessment submission.

### PASS: Learner performance summary averages scored attempts
- File: src/services/reportingService.ts
- Detail: Learner-facing summaries should continue computing average assessment score from scored attempts.

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

### PASS: Admin/course-manager attempt visibility policies exist
- File: supabase/migrations/050_fix_course_manager_visibility_and_profile_rls.sql
- Detail: Phase 6 should preserve staff visibility to `assessment_attempts` so analytics do not silently zero out.
