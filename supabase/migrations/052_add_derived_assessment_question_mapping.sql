ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS derived_from_module_quiz BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.assessment_questions
  ADD COLUMN IF NOT EXISTS source_question_key TEXT,
  ADD COLUMN IF NOT EXISTS derived_from_module_quiz BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_assessment_questions_source_question_key
  ON public.assessment_questions(assessment_id, source_question_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_questions_active_source_key_unique
  ON public.assessment_questions(assessment_id, source_question_key)
  WHERE source_question_key IS NOT NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_assessment_questions_active_order
  ON public.assessment_questions(assessment_id, is_active, "order");