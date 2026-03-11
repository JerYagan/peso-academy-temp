-- Run this in Supabase SQL Editor if the migration has not yet been applied.

DROP POLICY IF EXISTS "Users can view own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Users can enroll in courses" ON public.enrollments;
DROP POLICY IF EXISTS "Users can update own enrollments" ON public.enrollments;

CREATE POLICY "Users can view own enrollments" ON public.enrollments
FOR SELECT
TO authenticated
USING (user_id = public.get_current_user_profile_id());

CREATE POLICY "Users can enroll in courses" ON public.enrollments
FOR INSERT
TO authenticated
WITH CHECK (user_id = public.get_current_user_profile_id());

CREATE POLICY "Users can update own enrollments" ON public.enrollments
FOR UPDATE
TO authenticated
USING (user_id = public.get_current_user_profile_id())
WITH CHECK (user_id = public.get_current_user_profile_id());

DROP POLICY IF EXISTS "Course managers can view course enrollments" ON public.enrollments;
CREATE POLICY "Course managers can view course enrollments" ON public.enrollments
FOR SELECT
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'trainer')
);

DROP POLICY IF EXISTS "Course managers can update course enrollments" ON public.enrollments;
CREATE POLICY "Course managers can update course enrollments" ON public.enrollments
FOR UPDATE
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'trainer')
)
WITH CHECK (
  public.get_user_role() IN ('admin', 'trainer')
);

DROP POLICY IF EXISTS "Users can view own certificates" ON public.certificates;
CREATE POLICY "Users can view own certificates" ON public.certificates
FOR SELECT
TO authenticated
USING (user_id = public.get_current_user_profile_id());

DROP POLICY IF EXISTS "Course managers can view all certificates" ON public.certificates;
CREATE POLICY "Course managers can view all certificates" ON public.certificates
FOR SELECT
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'trainer')
);

DROP POLICY IF EXISTS "Users can view their own attempts" ON public.assessment_attempts;
DROP POLICY IF EXISTS "Users can create their own attempts" ON public.assessment_attempts;
DROP POLICY IF EXISTS "Users can update their own attempts" ON public.assessment_attempts;

CREATE POLICY "Users can view their own attempts" ON public.assessment_attempts
FOR SELECT
TO authenticated
USING (user_id = public.get_current_user_profile_id());

CREATE POLICY "Users can create their own attempts" ON public.assessment_attempts
FOR INSERT
TO authenticated
WITH CHECK (user_id = public.get_current_user_profile_id());

CREATE POLICY "Users can update their own attempts" ON public.assessment_attempts
FOR UPDATE
TO authenticated
USING (user_id = public.get_current_user_profile_id())
WITH CHECK (user_id = public.get_current_user_profile_id());

DROP POLICY IF EXISTS "Course managers can view assessment attempts" ON public.assessment_attempts;
CREATE POLICY "Course managers can view assessment attempts" ON public.assessment_attempts
FOR SELECT
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'trainer')
);

DROP POLICY IF EXISTS "Course managers can view module sessions" ON public.module_sessions;
CREATE POLICY "Course managers can view module sessions" ON public.module_sessions
FOR SELECT
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'trainer')
);

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

CREATE OR REPLACE FUNCTION public.get_course_manager_enrollments(
  p_course_ids uuid[] DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  course_id uuid,
  progress integer,
  status text,
  enrolled_at timestamptz,
  completed_at timestamptz,
  certificate_id uuid,
  updated_at timestamptz,
  originating_recommendation_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.user_id,
    e.course_id,
    e.progress,
    e.status,
    e.enrolled_at,
    e.completed_at,
    e.certificate_id,
    e.updated_at,
    e.originating_recommendation_id
  FROM public.enrollments e
  WHERE public.get_user_role() IN ('admin', 'trainer')
    AND (p_course_ids IS NULL OR e.course_id = ANY(p_course_ids))
    AND (p_user_id IS NULL OR e.user_id = p_user_id)
  ORDER BY e.enrolled_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_course_manager_certificates(
  p_course_ids uuid[] DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  course_id uuid,
  issued_at timestamptz,
  certificate_number text,
  certificate_type text,
  verification_code text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.user_id,
    c.course_id,
    c.issued_at,
    c.certificate_number,
    c.certificate_type,
    c.verification_code
  FROM public.certificates c
  WHERE public.get_user_role() IN ('admin', 'trainer')
    AND (p_course_ids IS NULL OR c.course_id = ANY(p_course_ids))
    AND (p_user_id IS NULL OR c.user_id = p_user_id)
  ORDER BY c.issued_at DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.get_course_manager_assessment_attempts(
  p_course_ids uuid[] DEFAULT NULL,
  p_enrollment_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  assessment_id uuid,
  enrollment_id uuid,
  user_id uuid,
  score integer,
  passed boolean,
  submitted_at timestamptz,
  time_spent integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    aa.id,
    aa.assessment_id,
    aa.enrollment_id,
    aa.user_id,
    aa.score,
    aa.passed,
    aa.submitted_at,
    aa.time_spent
  FROM public.assessment_attempts aa
  JOIN public.enrollments e ON e.id = aa.enrollment_id
  WHERE public.get_user_role() IN ('admin', 'trainer')
    AND (p_course_ids IS NULL OR e.course_id = ANY(p_course_ids))
    AND (p_enrollment_ids IS NULL OR aa.enrollment_id = ANY(p_enrollment_ids))
    AND aa.submitted_at IS NOT NULL
  ORDER BY aa.submitted_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_course_enrollment_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_course_enrollment_counts(uuid[]) TO authenticated, anon, service_role;

REVOKE ALL ON FUNCTION public.get_course_manager_enrollments(uuid[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_course_manager_enrollments(uuid[], uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_course_manager_certificates(uuid[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_course_manager_certificates(uuid[], uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_course_manager_assessment_attempts(uuid[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_course_manager_assessment_attempts(uuid[], uuid[]) TO authenticated, service_role;
