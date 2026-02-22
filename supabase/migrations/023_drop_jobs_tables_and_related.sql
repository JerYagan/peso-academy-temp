-- Remove all job-related features from the database
-- Run this in Supabase SQL Editor or via migration to drop jobs + job_applications and related enums

-- 1. Drop RLS policies (so we can drop tables)
DROP POLICY IF EXISTS "Anyone can view open jobs" ON public.jobs;
DROP POLICY IF EXISTS "Training officers and admins can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Training officers and admins can update jobs" ON public.jobs;
DROP POLICY IF EXISTS "Employers can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can view own applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can create own applications" ON public.job_applications;
DROP POLICY IF EXISTS "Training officers and admins can view job applications" ON public.job_applications;

-- 2. Drop tables (job_applications first due to FK to jobs)
DROP TABLE IF EXISTS public.job_applications CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;

-- 3. Drop enums (only if not used elsewhere)
DROP TYPE IF EXISTS application_status CASCADE;
DROP TYPE IF EXISTS job_status CASCADE;
DROP TYPE IF EXISTS job_type CASCADE;

-- 4. Remove job-related permissions (only if permissions/role_permissions tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions') THEN
    DELETE FROM public.role_permissions WHERE permission_id IN (SELECT id FROM public.permissions WHERE id LIKE 'jobs.%');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permissions') THEN
    DELETE FROM public.permissions WHERE id LIKE 'jobs.%';
  END IF;
END $$;
