ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS assessment_thumbnail TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER;

WITH ranked_course_assessments AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY course_id
      ORDER BY created_at, id
    ) AS next_display_order
  FROM public.assessments
  WHERE module_id IS NULL
)
UPDATE public.assessments AS assessments
SET display_order = ranked_course_assessments.next_display_order
FROM ranked_course_assessments
WHERE assessments.id = ranked_course_assessments.id
  AND assessments.display_order IS NULL;

UPDATE public.assessments
SET display_order = 1
WHERE display_order IS NULL;

ALTER TABLE public.assessments
  ALTER COLUMN display_order SET DEFAULT 1;

ALTER TABLE public.assessments
  ALTER COLUMN display_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assessments_course_display_order
  ON public.assessments(course_id, display_order);