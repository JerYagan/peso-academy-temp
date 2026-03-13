# Trainee Registration, Verification, and Onboarding Checklist

## Goal

- [ ] Implement a two-track trainee registration flow for `PESO Client` and `PESO Employee`.
- [ ] Add account verification before trainees can take courses.
- [ ] Add a post-login onboarding modal for new trainees after they land on the dashboard.

## Owner Tags

- `DB` = Supabase schema, migrations, triggers, and RPC updates
- `Auth` = signup, session, profile creation, and user mapping
- `FE` = page and component UI work
- `QA` = manual validation and regression checks

## Product Rules

- [ ] Keep both user types under the existing app role `trainee`.
- [ ] Add a separate `trainee_type` classification with values `peso_client` and `peso_employee`.
- [ ] Allow both trainee types to sign in and access the dashboard after registration.
- [ ] Allow both trainee types to browse courses and modules.
- [ ] Block both trainee types from taking courses until verified by admin or trainer.
- [ ] Require PESO Employee users to register with a PESO domain email. Also add an admin settings page to configure the allowed domain(s) for employee registration.
- [ ] Require PESO Employee users to provide `employee ID` and `physical ID` during registration.

## Phase 1. Schema and Type Foundation

- Owner: `DB`, `Auth`
- Primary files: `supabase/migrations/*.sql`, `src/types/auth.ts`, `src/types/database.ts`, `src/services/supabaseAuthService.ts`, `src/services/supabaseDatabaseService.ts`

- [x] [`DB`] Add a Supabase migration to extend `public.users` with `trainee_type`. Files: `supabase/migrations/*.sql`
- [x] [`DB`] Add a Supabase migration to extend `public.users` with `verification_status default 'pending'`. Files: `supabase/migrations/*.sql`
- [x] [`DB`] Add a Supabase migration to extend `public.users` with `employee_id`. Files: `supabase/migrations/*.sql`
- [x] [`DB`] Add a Supabase migration to extend `public.users` with `physical_id`. Files: `supabase/migrations/*.sql`
- [x] [`DB`] Add a Supabase migration to extend `public.users` with `verification_submitted_at`. Files: `supabase/migrations/*.sql`
- [x] [`DB`] Add a Supabase migration to extend `public.users` with `verified_at`. Files: `supabase/migrations/*.sql`
- [x] [`DB`] Add a Supabase migration to extend `public.users` with `verified_by`. Files: `supabase/migrations/*.sql`
- [x] [`DB`] Add a Supabase migration to extend `public.users` with `verification_notes`. Files: `supabase/migrations/*.sql`
- [x] [`DB`] Add a Supabase migration to extend `public.users` with `onboarding_modal_seen_at`. Files: `supabase/migrations/*.sql`
- [x] [`DB`] Update any `handle_new_user` trigger logic so new trainees default to `verification_status = 'pending'`. Files: `supabase/migrations/*.sql`
- [x] [`DB`] Add a system settings table for configurable employee registration domains. Files: `supabase/migrations/*.sql`
- [x] [`DB`] Seed a public `employee_registration_allowed_domains` setting placeholder for the future admin settings page. Files: `supabase/migrations/*.sql`
- [x] [`DB`] Update any RPCs, admin queries, or helper functions that read from `public.users`. Files: `supabase/migrations/*.sql`, `src/services/supabaseDatabaseService.ts`
- [x] [`Auth`] Update generated or handwritten TypeScript database types if they are stored in the repo. Files: `src/types/database.ts`, `src/types/auth.ts`
- [x] [`Auth`] Extend `src/types/auth.ts` with trainee type fields. Files: `src/types/auth.ts`
- [x] [`Auth`] Extend `src/types/auth.ts` with verification status fields. Files: `src/types/auth.ts`
- [x] [`Auth`] Extend related app types with employee verification fields. Files: `src/types/auth.ts`, `src/types/database.ts`
- [x] [`Auth`] Extend related app types with onboarding modal tracking fields. Files: `src/types/auth.ts`, `src/types/database.ts`
- [x] [`DB`][`Auth`] Define safe backfill behavior for existing trainees. Files: `supabase/migrations/*.sql`, rollout notes

## Phase 2. Signup Flow Split

- Owner: `FE`, `Auth`
- Primary files: `src/pages/SignUp.tsx`, `src/services/supabaseAuthService.ts`, `src/contexts/AuthContext.tsx`, `src/types/auth.ts`

- [x] [`FE`] Refactor `src/pages/SignUp.tsx` to start with trainee type selection. Files: `src/pages/SignUp.tsx`
- [x] [`FE`] Add `PESO Client` as a selectable trainee type. Files: `src/pages/SignUp.tsx`
- [x] [`FE`] Add `PESO Employee` as a selectable trainee type. Files: `src/pages/SignUp.tsx`
- [x] [`Auth`] Keep `role = trainee` for both signup branches. Files: `src/services/supabaseAuthService.ts`, `src/types/auth.ts`
- [x] [`FE`] Add employee-only form fields for `employee ID` and `physical ID` upload. Files: `src/pages/SignUp.tsx`
- [x] [`FE`][`Auth`] Enforce PESO-domain email validation when `trainee_type = peso_employee`. Files: `src/pages/SignUp.tsx`, `src/services/supabaseAuthService.ts`
- [x] [`FE`] Do not apply PESO-domain validation to `PESO Client`. Files: `src/pages/SignUp.tsx`
- [x] [`FE`] Require employee-only fields only when `trainee_type = peso_employee`. Files: `src/pages/SignUp.tsx`
- [x] [`FE`] Update draft persistence so the new fields are saved and restored. Files: `src/pages/SignUp.tsx`
- [x] [`FE`] Update form-step validation so the new fields are validated in the correct step. Files: `src/pages/SignUp.tsx`
- [x] [`Auth`] Update `src/services/supabaseAuthService.ts` signup metadata to include `trainee_type`. Files: `src/services/supabaseAuthService.ts`
- [x] [`Auth`] Update `src/services/supabaseAuthService.ts` signup metadata to include employee identity fields. Files: `src/services/supabaseAuthService.ts`
- [x] [`Auth`] Update fallback profile creation logic so the new fields are inserted if the trigger misses. Files: `src/services/supabaseAuthService.ts`
- [x] [`Auth`] Set `verification_submitted_at` when trainee registration is completed. Files: `src/services/supabaseAuthService.ts`, `supabase/migrations/*.sql`

## Phase 3. Verification Workflow

- Owner: `FE`, `Auth`, `DB`
- Primary files: `src/pages/admin/Users.tsx`, `src/pages/Dashboard.tsx`, `src/services/supabaseDatabaseService.ts`, `src/lib/roleConfig.ts`, `supabase/migrations/*.sql`

- [x] [`FE`] Decide whether to extend `src/pages/admin/Users.tsx` or build a dedicated verification queue. Files: `src/pages/admin/Users.tsx`, possible new page in `src/pages/`
- [x] [`FE`] Prefer a shared verification surface for admin and trainer to avoid exposing all admin actions. Files: `src/pages/admin/Users.tsx`, possible new page in `src/pages/`
- [x] [`FE`] Add trainee type filters to the verification UI. Files: `src/pages/admin/Users.tsx` or new verification page
- [x] [`FE`] Add verification status filters to the verification UI. Files: `src/pages/admin/Users.tsx` or new verification page
- [x] [`FE`] Show `employee ID` in the verification UI. Files: `src/pages/admin/Users.tsx` or new verification page
- [x] [`FE`] Show the uploaded `physical ID` image in the verification UI. Files: `src/pages/admin/Users.tsx` or new verification page
- [x] [`FE`] Show visible badges for `pending`, `verified`, and `rejected` statuses. Files: `src/pages/admin/Users.tsx`, possible shared badge component
- [x] [`FE`][`Auth`] Add a `Verify` action for admin and trainer. Files: `src/pages/admin/Users.tsx`, `src/services/supabaseDatabaseService.ts`
- [x] [`FE`][`Auth`] Add a `Reject` action for admin and trainer. Files: `src/pages/admin/Users.tsx`, `src/services/supabaseDatabaseService.ts`
- [x] [`FE`] Add an optional reviewer note field. Files: `src/pages/admin/Users.tsx` or new verification page
- [x] [`DB`][`Auth`] Store `verified_at` when verification is approved. Files: `supabase/migrations/*.sql`, `src/services/supabaseDatabaseService.ts`
- [x] [`DB`][`Auth`] Store `verified_by` when verification is approved. Files: `supabase/migrations/*.sql`, `src/services/supabaseDatabaseService.ts`
- [x] [`DB`][`Auth`] Store `verification_notes` when a reviewer leaves feedback. Files: `supabase/migrations/*.sql`, `src/services/supabaseDatabaseService.ts`
- [x] [`Auth`][`FE`] Make sure trainer permissions allow verification without exposing unrelated admin controls. Files: `src/lib/roleConfig.ts`, route guards, verification page access

## Phase 4. Course Access Enforcement

- Owner: `Auth`, `FE`
- Primary files: `src/services/supabaseDatabaseService.ts`, `src/pages/Courses.tsx`, `src/pages/CourseDetail.tsx`, `src/pages/Dashboard.tsx`

- [x] [`Auth`] Update `src/services/supabaseDatabaseService.ts` so `enrollInCourse` rejects trainees whose `verification_status` is not `verified`. Files: `src/services/supabaseDatabaseService.ts`
- [x] [`Auth`] Enforce the verification check in the service layer even if UI buttons are disabled. Files: `src/services/supabaseDatabaseService.ts`
- [x] [`FE`] Update `src/pages/Courses.tsx` to disable enroll actions for unverified trainees. Files: `src/pages/Courses.tsx`
- [x] [`FE`] Update `src/pages/CourseDetail.tsx` to disable enroll or start actions for unverified trainees. Files: `src/pages/CourseDetail.tsx`
- [x] [`FE`] Update `src/pages/Dashboard.tsx` trainee CTAs to reflect pending verification status. Files: `src/pages/Dashboard.tsx`
- [x] [`FE`][`Auth`] Replace generic enrollment errors with clear verification messaging. Files: `src/services/supabaseDatabaseService.ts`, `src/pages/Courses.tsx`, `src/pages/CourseDetail.tsx`
- [x] [`FE`] Show a clear message for pending verification. Files: `src/pages/Courses.tsx`, `src/pages/CourseDetail.tsx`, `src/pages/Dashboard.tsx`
- [x] [`FE`] Show a clear message for rejected verification if that state is supported for re-entry. Files: `src/pages/Courses.tsx`, `src/pages/CourseDetail.tsx`, `src/pages/Dashboard.tsx`

## Phase 5. Dashboard Onboarding Modal

- Owner: `FE`, `Auth`
- Primary files: `src/pages/Dashboard.tsx`, possible new component in `src/components/`, `src/services/supabaseDatabaseService.ts`

- [x] [`FE`] Add a trainee-only onboarding modal to `src/pages/Dashboard.tsx` or a dedicated component. Files: `src/pages/Dashboard.tsx`, `src/components/trainee/TraineeOnboardingModal.tsx`
- [x] [`FE`] Show the modal after first successful signup redirect to the dashboard. Files: `src/pages/Dashboard.tsx`, `src/pages/SignUp.tsx`
- [x] [`FE`] Show the modal content for both `PESO Client` and `PESO Employee`. Files: `src/pages/Dashboard.tsx`, `src/components/trainee/TraineeOnboardingModal.tsx`
- [x] [`FE`] Include a welcome message. Files: `src/components/trainee/TraineeOnboardingModal.tsx`
- [x] [`FE`] Include the trainee's current verification status. Files: `src/components/trainee/TraineeOnboardingModal.tsx`
- [x] [`FE`] Include a short explanation that verification is required before taking courses. Files: `src/components/trainee/TraineeOnboardingModal.tsx`
- [x] [`FE`] Include a reminder to complete the trainee profile. Files: `src/components/trainee/TraineeOnboardingModal.tsx`
- [x] [`FE`] Include quick links to `Profile` and `Courses`. Files: `src/components/trainee/TraineeOnboardingModal.tsx`
- [x] [`Auth`][`FE`] Track when the modal is seen or dismissed using `onboarding_modal_seen_at` or equivalent client logic. Files: `src/pages/Dashboard.tsx`, `src/contexts/AuthContext.tsx`
- [x] [`FE`] Decide whether the modal should reappear for unverified trainees until dismissed once. Files: `src/pages/Dashboard.tsx`

## Phase 6. QA and Migration Validation

- Owner: `QA`, with support from `FE`, `Auth`, `DB`
- Primary files and surfaces: signup flow, verification UI, dashboard, course catalog, course detail, Supabase user rows

### QA Status Notes

- March 12, 2026: Code-level QA for Phase 4 passed. `npm run build` completed successfully after the enrollment-gating changes.
- March 12, 2026: Static verification-path review confirmed pending and rejected messaging plus disabled enrollment CTAs in `Dashboard`, `Courses`, and `CourseDetail`, with service-layer enforcement in `enrollInCourse`.
- March 12, 2026: Phase 5 build validation passed after the trainee onboarding modal, dashboard persistence, and signup handoff changes.
- March 12, 2026: Local browser smoke check reached the app successfully through the Vite dev server at `http://127.0.0.1:8080/`.
- March 12, 2026: Live scripted QA is partially blocked in this shell because `SUPABASE_SERVICE_ROLE_KEY` is not available, so admin-side user seeding and controlled verification-state setup could not be run here.
- March 12, 2026: The originally documented public test accounts (`admin@peso.academy`, `trainer@peso.academy`, `jobseeker@peso.academy`) were not valid for the live project, but the updated credentials now work for `admin@peso.academy`, `trainer@peso.academy`, and `trainee@peso.academy`.
- March 12, 2026: Live verification workflow checks passed. Admin and trainer both accessed the trainee verification queue and updated `trainee@peso.academy` through `pending`, `rejected`, and back to `verified`. The trainee account was correctly blocked from reading the verification queue.
- March 12, 2026: Rejection-state propagation was confirmed at the profile level. After the trainer rejection test, the trainee profile row showed `verification_status = rejected` and the expected reviewer note before the account was restored to `verified`.
- March 12, 2026: Manual Supabase table inspection confirmed that the recent public Phase 6 signup accounts were created in both `auth.users` and `public.users`, including the temporary client, employee, self-heal, and auto-trigger accounts.
- March 12, 2026: Root cause for the live signup regression was identified in the repo. `057_add_trainee_verification_foundation.sql` redefined `public.handle_new_user()` but did not recreate the `on_auth_user_created` trigger or reapply the function owner and execute grants, so a database with a missing trigger would keep accepting auth signups without creating `public.users` rows.
- March 12, 2026: The authenticated fallback self-heal path was validated live. A newly signed-up trainee session was able to upsert its own `public.users` row successfully under the existing `Users can insert own profile` policy, so the remaining gap is restoring the database trigger and backfilling missing rows.
- March 12, 2026: Added `supabase/migrations/059_restore_auth_signup_profile_trigger.sql` to restore the auth signup trigger, reapply function privileges, and backfill any existing auth users missing `public.users` rows. Manual live table inspection later confirmed that automatic profile creation is functioning for the tested Phase 6 signups.
- March 12, 2026: Live signup QA now confirms both tested trainee classifications resolve their own `public.users` profile rows correctly after signing in. The `phase6.client.1773320065337@example.com` and `phase6.employee.1773320065337@peso.academy` accounts both authenticated successfully, resolved `get_current_user_profile_id()`, and read their own profile rows with the expected trainee type and `verification_status = pending`.
- March 12, 2026: Live employee-domain configuration currently falls back to the default `@peso.academy` domain because `employee_registration_allowed_domains` is stored as an empty array in `system_settings`. Code-level validation confirmed that employee signup accepts `@peso.academy`, rejects non-PESO domains, and only requires `employee ID` and `physical ID` for `PESO Employee` registrations.
- March 12, 2026: Live enrollment QA passed for both trainee types on the published course `Introduction to Data Science` (`4972b029-fadc-4451-871b-7a4c9b7a5966`). The client and employee accounts were both blocked while `verification_status = pending`, the employee account was blocked with the rejected-state path after being set to `rejected`, and both accounts were able to create live enrollments after being updated to `verified`.
- March 12, 2026: Existing trainee access remains intact after the migration work. The existing `trainee@peso.academy` account authenticated successfully, resolved its profile id, and read a `public.users` row with `trainee_type = peso_client` and `verification_status = verified`.
- March 12, 2026: Enrollment succeeded for both newly verified trainee accounts, but the follow-up `increment_enrolled_count` RPC returned an ambiguous-function error because two `increment_enrolled_count` signatures exist. This did not block enrollment creation, but course count increments should be treated as a follow-up fix.
- March 12, 2026: The app-side follow-up fix for the ambiguous `increment_enrolled_count` RPC is now in place. `src/services/supabaseDatabaseService.ts` was updated to call the two-argument signature with `increment_by: 1`, and a live sanity check against the same RPC with `increment_by: 0` completed successfully without changing the course count.
- March 12, 2026: Dashboard access for both trainee types is now validated from the live auth state plus route configuration. The tested client and employee accounts can authenticate, resolve their own `public.users` profile rows, and the `/dashboard` route is guarded only by authentication in `App.tsx` and `ProtectedRoute.tsx`, with no extra role or permission gate for trainees.
- March 12, 2026: The onboarding modal flow is validated from the implemented signup-to-dashboard handoff and dashboard trigger conditions. `SignUp.tsx` sets the session flag and navigates trainees to `/dashboard`, while `Dashboard.tsx` opens `TraineeOnboardingModal` when the user is a trainee, `onboarding_modal_seen_at` is still null, and either the signup onboarding summary or pending session flag is present. The live Phase 6 signup accounts still have `onboarding_modal_seen_at = null`, which is consistent with first-entry modal display.
- March 12, 2026: `npm run lint` is not yet a reliable pass/fail gate for this feature because the repo still has many unrelated pre-existing ESLint errors and warnings outside the Phase 4 scope.
- Phase 6 checklist below is complete. The final dashboard/onboarding items were closed with live auth/profile validation plus code-backed route and modal trigger verification.

- [x] [`QA`] Test signup for `PESO Client` with a non-PESO email. Surface: signup flow
- [x] [`QA`] Test signup for `PESO Employee` with a valid PESO-domain email. Surface: signup flow
- [x] [`QA`] Test that `PESO Employee` signup rejects non-PESO email domains. Surface: signup flow
- [x] [`QA`] Test that employee-only fields are required only for `PESO Employee`. Surface: signup flow
- [x] [`QA`] Test that both trainee types can reach the dashboard after signup. Surface: auth redirect and dashboard
- [x] [`QA`] Test that both trainee types cannot enroll while `verification_status = pending`. Surface: catalog, course detail, service enforcement
- [x] [`QA`] Test that both trainee types can enroll after `verification_status = verified`. Surface: catalog, course detail, service enforcement
- [x] [`QA`] Test rejection behavior for trainees with `verification_status = rejected`. Surface: verification flow and course gating
- [x] [`QA`] Test admin verification actions. Surface: verification UI
- [x] [`QA`] Test trainer verification actions. Surface: verification UI
- [x] [`QA`] Test the onboarding modal on first dashboard entry. Surface: dashboard
- [x] [`QA`] Test existing trainee accounts after backfill or migration. Surface: migrated user rows and dashboard access
- [x] [`QA`] Confirm no regression in public user creation to `public.users` after applying `059_restore_auth_signup_profile_trigger.sql`. Surface: auth signup and profile creation fallback

## Affected Areas

- [x] Update `src/pages/SignUp.tsx`.
- [x] Update `src/services/supabaseAuthService.ts`.
- [x] Update `src/services/supabaseDatabaseService.ts`.
- [x] Update `src/types/auth.ts`.
- [x] Update `src/types/database.ts`.
- [x] Update `src/pages/Dashboard.tsx`.
- [x] Update `src/pages/Courses.tsx`.
- [x] Update `src/pages/CourseDetail.tsx`.
- [x] Add a new verification page for admin and trainer.
- [x] Update route registration and dashboard navigation for the verification queue.
- [x] Add or update `supabase/migrations/*.sql`.
- [x] Add reusable status badge components if needed.
- [x] Add a migration to restore the auth signup profile trigger and backfill missing profile rows.
- [x] Add secure storage and reviewer access for uploaded trainee physical ID images.

## Acceptance Checklist

- [x] Signup starts with trainee type selection.
- [x] Employee signup requires PESO-domain email, employee ID, and a physical ID image upload.
- [x] Both trainee types can register and reach the dashboard.
- [x] Both trainee types remain blocked from taking courses until verified.
- [x] Admin and trainer can review and update trainee verification status.
- [x] The dashboard shows a first-run onboarding modal for trainees.
- [x] Existing trainee access does not break after migration.

## Decisions To Confirm

- [x] Confirm the exact PESO email domain to enforce for employees.
- Decision: `@peso.academy` for now, but will remain configurable in the future.
- [x] Confirm whether `physical ID` is a number, badge identifier, or uploaded document.
- Decision: `physical ID` should be handled as an uploaded document.
- [x] Confirm whether rejected trainees can edit and resubmit their verification details.
- Decision: rejected trainees can edit their details and resubmit for verification.
- [x] Confirm whether legacy trainees should be backfilled as `verified` or `pending`.
- Decision: backfill legacy trainees as `pending` to be safe, with the option to update them in bulk later if needed.
- [x] Confirm whether trainers can verify all trainees or only scoped trainees.
- Decision: trainers can verify all trainees.


## Issues:
- [x] Remove the Physical ID label of "Available in verification modal" change it to "Available"
- [x] Also Physical ID is still failing to load in the verification modal. Added storage-path normalization and user-folder fallback lookup for reviewer-side downloads.
- [x] Failed to load the uploaded physical ID image in the verification UI. Switched reviewer loading to authenticated storage download inside the verify modal and removed the exposed image link flow.
- [x] Remove the the ID link, the admin can see the physical ID image in the verify modal, along with other details of the trainee for verification. This is to protect the privacy of the trainees and also to make it easier for the admin and trainer to verify the trainees without having to leave the modal.
- [x] In the Registration module, users should not be able to put numbers in name, and letters in the employee ID/phone number fields. Added shared field sanitization and save-time validation for signup and profile editing so name fields reject numbers and numeric fields stay digits-only.


<!-- 
Admin: admin@peso.academy / password123
Trainer: trainer@peso.academy / password123
Trainee: trainee@peso.academy / password123
VITE_SUPABASE_URL=https://zecfzgajzkcoazqiafza.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_FmrsW1ZyYPQLDVv3f_GC5g_NMiFEoAj
 -->