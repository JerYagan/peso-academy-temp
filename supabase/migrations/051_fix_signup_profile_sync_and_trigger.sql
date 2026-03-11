-- Ensure auth signups always produce a matching public.users profile
-- under the current three-role model: admin, trainer, trainee.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_role'
  ) THEN
    BEGIN
      ALTER TYPE public.user_role RENAME VALUE 'jobseeker' TO 'trainee';
    EXCEPTION
      WHEN invalid_parameter_value THEN NULL;
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;

    BEGIN
      ALTER TYPE public.user_role RENAME VALUE 'spd' TO 'trainer';
    EXCEPTION
      WHEN invalid_parameter_value THEN NULL;
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;

    BEGIN
      ALTER TYPE public.user_role RENAME VALUE 'validator' TO 'admin';
    EXCEPTION
      WHEN invalid_parameter_value THEN NULL;
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;

    BEGIN
      ALTER TYPE public.user_role RENAME VALUE 'employer' TO 'trainee';
    EXCEPTION
      WHEN invalid_parameter_value THEN NULL;
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;

    BEGIN
      ALTER TYPE public.user_role RENAME VALUE 'training_officer' TO 'trainer';
    EXCEPTION
      WHEN invalid_parameter_value THEN NULL;
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
  END IF;
END $$;

UPDATE public.users
SET role = CASE
  WHEN role::text IN ('jobseeker', 'employer') THEN 'trainee'::public.user_role
  WHEN role::text IN ('spd', 'training_officer') THEN 'trainer'::public.user_role
  WHEN role::text = 'validator' THEN 'admin'::public.user_role
  ELSE role::text::public.user_role
END,
updated_at = NOW()
WHERE role::text IN ('jobseeker', 'employer', 'spd', 'training_officer', 'validator');

UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'role',
    CASE
      WHEN COALESCE(raw_user_meta_data ->> 'role', '') IN ('jobseeker', 'employer') THEN 'trainee'
      WHEN COALESCE(raw_user_meta_data ->> 'role', '') IN ('spd', 'training_officer') THEN 'trainer'
      WHEN COALESCE(raw_user_meta_data ->> 'role', '') = 'validator' THEN 'admin'
      WHEN COALESCE(raw_user_meta_data ->> 'role', '') IN ('admin', 'trainer', 'trainee') THEN raw_user_meta_data ->> 'role'
      ELSE 'trainee'
    END
  )
WHERE COALESCE(raw_user_meta_data ->> 'role', '') NOT IN ('admin', 'trainer', 'trainee');

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
    updated_at = NOW();

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', normalized_role::text)
  WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, anon, authenticated, service_role;

INSERT INTO public.users (
  id,
  email,
  name,
  role,
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
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;
