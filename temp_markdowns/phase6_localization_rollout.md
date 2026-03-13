# Phase 6 Localization Rollout

## Strategy

- Use an in-repo localization layer instead of a heavy external i18n package.
- Keep translation resources in `src/i18n/locales/*.ts` with English as the fallback source of truth.
- Persist the learner's selected language in three places:
  - `public.users.language_preference` as the canonical profile value
  - Supabase auth metadata as a mirror for profile self-heal and signup hydration
  - `localStorage["peso-language-preference"]` as the anonymous/session fallback
- Support future languages by keeping the resource tree keyed by feature/page namespace and centralizing supported-language metadata in `src/i18n/types.ts`.

## First-Rollout Learner Surfaces

- Public shell:
  - `src/components/Header.tsx`
  - `src/components/Footer.tsx`
  - `src/components/auth/AuthPageShell.tsx`
- Learner entry points:
  - `src/pages/Index.tsx`
  - `src/pages/Login.tsx`
  - `src/pages/SignUp.tsx`
- Shared authenticated learner shell:
  - `src/components/DashboardLayout.tsx` for trainee navigation and account menu labels

## Deferred Learner-Facing Inventory

- The following learner-facing screens still contain inline English and should move into resource files in the next rollout:
  - `src/pages/Profile.tsx`
  - learner dashboard body content and onboarding modal copy
  - learner course browsing and enrollment surfaces
  - certificates, progress, and empty-state messaging beyond the shell labels
  - validation and helper text emitted from service-level business logic that still returns English strings

## Admin And Trainer Fallback Behavior

- Admin and trainer screens are intentionally left in English for the first localization rollout.
- Shared infrastructure still falls back to English when a translation key is missing.
- Where admin/trainer copy remains inline instead of resource-backed, the UI continues to display existing English text rather than blocking rendering.

## Test Coverage Added

- Automated coverage now validates:
  - language hydration from local storage
  - structured translation retrieval for array-based learner copy
  - persistence of a language change into both local storage and the authenticated user profile update path
- Remaining manual QA to run after migration `067` is deployed:
  - verify language switcher on mobile header and authenticated dashboard shell
  - verify long Tagalog labels in modal and empty states do not break layout
  - verify a signed-in learner keeps the selected language across refresh and re-login