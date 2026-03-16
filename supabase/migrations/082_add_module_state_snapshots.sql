CREATE TABLE IF NOT EXISTS public.module_state_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  practice_quiz_draft_snapshot jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT module_state_snapshots_unique UNIQUE (user_id, enrollment_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_module_state_snapshots_enrollment_module
  ON public.module_state_snapshots(enrollment_id, module_id);

CREATE INDEX IF NOT EXISTS idx_module_state_snapshots_user_updated
  ON public.module_state_snapshots(user_id, updated_at DESC);

DROP TRIGGER IF EXISTS update_module_state_snapshots_updated_at ON public.module_state_snapshots;
CREATE TRIGGER update_module_state_snapshots_updated_at
BEFORE UPDATE ON public.module_state_snapshots
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.module_state_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own module state snapshots" ON public.module_state_snapshots;
CREATE POLICY "Users can view own module state snapshots"
ON public.module_state_snapshots
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.id = module_state_snapshots.enrollment_id
      AND e.user_id = auth.uid()
      AND e.course_id = module_state_snapshots.course_id
  )
);

DROP POLICY IF EXISTS "Users can insert own module state snapshots" ON public.module_state_snapshots;
CREATE POLICY "Users can insert own module state snapshots"
ON public.module_state_snapshots
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.modules m ON m.id = module_state_snapshots.module_id
    WHERE e.id = module_state_snapshots.enrollment_id
      AND e.user_id = auth.uid()
      AND e.course_id = module_state_snapshots.course_id
      AND m.course_id = module_state_snapshots.course_id
  )
);

DROP POLICY IF EXISTS "Users can update own module state snapshots" ON public.module_state_snapshots;
CREATE POLICY "Users can update own module state snapshots"
ON public.module_state_snapshots
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.modules m ON m.id = module_state_snapshots.module_id
    WHERE e.id = module_state_snapshots.enrollment_id
      AND e.user_id = auth.uid()
      AND e.course_id = module_state_snapshots.course_id
      AND m.course_id = module_state_snapshots.course_id
  )
);

DROP POLICY IF EXISTS "Course managers can view module state snapshots" ON public.module_state_snapshots;
CREATE POLICY "Course managers can view module state snapshots"
ON public.module_state_snapshots
FOR SELECT TO authenticated
USING (public.course_manager_can_manage_enrollment(enrollment_id));

COMMENT ON TABLE public.module_state_snapshots IS 'Durable learner-facing module draft state that survives reloads independently from transient module sessions.';
COMMENT ON COLUMN public.module_state_snapshots.practice_quiz_draft_snapshot IS 'In-progress practice quiz selections, submitted answers, essay draft metadata, and summary captured before module completion.';
