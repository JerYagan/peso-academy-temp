ALTER TABLE public.learner_recommendations
  ADD COLUMN IF NOT EXISTS acceptance_probability NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acceptance_band TEXT NOT NULL DEFAULT 'low';

CREATE TABLE IF NOT EXISTS public.learner_disengagement_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active_enrollments INTEGER NOT NULL DEFAULT 0,
  incomplete_enrollments INTEGER NOT NULL DEFAULT 0,
  recent_session_count INTEGER NOT NULL DEFAULT 0,
  repeated_short_session_count INTEGER NOT NULL DEFAULT 0,
  inactive_days INTEGER NOT NULL DEFAULT 0,
  disengagement_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  signal_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT learner_disengagement_scores_unique UNIQUE (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_learner_recommendations_acceptance_probability
  ON public.learner_recommendations(acceptance_probability DESC, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_learner_disengagement_scores_snapshot
  ON public.learner_disengagement_scores(snapshot_date DESC, disengagement_score DESC);

ALTER TABLE public.learner_disengagement_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own learner disengagement scores" ON public.learner_disengagement_scores;
CREATE POLICY "Users can view own learner disengagement scores" ON public.learner_disengagement_scores
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.phase1_is_course_manager()
);

DROP POLICY IF EXISTS "Course managers can refresh learner disengagement scores" ON public.learner_disengagement_scores;
CREATE POLICY "Course managers can refresh learner disengagement scores" ON public.learner_disengagement_scores
FOR ALL
USING (public.phase1_is_course_manager())
WITH CHECK (public.phase1_is_course_manager());

CREATE OR REPLACE FUNCTION public.refresh_phase6_predictive_scores()
RETURNS VOID AS $$
BEGIN
  WITH learner_activity AS (
    SELECT
      u.id AS user_id,
      COUNT(e.id) FILTER (WHERE e.status IN ('enrolled', 'in_progress', 'in-progress'))::INTEGER AS active_enrollments,
      COUNT(e.id) FILTER (WHERE COALESCE(e.progress, 0) < 100 AND COALESCE(e.status, '') <> 'completed')::INTEGER AS incomplete_enrollments,
      COUNT(ms.id) FILTER (
        WHERE COALESCE(ms.last_seen_at, ms.started_at, NOW()) >= NOW() - INTERVAL '14 days'
      )::INTEGER AS recent_session_count,
      COUNT(ms.id) FILTER (
        WHERE COALESCE(ms.duration_seconds, 0) > 0
          AND COALESCE(ms.duration_seconds, 0) <= 300
          AND COALESCE(ms.session_status, 'active') <> 'completed'
      )::INTEGER AS repeated_short_session_count,
      GREATEST(
        0,
        COALESCE(
          DATE_PART(
            'day',
            NOW() - MAX(COALESCE(ms.last_seen_at, ms.started_at, e.completed_at, e.enrolled_at, u.updated_at, u.created_at))
          )::INTEGER,
          0
        )
      ) AS inactive_days,
      ROUND(
        GREATEST(
          0,
          LEAST(
            100,
            (
              LEAST(COUNT(e.id) FILTER (WHERE COALESCE(e.progress, 0) < 100 AND COALESCE(e.status, '') <> 'completed')::NUMERIC * 14, 42)
              + LEAST(COUNT(ms.id) FILTER (
                  WHERE COALESCE(ms.duration_seconds, 0) > 0
                    AND COALESCE(ms.duration_seconds, 0) <= 300
                    AND COALESCE(ms.session_status, 'active') <> 'completed'
                )::NUMERIC * 8, 24)
              + LEAST(GREATEST(COALESCE(
                  DATE_PART(
                    'day',
                    NOW() - MAX(COALESCE(ms.last_seen_at, ms.started_at, e.completed_at, e.enrolled_at, u.updated_at, u.created_at))
                  )::NUMERIC,
                  0
                ) - 7, 0) * 2.5, 26)
              + CASE
                  WHEN COUNT(ms.id) FILTER (
                    WHERE COALESCE(ms.last_seen_at, ms.started_at, NOW()) >= NOW() - INTERVAL '14 days'
                  ) = 0
                    AND COUNT(e.id) FILTER (WHERE COALESCE(e.progress, 0) < 100 AND COALESCE(e.status, '') <> 'completed') > 0
                  THEN 12
                  ELSE 0
                END
            )
          )
        ),
        2
      ) AS disengagement_score,
      jsonb_build_object(
        'activeEnrollments', COUNT(e.id) FILTER (WHERE e.status IN ('enrolled', 'in_progress', 'in-progress'))::INTEGER,
        'incompleteEnrollments', COUNT(e.id) FILTER (WHERE COALESCE(e.progress, 0) < 100 AND COALESCE(e.status, '') <> 'completed')::INTEGER,
        'recentSessionCount', COUNT(ms.id) FILTER (
          WHERE COALESCE(ms.last_seen_at, ms.started_at, NOW()) >= NOW() - INTERVAL '14 days'
        )::INTEGER,
        'repeatedShortSessionCount', COUNT(ms.id) FILTER (
          WHERE COALESCE(ms.duration_seconds, 0) > 0
            AND COALESCE(ms.duration_seconds, 0) <= 300
            AND COALESCE(ms.session_status, 'active') <> 'completed'
        )::INTEGER,
        'inactiveDays', GREATEST(
          0,
          COALESCE(
            DATE_PART(
              'day',
              NOW() - MAX(COALESCE(ms.last_seen_at, ms.started_at, e.completed_at, e.enrolled_at, u.updated_at, u.created_at))
            )::INTEGER,
            0
          )
        )
      ) AS signal_summary
    FROM public.users u
    LEFT JOIN public.enrollments e ON e.user_id = u.id
    LEFT JOIN public.module_sessions ms ON ms.user_id = u.id
    WHERE u.role IN ('jobseeker', 'trainee')
    GROUP BY u.id
  )
  INSERT INTO public.learner_disengagement_scores (
    user_id,
    snapshot_date,
    active_enrollments,
    incomplete_enrollments,
    recent_session_count,
    repeated_short_session_count,
    inactive_days,
    disengagement_score,
    risk_level,
    signal_summary,
    generated_at,
    created_at,
    updated_at
  )
  SELECT
    user_id,
    CURRENT_DATE,
    active_enrollments,
    incomplete_enrollments,
    recent_session_count,
    repeated_short_session_count,
    inactive_days,
    disengagement_score,
    CASE
      WHEN disengagement_score >= 70 THEN 'high'
      WHEN disengagement_score >= 40 THEN 'medium'
      ELSE 'low'
    END,
    signal_summary,
    NOW(),
    NOW(),
    NOW()
  FROM learner_activity
  WHERE active_enrollments > 0 OR incomplete_enrollments > 0 OR recent_session_count > 0
  ON CONFLICT (user_id, snapshot_date) DO UPDATE
  SET active_enrollments = EXCLUDED.active_enrollments,
      incomplete_enrollments = EXCLUDED.incomplete_enrollments,
      recent_session_count = EXCLUDED.recent_session_count,
      repeated_short_session_count = EXCLUDED.repeated_short_session_count,
      inactive_days = EXCLUDED.inactive_days,
      disengagement_score = EXCLUDED.disengagement_score,
      risk_level = EXCLUDED.risk_level,
      signal_summary = EXCLUDED.signal_summary,
      generated_at = EXCLUDED.generated_at,
      updated_at = NOW();

  UPDATE public.learner_recommendations lr
  SET acceptance_probability = scored.acceptance_probability,
      acceptance_band = CASE
        WHEN scored.acceptance_probability >= 70 THEN 'high'
        WHEN scored.acceptance_probability >= 40 THEN 'medium'
        ELSE 'low'
      END,
      updated_at = NOW()
  FROM (
    SELECT
      id,
      ROUND(
        GREATEST(
          5,
          LEAST(
            95,
            (
              LEAST(COALESCE(score, 0), 140) / 140.0 * 45
              + CASE
                  WHEN COALESCE(impression_count, 0) > 0
                    THEN LEAST((COALESCE(click_count, 0)::NUMERIC / NULLIF(impression_count, 0)) * 25, 25)
                  ELSE 0
                END
              + CASE
                  WHEN COALESCE(click_count, 0) > 0
                    THEN LEAST((COALESCE(accept_count, 0)::NUMERIC / NULLIF(click_count, 0)) * 20, 20)
                  ELSE 0
                END
              + CASE
                  WHEN COALESCE(enrollment_count, 0) > 0
                    THEN LEAST((COALESCE(completion_count, 0)::NUMERIC / NULLIF(enrollment_count, 0)) * 10, 10)
                  ELSE 0
                END
              + CASE
                  WHEN COALESCE((source_mix ->> 'collaborative')::BOOLEAN, FALSE) THEN 6 ELSE 0
                END
              + CASE
                  WHEN COALESCE((source_mix ->> 'sessionBehavior')::BOOLEAN, FALSE) THEN 4 ELSE 0
                END
            )
          )
        ),
        2
      ) AS acceptance_probability
    FROM public.learner_recommendations
  ) AS scored
  WHERE lr.id = scored.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.refresh_phase6_predictive_scores() TO authenticated, service_role;