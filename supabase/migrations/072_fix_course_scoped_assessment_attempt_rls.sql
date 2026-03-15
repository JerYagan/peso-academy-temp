DROP POLICY IF EXISTS "Users can create their own attempts" ON public.assessment_attempts;

CREATE POLICY "Users can create their own attempts" ON public.assessment_attempts
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_current_user_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.id = assessment_attempts.enrollment_id
      AND e.user_id = public.get_current_user_profile_id()
  )
  AND EXISTS (
    SELECT 1
    FROM public.assessments a
    JOIN public.enrollments e ON e.id = assessment_attempts.enrollment_id
    WHERE a.id = assessment_attempts.assessment_id
      AND e.course_id = a.course_id
  )
);