ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS prerequisite_module_ids UUID[] NOT NULL DEFAULT '{}';

UPDATE public.assessments AS assessments
SET course_id = modules.course_id
FROM public.modules AS modules
WHERE assessments.module_id = modules.id
  AND assessments.course_id IS NULL;

ALTER TABLE public.assessments
  ALTER COLUMN module_id DROP NOT NULL;

ALTER TABLE public.assessments
  ALTER COLUMN course_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assessments_course_id
  ON public.assessments(course_id);

CREATE INDEX IF NOT EXISTS idx_assessments_prerequisite_module_ids
  ON public.assessments USING GIN(prerequisite_module_ids);

DROP POLICY IF EXISTS "Users can view assessments for enrolled modules" ON public.assessments;
CREATE POLICY "Users can view assessments for enrolled courses" ON public.assessments
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.enrollments
      WHERE enrollments.course_id = assessments.course_id
        AND enrollments.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view questions for accessible assessments" ON public.assessment_questions;
CREATE POLICY "Users can view questions for accessible assessments" ON public.assessment_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.assessments
      JOIN public.enrollments ON enrollments.course_id = assessments.course_id
      WHERE assessments.id = assessment_questions.assessment_id
        AND enrollments.user_id = auth.uid()
    )
  );