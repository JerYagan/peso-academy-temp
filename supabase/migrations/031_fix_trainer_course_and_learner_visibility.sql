-- Resolve trainer ownership through the application profile row, not only auth.uid().
-- This fixes empty trainer courses/learners when a seeded auth user and public.users row drifted.

CREATE OR REPLACE FUNCTION public.get_current_user_profile_id()
RETURNS UUID AS $$
DECLARE
  profile_id UUID;
  auth_email TEXT;
BEGIN
  SELECT id INTO profile_id
  FROM public.users
  WHERE id = auth.uid();

  IF profile_id IS NOT NULL THEN
    RETURN profile_id;
  END IF;

  SELECT email INTO auth_email
  FROM auth.users
  WHERE id = auth.uid();

  IF auth_email IS NULL OR auth_email = '' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO profile_id
  FROM public.users
  WHERE lower(email) = lower(auth_email)
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

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

  IF user_role = 'jobseeker' THEN
    user_role := 'trainee';
  ELSIF user_role = 'training_officer' THEN
    user_role := 'trainer';
  END IF;

  RETURN COALESCE(user_role, 'trainee');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Course managers can create courses" ON public.courses;
DROP POLICY IF EXISTS "Course managers can update courses" ON public.courses;
DROP POLICY IF EXISTS "Admins can delete courses" ON public.courses;
DROP POLICY IF EXISTS "Course managers can delete courses" ON public.courses;

CREATE POLICY "Course managers can create courses" ON public.courses
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.get_user_role() = 'admin'
    AND instructor_id IS NOT NULL
  )
  OR (
    public.get_user_role() IN ('trainer', 'spd', 'training_officer')
    AND instructor_id = public.get_current_user_profile_id()
  )
);

CREATE POLICY "Course managers can update courses" ON public.courses
FOR UPDATE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR instructor_id = public.get_current_user_profile_id()
)
WITH CHECK (
  public.get_user_role() = 'admin'
  OR instructor_id = public.get_current_user_profile_id()
);

CREATE POLICY "Course managers can delete courses" ON public.courses
FOR DELETE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR instructor_id = public.get_current_user_profile_id()
);

DROP POLICY IF EXISTS "Training officers and admins can manage modules" ON public.modules;
DROP POLICY IF EXISTS "Course managers can manage modules" ON public.modules;

CREATE POLICY "Course managers can manage modules" ON public.modules
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses
    WHERE courses.id = modules.course_id
      AND (
        public.get_user_role() = 'admin'
        OR courses.instructor_id = public.get_current_user_profile_id()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.courses
    WHERE courses.id = modules.course_id
      AND (
        public.get_user_role() = 'admin'
        OR courses.instructor_id = public.get_current_user_profile_id()
      )
  )
);

DROP POLICY IF EXISTS "Admins can view all enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Trainers can view course enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Trainers can update course enrollments" ON public.enrollments;

CREATE POLICY "Admins can view all enrollments" ON public.enrollments
FOR SELECT
TO authenticated
USING (public.get_user_role() = 'admin');

CREATE POLICY "Course managers can view course enrollments" ON public.enrollments
FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.courses
    WHERE courses.id = enrollments.course_id
      AND courses.instructor_id = public.get_current_user_profile_id()
  )
);

CREATE POLICY "Course managers can update course enrollments" ON public.enrollments
FOR UPDATE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.courses
    WHERE courses.id = enrollments.course_id
      AND courses.instructor_id = public.get_current_user_profile_id()
  )
)
WITH CHECK (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.courses
    WHERE courses.id = enrollments.course_id
      AND courses.instructor_id = public.get_current_user_profile_id()
  )
);

DROP POLICY IF EXISTS "Trainers can view enrolled learners" ON public.users;
DROP POLICY IF EXISTS "Course managers can view enrolled learners" ON public.users;

CREATE POLICY "Course managers can view enrolled learners" ON public.users
FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.courses c ON e.course_id = c.id
    WHERE e.user_id = users.id
      AND c.instructor_id = public.get_current_user_profile_id()
  )
);
