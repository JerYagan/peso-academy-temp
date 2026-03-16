-- Seed content for the existing course:
-- Leadership and Governance for Public Service
-- Course ID: 0ff4c989-768f-49ab-95e5-83cf48849ec0
--
-- This seed is idempotent for modules and assessments by title within the target course.

DO $$
DECLARE
  v_course_id CONSTANT UUID := '0ff4c989-768f-49ab-95e5-83cf48849ec0';
  v_now TIMESTAMPTZ := NOW();
  v_sample_pdf CONSTANT TEXT := 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
  v_sample_video CONSTANT TEXT := 'https://www.youtube.com/watch?v=ScMzIvxBSi4';
  v_thumbnail CONSTANT TEXT := '/images/course-service.svg';

  v_module_1_id UUID;
  v_module_2_id UUID;
  v_module_3_id UUID;

  v_assessment_1_id UUID;
  v_assessment_2_id UUID;
  v_assessment_3_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.courses
    WHERE id = v_course_id
  ) THEN
    RAISE EXCEPTION 'Course % was not found. Create the course first before running this seed.', v_course_id;
  END IF;

  SELECT id
  INTO v_module_1_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Leading with Public Service Values'
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
      module_document,
      status,
      skill_tags,
      topic_tags,
      created_at,
      updated_at
    )
    VALUES (
      v_course_id,
      'Leading with Public Service Values',
      'Introduces the leadership mindset, ethical standards, and governance principles expected in public service roles.',
      1,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'public-service-values-text',
          'type', 'text',
          'title', 'Leadership begins with public trust',
          'content', '<p>Leadership in public service depends on trust, transparency, and consistency. Teams perform better when leaders explain decisions clearly, model ethical behavior, and align daily work with the public interest.</p><p>Good governance starts with a shared understanding of mission, accountability, and the obligation to serve citizens fairly.</p>'
        ),
        jsonb_build_object(
          'id', 'public-service-values-video',
          'type', 'video',
          'title', 'Leadership values overview',
          'content', '',
          'videoUrl', v_sample_video
        ),
        jsonb_build_object(
          'id', 'public-service-values-document',
          'type', 'document',
          'title', 'Values and ethics reference',
          'content', '',
          'documentUrl', v_sample_pdf
        ),
        jsonb_build_object(
          'id', 'public-service-values-quiz',
          'type', 'quiz',
          'title', 'Quick quiz',
          'content', 'Which leadership behavior most directly strengthens public trust?',
          'options', jsonb_build_array(
            'Explaining decisions and applying rules fairly',
            'Keeping criteria hidden from the team',
            'Changing standards depending on the person involved',
            'Focusing only on speed regardless of consequences'
          ),
          'correctAnswer', 0,
          'explanation', 'Trust grows when leaders are transparent, fair, and consistent in how they act and decide.'
        )
      )::TEXT,
      ARRAY[v_sample_pdf, v_sample_video],
      ARRAY[]::TEXT[],
      v_thumbnail,
      v_sample_pdf,
      'finalized',
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now,
      v_now
    )
    RETURNING id INTO v_module_1_id;
  ELSE
    UPDATE public.modules
    SET description = 'Introduces the leadership mindset, ethical standards, and governance principles expected in public service roles.',
        "order" = 1,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'public-service-values-text',
            'type', 'text',
            'title', 'Leadership begins with public trust',
            'content', '<p>Leadership in public service depends on trust, transparency, and consistency. Teams perform better when leaders explain decisions clearly, model ethical behavior, and align daily work with the public interest.</p><p>Good governance starts with a shared understanding of mission, accountability, and the obligation to serve citizens fairly.</p>'
          ),
          jsonb_build_object(
            'id', 'public-service-values-video',
            'type', 'video',
            'title', 'Leadership values overview',
            'content', '',
            'videoUrl', v_sample_video
          ),
          jsonb_build_object(
            'id', 'public-service-values-document',
            'type', 'document',
            'title', 'Values and ethics reference',
            'content', '',
            'documentUrl', v_sample_pdf
          ),
          jsonb_build_object(
            'id', 'public-service-values-quiz',
            'type', 'quiz',
            'title', 'Quick quiz',
            'content', 'Which leadership behavior most directly strengthens public trust?',
            'options', jsonb_build_array(
              'Explaining decisions and applying rules fairly',
              'Keeping criteria hidden from the team',
              'Changing standards depending on the person involved',
              'Focusing only on speed regardless of consequences'
            ),
            'correctAnswer', 0,
            'explanation', 'Trust grows when leaders are transparent, fair, and consistent in how they act and decide.'
          )
        )::TEXT,
        materials = ARRAY[v_sample_pdf, v_sample_video],
        prerequisites = ARRAY[]::TEXT[],
        module_thumbnail = v_thumbnail,
        module_document = v_sample_pdf,
        status = 'finalized',
        skill_tags = ARRAY[]::TEXT[],
        topic_tags = ARRAY[]::TEXT[],
        updated_at = v_now
    WHERE id = v_module_1_id;
  END IF;

  SELECT id
  INTO v_module_2_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Accountability and Ethical Decision-Making'
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
      module_document,
      status,
      skill_tags,
      topic_tags,
      created_at,
      updated_at
    )
    VALUES (
      v_course_id,
      'Accountability and Ethical Decision-Making',
      'Builds practical judgment for policy compliance, documentation, and responsible decision-making in government work.',
      2,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'accountability-text',
          'type', 'text',
          'title', 'Document decisions and own the result',
          'content', '<p>Accountability means decisions can be traced, explained, and reviewed. Leaders in public service should define criteria, document key actions, and ensure that delegated work is monitored without losing ownership.</p><p>Ethical decision-making requires balancing urgency with due process so public resources are used fairly and responsibly.</p>'
        ),
        jsonb_build_object(
          'id', 'accountability-code',
          'type', 'code',
          'title', 'Simple decision log template',
          'language', 'plaintext',
          'content', 'Issue\nOptions considered\nDecision made\nReason for decision\nApproving officer\nFollow-up date'
        ),
        jsonb_build_object(
          'id', 'accountability-material',
          'type', 'learning_material',
          'title', 'Decision accountability checklist',
          'content', '',
          'materialUrl', v_sample_pdf
        ),
        jsonb_build_object(
          'id', 'accountability-quiz',
          'type', 'quiz',
          'title', 'Quick quiz',
          'content', 'What is the strongest reason for keeping a clear decision log in public service work?',
          'options', jsonb_build_array(
            'It supports transparency, review, and responsible follow-through',
            'It removes the need to explain actions to anyone',
            'It allows verbal instructions to replace formal process',
            'It guarantees every decision will be popular'
          ),
          'correctAnswer', 0,
          'explanation', 'A decision log makes actions reviewable and helps teams stay accountable for what was approved and why.'
        )
      )::TEXT,
      ARRAY[v_sample_pdf],
      ARRAY[v_module_1_id::TEXT],
      v_thumbnail,
      v_sample_pdf,
      'finalized',
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now,
      v_now
    )
    RETURNING id INTO v_module_2_id;
  ELSE
    UPDATE public.modules
    SET description = 'Builds practical judgment for policy compliance, documentation, and responsible decision-making in government work.',
        "order" = 2,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'accountability-text',
            'type', 'text',
            'title', 'Document decisions and own the result',
            'content', '<p>Accountability means decisions can be traced, explained, and reviewed. Leaders in public service should define criteria, document key actions, and ensure that delegated work is monitored without losing ownership.</p><p>Ethical decision-making requires balancing urgency with due process so public resources are used fairly and responsibly.</p>'
          ),
          jsonb_build_object(
            'id', 'accountability-code',
            'type', 'code',
            'title', 'Simple decision log template',
            'language', 'plaintext',
            'content', 'Issue\nOptions considered\nDecision made\nReason for decision\nApproving officer\nFollow-up date'
          ),
          jsonb_build_object(
            'id', 'accountability-material',
            'type', 'learning_material',
            'title', 'Decision accountability checklist',
            'content', '',
            'materialUrl', v_sample_pdf
          ),
          jsonb_build_object(
            'id', 'accountability-quiz',
            'type', 'quiz',
            'title', 'Quick quiz',
            'content', 'What is the strongest reason for keeping a clear decision log in public service work?',
            'options', jsonb_build_array(
              'It supports transparency, review, and responsible follow-through',
              'It removes the need to explain actions to anyone',
              'It allows verbal instructions to replace formal process',
              'It guarantees every decision will be popular'
            ),
            'correctAnswer', 0,
            'explanation', 'A decision log makes actions reviewable and helps teams stay accountable for what was approved and why.'
          )
        )::TEXT,
        materials = ARRAY[v_sample_pdf],
        prerequisites = ARRAY[v_module_1_id::TEXT],
        module_thumbnail = v_thumbnail,
        module_document = v_sample_pdf,
        status = 'finalized',
        skill_tags = ARRAY[]::TEXT[],
        topic_tags = ARRAY[]::TEXT[],
        updated_at = v_now
    WHERE id = v_module_2_id;
  END IF;

  SELECT id
  INTO v_module_3_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Collaborative Governance and Service Improvement'
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
      module_document,
      status,
      skill_tags,
      topic_tags,
      created_at,
      updated_at
    )
    VALUES (
      v_course_id,
      'Collaborative Governance and Service Improvement',
      'Focuses on inter-team coordination, stakeholder communication, and continuous improvement of public service delivery.',
      3,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'collaborative-governance-text',
          'type', 'text',
          'title', 'Improve services through coordinated leadership',
          'content', '<p>Strong governance depends on collaboration across units. Leaders should create clear handoffs, use feedback from citizens and staff, and review service bottlenecks regularly.</p><p>Continuous improvement in public service is not a one-time initiative. It requires routine reflection, measurable actions, and follow-up on whether changes actually improve outcomes.</p>'
        ),
        jsonb_build_object(
          'id', 'collaborative-governance-image',
          'type', 'image',
          'title', 'Team coordination visual',
          'content', '',
          'imageUrl', '/images/hero.png',
          'altText', 'Illustration representing coordinated public service teams',
          'caption', 'Use structured coordination and feedback to improve service quality.'
        ),
        jsonb_build_object(
          'id', 'collaborative-governance-document',
          'type', 'document',
          'title', 'Service improvement worksheet',
          'content', '',
          'documentUrl', v_sample_pdf
        ),
        jsonb_build_object(
          'id', 'collaborative-governance-quiz',
          'type', 'quiz',
          'title', 'Quick quiz',
          'content', 'Which action best supports continuous improvement in public service delivery?',
          'options', jsonb_build_array(
            'Reviewing feedback and tracking whether changes improve outcomes',
            'Assuming old procedures still work without checking',
            'Keeping service issues within one team only',
            'Avoiding stakeholder input to save time'
          ),
          'correctAnswer', 0,
          'explanation', 'Improvement depends on feedback, measurement, and follow-through rather than assumptions alone.'
        )
      )::TEXT,
      ARRAY[v_sample_pdf, v_sample_video],
      ARRAY[v_module_1_id::TEXT, v_module_2_id::TEXT],
      v_thumbnail,
      v_sample_pdf,
      'finalized',
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now,
      v_now
    )
    RETURNING id INTO v_module_3_id;
  ELSE
    UPDATE public.modules
    SET description = 'Focuses on inter-team coordination, stakeholder communication, and continuous improvement of public service delivery.',
        "order" = 3,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'collaborative-governance-text',
            'type', 'text',
            'title', 'Improve services through coordinated leadership',
            'content', '<p>Strong governance depends on collaboration across units. Leaders should create clear handoffs, use feedback from citizens and staff, and review service bottlenecks regularly.</p><p>Continuous improvement in public service is not a one-time initiative. It requires routine reflection, measurable actions, and follow-up on whether changes actually improve outcomes.</p>'
          ),
          jsonb_build_object(
            'id', 'collaborative-governance-image',
            'type', 'image',
            'title', 'Team coordination visual',
            'content', '',
            'imageUrl', '/images/hero.png',
            'altText', 'Illustration representing coordinated public service teams',
            'caption', 'Use structured coordination and feedback to improve service quality.'
          ),
          jsonb_build_object(
            'id', 'collaborative-governance-document',
            'type', 'document',
            'title', 'Service improvement worksheet',
            'content', '',
            'documentUrl', v_sample_pdf
          ),
          jsonb_build_object(
            'id', 'collaborative-governance-quiz',
            'type', 'quiz',
            'title', 'Quick quiz',
            'content', 'Which action best supports continuous improvement in public service delivery?',
            'options', jsonb_build_array(
              'Reviewing feedback and tracking whether changes improve outcomes',
              'Assuming old procedures still work without checking',
              'Keeping service issues within one team only',
              'Avoiding stakeholder input to save time'
            ),
            'correctAnswer', 0,
            'explanation', 'Improvement depends on feedback, measurement, and follow-through rather than assumptions alone.'
          )
        )::TEXT,
        materials = ARRAY[v_sample_pdf, v_sample_video],
        prerequisites = ARRAY[v_module_1_id::TEXT, v_module_2_id::TEXT],
        module_thumbnail = v_thumbnail,
        module_document = v_sample_pdf,
        status = 'finalized',
        skill_tags = ARRAY[]::TEXT[],
        topic_tags = ARRAY[]::TEXT[],
        updated_at = v_now
    WHERE id = v_module_3_id;
  END IF;

  SELECT id
  INTO v_assessment_1_id
  FROM public.assessments
  WHERE course_id = v_course_id
    AND title = 'Leadership Foundations Assessment'
  LIMIT 1;

  IF v_assessment_1_id IS NULL THEN
    INSERT INTO public.assessments (
      course_id,
      module_id,
      title,
      description,
      time_limit,
      passing_score,
      max_attempts,
      is_active,
      prerequisite_module_ids,
      display_order,
      assessment_thumbnail,
      skill_tags,
      topic_tags,
      created_at,
      updated_at
    )
    VALUES (
      v_course_id,
      NULL,
      'Leadership Foundations Assessment',
      'Checks understanding of ethical leadership, public trust, and core governance values.',
      12,
      75,
      3,
      true,
      ARRAY[v_module_1_id],
      1,
      v_thumbnail,
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now,
      v_now
    )
    RETURNING id INTO v_assessment_1_id;
  ELSE
    UPDATE public.assessments
    SET module_id = NULL,
        description = 'Checks understanding of ethical leadership, public trust, and core governance values.',
        time_limit = 12,
        passing_score = 75,
        max_attempts = 3,
        is_active = true,
        prerequisite_module_ids = ARRAY[v_module_1_id],
        display_order = 1,
        assessment_thumbnail = v_thumbnail,
        skill_tags = ARRAY[]::TEXT[],
        topic_tags = ARRAY[]::TEXT[],
        updated_at = v_now
    WHERE id = v_assessment_1_id;
  END IF;

  DELETE FROM public.assessment_questions WHERE assessment_id = v_assessment_1_id;

  INSERT INTO public.assessment_questions (
    assessment_id,
    question,
    question_type,
    options,
    correct_answer,
    points,
    "order",
    explanation,
    skill_tags,
    topic_tags,
    created_at
  )
  VALUES
    (
      v_assessment_1_id,
      'Why is transparency essential in public service leadership?',
      'multiple_choice',
      jsonb_build_array(
        'It helps people understand how and why decisions are made',
        'It allows leaders to avoid documentation',
        'It removes the need for accountability',
        'It guarantees agreement with every decision'
      ),
      'It helps people understand how and why decisions are made',
      2,
      1,
      'Transparency strengthens trust because actions and decisions can be understood and reviewed.',
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now
    ),
    (
      v_assessment_1_id,
      'True or false: Ethical leadership in government means applying standards consistently, even under pressure.',
      'true_false',
      NULL,
      'true',
      1,
      2,
      'Consistency under pressure is part of ethical leadership and fair governance.',
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now
    ),
    (
      v_assessment_1_id,
      'Which leadership priority best reflects a public service mindset?',
      'multiple_choice',
      jsonb_build_array(
        'Serving citizens fairly and responsibly',
        'Protecting convenience for managers first',
        'Avoiding stakeholder communication',
        'Making exceptions without clear basis'
      ),
      'Serving citizens fairly and responsibly',
      2,
      3,
      'Public service leadership centers on fair, responsible service to the public.',
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now
    );

  SELECT id
  INTO v_assessment_2_id
  FROM public.assessments
  WHERE course_id = v_course_id
    AND title = 'Governance and Accountability Assessment'
  LIMIT 1;

  IF v_assessment_2_id IS NULL THEN
    INSERT INTO public.assessments (
      course_id,
      module_id,
      title,
      description,
      time_limit,
      passing_score,
      max_attempts,
      is_active,
      prerequisite_module_ids,
      display_order,
      assessment_thumbnail,
      skill_tags,
      topic_tags,
      created_at,
      updated_at
    )
    VALUES (
      v_course_id,
      NULL,
      'Governance and Accountability Assessment',
      'Measures decision logging, due process, and accountable follow-through in public sector work.',
      15,
      75,
      3,
      true,
      ARRAY[v_module_2_id],
      2,
      v_thumbnail,
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now,
      v_now
    )
    RETURNING id INTO v_assessment_2_id;
  ELSE
    UPDATE public.assessments
    SET module_id = NULL,
        description = 'Measures decision logging, due process, and accountable follow-through in public sector work.',
        time_limit = 15,
        passing_score = 75,
        max_attempts = 3,
        is_active = true,
        prerequisite_module_ids = ARRAY[v_module_2_id],
        display_order = 2,
        assessment_thumbnail = v_thumbnail,
        skill_tags = ARRAY[]::TEXT[],
        topic_tags = ARRAY[]::TEXT[],
        updated_at = v_now
    WHERE id = v_assessment_2_id;
  END IF;

  DELETE FROM public.assessment_questions WHERE assessment_id = v_assessment_2_id;

  INSERT INTO public.assessment_questions (
    assessment_id,
    question,
    question_type,
    options,
    correct_answer,
    points,
    "order",
    explanation,
    skill_tags,
    topic_tags,
    created_at
  )
  VALUES
    (
      v_assessment_2_id,
      'What is the main value of documenting the basis for a public decision?',
      'multiple_choice',
      jsonb_build_array(
        'It allows review, accountability, and informed follow-up',
        'It makes formal approvals unnecessary',
        'It keeps the process hidden from oversight',
        'It replaces the need for policy compliance'
      ),
      'It allows review, accountability, and informed follow-up',
      2,
      1,
      'Documentation creates an auditable record of why a decision was made and what should happen next.',
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now
    ),
    (
      v_assessment_2_id,
      'True or false: Urgent service requests always justify skipping due process and recordkeeping.',
      'true_false',
      NULL,
      'false',
      1,
      2,
      'Urgency may change pace, but it does not remove the need for lawful process and documentation.',
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now
    ),
    (
      v_assessment_2_id,
      'Which practice best reflects accountable delegation?',
      'multiple_choice',
      jsonb_build_array(
        'Assigning tasks clearly and monitoring results',
        'Delegating work and refusing all follow-up',
        'Leaving expectations undocumented',
        'Changing standards after the work is done'
      ),
      'Assigning tasks clearly and monitoring results',
      2,
      3,
      'Delegation still requires clarity, oversight, and ownership of outcomes.',
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now
    );

  SELECT id
  INTO v_assessment_3_id
  FROM public.assessments
  WHERE course_id = v_course_id
    AND title = 'Service Improvement and Collaboration Assessment'
  LIMIT 1;

  IF v_assessment_3_id IS NULL THEN
    INSERT INTO public.assessments (
      course_id,
      module_id,
      title,
      description,
      time_limit,
      passing_score,
      max_attempts,
      is_active,
      prerequisite_module_ids,
      display_order,
      assessment_thumbnail,
      skill_tags,
      topic_tags,
      created_at,
      updated_at
    )
    VALUES (
      v_course_id,
      NULL,
      'Service Improvement and Collaboration Assessment',
      'Assesses collaboration, citizen feedback use, and continuous improvement in public service delivery.',
      15,
      80,
      3,
      true,
      ARRAY[v_module_3_id],
      3,
      v_thumbnail,
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now,
      v_now
    )
    RETURNING id INTO v_assessment_3_id;
  ELSE
    UPDATE public.assessments
    SET module_id = NULL,
        description = 'Assesses collaboration, citizen feedback use, and continuous improvement in public service delivery.',
        time_limit = 15,
        passing_score = 80,
        max_attempts = 3,
        is_active = true,
        prerequisite_module_ids = ARRAY[v_module_3_id],
        display_order = 3,
        assessment_thumbnail = v_thumbnail,
        skill_tags = ARRAY[]::TEXT[],
        topic_tags = ARRAY[]::TEXT[],
        updated_at = v_now
    WHERE id = v_assessment_3_id;
  END IF;

  DELETE FROM public.assessment_questions WHERE assessment_id = v_assessment_3_id;

  INSERT INTO public.assessment_questions (
    assessment_id,
    question,
    question_type,
    options,
    correct_answer,
    points,
    "order",
    explanation,
    skill_tags,
    topic_tags,
    created_at
  )
  VALUES
    (
      v_assessment_3_id,
      'Why should leaders review citizen and staff feedback regularly?',
      'multiple_choice',
      jsonb_build_array(
        'To identify service gaps and confirm whether improvements are working',
        'To avoid coordination with other units',
        'To replace performance tracking entirely',
        'To delay action until complaints stop'
      ),
      'To identify service gaps and confirm whether improvements are working',
      2,
      1,
      'Feedback becomes useful when it drives measurable improvements and follow-up.',
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now
    ),
    (
      v_assessment_3_id,
      'True or false: Continuous improvement is strongest when teams check whether changes actually improved service outcomes.',
      'true_false',
      NULL,
      'true',
      1,
      2,
      'Improvement requires evidence that the change had the intended effect.',
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now
    ),
    (
      v_assessment_3_id,
      'Which leadership action best supports collaborative governance?',
      'multiple_choice',
      jsonb_build_array(
        'Creating clear handoffs and shared follow-up across teams',
        'Keeping operational issues isolated from partner units',
        'Avoiding documented coordination plans',
        'Treating feedback as optional when services are delayed'
      ),
      'Creating clear handoffs and shared follow-up across teams',
      2,
      3,
      'Collaborative governance depends on cross-team clarity, coordination, and follow-through.',
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      v_now
    );

  RAISE NOTICE 'Seeded course %, modules %, %, % and assessments %, %, %.',
    v_course_id,
    v_module_1_id,
    v_module_2_id,
    v_module_3_id,
    v_assessment_1_id,
    v_assessment_2_id,
    v_assessment_3_id;
END
$$;