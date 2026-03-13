-- Restore the auth->public.users signup trigger after the trainee verification
-- foundation migration updated the function without reattaching the trigger.

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

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
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'phone', '')), ''),
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'address', '')), ''),
  CASE
    WHEN NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'date_of_birth', '')), '') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'date_of_birth', '')), '')::date
    ELSE NULL
  END,
  CASE
    WHEN NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'gender', '')), '') IN ('male', 'female', 'non_binary', 'prefer_not_to_say', 'other')
      THEN NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'gender', '')), '')
    ELSE NULL
  END,
  CASE
    WHEN NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'civil_status', '')), '') IN ('single', 'married', 'widowed', 'separated', 'divorced', 'annulled', 'prefer_not_to_say')
      THEN NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'civil_status', '')), '')
    ELSE NULL
  END,
  CASE
    WHEN NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'employment_status', '')), '') IN ('employed', 'unemployed', 'self_employed', 'student', 'underemployed', 'not_applicable', 'prefer_not_to_say')
      THEN NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'employment_status', '')), '')
    ELSE NULL
  END,
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'occupation', '')), ''),
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'education_level', '')), ''),
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'barangay', '')), ''),
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'city_municipality', '')), ''),
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'province', '')), ''),
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'postal_code', '')), ''),
  COALESCE((SELECT array_agg(value::text) FROM jsonb_array_elements_text(COALESCE(au.raw_user_meta_data -> 'industry_interests', '[]'::jsonb)) AS value), ARRAY[]::text[]),
  COALESCE((SELECT array_agg(value::text) FROM jsonb_array_elements_text(COALESCE(au.raw_user_meta_data -> 'preferred_categories', '[]'::jsonb)) AS value), ARRAY[]::text[]),
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'onboarding_skill_level', '')), ''),
  COALESCE((SELECT array_agg(value::text) FROM jsonb_array_elements_text(COALESCE(au.raw_user_meta_data -> 'skills', '[]'::jsonb)) AS value), ARRAY[]::text[]),
  CASE
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'role', 'trainee'))) <> 'trainee' THEN NULL
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'trainee_type', ''))) IN ('peso_client', 'peso_employee') THEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'trainee_type', '')))
    ELSE 'peso_client'
  END,
  CASE
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'role', 'trainee'))) <> 'trainee' THEN 'verified'
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'verification_status', ''))) IN ('pending', 'verified', 'rejected') THEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'verification_status', '')))
    ELSE 'pending'
  END,
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'employee_id', '')), ''),
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'physical_id', '')), ''),
  CASE
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'role', 'trainee'))) = 'trainee' THEN COALESCE(au.created_at, NOW())
    ELSE NULL
  END,
  CASE
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'verification_status', ''))) = 'verified' THEN COALESCE(au.created_at, NOW())
    WHEN LOWER(TRIM(COALESCE(au.raw_user_meta_data ->> 'role', 'trainee'))) <> 'trainee' THEN COALESCE(au.created_at, NOW())
    ELSE NULL
  END,
  NULL,
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data ->> 'verification_notes', '')), ''),
  NULL,
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;