-- Seed content for the course:
-- Advanced Web Development Engineering
--
-- What this script does:
--
-- - Creates or updates a complete Advanced Web Development Engineering course using an existing trainer/admin/SPD user as instructor.
-- - Upserts 3 finalized modules with text, YouTube video, image, learning material, and quiz blocks.
-- - Upserts 1 standalone graded course assessment.
-- - Rewrites assessment questions on every run so the seed stays deterministic.

DO $seed$
DECLARE
  v_course_title text := 'Advanced Web Development Engineering';
  v_course_id uuid;
  v_instructor_id uuid;
  v_now timestamptz := timezone('utc', now());

  v_module_1_id uuid;
  v_module_2_id uuid;
  v_module_3_id uuid;

  v_assessment_id uuid;

  v_m1_video text := 'https://www.youtube.com/watch?v=sDlCSIDwpDs';
  v_m2_video text := 'https://www.youtube.com/watch?v=Qwb-Za6cBws';
  v_m3_video text := 'https://www.youtube.com/watch?v=DYme1m4RiwI';

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
      quote_literal('A production-focused course that helps experienced learners design, optimize, secure, and deliver modern web applications using practical engineering patterns across the frontend, backend, and deployment lifecycle.') || ', ' ||
      quote_literal('Information Technology') || ', ' ||
      quote_literal('Advanced') || ', ' ||
      '20, ' ||
      quote_literal(v_instructor_id);

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', ' || quote_literal('general_public');
    END IF;

    v_sql := v_sql || ', ' ||
      quote_literal('/images/course-tech.svg') || ', ' ||
      'false, ' ||
      'ARRAY[' ||
        quote_literal('Web Architecture') || ', ' ||
        quote_literal('Frontend Performance') || ', ' ||
        quote_literal('API Security') || ', ' ||
        quote_literal('CI/CD') || ', ' ||
        quote_literal('Observability') || ']::text[]';

    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('Web Architecture') || ', ' ||
        quote_literal('Frontend Performance') || ', ' ||
        quote_literal('API Security') || ', ' ||
        quote_literal('CI/CD') || ', ' ||
        quote_literal('Observability') || ']::text[]';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('Advanced Web Development') || ', ' ||
        quote_literal('Full-Stack Engineering') || ', ' ||
        quote_literal('Performance Optimization') || ', ' ||
        quote_literal('Secure Deployment') || ']::text[]';
    END IF;
    IF v_has_course_industry_tags THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('information-technology') || ', ' ||
        quote_literal('software-development') || ', ' ||
        quote_literal('digital-services') || ']::text[]';
    END IF;
    IF v_has_course_career_paths THEN
      v_sql := v_sql || ', ARRAY[' ||
        quote_literal('frontend-developer') || ', ' ||
        quote_literal('full-stack-developer') || ', ' ||
        quote_literal('web-application-engineer') || ']::text[]';
    END IF;

    v_sql := v_sql || ', 0, 4.8, ' || quote_literal('completion') || ', true, ' ||
      quote_literal(v_now) || ', ' || quote_literal(v_now) || ') RETURNING id';

    EXECUTE v_sql INTO v_course_id;
  ELSE
    v_sql := 'UPDATE public.courses SET ' ||
      'description = ' || quote_literal('A production-focused course that helps experienced learners design, optimize, secure, and deliver modern web applications using practical engineering patterns across the frontend, backend, and deployment lifecycle.') || ', ' ||
      'category = ' || quote_literal('Information Technology') || ', ' ||
      'level = ' || quote_literal('Advanced') || ', ' ||
      'duration = 20, ' ||
      'instructor_id = ' || quote_literal(v_instructor_id);

    IF v_has_course_trainee_audience THEN
      v_sql := v_sql || ', trainee_audience = ' || quote_literal('general_public');
    END IF;

    v_sql := v_sql || ', thumbnail = ' || quote_literal('/images/course-tech.svg') ||
      ', is_tesda_accredited = false' ||
      ', skills = ARRAY[' ||
        quote_literal('Web Architecture') || ', ' ||
        quote_literal('Frontend Performance') || ', ' ||
        quote_literal('API Security') || ', ' ||
        quote_literal('CI/CD') || ', ' ||
        quote_literal('Observability') || ']::text[]';

    IF v_has_course_skill_tags THEN
      v_sql := v_sql || ', skill_tags = ARRAY[' ||
        quote_literal('Web Architecture') || ', ' ||
        quote_literal('Frontend Performance') || ', ' ||
        quote_literal('API Security') || ', ' ||
        quote_literal('CI/CD') || ', ' ||
        quote_literal('Observability') || ']::text[]';
    END IF;
    IF v_has_course_topic_tags THEN
      v_sql := v_sql || ', topic_tags = ARRAY[' ||
        quote_literal('Advanced Web Development') || ', ' ||
        quote_literal('Full-Stack Engineering') || ', ' ||
        quote_literal('Performance Optimization') || ', ' ||
        quote_literal('Secure Deployment') || ']::text[]';
    END IF;
    IF v_has_course_industry_tags THEN
      v_sql := v_sql || ', industry_tags = ARRAY[' ||
        quote_literal('information-technology') || ', ' ||
        quote_literal('software-development') || ', ' ||
        quote_literal('digital-services') || ']::text[]';
    END IF;
    IF v_has_course_career_paths THEN
      v_sql := v_sql || ', career_paths = ARRAY[' ||
        quote_literal('frontend-developer') || ', ' ||
        quote_literal('full-stack-developer') || ', ' ||
        quote_literal('web-application-engineer') || ']::text[]';
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

  -- ------------------------------------------------------------------ Module 1
  SELECT id
  INTO v_module_1_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Web Application Architecture and Scalable Frontend Systems'
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
      'Web Application Architecture and Scalable Frontend Systems',
      'Establishes the architectural thinking required to organize advanced web applications into clear layers, reusable components, and maintainable delivery boundaries.',
      1,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'awd-m1-text1',
          'type', 'text',
          'title', 'Designing for maintainability before scale becomes a problem',
          'content', $html$<p>Advanced web development begins with boundaries. Teams move faster when UI components are predictable, shared logic is centralized, state transitions are explicit, and backend communication is handled consistently. Instead of letting routing, rendering, data fetching, and business rules mix freely inside pages, mature systems isolate concerns so features can evolve without causing widespread regressions.</p>$html$
        ),
        jsonb_build_object(
          'id', 'awd-m1-text2',
          'type', 'text',
          'title', 'Component architecture and rendering strategies',
          'content', $html$<p>A well-structured frontend separates presentation components from state logic and data access. This separation makes individual pieces testable, replaceable, and understandable in isolation. It also reduces the risk of one change breaking unrelated features.</p><p>Choosing the right rendering strategy matters for both performance and developer experience. Client-side rendering works well for highly interactive interfaces. Server-side rendering improves initial load time and SEO. Hybrid approaches combine both benefits with tradeoffs in build complexity and infrastructure requirements.</p>$html$
        ),
        jsonb_build_object(
          'id', 'awd-m1-text3',
          'type', 'text',
          'title', 'Frontend boundaries that support team scale',
          'content', $html$<p>As a codebase grows, shared conventions become more valuable than individual optimization. A design system, shared component library, and consistent data access layer help multiple contributors work without constantly conflicting or duplicating effort.</p><p>Documenting these boundaries early, enforcing them through tooling, and reviewing them regularly keeps the architecture useful rather than hypothetical. The goal is not complexity but predictability: every developer should know where logic belongs.</p>$html$
        ),
        jsonb_build_object(
          'id', 'awd-m1-video',
          'type', 'video',
          'title', 'Web application architecture overview',
          'content', '',
          'videoUrl', v_m1_video
        ),
        jsonb_build_object(
          'id', 'awd-m1-image',
          'type', 'image',
          'title', 'Layered web application blueprint',
          'imageUrl', 'https://picsum.photos/seed/advanced-web-development-m1/1200/675',
          'altText', 'Diagram-inspired image representing layered frontend and backend web application architecture',
          'caption', 'A layered architecture helps teams reason about component ownership, state flow, data access, and future scaling decisions.'
        ),
        jsonb_build_object(
          'id', 'awd-m1-ref1',
          'type', 'learning_material',
          'title', 'web.dev: Modern Web Architecture',
          'url', 'https://web.dev/learn',
          'content', 'Supplemental reading on modern web platform capabilities, rendering strategies, architecture choices, and maintainable implementation patterns.'
        ),
        jsonb_build_object(
          'id', 'awd-m1-quiz1',
          'type', 'quiz',
          'title', 'Quick check: architecture',
          'content', 'Which architectural practice most improves long-term maintainability in a large web application?',
          'options', jsonb_build_array(
            'Keeping routing, API calls, and presentation logic in a single component for convenience',
            'Separating UI rendering, state logic, and data access into distinct responsibilities',
            'Avoiding shared conventions so each developer can organize code differently',
            'Rebuilding common components separately in each feature area'
          ),
          'correctAnswer', 1,
          'explanation', 'Clear boundaries reduce coupling and make features easier to debug, test, and extend.'
        ),
        jsonb_build_object(
          'id', 'awd-m1-quiz2',
          'type', 'quiz',
          'title', 'Quick check: rendering strategies',
          'content', 'True or false: Server-side rendering and client-side rendering always solve the same problem in the same way.',
          'options', jsonb_build_array(
            'True',
            'False'
          ),
          'correctAnswer', 1,
          'explanation', 'They differ in performance characteristics, SEO behavior, hydration cost, and infrastructure requirements.'
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
    SET description = 'Establishes the architectural thinking required to organize advanced web applications into clear layers, reusable components, and maintainable delivery boundaries.',
        "order" = 1,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'awd-m1-text1',
            'type', 'text',
            'title', 'Designing for maintainability before scale becomes a problem',
            'content', $html$<p>Advanced web development begins with boundaries. Teams move faster when UI components are predictable, shared logic is centralized, state transitions are explicit, and backend communication is handled consistently. Instead of letting routing, rendering, data fetching, and business rules mix freely inside pages, mature systems isolate concerns so features can evolve without causing widespread regressions.</p>$html$
          ),
          jsonb_build_object(
            'id', 'awd-m1-text2',
            'type', 'text',
            'title', 'Component architecture and rendering strategies',
            'content', $html$<p>A well-structured frontend separates presentation components from state logic and data access. This separation makes individual pieces testable, replaceable, and understandable in isolation. It also reduces the risk of one change breaking unrelated features.</p><p>Choosing the right rendering strategy matters for both performance and developer experience. Client-side rendering works well for highly interactive interfaces. Server-side rendering improves initial load time and SEO. Hybrid approaches combine both benefits with tradeoffs in build complexity and infrastructure requirements.</p>$html$
          ),
          jsonb_build_object(
            'id', 'awd-m1-text3',
            'type', 'text',
            'title', 'Frontend boundaries that support team scale',
            'content', $html$<p>As a codebase grows, shared conventions become more valuable than individual optimization. A design system, shared component library, and consistent data access layer help multiple contributors work without constantly conflicting or duplicating effort.</p><p>Documenting these boundaries early, enforcing them through tooling, and reviewing them regularly keeps the architecture useful rather than hypothetical. The goal is not complexity but predictability: every developer should know where logic belongs.</p>$html$
          ),
          jsonb_build_object(
            'id', 'awd-m1-video',
            'type', 'video',
            'title', 'Web application architecture overview',
            'content', '',
            'videoUrl', v_m1_video
          ),
          jsonb_build_object(
            'id', 'awd-m1-image',
            'type', 'image',
            'title', 'Layered web application blueprint',
            'imageUrl', 'https://picsum.photos/seed/advanced-web-development-m1/1200/675',
            'altText', 'Diagram-inspired image representing layered frontend and backend web application architecture',
            'caption', 'A layered architecture helps teams reason about component ownership, state flow, data access, and future scaling decisions.'
          ),
          jsonb_build_object(
            'id', 'awd-m1-ref1',
            'type', 'learning_material',
            'title', 'web.dev: Modern Web Architecture',
            'url', 'https://web.dev/learn',
            'content', 'Supplemental reading on modern web platform capabilities, rendering strategies, architecture choices, and maintainable implementation patterns.'
          ),
          jsonb_build_object(
            'id', 'awd-m1-quiz1',
            'type', 'quiz',
            'title', 'Quick check: architecture',
            'content', 'Which architectural practice most improves long-term maintainability in a large web application?',
            'options', jsonb_build_array(
              'Keeping routing, API calls, and presentation logic in a single component for convenience',
              'Separating UI rendering, state logic, and data access into distinct responsibilities',
              'Avoiding shared conventions so each developer can organize code differently',
              'Rebuilding common components separately in each feature area'
            ),
            'correctAnswer', 1,
            'explanation', 'Clear boundaries reduce coupling and make features easier to debug, test, and extend.'
          ),
          jsonb_build_object(
            'id', 'awd-m1-quiz2',
            'type', 'quiz',
            'title', 'Quick check: rendering strategies',
            'content', 'True or false: Server-side rendering and client-side rendering always solve the same problem in the same way.',
            'options', jsonb_build_array(
              'True',
              'False'
            ),
            'correctAnswer', 1,
            'explanation', 'They differ in performance characteristics, SEO behavior, hydration cost, and infrastructure requirements.'
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
    AND title = 'Performance Engineering for Interactive Web Applications'
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
      'Performance Engineering for Interactive Web Applications',
      'Teaches learners how to analyze and optimize loading, rendering, and runtime behavior so advanced web experiences remain fast under real user conditions.',
      2,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'awd-m2-text1',
          'type', 'text',
          'title', 'Performance is an engineering discipline, not a final polish step',
          'content', $html$<p>Fast applications are designed, measured, and protected continuously. Mature teams track loading cost, identify avoidable re-renders, defer low-priority work, lazy-load heavy modules, compress and cache assets, and monitor real user signals after release. Performance work is most effective when developers connect interface behavior to actual browser work such as scripting, layout, painting, network transfer, and hydration.</p>$html$
        ),
        jsonb_build_object(
          'id', 'awd-m2-text2',
          'type', 'text',
          'title', 'Measuring and improving rendering behavior',
          'content', $html$<p>React and other frameworks re-render components when state or props change. Not all re-renders are expensive, but unnecessary ones across many components add up. Identifying hot paths through profiling, memoizing stable values, reducing state scope, and batching updates are common strategies for reducing rendering waste.</p><p>Code splitting and lazy loading address the initial load problem differently. When routes and heavy dependencies are split into separate bundles loaded on demand, browsers do less work upfront and users see content faster.</p>$html$
        ),
        jsonb_build_object(
          'id', 'awd-m2-text3',
          'type', 'text',
          'title', 'Asset delivery and real user monitoring',
          'content', $html$<p>Images, fonts, and third-party scripts are common performance bottlenecks. Serving appropriately sized images, using modern formats, applying lazy loading, limiting third-party scripts, and enabling caching all reduce data transfer and rendering delay.</p><p>Real user monitoring captures performance from actual user sessions rather than simulated tests. Metrics such as Largest Contentful Paint, Interaction to Next Paint, and Cumulative Layout Shift reflect the experience of real visitors and guide optimization priorities.</p>$html$
        ),
        jsonb_build_object(
          'id', 'awd-m2-video',
          'type', 'video',
          'title', 'React performance optimization techniques',
          'content', '',
          'videoUrl', v_m2_video
        ),
        jsonb_build_object(
          'id', 'awd-m2-image',
          'type', 'image',
          'title', 'Performance dashboard and optimization workflow',
          'imageUrl', 'https://picsum.photos/seed/advanced-web-development-m2/1200/675',
          'altText', 'Illustration representing performance dashboards, charts, and optimization checkpoints for a web application',
          'caption', 'Strong performance work combines profiling, measurement, prioritization, and verification after each optimization step.'
        ),
        jsonb_build_object(
          'id', 'awd-m2-ref1',
          'type', 'learning_material',
          'title', 'web.dev: Performance',
          'url', 'https://web.dev/performance/',
          'content', 'Supplemental reading on Core Web Vitals, rendering performance, code delivery, and browser-level techniques for faster applications.'
        ),
        jsonb_build_object(
          'id', 'awd-m2-quiz1',
          'type', 'quiz',
          'title', 'Quick check: code splitting',
          'content', 'Which action is most likely to reduce initial JavaScript cost for users?',
          'options', jsonb_build_array(
            'Loading every route and feature bundle during the first page request',
            'Using code splitting so only required code is loaded initially',
            'Moving CSS into larger files without compression',
            'Rendering additional hidden components for future use'
          ),
          'correctAnswer', 1,
          'explanation', 'Code splitting reduces the amount of JavaScript the browser must download, parse, and execute on first load.'
        ),
        jsonb_build_object(
          'id', 'awd-m2-quiz2',
          'type', 'quiz',
          'title', 'Quick check: re-renders',
          'content', 'A component that re-renders often is automatically a performance problem even if the work is trivial. True or false?',
          'options', jsonb_build_array(
            'True',
            'False'
          ),
          'correctAnswer', 1,
          'explanation', 'Re-render frequency matters, but cost and user impact determine whether it is a meaningful issue.'
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
    SET description = 'Teaches learners how to analyze and optimize loading, rendering, and runtime behavior so advanced web experiences remain fast under real user conditions.',
        "order" = 2,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'awd-m2-text1',
            'type', 'text',
            'title', 'Performance is an engineering discipline, not a final polish step',
            'content', $html$<p>Fast applications are designed, measured, and protected continuously. Mature teams track loading cost, identify avoidable re-renders, defer low-priority work, lazy-load heavy modules, compress and cache assets, and monitor real user signals after release. Performance work is most effective when developers connect interface behavior to actual browser work such as scripting, layout, painting, network transfer, and hydration.</p>$html$
          ),
          jsonb_build_object(
            'id', 'awd-m2-text2',
            'type', 'text',
            'title', 'Measuring and improving rendering behavior',
            'content', $html$<p>React and other frameworks re-render components when state or props change. Not all re-renders are expensive, but unnecessary ones across many components add up. Identifying hot paths through profiling, memoizing stable values, reducing state scope, and batching updates are common strategies for reducing rendering waste.</p><p>Code splitting and lazy loading address the initial load problem differently. When routes and heavy dependencies are split into separate bundles loaded on demand, browsers do less work upfront and users see content faster.</p>$html$
          ),
          jsonb_build_object(
            'id', 'awd-m2-text3',
            'type', 'text',
            'title', 'Asset delivery and real user monitoring',
            'content', $html$<p>Images, fonts, and third-party scripts are common performance bottlenecks. Serving appropriately sized images, using modern formats, applying lazy loading, limiting third-party scripts, and enabling caching all reduce data transfer and rendering delay.</p><p>Real user monitoring captures performance from actual user sessions rather than simulated tests. Metrics such as Largest Contentful Paint, Interaction to Next Paint, and Cumulative Layout Shift reflect the experience of real visitors and guide optimization priorities.</p>$html$
          ),
          jsonb_build_object(
            'id', 'awd-m2-video',
            'type', 'video',
            'title', 'React performance optimization techniques',
            'content', '',
            'videoUrl', v_m2_video
          ),
          jsonb_build_object(
            'id', 'awd-m2-image',
            'type', 'image',
            'title', 'Performance dashboard and optimization workflow',
            'imageUrl', 'https://picsum.photos/seed/advanced-web-development-m2/1200/675',
            'altText', 'Illustration representing performance dashboards, charts, and optimization checkpoints for a web application',
            'caption', 'Strong performance work combines profiling, measurement, prioritization, and verification after each optimization step.'
          ),
          jsonb_build_object(
            'id', 'awd-m2-ref1',
            'type', 'learning_material',
            'title', 'web.dev: Performance',
            'url', 'https://web.dev/performance/',
            'content', 'Supplemental reading on Core Web Vitals, rendering performance, code delivery, and browser-level techniques for faster applications.'
          ),
          jsonb_build_object(
            'id', 'awd-m2-quiz1',
            'type', 'quiz',
            'title', 'Quick check: code splitting',
            'content', 'Which action is most likely to reduce initial JavaScript cost for users?',
            'options', jsonb_build_array(
              'Loading every route and feature bundle during the first page request',
              'Using code splitting so only required code is loaded initially',
              'Moving CSS into larger files without compression',
              'Rendering additional hidden components for future use'
            ),
            'correctAnswer', 1,
            'explanation', 'Code splitting reduces the amount of JavaScript the browser must download, parse, and execute on first load.'
          ),
          jsonb_build_object(
            'id', 'awd-m2-quiz2',
            'type', 'quiz',
            'title', 'Quick check: re-renders',
            'content', 'A component that re-renders often is automatically a performance problem even if the work is trivial. True or false?',
            'options', jsonb_build_array(
              'True',
              'False'
            ),
            'correctAnswer', 1,
            'explanation', 'Re-render frequency matters, but cost and user impact determine whether it is a meaningful issue.'
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
    AND title = 'Secure Backend APIs, Authentication, and Data Integrity'
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
      'Secure Backend APIs, Authentication, and Data Integrity',
      'Develops the learner''s ability to protect modern web applications through practical API security, safer authentication flows, and disciplined validation of user-controlled input.',
      3,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'awd-m3-text1',
          'type', 'text',
          'title', 'Secure systems assume the client can fail, break, or be abused',
          'content', $html$<p>Advanced web applications cannot rely on frontend checks alone. Backend services must verify identity, authorize each sensitive action, validate all inbound data, normalize inputs, log important events, and protect against replay, brute force, and excessive request volume. Security improves when teams treat trust as something earned per request rather than inherited from the interface.</p>$html$
        ),
        jsonb_build_object(
          'id', 'awd-m3-text2',
          'type', 'text',
          'title', 'Authentication, authorization, and validation layers',
          'content', $html$<p>Authentication confirms who the user is. Authorization decides what that user is allowed to do. Both must operate on the server side. A client-side check may hide a button from unauthorized users but never prevents a determined actor from sending the same request directly.</p><p>Input validation and normalization belong at every entry point. Strict schemas, sanitized values, allowed-list patterns, and consistent error responses all reduce the attack surface of an API. These controls are most effective when applied consistently as part of request handling middleware.</p>$html$
        ),
        jsonb_build_object(
          'id', 'awd-m3-text3',
          'type', 'text',
          'title', 'Rate limiting, logging, and safe error handling',
          'content', $html$<p>Rate limiting prevents abusive traffic from overwhelming a service or enabling brute-force attacks. Logging provides the audit trail needed to investigate incidents and understand normal versus abnormal request patterns. Safe error handling avoids leaking implementation details such as stack traces, schema names, or file paths to the client.</p><p>Together these controls form a layered defense. No single control eliminates all risk, but combining validation, authorization, rate limiting, and observability makes exploitation significantly harder and detection significantly faster.</p>$html$
        ),
        jsonb_build_object(
          'id', 'awd-m3-video',
          'type', 'video',
          'title', 'Node.js API security best practices',
          'content', '',
          'videoUrl', v_m3_video
        ),
        jsonb_build_object(
          'id', 'awd-m3-image',
          'type', 'image',
          'title', 'Secure API request flow',
          'imageUrl', 'https://picsum.photos/seed/advanced-web-development-m3/1200/675',
          'altText', 'Visual representation of a secure API request lifecycle with authentication, validation, and authorization checks',
          'caption', 'Secure request processing adds checkpoints for identity, permissions, validation, logging, and safe failure handling.'
        ),
        jsonb_build_object(
          'id', 'awd-m3-ref1',
          'type', 'learning_material',
          'title', 'OWASP API Security Top 10',
          'url', 'https://owasp.org/API-Security/',
          'content', 'Supplemental reading on practical API security risks and the controls teams should apply to reduce exposure in production systems.'
        ),
        jsonb_build_object(
          'id', 'awd-m3-quiz1',
          'type', 'quiz',
          'title', 'Quick check: access control',
          'content', 'Which control most directly reduces the risk of unauthorized users accessing another user''s data?',
          'options', jsonb_build_array(
            'Increasing image compression on the frontend',
            'Enforcing server-side authorization checks for every protected resource',
            'Renaming database tables more clearly',
            'Disabling application logs in production'
          ),
          'correctAnswer', 1,
          'explanation', 'Broken access control is prevented by verifying permissions on the server for each sensitive operation.'
        ),
        jsonb_build_object(
          'id', 'awd-m3-quiz2',
          'type', 'quiz',
          'title', 'Quick check: backend validation',
          'content', 'If the frontend form validates user input, the backend can safely skip validation for the same fields. True or false?',
          'options', jsonb_build_array(
            'True',
            'False'
          ),
          'correctAnswer', 1,
          'explanation', 'Backend validation remains essential because clients can be bypassed, modified, or automated.'
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
    SET description = 'Develops the learner''s ability to protect modern web applications through practical API security, safer authentication flows, and disciplined validation of user-controlled input.',
        "order" = 3,
        content = jsonb_build_array(
          jsonb_build_object(
            'id', 'awd-m3-text1',
            'type', 'text',
            'title', 'Secure systems assume the client can fail, break, or be abused',
            'content', $html$<p>Advanced web applications cannot rely on frontend checks alone. Backend services must verify identity, authorize each sensitive action, validate all inbound data, normalize inputs, log important events, and protect against replay, brute force, and excessive request volume. Security improves when teams treat trust as something earned per request rather than inherited from the interface.</p>$html$
          ),
          jsonb_build_object(
            'id', 'awd-m3-text2',
            'type', 'text',
            'title', 'Authentication, authorization, and validation layers',
            'content', $html$<p>Authentication confirms who the user is. Authorization decides what that user is allowed to do. Both must operate on the server side. A client-side check may hide a button from unauthorized users but never prevents a determined actor from sending the same request directly.</p><p>Input validation and normalization belong at every entry point. Strict schemas, sanitized values, allowed-list patterns, and consistent error responses all reduce the attack surface of an API. These controls are most effective when applied consistently as part of request handling middleware.</p>$html$
          ),
          jsonb_build_object(
            'id', 'awd-m3-text3',
            'type', 'text',
            'title', 'Rate limiting, logging, and safe error handling',
            'content', $html$<p>Rate limiting prevents abusive traffic from overwhelming a service or enabling brute-force attacks. Logging provides the audit trail needed to investigate incidents and understand normal versus abnormal request patterns. Safe error handling avoids leaking implementation details such as stack traces, schema names, or file paths to the client.</p><p>Together these controls form a layered defense. No single control eliminates all risk, but combining validation, authorization, rate limiting, and observability makes exploitation significantly harder and detection significantly faster.</p>$html$
          ),
          jsonb_build_object(
            'id', 'awd-m3-video',
            'type', 'video',
            'title', 'Node.js API security best practices',
            'content', '',
            'videoUrl', v_m3_video
          ),
          jsonb_build_object(
            'id', 'awd-m3-image',
            'type', 'image',
            'title', 'Secure API request flow',
            'imageUrl', 'https://picsum.photos/seed/advanced-web-development-m3/1200/675',
            'altText', 'Visual representation of a secure API request lifecycle with authentication, validation, and authorization checks',
            'caption', 'Secure request processing adds checkpoints for identity, permissions, validation, logging, and safe failure handling.'
          ),
          jsonb_build_object(
            'id', 'awd-m3-ref1',
            'type', 'learning_material',
            'title', 'OWASP API Security Top 10',
            'url', 'https://owasp.org/API-Security/',
            'content', 'Supplemental reading on practical API security risks and the controls teams should apply to reduce exposure in production systems.'
          ),
          jsonb_build_object(
            'id', 'awd-m3-quiz1',
            'type', 'quiz',
            'title', 'Quick check: access control',
            'content', 'Which control most directly reduces the risk of unauthorized users accessing another user''s data?',
            'options', jsonb_build_array(
              'Increasing image compression on the frontend',
              'Enforcing server-side authorization checks for every protected resource',
              'Renaming database tables more clearly',
              'Disabling application logs in production'
            ),
            'correctAnswer', 1,
            'explanation', 'Broken access control is prevented by verifying permissions on the server for each sensitive operation.'
          ),
          jsonb_build_object(
            'id', 'awd-m3-quiz2',
            'type', 'quiz',
            'title', 'Quick check: backend validation',
            'content', 'If the frontend form validates user input, the backend can safely skip validation for the same fields. True or false?',
            'options', jsonb_build_array(
              'True',
              'False'
            ),
            'correctAnswer', 1,
            'explanation', 'Backend validation remains essential because clients can be bypassed, modified, or automated.'
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
    AND title = 'Advanced Web Development Engineering Final Assessment'
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
    quote_literal('Advanced Web Development Engineering Final Assessment') || ', ' ||
    quote_literal('Measure the learner''s understanding of web application architecture, performance optimization, API security, and production delivery practices.') || ', ' ||
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
      'description = ' || quote_literal('Measure the learner''s understanding of web application architecture, performance optimization, API security, and production delivery practices.') || ', ' ||
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
      'Which statement best reflects an advanced web development mindset?',
      'multiple_choice',
      jsonb_build_array(
        'Finishing the interface quickly and delaying architecture until failures happen',
        'Building features with clear architecture, measurable performance, secure defaults, and reliable delivery practices',
        'Prioritizing visual polish over maintainability and observability',
        'Treating deployment as a separate concern unrelated to product quality'
      ),
      'Building features with clear architecture, measurable performance, secure defaults, and reliable delivery practices',
      2,
      1,
      'Advanced practice connects implementation quality with maintainability, security, and operational reliability.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which architectural choice most helps a frontend codebase scale across multiple contributors?',
      'multiple_choice',
      jsonb_build_array(
        'Storing business rules directly inside styling files',
        'Separating shared components, feature logic, and data access concerns',
        'Allowing each page to invent its own state conventions without guidance',
        'Avoiding reusable modules to reduce abstraction'
      ),
      'Separating shared components, feature logic, and data access concerns',
      2,
      2,
      'Clear separation of responsibilities reduces coupling and makes collaborative maintenance more predictable.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'True or false: Code splitting can improve initial load performance when applied thoughtfully.',
      'true_false',
      NULL,
      'true',
      1,
      3,
      'Loading only the code needed for the current route or interaction can reduce startup cost.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'True or false: API security is complete once a user is authenticated successfully.',
      'true_false',
      NULL,
      'false',
      1,
      4,
      'Secure systems also require authorization, validation, monitoring, rate limiting, and safe error handling.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which action is most likely to reduce initial JavaScript cost for users?',
      'multiple_choice',
      jsonb_build_array(
        'Loading every route and feature bundle during the first page request',
        'Using code splitting so only required code is loaded initially',
        'Moving CSS into larger files without compression',
        'Disabling all third-party scripts permanently'
      ),
      'Using code splitting so only required code is loaded initially',
      2,
      5,
      'Code splitting reduces the amount of JavaScript the browser must download, parse, and execute on first load.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which practice best protects a backend endpoint that updates sensitive user data?',
      'multiple_choice',
      jsonb_build_array(
        'Trusting the frontend to hide the endpoint from unauthorized users',
        'Enforcing authentication, authorization, and server-side validation on the request',
        'Logging the request only after the update is completed without any validation',
        'Returning detailed stack traces to the client for easier debugging'
      ),
      'Enforcing authentication, authorization, and server-side validation on the request',
      2,
      6,
      'Sensitive endpoints require layered protections before a state-changing operation is allowed.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which post-release signal is most useful for detecting a production regression quickly?',
      'multiple_choice',
      jsonb_build_array(
        'The number of comments in the code review',
        'A dashboard showing rising error rates and slower response times',
        'The number of folders in the source repository',
        'The color of the deployment badge in project documentation'
      ),
      'A dashboard showing rising error rates and slower response times',
      2,
      7,
      'Operational metrics provide immediate evidence about real system behavior after release.',
      false,
      true,
      v_now
    ),
    (
      v_assessment_id,
      'Which set of controls forms a layered defense for a production API?',
      'multiple_choice',
      jsonb_build_array(
        'Authentication only on login endpoints',
        'Authentication, authorization, input validation, rate limiting, and logging applied consistently',
        'Frontend form validation with no backend checks',
        'Strong passwords for all admin accounts but no request validation'
      ),
      'Authentication, authorization, input validation, rate limiting, and logging applied consistently',
      2,
      8,
      'Defense in depth applies multiple controls so that bypassing one layer does not expose the entire system.',
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
