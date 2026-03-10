-- Normalize legacy jobseeker role usage to trainee and make auth-triggered user creation stable.

DO $$
DECLARE
  role_data_type TEXT;
  role_udt_name TEXT;
  enum_has_jobseeker BOOLEAN := false;
  enum_has_trainee BOOLEAN := false;
BEGIN
  SELECT data_type, udt_name
  INTO role_data_type, role_udt_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'role';

  IF role_data_type = 'USER-DEFINED' AND role_udt_name = 'user_role' THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'user_role'
        AND e.enumlabel = 'jobseeker'
    ) INTO enum_has_jobseeker;

    SELECT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'user_role'
        AND e.enumlabel = 'trainee'
    ) INTO enum_has_trainee;

    IF enum_has_jobseeker AND NOT enum_has_trainee THEN
      EXECUTE 'ALTER TYPE public.user_role RENAME VALUE ''jobseeker'' TO ''trainee''';
    END IF;

    BEGIN
      EXECUTE 'ALTER TABLE public.users ALTER COLUMN role SET DEFAULT ''trainee''';
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
  ELSIF role_data_type IS NOT NULL THEN
    UPDATE public.users
    SET role = 'trainee', updated_at = NOW()
    WHERE role::TEXT = 'jobseeker';

    BEGIN
      EXECUTE 'ALTER TABLE public.users ALTER COLUMN role SET DEFAULT ''trainee''';
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"trainee"'::jsonb,
  true
)
WHERE COALESCE(raw_user_meta_data ->> 'role', '') = 'jobseeker';

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role'
  ) THEN
    SELECT role::TEXT INTO user_role
    FROM public.users
    WHERE id = auth.uid();
  END IF;

  IF user_role IS NULL THEN
    user_role := NULLIF(auth.jwt() -> 'user_metadata' ->> 'role', '');
  END IF;

  IF user_role IS NULL THEN
    SELECT NULLIF(raw_user_meta_data ->> 'role', '') INTO user_role
    FROM auth.users
    WHERE id = auth.uid();
  END IF;

  IF user_role = 'jobseeker' THEN
    user_role := 'trainee';
  ELSIF user_role = 'training_officer' THEN
    user_role := 'trainer';
  END IF;

  RETURN COALESCE(user_role, 'trainee');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

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
  has_role_column BOOLEAN;
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

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role'
  ) INTO has_role_column;

  INSERT INTO public.users (id, email, name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.id::TEXT || '@temp.local'),
    user_name,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    updated_at = NOW();

  IF has_role_column THEN
    EXECUTE format(
      'UPDATE public.users SET role = %L, updated_at = NOW() WHERE id = $1',
      normalized_role
    ) USING NEW.id;
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', normalized_role)
  WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'roles'
  ) THEN
    INSERT INTO public.roles (id, name, description, category, icon, color, dashboard_route, can_signup, metadata)
    VALUES (
      'trainee',
      'Trainee',
      'Access learning materials, assessments, and progress tracking.',
      'end_user',
      'User',
      'gray',
      '/dashboard',
      true,
      '{"level": "basic", "requiresApproval": false}'::jsonb
    )
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
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'role_permissions'
  ) THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT 'trainee', permission_id
    FROM public.role_permissions
    WHERE role_id = 'jobseeker'
    ON CONFLICT DO NOTHING;

    DELETE FROM public.role_permissions
    WHERE role_id = 'jobseeker';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'roles'
  ) THEN
    DELETE FROM public.roles
    WHERE id = 'jobseeker';
  END IF;
END $$;
