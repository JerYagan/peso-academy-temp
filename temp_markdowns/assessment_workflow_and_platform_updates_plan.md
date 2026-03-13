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

- [x] Choose the localization framework and translation loading strategy for React.
- [x] Add a user-facing language switcher for English and Tagalog.
- [x] Decide where language preference is stored: local storage, user profile, or both.
 - Decision: store language preference in the user profile for cross-device consistency, with a fallback to local storage for unauthenticated users or in case of profile loading issues.
- [x] Inventory learner-facing UI strings first, then identify which trainer/admin strings remain intentionally untranslated in the first rollout.
- [x] Extract strings into dedicated translation resource files instead of leaving them inline across pages and services.
- [x] Support a translation content structure that can be updated later without changing core feature code, and that can scale to more languages in future phases.
- [x] Define a fallback strategy for untranslated or intentionally deferred admin/trainer text.
- [x] Include localization testing for long labels, modal text, empty states, and validation messages.

### Phase 6 Notes

- The first localization rollout is implemented with an in-repo resource layer under `src/i18n/*`, a shared `LocaleProvider`, and learner-facing English and Tagalog switching.
- Implemented learner/public coverage currently includes the public shell, home page, login, signup, shared authenticated learner shell, and the new settings page.
- Automated coverage now exists for locale hydration, structured translation retrieval, and signed-in language persistence. Browser QA also confirmed public language switching, settings-page switching, reload persistence, and the earlier `/settings` reload redirect regression fix.
- Trainer and admin surfaces intentionally remain English in this rollout and fall back to English when a translation key is missing.
- Learner-facing translation is still incomplete for the onboarding modal, dashboard body content, course experience, certifications, and profile surfaces. Those items are deferred into a separate follow-up phase below so they do not block the core workflow and initial localization delivery.

## Phase 7. User Preferences and Settings Foundation

- Owner: `FE`, `Auth`, `DB`
- Primary files and surfaces: possible new `src/pages/Settings.tsx`, `src/components/settings/*`, `src/contexts/AuthContext.tsx`, `src/App.tsx`, `src/types/auth.ts`, `src/types/database.ts`, `supabase/migrations/*.sql`

- [x] Add a settings page where all users can manage personal preferences.
- [x] Support language preference selection and persistence for each user.
- [x] Support theme preference selection and persistence for each user.
- [x] Design the settings data model so future preferences can be added without reworking the page structure.
- [x] Decide whether preferences are stored only in user profiles, only in local storage, or synchronized across both.
    - Decision: store preferences in user profiles for cross-device consistency, with local storage as a fallback for unauthenticated users or in case of profile loading issues.
- [x] Add clear defaults and fallback behavior when a saved preference is missing or invalid.

### Phase 7 Notes

- A dedicated `/settings` page is now live for authenticated users and is linked from the dashboard account menu.
- Language preference persists through the locale context with profile-backed storage plus local storage fallback, and browser QA confirmed the setting survives reload for a signed-in trainee.
- Theme preference now follows the same synchronized model as language at the application layer: `next-themes` keeps the browser-local fallback, while the authenticated preference is also written to auth metadata and the `public.users.theme_preference` profile field when the schema is deployed.
- Live browser QA confirmed that an authenticated trainee can change theme from the settings page and keep that choice after reloading `/settings`. The remaining live gap is deployment of `supabase/migrations/068_add_user_theme_preference.sql`, because the connected Supabase project still lacks the `theme_preference` profile column.
- The page structure now acts as a preference hub so future personal settings can be added without reworking navigation or page layout.

## Phase 8. Data Standardization and Schema Cleanup

- Owner: `DB`, `Auth`, `QA`
- Primary files and surfaces: `supabase/migrations/*.sql`, `src/types/database.ts`, `src/types/auth.ts`, `src/pages/SignUp.tsx`, `src/pages/Profile.tsx`, `src/lib/profileFieldValidation.ts`

- [x] Audit current `TEXT` versus `VARCHAR` usage and document which columns truly need normalization versus which are already acceptable as unbounded text.
- [x] Decide whether the requirement is strict conversion to `VARCHAR(n)` or simply consistent validation at the application boundary.
 - Decision: implement consistent validation at the application boundary for now.
- [x] Add or tighten database constraints for phone numbers to enforce 11 digits and the `09XXXXXXXXX` pattern.
- [x] Align frontend validation, profile editing, signup, imports, and admin user-management flows to the same phone rule.
- [x] Review other identity and reporting fields for missing length constraints or inconsistent formats.
- [x] Confirm that migrations are safe for existing rows before applying stricter constraints in production.

### Phase 8 Notes

- The audit result for this phase is to keep `TEXT` for genuinely free-form or evolving fields such as `address`, `occupation`, `education_level`, `barangay`, `city_municipality`, `province`, and longer notes/metadata-backed content, while enforcing tighter application-boundary rules on identity-style fields that have stable practical formats.
- The primary standardized field in this slice is `phone`. Shared validation now normalizes supported Philippine mobile formats into `09XXXXXXXXX` and rejects non-conforming values before profile or admin updates are written.
- Frontend and service-layer validation now share the same phone rule and postal-code rule, and additional application-boundary length checks were added for name, employee ID, address, occupation, education level, barangay, city/municipality, and province.
- `supabase/migrations/069_standardize_phone_numbers.sql` safely handles legacy production data by recording any changed phone values into `public.user_phone_normalization_audit`, normalizing convertible mobile numbers, clearing non-conforming leftovers to `NULL`, syncing auth metadata to the cleaned value, and then enforcing the `09XXXXXXXXX` check at the database layer.
- This phase intentionally does not convert profile text fields to `VARCHAR(n)` yet. The current repo uses enum checks, application-boundary validation, and targeted database constraints where the format is operationally strict enough to justify enforcement.

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
- March 13, 2026: Localization rollout validation now includes automated tests and browser QA. `npm run test` passes for the locale provider coverage, `npm run build` passes after the localization and settings changes, the public site successfully switches between English and Tagalog, and the selected language survives page reload.
- March 13, 2026: Browser QA for the new settings page passed for the trainee role after the route-guard reload fix. The page renders inside the authenticated shell, live language switching updates both the page and shared learner navigation, and reloading `/settings` now preserves access instead of redirecting back to the dashboard.
- March 13, 2026: Phase 7 follow-up QA confirmed that signed-in theme changes now update the settings page immediately and survive reload through the browser fallback path. The live Supabase project still returns `PGRST204` for `public.users.theme_preference`, so full profile-row persistence remains blocked until migration `068_add_user_theme_preference.sql` is deployed.
- March 13, 2026: Phase 8 application-boundary validation now has automated coverage. `npm run test` passes with shared phone and postal-code normalization tests, and `npm run build` passes after wiring the standardized validation into profile, signup, admin user editing, and both user-update service layers.
- March 13, 2026: Live database verification for the new phone constraint is still pending deployment of `supabase/migrations/069_standardize_phone_numbers.sql`. Because the current environment does not have the Supabase CLI installed, the migration was prepared and documented but not applied from this workspace.
- March 13, 2026: The initial localization QA scope is still intentionally learner-first. Public and learner shell flows were validated, but trainer/admin translation coverage remains deferred because those surfaces still intentionally fall back to English in the first rollout.
- March 13, 2026: Phase 9 trainer authoring QA passed live after re-checking the active trainer module editor. The editor still exposes essay, multiple-choice, true/false, and short-answer question types; the derived quiz summary reflects mixed/manual-review content correctly; and the previously validated per-attempt shuffle behavior remains covered by the seeded live assessment replay against production question data.
- March 13, 2026: Phase 9 cross-role browser QA also passed for the current localization rollout. Learner surfaces switch between English and Tagalog in both public and authenticated shells, while trainer and admin surfaces correctly retain English page content even when the shared language control is switched to Tagalog because those role-specific translations are still intentionally deferred.
- March 13, 2026: Phase 9 live trainer QA exposed a broken `get_user_permissions` RPC in the connected Supabase project (`42702`, ambiguous `user_id`). The frontend now uses the direct role-permission query path by default, which removed the trainer portal permission timeouts and allowed trainer learner-review flows to complete normally in live QA.
- March 13, 2026: Phase 9 live admin enrollment QA exposed another older-schema issue: the enrollment progress dialog still selected `assessments.derived_from_module_quiz`, which does not exist in the connected project. `getEnrollmentProgressDetail()` now uses a schema-neutral assessment projection, and the admin enrollment progress dialog again shows summary progress, essay review state, activity history, and module-level detail for real learner enrollments.
- March 13, 2026: Phase 9 learner essay QA now passes for submission-state visibility and trainer feedback visibility on course `00eb2648-13c9-442b-9267-5da66dd83098`. After a live trainer review changed the essay attempt to `needs_revision`, the learner course page showed the returned-review message instead of hanging on assessment load. A follow-up runtime fix stopped learner assessment reads from trying to mutate derived assessments during normal course playback.
- March 13, 2026: Revision retry behavior remains intentionally limited by the current workflow. Learners now see the trainer feedback and `needs revision` state live, but resubmission is still blocked with the existing message that revision reopening will be enabled in a later workflow update.
- March 13, 2026: Phase 9 live profile validation also passed for the browser-side constraints. The learner profile form rejected invalid phone input with `Phone number must use the 09XXXXXXXXX format.` and rejected invalid postal input with `Postal code must contain exactly 4 digits.` The database-layer constraint portion remains blocked until migration `069_standardize_phone_numbers.sql` is deployed to the connected Supabase project.

- [x] Test trainer authoring for essay questions, mixed quiz types, and shuffled attempts.
- [x] Test learner essay submission, retry behavior, and trainer feedback visibility.
- [x] Test that courses with pending essay reviews cannot auto-complete or auto-generate certificates.
- [x] Test trainer-controlled completion and certificate issuance flows.
- [x] Test prerequisite-grayed modules and blocked progression behavior across refreshes and resumed sessions.
- [x] Test admin enrollment management progress visibility against real learner data.
- [x] Test registration after onboarding assessment removal and confirm the dashboard modal handles first-login onboarding correctly.
- [x] Test English and Tagalog switching across learner, trainer, and admin surfaces.
- [x] Test the new user settings page for preference persistence, defaults, and cross-session behavior.
- [x] Test phone validation and any new schema constraints against existing production-like records.

### QA Gaps Still Open

- Theme persistence QA is only partially complete in the live environment because the frontend implementation is ready, but the connected Supabase project still needs migration `068_add_user_theme_preference.sql` before profile-row persistence can be verified across devices.
- Phone-constraint QA is only partially complete in the live environment because the frontend/service validation is now confirmed, but the connected Supabase project still needs migration `069_standardize_phone_numbers.sql` before the database constraint and legacy-phone normalization can be verified against live rows.
- Essay revision reopening is still a deliberate product gap. Trainer return-for-follow-up and learner feedback visibility now work live, but learner resubmission after `needs_revision` is still deferred to a later workflow phase.

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
- Remaining trainee-page translation work is high risk for copy regressions because onboarding, dashboard, course, certifications, and profile screens still mix localized and inline English content.
- Reworking onboarding into a multi-step flow is high risk for completion analytics, resume state, and recommendation gating because the modal currently behaves as a single submission surface.
- Removing signup-side helper content and correcting homepage visual polish are lower-risk UI changes, but they still need regression checks on responsive layout and public-page rendering.

## Phase 10. Post-Core UX and Localization Follow-Up

- Owner: `FE`, `Auth`, `QA`
- Primary files and surfaces: `src/components/trainee/TraineeOnboardingModal.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Courses.tsx`, `src/pages/CourseDetail.tsx`, `src/pages/Certificates.tsx`, `src/pages/Profile.tsx`, `src/pages/SignUp.tsx`, `src/pages/Index.tsx`, learner-facing translation resources

- [x] Finish learner-facing translation coverage for the remaining trainee surfaces: onboarding modal, dashboard body content, course browse/detail flows, certifications, and profile.
- [x] Convert the onboarding modal from a single long form into a multi-step flow so questions are broken into smaller sections with clearer progress and lower trainee fatigue.
- [x] Preserve onboarding resume behavior, recommendation gating, analytics events, and profile persistence when the onboarding flow becomes multi-step.
- [x] Remove the signup-side right-column helper sections labeled `What happens after signup` and `Verification stays unchanged`.
- [x] Fix the missing background treatment on step 3 of the `Your Path to Upskilling` section on the home page.
- [x] Re-run browser QA for responsive layout, translation completeness, onboarding completion rate risks, and public-page visual regressions after these follow-up changes land.

### Phase 10 Notes

- This phase is intentionally separated from the core assessment workflow, onboarding relocation, initial localization rollout, and settings foundation so the remaining UX and translation gaps can be estimated and prioritized independently.
- The main reason for separating this work is risk isolation: the core workflow and first localization slice are already functional, while the remaining items are broader usability and content-completeness improvements rather than blockers for the deployed architecture.
- March 13, 2026: Phase 10 implementation converted the learner onboarding modal into a three-step flow with progress state and session-storage draft resume, while preserving the existing completion write, recommendation refresh, analytics event, and dashboard recommendation gating behavior.
- March 13, 2026: Learner-facing copy was refreshed across the onboarding modal, learner dashboard, course browse/detail surfaces, certificates, and learner profile. Public follow-up cleanup also removed the signup helper side panels and restored the missing visual treatment on the third `Your Path to Upskilling` card.
- March 13, 2026: Validation passed with `npm run build`, plus browser QA on `/` and `/signup` confirmed the home-page process cards render with the new third-step background treatment and the signup page no longer shows the removed helper panels.

## UI QA Pass
- Do a final authenticated learner QA pass for onboarding, dashboard, courses, and profile.
- Do a full UI QA Pass
- Make the number 3 in "how it works" section color green because blue doesn't seem to render properly
- Investigate if the UI elements complies with the dark mode contrast
- Remove all the gradients in the system

### UI QA Notes

- March 13, 2026: Final learner browser QA passed across dashboard, onboarding modal entry, course catalog, course detail, profile, and certificates using the live `trainee@peso.academy` account.
- March 13, 2026: The home-page `Your Path to Upskilling` section now uses flat card surfaces instead of gradients, and step `03` was changed to green for reliable rendering in both light and dark themes.
- March 13, 2026: A broader UI cleanup removed gradient-based backgrounds from the main public, auth, learner, trainer, and admin dashboard/course surfaces so the application now uses flat semantic surfaces consistently.
- March 13, 2026: Dark-mode contrast was rechecked on the home page and learner profile after the flat-surface conversion. The home hero subtitle and the `How it works` cards required follow-up adjustment; after the fix, sampled text contrast landed at or above the normal-text threshold in the checked surfaces.
- March 13, 2026: Follow-up runtime fixes resolved the authenticated notification noise and the course-detail derived-assessment sync failure. Notifications now avoid the unread-count HEAD request and tolerate older `notifications` schemas that do not include `metadata`, while derived assessment lookups now treat missing module assessment rows as a normal no-op path.


## Questions:
- Does the system still have recommendation algorithms that suggest courses to learners based on their profile and activity? If so, how do the new assessment and completion rules affect recommendation logic?
- Does the system use hybrid recommendation (Skill-based recommendations -Content Based & Peer behavior-based recommendations - Collaborative). What exactly is the type of data analytics and algorithms used in system?
- Does the system record the time spent on each module or course by learners? If so, how does the new credited hours model interact with actual time tracking for reporting and analytics?
- Does the system have a recommendatory feature in the system that indicates future opportunities for learners

## Task for later
- Write a full documentation of how the algorithm works in the system, including the data it uses, how it processes that data, and how it generates recommendations for learners. Indicate the affected modules, components, and services in the codebase, and any relevant database tables or fields. You must be thourough and detailed in your explanation, and include examples of how the algorithm would work in practice.

---

1. Yes. The system still has active course recommendation logic for learners, and it is not just static tagging.
    The learner dashboard loads both hybrid recommendations and a separate assessment-only set from src/pages/Dashboard.tsx and src/pages/Dashboard.tsx. The main hybrid recommender is built in src/services/reportingService.ts, and refreshed/persisted for learner surfaces in src/services/recommendationSyncService.ts and src/services/analyticsService.ts.

    The new assessment and completion rules affect that logic in two different ways:

    Assessment results matter more now because the engine explicitly boosts or downranks courses using assessed strengths, weak topics, score bands, and recent assessment outcomes in src/services/reportingService.ts and src/services/reportingService.ts.

    Approval-gated completion changes what counts as “completed” for some recommendation signals. The hybrid recommender’s completed-course affinity only uses enrollments whose status is completed in src/services/reportingService.ts, so a learner at 100% but still pending approval will not yet get the “builds on your completed training” style boosts. But the collaborative logic still treats progress at 100% as a completion-like signal even if status is not yet completed in src/services/reportingService.ts and src/services/reportingService.ts. So pending approvals reduce some content-based progression signals, but not all peer-behavior signals.

2. Yes, the implemented learner recommender is hybrid. It combines:
    Content/profile-based signals: learner skills, preferred categories, industry interests, onboarding answers, course tags, course level, TESDA flag, and career-path metadata in src/services/reportingService.ts and src/services/reportingService.ts.

    Collaborative signals: similar learners are found from overlapping enrollments and progress closeness, then candidate courses are weighted by neighbor similarity and their progress/completion state in src/services/reportingService.ts.

    Session-behavior signals: recent sessions, recent active categories, struggle patterns, repeated incomplete modules, and healthy engagement are computed from module-session aggregates in src/services/reportingService.ts.

    Assessment-performance signals: strongest topic, weakest topic, failed competencies, score bands, and average assessment score drive both the hybrid model and the assessment-only fallback in src/services/reportingService.ts and src/services/reportingService.ts.

    Popularity weighting: course enrolled-count contributes as a separate popularity term in src/services/reportingService.ts.

    This is not an ML model in the strict sense. It is mostly heuristic scoring and rollup analytics:

    Hybrid learner recommendation score with an acceptance-probability heuristic in src/services/reportingService.ts.
    Assessment-only recommendation score with its own acceptance-probability heuristic in src/services/reportingService.ts.

    Persisted recommendation records with source mix, context, rank, score, and acceptance probability in supabase/migrations/036_add_phase1_analytics_schema.sql and src/services/analyticsService.ts.

    Predictive analytics for admins based on aggregated formulas, not black-box AI: course risk scores, learner disengagement scores, recommendation acceptance analytics, and learner skill profiles in supabase/migrations/036_add_phase1_analytics_schema.sql, supabase/migrations/036_add_phase1_analytics_schema.sql, and supabase/migrations/042_add_predictive_score_storage.sql.

3. Yes. The system records actual learner time, primarily at module-session level and then rolls it up for course/enrollment reporting.

    Module sessions store started time, last seen time, ended time, duration seconds, status, and resume position in src/types/database.ts and are created/updated by src/services/moduleSessionService.ts, src/services/moduleSessionService.ts, and src/services/moduleSessionService.ts.

    Module completions and assessment attempts also store time spent in src/types/database.ts and src/services/reportingService.ts.

The credited-hours model is kept separate from actual time:

Enrollments now carry both credited_duration_hours and actual_learning_minutes in src/types/database.ts.
Actual learning minutes are computed from the larger of:
summed module-session duration, or
summed module-completion time plus assessment-attempt time
in src/services/supabaseDatabaseService.ts and src/services/supabaseDatabaseService.ts.
Credited duration hours come from the course’s defined duration, and only become populated when completion is approved in src/services/supabaseDatabaseService.ts, src/services/supabaseDatabaseService.ts, and src/services/supabaseDatabaseService.ts.
So the interaction is:

actual_learning_minutes = observed effort / analytics truth
credited_duration_hours = awarded course credit after approval
That means reports can distinguish “how long the learner actually spent” from “how many hours the course is worth.”

One important edge case: the assessment-only evidence requires scored assessments, not just submitted ones, in src/services/reportingService.ts. If an essay or short-answer attempt is submitted but still waiting for manual review, it will count as activity/time but may not yet strengthen assessment-based recommendations until a score exists.

There is no clear active learner-facing “future opportunities” recommender beyond course recommendations. What does exist is:
Course recommendations framed as next steps on the learner dashboard in src/pages/Dashboard.tsx.

Course career-path metadata, which can influence recommendation reasons such as “Extends your progress toward ...” in src/services/reportingService.ts and src/services/reportingService.ts.

Admin/trainer predictive analytics for risk and disengagement, not a learner-facing opportunity engine, in src/services/reportingService.ts.

I do not see a live implementation of separate job or opportunity matching in the active repo. The only “job matching” references I found in the active code are marketing copy in src/i18n/locales/en.ts and src/i18n/locales/tl.ts. There is also a hidden “Job Matches” placeholder, but only in the nested duplicate repo copy, not the active dashboard file.


## Write in a different markdown a full QA run plan for the system and all users
- [ ] Write in a different markdown a full QA run for the system and all users (Admin, Trainer, Trainee) to check if there are any issues or bugs in the system after the changes have been implemented. This includes testing all the functionalities of the system such as course creation, registration, enrollment, progress tracking, assessment, and certificate generation. Also, check if the user interface is working properly and if there are any visual glitches or inconsistencies. Make sure to test on different devices and browsers to ensure compatibility. Document any issues found during the QA run and prioritize them for fixing before the next release.
- [ ] Identify gaps in the system and create a plan to implement the necessary changes to address those gaps. This includes identifying any missing features, improving existing functionalities, and enhancing the user experience. Create a roadmap for implementing these changes and assign tasks to the relevant team members to ensure timely completion. Regularly review the progress of these tasks and make adjustments as needed to ensure that the system continues to meet the needs of its users.
- [ ] Include: a verification if the system uses the same recommendation algorithms and data analytics as before, and if there are any changes in the way recommendations are generated for learners. Check if the system still provides personalized course recommendations based on the learner's profile and activity, and if the new assessment and completion rules have any impact on the recommendation logic. Document any changes or improvements in the recommendation system and ensure that it continues to provide relevant and accurate suggestions to learners.
- [ ] Include: verify if the system saves the progress of trainees such as quizzes, course completion, time spent on each module, and if the new credited hours model affects the way time is tracked and reported. This is to address a critical issue of power and internet interuptions that may cause trainees to lose their progress and data. Ensure that the system has a robust mechanism for saving and recovering trainee progress, and that the new credited hours model does not interfere with this functionality. Document any issues found during this verification and prioritize them for fixing to enhance the user experience and prevent data loss for trainees.