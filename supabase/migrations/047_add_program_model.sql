-- Add a first-class program model so courses can be grouped and ranked at program scope.

CREATE TABLE IF NOT EXISTS public.programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT programs_title_unique UNIQUE (title)
);

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courses_program_id ON public.courses(program_id);
CREATE INDEX IF NOT EXISTS idx_programs_category ON public.programs(category);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view programs" ON public.programs;
DROP POLICY IF EXISTS "Course managers can create programs" ON public.programs;
DROP POLICY IF EXISTS "Course managers can update programs" ON public.programs;
DROP POLICY IF EXISTS "Course managers can delete programs" ON public.programs;

CREATE POLICY "Anyone can view programs" ON public.programs
FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Course managers can create programs" ON public.programs
FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer'));

CREATE POLICY "Course managers can update programs" ON public.programs
FOR UPDATE
TO authenticated
USING (public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer'))
WITH CHECK (public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer'));

CREATE POLICY "Course managers can delete programs" ON public.programs
FOR DELETE
TO authenticated
USING (public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer'));