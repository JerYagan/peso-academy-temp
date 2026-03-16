CREATE TABLE IF NOT EXISTS public.practice_quiz_essay_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  block_id text NOT NULL,
  prompt_title text NULL,
  prompt_text text NOT NULL,
  guidance_text text NULL,
  response_text text NOT NULL DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT practice_quiz_essay_responses_unique UNIQUE (enrollment_id, module_id, user_id, block_id)
);

CREATE INDEX IF NOT EXISTS idx_practice_quiz_essay_responses_enrollment
  ON public.practice_quiz_essay_responses(enrollment_id);

CREATE INDEX IF NOT EXISTS idx_practice_quiz_essay_responses_module
  ON public.practice_quiz_essay_responses(module_id);

CREATE INDEX IF NOT EXISTS idx_practice_quiz_essay_responses_user
  ON public.practice_quiz_essay_responses(user_id);

CREATE TABLE IF NOT EXISTS public.practice_quiz_essay_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL UNIQUE REFERENCES public.practice_quiz_essay_responses(id) ON DELETE CASCADE,
  feedback_text text NOT NULL DEFAULT '',
  reviewed_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_practice_quiz_essay_feedback_response
  ON public.practice_quiz_essay_feedback(response_id);

ALTER TABLE public.practice_quiz_essay_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_quiz_essay_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own practice quiz essay responses" ON public.practice_quiz_essay_responses;
CREATE POLICY "Users can view own practice quiz essay responses"
ON public.practice_quiz_essay_responses
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.id = practice_quiz_essay_responses.enrollment_id
      AND e.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own practice quiz essay responses" ON public.practice_quiz_essay_responses;
CREATE POLICY "Users can insert own practice quiz essay responses"
ON public.practice_quiz_essay_responses
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.id = practice_quiz_essay_responses.enrollment_id
      AND e.user_id = auth.uid()
      AND e.course_id = practice_quiz_essay_responses.course_id
  )
);

DROP POLICY IF EXISTS "Users can update own practice quiz essay responses" ON public.practice_quiz_essay_responses;
CREATE POLICY "Users can update own practice quiz essay responses"
ON public.practice_quiz_essay_responses
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.id = practice_quiz_essay_responses.enrollment_id
      AND e.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.id = practice_quiz_essay_responses.enrollment_id
      AND e.user_id = auth.uid()
      AND e.course_id = practice_quiz_essay_responses.course_id
  )
);

DROP POLICY IF EXISTS "Course managers can view practice quiz essay responses" ON public.practice_quiz_essay_responses;
CREATE POLICY "Course managers can view practice quiz essay responses"
ON public.practice_quiz_essay_responses
FOR SELECT TO authenticated
USING (public.course_manager_can_manage_enrollment(enrollment_id));

DROP POLICY IF EXISTS "Users can view own practice quiz essay feedback" ON public.practice_quiz_essay_feedback;
CREATE POLICY "Users can view own practice quiz essay feedback"
ON public.practice_quiz_essay_feedback
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.practice_quiz_essay_responses response
    JOIN public.enrollments e ON e.id = response.enrollment_id
    WHERE response.id = practice_quiz_essay_feedback.response_id
      AND e.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Course managers can view practice quiz essay feedback" ON public.practice_quiz_essay_feedback;
CREATE POLICY "Course managers can view practice quiz essay feedback"
ON public.practice_quiz_essay_feedback
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.practice_quiz_essay_responses response
    WHERE response.id = practice_quiz_essay_feedback.response_id
      AND public.course_manager_can_manage_enrollment(response.enrollment_id)
  )
);

DROP POLICY IF EXISTS "Course managers can insert practice quiz essay feedback" ON public.practice_quiz_essay_feedback;
CREATE POLICY "Course managers can insert practice quiz essay feedback"
ON public.practice_quiz_essay_feedback
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.practice_quiz_essay_responses response
    WHERE response.id = practice_quiz_essay_feedback.response_id
      AND public.course_manager_can_manage_enrollment(response.enrollment_id)
  )
);

DROP POLICY IF EXISTS "Course managers can update practice quiz essay feedback" ON public.practice_quiz_essay_feedback;
CREATE POLICY "Course managers can update practice quiz essay feedback"
ON public.practice_quiz_essay_feedback
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.practice_quiz_essay_responses response
    WHERE response.id = practice_quiz_essay_feedback.response_id
      AND public.course_manager_can_manage_enrollment(response.enrollment_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.practice_quiz_essay_responses response
    WHERE response.id = practice_quiz_essay_feedback.response_id
      AND public.course_manager_can_manage_enrollment(response.enrollment_id)
  )
);