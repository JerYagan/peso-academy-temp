# Verification, API Hardening, and Admin User Flow Plan

Created on March 16, 2026.

## Scope

This note addresses the following reported problems:

1. Verification queue needs pagination.
2. The Trainee Verification modal is redundant because clicking Verify or Reject already implies the target status.
3. API requests should be protected by auth/session tokens and server-side permission checks.
4. The system should display criteria for email and password.
5. Adding a new user triggers multiple API requests for a simple action.
6. Creating a new user should update the list without a full-page or auth-session-driven refresh cycle.

## Current Status Summary

### 1. Verification Queue Pagination

Status: partially addressed already.

- The current trainee verification page already has 15-row pagination in [src/pages/TraineeVerification.tsx](src/pages/TraineeVerification.tsx).
- The current implementation paginates after loading the full queue client-side.

Implication:

- If the complaint is about the absence of pagination, that issue is already fixed in the UI.
- If the complaint is about scalability, the remaining gap is server-side pagination or filtered RPC pagination so large queues do not require loading the entire result set first.

Recommended follow-up:

- Keep the current 15-row UI pagination.
- Add optional RPC-level pagination later if the verification queue becomes large enough to justify it.

## 2. Trainee Verification Modal Redundancy

Status: implemented on March 16, 2026.

Current behavior in [src/pages/TraineeVerification.tsx](src/pages/TraineeVerification.tsx):

- The table has separate Verify and Reject buttons.
- Clicking either button already sets `nextStatus`.
- The dialog then reopens a larger modal that still lets the reviewer choose the status again from a select input.

Root cause:

- The dialog is acting as both a detail viewer and a status editor.
- The status select duplicates the action that the user already chose from the table row.

Recommended fix:

- Replace the current large status-edit dialog with a compact action modal.
- Keep the selected action fixed:
  - Verify button opens a small confirm-verify modal.
  - Reject button opens a small confirm-reject modal.
- Remove the status selector from the modal.
- Keep only the information needed to complete the action:
  - trainee name/email
  - trainee type
  - optional physical ID preview or a link/button to view it
  - optional rejection note field if rejection feedback is needed

Expected result:

- Fewer clicks
- clearer intent
- no duplicate status selection
- easier reviewer workflow

Affected file:

- [src/pages/TraineeVerification.tsx](src/pages/TraineeVerification.tsx)

Implementation notes on March 16, 2026

- Replaced the larger status-edit dialog with a compact fixed-action modal.
- Removed the redundant status selector from the dialog.
- Kept the action-specific flow so Verify and Reject now open direct confirm modals.
- Preserved the physical ID preview for PESO Employee review and added optional rejection notes so the reviewer can still record follow-up guidance without re-selecting status.

## 3. API Requests Must Be Authenticated and Permission-Checked

Status: implemented on March 16, 2026.

Important clarification:

- Auth tokens should not be trusted because they appear in a request body.
- The robust pattern is:
  - authenticated Supabase client session or bearer token
  - server-side verification of the session/JWT
  - database-side enforcement using `auth.uid()`, role checks, RPC guards, and RLS policies

Current repo context:

- Many privileged actions use Supabase RPCs from the browser, including:
  - `get_trainees_for_verification`
  - `update_trainee_verification`
  - `set_user_role_by_id`
  - `delete_user_account`
- These should be protected by database-side authorization regardless of what the frontend sends.

Risk:

- If an RPC or endpoint relies only on client intent and not on authenticated server-side role checks, a crafted request could reach privileged logic without proper authorization.

Recommended fix:

- Audit every privileged RPC and endpoint.
- Require authenticated session context for all privileged actions.
- Enforce role authorization inside the RPC or server function itself.
- Do not trust role or user IDs supplied from the client unless the server validates them against the authenticated session.
- Prefer Authorization-header or Supabase-session-driven auth rather than custom tokens in JSON bodies.

Priority endpoints and flows to audit first:

1. trainee verification updates
2. admin role changes
3. user deletion
4. admin user creation

Likely files to inspect:

- [src/services/supabaseDatabaseService.ts](src/services/supabaseDatabaseService.ts)
- [src/services/supabaseAuthService.ts](src/services/supabaseAuthService.ts)
- related Supabase SQL migrations and RPC definitions under `supabase/migrations/`

Implementation notes on March 16, 2026

- Added [supabase/migrations/077_harden_privileged_rpc_auth.sql](supabase/migrations/077_harden_privileged_rpc_auth.sql) to harden the first-pass privileged RPC surface.
- Explicitly required authenticated session context for the verification queue RPCs and the admin role-change and account-delete RPCs, while still allowing `service_role` execution for controlled backend operations.
- Replaced older implicit trust assumptions with explicit role checks inside the SQL functions themselves so requests are denied unless the caller resolves to the required admin or trainer role server-side.
- Revoked default public and `anon` execute access from the hardened RPCs and re-granted execute only to `authenticated` and `service_role`.
- Added a service-layer guard in [src/services/supabaseAuthService.ts](src/services/supabaseAuthService.ts) so the admin page cannot enter the special admin-created-user branch unless a real authenticated admin session is present.

Remaining boundary note

- Admin user creation still uses the public client-side `signUp()` path today, so the deeper architectural cleanup to move admin provisioning into a dedicated backend-only endpoint remains part of item 5 rather than this RPC hardening pass.

## 4. Display Criteria for Email and Password

Status: implemented on March 16, 2026.

Current repo context:

- Signup now shows a password strength meter and password requirement checklist.
- Forgot-password validates email format.
- Reset-password and settings enforce the stronger password policy.

Remaining gap:

- Email criteria are still mostly implicit.
- Password criteria are not surfaced consistently on every auth/security surface.

Recommended fix:

- Standardize visible helper text across:
  - signup
  - forgot password
  - reset password
  - settings password change
  - profile password change if still exposed there
- Show email criteria explicitly:
  - valid email format required
  - PESO Employee must use allowed domain
- Show password criteria explicitly:
  - minimum 8 characters
  - uppercase
  - lowercase
  - number
  - special character

Expected result:

- fewer validation surprises
- fewer failed submissions
- clearer security requirements

Implementation notes on March 16, 2026

- Added a shared criteria panel component so email and password rules render with the same visual treatment across auth and security screens.
- Signup now shows explicit email criteria, including valid email format and the allowed PESO Employee domain requirement when the employee registration path is selected.
- Forgot-password now shows visible email-format criteria before submission instead of leaving that validation rule implicit.
- Reset-password and settings password change now both show the same visible password requirements that signup already enforces.
- Profile is no longer the live password-change surface in the current flow, so settings remains the canonical place for signed-in password updates.

## 5. Multiple API Requests for Admin User Creation

Status: implemented on March 16, 2026.

Current repo context from [src/pages/admin/Users.tsx](src/pages/admin/Users.tsx):

- Admin user creation calls `supabaseAuthService.signup(...)` directly from the browser.
- That signup path causes auth-session churn because `supabase.auth.signUp()` creates or switches to the new auth context.
- The app then works around that with session flags like `admin_creating_user` and later reloads the list again.
- The page also calls `loadUsers()` after successful creation.

Why this feels inefficient:

- The browser should not have to temporarily enter the new user creation flow as though it were the new user.
- The current approach couples admin account management to public signup behavior.
- It creates extra auth handling and repeated user-list refreshes.

Recommended fix:

- Move admin-created-user provisioning to a dedicated privileged backend path.
- Best option:
  - use a secure Edge Function or server-side endpoint with service-role access
  - verify the caller is an authenticated admin
  - create the auth user and profile server-side without switching the browser session
- Return the newly created user record directly to the admin page.

Expected result:

- no session swapping
- fewer redundant fetches
- simpler admin flow
- cleaner separation between public signup and admin provisioning

Implementation notes on March 16, 2026

- Added [supabase/functions/admin-create-user/index.ts](supabase/functions/admin-create-user/index.ts) as a dedicated backend-only admin provisioning path.
- The Edge Function now validates the caller's bearer token, confirms the caller resolves to an authenticated admin, creates the auth user with service-role access, and returns the created profile record directly.
- The browser no longer uses the public `supabase.auth.signUp()` flow for admin-created users, so admin account management is now separated from public signup behavior.
- The backend path explicitly sets `email_confirm: true` for admin-created accounts so provisioning does not depend on public email-confirmation behavior.


## 6. User List Should Update Without Refresh-Like Behavior
<!-- Clarification on this one, it's registering a new user, not literally admin making a new one -->
Status: implemented on March 16, 2026 after public-registration audit.

Clarification:

- This item refers to public registration of a new user, not the admin creating a user from the admin page.
- The complaint may still not be about a literal browser refresh.
- But the registration flow can still feel refresh-like if auth-state changes, onboarding routing, or post-signup data hydration cause visible churn immediately after signup.

Current repo context:

- Public signup is handled in [src/pages/SignUp.tsx](src/pages/SignUp.tsx) through `signup(...)`.
- Successful trainee signup currently does one of two things:
  - shows the verification-required success state when email confirmation is required, or
  - navigates the new trainee to the dashboard and sets the onboarding modal pending flag.
- The signup page itself does not issue the admin-page `loadUsers()` refetch pattern, so the earlier admin-user implementation solved a related but different flow.

Recommended fix:

- Audit the public registration success path directly instead of reusing the admin-user diagnosis.
- Confirm whether the perceived refresh comes from:
  - auth listener churn
  - redirect timing
  - onboarding modal bootstrapping
  - profile hydration or other post-login queries
- If unnecessary duplicate work exists, reduce the post-signup path to one intentional transition:
  - show verification-pending confirmation, or
  - navigate once into the trainee dashboard with no extra visible bounce.

Preferred behavior:

- register user
- complete exactly one intentional success transition
- avoid visible auth-session bounce or duplicate page churn
- keep onboarding and verification messaging clear without making the app feel like it reloaded

Implementation notes on March 16, 2026

- The admin-user improvements already completed under item 5 remain valid, but they should not be counted as the resolution for this item.
- Audited the public signup flow in [src/pages/SignUp.tsx](src/pages/SignUp.tsx) and confirmed the main churn risk was duplicated post-signup routing.
- The signup form already performs its own success transition, but the page also had an auth-driven redirect effect that could fire during the same signup cycle.
- Added a local guard so authenticated auth-state updates do not trigger a second redirect while the signup handler is still completing post-signup work such as employee document upload and onboarding flag setup.
- Verification-required signup still stays on the confirmation state, while direct authenticated signup now completes a single intentional navigation into the trainee dashboard.

## Implementation Order

1. Simplify the trainee verification action modal.
2. Audit privileged RPCs and server-side authorization.
3. Move admin user creation to a backend-only privileged flow.
4. Remove auth-session churn from admin user creation.
5. Reduce the admin page to a single post-create list update.
6. Standardize visible email/password criteria across auth and settings screens.
7. Evaluate whether verification queue pagination also needs server-side pagination.

## Acceptance Criteria

### Verification Queue

- The verification queue remains paginated.
- Verify and Reject actions open a small confirm-action modal.
- The modal does not ask the reviewer to choose the same status again.

### API Hardening

- Privileged RPCs reject unauthenticated requests.
- Privileged RPCs reject authenticated users without the required role.
- No privileged flow depends only on client-supplied role or status values.

### Auth Criteria Visibility

- Email and password rules are visible before submission.
- Error messages match the displayed rules.

### Admin User Creation

- Creating a user does not switch the current admin session.
- Creating a user does not cause refresh-like UI churn.
- The user list updates once after successful creation.
- The user table reflects the new record without a full reload cycle.

### Public Registration Flow

- Registering a new public user does not cause visible refresh-like churn.
- The post-signup path performs one intentional success transition only.
- Verification-required signup stays on the confirmation state without unnecessary rerender loops.
- Direct post-signup dashboard routing does not visibly bounce through extra auth-driven states.

## Suggested Validation Pass

1. Open the trainee verification queue and verify a pending trainee from the row action.
2. Reject a trainee and confirm the rejection action uses the compact modal flow.
3. Attempt privileged RPC-backed actions with a non-admin account and confirm denial.
4. Create a user from the admin page and confirm the admin remains on the same page with one list update only.
5. Register a new public trainee account and confirm the post-signup flow does not feel like a refresh or bounce.
6. Check signup, reset-password, and settings screens to confirm email/password criteria are visible and consistent.
