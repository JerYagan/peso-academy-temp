# Trainer QA Checklist

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
| Account | trainer@peso.academy |
| Build | `npm run test` passed (4 files, 11 tests) |
| Browser | VS Code integrated browser |
| Device | Desktop |
| Theme | System |
| Language | Tagalog shell |
| Tester | GitHub Copilot |
| Date | 2026-03-13 |

## Trainer Dashboard

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Verify trainer dashboard loads portfolio metrics. | Trainer dashboard loaded after login and displayed portfolio metrics and quick navigation. |
| Passed | Verify learner-risk indicators, course quality tabs, and quick actions. | Live Phase 3 recheck loaded the `Learners & risk`, `Courses`, and `Recommendations` tabs with populated analytics plus `Manage courses` and `View learners` quick actions. |
| Passed | Confirm no permission timeout or ambiguous permission RPC failures appear. | After routing internal trainer pages through explicit role access, the latest rerun of `/trainer/learners` and `/trainer/courses/:id/modules` loaded without the earlier repeated `Permission check timeout, using fallback` warnings. |

## Course Management

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Open trainer courses list and verify course cards, status badges, and module actions. | Course cards, status badges, publish-readiness messaging, and `Modules` and `Edit` actions rendered on the live courses page. |
| Untested | Create a new course. | |
| Passed | Edit an existing course. | Live Phase 3 recheck opened the `Edit Course` dialog with metadata, approved-tag selectors, preview, and `Save as Draft` or `Finalize` controls. |
| Untested | Publish a course. | |
| Untested | Unpublish a course. | |
| Passed | Verify course content completeness badges and publish-readiness messaging. | Live course cards showed content readiness percentages and publish-gap counts. |

## Module Authoring

| Status | Check | Notes |
| --- | --- | --- |
| Untested | Create a module from scratch. | |
| Passed | Edit an existing module. | The trainer `Modules` action opened the dedicated module-management surface for the selected course, including module counts, reorder handles, and a `Create Module` entry into the dedicated authoring flow. |
| Untested | Add text, image, video, document, learning material, and quiz blocks. | |
| Untested | Create a mixed assessment with multiple-choice questions. | |
| Untested | Create a mixed assessment with true or false questions. | |
| Untested | Create a mixed assessment with short-answer questions. | |
| Untested | Create a mixed assessment with essay questions. | |
| Untested | Verify derived quiz summary updates correctly. | |
| Untested | Save as draft, reload, and finalize. | |

## Learner Management And Review

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Open trainer learners page. | Learners page loaded after the fallback permission path resolved. |
| Passed | View real learner progress across enrolled courses. | `View Progress` opened the John Trainee dialog with cross-course totals and recent session history. |
| Passed | Confirm module-level completion, session history, and certificate status are visible. | The learner progress dialog exposed completed courses, certificates released, average progress, and recent session history. |
| Passed | Open essay review queue items. | Live Phase 3 recheck exposed `Review Essay` actions for both `under review` and `needs revision` seeded attempts, and the trainer review dialog loaded the learner response, decision controls, feedback field, and `Submit Review` action. |
| Untested | Approve one essay attempt. | |
| Untested | Return one essay attempt for follow-up. | |
| Passed | Verify learner revision resubmission returns to the manual-review queue with updated answers. | Phase 5 live QA on `/trainer/learners` showed a fresh `submitted` `Essay Review Module Assessment` entry dated `3/13/2026, 11:11:01 PM` above the older `needs revision` item, confirming the revised submission re-entered the review queue without erasing history. |
| Passed | Verify resulting state changes in learner progress and certificate gating. | After the revision resubmission, the course still showed `enrolled`, the module stayed pending, progress remained at `0%`, and no certificate-release path opened before trainer approval. |

## Completion Approval And Certificates

| Status | Check | Notes |
| --- | --- | --- |
| Untested | Confirm a fully completed learner with pending approval does not immediately receive a certificate. | |
| Untested | Approve a learner completion request. | |
| Passed | Verify certificate issuance succeeds only after approval requirements are met. | The learner progress dialog only exposed `Release Certificate` on the seeded enrollment that was already `Completion Approved`; in-progress and not-ready enrollments did not show a release action. |
| Untested | Confirm trainer-issued certificate metadata is stored correctly. | |

## Trainer Localization And Layout Checks

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Switch language control and confirm trainer shell remains stable. | Trainer shell remained usable while the account was displayed with Tagalog shell controls. |
| Passed | Confirm trainer content may remain English-first without UI breakage. | Trainer feature content remained readable without layout breakage under the localized shell. |
| Passed | Check trainer tables and dialogs at tablet and desktop widths. | Desktop-width learners dialog and course management tables remained usable in the live run. |
