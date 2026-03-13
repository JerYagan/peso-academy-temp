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

GRANT EXECUTE ON FUNCTION public.can_manage_trainee_verification() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_trainees_for_verification()
RETURNS SETOF public.users
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
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

GRANT EXECUTE ON FUNCTION public.get_trainees_for_verification() TO authenticated, service_role;

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

GRANT EXECUTE ON FUNCTION public.update_trainee_verification(UUID, TEXT, TEXT) TO authenticated, service_role;