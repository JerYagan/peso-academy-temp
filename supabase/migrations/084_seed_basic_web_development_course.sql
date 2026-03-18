-- Seed content for the course:
-- Basic Web Development Foundations
--
-- What this script does:
-- - Creates or updates a complete Basic Web Development course using an existing trainer/admin/SPD user as instructor.
-- - Upserts 3 finalized modules with text, YouTube video, image, learning material, and quiz blocks.
-- - Upserts 1 standalone graded course assessment.
-- - Rewrites assessment questions on every run so the seed stays deterministic.

DO $seed$
DECLARE
  v_course_title text := 'Basic Web Development Foundations';
  v_course_id uuid;
  v_instructor_id uuid;
  v_now timestamptz := timezone('utc', now());

  v_module_1_id uuid;
  v_module_2_id uuid;
  v_module_3_id uuid;

  v_assessment_id uuid;

  v_m1_video text := 'https://www.youtube.com/watch?v=pQN-pnXPaVg';
  v_m2_video text := 'https://www.youtube.com/watch?v=OXGznpKZ_sA';
  v_m3_video text := 'https://www.youtube.com/watch?v=EerdGm-ehJQ';

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
      quote_literal('This course introduces the core building blocks of modern web development. Learners begin by understanding how websites work, then move into creating page structure with HTML, styling interfaces with CSS, and adding interactivity with JavaScript.') || ', ' ||
      quote_literal('Information Technology') || ', ' ||
      quote_literal('Beginner') || ', ' ||
      '30, ' ||
      quote_literal(v_instructor_id);

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', ' || quote_literal('general_public');
    END IF;

    v_sql := v_sql || ', ' ||
      quote_literal('/images/course-tech.svg') || ', ' ||
      'false, ' ||
      'ARRAY[' ||
        quote_literal('Web Development Fundamentals') || ', ' ||
        quote_literal('HTML Authoring') || ', ' ||
        quote_literal('CSS Styling') || ', ' ||
        quote_literal('JavaScript Basics') || ', ' ||
        quote_literal('Browser and Developer Tools') || ']::text[]';

    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('Web Development Fundamentals') || ', ' ||
        quote_literal('HTML Authoring') || ', ' ||
        quote_literal('CSS Styling') || ', ' ||
        quote_literal('JavaScript Basics') || ', ' ||
        quote_literal('Browser and Developer Tools') || ']::text[]';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('Front-End Development') || ', ' ||
        quote_literal('User Interface Fundamentals') || ', ' ||
        quote_literal('Responsive Design Basics') || ', ' ||
        quote_literal('Client-Side Programming') || ']::text[]';
    END IF;
    IF v_has_course_industry_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('information-technology') || ', ' ||
        quote_literal('software-development') || ', ' ||
        quote_literal('web-development') || ']::text[]';
    END IF;
    IF v_has_course_career_paths THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('web-developer') || ', ' ||
        quote_literal('frontend-developer') || ', ' ||
        quote_literal('junior-developer') || ']::text[]';
    END IF;

    v_sql := v_sql || ', 0, 4.7, ' || quote_literal('completion') || ', true, ' ||
      quote_literal(v_now) || ', ' || quote_literal(v_now) || ') RETURNING id';

    EXECUTE v_sql INTO v_course_id;
  ELSE
    v_sql := 'UPDATE public.courses SET ' ||
      'description = ' || quote_literal('This course introduces the core building blocks of modern web development. Learners begin by understanding how websites work, then move into creating page structure with HTML, styling interfaces with CSS, and adding interactivity with JavaScript.') || ', ' ||
      'category = ' || quote_literal('Information Technology') || ', ' ||
      'level = ' || quote_literal('Beginner') || ', ' ||
      'duration = 30, ' ||
      'instructor_id = ' || quote_literal(v_instructor_id);

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', trainee_audience = ' || quote_literal('general_public');
    END IF;

    v_sql := v_sql || ', thumbnail = ' || quote_literal('/images/course-tech.svg') ||
      ', is_tesda_accredited = false' ||
      ', skills = ARRAY[' ||
        quote_literal('Web Development Fundamentals') || ', ' ||
        quote_literal('HTML Authoring') || ', ' ||
        quote_literal('CSS Styling') || ', ' ||
        quote_literal('JavaScript Basics') || ', ' ||
        quote_literal('Browser and Developer Tools') || ']::text[]';

    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', skill_tags = ARRAY[' ||
        quote_literal('Web Development Fundamentals') || ', ' ||
        quote_literal('HTML Authoring') || ', ' ||
        quote_literal('CSS Styling') || ', ' ||
        quote_literal('JavaScript Basics') || ', ' ||
        quote_literal('Browser and Developer Tools') || ']::text[]';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', topic_tags = ARRAY[' ||
        quote_literal('Front-End Development') || ', ' ||
        quote_literal('User Interface Fundamentals') || ', ' ||
        quote_literal('Responsive Design Basics') || ', ' ||
        quote_literal('Client-Side Programming') || ']::text[]';
    END IF;
    IF v_has_course_industry_tags THEN
      v_sql := v_sql || ', industry_tags = ARRAY[' ||
        quote_literal('information-technology') || ', ' ||
        quote_literal('software-development') || ', ' ||
        quote_literal('web-development') || ']::text[]';
    END IF;
    IF v_has_course_career_paths THEN
      v_sql := v_sql || ', career_paths = ARRAY[' ||
        quote_literal('web-developer') || ', ' ||
        quote_literal('frontend-developer') || ', ' ||
        quote_literal('junior-developer') || ']::text[]';
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
    AND title = 'Understanding the Web and Building Structure with HTML'
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
      'Understanding the Web and Building Structure with HTML',
      'Introduces the foundations of the web and teaches learners how to structure content using HTML, including semantic elements, headings, paragraphs, lists, links, and images.',
      1,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'bwd-m1-text1',
          'type', 'text',
          'title', 'How the web works at a beginner level',
          'content', $html$<p>When a user opens a website, the browser sends a request to a server. The server responds with files such as HTML, CSS, JavaScript, and images. The browser reads these files and turns them into the page a user can see and interact with.</p><p>HTML gives the page structure. CSS controls appearance. JavaScript adds behavior. These three technologies work together in most front-end web experiences. Understanding their separate roles helps learners avoid confusion as projects become larger.</p>$html$
        ),
        jsonb_build_object(
          'id', 'bwd-m1-text2',
          'type', 'text',
          'title', 'HTML gives meaning and structure to content',
          'content', $html$<p>HTML is not only about placing text on a page. Good HTML gives meaning to content. A page title belongs in a heading element, navigation belongs in a navigation area, and the main lesson content belongs in the main section. This structure helps browsers, assistive technologies, and developers understand the purpose of each part of the page.</p><p>Semantic HTML also makes pages easier to maintain. When sections are named clearly with elements such as header, nav, main, section, article, and footer, the code becomes easier to read and easier to update later.</p>$html$
        ),
        jsonb_build_object(
          'id', 'bwd-m1-text3',
          'type', 'text',
          'title', 'Start with a clean HTML document',
          'content', $html$<p>A beginner-friendly HTML page usually begins with a doctype, an html element, a head section, and a body section. The head contains metadata such as the page title and links to stylesheets. The body contains the visible content of the page.</p><p>Inside the body, learners should group related content together and use headings in a logical order. Skipping structure for visual shortcuts often creates confusion later when styling or scripting the page.</p>$html$
        ),
        jsonb_build_object(
          'id', 'bwd-m1-video',
          'type', 'video',
          'title', 'HTML Full Course for Beginners',
          'content', '',
          'videoUrl', v_m1_video
        ),
        jsonb_build_object(
          'id', 'bwd-m1-image',
          'type', 'image',
          'title', 'HTML structure illustration',
          'imageUrl', 'https://upload.wikimedia.org/wikipedia/commons/6/61/HTML5_logo_and_wordmark.svg',
          'altText', 'HTML5 logo representing the structure of web pages',
          'caption', 'HTML provides the foundational structure of every web page through a hierarchy of elements.'
        ),
        jsonb_build_object(
          'id', 'bwd-m1-ref1',
          'type', 'learning_material',
          'title', 'MDN Web Docs: HTML Introduction',
          'url', 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content',
          'content', 'MDN Web Docs introduction to structuring content with HTML, covering semantic elements, headings, links, images, and page organization best practices.'
        ),
        jsonb_build_object(
          'id', 'bwd-m1-quiz1',
          'type', 'quiz',
          'title', 'Quick check: HTML purpose',
          'content', 'What is the main purpose of HTML in a web page?',
          'options', jsonb_build_array(
            'To define the structure and meaning of content',
            'To store user passwords on a server',
            'To style colors, spacing, and fonts only',
            'To replace the browser completely'
          ),
          'correctAnswer', 0,
          'explanation', 'HTML provides the page structure and content meaning, while CSS handles presentation and JavaScript handles behavior.'
        ),
        jsonb_build_object(
          'id', 'bwd-m1-quiz2',
          'type', 'quiz',
          'title', 'Quick check: semantic elements',
          'content', 'Which group of elements is most associated with semantic page structure?',
          'options', jsonb_build_array(
            'header, main, section, footer',
            'bold, flash, center, font',
            'color, width, margin, padding',
            'server, database, router, cache'
          ),
          'correctAnswer', 0,
          'explanation', 'These semantic elements help organize a page by purpose, making the document clearer for both developers and assistive tools.'
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
    SET description = 'Introduces the foundations of the web and teaches learners how to structure content using HTML, including semantic elements, headings, paragraphs, lists, links, and images.',
        "order" = 1,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'bwd-m1-text1',
            'type', 'text',
            'title', 'How the web works at a beginner level',
            'content', $html$<p>When a user opens a website, the browser sends a request to a server. The server responds with files such as HTML, CSS, JavaScript, and images. The browser reads these files and turns them into the page a user can see and interact with.</p><p>HTML gives the page structure. CSS controls appearance. JavaScript adds behavior. These three technologies work together in most front-end web experiences. Understanding their separate roles helps learners avoid confusion as projects become larger.</p>$html$
          ),
          jsonb_build_object(
            'id', 'bwd-m1-text2',
            'type', 'text',
            'title', 'HTML gives meaning and structure to content',
            'content', $html$<p>HTML is not only about placing text on a page. Good HTML gives meaning to content. A page title belongs in a heading element, navigation belongs in a navigation area, and the main lesson content belongs in the main section. This structure helps browsers, assistive technologies, and developers understand the purpose of each part of the page.</p><p>Semantic HTML also makes pages easier to maintain. When sections are named clearly with elements such as header, nav, main, section, article, and footer, the code becomes easier to read and easier to update later.</p>$html$
          ),
          jsonb_build_object(
            'id', 'bwd-m1-text3',
            'type', 'text',
            'title', 'Start with a clean HTML document',
            'content', $html$<p>A beginner-friendly HTML page usually begins with a doctype, an html element, a head section, and a body section. The head contains metadata such as the page title and links to stylesheets. The body contains the visible content of the page.</p><p>Inside the body, learners should group related content together and use headings in a logical order. Skipping structure for visual shortcuts often creates confusion later when styling or scripting the page.</p>$html$
          ),
          jsonb_build_object(
            'id', 'bwd-m1-video',
            'type', 'video',
            'title', 'HTML Full Course for Beginners',
            'content', '',
            'videoUrl', v_m1_video
          ),
          jsonb_build_object(
            'id', 'bwd-m1-image',
            'type', 'image',
            'title', 'HTML structure illustration',
            'imageUrl', 'https://upload.wikimedia.org/wikipedia/commons/6/61/HTML5_logo_and_wordmark.svg',
            'altText', 'HTML5 logo representing the structure of web pages',
            'caption', 'HTML provides the foundational structure of every web page through a hierarchy of elements.'
          ),
          jsonb_build_object(
            'id', 'bwd-m1-ref1',
            'type', 'learning_material',
            'title', 'MDN Web Docs: HTML Introduction',
            'url', 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content',
            'content', 'MDN Web Docs introduction to structuring content with HTML, covering semantic elements, headings, links, images, and page organization best practices.'
          ),
          jsonb_build_object(
            'id', 'bwd-m1-quiz1',
            'type', 'quiz',
            'title', 'Quick check: HTML purpose',
            'content', 'What is the main purpose of HTML in a web page?',
            'options', jsonb_build_array(
              'To define the structure and meaning of content',
              'To store user passwords on a server',
              'To style colors, spacing, and fonts only',
              'To replace the browser completely'
            ),
            'correctAnswer', 0,
            'explanation', 'HTML provides the page structure and content meaning, while CSS handles presentation and JavaScript handles behavior.'
          ),
          jsonb_build_object(
            'id', 'bwd-m1-quiz2',
            'type', 'quiz',
            'title', 'Quick check: semantic elements',
            'content', 'Which group of elements is most associated with semantic page structure?',
            'options', jsonb_build_array(
              'header, main, section, footer',
              'bold, flash, center, font',
              'color, width, margin, padding',
              'server, database, router, cache'
            ),
            'correctAnswer', 0,
            'explanation', 'These semantic elements help organize a page by purpose, making the document clearer for both developers and assistive tools.'
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
    AND title = 'Styling Web Pages with CSS'
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
      'Styling Web Pages with CSS',
      'Focuses on visual presentation with CSS including selectors, colors, typography, spacing, the box model, and simple responsive layout concepts.',
      2,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'bwd-m2-text1',
          'type', 'text',
          'title', 'CSS controls presentation and visual hierarchy',
          'content', $html$<p>Without CSS, HTML pages are functional but visually plain. CSS makes it possible to define colors, font sizes, spacing, alignment, and layout. This improves readability and helps users focus on the most important parts of the page.</p><p>Visual hierarchy matters. A clear heading should stand out from body text. Buttons should look clickable. Content blocks should have enough spacing so the page does not feel crowded. Good styling supports understanding, not just decoration.</p>$html$
        ),
        jsonb_build_object(
          'id', 'bwd-m2-text2',
          'type', 'text',
          'title', 'Selectors help you target the right elements',
          'content', $html$<p>CSS rules apply to elements through selectors. Beginners often start with element selectors such as p or h1, then move into class selectors such as .card or .button. Classes are especially useful because they allow the same styling pattern to be reused across different elements.</p><p>When styles are grouped logically, the page becomes easier to maintain. A class named .hero-title communicates intention more clearly than repeating inline styling across many elements.</p>$html$
        ),
        jsonb_build_object(
          'id', 'bwd-m2-text3',
          'type', 'text',
          'title', 'The box model explains spacing',
          'content', $html$<p>Every visible HTML element can be understood as a box. The box model includes content, padding, border, and margin. Padding creates space inside the box, border wraps around the content and padding, and margin creates space outside the box.</p><p>Many beginner layout problems happen because margin and padding are confused. Once learners understand the box model, page spacing becomes much easier to control.</p>$html$
        ),
        jsonb_build_object(
          'id', 'bwd-m2-video',
          'type', 'video',
          'title', 'CSS Tutorial for Beginners',
          'content', '',
          'videoUrl', v_m2_video
        ),
        jsonb_build_object(
          'id', 'bwd-m2-image',
          'type', 'image',
          'title', 'CSS logo',
          'imageUrl', 'https://upload.wikimedia.org/wikipedia/commons/d/d5/CSS3_logo_and_wordmark.svg',
          'altText', 'CSS3 logo representing visual styling of web pages',
          'caption', 'CSS controls the presentation of HTML elements including layout, color, typography, and spacing.'
        ),
        jsonb_build_object(
          'id', 'bwd-m2-ref1',
          'type', 'learning_material',
          'title', 'MDN Web Docs: CSS First Steps',
          'url', 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics',
          'content', 'MDN Web Docs guide to CSS covering selectors, the box model, colors, fonts, spacing, and the basics of responsive layout and visual hierarchy.'
        ),
        jsonb_build_object(
          'id', 'bwd-m2-quiz1',
          'type', 'quiz',
          'title', 'Quick check: box model',
          'content', 'Which CSS concept explains the relationship between content, padding, border, and margin?',
          'options', jsonb_build_array(
            'The box model',
            'The DOM tree',
            'The server stack',
            'The URL path'
          ),
          'correctAnswer', 0,
          'explanation', 'The box model defines how element size and spacing are calculated and displayed on the page.'
        ),
        jsonb_build_object(
          'id', 'bwd-m2-quiz2',
          'type', 'quiz',
          'title', 'Quick check: class selectors',
          'content', 'Why are class selectors useful in CSS?',
          'options', jsonb_build_array(
            'They allow reusable styling across multiple elements',
            'They automatically deploy the website',
            'They replace HTML structure entirely',
            'They store JavaScript functions'
          ),
          'correctAnswer', 0,
          'explanation', 'Class selectors help apply consistent design patterns without repeating styling rules on each element.'
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
    SET description = 'Focuses on visual presentation with CSS including selectors, colors, typography, spacing, the box model, and simple responsive layout concepts.',
        "order" = 2,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'bwd-m2-text1',
            'type', 'text',
            'title', 'CSS controls presentation and visual hierarchy',
            'content', $html$<p>Without CSS, HTML pages are functional but visually plain. CSS makes it possible to define colors, font sizes, spacing, alignment, and layout. This improves readability and helps users focus on the most important parts of the page.</p><p>Visual hierarchy matters. A clear heading should stand out from body text. Buttons should look clickable. Content blocks should have enough spacing so the page does not feel crowded. Good styling supports understanding, not just decoration.</p>$html$
          ),
          jsonb_build_object(
            'id', 'bwd-m2-text2',
            'type', 'text',
            'title', 'Selectors help you target the right elements',
            'content', $html$<p>CSS rules apply to elements through selectors. Beginners often start with element selectors such as p or h1, then move into class selectors such as .card or .button. Classes are especially useful because they allow the same styling pattern to be reused across different elements.</p><p>When styles are grouped logically, the page becomes easier to maintain. A class named .hero-title communicates intention more clearly than repeating inline styling across many elements.</p>$html$
          ),
          jsonb_build_object(
            'id', 'bwd-m2-text3',
            'type', 'text',
            'title', 'The box model explains spacing',
            'content', $html$<p>Every visible HTML element can be understood as a box. The box model includes content, padding, border, and margin. Padding creates space inside the box, border wraps around the content and padding, and margin creates space outside the box.</p><p>Many beginner layout problems happen because margin and padding are confused. Once learners understand the box model, page spacing becomes much easier to control.</p>$html$
          ),
          jsonb_build_object(
            'id', 'bwd-m2-video',
            'type', 'video',
            'title', 'CSS Tutorial for Beginners',
            'content', '',
            'videoUrl', v_m2_video
          ),
          jsonb_build_object(
            'id', 'bwd-m2-image',
            'type', 'image',
            'title', 'CSS logo',
            'imageUrl', 'https://upload.wikimedia.org/wikipedia/commons/d/d5/CSS3_logo_and_wordmark.svg',
            'altText', 'CSS3 logo representing visual styling of web pages',
            'caption', 'CSS controls the presentation of HTML elements including layout, color, typography, and spacing.'
          ),
          jsonb_build_object(
            'id', 'bwd-m2-ref1',
            'type', 'learning_material',
            'title', 'MDN Web Docs: CSS First Steps',
            'url', 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics',
            'content', 'MDN Web Docs guide to CSS covering selectors, the box model, colors, fonts, spacing, and the basics of responsive layout and visual hierarchy.'
          ),
          jsonb_build_object(
            'id', 'bwd-m2-quiz1',
            'type', 'quiz',
            'title', 'Quick check: box model',
            'content', 'Which CSS concept explains the relationship between content, padding, border, and margin?',
            'options', jsonb_build_array(
              'The box model',
              'The DOM tree',
              'The server stack',
              'The URL path'
            ),
            'correctAnswer', 0,
            'explanation', 'The box model defines how element size and spacing are calculated and displayed on the page.'
          ),
          jsonb_build_object(
            'id', 'bwd-m2-quiz2',
            'type', 'quiz',
            'title', 'Quick check: class selectors',
            'content', 'Why are class selectors useful in CSS?',
            'options', jsonb_build_array(
              'They allow reusable styling across multiple elements',
              'They automatically deploy the website',
              'They replace HTML structure entirely',
              'They store JavaScript functions'
            ),
            'correctAnswer', 0,
            'explanation', 'Class selectors help apply consistent design patterns without repeating styling rules on each element.'
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
    AND title = 'Adding Interactivity with JavaScript'
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
      'Adding Interactivity with JavaScript',
      'Introduces JavaScript as the language for adding behavior to web pages through variables, conditions, functions, and event handling that responds to user actions.',
      3,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'bwd-m3-text1',
          'type', 'text',
          'title', 'JavaScript brings behavior to the page',
          'content', $html$<p>JavaScript allows a web page to do more than display content. It can react when a user clicks a button, enters text in a form, or opens a menu. This is what makes a website interactive rather than static.</p><p>For beginners, JavaScript is easiest to understand as a way to make decisions and perform actions. The page can check conditions, update text, show messages, or change styles based on what the user does.</p>$html$
        ),
        jsonb_build_object(
          'id', 'bwd-m3-text2',
          'type', 'text',
          'title', 'Variables, conditions, and functions are core building blocks',
          'content', $html$<p>Variables store values such as names, scores, counts, or settings. Conditions allow the code to choose what happens next. Functions group instructions into reusable blocks so the same behavior can be triggered many times without rewriting the code.</p><p>These three ideas appear in almost every JavaScript project. Even simple interactive pages rely on them to keep code organized and predictable.</p>$html$
        ),
        jsonb_build_object(
          'id', 'bwd-m3-text3',
          'type', 'text',
          'title', 'Events connect user actions to code',
          'content', $html$<p>In the browser, events represent actions such as clicks, typing, scrolling, and form submission. JavaScript can listen for these events and run code in response. This is how buttons trigger messages, menus open and close, and validation feedback appears on forms.</p><p>A beginner project may start with one event listener on a button, but the same principle scales to many interactive features in larger applications.</p>$html$
        ),
        jsonb_build_object(
          'id', 'bwd-m3-video',
          'type', 'video',
          'title', 'JavaScript Tutorial for Beginners',
          'content', '',
          'videoUrl', v_m3_video
        ),
        jsonb_build_object(
          'id', 'bwd-m3-image',
          'type', 'image',
          'title', 'JavaScript logo',
          'imageUrl', 'https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png',
          'altText', 'JavaScript logo representing browser-side programming and interactivity',
          'caption', 'JavaScript adds behavior and interactivity to web pages by responding to user events and updating content dynamically.'
        ),
        jsonb_build_object(
          'id', 'bwd-m3-ref1',
          'type', 'learning_material',
          'title', 'MDN Web Docs: JavaScript First Steps',
          'url', 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting',
          'content', 'MDN Web Docs guide to JavaScript covering variables, conditions, functions, events, and DOM manipulation for beginners building their first interactive web pages.'
        ),
        jsonb_build_object(
          'id', 'bwd-m3-quiz1',
          'type', 'quiz',
          'title', 'Quick check: JavaScript role',
          'content', 'What is the primary purpose of JavaScript on a web page?',
          'options', jsonb_build_array(
            'To add behavior and interactivity',
            'To replace all HTML tags',
            'To physically host the website on a server',
            'To define image resolution'
          ),
          'correctAnswer', 0,
          'explanation', 'JavaScript allows the page to react to users and update content dynamically.'
        ),
        jsonb_build_object(
          'id', 'bwd-m3-quiz2',
          'type', 'quiz',
          'title', 'Quick check: event handling',
          'content', 'Which JavaScript concept is used to run code when a user clicks a button?',
          'options', jsonb_build_array(
            'Event handling',
            'DNS routing',
            'File compression',
            'SQL joins'
          ),
          'correctAnswer', 0,
          'explanation', 'Event handling lets JavaScript respond to actions such as clicks, typing, and form submission.'
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
    SET description = 'Introduces JavaScript as the language for adding behavior to web pages through variables, conditions, functions, and event handling that responds to user actions.',
        "order" = 3,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'bwd-m3-text1',
            'type', 'text',
            'title', 'JavaScript brings behavior to the page',
            'content', $html$<p>JavaScript allows a web page to do more than display content. It can react when a user clicks a button, enters text in a form, or opens a menu. This is what makes a website interactive rather than static.</p><p>For beginners, JavaScript is easiest to understand as a way to make decisions and perform actions. The page can check conditions, update text, show messages, or change styles based on what the user does.</p>$html$
          ),
          jsonb_build_object(
            'id', 'bwd-m3-text2',
            'type', 'text',
            'title', 'Variables, conditions, and functions are core building blocks',
            'content', $html$<p>Variables store values such as names, scores, counts, or settings. Conditions allow the code to choose what happens next. Functions group instructions into reusable blocks so the same behavior can be triggered many times without rewriting the code.</p><p>These three ideas appear in almost every JavaScript project. Even simple interactive pages rely on them to keep code organized and predictable.</p>$html$
          ),
          jsonb_build_object(
            'id', 'bwd-m3-text3',
            'type', 'text',
            'title', 'Events connect user actions to code',
            'content', $html$<p>In the browser, events represent actions such as clicks, typing, scrolling, and form submission. JavaScript can listen for these events and run code in response. This is how buttons trigger messages, menus open and close, and validation feedback appears on forms.</p><p>A beginner project may start with one event listener on a button, but the same principle scales to many interactive features in larger applications.</p>$html$
          ),
          jsonb_build_object(
            'id', 'bwd-m3-video',
            'type', 'video',
            'title', 'JavaScript Tutorial for Beginners',
            'content', '',
            'videoUrl', v_m3_video
          ),
          jsonb_build_object(
            'id', 'bwd-m3-image',
            'type', 'image',
            'title', 'JavaScript logo',
            'imageUrl', 'https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png',
            'altText', 'JavaScript logo representing browser-side programming and interactivity',
            'caption', 'JavaScript adds behavior and interactivity to web pages by responding to user events and updating content dynamically.'
          ),
          jsonb_build_object(
            'id', 'bwd-m3-ref1',
            'type', 'learning_material',
            'title', 'MDN Web Docs: JavaScript First Steps',
            'url', 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting',
            'content', 'MDN Web Docs guide to JavaScript covering variables, conditions, functions, events, and DOM manipulation for beginners building their first interactive web pages.'
          ),
          jsonb_build_object(
            'id', 'bwd-m3-quiz1',
            'type', 'quiz',
            'title', 'Quick check: JavaScript role',
            'content', 'What is the primary purpose of JavaScript on a web page?',
            'options', jsonb_build_array(
              'To add behavior and interactivity',
              'To replace all HTML tags',
              'To physically host the website on a server',
              'To define image resolution'
            ),
            'correctAnswer', 0,
            'explanation', 'JavaScript allows the page to react to users and update content dynamically.'
          ),
          jsonb_build_object(
            'id', 'bwd-m3-quiz2',
            'type', 'quiz',
            'title', 'Quick check: event handling',
            'content', 'Which JavaScript concept is used to run code when a user clicks a button?',
            'options', jsonb_build_array(
              'Event handling',
              'DNS routing',
              'File compression',
              'SQL joins'
            ),
            'correctAnswer', 0,
            'explanation', 'Event handling lets JavaScript respond to actions such as clicks, typing, and form submission.'
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
    AND title = 'Basic Web Development Foundations Final Assessment'
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
    quote_literal('Basic Web Development Foundations Final Assessment') || ', ' ||
    quote_literal('Measure the learner''s understanding of core HTML, CSS, and JavaScript concepts needed to build and explain a simple beginner web page.') || ', ' ||
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
      'description = ' || quote_literal('Measure the learner''s understanding of core HTML, CSS, and JavaScript concepts needed to build and explain a simple beginner web page.') || ', ' ||
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
      'Which technology is mainly responsible for structuring content on a web page?',
      'multiple_choice',
      jsonb_build_array('HTML', 'CSS', 'Java', 'Photoshop'),
      'HTML',
      2,
      1,
      'HTML provides the structure and meaning of web page content.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'True or false: CSS is used primarily to control the visual appearance of a page.',
      'true_false',
      NULL,
      'true',
      1,
      2,
      'CSS is responsible for presentation such as colors, spacing, typography, and layout.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which HTML element is most appropriate for the main content area of a page?',
      'multiple_choice',
      jsonb_build_array('main', 'blink', 'font', 'center'),
      'main',
      2,
      3,
      'The main element is a semantic container intended for the primary page content.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'What does the CSS box model include?',
      'multiple_choice',
      jsonb_build_array(
        'Content, padding, border, and margin',
        'Header, nav, article, and footer',
        'Server, browser, cache, and router',
        'Variable, loop, array, and object'
      ),
      'Content, padding, border, and margin',
      2,
      4,
      'These are the four key parts used to understand element sizing and spacing.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which CSS selector is commonly used to style multiple elements with the same design pattern?',
      'multiple_choice',
      jsonb_build_array(
        'Class selector',
        'Database selector',
        'Terminal selector',
        'Browser history selector'
      ),
      'Class selector',
      2,
      5,
      'Classes are reusable and help apply consistent styles across many elements.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'True or false: JavaScript can respond to a button click in the browser.',
      'true_false',
      NULL,
      'true',
      1,
      6,
      'JavaScript uses event handling to run code in response to user actions such as button clicks.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which JavaScript feature is used to store a value for later use?',
      'multiple_choice',
      jsonb_build_array('Variable', 'Border', 'Heading', 'Hyperlink'),
      'Variable',
      2,
      7,
      'Variables store values such as names, numbers, or text so the program can use them later.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'A beginner wants to change the text color of all paragraph elements on a page. Which technology should be used?',
      'multiple_choice',
      jsonb_build_array('CSS', 'HTML only', 'DNS', 'SQL'),
      'CSS',
      2,
      8,
      'CSS controls presentation and is the correct tool for changing text color.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which statement best describes semantic HTML?',
      'multiple_choice',
      jsonb_build_array(
        'It uses meaningful elements that describe the purpose of content',
        'It removes the need for CSS completely',
        'It stores backend business logic in the browser',
        'It prevents all accessibility issues automatically'
      ),
      'It uses meaningful elements that describe the purpose of content',
      2,
      9,
      'Semantic HTML makes the structure clearer for developers, browsers, and assistive technologies.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which combination correctly matches the role of each core front-end technology?',
      'multiple_choice',
      jsonb_build_array(
        'HTML for structure, CSS for style, JavaScript for behavior',
        'HTML for style, CSS for hosting, JavaScript for page titles',
        'HTML for databases, CSS for APIs, JavaScript for images',
        'HTML for passwords, CSS for servers, JavaScript for storage'
      ),
      'HTML for structure, CSS for style, JavaScript for behavior',
      2,
      10,
      'This is the basic and correct division of responsibility in front-end web development.',
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
