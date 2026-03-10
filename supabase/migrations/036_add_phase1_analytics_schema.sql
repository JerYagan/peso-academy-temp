-- Phase 1 analytics, recommendation persistence, rollups, and tagging support.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS skill_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS topic_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS skill_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS topic_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS skill_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS topic_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.assessment_questions
  ADD COLUMN IF NOT EXISTS skill_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS topic_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE public.courses
SET skill_tags = COALESCE(skills, ARRAY[]::TEXT[])
WHERE skill_tags IS NULL OR cardinality(skill_tags) = 0;

CREATE OR REPLACE FUNCTION public.sync_course_skill_tags()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.skill_tags IS NULL OR cardinality(NEW.skill_tags) = 0 THEN
    NEW.skill_tags := COALESCE(NEW.skills, ARRAY[]::TEXT[]);
  END IF;

  IF NEW.topic_tags IS NULL THEN
    NEW.topic_tags := ARRAY[]::TEXT[];
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_course_skill_tags_trigger ON public.courses;
CREATE TRIGGER sync_course_skill_tags_trigger
BEFORE INSERT OR UPDATE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.sync_course_skill_tags();

CREATE TABLE IF NOT EXISTS public.learner_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  source_surface TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score NUMERIC(10,4) NOT NULL DEFAULT 0,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_mix JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_version TEXT NOT NULL DEFAULT 'phase1-blended-v1',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_impression_at TIMESTAMPTZ,
  last_click_at TIMESTAMPTZ,
  last_accept_at TIMESTAMPTZ,
  impression_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  accept_count INTEGER NOT NULL DEFAULT 0,
  enrollment_count INTEGER NOT NULL DEFAULT 0,
  completion_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT learner_recommendations_surface_unique UNIQUE (user_id, course_id, source_surface)
);

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS originating_recommendation_id UUID REFERENCES public.learner_recommendations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  module_id UUID REFERENCES public.modules(id) ON DELETE SET NULL,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  recommendation_id UUID REFERENCES public.learner_recommendations(id) ON DELETE SET NULL,
  surface TEXT,
  session_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.analytics_user_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  enrollments_started INTEGER NOT NULL DEFAULT 0,
  modules_completed INTEGER NOT NULL DEFAULT 0,
  assessments_submitted INTEGER NOT NULL DEFAULT 0,
  recommendation_impressions INTEGER NOT NULL DEFAULT 0,
  recommendation_clicks INTEGER NOT NULL DEFAULT 0,
  recommendation_accepts INTEGER NOT NULL DEFAULT 0,
  total_learning_minutes INTEGER NOT NULL DEFAULT 0,
  average_progress NUMERIC(6,2) NOT NULL DEFAULT 0,
  progress_velocity NUMERIC(8,2) NOT NULL DEFAULT 0,
  average_assessment_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analytics_user_daily_unique UNIQUE (user_id, metric_date)
);

CREATE TABLE IF NOT EXISTS public.analytics_course_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  enrollments_started INTEGER NOT NULL DEFAULT 0,
  enrollments_completed INTEGER NOT NULL DEFAULT 0,
  certificates_issued INTEGER NOT NULL DEFAULT 0,
  active_learners INTEGER NOT NULL DEFAULT 0,
  course_views INTEGER NOT NULL DEFAULT 0,
  recommendation_enrollments INTEGER NOT NULL DEFAULT 0,
  total_learning_minutes INTEGER NOT NULL DEFAULT 0,
  average_progress NUMERIC(6,2) NOT NULL DEFAULT 0,
  average_assessment_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analytics_course_daily_unique UNIQUE (course_id, metric_date)
);

CREATE TABLE IF NOT EXISTS public.analytics_module_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  module_opens INTEGER NOT NULL DEFAULT 0,
  completions INTEGER NOT NULL DEFAULT 0,
  assessment_attempts INTEGER NOT NULL DEFAULT 0,
  passed_attempts INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  active_learners INTEGER NOT NULL DEFAULT 0,
  average_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  pass_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  failure_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  average_time_spent_minutes NUMERIC(8,2) NOT NULL DEFAULT 0,
  abandonment_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analytics_module_daily_unique UNIQUE (module_id, metric_date)
);

CREATE TABLE IF NOT EXISTS public.analytics_recommendation_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES public.learner_recommendations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  surface TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  accepts INTEGER NOT NULL DEFAULT 0,
  enrollments INTEGER NOT NULL DEFAULT 0,
  completions INTEGER NOT NULL DEFAULT 0,
  ctr NUMERIC(6,2) NOT NULL DEFAULT 0,
  accept_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analytics_recommendation_daily_unique UNIQUE (recommendation_id, metric_date, surface)
);

CREATE TABLE IF NOT EXISTS public.analytics_admin_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL UNIQUE,
  total_enrollments INTEGER NOT NULL DEFAULT 0,
  total_completions INTEGER NOT NULL DEFAULT 0,
  active_learners INTEGER NOT NULL DEFAULT 0,
  certificates_issued INTEGER NOT NULL DEFAULT 0,
  recommendation_impressions INTEGER NOT NULL DEFAULT 0,
  recommendation_clicks INTEGER NOT NULL DEFAULT 0,
  recommendation_accepts INTEGER NOT NULL DEFAULT 0,
  total_learning_minutes INTEGER NOT NULL DEFAULT 0,
  average_assessment_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.learner_skill_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  strongest_skill_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  improvement_skill_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  topic_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  average_assessment_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  total_learning_minutes INTEGER NOT NULL DEFAULT 0,
  modules_completed INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_version TEXT NOT NULL DEFAULT 'phase1-skill-profile-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.module_quality_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  completion_count INTEGER NOT NULL DEFAULT 0,
  average_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  pass_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  average_time_spent_minutes NUMERIC(8,2) NOT NULL DEFAULT 0,
  abandonment_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  quality_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  signal_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT module_quality_signals_unique UNIQUE (module_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS public.course_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active_enrollments INTEGER NOT NULL DEFAULT 0,
  completed_enrollments INTEGER NOT NULL DEFAULT 0,
  completion_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  average_progress NUMERIC(6,2) NOT NULL DEFAULT 0,
  average_time_spent_minutes NUMERIC(8,2) NOT NULL DEFAULT 0,
  recommendation_acceptance_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  risk_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  score_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT course_risk_scores_unique UNIQUE (course_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_date ON public.analytics_events(user_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_recommendation_date ON public.analytics_events(recommendation_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_course_date ON public.analytics_events(course_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_learner_recommendations_user_surface ON public.learner_recommendations(user_id, source_surface, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollments_originating_recommendation ON public.enrollments(originating_recommendation_id);

CREATE OR REPLACE FUNCTION public.phase1_is_course_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_user_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_course_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_module_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_recommendation_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_admin_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_skill_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_quality_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_risk_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own analytics events" ON public.analytics_events;
CREATE POLICY "Users can view own analytics events" ON public.analytics_events
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR user_id = public.get_current_user_profile_id()
  OR public.phase1_is_course_manager()
);

DROP POLICY IF EXISTS "Users can insert own analytics events" ON public.analytics_events;
CREATE POLICY "Users can insert own analytics events" ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IS NULL
  OR user_id = auth.uid()
  OR user_id = public.get_current_user_profile_id()
  OR public.phase1_is_course_manager()
);

DROP POLICY IF EXISTS "Users can view own learner recommendations" ON public.learner_recommendations;
CREATE POLICY "Users can view own learner recommendations" ON public.learner_recommendations
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR user_id = public.get_current_user_profile_id()
  OR public.phase1_is_course_manager()
);

DROP POLICY IF EXISTS "Users can upsert own learner recommendations" ON public.learner_recommendations;
CREATE POLICY "Users can upsert own learner recommendations" ON public.learner_recommendations
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  OR user_id = public.get_current_user_profile_id()
  OR public.phase1_is_course_manager()
)
WITH CHECK (
  user_id = auth.uid()
  OR user_id = public.get_current_user_profile_id()
  OR public.phase1_is_course_manager()
);

DROP POLICY IF EXISTS "Users can view own learner skill profiles" ON public.learner_skill_profiles;
CREATE POLICY "Users can view own learner skill profiles" ON public.learner_skill_profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR user_id = public.get_current_user_profile_id()
  OR public.phase1_is_course_manager()
);

DROP POLICY IF EXISTS "Users can upsert own learner skill profiles" ON public.learner_skill_profiles;
CREATE POLICY "Users can upsert own learner skill profiles" ON public.learner_skill_profiles
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  OR user_id = public.get_current_user_profile_id()
  OR public.phase1_is_course_manager()
)
WITH CHECK (
  user_id = auth.uid()
  OR user_id = public.get_current_user_profile_id()
  OR public.phase1_is_course_manager()
);

DROP POLICY IF EXISTS "Users can view own analytics user daily" ON public.analytics_user_daily;
CREATE POLICY "Users can view own analytics user daily" ON public.analytics_user_daily
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR user_id = public.get_current_user_profile_id()
  OR public.phase1_is_course_manager()
);

DROP POLICY IF EXISTS "Course managers can view course analytics daily" ON public.analytics_course_daily;
CREATE POLICY "Course managers can view course analytics daily" ON public.analytics_course_daily
FOR SELECT
TO authenticated
USING (public.phase1_is_course_manager());

DROP POLICY IF EXISTS "Course managers can view module analytics daily" ON public.analytics_module_daily;
CREATE POLICY "Course managers can view module analytics daily" ON public.analytics_module_daily
FOR SELECT
TO authenticated
USING (public.phase1_is_course_manager());

DROP POLICY IF EXISTS "Users can view recommendation analytics daily" ON public.analytics_recommendation_daily;
CREATE POLICY "Users can view recommendation analytics daily" ON public.analytics_recommendation_daily
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR user_id = public.get_current_user_profile_id()
  OR public.phase1_is_course_manager()
);

DROP POLICY IF EXISTS "Course managers can view admin analytics daily" ON public.analytics_admin_daily;
CREATE POLICY "Course managers can view admin analytics daily" ON public.analytics_admin_daily
FOR SELECT
TO authenticated
USING (public.phase1_is_course_manager());

DROP POLICY IF EXISTS "Course managers can view module quality signals" ON public.module_quality_signals;
CREATE POLICY "Course managers can view module quality signals" ON public.module_quality_signals
FOR SELECT
TO authenticated
USING (public.phase1_is_course_manager());

DROP POLICY IF EXISTS "Course managers can view course risk scores" ON public.course_risk_scores;
CREATE POLICY "Course managers can view course risk scores" ON public.course_risk_scores
FOR SELECT
TO authenticated
USING (public.phase1_is_course_manager());

CREATE OR REPLACE FUNCTION public.track_analytics_event(
  p_event_name TEXT,
  p_user_id UUID DEFAULT NULL,
  p_course_id UUID DEFAULT NULL,
  p_module_id UUID DEFAULT NULL,
  p_assessment_id UUID DEFAULT NULL,
  p_enrollment_id UUID DEFAULT NULL,
  p_recommendation_id UUID DEFAULT NULL,
  p_surface TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid(), public.get_current_user_profile_id());

  INSERT INTO public.analytics_events (
    event_name,
    event_date,
    occurred_at,
    user_id,
    course_id,
    module_id,
    assessment_id,
    enrollment_id,
    recommendation_id,
    surface,
    session_id,
    metadata
  ) VALUES (
    p_event_name,
    p_occurred_at::date,
    p_occurred_at,
    v_user_id,
    p_course_id,
    p_module_id,
    p_assessment_id,
    p_enrollment_id,
    p_recommendation_id,
    p_surface,
    p_session_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_event_id;

  IF p_recommendation_id IS NOT NULL THEN
    UPDATE public.learner_recommendations
    SET last_impression_at = CASE WHEN p_event_name = 'recommendation_impression' THEN p_occurred_at ELSE last_impression_at END,
        last_click_at = CASE WHEN p_event_name = 'recommendation_click' THEN p_occurred_at ELSE last_click_at END,
        last_accept_at = CASE WHEN p_event_name IN ('recommendation_accept', 'course_enroll') THEN p_occurred_at ELSE last_accept_at END,
        impression_count = impression_count + CASE WHEN p_event_name = 'recommendation_impression' THEN 1 ELSE 0 END,
        click_count = click_count + CASE WHEN p_event_name = 'recommendation_click' THEN 1 ELSE 0 END,
        accept_count = accept_count + CASE WHEN p_event_name = 'recommendation_accept' THEN 1 ELSE 0 END,
        enrollment_count = enrollment_count + CASE WHEN p_event_name = 'course_enroll' THEN 1 ELSE 0 END,
        completion_count = completion_count + CASE WHEN p_event_name = 'course_complete' THEN 1 ELSE 0 END,
        updated_at = NOW()
    WHERE id = p_recommendation_id;
  END IF;

  IF p_enrollment_id IS NOT NULL AND p_recommendation_id IS NOT NULL AND p_event_name IN ('recommendation_accept', 'course_enroll') THEN
    UPDATE public.enrollments
    SET originating_recommendation_id = COALESCE(originating_recommendation_id, p_recommendation_id),
        updated_at = NOW()
    WHERE id = p_enrollment_id;
  END IF;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.refresh_phase1_analytics_rollups(p_user_id UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.analytics_user_daily (
    user_id,
    metric_date,
    enrollments_started,
    modules_completed,
    assessments_submitted,
    recommendation_impressions,
    recommendation_clicks,
    recommendation_accepts,
    total_learning_minutes,
    average_progress,
    progress_velocity,
    average_assessment_score,
    last_activity_at,
    created_at,
    updated_at
  )
  WITH enrollment_daily AS (
    SELECT
      e.user_id,
      e.enrolled_at::date AS metric_date,
      COUNT(*) AS enrollments_started,
      AVG(COALESCE(e.progress, 0)) AS average_progress
    FROM public.enrollments e
    WHERE p_user_id IS NULL OR e.user_id = p_user_id
    GROUP BY e.user_id, e.enrolled_at::date
  ),
  module_daily AS (
    SELECT
      e.user_id,
      COALESCE(mc.completed_at::date, e.updated_at::date, e.enrolled_at::date) AS metric_date,
      COUNT(*) FILTER (WHERE mc.completed_at IS NOT NULL) AS modules_completed,
      SUM(COALESCE(mc.time_spent, 0))::INTEGER AS module_minutes
    FROM public.module_completions mc
    JOIN public.enrollments e ON e.id = mc.enrollment_id
    WHERE p_user_id IS NULL OR e.user_id = p_user_id
    GROUP BY e.user_id, COALESCE(mc.completed_at::date, e.updated_at::date, e.enrolled_at::date)
  ),
  assessment_daily AS (
    SELECT
      aa.user_id,
      COALESCE(aa.submitted_at::date, aa.started_at::date) AS metric_date,
      COUNT(*) FILTER (WHERE aa.submitted_at IS NOT NULL) AS assessments_submitted,
      AVG(COALESCE(aa.score, 0)) FILTER (WHERE aa.score IS NOT NULL) AS average_assessment_score,
      COALESCE(SUM(COALESCE(aa.time_spent, 0)) / 60, 0)::INTEGER AS assessment_minutes
    FROM public.assessment_attempts aa
    WHERE p_user_id IS NULL OR aa.user_id = p_user_id
    GROUP BY aa.user_id, COALESCE(aa.submitted_at::date, aa.started_at::date)
  ),
  event_daily AS (
    SELECT
      COALESCE(ae.user_id, e.user_id) AS user_id,
      ae.event_date AS metric_date,
      COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_impression') AS recommendation_impressions,
      COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_click') AS recommendation_clicks,
      COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_accept') AS recommendation_accepts,
      MAX(ae.occurred_at) AS last_activity_at
    FROM public.analytics_events ae
    LEFT JOIN public.enrollments e ON e.id = ae.enrollment_id
    WHERE p_user_id IS NULL OR COALESCE(ae.user_id, e.user_id) = p_user_id
    GROUP BY COALESCE(ae.user_id, e.user_id), ae.event_date
  ),
  dates AS (
    SELECT user_id, metric_date FROM enrollment_daily
    UNION
    SELECT user_id, metric_date FROM module_daily
    UNION
    SELECT user_id, metric_date FROM assessment_daily
    UNION
    SELECT user_id, metric_date FROM event_daily
  )
  SELECT
    d.user_id,
    d.metric_date,
    COALESCE(ed.enrollments_started, 0),
    COALESCE(md.modules_completed, 0),
    COALESCE(ad.assessments_submitted, 0),
    COALESCE(ev.recommendation_impressions, 0),
    COALESCE(ev.recommendation_clicks, 0),
    COALESCE(ev.recommendation_accepts, 0),
    COALESCE(md.module_minutes, 0) + COALESCE(ad.assessment_minutes, 0),
    COALESCE(ed.average_progress, 0),
    CASE
      WHEN COALESCE(ed.enrollments_started, 0) > 0 THEN ROUND(COALESCE(md.modules_completed, 0)::NUMERIC / ed.enrollments_started, 2)
      ELSE COALESCE(md.modules_completed, 0)::NUMERIC
    END,
    COALESCE(ad.average_assessment_score, 0),
    ev.last_activity_at,
    NOW(),
    NOW()
  FROM dates d
  LEFT JOIN enrollment_daily ed ON ed.user_id = d.user_id AND ed.metric_date = d.metric_date
  LEFT JOIN module_daily md ON md.user_id = d.user_id AND md.metric_date = d.metric_date
  LEFT JOIN assessment_daily ad ON ad.user_id = d.user_id AND ad.metric_date = d.metric_date
  LEFT JOIN event_daily ev ON ev.user_id = d.user_id AND ev.metric_date = d.metric_date
  ON CONFLICT (user_id, metric_date) DO UPDATE
  SET enrollments_started = EXCLUDED.enrollments_started,
      modules_completed = EXCLUDED.modules_completed,
      assessments_submitted = EXCLUDED.assessments_submitted,
      recommendation_impressions = EXCLUDED.recommendation_impressions,
      recommendation_clicks = EXCLUDED.recommendation_clicks,
      recommendation_accepts = EXCLUDED.recommendation_accepts,
      total_learning_minutes = EXCLUDED.total_learning_minutes,
      average_progress = EXCLUDED.average_progress,
      progress_velocity = EXCLUDED.progress_velocity,
      average_assessment_score = EXCLUDED.average_assessment_score,
      last_activity_at = EXCLUDED.last_activity_at,
      updated_at = NOW();

  INSERT INTO public.analytics_course_daily (
    course_id,
    metric_date,
    enrollments_started,
    enrollments_completed,
    certificates_issued,
    active_learners,
    course_views,
    recommendation_enrollments,
    total_learning_minutes,
    average_progress,
    average_assessment_score,
    created_at,
    updated_at
  )
  WITH scoped_enrollments AS (
    SELECT e.*
    FROM public.enrollments e
    WHERE p_user_id IS NULL OR e.user_id = p_user_id
  ),
  enrollment_daily AS (
    SELECT
      e.course_id,
      e.enrolled_at::date AS metric_date,
      COUNT(*) AS enrollments_started,
      AVG(COALESCE(e.progress, 0)) AS average_progress,
      COUNT(DISTINCT e.user_id) AS active_learners
    FROM scoped_enrollments e
    GROUP BY e.course_id, e.enrolled_at::date
  ),
  completion_daily AS (
    SELECT
      e.course_id,
      e.completed_at::date AS metric_date,
      COUNT(*) AS enrollments_completed
    FROM scoped_enrollments e
    WHERE e.completed_at IS NOT NULL OR e.status = 'completed'
    GROUP BY e.course_id, e.completed_at::date
  ),
  certificate_daily AS (
    SELECT
      c.course_id,
      c.issued_at::date AS metric_date,
      COUNT(*) AS certificates_issued
    FROM public.certificates c
    JOIN scoped_enrollments e ON e.course_id = c.course_id AND e.user_id = c.user_id
    GROUP BY c.course_id, c.issued_at::date
  ),
  module_time_daily AS (
    SELECT
      e.course_id,
      COALESCE(mc.completed_at::date, e.updated_at::date, e.enrolled_at::date) AS metric_date,
      SUM(COALESCE(mc.time_spent, 0))::INTEGER AS total_learning_minutes
    FROM public.module_completions mc
    JOIN scoped_enrollments e ON e.id = mc.enrollment_id
    GROUP BY e.course_id, COALESCE(mc.completed_at::date, e.updated_at::date, e.enrolled_at::date)
  ),
  assessment_daily AS (
    SELECT
      e.course_id,
      aa.submitted_at::date AS metric_date,
      AVG(COALESCE(aa.score, 0)) FILTER (WHERE aa.score IS NOT NULL) AS average_assessment_score
    FROM public.assessment_attempts aa
    JOIN scoped_enrollments e ON e.id = aa.enrollment_id
    WHERE aa.submitted_at IS NOT NULL
    GROUP BY e.course_id, aa.submitted_at::date
  ),
  event_daily AS (
    SELECT
      ae.course_id,
      ae.event_date AS metric_date,
      COUNT(*) FILTER (WHERE ae.event_name IN ('course_view', 'recommendation_click')) AS course_views,
      COUNT(*) FILTER (WHERE ae.event_name = 'course_enroll' AND ae.recommendation_id IS NOT NULL) AS recommendation_enrollments
    FROM public.analytics_events ae
    WHERE ae.course_id IS NOT NULL
      AND (p_user_id IS NULL OR ae.user_id = p_user_id)
    GROUP BY ae.course_id, ae.event_date
  ),
  dates AS (
    SELECT course_id, metric_date FROM enrollment_daily
    UNION
    SELECT course_id, metric_date FROM completion_daily
    UNION
    SELECT course_id, metric_date FROM certificate_daily
    UNION
    SELECT course_id, metric_date FROM module_time_daily
    UNION
    SELECT course_id, metric_date FROM assessment_daily
    UNION
    SELECT course_id, metric_date FROM event_daily
  )
  SELECT
    d.course_id,
    d.metric_date,
    COALESCE(ed.enrollments_started, 0),
    COALESCE(cd.enrollments_completed, 0),
    COALESCE(cert.certificates_issued, 0),
    COALESCE(ed.active_learners, 0),
    COALESCE(ev.course_views, 0),
    COALESCE(ev.recommendation_enrollments, 0),
    COALESCE(mt.total_learning_minutes, 0),
    COALESCE(ed.average_progress, 0),
    COALESCE(ad.average_assessment_score, 0),
    NOW(),
    NOW()
  FROM dates d
  LEFT JOIN enrollment_daily ed ON ed.course_id = d.course_id AND ed.metric_date = d.metric_date
  LEFT JOIN completion_daily cd ON cd.course_id = d.course_id AND cd.metric_date = d.metric_date
  LEFT JOIN certificate_daily cert ON cert.course_id = d.course_id AND cert.metric_date = d.metric_date
  LEFT JOIN module_time_daily mt ON mt.course_id = d.course_id AND mt.metric_date = d.metric_date
  LEFT JOIN assessment_daily ad ON ad.course_id = d.course_id AND ad.metric_date = d.metric_date
  LEFT JOIN event_daily ev ON ev.course_id = d.course_id AND ev.metric_date = d.metric_date
  ON CONFLICT (course_id, metric_date) DO UPDATE
  SET enrollments_started = EXCLUDED.enrollments_started,
      enrollments_completed = EXCLUDED.enrollments_completed,
      certificates_issued = EXCLUDED.certificates_issued,
      active_learners = EXCLUDED.active_learners,
      course_views = EXCLUDED.course_views,
      recommendation_enrollments = EXCLUDED.recommendation_enrollments,
      total_learning_minutes = EXCLUDED.total_learning_minutes,
      average_progress = EXCLUDED.average_progress,
      average_assessment_score = EXCLUDED.average_assessment_score,
      updated_at = NOW();

  INSERT INTO public.analytics_module_daily (
    module_id,
    course_id,
    metric_date,
    module_opens,
    completions,
    assessment_attempts,
    passed_attempts,
    failed_attempts,
    active_learners,
    average_score,
    pass_rate,
    failure_rate,
    average_time_spent_minutes,
    abandonment_rate,
    created_at,
    updated_at
  )
  WITH completion_daily AS (
    SELECT
      mc.module_id,
      m.course_id,
      COALESCE(mc.completed_at::date, e.updated_at::date, e.enrolled_at::date) AS metric_date,
      COUNT(*) FILTER (WHERE mc.completed_at IS NOT NULL) AS completions,
      COUNT(DISTINCT e.user_id) AS active_learners,
      AVG(COALESCE(mc.time_spent, 0)) AS average_time_spent_minutes
    FROM public.module_completions mc
    JOIN public.modules m ON m.id = mc.module_id
    JOIN public.enrollments e ON e.id = mc.enrollment_id
    WHERE p_user_id IS NULL OR e.user_id = p_user_id
    GROUP BY mc.module_id, m.course_id, COALESCE(mc.completed_at::date, e.updated_at::date, e.enrolled_at::date)
  ),
  assessment_daily AS (
    SELECT
      a.module_id,
      m.course_id,
      aa.submitted_at::date AS metric_date,
      COUNT(*) AS assessment_attempts,
      COUNT(*) FILTER (WHERE aa.passed = true) AS passed_attempts,
      COUNT(*) FILTER (WHERE aa.passed = false) AS failed_attempts,
      AVG(COALESCE(aa.score, 0)) FILTER (WHERE aa.score IS NOT NULL) AS average_score
    FROM public.assessment_attempts aa
    JOIN public.assessments a ON a.id = aa.assessment_id
    JOIN public.modules m ON m.id = a.module_id
    WHERE aa.submitted_at IS NOT NULL
      AND (p_user_id IS NULL OR aa.user_id = p_user_id)
    GROUP BY a.module_id, m.course_id, aa.submitted_at::date
  ),
  event_daily AS (
    SELECT
      ae.module_id,
      COALESCE(ae.course_id, m.course_id) AS course_id,
      ae.event_date AS metric_date,
      COUNT(*) FILTER (WHERE ae.event_name = 'module_open') AS module_opens
    FROM public.analytics_events ae
    LEFT JOIN public.modules m ON m.id = ae.module_id
    WHERE ae.module_id IS NOT NULL
      AND (p_user_id IS NULL OR ae.user_id = p_user_id)
    GROUP BY ae.module_id, COALESCE(ae.course_id, m.course_id), ae.event_date
  ),
  dates AS (
    SELECT module_id, course_id, metric_date FROM completion_daily
    UNION
    SELECT module_id, course_id, metric_date FROM assessment_daily
    UNION
    SELECT module_id, course_id, metric_date FROM event_daily
  )
  SELECT
    d.module_id,
    d.course_id,
    d.metric_date,
    COALESCE(ev.module_opens, 0),
    COALESCE(cd.completions, 0),
    COALESCE(ad.assessment_attempts, 0),
    COALESCE(ad.passed_attempts, 0),
    COALESCE(ad.failed_attempts, 0),
    COALESCE(cd.active_learners, 0),
    COALESCE(ad.average_score, 0),
    CASE WHEN COALESCE(ad.assessment_attempts, 0) > 0 THEN ROUND((COALESCE(ad.passed_attempts, 0)::NUMERIC / ad.assessment_attempts) * 100, 2) ELSE 0 END,
    CASE WHEN COALESCE(ad.assessment_attempts, 0) > 0 THEN ROUND((COALESCE(ad.failed_attempts, 0)::NUMERIC / ad.assessment_attempts) * 100, 2) ELSE 0 END,
    COALESCE(cd.average_time_spent_minutes, 0),
    CASE WHEN COALESCE(ev.module_opens, 0) > 0 THEN ROUND((GREATEST(ev.module_opens - COALESCE(cd.completions, 0), 0)::NUMERIC / ev.module_opens) * 100, 2) ELSE 0 END,
    NOW(),
    NOW()
  FROM dates d
  LEFT JOIN completion_daily cd ON cd.module_id = d.module_id AND cd.metric_date = d.metric_date
  LEFT JOIN assessment_daily ad ON ad.module_id = d.module_id AND ad.metric_date = d.metric_date
  LEFT JOIN event_daily ev ON ev.module_id = d.module_id AND ev.metric_date = d.metric_date
  ON CONFLICT (module_id, metric_date) DO UPDATE
  SET course_id = EXCLUDED.course_id,
      module_opens = EXCLUDED.module_opens,
      completions = EXCLUDED.completions,
      assessment_attempts = EXCLUDED.assessment_attempts,
      passed_attempts = EXCLUDED.passed_attempts,
      failed_attempts = EXCLUDED.failed_attempts,
      active_learners = EXCLUDED.active_learners,
      average_score = EXCLUDED.average_score,
      pass_rate = EXCLUDED.pass_rate,
      failure_rate = EXCLUDED.failure_rate,
      average_time_spent_minutes = EXCLUDED.average_time_spent_minutes,
      abandonment_rate = EXCLUDED.abandonment_rate,
      updated_at = NOW();

  INSERT INTO public.analytics_recommendation_daily (
    recommendation_id,
    user_id,
    course_id,
    metric_date,
    surface,
    impressions,
    clicks,
    accepts,
    enrollments,
    completions,
    ctr,
    accept_rate,
    created_at,
    updated_at
  )
  SELECT
    lr.id,
    lr.user_id,
    lr.course_id,
    ae.event_date,
    COALESCE(ae.surface, lr.source_surface),
    COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_impression'),
    COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_click'),
    COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_accept'),
    COUNT(*) FILTER (WHERE ae.event_name = 'course_enroll'),
    COUNT(*) FILTER (WHERE ae.event_name = 'course_complete'),
    CASE
      WHEN COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_impression') > 0
        THEN ROUND((COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_click')::NUMERIC / COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_impression')) * 100, 2)
      ELSE 0
    END,
    CASE
      WHEN COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_click') > 0
        THEN ROUND((COUNT(*) FILTER (WHERE ae.event_name IN ('recommendation_accept', 'course_enroll'))::NUMERIC / COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_click')) * 100, 2)
      ELSE 0
    END,
    NOW(),
    NOW()
  FROM public.learner_recommendations lr
  JOIN public.analytics_events ae ON ae.recommendation_id = lr.id
  WHERE p_user_id IS NULL OR lr.user_id = p_user_id
  GROUP BY lr.id, lr.user_id, lr.course_id, ae.event_date, COALESCE(ae.surface, lr.source_surface)
  ON CONFLICT (recommendation_id, metric_date, surface) DO UPDATE
  SET impressions = EXCLUDED.impressions,
      clicks = EXCLUDED.clicks,
      accepts = EXCLUDED.accepts,
      enrollments = EXCLUDED.enrollments,
      completions = EXCLUDED.completions,
      ctr = EXCLUDED.ctr,
      accept_rate = EXCLUDED.accept_rate,
      updated_at = NOW();

  INSERT INTO public.analytics_admin_daily (
    metric_date,
    total_enrollments,
    total_completions,
    active_learners,
    certificates_issued,
    recommendation_impressions,
    recommendation_clicks,
    recommendation_accepts,
    total_learning_minutes,
    average_assessment_score,
    created_at,
    updated_at
  )
  WITH scoped_dates AS (
    SELECT metric_date FROM public.analytics_user_daily WHERE p_user_id IS NULL OR user_id = p_user_id
  )
  SELECT
    d.metric_date,
    COALESCE(SUM(u.enrollments_started), 0),
    COALESCE(SUM(c.enrollments_completed), 0),
    COUNT(DISTINCT u.user_id),
    COALESCE(SUM(c.certificates_issued), 0),
    COALESCE(SUM(u.recommendation_impressions), 0),
    COALESCE(SUM(u.recommendation_clicks), 0),
    COALESCE(SUM(u.recommendation_accepts), 0),
    COALESCE(SUM(u.total_learning_minutes), 0),
    COALESCE(AVG(NULLIF(u.average_assessment_score, 0)), 0),
    NOW(),
    NOW()
  FROM scoped_dates d
  LEFT JOIN public.analytics_user_daily u ON u.metric_date = d.metric_date AND (p_user_id IS NULL OR u.user_id = p_user_id)
  LEFT JOIN public.analytics_course_daily c ON c.metric_date = d.metric_date
  GROUP BY d.metric_date
  ON CONFLICT (metric_date) DO UPDATE
  SET total_enrollments = EXCLUDED.total_enrollments,
      total_completions = EXCLUDED.total_completions,
      active_learners = EXCLUDED.active_learners,
      certificates_issued = EXCLUDED.certificates_issued,
      recommendation_impressions = EXCLUDED.recommendation_impressions,
      recommendation_clicks = EXCLUDED.recommendation_clicks,
      recommendation_accepts = EXCLUDED.recommendation_accepts,
      total_learning_minutes = EXCLUDED.total_learning_minutes,
      average_assessment_score = EXCLUDED.average_assessment_score,
      updated_at = NOW();

  INSERT INTO public.learner_skill_profiles (
    user_id,
    strongest_skill_tags,
    improvement_skill_tags,
    topic_summary,
    average_assessment_score,
    total_learning_minutes,
    modules_completed,
    generated_at,
    model_version,
    created_at,
    updated_at
  )
  WITH skill_stats AS (
    SELECT
      e.user_id,
      unnest(COALESCE(NULLIF(c.skill_tags, ARRAY[]::TEXT[]), c.skills, ARRAY[c.category])) AS skill_tag,
      AVG(COALESCE(aa.score, 0)) FILTER (WHERE aa.score IS NOT NULL) AS average_assessment_score,
      SUM(COALESCE(mc.time_spent, 0)) AS total_learning_minutes,
      COUNT(DISTINCT mc.id) FILTER (WHERE mc.completed_at IS NOT NULL) AS modules_completed
    FROM public.enrollments e
    JOIN public.courses c ON c.id = e.course_id
    LEFT JOIN public.module_completions mc ON mc.enrollment_id = e.id
    LEFT JOIN public.assessment_attempts aa ON aa.enrollment_id = e.id AND aa.submitted_at IS NOT NULL
    WHERE p_user_id IS NULL OR e.user_id = p_user_id
    GROUP BY e.user_id, unnest(COALESCE(NULLIF(c.skill_tags, ARRAY[]::TEXT[]), c.skills, ARRAY[c.category]))
  ),
  ranked AS (
    SELECT
      user_id,
      skill_tag,
      average_assessment_score,
      total_learning_minutes,
      modules_completed,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY average_assessment_score DESC NULLS LAST, modules_completed DESC, total_learning_minutes DESC) AS strongest_rank,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY average_assessment_score ASC NULLS LAST, modules_completed ASC, total_learning_minutes ASC) AS weakest_rank
    FROM skill_stats
  )
  SELECT
    user_id,
    ARRAY_REMOVE(ARRAY_AGG(skill_tag ORDER BY strongest_rank) FILTER (WHERE strongest_rank <= 3), NULL),
    ARRAY_REMOVE(ARRAY_AGG(skill_tag ORDER BY weakest_rank) FILTER (WHERE weakest_rank <= 3), NULL),
    jsonb_object_agg(
      skill_tag,
      jsonb_build_object(
        'averageAssessmentScore', ROUND(COALESCE(average_assessment_score, 0), 2),
        'totalLearningMinutes', COALESCE(total_learning_minutes, 0),
        'modulesCompleted', COALESCE(modules_completed, 0)
      )
    ),
    ROUND(COALESCE(AVG(average_assessment_score), 0), 2),
    COALESCE(SUM(total_learning_minutes), 0)::INTEGER,
    COALESCE(SUM(modules_completed), 0)::INTEGER,
    NOW(),
    'phase1-skill-profile-v1',
    NOW(),
    NOW()
  FROM ranked
  GROUP BY user_id
  ON CONFLICT (user_id) DO UPDATE
  SET strongest_skill_tags = EXCLUDED.strongest_skill_tags,
      improvement_skill_tags = EXCLUDED.improvement_skill_tags,
      topic_summary = EXCLUDED.topic_summary,
      average_assessment_score = EXCLUDED.average_assessment_score,
      total_learning_minutes = EXCLUDED.total_learning_minutes,
      modules_completed = EXCLUDED.modules_completed,
      generated_at = EXCLUDED.generated_at,
      model_version = EXCLUDED.model_version,
      updated_at = NOW();

  INSERT INTO public.module_quality_signals (
    module_id,
    course_id,
    snapshot_date,
    attempt_count,
    completion_count,
    average_score,
    pass_rate,
    average_time_spent_minutes,
    abandonment_rate,
    quality_score,
    risk_level,
    signal_summary,
    generated_at,
    created_at,
    updated_at
  )
  SELECT
    m.id,
    m.course_id,
    CURRENT_DATE,
    COALESCE(SUM(amd.assessment_attempts), 0),
    COALESCE(SUM(amd.completions), 0),
    ROUND(COALESCE(AVG(NULLIF(amd.average_score, 0)), 0), 2),
    ROUND(COALESCE(AVG(amd.pass_rate), 0), 2),
    ROUND(COALESCE(AVG(amd.average_time_spent_minutes), 0), 2),
    ROUND(COALESCE(AVG(amd.abandonment_rate), 0), 2),
    ROUND(
      GREATEST(0, LEAST(100,
        COALESCE(AVG(amd.pass_rate), 0) * 0.45
        + (100 - COALESCE(AVG(amd.abandonment_rate), 0)) * 0.35
        + COALESCE(AVG(amd.average_score), 0) * 0.20
      )),
      2
    ),
    CASE
      WHEN COALESCE(AVG(amd.abandonment_rate), 0) >= 50 OR COALESCE(AVG(amd.pass_rate), 0) < 40 THEN 'high'
      WHEN COALESCE(AVG(amd.abandonment_rate), 0) >= 25 OR COALESCE(AVG(amd.pass_rate), 0) < 60 THEN 'medium'
      ELSE 'low'
    END,
    jsonb_build_object(
      'averageScore', ROUND(COALESCE(AVG(NULLIF(amd.average_score, 0)), 0), 2),
      'passRate', ROUND(COALESCE(AVG(amd.pass_rate), 0), 2),
      'abandonmentRate', ROUND(COALESCE(AVG(amd.abandonment_rate), 0), 2)
    ),
    NOW(),
    NOW(),
    NOW()
  FROM public.modules m
  LEFT JOIN public.analytics_module_daily amd ON amd.module_id = m.id
  WHERE p_user_id IS NULL OR EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.course_id = m.course_id
      AND e.user_id = p_user_id
  )
  GROUP BY m.id, m.course_id
  ON CONFLICT (module_id, snapshot_date) DO UPDATE
  SET attempt_count = EXCLUDED.attempt_count,
      completion_count = EXCLUDED.completion_count,
      average_score = EXCLUDED.average_score,
      pass_rate = EXCLUDED.pass_rate,
      average_time_spent_minutes = EXCLUDED.average_time_spent_minutes,
      abandonment_rate = EXCLUDED.abandonment_rate,
      quality_score = EXCLUDED.quality_score,
      risk_level = EXCLUDED.risk_level,
      signal_summary = EXCLUDED.signal_summary,
      generated_at = EXCLUDED.generated_at,
      updated_at = NOW();

  INSERT INTO public.course_risk_scores (
    course_id,
    snapshot_date,
    active_enrollments,
    completed_enrollments,
    completion_rate,
    average_progress,
    average_time_spent_minutes,
    recommendation_acceptance_rate,
    risk_score,
    risk_level,
    score_summary,
    generated_at,
    created_at,
    updated_at
  )
  WITH acceptance AS (
    SELECT
      course_id,
      ROUND(COALESCE(AVG(accept_rate), 0), 2) AS recommendation_acceptance_rate
    FROM public.analytics_recommendation_daily
    GROUP BY course_id
  )
  SELECT
    c.id,
    CURRENT_DATE,
    COUNT(e.id) FILTER (WHERE e.status IN ('enrolled', 'in-progress')),
    COUNT(e.id) FILTER (WHERE e.status = 'completed' OR e.completed_at IS NOT NULL),
    CASE WHEN COUNT(e.id) > 0
      THEN ROUND((COUNT(e.id) FILTER (WHERE e.status = 'completed' OR e.completed_at IS NOT NULL)::NUMERIC / COUNT(e.id)) * 100, 2)
      ELSE 0 END,
    ROUND(COALESCE(AVG(COALESCE(e.progress, 0)), 0), 2),
    ROUND(COALESCE(AVG(COALESCE(acd.total_learning_minutes, 0)), 0), 2),
    COALESCE(a.recommendation_acceptance_rate, 0),
    ROUND(
      GREATEST(0, LEAST(100,
        100
        - (CASE WHEN COUNT(e.id) > 0 THEN (COUNT(e.id) FILTER (WHERE e.status = 'completed' OR e.completed_at IS NOT NULL)::NUMERIC / COUNT(e.id)) * 100 ELSE 0 END) * 0.55
        - COALESCE(AVG(COALESCE(e.progress, 0)), 0) * 0.25
        - COALESCE(a.recommendation_acceptance_rate, 0) * 0.20
      )),
      2
    ),
    CASE
      WHEN COUNT(e.id) = 0 THEN 'medium'
      WHEN (CASE WHEN COUNT(e.id) > 0 THEN (COUNT(e.id) FILTER (WHERE e.status = 'completed' OR e.completed_at IS NOT NULL)::NUMERIC / COUNT(e.id)) * 100 ELSE 0 END) < 35 THEN 'high'
      WHEN (CASE WHEN COUNT(e.id) > 0 THEN (COUNT(e.id) FILTER (WHERE e.status = 'completed' OR e.completed_at IS NOT NULL)::NUMERIC / COUNT(e.id)) * 100 ELSE 0 END) < 60 THEN 'medium'
      ELSE 'low'
    END,
    jsonb_build_object(
      'completionRate', CASE WHEN COUNT(e.id) > 0 THEN ROUND((COUNT(e.id) FILTER (WHERE e.status = 'completed' OR e.completed_at IS NOT NULL)::NUMERIC / COUNT(e.id)) * 100, 2) ELSE 0 END,
      'averageProgress', ROUND(COALESCE(AVG(COALESCE(e.progress, 0)), 0), 2),
      'recommendationAcceptanceRate', COALESCE(a.recommendation_acceptance_rate, 0)
    ),
    NOW(),
    NOW(),
    NOW()
  FROM public.courses c
  LEFT JOIN public.enrollments e ON e.course_id = c.id AND (p_user_id IS NULL OR e.user_id = p_user_id)
  LEFT JOIN public.analytics_course_daily acd ON acd.course_id = c.id
  LEFT JOIN acceptance a ON a.course_id = c.id
  GROUP BY c.id, a.recommendation_acceptance_rate
  ON CONFLICT (course_id, snapshot_date) DO UPDATE
  SET active_enrollments = EXCLUDED.active_enrollments,
      completed_enrollments = EXCLUDED.completed_enrollments,
      completion_rate = EXCLUDED.completion_rate,
      average_progress = EXCLUDED.average_progress,
      average_time_spent_minutes = EXCLUDED.average_time_spent_minutes,
      recommendation_acceptance_rate = EXCLUDED.recommendation_acceptance_rate,
      risk_score = EXCLUDED.risk_score,
      risk_level = EXCLUDED.risk_level,
      score_summary = EXCLUDED.score_summary,
      generated_at = EXCLUDED.generated_at,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_learner_recommendations_updated_at ON public.learner_recommendations;
CREATE TRIGGER update_learner_recommendations_updated_at
BEFORE UPDATE ON public.learner_recommendations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_analytics_user_daily_updated_at ON public.analytics_user_daily;
CREATE TRIGGER update_analytics_user_daily_updated_at
BEFORE UPDATE ON public.analytics_user_daily
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_analytics_course_daily_updated_at ON public.analytics_course_daily;
CREATE TRIGGER update_analytics_course_daily_updated_at
BEFORE UPDATE ON public.analytics_course_daily
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_analytics_module_daily_updated_at ON public.analytics_module_daily;
CREATE TRIGGER update_analytics_module_daily_updated_at
BEFORE UPDATE ON public.analytics_module_daily
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_analytics_recommendation_daily_updated_at ON public.analytics_recommendation_daily;
CREATE TRIGGER update_analytics_recommendation_daily_updated_at
BEFORE UPDATE ON public.analytics_recommendation_daily
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_analytics_admin_daily_updated_at ON public.analytics_admin_daily;
CREATE TRIGGER update_analytics_admin_daily_updated_at
BEFORE UPDATE ON public.analytics_admin_daily
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_learner_skill_profiles_updated_at ON public.learner_skill_profiles;
CREATE TRIGGER update_learner_skill_profiles_updated_at
BEFORE UPDATE ON public.learner_skill_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_module_quality_signals_updated_at ON public.module_quality_signals;
CREATE TRIGGER update_module_quality_signals_updated_at
BEFORE UPDATE ON public.module_quality_signals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_course_risk_scores_updated_at ON public.course_risk_scores;
CREATE TRIGGER update_course_risk_scores_updated_at
BEFORE UPDATE ON public.course_risk_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

GRANT EXECUTE ON FUNCTION public.track_analytics_event(TEXT, UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_phase1_analytics_rollups(UUID) TO authenticated, service_role;
