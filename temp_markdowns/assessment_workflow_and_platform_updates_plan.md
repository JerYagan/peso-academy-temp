# Assessment Workflow and Platform Updates Phase Plan

## Goal

- Implement essay-based assessments with trainer review and feedback.
- Remove automatic completion/certificate paths that conflict with trainer-reviewed workflows.
- Reduce learner pressure in the course experience while preserving reporting value.
- Expand admin visibility, audience controls, and future face-to-face enrollment support.
- Move onboarding assessment out of registration and prepare the platform for English/Tagalog localization.
- Standardize high-risk data fields such as phone number formatting and text column usage.

## Owner Tags

- `DB` = Supabase schema, migrations, constraints, RPCs, and reporting views
- `Auth` = registration, onboarding, profile update, and user data integrity
- `FE` = page and component UX work
- `Assess` = quiz, essay, submission, review, completion, and certificate workflows
- `QA` = regression, migration, and rollout validation

## Guiding Rules

- Essay assessments must be reviewable by trainers before a course can be considered fully completed.
- Automated certificate issuance must be disabled because certificates are fully manual.
- Trainee-facing duration messaging should not pressure completion, but reporting should still retain course-defined hours.
- Admin enrollment management should expose learner progress at the same practical level trainers can review.
- Module progression should enforce prerequisites instead of relying on trainee self-certification.
- Registration should only keep account-creation essentials; onboarding assessment belongs after login on the dashboard.
- Phone numbers should be standardized to the `09XXXXXXXXX` format and capped at 11 digits.
- Essay questions live in quiz content blocks, not in a separate standalone assessment authoring source of truth.
- Every course completion requires trainer approval.
- Module prerequisite enforcement is sequential.
- Paste prevention should apply to all quiz types.

## Phase 0. Discovery, Decisions, and Scope Lock

- Owner: `FE`, `Assess`, `DB`, `Auth`
- Primary files and surfaces: `src/pages/trainer/ModuleEditorPage.tsx`, `src/services/assessmentService.ts`, `src/pages/CourseDetail.tsx`, `src/pages/admin/Enrollments.tsx`, `src/pages/SignUp.tsx`, `src/pages/Dashboard.tsx`, `supabase/migrations/*.sql`

- [x] Confirm whether essay questions live only inside module quiz content blocks or also inside standalone assessment records.
- Decision: essay questions live in the quiz content block.
- [x] Confirm whether every course completion requires trainer approval, or only courses containing essay questions or face-to-face components.
- Decision: every course completion requires trainer approval.
- [x] Confirm whether certificates become fully manual or only become manual for courses with essays and trainer-validated completion.
- Decision: certificates become fully manual.
- [x] Confirm whether “Duration (hours)” should be removed only from trainee-facing UI or also from admin/trainer authoring screens.
- Decision: do not remove duration hours; keep them visible in the system and credit the full stated course hours even when a trainee finishes faster.
- [x] Confirm whether Tagalog support is full interface translation, partial translation for learner-facing text, or a staged rollout.
- Decision: start with partial translation for learner-facing text first.
- Decision: do not hardcode translations in components; store translation strings in dedicated resource files and load them based on the user's language preference so copy can be updated later without rewriting feature logic.
- [x] Confirm whether module prerequisite enforcement is strictly sequential or supports branching prerequisites.
- Decision: module prerequisites are sequential.
- [x] Confirm whether paste prevention should apply to all quiz types or only selected text-entry assessments.
- Decision: paste prevention applies to all quiz types.
- [x] Add a phase to implement a settings page where all users in the system can set their language preference, theme preference, and other preferences in the future.
- Decision: add a dedicated settings/preferences phase to support language, theme, and future user preferences.

## Deferred Until Clarified

- [ ] Face-to-face course enlistment requirements remain out of scope for now until the request flow, approval flow, seats, scheduling, and attendance scope are clarified.
- [ ] Audience pre-filtering and approval rules remain out of scope for now until the eligibility model is clarified.



## Phase 1. Essay Assessment Foundation

- Owner: `Assess`, `DB`, `FE`
- Primary files and surfaces: `src/pages/trainer/ModuleEditorPage.tsx`, `src/components/course/ContentBlock.tsx`, `src/lib/contentBlocks.ts`, `src/services/assessmentService.ts`, `src/types/index.ts`, `src/types/database.ts`, `supabase/migrations/*.sql`

- [x] Audit the existing quiz question model and confirm where `essay` is already partially supported versus still missing in the trainer authoring flow.
- [x] Extend the assessment schema so essay attempts can store long-form answers, trainer feedback, reviewer id, review timestamps, and review status.
- [x] Add explicit attempt states such as `submitted`, `under_review`, `needs_revision`, and `approved` where needed.
- [x] Ensure quiz blocks remain the source of truth for question content and remove any competing assessment authoring source where needed.
- [x] Update trainer module authoring so essay questions can be created, edited, ordered, and previewed alongside existing quiz types.
- [x] Update learner quiz rendering so essay prompts support long-form response entry, autosave strategy, and clean submission UX.
- [x] Decide whether essay answers are single-attempt only or can be revised after trainer feedback.
- Decision: essay assessments are single-attempt for learners; trainer-configured attempt counts can still remain on the assessment for later workflow handling.
- [x] Add service-layer validation so essay attempts are persisted safely and cannot bypass the review state.

### Phase 1 Notes

- Current implementation blocks new attempts while an essay-containing submission is in `submitted` or `under_review` state.
- Current implementation also enforces a single learner submission whenever the assessment includes an essay question, even if the trainer-configured attempt count is higher.
- Revision reopening policy after `needs_revision` is still pending trainer review UI implementation, but the learner-side rule remains single-attempt unless that later workflow explicitly reopens submission.

## Phase 2. Trainer Review, Course Completion, and Certificate Gating

- Owner: `Assess`, `FE`, `DB`
- Primary files and surfaces: `src/pages/validator/*`, `src/pages/trainer/*`, `src/pages/CourseDetail.tsx`, `src/pages/Dashboard.tsx`, `src/services/supabaseDatabaseService.ts`, `src/services/certificatePdfService.ts`, `src/pages/Certificates.tsx`, `src/pages/VerifyCertificate.tsx`, `supabase/migrations/*.sql`

- [x] Add a trainer review surface for essay submissions with response content, review decision, and personalized feedback.
- [x] Link essay review status back to module completion and overall course completion logic.
- [x] Remove trainee-side `mark as complete` actions where learners currently self-advance completion state.
- [x] Introduce trainer-controlled completion approval for every course, not only essay-based courses.
- [x] Disable automatic certificate generation for trainer-reviewed completion paths.
- [x] Define the fully manual certificate workflow for trainer and admin issuance, release, and audit history.
- [x] Update certificate eligibility checks so no certificate is created while essay reviews remain pending.
- [x] Update learner messaging so trainees understand when they are waiting for trainer feedback instead of seeing a generic incomplete state.

### Phase 2 Notes

- Essay/manual-review attempts now flow through the trainer learner-progress dialog, where trainers can open a learner course, review essay answers, and approve or return them with feedback.
- Auto-graded passed assessments now mark their module complete automatically, while essay/manual-review assessments only complete the module after trainer approval.
- Content-only modules no longer expose a learner-facing `Mark as Complete` button; progress is recorded automatically after time is spent in the module.
- Enrollment progress reaching 100% now moves the course into `pending` completion approval instead of auto-completing it.
- Certificates are no longer auto-generated from enrollment progress. Trainers and admins must release them manually, and issuance is now stamped with `issued_by` for audit history.

## Phase 3. Learner Experience and Progression Rules

- Owner: `FE`, `Assess`, `DB`
- Primary files and surfaces: `src/pages/CourseDetail.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Courses.tsx`, `src/services/moduleSessionService.ts`, `src/services/supabaseDatabaseService.ts`, `supabase/migrations/*.sql`

- [x] Review trainee-facing duration-hours messaging and decide whether it should be softened, repositioned, or explained better without removing the credited-hours model.
- [x] Keep course-defined hours in the data model for reporting, certificates, and completion credit.
- [x] When a trainee completes a course, record the official course hours even if the real elapsed learning time is shorter.
- [x] Keep separate analytics for actual elapsed time versus credited course hours so reporting can still measure average completion behavior honestly.
- [x] Implement sequential module prerequisite enforcement so blocked modules are visibly grayed out and cannot be opened early.
- [x] Define whether prerequisites are based on prior module completion, essay approval, assessment passing score, or a combination.
- [x] Shuffle quiz questions and answer options on each attempt where applicable.
- [x] Add anti-copy and anti-paste deterrents for all quiz types, while documenting that client-side prevention is not a full security boundary.

### Phase 3 Notes

- Learner-facing duration copy now emphasizes flexible pacing and official credited hours instead of raw pressure-oriented hour totals. Browse and recommendation cards soften pace language, while course detail explains that official hours are credited after trainer approval and actual study time is tracked separately.
- Enrollment completion snapshots now preserve two distinct values: `credited_duration_hours` for the official course-hour credit and `actual_learning_minutes` for the observed learning time gathered from module sessions, with fallback to completion and assessment timing when session data is missing.
- Sequential progression is now enforced from module order first, then merged with any explicit module prerequisite ids. In practice, prerequisite access is based on module completion, which already depends on assessment passing and essay/manual-review approval where applicable.
- Assessment attempts now shuffle question order and answer option order deterministically per attempt, and the learner assessment UI blocks copy, cut, paste, and context-menu shortcuts as deterrents only.

## Phase 4. Admin Progress Visibility and Enrollment Enhancements

- Owner: `FE`, `DB`
- Primary files and surfaces: `src/pages/admin/Enrollments.tsx`, `src/pages/admin/Reports.tsx`, `src/services/supabaseDatabaseService.ts`, `src/services/reportingService.ts`, `supabase/migrations/*.sql`

- [x] Expand admin enrollment management so admins can view learner progress with parity to current trainer-side practical visibility.
- [x] Decide whether admin needs only summary progress, module-by-module progress, assessment status, or essay review status as well.
- Decision: admin visibility includes summary progress, module-by-module progress, assessment state, and essay review state.
- [x] Surface learner last activity, blocked prerequisite state, and pending trainer review state where helpful in enrollment management.
- [x] Reserve extension points for future face-to-face enlistment and audience-filtered enrollment without implementing those flows yet.

### Phase 4 Notes

- Admin enrollment management now includes a per-enrollment progress dialog with workflow status, last activity, recent course sessions, module-by-module completion, assessment state, and essay review visibility.
- The admin drill-down now surfaces blocked prerequisite state per module by reusing the same sequential-plus-explicit prerequisite logic as the learner course experience.
- Future face-to-face enlistment and audience-filtered enrollment remain intentionally unimplemented, but the admin enrollment surface now calls them out as reserved extension points so later workflow fields can plug into the same screen.

## Phase 5. Registration Simplification and Post-Login Onboarding

- Owner: `Auth`, `FE`
- Primary files and surfaces: `src/pages/SignUp.tsx`, `src/pages/Dashboard.tsx`, `src/components/trainee/TraineeOnboardingModal.tsx`, `src/lib/onboarding.ts`, `src/contexts/AuthContext.tsx`, `src/types/auth.ts`, `supabase/migrations/*.sql`

- [x] Remove onboarding assessment questions from the registration flow so signup keeps only account essentials, trainee classification, and employee verification requirements.
- [x] Move onboarding assessment to a dashboard modal or guided flow after first login.
- [x] Preserve the existing trainee verification logic for PESO Client and PESO Employee while simplifying the signup form.
- [x] Decide whether the post-login onboarding can be skipped, resumed later, or must be completed before recommendations appear.
- [x] Make sure any recommendation, analytics, or learner-profile side effects currently tied to signup are moved to the post-login onboarding completion event.
- [x] Update dashboard prompts so the new onboarding flow clearly explains why the trainee should complete it.

Implementation notes:
- `src/pages/SignUp.tsx` now stops at account essentials plus PESO Employee verification requirements, then defers onboarding to the dashboard by setting a session flag for the first-login modal prompt.
- `src/components/trainee/TraineeOnboardingModal.tsx` is now the actual onboarding form, persists onboarding profile fields through `updateUser`, refreshes profile-driven recommendations, and logs the onboarding completion analytics event.
- `src/pages/Dashboard.tsx` now treats onboarding completion as the gate for recommendation surfaces, shows a dedicated CTA until completion, and keeps the flow resumable via the dashboard modal/session prompt.
- Follow-up fix after live QA: `supabase/migrations/065_add_onboarding_completion_profile_fields.sql` adds the missing `public.users` onboarding completion columns and backfills them from auth metadata, while `src/services/supabaseAuthService.ts` now writes and reads those fields from both auth metadata and the profile row.
- Live QA rerun is pending deployment of migration `065_add_onboarding_completion_profile_fields.sql` to the target Supabase project. Local build validation passed after the fix.
- Browser QA rerun on 2026-03-13 confirmed the Phase 5 UI flow works up to the live backend boundary: signup succeeds, the dashboard opens, the onboarding modal appears immediately, and recommendation gating copy renders correctly.
- That same browser QA also confirmed the current deployed database still blocks onboarding completion before migration `065` is applied: submitting the onboarding modal fails with `PGRST204` because `public.users.onboarding_completed_at` is missing from the live schema cache.
- Because auth metadata and recommendation side effects run before the profile-table update fails, the learner can temporarily land in an inconsistent state where onboarding looks completed and recommendations appear even though the profile-table write failed. Console QA also surfaced separate analytics rollup errors (`analytics_user_daily.user_id` null constraint violations) during recommendation refresh.
- Fresh browser QA rerun later on 2026-03-13 confirmed the live schema now accepts the onboarding completion write for a brand-new trainee account: signup redirected to the dashboard, the onboarding modal completed successfully, the modal stayed dismissed after reload, and personalized recommendations persisted across refresh.
- The remaining live blocker after that rerun is no longer onboarding persistence. Console QA still shows repeated Phase 1 analytics rollup failures with `analytics_user_daily.user_id` null constraint violations, plus `400` notification/analytics fetch noise that should be isolated separately from the now-working onboarding flow.
- Follow-up database fix: `supabase/migrations/066_fix_phase1_rollup_user_scope.sql` replaces `refresh_phase1_analytics_rollups` so per-user refreshes stay scoped, orphaned analytics events with no resolved learner are excluded from `analytics_user_daily`, and downstream course/module/recommendation rollups only recompute the affected scope when `p_user_id` is provided.

## Phase 6. Localization and Language Switching

- Owner: `FE`, `Auth`, `QA`
- Primary files and surfaces: `src/App.tsx`, `src/pages/**/*`, `src/components/**/*`, `src/lib/**/*`, possible new `src/i18n/*`, persisted user settings, `public/*`

- [ ] Choose the localization framework and translation loading strategy for React.
- [ ] Add a user-facing language switcher for English and Tagalog.
- [ ] Decide where language preference is stored: local storage, user profile, or both.
 - Decision: store language preference in the user profile for cross-device consistency, with a fallback to local storage for unauthenticated users or in case of profile loading issues.
- [ ] Inventory learner-facing UI strings first, then identify which trainer/admin strings remain intentionally untranslated in the first rollout.
- [ ] Extract strings into dedicated translation resource files instead of leaving them inline across pages and services.
- [ ] Support a translation content structure that can be updated later without changing core feature code, and that can scale to more languages in future phases.
- [ ] Define a fallback strategy for untranslated or intentionally deferred admin/trainer text.
- [ ] Include localization testing for long labels, modal text, empty states, and validation messages.

## Phase 7. User Preferences and Settings Foundation

- Owner: `FE`, `Auth`, `DB`
- Primary files and surfaces: possible new `src/pages/Settings.tsx`, `src/components/settings/*`, `src/contexts/AuthContext.tsx`, `src/App.tsx`, `src/types/auth.ts`, `src/types/database.ts`, `supabase/migrations/*.sql`

- [ ] Add a settings page where all users can manage personal preferences.
- [ ] Support language preference selection and persistence for each user.
- [ ] Support theme preference selection and persistence for each user.
- [ ] Design the settings data model so future preferences can be added without reworking the page structure.
- [ ] Decide whether preferences are stored only in user profiles, only in local storage, or synchronized across both.
    - Decision: store preferences in user profiles for cross-device consistency, with local storage as a fallback for unauthenticated users or in case of profile loading issues.
- [ ] Add clear defaults and fallback behavior when a saved preference is missing or invalid.

## Phase 8. Data Standardization and Schema Cleanup

- Owner: `DB`, `Auth`, `QA`
- Primary files and surfaces: `supabase/migrations/*.sql`, `src/types/database.ts`, `src/types/auth.ts`, `src/pages/SignUp.tsx`, `src/pages/Profile.tsx`, `src/lib/profileFieldValidation.ts`

- [ ] Audit current `TEXT` versus `VARCHAR` usage and document which columns truly need normalization versus which are already acceptable as unbounded text.
- [ ] Decide whether the requirement is strict conversion to `VARCHAR(n)` or simply consistent validation at the application boundary.
 - Decision: implement consistent validation at the application boundary for now.
- [ ] Add or tighten database constraints for phone numbers to enforce 11 digits and the `09XXXXXXXXX` pattern.
- [ ] Align frontend validation, profile editing, signup, imports, and admin user-management flows to the same phone rule.
- [ ] Review other identity and reporting fields for missing length constraints or inconsistent formats.
- [ ] Confirm that migrations are safe for existing rows before applying stricter constraints in production.

## Phase 9. QA, Rollout, and Migration Validation

- Owner: `QA`, with support from `FE`, `DB`, `Auth`, `Assess`
- Primary files and surfaces: assessment authoring, learner quiz-taking, trainer review, admin enrollments, onboarding modal, localization switcher, Supabase schema and policies

### Current QA Status

- March 13, 2026: Live authenticated QA succeeded for the deployed Phase 2 schema. Direct probes with trainer credentials confirmed that `assessment_attempts.review_status`, `assessment_answers.review_status`, `enrollments.completion_approval_status`, and `certificates.issued_by` are present and queryable in the connected Supabase project.
- March 13, 2026: Live role-access checks passed for the surrounding operational surfaces. `trainer@peso.academy`, `admin@peso.academy`, and `trainee@peso.academy` could all authenticate; the trainer account could read its managed course set; the admin account could access `get_trainees_for_verification()`; and the trainee account was correctly denied access to the verification queue.
- March 13, 2026: Live trainer-course inspection confirmed that `Introduction to Data Science` currently has 6 modules and 6 assessments, but none of its `assessment_questions` rows use `question_type = 'essay'`.
- March 13, 2026: Live data inspection also confirmed that the trainer-managed course currently has no `assessment_attempts` rows with `requires_manual_review = true`, no enrollments in `completion_approval_status = 'pending'` or `approved`, and no released certificates linked to those enrollments. Because of that, the new review, completion-approval, and manual-certificate paths are deployed but still unexercised in live data.
- March 13, 2026: End-to-end Phase 2 runtime QA therefore remains partially blocked by missing live essay-enabled and completion-ready test data, not by missing schema. The next live QA pass should use a seeded or edited course that contains at least one essay question and a trainee enrollment progressed far enough to enter approval-gated completion.
- March 13, 2026: Live Phase 3 progression QA confirmed sequential locking against a real trainee enrollment in `Introduction to Data Science`. The enrolled trainee has only Module 1 recorded as completed, Module 2 remains accessible, and Modules 3 through 6 are correctly blocked by earlier incomplete modules when evaluated from live `modules` and `module_completions` rows.
- March 13, 2026: Live Phase 3 shuffle QA also succeeded against the same course. Module 1 has a 7-question assessment, and two real learner attempt ids for that assessment produced different question orderings and different answer-option orderings when the production `AssessmentInterface` deterministic shuffle algorithm was replayed with live `assessment_questions` data. This confirms per-attempt shuffle behavior without needing to mutate live learner state.
- March 13, 2026: One live-data inconsistency surfaced during Phase 3 QA. The same trainee enrollment has Module 1 marked completed even though the only submitted Module 1 assessment attempt scored 43% and failed. Sequential locking still behaves correctly relative to the stored completion state, but this row should be treated as a legacy or alternate-path completion record and reviewed separately before considering progression QA fully clean.
- March 13, 2026: A dedicated live QA seed course, `QA Essay Review Trace 2026-03-12T20-38-55-717Z`, was created with one mixed essay assessment, one trainee enrollment, and one submitted manual-review attempt. This removed the earlier live-data blocker for Phase 2 validation and confirmed that trainee-side essay submission rows can be seeded and read live.
- March 13, 2026: Live Phase 2 policy QA found a trainer review blocker. The trainer account can read the seeded `assessment_attempts` row, but `UPDATE public.assessment_attempts` on that row is a silent no-op under RLS. Because `assessmentService.reviewManualAttempt()` expects the update to return a row from `.select().single()`, the current live trainer review flow would fail before it can approve or reject essay work.
- March 13, 2026: The same `assessment_attempts` review update is also a silent no-op for the admin account. Admin can read the seeded manual-review attempt, but direct updates to `review_feedback`, `reviewed_at`, and `reviewed_by` do not persist. This indicates the live blocker is broader than just the trainer portal.
- March 13, 2026: Role-matrix QA also found that a trainee account can insert a `module_completions` row for the seeded essay module directly, while trainer and admin inserts to that table are blocked by RLS for the same enrollment. That means learner-side direct API access could bypass essay review gating at the database-policy level even though the current UI does not expose that path.
- March 13, 2026: Downstream completion gating is only partially validated live. After the seeded enrollment was moved to `completion_approval_status = 'pending'`, the trainer account could approve the enrollment and set credited vs actual time values, but trainer-side certificate insertion was blocked by RLS even though the product currently exposes trainer manual-release actions. Admin certificate insertion succeeded once the enrollment was already approved.
- March 13, 2026: Follow-up implementation added `supabase/migrations/064_fix_manual_review_completion_and_certificate_rls.sql` to repair the RLS layer. The migration grants course managers real update access for `assessment_attempts` and `assessment_answers`, limits learner-owned `module_completions` writes to content-only modules or modules with a passed learner attempt, grants course managers module-completion writes for trainer-approved paths, and allows trainer/admin certificate issuance only when an approved enrollment exists for that learner and course.
- March 13, 2026: Post-deployment live QA passed on fresh seeded courses after `064_fix_manual_review_completion_and_certificate_rls.sql` was applied. Trainer review updates now persist on `assessment_attempts` and `assessment_answers`, and learner-side direct mutation of an assessed `module_completions` row is blocked by RLS until the learner has a passed attempt.
- March 13, 2026: Fresh trainer-issued certificate QA passed end to end on course `3a46aa3a-1e8d-49a6-8f9f-7e8b63862a83`. The trainee submission was reviewed and approved by the trainer, trainer-side module completion insert succeeded, the enrollment moved through `pending` to `approved`, certificate insertion was correctly blocked before approval, and trainer certificate issuance succeeded after approval with `issued_by` set to the trainer profile id.
- March 13, 2026: Fresh admin-issued certificate QA also passed on course `5ce43fc7-3f34-4952-9929-a0bfd5d21f33`. Admin-side assessment review updates persisted, admin-side module completion insert succeeded, trainer-side completion approval persisted on the enrollment, and admin certificate issuance succeeded after approval with `issued_by` set to the admin profile id.

- [ ] Test trainer authoring for essay questions, mixed quiz types, and shuffled attempts.
- [ ] Test learner essay submission, retry behavior, and trainer feedback visibility.
- [x] Test that courses with pending essay reviews cannot auto-complete or auto-generate certificates.
- [x] Test trainer-controlled completion and certificate issuance flows.
- [x] Test prerequisite-grayed modules and blocked progression behavior across refreshes and resumed sessions.
- [ ] Test admin enrollment management progress visibility against real learner data.
- [ ] Test registration after onboarding assessment removal and confirm the dashboard modal handles first-login onboarding correctly.
- [ ] Test English and Tagalog switching across learner, trainer, and admin surfaces.
- [ ] Test the new user settings page for preference persistence, defaults, and cross-session behavior.
- [ ] Test phone validation and any new schema constraints against existing production-like records.

## Recommended Delivery Order

1. Phase 0 first, because certificate, completion, and essay-review rules need to be settled before implementation.
2. Phase 1 and Phase 2 next, because essay review changes the assessment and completion architecture.
3. Phase 3 and Phase 4 after that, because learner progression and admin visibility depend on the new completion model.
4. Phase 5 next, because onboarding relocation is lower risk once assessment workflow decisions are stable.
5. Phase 6 and Phase 7 next, because localization and user preferences should land together.
6. Phase 8 next, because schema cleanup should follow the finalized validation and settings model.
7. Phase 9 last, with focused regression checks after each earlier phase instead of one big-bang QA pass.

## High-Risk Areas

- Assessment data model changes may affect existing module assessments and learner attempts.
- Removing automated certificate issuance changes completion expectations across learner, trainer, and reporting flows.
- Crediting official course hours while also tracking real elapsed time requires careful reporting semantics.
- Localization will touch a large percentage of UI copy and validation messaging.
- User settings add a new cross-cutting persistence surface that can affect localization and theming behavior.
- Tightening schema constraints for phone and text fields can break older data if backfill rules are not defined first.




