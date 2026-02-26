-- Add published flag so trainers can control when a course appears on the Trainee dashboard.
-- Existing courses default to published (true); new courses can be created as draft (false).

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.courses.published IS 'When true, course is visible to trainees in Browse Courses. When false, only trainers/admins see it.';
