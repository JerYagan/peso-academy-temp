-- Finalize the canonical course/module/assessment taxonomy and backfill legacy content.

CREATE OR REPLACE FUNCTION public.validate_taxonomy_values(values_to_check TEXT[], allowed_values TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(bool_and(value = ANY(allowed_values)), TRUE)
  FROM unnest(COALESCE(values_to_check, ARRAY[]::TEXT[])) AS value;
$$;

CREATE OR REPLACE FUNCTION public.canonical_course_category(raw_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT := lower(regexp_replace(coalesce(raw_value, ''), '[^a-z0-9]+', ' ', 'g'));
BEGIN
  normalized := regexp_replace(normalized, '\s+', ' ', 'g');

  IF normalized = '' THEN RETURN NULL; END IF;
  IF normalized IN ('digital skills', 'digital literacy', 'digital skills fundamentals') OR normalized LIKE '%digital%' THEN RETURN 'Digital Skills'; END IF;
  IF normalized IN ('technical skills', 'vocational training') OR normalized LIKE '%technical%' OR normalized LIKE '%web%' OR normalized LIKE '%mobile%' OR normalized LIKE '%trade%' THEN RETURN 'Technical Skills'; END IF;
  IF normalized IN ('soft skills', 'career development', 'employability skills') OR normalized LIKE '%career%' OR normalized LIKE '%employ%' THEN RETURN 'Employability Skills'; END IF;
  IF normalized IN ('business management', 'business and management') OR normalized LIKE '%business%' OR normalized LIKE '%management%' OR normalized LIKE '%office%' THEN RETURN 'Business & Management'; END IF;
  IF normalized LIKE '%entrepreneur%' THEN RETURN 'Entrepreneurship'; END IF;
  IF normalized LIKE '%personal%' THEN RETURN 'Personal Development'; END IF;
  IF normalized LIKE '%hospitality%' OR normalized LIKE '%tourism%' THEN RETURN 'Hospitality & Tourism'; END IF;
  IF normalized LIKE '%construction%' OR normalized LIKE '%safety%' THEN RETURN 'Construction & Trades'; END IF;
  IF normalized LIKE '%creative%' OR normalized LIKE '%design%' THEN RETURN 'Creative & Design'; END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_skill_tag(raw_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT := lower(regexp_replace(coalesce(raw_value, ''), '[^a-z0-9]+', ' ', 'g'));
BEGIN
  normalized := regexp_replace(normalized, '\s+', ' ', 'g');

  CASE normalized
    WHEN 'basic computer skills' THEN RETURN 'Computer Basics';
    WHEN 'computer basics' THEN RETURN 'Computer Basics';
    WHEN 'digital literacy' THEN RETURN 'Digital Literacy';
    WHEN 'computer literacy' THEN RETURN 'Digital Literacy';
    WHEN 'internet navigation' THEN RETURN 'Internet Navigation';
    WHEN 'internet basics' THEN RETURN 'Internet Navigation';
    WHEN 'microsoft office' THEN RETURN 'Microsoft Office';
    WHEN 'office productivity' THEN RETURN 'Microsoft Office';
    WHEN 'microsoft office suite' THEN RETURN 'Microsoft Office';
    WHEN 'email etiquette' THEN RETURN 'Email Etiquette';
    WHEN 'online collaboration' THEN RETURN 'Online Collaboration';
    WHEN 'data entry' THEN RETURN 'Data Entry';
    WHEN 'office administration' THEN RETURN 'Office Administration';
    WHEN 'communication' THEN RETURN 'Communication';
    WHEN 'communication skills' THEN RETURN 'Communication';
    WHEN 'customer service' THEN RETURN 'Customer Service';
    WHEN 'customer relations' THEN RETURN 'Customer Service';
    WHEN 'problem solving' THEN RETURN 'Problem Solving';
    WHEN 'professional communication' THEN RETURN 'Professional Communication';
    WHEN 'workplace communication' THEN RETURN 'Professional Communication';
    WHEN 'resume writing' THEN RETURN 'Resume Writing';
    WHEN 'resume preparation' THEN RETURN 'Resume Writing';
    WHEN 'interview skills' THEN RETURN 'Interview Skills';
    WHEN 'job interview skills' THEN RETURN 'Interview Skills';
    WHEN 'work ethics' THEN RETURN 'Work Ethics';
    WHEN 'professional ethics' THEN RETURN 'Work Ethics';
    WHEN 'html' THEN RETURN 'HTML';
    WHEN 'css' THEN RETURN 'CSS';
    WHEN 'javascript' THEN RETURN 'JavaScript';
    WHEN 'web development' THEN RETURN 'Web Development';
    WHEN 'web design' THEN RETURN 'Web Development';
    WHEN 'mobile development' THEN RETURN 'Mobile Development';
    WHEN 'mobile app development' THEN RETURN 'Mobile Development';
    WHEN 'react native' THEN RETURN 'React Native';
    WHEN 'api integration' THEN RETURN 'API Integration';
    WHEN 'business planning' THEN RETURN 'Business Planning';
    WHEN 'business basics' THEN RETURN 'Business Planning';
    WHEN 'marketing' THEN RETURN 'Marketing';
    WHEN 'financial management' THEN RETURN 'Financial Management';
    WHEN 'financial literacy' THEN RETURN 'Financial Management';
    WHEN 'organization' THEN RETURN 'Project Coordination';
    WHEN 'project coordination' THEN RETURN 'Project Coordination';
    WHEN 'entrepreneurship' THEN RETURN 'Entrepreneurship';
    WHEN 'business startup' THEN RETURN 'Entrepreneurship';
    WHEN 'graphic design' THEN RETURN 'Graphic Design';
    WHEN 'hospitality service' THEN RETURN 'Hospitality Service';
    WHEN 'construction safety' THEN RETURN 'Construction Safety';
    ELSE RETURN NULL;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_topic_tag(raw_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT := lower(regexp_replace(coalesce(raw_value, ''), '[^a-z0-9]+', ' ', 'g'));
BEGIN
  normalized := regexp_replace(normalized, '\s+', ' ', 'g');

  CASE normalized
    WHEN 'digital literacy' THEN RETURN 'Digital Literacy';
    WHEN 'office productivity' THEN RETURN 'Office Productivity';
    WHEN 'office administration' THEN RETURN 'Office Productivity';
    WHEN 'microsoft office' THEN RETURN 'Office Productivity';
    WHEN 'data management' THEN RETURN 'Data Management';
    WHEN 'data entry' THEN RETURN 'Data Management';
    WHEN 'customer relations' THEN RETURN 'Customer Relations';
    WHEN 'customer service' THEN RETURN 'Customer Relations';
    WHEN 'career readiness' THEN RETURN 'Career Readiness';
    WHEN 'resume writing' THEN RETURN 'Career Readiness';
    WHEN 'interview skills' THEN RETURN 'Career Readiness';
    WHEN 'work ethics' THEN RETURN 'Career Readiness';
    WHEN 'professional communication' THEN RETURN 'Professional Communication';
    WHEN 'communication' THEN RETURN 'Professional Communication';
    WHEN 'web development' THEN RETURN 'Web Development';
    WHEN 'html' THEN RETURN 'Web Development';
    WHEN 'css' THEN RETURN 'Web Development';
    WHEN 'javascript' THEN RETURN 'Web Development';
    WHEN 'mobile development' THEN RETURN 'Mobile Development';
    WHEN 'react native' THEN RETURN 'Mobile Development';
    WHEN 'entrepreneurship fundamentals' THEN RETURN 'Entrepreneurship Fundamentals';
    WHEN 'entrepreneurship' THEN RETURN 'Entrepreneurship Fundamentals';
    WHEN 'marketing strategy' THEN RETURN 'Marketing Strategy';
    WHEN 'marketing' THEN RETURN 'Marketing Strategy';
    WHEN 'financial literacy' THEN RETURN 'Financial Literacy';
    WHEN 'financial management' THEN RETURN 'Financial Literacy';
    WHEN 'project management' THEN RETURN 'Project Management';
    WHEN 'hospitality service' THEN RETURN 'Hospitality Service';
    WHEN 'construction safety' THEN RETURN 'Construction Safety';
    WHEN 'creative design' THEN RETURN 'Creative Design';
    WHEN 'graphic design' THEN RETURN 'Creative Design';
    ELSE RETURN NULL;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.default_skill_tags_for_category(canonical_category TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE canonical_category
    WHEN 'Digital Skills' THEN ARRAY['Computer Basics', 'Digital Literacy']::TEXT[]
    WHEN 'Technical Skills' THEN ARRAY['Web Development']::TEXT[]
    WHEN 'Employability Skills' THEN ARRAY['Communication']::TEXT[]
    WHEN 'Business & Management' THEN ARRAY['Office Administration']::TEXT[]
    WHEN 'Entrepreneurship' THEN ARRAY['Business Planning']::TEXT[]
    WHEN 'Personal Development' THEN ARRAY['Professional Communication']::TEXT[]
    WHEN 'Hospitality & Tourism' THEN ARRAY['Hospitality Service']::TEXT[]
    WHEN 'Construction & Trades' THEN ARRAY['Construction Safety']::TEXT[]
    ELSE ARRAY['Graphic Design']::TEXT[]
  END;
$$;

CREATE OR REPLACE FUNCTION public.default_topic_tags_for_category(canonical_category TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE canonical_category
    WHEN 'Digital Skills' THEN ARRAY['Digital Literacy', 'Office Productivity']::TEXT[]
    WHEN 'Technical Skills' THEN ARRAY['Web Development']::TEXT[]
    WHEN 'Employability Skills' THEN ARRAY['Career Readiness', 'Professional Communication']::TEXT[]
    WHEN 'Business & Management' THEN ARRAY['Office Productivity', 'Project Management']::TEXT[]
    WHEN 'Entrepreneurship' THEN ARRAY['Entrepreneurship Fundamentals', 'Marketing Strategy']::TEXT[]
    WHEN 'Personal Development' THEN ARRAY['Professional Communication']::TEXT[]
    WHEN 'Hospitality & Tourism' THEN ARRAY['Hospitality Service']::TEXT[]
    WHEN 'Construction & Trades' THEN ARRAY['Construction Safety']::TEXT[]
    ELSE ARRAY['Creative Design']::TEXT[]
  END;
$$;

WITH normalized_courses AS (
  SELECT
    c.id,
    COALESCE(public.canonical_course_category(c.category), 'Digital Skills') AS canonical_category,
    ARRAY(
      SELECT DISTINCT public.canonical_skill_tag(value)
      FROM unnest(COALESCE(NULLIF(c.skill_tags, ARRAY[]::TEXT[]), c.skills, ARRAY[]::TEXT[])) AS value
      WHERE public.canonical_skill_tag(value) IS NOT NULL
      ORDER BY public.canonical_skill_tag(value)
    ) AS canonical_skill_tags,
    ARRAY(
      SELECT DISTINCT public.canonical_topic_tag(value)
      FROM unnest(COALESCE(c.topic_tags, ARRAY[]::TEXT[])) AS value
      WHERE public.canonical_topic_tag(value) IS NOT NULL
      ORDER BY public.canonical_topic_tag(value)
    ) AS canonical_topic_tags
  FROM public.courses c
)
UPDATE public.courses c
SET
  category = normalized_courses.canonical_category,
  skills = COALESCE(
    NULLIF(normalized_courses.canonical_skill_tags, ARRAY[]::TEXT[]),
    public.default_skill_tags_for_category(normalized_courses.canonical_category)
  ),
  skill_tags = COALESCE(
    NULLIF(normalized_courses.canonical_skill_tags, ARRAY[]::TEXT[]),
    public.default_skill_tags_for_category(normalized_courses.canonical_category)
  ),
  topic_tags = COALESCE(
    NULLIF(normalized_courses.canonical_topic_tags, ARRAY[]::TEXT[]),
    public.default_topic_tags_for_category(normalized_courses.canonical_category)
  )
FROM normalized_courses
WHERE normalized_courses.id = c.id;

WITH normalized_modules AS (
  SELECT
    m.id,
    c.category AS course_category,
    c.skill_tags AS course_skill_tags,
    c.topic_tags AS course_topic_tags,
    ARRAY(
      SELECT DISTINCT public.canonical_skill_tag(value)
      FROM unnest(COALESCE(m.skill_tags, ARRAY[]::TEXT[])) AS value
      WHERE public.canonical_skill_tag(value) IS NOT NULL
      ORDER BY public.canonical_skill_tag(value)
    ) AS canonical_skill_tags,
    ARRAY(
      SELECT DISTINCT public.canonical_topic_tag(value)
      FROM unnest(COALESCE(m.topic_tags, ARRAY[]::TEXT[])) AS value
      WHERE public.canonical_topic_tag(value) IS NOT NULL
      ORDER BY public.canonical_topic_tag(value)
    ) AS canonical_topic_tags
  FROM public.modules m
  JOIN public.courses c ON c.id = m.course_id
)
UPDATE public.modules m
SET
  skill_tags = COALESCE(
    NULLIF(normalized_modules.canonical_skill_tags, ARRAY[]::TEXT[]),
    NULLIF(normalized_modules.course_skill_tags, ARRAY[]::TEXT[]),
    public.default_skill_tags_for_category(normalized_modules.course_category)
  ),
  topic_tags = COALESCE(
    NULLIF(normalized_modules.canonical_topic_tags, ARRAY[]::TEXT[]),
    NULLIF(normalized_modules.course_topic_tags, ARRAY[]::TEXT[]),
    public.default_topic_tags_for_category(normalized_modules.course_category)
  )
FROM normalized_modules
WHERE normalized_modules.id = m.id;

WITH normalized_assessments AS (
  SELECT
    a.id,
    c.category AS course_category,
    m.skill_tags AS module_skill_tags,
    m.topic_tags AS module_topic_tags,
    ARRAY(
      SELECT DISTINCT public.canonical_skill_tag(value)
      FROM unnest(COALESCE(a.skill_tags, ARRAY[]::TEXT[])) AS value
      WHERE public.canonical_skill_tag(value) IS NOT NULL
      ORDER BY public.canonical_skill_tag(value)
    ) AS canonical_skill_tags,
    ARRAY(
      SELECT DISTINCT public.canonical_topic_tag(value)
      FROM unnest(COALESCE(a.topic_tags, ARRAY[]::TEXT[])) AS value
      WHERE public.canonical_topic_tag(value) IS NOT NULL
      ORDER BY public.canonical_topic_tag(value)
    ) AS canonical_topic_tags
  FROM public.assessments a
  JOIN public.modules m ON m.id = a.module_id
  JOIN public.courses c ON c.id = m.course_id
)
UPDATE public.assessments a
SET
  skill_tags = COALESCE(
    NULLIF(normalized_assessments.canonical_skill_tags, ARRAY[]::TEXT[]),
    NULLIF(normalized_assessments.module_skill_tags, ARRAY[]::TEXT[]),
    public.default_skill_tags_for_category(normalized_assessments.course_category)
  ),
  topic_tags = COALESCE(
    NULLIF(normalized_assessments.canonical_topic_tags, ARRAY[]::TEXT[]),
    NULLIF(normalized_assessments.module_topic_tags, ARRAY[]::TEXT[]),
    public.default_topic_tags_for_category(normalized_assessments.course_category)
  )
FROM normalized_assessments
WHERE normalized_assessments.id = a.id;

WITH normalized_questions AS (
  SELECT
    q.id,
    c.category AS course_category,
    a.skill_tags AS assessment_skill_tags,
    a.topic_tags AS assessment_topic_tags,
    ARRAY(
      SELECT DISTINCT public.canonical_skill_tag(value)
      FROM unnest(COALESCE(q.skill_tags, ARRAY[]::TEXT[])) AS value
      WHERE public.canonical_skill_tag(value) IS NOT NULL
      ORDER BY public.canonical_skill_tag(value)
    ) AS canonical_skill_tags,
    ARRAY(
      SELECT DISTINCT public.canonical_topic_tag(value)
      FROM unnest(COALESCE(q.topic_tags, ARRAY[]::TEXT[])) AS value
      WHERE public.canonical_topic_tag(value) IS NOT NULL
      ORDER BY public.canonical_topic_tag(value)
    ) AS canonical_topic_tags
  FROM public.assessment_questions q
  JOIN public.assessments a ON a.id = q.assessment_id
  JOIN public.modules m ON m.id = a.module_id
  JOIN public.courses c ON c.id = m.course_id
)
UPDATE public.assessment_questions q
SET
  skill_tags = COALESCE(
    NULLIF(normalized_questions.canonical_skill_tags, ARRAY[]::TEXT[]),
    NULLIF(normalized_questions.assessment_skill_tags, ARRAY[]::TEXT[]),
    public.default_skill_tags_for_category(normalized_questions.course_category)
  ),
  topic_tags = COALESCE(
    NULLIF(normalized_questions.canonical_topic_tags, ARRAY[]::TEXT[]),
    NULLIF(normalized_questions.assessment_topic_tags, ARRAY[]::TEXT[]),
    public.default_topic_tags_for_category(normalized_questions.course_category)
  )
FROM normalized_questions
WHERE normalized_questions.id = q.id;

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_category_taxonomy_check;
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_skill_tags_taxonomy_check;
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_topic_tags_taxonomy_check;
ALTER TABLE public.modules DROP CONSTRAINT IF EXISTS modules_skill_tags_taxonomy_check;
ALTER TABLE public.modules DROP CONSTRAINT IF EXISTS modules_topic_tags_taxonomy_check;
ALTER TABLE public.assessments DROP CONSTRAINT IF EXISTS assessments_skill_tags_taxonomy_check;
ALTER TABLE public.assessments DROP CONSTRAINT IF EXISTS assessments_topic_tags_taxonomy_check;
ALTER TABLE public.assessment_questions DROP CONSTRAINT IF EXISTS assessment_questions_skill_tags_taxonomy_check;
ALTER TABLE public.assessment_questions DROP CONSTRAINT IF EXISTS assessment_questions_topic_tags_taxonomy_check;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_category_taxonomy_check CHECK (
    category = ANY (ARRAY['Digital Skills','Technical Skills','Employability Skills','Business & Management','Entrepreneurship','Personal Development','Hospitality & Tourism','Construction & Trades','Creative & Design'])
  ),
  ADD CONSTRAINT courses_skill_tags_taxonomy_check CHECK (
    public.validate_taxonomy_values(skill_tags, ARRAY['Computer Basics','Digital Literacy','Internet Navigation','Microsoft Office','Email Etiquette','Online Collaboration','Data Entry','Office Administration','Communication','Customer Service','Problem Solving','Professional Communication','Resume Writing','Interview Skills','Work Ethics','HTML','CSS','JavaScript','Web Development','Mobile Development','React Native','API Integration','Business Planning','Marketing','Financial Management','Project Coordination','Entrepreneurship','Graphic Design','Hospitality Service','Construction Safety'])
  ),
  ADD CONSTRAINT courses_topic_tags_taxonomy_check CHECK (
    public.validate_taxonomy_values(topic_tags, ARRAY['Digital Literacy','Office Productivity','Data Management','Customer Relations','Career Readiness','Professional Communication','Web Development','Mobile Development','Entrepreneurship Fundamentals','Marketing Strategy','Financial Literacy','Project Management','Hospitality Service','Construction Safety','Creative Design'])
  );

ALTER TABLE public.modules
  ADD CONSTRAINT modules_skill_tags_taxonomy_check CHECK (
    public.validate_taxonomy_values(skill_tags, ARRAY['Computer Basics','Digital Literacy','Internet Navigation','Microsoft Office','Email Etiquette','Online Collaboration','Data Entry','Office Administration','Communication','Customer Service','Problem Solving','Professional Communication','Resume Writing','Interview Skills','Work Ethics','HTML','CSS','JavaScript','Web Development','Mobile Development','React Native','API Integration','Business Planning','Marketing','Financial Management','Project Coordination','Entrepreneurship','Graphic Design','Hospitality Service','Construction Safety'])
  ),
  ADD CONSTRAINT modules_topic_tags_taxonomy_check CHECK (
    public.validate_taxonomy_values(topic_tags, ARRAY['Digital Literacy','Office Productivity','Data Management','Customer Relations','Career Readiness','Professional Communication','Web Development','Mobile Development','Entrepreneurship Fundamentals','Marketing Strategy','Financial Literacy','Project Management','Hospitality Service','Construction Safety','Creative Design'])
  );

ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_skill_tags_taxonomy_check CHECK (
    public.validate_taxonomy_values(skill_tags, ARRAY['Computer Basics','Digital Literacy','Internet Navigation','Microsoft Office','Email Etiquette','Online Collaboration','Data Entry','Office Administration','Communication','Customer Service','Problem Solving','Professional Communication','Resume Writing','Interview Skills','Work Ethics','HTML','CSS','JavaScript','Web Development','Mobile Development','React Native','API Integration','Business Planning','Marketing','Financial Management','Project Coordination','Entrepreneurship','Graphic Design','Hospitality Service','Construction Safety'])
  ),
  ADD CONSTRAINT assessments_topic_tags_taxonomy_check CHECK (
    public.validate_taxonomy_values(topic_tags, ARRAY['Digital Literacy','Office Productivity','Data Management','Customer Relations','Career Readiness','Professional Communication','Web Development','Mobile Development','Entrepreneurship Fundamentals','Marketing Strategy','Financial Literacy','Project Management','Hospitality Service','Construction Safety','Creative Design'])
  );

ALTER TABLE public.assessment_questions
  ADD CONSTRAINT assessment_questions_skill_tags_taxonomy_check CHECK (
    public.validate_taxonomy_values(skill_tags, ARRAY['Computer Basics','Digital Literacy','Internet Navigation','Microsoft Office','Email Etiquette','Online Collaboration','Data Entry','Office Administration','Communication','Customer Service','Problem Solving','Professional Communication','Resume Writing','Interview Skills','Work Ethics','HTML','CSS','JavaScript','Web Development','Mobile Development','React Native','API Integration','Business Planning','Marketing','Financial Management','Project Coordination','Entrepreneurship','Graphic Design','Hospitality Service','Construction Safety'])
  ),
  ADD CONSTRAINT assessment_questions_topic_tags_taxonomy_check CHECK (
    public.validate_taxonomy_values(topic_tags, ARRAY['Digital Literacy','Office Productivity','Data Management','Customer Relations','Career Readiness','Professional Communication','Web Development','Mobile Development','Entrepreneurship Fundamentals','Marketing Strategy','Financial Literacy','Project Management','Hospitality Service','Construction Safety','Creative Design'])
  );