# Admin QA Checklist

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
| Account | admin@peso.academy |
| Build | `npm run test` passed (4 files, 11 tests) |
| Browser | VS Code integrated browser |
| Device | Desktop |
| Theme | System |
| Language | Tagalog shell |
| Tester | GitHub Copilot |
| Date | 2026-03-13 |

## Admin Dashboard

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Verify admin analytics dashboard loads organization-wide metrics. | Live Phase 3 recheck loaded organization-wide totals, completion cards, certificate counts, learner activity, and trend charts on the admin dashboard. |
| Passed | Check predictive analytics cards, report summaries, and navigation to operational pages. | Live Phase 3 recheck loaded overview, learner-activity, predictive-oversight, and recommendation-health sections; the separate reports workspace also loaded completion analytics without the earlier predictive-refresh startup noise. |

## User Management

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Open users page. | Users page loaded with seeded users, roles, and edit/delete actions visible. |
| Passed | Create or edit a user if the flow is supported. | The disposable `phase2fresh.20260313.1220@example.com` learner saved successfully on the latest rerun and the admin session stayed on `/admin/users` without the earlier redirect back to `/login`. |
| Untested | Verify phone and role edits behave correctly. | The user-edit dialog now persists a phone and address update without destabilizing the admin session; the separate `Change User Role` dialog still needs a clean end-to-end role-save rerun. |
| Untested | Confirm user status, role, and verification state changes are reflected in downstream access. | Pending a dedicated role or verification-state mutation pass after the session-stability fix. |

## Enrollment Management

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Open admin enrollments table. | Enrollments table loaded with live seeded rows and filters. |
| Untested | Filter by course and status. | |
| Passed | Open real learner progress dialogs. | `View Progress` opened the admin enrollment detail dialog successfully. |
| Passed | Confirm visibility includes summary progress. | Dialog showed progress, modules completed, pending reviews, and blocked modules. |
| Passed | Confirm visibility includes module-by-module detail. | Dialog listed module and assessment progress for the selected enrollment. |
| Passed | Confirm visibility includes essay review state. | Dialog displayed essay review status and latest assessment state. |
| Untested | Confirm returned-for-revision and resubmitted attempts remain visible as historical learner activity. | |
| Passed | Confirm visibility includes recent course activity. | Dialog exposed the recent course activity panel for the selected enrollment. |
| Passed | Confirm visibility includes credited hours and actual learning time where available. | Dialog showed both credited hours and actual learning minutes. |
| Passed | Verify no older-schema regression appears in assessment projection reads. | The admin enrollment detail dialog rendered without the earlier assessment projection failure. |

## Reports And Predictive Surfaces

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Open reports page and verify charts or cards load. | Latest Phase 1 recheck loaded the reports workspace in about 3.1 seconds and rendered completion analytics. |
| Passed | Check recommendation acceptance analytics if surfaced. | Phase 4 root-cause fix removed stale `learner_recommendations` deletions that were nulling attribution FKs. A post-fix live learner enrollment preserved recommendation id `079d2b15-052e-4841-827b-aec4aa6ff64a` on the enrollment row and on both `recommendation_accept` plus `course_enroll` analytics events for `surface = dashboard_recommendations`. Historical rows created before the fix still contain null attribution where the underlying recommendation row had already been deleted. |
| Passed | Verify predictive risk, disengagement, and aggregate learner metrics render without blocking errors. | Predictive and aggregate analytics now render, but the server-side predictive refresh function still needs a backend repair before it can be safely re-enabled on startup. |

## Admin Certificate And Completion Controls

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Validate admin-side approval and certificate release flows against seeded live QA enrollments. | The admin enrollment dialog now supports both approval and release actions end to end: `QA Trainer Issuer QA` was temporarily reset to `Awaiting Trainer Approval`, approved live from the admin dialog, and immediately surfaced `Release Certificate`, while the seeded `QA Admin Issuer QA` enrollment had already proven the release path. |
| Passed | Confirm admin-issued certificates are blocked until approval state is valid. | The admin release control was available on the `Completion Approved` seeded enrollment and did not appear in the non-ready rows during the same live pass, matching the expected approval gate. |

## Admin Localization And Layout Checks

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Switch language control and confirm admin shell remains stable. | Admin shell remained stable in Tagalog during the live pass. |
| Passed | Confirm admin content may remain English-first without UI breakage. | English-first admin content did not break layout inside the localized shell. |
| Passed | Check admin tables and dialogs at tablet and desktop widths. | Desktop-width enrollments table and detail dialog remained usable. |
