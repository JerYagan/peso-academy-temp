ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS trainee_type TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS employee_id TEXT,
  ADD COLUMN IF NOT EXISTS physical_id TEXT,
  ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_modal_seen_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_trainee_type_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_trainee_type_check
      CHECK (
        trainee_type IS NULL OR trainee_type IN ('peso_client', 'peso_employee')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_verification_status_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_verification_status_check
      CHECK (
        verification_status IN ('pending', 'verified', 'rejected')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_verified_by_fkey'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_verified_by_fkey
      FOREIGN KEY (verified_by)
      REFERENCES public.users (id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.users
SET
  trainee_type = CASE
    WHEN trainee_type IS NOT NULL THEN trainee_type
    WHEN role::text = 'trainee' THEN 'peso_client'
    ELSE NULL
  END,
  verification_status = 'verified',
  verification_submitted_at = CASE
    WHEN verification_submitted_at IS NOT NULL THEN verification_submitted_at
    WHEN role::text = 'trainee' THEN COALESCE(created_at, NOW())
    ELSE NULL
  END,
  verified_at = CASE
    WHEN verified_at IS NOT NULL THEN verified_at
    ELSE COALESCE(updated_at, created_at, NOW())
  END,
  updated_at = NOW()
WHERE role::text IN ('trainee', 'trainer', 'admin');

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view public system settings" ON public.system_settings;
CREATE POLICY "Public can view public system settings" ON public.system_settings
  FOR SELECT
  USING (is_public = TRUE OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert system settings" ON public.system_settings;
CREATE POLICY "Admins can insert system settings" ON public.system_settings
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update system settings" ON public.system_settings;
CREATE POLICY "Admins can update system settings" ON public.system_settings
  FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete system settings" ON public.system_settings;
CREATE POLICY "Admins can delete system settings" ON public.system_settings
  FOR DELETE
  USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;

INSERT INTO public.system_settings (key, value_json, description, is_public)
VALUES (
  'employee_registration_allowed_domains',
  '[]'::jsonb,
  'Allowed email domains for PESO employee self-registration.',
  TRUE
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  raw_role TEXT;
  normalized_role public.user_role := 'trainee'::public.user_role;
  user_name TEXT;
  user_email TEXT;
  normalized_trainee_type TEXT;
  normalized_verification_status TEXT;
BEGIN
  raw_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'role', 'trainee')));

  IF raw_role IN ('', 'jobseeker', 'learner', 'student', 'employer') THEN
    normalized_role := 'trainee'::public.user_role;
  ELSIF raw_role IN ('training_officer', 'spd') THEN
    normalized_role := 'trainer'::public.user_role;
  ELSIF raw_role = 'validator' THEN
    normalized_role := 'admin'::public.user_role;
  ELSIF raw_role IN ('admin', 'trainer', 'trainee') THEN
    normalized_role := raw_role::public.user_role;
  ELSE
    normalized_role := 'trainee'::public.user_role;
  END IF;

  user_email := COALESCE(NULLIF(TRIM(COALESCE(NEW.email, '')), ''), NEW.id::text || '@temp.local');
  user_name := COALESCE(
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'name', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), ''),
    NULLIF(SPLIT_PART(user_email, '@', 1), ''),
    'User'
  );

  normalized_trainee_type := CASE
    WHEN normalized_role <> 'trainee'::public.user_role THEN NULL
    WHEN LOWER(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'trainee_type', ''))) IN ('peso_client', 'peso_employee')
      THEN LOWER(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'trainee_type', '')))
    ELSE 'peso_client'
  END;

  normalized_verification_status := CASE
    WHEN normalized_role <> 'trainee'::public.user_role THEN 'verified'
    WHEN LOWER(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'verification_status', ''))) IN ('pending', 'verified', 'rejected')
      THEN LOWER(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'verification_status', '')))
    ELSE 'pending'
  END;

  INSERT INTO public.users (
    id,
    email,
    name,
    role,
    phone,
    address,
    date_of_birth,
    gender,
    civil_status,
    employment_status,
    occupation,
    education_level,
    barangay,
    city_municipality,
    province,
    postal_code,
    industry_interests,
    preferred_categories,
    onboarding_skill_level,
    skills,
    trainee_type,
    verification_status,
    employee_id,
    physical_id,
    verification_submitted_at,
    verified_at,
    verified_by,
    verification_notes,
    onboarding_modal_seen_at,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    user_email,
    user_name,
    normalized_role,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'address', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'date_of_birth', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'gender', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'civil_status', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'employment_status', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'occupation', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'education_level', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'barangay', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'city_municipality', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'province', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'postal_code', '')), ''),
    COALESCE((SELECT array_agg(value::text) FROM jsonb_array_elements_text(COALESCE(NEW.raw_user_meta_data -> 'industry_interests', '[]'::jsonb)) AS value), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(value::text) FROM jsonb_array_elements_text(COALESCE(NEW.raw_user_meta_data -> 'preferred_categories', '[]'::jsonb)) AS value), ARRAY[]::text[]),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'onboarding_skill_level', '')), ''),
    COALESCE((SELECT array_agg(value::text) FROM jsonb_array_elements_text(COALESCE(NEW.raw_user_meta_data -> 'skills', '[]'::jsonb)) AS value), ARRAY[]::text[]),
    normalized_trainee_type,
    normalized_verification_status,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'employee_id', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'physical_id', '')), ''),
    CASE
      WHEN normalized_role = 'trainee'::public.user_role THEN COALESCE(NEW.created_at, NOW())
      ELSE NULL
    END,
    CASE
      WHEN normalized_verification_status = 'verified' THEN COALESCE(NEW.created_at, NOW())
      ELSE NULL
    END,
    NULL,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'verification_notes', '')), ''),
    NULL,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(NULLIF(EXCLUDED.name, ''), public.users.name),
    role = EXCLUDED.role,
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    address = COALESCE(EXCLUDED.address, public.users.address),
    date_of_birth = COALESCE(EXCLUDED.date_of_birth, public.users.date_of_birth),
    gender = COALESCE(EXCLUDED.gender, public.users.gender),
    civil_status = COALESCE(EXCLUDED.civil_status, public.users.civil_status),
    employment_status = COALESCE(EXCLUDED.employment_status, public.users.employment_status),
    occupation = COALESCE(EXCLUDED.occupation, public.users.occupation),
    education_level = COALESCE(EXCLUDED.education_level, public.users.education_level),
    barangay = COALESCE(EXCLUDED.barangay, public.users.barangay),
    city_municipality = COALESCE(EXCLUDED.city_municipality, public.users.city_municipality),
    province = COALESCE(EXCLUDED.province, public.users.province),
    postal_code = COALESCE(EXCLUDED.postal_code, public.users.postal_code),
    industry_interests = CASE
      WHEN COALESCE(array_length(EXCLUDED.industry_interests, 1), 0) > 0 THEN EXCLUDED.industry_interests
      ELSE public.users.industry_interests
    END,
    preferred_categories = CASE
      WHEN COALESCE(array_length(EXCLUDED.preferred_categories, 1), 0) > 0 THEN EXCLUDED.preferred_categories
      ELSE public.users.preferred_categories
    END,
    onboarding_skill_level = COALESCE(EXCLUDED.onboarding_skill_level, public.users.onboarding_skill_level),
    skills = CASE
      WHEN COALESCE(array_length(EXCLUDED.skills, 1), 0) > 0 THEN EXCLUDED.skills
      ELSE public.users.skills
    END,
    trainee_type = COALESCE(EXCLUDED.trainee_type, public.users.trainee_type),
    verification_status = COALESCE(EXCLUDED.verification_status, public.users.verification_status),
    employee_id = COALESCE(EXCLUDED.employee_id, public.users.employee_id),
    physical_id = COALESCE(EXCLUDED.physical_id, public.users.physical_id),
    verification_submitted_at = COALESCE(EXCLUDED.verification_submitted_at, public.users.verification_submitted_at),
    verified_at = COALESCE(EXCLUDED.verified_at, public.users.verified_at),
    verified_by = COALESCE(EXCLUDED.verified_by, public.users.verified_by),
    verification_notes = COALESCE(EXCLUDED.verification_notes, public.users.verification_notes),
    onboarding_modal_seen_at = COALESCE(EXCLUDED.onboarding_modal_seen_at, public.users.onboarding_modal_seen_at),
    updated_at = NOW();

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'role', normalized_role::text,
      'trainee_type', normalized_trainee_type,
      'verification_status', normalized_verification_status
    )
  WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

INSERT INTO public.users (
  id,
  email,
  name,
  role,
  trainee_type,
  verification_status,
  verification_submitted_at,
  verified_at,
  created_at,
  updated_at
)
SELECT
  au.id,
  COALESCE(NULLIF(TRIM(COALESCE(au.email, '')), ''), au.id::text || '@temp.local'),
  COALESCE(
    NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'name', '')), ''),
    NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'full_name', '')), ''),
    NULLIF(SPLIT_PART(COALESCE(au.email, ''), '@', 1), ''),
    'User'
  ),
  CASE
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'role', ''))) IN ('admin', 'trainer', 'trainee') THEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'role', '')))::public.user_role
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'role', ''))) IN ('spd', 'training_officer') THEN 'trainer'::public.user_role
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'role', ''))) = 'validator' THEN 'admin'::public.user_role
    ELSE 'trainee'::public.user_role
  END,
  CASE
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'role', 'trainee'))) = 'trainee'
      AND LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'trainee_type', ''))) IN ('peso_client', 'peso_employee')
      THEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'trainee_type', '')))
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'role', 'trainee'))) = 'trainee'
      THEN 'peso_client'
    ELSE NULL
  END,
  CASE
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'role', 'trainee'))) = 'trainee' THEN 'verified'
    ELSE 'verified'
  END,
  CASE
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'role', 'trainee'))) = 'trainee' THEN COALESCE(au.created_at, NOW())
    ELSE NULL
  END,
  CASE
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'role', 'trainee'))) = 'trainee' THEN COALESCE(au.created_at, NOW())
    ELSE COALESCE(au.created_at, NOW())
  END,
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;