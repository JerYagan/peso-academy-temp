ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS industry_interests TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS preferred_categories TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS onboarding_skill_level TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_onboarding_skill_level_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_onboarding_skill_level_check
      CHECK (
        onboarding_skill_level IS NULL OR onboarding_skill_level IN ('exploring', 'beginner', 'intermediate', 'advanced')
      );
  END IF;
END $$;