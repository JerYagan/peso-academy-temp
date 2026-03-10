ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS civil_status TEXT,
  ADD COLUMN IF NOT EXISTS employment_status TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS education_level TEXT,
  ADD COLUMN IF NOT EXISTS barangay TEXT,
  ADD COLUMN IF NOT EXISTS city_municipality TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_gender_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_gender_check
      CHECK (
        gender IS NULL OR gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say', 'other')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_civil_status_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_civil_status_check
      CHECK (
        civil_status IS NULL OR civil_status IN ('single', 'married', 'widowed', 'separated', 'divorced', 'annulled', 'prefer_not_to_say')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_employment_status_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_employment_status_check
      CHECK (
        employment_status IS NULL OR employment_status IN ('employed', 'unemployed', 'self_employed', 'student', 'underemployed', 'not_applicable', 'prefer_not_to_say')
      );
  END IF;
END $$;

UPDATE public.users AS profile
SET
  date_of_birth = COALESCE(profile.date_of_birth, NULLIF(auth_user.raw_user_meta_data ->> 'date_of_birth', '')::date),
  gender = COALESCE(profile.gender, NULLIF(auth_user.raw_user_meta_data ->> 'gender', '')),
  civil_status = COALESCE(profile.civil_status, NULLIF(auth_user.raw_user_meta_data ->> 'civil_status', '')),
  employment_status = COALESCE(profile.employment_status, NULLIF(auth_user.raw_user_meta_data ->> 'employment_status', '')),
  occupation = COALESCE(profile.occupation, NULLIF(auth_user.raw_user_meta_data ->> 'occupation', '')),
  education_level = COALESCE(profile.education_level, NULLIF(auth_user.raw_user_meta_data ->> 'education_level', '')),
  barangay = COALESCE(profile.barangay, NULLIF(auth_user.raw_user_meta_data ->> 'barangay', '')),
  city_municipality = COALESCE(profile.city_municipality, NULLIF(auth_user.raw_user_meta_data ->> 'city_municipality', '')),
  province = COALESCE(profile.province, NULLIF(auth_user.raw_user_meta_data ->> 'province', '')),
  postal_code = COALESCE(profile.postal_code, NULLIF(auth_user.raw_user_meta_data ->> 'postal_code', '')),
  updated_at = NOW()
FROM auth.users AS auth_user
WHERE auth_user.id = profile.id;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  raw_role TEXT;
  normalized_role TEXT := 'trainee';
  user_name TEXT;
BEGIN
  raw_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'role', 'trainee')));

  IF raw_role IN ('', 'jobseeker', 'learner', 'student') THEN
    normalized_role := 'trainee';
  ELSIF raw_role = 'training_officer' THEN
    normalized_role := 'trainer';
  ELSE
    normalized_role := raw_role;
  END IF;

  user_name := COALESCE(
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'name', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), ''),
    NULLIF(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), ''),
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
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.id::TEXT || '@temp.local'),
    user_name,
    normalized_role,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'address', '')), ''),
    NULLIF(NEW.raw_user_meta_data ->> 'date_of_birth', '')::date,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'gender', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'civil_status', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'employment_status', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'occupation', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'education_level', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'barangay', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'city_municipality', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'province', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'postal_code', '')), ''),
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    role = COALESCE(EXCLUDED.role, public.users.role),
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
    updated_at = NOW();

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role', normalized_role,
    'name', user_name
  )
  WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;