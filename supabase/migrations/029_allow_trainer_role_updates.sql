-- Allow admin role-management flows to assign the schema-backed trainer role.
-- This keeps auth metadata and public.users aligned when admins change roles.

CREATE OR REPLACE FUNCTION public.set_user_role_by_id(user_id UUID, user_role TEXT)
RETURNS VOID AS $$
DECLARE
  normalized_role TEXT;
BEGIN
  IF public.get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  normalized_role := LOWER(TRIM(user_role));

  IF normalized_role = 'training_officer' THEN
    normalized_role := 'trainer';
  END IF;

  IF normalized_role NOT IN ('admin', 'trainer', 'validator', 'trainee', 'jobseeker', 'employer', 'spd') THEN
    RAISE EXCEPTION 'Invalid role. Must be one of: admin, trainer, validator, trainee, jobseeker, employer, spd';
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', normalized_role)
  WHERE id = user_id;

  UPDATE public.users
  SET role = normalized_role::public.user_role,
      updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;