# Black Box Testing Outcome Documentation

## Purpose

This document defines the outcomes that black box testing records for the PESO Academy system.

It does not log an executed test run. It establishes the exact user-visible result that qualifies as:

- `Passed`
- `Failed`
- `Blocked`
- `N/A`

The wording in this file is definitive. Each scenario states the observable result that marks the test outcome.

## Scope

This black box outcome reference covers the main user-facing flows for:

- Public users
- Authenticated trainees
- Trainers
- Admins
- Shared cross-cutting behavior

## Outcome Rules

| Outcome | Definition |
| --- | --- |
| `Passed` | The interface, route, validation, or workflow produces the exact expected user-visible result. |
| `Failed` | The interface, route, validation, or workflow produces an incorrect, incomplete, misleading, or broken result. |
| `Blocked` | The scenario cannot be completed because a required dependency, environment condition, seeded account, backend record, or permission prerequisite is unavailable. |
| `N/A` | The scenario does not apply to the current role, environment, feature flag state, or release scope. |

## Entry Conditions

These conditions define a valid black box test setup for this system:

- The application loads from a reachable deployed or local environment.
- Public routes are accessible without an authenticated session.
- Seeded trainee, trainer, and admin accounts exist for role-based flows.
- Test data exists for enrollments, courses, modules, assessments, and certificates where required.
- The active browser allows storage, cookies, and network requests.

If any required condition is missing, the affected scenario records `Blocked`.

## Public And Authentication Outcomes

| ID | Scenario | User Action | Passed Outcome | Failed Outcome | Blocked Outcome |
| --- | --- | --- | --- | --- | --- |
| PUB-01 | Landing page load | Open the root route. | The landing page renders the hero, navigation, feature sections, and footer without broken layout or missing content. | The page does not load, shows broken structure, hides critical content, or displays visible rendering defects. | The environment URL is unavailable or the app fails before the page can render. |
| PUB-02 | Navigation links | Click public header links. | Each link opens the correct destination page and the destination content renders. | One or more links route to the wrong page, fail to route, or land on a broken screen. | Navigation cannot be exercised because the page does not load. |
| PUB-03 | Theme toggle | Toggle theme on a public page. | The theme changes immediately and the selected theme remains active after reload. | The theme does not change, changes inconsistently, or resets after reload. | Browser storage is unavailable or the page cannot reload correctly. |
| PUB-04 | Language switch | Switch between English and Tagalog on a public surface. | The page updates to the selected language state and remains structurally usable. | The page shows mixed language output, broken labels, or unusable layout after the switch. | Localization controls or translation data are unavailable in the active environment. |
| AUTH-01 | Trainee registration | Submit a valid new trainee registration. | The account is created and the user is redirected into the authenticated trainee experience. | The account is not created, the form fails without valid reason, or the redirect lands on the wrong screen. | Registration is disabled, the auth backend is unreachable, or the environment disallows account creation. |
| AUTH-02 | Required-field validation | Submit registration or login with missing required fields. | The form blocks submission and displays the required validation messages on the missing fields. | The form submits incomplete data, shows no validation, or shows incorrect validation targets. | The form cannot submit because the page fails to load. |
| AUTH-03 | Invalid credential handling | Submit login with invalid credentials. | The login stays on the auth surface and displays an authentication error state. | The system logs the user in, hangs without feedback, or hides the auth error. | The auth service is unavailable. |
| AUTH-04 | Role-based login redirect | Login as trainee, trainer, and admin. | Each role lands on the correct dashboard or shell for that role. | A role lands on the wrong dashboard, hits an access error, or loops on redirect. | The account or required role mapping does not exist. |
| AUTH-05 | Session persistence | Reload after successful login. | The authenticated session remains active and the same role keeps access to protected routes. | The session is lost, the user is logged out unexpectedly, or protected routes break after reload. | Session storage or auth state cannot initialize. |
| AUTH-06 | Logout behavior | Logout from an authenticated session. | The user leaves the protected shell and protected routes no longer render without re-authentication. | The user remains authenticated, protected pages stay accessible, or logout returns to a broken state. | The authenticated shell fails before the logout action can complete. |

## Trainee Outcomes

| ID | Scenario | User Action | Passed Outcome | Failed Outcome | Blocked Outcome |
| --- | --- | --- | --- | --- | --- |
| TRN-01 | Dashboard load | Open the trainee dashboard after login. | The trainee dashboard loads with learner navigation, summary content, and actionable cards. | The dashboard stays blank, stalls indefinitely, or shows the wrong role surface. | The trainee account cannot authenticate or required dashboard data is unavailable. |
| TRN-02 | Onboarding completion | Complete onboarding as a new trainee. | The onboarding flow saves, closes, and the completed state remains after reload. | The onboarding flow does not save, reopens incorrectly, or leaves the learner in an inconsistent state. | The trainee account does not enter onboarding state or the backing data path is unavailable. |
| TRN-03 | Course catalog access | Open the course catalog as a trainee. | The course list renders and available courses are visible with usable filtering or browsing controls if present. | The course list is empty without valid reason, broken, or inaccessible to the trainee role. | Catalog data does not load or the account lacks required course-read access in the environment. |
| TRN-04 | Course detail load | Open a course detail page from the catalog. | The course page renders title, description, modules, and enrolled-state actions relevant to the learner. | The course detail page breaks, loads incomplete content, or hides core course information. | The course record is unavailable or enrollment prerequisites prevent access to the page. |
| TRN-05 | Enrollment action | Enroll in an available course. | The enrollment action succeeds and the course reflects the enrolled state in the learner flow. | Enrollment fails, duplicates incorrectly, or the interface does not reflect the new enrollment state. | Enrollment is disabled or the course cannot accept new learners in the current data state. |
| TRN-06 | Module progression | Open modules in order for an enrolled course. | Available modules open and locked modules remain visibly unavailable until prerequisites are satisfied. | Locked modules open incorrectly, available modules stay inaccessible, or progression state is inconsistent. | The enrollment or module data is incomplete in the environment. |
| TRN-07 | Media playback | Open module video or document content. | The learner can view or play the assigned learning material from the course page. | Media fails to load, opens the wrong asset, or returns an unusable viewer state. | The storage asset is missing or access to the file backend is unavailable. |
| TRN-08 | Objective assessment submission | Submit a quiz or auto-graded assessment with valid answers. | The submission completes, the learner receives the attempt result, and the course reflects the updated assessment state. | The submission is lost, the score is incorrect at the UI level, or the learner remains stuck in the attempt flow. | The assessment cannot open because data, attempt creation, or backend grading is unavailable. |
| TRN-09 | Manual-review assessment submission | Submit an essay or manual-review assessment. | The submission enters review state and the learner sees confirmation that the responses are waiting for review. | The submission disappears, returns the wrong status, or the learner receives no reliable confirmation. | The course lacks the required seeded assessment or the review pipeline is unavailable. |
| TRN-10 | Returned review revision flow | Open a trainer-returned manual-review assessment and resubmit revised answers. | The learner sees trainer feedback, previous answers are available for revision, and the revised submission re-enters review. | Feedback is missing, the wrong attempt reopens, prior answers are lost, or resubmission fails. | No returned-review attempt exists for the learner in the active data set. |
| TRN-11 | Certificate visibility | Open certificates after completing an eligible course. | The learner can access the certificate state that matches the completed enrollment outcome. | The certificate is missing, visible too early, or unavailable after valid completion. | No completion-approved enrollment exists for the learner. |
| TRN-12 | Profile update | Save edits in the trainee profile or settings area. | The updated profile data persists and remains visible after reload. | Edits are discarded, partially saved, or reflected inconsistently across the UI. | The profile data source is unavailable or the user cannot open the settings surface. |

## Trainer Outcomes

| ID | Scenario | User Action | Passed Outcome | Failed Outcome | Blocked Outcome |
| --- | --- | --- | --- | --- | --- |
| TNR-01 | Trainer dashboard load | Login as trainer and open the trainer dashboard. | The trainer dashboard renders trainer navigation, assigned operational views, and page content without access errors. | The trainer lands on the wrong shell, sees unauthorized content, or the page does not load correctly. | The trainer account or role permission mapping is unavailable. |
| TNR-02 | Trainer learner list | Open the trainer learner management or review list. | The learner list renders with usable records and the trainer can open relevant learner detail paths. | The list is empty without valid cause, does not load, or opens broken details. | Required learner or enrollment data is not present in the test environment. |
| TNR-03 | Course authoring access | Open trainer course creation or editing surfaces. | The trainer can access course management screens assigned to the trainer role. | The route denies valid trainer access, loads the wrong content, or breaks during render. | Trainer content authoring is disabled or missing in the environment. |
| TNR-04 | Assessment authoring | Create or edit an assessment with supported question types. | The authoring surface accepts the configured question types and preserves the authored structure after save. | Question types are missing, the save loses content, or the assessment renders incorrectly after save. | The trainer lacks a course they can edit or the course-authoring backend is unavailable. |
| TNR-05 | Manual review queue access | Open submitted learner work that requires review. | The trainer can view the learner submission, answers, and review controls. | Submitted work is invisible, incomplete, or the trainer cannot access the review actions. | No submitted manual-review attempt exists in the test data. |
| TNR-06 | Approve learner submission | Approve a learner manual-review attempt. | The attempt status updates to the approved outcome and the learner progression path reflects the review result. | The status does not change, changes to the wrong value, or the learner state does not update. | The trainer lacks a reviewable attempt or the review write path is unavailable. |
| TNR-07 | Return learner submission for revision | Mark a manual-review attempt for revision and provide feedback. | The attempt records the returned state and the learner receives revision feedback in the learner flow. | The review state is lost, the wrong learner attempt changes, or the feedback is not visible to the learner. | The trainer does not have a reviewable returned-work scenario in the dataset. |
| TNR-08 | Completion recommendation or approval handoff | Complete the trainer-side action that advances a learner toward completion approval. | The learner enrollment advances to the next visible approval state expected from trainer action. | The enrollment state does not advance, advances incorrectly, or becomes internally inconsistent at the UI level. | The target enrollment has not met the completion prerequisites. |

## Admin Outcomes

| ID | Scenario | User Action | Passed Outcome | Failed Outcome | Blocked Outcome |
| --- | --- | --- | --- | --- | --- |
| ADM-01 | Admin dashboard load | Login as admin and open the admin dashboard. | The admin dashboard renders admin navigation, summary content, and management entry points. | The page fails to load, renders a different role shell, or exposes broken admin widgets. | The admin account or admin role mapping is unavailable. |
| ADM-02 | User management access | Open admin user management or role-management surfaces. | The admin can view the user-management interface and open user detail actions supported by the system. | The admin route fails, displays incomplete records, or denies valid access. | The user-management data source is unavailable. |
| ADM-03 | Enrollment monitoring | Open admin enrollment lists or details. | The admin can view enrollment states, progress details, and workflow actions exposed to admin users. | Enrollment data is missing, progress detail fails, or action controls do not match the enrollment state. | Enrollment data or progress records are unavailable in the environment. |
| ADM-04 | Admin approval flow | Approve an enrollment that is waiting for admin approval. | The enrollment moves to the approved completion state and the next release action becomes visible when applicable. | The status does not change, changes incorrectly, or the interface remains stale after approval. | No enrollment exists in the correct waiting-for-approval state. |
| ADM-05 | Certificate release flow | Release a certificate for an approval-complete enrollment. | The certificate release action completes and the enrollment reflects the released certificate state. | The release action fails, appears too early, or does not update the enrollment state. | No eligible approval-complete enrollment exists. |
| ADM-06 | Admin reporting access | Open dashboard analytics or report pages. | The analytics and reporting surfaces load usable data and the admin can navigate the reporting workflow. | Reports fail to load, show broken widgets, or return unusable reporting screens. | The reporting backend or report data is unavailable in the environment. |
| ADM-07 | Permission-restricted routes | Open role-sensitive admin routes directly. | The admin retains access to admin routes and non-admin users remain excluded from the same routes. | Admin routes reject valid admin access or allow unauthorized users into the admin surface. | The environment lacks the required role or route configuration. |

## Shared Cross-Cutting Outcomes

| ID | Scenario | User Action | Passed Outcome | Failed Outcome | Blocked Outcome |
| --- | --- | --- | --- | --- | --- |
| SHR-01 | Responsive layout | Open core routes on mobile, tablet, and desktop widths. | Navigation, forms, cards, dialogs, and data views remain readable and actionable at the supported viewport sizes. | The layout clips, overlaps, hides actions, or becomes unusable at a supported width. | Device emulation or browser resizing is not available. |
| SHR-02 | Visual consistency | Navigate key public and authenticated pages. | Typography, spacing, backgrounds, buttons, cards, and dialogs render consistently with no missing or broken visual states. | The UI displays missing styles, unreadable contrast, or visibly inconsistent component states. | CSS or asset delivery fails before the page can render correctly. |
| SHR-03 | Route protection | Open protected routes while signed out and while signed in under the wrong role. | Protected routes deny invalid access and authenticated routes open only for the permitted role. | Unauthorized users can access protected content or valid users are rejected from their permitted routes. | The auth layer cannot initialize and route state cannot be evaluated. |
| SHR-04 | Error handling | Trigger a known invalid action such as bad credentials or incomplete form submission. | The system returns a visible, relevant error state without crashing the page. | The page crashes, suppresses the error, or displays misleading feedback. | The invalid action cannot be submitted because the page is already broken. |
| SHR-05 | Data persistence after reload | Complete a state-changing action and reload. | The saved state remains reflected after reload in the relevant user flow. | The saved state disappears, duplicates, or reloads incorrectly. | The backend record cannot be written or re-read. |
| SHR-06 | Localization stability | Change language on supported surfaces and continue navigation. | The selected language state remains active and the navigated surfaces remain structurally stable. | The language resets unexpectedly, key text disappears, or layout breaks after navigation. | Language assets are missing from the environment. |
| SHR-07 | Recommendation surfaces | Complete the prerequisites that make recommendations available and open the dashboard. | Recommendation cards or recommendation-driven sections load in the learner flow when the learner qualifies for them. | Recommendations do not appear when qualified, appear with broken state, or display misleading unsupported data. | The recommendation backend, prerequisite learner state, or seeded data is unavailable. |
| SHR-08 | Schema-tolerant reads | Open complex pages that depend on notifications, course data, enrollment progress, or reporting. | The user-facing page completes its load path without surfacing schema-read failures in the UI flow. | The user hits a visible load failure, broken partial render, or unusable route because data reads fail. | The backing environment is missing required data or the target service is unavailable. |

## Final Classification Rules

Record each executed black box scenario using the rules below:

1. Mark `Passed` only when the full visible result matches the passed outcome defined in this document.
2. Mark `Failed` when any essential part of the visible result deviates from the defined passed outcome.
3. Mark `Blocked` when the tester cannot reach a valid execution state because a dependency or prerequisite is missing.
4. Mark `N/A` only when the scenario is outside the role scope, release scope, or environment scope.

## Decision Standard

This document makes the black box outcome standard explicit:

- A route either renders its required user-facing content or it fails.
- A workflow either reaches its defined completion state or it fails.
- A protected surface either enforces the correct access boundary or it fails.
- A persistence action either survives reload in the correct state or it fails.
- A dependency gap or missing prerequisite records `Blocked`, not `Failed`.

That standard removes ambiguity from black box reporting and keeps the result set consistent across public, trainee, trainer, admin, and shared QA execution.