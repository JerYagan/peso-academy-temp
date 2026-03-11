-- Run this in Supabase SQL Editor if migration 053 has not yet been applied.

CREATE TABLE IF NOT EXISTS public.taxonomy_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_type TEXT NOT NULL CHECK (term_type IN ('course_category', 'skill_tag', 'topic_tag')),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_taxonomy_terms_type_name_unique
  ON public.taxonomy_terms (term_type, lower(trim(name)));

CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_type_active
  ON public.taxonomy_terms (term_type, is_active, name);

CREATE OR REPLACE FUNCTION public.can_manage_taxonomy()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  resolved_profile_id UUID;
  resolved_role TEXT;
BEGIN
  resolved_profile_id := public.get_current_user_profile_id();

  SELECT u.role::text
  INTO resolved_role
  FROM public.users u
  WHERE u.id IN (auth.uid(), resolved_profile_id)
  ORDER BY CASE WHEN u.id = resolved_profile_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF resolved_role IN ('admin', 'trainer') THEN
    RETURN true;
  END IF;

  RETURN LOWER(COALESCE((SELECT raw_user_meta_data ->> 'role' FROM auth.users WHERE id = auth.uid()), '')) IN ('admin', 'trainer');
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_taxonomy() TO authenticated, service_role;

ALTER TABLE public.taxonomy_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view taxonomy terms" ON public.taxonomy_terms;
CREATE POLICY "Authenticated users can view taxonomy terms" ON public.taxonomy_terms
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Managers can insert taxonomy terms" ON public.taxonomy_terms;
CREATE POLICY "Managers can insert taxonomy terms" ON public.taxonomy_terms
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_taxonomy());

DROP POLICY IF EXISTS "Managers can update taxonomy terms" ON public.taxonomy_terms;
CREATE POLICY "Managers can update taxonomy terms" ON public.taxonomy_terms
FOR UPDATE
TO authenticated
USING (public.can_manage_taxonomy())
WITH CHECK (public.can_manage_taxonomy());

DROP POLICY IF EXISTS "Managers can delete taxonomy terms" ON public.taxonomy_terms;
CREATE POLICY "Managers can delete taxonomy terms" ON public.taxonomy_terms
FOR DELETE
TO authenticated
USING (public.can_manage_taxonomy());

INSERT INTO public.taxonomy_terms (term_type, name)
VALUES
  ('course_category', 'Digital Skills'),
  ('course_category', 'Technical Skills'),
  ('course_category', 'Employability Skills'),
  ('course_category', 'Business & Management'),
  ('course_category', 'Entrepreneurship'),
  ('course_category', 'Personal Development'),
  ('course_category', 'Hospitality & Tourism'),
  ('course_category', 'Construction & Trades'),
  ('course_category', 'Creative & Design'),
  ('course_category', 'Others'),
  ('skill_tag', 'Computer Basics'),
  ('skill_tag', 'Digital Literacy'),
  ('skill_tag', 'Internet Navigation'),
  ('skill_tag', 'Microsoft Office'),
  ('skill_tag', 'Email Etiquette'),
  ('skill_tag', 'Online Collaboration'),
  ('skill_tag', 'Data Entry'),
  ('skill_tag', 'Office Administration'),
  ('skill_tag', 'Communication'),
  ('skill_tag', 'Customer Service'),
  ('skill_tag', 'Problem Solving'),
  ('skill_tag', 'Professional Communication'),
  ('skill_tag', 'Resume Writing'),
  ('skill_tag', 'Interview Skills'),
  ('skill_tag', 'Work Ethics'),
  ('skill_tag', 'HTML'),
  ('skill_tag', 'CSS'),
  ('skill_tag', 'JavaScript'),
  ('skill_tag', 'Web Development'),
  ('skill_tag', 'Mobile Development'),
  ('skill_tag', 'React Native'),
  ('skill_tag', 'API Integration'),
  ('skill_tag', 'Business Planning'),
  ('skill_tag', 'Marketing'),
  ('skill_tag', 'Financial Management'),
  ('skill_tag', 'Project Coordination'),
  ('skill_tag', 'Entrepreneurship'),
  ('skill_tag', 'Graphic Design'),
  ('skill_tag', 'Hospitality Service'),
  ('skill_tag', 'Construction Safety'),
  ('topic_tag', 'Digital Literacy'),
  ('topic_tag', 'Office Productivity'),
  ('topic_tag', 'Data Management'),
  ('topic_tag', 'Customer Relations'),
  ('topic_tag', 'Career Readiness'),
  ('topic_tag', 'Professional Communication'),
  ('topic_tag', 'Web Development'),
  ('topic_tag', 'Mobile Development'),
  ('topic_tag', 'Entrepreneurship Fundamentals'),
  ('topic_tag', 'Marketing Strategy'),
  ('topic_tag', 'Financial Literacy'),
  ('topic_tag', 'Project Management'),
  ('topic_tag', 'Hospitality Service'),
  ('topic_tag', 'Construction Safety'),
  ('topic_tag', 'Creative Design')
ON CONFLICT DO NOTHING;