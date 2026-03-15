CREATE OR REPLACE FUNCTION public.taxonomy_term_exists(requested_term_type TEXT, raw_value TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.taxonomy_terms term
    WHERE term.term_type = requested_term_type
      AND lower(trim(term.name)) = lower(trim(coalesce(raw_value, '')))
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_managed_taxonomy_values(values_to_check TEXT[], requested_term_type TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    bool_and(public.taxonomy_term_exists(requested_term_type, value)),
    TRUE
  )
  FROM unnest(COALESCE(values_to_check, ARRAY[]::TEXT[])) AS value;
$$;

GRANT EXECUTE ON FUNCTION public.taxonomy_term_exists(TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.validate_managed_taxonomy_values(TEXT[], TEXT) TO authenticated, anon, service_role;

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
    public.taxonomy_term_exists('course_category', category)
  ),
  ADD CONSTRAINT courses_skill_tags_taxonomy_check CHECK (
    public.validate_managed_taxonomy_values(skill_tags, 'skill_tag')
  ),
  ADD CONSTRAINT courses_topic_tags_taxonomy_check CHECK (
    public.validate_managed_taxonomy_values(topic_tags, 'topic_tag')
  );

ALTER TABLE public.modules
  ADD CONSTRAINT modules_skill_tags_taxonomy_check CHECK (
    public.validate_managed_taxonomy_values(skill_tags, 'skill_tag')
  ),
  ADD CONSTRAINT modules_topic_tags_taxonomy_check CHECK (
    public.validate_managed_taxonomy_values(topic_tags, 'topic_tag')
  );

ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_skill_tags_taxonomy_check CHECK (
    public.validate_managed_taxonomy_values(skill_tags, 'skill_tag')
  ),
  ADD CONSTRAINT assessments_topic_tags_taxonomy_check CHECK (
    public.validate_managed_taxonomy_values(topic_tags, 'topic_tag')
  );

ALTER TABLE public.assessment_questions
  ADD CONSTRAINT assessment_questions_skill_tags_taxonomy_check CHECK (
    public.validate_managed_taxonomy_values(skill_tags, 'skill_tag')
  ),
  ADD CONSTRAINT assessment_questions_topic_tags_taxonomy_check CHECK (
    public.validate_managed_taxonomy_values(topic_tags, 'topic_tag')
  );