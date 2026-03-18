-- Seed content for the course:
-- Community Engagement and Development Excellence
--
-- What this script does:
--
-- - Creates or updates a complete Community Engagement and Development Excellence course using an existing trainer/admin/SPD user as instructor.
-- - Upserts 4 finalized modules with text, YouTube video, image, learning material, and quiz blocks.
-- - Upserts 1 standalone graded course assessment.
-- - Rewrites assessment questions on every run so the seed stays deterministic.

DO $seed$
DECLARE
  v_course_title text := 'Community Engagement and Development Excellence';
  v_course_id uuid;
  v_instructor_id uuid;
  v_now timestamptz := timezone('utc', now());

  v_module_1_id uuid;
  v_module_2_id uuid;
  v_module_3_id uuid;
  v_module_4_id uuid;

  v_assessment_id uuid;

  v_m1_video text := 'https://www.youtube.com/watch?v=ScMzIvxBSi4';
  v_m2_video text := 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  v_m3_video text := 'https://www.youtube.com/watch?v=HluANRwPyNo';
  v_m4_video text := 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

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
      quote_literal('A practice-oriented course that develops the knowledge and field habits needed to build trust with communities, assess local needs, plan responsive programs, mobilize stakeholders, and sustain community-led development initiatives.') || ', ' ||
      quote_literal('Community Development') || ', ' ||
      quote_literal('Intermediate') || ', ' ||
      '16, ' ||
      quote_literal(v_instructor_id);

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', ' || quote_literal('general_public');
    END IF;

    v_sql := v_sql || ', ' ||
      quote_literal('/images/course-service.svg') || ', ' ||
      'false, ' ||
      'ARRAY[' ||
        quote_literal('Community Engagement') || ', ' ||
        quote_literal('Stakeholder Communication') || ', ' ||
        quote_literal('Program Planning') || ', ' ||
        quote_literal('Facilitation') || ', ' ||
        quote_literal('Monitoring and Evaluation') || ']::text[]';

    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('Community Engagement') || ', ' ||
        quote_literal('Stakeholder Communication') || ', ' ||
        quote_literal('Program Planning') || ', ' ||
        quote_literal('Facilitation') || ', ' ||
        quote_literal('Monitoring and Evaluation') || ']::text[]';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('Community Development') || ', ' ||
        quote_literal('Public Service') || ', ' ||
        quote_literal('Inclusive Participation') || ', ' ||
        quote_literal('Project Implementation') || ']::text[]';
    END IF;
    IF v_has_course_industry_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('public-service') || ', ' ||
        quote_literal('nonprofit') || ', ' ||
        quote_literal('local-governance') || ', ' ||
        quote_literal('social-development') || ']::text[]';
    END IF;
    IF v_has_course_career_paths THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('community-development-worker') || ', ' ||
        quote_literal('program-coordinator') || ', ' ||
        quote_literal('ngo-field-officer') || ']::text[]';
    END IF;

    v_sql := v_sql || ', 0, 4.6, ' || quote_literal('completion') || ', true, ' ||
      quote_literal(v_now) || ', ' || quote_literal(v_now) || ') RETURNING id';

    EXECUTE v_sql INTO v_course_id;
  ELSE
    v_sql := 'UPDATE public.courses SET ' ||
      'description = ' || quote_literal('A practice-oriented course that develops the knowledge and field habits needed to build trust with communities, assess local needs, plan responsive programs, mobilize stakeholders, and sustain community-led development initiatives.') || ', ' ||
      'category = ' || quote_literal('Community Development') || ', ' ||
      'level = ' || quote_literal('Intermediate') || ', ' ||
      'duration = 16, ' ||
      'instructor_id = ' || quote_literal(v_instructor_id);

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', trainee_audience = ' || quote_literal('general_public');
    END IF;

    v_sql := v_sql || ', thumbnail = ' || quote_literal('/images/course-service.svg') ||
      ', is_tesda_accredited = false' ||
      ', skills = ARRAY[' ||
        quote_literal('Community Engagement') || ', ' ||
        quote_literal('Stakeholder Communication') || ', ' ||
        quote_literal('Program Planning') || ', ' ||
        quote_literal('Facilitation') || ', ' ||
        quote_literal('Monitoring and Evaluation') || ']::text[]';

    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', skill_tags = ARRAY[' ||
        quote_literal('Community Engagement') || ', ' ||
        quote_literal('Stakeholder Communication') || ', ' ||
        quote_literal('Program Planning') || ', ' ||
        quote_literal('Facilitation') || ', ' ||
        quote_literal('Monitoring and Evaluation') || ']::text[]';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', topic_tags = ARRAY[' ||
        quote_literal('Community Development') || ', ' ||
        quote_literal('Public Service') || ', ' ||
        quote_literal('Inclusive Participation') || ', ' ||
        quote_literal('Project Implementation') || ']::text[]';
    END IF;
    IF v_has_course_industry_tags THEN
      v_sql := v_sql || ', industry_tags = ARRAY[' ||
        quote_literal('public-service') || ', ' ||
        quote_literal('nonprofit') || ', ' ||
        quote_literal('local-governance') || ', ' ||
        quote_literal('social-development') || ']::text[]';
    END IF;
    IF v_has_course_career_paths THEN
      v_sql := v_sql || ', career_paths = ARRAY[' ||
        quote_literal('community-development-worker') || ', ' ||
        quote_literal('program-coordinator') || ', ' ||
        quote_literal('ngo-field-officer') || ']::text[]';
    END IF;

    v_sql := v_sql || ', rating = 4.6' ||
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
    AND title = 'Foundations of Community Engagement'
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
      'Foundations of Community Engagement',
      'Establishes the core principles, values, and field behaviors that support respectful and effective engagement with communities.',
      1,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'ce-m1-text1',
          'type', 'text',
          'title', 'What meaningful engagement looks like',
          'content', $html$<p>Community engagement is strongest when people are treated as partners rather than passive recipients. Effective practitioners listen before proposing solutions, acknowledge local knowledge, and create space for groups whose voices are often missed such as youth, women, older persons, and persons with disabilities.</p><p>Meaningful engagement requires honest communication about what is possible, what is already decided, and what is genuinely open for community input. Building trust takes time and consistent follow-through, but the results are programs that are more relevant, more used, and more likely to be sustained.</p>$html$
        ),
        jsonb_build_object(
          'id', 'ce-m1-text2',
          'type', 'text',
          'title', 'Trust, inclusion, and accountability in development work',
          'content', $html$<p>Trust is built through transparency, reliability, and respect. When community members see that their input is genuinely used, that commitments are followed through, and that they are treated as knowledgeable contributors rather than beneficiaries to be managed, participation grows stronger over time.</p><p>Inclusion means deliberately bringing in the perspectives of people who are often excluded. Accountability means being honest about what has been done, what has not, and why. Together these values make development work more effective and more ethical.</p>$html$
        ),
        jsonb_build_object(
          'id', 'ce-m1-video',
          'type', 'video',
          'title', 'Introduction to community engagement principles',
          'content', '',
          'videoUrl', v_m1_video
        ),
        jsonb_build_object(
          'id', 'ce-m1-image',
          'type', 'image',
          'title', 'Community dialogue circle',
          'imageUrl', 'https://picsum.photos/seed/community-engagement-m1/1200/675',
          'altText', 'Community members and facilitators seated in a dialogue circle',
          'caption', 'A visual reminder that development work starts with listening, shared understanding, and visible inclusion.'
        ),
        jsonb_build_object(
          'id', 'ce-m1-ref1',
          'type', 'learning_material',
          'title', 'Reference reading on communication and participation',
          'url', 'https://edu.gcfglobal.org/en/',
          'content', 'Supplemental material on clear communication, collaboration, and learner-friendly facilitation habits for community-based work.'
        ),
        jsonb_build_object(
          'id', 'ce-m1-quiz1',
          'type', 'quiz',
          'title', 'Quick check: meaningful engagement',
          'content', 'Which action best reflects meaningful community engagement?',
          'options', jsonb_build_array(
            'Finalizing the project plan before consulting residents',
            'Asking local leaders only and excluding other groups',
            'Involving community members in identifying issues and shaping responses',
            'Sharing project updates only after the budget is spent'
          ),
          'correctAnswer', 2,
          'explanation', 'Meaningful engagement requires participation in decision-making, not just information delivery.'
        ),
        jsonb_build_object(
          'id', 'ce-m1-quiz2',
          'type', 'quiz',
          'title', 'Quick check: building trust',
          'content', 'True or false: Trust is built faster when facilitators make promises they are not yet sure they can fulfill.',
          'options', jsonb_build_array(
            'True',
            'False'
          ),
          'correctAnswer', 1,
          'explanation', 'Unrealistic promises damage credibility and weaken long-term cooperation.'
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
    SET description = 'Establishes the core principles, values, and field behaviors that support respectful and effective engagement with communities.',
        "order" = 1,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'ce-m1-text1',
            'type', 'text',
            'title', 'What meaningful engagement looks like',
            'content', $html$<p>Community engagement is strongest when people are treated as partners rather than passive recipients. Effective practitioners listen before proposing solutions, acknowledge local knowledge, and create space for groups whose voices are often missed such as youth, women, older persons, and persons with disabilities.</p><p>Meaningful engagement requires honest communication about what is possible, what is already decided, and what is genuinely open for community input. Building trust takes time and consistent follow-through, but the results are programs that are more relevant, more used, and more likely to be sustained.</p>$html$
          ),
          jsonb_build_object(
            'id', 'ce-m1-text2',
            'type', 'text',
            'title', 'Trust, inclusion, and accountability in development work',
            'content', $html$<p>Trust is built through transparency, reliability, and respect. When community members see that their input is genuinely used, that commitments are followed through, and that they are treated as knowledgeable contributors rather than beneficiaries to be managed, participation grows stronger over time.</p><p>Inclusion means deliberately bringing in the perspectives of people who are often excluded. Accountability means being honest about what has been done, what has not, and why. Together these values make development work more effective and more ethical.</p>$html$
          ),
          jsonb_build_object(
            'id', 'ce-m1-video',
            'type', 'video',
            'title', 'Introduction to community engagement principles',
            'content', '',
            'videoUrl', v_m1_video
          ),
          jsonb_build_object(
            'id', 'ce-m1-image',
            'type', 'image',
            'title', 'Community dialogue circle',
            'imageUrl', 'https://picsum.photos/seed/community-engagement-m1/1200/675',
            'altText', 'Community members and facilitators seated in a dialogue circle',
            'caption', 'A visual reminder that development work starts with listening, shared understanding, and visible inclusion.'
          ),
          jsonb_build_object(
            'id', 'ce-m1-ref1',
            'type', 'learning_material',
            'title', 'Reference reading on communication and participation',
            'url', 'https://edu.gcfglobal.org/en/',
            'content', 'Supplemental material on clear communication, collaboration, and learner-friendly facilitation habits for community-based work.'
          ),
          jsonb_build_object(
            'id', 'ce-m1-quiz1',
            'type', 'quiz',
            'title', 'Quick check: meaningful engagement',
            'content', 'Which action best reflects meaningful community engagement?',
            'options', jsonb_build_array(
              'Finalizing the project plan before consulting residents',
              'Asking local leaders only and excluding other groups',
              'Involving community members in identifying issues and shaping responses',
              'Sharing project updates only after the budget is spent'
            ),
            'correctAnswer', 2,
            'explanation', 'Meaningful engagement requires participation in decision-making, not just information delivery.'
          ),
          jsonb_build_object(
            'id', 'ce-m1-quiz2',
            'type', 'quiz',
            'title', 'Quick check: building trust',
            'content', 'True or false: Trust is built faster when facilitators make promises they are not yet sure they can fulfill.',
            'options', jsonb_build_array(
              'True',
              'False'
            ),
            'correctAnswer', 1,
            'explanation', 'Unrealistic promises damage credibility and weaken long-term cooperation.'
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
    AND title = 'Stakeholder Mapping and Community Needs Assessment'
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
      'Stakeholder Mapping and Community Needs Assessment',
      'Guides learners in identifying key actors, collecting relevant information, and analyzing what a community needs before proposing interventions.',
      2,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'ce-m2-text1',
          'type', 'text',
          'title', 'Mapping stakeholders before acting',
          'content', $html$<p>Development initiatives often fail when planners focus only on visible officials and overlook informal influencers, frontline workers, local organizations, and affected households. A simple stakeholder map helps teams understand who is affected, who has influence, and who should be involved at each stage of planning and implementation.</p><p>A good stakeholder analysis categorizes actors by their relationship to the issue, their level of interest, and their capacity to support or block progress. This helps project teams prioritize engagement and allocate communication effort effectively.</p>$html$
        ),
        jsonb_build_object(
          'id', 'ce-m2-text2',
          'type', 'text',
          'title', 'Community needs assessment methods',
          'content', $html$<p>A needs assessment is a systematic way of understanding what a community values, what it lacks, and what it already has. Common methods include individual interviews, focus group discussions, direct observation, community mapping, and participatory ranking exercises. Each method produces different kinds of information and works better in different contexts.</p><p>Combining methods usually produces more complete and trustworthy findings. For example, a focus group may reveal shared concerns that an individual interview would not surface, while direct observation can confirm or challenge what people say in formal discussions.</p>$html$
        ),
        jsonb_build_object(
          'id', 'ce-m2-video',
          'type', 'video',
          'title', 'Community needs assessment basics',
          'content', '',
          'videoUrl', v_m2_video
        ),
        jsonb_build_object(
          'id', 'ce-m2-image',
          'type', 'image',
          'title', 'Stakeholder mapping board',
          'imageUrl', 'https://picsum.photos/seed/community-engagement-m2/1200/675',
          'altText', 'A stakeholder map with community actors, influence levels, and partnership roles',
          'caption', 'Stakeholder mapping helps project teams see who must be informed, consulted, involved, or empowered.'
        ),
        jsonb_build_object(
          'id', 'ce-m2-ref1',
          'type', 'learning_material',
          'title', 'Reference guide for planning and collaborative work',
          'url', 'https://www.atlassian.com/work-management/productivity',
          'content', 'Supplemental reading on organizing collaborative work, clarifying responsibilities, and aligning actions with goals in community and organizational settings.'
        ),
        jsonb_build_object(
          'id', 'ce-m2-quiz1',
          'type', 'quiz',
          'title', 'Quick check: stakeholder mapping',
          'content', 'What is the main purpose of a stakeholder map?',
          'options', jsonb_build_array(
            'To replace field interviews completely',
            'To identify who is affected, influential, and necessary to engage',
            'To estimate the final project budget only',
            'To choose the project logo and campaign materials'
          ),
          'correctAnswer', 1,
          'explanation', 'Stakeholder mapping clarifies relationships, influence, and engagement priorities.'
        ),
        jsonb_build_object(
          'id', 'ce-m2-quiz2',
          'type', 'quiz',
          'title', 'Quick check: needs assessment',
          'content', 'True or false: A needs assessment should rely only on assumptions from the project team if time is limited.',
          'options', jsonb_build_array(
            'True',
            'False'
          ),
          'correctAnswer', 1,
          'explanation', 'Even a simple needs assessment should include direct evidence from the community.'
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
    SET description = 'Guides learners in identifying key actors, collecting relevant information, and analyzing what a community needs before proposing interventions.',
        "order" = 2,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'ce-m2-text1',
            'type', 'text',
            'title', 'Mapping stakeholders before acting',
            'content', $html$<p>Development initiatives often fail when planners focus only on visible officials and overlook informal influencers, frontline workers, local organizations, and affected households. A simple stakeholder map helps teams understand who is affected, who has influence, and who should be involved at each stage of planning and implementation.</p><p>A good stakeholder analysis categorizes actors by their relationship to the issue, their level of interest, and their capacity to support or block progress. This helps project teams prioritize engagement and allocate communication effort effectively.</p>$html$
          ),
          jsonb_build_object(
            'id', 'ce-m2-text2',
            'type', 'text',
            'title', 'Community needs assessment methods',
            'content', $html$<p>A needs assessment is a systematic way of understanding what a community values, what it lacks, and what it already has. Common methods include individual interviews, focus group discussions, direct observation, community mapping, and participatory ranking exercises. Each method produces different kinds of information and works better in different contexts.</p><p>Combining methods usually produces more complete and trustworthy findings. For example, a focus group may reveal shared concerns that an individual interview would not surface, while direct observation can confirm or challenge what people say in formal discussions.</p>$html$
          ),
          jsonb_build_object(
            'id', 'ce-m2-video',
            'type', 'video',
            'title', 'Community needs assessment basics',
            'content', '',
            'videoUrl', v_m2_video
          ),
          jsonb_build_object(
            'id', 'ce-m2-image',
            'type', 'image',
            'title', 'Stakeholder mapping board',
            'imageUrl', 'https://picsum.photos/seed/community-engagement-m2/1200/675',
            'altText', 'A stakeholder map with community actors, influence levels, and partnership roles',
            'caption', 'Stakeholder mapping helps project teams see who must be informed, consulted, involved, or empowered.'
          ),
          jsonb_build_object(
            'id', 'ce-m2-ref1',
            'type', 'learning_material',
            'title', 'Reference guide for planning and collaborative work',
            'url', 'https://www.atlassian.com/work-management/productivity',
            'content', 'Supplemental reading on organizing collaborative work, clarifying responsibilities, and aligning actions with goals in community and organizational settings.'
          ),
          jsonb_build_object(
            'id', 'ce-m2-quiz1',
            'type', 'quiz',
            'title', 'Quick check: stakeholder mapping',
            'content', 'What is the main purpose of a stakeholder map?',
            'options', jsonb_build_array(
              'To replace field interviews completely',
              'To identify who is affected, influential, and necessary to engage',
              'To estimate the final project budget only',
              'To choose the project logo and campaign materials'
            ),
            'correctAnswer', 1,
            'explanation', 'Stakeholder mapping clarifies relationships, influence, and engagement priorities.'
          ),
          jsonb_build_object(
            'id', 'ce-m2-quiz2',
            'type', 'quiz',
            'title', 'Quick check: needs assessment',
            'content', 'True or false: A needs assessment should rely only on assumptions from the project team if time is limited.',
            'options', jsonb_build_array(
              'True',
              'False'
            ),
            'correctAnswer', 1,
            'explanation', 'Even a simple needs assessment should include direct evidence from the community.'
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
    AND title = 'Participatory Program Design and Resource Mobilization'
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
      'Participatory Program Design and Resource Mobilization',
      'Shows learners how to convert assessment findings into realistic activities, timelines, resource plans, and shared commitments with community partners.',
      3,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'ce-m3-text1',
          'type', 'text',
          'title', 'Turning needs into an action plan',
          'content', $html$<p>Once priorities are clear, teams must translate them into manageable actions. A strong community action plan identifies the problem, states what success looks like, assigns responsibilities, sets realistic deadlines, and clarifies what support will come from community members, government offices, and partner organizations.</p><p>Participatory planning techniques such as collaborative drafting sessions, public feedback periods, and community validation meetings strengthen both the quality of the plan and the commitment of participants to its implementation.</p>$html$
        ),
        jsonb_build_object(
          'id', 'ce-m3-text2',
          'type', 'text',
          'title', 'Resource mobilization and community contributions',
          'content', $html$<p>Most community development work involves multiple sources of support. Financial contributions from government programs or donors are often complemented by in-kind contributions from community members such as volunteer labor, meeting spaces, local expertise, tools, or materials. Recognizing and documenting these contributions strengthens ownership and accountability.</p><p>Resource mobilization is more effective when the community sees a clear connection between their contribution and a tangible improvement. Clear expectations, honest reporting, and visible results encourage continued participation and sustained investment.</p>$html$
        ),
        jsonb_build_object(
          'id', 'ce-m3-video',
          'type', 'video',
          'title', 'Building practical action plans',
          'content', '',
          'videoUrl', v_m3_video
        ),
        jsonb_build_object(
          'id', 'ce-m3-image',
          'type', 'image',
          'title', 'Community planning session wall chart',
          'imageUrl', 'https://picsum.photos/seed/community-engagement-m3/1200/675',
          'altText', 'A wall chart showing project tasks, timelines, and assigned community roles',
          'caption', 'Visible planning tools help community members understand commitments and monitor progress together.'
        ),
        jsonb_build_object(
          'id', 'ce-m3-ref1',
          'type', 'learning_material',
          'title', 'Reference material on structured planning',
          'url', 'https://www.microsoft.com/en-us/microsoft-365/business-insights-ideas/resources',
          'content', 'Supplemental reading on turning ideas into organized work plans and tracking deliverables clearly in collaborative settings.'
        ),
        jsonb_build_object(
          'id', 'ce-m3-quiz1',
          'type', 'quiz',
          'title', 'Quick check: action plan elements',
          'content', 'Which element is essential in a community action plan?',
          'options', jsonb_build_array(
            'A list of activities without owners or deadlines',
            'Objectives, activities, assigned roles, and timelines',
            'A plan based only on outside donor preferences',
            'A budget with no link to community priorities'
          ),
          'correctAnswer', 1,
          'explanation', 'An action plan must connect goals to responsibilities and timing.'
        ),
        jsonb_build_object(
          'id', 'ce-m3-quiz2',
          'type', 'quiz',
          'title', 'Quick check: community ownership',
          'content', 'True or false: Community ownership usually improves when local stakeholders help define responsibilities and contributions.',
          'options', jsonb_build_array(
            'True',
            'False'
          ),
          'correctAnswer', 0,
          'explanation', 'Participation in planning increases buy-in and commitment during implementation.'
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
    SET description = 'Shows learners how to convert assessment findings into realistic activities, timelines, resource plans, and shared commitments with community partners.',
        "order" = 3,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'ce-m3-text1',
            'type', 'text',
            'title', 'Turning needs into an action plan',
            'content', $html$<p>Once priorities are clear, teams must translate them into manageable actions. A strong community action plan identifies the problem, states what success looks like, assigns responsibilities, sets realistic deadlines, and clarifies what support will come from community members, government offices, and partner organizations.</p><p>Participatory planning techniques such as collaborative drafting sessions, public feedback periods, and community validation meetings strengthen both the quality of the plan and the commitment of participants to its implementation.</p>$html$
          ),
          jsonb_build_object(
            'id', 'ce-m3-text2',
            'type', 'text',
            'title', 'Resource mobilization and community contributions',
            'content', $html$<p>Most community development work involves multiple sources of support. Financial contributions from government programs or donors are often complemented by in-kind contributions from community members such as volunteer labor, meeting spaces, local expertise, tools, or materials. Recognizing and documenting these contributions strengthens ownership and accountability.</p><p>Resource mobilization is more effective when the community sees a clear connection between their contribution and a tangible improvement. Clear expectations, honest reporting, and visible results encourage continued participation and sustained investment.</p>$html$
          ),
          jsonb_build_object(
            'id', 'ce-m3-video',
            'type', 'video',
            'title', 'Building practical action plans',
            'content', '',
            'videoUrl', v_m3_video
          ),
          jsonb_build_object(
            'id', 'ce-m3-image',
            'type', 'image',
            'title', 'Community planning session wall chart',
            'imageUrl', 'https://picsum.photos/seed/community-engagement-m3/1200/675',
            'altText', 'A wall chart showing project tasks, timelines, and assigned community roles',
            'caption', 'Visible planning tools help community members understand commitments and monitor progress together.'
          ),
          jsonb_build_object(
            'id', 'ce-m3-ref1',
            'type', 'learning_material',
            'title', 'Reference material on structured planning',
            'url', 'https://www.microsoft.com/en-us/microsoft-365/business-insights-ideas/resources',
            'content', 'Supplemental reading on turning ideas into organized work plans and tracking deliverables clearly in collaborative settings.'
          ),
          jsonb_build_object(
            'id', 'ce-m3-quiz1',
            'type', 'quiz',
            'title', 'Quick check: action plan elements',
            'content', 'Which element is essential in a community action plan?',
            'options', jsonb_build_array(
              'A list of activities without owners or deadlines',
              'Objectives, activities, assigned roles, and timelines',
              'A plan based only on outside donor preferences',
              'A budget with no link to community priorities'
            ),
            'correctAnswer', 1,
            'explanation', 'An action plan must connect goals to responsibilities and timing.'
          ),
          jsonb_build_object(
            'id', 'ce-m3-quiz2',
            'type', 'quiz',
            'title', 'Quick check: community ownership',
            'content', 'True or false: Community ownership usually improves when local stakeholders help define responsibilities and contributions.',
            'options', jsonb_build_array(
              'True',
              'False'
            ),
            'correctAnswer', 0,
            'explanation', 'Participation in planning increases buy-in and commitment during implementation.'
          )
        )::text,
        materials = ARRAY[v_m3_video]::text[],
        prerequisites = ARRAY[v_module_1_id::text, v_module_2_id::text]::text[],
        module_thumbnail = '/images/course-service.svg',
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_3_id;
  END IF;

  -- ------------------------------------------------------------------ Module 4
  SELECT id
  INTO v_module_4_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Monitoring, Feedback, and Sustainable Community Development'
  LIMIT 1;

  IF v_module_4_id IS NULL THEN
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
      'Monitoring, Feedback, and Sustainable Community Development',
      'Develops the learner''s ability to track progress, collect feedback, respond to issues, and strengthen long-term sustainability beyond initial project delivery.',
      4,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'ce-m4-text1',
          'type', 'text',
          'title', 'Monitoring progress without overcomplicating it',
          'content', $html$<p>Monitoring is not only about reports. It is about regularly checking whether activities are happening, whether participants are benefiting, and whether problems need correction. Simple indicators such as attendance, completion of planned activities, beneficiary satisfaction, and observed behavior change can guide better decisions when reviewed consistently.</p><p>Monitoring systems are most effective when they are simple enough for field teams to maintain, visible enough for community members to follow, and timely enough to allow adjustments before problems become crises.</p>$html$
        ),
        jsonb_build_object(
          'id', 'ce-m4-text2',
          'type', 'text',
          'title', 'Feedback loops and sustainable community development',
          'content', $html$<p>Feedback loops connect program implementers with the people they serve. Systematic feedback collection through regular community meetings, suggestion mechanisms, or simple review sessions helps teams identify gaps, confirm what is working, and build accountability to participants rather than just to donors or supervisors.</p><p>Sustainability requires gradually shifting ownership to the community. This means training local leaders, transferring knowledge and skills, documenting processes clearly, and reducing external dependency over time. Projects that plan for sustainability from the beginning are more likely to produce lasting change.</p>$html$
        ),
        jsonb_build_object(
          'id', 'ce-m4-video',
          'type', 'video',
          'title', 'Feedback and sustainability in local programs',
          'content', '',
          'videoUrl', v_m4_video
        ),
        jsonb_build_object(
          'id', 'ce-m4-image',
          'type', 'image',
          'title', 'Progress review meeting',
          'imageUrl', 'https://picsum.photos/seed/community-engagement-m4/1200/675',
          'altText', 'A review meeting showing indicators, notes, and community feedback points',
          'caption', 'Monitoring works best when community members can see progress, raise concerns, and help shape improvements.'
        ),
        jsonb_build_object(
          'id', 'ce-m4-ref1',
          'type', 'learning_material',
          'title', 'Reference reading on learning and communication',
          'url', 'https://developer.mozilla.org/en-US/docs/Learn',
          'content', 'Supplemental material that supports clear reporting, structured review, and practical knowledge-sharing habits in program delivery settings.'
        ),
        jsonb_build_object(
          'id', 'ce-m4-quiz1',
          'type', 'quiz',
          'title', 'Quick check: monitoring indicators',
          'content', 'Which is the best example of a monitoring indicator?',
          'options', jsonb_build_array(
            'A general belief that the project is successful',
            'The number of community participants attending monthly sessions',
            'The project title used in presentation slides',
            'The color scheme of the printed campaign poster'
          ),
          'correctAnswer', 1,
          'explanation', 'Indicators should be observable or measurable signs of progress.'
        ),
        jsonb_build_object(
          'id', 'ce-m4-quiz2',
          'type', 'quiz',
          'title', 'Quick check: feedback timing',
          'content', 'True or false: Feedback should ideally be collected only after a project fully ends.',
          'options', jsonb_build_array(
            'True',
            'False'
          ),
          'correctAnswer', 1,
          'explanation', 'Ongoing feedback allows teams to improve implementation while activities are still underway.'
        )
      )::text,
      ARRAY[v_m4_video]::text[],
      ARRAY[v_module_1_id::text, v_module_2_id::text, v_module_3_id::text]::text[],
      '/images/course-service.svg',
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_4_id;
  ELSE
    UPDATE public.modules
    SET description = 'Develops the learner''s ability to track progress, collect feedback, respond to issues, and strengthen long-term sustainability beyond initial project delivery.',
        "order" = 4,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'ce-m4-text1',
            'type', 'text',
            'title', 'Monitoring progress without overcomplicating it',
            'content', $html$<p>Monitoring is not only about reports. It is about regularly checking whether activities are happening, whether participants are benefiting, and whether problems need correction. Simple indicators such as attendance, completion of planned activities, beneficiary satisfaction, and observed behavior change can guide better decisions when reviewed consistently.</p><p>Monitoring systems are most effective when they are simple enough for field teams to maintain, visible enough for community members to follow, and timely enough to allow adjustments before problems become crises.</p>$html$
          ),
          jsonb_build_object(
            'id', 'ce-m4-text2',
            'type', 'text',
            'title', 'Feedback loops and sustainable community development',
            'content', $html$<p>Feedback loops connect program implementers with the people they serve. Systematic feedback collection through regular community meetings, suggestion mechanisms, or simple review sessions helps teams identify gaps, confirm what is working, and build accountability to participants rather than just to donors or supervisors.</p><p>Sustainability requires gradually shifting ownership to the community. This means training local leaders, transferring knowledge and skills, documenting processes clearly, and reducing external dependency over time. Projects that plan for sustainability from the beginning are more likely to produce lasting change.</p>$html$
          ),
          jsonb_build_object(
            'id', 'ce-m4-video',
            'type', 'video',
            'title', 'Feedback and sustainability in local programs',
            'content', '',
            'videoUrl', v_m4_video
          ),
          jsonb_build_object(
            'id', 'ce-m4-image',
            'type', 'image',
            'title', 'Progress review meeting',
            'imageUrl', 'https://picsum.photos/seed/community-engagement-m4/1200/675',
            'altText', 'A review meeting showing indicators, notes, and community feedback points',
            'caption', 'Monitoring works best when community members can see progress, raise concerns, and help shape improvements.'
          ),
          jsonb_build_object(
            'id', 'ce-m4-ref1',
            'type', 'learning_material',
            'title', 'Reference reading on learning and communication',
            'url', 'https://developer.mozilla.org/en-US/docs/Learn',
            'content', 'Supplemental material that supports clear reporting, structured review, and practical knowledge-sharing habits in program delivery settings.'
          ),
          jsonb_build_object(
            'id', 'ce-m4-quiz1',
            'type', 'quiz',
            'title', 'Quick check: monitoring indicators',
            'content', 'Which is the best example of a monitoring indicator?',
            'options', jsonb_build_array(
              'A general belief that the project is successful',
              'The number of community participants attending monthly sessions',
              'The project title used in presentation slides',
              'The color scheme of the printed campaign poster'
            ),
            'correctAnswer', 1,
            'explanation', 'Indicators should be observable or measurable signs of progress.'
          ),
          jsonb_build_object(
            'id', 'ce-m4-quiz2',
            'type', 'quiz',
            'title', 'Quick check: feedback timing',
            'content', 'True or false: Feedback should ideally be collected only after a project fully ends.',
            'options', jsonb_build_array(
              'True',
              'False'
            ),
            'correctAnswer', 1,
            'explanation', 'Ongoing feedback allows teams to improve implementation while activities are still underway.'
          )
        )::text,
        materials = ARRAY[v_m4_video]::text[],
        prerequisites = ARRAY[v_module_1_id::text, v_module_2_id::text, v_module_3_id::text]::text[],
        module_thumbnail = '/images/course-service.svg',
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_4_id;
  END IF;

  -- ------------------------------------------------------------------ Assessment
  SELECT id
  INTO v_assessment_id
  FROM public.assessments
  WHERE course_id = v_course_id
    AND title = 'Community Engagement and Development Final Assessment'
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
    quote_literal('Community Engagement and Development Final Assessment') || ', ' ||
    quote_literal('Measure the learner''s understanding of community engagement principles, stakeholder mapping, participatory planning, resource mobilization, and monitoring practices.') || ', ' ||
    quote_literal('/images/course-service.svg') || ', 30, 75, 3, true, true';

  IF v_has_assessment_prerequisite_module_ids THEN
    v_sql := v_sql || ', ARRAY[' ||
      quote_literal(v_module_1_id::text) || ', ' ||
      quote_literal(v_module_2_id::text) || ', ' ||
      quote_literal(v_module_3_id::text) || ', ' ||
      quote_literal(v_module_4_id::text) || ']::uuid[]';
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
      'description = ' || quote_literal('Measure the learner''s understanding of community engagement principles, stakeholder mapping, participatory planning, resource mobilization, and monitoring practices.') || ', ' ||
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
        quote_literal(v_module_3_id::text) || ', ' ||
        quote_literal(v_module_4_id::text) || ']::uuid[]';
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
      'Which statement best describes community engagement excellence?',
      'multiple_choice',
      jsonb_build_array(
        'Delivering services quickly without asking for local input',
        'Building partnerships where communities help define problems and solutions',
        'Prioritizing reports over relationships',
        'Using one standard intervention for all communities'
      ),
      'Building partnerships where communities help define problems and solutions',
      2,
      1,
      'Excellence in engagement is rooted in participation, respect, and shared decision-making.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which stakeholder is most likely to provide insight into everyday barriers faced by beneficiaries?',
      'multiple_choice',
      jsonb_build_array(
        'A distant supplier with no field role',
        'Directly affected households and service users',
        'A printer producing advocacy materials',
        'A visitor attending only the launch event'
      ),
      'Directly affected households and service users',
      2,
      2,
      'Primary stakeholders experience the issue directly and are essential sources of field insight.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'True or false: Excluding quieter groups from consultations can lead to incomplete or biased planning decisions.',
      'true_false',
      NULL,
      'true',
      1,
      3,
      'Missing voices often means missing actual needs, constraints, and risks.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'True or false: A project is sustainable if outside partners continue doing all of the work indefinitely.',
      'true_false',
      NULL,
      'false',
      1,
      4,
      'Sustainability improves when local capacity and ownership increase over time.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which practice most improves trust during project implementation?',
      'multiple_choice',
      jsonb_build_array(
        'Hiding delays until the project is complete',
        'Communicating updates honestly and explaining adjustments clearly',
        'Changing responsibilities without informing anyone',
        'Avoiding feedback to prevent complaints'
      ),
      'Communicating updates honestly and explaining adjustments clearly',
      2,
      5,
      'Transparency strengthens credibility and helps protect relationships during challenges.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which is the best example of an in-kind community contribution?',
      'multiple_choice',
      jsonb_build_array(
        'A volunteer venue for meetings',
        'A delayed project report',
        'A blank attendance sheet',
        'An unconfirmed promise from an outside donor'
      ),
      'A volunteer venue for meetings',
      2,
      6,
      'In-kind support includes non-cash contributions such as space, labor, tools, or materials.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which element is essential in a community action plan?',
      'multiple_choice',
      jsonb_build_array(
        'A list of activities without owners or deadlines',
        'Objectives, activities, assigned roles, and timelines',
        'A plan based only on outside donor preferences',
        'A budget with no link to community priorities'
      ),
      'Objectives, activities, assigned roles, and timelines',
      2,
      7,
      'An action plan must connect goals to responsibilities and timing.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which is the best example of a monitoring indicator?',
      'multiple_choice',
      jsonb_build_array(
        'A general belief that the project is successful',
        'The number of community participants attending monthly sessions',
        'The project title used in presentation slides',
        'The color scheme of the printed campaign poster'
      ),
      'The number of community participants attending monthly sessions',
      2,
      8,
      'Indicators should be observable or measurable signs of progress.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'True or false: Monitoring systems should be simple enough for field teams to use and timely enough to allow adjustments before problems escalate.',
      'true_false',
      NULL,
      'true',
      1,
      9,
      'Practical monitoring depends on systems that field staff can actually maintain and act on.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which action best supports long-term sustainability after external project support ends?',
      'multiple_choice',
      jsonb_build_array(
        'Keeping all knowledge with the external project team',
        'Training local leaders, transferring skills, and building community ownership gradually',
        'Reducing community meetings to save time',
        'Replacing community workers with automated systems'
      ),
      'Training local leaders, transferring skills, and building community ownership gradually',
      2,
      10,
      'Sustainability requires shifting capacity and decision-making toward the community over time.',
      false,
      true,
      v_now
    );

  RAISE NOTICE 'Seeded course %, modules %, %, %, %, and assessment %.',
    v_course_id,
    v_module_1_id,
    v_module_2_id,
    v_module_3_id,
    v_module_4_id,
    v_assessment_id;
END
$seed$;
