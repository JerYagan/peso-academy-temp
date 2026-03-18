-- Seed content for the course:
-- Leadership and Governance for Public Service
--
-- What this script does:
--
-- - Creates or updates a complete Leadership and Governance for Public Service course using an existing trainer/admin/SPD user as instructor.
-- - Upserts 3 finalized modules with text, YouTube video, image, learning material, and quiz blocks.
-- - Upserts 1 standalone graded course assessment.
-- - Rewrites assessment questions on every run so the seed stays deterministic.

DO $seed$
DECLARE
  v_course_title text := 'Leadership and Governance for Public Service';
  v_course_id uuid;
  v_instructor_id uuid;
  v_now timestamptz := timezone('utc', now());

  v_module_1_id uuid;
  v_module_2_id uuid;
  v_module_3_id uuid;

  v_assessment_id uuid;

  v_m1_video text := 'https://www.youtube.com/watch?v=RFFpv49gWxU';
  v_m2_video text := 'https://www.youtube.com/watch?v=vCpTTrXRvS4';
  v_m3_video text := 'https://www.youtube.com/watch?v=NJgAmPltFV4';

  v_has_assessment_prerequisite_module_ids boolean;
  v_has_assessment_derived_from_module_quiz boolean;
  v_has_assessment_display_order boolean;
  v_has_course_trainee_audience boolean;
  v_has_course_skill_tags boolean;
  v_has_course_topic_tags boolean;
  v_has_course_industry_tags boolean;
  v_has_course_career_paths boolean;
  v_sql text;
BEGIN
  SELECT id
  INTO v_instructor_id
  FROM public.users
  WHERE role IN ('trainer', 'admin', 'spd')
  ORDER BY CASE role
    WHEN 'trainer' THEN 1
    WHEN 'spd' THEN 2
    WHEN 'admin' THEN 3
    ELSE 4
  END,
  created_at ASC
  LIMIT 1;

  IF v_instructor_id IS NULL THEN
    RAISE EXCEPTION 'No trainer/admin/SPD user found in public.users. Seed users first before running this course seed.';
  END IF;

  SELECT id
  INTO v_course_id
  FROM public.courses
  WHERE title = v_course_title
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'courses'
      AND column_name = 'trainee_audience'
  )
  INTO v_has_course_trainee_audience;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'courses'
      AND column_name = 'skill_tags'
  )
  INTO v_has_course_skill_tags;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'courses'
      AND column_name = 'topic_tags'
  )
  INTO v_has_course_topic_tags;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'courses'
      AND column_name = 'industry_tags'
  )
  INTO v_has_course_industry_tags;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'courses'
      AND column_name = 'career_paths'
  )
  INTO v_has_course_career_paths;

  IF v_course_id IS NULL THEN
    v_sql := 'INSERT INTO public.courses (' ||
      'title, description, category, level, duration, instructor_id';

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', trainee_audience';
    END IF;
    v_sql := v_sql || ', thumbnail, is_tesda_accredited, skills';
    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', skill_tags';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', topic_tags';
    END IF;
    IF v_has_course_industry_tags THEN
      v_sql := v_sql || ', industry_tags';
    END IF;
    IF v_has_course_career_paths THEN
      v_sql := v_sql || ', career_paths';
    END IF;

    v_sql := v_sql || ', enrolled_count, rating, certificate_type, published, created_at, updated_at) VALUES (' ||
      quote_literal(v_course_title) || ', ' ||
      quote_literal('This course equips learners with the core leadership and governance competencies required in public service settings. It covers the foundations of good governance, leadership practices, and ethical accountability systems that build trust in government institutions.') || ', ' ||
      quote_literal('Public Administration') || ', ' ||
      quote_literal('Intermediate') || ', ' ||
      '30, ' ||
      quote_literal(v_instructor_id);

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', ' || quote_literal('general_public');
    END IF;

    v_sql := v_sql || ', ' ||
      quote_literal('/images/course-service.svg') || ', ' ||
      'false, ' ||
      'ARRAY[' ||
        quote_literal('Public Sector Leadership') || ', ' ||
        quote_literal('Governance and Accountability') || ', ' ||
        quote_literal('Ethical Decision-Making') || ', ' ||
        quote_literal('Strategic Planning') || ', ' ||
        quote_literal('Stakeholder Engagement') || ', ' ||
        quote_literal('Public Service Delivery') || ']::text[]';

    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('Public Sector Leadership') || ', ' ||
        quote_literal('Governance and Accountability') || ', ' ||
        quote_literal('Ethical Decision-Making') || ', ' ||
        quote_literal('Strategic Planning') || ', ' ||
        quote_literal('Stakeholder Engagement') || ', ' ||
        quote_literal('Public Service Delivery') || ']::text[]';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('Public Administration') || ', ' ||
        quote_literal('Leadership Development') || ', ' ||
        quote_literal('Public Governance') || ', ' ||
        quote_literal('Ethics and Integrity') || ']::text[]';
    END IF;
    IF v_has_course_industry_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('public-service') || ', ' ||
        quote_literal('local-governance') || ', ' ||
        quote_literal('government') || ']::text[]';
    END IF;
    IF v_has_course_career_paths THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('public-servant') || ', ' ||
        quote_literal('government-official') || ', ' ||
        quote_literal('local-government-officer') || ']::text[]';
    END IF;

    v_sql := v_sql || ', 0, 4.7, ' || quote_literal('completion') || ', true, ' ||
      quote_literal(v_now) || ', ' || quote_literal(v_now) || ') RETURNING id';

    EXECUTE v_sql INTO v_course_id;
  ELSE
    v_sql := 'UPDATE public.courses SET ' ||
      'description = ' || quote_literal('This course equips learners with the core leadership and governance competencies required in public service settings. It covers the foundations of good governance, leadership practices, and ethical accountability systems that build trust in government institutions.') || ', ' ||
      'category = ' || quote_literal('Public Administration') || ', ' ||
      'level = ' || quote_literal('Intermediate') || ', ' ||
      'duration = 30, ' ||
      'instructor_id = ' || quote_literal(v_instructor_id);

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', trainee_audience = ' || quote_literal('general_public');
    END IF;

    v_sql := v_sql || ', thumbnail = ' || quote_literal('/images/course-service.svg') ||
      ', is_tesda_accredited = false' ||
      ', skills = ARRAY[' ||
        quote_literal('Public Sector Leadership') || ', ' ||
        quote_literal('Governance and Accountability') || ', ' ||
        quote_literal('Ethical Decision-Making') || ', ' ||
        quote_literal('Strategic Planning') || ', ' ||
        quote_literal('Stakeholder Engagement') || ', ' ||
        quote_literal('Public Service Delivery') || ']::text[]';

    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', skill_tags = ARRAY[' ||
        quote_literal('Public Sector Leadership') || ', ' ||
        quote_literal('Governance and Accountability') || ', ' ||
        quote_literal('Ethical Decision-Making') || ', ' ||
        quote_literal('Strategic Planning') || ', ' ||
        quote_literal('Stakeholder Engagement') || ', ' ||
        quote_literal('Public Service Delivery') || ']::text[]';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', topic_tags = ARRAY[' ||
        quote_literal('Public Administration') || ', ' ||
        quote_literal('Leadership Development') || ', ' ||
        quote_literal('Public Governance') || ', ' ||
        quote_literal('Ethics and Integrity') || ']::text[]';
    END IF;
    IF v_has_course_industry_tags THEN
      v_sql := v_sql || ', industry_tags = ARRAY[' ||
        quote_literal('public-service') || ', ' ||
        quote_literal('local-governance') || ', ' ||
        quote_literal('government') || ']::text[]';
    END IF;
    IF v_has_course_career_paths THEN
      v_sql := v_sql || ', career_paths = ARRAY[' ||
        quote_literal('public-servant') || ', ' ||
        quote_literal('government-official') || ', ' ||
        quote_literal('local-government-officer') || ']::text[]';
    END IF;

    v_sql := v_sql || ', rating = 4.7' ||
      ', certificate_type = ' || quote_literal('completion') ||
      ', published = true' ||
      ', updated_at = ' || quote_literal(v_now) ||
      ' WHERE id = ' || quote_literal(v_course_id);

    EXECUTE v_sql;
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

  -- ------------------------------------------------------------------ Module 1
  SELECT id
  INTO v_module_1_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Foundations of Good Governance in Public Service'
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
      module_thumbnail,
      status,
      created_at,
      updated_at
    )
    VALUES (
      v_course_id,
      'Foundations of Good Governance in Public Service',
      'Introduces the meaning of governance in the public sector and explains why transparency, participation, rule of law, responsiveness, and accountability are central to good governance.',
      1,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'lg-m1-text1',
          'type', 'text',
          'title', 'Governance is more than administration',
          'content', $html$<p>Governance in public service is not limited to following office procedures or moving papers through a system. It is the broader process through which public institutions make decisions, allocate resources, coordinate action, and remain answerable to the people they serve. Good governance ensures that public power is used lawfully, fairly, and effectively.</p><p>In practical terms, governance influences whether services are delivered on time, whether resources are used wisely, and whether citizens believe institutions are trustworthy. A technically efficient office can still perform poorly if decisions are opaque, if communities are excluded, or if accountability is weak.</p>$html$
        ),
        jsonb_build_object(
          'id', 'lg-m1-text2',
          'type', 'text',
          'title', 'The core principles of good governance',
          'content', $html$<p>Public sector governance is assessed through several core principles. Participation means people affected by public decisions should have meaningful opportunities to be heard. Rule of law means policies and actions must be based on lawful authority and applied fairly. Transparency means information on decisions, budgets, and processes should be understandable and accessible.</p><p>Responsiveness means institutions should act in a timely and practical way when public needs arise. Accountability means officials must explain their actions and face consequences when standards are not met. Equity and inclusion mean governance should work for all groups, especially those who are underserved or excluded.</p>$html$
        ),
        jsonb_build_object(
          'id', 'lg-m1-text3',
          'type', 'text',
          'title', 'Why governance matters in everyday public service',
          'content', $html$<p>Governance is visible in daily operations. It shapes how a municipal office handles complaints, how a school division distributes resources, how a health office prioritizes programs, and how procurement decisions are recorded. Strong governance reduces arbitrariness and improves consistency.</p><p>When governance is weak, public institutions often experience duplicated work, poor record-keeping, delayed approvals, citizen complaints, distrust, and vulnerability to corruption. Good governance creates a disciplined and fair operating environment where public servants can deliver better results.</p>$html$
        ),
        jsonb_build_object(
          'id', 'lg-m1-video',
          'type', 'video',
          'title', '8 Principles of Governance in Public Administration',
          'content', '',
          'videoUrl', v_m1_video
        ),
        jsonb_build_object(
          'id', 'lg-m1-image',
          'type', 'image',
          'title', 'Governance principles illustration',
          'imageUrl', 'https://img.youtube.com/vi/RFFpv49gWxU/maxresdefault.jpg',
          'altText', 'Video thumbnail illustrating key principles of good governance in public administration',
          'caption', 'Good governance connects institutional performance to the public interest through accountability, transparency, and participation.'
        ),
        jsonb_build_object(
          'id', 'lg-m1-ref1',
          'type', 'learning_material',
          'title', 'OECD Public Governance Resources',
          'url', 'https://www.oecd.org/gov/',
          'content', 'OECD resources on public governance covering accountability frameworks, policy implementation, citizen engagement, and institutional performance improvement.'
        ),
        jsonb_build_object(
          'id', 'lg-m1-quiz1',
          'type', 'quiz',
          'title', 'Quick check: transparency',
          'content', 'Which principle of governance is most directly concerned with making public decisions and processes visible and understandable to citizens?',
          'options', jsonb_build_array(
            'Transparency',
            'Hierarchy',
            'Confidentiality',
            'Delegation'
          ),
          'correctAnswer', 0,
          'explanation', 'Transparency means government decisions, actions, and information are open enough for people to understand how public institutions are operating.'
        ),
        jsonb_build_object(
          'id', 'lg-m1-quiz2',
          'type', 'quiz',
          'title', 'Quick check: participation',
          'content', 'Why is participation considered important in public governance?',
          'options', jsonb_build_array(
            'It allows citizens and stakeholders to contribute to decisions that affect them',
            'It removes the need for legal procedures',
            'It ensures only senior officials make decisions',
            'It replaces accountability systems'
          ),
          'correctAnswer', 0,
          'explanation', 'Participation improves legitimacy, helps decision-makers understand public needs, and supports more inclusive governance outcomes.'
        )
      )::text,
      ARRAY[v_m1_video]::text[],
      ARRAY[]::text[],
      '/images/course-service.svg',
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_1_id;
  ELSE
    UPDATE public.modules
    SET description = 'Introduces the meaning of governance in the public sector and explains why transparency, participation, rule of law, responsiveness, and accountability are central to good governance.',
        "order" = 1,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'lg-m1-text1',
            'type', 'text',
            'title', 'Governance is more than administration',
            'content', $html$<p>Governance in public service is not limited to following office procedures or moving papers through a system. It is the broader process through which public institutions make decisions, allocate resources, coordinate action, and remain answerable to the people they serve. Good governance ensures that public power is used lawfully, fairly, and effectively.</p><p>In practical terms, governance influences whether services are delivered on time, whether resources are used wisely, and whether citizens believe institutions are trustworthy. A technically efficient office can still perform poorly if decisions are opaque, if communities are excluded, or if accountability is weak.</p>$html$
          ),
          jsonb_build_object(
            'id', 'lg-m1-text2',
            'type', 'text',
            'title', 'The core principles of good governance',
            'content', $html$<p>Public sector governance is assessed through several core principles. Participation means people affected by public decisions should have meaningful opportunities to be heard. Rule of law means policies and actions must be based on lawful authority and applied fairly. Transparency means information on decisions, budgets, and processes should be understandable and accessible.</p><p>Responsiveness means institutions should act in a timely and practical way when public needs arise. Accountability means officials must explain their actions and face consequences when standards are not met. Equity and inclusion mean governance should work for all groups, especially those who are underserved or excluded.</p>$html$
          ),
          jsonb_build_object(
            'id', 'lg-m1-text3',
            'type', 'text',
            'title', 'Why governance matters in everyday public service',
            'content', $html$<p>Governance is visible in daily operations. It shapes how a municipal office handles complaints, how a school division distributes resources, how a health office prioritizes programs, and how procurement decisions are recorded. Strong governance reduces arbitrariness and improves consistency.</p><p>When governance is weak, public institutions often experience duplicated work, poor record-keeping, delayed approvals, citizen complaints, distrust, and vulnerability to corruption. Good governance creates a disciplined and fair operating environment where public servants can deliver better results.</p>$html$
          ),
          jsonb_build_object(
            'id', 'lg-m1-video',
            'type', 'video',
            'title', '8 Principles of Governance in Public Administration',
            'content', '',
            'videoUrl', v_m1_video
          ),
          jsonb_build_object(
            'id', 'lg-m1-image',
            'type', 'image',
            'title', 'Governance principles illustration',
            'imageUrl', 'https://img.youtube.com/vi/RFFpv49gWxU/maxresdefault.jpg',
            'altText', 'Video thumbnail illustrating key principles of good governance in public administration',
            'caption', 'Good governance connects institutional performance to the public interest through accountability, transparency, and participation.'
          ),
          jsonb_build_object(
            'id', 'lg-m1-ref1',
            'type', 'learning_material',
            'title', 'OECD Public Governance Resources',
            'url', 'https://www.oecd.org/gov/',
            'content', 'OECD resources on public governance covering accountability frameworks, policy implementation, citizen engagement, and institutional performance improvement.'
          ),
          jsonb_build_object(
            'id', 'lg-m1-quiz1',
            'type', 'quiz',
            'title', 'Quick check: transparency',
            'content', 'Which principle of governance is most directly concerned with making public decisions and processes visible and understandable to citizens?',
            'options', jsonb_build_array(
              'Transparency',
              'Hierarchy',
              'Confidentiality',
              'Delegation'
            ),
            'correctAnswer', 0,
            'explanation', 'Transparency means government decisions, actions, and information are open enough for people to understand how public institutions are operating.'
          ),
          jsonb_build_object(
            'id', 'lg-m1-quiz2',
            'type', 'quiz',
            'title', 'Quick check: participation',
            'content', 'Why is participation considered important in public governance?',
            'options', jsonb_build_array(
              'It allows citizens and stakeholders to contribute to decisions that affect them',
              'It removes the need for legal procedures',
              'It ensures only senior officials make decisions',
              'It replaces accountability systems'
            ),
            'correctAnswer', 0,
            'explanation', 'Participation improves legitimacy, helps decision-makers understand public needs, and supports more inclusive governance outcomes.'
          )
        )::text,
        materials = ARRAY[v_m1_video]::text[],
        prerequisites = ARRAY[]::text[],
        module_thumbnail = '/images/course-service.svg',
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_1_id;
  END IF;

  -- ------------------------------------------------------------------ Module 2
  SELECT id
  INTO v_module_2_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Leadership Practices for Public Sector Teams'
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
      module_thumbnail,
      status,
      created_at,
      updated_at
    )
    VALUES (
      v_course_id,
      'Leadership Practices for Public Sector Teams',
      'Focuses on leadership practice inside public institutions including how public leaders set direction, align teams, support performance, and make decisions under resource and policy constraints.',
      2,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'lg-m2-text1',
          'type', 'text',
          'title', 'Leadership in public service requires credibility and direction',
          'content', $html$<p>Public service leadership is not just about rank. A supervisor may have legal authority to assign work, but effective leadership depends on credibility, judgment, and the ability to help teams perform in the public interest. In government settings, leaders often work within rules, budget limits, and political expectations while still needing to produce reliable results.</p><p>Effective public leaders provide direction by clarifying priorities, defining roles, and linking daily work to public outcomes. They help teams understand why a task matters, how quality will be judged, and what success looks like for citizens or service users.</p>$html$
        ),
        jsonb_build_object(
          'id', 'lg-m2-text2',
          'type', 'text',
          'title', 'Citizen-centered leadership improves service delivery',
          'content', $html$<p>Citizen-centered leadership asks a simple but demanding question: how will this decision affect the people who rely on the service? Instead of focusing only on internal convenience, strong public leaders examine waiting times, access barriers, communication quality, and the fairness of procedures.</p><p>This mindset is especially important in frontline and administrative offices. A process that looks orderly from inside the institution may still be confusing or burdensome for the public. Leaders should use feedback, complaints data, and field observations to identify pain points and remove avoidable barriers.</p>$html$
        ),
        jsonb_build_object(
          'id', 'lg-m2-text3',
          'type', 'text',
          'title', 'Leading through coordination and change',
          'content', $html$<p>Public institutions rarely operate in isolation. Many priorities require coordination across departments, local units, community groups, and external partners. Leaders must align stakeholders, clarify responsibilities, and manage competing expectations without losing sight of legal mandates and policy goals.</p><p>During reform or crisis response, teams need clear communication, timely decisions, and visible support from leadership. A leader who listens, explains tradeoffs, and follows through on commitments is more likely to build trust and sustain performance through change.</p>$html$
        ),
        jsonb_build_object(
          'id', 'lg-m2-video',
          'type', 'video',
          'title', 'Leadership in the Public Sector',
          'content', '',
          'videoUrl', v_m2_video
        ),
        jsonb_build_object(
          'id', 'lg-m2-image',
          'type', 'image',
          'title', 'Public sector leadership illustration',
          'imageUrl', 'https://img.youtube.com/vi/vCpTTrXRvS4/maxresdefault.jpg',
          'altText', 'Video thumbnail representing leadership practices in the public sector',
          'caption', 'Public sector leadership combines formal authority with credibility, direction-setting, and citizen-centered service delivery.'
        ),
        jsonb_build_object(
          'id', 'lg-m2-ref1',
          'type', 'learning_material',
          'title', 'OECD Public Policymaking Resources',
          'url', 'https://www.oecd.org/en/topics/public-policymaking.html',
          'content', 'OECD resources on public policymaking, leadership in government, service delivery improvement, and citizen-centered institutional management practices.'
        ),
        jsonb_build_object(
          'id', 'lg-m2-quiz1',
          'type', 'quiz',
          'title', 'Quick check: leadership vs authority',
          'content', 'Which statement best distinguishes leadership from authority in a public institution?',
          'options', jsonb_build_array(
            'Authority comes from position, while leadership depends on influence, judgment, and trust',
            'Leadership is only relevant during emergencies',
            'Authority is informal, while leadership is always legal',
            'Leadership removes the need for management systems'
          ),
          'correctAnswer', 0,
          'explanation', 'Formal authority gives a person the right to make or enforce decisions, but leadership is demonstrated through how effectively that person guides people toward shared public goals.'
        ),
        jsonb_build_object(
          'id', 'lg-m2-quiz2',
          'type', 'quiz',
          'title', 'Quick check: citizen-centered leadership',
          'content', 'What is the most citizen-centered response when a government process is legally correct but consistently confusing for service users?',
          'options', jsonb_build_array(
            'Review the process and improve clarity, access, and communication without violating rules',
            'Keep the process unchanged because legal compliance is enough',
            'Transfer responsibility to citizens to understand the system better',
            'Reduce public information to avoid complaints'
          ),
          'correctAnswer', 0,
          'explanation', 'Citizen-centered leadership looks for ways to preserve legal compliance while reducing barriers that make services difficult to access or understand.'
        )
      )::text,
      ARRAY[v_m2_video]::text[],
      ARRAY[v_module_1_id::text]::text[],
      '/images/course-service.svg',
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_2_id;
  ELSE
    UPDATE public.modules
    SET description = 'Focuses on leadership practice inside public institutions including how public leaders set direction, align teams, support performance, and make decisions under resource and policy constraints.',
        "order" = 2,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'lg-m2-text1',
            'type', 'text',
            'title', 'Leadership in public service requires credibility and direction',
            'content', $html$<p>Public service leadership is not just about rank. A supervisor may have legal authority to assign work, but effective leadership depends on credibility, judgment, and the ability to help teams perform in the public interest. In government settings, leaders often work within rules, budget limits, and political expectations while still needing to produce reliable results.</p><p>Effective public leaders provide direction by clarifying priorities, defining roles, and linking daily work to public outcomes. They help teams understand why a task matters, how quality will be judged, and what success looks like for citizens or service users.</p>$html$
          ),
          jsonb_build_object(
            'id', 'lg-m2-text2',
            'type', 'text',
            'title', 'Citizen-centered leadership improves service delivery',
            'content', $html$<p>Citizen-centered leadership asks a simple but demanding question: how will this decision affect the people who rely on the service? Instead of focusing only on internal convenience, strong public leaders examine waiting times, access barriers, communication quality, and the fairness of procedures.</p><p>This mindset is especially important in frontline and administrative offices. A process that looks orderly from inside the institution may still be confusing or burdensome for the public. Leaders should use feedback, complaints data, and field observations to identify pain points and remove avoidable barriers.</p>$html$
          ),
          jsonb_build_object(
            'id', 'lg-m2-text3',
            'type', 'text',
            'title', 'Leading through coordination and change',
            'content', $html$<p>Public institutions rarely operate in isolation. Many priorities require coordination across departments, local units, community groups, and external partners. Leaders must align stakeholders, clarify responsibilities, and manage competing expectations without losing sight of legal mandates and policy goals.</p><p>During reform or crisis response, teams need clear communication, timely decisions, and visible support from leadership. A leader who listens, explains tradeoffs, and follows through on commitments is more likely to build trust and sustain performance through change.</p>$html$
          ),
          jsonb_build_object(
            'id', 'lg-m2-video',
            'type', 'video',
            'title', 'Leadership in the Public Sector',
            'content', '',
            'videoUrl', v_m2_video
          ),
          jsonb_build_object(
            'id', 'lg-m2-image',
            'type', 'image',
            'title', 'Public sector leadership illustration',
            'imageUrl', 'https://img.youtube.com/vi/vCpTTrXRvS4/maxresdefault.jpg',
            'altText', 'Video thumbnail representing leadership practices in the public sector',
            'caption', 'Public sector leadership combines formal authority with credibility, direction-setting, and citizen-centered service delivery.'
          ),
          jsonb_build_object(
            'id', 'lg-m2-ref1',
            'type', 'learning_material',
            'title', 'OECD Public Policymaking Resources',
            'url', 'https://www.oecd.org/en/topics/public-policymaking.html',
            'content', 'OECD resources on public policymaking, leadership in government, service delivery improvement, and citizen-centered institutional management practices.'
          ),
          jsonb_build_object(
            'id', 'lg-m2-quiz1',
            'type', 'quiz',
            'title', 'Quick check: leadership vs authority',
            'content', 'Which statement best distinguishes leadership from authority in a public institution?',
            'options', jsonb_build_array(
              'Authority comes from position, while leadership depends on influence, judgment, and trust',
              'Leadership is only relevant during emergencies',
              'Authority is informal, while leadership is always legal',
              'Leadership removes the need for management systems'
            ),
            'correctAnswer', 0,
            'explanation', 'Formal authority gives a person the right to make or enforce decisions, but leadership is demonstrated through how effectively that person guides people toward shared public goals.'
          ),
          jsonb_build_object(
            'id', 'lg-m2-quiz2',
            'type', 'quiz',
            'title', 'Quick check: citizen-centered leadership',
            'content', 'What is the most citizen-centered response when a government process is legally correct but consistently confusing for service users?',
            'options', jsonb_build_array(
              'Review the process and improve clarity, access, and communication without violating rules',
              'Keep the process unchanged because legal compliance is enough',
              'Transfer responsibility to citizens to understand the system better',
              'Reduce public information to avoid complaints'
            ),
            'correctAnswer', 0,
            'explanation', 'Citizen-centered leadership looks for ways to preserve legal compliance while reducing barriers that make services difficult to access or understand.'
          )
        )::text,
        materials = ARRAY[v_m2_video]::text[],
        prerequisites = ARRAY[v_module_1_id::text]::text[],
        module_thumbnail = '/images/course-service.svg',
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_2_id;
  END IF;

  -- ------------------------------------------------------------------ Module 3
  SELECT id
  INTO v_module_3_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Ethics, Accountability, and Transparency in Government Work'
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
      module_thumbnail,
      status,
      created_at,
      updated_at
    )
    VALUES (
      v_course_id,
      'Ethics, Accountability, and Transparency in Government Work',
      'Examines the ethical standards and accountability systems that support legitimate public service including integrity, conflict of interest, responsible resource use, and reporting obligations.',
      3,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'lg-m3-text1',
          'type', 'text',
          'title', 'Ethics protects the public interest',
          'content', $html$<p>Public service ethics is grounded in the principle that public office exists to serve the community, not private advantage. Ethical behavior requires honesty, fairness, respect for law, responsible judgment, and careful stewardship of public funds, information, and authority.</p><p>Even when rules are clear, ethical judgment is still necessary. Public servants make choices about priorities, discretion, communication, and the handling of sensitive situations. Ethical conduct ensures those choices remain aligned with institutional mandates and the broader public good.</p>$html$
        ),
        jsonb_build_object(
          'id', 'lg-m3-text2',
          'type', 'text',
          'title', 'Integrity is demonstrated through consistent conduct',
          'content', $html$<p>Integrity is not only about avoiding corruption. It also includes avoiding favoritism, declaring conflicts of interest, maintaining accurate records, protecting confidential information appropriately, and refusing to misuse time, influence, or assets. Integrity means acting consistently with the standards expected of public office, even when no one is watching.</p><p>In practice, integrity must be supported by systems. Codes of conduct, procurement controls, audit trails, disclosure rules, complaint channels, and supervisory review all help reinforce ethical behavior. Strong institutions do not rely on personal virtue alone; they build mechanisms that make good conduct easier and misconduct harder.</p>$html$
        ),
        jsonb_build_object(
          'id', 'lg-m3-text3',
          'type', 'text',
          'title', 'Accountability builds public trust',
          'content', $html$<p>Accountability means public officials can explain what they did, why they did it, and what results followed. It includes answerability, review, corrective action, and consequences. Without accountability, citizens have little basis for trusting that government decisions were made fairly or competently.</p><p>Accountability operates at multiple levels: individual accountability for conduct and decisions, managerial accountability for team performance, legal accountability for compliance, and public accountability to citizens and oversight bodies. Strong leaders encourage accountability by documenting decisions, reporting honestly, and responding constructively to feedback and review.</p>$html$
        ),
        jsonb_build_object(
          'id', 'lg-m3-video',
          'type', 'video',
          'title', 'Public Service Ethics',
          'content', '',
          'videoUrl', v_m3_video
        ),
        jsonb_build_object(
          'id', 'lg-m3-image',
          'type', 'image',
          'title', 'Public service ethics illustration',
          'imageUrl', 'https://img.youtube.com/vi/NJgAmPltFV4/maxresdefault.jpg',
          'altText', 'Video thumbnail illustrating ethics and accountability in public service',
          'caption', 'Ethical public service depends on both individual integrity and institutional systems that reinforce accountable conduct.'
        ),
        jsonb_build_object(
          'id', 'lg-m3-ref1',
          'type', 'learning_material',
          'title', 'OECD Anti-Corruption and Integrity Resources',
          'url', 'https://www.oecd.org/en/topics/anti-corruption-and-integrity.html',
          'content', 'OECD resources on anti-corruption, integrity frameworks, public ethics, and accountability systems that support trustworthy governance in public institutions.'
        ),
        jsonb_build_object(
          'id', 'lg-m3-quiz1',
          'type', 'quiz',
          'title', 'Quick check: conflict of interest',
          'content', 'Which situation is the clearest example of a conflict of interest in public service?',
          'options', jsonb_build_array(
            'A public official participates in a procurement decision involving a company owned by a close relative',
            'A supervisor explains office rules to a new employee',
            'A staff member submits a weekly accomplishment report',
            'A department posts service hours online'
          ),
          'correctAnswer', 0,
          'explanation', 'A conflict of interest exists when private relationships or benefits could improperly influence official judgment or create the appearance of bias.'
        ),
        jsonb_build_object(
          'id', 'lg-m3-quiz2',
          'type', 'quiz',
          'title', 'Quick check: accountability',
          'content', 'Which action best supports accountability in a public office?',
          'options', jsonb_build_array(
            'Documenting decisions, reporting results, and responding to review findings',
            'Avoiding written records for sensitive matters',
            'Limiting information only to senior insiders in all cases',
            'Delaying responses to citizen complaints until pressure decreases'
          ),
          'correctAnswer', 0,
          'explanation', 'Accountability requires traceable decisions, explainable actions, and willingness to correct problems when oversight or feedback identifies them.'
        )
      )::text,
      ARRAY[v_m3_video]::text[],
      ARRAY[v_module_1_id::text, v_module_2_id::text]::text[],
      '/images/course-service.svg',
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_3_id;
  ELSE
    UPDATE public.modules
    SET description = 'Examines the ethical standards and accountability systems that support legitimate public service including integrity, conflict of interest, responsible resource use, and reporting obligations.',
        "order" = 3,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'lg-m3-text1',
            'type', 'text',
            'title', 'Ethics protects the public interest',
            'content', $html$<p>Public service ethics is grounded in the principle that public office exists to serve the community, not private advantage. Ethical behavior requires honesty, fairness, respect for law, responsible judgment, and careful stewardship of public funds, information, and authority.</p><p>Even when rules are clear, ethical judgment is still necessary. Public servants make choices about priorities, discretion, communication, and the handling of sensitive situations. Ethical conduct ensures those choices remain aligned with institutional mandates and the broader public good.</p>$html$
          ),
          jsonb_build_object(
            'id', 'lg-m3-text2',
            'type', 'text',
            'title', 'Integrity is demonstrated through consistent conduct',
            'content', $html$<p>Integrity is not only about avoiding corruption. It also includes avoiding favoritism, declaring conflicts of interest, maintaining accurate records, protecting confidential information appropriately, and refusing to misuse time, influence, or assets. Integrity means acting consistently with the standards expected of public office, even when no one is watching.</p><p>In practice, integrity must be supported by systems. Codes of conduct, procurement controls, audit trails, disclosure rules, complaint channels, and supervisory review all help reinforce ethical behavior. Strong institutions do not rely on personal virtue alone; they build mechanisms that make good conduct easier and misconduct harder.</p>$html$
          ),
          jsonb_build_object(
            'id', 'lg-m3-text3',
            'type', 'text',
            'title', 'Accountability builds public trust',
            'content', $html$<p>Accountability means public officials can explain what they did, why they did it, and what results followed. It includes answerability, review, corrective action, and consequences. Without accountability, citizens have little basis for trusting that government decisions were made fairly or competently.</p><p>Accountability operates at multiple levels: individual accountability for conduct and decisions, managerial accountability for team performance, legal accountability for compliance, and public accountability to citizens and oversight bodies. Strong leaders encourage accountability by documenting decisions, reporting honestly, and responding constructively to feedback and review.</p>$html$
          ),
          jsonb_build_object(
            'id', 'lg-m3-video',
            'type', 'video',
            'title', 'Public Service Ethics',
            'content', '',
            'videoUrl', v_m3_video
          ),
          jsonb_build_object(
            'id', 'lg-m3-image',
            'type', 'image',
            'title', 'Public service ethics illustration',
            'imageUrl', 'https://img.youtube.com/vi/NJgAmPltFV4/maxresdefault.jpg',
            'altText', 'Video thumbnail illustrating ethics and accountability in public service',
            'caption', 'Ethical public service depends on both individual integrity and institutional systems that reinforce accountable conduct.'
          ),
          jsonb_build_object(
            'id', 'lg-m3-ref1',
            'type', 'learning_material',
            'title', 'OECD Anti-Corruption and Integrity Resources',
            'url', 'https://www.oecd.org/en/topics/anti-corruption-and-integrity.html',
            'content', 'OECD resources on anti-corruption, integrity frameworks, public ethics, and accountability systems that support trustworthy governance in public institutions.'
          ),
          jsonb_build_object(
            'id', 'lg-m3-quiz1',
            'type', 'quiz',
            'title', 'Quick check: conflict of interest',
            'content', 'Which situation is the clearest example of a conflict of interest in public service?',
            'options', jsonb_build_array(
              'A public official participates in a procurement decision involving a company owned by a close relative',
              'A supervisor explains office rules to a new employee',
              'A staff member submits a weekly accomplishment report',
              'A department posts service hours online'
            ),
            'correctAnswer', 0,
            'explanation', 'A conflict of interest exists when private relationships or benefits could improperly influence official judgment or create the appearance of bias.'
          ),
          jsonb_build_object(
            'id', 'lg-m3-quiz2',
            'type', 'quiz',
            'title', 'Quick check: accountability',
            'content', 'Which action best supports accountability in a public office?',
            'options', jsonb_build_array(
              'Documenting decisions, reporting results, and responding to review findings',
              'Avoiding written records for sensitive matters',
              'Limiting information only to senior insiders in all cases',
              'Delaying responses to citizen complaints until pressure decreases'
            ),
            'correctAnswer', 0,
            'explanation', 'Accountability requires traceable decisions, explainable actions, and willingness to correct problems when oversight or feedback identifies them.'
          )
        )::text,
        materials = ARRAY[v_m3_video]::text[],
        prerequisites = ARRAY[v_module_1_id::text, v_module_2_id::text]::text[],
        module_thumbnail = '/images/course-service.svg',
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_3_id;
  END IF;

  -- ------------------------------------------------------------------ Assessment
  SELECT id
  INTO v_assessment_id
  FROM public.assessments
  WHERE course_id = v_course_id
    AND title = 'Leadership and Governance for Public Service Final Assessment'
    AND module_id IS NULL
  LIMIT 1;

  v_sql := 'INSERT INTO public.assessments (' ||
    'course_id, module_id, title, description, assessment_thumbnail, time_limit, passing_score, max_attempts, allow_retry_after_passing, is_active';

  IF v_has_assessment_prerequisite_module_ids THEN
    v_sql := v_sql || ', prerequisite_module_ids';
  END IF;
  IF v_has_assessment_derived_from_module_quiz THEN
    v_sql := v_sql || ', derived_from_module_quiz';
  END IF;
  IF v_has_assessment_display_order THEN
    v_sql := v_sql || ', display_order';
  END IF;

  v_sql := v_sql || ', created_at, updated_at) VALUES (' ||
    quote_literal(v_course_id) || ', NULL, ' ||
    quote_literal('Leadership and Governance for Public Service Final Assessment') || ', ' ||
    quote_literal('Measure the learner''s understanding of governance principles, public sector leadership practice, and ethics and accountability systems in government work.') || ', ' ||
    quote_literal('/images/course-service.svg') || ', 30, 75, 3, true, true';

  IF v_has_assessment_prerequisite_module_ids THEN
    v_sql := v_sql || ', ARRAY[' ||
      quote_literal(v_module_1_id::text) || ', ' ||
      quote_literal(v_module_2_id::text) || ', ' ||
      quote_literal(v_module_3_id::text) || ']::uuid[]';
  END IF;
  IF v_has_assessment_derived_from_module_quiz THEN
    v_sql := v_sql || ', false';
  END IF;
  IF v_has_assessment_display_order THEN
    v_sql := v_sql || ', 1';
  END IF;

  v_sql := v_sql || ', ' || quote_literal(v_now) || ', ' || quote_literal(v_now) || ') RETURNING id';

  IF v_assessment_id IS NULL THEN
    EXECUTE v_sql INTO v_assessment_id;
  ELSE
    v_sql := 'UPDATE public.assessments SET ' ||
      'description = ' || quote_literal('Measure the learner''s understanding of governance principles, public sector leadership practice, and ethics and accountability systems in government work.') || ', ' ||
      'assessment_thumbnail = ' || quote_literal('/images/course-service.svg') || ', ' ||
      'time_limit = 30, ' ||
      'passing_score = 75, ' ||
      'max_attempts = 3, ' ||
      'allow_retry_after_passing = true, ' ||
      'is_active = true';

    IF v_has_assessment_prerequisite_module_ids THEN
      v_sql := v_sql || ', prerequisite_module_ids = ARRAY[' ||
        quote_literal(v_module_1_id::text) || ', ' ||
        quote_literal(v_module_2_id::text) || ', ' ||
        quote_literal(v_module_3_id::text) || ']::uuid[]';
    END IF;
    IF v_has_assessment_derived_from_module_quiz THEN
      v_sql := v_sql || ', derived_from_module_quiz = false';
    END IF;
    IF v_has_assessment_display_order THEN
      v_sql := v_sql || ', display_order = 1';
    END IF;

    v_sql := v_sql || ', updated_at = ' || quote_literal(v_now) ||
      ' WHERE id = ' || quote_literal(v_assessment_id);

    EXECUTE v_sql;
  END IF;

  DELETE FROM public.assessment_questions
  WHERE assessment_id = v_assessment_id;

  INSERT INTO public.assessment_questions (
    assessment_id,
    question,
    question_type,
    options,
    correct_answer,
    points,
    "order",
    explanation,
    derived_from_module_quiz,
    is_active,
    created_at
  )
  VALUES
    (
      v_assessment_id,
      'Which governance principle focuses on making public decisions and information open and understandable to the public?',
      'multiple_choice',
      jsonb_build_array(
        'Transparency',
        'Secrecy',
        'Delegation',
        'Centralization'
      ),
      'Transparency',
      2,
      1,
      'Transparency helps citizens understand how decisions are made and how public resources are used.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'True or false: Participation in governance means citizens should have opportunities to contribute to decisions that affect them.',
      'true_false',
      NULL,
      'true',
      1,
      2,
      'Participation strengthens legitimacy and helps institutions make better-informed decisions.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which statement best describes the role of leadership in public service?',
      'multiple_choice',
      jsonb_build_array(
        'It helps align people, decisions, and resources toward public outcomes',
        'It removes the need for laws and procedures',
        'It is only relevant for elected officials',
        'It is mainly about controlling information'
      ),
      'It helps align people, decisions, and resources toward public outcomes',
      2,
      3,
      'Public leadership gives direction, builds coordination, and supports effective service delivery within institutional constraints.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'What is the best example of citizen-centered leadership?',
      'multiple_choice',
      jsonb_build_array(
        'Redesigning a confusing process so users can access services more easily while keeping legal safeguards intact',
        'Reducing public information so fewer complaints are recorded',
        'Prioritizing internal convenience over service quality',
        'Ignoring frontline feedback because policies already exist'
      ),
      'Redesigning a confusing process so users can access services more easily while keeping legal safeguards intact',
      2,
      4,
      'Citizen-centered leadership improves access and clarity without abandoning legal or policy requirements.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'True or false: Formal authority automatically guarantees effective leadership.',
      'true_false',
      NULL,
      'false',
      1,
      5,
      'Authority comes from position, but effective leadership depends on credibility, judgment, communication, and trust.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which scenario most clearly reflects ethical risk in public service?',
      'multiple_choice',
      jsonb_build_array(
        'A manager approves a contract involving a close relative without disclosure',
        'A clerk updates a public notice board',
        'A team lead schedules a staff meeting',
        'An office receives citizen feedback through a hotline'
      ),
      'A manager approves a contract involving a close relative without disclosure',
      2,
      6,
      'Undisclosed private interests can improperly affect official decisions and undermine trust.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which set of mechanisms best supports integrity in a public institution?',
      'multiple_choice',
      jsonb_build_array(
        'Codes of conduct, disclosures, audit trails, and review systems',
        'Informal verbal instructions only',
        'Personal trust without documentation',
        'Unrecorded decision-making for efficiency'
      ),
      'Codes of conduct, disclosures, audit trails, and review systems',
      2,
      7,
      'Ethical systems are strengthened when institutions create structures that guide, record, and review conduct.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'What is the main purpose of accountability in government work?',
      'multiple_choice',
      jsonb_build_array(
        'To ensure officials can explain actions and be reviewed or corrected when necessary',
        'To eliminate all discretion from public service',
        'To prevent communication with citizens',
        'To move all decisions outside public institutions'
      ),
      'To ensure officials can explain actions and be reviewed or corrected when necessary',
      2,
      8,
      'Accountability connects power with answerability, oversight, and consequences.',
      false,
      true,
      v_now
    );

  RAISE NOTICE 'Seeded course %, modules %, %, %, and assessment %.',
    v_course_id,
    v_module_1_id,
    v_module_2_id,
    v_module_3_id,
    v_assessment_id;
END
$seed$;
