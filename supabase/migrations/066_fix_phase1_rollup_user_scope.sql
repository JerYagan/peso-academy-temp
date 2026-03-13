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
    session_count,
    session_learning_minutes,
    incomplete_sessions,
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
  session_daily AS (
    SELECT
      e.user_id,
      COALESCE(ms.last_seen_at::date, ms.started_at::date) AS metric_date,
      COUNT(*) AS session_count,
      COALESCE(SUM(COALESCE(ms.duration_seconds, 0)) / 60, 0)::INTEGER AS session_learning_minutes,
      COUNT(*) FILTER (WHERE ms.session_status IS DISTINCT FROM 'completed') AS incomplete_sessions,
      MAX(COALESCE(ms.last_seen_at, ms.started_at)) AS last_session_activity
    FROM public.module_sessions ms
    JOIN public.enrollments e ON e.id = ms.enrollment_id
    WHERE p_user_id IS NULL OR e.user_id = p_user_id
    GROUP BY e.user_id, COALESCE(ms.last_seen_at::date, ms.started_at::date)
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
      COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_refresh') AS recommendation_refreshes,
      MAX(ae.occurred_at) AS last_activity_at
    FROM public.analytics_events ae
    LEFT JOIN public.enrollments e ON e.id = ae.enrollment_id
    WHERE COALESCE(ae.user_id, e.user_id) IS NOT NULL
      AND (p_user_id IS NULL OR COALESCE(ae.user_id, e.user_id) = p_user_id)
    GROUP BY COALESCE(ae.user_id, e.user_id), ae.event_date
  ),
  dates AS (
    SELECT user_id, metric_date FROM enrollment_daily
    UNION
    SELECT user_id, metric_date FROM module_daily
    UNION
    SELECT user_id, metric_date FROM session_daily
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
    GREATEST(COALESCE(sd.session_learning_minutes, 0), COALESCE(md.module_minutes, 0)) + COALESCE(ad.assessment_minutes, 0),
    COALESCE(ed.average_progress, 0),
    CASE
      WHEN COALESCE(ed.enrollments_started, 0) > 0 THEN ROUND(COALESCE(md.modules_completed, 0)::NUMERIC / ed.enrollments_started, 2)
      ELSE COALESCE(md.modules_completed, 0)::NUMERIC
    END,
    COALESCE(ad.average_assessment_score, 0),
    CASE
      WHEN ev.last_activity_at IS NULL THEN sd.last_session_activity
      WHEN sd.last_session_activity IS NULL THEN ev.last_activity_at
      ELSE GREATEST(ev.last_activity_at, sd.last_session_activity)
    END,
    COALESCE(sd.session_count, 0),
    COALESCE(sd.session_learning_minutes, 0),
    COALESCE(sd.incomplete_sessions, 0),
    NOW(),
    NOW()
  FROM dates d
  LEFT JOIN enrollment_daily ed ON ed.user_id = d.user_id AND ed.metric_date = d.metric_date
  LEFT JOIN module_daily md ON md.user_id = d.user_id AND md.metric_date = d.metric_date
  LEFT JOIN session_daily sd ON sd.user_id = d.user_id AND sd.metric_date = d.metric_date
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
      session_count = EXCLUDED.session_count,
      session_learning_minutes = EXCLUDED.session_learning_minutes,
      incomplete_sessions = EXCLUDED.incomplete_sessions,
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
    session_count,
    session_learning_minutes,
    incomplete_sessions,
    revisit_rate,
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
      COUNT(DISTINCT c.id) AS certificates_issued
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
  session_by_learner_module AS (
    SELECT
      e.course_id,
      COALESCE(ms.last_seen_at::date, ms.started_at::date) AS metric_date,
      e.user_id,
      ms.module_id,
      COUNT(*) AS session_instances,
      COUNT(*) FILTER (WHERE ms.session_status IS DISTINCT FROM 'completed') AS incomplete_sessions,
      COALESCE(SUM(COALESCE(ms.duration_seconds, 0)) / 60, 0)::INTEGER AS session_learning_minutes
    FROM public.module_sessions ms
    JOIN scoped_enrollments e ON e.id = ms.enrollment_id
    GROUP BY e.course_id, COALESCE(ms.last_seen_at::date, ms.started_at::date), e.user_id, ms.module_id
  ),
  session_daily AS (
    SELECT
      course_id,
      metric_date,
      SUM(session_instances)::INTEGER AS session_count,
      SUM(session_learning_minutes)::INTEGER AS session_learning_minutes,
      SUM(incomplete_sessions)::INTEGER AS incomplete_sessions,
      COUNT(DISTINCT user_id) AS active_session_learners
    FROM session_by_learner_module
    GROUP BY course_id, metric_date
  ),
  course_revisit_daily AS (
    SELECT
      course_id,
      metric_date,
      CASE
        WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE session_instances > 1)::NUMERIC / COUNT(*)) * 100, 2)
        ELSE 0
      END AS revisit_rate
    FROM session_by_learner_module
    GROUP BY course_id, metric_date
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
    SELECT course_id, metric_date FROM session_daily
    UNION
    SELECT course_id, metric_date FROM course_revisit_daily
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
    GREATEST(COALESCE(ed.active_learners, 0), COALESCE(sd.active_session_learners, 0)),
    COALESCE(ev.course_views, 0),
    COALESCE(ev.recommendation_enrollments, 0),
    GREATEST(COALESCE(mt.total_learning_minutes, 0), COALESCE(sd.session_learning_minutes, 0)),
    COALESCE(ed.average_progress, 0),
    COALESCE(ad.average_assessment_score, 0),
    COALESCE(sd.session_count, 0),
    COALESCE(sd.session_learning_minutes, 0),
    COALESCE(sd.incomplete_sessions, 0),
    COALESCE(cr.revisit_rate, 0),
    NOW(),
    NOW()
  FROM dates d
  LEFT JOIN enrollment_daily ed ON ed.course_id = d.course_id AND ed.metric_date = d.metric_date
  LEFT JOIN completion_daily cd ON cd.course_id = d.course_id AND cd.metric_date = d.metric_date
  LEFT JOIN certificate_daily cert ON cert.course_id = d.course_id AND cert.metric_date = d.metric_date
  LEFT JOIN module_time_daily mt ON mt.course_id = d.course_id AND mt.metric_date = d.metric_date
  LEFT JOIN session_daily sd ON sd.course_id = d.course_id AND sd.metric_date = d.metric_date
  LEFT JOIN course_revisit_daily cr ON cr.course_id = d.course_id AND cr.metric_date = d.metric_date
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
      session_count = EXCLUDED.session_count,
      session_learning_minutes = EXCLUDED.session_learning_minutes,
      incomplete_sessions = EXCLUDED.incomplete_sessions,
      revisit_rate = EXCLUDED.revisit_rate,
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
    session_count,
    incomplete_sessions,
    revisit_rate,
    session_learning_minutes,
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
  session_by_user_daily AS (
    SELECT
      ms.module_id,
      m.course_id,
      COALESCE(ms.last_seen_at::date, ms.started_at::date) AS metric_date,
      e.user_id,
      COUNT(*) AS session_instances,
      COUNT(*) FILTER (WHERE ms.session_status IS DISTINCT FROM 'completed') AS incomplete_sessions,
      COALESCE(SUM(COALESCE(ms.duration_seconds, 0)) / 60, 0)::INTEGER AS duration_minutes
    FROM public.module_sessions ms
    JOIN public.modules m ON m.id = ms.module_id
    JOIN public.enrollments e ON e.id = ms.enrollment_id
    WHERE p_user_id IS NULL OR e.user_id = p_user_id
    GROUP BY ms.module_id, m.course_id, COALESCE(ms.last_seen_at::date, ms.started_at::date), e.user_id
  ),
  session_daily AS (
    SELECT
      module_id,
      course_id,
      metric_date,
      SUM(session_instances)::INTEGER AS session_count,
      COUNT(DISTINCT user_id) AS active_learners,
      ROUND(COALESCE(AVG(duration_minutes), 0), 2) AS average_session_minutes,
      SUM(incomplete_sessions)::INTEGER AS incomplete_sessions,
      SUM(duration_minutes)::INTEGER AS session_learning_minutes,
      CASE
        WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE session_instances > 1)::NUMERIC / COUNT(*)) * 100, 2)
        ELSE 0
      END AS revisit_rate
    FROM session_by_user_daily
    GROUP BY module_id, course_id, metric_date
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
    SELECT module_id, course_id, metric_date FROM session_daily
    UNION
    SELECT module_id, course_id, metric_date FROM event_daily
  )
  SELECT
    d.module_id,
    d.course_id,
    d.metric_date,
    GREATEST(COALESCE(ev.module_opens, 0), COALESCE(sd.session_count, 0)),
    COALESCE(cd.completions, 0),
    COALESCE(ad.assessment_attempts, 0),
    COALESCE(ad.passed_attempts, 0),
    COALESCE(ad.failed_attempts, 0),
    GREATEST(COALESCE(cd.active_learners, 0), COALESCE(sd.active_learners, 0)),
    COALESCE(ad.average_score, 0),
    CASE WHEN COALESCE(ad.assessment_attempts, 0) > 0 THEN ROUND((COALESCE(ad.passed_attempts, 0)::NUMERIC / ad.assessment_attempts) * 100, 2) ELSE 0 END,
    CASE WHEN COALESCE(ad.assessment_attempts, 0) > 0 THEN ROUND((COALESCE(ad.failed_attempts, 0)::NUMERIC / ad.assessment_attempts) * 100, 2) ELSE 0 END,
    COALESCE(sd.average_session_minutes, cd.average_time_spent_minutes, 0),
    CASE
      WHEN COALESCE(sd.session_count, 0) > 0 THEN ROUND((COALESCE(sd.incomplete_sessions, 0)::NUMERIC / sd.session_count) * 100, 2)
      WHEN COALESCE(ev.module_opens, 0) > 0 THEN ROUND((GREATEST(ev.module_opens - COALESCE(cd.completions, 0), 0)::NUMERIC / ev.module_opens) * 100, 2)
      ELSE 0
    END,
    COALESCE(sd.session_count, 0),
    COALESCE(sd.incomplete_sessions, 0),
    COALESCE(sd.revisit_rate, 0),
    COALESCE(sd.session_learning_minutes, 0),
    NOW(),
    NOW()
  FROM dates d
  LEFT JOIN completion_daily cd ON cd.module_id = d.module_id AND cd.metric_date = d.metric_date
  LEFT JOIN assessment_daily ad ON ad.module_id = d.module_id AND ad.metric_date = d.metric_date
  LEFT JOIN session_daily sd ON sd.module_id = d.module_id AND sd.metric_date = d.metric_date
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
      session_count = EXCLUDED.session_count,
      incomplete_sessions = EXCLUDED.incomplete_sessions,
      revisit_rate = EXCLUDED.revisit_rate,
      session_learning_minutes = EXCLUDED.session_learning_minutes,
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
    refreshes,
    downstream_module_sessions,
    downstream_assessments,
    downstream_learning_minutes,
    created_at,
    updated_at
  )
  WITH scoped_recommendations AS (
    SELECT *
    FROM public.learner_recommendations
    WHERE p_user_id IS NULL OR user_id = p_user_id
  ),
  event_daily AS (
    SELECT
      lr.id AS recommendation_id,
      lr.user_id,
      lr.course_id,
      ae.event_date AS metric_date,
      COALESCE(ae.surface, lr.source_surface) AS surface,
      COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_impression') AS impressions,
      COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_click') AS clicks,
      COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_accept') AS accepts,
      COUNT(*) FILTER (WHERE ae.event_name = 'recommendation_refresh') AS refreshes
    FROM scoped_recommendations lr
    JOIN public.analytics_events ae ON ae.recommendation_id = lr.id
    GROUP BY lr.id, lr.user_id, lr.course_id, ae.event_date, COALESCE(ae.surface, lr.source_surface)
  ),
  enrollment_daily AS (
    SELECT
      lr.id AS recommendation_id,
      lr.user_id,
      lr.course_id,
      e.enrolled_at::date AS metric_date,
      lr.source_surface AS surface,
      COUNT(*) AS enrollments
    FROM public.enrollments e
    JOIN scoped_recommendations lr ON lr.id = e.originating_recommendation_id
    GROUP BY lr.id, lr.user_id, lr.course_id, e.enrolled_at::date, lr.source_surface
  ),
  completion_daily AS (
    SELECT
      lr.id AS recommendation_id,
      lr.user_id,
      lr.course_id,
      e.completed_at::date AS metric_date,
      lr.source_surface AS surface,
      COUNT(*) AS completions
    FROM public.enrollments e
    JOIN scoped_recommendations lr ON lr.id = e.originating_recommendation_id
    WHERE e.completed_at IS NOT NULL OR e.status = 'completed'
    GROUP BY lr.id, lr.user_id, lr.course_id, e.completed_at::date, lr.source_surface
  ),
  downstream_session_daily AS (
    SELECT
      lr.id AS recommendation_id,
      lr.user_id,
      lr.course_id,
      COALESCE(ms.last_seen_at::date, ms.started_at::date) AS metric_date,
      lr.source_surface AS surface,
      COUNT(*) AS downstream_module_sessions,
      COALESCE(SUM(COALESCE(ms.duration_seconds, 0)) / 60, 0)::INTEGER AS downstream_learning_minutes
    FROM public.module_sessions ms
    JOIN public.enrollments e ON e.id = ms.enrollment_id
    JOIN scoped_recommendations lr ON lr.id = e.originating_recommendation_id
    GROUP BY lr.id, lr.user_id, lr.course_id, COALESCE(ms.last_seen_at::date, ms.started_at::date), lr.source_surface
  ),
  downstream_assessment_daily AS (
    SELECT
      lr.id AS recommendation_id,
      lr.user_id,
      lr.course_id,
      aa.submitted_at::date AS metric_date,
      lr.source_surface AS surface,
      COUNT(*) AS downstream_assessments
    FROM public.assessment_attempts aa
    JOIN public.enrollments e ON e.id = aa.enrollment_id
    JOIN scoped_recommendations lr ON lr.id = e.originating_recommendation_id
    WHERE aa.submitted_at IS NOT NULL
    GROUP BY lr.id, lr.user_id, lr.course_id, aa.submitted_at::date, lr.source_surface
  ),
  dates AS (
    SELECT recommendation_id, user_id, course_id, metric_date, surface FROM event_daily
    UNION
    SELECT recommendation_id, user_id, course_id, metric_date, surface FROM enrollment_daily
    UNION
    SELECT recommendation_id, user_id, course_id, metric_date, surface FROM completion_daily
    UNION
    SELECT recommendation_id, user_id, course_id, metric_date, surface FROM downstream_session_daily
    UNION
    SELECT recommendation_id, user_id, course_id, metric_date, surface FROM downstream_assessment_daily
  )
  SELECT
    d.recommendation_id,
    d.user_id,
    d.course_id,
    d.metric_date,
    d.surface,
    COALESCE(ev.impressions, 0),
    COALESCE(ev.clicks, 0),
    COALESCE(ev.accepts, 0),
    COALESCE(enr.enrollments, 0),
    COALESCE(comp.completions, 0),
    CASE
      WHEN COALESCE(ev.impressions, 0) > 0 THEN ROUND((COALESCE(ev.clicks, 0)::NUMERIC / ev.impressions) * 100, 2)
      ELSE 0
    END,
    CASE
      WHEN COALESCE(ev.clicks, 0) > 0 THEN ROUND(((COALESCE(ev.accepts, 0) + COALESCE(enr.enrollments, 0))::NUMERIC / ev.clicks) * 100, 2)
      ELSE 0
    END,
    COALESCE(ev.refreshes, 0),
    COALESCE(ds.downstream_module_sessions, 0),
    COALESCE(da.downstream_assessments, 0),
    COALESCE(ds.downstream_learning_minutes, 0),
    NOW(),
    NOW()
  FROM dates d
  LEFT JOIN event_daily ev
    ON ev.recommendation_id = d.recommendation_id AND ev.metric_date = d.metric_date AND ev.surface = d.surface
  LEFT JOIN enrollment_daily enr
    ON enr.recommendation_id = d.recommendation_id AND enr.metric_date = d.metric_date AND enr.surface = d.surface
  LEFT JOIN completion_daily comp
    ON comp.recommendation_id = d.recommendation_id AND comp.metric_date = d.metric_date AND comp.surface = d.surface
  LEFT JOIN downstream_session_daily ds
    ON ds.recommendation_id = d.recommendation_id AND ds.metric_date = d.metric_date AND ds.surface = d.surface
  LEFT JOIN downstream_assessment_daily da
    ON da.recommendation_id = d.recommendation_id AND da.metric_date = d.metric_date AND da.surface = d.surface
  ON CONFLICT (recommendation_id, metric_date, surface) DO UPDATE
  SET impressions = EXCLUDED.impressions,
      clicks = EXCLUDED.clicks,
      accepts = EXCLUDED.accepts,
      enrollments = EXCLUDED.enrollments,
      completions = EXCLUDED.completions,
      ctr = EXCLUDED.ctr,
      accept_rate = EXCLUDED.accept_rate,
      refreshes = EXCLUDED.refreshes,
      downstream_module_sessions = EXCLUDED.downstream_module_sessions,
      downstream_assessments = EXCLUDED.downstream_assessments,
      downstream_learning_minutes = EXCLUDED.downstream_learning_minutes,
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
    session_count,
    session_learning_minutes,
    incomplete_sessions,
    recommendation_refreshes,
    downstream_recommendation_sessions,
    created_at,
    updated_at
  )
  WITH user_agg AS (
    SELECT
      metric_date,
      SUM(enrollments_started) AS total_enrollments,
      COUNT(DISTINCT user_id) AS active_learners,
      SUM(recommendation_impressions) AS recommendation_impressions,
      SUM(recommendation_clicks) AS recommendation_clicks,
      SUM(recommendation_accepts) AS recommendation_accepts,
      SUM(total_learning_minutes) AS total_learning_minutes,
      AVG(NULLIF(average_assessment_score, 0)) AS average_assessment_score,
      SUM(session_count) AS session_count,
      SUM(session_learning_minutes) AS session_learning_minutes,
      SUM(incomplete_sessions) AS incomplete_sessions
    FROM public.analytics_user_daily
    WHERE p_user_id IS NULL OR user_id = p_user_id
    GROUP BY metric_date
  ),
  course_agg AS (
    SELECT
      metric_date,
      SUM(enrollments_completed) AS total_completions,
      SUM(certificates_issued) AS certificates_issued
    FROM public.analytics_course_daily
    WHERE p_user_id IS NULL OR course_id IN (
      SELECT DISTINCT course_id FROM public.enrollments WHERE user_id = p_user_id
    )
    GROUP BY metric_date
  ),
  recommendation_agg AS (
    SELECT
      metric_date,
      SUM(refreshes) AS recommendation_refreshes,
      SUM(downstream_module_sessions) AS downstream_recommendation_sessions
    FROM public.analytics_recommendation_daily
    WHERE p_user_id IS NULL OR user_id = p_user_id
    GROUP BY metric_date
  ),
  dates AS (
    SELECT metric_date FROM user_agg
    UNION
    SELECT metric_date FROM course_agg
    UNION
    SELECT metric_date FROM recommendation_agg
  )
  SELECT
    d.metric_date,
    COALESCE(u.total_enrollments, 0),
    COALESCE(c.total_completions, 0),
    COALESCE(u.active_learners, 0),
    COALESCE(c.certificates_issued, 0),
    COALESCE(u.recommendation_impressions, 0),
    COALESCE(u.recommendation_clicks, 0),
    COALESCE(u.recommendation_accepts, 0),
    COALESCE(u.total_learning_minutes, 0),
    COALESCE(u.average_assessment_score, 0),
    COALESCE(u.session_count, 0),
    COALESCE(u.session_learning_minutes, 0),
    COALESCE(u.incomplete_sessions, 0),
    COALESCE(r.recommendation_refreshes, 0),
    COALESCE(r.downstream_recommendation_sessions, 0),
    NOW(),
    NOW()
  FROM dates d
  LEFT JOIN user_agg u ON u.metric_date = d.metric_date
  LEFT JOIN course_agg c ON c.metric_date = d.metric_date
  LEFT JOIN recommendation_agg r ON r.metric_date = d.metric_date
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
      session_count = EXCLUDED.session_count,
      session_learning_minutes = EXCLUDED.session_learning_minutes,
      incomplete_sessions = EXCLUDED.incomplete_sessions,
      recommendation_refreshes = EXCLUDED.recommendation_refreshes,
      downstream_recommendation_sessions = EXCLUDED.downstream_recommendation_sessions,
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
    'phase2-session-rollups-v1',
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
      'abandonmentRate', ROUND(COALESCE(AVG(amd.abandonment_rate), 0), 2),
      'revisitRate', ROUND(COALESCE(AVG(amd.revisit_rate), 0), 2),
      'sessionCount', COALESCE(SUM(amd.session_count), 0),
      'incompleteSessions', COALESCE(SUM(amd.incomplete_sessions), 0)
    ),
    NOW(),
    NOW(),
    NOW()
  FROM public.modules m
  LEFT JOIN public.analytics_module_daily amd ON amd.module_id = m.id
  WHERE p_user_id IS NULL OR m.course_id IN (
    SELECT DISTINCT course_id FROM public.enrollments WHERE user_id = p_user_id
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
  WITH scoped_courses AS (
    SELECT c.id
    FROM public.courses c
    WHERE p_user_id IS NULL OR c.id IN (
      SELECT DISTINCT course_id FROM public.enrollments WHERE user_id = p_user_id
    )
  ),
  acceptance AS (
    SELECT
      course_id,
      ROUND(COALESCE(AVG(accept_rate), 0), 2) AS recommendation_acceptance_rate
    FROM public.analytics_recommendation_daily
    WHERE p_user_id IS NULL OR user_id = p_user_id
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
      'recommendationAcceptanceRate', COALESCE(a.recommendation_acceptance_rate, 0),
      'averageRevisitRate', ROUND(COALESCE(AVG(acd.revisit_rate), 0), 2),
      'incompleteSessions', COALESCE(SUM(acd.incomplete_sessions), 0)
    ),
    NOW(),
    NOW(),
    NOW()
  FROM scoped_courses c
  LEFT JOIN public.enrollments e ON e.course_id = c.id
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