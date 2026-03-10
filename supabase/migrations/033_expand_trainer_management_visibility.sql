-- Expand trainer/SPD/training officer visibility for course management screens.
-- This avoids empty trainer portals when legacy course ownership is inconsistent.

DROP POLICY IF EXISTS "Course managers can update courses" ON public.courses;
DROP POLICY IF EXISTS "Course managers can delete courses" ON public.courses;
DROP POLICY IF EXISTS "Course managers can manage modules" ON public.modules;
DROP POLICY IF EXISTS "Course managers can view course enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Course managers can update course enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Course managers can view enrolled learners" ON public.users;

CREATE POLICY "Course managers can update courses" ON public.courses
FOR UPDATE
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
)
WITH CHECK (
  public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
);

CREATE POLICY "Course managers can delete courses" ON public.courses
FOR DELETE
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
);

CREATE POLICY "Course managers can manage modules" ON public.modules
FOR ALL
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
)
WITH CHECK (
  public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
);

CREATE POLICY "Course managers can view course enrollments" ON public.enrollments
FOR SELECT
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
);

CREATE POLICY "Course managers can update course enrollments" ON public.enrollments
FOR UPDATE
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
)
WITH CHECK (
  public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
);

CREATE POLICY "Course managers can view enrolled learners" ON public.users
FOR SELECT
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
  OR id = auth.uid()
  OR id = public.get_current_user_profile_id()
);
