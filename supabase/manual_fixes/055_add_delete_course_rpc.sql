-- Run this in Supabase SQL Editor if migration 055 has not yet been applied.
-- This gives course managers a privileged delete path that bypasses stale RLS
-- policy drift while still enforcing the app's role checks.

CREATE OR REPLACE FUNCTION public.delete_course(p_course_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.get_user_role() NOT IN ('admin', 'trainer', 'spd', 'training_officer') THEN
    RAISE EXCEPTION 'Only course managers can delete courses';
  END IF;

  DELETE FROM public.courses
  WHERE id = p_course_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_course(UUID) TO authenticated, service_role;