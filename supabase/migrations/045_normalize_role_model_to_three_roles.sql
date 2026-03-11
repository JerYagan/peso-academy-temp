-- Normalize the live role model to the three supported runtime roles:
-- admin, trainer, and trainee.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_role' AND n.nspname = 'public'
  ) THEN
    BEGIN
      ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'trainee';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

UPDATE public.users
SET role = CASE role::TEXT
  WHEN 'jobseeker' THEN 'trainee'::public.user_role
  WHEN 'employer' THEN 'trainee'::public.user_role
  WHEN 'spd' THEN 'trainer'::public.user_role
  WHEN 'validator' THEN 'admin'::public.user_role
  ELSE role
END
WHERE role::TEXT IN ('jobseeker', 'employer', 'spd', 'validator');

UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
  'role',
  CASE COALESCE(raw_user_meta_data ->> 'role', '')
    WHEN 'training_officer' THEN 'trainer'
    WHEN 'spd' THEN 'trainer'
    WHEN 'validator' THEN 'admin'
    WHEN 'jobseeker' THEN 'trainee'
    WHEN 'employer' THEN 'trainee'
    ELSE COALESCE(NULLIF(raw_user_meta_data ->> 'role', ''), 'trainee')
  END
),
updated_at = NOW()
WHERE COALESCE(raw_user_meta_data ->> 'role', '') IN ('training_officer', 'spd', 'validator', 'jobseeker', 'employer')
   OR raw_user_meta_data ->> 'role' IS NULL;

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
  'role',
  CASE COALESCE(raw_app_meta_data ->> 'role', '')
    WHEN 'training_officer' THEN 'trainer'
    WHEN 'spd' THEN 'trainer'
    WHEN 'validator' THEN 'admin'
    WHEN 'jobseeker' THEN 'trainee'
    WHEN 'employer' THEN 'trainee'
    ELSE COALESCE(NULLIF(raw_app_meta_data ->> 'role', ''), raw_user_meta_data ->> 'role', 'trainee')
  END
),
updated_at = NOW()
WHERE COALESCE(raw_app_meta_data ->> 'role', '') IN ('training_officer', 'spd', 'validator', 'jobseeker', 'employer')
   OR raw_app_meta_data ->> 'role' IS NULL;

INSERT INTO public.roles (id, name, description, category, icon, color, dashboard_route, can_signup, metadata)
VALUES
  ('admin', 'Administrator', 'Full system access and management capabilities', 'internal', 'Shield', 'red', '/admin/dashboard', false, '{"level": "highest", "requiresApproval": true}'::jsonb),
  ('trainer', 'Trainer', 'Create courses, manage content, and track learner progress', 'internal', 'GraduationCap', 'green', '/trainer/dashboard', false, '{"level": "moderate", "requiresApproval": true}'::jsonb),
  ('trainee', 'Trainee', 'Access learning materials and complete training courses', 'end_user', 'User', 'gray', '/dashboard', true, '{"level": "basic", "requiresApproval": false}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  dashboard_route = EXCLUDED.dashboard_route,
  can_signup = EXCLUDED.can_signup,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT
  CASE
    WHEN role_id IN ('training_officer', 'spd') THEN 'trainer'
    WHEN role_id = 'validator' THEN 'admin'
    WHEN role_id IN ('jobseeker', 'employer') THEN 'trainee'
    ELSE role_id
  END AS role_id,
  permission_id
FROM public.role_permissions
WHERE role_id IN ('training_officer', 'spd', 'validator', 'jobseeker', 'employer')
ON CONFLICT (role_id, permission_id) DO NOTHING;

DELETE FROM public.role_permissions
WHERE role_id IN ('training_officer', 'spd', 'validator', 'jobseeker', 'employer');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'admin', permission_id
FROM public.role_permissions
WHERE role_id = 'trainer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

DELETE FROM public.role_permissions
WHERE role_id NOT IN ('admin', 'trainer', 'trainee');

DELETE FROM public.roles
WHERE id NOT IN ('admin', 'trainer', 'trainee');

DO $$
DECLARE
  role_alias_constraint TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'role_aliases'
  ) THEN
    SELECT con.conname
    INTO role_alias_constraint
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'role_aliases'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%role_code%';

    IF role_alias_constraint IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.role_aliases DROP CONSTRAINT %I', role_alias_constraint);
    END IF;

    DELETE FROM public.role_aliases;

    INSERT INTO public.role_aliases (role_code, display_name, description)
    VALUES
      ('admin', 'Administrator', 'Full system access and management capabilities'),
      ('trainer', 'Trainer', 'Creates and manages training content and supports learners'),
      ('trainee', 'Trainee', 'Accesses learning, assessment, and progress modules only')
    ON CONFLICT (role_code) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      description = EXCLUDED.description,
      updated_at = NOW();

    ALTER TABLE public.role_aliases
      ADD CONSTRAINT role_aliases_role_code_check
      CHECK (role_code IN ('admin', 'trainer', 'trainee'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
  profile_id UUID;
BEGIN
  profile_id := public.get_current_user_profile_id();

  IF profile_id IS NOT NULL THEN
    SELECT role::TEXT INTO user_role
    FROM public.users
    WHERE id = profile_id;
  END IF;

  IF user_role IS NULL OR user_role = '' THEN
    user_role := NULLIF(auth.jwt() -> 'user_metadata' ->> 'role', '');
  END IF;

  IF user_role IS NULL OR user_role = '' THEN
    SELECT NULLIF(raw_user_meta_data ->> 'role', '') INTO user_role
    FROM auth.users
    WHERE id = auth.uid();
  END IF;

  RETURN CASE COALESCE(user_role, 'trainee')
    WHEN 'training_officer' THEN 'trainer'
    WHEN 'spd' THEN 'trainer'
    WHEN 'validator' THEN 'admin'
    WHEN 'jobseeker' THEN 'trainee'
    WHEN 'employer' THEN 'trainee'
    ELSE COALESCE(user_role, 'trainee')
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;