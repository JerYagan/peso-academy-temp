DROP POLICY IF EXISTS "Admins can view all certificates" ON public.certificates;
CREATE POLICY "Admins can view all certificates" ON public.certificates
FOR SELECT
USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Course managers can view all certificates" ON public.certificates;
CREATE POLICY "Course managers can view all certificates" ON public.certificates
FOR SELECT
USING (public.phase1_is_course_manager());

DROP POLICY IF EXISTS "Admins can view all assessment attempts" ON public.assessment_attempts;
CREATE POLICY "Admins can view all assessment attempts" ON public.assessment_attempts
FOR SELECT
USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Course managers can view assessment attempts" ON public.assessment_attempts;
CREATE POLICY "Course managers can view assessment attempts" ON public.assessment_attempts
FOR SELECT
USING (
  public.phase1_is_course_manager()
  AND EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.courses c ON c.id = e.course_id
    WHERE e.id = assessment_attempts.enrollment_id
  )
);
