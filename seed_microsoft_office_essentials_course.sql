-- Seed content for the course:
-- Microsoft Office Essentials for Workplace Productivity
--
-- What this script does:
-- - Creates or updates a complete Microsoft Office course using an existing trainer/admin/SPD user as instructor.
-- - Upserts 3 finalized modules with text, YouTube video, and quiz blocks only.
-- - Upserts 1 standalone graded course assessment.
-- - Rewrites assessment questions on every run so the seed stays deterministic.

DO $seed$
DECLARE
  v_course_title text := 'Microsoft Office Essentials for Workplace Productivity';
  v_course_id uuid;
  v_instructor_id uuid;
  v_now timestamptz := timezone('utc', now());

  v_module_1_id uuid;
  v_module_2_id uuid;
  v_module_3_id uuid;

  v_assessment_id uuid;

  v_word_video text := 'https://www.youtube.com/watch?v=5Im87VPQZ_0';
  v_excel_video text := 'https://www.youtube.com/watch?v=LgXzzu68j7M';
  v_powerpoint_video text := 'https://www.youtube.com/watch?v=l5Ij7nUy9UQ';

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
      quote_literal('Build practical productivity skills in Microsoft Word, Excel, and PowerPoint for everyday office tasks. Learners will create professional documents, organize and analyze worksheet data, and design clear presentations for workplace reporting and communication.') || ', ' ||
      quote_literal('Digital Skills') || ', ' ||
      quote_literal('Beginner') || ', ' ||
      '24, ' ||
      quote_literal(v_instructor_id) ;

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', ' || quote_literal('general_public');
    END IF;

    v_sql := v_sql || ', ' ||
      quote_literal('/images/course-office.svg') || ', ' ||
      'true, ' ||
      'ARRAY[' ||
        quote_literal('Microsoft Office') || ', ' ||
        quote_literal('Digital Literacy') || ', ' ||
        quote_literal('Computer Basics') || ', ' ||
        quote_literal('Office Administration') || ']::text[]';

    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('Microsoft Office') || ', ' ||
        quote_literal('Digital Literacy') || ', ' ||
        quote_literal('Computer Basics') || ', ' ||
        quote_literal('Office Administration') || ']::text[]';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('Office Productivity') || ', ' ||
        quote_literal('Digital Literacy') || ', ' ||
        quote_literal('Data Management') || ']::text[]';
    END IF;

    IF v_has_course_industry_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('office-productivity') || ', ' ||
        quote_literal('digital-skills') || ']::text[]';
    END IF;
    IF v_has_course_career_paths THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('administrative-support') || ', ' ||
        quote_literal('general-office-work') || ']::text[]';
    END IF;

    v_sql := v_sql || ', 0, 4.8, ' || quote_literal('completion') || ', true, ' ||
      quote_literal(v_now) || ', ' || quote_literal(v_now) || ') RETURNING id';

    EXECUTE v_sql INTO v_course_id;
  ELSE
    v_sql := 'UPDATE public.courses SET ' ||
      'description = ' || quote_literal('Build practical productivity skills in Microsoft Word, Excel, and PowerPoint for everyday office tasks. Learners will create professional documents, organize and analyze worksheet data, and design clear presentations for workplace reporting and communication.') || ', ' ||
      'category = ' || quote_literal('Digital Skills') || ', ' ||
      'level = ' || quote_literal('Beginner') || ', ' ||
      'duration = 24, ' ||
      'instructor_id = ' || quote_literal(v_instructor_id);

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', trainee_audience = ' || quote_literal('general_public');
    END IF;

    v_sql := v_sql || ', thumbnail = ' || quote_literal('/images/course-office.svg') ||
      ', is_tesda_accredited = true' ||
      ', skills = ARRAY[' ||
        quote_literal('Microsoft Office') || ', ' ||
        quote_literal('Digital Literacy') || ', ' ||
        quote_literal('Computer Basics') || ', ' ||
        quote_literal('Office Administration') || ']::text[]';

    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', skill_tags = ARRAY[' ||
        quote_literal('Microsoft Office') || ', ' ||
        quote_literal('Digital Literacy') || ', ' ||
        quote_literal('Computer Basics') || ', ' ||
        quote_literal('Office Administration') || ']::text[]';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', topic_tags = ARRAY[' ||
        quote_literal('Office Productivity') || ', ' ||
        quote_literal('Digital Literacy') || ', ' ||
        quote_literal('Data Management') || ']::text[]';
    END IF;

    IF v_has_course_industry_tags THEN
      v_sql := v_sql || ', industry_tags = ARRAY[' ||
        quote_literal('office-productivity') || ', ' ||
        quote_literal('digital-skills') || ']::text[]';
    END IF;
    IF v_has_course_career_paths THEN
      v_sql := v_sql || ', career_paths = ARRAY[' ||
        quote_literal('administrative-support') || ', ' ||
        quote_literal('general-office-work') || ']::text[]';
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
    AND title = 'Microsoft Word Essentials for Professional Documents'
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
      'Microsoft Word Essentials for Professional Documents',
      'Learn how to create, format, review, and finalize Word documents used in school, training, and office work.',
      1,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'word-overview-text',
          'type', 'text',
          'title', 'Start with a clean document structure',
          'content', $html$<p>Microsoft Word is most useful when a document is easy to read, edit, and share. Begin by choosing the correct page setup, using a clear title, and organizing the page with headings instead of manually enlarging text. This makes long documents easier to navigate and update.</p><p>Use built-in styles for headings, body text, and lists so formatting stays consistent across the whole file. Consistency matters in resumes, letters, reports, meeting notes, and any document that other people need to review.</p>$html$
        ),
        jsonb_build_object(
          'id', 'word-formatting-text',
          'type', 'text',
          'title', 'Format for clarity, not decoration',
          'content', $html$<p>Good formatting improves readability. Choose one or two fonts, keep spacing consistent, and use bullets or numbered lists when presenting steps or grouped ideas. Avoid using many font colors, oversized text, or unnecessary effects because they make the document harder to scan.</p><p>Headers, footers, page numbers, and tables are practical tools for formal documents. When information must be reused later, tables and properly aligned paragraphs are easier to maintain than text arranged with spaces or repeated tab presses.</p>$html$
        ),
        jsonb_build_object(
          'id', 'word-beginner-video',
          'type', 'video',
          'title', 'Microsoft Word tutorial for beginners',
          'content', '',
          'videoUrl', v_word_video
        ),
        jsonb_build_object(
          'id', 'word-styles-quiz',
          'type', 'quiz',
          'title', 'Quick check: styles',
          'content', 'Which Word feature should you use when you want all major headings to keep the same format throughout a report?',
          'options', jsonb_build_array(
            'Styles',
            'Manual font changes on each heading',
            'Repeated space bar presses',
            'Text boxes on every page'
          ),
          'correctAnswer', 0,
          'explanation', 'Styles apply consistent formatting and make documents easier to update and navigate.'
        ),
        jsonb_build_object(
          'id', 'word-review-quiz',
          'type', 'quiz',
          'title', 'Quick check: collaboration',
          'content', 'Which feature is best when a trainer or supervisor needs to suggest edits without permanently rewriting your original text?',
          'options', jsonb_build_array(
            'Track Changes',
            'WordArt',
            'Page Color',
            'Zoom'
          ),
          'correctAnswer', 0,
          'explanation', 'Track Changes records edits and comments so revisions can be reviewed and accepted deliberately.'
        )
      )::text,
      ARRAY[v_word_video]::text[],
      ARRAY[]::text[],
      '/images/course-office.svg',
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_1_id;
  ELSE
    UPDATE public.modules
    SET description = 'Learn how to create, format, review, and finalize Word documents used in school, training, and office work.',
        "order" = 1,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'word-overview-text',
            'type', 'text',
            'title', 'Start with a clean document structure',
            'content', $html$<p>Microsoft Word is most useful when a document is easy to read, edit, and share. Begin by choosing the correct page setup, using a clear title, and organizing the page with headings instead of manually enlarging text. This makes long documents easier to navigate and update.</p><p>Use built-in styles for headings, body text, and lists so formatting stays consistent across the whole file. Consistency matters in resumes, letters, reports, meeting notes, and any document that other people need to review.</p>$html$
          ),
          jsonb_build_object(
            'id', 'word-formatting-text',
            'type', 'text',
            'title', 'Format for clarity, not decoration',
            'content', $html$<p>Good formatting improves readability. Choose one or two fonts, keep spacing consistent, and use bullets or numbered lists when presenting steps or grouped ideas. Avoid using many font colors, oversized text, or unnecessary effects because they make the document harder to scan.</p><p>Headers, footers, page numbers, and tables are practical tools for formal documents. When information must be reused later, tables and properly aligned paragraphs are easier to maintain than text arranged with spaces or repeated tab presses.</p>$html$
          ),
          jsonb_build_object(
            'id', 'word-beginner-video',
            'type', 'video',
            'title', 'Microsoft Word tutorial for beginners',
            'content', '',
            'videoUrl', v_word_video
          ),
          jsonb_build_object(
            'id', 'word-styles-quiz',
            'type', 'quiz',
            'title', 'Quick check: styles',
            'content', 'Which Word feature should you use when you want all major headings to keep the same format throughout a report?',
            'options', jsonb_build_array(
              'Styles',
              'Manual font changes on each heading',
              'Repeated space bar presses',
              'Text boxes on every page'
            ),
            'correctAnswer', 0,
            'explanation', 'Styles apply consistent formatting and make documents easier to update and navigate.'
          ),
          jsonb_build_object(
            'id', 'word-review-quiz',
            'type', 'quiz',
            'title', 'Quick check: collaboration',
            'content', 'Which feature is best when a trainer or supervisor needs to suggest edits without permanently rewriting your original text?',
            'options', jsonb_build_array(
              'Track Changes',
              'WordArt',
              'Page Color',
              'Zoom'
            ),
            'correctAnswer', 0,
            'explanation', 'Track Changes records edits and comments so revisions can be reviewed and accepted deliberately.'
          )
        )::text,
        materials = ARRAY[v_word_video]::text[],
        prerequisites = ARRAY[]::text[],
        module_thumbnail = '/images/course-office.svg',
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_1_id;
  END IF;

  SELECT id
  INTO v_module_2_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Microsoft Excel Essentials for Worksheets and Calculations'
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
      'Microsoft Excel Essentials for Worksheets and Calculations',
      'Learn how to enter structured data, format worksheets, and use basic formulas and functions in Excel.',
      2,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'excel-structure-text',
          'type', 'text',
          'title', 'Keep worksheet data structured',
          'content', $html$<p>In Excel, reliable analysis starts with clean data entry. Use one header row, keep each column focused on one kind of value, and avoid leaving random blank rows inside the dataset. A structured table is easier to sort, filter, total, and chart.</p><p>When the worksheet represents attendance, inventory, expenses, or performance tracking, each row should represent one record and each column should represent one field such as date, name, amount, or status.</p>$html$
        ),
        jsonb_build_object(
          'id', 'excel-formulas-text',
          'type', 'text',
          'title', 'Use formulas to reduce manual work',
          'content', $html$<p>Excel formulas save time and reduce repeated calculations. Start with basic operators like addition, subtraction, multiplication, and division, then move to functions such as SUM, AVERAGE, MIN, MAX, and COUNT. These functions are useful for reports, budgets, and simple monitoring dashboards.</p><p>Cell references matter. Relative references change when a formula is copied, while absolute references stay fixed. Understanding that difference helps prevent errors when filling formulas down a column.</p>$html$
        ),
        jsonb_build_object(
          'id', 'excel-beginner-video',
          'type', 'video',
          'title', 'Microsoft Excel tutorial for beginners',
          'content', '',
          'videoUrl', v_excel_video
        ),
        jsonb_build_object(
          'id', 'excel-reference-quiz',
          'type', 'quiz',
          'title', 'Quick check: references',
          'content', 'Which type of Excel reference stays fixed when you copy a formula to other cells?',
          'options', jsonb_build_array(
            'Absolute reference',
            'Relative reference',
            'Filtered reference',
            'Hidden reference'
          ),
          'correctAnswer', 0,
          'explanation', 'Absolute references lock a row, column, or both so the formula keeps pointing at the same cell.'
        ),
        jsonb_build_object(
          'id', 'excel-analysis-quiz',
          'type', 'quiz',
          'title', 'Quick check: functions',
          'content', 'Which function should you use if you want to total a list of numeric values in a column?',
          'options', jsonb_build_array(
            'SUM',
            'UPPER',
            'LEFT',
            'TRIM'
          ),
          'correctAnswer', 0,
          'explanation', 'SUM adds numeric values and is one of the most common worksheet functions.'
        )
      )::text,
      ARRAY[v_excel_video]::text[],
      ARRAY[v_module_1_id::text]::text[],
      '/images/course-office.svg',
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_2_id;
  ELSE
    UPDATE public.modules
    SET description = 'Learn how to enter structured data, format worksheets, and use basic formulas and functions in Excel.',
        "order" = 2,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'excel-structure-text',
            'type', 'text',
            'title', 'Keep worksheet data structured',
            'content', $html$<p>In Excel, reliable analysis starts with clean data entry. Use one header row, keep each column focused on one kind of value, and avoid leaving random blank rows inside the dataset. A structured table is easier to sort, filter, total, and chart.</p><p>When the worksheet represents attendance, inventory, expenses, or performance tracking, each row should represent one record and each column should represent one field such as date, name, amount, or status.</p>$html$
          ),
          jsonb_build_object(
            'id', 'excel-formulas-text',
            'type', 'text',
            'title', 'Use formulas to reduce manual work',
            'content', $html$<p>Excel formulas save time and reduce repeated calculations. Start with basic operators like addition, subtraction, multiplication, and division, then move to functions such as SUM, AVERAGE, MIN, MAX, and COUNT. These functions are useful for reports, budgets, and simple monitoring dashboards.</p><p>Cell references matter. Relative references change when a formula is copied, while absolute references stay fixed. Understanding that difference helps prevent errors when filling formulas down a column.</p>$html$
          ),
          jsonb_build_object(
            'id', 'excel-beginner-video',
            'type', 'video',
            'title', 'Microsoft Excel tutorial for beginners',
            'content', '',
            'videoUrl', v_excel_video
          ),
          jsonb_build_object(
            'id', 'excel-reference-quiz',
            'type', 'quiz',
            'title', 'Quick check: references',
            'content', 'Which type of Excel reference stays fixed when you copy a formula to other cells?',
            'options', jsonb_build_array(
              'Absolute reference',
              'Relative reference',
              'Filtered reference',
              'Hidden reference'
            ),
            'correctAnswer', 0,
            'explanation', 'Absolute references lock a row, column, or both so the formula keeps pointing at the same cell.'
          ),
          jsonb_build_object(
            'id', 'excel-analysis-quiz',
            'type', 'quiz',
            'title', 'Quick check: functions',
            'content', 'Which function should you use if you want to total a list of numeric values in a column?',
            'options', jsonb_build_array(
              'SUM',
              'UPPER',
              'LEFT',
              'TRIM'
            ),
            'correctAnswer', 0,
            'explanation', 'SUM adds numeric values and is one of the most common worksheet functions.'
          )
        )::text,
        materials = ARRAY[v_excel_video]::text[],
        prerequisites = ARRAY[v_module_1_id::text]::text[],
        module_thumbnail = '/images/course-office.svg',
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_2_id;
  END IF;

  SELECT id
  INTO v_module_3_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Microsoft PowerPoint Essentials for Clear Presentations'
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
      'Microsoft PowerPoint Essentials for Clear Presentations',
      'Learn how to design readable slides, organize a presentation flow, and present information clearly using PowerPoint.',
      3,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'powerpoint-story-text',
          'type', 'text',
          'title', 'Build slides around one idea at a time',
          'content', $html$<p>A strong presentation helps the audience understand your message quickly. Each slide should focus on one main point supported by a short title and only the most important details. Overcrowded slides force people to read instead of listen.</p><p>Use simple slide order: introduce the topic, explain the key points, show an example or evidence, and end with a clear summary or next step. This structure works for class reports, project updates, and office briefings.</p>$html$
        ),
        jsonb_build_object(
          'id', 'powerpoint-design-text',
          'type', 'text',
          'title', 'Design for readability and consistency',
          'content', $html$<p>Readable presentations use high contrast, large enough text, and limited on-screen clutter. Keep slide backgrounds simple and use images, icons, or charts only when they add meaning. Repeating the same colors and layouts across slides makes the presentation look more professional.</p><p>Slide Master is useful when you want the same font, logo placement, or footer structure across many slides. It saves time and reduces formatting mistakes in longer presentations.</p>$html$
        ),
        jsonb_build_object(
          'id', 'powerpoint-beginner-video',
          'type', 'video',
          'title', 'Microsoft PowerPoint tutorial for beginners',
          'content', '',
          'videoUrl', v_powerpoint_video
        ),
        jsonb_build_object(
          'id', 'powerpoint-design-quiz',
          'type', 'quiz',
          'title', 'Quick check: consistency',
          'content', 'Why would you use Slide Master in PowerPoint?',
          'options', jsonb_build_array(
            'To keep formatting consistent across multiple slides',
            'To calculate worksheet formulas',
            'To review spelling in Word documents',
            'To store database records'
          ),
          'correctAnswer', 0,
          'explanation', 'Slide Master controls shared design elements so the whole presentation stays consistent.'
        )
      )::text,
      ARRAY[v_powerpoint_video]::text[],
      ARRAY[v_module_1_id::text, v_module_2_id::text]::text[],
      '/images/course-office.svg',
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_3_id;
  ELSE
    UPDATE public.modules
    SET description = 'Learn how to design readable slides, organize a presentation flow, and present information clearly using PowerPoint.',
        "order" = 3,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'powerpoint-story-text',
            'type', 'text',
            'title', 'Build slides around one idea at a time',
            'content', $html$<p>A strong presentation helps the audience understand your message quickly. Each slide should focus on one main point supported by a short title and only the most important details. Overcrowded slides force people to read instead of listen.</p><p>Use simple slide order: introduce the topic, explain the key points, show an example or evidence, and end with a clear summary or next step. This structure works for class reports, project updates, and office briefings.</p>$html$
          ),
          jsonb_build_object(
            'id', 'powerpoint-design-text',
            'type', 'text',
            'title', 'Design for readability and consistency',
            'content', $html$<p>Readable presentations use high contrast, large enough text, and limited on-screen clutter. Keep slide backgrounds simple and use images, icons, or charts only when they add meaning. Repeating the same colors and layouts across slides makes the presentation look more professional.</p><p>Slide Master is useful when you want the same font, logo placement, or footer structure across many slides. It saves time and reduces formatting mistakes in longer presentations.</p>$html$
          ),
          jsonb_build_object(
            'id', 'powerpoint-beginner-video',
            'type', 'video',
            'title', 'Microsoft PowerPoint tutorial for beginners',
            'content', '',
            'videoUrl', v_powerpoint_video
          ),
          jsonb_build_object(
            'id', 'powerpoint-design-quiz',
            'type', 'quiz',
            'title', 'Quick check: consistency',
            'content', 'Why would you use Slide Master in PowerPoint?',
            'options', jsonb_build_array(
              'To keep formatting consistent across multiple slides',
              'To calculate worksheet formulas',
              'To review spelling in Word documents',
              'To store database records'
            ),
            'correctAnswer', 0,
            'explanation', 'Slide Master controls shared design elements so the whole presentation stays consistent.'
          )
        )::text,
        materials = ARRAY[v_powerpoint_video]::text[],
        prerequisites = ARRAY[v_module_1_id::text, v_module_2_id::text]::text[],
        module_thumbnail = '/images/course-office.svg',
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_3_id;
  END IF;

  SELECT id
  INTO v_assessment_id
  FROM public.assessments
  WHERE course_id = v_course_id
    AND title = 'Microsoft Office Essentials Final Assessment'
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
    quote_literal('Microsoft Office Essentials Final Assessment') || ', ' ||
    quote_literal('Measure the learner''s understanding of core Word, Excel, and PowerPoint workflows used in common office tasks.') || ', ' ||
    quote_literal('/images/course-office.svg') || ', 25, 75, 3, true, true';

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
      'description = ' || quote_literal('Measure the learner''s understanding of core Word, Excel, and PowerPoint workflows used in common office tasks.') || ', ' ||
      'assessment_thumbnail = ' || quote_literal('/images/course-office.svg') || ', ' ||
      'time_limit = 25, ' ||
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
      'Which Microsoft Word feature is most appropriate when you need heading formatting to stay consistent across a multi-page report?',
      'multiple_choice',
      jsonb_build_array('Styles', 'Text boxes', 'WordArt', 'Page Color'),
      'Styles',
      2,
      1,
      'Styles help keep headings consistent and make navigation easier in long documents.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'True or false: In Word, Track Changes is useful when a reviewer needs to suggest edits that can be accepted or rejected later.',
      'true_false',
      NULL,
      'true',
      1,
      2,
      'Track Changes preserves review visibility instead of silently overwriting the original text.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'In Excel, what is the best reason to keep one header row and one type of data per column?',
      'multiple_choice',
      jsonb_build_array(
        'It makes sorting, filtering, and formulas more reliable',
        'It prevents users from entering formulas',
        'It automatically creates a presentation',
        'It removes the need for labels'
      ),
      'It makes sorting, filtering, and formulas more reliable',
      2,
      3,
      'Structured data is easier for Excel tools to interpret correctly.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which Excel function should a learner use to total values from several cells?',
      'multiple_choice',
      jsonb_build_array('SUM', 'TRIM', 'UPPER', 'LEFT'),
      'SUM',
      2,
      4,
      'SUM is the standard function for adding numeric values.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'True or false: An absolute reference in Excel stays fixed when a formula is copied to another cell.',
      'true_false',
      NULL,
      'true',
      1,
      5,
      'Absolute references lock the referenced row, column, or both.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which PowerPoint practice best improves readability during a live presentation?',
      'multiple_choice',
      jsonb_build_array(
        'Use one main idea per slide with concise text',
        'Fill each slide with full paragraphs',
        'Use many font styles on every slide',
        'Add animations to every object automatically'
      ),
      'Use one main idea per slide with concise text',
      2,
      6,
      'Slides should support the speaker, not replace them with dense reading material.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'What is the main benefit of Slide Master in PowerPoint?',
      'multiple_choice',
      jsonb_build_array(
        'It keeps layouts and formatting consistent across slides',
        'It checks spreadsheet formulas',
        'It stores email messages',
        'It converts slides into database tables'
      ),
      'It keeps layouts and formatting consistent across slides',
      2,
      7,
      'Slide Master is designed to control repeated design elements across a presentation.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'A staff member needs to draft a formal letter, compute monthly totals, and present results in a meeting. Which Office tool set is the best match?',
      'multiple_choice',
      jsonb_build_array(
        'Word for the letter, Excel for totals, and PowerPoint for the presentation',
        'Excel for the letter, Word for totals, and PowerPoint only for storage',
        'PowerPoint for the letter, Excel for presenting, and Word for formulas',
        'Only Word for all three tasks because the apps have the same purpose'
      ),
      'Word for the letter, Excel for totals, and PowerPoint for the presentation',
      3,
      8,
      'Each app serves a different productivity role: documents, calculations, and presentations.',
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