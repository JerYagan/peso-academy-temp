# Practice Quiz and Graded Assessment Plan

## Goal

- [ ] Keep module quiz blocks as practice-only learning aids.
- [ ] Count only graded assessment attempts in analytics, reporting, and recommendation scoring.
- [ ] Let learners move through module content and prerequisite chains without trainer or validator intervention.
- [ ] Add a clear `Next Module` action at the end of module content.
- [ ] Add an explicit course-level graded assessment authoring option in module creation and editing, separate from inline practice quizzes.

## Product Decisions To Lock

- [ ] Inline module quiz blocks are formative only. They give immediate feedback in content, but they do not create scored records used by analytics or recommendations.
- [ ] Graded assessments remain the only scored artifact. They continue writing to `assessment_attempts` and related tables so reporting and recommendation pipelines stay stable.
- [x] Graded assessments are course-scoped, not module-scoped. A course can expose optional graded assessments that unlock only after the learner completes trainer-selected prerequisite modules.
- [ ] Module unlock and course progress must be based on module completion state, not on passing a graded assessment.
- [ ] Module prerequisites are satisfied by completion of the required earlier module, even if the learner has not taken or passed the module assessment yet.
- [x] No validator involvement is required for routine trainee assessment progression. Essay and manual-review assessment types remain supported, but they must not block module navigation.
- [x] Course completion and certificate release remain trainer/admin controlled even after learners finish modules and any configured graded assessment requirements.
- [ ] The separate assessment option in authoring should support its own points, correct answers, passing score, grading rules, and prerequisite-module selection instead of deriving those fields from practice quiz blocks.

## Current State And Conflict

- [x] The current implementation intentionally made module quiz blocks the source of truth for graded assessments.
- [x] `getEnrollmentCompletionState(...)` currently treats passed assessments as part of progress, so learners cannot reach full completion from module completion alone.
- [x] The learner module surface already auto-completes content-only modules after enough viewing time, but graded assessments still sit on the critical path for progress and completion.
- [x] The learner assessment runtime and reporting stack are already wired to `assessment_attempts`, which is useful and should be preserved.

This request changes the direction from the existing derived-assessment model. The implementation should therefore decouple practice quizzes from graded assessments rather than extend the current derivation behavior.

## Target Architecture

### 1. Practice Quiz Layer

- [ ] Keep quiz blocks inside module content for immediate learner practice.
- [ ] Preserve question text, options, and optional explanatory feedback in the content block schema.
- [ ] Remove scoring consequences from practice quiz submissions. Practice interactions can still be tracked as lightweight engagement analytics if needed, but not as grade-bearing records.

### 2. Graded Assessment Layer

- [x] Keep course-level graded assessments optional per course, and allow trainer/admin users to add multiple graded assessments when needed, authored from the module creation and editing flow in dedicated assessment panels tied to the course.
- [ ] Store assessment metadata and scored questions in `assessments` and `assessment_questions`, but treat the record as course-scoped and not owned by a single module.
- [x] Add a prerequisite-module selector that allows any module combination so trainer/admin users can choose which completed modules unlock each graded assessment for learners.
- [ ] Allow trainers to optionally copy question text from an existing practice quiz block as a starting point, but once created the graded assessment remains its own source of truth.
- [x] Keep assessment questions open to both auto-graded and essay/manual-review types, while ensuring the manual-review path does not stop learners from continuing through modules.
- [ ] Make the learner-facing unlock state explicit so the assessment stays hidden or disabled until all selected prerequisite modules are completed.

### 3. Progression Layer

- [ ] Mark module completion from learner content completion rules, not from graded assessment pass state.
- [ ] Unlock the next module when prerequisite modules are completed.
- [ ] Keep course progress percentage based on completed modules only.
- [ ] Treat graded assessments as optional score signals for analytics and recommendations unless product separately decides they are required evidence for trainer/admin completion approval.
- [ ] Keep final course completion approval and certificate release under trainer/admin control even after learners complete all modules.

### 4. Completion Approval Layer

- [ ] Let learners complete modules and access the course-level graded assessment without needing trainer or validator intervention.
- [ ] Keep the final step that marks an enrollment as course-complete under trainer/admin action.
- [ ] Allow trainers/admins to use module completion, graded assessment performance, and any additional business checks before approving completion and releasing certification.
- [x] Preserve the current manual trainer/admin approval direction for certificates unless product explicitly changes that policy later.

### 5. Navigation Layer

- [ ] Add a `Next Module` button at the bottom of the learner module viewer.
- [ ] If another accessible module exists, switch directly into it.
- [ ] If the learner is on the last accessible module, show a return-to-module-list or course-summary action instead.

## Phase Plan

## Phase 0. Scope Lock And Policy Cleanup

- [x] Confirm whether the course-level graded assessment is optional for every course or required only for selected course types. Decision: Make it optional.
- [x] Confirm whether a course can have only one graded assessment in v1 or whether multiple course-level assessments are expected later. Decision: Trainer/admin users can add multiple graded assessments.
- [x] Confirm whether the prerequisite-module selector should allow any module combination or only sequential milestone checkpoints. Decision: Allow any module combination.
- [x] Confirm whether any essay or manual-review assessment type is still needed. Decision: Keep essay/manual-review assessment types.
- [x] Confirm whether course completion approval and certificate release remain trainer-controlled. Decision: Keep trainer/admin completion approval.
- [x] Remove outdated product copy that says quiz blocks are the source of truth for grading. Decision: Update copy to reflect the new separation of practice quizzes and graded assessments.
- [x] Add a QA phase to the implementation plan to verify whether the system counts graded assessments correctly for progress, analytics, and recommendations while ignoring practice quizzes, with explicit hybrid predictive analytics regression coverage.

### Phase 0 Notes

- Course-level graded assessments are optional. Courses can ship with none, one, or multiple graded assessments.
- Each graded assessment can unlock from any module combination selected by trainer/admin authors, not only sequential milestone checkpoints.
- Essay and manual-review assessment types remain in scope, but module progression must stay self-service and must not wait on review completion.
- Course completion approval and certificate release remain trainer/admin controlled even after learner-side requirements are done.
- All product and implementation copy should describe practice quizzes and graded assessments as separate systems with different purposes.

## Phase 1. Authoring Model Separation

- [x] Update module creation and editing so practice quizzes remain in the content tab only.
- [x] Replace the current derived-assessment summary behavior with a dedicated course-level graded assessment option that owns its own questions, grading rules, and prerequisite-module selection.
- [x] Keep practice quiz authoring lightweight and feedback-oriented.
- [x] Keep graded assessment authoring explicit and structured around points, correct answers, passing score, scoring rules, and unlock prerequisites.
- [x] Add an `Import from practice quiz` helper so trainers can reuse wording without dual manual re-entry.

Primary files:

- `src/pages/trainer/ModuleEditorPage.tsx`
- `src/components/course/ModuleManagementDialog.tsx`
- `src/components/course/ContentBlock.tsx`
- `src/lib/contentBlocks.ts`
- `src/services/assessmentService.ts`
- related course assessment schema and type definitions

### Phase 1 Notes

- Module editing now separates practice quiz authoring from graded assessment authoring. Practice quizzes stay in the Content tab, while scored assessments live in a dedicated Graded Assessments tab.
- Practice quiz blocks were updated to use practice-only copy and lightweight formative feedback editing instead of assessment-derived scoring language.
- The trainer editor now supports multiple course-level graded assessments, per-assessment prerequisite module selection, explicit question editing, and manual import of practice quiz wording into graded assessment drafts.
- `assessmentService` now supports loading, saving, and deactivating course-scoped assessments without using the quiz-block derivation path.
- Added `supabase/migrations/070_add_course_scoped_assessments.sql` to support course-linked assessments with nullable `module_id` and `prerequisite_module_ids`.
- The legacy `src/components/course/ModuleManagementDialog.tsx` path referenced in the original checklist does not exist in the current workspace, so the Phase 1 authoring implementation landed in the active trainer module editor surface instead.

## Phase 2. Remove Derived Sync As The Default Path

- [x] Stop auto-generating `assessments` and `assessment_questions` from module quiz blocks on save.
- [x] Shift assessment ownership from module-linked derived records to course-linked graded assessments with prerequisite-module metadata.
- [x] Preserve existing assessment read paths for learners and reports.
- [x] Add compatibility handling for modules that already have derived assessments so old data does not disappear.
- [x] Decide whether to keep derived-assessment mapping columns as legacy fields for migration history or remove them later after cleanup. Decision: keep them as legacy fields until migration cleanup is complete.

Primary files:

- `src/services/assessmentService.ts`
- trainer module save flows in `src/pages/trainer/ModuleEditorPage.tsx`
- trainer/admin module management surfaces in `src/components/course/ModuleManagementDialog.tsx`
- `src/types/index.ts`
- `src/types/database.ts`
- related Supabase migration files

### Phase 2 Notes

- `ModuleEditorPage` no longer saves quiz-derived assessments when a module is created or updated. Explicit course-scoped graded assessments are now the default authoring path.
- `assessmentService.getAssessmentByModule(...)` was changed to a compatibility read for legacy module-linked assessments only. It no longer auto-syncs or derives assessment rows from module content during reads.
- Course-scoped assessment ownership now lives in the shared service layer, while legacy module-linked assessments remain readable so older learner flows and historical data are not dropped.
- Enrollment progress detail and related staff/reporting reads were updated to return both legacy module-linked assessments and new course-scoped assessments.
- Shared app and database types were expanded so course-scoped assessments can carry `courseId`, optional `moduleId`, prerequisite-module ids, and legacy derived flags without losing older data shape support.
- Derived assessment mapping columns such as `derived_from_module_quiz`, `source_question_key`, and `is_active` are intentionally kept for now as legacy migration/history fields. Removal is deferred until cleanup and backfill work is done safely.
- The original checklist still mentions `src/components/course/ModuleManagementDialog.tsx`, but that surface does not exist in the current workspace. The Phase 2 implementation therefore landed in the active assessment service, shared types, reporting/detail layer, and trainer module editor flow.

## Phase 3. Learner Progress And Prerequisite Rewrite

- [x] Change enrollment progress calculation so completed modules and required graded-assessment completion both count toward progress.
- [x] Keep prerequisite checks tied to completed modules only so assessment status does not block opening the next module.
- [x] Ensure learners can open the next module as soon as the required earlier module is marked complete.
- [x] Make sure course-level assessment submission still records score without determining whether the learner can continue learning through modules.
- [x] Require graded-assessment completion before learner progress can reach 100%, before the course is ready for completion approval, and before certificates can be released.
- [x] Keep trainer/admin completion approval as the only action that flips the enrollment into completed state and enables certificate release.

Primary files:

- `src/services/supabaseDatabaseService.ts`
- `src/services/assessmentService.ts`
- `src/pages/CourseDetail.tsx`
- trainer/admin completion approval surfaces
- any helper that computes learner access or completion state

### Phase 3 Notes

- Enrollment progress now combines completed modules with required graded-assessment completion, so learners do not reach 100% until both the module path and the required assessment path are complete.
- `getEnrollmentCompletionState(...)` now treats a course as learner-ready only when all required modules are complete and all required graded assessments have been submitted, while still leaving final enrollment completion under trainer/admin approval.
- Learner module access continues to use completed-module prerequisite checks only, so the next module unlocks immediately after the required earlier module is marked complete even if the graded assessment is still pending.
- Assessment submission and manual review still store scores, pass/fail, answer rows, notifications, and analytics events, but they no longer auto-complete modules or block module-to-module progression.
- Enrollment read paths now reconcile stored progress before rendering so older enrollments with stale percentages are refreshed to the current module-plus-assessment formula as soon as learner or staff pages load them.
- Staff `View Progress` now opens as a dedicated, vertically scrollable page for both admin and trainer review flows instead of a constrained modal.

### Trainer/Admin
- [x] Change View Progress so it opens as a separate page instead of a modal.
- [x] Make the progress page vertically scrollable so trainers can review learner data without modal size constraints.

## Phase 4. Learner UX Changes

- [x] In `ModuleContentViewer`, keep practice quizzes answerable inline with immediate feedback.
- [x] Present the course-level graded assessment as a separate optional activity card or tab section once its prerequisite modules are complete.
- [x] Add a bottom-of-page `Next Module` button when the current module is complete or when the learner has reached the end of the content.
- [x] Make the button smart about the next accessible module based on prerequisite rules.
- [x] Keep a fallback CTA such as `Back to Modules` when there is no next accessible module.
- [x] Show a clear locked-state message for the graded assessment when prerequisite modules are still incomplete.

Primary files:

- `src/components/course/ModuleContentViewer.tsx`
- `src/pages/CourseDetail.tsx`
- `src/components/course/AssessmentInterface.tsx`

### Phase 4 Notes

- `ModuleContentViewer` now keeps quiz blocks inline as practice-only prompts with immediate feedback and no embedded graded-assessment runner.
- `CourseDetail` now renders graded assessments as a separate learner activity section, including locked-state prerequisite messaging, per-assessment selection, and inline launch of the selected assessment.
- `AssessmentInterface` now supports loading a course-scoped assessment directly by assessment id so the learner can take it outside the module-content stream.
- The learner course page now ends with a navigation card that sends the learner to the next currently accessible module when one exists and falls back to `Back to Modules` otherwise.

### Changes
- On the learner's side: Make the sidebar area of the course page render the thumbnails for modules and assessments. Also make it sticky

## Phase 5. Analytics And Recommendation Guardrails

- [x] Verify that analytics and recommendation inputs continue reading only from scored assessment attempts.
- [x] Verify that course-level graded assessments still feed the same analytics and recommendation paths after moving away from module-linked assessment ownership.
- [x] Ensure practice quiz events, if logged, are categorized as engagement or formative signals and are excluded from score rollups.
- [x] Recheck dashboards, learner summaries, trainer analytics, admin reports, and recommendation scoring so none of them accidentally consume practice quiz outcomes.

Primary files:

- `src/services/reportingService.ts`
- analytics SQL or rollup migrations under `supabase/migrations/`
- `scripts/check-assessment-reporting-regressions.ts`

## Phase 6. QA And Hybrid Recommendation Regression

- [x] Verify that graded assessments still write the expected `assessment_attempts` and related answer records for analytics consumers.
- [x] Verify that practice quizzes do not write grade-bearing attempt data and do not contaminate score rollups.
- [x] Regression-test hybrid predictive analytics and recommendation outputs so changes to assessment ownership or scoring inputs do not skew learner recommendations.
- [x] Re-run staff and learner reporting checks for visibility, score aggregation, certificate gating, and completion approval workflows after the model change.
- [x] Add or update automated smoke-check scripts so future changes can validate the separation between practice quiz signals and graded assessment signals.

Primary files:

- `src/services/reportingService.ts`
- analytics SQL or rollup migrations under `supabase/migrations/`
- `scripts/check-assessment-reporting-regressions.ts`
- `temp_markdowns/recommendation_algorithm_system_documentation.md`
- related QA notes or regression reports under `temp_markdowns/`

## Phase 7. Migration And Cleanup

- [x] Audit existing modules for these states:
  - practice quizzes only
  - standalone graded assessments only
  - both present
  - legacy derived assessments from quiz blocks
- [x] For legacy derived assessments, decide whether to convert them into course-level graded assessments with prerequisite metadata or mark them for trainer review.
- [x] Remove or archive UI labels and developer notes that describe quiz blocks as the graded source of truth.
- [x] Update seed content and internal docs so new sample modules follow the new separation model.

Primary files:

- `scripts/audit-derived-assessments.ts`
- `scripts/seed-course-content.ts`
- `temp_markdowns/assessment_workflow_and_platform_updates_plan.md`
- Supabase migrations or SQL helpers as needed

### Phase 7 Notes

- `scripts/audit-derived-assessments.ts` now audits modules by the separated model: `practice_quizzes_only`, `standalone_graded_assessments_only`, `both_present`, `legacy_derived_assessments`, and `no_assessment_source`.
- The audit now makes a migration decision for each legacy derived assessment: either convert it to a course-level graded assessment with `prerequisite_module_ids = [moduleId]` or leave it in a trainer-review queue.
- `scripts/seed-course-content.ts` now seeds standalone course-level graded assessments unlocked by module completion instead of module-linked graded rows, while keeping inline quiz blocks as practice content.
- Legacy UI and script copy that described quiz blocks as the graded source of truth was replaced with migration-review wording.

### Changes
Learner's side:
- Dashboard: Add the course thumbnail in the courses inside My Courses section

Admin and Trainer side:
- Make the modal horizontally scrollable and make sure that the right side area is sticky

## Recommended Implementation Order

- [x] Lock product decisions for course-level assessment scope, prerequisite-module unlock rules, supported manual-review types, and trainer/admin completion approval.
- [ ] Separate trainer authoring so practice quizzes and graded assessments no longer share the same source of truth.
- [ ] Introduce course-level assessment ownership and prerequisite metadata while preserving read compatibility for existing assessments.
- [ ] Rewrite progress and prerequisite calculations to depend on module completion only.
- [ ] Update learner surfaces to expose the locked or unlocked course-level assessment and add `Next Module` navigation.
- [ ] Run reporting, QA, and hybrid recommendation regression checks.
- [ ] Audit and clean legacy derived assessment data.

## Verification Checklist

- [ ] Completing a module unlocks the next prerequisite-dependent module even if the learner skips the graded assessment.
- [ ] Completing the trainer-selected prerequisite modules unlocks each course-level graded assessment tied to that module combination.
- [ ] Enrollment progress reaches 100% when all modules are complete, without requiring passed assessments.
- [ ] Practice quiz interactions never write grade-bearing `assessment_attempts` rows.
- [ ] Submitting the course-level graded assessment still writes `assessment_attempts` and still feeds analytics and recommendations.
- [ ] Essay or manual-review graded assessments do not block module progression while still preserving their review workflow and reporting data.
- [ ] The learner can move to the next module directly from the module viewer.
- [ ] Trainer/admin completion approval remains required before the enrollment is marked complete and before certificate release is allowed.
- [ ] Trainer authoring no longer forces duplicate question entry and no longer treats practice quizzes as the grading source of truth.
- [ ] Hybrid predictive analytics and learner recommendations continue using graded assessment data without accidentally incorporating practice quiz activity as score input.

## Risks And Watchouts

- [ ] Existing documentation and code currently assume derived assessments from quiz blocks; partial implementation will create inconsistent trainer expectations.
- [ ] Moving from module-linked assessments to a course-level assessment with prerequisite metadata will require careful schema and type updates across learner loading, trainer authoring, and reporting joins.
- [ ] If course completion approval currently depends on `progress === 100`, changing the progress formula may also affect completion-review and certificate flows. That is manageable, but it must be regression-tested.
- [ ] Old modules with derived assessments may remain technically valid, but staff should know whether those assessments are still authoritative or should be rebuilt in the new dedicated assessment editor.

## Suggested Output Of This Change

- [ ] Learners practice freely inside module content without score pressure.
- [ ] Trainers keep scored assessments separate, explicit, and course-scoped.
- [ ] Analytics and recommendations rely only on graded assessment attempts.
- [ ] Module progression becomes self-service and module-completion driven.
- [ ] Final completion and certificate release stay under trainer/admin control.
- [ ] The learner flow gains a direct `Next Module` path that reduces friction between modules.


