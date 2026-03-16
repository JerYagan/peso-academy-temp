ALTER TABLE public.module_completions
ADD COLUMN IF NOT EXISTS practice_quiz_snapshot jsonb NULL;

COMMENT ON COLUMN public.module_completions.practice_quiz_snapshot IS
'Stores the learner''s formative practice quiz summary, objective answers, and essay-response snapshot captured when the module is completed. This remains separate from graded assessments, course completion approval, and certificate eligibility.';