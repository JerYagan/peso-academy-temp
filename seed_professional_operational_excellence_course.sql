-- Seed content for the existing course:
-- Professional and Operational Excellence
-- Course ID: f2cfc98f-8ff2-49fd-8d7b-61db0e67f449
--
-- What this script does:
-- - Ensures the target course exists.
-- - Upserts 3 finalized modules with inline practice quiz blocks in modules.content.
-- - Upserts 3 standalone graded assessments scoped to the course.
-- - Rewrites assessment questions on every run so the seed stays deterministic.

DO $seed$
DECLARE
  v_course_id uuid := 'f2cfc98f-8ff2-49fd-8d7b-61db0e67f449';
  v_now timestamptz := timezone('utc', now());

  v_module_1_id uuid;
  v_module_2_id uuid;
  v_module_3_id uuid;

  v_assessment_1_id uuid;
  v_assessment_2_id uuid;
  v_assessment_3_id uuid;

  v_has_assessment_prerequisite_module_ids boolean;
  v_has_assessment_derived_from_module_quiz boolean;
  v_has_assessment_display_order boolean;

  v_sql text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.courses
    WHERE id = v_course_id
  ) THEN
    RAISE EXCEPTION 'Course % does not exist. Create the course row first, then rerun this seed.', v_course_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assessments'
      AND column_name = 'prerequisite_module_ids'
  )
  INTO v_has_assessment_prerequisite_module_ids;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assessments'
      AND column_name = 'derived_from_module_quiz'
  )
  INTO v_has_assessment_derived_from_module_quiz;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assessments'
      AND column_name = 'display_order'
  )
  INTO v_has_assessment_display_order;

  SELECT id
  INTO v_module_1_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Operational Service Standards and Workflow Discipline'
  LIMIT 1;

  IF v_module_1_id IS NULL THEN
    INSERT INTO public.modules (
      course_id,
      title,
      description,
      "order",
      content,
      materials,
      prerequisites,
      status,
      created_at,
      updated_at
    )
    VALUES (
      v_course_id,
      'Operational Service Standards and Workflow Discipline',
      'Introduce service standards, consistent workflows, and accountability habits that improve day-to-day operational execution.',
      1,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'ops-standards-text',
          'type', 'text',
          'title', 'Why workflow discipline matters',
          'content', $html$<p>Operational excellence depends on repeatable service standards, clear task ownership, and documented workflows. Teams perform more consistently when each step is visible, measured, and reviewed.</p><p>Start by defining the expected output, the service time target, and the handoff point for every routine activity.</p>$html$
        ),
        jsonb_build_object(
          'id', 'ops-standards-material',
          'type', 'learning_material',
          'title', 'Service standard checklist',
          'content', '',
          'materialUrl', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
        ),
        jsonb_build_object(
          'id', 'ops-standards-quiz',
          'type', 'quiz',
          'title', 'Workflow discipline check',
          'content', 'Which practice most directly improves workflow discipline in daily operations?',
          'options', jsonb_build_array(
            'Documenting task steps and ownership clearly',
            'Changing the process every day without review',
            'Skipping service targets to move faster',
            'Leaving handoffs informal and untracked'
          ),
          'correctAnswer', 0,
          'explanation', 'Clear workflow steps and ownership reduce confusion, delays, and avoidable errors.'
        )
      )::text,
      ARRAY[
        'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      ]::text[],
      ARRAY[]::uuid[],
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_1_id;
  ELSE
    UPDATE public.modules
    SET description = 'Introduce service standards, consistent workflows, and accountability habits that improve day-to-day operational execution.',
        "order" = 1,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'ops-standards-text',
            'type', 'text',
            'title', 'Why workflow discipline matters',
            'content', $html$<p>Operational excellence depends on repeatable service standards, clear task ownership, and documented workflows. Teams perform more consistently when each step is visible, measured, and reviewed.</p><p>Start by defining the expected output, the service time target, and the handoff point for every routine activity.</p>$html$
          ),
          jsonb_build_object(
            'id', 'ops-standards-material',
            'type', 'learning_material',
            'title', 'Service standard checklist',
            'content', '',
            'materialUrl', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
          ),
          jsonb_build_object(
            'id', 'ops-standards-quiz',
            'type', 'quiz',
            'title', 'Workflow discipline check',
            'content', 'Which practice most directly improves workflow discipline in daily operations?',
            'options', jsonb_build_array(
              'Documenting task steps and ownership clearly',
              'Changing the process every day without review',
              'Skipping service targets to move faster',
              'Leaving handoffs informal and untracked'
            ),
            'correctAnswer', 0,
            'explanation', 'Clear workflow steps and ownership reduce confusion, delays, and avoidable errors.'
          )
        )::text,
        materials = ARRAY[
          'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
        ]::text[],
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_1_id;
  END IF;

  SELECT id
  INTO v_module_2_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Data-Driven Monitoring and Performance Decisions'
  LIMIT 1;

  IF v_module_2_id IS NULL THEN
    INSERT INTO public.modules (
      course_id,
      title,
      description,
      "order",
      content,
      materials,
      prerequisites,
      status,
      created_at,
      updated_at
    )
    VALUES (
      v_course_id,
      'Data-Driven Monitoring and Performance Decisions',
      'Use service metrics, simple dashboards, and escalation signals to make better operational decisions.',
      2,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'ops-metrics-text',
          'type', 'text',
          'title', 'Measure what affects service delivery',
          'content', $html$<p>Operational teams need a small set of reliable indicators such as turnaround time, backlog size, completion rate, and common failure points. Metrics become useful only when they guide a practical action.</p><p>Review trends regularly and escalate recurring bottlenecks before they affect more clients or internal teams.</p>$html$
        ),
        jsonb_build_object(
          'id', 'ops-metrics-code',
          'type', 'code',
          'title', 'Daily monitoring prompt',
          'language', 'plaintext',
          'content', '1. Check backlog volume\n2. Compare turnaround time against target\n3. Identify delayed cases\n4. Assign corrective action owner\n5. Set the next review time'
        ),
        jsonb_build_object(
          'id', 'ops-metrics-quiz',
          'type', 'quiz',
          'title', 'Metrics and action check',
          'content', 'What makes an operational metric useful for decision-making?',
          'options', jsonb_build_array(
            'It leads to a clear action or follow-up decision',
            'It looks impressive but is never reviewed',
            'It replaces all team discussion automatically',
            'It only tracks activities with no service impact'
          ),
          'correctAnswer', 0,
          'explanation', 'Metrics should support action, prioritization, and improvement decisions.'
        )
      )::text,
      ARRAY[
        'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      ]::text[],
      ARRAY[]::uuid[],
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_2_id;
  ELSE
    UPDATE public.modules
    SET description = 'Use service metrics, simple dashboards, and escalation signals to make better operational decisions.',
        "order" = 2,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'ops-metrics-text',
            'type', 'text',
            'title', 'Measure what affects service delivery',
            'content', $html$<p>Operational teams need a small set of reliable indicators such as turnaround time, backlog size, completion rate, and common failure points. Metrics become useful only when they guide a practical action.</p><p>Review trends regularly and escalate recurring bottlenecks before they affect more clients or internal teams.</p>$html$
          ),
          jsonb_build_object(
            'id', 'ops-metrics-code',
            'type', 'code',
            'title', 'Daily monitoring prompt',
            'language', 'plaintext',
            'content', '1. Check backlog volume\n2. Compare turnaround time against target\n3. Identify delayed cases\n4. Assign corrective action owner\n5. Set the next review time'
          ),
          jsonb_build_object(
            'id', 'ops-metrics-quiz',
            'type', 'quiz',
            'title', 'Metrics and action check',
            'content', 'What makes an operational metric useful for decision-making?',
            'options', jsonb_build_array(
              'It leads to a clear action or follow-up decision',
              'It looks impressive but is never reviewed',
              'It replaces all team discussion automatically',
              'It only tracks activities with no service impact'
            ),
            'correctAnswer', 0,
            'explanation', 'Metrics should support action, prioritization, and improvement decisions.'
          )
        )::text,
        materials = ARRAY[
          'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
        ]::text[],
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_2_id;
  END IF;

  SELECT id
  INTO v_module_3_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Customer-Centered Communication and Continuous Improvement'
  LIMIT 1;

  IF v_module_3_id IS NULL THEN
    INSERT INTO public.modules (
      course_id,
      title,
      description,
      "order",
      content,
      materials,
      prerequisites,
      status,
      created_at,
      updated_at
    )
    VALUES (
      v_course_id,
      'Customer-Centered Communication and Continuous Improvement',
      'Strengthen communication, issue handling, and continuous-improvement habits that support reliable public service delivery.',
      3,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'ops-communication-text',
          'type', 'text',
          'title', 'Communicate clearly and improve continuously',
          'content', $html$<p>Operational excellence is visible in how teams explain delays, manage expectations, and learn from recurring issues. Clear communication reduces repeat inquiries and supports trust.</p><p>Continuous improvement starts with short review loops, root-cause analysis, and small changes that remove friction from the client experience.</p>$html$
        ),
        jsonb_build_object(
          'id', 'ops-communication-video',
          'type', 'video',
          'title', 'Continuous improvement briefing',
          'content', '',
          'videoUrl', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        ),
        jsonb_build_object(
          'id', 'ops-communication-quiz',
          'type', 'quiz',
          'title', 'Service communication check',
          'content', 'Which response best supports customer-centered operational service?',
          'options', jsonb_build_array(
            'Explain the status, next step, and expected update time',
            'Provide no timeline and wait for another complaint',
            'Escalate every issue without context',
            'Hide process issues from the team'
          ),
          'correctAnswer', 0,
          'explanation', 'Good operational communication makes status, ownership, and next actions clear.'
        )
      )::text,
      ARRAY[
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      ]::text[],
      ARRAY[]::uuid[],
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_3_id;
  ELSE
    UPDATE public.modules
    SET description = 'Strengthen communication, issue handling, and continuous-improvement habits that support reliable public service delivery.',
        "order" = 3,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'ops-communication-text',
            'type', 'text',
            'title', 'Communicate clearly and improve continuously',
            'content', $html$<p>Operational excellence is visible in how teams explain delays, manage expectations, and learn from recurring issues. Clear communication reduces repeat inquiries and supports trust.</p><p>Continuous improvement starts with short review loops, root-cause analysis, and small changes that remove friction from the client experience.</p>$html$
          ),
          jsonb_build_object(
            'id', 'ops-communication-video',
            'type', 'video',
            'title', 'Continuous improvement briefing',
            'content', '',
            'videoUrl', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
          ),
          jsonb_build_object(
            'id', 'ops-communication-quiz',
            'type', 'quiz',
            'title', 'Service communication check',
            'content', 'Which response best supports customer-centered operational service?',
            'options', jsonb_build_array(
              'Explain the status, next step, and expected update time',
              'Provide no timeline and wait for another complaint',
              'Escalate every issue without context',
              'Hide process issues from the team'
            ),
            'correctAnswer', 0,
            'explanation', 'Good operational communication makes status, ownership, and next actions clear.'
          )
        )::text,
        materials = ARRAY[
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        ]::text[],
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_3_id;
  END IF;

  UPDATE public.modules
  SET prerequisites = ARRAY[]::uuid[],
      updated_at = v_now
  WHERE id = v_module_1_id;

  UPDATE public.modules
  SET prerequisites = ARRAY[v_module_1_id],
      updated_at = v_now
  WHERE id = v_module_2_id;

  UPDATE public.modules
  SET prerequisites = ARRAY[v_module_1_id, v_module_2_id],
      updated_at = v_now
  WHERE id = v_module_3_id;

  SELECT id
  INTO v_assessment_1_id
  FROM public.assessments
  WHERE (course_id = v_course_id AND title = 'Operational Workflow Discipline Assessment')
     OR module_id = v_module_1_id
  ORDER BY CASE WHEN course_id = v_course_id AND title = 'Operational Workflow Discipline Assessment' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_assessment_1_id IS NULL THEN
    v_sql :=
      'INSERT INTO public.assessments (course_id, module_id, title, description, time_limit, passing_score, max_attempts, is_active';

    IF v_has_assessment_prerequisite_module_ids THEN
      v_sql := v_sql || ', prerequisite_module_ids';
    END IF;

    IF v_has_assessment_derived_from_module_quiz THEN
      v_sql := v_sql || ', derived_from_module_quiz';
    END IF;

    IF v_has_assessment_display_order THEN
      v_sql := v_sql || ', display_order';
    END IF;

    v_sql := v_sql || ', created_at, updated_at) VALUES ('
      || quote_literal(v_course_id) || '::uuid, '
      || 'NULL, '
      || quote_literal('Operational Workflow Discipline Assessment') || ', '
      || quote_literal('Evaluate understanding of service standards, process visibility, and ownership discipline.') || ', '
      || '12, 75, 3, true';

    IF v_has_assessment_prerequisite_module_ids THEN
      v_sql := v_sql || ', ' || quote_literal(ARRAY[v_module_1_id]) || '::uuid[]';
    END IF;

    IF v_has_assessment_derived_from_module_quiz THEN
      v_sql := v_sql || ', false';
    END IF;

    IF v_has_assessment_display_order THEN
      v_sql := v_sql || ', 1';
    END IF;

    v_sql := v_sql || ', '
      || quote_literal(v_now) || '::timestamptz, '
      || quote_literal(v_now) || '::timestamptz) RETURNING id';

    EXECUTE v_sql INTO v_assessment_1_id;
  ELSE
    v_sql :=
      'UPDATE public.assessments SET '
      || 'course_id = ' || quote_literal(v_course_id) || '::uuid, '
      || 'module_id = NULL, '
      || 'title = ' || quote_literal('Operational Workflow Discipline Assessment') || ', '
      || 'description = ' || quote_literal('Evaluate understanding of service standards, process visibility, and ownership discipline.') || ', '
      || 'time_limit = 12, '
      || 'passing_score = 75, '
      || 'max_attempts = 3, '
      || 'is_active = true';

    IF v_has_assessment_prerequisite_module_ids THEN
      v_sql := v_sql || ', prerequisite_module_ids = ' || quote_literal(ARRAY[v_module_1_id]) || '::uuid[]';
    END IF;

    IF v_has_assessment_derived_from_module_quiz THEN
      v_sql := v_sql || ', derived_from_module_quiz = false';
    END IF;

    IF v_has_assessment_display_order THEN
      v_sql := v_sql || ', display_order = 1';
    END IF;

    v_sql := v_sql
      || ', updated_at = ' || quote_literal(v_now) || '::timestamptz '
      || 'WHERE id = ' || quote_literal(v_assessment_1_id) || '::uuid';

    EXECUTE v_sql;
  END IF;

  DELETE FROM public.assessment_questions
  WHERE assessment_id = v_assessment_1_id;

  INSERT INTO public.assessment_questions (
    assessment_id,
    question,
    question_type,
    options,
    correct_answer,
    points,
    "order",
    explanation,
    is_active,
    created_at
  )
  VALUES
    (
      v_assessment_1_id,
      'Which action best strengthens workflow discipline in routine service operations?',
      'multiple_choice',
      to_jsonb(ARRAY[
        'Define task steps, owners, and handoff points clearly',
        'Allow every staff member to invent a new flow daily',
        'Remove service standards when volume increases',
        'Track issues only when a complaint is filed'
      ]::text[]),
      'Define task steps, owners, and handoff points clearly',
      2,
      1,
      'Clear ownership and handoffs are the foundation of repeatable operations.',
      true,
      v_now
    ),
    (
      v_assessment_1_id,
      'True or false: Service standards are only useful for new staff and do not affect experienced teams.',
      'true_false',
      NULL,
      'false',
      1,
      2,
      'Standards improve consistency for the whole team, not only for onboarding.',
      true,
      v_now
    ),
    (
      v_assessment_1_id,
      'Why should handoff points be documented in an operational workflow?',
      'multiple_choice',
      to_jsonb(ARRAY[
        'They reduce delays and confusion between steps',
        'They eliminate the need to review service quality',
        'They make accountability impossible to assign',
        'They only matter for financial reports'
      ]::text[]),
      'They reduce delays and confusion between steps',
      2,
      3,
      'Documented handoffs keep work moving and make responsibility visible.',
      true,
      v_now
    );

  SELECT id
  INTO v_assessment_2_id
  FROM public.assessments
  WHERE (course_id = v_course_id AND title = 'Performance Monitoring and Decision Assessment')
     OR module_id = v_module_2_id
  ORDER BY CASE WHEN course_id = v_course_id AND title = 'Performance Monitoring and Decision Assessment' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_assessment_2_id IS NULL THEN
    v_sql :=
      'INSERT INTO public.assessments (course_id, module_id, title, description, time_limit, passing_score, max_attempts, is_active';

    IF v_has_assessment_prerequisite_module_ids THEN
      v_sql := v_sql || ', prerequisite_module_ids';
    END IF;

    IF v_has_assessment_derived_from_module_quiz THEN
      v_sql := v_sql || ', derived_from_module_quiz';
    END IF;

    IF v_has_assessment_display_order THEN
      v_sql := v_sql || ', display_order';
    END IF;

    v_sql := v_sql || ', created_at, updated_at) VALUES ('
      || quote_literal(v_course_id) || '::uuid, '
      || 'NULL, '
      || quote_literal('Performance Monitoring and Decision Assessment') || ', '
      || quote_literal('Check whether learners can interpret simple operational metrics and act on bottlenecks.') || ', '
      || '15, 75, 3, true';

    IF v_has_assessment_prerequisite_module_ids THEN
      v_sql := v_sql || ', ' || quote_literal(ARRAY[v_module_2_id]) || '::uuid[]';
    END IF;

    IF v_has_assessment_derived_from_module_quiz THEN
      v_sql := v_sql || ', false';
    END IF;

    IF v_has_assessment_display_order THEN
      v_sql := v_sql || ', 2';
    END IF;

    v_sql := v_sql || ', '
      || quote_literal(v_now) || '::timestamptz, '
      || quote_literal(v_now) || '::timestamptz) RETURNING id';

    EXECUTE v_sql INTO v_assessment_2_id;
  ELSE
    v_sql :=
      'UPDATE public.assessments SET '
      || 'course_id = ' || quote_literal(v_course_id) || '::uuid, '
      || 'module_id = NULL, '
      || 'title = ' || quote_literal('Performance Monitoring and Decision Assessment') || ', '
      || 'description = ' || quote_literal('Check whether learners can interpret simple operational metrics and act on bottlenecks.') || ', '
      || 'time_limit = 15, '
      || 'passing_score = 75, '
      || 'max_attempts = 3, '
      || 'is_active = true';

    IF v_has_assessment_prerequisite_module_ids THEN
      v_sql := v_sql || ', prerequisite_module_ids = ' || quote_literal(ARRAY[v_module_2_id]) || '::uuid[]';
    END IF;

    IF v_has_assessment_derived_from_module_quiz THEN
      v_sql := v_sql || ', derived_from_module_quiz = false';
    END IF;

    IF v_has_assessment_display_order THEN
      v_sql := v_sql || ', display_order = 2';
    END IF;

    v_sql := v_sql
      || ', updated_at = ' || quote_literal(v_now) || '::timestamptz '
      || 'WHERE id = ' || quote_literal(v_assessment_2_id) || '::uuid';

    EXECUTE v_sql;
  END IF;

  DELETE FROM public.assessment_questions
  WHERE assessment_id = v_assessment_2_id;

  INSERT INTO public.assessment_questions (
    assessment_id,
    question,
    question_type,
    options,
    correct_answer,
    points,
    "order",
    explanation,
    is_active,
    created_at
  )
  VALUES
    (
      v_assessment_2_id,
      'What is the strongest reason to review turnaround time regularly?',
      'multiple_choice',
      to_jsonb(ARRAY[
        'It shows whether the team is meeting service targets and where action is needed',
        'It replaces the need to assign corrective action',
        'It only matters at the end of the year',
        'It should be ignored when the backlog increases'
      ]::text[]),
      'It shows whether the team is meeting service targets and where action is needed',
      2,
      1,
      'Turnaround time is useful when it triggers review and corrective action.',
      true,
      v_now
    ),
    (
      v_assessment_2_id,
      'True or false: A backlog metric is useful even if no one reviews it or acts on it.',
      'true_false',
      NULL,
      'false',
      1,
      2,
      'Operational measures only help when they inform a decision or follow-up.',
      true,
      v_now
    ),
    (
      v_assessment_2_id,
      'Which response best addresses a recurring operational bottleneck?',
      'multiple_choice',
      to_jsonb(ARRAY[
        'Assign an owner, define a corrective action, and review the result',
        'Ignore the pattern until a major failure occurs',
        'Hide the delay from the team dashboard',
        'Change several processes at once without tracking impact'
      ]::text[]),
      'Assign an owner, define a corrective action, and review the result',
      2,
      3,
      'Good monitoring ends with ownership and a follow-up review.',
      true,
      v_now
    );

  SELECT id
  INTO v_assessment_3_id
  FROM public.assessments
  WHERE (course_id = v_course_id AND title = 'Customer Communication and Improvement Assessment')
     OR module_id = v_module_3_id
  ORDER BY CASE WHEN course_id = v_course_id AND title = 'Customer Communication and Improvement Assessment' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_assessment_3_id IS NULL THEN
    v_sql :=
      'INSERT INTO public.assessments (course_id, module_id, title, description, time_limit, passing_score, max_attempts, is_active';

    IF v_has_assessment_prerequisite_module_ids THEN
      v_sql := v_sql || ', prerequisite_module_ids';
    END IF;

    IF v_has_assessment_derived_from_module_quiz THEN
      v_sql := v_sql || ', derived_from_module_quiz';
    END IF;

    IF v_has_assessment_display_order THEN
      v_sql := v_sql || ', display_order';
    END IF;

    v_sql := v_sql || ', created_at, updated_at) VALUES ('
      || quote_literal(v_course_id) || '::uuid, '
      || 'NULL, '
      || quote_literal('Customer Communication and Improvement Assessment') || ', '
      || quote_literal('Assess communication quality, expectation-setting, and continuous-improvement thinking in operational service delivery.') || ', '
      || '15, 80, 3, true';

    IF v_has_assessment_prerequisite_module_ids THEN
      v_sql := v_sql || ', ' || quote_literal(ARRAY[v_module_3_id]) || '::uuid[]';
    END IF;

    IF v_has_assessment_derived_from_module_quiz THEN
      v_sql := v_sql || ', false';
    END IF;

    IF v_has_assessment_display_order THEN
      v_sql := v_sql || ', 3';
    END IF;

    v_sql := v_sql || ', '
      || quote_literal(v_now) || '::timestamptz, '
      || quote_literal(v_now) || '::timestamptz) RETURNING id';

    EXECUTE v_sql INTO v_assessment_3_id;
  ELSE
    v_sql :=
      'UPDATE public.assessments SET '
      || 'course_id = ' || quote_literal(v_course_id) || '::uuid, '
      || 'module_id = NULL, '
      || 'title = ' || quote_literal('Customer Communication and Improvement Assessment') || ', '
      || 'description = ' || quote_literal('Assess communication quality, expectation-setting, and continuous-improvement thinking in operational service delivery.') || ', '
      || 'time_limit = 15, '
      || 'passing_score = 80, '
      || 'max_attempts = 3, '
      || 'is_active = true';

    IF v_has_assessment_prerequisite_module_ids THEN
      v_sql := v_sql || ', prerequisite_module_ids = ' || quote_literal(ARRAY[v_module_3_id]) || '::uuid[]';
    END IF;

    IF v_has_assessment_derived_from_module_quiz THEN
      v_sql := v_sql || ', derived_from_module_quiz = false';
    END IF;

    IF v_has_assessment_display_order THEN
      v_sql := v_sql || ', display_order = 3';
    END IF;

    v_sql := v_sql
      || ', updated_at = ' || quote_literal(v_now) || '::timestamptz '
      || 'WHERE id = ' || quote_literal(v_assessment_3_id) || '::uuid';

    EXECUTE v_sql;
  END IF;

  DELETE FROM public.assessment_questions
  WHERE assessment_id = v_assessment_3_id;

  INSERT INTO public.assessment_questions (
    assessment_id,
    question,
    question_type,
    options,
    correct_answer,
    points,
    "order",
    explanation,
    is_active,
    created_at
  )
  VALUES
    (
      v_assessment_3_id,
      'Which update best reflects customer-centered operational communication?',
      'multiple_choice',
      to_jsonb(ARRAY[
        'We completed the review, the next step is approval, and we will update you by 3:00 PM.',
        'Please wait.',
        'We are handling it somewhere in the process.',
        'No further details are available.'
      ]::text[]),
      'We completed the review, the next step is approval, and we will update you by 3:00 PM.',
      2,
      1,
      'Strong updates explain status, next step, and timing clearly.',
      true,
      v_now
    ),
    (
      v_assessment_3_id,
      'True or false: Continuous improvement should rely only on major overhauls rather than small repeated fixes.',
      'true_false',
      NULL,
      'false',
      1,
      2,
      'Short review loops and small friction-reducing changes are central to operational improvement.',
      true,
      v_now
    ),
    (
      v_assessment_3_id,
      'What is the best first response to a repeated service complaint?',
      'multiple_choice',
      to_jsonb(ARRAY[
        'Review the root cause, assign an owner, and improve the process',
        'Treat each complaint as unrelated and avoid changes',
        'Hide the issue from staff to avoid concern',
        'Respond without checking what happened previously'
      ]::text[]),
      'Review the root cause, assign an owner, and improve the process',
      2,
      3,
      'Repeated issues should feed a root-cause review and process improvement cycle.',
      true,
      v_now
    );
END
$seed$;