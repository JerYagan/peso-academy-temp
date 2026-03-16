CREATE OR REPLACE FUNCTION public.can_manage_trainee_verification()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  resolved_profile_id UUID;
  resolved_role TEXT;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF auth.uid() IS NULL OR auth.role() <> 'authenticated' THEN
    RETURN false;
  END IF;

  resolved_profile_id := public.get_current_user_profile_id();

  SELECT u.role::text
  INTO resolved_role
  FROM public.users u
  WHERE u.id IN (auth.uid(), resolved_profile_id)
  ORDER BY CASE WHEN u.id = resolved_profile_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF resolved_role IN ('admin', 'trainer') THEN
    RETURN true;
  END IF;

  RETURN LOWER(COALESCE((SELECT raw_user_meta_data ->> 'role' FROM auth.users WHERE id = auth.uid()), '')) IN ('admin', 'trainer');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trainees_for_verification()
RETURNS SETOF public.users
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.role() <> 'authenticated') THEN
    RAISE EXCEPTION 'Authentication required to view the trainee verification queue.';
  END IF;

  IF NOT public.can_manage_trainee_verification() THEN
    RAISE EXCEPTION 'You do not have permission to view the trainee verification queue.';
  END IF;

  RETURN QUERY
  SELECT u.*
  FROM public.users u
  WHERE u.role = 'trainee'::public.user_role
  ORDER BY
    CASE COALESCE(u.verification_status, 'pending')
      WHEN 'pending' THEN 0
      WHEN 'rejected' THEN 1
      WHEN 'verified' THEN 2
      ELSE 3
    END,
    COALESCE(u.verification_submitted_at, u.created_at) DESC,
    u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_trainee_verification(
  p_trainee_id UUID,
  p_verification_status TEXT,
  p_verification_notes TEXT DEFAULT NULL
)
RETURNS public.users
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  actor_profile_id UUID;
  normalized_status TEXT;
  updated_row public.users%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.role() <> 'authenticated') THEN
    RAISE EXCEPTION 'Authentication required to update trainee verification.';
  END IF;

  IF NOT public.can_manage_trainee_verification() THEN
    RAISE EXCEPTION 'You do not have permission to update trainee verification.';
  END IF;

  normalized_status := LOWER(TRIM(COALESCE(p_verification_status, '')));

  IF normalized_status NOT IN ('pending', 'verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid verification status: %', p_verification_status;
  END IF;

  actor_profile_id := COALESCE(public.get_current_user_profile_id(), auth.uid());

  UPDATE public.users u
  SET
    verification_status = normalized_status,
    verification_notes = NULLIF(TRIM(COALESCE(p_verification_notes, '')), ''),
    verified_at = CASE WHEN normalized_status = 'verified' THEN NOW() ELSE NULL END,
    verified_by = CASE WHEN normalized_status = 'verified' THEN actor_profile_id ELSE NULL END,
    updated_at = NOW()
  WHERE u.id = p_trainee_id
    AND u.role = 'trainee'::public.user_role
  RETURNING u.* INTO updated_row;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'Trainee not found for verification update.';
  END IF;

  RETURN updated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_role_by_id(user_id UUID, user_role TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_role TEXT;
  target_exists BOOLEAN;
BEGIN
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.role() <> 'authenticated') THEN
    RAISE EXCEPTION 'Authentication required to update user roles.';
  END IF;

  IF auth.role() <> 'service_role' AND public.get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  normalized_role := LOWER(TRIM(user_role));

  IF normalized_role = 'training_officer' OR normalized_role = 'spd' OR normalized_role = 'validator' THEN
    normalized_role := CASE normalized_role
      WHEN 'validator' THEN 'admin'
      ELSE 'trainer'
    END;
  ELSIF normalized_role = 'jobseeker' OR normalized_role = 'employer' THEN
    normalized_role := 'trainee';
  END IF;

  IF normalized_role NOT IN ('admin', 'trainer', 'trainee') THEN
    RAISE EXCEPTION 'Invalid role. Must be one of: admin, trainer, trainee';
  END IF;

  SELECT EXISTS(SELECT 1 FROM auth.users au WHERE au.id = user_id) INTO target_exists;
  IF NOT target_exists THEN
    RAISE EXCEPTION 'Target user not found.';
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', normalized_role)
  WHERE id = user_id;

  UPDATE public.users
  SET role = normalized_role::public.user_role,
      updated_at = NOW()
  WHERE id = user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_account(user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  actor_profile_id UUID;
BEGIN
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.role() <> 'authenticated') THEN
    RAISE EXCEPTION 'Authentication required to delete user accounts.';
  END IF;

  IF auth.role() <> 'service_role' AND public.get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  actor_profile_id := COALESCE(public.get_current_user_profile_id(), auth.uid());

  IF user_id = actor_profile_id OR user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_trainee_verification() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_trainees_for_verification() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_trainee_verification(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_user_role_by_id(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_manage_trainee_verification() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_trainees_for_verification() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_trainee_verification(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_user_role_by_id(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated, service_role;
