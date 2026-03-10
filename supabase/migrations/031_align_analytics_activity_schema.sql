-- Align analytics-related schema with the application data model.
-- 1. Enrollments need updated_at so activity and engagement analytics can use last activity.
-- 2. Module completions need nullable completed_at because time tracking can begin before a module is finished.

ALTER TABLE public.enrollments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.enrollments
SET updated_at = COALESCE(completed_at, enrolled_at, NOW())
WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS update_enrollments_updated_at ON public.enrollments;
CREATE TRIGGER update_enrollments_updated_at
BEFORE UPDATE ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.module_completions
ALTER COLUMN completed_at DROP NOT NULL;

COMMENT ON COLUMN public.enrollments.updated_at IS 'Tracks latest enrollment activity for engagement analytics and dashboards.';
COMMENT ON COLUMN public.module_completions.completed_at IS 'Null when time tracking exists but the module is not yet completed.';