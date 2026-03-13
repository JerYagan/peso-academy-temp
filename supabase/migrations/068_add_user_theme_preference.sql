ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'system';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_theme_preference_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_theme_preference_check
      CHECK (theme_preference IN ('system', 'light', 'dark'));
  END IF;
END;
$$ LANGUAGE plpgsql;

UPDATE public.users AS profile
SET theme_preference = COALESCE(
  NULLIF(auth_user.raw_user_meta_data ->> 'theme_preference', ''),
  profile.theme_preference,
  'system'
)
FROM auth.users AS auth_user
WHERE auth_user.id = profile.id;