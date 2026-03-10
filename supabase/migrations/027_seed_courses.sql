-- Seed initial courses for PESO Academy
-- Creates or updates at least 10 courses using an existing trainer/admin user as instructor.

CREATE OR REPLACE FUNCTION public.seed_course(
  p_title TEXT,
  p_description TEXT,
  p_category TEXT,
  p_level course_level,
  p_duration INTEGER,
  p_thumbnail TEXT,
  p_is_tesda_accredited BOOLEAN,
  p_skills TEXT[],
  p_enrolled_count INTEGER,
  p_rating NUMERIC,
  p_certificate_type certificate_type,
  p_published BOOLEAN DEFAULT true
) RETURNS VOID AS $$
DECLARE
  v_instructor_id UUID;
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
    RAISE NOTICE 'No trainer/admin/SPD user found in public.users. Seed users first before seeding courses.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.courses
    WHERE title = p_title
  ) THEN
    UPDATE public.courses
    SET description = p_description,
        category = p_category,
        level = p_level,
        duration = p_duration,
        instructor_id = v_instructor_id,
        thumbnail = p_thumbnail,
        is_tesda_accredited = p_is_tesda_accredited,
        skills = p_skills,
        enrolled_count = p_enrolled_count,
        rating = p_rating,
        certificate_type = p_certificate_type,
        published = p_published,
        updated_at = NOW()
    WHERE title = p_title;
  ELSE
    INSERT INTO public.courses (
      title,
      description,
      category,
      level,
      duration,
      instructor_id,
      thumbnail,
      is_tesda_accredited,
      skills,
      enrolled_count,
      rating,
      certificate_type,
      published,
      created_at,
      updated_at
    )
    VALUES (
      p_title,
      p_description,
      p_category,
      p_level,
      p_duration,
      v_instructor_id,
      p_thumbnail,
      p_is_tesda_accredited,
      p_skills,
      p_enrolled_count,
      p_rating,
      p_certificate_type,
      p_published,
      NOW(),
      NOW()
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT public.seed_course(
  'Digital Skills Fundamentals',
  'Learn essential digital skills including computer basics, internet navigation, email etiquette, online collaboration, and productivity tools for everyday work.',
  'Digital Skills',
  'Beginner',
  40,
  '/images/course-tech.svg',
  true,
  ARRAY['Computer Basics', 'Microsoft Office', 'Internet Navigation', 'Email Communication'],
  1250,
  4.50,
  'completion',
  true
);

SELECT public.seed_course(
  'Web Development Basics',
  'Introduction to HTML, CSS, JavaScript, responsive layouts, and deploying simple websites for entry-level web development roles.',
  'Technical Skills',
  'Beginner',
  60,
  '/images/course-tech.svg',
  true,
  ARRAY['HTML', 'CSS', 'JavaScript', 'Responsive Design'],
  850,
  4.70,
  'completion',
  true
);

SELECT public.seed_course(
  'Customer Service Excellence',
  'Develop communication, empathy, conflict resolution, and service recovery skills for frontline and client-facing roles.',
  'Employability Skills',
  'Intermediate',
  30,
  '/images/course-service.svg',
  true,
  ARRAY['Communication', 'Customer Service', 'Problem Solving', 'Professionalism'],
  2100,
  4.60,
  'completion',
  true
);

SELECT public.seed_course(
  'Entrepreneurship Fundamentals',
  'Learn how to validate ideas, build a business plan, manage finances, and market products or services effectively.',
  'Entrepreneurship',
  'Intermediate',
  50,
  '/images/course-business.svg',
  true,
  ARRAY['Business Planning', 'Marketing', 'Financial Management', 'Startup Strategy'],
  650,
  4.40,
  'completion',
  true
);

SELECT public.seed_course(
  'Data Entry and Office Administration',
  'Build practical office skills covering data entry accuracy, document management, scheduling, and basic workplace tools.',
  'Employability Skills',
  'Beginner',
  35,
  '/images/course-office.svg',
  true,
  ARRAY['Data Entry', 'Office Administration', 'Organization', 'Records Management'],
  1800,
  4.50,
  'completion',
  true
);

SELECT public.seed_course(
  'Mobile App Development',
  'Build cross-platform mobile applications using modern frameworks, API integration, and deployment best practices.',
  'Technical Skills',
  'Advanced',
  80,
  '/images/course-tech.svg',
  true,
  ARRAY['Mobile Development', 'React Native', 'API Integration', 'App Deployment'],
  320,
  4.80,
  'completion',
  true
);

SELECT public.seed_course(
  'Bookkeeping for Small Businesses',
  'Understand the basics of bookkeeping, cash flow tracking, budgeting, and financial record maintenance for micro and small enterprises.',
  'Entrepreneurship',
  'Beginner',
  36,
  '/images/course-business.svg',
  true,
  ARRAY['Bookkeeping', 'Budgeting', 'Cash Flow Management', 'Financial Records'],
  540,
  4.30,
  'completion',
  true
);

SELECT public.seed_course(
  'Graphic Design for Social Media',
  'Create engaging social media graphics using design principles, layout techniques, and accessible content practices.',
  'Digital Skills',
  'Intermediate',
  45,
  '/images/course-tech.svg',
  true,
  ARRAY['Graphic Design', 'Branding', 'Content Creation', 'Canva'],
  710,
  4.55,
  'completion',
  true
);

SELECT public.seed_course(
  'Workplace Readiness and Professional Ethics',
  'Prepare for employment with training on workplace behavior, resume readiness, interview preparation, and ethical decision-making.',
  'Employability Skills',
  'Beginner',
  24,
  '/images/course-service.svg',
  true,
  ARRAY['Resume Writing', 'Interview Skills', 'Work Ethics', 'Professional Communication'],
  940,
  4.40,
  'participation',
  true
);

SELECT public.seed_course(
  'E-Commerce Operations and Online Selling',
  'Learn product listing, customer messaging, order fulfillment, digital payments, and marketplace operations for online businesses.',
  'Entrepreneurship',
  'Intermediate',
  42,
  '/images/course-business.svg',
  true,
  ARRAY['Online Selling', 'Marketplace Operations', 'Digital Payments', 'Customer Engagement'],
  605,
  4.45,
  'completion',
  true
);

DROP FUNCTION IF EXISTS public.seed_course(
  TEXT,
  TEXT,
  TEXT,
  course_level,
  INTEGER,
  TEXT,
  BOOLEAN,
  TEXT[],
  INTEGER,
  NUMERIC,
  certificate_type,
  BOOLEAN
);