-- Seed content for the course:
-- Community Engagement and Development Excellence
--
-- What this script does:
-- - Creates or updates a complete Community Engagement course using an existing trainer/admin/SPD user as instructor.
-- - Upserts 4 finalized modules with text, video, image, learning material, and inline practice quiz blocks.
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

  v_course_thumbnail text := 'https://picsum.photos/seed/community-engagement-development-course/1200/675';
  v_module_1_thumbnail text := 'https://picsum.photos/seed/community-engagement-m1/1200/675';
  v_module_2_thumbnail text := 'https://picsum.photos/seed/community-engagement-m2/1200/675';
  v_module_3_thumbnail text := 'https://picsum.photos/seed/community-engagement-m3/1200/675';
  v_module_4_thumbnail text := 'https://picsum.photos/seed/community-engagement-m4/1200/675';

  v_module_1_video text := 'https://www.youtube.com/watch?v=ScMzIvxBSi4';
  v_module_2_video text := 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  v_module_3_video text := 'https://www.youtube.com/watch?v=HluANRwPyNo';
  v_module_4_video text := 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

  v_has_assessment_prerequisite_module_ids boolean;
  v_has_assessment_derived_from_module_quiz boolean;
  v_has_assessment_display_order boolean;
  v_has_course_trainee_audience boolean;
  v_has_course_skill_tags boolean;
  v_has_course_topic_tags boolean;
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

    v_sql := v_sql || ', enrolled_count, rating, certificate_type, published, created_at, updated_at) VALUES (' ||
      quote_literal(v_course_title) || ', ' ||
      quote_literal('A practice-oriented course that develops the knowledge and field habits needed to build trust with communities, assess local needs, plan responsive programs, mobilize stakeholders, and sustain community-led development initiatives.') || ', ' ||
      quote_literal('Others') || ', ' ||
      quote_literal('Intermediate') || ', ' ||
      '16, ' ||
      quote_literal(v_instructor_id);

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', ' || quote_literal('general_public');
    END IF;

    v_sql := v_sql || ', ' ||
      quote_literal(v_course_thumbnail) || ', ' ||
      'false, ' ||
      'ARRAY[' ||
        quote_literal('Communication') || ', ' ||
        quote_literal('Professional Communication') || ', ' ||
        quote_literal('Project Coordination') || ', ' ||
        quote_literal('Problem Solving') || ', ' ||
        quote_literal('Customer Service') || ']::text[]';

    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('Communication') || ', ' ||
        quote_literal('Professional Communication') || ', ' ||
        quote_literal('Project Coordination') || ', ' ||
        quote_literal('Problem Solving') || ', ' ||
        quote_literal('Customer Service') || ']::text[]';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('Professional Communication') || ', ' ||
        quote_literal('Project Management') || ', ' ||
        quote_literal('Customer Relations') || ']::text[]';
    END IF;

    v_sql := v_sql || ', 0, 4.8, ' || quote_literal('completion') || ', true, ' ||
      quote_literal(v_now) || ', ' || quote_literal(v_now) || ') RETURNING id';

    EXECUTE v_sql INTO v_course_id;
  ELSE
    v_sql := 'UPDATE public.courses SET ' ||
      'description = ' || quote_literal('A practice-oriented course that develops the knowledge and field habits needed to build trust with communities, assess local needs, plan responsive programs, mobilize stakeholders, and sustain community-led development initiatives.') || ', ' ||
      'category = ' || quote_literal('Others') || ', ' ||
      'level = ' || quote_literal('Intermediate') || ', ' ||
      'duration = 16, ' ||
      'instructor_id = ' || quote_literal(v_instructor_id);

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', trainee_audience = ' || quote_literal('general_public');
    END IF;

    v_sql := v_sql || ', thumbnail = ' || quote_literal(v_course_thumbnail) ||
      ', is_tesda_accredited = false' ||
      ', skills = ARRAY[' ||
        quote_literal('Communication') || ', ' ||
        quote_literal('Professional Communication') || ', ' ||
        quote_literal('Project Coordination') || ', ' ||
        quote_literal('Problem Solving') || ', ' ||
        quote_literal('Customer Service') || ']::text[]';

    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', skill_tags = ARRAY[' ||
        quote_literal('Communication') || ', ' ||
        quote_literal('Professional Communication') || ', ' ||
        quote_literal('Project Coordination') || ', ' ||
        quote_literal('Problem Solving') || ', ' ||
        quote_literal('Customer Service') || ']::text[]';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', topic_tags = ARRAY[' ||
        quote_literal('Professional Communication') || ', ' ||
        quote_literal('Project Management') || ', ' ||
        quote_literal('Customer Relations') || ']::text[]';
    END IF;

    v_sql := v_sql || ', rating = 4.8' ||
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
      'Establish the core principles, values, and field behaviors that support respectful and effective engagement with communities.',
      1,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'community-foundations-text',
          'type', 'text',
          'title', 'What meaningful engagement looks like',
          'content', $html$<p>Community engagement is strongest when people are treated as partners rather than passive recipients. Effective practitioners listen before proposing solutions, acknowledge local knowledge, and create space for groups whose voices are often missed such as youth, women, older persons, and persons with disabilities.</p>$html$
        ),
        jsonb_build_object(
          'id', 'community-foundations-video',
          'type', 'video',
          'title', 'Introduction to community engagement principles',
          'content', 'Use this video to introduce the idea that sustainable development depends on participation, trust, and shared ownership.',
          'videoUrl', v_module_1_video
        ),
        jsonb_build_object(
          'id', 'community-foundations-image',
          'type', 'image',
          'title', 'Community dialogue circle',
          'content', '',
          'imageUrl', 'https://picsum.photos/seed/community-engagement-m1-image/1200/675',
          'altText', 'Community members and facilitators seated in a dialogue circle',
          'caption', 'A visual reminder that development work starts with listening, shared understanding, and visible inclusion.'
        ),
        jsonb_build_object(
          'id', 'community-foundations-material',
          'type', 'learning_material',
          'title', 'Reference reading on communication and participation',
          'content', 'Supplemental material on clear communication, collaboration, and learner-friendly facilitation habits.',
          'materialUrl', 'https://edu.gcfglobal.org/en/'
        ),
        jsonb_build_object(
          'id', 'community-foundations-mc-quiz',
          'type', 'quiz',
          'title', 'Quiz 1 - Foundations of engagement',
          'content', 'Which action best reflects meaningful community engagement?',
          'questionType', 'multiple_choice',
          'options', jsonb_build_array(
            'Finalizing the project plan before consulting residents',
            'Asking local leaders only and excluding other groups',
            'Involving community members in identifying issues and shaping responses',
            'Sharing project updates only after the budget is spent'
          ),
          'correctAnswer', 2,
          'points', 1,
          'explanation', 'Meaningful engagement requires participation in decision-making, not just information delivery.'
        ),
        jsonb_build_object(
          'id', 'community-foundations-tf-quiz',
          'type', 'quiz',
          'title', 'Quiz 1 - Trust and credibility',
          'content', 'Trust is built faster when facilitators make promises they are not yet sure they can fulfill.',
          'questionType', 'true_false',
          'options', jsonb_build_array('True', 'False'),
          'correctAnswer', 1,
          'points', 1,
          'explanation', 'Unrealistic promises damage credibility and weaken long-term cooperation.'
        ),
        jsonb_build_object(
          'id', 'community-foundations-essay-quiz',
          'type', 'quiz',
          'title', 'Quiz 1 - Inclusion reflection',
          'content', 'Name one group that is often underrepresented in community consultations and explain why they should be included.',
          'questionType', 'essay',
          'points', 3,
          'explanation', 'Expected focus: recognition of marginalized groups and the value of inclusive participation.'
        )
      )::text,
      ARRAY[
        v_module_1_video,
        'https://picsum.photos/seed/community-engagement-m1-image/1200/675',
        'https://edu.gcfglobal.org/en/'
      ]::text[],
      ARRAY[]::text[],
      v_module_1_thumbnail,
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_1_id;
  ELSE
    UPDATE public.modules
    SET description = 'Establish the core principles, values, and field behaviors that support respectful and effective engagement with communities.',
        "order" = 1,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'community-foundations-text',
            'type', 'text',
            'title', 'What meaningful engagement looks like',
            'content', $html$<p>Community engagement is strongest when people are treated as partners rather than passive recipients. Effective practitioners listen before proposing solutions, acknowledge local knowledge, and create space for groups whose voices are often missed such as youth, women, older persons, and persons with disabilities.</p>$html$
          ),
          jsonb_build_object(
            'id', 'community-foundations-video',
            'type', 'video',
            'title', 'Introduction to community engagement principles',
            'content', 'Use this video to introduce the idea that sustainable development depends on participation, trust, and shared ownership.',
            'videoUrl', v_module_1_video
          ),
          jsonb_build_object(
            'id', 'community-foundations-image',
            'type', 'image',
            'title', 'Community dialogue circle',
            'content', '',
            'imageUrl', 'https://picsum.photos/seed/community-engagement-m1-image/1200/675',
            'altText', 'Community members and facilitators seated in a dialogue circle',
            'caption', 'A visual reminder that development work starts with listening, shared understanding, and visible inclusion.'
          ),
          jsonb_build_object(
            'id', 'community-foundations-material',
            'type', 'learning_material',
            'title', 'Reference reading on communication and participation',
            'content', 'Supplemental material on clear communication, collaboration, and learner-friendly facilitation habits.',
            'materialUrl', 'https://edu.gcfglobal.org/en/'
          ),
          jsonb_build_object(
            'id', 'community-foundations-mc-quiz',
            'type', 'quiz',
            'title', 'Quiz 1 - Foundations of engagement',
            'content', 'Which action best reflects meaningful community engagement?',
            'questionType', 'multiple_choice',
            'options', jsonb_build_array(
              'Finalizing the project plan before consulting residents',
              'Asking local leaders only and excluding other groups',
              'Involving community members in identifying issues and shaping responses',
              'Sharing project updates only after the budget is spent'
            ),
            'correctAnswer', 2,
            'points', 1,
            'explanation', 'Meaningful engagement requires participation in decision-making, not just information delivery.'
          ),
          jsonb_build_object(
            'id', 'community-foundations-tf-quiz',
            'type', 'quiz',
            'title', 'Quiz 1 - Trust and credibility',
            'content', 'Trust is built faster when facilitators make promises they are not yet sure they can fulfill.',
            'questionType', 'true_false',
            'options', jsonb_build_array('True', 'False'),
            'correctAnswer', 1,
            'points', 1,
            'explanation', 'Unrealistic promises damage credibility and weaken long-term cooperation.'
          ),
          jsonb_build_object(
            'id', 'community-foundations-essay-quiz',
            'type', 'quiz',
            'title', 'Quiz 1 - Inclusion reflection',
            'content', 'Name one group that is often underrepresented in community consultations and explain why they should be included.',
            'questionType', 'essay',
            'points', 3,
            'explanation', 'Expected focus: recognition of marginalized groups and the value of inclusive participation.'
          )
        )::text,
        materials = ARRAY[
          v_module_1_video,
          'https://picsum.photos/seed/community-engagement-m1-image/1200/675',
          'https://edu.gcfglobal.org/en/'
        ]::text[],
        prerequisites = ARRAY[]::text[],
        module_thumbnail = v_module_1_thumbnail,
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_1_id;
  END IF;

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
      'Guide learners in identifying key actors, collecting relevant information, and analyzing what a community needs before proposing interventions.',
      2,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'community-needs-text',
          'type', 'text',
          'title', 'Mapping stakeholders before acting',
          'content', $html$<p>Development initiatives often fail when planners focus only on visible officials and overlook informal influencers, frontline workers, local organizations, and affected households. A simple stakeholder map helps teams understand who is affected, who has influence, and who should be involved at each stage of planning and implementation.</p>$html$
        ),
        jsonb_build_object(
          'id', 'community-needs-video',
          'type', 'video',
          'title', 'Community needs assessment basics',
          'content', 'Use this video as a discussion starter on observation, interview preparation, and evidence-based prioritization.',
          'videoUrl', v_module_2_video
        ),
        jsonb_build_object(
          'id', 'community-needs-image',
          'type', 'image',
          'title', 'Stakeholder mapping board',
          'content', '',
          'imageUrl', 'https://picsum.photos/seed/community-engagement-m2-image/1200/675',
          'altText', 'A stakeholder map with community actors, influence levels, and partnership roles',
          'caption', 'Stakeholder mapping helps project teams see who must be informed, consulted, involved, or empowered.'
        ),
        jsonb_build_object(
          'id', 'community-needs-material',
          'type', 'learning_material',
          'title', 'Reference guide for planning and productivity',
          'content', 'Supplemental reading on organizing collaborative work, clarifying responsibilities, and aligning actions with goals.',
          'materialUrl', 'https://www.atlassian.com/work-management/productivity'
        ),
        jsonb_build_object(
          'id', 'community-needs-mc-quiz',
          'type', 'quiz',
          'title', 'Quiz 2 - Stakeholders and needs',
          'content', 'What is the main purpose of a stakeholder map?',
          'questionType', 'multiple_choice',
          'options', jsonb_build_array(
            'To replace field interviews completely',
            'To identify who is affected, influential, and necessary to engage',
            'To estimate the final project budget only',
            'To choose the project logo and campaign materials'
          ),
          'correctAnswer', 1,
          'points', 1,
          'explanation', 'Stakeholder mapping clarifies relationships, influence, and engagement priorities.'
        ),
        jsonb_build_object(
          'id', 'community-needs-tf-quiz',
          'type', 'quiz',
          'title', 'Quiz 2 - Evidence first',
          'content', 'A needs assessment should rely only on assumptions from the project team if time is limited.',
          'questionType', 'true_false',
          'options', jsonb_build_array('True', 'False'),
          'correctAnswer', 1,
          'points', 1,
          'explanation', 'Even a simple needs assessment should include direct evidence from the community.'
        ),
        jsonb_build_object(
          'id', 'community-needs-essay-quiz',
          'type', 'quiz',
          'title', 'Quiz 2 - Methods reflection',
          'content', 'Give one reason why household interviews and focus group discussions can produce different insights.',
          'questionType', 'essay',
          'points', 3,
          'explanation', 'Expected focus: differences in setting, comfort level, group dynamics, or depth of responses.'
        )
      )::text,
      ARRAY[
        v_module_2_video,
        'https://picsum.photos/seed/community-engagement-m2-image/1200/675',
        'https://www.atlassian.com/work-management/productivity'
      ]::text[],
      ARRAY[v_module_1_id::text]::text[],
      v_module_2_thumbnail,
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_2_id;
  ELSE
    UPDATE public.modules
    SET description = 'Guide learners in identifying key actors, collecting relevant information, and analyzing what a community needs before proposing interventions.',
        "order" = 2,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'community-needs-text',
            'type', 'text',
            'title', 'Mapping stakeholders before acting',
            'content', $html$<p>Development initiatives often fail when planners focus only on visible officials and overlook informal influencers, frontline workers, local organizations, and affected households. A simple stakeholder map helps teams understand who is affected, who has influence, and who should be involved at each stage of planning and implementation.</p>$html$
          ),
          jsonb_build_object(
            'id', 'community-needs-video',
            'type', 'video',
            'title', 'Community needs assessment basics',
            'content', 'Use this video as a discussion starter on observation, interview preparation, and evidence-based prioritization.',
            'videoUrl', v_module_2_video
          ),
          jsonb_build_object(
            'id', 'community-needs-image',
            'type', 'image',
            'title', 'Stakeholder mapping board',
            'content', '',
            'imageUrl', 'https://picsum.photos/seed/community-engagement-m2-image/1200/675',
            'altText', 'A stakeholder map with community actors, influence levels, and partnership roles',
            'caption', 'Stakeholder mapping helps project teams see who must be informed, consulted, involved, or empowered.'
          ),
          jsonb_build_object(
            'id', 'community-needs-material',
            'type', 'learning_material',
            'title', 'Reference guide for planning and productivity',
            'content', 'Supplemental reading on organizing collaborative work, clarifying responsibilities, and aligning actions with goals.',
            'materialUrl', 'https://www.atlassian.com/work-management/productivity'
          ),
          jsonb_build_object(
            'id', 'community-needs-mc-quiz',
            'type', 'quiz',
            'title', 'Quiz 2 - Stakeholders and needs',
            'content', 'What is the main purpose of a stakeholder map?',
            'questionType', 'multiple_choice',
            'options', jsonb_build_array(
              'To replace field interviews completely',
              'To identify who is affected, influential, and necessary to engage',
              'To estimate the final project budget only',
              'To choose the project logo and campaign materials'
            ),
            'correctAnswer', 1,
            'points', 1,
            'explanation', 'Stakeholder mapping clarifies relationships, influence, and engagement priorities.'
          ),
          jsonb_build_object(
            'id', 'community-needs-tf-quiz',
            'type', 'quiz',
            'title', 'Quiz 2 - Evidence first',
            'content', 'A needs assessment should rely only on assumptions from the project team if time is limited.',
            'questionType', 'true_false',
            'options', jsonb_build_array('True', 'False'),
            'correctAnswer', 1,
            'points', 1,
            'explanation', 'Even a simple needs assessment should include direct evidence from the community.'
          ),
          jsonb_build_object(
            'id', 'community-needs-essay-quiz',
            'type', 'quiz',
            'title', 'Quiz 2 - Methods reflection',
            'content', 'Give one reason why household interviews and focus group discussions can produce different insights.',
            'questionType', 'essay',
            'points', 3,
            'explanation', 'Expected focus: differences in setting, comfort level, group dynamics, or depth of responses.'
          )
        )::text,
        materials = ARRAY[
          v_module_2_video,
          'https://picsum.photos/seed/community-engagement-m2-image/1200/675',
          'https://www.atlassian.com/work-management/productivity'
        ]::text[],
        prerequisites = ARRAY[v_module_1_id::text]::text[],
        module_thumbnail = v_module_2_thumbnail,
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_2_id;
  END IF;

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
      'Show learners how to convert assessment findings into realistic activities, timelines, resource plans, and shared commitments with community partners.',
      3,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'community-design-text',
          'type', 'text',
          'title', 'Turning needs into an action plan',
          'content', $html$<p>Once priorities are clear, teams must translate them into manageable actions. A strong community action plan identifies the problem, states what success looks like, assigns responsibilities, sets realistic deadlines, and clarifies what support will come from community members, government offices, and partner organizations.</p>$html$
        ),
        jsonb_build_object(
          'id', 'community-design-video',
          'type', 'video',
          'title', 'Building practical action plans',
          'content', 'Use this video to prompt discussion about sequencing activities, defining responsibilities, and avoiding vague implementation plans.',
          'videoUrl', v_module_3_video
        ),
        jsonb_build_object(
          'id', 'community-design-image',
          'type', 'image',
          'title', 'Community planning session wall chart',
          'content', '',
          'imageUrl', 'https://picsum.photos/seed/community-engagement-m3-image/1200/675',
          'altText', 'A wall chart showing project tasks, timelines, and assigned community roles',
          'caption', 'Visible planning tools help community members understand commitments and monitor progress together.'
        ),
        jsonb_build_object(
          'id', 'community-design-material',
          'type', 'learning_material',
          'title', 'Reference material on structured planning',
          'content', 'Supplemental reading on turning ideas into organized work plans and tracking deliverables clearly.',
          'materialUrl', 'https://www.microsoft.com/en-us/microsoft-365/business-insights-ideas/resources'
        ),
        jsonb_build_object(
          'id', 'community-design-mc-quiz',
          'type', 'quiz',
          'title', 'Quiz 3 - Action planning and mobilization',
          'content', 'Which element is essential in a community action plan?',
          'questionType', 'multiple_choice',
          'options', jsonb_build_array(
            'A list of activities without owners or deadlines',
            'Objectives, activities, assigned roles, and timelines',
            'A plan based only on outside donor preferences',
            'A budget with no link to community priorities'
          ),
          'correctAnswer', 1,
          'points', 1,
          'explanation', 'An action plan must connect goals to responsibilities and timing.'
        ),
        jsonb_build_object(
          'id', 'community-design-tf-quiz',
          'type', 'quiz',
          'title', 'Quiz 3 - Ownership check',
          'content', 'Community ownership usually improves when local stakeholders help define responsibilities and contributions.',
          'questionType', 'true_false',
          'options', jsonb_build_array('True', 'False'),
          'correctAnswer', 0,
          'points', 1,
          'explanation', 'Participation in planning increases buy-in and commitment during implementation.'
        ),
        jsonb_build_object(
          'id', 'community-design-essay-quiz',
          'type', 'quiz',
          'title', 'Quiz 3 - Resource reflection',
          'content', 'Give one example of a local resource that can support a development project aside from direct funding.',
          'questionType', 'essay',
          'points', 3,
          'explanation', 'Expected focus: volunteer time, meeting space, local expertise, communication channels, tools, or in-kind materials.'
        )
      )::text,
      ARRAY[
        v_module_3_video,
        'https://picsum.photos/seed/community-engagement-m3-image/1200/675',
        'https://www.microsoft.com/en-us/microsoft-365/business-insights-ideas/resources'
      ]::text[],
      ARRAY[v_module_1_id::text, v_module_2_id::text]::text[],
      v_module_3_thumbnail,
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_3_id;
  ELSE
    UPDATE public.modules
    SET description = 'Show learners how to convert assessment findings into realistic activities, timelines, resource plans, and shared commitments with community partners.',
        "order" = 3,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'community-design-text',
            'type', 'text',
            'title', 'Turning needs into an action plan',
            'content', $html$<p>Once priorities are clear, teams must translate them into manageable actions. A strong community action plan identifies the problem, states what success looks like, assigns responsibilities, sets realistic deadlines, and clarifies what support will come from community members, government offices, and partner organizations.</p>$html$
          ),
          jsonb_build_object(
            'id', 'community-design-video',
            'type', 'video',
            'title', 'Building practical action plans',
            'content', 'Use this video to prompt discussion about sequencing activities, defining responsibilities, and avoiding vague implementation plans.',
            'videoUrl', v_module_3_video
          ),
          jsonb_build_object(
            'id', 'community-design-image',
            'type', 'image',
            'title', 'Community planning session wall chart',
            'content', '',
            'imageUrl', 'https://picsum.photos/seed/community-engagement-m3-image/1200/675',
            'altText', 'A wall chart showing project tasks, timelines, and assigned community roles',
            'caption', 'Visible planning tools help community members understand commitments and monitor progress together.'
          ),
          jsonb_build_object(
            'id', 'community-design-material',
            'type', 'learning_material',
            'title', 'Reference material on structured planning',
            'content', 'Supplemental reading on turning ideas into organized work plans and tracking deliverables clearly.',
            'materialUrl', 'https://www.microsoft.com/en-us/microsoft-365/business-insights-ideas/resources'
          ),
          jsonb_build_object(
            'id', 'community-design-mc-quiz',
            'type', 'quiz',
            'title', 'Quiz 3 - Action planning and mobilization',
            'content', 'Which element is essential in a community action plan?',
            'questionType', 'multiple_choice',
            'options', jsonb_build_array(
              'A list of activities without owners or deadlines',
              'Objectives, activities, assigned roles, and timelines',
              'A plan based only on outside donor preferences',
              'A budget with no link to community priorities'
            ),
            'correctAnswer', 1,
            'points', 1,
            'explanation', 'An action plan must connect goals to responsibilities and timing.'
          ),
          jsonb_build_object(
            'id', 'community-design-tf-quiz',
            'type', 'quiz',
            'title', 'Quiz 3 - Ownership check',
            'content', 'Community ownership usually improves when local stakeholders help define responsibilities and contributions.',
            'questionType', 'true_false',
            'options', jsonb_build_array('True', 'False'),
            'correctAnswer', 0,
            'points', 1,
            'explanation', 'Participation in planning increases buy-in and commitment during implementation.'
          ),
          jsonb_build_object(
            'id', 'community-design-essay-quiz',
            'type', 'quiz',
            'title', 'Quiz 3 - Resource reflection',
            'content', 'Give one example of a local resource that can support a development project aside from direct funding.',
            'questionType', 'essay',
            'points', 3,
            'explanation', 'Expected focus: volunteer time, meeting space, local expertise, communication channels, tools, or in-kind materials.'
          )
        )::text,
        materials = ARRAY[
          v_module_3_video,
          'https://picsum.photos/seed/community-engagement-m3-image/1200/675',
          'https://www.microsoft.com/en-us/microsoft-365/business-insights-ideas/resources'
        ]::text[],
        prerequisites = ARRAY[v_module_1_id::text, v_module_2_id::text]::text[],
        module_thumbnail = v_module_3_thumbnail,
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_3_id;
  END IF;

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
      'Develop the learner''s ability to track progress, collect feedback, respond to issues, and strengthen long-term sustainability beyond initial project delivery.',
      4,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'community-monitoring-text',
          'type', 'text',
          'title', 'Monitoring progress without overcomplicating it',
          'content', $html$<p>Monitoring is not only about reports. It is about regularly checking whether activities are happening, whether participants are benefiting, and whether problems need correction. Simple indicators such as attendance, completion of planned activities, beneficiary satisfaction, and observed behavior change can guide better decisions when reviewed consistently.</p>$html$
        ),
        jsonb_build_object(
          'id', 'community-monitoring-video',
          'type', 'video',
          'title', 'Feedback and sustainability in local programs',
          'content', 'Use this video to prompt reflection on how teams can learn from results, adjust quickly, and build long-term ownership.',
          'videoUrl', v_module_4_video
        ),
        jsonb_build_object(
          'id', 'community-monitoring-image',
          'type', 'image',
          'title', 'Progress review meeting',
          'content', '',
          'imageUrl', 'https://picsum.photos/seed/community-engagement-m4-image/1200/675',
          'altText', 'A review meeting showing indicators, notes, and community feedback points',
          'caption', 'Monitoring works best when community members can see progress, raise concerns, and help shape improvements.'
        ),
        jsonb_build_object(
          'id', 'community-monitoring-material',
          'type', 'learning_material',
          'title', 'Reference reading on learning and communication',
          'content', 'Supplemental material that supports clear reporting, structured review, and practical knowledge-sharing habits.',
          'materialUrl', 'https://developer.mozilla.org/en-US/docs/Learn'
        ),
        jsonb_build_object(
          'id', 'community-monitoring-mc-quiz',
          'type', 'quiz',
          'title', 'Quiz 4 - Monitoring and sustainability',
          'content', 'Which is the best example of a monitoring indicator?',
          'questionType', 'multiple_choice',
          'options', jsonb_build_array(
            'A general belief that the project is successful',
            'The number of community participants attending monthly sessions',
            'The project title used in presentation slides',
            'The color scheme of the printed campaign poster'
          ),
          'correctAnswer', 1,
          'points', 1,
          'explanation', 'Indicators should be observable or measurable signs of progress.'
        ),
        jsonb_build_object(
          'id', 'community-monitoring-tf-quiz',
          'type', 'quiz',
          'title', 'Quiz 4 - Feedback timing',
          'content', 'Feedback should ideally be collected only after a project fully ends.',
          'questionType', 'true_false',
          'options', jsonb_build_array('True', 'False'),
          'correctAnswer', 1,
          'points', 1,
          'explanation', 'Ongoing feedback allows teams to improve implementation while activities are still underway.'
        ),
        jsonb_build_object(
          'id', 'community-monitoring-essay-quiz',
          'type', 'quiz',
          'title', 'Quiz 4 - Sustainability reflection',
          'content', 'State one practical step that can help a community initiative continue after external support decreases.',
          'questionType', 'essay',
          'points', 3,
          'explanation', 'Expected focus: training local leaders, setting up local committees, documenting processes, or transferring responsibilities gradually.'
        )
      )::text,
      ARRAY[
        v_module_4_video,
        'https://picsum.photos/seed/community-engagement-m4-image/1200/675',
        'https://developer.mozilla.org/en-US/docs/Learn'
      ]::text[],
      ARRAY[v_module_1_id::text, v_module_2_id::text, v_module_3_id::text]::text[],
      v_module_4_thumbnail,
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_4_id;
  ELSE
    UPDATE public.modules
    SET description = 'Develop the learner''s ability to track progress, collect feedback, respond to issues, and strengthen long-term sustainability beyond initial project delivery.',
        "order" = 4,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'community-monitoring-text',
            'type', 'text',
            'title', 'Monitoring progress without overcomplicating it',
            'content', $html$<p>Monitoring is not only about reports. It is about regularly checking whether activities are happening, whether participants are benefiting, and whether problems need correction. Simple indicators such as attendance, completion of planned activities, beneficiary satisfaction, and observed behavior change can guide better decisions when reviewed consistently.</p>$html$
          ),
          jsonb_build_object(
            'id', 'community-monitoring-video',
            'type', 'video',
            'title', 'Feedback and sustainability in local programs',
            'content', 'Use this video to prompt reflection on how teams can learn from results, adjust quickly, and build long-term ownership.',
            'videoUrl', v_module_4_video
          ),
          jsonb_build_object(
            'id', 'community-monitoring-image',
            'type', 'image',
            'title', 'Progress review meeting',
            'content', '',
            'imageUrl', 'https://picsum.photos/seed/community-engagement-m4-image/1200/675',
            'altText', 'A review meeting showing indicators, notes, and community feedback points',
            'caption', 'Monitoring works best when community members can see progress, raise concerns, and help shape improvements.'
          ),
          jsonb_build_object(
            'id', 'community-monitoring-material',
            'type', 'learning_material',
            'title', 'Reference reading on learning and communication',
            'content', 'Supplemental material that supports clear reporting, structured review, and practical knowledge-sharing habits.',
            'materialUrl', 'https://developer.mozilla.org/en-US/docs/Learn'
          ),
          jsonb_build_object(
            'id', 'community-monitoring-mc-quiz',
            'type', 'quiz',
            'title', 'Quiz 4 - Monitoring and sustainability',
            'content', 'Which is the best example of a monitoring indicator?',
            'questionType', 'multiple_choice',
            'options', jsonb_build_array(
              'A general belief that the project is successful',
              'The number of community participants attending monthly sessions',
              'The project title used in presentation slides',
              'The color scheme of the printed campaign poster'
            ),
            'correctAnswer', 1,
            'points', 1,
            'explanation', 'Indicators should be observable or measurable signs of progress.'
          ),
          jsonb_build_object(
            'id', 'community-monitoring-tf-quiz',
            'type', 'quiz',
            'title', 'Quiz 4 - Feedback timing',
            'content', 'Feedback should ideally be collected only after a project fully ends.',
            'questionType', 'true_false',
            'options', jsonb_build_array('True', 'False'),
            'correctAnswer', 1,
            'points', 1,
            'explanation', 'Ongoing feedback allows teams to improve implementation while activities are still underway.'
          ),
          jsonb_build_object(
            'id', 'community-monitoring-essay-quiz',
            'type', 'quiz',
            'title', 'Quiz 4 - Sustainability reflection',
            'content', 'State one practical step that can help a community initiative continue after external support decreases.',
            'questionType', 'essay',
            'points', 3,
            'explanation', 'Expected focus: training local leaders, setting up local committees, documenting processes, or transferring responsibilities gradually.'
          )
        )::text,
        materials = ARRAY[
          v_module_4_video,
          'https://picsum.photos/seed/community-engagement-m4-image/1200/675',
          'https://developer.mozilla.org/en-US/docs/Learn'
        ]::text[],
        prerequisites = ARRAY[v_module_1_id::text, v_module_2_id::text, v_module_3_id::text]::text[],
        module_thumbnail = v_module_4_thumbnail,
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_4_id;
  END IF;

  SELECT id
  INTO v_assessment_id
  FROM public.assessments
  WHERE course_id = v_course_id
    AND title = 'Community Engagement and Development Excellence Final Assessment'
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
    quote_literal('Community Engagement and Development Excellence Final Assessment') || ', ' ||
    quote_literal('Answer all items using principles covered in the modules, with practical and ethical responses grounded in inclusive community development practice.') || ', ' ||
    quote_literal(v_course_thumbnail) || ', 30, 75, 3, true, true';

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
      'description = ' || quote_literal('Answer all items using principles covered in the modules, with practical and ethical responses grounded in inclusive community development practice.') || ', ' ||
      'assessment_thumbnail = ' || quote_literal(v_course_thumbnail) || ', ' ||
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
      1,
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
      1,
      2,
      'Primary stakeholders experience the issue directly and are essential sources of field insight.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Excluding quieter groups from consultations can lead to incomplete or biased planning decisions.',
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
      'A project is sustainable if outside partners continue doing all of the work indefinitely.',
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
      'List two methods that can be used in a community needs assessment.',
      'short_answer',
      NULL,
      'Interviews, focus group discussions, surveys, observation, community meetings, or mapping exercises.',
      2,
      5,
      'Expected focus: interviews, focus group discussions, surveys, observation, community meetings, or mapping exercises.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Give one reason why assigning roles clearly in an action plan matters.',
      'short_answer',
      NULL,
      'Accountability, coordination, reduced duplication, or clearer follow-through.',
      2,
      6,
      'Expected focus: accountability, coordination, reduced duplication, or clearer follow-through.',
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
      1,
      7,
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
      1,
      8,
      'In-kind support includes non-cash contributions such as space, labor, tools, or materials.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'A youth livelihood project has low attendance after the first month. Explain how you would gather feedback, identify likely causes, and adjust the implementation plan while maintaining trust with participants.',
      'essay',
      NULL,
      NULL,
      5,
      9,
      'Expected focus: respectful consultation, data gathering, schedule or design adjustment, transparent communication, and shared problem-solving with participants.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Describe how you would design a small community clean-up and waste segregation initiative from initial consultation to sustainability planning.',
      'essay',
      NULL,
      NULL,
      5,
      10,
      'Expected focus: stakeholder engagement, needs assessment, action planning, role assignment, resource mobilization, monitoring indicators, and long-term ownership.',
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