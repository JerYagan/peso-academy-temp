# Course Trainee Type Visibility Plan

## Goal

- Add a course audience selector in course creation and editing for `PESO Clients`, `PESO Employees`, and `All/General Public`.
- Show learner-facing courses only when the learner's `trainee_type` is allowed by the course audience.
- Prevent enrollment into courses that do not match the learner's allowed audience, even if the learner reaches the course by direct URL or stale UI state.

## Current State

- Learner profiles already support `trainee_type` in the `users` table and app types. Current values are `peso_client` and `peso_employee`.
- Courses do not currently store any audience field in shared app types or database types.
- Course creation and editing in `src/components/course/CourseCreateEditDialog.tsx` have no audience selector.
- Learner course discovery in `src/pages/Courses.tsx` loads all courses through `courseService.getCourses()` and only filters by `published` plus local UI state.
- Enrollment in `src/services/supabaseDatabaseService.ts` checks `published` and learner verification state, but it does not check `trainee_type` against a course audience.
- The database currently has open course read policies from older migrations, so UI-only filtering would not be sufficient protection.

## Product Decisions To Lock

- Store course audience as a single required value, not a multi-select, with these canonical values:
  - `general_public`
  - `peso_client`
  - `peso_employee`
- Treat `general_public` as visible to everyone, including unauthenticated users if the public catalog remains enabled.
- Treat existing courses with no explicit audience as `general_public` during migration so the rollout is backward-compatible.
- If a trainee account has a null or unknown `trainee_type`, only allow `general_public` courses until the profile is corrected.
- Keep admin and trainer visibility unrestricted so staff can manage and audit all courses regardless of audience.
- Enforce the rule at both the database and application layers. The app should hide mismatched courses, and the backend should still deny direct enrollment or direct read access where applicable.

## Target Behavior

### Admin And Trainer Authoring

- In the course create/edit dialog, add an `Audience` select with these labels:
  - `All / General Public`
  - `PESO Clients`
  - `PESO Employees`
- Default new courses to `All / General Public`.
- Show the selected audience as a badge in admin and trainer course lists so staff can audit visibility quickly.

### Learner Visibility

- Learners tagged as `peso_client` can see:
  - `general_public`
  - `peso_client`
- Learners tagged as `peso_employee` can see:
  - `general_public`
  - `peso_employee`
- Learners with missing `trainee_type` can see only:
  - `general_public`
- Admins and trainers can see all courses regardless of audience.

### Enrollment Rules

- Learners can enroll only if the course is `published` and the course audience matches their `trainee_type`, or the course is `general_public`.
- A direct link to a hidden course must not allow enrollment.
- Bulk enrollment and manual enrollment tools should validate audience compatibility and either block mismatched learners or skip them with a clear error report.

## Technical Design

### 1. Database Schema

- Add a non-null audience column to `public.courses`, for example `trainee_audience text not null default 'general_public'`.
- Add a check constraint limiting values to `general_public`, `peso_client`, and `peso_employee`.
- Backfill existing course rows to `general_public`.
- Add an index on the new column only if filtering volume justifies it after rollout.

Suggested migration tasks:

- Add the column and constraint.
- Backfill existing rows.
- Update any seed scripts or sample data that insert courses.
- Replace the legacy open course select policy with role-aware visibility rules.

### 2. Database Access And RLS

The course read policy should stop exposing all courses to every user.

Recommended policy direction:

- `admin` and `trainer` roles can read all courses.
- Authenticated trainees can read only:
  - published courses where `trainee_audience = 'general_public'`
  - published courses where `trainee_audience` equals their own `users.trainee_type`
- Anonymous users, if the public catalog remains accessible, can read only published `general_public` courses.

Recommended implementation shape:

- Add a helper function such as `public.get_current_user_trainee_type()` that resolves the current profile row consistently through `public.get_current_user_profile_id()`.
- Replace the legacy `Anyone can view courses` policy with role-aware policies built on `published`, role, and `trainee_audience`.
- Keep insert, update, and delete policies for staff unchanged unless they need column-level validation updates.

This is the key security step. Without it, learners could still read mismatched courses outside the intended UI.

### 3. Shared Types And Service Layer

Update shared app and database typing so the new field flows through the whole stack.

Primary files:

- `src/types/index.ts`
- `src/types/database.ts`
- `src/services/supabaseDatabaseService.ts`

Required changes:

- Add `traineeAudience` to the `Course` interface.
- Add `trainee_audience` to Supabase database types for the `courses` table.
- Include the new column in `COURSE_SELECT_FIELDS`, row mappers, cache payloads, create payloads, and update payloads.
- Preserve backward compatibility in read fallbacks so older schemas do not crash the app before migrations are applied.

Recommended enum mapping:

- DB: `general_public | peso_client | peso_employee`
- App type: `"general_public" | "peso_client" | "peso_employee"`
- UI labels handled in the page or shared formatter helper.

### 4. Course Authoring UI

Primary files:

- `src/components/course/CourseCreateEditDialog.tsx`
- `src/pages/admin/Courses.tsx`
- `src/pages/trainer/Courses.tsx`

Required changes:

- Add `traineeAudience` to the course form state.
- Show an audience select in the dialog with the three supported options.
- Include the field in preview, create, and edit payloads.
- Show the selected audience in course cards or table rows for staff visibility.

Optional improvement:

- Add a quick audience filter in the staff course list if course volume is high.

### 5. Learner Course Discovery

Primary files:

- `src/pages/Courses.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/CourseDetail.tsx`
- `src/services/recommendationSyncService.ts`

Required changes:

- Stop assuming `courseService.getCourses()` returns universally visible rows.
- If RLS is updated correctly, learner-facing reads should naturally exclude mismatched courses.
- Add a defensive client-side filter as a second guard so mixed caches or stale state do not flash restricted rows.
- Ensure `CourseDetail` handles restricted courses safely by showing not found or unavailable instead of exposing full details.
- Remove restricted courses from dashboard recommendations and any learner-side recommendation list.

Important note:

- Learner-facing filtering should cover every surface that consumes the course list, not just the Browse Courses page.

### 6. Enrollment Enforcement

Primary files:

- `src/services/supabaseDatabaseService.ts`
- `src/components/enrollment/BulkEnrollmentDialog.tsx`
- `src/pages/admin/Enrollments.tsx`

Required changes:

- In `enrollInCourse(...)`, fetch and validate `trainee_audience` together with `published` before inserting into `enrollments`.
- Also fetch the learner profile's `trainee_type` and reject mismatches with a specific error message.
- Extend bulk enrollment to skip or reject incompatible learners, returning a clear error list instead of silently enrolling them.
- Keep staff-managed exceptions out of v1 unless product explicitly wants an override flow. The safer default is consistent enforcement for both self-enrollment and bulk enrollment.

Suggested mismatch message:

- `This course is only available to PESO Clients.`
- `This course is only available to PESO Employees.`

### 7. Reporting And Downstream Effects

Primary files to review:

- `src/pages/admin/Reports.tsx`
- any analytics or recommendation pipeline that consumes `courseService.getCourses()`

Checks to make:

- Staff reports should still include all courses.
- Learner dashboards and recommendation cards should not include restricted courses.
- Existing enrollment counts and analytics should not break when the new field is added.

## Phase-By-Phase Implementation Plan

### Phase 1. Schema And Policy Foundation

#### Objective

- Add the course audience field at the database level and make course visibility enforceable through policy, not only through frontend filtering.

#### Checklist

- [x] Add `trainee_audience` to `public.courses` with `not null default 'general_public'`.
- [x] Add a check constraint allowing only `general_public`, `peso_client`, and `peso_employee`.
- [x] Backfill all existing courses to `general_public`.
- [x] Add or update helper SQL for resolving the current learner `trainee_type` through the profile row.
- [x] Replace the legacy open course `SELECT` policy with role-aware visibility rules.
- [x] Preserve full course visibility for `admin` and `trainer` roles.
- [x] Limit trainee read access to `published` courses that match `general_public` or the learner's own `trainee_type`.
- [x] Decide and implement anonymous read behavior for the public catalog.
- [x] Update any seed or fixture data that inserts course rows.
- [x] Regenerate or manually update `src/types/database.ts` after the migration shape is final.

#### Implementation Notes

- The current risk is not just incorrect UI visibility. Older migrations still expose broad course reads, so this phase is the real enforcement baseline.
- Use `general_public` as the migration-safe default so existing content remains visible after rollout.
- Prefer a small SQL helper such as `public.get_current_user_trainee_type()` that reads from `public.users` using `public.get_current_user_profile_id()` so policy logic stays readable.
- Keep the policy logic explicit around `published = true` for learner and anonymous reads. Staff should still be able to see draft and restricted courses for management.
- This phase should land before frontend visibility work if the goal is strong access control instead of cosmetic filtering.

#### Phase 1 Implementation Status On March 16, 2026

- Added `supabase/migrations/073_add_course_trainee_audience_and_visibility_rls.sql` to introduce `courses.trainee_audience`, backfill legacy rows to `general_public`, and enforce the allowed audience values with a check constraint.
- Added `public.get_current_user_trainee_type()` so RLS can resolve learner audience consistently through the existing profile-id helper.
- Replaced the legacy open course visibility with two explicit read policies:
  - anonymous users can read only published `general_public` courses
  - authenticated users can read all courses if they are staff, otherwise only published `general_public` or matching-audience courses
- Updated the reusable SQL seed helper `public.seed_course(...)` so future seed usage can set `trainee_audience`, while defaulting to `general_public` for backward compatibility.
- Updated `src/types/database.ts` so the generated database shape includes `trainee_audience` on course rows, inserts, and updates.

### Phase 2. Shared Types And Course Service

#### Objective

- Thread the new audience field through shared types, Supabase mappers, and course service reads and writes so the rest of the app can use it consistently.

#### Checklist

- [x] Add `traineeAudience` to the shared `Course` interface in `src/types/index.ts`.
- [x] Add `trainee_audience` to the `courses` table types in `src/types/database.ts`.
- [x] Add the new field to course select clauses in `src/services/supabaseDatabaseService.ts`.
- [x] Map `trainee_audience` to `traineeAudience` in course row mappers.
- [x] Include the field in course create payloads.
- [x] Include the field in course update payloads.
- [x] Update cache serialization and invalidation paths that store course objects.
- [x] Keep read fallbacks backward-compatible while the app may still hit a pre-migration schema.
- [x] Verify `getCourses()` and `getCourse()` continue to work for staff pages after the field is added.

#### Implementation Notes

- The safest app-level enum is `"general_public" | "peso_client" | "peso_employee"` so it stays aligned with database values and avoids conversion bugs.
- Update `COURSE_SELECT_FIELDS`, `mapCourseRecord(...)`, `createCourse(...)`, and `updateCourse(...)` together in the same change so the field does not disappear on edit.
- Any compatibility layer for older schemas should default missing `trainee_audience` to `general_public` until all environments are migrated.
- This phase also affects any feature that consumes `courseService.getCourses()`, including dashboard surfaces and recommendations.

#### Phase 2 Implementation Status On March 16, 2026

- Added `CourseTraineeAudience` and `course.traineeAudience` in `src/types/index.ts` so the app-level course model now carries audience targeting explicitly.
- `src/types/database.ts` already included the migration-backed `trainee_audience` field from Phase 1, so Phase 2 reuses that generated shape instead of introducing a second mapping layer.
- Replaced the course read select wildcard in `src/services/supabaseDatabaseService.ts` with an explicit `COURSE_SELECT_FIELDS` list that includes `trainee_audience`, allowing the existing missing-column fallback to strip the field automatically on older schemas.
- Updated `mapCourseRecord(...)` to normalize missing or unknown values back to `general_public`, which keeps cache entries and old-schema reads stable.
- Updated `createCourse(...)` and `updateCourse(...)` to write `trainee_audience`, defaulting to `general_public` when the field is not yet surfaced by the UI.
- Updated the existing course authoring payload builder to preserve an existing course audience on edit and send `general_public` for newly created courses until the dedicated audience selector is added in Phase 3.

### Phase 3. Admin And Trainer Authoring UX

#### Objective

- Let staff set and review audience targeting during course creation and editing.

#### Checklist

- [x] Add `traineeAudience` to the course dialog form state in `src/components/course/CourseCreateEditDialog.tsx`.
- [x] Add an `Audience` select field with:
  - [x] `All / General Public`
  - [x] `PESO Clients`
  - [x] `PESO Employees`
- [x] Default new courses to `All / General Public`.
- [x] Preload the selected value when editing an existing course.
- [x] Include the field in preview mode and save flows.
- [x] Show audience badges or labels in admin course cards.
- [x] Show audience badges or labels in trainer course cards if that page uses a separate surface.
- [x] Verify the field persists correctly across create, edit, draft, and publish flows.

#### Implementation Notes

- The current course authoring surface is `src/components/course/CourseCreateEditDialog.tsx`, reused by admin flows and likely the right place to centralize the change.
- Audience should be visible in staff lists, not only buried in the edit dialog, otherwise it becomes hard to audit restricted content at scale.
- Use a single select, not multi-select, because the requested behavior maps cleanly to one audience bucket plus `general_public`.
- This phase should not attempt to introduce staff override logic. Keep authoring simple and aligned with the enforcement model.

#### Phase 3 Implementation Status On March 16, 2026

- Added `traineeAudience` to the `CourseCreateEditDialog` form state with `general_public` as the default for new courses.
- Added a staff-facing `Audience` select with the required three options: `All / General Public`, `PESO Clients`, and `PESO Employees`.
- Updated the edit flow to preload the current course audience so existing courses keep their targeting when staff open the dialog.
- Updated preview and save flows so the selected audience is included in draft preview payloads and course create or update requests.
- Added staff-visible audience badges to both admin and trainer course cards so restricted targeting is visible without opening the edit dialog.

### Phase 4. Learner Visibility And Direct Access Guardrails

#### Objective

- Ensure learner-facing course surfaces only show audience-appropriate content and handle direct access safely.

#### Checklist

- [x] Update `src/pages/Courses.tsx` so learners only see allowed courses.
- [x] Add a defensive client-side audience filter based on the authenticated user's `traineeType`.
- [x] Ensure `published !== false` filtering still applies.
- [x] Update `src/pages/Dashboard.tsx` to exclude restricted courses from learner-facing course summaries and recommendations.
- [x] Review `src/services/recommendationSyncService.ts` and any learner recommendation cards that consume `getCourses()`.
- [x] Update `src/pages/CourseDetail.tsx` to treat mismatched courses as unavailable or not found.
- [x] Confirm staff users can still open any course detail page.
- [x] Confirm public or anonymous viewers only see `general_public` courses if the public catalog remains enabled.

#### Implementation Notes

- RLS should already remove most mismatched rows after Phase 1, but the frontend still needs a defensive filter to avoid stale-cache flashes or mixed-session edge cases.
- `CourseDetail` needs a deliberate unavailable-state path, otherwise a direct route could still expose metadata from cached course objects.
- Do not limit this phase to the Browse Courses page. Any learner-facing dashboard, recommendation carousel, or course preview using the shared course service must be reviewed.
- Staff flows should remain unrestricted, so role checks need to distinguish learner browsing from admin and trainer management views.

#### Phase 4 Implementation Status On March 16, 2026

- Added `src/lib/courseAudience.ts` with shared `canUserViewCourse(...)` and `filterCoursesForUser(...)` helpers so audience and published-state checks stay consistent across learner surfaces.
- Updated `src/pages/Courses.tsx` to apply the shared learner visibility filter instead of relying only on the old published-only client filter.
- Updated the trainee dashboard in `src/pages/Dashboard.tsx` so learner course summaries, active-course cards, completed-course cards, and personalized recommendations all use the filtered course list.
- Updated `src/services/recommendationSyncService.ts` so persisted learner recommendations are built only from courses the trainee is actually allowed to see.
- Updated `src/pages/CourseDetail.tsx` to redirect to the course catalog when a non-staff user reaches a mismatched or otherwise unavailable course, while preview mode and staff access stay unrestricted.

### Phase 5. Enrollment Enforcement

#### Objective

- Block mismatched enrollments server-side and surface clear failure messages in both self-enrollment and staff enrollment workflows.

#### Checklist

- [x] Update `enrollInCourse(...)` in `src/services/supabaseDatabaseService.ts` to fetch `trainee_audience` together with `published`.
- [x] Fetch the learner profile's `trainee_type` during enrollment validation.
- [x] Reject enrollment when the course audience is not `general_public` and does not match the learner's `trainee_type`.
- [x] Preserve the existing verification-status check for trainees.
- [x] Return a specific mismatch error message for client-only or employee-only courses.
- [x] Update `src/components/enrollment/BulkEnrollmentDialog.tsx` to skip or reject incompatible learners.
- [x] Update any admin enrollment result UI to report which learners were blocked by audience rules.
- [x] Confirm direct course-link enrollment attempts fail cleanly even if the course card was cached or manually opened.

#### Implementation Notes

- This phase closes the main bypass path. Even if UI filtering is correct, a learner must not be able to enroll through direct requests or stale local state.
- The current enrollment validation already checks course publication state and verification state, so audience validation fits naturally into the same pre-insert guard.
- Bulk enrollment should not silently succeed on disallowed users. Return explicit failures so staff know whether the problem is trainee type mismatch or something else.
- Unless product explicitly requests exceptions, keep audience rules consistent for both learner self-service and staff bulk enrollment.

#### Phase 5 Implementation Status On March 16, 2026

- Updated `enrollInCourse(...)` to read `trainee_audience` with the course record and `trainee_type` with the learner profile before inserting an enrollment.
- Preserved the existing trainee verification check, then added an audience mismatch guard that blocks restricted courses when the learner does not match the required `trainee_type`.
- Added explicit mismatch feedback so learners now see `This course is only available to PESO Clients.` or `This course is only available to PESO Employees.` instead of a generic access error.
- Updated `bulkEnroll(...)` to validate selected users against the target course audience before inserting enrollments and to skip incompatible users instead of silently enrolling them.
- Updated `BulkEnrollmentDialog` to show a persistent `Enrollment issues` list so admin and trainer staff can see which users were blocked by audience rules and why.

### Phase 6. Reporting, Recommendations, And Downstream Review

#### Objective

- Confirm the new audience field does not break reporting and that learner-facing downstream features stop surfacing restricted courses.

#### Checklist

- [x] Review `src/pages/admin/Reports.tsx` to confirm staff still see all courses.
- [x] Review recommendation and analytics paths that consume `courseService.getCourses()`.
- [x] Ensure learner-facing recommendation lists exclude audience-mismatched courses.
- [x] Ensure staff analytics and counts remain complete across all courses.
- [x] Confirm adding `traineeAudience` to course objects does not break existing charting or summaries.
- [x] Add a lightweight regression check or manual verification note for course visibility rules in learner recommendations.

#### Implementation Notes

- Recommendation and dashboard surfaces are the most likely place for partial regressions because they often reuse shared course list reads without explicit visibility assumptions.
- Staff reports should stay complete; learner-facing recommendation content should narrow.
- If a script-based regression check already exists for other course/reporting invariants, extend it rather than adding a one-off manual-only step.

#### Phase 6 Implementation Status On March 16, 2026

- Reviewed `src/pages/admin/Reports.tsx` and kept the course catalog load staff-complete by continuing to source report filters from the raw `courseService.getCourses()` result without learner audience filtering.
- Reviewed learner-facing recommendation consumers and confirmed the two active paths already narrow correctly: `src/pages/Dashboard.tsx` builds recommendations from the filtered `visibleCourses` state, and `src/services/recommendationSyncService.ts` persists only recommendations built from `filterCoursesForUser(...)` output.
- Extended `scripts/check-assessment-reporting-regressions.ts` so the existing repository regression guard now also verifies learner browse and recommendation surfaces keep filtering by audience while admin and trainer analytics continue using full staff-visible course catalogs.
- Updated `scripts/README.md` so the regression script documentation now covers the new audience-visibility and reporting checks added in this phase.

### Phase 7. QA And Rollout

#### Objective

- Validate the full behavior matrix and roll out without breaking existing courses.

#### Checklist

- [ ] Test a `peso_client` learner account:
  - [ ] sees `general_public` courses
  - [ ] sees `peso_client` courses
  - [ ] does not see `peso_employee` courses
- [ ] Test a `peso_employee` learner account:
  - [ ] sees `general_public` courses
  - [ ] sees `peso_employee` courses
  - [ ] does not see `peso_client` courses
- [ ] Test a learner account with null or missing `trainee_type`:
  - [ ] sees only `general_public` courses
  - [ ] cannot enroll in client-only or employee-only courses
- [ ] Test an admin account:
  - [ ] sees all courses
  - [ ] can create and edit all audience values
- [ ] Test a trainer account:
  - [ ] sees all courses permitted by current staff rules
  - [ ] can create and edit all audience values allowed by current staff rules
- [ ] Test direct URL access to a restricted course detail page.
- [ ] Test self-enrollment mismatch rejection.
- [ ] Test bulk enrollment mismatch handling.
- [ ] Test existing courses after migration to confirm they behave as `general_public`.
- [ ] Run a production-safe migration order:
  - [ ] deploy migration first
  - [ ] deploy app code second
  - [ ] validate with staff and learner smoke tests

#### Implementation Notes

- Backward compatibility matters more than elegance here. Existing courses should remain visible as `general_public` immediately after migration.
- The safest rollout order is schema first, then application code, then smoke-test accounts across both learner audience types.
- If the public catalog is important, include an unauthenticated browser-session check in QA instead of assuming RLS behavior is correct.
- Record a short post-rollout verification note so future audience-related bugs have a known-good reference.

## Suggested File Touchpoints

- `src/components/course/CourseCreateEditDialog.tsx`
- `src/pages/admin/Courses.tsx`
- `src/pages/trainer/Courses.tsx`
- `src/pages/Courses.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/CourseDetail.tsx`
- `src/services/supabaseDatabaseService.ts`
- `src/services/recommendationSyncService.ts`
- `src/types/index.ts`
- `src/types/database.ts`
- new Supabase migration under `supabase/migrations/`

## Acceptance Criteria

- Staff can set a course audience during creation and editing.
- Existing courses default safely to `All / General Public` after migration.
- Learners only see courses allowed by their `trainee_type` and the course audience.
- Learners cannot enroll in mismatched courses even through direct links or stale UI state.
- Staff reporting and management views continue to work across all courses.
- Learner recommendations and dashboards no longer surface restricted courses.