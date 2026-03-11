-- Fix enrollment policies to use the resolved profile id instead of raw auth.uid()
-- and expose aggregate enrollment counts without requiring direct enrollments table access.

DROP POLICY IF EXISTS "Users can view own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Users can enroll in courses" ON public.enrollments;
DROP POLICY IF EXISTS "Users can update own enrollments" ON public.enrollments;

CREATE POLICY "Users can view own enrollments" ON public.enrollments
  FOR SELECT USING (user_id = public.get_current_user_profile_id());

CREATE POLICY "Users can enroll in courses" ON public.enrollments
  FOR INSERT WITH CHECK (user_id = public.get_current_user_profile_id());

CREATE POLICY "Users can update own enrollments" ON public.enrollments
  FOR UPDATE USING (user_id = public.get_current_user_profile_id());

CREATE OR REPLACE FUNCTION public.get_course_enrollment_counts(course_ids uuid[])
RETURNS TABLE(course_id uuid, enrollment_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.course_id,
    COUNT(*)::bigint AS enrollment_count
  FROM public.enrollments e
  WHERE e.course_id = ANY(COALESCE(course_ids, ARRAY[]::uuid[]))
    AND COALESCE(e.status, 'enrolled') <> 'dropped'
  GROUP BY e.course_id;
$$;

REVOKE ALL ON FUNCTION public.get_course_enrollment_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_course_enrollment_counts(uuid[]) TO authenticated, anon, service_role;
