# Phase 5 Supabase Deploy Runbook

## Scope

This runbook applies the two live database fixes identified during Phase 5 QA:

- `supabase/migrations/065_add_onboarding_completion_profile_fields.sql`
- `supabase/migrations/066_fix_phase1_rollup_user_scope.sql`

`065` fixes onboarding completion persistence in `public.users`.

`066` fixes `refresh_phase1_analytics_rollups` so user-scoped refreshes stay scoped and orphaned analytics events do not insert `NULL` into `analytics_user_daily.user_id`.

## Target project

- Supabase project URL: `https://zecfzgajzkcoazqiafza.supabase.co`
- Project ref: `zecfzgajzkcoazqiafza`

## Preferred path: Supabase CLI

Run these from `c:\Users\caran\Desktop\peso-system\peso-academy`.

1. Install the CLI if needed.

```powershell
npm install -g supabase
```

2. Authenticate.

```powershell
supabase login
```

3. Link the local repo to the hosted project.

```powershell
supabase link --project-ref zecfzgajzkcoazqiafza
```

4. Push pending migrations.

```powershell
supabase db push
```

If you want to verify only the relevant files before push, confirm these files exist locally:

- `supabase/migrations/065_add_onboarding_completion_profile_fields.sql`
- `supabase/migrations/066_fix_phase1_rollup_user_scope.sql`

## Fallback path: Supabase SQL Editor

Use this if the CLI is unavailable.

1. Open the Supabase dashboard for project `zecfzgajzkcoazqiafza`.
2. Go to SQL Editor.
3. Create a new query tab.
4. Paste the full contents of `supabase/migrations/065_add_onboarding_completion_profile_fields.sql` and run it.
5. Open a second query tab.
6. Paste the full contents of `supabase/migrations/066_fix_phase1_rollup_user_scope.sql` and run it.

Apply `065` before `066`.

## Post-deploy validation

1. Confirm the onboarding columns exist through REST or Table Editor:

- `onboarding_completed_at`
- `onboarding_confidence_level`
- `onboarding_weekly_commitment`
- `onboarding_digital_comfort`

2. Log in with a fresh trainee account or create a new one.
3. Navigate to `/dashboard`.
4. Verify the onboarding modal appears for a new trainee.
5. Submit onboarding.
6. Reload `/dashboard`.
7. Confirm:

- the onboarding modal stays dismissed
- personalized recommendations remain visible
- profile signals remain populated
- no `PGRST204` error appears for `public.users.onboarding_completed_at`
- no `analytics_user_daily.user_id` null-constraint error appears in console during recommendation refresh

## Known non-blocking noise to watch separately

Current live QA still shows these dashboard-load issues that are not proven fixed by `065` or `066`:

- repeated `notifications` HEAD requests aborted with `net::ERR_ABORTED`
- generic `400` resource failures during dashboard load

If those still appear after migration deploy, treat them as a separate investigation from the Phase 5 onboarding persistence fix.

## Local rerun commands

Start the app locally from the app folder:

```powershell
Push-Location "c:\Users\caran\Desktop\peso-system\peso-academy"; npm run dev -- --host 127.0.0.1 --port 4173
```

Optional local validation before rerun:

```powershell
Push-Location "c:\Users\caran\Desktop\peso-system\peso-academy"; npm run build
```