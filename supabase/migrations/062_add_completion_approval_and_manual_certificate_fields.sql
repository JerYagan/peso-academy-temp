ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS completion_approval_status TEXT NOT NULL DEFAULT 'not_ready',
  ADD COLUMN IF NOT EXISTS completion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completion_feedback TEXT;

UPDATE public.enrollments
SET completion_approval_status = CASE
  WHEN status = 'completed' THEN 'approved'
  WHEN progress >= 100 THEN 'pending'
  ELSE 'not_ready'
END
WHERE completion_approval_status IS NULL OR completion_approval_status = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'enrollments_completion_approval_status_check'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_completion_approval_status_check
      CHECK (
        completion_approval_status IN ('not_ready', 'pending', 'approved', 'needs_revision')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_enrollments_completion_approval_status
  ON public.enrollments(completion_approval_status);

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS issued_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_certificates_issued_by
  ON public.certificates(issued_by);
