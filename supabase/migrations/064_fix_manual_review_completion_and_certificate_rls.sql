-- Repair RLS for manual assessment review, assessed module completion gating,
-- and trainer/admin manual certificate issuance.

CREATE OR REPLACE FUNCTION public.course_manager_can_manage_course(target_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    public.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = target_course_id
        AND c.instructor_id = public.get_current_user_profile_id()
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
        public.get_user_role() = 'admin'
        OR c.instructor_id = public.get_current_user_profile_id()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.learner_can_self_complete_module(
  target_enrollment_id UUID,
  target_module_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.enrollments e
      WHERE e.id = target_enrollment_id
        AND e.user_id = public.get_current_user_profile_id()
    )
    AND (
      NOT EXISTS (
        SELECT 1
        FROM public.assessments a
        WHERE a.module_id = target_module_id
          AND COALESCE(a.is_active, TRUE)
      )
      OR EXISTS (
        SELECT 1
        FROM public.assessment_attempts aa
        JOIN public.assessments a ON a.id = aa.assessment_id
        WHERE aa.enrollment_id = target_enrollment_id
          AND a.module_id = target_module_id
          AND aa.user_id = public.get_current_user_profile_id()
          AND aa.submitted_at IS NOT NULL
          AND aa.passed = TRUE
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_issue_manual_certificate(
  target_course_id UUID,
  target_user_id UUID,
  target_issued_by UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    public.course_manager_can_manage_course(target_course_id)
    AND (target_issued_by IS NULL OR target_issued_by = public.get_current_user_profile_id())
    AND EXISTS (
      SELECT 1
      FROM public.enrollments e
      WHERE e.course_id = target_course_id
        AND e.user_id = target_user_id
        AND e.completion_approval_status = 'approved'
    );
$$;

DROP POLICY IF EXISTS "Users can view their own attempts" ON public.assessment_attempts;
DROP POLICY IF EXISTS "Users can create their own attempts" ON public.assessment_attempts;
DROP POLICY IF EXISTS "Users can update their own attempts" ON public.assessment_attempts;
DROP POLICY IF EXISTS "Admins can view all assessment attempts" ON public.assessment_attempts;
DROP POLICY IF EXISTS "Course managers can view assessment attempts" ON public.assessment_attempts;
DROP POLICY IF EXISTS "Course managers can update assessment attempts" ON public.assessment_attempts;

CREATE POLICY "Users can view their own attempts" ON public.assessment_attempts
FOR SELECT
TO authenticated
USING (user_id = public.get_current_user_profile_id());

CREATE POLICY "Course managers can view assessment attempts" ON public.assessment_attempts
FOR SELECT
TO authenticated
USING (public.course_manager_can_manage_enrollment(enrollment_id));

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
    JOIN public.modules m ON m.id = a.module_id
    JOIN public.enrollments e ON e.id = assessment_attempts.enrollment_id
    WHERE a.id = assessment_attempts.assessment_id
      AND e.course_id = m.course_id
  )
);

CREATE POLICY "Users can update their own attempts" ON public.assessment_attempts
FOR UPDATE
TO authenticated
USING (user_id = public.get_current_user_profile_id())
WITH CHECK (user_id = public.get_current_user_profile_id());

CREATE POLICY "Course managers can update assessment attempts" ON public.assessment_attempts
FOR UPDATE
TO authenticated
USING (public.course_manager_can_manage_enrollment(enrollment_id))
WITH CHECK (public.course_manager_can_manage_enrollment(enrollment_id));

DROP POLICY IF EXISTS "Users can view answers for their attempts" ON public.assessment_answers;
DROP POLICY IF EXISTS "Users can create answers for their attempts" ON public.assessment_answers;
DROP POLICY IF EXISTS "Course managers can view assessment answers" ON public.assessment_answers;
DROP POLICY IF EXISTS "Course managers can update assessment answers" ON public.assessment_answers;

CREATE POLICY "Users can view answers for their attempts" ON public.assessment_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessment_attempts aa
    WHERE aa.id = assessment_answers.attempt_id
      AND aa.user_id = public.get_current_user_profile_id()
  )
);

CREATE POLICY "Course managers can view assessment answers" ON public.assessment_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessment_attempts aa
    WHERE aa.id = assessment_answers.attempt_id
      AND public.course_manager_can_manage_enrollment(aa.enrollment_id)
  )
);

CREATE POLICY "Users can create answers for their attempts" ON public.assessment_answers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.assessment_attempts aa
    WHERE aa.id = assessment_answers.attempt_id
      AND aa.user_id = public.get_current_user_profile_id()
  )
);

CREATE POLICY "Course managers can update assessment answers" ON public.assessment_answers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessment_attempts aa
    WHERE aa.id = assessment_answers.attempt_id
      AND public.course_manager_can_manage_enrollment(aa.enrollment_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.assessment_attempts aa
    WHERE aa.id = assessment_answers.attempt_id
      AND public.course_manager_can_manage_enrollment(aa.enrollment_id)
  )
);

DROP POLICY IF EXISTS "Users can view own module completions" ON public.module_completions;
DROP POLICY IF EXISTS "Users can create own module completions" ON public.module_completions;
DROP POLICY IF EXISTS "Users can update own module completions" ON public.module_completions;
DROP POLICY IF EXISTS "Trainers can view course module completions" ON public.module_completions;
DROP POLICY IF EXISTS "Course managers can create course module completions" ON public.module_completions;
DROP POLICY IF EXISTS "Course managers can update course module completions" ON public.module_completions;

CREATE POLICY "Users can view own module completions" ON public.module_completions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.id = module_completions.enrollment_id
      AND e.user_id = public.get_current_user_profile_id()
  )
);

CREATE POLICY "Users can create own module completions" ON public.module_completions
FOR INSERT
TO authenticated
WITH CHECK (
  public.learner_can_self_complete_module(enrollment_id, module_id)
);

CREATE POLICY "Users can update own module completions" ON public.module_completions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.id = module_completions.enrollment_id
      AND e.user_id = public.get_current_user_profile_id()
  )
)
WITH CHECK (
  public.learner_can_self_complete_module(enrollment_id, module_id)
);

CREATE POLICY "Course managers can view course module completions" ON public.module_completions
FOR SELECT
TO authenticated
USING (public.course_manager_can_manage_enrollment(enrollment_id));

CREATE POLICY "Course managers can create course module completions" ON public.module_completions
FOR INSERT
TO authenticated
WITH CHECK (public.course_manager_can_manage_enrollment(enrollment_id));

CREATE POLICY "Course managers can update course module completions" ON public.module_completions
FOR UPDATE
TO authenticated
USING (public.course_manager_can_manage_enrollment(enrollment_id))
WITH CHECK (public.course_manager_can_manage_enrollment(enrollment_id));

DROP POLICY IF EXISTS "Users can insert own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Admins and training officers can issue certificates" ON public.certificates;
DROP POLICY IF EXISTS "Admins and training officers can update certificates" ON public.certificates;
DROP POLICY IF EXISTS "Course managers can issue approved certificates" ON public.certificates;
DROP POLICY IF EXISTS "Course managers can update approved certificates" ON public.certificates;

CREATE POLICY "Course managers can issue approved certificates" ON public.certificates
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_issue_manual_certificate(course_id, user_id, issued_by)
);

CREATE POLICY "Course managers can update approved certificates" ON public.certificates
FOR UPDATE
TO authenticated
USING (public.course_manager_can_manage_course(course_id))
WITH CHECK (
  public.can_issue_manual_certificate(course_id, user_id, issued_by)
);