ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS language_preference TEXT NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_language_preference_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_language_preference_check
      CHECK (language_preference IN ('en', 'tl'));
  END IF;
END;
$$ LANGUAGE plpgsql;

UPDATE public.users AS profile
SET language_preference = COALESCE(
  NULLIF(auth_user.raw_user_meta_data ->> 'language_preference', ''),
  profile.language_preference,
  'en'
)
FROM auth.users AS auth_user
WHERE auth_user.id = profile.id;