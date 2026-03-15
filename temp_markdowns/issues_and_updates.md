<!--
User credentials:
- Admin: admin@peso.academy
- Trainer: trainer@peso.academy
- Jobseeker: jobseeker@peso.academy
- Validator: validator@peso.academy
 -->

### System
- [ ] Landing page: there are still some icons with white/transparent bg

### Admin & Trainer & Trainee

### Admin

### Course/Module Creation
- [ ] Add others in course category dropdown and add a note to choose the closest approved skill and topic tags for reporting and recommendations to work properly.

### Registration
- [ ] Registered account goes to Auth but not in the users table. This causes issues for admin when trying to manage users and for trainers when trying to assign courses to users.

### Trainer & Admin & Course Creation

Archived historical note: the block below describes the earlier quiz-derived assessment approach and is no longer the active product direction. The current model keeps practice quiz blocks formative and keeps graded assessments as standalone records.

- [ ] Assessment score should be the quiz block score and not a separate field that the trainer has to fill in. This is to avoid discrepancies and extra work for the trainer. The quiz block score should be automatically calculated based on the questions and answers in the quiz block. Assessment is the quizzes in each modules. Create an implementation plan so we can address this problem.
	- Root cause
		- The platform currently has two parallel quiz systems: module `quiz` content blocks inside module content, and a separate assessment builder backed by `assessments` and `assessment_questions`.
		- Learners are graded from the separate assessment tables, while quiz blocks are only rendered inline inside module content. This creates duplicate authoring work and allows module quiz content and recorded assessment scores to drift apart.
	- Target decision
		- Make module quiz blocks the single source of truth for module assessments.
		- Keep `assessment_attempts` as the scored learner-attempt record so existing reporting, dashboards, and recommendation features continue to work.
		- Replace manual question entry in the assessment editor with an auto-generated assessment derived from quiz blocks in the module content.
	- Phase 1: define the canonical model
		- [x] Extend the quiz block schema so each quiz block can fully represent a graded assessment question. Added shared quiz block fields for `points`, `questionType`, `sourceQuestionKey`, and `isGradable` in a shared content-block utility.
		- Decide the supported grading scope for v1. Recommended: auto-grade only `multiple_choice` and `true_false`, and either block `short_answer`/`essay` from module quiz assessments or clearly mark them as not counted until manual grading is designed.
		- [x] Keep `passingScore` as the pass/fail threshold, but stop treating question creation as a separate assessment-authoring workflow.
		- [x] Add a shared parser/normalizer so legacy module content with older quiz blocks is normalized into the canonical quiz-block shape before editor, preview, and viewer rendering.
		- Phase 1 implementation status on March 12, 2026
			- Added `src/lib/contentBlocks.ts` as the shared content-block model and parser.
			- Reused the shared parser in trainer module editing, trainer module management, module preview, learner module viewer, and trainer module list block counting.
			- Added canonical quiz block defaults for newly created quiz blocks so new content starts with `points`, `questionType`, `sourceQuestionKey`, and `isGradable`.
			- Updated the quiz block editor UI to expose `questionType` and `points` so newly authored content follows the canonical model immediately.
			- Validation result: editor diagnostics were clean after the change, and a clean-shell `npm run build` completed without reported errors. Existing chunk-size warning remains.
	- Phase 2: authoring UX changes for admin and trainer
		- [x] Update the module editor and module management dialog so quiz blocks include all grading fields needed for assessment use.
		- [x] Remove or heavily simplify the separate assessment question editor. The assessment panel now acts as assessment metadata plus a read-only derived quiz summary.
		- [x] Add validation before save/publish: a graded module assessment must have at least one valid quiz block, each quiz block must have at least two options for multiple choice, one correct answer, and a positive point value.
		- [x] Show a computed assessment summary in the editor such as total questions, total points, auto-calculated score basis, and which blocks are counted.
		- Phase 2 implementation status on March 12, 2026
			- Added shared validation and summary helpers in `src/lib/contentBlocks.ts` for gradable quiz blocks.
			- Added `src/components/course/DerivedAssessmentSummary.tsx` and reused it in both trainer authoring surfaces.
			- Updated `src/pages/trainer/ModuleEditorPage.tsx` so the assessment panel is metadata-only and blocks invalid assessment saves or invalid finalize flows when an assessment already exists.
			- Updated `src/components/course/ModuleManagementDialog.tsx` so the assessment tab no longer acts as a separate question bank editor.
			- Validation result: editor diagnostics were clean after the change, and a clean-shell `npm run build` completed without reported errors.
	- Phase 3: derived assessment sync layer
		- [x] On module save, parse the saved content blocks and derive the module assessment payload automatically.
		- [x] Create or update the module's `assessments` row from module quiz metadata instead of manual question form entry.
		- [x] Create, update, reorder, or deactivate `assessment_questions` rows from the quiz blocks so the learner assessment runtime can keep using the existing tables and attempt flow.
		- [x] Add a stable mapping between quiz blocks and `assessment_questions` rows to avoid duplicating questions on every edit.
		- Phase 3 implementation status on March 12, 2026
			- Added `supabase/migrations/052_add_derived_assessment_question_mapping.sql` to store stable derived-assessment mapping fields on `assessments` and `assessment_questions`.
			- Extended `src/services/assessmentService.ts` with row mappers plus `syncDerivedAssessmentFromQuizBlocks(...)`, which derives assessment metadata from module quiz blocks and performs deterministic create, update, reorder, and soft-deactivate behavior for questions.
			- Updated both trainer save surfaces so module saves and assessment metadata saves now run the derived sync flow automatically from the current quiz blocks.
			- Validation result: editor diagnostics were clean after the change, and a clean-shell `npm run build` completed without reported errors. Existing chunk-size warning remains.
	- Phase 4: learner runtime and scoring
		- [x] Keep the learner-facing assessment runner backed by `assessmentService`, but ensure it loads questions generated from module quiz blocks.
		- [x] Continue calculating score automatically from correct answers and points in `submitAttempt`, since this already computes percentage scores from question totals.
		- [x] Decide whether inline content-block quizzes in the module content tab remain as practice-only items or become read-only previews of the same graded questions. Chosen behavior: gradable quiz blocks render as read-only assessment previews and the recorded attempt stays in the assessment flow.
		- Phase 4 implementation status on March 12, 2026
			- Updated `src/components/course/ModuleContentViewer.tsx` so the learner Activities tab now appears from the actual module assessment record instead of only from material URL heuristics.
			- Updated graded quiz blocks in the learner content tab to render as read-only previews with a direct action into the assessment flow, removing the duplicate answer path for the same scored question.
			- Kept non-gradable inline quiz behavior unchanged, so practice-only quiz content can still stay in the content tab when authors intentionally mark it as non-gradable.
			- Validation result: editor diagnostics were clean after the change, and a clean-shell `npm run build` completed without reported errors. Existing chunk-size warning remains.
	- Phase 5: migration and backward compatibility
		- [x] Audit existing modules for three states: quiz blocks only, assessment tables only, and both present with mismatched questions.
		- [x] Write a one-time migration script that backfills `assessment_questions` from module quiz blocks for modules that already use quiz blocks.
		- [x] For modules that only have assessment-table questions, either convert them into module quiz blocks automatically or flag them for manual cleanup in an admin report. Current implementation flags them for manual cleanup in the generated report.
		- [x] Add a mismatch report so staff can detect modules where content quiz blocks and assessment records diverge before the old manual editor is removed.
		- Phase 5 implementation status on March 12, 2026
			- Added `scripts/audit-derived-assessments.ts` with two modes: audit-only classification/reporting and optional `--apply-backfill` for safe `quiz_blocks_only` modules.
			- Added package commands `npm run audit:derived-assessments` and `npm run backfill:derived-assessments`, plus script documentation in `scripts/README.md`.
			- The audit script classifies modules into `quiz_blocks_only`, `assessment_tables_only`, `both_in_sync`, `both_mismatched`, and `no_assessment_source`, then writes a markdown cleanup report under `temp_markdowns/`.
			- The backfill path intentionally updates only safe quiz-block-derived modules and leaves legacy assessment-table-only or mismatched modules untouched for manual review.
			- While implementing the audit, fixed `src/services/assessmentService.ts` so derived assessments store and compare the actual correct option text instead of a quiz-block index, while still accepting older numeric-index rows during grading.
			- Validation result: editor diagnostics were clean, the new script compiled and started successfully, and a clean-shell `npm run build` completed without reported errors. Live audit/backfill execution still requires `SUPABASE_URL` or `VITE_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` in the shell.
	- Phase 6: reporting and analytics protection
		- [x] Verify that dashboards, learner profile summaries, trainer analytics, admin reports, and assessment-only recommendations still read from `assessment_attempts` unchanged.
		- [x] Regression-test score aggregation because reporting currently relies on `assessment_attempts.score`, not module content directly.
		- [x] Preserve analytics events such as `assessment_submit`; only the question source changes, not the attempt event contract.
		- Phase 6 implementation status on March 12, 2026
			- Added `scripts/check-assessment-reporting-regressions.ts` as a repository-level regression guard for assessment reporting and analytics invariants.
			- Added `npm run check:assessment-reporting`, which writes `temp_markdowns/assessment_reporting_regression_report.md` and verifies nine critical invariants across assessment submission, learner summaries, staff reporting, analytics SQL rollups, and staff attempt visibility policies.
			- Confirmed the learner assessment runtime still writes `assessment_attempts.score` and `assessment_attempts.passed`, still emits the `assessment_submit` analytics event, and still refreshes the phase 1 analytics rollups after submission.
			- Confirmed reporting and analytics paths still aggregate from `assessment_attempts.score` rather than from raw module quiz content or `assessment_questions` rows.
			- Validation result: the new regression script passed 9 of 9 checks, editor diagnostics were clean, and a clean-shell `npm run build` completed without reported errors. Existing chunk-size warning remains.
	- Phase 7: rollout order
		- [x] Step 1: add quiz block grading fields and editor validation.
		- [x] Step 2: build the derivation/sync utility from module quiz blocks to `assessments` plus `assessment_questions`.
		- [x] Step 3: switch trainer/admin UI from manual assessment-question editing to derived assessment summaries.
		- [ ] Step 4: run migration and mismatch audit on existing module data. This remains an operational rollout step that still needs a live Supabase environment.
		- [x] Step 5: remove deprecated manual question-entry paths after verification.
		- Phase 7 implementation status on March 12, 2026
			- Removed the deprecated manual assessment delete actions from both trainer authoring surfaces so assessment lifecycle now follows quiz-block changes instead of a second destructive UI path.
			- Updated `src/services/assessmentService.ts` so saving a module with zero gradable quiz blocks deactivates the derived assessment and its active questions instead of leaving stale assessment rows behind.
			- Removed the remaining learner fallback that inferred assessment availability from material marker strings. `src/components/course/ModuleContentViewer.tsx` now relies only on the actual derived assessment record.
			- Removed deprecated `quiz-activity` and `module-assessment` material markers from `scripts/seed-course-content.ts` so seeded demo content follows the same rollout path as the app.
			- Removed the unused manual assessment/question CRUD surface from `src/services/assessmentService.ts`, leaving derived sync as the supported authoring path.
			- Validation result: editor diagnostics were clean, source search found no remaining manual assessment-delete references in `src/`, and a clean-shell `npm run build` completed without reported errors. Existing chunk-size warning remains.
	- Verification checklist
		- Creating a module with quiz blocks should automatically create or update the linked assessment and questions with no duplicate trainer input.
		- Editing quiz text, options, answers, order, or points should update the derived assessment questions deterministically.
		- Submitting a learner assessment should still write the same `assessment_attempts` and `assessment_answers` records and produce the expected percentage score.
		- Trainer/admin reports and learner dashboard metrics should remain consistent before and after the change.
	- Key implementation files to touch
		- `src/components/course/ContentBlock.tsx`
		- `src/pages/trainer/ModuleEditorPage.tsx`
		- `src/components/course/ModuleManagementDialog.tsx`
		- `src/components/course/ModuleContentViewer.tsx`
		- `src/services/assessmentService.ts`
		- related Supabase migration files for any new mapping fields or constraints
	- Engineering checklist
		- Workstream A: canonical quiz-block assessment model
			- [ ] Add grading fields to the `ContentBlock` quiz schema: `points`, `questionType`, `sourceQuestionKey`, and `isGradable`.
			- [ ] Define normalization rules for legacy quiz blocks that only have `options` and numeric `correctAnswer`.
			- [ ] Add a shared parser/normalizer utility for module quiz blocks so editor, sync, and learner runtime all read the same structure.
			- Estimated file changes
				- `src/components/course/ContentBlock.tsx`
				- new shared utility under `src/lib/` or `src/services/`
				- `src/components/course/ModulePreview.tsx`
			- Estimate
				- 2 to 4 frontend files
				- 0 to 1 migration if question mapping is stored in JSON only
		- Workstream B: trainer and admin authoring UX
			- [x] Update quiz block editor UI to expose points and supported question type.
			- [x] Add editor validation for missing options, missing correct answer, invalid points, and unsupported question types.
			- [x] Replace manual assessment question entry with a derived summary panel showing counted quiz blocks, total questions, total points, and pass threshold.
			- [x] Keep assessment settings limited to metadata such as title, description, passing score, max attempts, active state, and taxonomy tags.
			- Estimated file changes
				- `src/components/course/ContentBlock.tsx`
				- `src/pages/trainer/ModuleEditorPage.tsx`
				- `src/components/course/ModuleManagementDialog.tsx`
			- Estimate
				- 3 to 5 frontend files
				- no DB migration by itself
		- Workstream C: derived assessment sync service
			- [x] Create a sync function that converts module quiz blocks into an `assessments` record plus ordered `assessment_questions` rows.
			- [x] Run the sync whenever a module is created or updated and content blocks are saved.
			- [x] Ensure sync handles create, update, reorder, and delete without duplicating question rows.
			- [x] Add idempotency rules so repeated saves produce the same derived assessment state.
			- Estimated file changes
				- `src/services/assessmentService.ts`
				- `src/pages/trainer/ModuleEditorPage.tsx`
				- `src/components/course/ModuleManagementDialog.tsx`
				- new sync helper file if kept separate
			- Estimate
				- 3 to 6 application files
				- 1 migration strongly recommended for persistent source mapping
		- Workstream D: learner assessment runtime
			- [x] Make sure `AssessmentInterface` continues to load the derived questions with no learner-facing schema break.
			- [x] Decide and implement one learner experience: either hide inline module quiz answering when a graded assessment exists, or render inline quizzes as non-graded previews only.
			- [x] Prevent duplicate answering paths for the same graded question.
			- Estimated file changes
				- `src/components/course/AssessmentInterface.tsx`
				- `src/components/course/ModuleContentViewer.tsx`
			- Estimate
				- 2 to 3 frontend files
				- no DB migration expected
		- Workstream E: migration and audit
			- [x] Build a one-time audit script to classify modules into `quiz_blocks_only`, `assessment_tables_only`, `both_in_sync`, and `both_mismatched`.
			- [x] Backfill `assessment_questions` from quiz blocks for `quiz_blocks_only` modules.
			- [x] For `assessment_tables_only`, either auto-convert DB questions into quiz blocks or emit a staff cleanup report before rollout.
			- [x] Add a temporary admin or script-based mismatch report for cleanup verification.
			- Estimated file changes
				- new script under `scripts/`
				- at least one new Supabase migration or SQL helper
			- Estimate
				- 1 to 3 scripts
				- 1 to 2 SQL files or migrations
		- Workstream F: regression protection
			- [x] Verify reporting still uses `assessment_attempts.score` and does not require downstream aggregation rewrites.
			- [x] Regression test trainer analytics, admin reports, learner profile, dashboard score summaries, and assessment-only recommendations.
			- [x] Verify analytics events and notifications still fire on submission and grading.
			- Estimated file changes
				- mostly tests or targeted smoke-check scripts
				- possible small adjustments in `src/services/reportingService.ts`
			- Estimate
				- 1 to 4 files depending on how much automated coverage is added
	- Suggested implementation sequence
		- Sprint task 1: define the shared quiz block schema and normalizer.
		- Sprint task 2: update trainer/admin authoring UI and validation.
		- Sprint task 3: implement the derived assessment sync service.
		- Sprint task 4: adjust learner runtime so there is only one graded answering path.
		- Sprint task 5: run migration and mismatch audit on existing content.
		- Sprint task 6: regression test reporting, analytics, and notifications.
	- Supabase migration steps
		- Migration 1: add persistent source mapping
			- Add `source_question_key text` to `assessment_questions`.
			- Add a uniqueness constraint on `(assessment_id, source_question_key)` so sync can upsert deterministically.
			- Optional: add `derived_from_module_quiz boolean not null default false` to `assessments` so derived records are distinguishable from legacy/manual records.
		- Migration 2: backfill derived mappings
			- Populate `source_question_key` for existing `assessment_questions` where possible.
			- Mark existing assessment rows as derived or legacy depending on audit classification.
		- Migration 3: cleanup guardrails
			- Add comments or constraints documenting that derived module assessments should not be manually edited outside the sync flow.
			- If needed, add an index on `assessment_questions(assessment_id, order)` and `assessment_questions(assessment_id, source_question_key)` for sync performance.
	- Concrete DB rollout notes
		- Run the schema migration first.
		- Deploy application code that can read both pre-migration and post-migration question rows.
		- Run `npm run audit:derived-assessments` in a shell that has `SUPABASE_URL` or `VITE_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`, then export the mismatch report.
		- Run `npm run backfill:derived-assessments` for the safe `quiz_blocks_only` modules after reviewing the audit output.
		- Enable the new derived sync path for trainer/admin saves.
		- Remove deprecated manual-question editing only after mismatches are cleaned up.
	- Practical file estimate by phase
		- Phase 1 to 2: about 4 to 6 frontend files.
		- Phase 3: about 3 to 5 service and page files plus 1 migration.
		- Phase 4: about 2 frontend files.
		- Phase 5: 1 to 3 scripts plus 1 to 2 SQL migrations.
		- Phase 6: 0 to 4 files depending on whether automated tests are added.
	- Definition of done
		- Trainers and admins only define quiz content once, inside module quiz blocks.
		- Saving module quiz blocks deterministically updates the linked assessment question set.
		- Learner submission score is still auto-calculated from question points and correct answers.
		- Existing score-based dashboards, reports, and recommendation features continue to work without schema-specific UI regressions.
		- Legacy modules are either migrated or explicitly flagged for cleanup.

## Regarding the quiz and assessment
- [ ] Assessment section in module creation tab should not exists because the quiz blocks in the content tab should be the source of truth for the assessment questions and answers. The current setup creates confusion and extra work for the trainers because they have to enter the same information in two different places. Removing the separate assessment section will streamline the authoring process and reduce the chances of discrepancies between quiz content and recorded assessments.

### Admin & Trainer
- [ ] In admin, can you make a category and tag management which the admin and trainer can manage (Add, Edit, Delete) the categories and tags for the courses and modules. This will help to organize the courses and modules better and also help the trainers to find the relevant courses and modules easily.
- [ ] In the creation and editing of courses and modules, instead of using dropdown for categories and tags, can you make it a searchable dropdown which can show the existing categories and tags and also allow the admin and trainer to add new categories and tags on the fly. This will improve the user experience and also help to maintain the consistency of categories and tags across the platform.

### Trainer
- [ ] Viewing progress modal should be vertically scrollable

### Trainee
- [ ] Loading time for courses and modules should be optimized, especially for users with slower internet connections
- [ ] Prevent the certificate from being generated twice (in case the user click mark as complete twice)

### Courses Module
- [ ] Learners Enrolled shows 0 even though there are learners enrolled in the course

remove this, trainee assessments doesn't require validator approval

## Product Improvement Roadmap

This roadmap groups the requested updates by area so implementation can be prioritized without losing the original scope.

### Phase 1: Core System Updates

#### 1. Forgot Password Flow
- [x] Add a Forgot password entry point on the learner login page.
- [x] Add a password reset request screen for email and password users.
- [x] Connect the flow to Supabase password reset so users receive a reset link by email.
- [x] Add a reset password completion screen for setting a new password after opening the reset link.
- [x] Hide or disable the flow for users who signed in through providers that do not use password credentials.
- [x] Show clear success and failure states, including invalid link, expired link, missing email, and network failure cases.

Implementation notes
- Use the existing auth service and route structure so the reset flow behaves consistently with current login and onboarding flows.
- Ensure the reset redirect URL matches the deployed environment configuration.
- Add user-facing copy that makes it clear the reset email may take a short time to arrive.

Implementation status on March 15, 2026
- Added public `/forgot-password` and `/reset-password` routes using the existing auth page shell and Supabase auth service.
- Replaced the login-page placeholder toast with a real forgot-password entry point.
- Added request and reset completion screens with success, invalid-link, expired-link, missing-input, provider-only, and update-failure handling.
- Added locale copy for both English and Tagalog.
- Validation result: targeted editor diagnostics were clean, and `npm run build` completed successfully. Existing bundle-size warnings remain unchanged.

Verification
- [ ] A learner using email and password can request a reset email successfully.
- [ ] Opening a valid reset link allows the learner to set a new password.
- [ ] Invalid or expired reset links show a clear recovery path.

#### 2. Sign Up and Login Hardening
- [ ] Audit current sign up and login error cases across email validation, duplicate accounts, incorrect password, unconfirmed account, locked or inactive account states, and network failures.
- [ ] Replace generic auth error messaging with clearer user feedback that explains what the learner can do next.
- [ ] Add field-level validation before submission for required fields and obvious format errors.
- [ ] Prevent duplicate form submissions while auth requests are in progress.
- [ ] Standardize loading, success, and failure states across sign up and login screens.
- [ ] Review role/profile creation behavior so auth success does not leave partially created user records without feedback.

Implementation notes
- Prefer a shared auth error mapping utility so the same backend errors are translated consistently across all auth screens.
- Keep messages helpful without exposing sensitive account enumeration details where that would create risk.
- Reuse the existing toast, alert, or inline status patterns already used in the app.

Verification
- [ ] Sign up failures show actionable feedback without blank or raw backend errors.
- [ ] Login failures clearly distinguish invalid credentials, validation issues, and transient server or network problems.
- [ ] Successful auth flows still create or load the expected profile and role state.

#### 3. Notifications Reliability
- [x] Ensure core system events create notifications consistently for all intended recipients.
- [x] Verify notifications are visible in each role-specific dashboard or shared notification surface.
- [x] Confirm unread and read state updates work correctly and do not regress counts.
- [x] Audit if any notifications was being sent and received to all users (specially on the learner's side for example if their certificates was released or if they have new courses recommended) and fix any reliability issue found.
- [x] Audit the current notification flow for admin, trainer, learner, and any other active user roles.
- [x] Identify where notifications fail today: event creation, database writes, role targeting, fetch queries, unread counts, or UI rendering.
- [x] Add fallback handling for missing related records so notification rendering does not silently fail.

- [x] Create a test notification in the Admin settings to test if notification actually works across all users

Implemented an admin-only Notification Test card in Settings so staff can send a system announcement to all users, trainees, trainers, admins, or just themselves. The sender now uses a bulk notification-service path with test metadata, which makes it easier to verify delivery after the notification reliability fixes and migration rollout.

Implementation notes
- Check both notification creation and notification consumption paths; reliability problems often come from one side only.
- Review row-level security and role filters if some roles can create notifications but not read them.
- If notifications depend on triggers or server-side functions, validate those paths separately from the frontend UI.

Implementation status on March 16, 2026
- Audited the shared notification pipeline across `notificationService`, the shared header notification center, the full notifications page, and the main trainer/admin/learner service call sites that create notifications.
- Confirmed the biggest reliability failures were schema and policy mismatches: the frontend already depended on notification `metadata`, but the base notifications schema did not define that column, and client-side trainer/admin notification writes were not covered by a matching insert policy.
- Added Supabase migration `076_harden_notification_reliability.sql` to add the `metadata` column, create a created-at index, allow staff or self-targeted notification inserts, and allow users to delete their own notifications.
- Hardened the frontend notification service so read, mark-all-read, delete, and delete-all-read operations now return success/failure instead of silently swallowing write failures.
- Updated both notification UIs so they only apply optimistic read/delete state changes after successful writes, and they now show a user-facing fallback toast when a notification has no linked record to open.
- Verified notification visibility is shared across admin, trainer, learner, and validator authenticated pages through the common `DashboardLayout`, which mounts the same `NotificationCenter` everywhere plus the dedicated `/notifications` page.
- Audited learner-side delivery coverage and confirmed certificate release notifications already existed, but fresh recommendation refreshes did not notify learners at all; added a new learner recommendation notification path that fires when the top dashboard recommendations change.
- Updated enrollment notifications to carry `courseId` metadata so clicking the notification can open the linked course instead of showing an orphaned message.
- Extended the notification UI icon/color mapping to cover `course_assigned` and `system_announcement` types cleanly.
- Updated the local Supabase database types so the notifications table now includes `metadata`.
- Validation result: targeted editor diagnostics were clean, and `npm run build` completed successfully. Existing bundle-size warnings remain unchanged.

Verification
- [x] Admin-triggered events reach the intended recipients.
- [x] Trainer-facing notifications render correctly.
- [x] Learner-facing notifications render correctly.
- [x] Mark as read and unread count behavior stays correct after refresh.

#### 4. Remove Assessment Attempt Limits
- [ ] Identify all places where max attempts are enforced, displayed, or stored.
- [ ] Remove frontend messaging that warns learners about limited assessment tries.
- [ ] Remove backend or service-layer enforcement that blocks additional submissions after a fixed number of attempts.
- [ ] Review database fields and business rules tied to attempt limits and stop relying on them for access control.
- [ ] Keep attempt history for analytics and reporting even after removing the restriction.
- [ ] Confirm learner progress, scoring, and pass status continue to work with unlimited retakes.

Implementation notes
- Remove the restriction at the source of truth rather than only hiding it in the UI.
- Preserve existing assessment reporting and analytics records so dashboards still reflect historical attempts.
- Check trainer and admin authoring screens for any leftover max-attempt configuration that no longer has runtime effect.

Verification
- [ ] Learners can retake assessments without being blocked by a max-attempt rule.
- [ ] Assessment scores and attempt records are still saved correctly.
- [ ] Trainer and admin reporting continues to show attempts accurately after the change.

#### Phase 1 Definition of Done
- [ ] Learners can reset passwords end to end using the production auth flow.
- [ ] Sign up and login surfaces provide clear and consistent validation and failure messaging.
- [ ] Notifications are generated and rendered reliably for every supported role.
- [ ] Assessment attempt limits no longer block learner submissions anywhere in the system.

### Phase 2: Learner Experience Improvements

#### Dashboard
- [ ] Move Recommendation Courses to Browse Courses page and show them as recommended there instead of on the dashboard. This will declutter the dashboard and allow learners to explore more course options in the Browse Courses page, while still surfacing personalized recommendations based on their profile and progress.
- [ ] Remove Recent Assessment Scores from the learner dashboard.
- [ ] Remove Module Completion Records from the learner dashboard.
- [ ] Redesign the dashboard review and statistics area so it feels less overwhelming for new learners, using clearer visuals, tooltips, or progressive disclosure for deeper details.

#### Progress Page
- [ ] Replace the Course Progress bar graph with an actual progress bar.
- [ ] Show only the 5 most recent learning sessions by default.
- [ ] Add a See all action for viewing the full learning session history in a separate page or modal.

#### Profile and Onboarding
- [ ] Remove assessment-related statistics from the learner profile page.
- [ ] Remove module completion statistics from the learner profile page.
- [ ] Require at least one selection in every onboarding section so the recommendation system has enough starting data.

### Phase 3: Admin Dashboard Cleanup
- [x] Add a short explanation or helper text for Predictive Oversight, based on the dashboard context shown in the admin view.
- [x] Remove Hybrid Recommendation evidence from the admin dashboard.

Implementation status on March 16, 2026
- Added a short helper block in the admin Predictive Oversight tab to explain that the section is an early-warning workspace for high-risk courses and disengagement patterns.
- Removed the Hybrid Recommendation evidence panel from the admin dashboard and cleaned up its related learner-selector and collaborative-debug loading logic.
- Validation result: targeted editor diagnostics were clean after the change.

### Phase 4: Shared Trainer and Admin Certificate Workflow
- [x] Add a dedicated certificates page for trainers and admins
- [x] Show learners who have completed their courses and are eligible for certificate release.
- [x] Allow trainers and admins to generate certificates from the page.
- [x] Track certificate generation status so staff can monitor what has been released and what is still pending.

Implementation status on March 16, 2026
- Added a shared staff certificates workflow page for both admins and trainers, with dedicated routes at `/admin/certificates` and `/trainer/certificates` plus navigation links so the page is directly reachable from both portals.
- The new page loads manager-visible enrollments and certificates, groups them into eligible, pending, and released workflow tabs, and surfaces learners whose approved completions are ready for certificate release.
- Trainers and admins can now release certificates directly from the workflow page, while pending items link back to the underlying progress or enrollment record for review before release.
- Certificate status tracking now stays visible on the page through summary cards and released-status rows so staff can monitor what is pending and what has already been issued.

### Phase 5: Trainer Workflow Improvements

#### Dashboard and Reporting
- [x] Rename CTR to Click Through Rate in the trainer dashboard.

#### Course Creation and Editing
- [x] Remove the Program field from the Create Course modal.
- [x] Limit tag search results to 5 entries in the tag search results window.
- [x] Implement on the fly tag creation but make sure it doesn't create duplicates and it should be added to the list of tags in the system. Also, make sure it doesn't violate any taxonomy constraints
- [x] Keep category and tag selection consistent so trainers use approved metadata more reliably.

### Module Editing and Creation
- [x] Make the skill and topic tags in module creation inherit from the course's tags and only allow selection from those to maintain consistency between course and module metadata.

Implementation status on March 16, 2026
- Renamed the trainer recommendation metric label from CTR to Click Through Rate across the summary card, chart legend, and recommendation winners section.
- Removed the Program selector from the shared course create/edit dialog so trainers and admins no longer assign programs during course authoring.
- Updated the shared taxonomy tag picker to cap visible search results at five, surface category-aligned tags first, and support on-the-fly taxonomy term creation through the existing deduplicating taxonomy service.
- Tightened course authoring so tag creation is available only after a category is chosen, helping keep category and tag selection aligned.
- Updated module creation and editing so module skill and topic tags inherit from the parent course tags and are restricted to those inherited values only.
- Validation result: targeted editor diagnostics were clean after the change.

### Regarding Assessments, Quizzes, and Scoring for the Analytics and Recommendation System
- Quizzes should serve as a practice tool for learners to test their understanding of the module content, but they should not be counted for scoring in analytics and recommendations. While the assessment score should be the only score that counts for analytics and recommendations, the quiz blocks can still be used for formative assessment and practice within the module content. This way, learners can engage with the quiz content without the pressure of it affecting their overall score, and trainers can use quizzes to reinforce learning without worrying about grading implications.

- Learners should be able to proceed through the module contents (including modules with pre-requisites) without the intervention of a trainer or validator, and their progress should be tracked based on module completion. This allows for a more inclusive learning experience where learners can engage with the material at their own pace without being penalized for quiz performance.

- Add a "Next Module" button at the end of each module content page to encourage learners to continue their learning journey without needing to return to the module list. This will help maintain engagement and make it easier for learners to navigate through the course.

- Add an assessment option in module creation and editing that is specifically designed for graded assessments, which can be linked to the quiz blocks for content but have separate fields for points, correct answers, and grading criteria. This way, trainers can author quiz content for practice and also define a clear assessment structure for scoring without duplication.

- Implementation plan moved to `temp_markdowns/practice_quiz_and_graded_assessment_plan.md`


## In a different markdown, add an implementation plan
- In the course creation page, add a selection to filter the courses by trainee types (PESO Clients, PESO Employees, and All/General Public)
- Courses should be visible to learners side based on their trainee type. For example, if a course is tagged as PESO Clients, only learners tagged as PESO Clients can see the course in the Browse Courses page and enroll in it. If a course is tagged as All/General Public, all learners can see the course and enroll in it regardless of their trainee type. 

### Changes
- [x] Remove Verification page from Trainer side
- [x] Add a Learners page to Admin side but separate it from Enrollments page. Make the Learners page like the one in the trainer side. As for enrollments page, it should be more of a management page for the admin to see all the enrollments in the system and manage them (approve, reject, etc.) instead of seeing the progress of the learners.
- [x] Streamline the process for Assessment Approval to Course Approval to Certificate Generation and Release. For example, after the trainer/admin reviewed the Assessment, a modal should open to approve the course completion and generate the certificate. This will reduce the number of steps and make the process more efficient for trainers and admins, while still ensuring that learners receive recognition for their achievements in a timely manner.

Changes implementation status on March 16, 2026
- Added dedicated admin learner routes using the shared learner list and learner progress review pages, while keeping admin enrollments focused on workflow management.
- Removed trainer-side Verification navigation and restricted the Verification route to admin access.
- Reworked admin enrollment actions so staff can approve completion, mark follow-up, release certificates, or jump into learner review from the management queue.
- Extended assessment review with a post-approval follow-up modal so staff can approve completion and release the certificate without leaving the review workflow.

- [x] Remove module auto-complete after a certain amount of time, I don't know if this is a bug or a feature but it is quite inconvenient for the learners to auto-complete the module after a certain amount of time, especially if they are taking a break or need to step away from their device. Removing this feature will allow learners to have more control over their learning experience and prevent any unintended progress through the modules.
- [x] Allow unlimited retries for the practice quizzes inside the modules. This will encourage learners to engage with the quiz content and reinforce their understanding of the material without the pressure of limited attempts. By allowing unlimited retries, learners can take the time they need to master the content and improve their scores without feeling discouraged by a max-attempt limit.
- [x] Remove the "content" tab/divider at the top of the module content page
- [x] Organize and categorize trainer top navigation (just like admin)
- [x] In the Course Creation page, add a Tesda Accredited checkbox, also organize the fields better as there are some fields that are not that important and can be moved to the bottom of the form. Also, add a tooltip or helper text for the Tesda Accredited checkbox to explain what it means and how it affects the course.
- [x] In the course creation page, remove Industry and Career Path fields as these are not that important and can be added as tags instead. This will simplify the course creation form and allow trainers to use tags for more flexible categorization of their courses.
- [x] Admin: In the enrollment page, the button placement for each entries is too ugly, just make a dropdown for the actions

Workflow and course-form implementation status on March 16, 2026
- Removed the timer-based module auto-complete flow and replaced it with explicit learner-controlled module completion inside the module viewer.
- Kept practice quizzes inside module content formative and added unlimited retry/reset behavior for repeated self-checks.
- Removed the top content tab strip from the module viewer and presented module content, videos, and supporting documents in a cleaner single-column flow.
- Grouped trainer navigation into admin-style sections for clearer top-level organization.
- Reworked the course create/edit dialog to surface TESDA accreditation as a first-class setting with helper guidance, while removing the lower-priority Industry and Career Path inputs.
- Replaced the admin enrollment action button stack with a compact dropdown menu per enrollment row.

### Changes
- [x] Move the Retry Quiz at the bottom of the module (besides the next button) instead of inside the quiz block, this will make it more intuitive for the learners to retry the quiz after they finish answering all the questions in the quiz block. By placing the Retry Quiz button at the bottom of the module, learners can easily find it and use it to reinforce their understanding of the material without having to scroll back up to the quiz block.
- [x] Admin: Limit the number of entries in the verification page up to 15, and add pagination
- [x] Admin: Remove admin shortcuts
- [x] Admin: Create and Editing courses doesn't work

Implementation notes on March 16, 2026
- Moved the module practice quiz retry action out of individual quiz cards and into the bottom module navigation area beside the next-module action.
- Added 15-row pagination to the admin trainee verification queue and reset the current page whenever filters change.
- Removed the admin shortcuts submenu from the account dropdown now that the admin navigation is already exposed in the main header.
- Fixed the course create/edit runtime crash by declaring the taxonomy search value before the filtered-options memo in `TaxonomyTagField`.

## Changes - Language and Content
- [x] Remove language selection in the settings for the trainer and admin
- [x] There are still some English words when translated to Tagalog in the Dashboard (also the Continue Learning button), Browse Course, All the progress page, The profile fields in the profile page
- [x] Fix the PESO logo for all users in the top navigation bar being too small, also in the homepage top nav

## Learner course card
- [x] Change the "Flexible pace: about x weeks" to show the official duration hours, same in the dashboard instead of showing the supposed "Credited Hours"

Implementation notes on March 16, 2026
- Hid the language preference card on the Settings page for trainer and admin roles while leaving trainee language controls intact.
- Localized the remaining learner-facing hardcoded English across the dashboard, browse page, progress page, and profile field labels that were still bypassing the Tagalog copy.
- Increased the PESO logo size in both the shared authenticated navigation and the homepage header so the mark is readable across user roles.
- Replaced the learner-facing flexible pace and credited-hours wording with direct duration-hour displays on course cards and related dashboard surfaces.

### Learner Predictive Analytics
- [x] Remove any mention of trainees in the learner-facing profile page and dashboard and replace it with learner, remove the Learner Profile Analytics section, and place the training snapshot with account summary in a two-column layout
- [x] Audit and explain what part in learner side has predictive analytics
- [x] In the progress page and detailed insight section in the Dashboard, add a strengths and weaknesses section based on assessment performance
- [x] In the Progress page and detailed insight section in the Dashboard, add industry and career path recommendations with at least 3 recommendations and a short explanation of how each recommendation relates to learner interests and performance

Implementation notes on March 16, 2026
- Reframed learner-facing wording on the dashboard, profile, and recommendation reason text so the experience consistently says learner instead of trainee where it is shown to learners.
- Removed the learner profile analytics card from the Profile page and re-laid out the learner-side Training Snapshot and Account Summary cards into a two-column section.
- Added a shared learner industry and career path recommendation helper in the reporting service so the Dashboard and Progress page surface the same three recommendation cards and rationale.
- Added explicit strengths and areas-to-improve cards to both the Dashboard detailed insights accordion and the Progress page, using strongest-topic and needs-improvement-topic signals already derived from learner assessment performance.
- Confirmed that the learner side currently exposes recommendation ranking, topic performance summaries, strongest and weakest topic signals, and learner-interest matching; the more explicit predictive-risk overview remains admin-facing.

### Course Creation and Taxonomy Management
- [x] Fix the course create/edit Skill Tags and Topic Tags pickers so approved options render consistently again
- [x] Stop course create/edit from wiping `industry_tags` and `career_paths` during save and edit flows
- [x] Add Industry Tags and Career Paths sections to Taxonomy Management
- [x] Keep Industry Tags and Career Path selection simple in course create/edit by using managed dropdown-style pickers instead of in-form term creation

Implementation notes on March 16, 2026
- Hardened the course taxonomy pickers so they sync fallback options immediately and use explicit filtered command lists, which fixes the missing Skill Tag and Topic Tag option lists in course authoring.
- Expanded managed taxonomy support to include `industry_tag` and `career_path` in the frontend taxonomy service and Taxonomy Management page.
- Added Industry Tags and Career Path selectors to the course create/edit dialog as optional managed metadata while keeping category, skill, and topic authoring focused on the core course details.
- Updated the course create/edit dialog so Skill Tags, Topic Tags, Industry Tags, and Career Path Tags are all treated as global managed metadata and are no longer bounded by the selected category.
- Preserved existing course `industryTags` and `careerPaths` during edit and save instead of resetting them to empty arrays.
- Added Supabase migration `075_expand_taxonomy_terms_for_course_metadata.sql` so the `taxonomy_terms` table accepts the new term types and seeds starter values.


## Course Creation/Editing
- [x] Skill and Topic Tags now show managed items even before a category is selected, and narrow to category-aligned options after category selection
- How should I handle the Industry and Career Path tags, while they're necessary for the recommendation system, they are not that important for the course creation and editing process. I think adding another sections in taxonomy page for Industry and Career Path management will be better, and in the course creation and editing page, we can just add a dropdown to select the relevant Industry and Career Path tags for the course. This way, we can keep the course creation and editing process simple and focused, while still allowing trainers to provide the necessary metadata for the recommendation system. Also bring back the Industry and Career Path fields in the course creation and editing page.

Create a sql seed for all the possible industries and career paths

Implementation notes on March 16, 2026
- Added `supabase/manual_fixes/seed_industry_and_career_path_taxonomy.sql` as a rerunnable SQL seed with a broader starter catalog of managed `industry_tag` and `career_path` values.
- Expanded that seed further to cover more service, admin, operations, retail, IT, logistics, hospitality, compliance, and support-role pathways.
- The seed uses `ON CONFLICT DO NOTHING`, so it is safe to apply after the existing taxonomy term migrations without duplicating rows.

## Verify
- Does the career path and industry wired to the analytics in the learner side? Because it seems like it is showing Category instead of the career path and industry in the recommendation section in the dashboard and progress page.
- Does the admin and trainer shows analytics related to career path and industry of each learner

Implementation notes on March 16, 2026
- Tightened the learner industry and career path recommendation helper so the Dashboard and Progress page now use only real course `industryTags`, real course `careerPaths`, and saved learner `industryInterests` for those cards.
- Removed the synthetic fallback entries that previously generated labels like `<course category> pathway`, `<topic> pathway`, or category-derived pathway cards when actual industry or career-path metadata was missing.
- Verified that admin and trainer analytics still do not expose learner-level industry or career-path analytics; current staff dashboards remain focused on progress, assessments, risk, disengagement, and recommendation performance metrics.

Are the industry and career paths wired to Recommended Courses as well? Also is it wired to onboarding questions?

## Change
- Onboarding: Add a search bar for Industry Interest (which will take from the industry tags that we have in the system) and Course Categories (which will take from the category tags that we have in the system)
- Onboarding: Populate the selections Industry Interest and Course Categories based on the existing tags in the system, and make sure that the selections are saved in the learner profile and are used for the recommendation system
- Onboarding: Improve Readiness section UI, I don't like the vertical selection and this section is way verbose

Implementation notes on March 16, 2026
- Updated the learner onboarding modal so Industry Interests now load from managed `industry_tag` taxonomy values and Preferred Course Categories now load from managed `course_category` values instead of hardcoded onboarding lists.
- Replaced the fixed checkbox grids with searchable selection panels for both onboarding interest groups while preserving multi-select behavior and saved selections.
- Kept the existing onboarding persistence path intact so the selected industry interests and preferred categories still save into the learner profile through `updateUser(...)`, and the post-onboarding recommendation refresh continues using those profile fields.
- Compressed the readiness step into a cleaner horizontal option layout that keeps the question context visible but removes the previous long vertical card stack.
- Validation result: targeted diagnostics were clean, and `npm run build` completed successfully. Existing bundle-size warnings remain unchanged.

## Change
- Onboarding: in the Industry Interest and Course Categories, searching should show search result in a dropdown (with a checkbox/radio besides it) and the user can select from the dropdown instead of showing it in the checkbox grid, also limit the search result to 5 entries to avoid overwhelming the learners with too many options. This will make it easier for learners to find and select their interests without having to scroll through a long list of options, while still allowing them to see a relevant subset of choices based on their search query.

Implementation notes on March 16, 2026
- Kept the original checkbox-grid layout for the default onboarding interest view, with the visible grid still capped to 10 randomly sampled managed taxonomy values for each interest group.
- Updated onboarding search so typed queries now open a compact dropdown below the search field, with a checkbox beside each result and a maximum of 5 matching entries shown at once.
- Preserved the taxonomy-backed source of truth and existing onboarding persistence path, so the selected values still save into the learner profile and continue feeding recommendation refresh after onboarding completion.
- Fixed the onboarding runtime error in the readiness step by correcting the `renderReadinessQuestion(...)` call signature so readiness options are passed as an array again instead of a string value.
- Updated the readiness layout so the three onboarding questions stack vertically, while each question keeps its answer choices in a horizontal row.
- Validation result: targeted diagnostics were clean, and `npm run build` completed successfully. Existing bundle-size warnings remain unchanged.

## Change
- Fix the bug where creating a new account defaults the user settings to dark mode

Implementation notes on March 16, 2026
- Fixed the theme preference resolver so a newly authenticated user without an explicit saved theme now defaults to `system` instead of inheriting a previously stored guest theme or the current dark-mode state.
- Updated the signup return mapping so newly created users carry their `languagePreference` and `themePreference` values immediately in auth state, instead of waiting for a later profile refresh.
- Added a regression test covering the new-account case where local storage already contains `dark`, ensuring a newly signed-in learner still resolves to `system`.
- Validation result: targeted diagnostics were clean, `npm test -- ThemePreferenceContext` passed, and `npm run build` completed successfully. Existing bundle-size warnings remain unchanged.

### Registration for PESO Client and Employee
- Strengthen the registration process for PESO Clients and Employees by implementing a verification step like email verification. This will help ensure that only authorized individuals can create accounts under these specific trainee types, maintaining the integrity of the user base and providing an additional layer of security for sensitive roles.
- Add a password strength meter to the registration form to encourage users to create stronger passwords, enhancing account security and reducing the risk of unauthorized access. The strength meter can provide real-time feedback on password complexity, such as length, use of special characters, and inclusion of numbers, guiding users towards creating more secure credentials.
- Password should require a minimum of 8 characters, at least one uppercase letter, one lowercase letter, one number, and one special character. This will help ensure that users create strong passwords that are resistant to common attack methods, improving the overall security of user accounts on the platform.
- Also verify if the forgot password flow is working properly, and if the user receives the email to reset their password, and if they can successfully reset their password using the link provided in the email. This will help ensure that users can regain access to their accounts securely if they forget their passwords, maintaining a positive user experience while also protecting account security.

Implementation notes on March 16, 2026
- Added a shared password policy utility so signup, reset-password, and in-app password change flows now all enforce the same rule: minimum 8 characters with uppercase, lowercase, number, and special character requirements.
- Updated the trainee signup flow so public PESO Client and PESO Employee registrations now return an explicit email-verification-required state when Supabase email confirmations are enabled, instead of assuming immediate dashboard access.
- Added a real-time password strength meter and requirement checklist to the public signup form so learners can see exactly which password rules are already satisfied before submission.
- Kept the existing PESO Employee domain, employee ID, and physical-ID checks, and added a post-login employee verification-document upload path in the learner profile so employee accounts can finish document submission after email confirmation when an immediate authenticated storage upload is not available.
- Tightened forgot-password input validation and updated the reset-password screen to require the same strong password policy used by signup and settings.
- Tightened the sign-in error path so users who try to log in before confirming their account get a clearer email-confirmation message instead of a generic backend error.
- Validation result: targeted password-policy tests passed and `npm run build` completed successfully. Existing bundle-size warnings remain unchanged.

Operational verification status
- The forgot-password flow is wired correctly in code: learners can request a reset email, the reset route recognizes recovery links, and password updates now enforce the stronger policy.
- Live email delivery and recovery-link completion still require an end-to-end Supabase mailbox round-trip in the target environment; this was not directly testable from the local workspace.
- Public trainee email verification enforcement depends on Supabase Authentication email confirmations being enabled in the deployed project.