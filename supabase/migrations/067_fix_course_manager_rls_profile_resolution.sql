-- Ensure trainer/admin review and manual module completion checks work when
-- course ownership is stored as either a profile id or auth user id.

CREATE OR REPLACE FUNCTION public.course_manager_can_manage_course(target_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = target_course_id
        AND c.instructor_id = ANY(
          ARRAY[
            public.get_current_user_profile_id(),
            auth.uid()
          ]::UUID[]
        )
    ),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.course_manager_can_manage_enrollment(target_enrollment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.courses c ON c.id = e.course_id
    WHERE e.id = target_enrollment_id
      AND (
        public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
        OR c.instructor_id = ANY(
          ARRAY[
            public.get_current_user_profile_id(),
            auth.uid()
          ]::UUID[]
        )
      )
  );
$$;