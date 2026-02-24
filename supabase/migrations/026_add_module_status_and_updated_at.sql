-- Module status: draft (default) vs finalized. In Module Management we only finalize/draft modules;
-- course-level publishing is done in Courses. Add updated_at for "Last modified" display.

DO $$ BEGIN
  CREATE TYPE module_status AS ENUM ('draft', 'finalized');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Existing modules treated as finalized so learners still see them; new modules created as draft
ALTER TABLE public.modules
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'finalized'
  CHECK (status IN ('draft', 'finalized'));

ALTER TABLE public.modules
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS update_modules_updated_at ON public.modules;
CREATE TRIGGER update_modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON COLUMN public.modules.status IS 'draft = saved but not finalized; finalized = ready for learners (course publish is separate in Courses)';
