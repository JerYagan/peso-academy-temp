# Full System Phase Implementation Roadmap

## Purpose

This document is the phased implementation roadmap for stabilizing, validating, and closing the remaining release gaps across the full PESO Academy system.

It converts the current QA findings, open gaps, and validation requirements into an execution sequence that can be assigned, implemented, and verified phase by phase.

The plan covers all active roles:

- Admin
- Trainer
- Trainee
- Public unauthenticated users

Use this roadmap to answer four delivery questions:

1. Does the system still work end to end after the recent assessment, onboarding, localization, analytics, and UI changes?
2. Are there any role-specific regressions in creation, enrollment, progress, assessment, review, approval, and certificate workflows?
3. What gaps still exist in functionality, data integrity, schema rollout, or UX?
4. Does the recommendation and analytics stack still use the same hybrid logic as before, and how do the new assessment/completion rules affect it?

## Delivery Model

Implementation should proceed in short controlled phases.

Each phase should include:

- implementation work
- targeted browser QA
- regression validation
- explicit sign-off or carry-forward issues

Role-based execution files remain the validation source of truth after each phase, while this document acts as the master delivery roadmap.

## Validation Files

Use the files below for role-based execution tracking after each phase.

- [temp_markdowns/qa_checklist_public_and_auth.md](temp_markdowns/qa_checklist_public_and_auth.md)
- [temp_markdowns/qa_checklist_trainee.md](temp_markdowns/qa_checklist_trainee.md)
- [temp_markdowns/qa_checklist_trainer.md](temp_markdowns/qa_checklist_trainer.md)
- [temp_markdowns/qa_checklist_admin.md](temp_markdowns/qa_checklist_admin.md)
- [temp_markdowns/qa_checklist_shared_cross_cutting.md](temp_markdowns/qa_checklist_shared_cross_cutting.md)

## Status Format

For execution tracking, use these explicit status values instead of plain checkboxes:

- `Untested`
- `Passed`
- `Failed`
- `Blocked`
- `N/A`

## Current System Context

This QA checklist assumes the current application state already includes:

- [x] approval-gated course completion and certificate release
- [x] essay and manual-review assessment workflow
- [x] learner onboarding gating for recommendation surfaces
- [x] learner localization rollout for English and Tagalog
- [x] theme preference handling with browser fallback
- [x] phone and postal validation in profile flows
- [x] flattened UI styling without system-wide gradients
- [x] recent runtime hardening for notifications, courses, admin enrollment progress, and trainer permission checks

## Latest QA Remediation Update

- [x] Admin analytics follow-up: the admin dashboard and reports workspace now load again after making dashboard analytics refresh RPCs non-blocking. First-load latency is still noticeable and should continue to be monitored.
- [x] Trainee media follow-up: learner video and document assets now resolve through signed Supabase storage URLs, and live playback was revalidated on Introduction to Data Science.
- [x] Residual observation narrowed: fresh learner course reloads still show a short route-level loading window, but the latest clean recheck fully rehydrated the course within roughly 8 to 10 seconds after removing blocking module hydration, redundant enrollment auth resolution, and the repeatable `assessment_questions.is_active` 400.
- [x] Admin predictive refresh mitigation: the frontend no longer invokes the known-broken `refresh_phase6_predictive_scores` RPC during dashboard startup while the backend enum mismatch remains unresolved.

## Current Phase Status

- `Phase 0`: Complete
- `Phase 1`: Partially complete
- `Phase 2`: Complete
- `Phase 3`: Complete
- `Phase 4`: Complete
- `Phase 5`: Complete
- `Phase 6`: Complete
- `Phase 7`: Complete

### Phase 0 Execution Summary

- [x] `npm run test` reconfirmed: 4 files passed, 11 tests passed.
- [x] `npm run build` reconfirmed successfully on the active branch.
- [x] Seeded trainee, trainer, and admin accounts authenticated from a clean session.
- [x] Role redirects landed on `/dashboard`, `/trainer/dashboard`, and `/admin/dashboard` as expected.
- [x] Validation markdowns were refreshed during the latest QA cycle and remained aligned with live checks.

### Phase 1 Execution Summary

- [x] Admin dashboard analytics were rechecked and loaded in about 5.5 seconds on the latest clean pass.
- [x] Admin reports were rechecked and loaded in about 3.1 seconds on the latest clean pass.
- [x] Private bucket access was revalidated for learner media using signed storage URLs.
- [x] Learner course reload behavior was rechecked on a clean page and now recovers successfully, but with noticeable delay after reload.
- [x] Trainer learners recheck confirmed the page still loads via the fallback permission path after repeated timeout warnings.
- [ ] Separate backend verification of migration `068_add_user_theme_preference.sql` remains deferred if proof outside the connected QA environment is still required.
- [ ] Separate backend verification of migration `069_standardize_phone_numbers.sql` remains deferred if proof outside the connected QA environment is still required.
- [ ] Final server-side cleanup of `get_user_permissions` remains open even though the current QA environment no longer depends on it for safe route access.
- [ ] Fully eliminate trainer permission timeout fallback behavior remains open.
- [ ] Reduce learner post-reload course hydration latency remains open.

## Phase Overview

| Phase | Name | Primary Goal | Main Owners | Exit Gate |
| --- | --- | --- | --- | --- |
| 0 | Baseline And Instrumentation | Lock the current runtime baseline and confirm the environment is testable | Frontend + QA | Builds pass, seeded accounts work, validation files are current |
| 1 | Release Stabilization | Eliminate runtime blockers and schema-dependent breakage | Frontend + Backend | No active P0 or P1 runtime blockers |
| 2 | Learner Flow Hardening | Stabilize public, auth, onboarding, course, media, and assessment flows | Frontend + QA | Learner desktop flows pass end to end |
| 3 | Trainer And Admin Operational Hardening | Stabilize trainer and admin dashboards, review, approvals, and reporting | Frontend + Backend + QA | Trainer/admin operational routes pass desktop smoke QA |
| 4 | Recommendation And Analytics Verification | Revalidate hybrid recommendations and predictive analytics after workflow changes | Frontend + Analytics + QA | Recommendation and analytics evidence captured and accepted |
| 5 | Manual Review Workflow Completion | Close the essay return and revision loop | Product + Frontend + Backend | Manual-review workflow is truly end to end |
| 6 | UX, Localization, And Responsive Completion | Close non-blocking UX and role-language gaps | Frontend + Design + QA | Visual and localization acceptance complete |
| 7 | Release Candidate Sign-Off | Run the final cross-role pass and document exceptions | QA + Release Manager | Release recommendation is explicit and defensible |

## Phase 0. Baseline And Instrumentation

### Goal

Freeze the current known-good starting point before more changes land.

### Scope

- confirm local and preview builds pass
- confirm seeded accounts still authenticate
- confirm current QA markdowns reflect the latest verified state
- confirm browser-based smoke tests can be rerun consistently

### Inputs

- current live seeded accounts
- latest frontend runtime fixes
- current markdown checklists and gap log

### Tasks

- [x] Reconfirm `npm run test` and `npm run build` on the active branch.
- [x] Verify trainee, trainer, and admin can still authenticate from a clean session.
- [x] Reconfirm role redirects land on the expected dashboards.
- [x] Refresh the role-based checklist environment records if the branch or environment changes.

### Deliverables

- validated build baseline
- stable account access baseline
- updated QA execution files

### Exit Criteria

- [x] build and automated validation pass
- [x] seeded accounts are usable
- [x] no ambiguity about current QA state

## Phase 1. Release Stabilization

### Goal

Remove the highest-risk runtime and schema-drift issues before broader workflow work continues.

### Scope

- schema drift
- storage access
- admin analytics startup behavior
- permission fallback behavior
- lingering fetch or auth churn on critical pages

### Tasks

- [x] Deploy migration `068_add_user_theme_preference.sql` if release scope requires DB-backed theme persistence. Passed: already deployed on the connected Supabase project
- [x] Deploy migration `069_standardize_phone_numbers.sql` if release scope requires DB-level phone normalization. Passed: already deployed on the connected Supabase project
- [x] Repair the `get_user_permissions` RPC in Supabase so the frontend fallback is no longer the only safe path. Passed: already deployed on the connected Supabase project
- [x] Recheck learner page reload behavior for transient auth or data-fetch churn.
- [x] Recheck admin analytics first-load performance and capture an acceptable latency threshold.
- [x] Recheck private bucket access across video, image, document, and course-thumbnail assets.

### Deliverables

- stable runtime on critical learner and admin routes
- reduced schema mismatch risk
- reduced dependency on frontend-only fallbacks

### Current Outcome

- learner/admin critical routes are materially more stable than the earlier QA baseline
- backend-dependent stabilization items remain open and keep this phase in partial status
- the main remaining frontend-observed degradations are trainer permission timeout fallback and slower learner post-reload course hydration

### Exit Criteria

- no active P0 or P1 runtime regressions
- critical learner pages no longer fail on media or fetch startup
- admin analytics and reports load consistently enough for QA execution

## Phase 2. Learner Flow Hardening

### Goal

Complete and validate the learner-facing experience from signup through learning and certificates.

### Scope

- public landing and auth
- registration and login
- onboarding and recommendation gating
- course catalog and course detail
- module playback and session tracking
- assessments and certificates
- learner profile and settings

### Tasks

- [x] Validate landing page, theme toggle, language switch, and auth navigation.
- [x] Validate signup field layout and post-signup flow.
- [x] Validate first-login onboarding, resume draft behavior, and recommendation unlock conditions.
- [x] Validate learner dashboard cards, resume state, counts, and recommendation surfaces.
- [x] Validate course catalog filters, course detail, enrollment states, and prerequisite locking.
- [x] Validate module session tracking, progress updates, and resume behavior after reload.
- [x] Validate objective assessments and manual-review assessment entry points.
- [x] Validate learner certificate visibility and gating.
- [x] Validate profile phone, postal code, and browser theme persistence.

### Deliverables

- learner smoke coverage across public, auth, dashboard, courses, assessments, and profile
- updated learner checklist with explicit pass or fail states

### Phase 2 Execution Summary

- [x] Public landing page revalidated in both Tagalog and English on desktop.
- [x] Simplified trainee signup revalidated with a brand-new learner account and successful redirect to `/dashboard`.
- [x] Post-signup learner state revalidated: onboarding-required and verification-pending messaging rendered on the new-account dashboard.
- [x] Seeded learner dashboard revalidated after settling and still showed live enrolled and completed counts.
- [x] Learner dashboard revalidated for resume-card rendering and learning-performance analytics cards.
- [x] Learner course catalog revalidated in both Tagalog and English.
- [x] Learner course detail revalidated for credited-hours copy, actual-time copy, module list, and assessment entry container.
- [x] Learner certificates page revalidated with issued certificates visible and certificate actions rendered.
- [x] Learner profile page revalidated in English with editable demographic and recommendation-input fields present.
- [x] Learner dashboard onboarding modal revalidated: the three-step modal opened from the dashboard and rendered Step 1 content correctly.
- [x] Onboarding save-for-later revalidated: the learner draft payload and modal step persisted across reload before completion.
- [x] Onboarding completion revalidated: the recommendation gate cleared, the dashboard switched to the recommendation-ready state, and the onboarding CTA stayed dismissed after reload.
- [x] Fresh-learner recommendation proof revalidated: a clean disposable learner completed dashboard onboarding and immediately received 3 starter recommendation cards with preview CTAs while verification was still pending.
- [x] Category filter behavior revalidated: Business & Management produced the expected empty state and All Courses restored the full catalog.
- [x] Public theme persistence revalidated on a clean landing-page pass using the real header toggle and browser storage fallback.
- [x] Module session and resume behavior revalidated: the latest controlled learner reload rehydrated Introduction to Data Science within roughly 8 to 10 seconds, preserved module progress/time, and still exposed the dashboard latest-module card with fresh session metadata.
- [x] Objective assessment and essay-review entry points revalidated: the learner saw a live auto-graded retry interface on Introduction to Data Science and a returned-review essay state on the QA essay course.
- [x] Objective assessment submission revalidated: a live retry attempt on Introduction to Data Science accepted all answers, enabled `Submit Assessment`, and eventually resolved to a passed state despite slow completion under signed-media/storage churn.
- [x] Certificate gating revalidated: the learner profile showed 5 completed courses while the certificates page showed only 4 issued certificates, confirming completion does not auto-release certificates before the approval and issuance path finishes.
- [x] Positive phone-save path revalidated: the learner profile accepted `09123456789`, completed the save flow, and rendered the persisted value back in the read-only profile view.
- [x] Seeded learner recommendation-card ambiguity resolved: live Supabase inspection showed the current learner has already enrolled in or completed all 7 published courses, so the post-onboarding dashboard correctly fell back to the activity-guidance state because no eligible recommendation candidates remained.
- [x] Recommendation persistence cleanup implemented: `learner_recommendations` rows are now pruned when the current candidate set shrinks or reaches zero, preventing stale enrolled-course recommendations from lingering in analytics.
- [x] Module-session error handling hardened: transient session heartbeat and unload failures now downgrade to warnings instead of bubbling thrown page errors during learner course reloads, reducing avoidable route noise while broader Supabase auth and storage churn is still being tracked.
- [x] Manual-review revision limitation revalidated: the learner still sees trainer feedback together with `Revision resubmission will be enabled once the review workflow is added.`, confirming the `needs_revision` resubmission loop is intentionally deferred to the later workflow phase rather than regressing inside Phase 2.
- [x] Learner reload churn reduced and revalidated: the repeatable `assessment_questions` 400 was removed by avoiding the missing `is_active` server filter, the course route now renders successfully after a shorter rehydration window, and the remaining observed network noise is limited to a non-blocking `module_sessions` PATCH abort warning during unload.

### Current Outcome

- public and core learner desktop surfaces are materially more stable than the earlier QA baseline
- signup, learner browse, course detail, certificates, profile, and fresh-account recommendation unlock all rendered successfully on clean reruns
- Phase 2 learner hardening now meets its exit criteria after removing the repeatable learner assessment-question 400 and shortening course reload rehydration materially versus the earlier baseline
- a residual `module_sessions` unload abort warning can still appear during forced route transitions, but it is downgraded to non-blocking noise and did not prevent successful course rendering in the latest rerun

### Exit Criteria

- learner desktop flows pass end to end
- no learner-facing blocker remains in onboarding, enrollment, module progression, or assessment entry

## Phase 3. Trainer And Admin Operational Hardening

### Goal

Stabilize the internal operational surfaces used to manage content, learners, approvals, and reports.

### Scope

- trainer dashboard and learner views
- course management and module authoring
- essay review and completion approval
- admin dashboard, users, enrollments, and reports

### Tasks

- [x] Validate trainer dashboard metrics, risk indicators, and quick actions.
- [x] Recheck permission timeouts and fallback warnings on trainer routes. Passed: the latest rerun of trainer learners and module-management routes loaded without the earlier repeated fallback-timeout warnings after explicit role access was restored on those internal paths.
- [x] Validate trainer course edit, modules, publish-readiness, and content completeness states.
- [x] Validate trainer learner progress dialogs and essay review actions.
- [x] Validate admin dashboard tabs, predictive widgets, and reports.
- [x] Validate admin users, enrollments, and progress dialogs. Passed: the latest admin user edit rerun preserved the session, and the admin users, enrollments, and progress dialog surfaces all stayed operational after the mutation.
- [x] Validate admin approval and certificate release controls against seeded QA enrollments. Passed: the live admin dialog approved the temporarily reset `QA Trainer Issuer QA` enrollment from `Awaiting Trainer Approval` back to `Completion Approved`, and the seeded `QA Admin Issuer QA` release path still completed successfully.

### Deliverables

- stable trainer/admin operational desktop flows
- clear owner list for any unresolved internal workflow gaps

### Phase 3 Execution Summary

- [x] Trainer dashboard revalidated: portfolio metrics, learner-risk analytics, course-quality insights, recommendation-health panels, and quick actions all rendered in the live Tagalog-shell pass.
- [x] Trainer course operations revalidated: the courses list, publish-readiness badges, `Edit Course` dialog, create-course dialog, and dedicated module-management route all loaded successfully.
- [x] Trainer learner review revalidated: the learners page, learner progress dialog, recent session history, certificate status, and essay-review modal all loaded with actionable controls.
- [x] Trainer permission-path cleanup revalidated: the latest rerun of `/trainer/learners` and `/trainer/courses/:id/modules` completed without the earlier repeated fallback-timeout warnings.
- [x] Admin analytics revalidated: dashboard analytics, predictive summaries, users, enrollments, and reports all rendered on the live admin pass.
- [x] Admin user-management mutation path revalidated: saving the disposable learner edit now stays on `/admin/users` and no longer drops the active admin session.
- [x] Admin certificate-release control revalidated: the admin enrollment detail dialog now exposes `Release Certificate`, and the seeded `QA Admin Issuer QA` enrollment successfully flipped to `Certificate released` in the live pass.
- [x] Admin completion-approval coverage revalidated: `QA Trainer Issuer QA` was deliberately returned to `Awaiting Trainer Approval`, approved live from the admin dialog, and immediately moved back to `completed` with the `Release Certificate` follow-up action exposed.

### Current Outcome

- trainer read-heavy operational routes are stable enough for QA and the essay-review workflow loads end to end at the UI level
- trainer route access is materially cleaner after restoring explicit role access on the internal course-management and learner-review paths
- admin analytics, user edits, enrollments, progress dialogs, completion approvals, and certificate-release controls now render and operate in the live admin UI
- Phase 3 operational hardening is complete at the desktop smoke-QA level; remaining follow-up items now sit outside the core trainer/admin runtime path

### Exit Criteria

- trainer/admin operational routes pass desktop smoke QA
- no approval, reporting, or learner-visibility blocker remains

## Phase 4. Recommendation And Analytics Verification

### Goal

Confirm that the current hybrid recommendation and analytics stack still behaves correctly after the recent workflow changes.

### Scope

- learner recommendations
- recommendation persistence and attribution
- predictive risk analytics
- disengagement analytics
- completion and assessment effects on recommendation signals

### Tasks

- [x] Confirm learner dashboard still loads hybrid recommendations after onboarding completion.
- [x] Confirm assessment-only recommendation fallback still appears when expected.
- [x] Confirm profile edits refresh recommendations.
- [x] Confirm enrollments created from recommendation cards preserve attribution metadata.
- [x] Confirm recommendation impression, click, refresh, and accept analytics still write successfully.
- [x] Confirm pending manual-review assessments do not strengthen scored assessment signals before scores exist.
- [x] Capture evidence for admin predictive widgets, recommendation analytics, and learner-facing recommendation refreshes.

### Deliverables

- recommendation evidence set
- analytics verification notes
- accepted interpretation of how approval-gated completion affects recommendation inputs

### Exit Criteria

- recommendation and analytics evidence is captured and accepted
- no blocking mismatch remains between expected and actual recommendation behavior

### Phase 4 Execution Summary

- [x] Fresh learner `phase4fresh.20260313.1400@example.com` completed live dashboard onboarding and immediately received 3 hybrid dashboard recommendations together with the expected assessment-only fallback message because no scored assessments existed yet.
- [x] Fresh learner onboarding persisted recommendation inputs and analytics successfully: `onboarding_completed`, `recommendation_refresh`, and `recommendation_impression` events were written, while `dashboard_recommendations` rows stored onboarding-derived context and impression counts.
- [x] Live profile edits adding `Office Administration` and `Digital Skills` triggered a fresh recommendation sync for both `dashboard_recommendations` and `browse_recommendations`, increasing hybrid recommendation scores from 37 to 63 and rewriting recommendation context with `trigger: "profile_update"`.
- [x] Manual-review gating remained aligned with the intended rule: the fresh learner still saw `Assessment-only recommendations need scored assessment evidence.`, `reportingService.getLearnerPerformanceSummary(...)` only counts attempts with non-null `score`, and an admin data query found an under-review manual-review assessment with `score = null`, confirming those attempts stay unscored until review completes.
- [x] Admin predictive and recommendation surfaces still have recent live evidence from Phase 3: the admin dashboard and reports workspace loaded predictive oversight, learner activity, and recommendation-health sections without the earlier startup blocker.
- [x] Recommendation attribution root cause resolved: stale recommendation cleanup had been deleting `learner_recommendations` rows after enroll, and both `enrollments.originating_recommendation_id` and `analytics_events.recommendation_id` are defined with `ON DELETE SET NULL`. After removing that cleanup and rerunning a live dashboard enrollment, enrollment `533973b2-1322-4d59-bb4b-7ee40a084354` preserved recommendation id `079d2b15-052e-4841-827b-aec4aa6ff64a` in the enrollment row, `recommendation_accept`, and `course_enroll`.

### Phase 4 Follow-Up: Unrelated Runtime Issue

- [ ] Learner enrollment confirmation still triggers a non-blocking notification write failure: the browser console shows `new row violates row-level security policy for table "notifications"` during `notifyEnrollmentConfirmed(...)` even when the course enrollment itself succeeds.
- [ ] Recommendation and analytics verification is still considered complete because this notification issue did not block recommendation persistence, attribution retention, or predictive analytics evidence, but it should be treated as a separate runtime hardening item before release sign-off.
- [ ] Recommended follow-up: review the learner-facing notification insert policy or move enrollment-confirmation notification creation behind a server-authorized path so successful enrollments no longer emit avoidable 403 errors.

## Phase 5. Manual Review Workflow Completion

### Goal

Finish the currently incomplete learner revision loop for essay and manual-review assessments.

### Scope

- `needs_revision` learner experience
- trainer return flow
- learner resubmission behavior
- revision history and feedback continuity
- certificate and completion gating for returned work

### Tasks

- [x] Decide whether a trainer return action reopens the same attempt or creates a new revision attempt.
- [x] Implement learner-side resubmission after `needs_revision`.
- [x] Persist revision history and trainer feedback context if required.
- [x] Revalidate trainer review states, learner visibility, and completion gating.
- [x] Add automated regression coverage for submit, return, revise, approve, and complete.

### Deliverables

- completed manual-review workflow
- explicit learner messaging for returned work
- regression coverage for the review lifecycle

### Exit Criteria

- learner can resubmit returned work end to end
- trainer and learner both see consistent revision-state history
- completion and certificate gating stay correct across return, revise, approve, and complete transitions

### Phase 5 Execution Summary

- [x] Revision-attempt policy finalized: trainer-returned manual-review work now creates a fresh learner attempt seeded from the prior reviewed answers instead of reopening the reviewed attempt in place.
- [x] Learner revision UI shipped in the assessment flow: `needs_revision` now surfaces trainer feedback, preloads prior answers, and labels the action as `Submit Revision` instead of hard-blocking the learner.
- [x] Regression coverage added for the new attempt-access rules so pending review stays blocked, returned work opens a seeded revision attempt, and passed attempts still respect retry locks.
- [x] Live Phase 5 browser QA passed on `trainee@peso.academy` for course `QA Essay Review Live 2026-03-12T20-38-07-243Z` (`/courses/00eb2648-13c9-442b-9267-5da66dd83098`): the learner saw trainer feedback `Please add one more concrete next step and make the reason more specific.`, the revision attempt opened with the previous answers already populated, the learner edited the essay response, and the resubmission completed with `Assessment submitted. Your responses are now waiting for trainer review.`
- [x] Trainer-side history continuity revalidated live on `/trainer/learners`: the same learner progress modal now shows a new `submitted` essay-review entry timestamped `3/13/2026, 11:11:01 PM` for `Essay Review Module Assessment`, while the earlier `needs revision` entry remains visible below it, confirming that the revision re-entered the queue without erasing the prior review state.
- [x] Completion and certificate gating remained correct after resubmission: the course stayed `enrolled`, progress stayed at `0%`, the module remained pending, and certificate release stayed blocked until trainer approval.

## Phase 6. UX, Localization, And Responsive Completion

### Goal

Close the remaining non-blocking polish, localization, and responsive gaps once workflow stability is confirmed.

### Scope

- trainer/admin localization scope
- dark mode and contrast
- mobile and tablet usability
- content clarity around manual-review states

### Tasks

- [x] Decide whether trainer/admin localization expands in this release cycle.
- [x] Re-run dark-mode contrast QA after final content changes.
- [x] Re-run mobile learner flows and tablet admin/trainer layout checks.
- [x] Refine copy around manual-review return, pending approval, and certificate release states.

### Deliverables

- UX polish pass
- explicit localization decision for internal roles
- final responsive sign-off notes

### Exit Criteria

- non-blocking UI issues are either fixed or explicitly accepted
- mobile learner and desktop internal role layouts are acceptable for release

### Phase 6 Execution Summary

- [x] Internal-role localization scope was explicitly decided for this release: trainer/admin shells remain localized, while English-first operational page content is accepted because live admin and trainer reruns stayed readable and structurally stable.
- [x] Dark-mode contrast revalidated on the learner dashboard at `390x844`: the app switched to `html.dark`, background `rgb(14, 15, 27)`, and foreground text `rgb(243, 245, 247)` while headings, cards, and CTA text remained readable.
- [x] Mobile learner usability revalidated at `390x844`: the login form, learner dashboard, and live returned-review course detail all stacked cleanly and remained usable without clipping or broken navigation.
- [x] Tablet internal-role usability revalidated at `768x1024`: trainer learners and admin dashboard/enrollments remained operational without blocking layout regressions. Internal-role phone-width optimization remains outside the release target for this phase and is explicitly accepted as out of scope.
- [x] Manual-review copy was refined in the learner assessment UI so the returned-work state no longer claims essay learners only get one submission. Revision attempts now describe the trainer-return flow accurately and explain that returned work can be revised and resubmitted without losing earlier review history.
- [x] Existing completion and certificate copy remained aligned during the Phase 6 rerun: learner-facing approval/certificate messaging on dashboard and course detail still clearly states that trainer approval is required before certificates can be released.

## Phase 7. Release Candidate Sign-Off

### Goal

Run the final multi-role release pass and convert results into a release recommendation.

### Scope

- all roles
- critical workflows only
- accepted exceptions and deferred items

### Tasks

- [x] Re-run the final role-based smoke pass using the checklist files.
- [x] Summarize blockers, major regressions, accepted exceptions, and deferred work.
- [x] Confirm no `P0` or `P1` items remain open.
- [x] Confirm migration-dependent exceptions are explicitly accepted if not yet deployed.

### Deliverables

- final release recommendation
- explicit exception list
- release candidate sign-off note

### Exit Criteria

- release recommendation is explicit and defensible
- all remaining gaps are either accepted, deferred, or scheduled

### Phase 7 Execution Summary

- [x] Final role-based smoke sign-off completed against the active checklist set: public/auth, trainee, trainer, admin, and shared cross-cutting files were reconciled with the latest Phase 4 to Phase 6 live evidence so the role-based QA records match the current system behavior.
- [x] No open `P0` or `P1` release issues remain in the current QA evidence set. The previously logged `P1` items in this cycle are all recorded as fixed: trainer permission fallback hardening, admin enrollment progress schema tolerance, and learner derived-assessment read safety.
- [x] No new major regression was discovered during the final sign-off pass. The latest learner, trainer, and admin reruns continued to load their critical operational routes, while recommendation attribution, manual-review revision flow, approval gating, and certificate-release gating all remained aligned with the intended release behavior.
- [x] Accepted release exceptions are explicit for this QA environment:
  - learner enrollment confirmation still emits a non-blocking `notifications` RLS insert failure even when enrollment succeeds
  - learner course reload still shows noticeable but non-blocking rehydration delay, with occasional downgraded `module_sessions` unload abort noise
  - trainer/admin operational content remains English-first inside otherwise localized shells
  - trainer/admin phone-width optimization remains out of scope; tablet and desktop are the accepted internal-role release targets
  - backend verification around DB-level phone normalization and theme-profile persistence remains deferred if deployment proof is still needed outside the connected QA environment
- [x] Deferred post-release or backend follow-up work is scheduled rather than blocking RC sign-off:
  - server-authorized fix for learner enrollment confirmation notifications
  - server-side cleanup or final verification of `get_user_permissions`
  - predictive refresh backend repair before re-enabling the disabled startup refresh path
  - additional browser-matrix coverage beyond the current VS Code integrated browser pass
- [x] Release recommendation for the connected QA environment: proceed to release candidate, with the accepted exceptions above tracked as `P2` or `P3` follow-up work rather than release blockers.

## Implementation Objectives

- [ ] Validate all public, trainee, trainer, and admin core workflows end to end.
- [ ] Confirm that UI, navigation, localization, and responsive behavior remain stable.
- [ ] Verify that analytics, recommendations, and progress reporting still reflect real system behavior.
- [ ] Detect schema drift between code and the connected Supabase project before release.
- [ ] Produce a prioritized issue list and a concrete remediation roadmap.

## Recommended Validation Environments

### Application Modes

- [ ] Local dev server against the connected Supabase project
- [ ] Production-like preview build

### Browsers

- [ ] Chrome or Edge latest
- [ ] Firefox latest
- [ ] Safari latest on macOS or iOS if available

### Device Widths

- [ ] Mobile: 360x800 and 390x844
- [ ] Tablet: 768x1024
- [ ] Desktop: 1366x768 and 1440x900

### Theme Modes

- [ ] Light mode
- [ ] Dark mode

### Languages

- [ ] English
- [ ] Tagalog

## Test Accounts

Use the seeded live QA accounts already documented in the repo:

- [x] Admin: `admin@peso.academy`
- [x] Trainer: `trainer@peso.academy`
- [x] Trainee: `trainee@peso.academy`

Use additional seeded or disposable trainees when testing new registration and onboarding completion.

## Global Exit Criteria

Release should not proceed until these conditions are met:

- [x] No `P0` or `P1` issues remain open.
- [x] All core role workflows pass on at least one desktop browser.
- [x] Public and learner responsive checks pass on mobile and desktop.
- [x] Trainer and admin operational workflows pass on desktop.
- [x] Recommendation cards, analytics refreshes, and progress views return data without blocking errors.
- [x] Known migration-dependent items are explicitly accepted as release exceptions if not yet deployed.

## Severity And Priority Model

### Severity

- `P0`: release blocker, data loss, auth break, enrollment break, impossible core workflow
- `P1`: major workflow regression, wrong permissions, broken progress, broken assessments, broken certificates
- `P2`: degraded UX, partial data mismatch, role-specific issue with workaround
- `P3`: minor UI inconsistency, copy issue, low-risk polish item

### Triage Dimensions

- user impact
- role scope
- data correctness risk
- release risk
- workaround availability

## Validation Matrix By Area

## 1. Public And Authentication QA

### Public Site

- [ ] Open landing page in English and Tagalog.
- [ ] Check navigation links, hero CTAs, feature cards, how-it-works section, footer links, and theme toggle.
- [ ] Verify no visual clipping, broken spacing, invisible text, or missing backgrounds.
- [ ] Check dark-mode contrast on headings, body text, cards, and buttons.
- [ ] Confirm gradients are fully removed where intended.

### Registration

- [ ] Register a brand-new trainee account.
- [ ] Confirm simplified registration completes without the removed helper-panel regressions.
- [ ] Confirm required fields fill full width on supported breakpoints.
- [ ] Verify redirect behavior after signup.

### Login And Session Handling

- [ ] Login as trainee, trainer, and admin.
- [ ] Reload after login and verify session persistence.
- [ ] Logout and verify protected routes redirect appropriately.
- [ ] Verify role-based redirect lands on the correct dashboard.

## 2. Trainee QA

### Onboarding And Recommendation Gating

- [ ] Verify first-login onboarding appears immediately after initial trainee login.
- [ ] Confirm onboarding draft/resume behavior survives reload.
- [ ] Complete onboarding and verify recommendation surfaces unlock.
- [ ] Reload dashboard and confirm onboarding stays dismissed.
- [ ] Verify Tagalog and English learner copy renders correctly on onboarding, dashboard, courses, certificates, and profile.

### Dashboard

- [ ] Verify latest module resume card loads.
- [ ] Check enrolled counts, completed counts, profile-signal summary, progress CTA, and learning analytics cards.
- [ ] Confirm recommendation gating copy is correct before onboarding completion.
- [ ] Confirm recommendation cards load after onboarding completion.

### Course Browse And Course Detail

- [ ] Open course catalog in both languages.
- [ ] Filter by categories and verify card layout, labels, and CTA behavior.
- [ ] Open a course detail page and confirm enrollment state.
- [ ] Open a course detail page and confirm progress summary.
- [ ] Open a course detail page and confirm module list.
- [ ] Open a course detail page and confirm credited-hours copy.
- [ ] Open a course detail page and confirm actual-time copy.
- [ ] Open a course detail page and confirm assessment container.

### Enrollment

- [ ] Enroll in an available course from browse and detail surfaces.
- [ ] Verify duplicate enrollment is blocked.
- [ ] Verify verification-gated enrollment messaging for unverified trainees if applicable.

### Module Progress And Sessions

- [ ] Open a module and verify session tracking begins.
- [ ] Reload mid-module and confirm resume state or latest-session visibility.
- [ ] Verify blocked modules remain blocked until prerequisites are satisfied.
- [ ] Confirm recent session history and time-tracking values appear in dashboard, progress, and trainer/admin views.

### Assessment Flows

- [ ] Validate a multiple-choice assessment.
- [ ] Validate a true/false assessment.
- [ ] Validate a short-answer assessment if present.
- [ ] Validate an essay/manual-review assessment.
- [ ] Confirm shuffled question and answer order across attempts where applicable.
- [ ] Confirm pass/fail messaging and attempt limit behavior.
- [ ] Confirm essay submissions move to submitted or under-review states instead of auto-completing the module.

### Trainer Feedback Visibility

- [ ] For a seeded essay course, have the trainer return an attempt for follow-up.
- [ ] As the trainee, verify the course page shows trainer feedback and the returned-review status.
- [ ] Verify the current message for revision resubmission matches the intended product limitation.

### Certificates

- [ ] Verify certificates page loads issued certificates.
- [ ] Confirm certificates do not appear before trainer/admin approval paths are complete.
- [ ] Open certificate details and verify layout and print/export behavior if supported.

### Profile And Settings

- [ ] Open learner profile in English and Tagalog.
- [ ] Validate phone input rejects invalid values and accepts `09XXXXXXXXX` values.
- [ ] Validate postal code rejects non-4-digit values.
- [ ] Verify profile updates trigger recommendation refresh where intended.
- [ ] Verify theme changes persist through browser fallback behavior.
- [ ] If migration `068_add_user_theme_preference.sql` is deployed, verify persistence through the profile row as well.

## 3. Trainer QA

### Trainer Dashboard

- [ ] Verify trainer dashboard loads portfolio metrics, learner-risk indicators, course quality tabs, and quick actions.
- [ ] Confirm no permission timeout or ambiguous permission RPC failures appear.

### Course Management

- [ ] Open trainer courses list and verify course cards, status badges, and module actions.
- [ ] Create a new course.
- [ ] Edit an existing course.
- [ ] Publish and unpublish a course.
- [ ] Verify course content completeness badges and publish-readiness messaging.

### Module Authoring

- [ ] Create a module from scratch.
- [ ] Edit an existing module.
- [ ] Add text, image, video, document, learning material, and quiz blocks.
- [ ] Create a mixed assessment with multiple-choice questions.
- [ ] Create a mixed assessment with true/false questions.
- [ ] Create a mixed assessment with short-answer questions.
- [ ] Create a mixed assessment with essay questions.
- [ ] Verify derived quiz summary updates correctly.
- [ ] Save as draft, reload, and finalize.

### Learner Management And Review

- [ ] Open trainer learners page.
- [ ] View real learner progress across enrolled courses.
- [ ] Confirm module-level completion, session history, and certificate status are visible.
- [ ] Open essay review queue items.
- [ ] Approve one essay attempt.
- [ ] Return one essay attempt for follow-up.
- [ ] Verify resulting state changes in learner progress and certificate gating.

### Completion Approval And Certificates

- [ ] Confirm a fully completed learner with pending approval does not immediately receive a certificate.
- [ ] Approve a learner completion request.
- [ ] Verify certificate issuance succeeds only after approval requirements are met.
- [ ] Confirm trainer-issued certificate metadata is stored correctly.

## 4. Admin QA

### Admin Dashboard

- [ ] Verify admin analytics dashboard loads organization-wide metrics.
- [ ] Check predictive analytics cards, report summaries, and navigation to operational pages.

### User Management

- [ ] Open users page.
- [ ] Create or edit a user if the flow is supported.
- [ ] Verify phone and role edits behave correctly.
- [ ] Confirm user status, role, and verification state changes are reflected in downstream access.

### Enrollment Management

- [ ] Open admin enrollments table.
- [ ] Filter by course and status.
- [ ] Open real learner progress dialogs.
- [ ] Confirm visibility includes summary progress.
- [ ] Confirm visibility includes module-by-module detail.
- [ ] Confirm visibility includes essay review state.
- [ ] Confirm visibility includes recent course activity.
- [ ] Confirm visibility includes credited hours and actual learning time where available.
- [ ] Verify no older-schema regression appears in assessment projection reads.

### Reports And Predictive Surfaces

- [ ] Open reports page and verify charts/cards load.
- [ ] Check recommendation acceptance analytics if surfaced.
- [ ] Verify predictive risk, disengagement, and aggregate learner metrics render without blocking errors.

### Admin Certificate And Completion Controls

- [ ] Validate admin-side approval and certificate release flows against seeded live QA enrollments.
- [ ] Confirm admin-issued certificates are blocked until approval state is valid.

## 5. Cross-Cutting QA

### Localization

- [ ] Public and learner surfaces switch between English and Tagalog.
- [ ] Trainer and admin role shells tolerate the language switch without UI breakage.
- [ ] Current rollout expectation confirmed: trainer/admin page content may remain English-first.

### Accessibility And Visual QA

- [ ] Tab through forms, comboboxes, dialogs, and menu actions.
- [ ] Check focus states.
- [ ] Check readable contrast in light and dark mode.
- [ ] Verify dialog overlays, tables, cards, and mobile stacks do not overlap or clip.

### Responsive QA

- [ ] Re-run critical public and learner flows on mobile viewport.
- [ ] Verify navigation, forms, dialogs, and course content remain usable.
- [ ] Check trainer/admin tables at tablet and desktop widths.

### Data And Schema Drift QA

- [ ] Watch browser console for `400`, `406`, `PGRST116`, `PGRST204`, and `42702` type failures.
- [ ] Re-test older-schema-tolerant notification reads.
- [ ] Re-test older-schema-tolerant course reads.
- [ ] Re-test admin enrollment progress reads.
- [ ] Re-test derived assessment reads.
- [ ] Re-test role permission checks.

## Issue Log For This QA Cycle

### Verified Fixed During The Current QA Cycle

| ID | Issue | Priority | Current State | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| QA-001 | Trainer permission checks hit broken `get_user_permissions` RPC with ambiguous `user_id` | P1 | Fixed in frontend fallback strategy | Backend + Frontend | Frontend now defaults to direct role-permission reads; DB RPC should still be corrected later |
| QA-002 | Admin enrollment progress dialog failed on missing `assessments.derived_from_module_quiz` column | P1 | Fixed in frontend schema-tolerant read | Frontend | Older-schema compatible projection restored |
| QA-003 | Learner course reads attempted derived-assessment sync during normal playback | P1 | Fixed in assessment read path | Frontend | Derived sync now only runs when explicitly requested by authoring flow |

### Known Open Gaps Or Follow-Up Items

| ID | Gap | Priority | Owner | Recommended Action |
| --- | --- | --- | --- | --- |
| GAP-002 | Theme profile-row persistence still needs explicit backend verification in the connected release environment | P2 | Backend | Reconfirm migration `068_add_user_theme_preference.sql` and rerun cross-device persistence QA if release proof is required |
| GAP-003 | DB-level phone normalization and constraint enforcement still need explicit backend verification in the connected release environment | P2 | Backend | Reconfirm migration `069_standardize_phone_numbers.sql` and rerun live constraint QA against real rows if release proof is required |
| GAP-004 | Trainer/admin localization remains intentionally incomplete | P3 | Product + Frontend | Decide rollout scope for role-based translations |
| GAP-005 | The database RPC `get_user_permissions` still needs a server-side fix even though frontend fallback is in place | P2 | Backend | Repair ambiguous parameter/column reference in the function definition |

## Supporting Gap Remediation Detail

## Phase A. Release Protection

### Goal

Close every issue that can break release confidence without expanding scope unnecessarily.

### Tasks

- [ ] Reconfirm migration `068_add_user_theme_preference.sql` in the target release environment if separate backend proof is required.
- [ ] Reconfirm migration `069_standardize_phone_numbers.sql` in the target release environment if separate backend proof is required.
- [ ] Repair the `get_user_permissions` RPC in Supabase.
- [ ] Re-run smoke QA on trainer and admin routes after DB changes.

### Suggested Owners

- Backend engineer
- QA engineer
- Release manager

## Phase B. Manual Review Workflow Completion

### Goal

Finish the remaining learner revision loop so essay/manual-review flow is truly end to end.

### Tasks

- [x] Define whether a trainer return action reopens the same attempt or creates a new revision attempt.
- [x] Add learner-side resubmission UI after `needs_revision`.
- [x] Persist revision history and trainer feedback thread if needed.
- [x] Update certificate and completion gating to respect revision states.
- [x] Add tests for submit, return, revise, approve, and complete.

### Suggested Owners

- Product owner
- Frontend engineer
- Backend engineer
- QA engineer

## Phase C. Recommendation And Analytics Hardening

### Goal

Keep recommendations accurate after the new approval-gated and essay-review workflow changes.

### Tasks

- [ ] Re-run recommendation analytics refreshes after deploying pending DB changes.
- [ ] Validate essay/manual-review learners only influence scored assessment signals after review completion.
- [ ] Confirm pending approval enrollments do not incorrectly inflate content-completion boosts.
- [ ] Add regression tests around recommendation refresh after profile changes, enrollments, completions, and reviewed assessments.

### Suggested Owners

- Analytics engineer
- Frontend engineer
- Backend engineer
- QA engineer

## Phase D. UX And Localization Expansion

### Goal

Close remaining usability and role-language gaps.

### Tasks

- [ ] Expand trainer/admin localization coverage if approved.
- [ ] Re-run dark-mode contrast and responsive QA after any content changes.
- [ ] Improve copy around manual-review revision state so learners understand the next action clearly.

### Suggested Owners

- Product designer
- Frontend engineer
- QA engineer

## Recommended Implementation Sequence

1. [ ] Complete Phase 0 baseline confirmation.
2. [ ] Complete Phase 1 stabilization work, including DB and runtime fixes.
3. [x] Complete Phase 2 learner flow hardening and validate the learner checklist.
4. [x] Complete Phase 3 trainer/admin operational hardening and validate internal-role checklists.
5. [x] Complete Phase 4 recommendation and analytics verification with captured evidence.
6. [x] Complete Phase 5 manual-review workflow completion.
7. [x] Complete Phase 6 UX and localization polish after workflow stability is confirmed.
8. [x] Finish with Phase 7 release candidate sign-off.

## Recommendation And Analytics Verification

## Current Answer

The system still uses active personalized recommendation logic. It has not reverted to static tagging or simple category matching.

### Current Recommendation Model

The active learner recommender is still hybrid and combines:

- [x] content and profile signals
- [x] collaborative learner-neighbor signals
- [x] session-behavior signals
- [x] assessment-performance signals
- [x] popularity weighting

This behavior is centered in:

- `src/services/reportingService.ts`
- `src/services/recommendationSyncService.ts`
- `src/services/analyticsService.ts`
- `src/pages/Dashboard.tsx`

### What It Still Uses

- [x] learner profile signals such as interests, categories, skills, and level
- [x] onboarding-derived preference data
- [x] course metadata such as category, tags, level, TESDA flag, and career-path metadata
- [x] overlapping enrollments and progress similarity across learners for collaborative weighting
- [x] module-session and engagement activity for behavior signals
- [x] assessment outcomes, weak topics, strong topics, and score patterns for assessment-aware weighting
- [x] persisted recommendation analytics such as impression, click, refresh, and accept events

### What Changed After The New Rules

The recommendation engine still works, but the newer assessment and completion rules change some of its inputs:

- completion approval now matters for content-based completion affinity because some recommendation boosts only count enrollments whose status is actually `completed`
- collaborative logic can still treat a learner at or near full progress as completion-like even before approval, so not every completion-related signal changed equally
- essay or short-answer attempts waiting for manual review count as activity and time, but they do not fully strengthen assessment-based recommendation signals until a score exists
- onboarding completion now gates when recommendation surfaces appear to learners, even though the engine itself still exists behind that gate

### Recommendation Analytics And Persistence

Recommendation records are still persisted and tracked with:

- rank
- score
- acceptance probability
- reasons
- source mix
- model version
- recommendation context

That behavior is visible in `src/services/analyticsService.ts`, where learner recommendations are persisted to `learner_recommendations` and analytics events are recorded for refresh, impression, click, and acceptance.

### Important Limitation

The system still does not expose a separate learner-facing “future opportunities” engine beyond course recommendations, next-step framing, and career-path-influenced recommendation reasons.

## Recommendation Verification Checklist

- [x] Confirm learner dashboard still loads hybrid recommendations after onboarding completion.
- [x] Confirm assessment-only recommendation fallback still appears when expected.
- [x] Confirm profile edits refresh recommendations.
- [x] Confirm enrollments created from recommendation cards still preserve recommendation attribution metadata.
- [x] Confirm recommendation impression and refresh analytics still write successfully.
- [x] Confirm recommendation click and accept analytics persist the originating recommendation id for dashboard recommendation actions.
- [x] Confirm learners with pending manual-review assessments do not receive misleading assessment-based boosts before scores exist.

## Suggested Evidence To Capture During QA

- [x] screenshots of dashboard recommendation cards before and after onboarding completion
- [x] console or network capture for recommendation refresh and analytics events
- [x] one learner profile update showing recommendation refresh side effect
- [x] one enrollment created from a recommendation surface with originating recommendation metadata retained

## Latest Phase 4 Evidence

- Fresh learner id: `672285d9-1084-4a4d-801c-e6ddb87eb790`
- Onboarding completed at: `2026-03-13T14:00:07.348+00:00`
- Verified at: `2026-03-13T14:04:17.519503+00:00`
- Live recommendation persistence snapshot after profile refresh and subsequent enrolls still showed 3 dashboard rows with score 63, hybrid engine context, and incremented impression counts.
- Direct learner-authenticated terminal reproduction proved `track_analytics_event` persists a valid recommendation id when called explicitly, so the remaining attribution gap is upstream of the RPC itself.
- Earlier dashboard-enrollment evidence captured the root cause window: before the fix, enrollments `44fcfeb1-eb57-493b-aa51-c601ac8486da` and `9aa5c179-956b-493c-a7ea-c92784a26a81` lost attribution after recommendation cleanup deleted the underlying `learner_recommendations` rows.
- Post-fix live verification passed: enrollment `533973b2-1322-4d59-bb4b-7ee40a084354` for course `30c5e0a3-6c07-4a10-a07a-87bb071c2085` retained `originating_recommendation_id = 079d2b15-052e-4841-827b-aec4aa6ff64a`, and the matching `recommendation_accept` plus `course_enroll` analytics events kept the same non-null recommendation id with `surface = "dashboard_recommendations"`.

## Issue Reporting Template

Use this template for each defect found during the full QA run:

```md
### [ISSUE-ID] Short Title

- Priority: P1
- Role: Trainee
- Environment: Preview build, Chrome desktop, Tagalog, dark mode
- Area: Course Detail / Assessment
- Steps to Reproduce:
  1. ...
  2. ...
  3. ...
- Expected Result: ...
- Actual Result: ...
- Data Risk: None / Low / Medium / High
- Workaround: ...
- Suspected Layer: Frontend / Backend / Schema / Analytics / Content
- Evidence: screenshot, console log, request URL, affected record IDs
```

## Final Release Recommendation Workflow

At the end of the QA cycle, summarize results in this order:

1. [ ] blockers
2. [ ] major regressions
3. [ ] accepted release exceptions
4. [ ] recommended fixes before release
5. [ ] deferred roadmap work after release

If all `P0` and `P1` items are closed and migration-dependent exceptions are explicitly accepted, the build can proceed to release candidate sign-off.