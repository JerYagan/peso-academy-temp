# Shared Cross-Cutting QA And Recommendation Verification Checklist

## Status Legend

Use one of these values in the `Status` column:

- `Untested`
- `Passed`
- `Failed`
- `Blocked`
- `N/A`

## Localization

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Public and learner surfaces switch between English and Tagalog. | Public/login and learner flows were revalidated across English and Tagalog during the earlier learner passes, and the Phase 6 rerun returned to the public login shell cleanly in both language states without layout breakage. |
| Passed | Trainer and admin role shells tolerate language switching without UI breakage. | Trainer and admin reruns continued to render stable localized shells while moving between dashboard and operational routes. No navigation or header breakage appeared during the Phase 6 tablet-width checks. |
| Passed | Confirm trainer and admin content may remain English-first in the current rollout. | Phase 6 explicitly accepts shell-localized navigation with English-first operational content for trainer/admin in this release cycle because the pages remained readable and structurally stable. |

## Accessibility And Visual QA

| Status | Check | Notes |
| --- | --- | --- |
| Untested | Tab through forms, comboboxes, dialogs, and menu actions. | |
| Untested | Check focus states. | |
| Passed | Check readable contrast in light and dark mode. | Phase 6 rechecked the learner dashboard in dark mode at `390x844`. The page switched to `html.dark` with dark background `rgb(14, 15, 27)` and light foreground text `rgb(243, 245, 247)`, and the dashboard headings/cards remained readable. |
| Passed | Verify dialog overlays, tables, cards, and mobile stacks do not overlap or clip. | Learner mobile dashboard and course-detail cards stacked without overlap at phone width, while trainer and admin operational pages remained usable at tablet width. Internal-role mobile tables are not a release target for this phase. |

## Responsive QA

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Re-run critical public and learner flows on mobile viewport. | Phase 6 reran the public login shell plus learner login, dashboard, and returned-review course flow at `390x844`. These phone-width surfaces remained readable and actionable. |
| Passed | Verify navigation, forms, dialogs, and course content remain usable. | The login form, learner dashboard CTAs, course navigation, and manual-review course content all remained usable at phone width during the Phase 6 rerun. |
| Passed | Check trainer and admin tables at tablet and desktop widths. | Trainer learners and admin dashboard/enrollments remained usable at `768x1024` and at prior desktop widths. No tablet clipping blocked internal-role operational work. |

## Data And Schema Drift QA

| Status | Check | Notes |
| --- | --- | --- |
| Untested | Watch browser console for `400`, `406`, `PGRST116`, `PGRST204`, and `42702` type failures. | |
| Untested | Re-test older-schema-tolerant notification reads. | |
| Untested | Re-test older-schema-tolerant course reads. | |
| Untested | Re-test admin enrollment progress reads. | |
| Untested | Re-test derived assessment reads. | |
| Untested | Re-test role permission checks. | |

## Recommendation Verification

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Confirm learner dashboard still loads hybrid recommendations after onboarding completion. | Phase 4 live QA showed the fresh learner receiving 3 dashboard recommendations immediately after completing onboarding. |
| Passed | Confirm assessment-only recommendation fallback still appears when expected. | Phase 4 live QA confirmed the dashboard still showed the assessment-only fallback when no scored assessment evidence existed yet. |
| Passed | Confirm profile edits refresh recommendations. | Phase 4 live QA confirmed recommendation refreshes after learner profile edits and recorded the refreshed context in recommendation persistence. |
| Passed | Confirm enrollments created from recommendation cards preserve recommendation attribution metadata. | Phase 4 post-fix verification confirmed enrollment `533973b2-1322-4d59-bb4b-7ee40a084354` retained recommendation id `079d2b15-052e-4841-827b-aec4aa6ff64a` on the enrollment row and analytics events. |
| Passed | Confirm recommendation impression, click, refresh, and accept analytics still write successfully. | Phase 4 QA verified `recommendation_refresh`, `recommendation_impression`, click, and accept analytics writes end to end after the attribution fix. |
| Passed | Confirm learners with pending manual-review assessments do not receive misleading assessment-based boosts before scores exist. | Phase 4 QA confirmed under-review manual-review attempts remain `score = null` and do not strengthen scored assessment recommendation signals before review completes. |

## Manual Review Revision Verification

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Confirm a trainer-returned manual-review attempt opens a new learner revision attempt instead of reopening the reviewed submission. | Phase 5 live QA confirmed returned work now creates a fresh learner revision attempt instead of mutating the previously reviewed attempt. |
| Passed | Confirm the learner revision attempt is seeded from the previous answers and shows trainer feedback. | Phase 5 live QA showed the returned essay answers copied into the revision form with trainer feedback visible above the assessment. |
| Passed | Confirm a resubmitted revision re-enters trainer review without erasing prior attempt history. | Trainer-side follow-up showed the new `submitted` review entry above the earlier `needs revision` item, preserving history while returning the learner to the review queue. |

## Suggested Evidence Capture

| Status | Evidence Item | Notes |
| --- | --- | --- |
| Untested | Capture screenshots of dashboard recommendation cards before and after onboarding completion. | |
| Untested | Capture console or network evidence for recommendation refresh and analytics events. | |
| Untested | Capture one learner profile update showing recommendation refresh side effect. | |
| Untested | Capture one enrollment created from a recommendation surface with originating recommendation metadata retained. | |
