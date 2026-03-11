-- Add module session history so learner engagement can be tracked independently from module completion.

CREATE TABLE IF NOT EXISTS public.module_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  session_status TEXT NOT NULL DEFAULT 'active'
    CHECK (session_status IN ('active', 'completed', 'abandoned', 'timed_out')),
  entry_source TEXT,
  resume_position_seconds INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT module_sessions_duration_nonnegative CHECK (duration_seconds >= 0),
  CONSTRAINT module_sessions_resume_nonnegative CHECK (
    resume_position_seconds IS NULL OR resume_position_seconds >= 0
  ),
  CONSTRAINT module_sessions_ended_after_started CHECK (
    ended_at IS NULL OR ended_at >= started_at
  ),
  CONSTRAINT module_sessions_seen_after_started CHECK (
    last_seen_at >= started_at
  )
);

CREATE INDEX IF NOT EXISTS idx_module_sessions_user_date
  ON public.module_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_module_sessions_enrollment_module
  ON public.module_sessions(enrollment_id, module_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_module_sessions_module_date
  ON public.module_sessions(module_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_module_sessions_active
  ON public.module_sessions(user_id, session_status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_module_sessions_user_last_seen
  ON public.module_sessions(user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_module_sessions_user_enrollment_last_seen
  ON public.module_sessions(user_id, enrollment_id, last_seen_at DESC);

CREATE OR REPLACE FUNCTION public.get_trainer_accessible_module_sessions(
  p_learner_id UUID DEFAULT NULL,
  p_course_id UUID DEFAULT NULL
)
RETURNS SETOF public.module_sessions AS $$
  SELECT ms.*
  FROM public.module_sessions ms
  WHERE (
    public.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = ms.course_id
        AND c.instructor_id = public.get_current_user_profile_id()
    )
  )
  AND (p_learner_id IS NULL OR ms.user_id = p_learner_id)
  AND (p_course_id IS NULL OR ms.course_id = p_course_id)
  ORDER BY ms.last_seen_at DESC;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_trainer_accessible_module_sessions(UUID, UUID) TO authenticated, service_role;

DROP TRIGGER IF EXISTS update_module_sessions_updated_at ON public.module_sessions;
CREATE TRIGGER update_module_sessions_updated_at
BEFORE UPDATE ON public.module_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.module_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own module sessions" ON public.module_sessions;
CREATE POLICY "Users can view own module sessions" ON public.module_sessions
FOR SELECT
TO authenticated
USING (
  user_id = public.get_current_user_profile_id()
);

DROP POLICY IF EXISTS "Users can create own module sessions" ON public.module_sessions;
CREATE POLICY "Users can create own module sessions" ON public.module_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_current_user_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.modules m ON m.id = module_sessions.module_id
    WHERE e.id = module_sessions.enrollment_id
      AND e.user_id = public.get_current_user_profile_id()
      AND e.course_id = module_sessions.course_id
      AND m.course_id = module_sessions.course_id
  )
);

DROP POLICY IF EXISTS "Users can update own module sessions" ON public.module_sessions;
CREATE POLICY "Users can update own module sessions" ON public.module_sessions
FOR UPDATE
TO authenticated
USING (
  user_id = public.get_current_user_profile_id()
)
WITH CHECK (
  user_id = public.get_current_user_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.modules m ON m.id = module_sessions.module_id
    WHERE e.id = module_sessions.enrollment_id
      AND e.user_id = public.get_current_user_profile_id()
      AND e.course_id = module_sessions.course_id
      AND m.course_id = module_sessions.course_id
  )
);

DROP POLICY IF EXISTS "Course managers can view module sessions" ON public.module_sessions;
CREATE POLICY "Course managers can view module sessions" ON public.module_sessions
FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = module_sessions.course_id
      AND c.instructor_id = public.get_current_user_profile_id()
  )
);
