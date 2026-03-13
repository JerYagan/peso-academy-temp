ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS credited_duration_hours INTEGER,
  ADD COLUMN IF NOT EXISTS actual_learning_minutes INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'enrollments_credited_duration_hours_nonnegative'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_credited_duration_hours_nonnegative
      CHECK (credited_duration_hours IS NULL OR credited_duration_hours >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'enrollments_actual_learning_minutes_nonnegative'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_actual_learning_minutes_nonnegative
      CHECK (actual_learning_minutes IS NULL OR actual_learning_minutes >= 0);
  END IF;
END $$;

WITH session_minutes AS (
  SELECT
    enrollment_id,
    ROUND(SUM(COALESCE(duration_seconds, 0)) / 60.0)::INTEGER AS total_minutes
  FROM public.module_sessions
  GROUP BY enrollment_id
), completion_minutes AS (
  SELECT
    enrollment_id,
    SUM(COALESCE(time_spent, 0))::INTEGER AS total_minutes
  FROM public.module_completions
  GROUP BY enrollment_id
), assessment_minutes AS (
  SELECT
    enrollment_id,
    ROUND(SUM(COALESCE(time_spent, 0)) / 60.0)::INTEGER AS total_minutes
  FROM public.assessment_attempts
  WHERE submitted_at IS NOT NULL
  GROUP BY enrollment_id
), learning_snapshot AS (
  SELECT
    e.id AS enrollment_id,
    CASE
      WHEN COALESCE(sm.total_minutes, 0) > 0 THEN sm.total_minutes
      ELSE COALESCE(cm.total_minutes, 0) + COALESCE(am.total_minutes, 0)
    END AS actual_learning_minutes,
    CASE
      WHEN COALESCE(e.completion_approval_status, 'not_ready') = 'approved' OR e.status = 'completed'
        THEN GREATEST(COALESCE(c.duration, 0), 0)
      ELSE e.credited_duration_hours
    END AS credited_duration_hours
  FROM public.enrollments e
  JOIN public.courses c ON c.id = e.course_id
  LEFT JOIN session_minutes sm ON sm.enrollment_id = e.id
  LEFT JOIN completion_minutes cm ON cm.enrollment_id = e.id
  LEFT JOIN assessment_minutes am ON am.enrollment_id = e.id
)
UPDATE public.enrollments e
SET
  actual_learning_minutes = learning_snapshot.actual_learning_minutes,
  credited_duration_hours = learning_snapshot.credited_duration_hours
FROM learning_snapshot
WHERE learning_snapshot.enrollment_id = e.id;

CREATE INDEX IF NOT EXISTS idx_enrollments_credited_duration_hours
  ON public.enrollments(credited_duration_hours);

CREATE INDEX IF NOT EXISTS idx_enrollments_actual_learning_minutes
  ON public.enrollments(actual_learning_minutes);