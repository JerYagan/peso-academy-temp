# Public And Authentication QA Checklist

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
| Build | `npm run test` passed (4 files, 11 tests) |
| Browser | VS Code integrated browser |
| Device | Desktop |
| Theme | Light during current public-phase pass |
| Language | Tagalog and English |
| Tester | GitHub Copilot |
| Date | 2026-03-13 |

## Public Site

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Open landing page in English. | Live Phase 2 pass showed the English hero, navigation, features, and how-it-works sections rendering correctly. |
| Passed | Open landing page in Tagalog. | Live Phase 2 pass showed the Tagalog hero, navigation, features, and how-it-works sections rendering correctly. |
| Passed | Check header navigation links. | Public header links for landing, features, courses, login, and signup rendered and remained usable during the desktop pass. |
| Passed | Check hero CTAs. | Primary landing-page CTAs rendered in both languages during the public recheck. |
| Passed | Check feature cards. | Feature-card content was visible in both languages during the live landing-page pass. |
| Passed | Check how-it-works section. | The how-it-works section rendered in both Tagalog and English during the public recheck. |
| Passed | Check footer links and footer layout. | Phase 7 rechecked the public landing footer in the live mobile dark-mode pass and the PESO Academy link, quick links, contact block, and copyright line all rendered without layout breakage. |
| Passed | Check theme toggle behavior. | Clean public-page recheck toggled the stored theme from dark to light, updated the HTML class accordingly, and kept the light preference after reload via browser fallback storage. |
| Passed | Verify no visual clipping, broken spacing, invisible text, or missing backgrounds. | No public desktop clipping or missing-background regressions were visible on the landing-page recheck. |
| Passed | Verify dark-mode contrast on headings, body text, cards, and buttons. | Phase 7 rechecked the public landing page in dark mode and the page kept the dark background with light foreground text while the hero, feature cards, CTA buttons, and footer content remained readable. |
| Passed | Confirm gradients are removed where intended. | The public landing page continued to use the flattened non-gradient styling from the earlier UI cleanup. |

## Registration

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Register a brand-new trainee account. | A fresh trainee account was created successfully during the Phase 2 pass. |
| Passed | Confirm simplified registration completes without helper-panel regressions. | The simplified signup surface rendered without the earlier helper-panel/layout regressions. |
| Passed | Confirm required fields take full width on supported breakpoints. | Desktop signup fields rendered at full width during the current pass. Mobile and tablet still need separate responsive validation. |
| Passed | Verify redirect behavior after signup. | Successful signup redirected directly to `/dashboard`. |

## Login And Session Handling

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Login as trainee. | Seeded trainee login and new-account signup redirect both landed on learner-authenticated surfaces during the latest Phase 2 work. |
| Passed | Login as trainer. | Revalidated during the earlier phase baseline and trainer smoke QA. |
| Passed | Login as admin. | Revalidated during the earlier phase baseline and admin smoke QA. |
| Passed | Reload after login and verify session persistence. | Session persistence held across the current learner reruns, although some authenticated routes still showed intermittent fetch churn before settling. |
| Passed | Logout and verify protected routes redirect appropriately. | Public/auth re-entry checks required signing out of prior role sessions before returning to landing, signup, and login. |
| Passed | Verify role-based redirect lands on the correct dashboard. | Trainee, trainer, and admin dashboard redirects were revalidated during the Phase 0 and Phase 2 runs. |

## Public Responsive And Browser Checks

| Status | Check | Notes |
| --- | --- | --- |
| Passed | Verify public site on mobile viewport. | Phase 7 rechecked the public landing page at `390x844` in dark mode. The hero, feature sections, CTA stack, and footer remained readable and actionable without clipping. |
| Untested | Verify public site on tablet viewport. | |
| Passed | Verify public site on desktop viewport. | Earlier public and learner-phase reruns covered the public landing page successfully at desktop width without layout regressions. |
| Untested | Verify public site on Chrome or Edge. | |
| Untested | Verify public site on Firefox. | |
| Untested | Verify public site on Safari if available. | |
