ALTER TABLE public.taxonomy_terms
  DROP CONSTRAINT IF EXISTS taxonomy_terms_term_type_check;

ALTER TABLE public.taxonomy_terms
  ADD CONSTRAINT taxonomy_terms_term_type_check CHECK (
    term_type IN ('course_category', 'skill_tag', 'topic_tag', 'industry_tag', 'career_path')
  );

INSERT INTO public.taxonomy_terms (term_type, name)
VALUES
  ('industry_tag', 'Digital Services'),
  ('industry_tag', 'Office Administration'),
  ('industry_tag', 'Customer Service'),
  ('industry_tag', 'Retail and Sales'),
  ('industry_tag', 'Entrepreneurship'),
  ('industry_tag', 'Hospitality and Tourism'),
  ('industry_tag', 'Construction and Trades'),
  ('industry_tag', 'Creative and Design'),
  ('career_path', 'Administrative Assistant'),
  ('career_path', 'Office Staff'),
  ('career_path', 'Customer Service Associate'),
  ('career_path', 'Retail Sales Associate'),
  ('career_path', 'Digital Support Associate'),
  ('career_path', 'Marketing Assistant'),
  ('career_path', 'Graphic Designer'),
  ('career_path', 'Web Developer'),
  ('career_path', 'Mobile App Developer'),
  ('career_path', 'Entrepreneur'),
  ('career_path', 'Hospitality Service Associate'),
  ('career_path', 'Construction Support Technician')
ON CONFLICT DO NOTHING;
