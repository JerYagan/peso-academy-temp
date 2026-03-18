-- Seed content for the course:
-- Graphic Design Fundamentals for Print and Digital Media
--
-- What this script does:
-- - Creates or updates a complete Graphic Design course using an existing trainer/admin/SPD user as instructor.
-- - Upserts 3 finalized modules with text, YouTube video, image, learning material, and quiz blocks.
-- - Upserts 1 standalone graded course assessment.
-- - Rewrites assessment questions on every run so the seed stays deterministic.

DO $seed$
DECLARE
  v_course_title text := 'Graphic Design Fundamentals for Print and Digital Media';
  v_course_id uuid;
  v_instructor_id uuid;
  v_now timestamptz := timezone('utc', now());

  v_module_1_id uuid;
  v_module_2_id uuid;
  v_module_3_id uuid;

  v_assessment_id uuid;

  v_m1_video text := 'https://www.youtube.com/watch?v=YqQx75OPRa0';
  v_m2_video text := 'https://www.youtube.com/watch?v=sByzHoiYFX0';
  v_m3_video text := 'https://www.youtube.com/watch?v=2W2rN3k2v5U';

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
      quote_literal('This course introduces the practical foundations of graphic design for modern communication. Learners will study visual hierarchy, typography, color, composition, branding basics, and digital content production for social media, marketing materials, presentations, and simple client work.') || ', ' ||
      quote_literal('Creative & Design') || ', ' ||
      quote_literal('Beginner') || ', ' ||
      '24, ' ||
      quote_literal(v_instructor_id);

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', ' || quote_literal('general_public');
    END IF;

    v_sql := v_sql || ', ' ||
      quote_literal('/images/course-tech.svg') || ', ' ||
      'false, ' ||
      'ARRAY[' ||
        quote_literal('Graphic Design') || ', ' ||
        quote_literal('Visual Communication') || ', ' ||
        quote_literal('Typography') || ', ' ||
        quote_literal('Layout Design') || ', ' ||
        quote_literal('Branding Fundamentals') || ', ' ||
        quote_literal('Digital Content Creation') || ']::text[]';

    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('Graphic Design') || ', ' ||
        quote_literal('Visual Communication') || ', ' ||
        quote_literal('Typography') || ', ' ||
        quote_literal('Layout Design') || ', ' ||
        quote_literal('Branding Fundamentals') || ', ' ||
        quote_literal('Digital Content Creation') || ']::text[]';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('Design Principles') || ', ' ||
        quote_literal('Branding and Identity') || ', ' ||
        quote_literal('Digital Media Production') || ']::text[]';
    END IF;
    IF v_has_course_industry_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('creative-design') || ', ' ||
        quote_literal('digital-media') || ', ' ||
        quote_literal('marketing') || ']::text[]';
    END IF;
    IF v_has_course_career_paths THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('graphic-designer') || ', ' ||
        quote_literal('content-creator') || ', ' ||
        quote_literal('marketing-assistant') || ']::text[]';
    END IF;

    v_sql := v_sql || ', 0, 4.7, ' || quote_literal('completion') || ', true, ' ||
      quote_literal(v_now) || ', ' || quote_literal(v_now) || ') RETURNING id';

    EXECUTE v_sql INTO v_course_id;
  ELSE
    v_sql := 'UPDATE public.courses SET ' ||
      'description = ' || quote_literal('This course introduces the practical foundations of graphic design for modern communication. Learners will study visual hierarchy, typography, color, composition, branding basics, and digital content production for social media, marketing materials, presentations, and simple client work.') || ', ' ||
      'category = ' || quote_literal('Creative & Design') || ', ' ||
      'level = ' || quote_literal('Beginner') || ', ' ||
      'duration = 24, ' ||
      'instructor_id = ' || quote_literal(v_instructor_id);

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', trainee_audience = ' || quote_literal('general_public');
    END IF;

    v_sql := v_sql || ', thumbnail = ' || quote_literal('/images/course-tech.svg') ||
      ', is_tesda_accredited = false' ||
      ', skills = ARRAY[' ||
        quote_literal('Graphic Design') || ', ' ||
        quote_literal('Visual Communication') || ', ' ||
        quote_literal('Typography') || ', ' ||
        quote_literal('Layout Design') || ', ' ||
        quote_literal('Branding Fundamentals') || ', ' ||
        quote_literal('Digital Content Creation') || ']::text[]';

    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', skill_tags = ARRAY[' ||
        quote_literal('Graphic Design') || ', ' ||
        quote_literal('Visual Communication') || ', ' ||
        quote_literal('Typography') || ', ' ||
        quote_literal('Layout Design') || ', ' ||
        quote_literal('Branding Fundamentals') || ', ' ||
        quote_literal('Digital Content Creation') || ']::text[]';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', topic_tags = ARRAY[' ||
        quote_literal('Design Principles') || ', ' ||
        quote_literal('Branding and Identity') || ', ' ||
        quote_literal('Digital Media Production') || ']::text[]';
    END IF;
    IF v_has_course_industry_tags THEN
      v_sql := v_sql || ', industry_tags = ARRAY[' ||
        quote_literal('creative-design') || ', ' ||
        quote_literal('digital-media') || ', ' ||
        quote_literal('marketing') || ']::text[]';
    END IF;
    IF v_has_course_career_paths THEN
      v_sql := v_sql || ', career_paths = ARRAY[' ||
        quote_literal('graphic-designer') || ', ' ||
        quote_literal('content-creator') || ', ' ||
        quote_literal('marketing-assistant') || ']::text[]';
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
    AND title = 'Principles of Visual Communication and Design Thinking'
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
      'Principles of Visual Communication and Design Thinking',
      'Learn how contrast, alignment, repetition, proximity, balance, and hierarchy shape what viewers notice and how a design thinking workflow guides effective communication.',
      1,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'gd-m1-text1',
          'type', 'text',
          'title', 'Graphic design solves communication problems',
          'content', $html$<p>Graphic design is not only about making something look attractive. Its main purpose is to help people understand, remember, and respond to a message. A poster, social media graphic, brochure, or campaign banner all have visual choices that shape how quickly the viewer understands what matters. Strong design reduces confusion, directs attention, and supports a goal such as informing, persuading, or guiding action.</p><p>Before opening a design tool, a designer should define the message, audience, format, and desired result. The most effective designs begin with clarity about audience and purpose rather than decoration.</p>$html$
        ),
        jsonb_build_object(
          'id', 'gd-m1-text2',
          'type', 'text',
          'title', 'Visual hierarchy tells the viewer where to look first',
          'content', $html$<p>Visual hierarchy is the arrangement of elements so the viewer naturally notices information in the right sequence. Larger elements, stronger contrast, strategic spacing, and placement near the top or center usually attract attention first. Headings, subheadings, calls to action, and supporting details should be designed so the audience can scan quickly and still understand the message.</p><p>When hierarchy is weak, the viewer may not know where to begin. Good hierarchy usually comes from a thoughtful combination of size, spacing, color emphasis, and clear grouping.</p>$html$
        ),
        jsonb_build_object(
          'id', 'gd-m1-text3',
          'type', 'text',
          'title', 'The basic design principles create order',
          'content', $html$<p>Contrast helps elements stand apart, alignment creates structure, repetition improves consistency, and proximity groups related content. Together, these principles make a layout feel intentional. Designers often test these principles through quick thumbnail sketches before building the final layout. Strong design decisions are often the result of several simple improvements rather than one dramatic visual trick.</p>$html$
        ),
        jsonb_build_object(
          'id', 'gd-m1-video',
          'type', 'video',
          'title', 'Graphic Design Basics and Core Principles',
          'content', '',
          'videoUrl', v_m1_video
        ),
        jsonb_build_object(
          'id', 'gd-m1-image',
          'type', 'image',
          'title', 'Designer sketching layout thumbnails',
          'imageUrl', 'https://picsum.photos/seed/graphic-design-m1/1200/675',
          'altText', 'Designer sketching layout thumbnails and arranging visual elements on a workspace',
          'caption', 'Reference image for discussing design principles, planning, and visual hierarchy'
        ),
        jsonb_build_object(
          'id', 'gd-m1-ref1',
          'type', 'learning_material',
          'title', 'Visual Hierarchy and Design Basics',
          'url', 'https://www.canva.com/learn/visual-hierarchy/',
          'content', 'Canva guide to visual hierarchy covering how to direct viewer attention through size, color, contrast, and placement.'
        ),
        jsonb_build_object(
          'id', 'gd-m1-quiz1',
          'type', 'quiz',
          'title', 'Quick check: design purpose',
          'content', 'What is the primary role of graphic design in communication?',
          'options', jsonb_build_array(
            'To fill empty space with decoration',
            'To make every design look complex',
            'To organize visuals so a message is understood clearly and effectively',
            'To use as many colors and fonts as possible'
          ),
          'correctAnswer', 2,
          'explanation', 'Graphic design supports communication by guiding attention and improving clarity, not by adding random decoration.'
        ),
        jsonb_build_object(
          'id', 'gd-m1-quiz2',
          'type', 'quiz',
          'title', 'Quick check: visual hierarchy',
          'content', 'Which design principle is most directly involved when a heading, subheading, and supporting text are arranged so the viewer reads them in the correct order?',
          'options', jsonb_build_array(
            'Visual hierarchy',
            'File compression',
            'Animation timing',
            'Resolution scaling'
          ),
          'correctAnswer', 0,
          'explanation', 'Visual hierarchy determines what the viewer notices first, second, and third.'
        )
      )::text,
      ARRAY[v_m1_video]::text[],
      ARRAY[]::text[],
      '/images/course-tech.svg',
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_1_id;
  ELSE
    UPDATE public.modules
    SET description = 'Learn how contrast, alignment, repetition, proximity, balance, and hierarchy shape what viewers notice and how a design thinking workflow guides effective communication.',
        "order" = 1,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'gd-m1-text1',
            'type', 'text',
            'title', 'Graphic design solves communication problems',
            'content', $html$<p>Graphic design is not only about making something look attractive. Its main purpose is to help people understand, remember, and respond to a message. A poster, social media graphic, brochure, or campaign banner all have visual choices that shape how quickly the viewer understands what matters. Strong design reduces confusion, directs attention, and supports a goal such as informing, persuading, or guiding action.</p><p>Before opening a design tool, a designer should define the message, audience, format, and desired result. The most effective designs begin with clarity about audience and purpose rather than decoration.</p>$html$
          ),
          jsonb_build_object(
            'id', 'gd-m1-text2',
            'type', 'text',
            'title', 'Visual hierarchy tells the viewer where to look first',
            'content', $html$<p>Visual hierarchy is the arrangement of elements so the viewer naturally notices information in the right sequence. Larger elements, stronger contrast, strategic spacing, and placement near the top or center usually attract attention first. Headings, subheadings, calls to action, and supporting details should be designed so the audience can scan quickly and still understand the message.</p><p>When hierarchy is weak, the viewer may not know where to begin. Good hierarchy usually comes from a thoughtful combination of size, spacing, color emphasis, and clear grouping.</p>$html$
          ),
          jsonb_build_object(
            'id', 'gd-m1-text3',
            'type', 'text',
            'title', 'The basic design principles create order',
            'content', $html$<p>Contrast helps elements stand apart, alignment creates structure, repetition improves consistency, and proximity groups related content. Together, these principles make a layout feel intentional. Designers often test these principles through quick thumbnail sketches before building the final layout. Strong design decisions are often the result of several simple improvements rather than one dramatic visual trick.</p>$html$
          ),
          jsonb_build_object(
            'id', 'gd-m1-video',
            'type', 'video',
            'title', 'Graphic Design Basics and Core Principles',
            'content', '',
            'videoUrl', v_m1_video
          ),
          jsonb_build_object(
            'id', 'gd-m1-image',
            'type', 'image',
            'title', 'Designer sketching layout thumbnails',
            'imageUrl', 'https://picsum.photos/seed/graphic-design-m1/1200/675',
            'altText', 'Designer sketching layout thumbnails and arranging visual elements on a workspace',
            'caption', 'Reference image for discussing design principles, planning, and visual hierarchy'
          ),
          jsonb_build_object(
            'id', 'gd-m1-ref1',
            'type', 'learning_material',
            'title', 'Visual Hierarchy and Design Basics',
            'url', 'https://www.canva.com/learn/visual-hierarchy/',
            'content', 'Canva guide to visual hierarchy covering how to direct viewer attention through size, color, contrast, and placement.'
          ),
          jsonb_build_object(
            'id', 'gd-m1-quiz1',
            'type', 'quiz',
            'title', 'Quick check: design purpose',
            'content', 'What is the primary role of graphic design in communication?',
            'options', jsonb_build_array(
              'To fill empty space with decoration',
              'To make every design look complex',
              'To organize visuals so a message is understood clearly and effectively',
              'To use as many colors and fonts as possible'
            ),
            'correctAnswer', 2,
            'explanation', 'Graphic design supports communication by guiding attention and improving clarity, not by adding random decoration.'
          ),
          jsonb_build_object(
            'id', 'gd-m1-quiz2',
            'type', 'quiz',
            'title', 'Quick check: visual hierarchy',
            'content', 'Which design principle is most directly involved when a heading, subheading, and supporting text are arranged so the viewer reads them in the correct order?',
            'options', jsonb_build_array(
              'Visual hierarchy',
              'File compression',
              'Animation timing',
              'Resolution scaling'
            ),
            'correctAnswer', 0,
            'explanation', 'Visual hierarchy determines what the viewer notices first, second, and third.'
          )
        )::text,
        materials = ARRAY[v_m1_video]::text[],
        prerequisites = ARRAY[]::text[],
        module_thumbnail = '/images/course-tech.svg',
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_1_id;
  END IF;

  -- ------------------------------------------------------------------ Module 2
  SELECT id
  INTO v_module_2_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Typography and Color in Graphic Design'
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
      'Typography and Color in Graphic Design',
      'Explore how font choice, color palettes, spacing, and grid systems create readable, balanced, and visually appealing layouts for print and digital contexts.',
      2,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'gd-m2-text1',
          'type', 'text',
          'title', 'Typography affects tone and readability',
          'content', $html$<p>Typography is one of the most important tools in graphic design because it carries both information and mood. A bold sans serif may feel modern and direct, while a serif font may suggest tradition or formality. Script and display fonts can add personality, but they must be used carefully because they can quickly reduce readability if overused.</p><p>Good typography depends on hierarchy, spacing, and consistency. Designers should establish clear differences between headline size, subhead size, and body text while maintaining a visual relationship between them.</p>$html$
        ),
        jsonb_build_object(
          'id', 'gd-m2-text2',
          'type', 'text',
          'title', 'Color supports emotion, emphasis, and accessibility',
          'content', $html$<p>Color can guide attention, reinforce brand identity, and influence emotional response. Warm colors often feel energetic, while cooler colors may feel calm or professional. However, designers must also check contrast, legibility, and accessibility, especially when text is placed over images or tinted backgrounds.</p><p>An effective palette usually includes a dominant color, supporting neutrals, and one or two accent colors for emphasis. Too many competing colors can weaken the message and make the design appear inconsistent.</p>$html$
        ),
        jsonb_build_object(
          'id', 'gd-m2-text3',
          'type', 'text',
          'title', 'Layout becomes stronger when spacing is intentional',
          'content', $html$<p>Many beginner layouts feel crowded because elements are not given enough space to breathe. Margins, gutters, padding, and consistent alignment help create a more organized composition. Grid systems are especially useful because they provide a repeatable structure for positioning text, images, and icons in a balanced way.</p><p>White space should not be treated as wasted space. It improves focus and makes the most important content stand out. Designers who control spacing well usually create work that looks more professional, even when the visual style is simple.</p>$html$
        ),
        jsonb_build_object(
          'id', 'gd-m2-video',
          'type', 'video',
          'title', 'Typography and Layout Basics for Beginners',
          'content', '',
          'videoUrl', v_m2_video
        ),
        jsonb_build_object(
          'id', 'gd-m2-image',
          'type', 'image',
          'title', 'Color swatches and typography samples',
          'imageUrl', 'https://picsum.photos/seed/graphic-design-m2/1200/675',
          'altText', 'Color swatches, typography samples, and layout guides on a designer screen',
          'caption', 'Reference image for discussing typography, color systems, and layout structure'
        ),
        jsonb_build_object(
          'id', 'gd-m2-ref1',
          'type', 'learning_material',
          'title', 'Typography and Color in Design',
          'url', 'https://www.canva.com/learn/typography/',
          'content', 'Canva guide to typography in design covering font pairing, type hierarchy, and spacing decisions for clear and consistent layouts.'
        ),
        jsonb_build_object(
          'id', 'gd-m2-quiz1',
          'type', 'quiz',
          'title', 'Quick check: multiple fonts',
          'content', 'Why is it risky to use several decorative fonts in one layout?',
          'options', jsonb_build_array(
            'It usually improves readability too much',
            'It can make the design feel inconsistent and harder to read',
            'It automatically reduces file size',
            'It guarantees stronger brand recognition'
          ),
          'correctAnswer', 1,
          'explanation', 'Too many decorative fonts compete for attention and usually weaken readability and visual consistency.'
        ),
        jsonb_build_object(
          'id', 'gd-m2-quiz2',
          'type', 'quiz',
          'title', 'Quick check: white space',
          'content', 'What is the main purpose of white space in a layout?',
          'options', jsonb_build_array(
            'To leave unfinished parts of the design visible',
            'To reduce the need for alignment',
            'To improve focus, separation, and readability',
            'To make every design look empty'
          ),
          'correctAnswer', 2,
          'explanation', 'White space creates room around elements so viewers can scan content more easily and identify what matters most.'
        )
      )::text,
      ARRAY[v_m2_video]::text[],
      ARRAY[v_module_1_id::text]::text[],
      '/images/course-tech.svg',
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_2_id;
  ELSE
    UPDATE public.modules
    SET description = 'Explore how font choice, color palettes, spacing, and grid systems create readable, balanced, and visually appealing layouts for print and digital contexts.',
        "order" = 2,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'gd-m2-text1',
            'type', 'text',
            'title', 'Typography affects tone and readability',
            'content', $html$<p>Typography is one of the most important tools in graphic design because it carries both information and mood. A bold sans serif may feel modern and direct, while a serif font may suggest tradition or formality. Script and display fonts can add personality, but they must be used carefully because they can quickly reduce readability if overused.</p><p>Good typography depends on hierarchy, spacing, and consistency. Designers should establish clear differences between headline size, subhead size, and body text while maintaining a visual relationship between them.</p>$html$
          ),
          jsonb_build_object(
            'id', 'gd-m2-text2',
            'type', 'text',
            'title', 'Color supports emotion, emphasis, and accessibility',
            'content', $html$<p>Color can guide attention, reinforce brand identity, and influence emotional response. Warm colors often feel energetic, while cooler colors may feel calm or professional. However, designers must also check contrast, legibility, and accessibility, especially when text is placed over images or tinted backgrounds.</p><p>An effective palette usually includes a dominant color, supporting neutrals, and one or two accent colors for emphasis. Too many competing colors can weaken the message and make the design appear inconsistent.</p>$html$
          ),
          jsonb_build_object(
            'id', 'gd-m2-text3',
            'type', 'text',
            'title', 'Layout becomes stronger when spacing is intentional',
            'content', $html$<p>Many beginner layouts feel crowded because elements are not given enough space to breathe. Margins, gutters, padding, and consistent alignment help create a more organized composition. Grid systems are especially useful because they provide a repeatable structure for positioning text, images, and icons in a balanced way.</p><p>White space should not be treated as wasted space. It improves focus and makes the most important content stand out. Designers who control spacing well usually create work that looks more professional, even when the visual style is simple.</p>$html$
          ),
          jsonb_build_object(
            'id', 'gd-m2-video',
            'type', 'video',
            'title', 'Typography and Layout Basics for Beginners',
            'content', '',
            'videoUrl', v_m2_video
          ),
          jsonb_build_object(
            'id', 'gd-m2-image',
            'type', 'image',
            'title', 'Color swatches and typography samples',
            'imageUrl', 'https://picsum.photos/seed/graphic-design-m2/1200/675',
            'altText', 'Color swatches, typography samples, and layout guides on a designer screen',
            'caption', 'Reference image for discussing typography, color systems, and layout structure'
          ),
          jsonb_build_object(
            'id', 'gd-m2-ref1',
            'type', 'learning_material',
            'title', 'Typography and Color in Design',
            'url', 'https://www.canva.com/learn/typography/',
            'content', 'Canva guide to typography in design covering font pairing, type hierarchy, and spacing decisions for clear and consistent layouts.'
          ),
          jsonb_build_object(
            'id', 'gd-m2-quiz1',
            'type', 'quiz',
            'title', 'Quick check: multiple fonts',
            'content', 'Why is it risky to use several decorative fonts in one layout?',
            'options', jsonb_build_array(
              'It usually improves readability too much',
              'It can make the design feel inconsistent and harder to read',
              'It automatically reduces file size',
              'It guarantees stronger brand recognition'
            ),
            'correctAnswer', 1,
            'explanation', 'Too many decorative fonts compete for attention and usually weaken readability and visual consistency.'
          ),
          jsonb_build_object(
            'id', 'gd-m2-quiz2',
            'type', 'quiz',
            'title', 'Quick check: white space',
            'content', 'What is the main purpose of white space in a layout?',
            'options', jsonb_build_array(
              'To leave unfinished parts of the design visible',
              'To reduce the need for alignment',
              'To improve focus, separation, and readability',
              'To make every design look empty'
            ),
            'correctAnswer', 2,
            'explanation', 'White space creates room around elements so viewers can scan content more easily and identify what matters most.'
          )
        )::text,
        materials = ARRAY[v_m2_video]::text[],
        prerequisites = ARRAY[v_module_1_id::text]::text[],
        module_thumbnail = '/images/course-tech.svg',
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_2_id;
  END IF;

  -- ------------------------------------------------------------------ Module 3
  SELECT id
  INTO v_module_3_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Branding, Layout, and Digital Content Production'
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
      'Branding, Layout, and Digital Content Production',
      'Apply design foundations to real content production including brand consistency, image selection, and creating social posts, promotional graphics, and campaign assets.',
      3,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'gd-m3-text1',
          'type', 'text',
          'title', 'Branding is a system, not just a logo',
          'content', $html$<p>Many beginners think branding means selecting a logo and a favorite color. In practice, branding is a consistent visual and verbal system that helps people recognize and trust a product, service, or organization. Typography, color palette, image style, icon treatment, spacing rules, and tone of voice all contribute to identity.</p><p>When brand elements are used inconsistently, the audience may not immediately recognize the organization across different channels. Consistency improves recall and gives the impression of professionalism.</p>$html$
        ),
        jsonb_build_object(
          'id', 'gd-m3-text2',
          'type', 'text',
          'title', 'Image selection should support the message',
          'content', $html$<p>Images are powerful because they communicate quickly, but they can also weaken a design if they are generic, low quality, or unrelated to the content. A good image should match the message, target audience, and emotional tone of the design. Designers should also consider readability when placing text over photos.</p><p>Image use is successful when it adds context and emotional resonance without competing with the main information. High-contrast overlays or strategic placement can help text remain legible over backgrounds.</p>$html$
        ),
        jsonb_build_object(
          'id', 'gd-m3-text3',
          'type', 'text',
          'title', 'Platform-specific design still needs consistency',
          'content', $html$<p>Digital platforms require different dimensions and user behaviors. A vertical story graphic, a square social post, and a horizontal banner each have different space constraints and attention patterns. Designers need to adapt layout and text density to each format while preserving consistent brand elements such as logo position, color palette, headline style, and call-to-action treatment.</p><p>Creating a simple content system can help. For example, a designer may use one headline style for announcements, one image treatment for testimonials, and one button style for promotions.</p>$html$
        ),
        jsonb_build_object(
          'id', 'gd-m3-video',
          'type', 'video',
          'title', 'Branding and Social Media Design Basics',
          'content', '',
          'videoUrl', v_m3_video
        ),
        jsonb_build_object(
          'id', 'gd-m3-image',
          'type', 'image',
          'title', 'Social media content mockups',
          'imageUrl', 'https://picsum.photos/seed/graphic-design-m3/1200/675',
          'altText', 'Social media content mockups with coordinated brand colors, typography, and image treatments',
          'caption', 'Reference image for discussing branding systems and digital content adaptation'
        ),
        jsonb_build_object(
          'id', 'gd-m3-ref1',
          'type', 'learning_material',
          'title', 'Brand Identity and Digital Content Design',
          'url', 'https://www.canva.com/learn/brand-identity/',
          'content', 'Canva guide to brand identity covering visual systems, consistency across platforms, and producing digital content for different formats and audiences.'
        ),
        jsonb_build_object(
          'id', 'gd-m3-quiz1',
          'type', 'quiz',
          'title', 'Quick check: brand consistency',
          'content', 'Which statement best explains why brand consistency matters?',
          'options', jsonb_build_array(
            'It prevents any future redesign work forever',
            'It helps audiences recognize and trust the organization across different materials',
            'It allows designers to ignore audience needs',
            'It means every design should have identical layouts regardless of platform'
          ),
          'correctAnswer', 1,
          'explanation', 'Consistency builds recognition and supports a more professional and reliable visual presence.'
        ),
        jsonb_build_object(
          'id', 'gd-m3-quiz2',
          'type', 'quiz',
          'title', 'Quick check: platform adaptation',
          'content', 'What is the best reason to adapt a design for a specific platform such as a story, post, or banner?',
          'options', jsonb_build_array(
            'Every platform has different dimensions and attention patterns',
            'Brand elements should be removed on smaller screens',
            'Typography does not matter online',
            'Images should replace all written content on digital platforms'
          ),
          'correctAnswer', 0,
          'explanation', 'Designers adapt layout, scale, and content density to the platform while keeping the brand system consistent.'
        )
      )::text,
      ARRAY[v_m3_video]::text[],
      ARRAY[v_module_1_id::text, v_module_2_id::text]::text[],
      '/images/course-tech.svg',
      'finalized',
      v_now,
      v_now
    )
    RETURNING id INTO v_module_3_id;
  ELSE
    UPDATE public.modules
    SET description = 'Apply design foundations to real content production including brand consistency, image selection, and creating social posts, promotional graphics, and campaign assets.',
        "order" = 3,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'gd-m3-text1',
            'type', 'text',
            'title', 'Branding is a system, not just a logo',
            'content', $html$<p>Many beginners think branding means selecting a logo and a favorite color. In practice, branding is a consistent visual and verbal system that helps people recognize and trust a product, service, or organization. Typography, color palette, image style, icon treatment, spacing rules, and tone of voice all contribute to identity.</p><p>When brand elements are used inconsistently, the audience may not immediately recognize the organization across different channels. Consistency improves recall and gives the impression of professionalism.</p>$html$
          ),
          jsonb_build_object(
            'id', 'gd-m3-text2',
            'type', 'text',
            'title', 'Image selection should support the message',
            'content', $html$<p>Images are powerful because they communicate quickly, but they can also weaken a design if they are generic, low quality, or unrelated to the content. A good image should match the message, target audience, and emotional tone of the design. Designers should also consider readability when placing text over photos.</p><p>Image use is successful when it adds context and emotional resonance without competing with the main information. High-contrast overlays or strategic placement can help text remain legible over backgrounds.</p>$html$
          ),
          jsonb_build_object(
            'id', 'gd-m3-text3',
            'type', 'text',
            'title', 'Platform-specific design still needs consistency',
            'content', $html$<p>Digital platforms require different dimensions and user behaviors. A vertical story graphic, a square social post, and a horizontal banner each have different space constraints and attention patterns. Designers need to adapt layout and text density to each format while preserving consistent brand elements such as logo position, color palette, headline style, and call-to-action treatment.</p><p>Creating a simple content system can help. For example, a designer may use one headline style for announcements, one image treatment for testimonials, and one button style for promotions.</p>$html$
          ),
          jsonb_build_object(
            'id', 'gd-m3-video',
            'type', 'video',
            'title', 'Branding and Social Media Design Basics',
            'content', '',
            'videoUrl', v_m3_video
          ),
          jsonb_build_object(
            'id', 'gd-m3-image',
            'type', 'image',
            'title', 'Social media content mockups',
            'imageUrl', 'https://picsum.photos/seed/graphic-design-m3/1200/675',
            'altText', 'Social media content mockups with coordinated brand colors, typography, and image treatments',
            'caption', 'Reference image for discussing branding systems and digital content adaptation'
          ),
          jsonb_build_object(
            'id', 'gd-m3-ref1',
            'type', 'learning_material',
            'title', 'Brand Identity and Digital Content Design',
            'url', 'https://www.canva.com/learn/brand-identity/',
            'content', 'Canva guide to brand identity covering visual systems, consistency across platforms, and producing digital content for different formats and audiences.'
          ),
          jsonb_build_object(
            'id', 'gd-m3-quiz1',
            'type', 'quiz',
            'title', 'Quick check: brand consistency',
            'content', 'Which statement best explains why brand consistency matters?',
            'options', jsonb_build_array(
              'It prevents any future redesign work forever',
              'It helps audiences recognize and trust the organization across different materials',
              'It allows designers to ignore audience needs',
              'It means every design should have identical layouts regardless of platform'
            ),
            'correctAnswer', 1,
            'explanation', 'Consistency builds recognition and supports a more professional and reliable visual presence.'
          ),
          jsonb_build_object(
            'id', 'gd-m3-quiz2',
            'type', 'quiz',
            'title', 'Quick check: platform adaptation',
            'content', 'What is the best reason to adapt a design for a specific platform such as a story, post, or banner?',
            'options', jsonb_build_array(
              'Every platform has different dimensions and attention patterns',
              'Brand elements should be removed on smaller screens',
              'Typography does not matter online',
              'Images should replace all written content on digital platforms'
            ),
            'correctAnswer', 0,
            'explanation', 'Designers adapt layout, scale, and content density to the platform while keeping the brand system consistent.'
          )
        )::text,
        materials = ARRAY[v_m3_video]::text[],
        prerequisites = ARRAY[v_module_1_id::text, v_module_2_id::text]::text[],
        module_thumbnail = '/images/course-tech.svg',
        status = 'finalized',
        updated_at = v_now
    WHERE id = v_module_3_id;
  END IF;

  -- ------------------------------------------------------------------ Assessment
  SELECT id
  INTO v_assessment_id
  FROM public.assessments
  WHERE course_id = v_course_id
    AND title = 'Graphic Design Fundamentals Final Assessment'
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
    quote_literal('Graphic Design Fundamentals Final Assessment') || ', ' ||
    quote_literal('Measure the learner''s understanding of graphic design principles, typography, color, layout, branding, image use, and digital content adaptation.') || ', ' ||
    quote_literal('/images/course-tech.svg') || ', 30, 75, 3, true, true';

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
      'description = ' || quote_literal('Measure the learner''s understanding of graphic design principles, typography, color, layout, branding, image use, and digital content adaptation.') || ', ' ||
      'assessment_thumbnail = ' || quote_literal('/images/course-tech.svg') || ', ' ||
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
      'What is the strongest definition of graphic design in a professional context?',
      'multiple_choice',
      jsonb_build_array(
        'The process of making visuals look expensive',
        'The use of visual elements to communicate messages clearly and purposefully',
        'A method for adding decorative effects to text',
        'A software skill limited to photo editing'
      ),
      'The use of visual elements to communicate messages clearly and purposefully',
      2,
      1,
      'Graphic design is fundamentally about communication, organization, and audience understanding.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which design principle helps viewers identify what to read first, second, and third?',
      'multiple_choice',
      jsonb_build_array(
        'File export settings',
        'Visual hierarchy',
        'Compression ratio',
        'Pixel density'
      ),
      'Visual hierarchy',
      2,
      2,
      'Visual hierarchy shapes the order in which content is noticed and understood.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'True or false: A successful layout usually becomes easier to read when related items are grouped closely and unrelated items are separated.',
      'true_false',
      NULL,
      'true',
      1,
      3,
      'This reflects the principle of proximity, which helps viewers interpret relationships between elements.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which typography choice is usually best for improving readability in a content-heavy layout?',
      'multiple_choice',
      jsonb_build_array(
        'Using multiple script fonts for body text',
        'Establishing a clear type hierarchy with consistent spacing',
        'Making all text the same size',
        'Center-aligning every paragraph by default'
      ),
      'Establishing a clear type hierarchy with consistent spacing',
      2,
      4,
      'Readability improves when text roles are clearly defined and spacing is controlled.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'What is the main reason designers check color contrast in text-based graphics?',
      'multiple_choice',
      jsonb_build_array(
        'To reduce the number of fonts used',
        'To improve legibility and accessibility',
        'To make all colors equally bright',
        'To avoid using neutral colors'
      ),
      'To improve legibility and accessibility',
      2,
      5,
      'Contrast ensures viewers can distinguish text from its background and read content more comfortably.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'True or false: White space is wasted space and should always be filled with additional icons or text.',
      'true_false',
      NULL,
      'false',
      1,
      6,
      'White space improves focus, separation, and clarity, and is an important part of professional layout design.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which statement best describes branding?',
      'multiple_choice',
      jsonb_build_array(
        'It is only the design of a logo symbol',
        'It is a system of consistent visual and verbal cues that support recognition and trust',
        'It is the same as advertising budget planning',
        'It removes the need for audience research'
      ),
      'It is a system of consistent visual and verbal cues that support recognition and trust',
      2,
      7,
      'Branding includes multiple elements working together, not just a logo alone.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which image choice is most appropriate for a professional awareness campaign graphic?',
      'multiple_choice',
      jsonb_build_array(
        'A low-resolution image that does not match the message but looks colorful',
        'A relevant, high-quality image that supports the subject and leaves room for readable text',
        'Any stock image with bright filters',
        'An image selected only because it fills the full frame'
      ),
      'A relevant, high-quality image that supports the subject and leaves room for readable text',
      2,
      8,
      'Image selection should strengthen the message and work with the layout, not compete with it.',
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
