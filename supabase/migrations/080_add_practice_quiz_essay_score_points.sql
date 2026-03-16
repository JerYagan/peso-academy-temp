ALTER TABLE public.practice_quiz_essay_feedback
ADD COLUMN IF NOT EXISTS score_points numeric(10,2) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'practice_quiz_essay_feedback_score_points_non_negative'
  ) THEN
    ALTER TABLE public.practice_quiz_essay_feedback
    ADD CONSTRAINT practice_quiz_essay_feedback_score_points_non_negative
    CHECK (score_points IS NULL OR score_points >= 0);
  END IF;
END $$;