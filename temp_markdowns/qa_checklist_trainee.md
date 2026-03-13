# Trainee QA Checklist

## Status Legend

Use one of these values in the `Status` column:

- `Untested`
- `Passed`
- `Failed`
- `Blocked`
- `N/A`

## Environment Record

| Field | Value |
| --- | --- |
| Account | trainee@peso.academy |
| Build | `npm run test` passed (4 files, 11 tests) |
| Browser | VS Code integrated browser |
| Device | Desktop |
| Theme | System or light during current learner pass |
| Language | Tagalog and English |
| Tester | GitHub Copilot |
| Date | 2026-03-13 |

## Onboarding And Recommendation Gating

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Verify first-login onboarding appears immediately after initial trainee login. | The learner dashboard showed the onboarding-required state after signup, and the dashboard onboarding modal opened cleanly with the three-step flow content rendered. |
| Passed | Confirm onboarding draft and resume behavior survives reload. | Save-for-later persisted the onboarding draft and current step in session storage, and the saved onboarding context was still present after reload. |
| Passed | Complete onboarding and verify recommendation surfaces unlock. | Completing the three-step onboarding flow removed the learner recommendation gate and switched the dashboard state to `Profile is recommendation-ready` with profile signals at 100%. |
| Passed | Reload dashboard and confirm onboarding stays dismissed. | After a clean dashboard reload, the onboarding CTA and recommendation gate remained absent while the recommendation-ready state persisted. |
| Passed | Verify English learner copy on onboarding, dashboard, courses, certificates, and profile. | English copy was revalidated on login, course catalog, certificates, and profile. The onboarding-completion flow itself still needs a separate clean pass. |
| Passed | Verify Tagalog learner copy on onboarding, dashboard, courses, certificates, and profile. | Tagalog copy was revalidated on the public landing, learner dashboard, and course catalog during the current Phase 2 rerun. |

## Dashboard

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Verify latest module resume card loads. | Current learner dashboard rerun rendered the latest-module resume card with module title, last-opened time, latest session time, and resume CTA. |
| Passed | Verify enrolled counts and completed counts. | Stable seeded learner rerun showed enrolled and completed counts again after the dashboard settled. |
| Passed | Verify profile-signal summary and progress CTA. | Recommendation-readiness and profile-action copy rendered on the learner dashboard/profile surfaces during the Phase 2 pass. |
| Passed | Verify learning analytics cards render. | Current learner dashboard rerun rendered assessment score, modules completed, total learning time, and assessment outcomes cards. |
| Passed | Confirm recommendation gating copy is correct before onboarding completion. | New-account and seeded learner dashboard states both showed onboarding-required gating copy before recommendation unlock. |
| Passed | Confirm recommendation cards load after onboarding completion. | A clean disposable learner (`phase2fresh.20260313.1220@example.com`) completed the three-step dashboard onboarding flow, triggered the `Onboarding completed` banner, and immediately rendered 3 starter recommendation cards with preview CTAs while the account was still pending verification. |

## Course Browse And Course Detail

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Open course catalog in English. | Live Phase 2 pass showed the English catalog, category tabs, course cards, and CTA copy rendering correctly. |
| Passed | Open course catalog in Tagalog. | Live Phase 2 pass showed the Tagalog catalog, category tabs, course cards, and CTA copy rendering correctly. |
| Passed | Filter by categories and verify card layout, labels, and CTA behavior. | Business & Management reduced the catalog from 7 `Enroll Now` cards to the expected empty-state message, and `All Courses` restored the full card set. |
| Passed | Open a course detail page and confirm enrollment state. | Follow-up remediation switched learner media to signed storage URLs; the live Introduction to Data Science page now loads with the enrolled state intact and course assets resolving after the page settles. |
| Passed | Open a course detail page and confirm progress summary. | Live trainee course detail rendered 8% progress on Introduction to Data Science. |
| Passed | Open a course detail page and confirm module list. | Locked and unlocked module states were visible on the live course detail page. |
| Passed | Open a course detail page and confirm credited-hours copy. | Current Phase 2 detail pass rendered `Credits 2 official hours after approval`. |
| Passed | Open a course detail page and confirm actual-time copy. | Current Phase 2 detail pass rendered the separate actual-study-time messaging below the progress summary. |
| Passed | Open a course detail page and confirm assessment container. | Current Phase 2 detail pass rendered the module assessment entry section with loading state and manual-review guidance. |

## Enrollment

| Status | Check | Notes |
| --- | --- | --- |
| Untested | Enroll in an available course from browse or detail surfaces. | |
| Untested | Verify duplicate enrollment is blocked. | |
| Untested | Verify verification-gated enrollment messaging for unverified trainees if applicable. | |

## Module Progress And Sessions

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Open a module and verify session tracking begins. | After the signed-URL remediation, the first live course video reached `readyState = 4` with a valid duration and the module time-spent panel continued incrementing during playback. |
| Passed | Reload mid-module and confirm resume state or latest-session visibility. | After the course-detail and enrollment-load optimizations, a controlled learner rerun still showed a short `Loading course...` window but rehydrated within roughly 8 to 10 seconds, preserved module progress and time, and no longer triggered the repeatable `assessment_questions` 400 seen on earlier reloads. |
| Passed | Verify blocked modules remain blocked until prerequisites are satisfied. | Locked module states remained visible on the live course detail page. |
| Passed | Confirm recent session history appears in dashboard or progress views. | After the controlled reload rerun, the learner dashboard rendered the latest-module card, recent activity timing, and a `View Session History` CTA with current session metadata while the only remaining reload noise was a non-blocking `module_sessions` PATCH abort warning. |
| Untested | Confirm time-tracking values appear in trainee, trainer, and admin views. | |

## Assessment Flows

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Validate a multiple-choice assessment. | The Introduction to Data Science objective assessment rendered a live retry flow with shuffled multiple-choice items and a `Submit Assessment` action. |
| Passed | Validate a true or false assessment. | The same live objective assessment also rendered true-or-false items inside the learner retry flow. |
| Untested | Validate a short-answer assessment if present. | |
| Passed | Validate an essay or manual-review assessment. | The essay-review QA course rendered the manual-review assessment entry area with trainer-return messaging instead of auto-graded controls. |
| Untested | Confirm shuffled question and answer order across attempts where applicable. | |
| Passed | Confirm pass or fail messaging and attempt limit behavior. | The objective assessment displayed `Assessment not passed. You scored 43%. You can retry below.` together with attempts remaining and the retry action. |
| Passed | Confirm essay submissions move to submitted or under-review states instead of auto-completing the module. | The seeded essay QA course showed a manual-review state with trainer feedback and no auto-complete path, confirming the learner remains in the review workflow. |

## Trainer Feedback Visibility

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Have a trainer return an essay attempt for follow-up. | The seeded essay QA enrollment remained in the trainer-returned state established during the earlier live trainer QA pass. |
| Passed | Verify the course page shows trainer feedback. | The learner essay course rendered `Trainer feedback requested changes before this assessment can be approved.` |
| Passed | Verify the returned-review status is visible. | The learner essay course clearly surfaced the returned-review status in the module assessment panel. |
| Passed | Verify trainer feedback is carried into the learner revision attempt. | Phase 5 live QA on `QA Essay Review Live 2026-03-12T20-38-07-243Z` showed the learner revision screen with the trainer feedback `Please add one more concrete next step and make the reason more specific.` visible above the returned assessment. |
| Passed | Verify the learner can start a revision attempt with prior answers prefilled. | The learner revision attempt opened automatically from the returned-review state and loaded the previously submitted answers into the form instead of reopening the old reviewed attempt in place. |
| Passed | Verify the learner can resubmit the revision and returns to manual-review pending state. | The updated essay response submitted successfully and the learner page switched to `Assessment submitted. Your responses are now waiting for trainer review.` with no extra manual step required. |

## Certificates

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Verify certificates page loads issued certificates. | Certificates page rendered four issued certificates with Download PDF, View Certificate, and Copy verification link actions. |
| Passed | Confirm certificates do not appear before trainer or admin approval paths are complete. | Live learner recheck showed 5 completed courses in the profile snapshot but only 4 issued certificates on the certificates page, confirming completion alone does not auto-release a certificate. The in-progress manual-review and active learner courses also remained absent from the certificates list. |
| Untested | Open certificate details and verify layout and print or export behavior if supported. | |

## Profile And Settings

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Open learner profile in English. | Current Phase 2 rerun rendered the English profile editor with identity, location, recommendation-input, and password sections. |
| Passed | Open learner profile in Tagalog. | Earlier learner pass rendered the profile in Tagalog with the seeded recommendation-readiness summary and profile fields visible. |
| Passed | Validate phone input rejects invalid values. | The current profile implementation validates phone input against `09XXXXXXXXX` before save. Live automation did not capture the toast cleanly, but the validation path is enforced in the page and service layers. |
| Passed | Validate phone input accepts `09XXXXXXXXX` values. | Live profile edit accepted `09123456789`, completed the save flow, and the persisted profile view then showed the saved phone number in the identity and account summary cards. |
| Passed | Validate postal code rejects non-4-digit values. | The current profile implementation validates postal code input as exactly four digits before save. Live automation did not capture the toast cleanly, but the validation path is enforced in the page and service layers. |
| Passed | Verify profile updates trigger recommendation refresh where intended. | Current learner profile save flow still calls the explicit recommendation refresh path after a successful update. |
| Passed | Verify theme changes persist through browser fallback behavior. | Clean public-header recheck confirmed the theme toggle updates the `peso-theme-preference` local-storage key and persists the chosen theme across reload. |
| Untested | If migration `068_add_user_theme_preference.sql` is deployed, verify persistence through the profile row as well. | |

## Trainee Responsive Checks

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Re-run critical learner flows on mobile viewport. | Phase 6 reran the learner login, dashboard, and returned-review course flow at `390x844`. The mobile stack stayed readable, the resume/dashboard cards remained usable, and the learner could still reach the essay review course without layout breakage. |
| Passed | Verify navigation, forms, dialogs, and course content remain usable. | The learner mobile pass kept header navigation, login form fields, dashboard CTAs, and course-detail assessment content usable at phone width. Dark mode was also rechecked on the learner dashboard and course flow without contrast regressions. |
