CREATE TABLE IF NOT EXISTS public.user_phone_normalization_audit (
  user_id UUID PRIMARY KEY,
  original_phone TEXT,
  normalized_phone TEXT,
  migration_tag TEXT NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

WITH phone_candidates AS (
  SELECT
    id,
    phone AS original_phone,
    CASE
      WHEN phone IS NULL OR BTRIM(phone) = '' THEN NULL
      WHEN REGEXP_REPLACE(phone, '\\D', '', 'g') ~ '^09\\d{9}$' THEN REGEXP_REPLACE(phone, '\\D', '', 'g')
      WHEN REGEXP_REPLACE(phone, '\\D', '', 'g') ~ '^639\\d{9}$' THEN '0' || SUBSTRING(REGEXP_REPLACE(phone, '\\D', '', 'g') FROM 3)
      WHEN REGEXP_REPLACE(phone, '\\D', '', 'g') ~ '^9\\d{9}$' THEN '0' || REGEXP_REPLACE(phone, '\\D', '', 'g')
      ELSE NULL
    END AS normalized_phone
  FROM public.users
), audit_rows AS (
  INSERT INTO public.user_phone_normalization_audit (user_id, original_phone, normalized_phone, migration_tag)
  SELECT id, original_phone, normalized_phone, '069_standardize_phone_numbers'
  FROM phone_candidates
  WHERE COALESCE(original_phone, '') <> COALESCE(normalized_phone, '')
  ON CONFLICT (user_id) DO UPDATE SET
    original_phone = EXCLUDED.original_phone,
    normalized_phone = EXCLUDED.normalized_phone,
    migration_tag = EXCLUDED.migration_tag,
    logged_at = NOW()
  RETURNING user_id, normalized_phone
)
UPDATE public.users AS profile
SET phone = audit_rows.normalized_phone,
    updated_at = NOW()
FROM audit_rows
WHERE profile.id = audit_rows.user_id;

UPDATE auth.users AS auth_user
SET raw_user_meta_data =
  CASE
    WHEN profile.phone IS NULL THEN COALESCE(auth_user.raw_user_meta_data, '{}'::jsonb) - 'phone'
    ELSE COALESCE(auth_user.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('phone', profile.phone)
  END
FROM public.users AS profile
WHERE profile.id = auth_user.id
  AND COALESCE(auth_user.raw_user_meta_data ->> 'phone', '') <> COALESCE(profile.phone, '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_phone_mobile_format_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_phone_mobile_format_check
      CHECK (phone IS NULL OR phone ~ '^09\d{9}$');
  END IF;
END;
$$ LANGUAGE plpgsql;