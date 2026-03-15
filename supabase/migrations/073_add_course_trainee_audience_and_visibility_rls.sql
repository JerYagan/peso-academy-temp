-- Add course trainee audience targeting and restrict learner/public visibility
-- to published courses that match the resolved trainee type.

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS trainee_audience TEXT NOT NULL DEFAULT 'general_public';

UPDATE public.courses
SET trainee_audience = 'general_public'
WHERE trainee_audience IS NULL
   OR trainee_audience NOT IN ('general_public', 'peso_client', 'peso_employee');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'courses_trainee_audience_check'
      AND conrelid = 'public.courses'::regclass
  ) THEN
    ALTER TABLE public.courses
    ADD CONSTRAINT courses_trainee_audience_check
    CHECK (trainee_audience IN ('general_public', 'peso_client', 'peso_employee'));
  END IF;
END $$;

COMMENT ON COLUMN public.courses.trainee_audience IS 'Audience targeting for learner course visibility: general_public, peso_client, or peso_employee.';

CREATE OR REPLACE FUNCTION public.get_current_user_trainee_type()
RETURNS TEXT AS $$
DECLARE
  resolved_trainee_type TEXT;
  profile_id UUID;
BEGIN
  profile_id := public.get_current_user_profile_id();

  IF profile_id IS NOT NULL THEN
    SELECT users.trainee_type::TEXT
    INTO resolved_trainee_type
    FROM public.users
    WHERE users.id = profile_id;
  END IF;

  IF resolved_trainee_type IS NULL OR resolved_trainee_type = '' THEN
    resolved_trainee_type := NULLIF(auth.jwt() -> 'user_metadata' ->> 'trainee_type', '');
  END IF;

  RETURN CASE resolved_trainee_type
    WHEN 'peso_client' THEN 'peso_client'
    WHEN 'peso_employee' THEN 'peso_employee'
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_current_user_trainee_type() TO authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can view courses" ON public.courses;
DROP POLICY IF EXISTS "Public can view published general courses" ON public.courses;
DROP POLICY IF EXISTS "Authenticated users can view allowed courses" ON public.courses;

CREATE POLICY "Public can view published general courses" ON public.courses
FOR SELECT
TO anon
USING (
  COALESCE(published, true) = true
  AND trainee_audience = 'general_public'
);

CREATE POLICY "Authenticated users can view allowed courses" ON public.courses
FOR SELECT
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'trainer')
  OR (
    COALESCE(published, true) = true
    AND (
      trainee_audience = 'general_public'
      OR trainee_audience = public.get_current_user_trainee_type()
    )
  )
);

DROP FUNCTION IF EXISTS public.seed_course(TEXT, TEXT, TEXT, course_level, INTEGER, TEXT, BOOLEAN, TEXT[], INTEGER, NUMERIC, certificate_type, BOOLEAN);

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
  p_published BOOLEAN DEFAULT true,
  p_trainee_audience TEXT DEFAULT 'general_public'
) RETURNS VOID AS $$
DECLARE
  v_instructor_id UUID;
  v_trainee_audience TEXT;
BEGIN
  v_trainee_audience := CASE p_trainee_audience
    WHEN 'peso_client' THEN 'peso_client'
    WHEN 'peso_employee' THEN 'peso_employee'
    ELSE 'general_public'
  END;

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
        trainee_audience = v_trainee_audience,
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
      trainee_audience,
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
      v_trainee_audience,
      NOW(),
      NOW()
    );
  END IF;
END;
$$ LANGUAGE plpgsql;