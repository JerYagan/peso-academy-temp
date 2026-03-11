-- Remove trainer-specific course ownership restrictions.
-- Trainers, SPDs, training officers, and admins can manage all courses,
-- modules, enrollments, and trainer session views without instructor scoping.

DROP POLICY IF EXISTS "Course managers can create courses" ON public.courses;
DROP POLICY IF EXISTS "Course managers can update courses" ON public.courses;
DROP POLICY IF EXISTS "Course managers can delete courses" ON public.courses;
DROP POLICY IF EXISTS "Course managers can manage modules" ON public.modules;
DROP POLICY IF EXISTS "Course managers can view course enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Course managers can update course enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Course managers can view enrolled learners" ON public.users;
DROP POLICY IF EXISTS "Course managers can view module sessions" ON public.module_sessions;

CREATE POLICY "Course managers can create courses" ON public.courses
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
  AND instructor_id IS NOT NULL
);

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

CREATE OR REPLACE FUNCTION public.get_trainer_accessible_module_sessions(
  p_learner_id UUID DEFAULT NULL,
  p_course_id UUID DEFAULT NULL
)
RETURNS SETOF public.module_sessions AS $$
  SELECT ms.*
  FROM public.module_sessions ms
  JOIN public.enrollments e
    ON e.id = ms.enrollment_id
   AND e.user_id = ms.user_id
   AND e.course_id = ms.course_id
  JOIN public.courses c
    ON c.id = ms.course_id
   AND c.id = e.course_id
  WHERE public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
    AND (p_learner_id IS NULL OR ms.user_id = p_learner_id)
    AND (p_course_id IS NULL OR ms.course_id = p_course_id)
  ORDER BY ms.last_seen_at DESC;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_trainer_accessible_module_sessions(UUID, UUID) TO authenticated, service_role;

CREATE POLICY "Course managers can view module sessions" ON public.module_sessions
FOR SELECT
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
);