ALTER TABLE public.assessment_attempts
  ADD COLUMN IF NOT EXISTS review_status TEXT,
  ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_feedback TEXT;

ALTER TABLE public.assessment_answers
  ADD COLUMN IF NOT EXISTS review_status TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

UPDATE public.assessment_attempts
SET
  review_status = CASE
    WHEN submitted_at IS NOT NULL THEN 'approved'
    ELSE NULL
  END,
  requires_manual_review = COALESCE(requires_manual_review, false)
WHERE review_status IS NULL;

UPDATE public.assessment_answers
SET review_status = CASE
  WHEN is_correct IS NULL THEN 'submitted'
  ELSE 'approved'
END
WHERE review_status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assessment_attempts_review_status_check'
  ) THEN
    ALTER TABLE public.assessment_attempts
      ADD CONSTRAINT assessment_attempts_review_status_check
      CHECK (
        review_status IS NULL OR review_status IN ('submitted', 'under_review', 'needs_revision', 'approved')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assessment_answers_review_status_check'
  ) THEN
    ALTER TABLE public.assessment_answers
      ADD CONSTRAINT assessment_answers_review_status_check
      CHECK (
        review_status IS NULL OR review_status IN ('submitted', 'under_review', 'needs_revision', 'approved')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_review_status
  ON public.assessment_attempts(review_status);

CREATE INDEX IF NOT EXISTS idx_assessment_answers_review_status
  ON public.assessment_answers(review_status);