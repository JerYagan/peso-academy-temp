-- Phase 10 hardening for session lifecycle cleanup and trainer ownership boundaries.

CREATE OR REPLACE FUNCTION public.close_stale_module_sessions(
  p_user_id UUID DEFAULT NULL,
  p_stale_before TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '15 minutes')
)
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE public.module_sessions ms
  SET ended_at = COALESCE(ms.ended_at, ms.last_seen_at, p_stale_before),
      session_status = 'timed_out',
      updated_at = NOW()
  WHERE ms.session_status = 'active'
    AND COALESCE(ms.last_seen_at, ms.started_at) < p_stale_before
    AND (p_user_id IS NULL OR ms.user_id = p_user_id);

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.close_stale_module_sessions(UUID, TIMESTAMPTZ) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_trainer_accessible_module_sessions(
  p_learner_id UUID DEFAULT NULL,
  p_course_id UUID DEFAULT NULL
)
RETURNS SETOF public.module_sessions AS $$
  SELECT ms.*
  FROM public.module_sessions ms
  JOIN public.enrollments e
    ON e.id = ms.enrollment_id
   AND e.user_id = ms.user_id
   AND e.course_id = ms.course_id
  JOIN public.courses c
    ON c.id = ms.course_id
   AND c.id = e.course_id
  WHERE (
    public.get_user_role() = 'admin'
    OR (
      public.get_user_role() IN ('trainer', 'spd', 'training_officer')
      AND c.instructor_id = public.get_current_user_profile_id()
    )
  )
  AND (p_learner_id IS NULL OR ms.user_id = p_learner_id)
  AND (p_course_id IS NULL OR ms.course_id = p_course_id)
  ORDER BY ms.last_seen_at DESC;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_trainer_accessible_module_sessions(UUID, UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "Course managers can view module sessions" ON public.module_sessions;
CREATE POLICY "Course managers can view module sessions" ON public.module_sessions
FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.courses c ON c.id = e.course_id
    WHERE e.id = module_sessions.enrollment_id
      AND e.user_id = module_sessions.user_id
      AND e.course_id = module_sessions.course_id
      AND c.instructor_id = public.get_current_user_profile_id()
      AND public.get_user_role() IN ('trainer', 'spd', 'training_officer')
  )
);