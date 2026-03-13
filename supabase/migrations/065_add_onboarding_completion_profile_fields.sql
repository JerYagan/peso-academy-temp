ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_confidence_level TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_weekly_commitment TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_digital_comfort TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_onboarding_confidence_level_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_onboarding_confidence_level_check
      CHECK (
        onboarding_confidence_level IS NULL
        OR onboarding_confidence_level IN ('needs_guidance', 'some_exposure', 'ready_for_projects')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_onboarding_weekly_commitment_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_onboarding_weekly_commitment_check
      CHECK (
        onboarding_weekly_commitment IS NULL
        OR onboarding_weekly_commitment IN ('under_2', '2_to_4', '5_plus')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_onboarding_digital_comfort_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_onboarding_digital_comfort_check
      CHECK (
        onboarding_digital_comfort IS NULL
        OR onboarding_digital_comfort IN ('needs_support', 'comfortable', 'advanced_tools')
      );
  END IF;
END $$;

UPDATE public.users AS profile
SET
  onboarding_confidence_level = CASE
    WHEN NULLIF(TRIM(COALESCE(auth_user.raw_user_meta_data ->> 'onboarding_confidence_level', '')), '') IN ('needs_guidance', 'some_exposure', 'ready_for_projects')
      THEN NULLIF(TRIM(COALESCE(auth_user.raw_user_meta_data ->> 'onboarding_confidence_level', '')), '')
    ELSE profile.onboarding_confidence_level
  END,
  onboarding_weekly_commitment = CASE
    WHEN NULLIF(TRIM(COALESCE(auth_user.raw_user_meta_data ->> 'onboarding_weekly_commitment', '')), '') IN ('under_2', '2_to_4', '5_plus')
      THEN NULLIF(TRIM(COALESCE(auth_user.raw_user_meta_data ->> 'onboarding_weekly_commitment', '')), '')
    ELSE profile.onboarding_weekly_commitment
  END,
  onboarding_digital_comfort = CASE
    WHEN NULLIF(TRIM(COALESCE(auth_user.raw_user_meta_data ->> 'onboarding_digital_comfort', '')), '') IN ('needs_support', 'comfortable', 'advanced_tools')
      THEN NULLIF(TRIM(COALESCE(auth_user.raw_user_meta_data ->> 'onboarding_digital_comfort', '')), '')
    ELSE profile.onboarding_digital_comfort
  END,
  onboarding_completed_at = COALESCE(
    CASE
      WHEN NULLIF(TRIM(COALESCE(auth_user.raw_user_meta_data ->> 'onboarding_completed_at', '')), '') IS NOT NULL
        THEN (auth_user.raw_user_meta_data ->> 'onboarding_completed_at')::timestamptz
      ELSE NULL
    END,
    profile.onboarding_completed_at
  ),
  updated_at = NOW()
FROM auth.users AS auth_user
WHERE auth_user.id = profile.id
  AND (
    NULLIF(TRIM(COALESCE(auth_user.raw_user_meta_data ->> 'onboarding_confidence_level', '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(auth_user.raw_user_meta_data ->> 'onboarding_weekly_commitment', '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(auth_user.raw_user_meta_data ->> 'onboarding_digital_comfort', '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(auth_user.raw_user_meta_data ->> 'onboarding_completed_at', '')), '') IS NOT NULL
  );