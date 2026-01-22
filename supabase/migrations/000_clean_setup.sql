-- ============================================================================
-- PESO Academy - Clean Database Setup
-- ============================================================================
-- This script sets up the entire database from scratch using payroll-pal's
-- authentication approach (roles stored in auth.users.raw_user_meta_data)
-- 
-- IMPORTANT: This script will DROP all existing tables, functions, and policies
-- Run this in a fresh Supabase project or backup your data first!
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- STEP 1: DROP ALL EXISTING OBJECTS (Clean Slate)
-- ============================================================================

-- Drop auth trigger first (on auth.users)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop all tables first (CASCADE will automatically drop policies, triggers, and dependent objects)
-- This is safer than trying to drop policies/triggers on non-existent tables
DROP TABLE IF EXISTS public.feedback CASCADE;
DROP TABLE IF EXISTS public.feedback_templates CASCADE;
DROP TABLE IF EXISTS public.validations CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.module_completions CASCADE;
DROP TABLE IF EXISTS public.certificates CASCADE;
DROP TABLE IF EXISTS public.job_applications CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.modules CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop all functions (after tables are dropped)
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.prevent_role_change() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.increment_enrolled_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_submission_status_on_validation() CASCADE;
DROP FUNCTION IF EXISTS public.get_all_users() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_role(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_user_email(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.set_user_active_status(UUID, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.delete_user_account(UUID) CASCADE;

-- Drop custom types/enums (CASCADE will handle dependencies)
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS course_level CASCADE;
DROP TYPE IF EXISTS enrollment_status CASCADE;
DROP TYPE IF EXISTS submission_status CASCADE;
DROP TYPE IF EXISTS certificate_type CASCADE;
DROP TYPE IF EXISTS job_type CASCADE;
DROP TYPE IF EXISTS job_status CASCADE;
DROP TYPE IF EXISTS application_status CASCADE;

-- ============================================================================
-- STEP 2: CREATE CUSTOM TYPES/ENUMS
-- ============================================================================

CREATE TYPE course_level AS ENUM ('Beginner', 'Intermediate', 'Advanced');
CREATE TYPE enrollment_status AS ENUM ('enrolled', 'in-progress', 'completed', 'dropped');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected', 'revision_requested');
CREATE TYPE certificate_type AS ENUM ('completion', 'participation');
CREATE TYPE job_type AS ENUM ('Full-time', 'Part-time', 'Contract');
CREATE TYPE job_status AS ENUM ('open', 'closed');
CREATE TYPE application_status AS ENUM ('pending', 'reviewed', 'accepted', 'rejected');

-- ============================================================================
-- STEP 3: CREATE HELPER FUNCTIONS (Payroll-Pal Style)
-- ============================================================================

-- Function to get user role from JWT user_metadata (Payroll-Pal approach)
-- This function runs with SECURITY DEFINER to safely access user metadata
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Try to get role from JWT user_metadata first
  user_role := (auth.jwt() -> 'user_metadata' ->> 'role');
  
  -- If not found in JWT, try to get from auth.users (requires SECURITY DEFINER)
  IF user_role IS NULL THEN
    SELECT raw_user_meta_data->>'role' INTO user_role
    FROM auth.users
    WHERE id = auth.uid();
  END IF;
  
  -- Default role if not found
  RETURN COALESCE(user_role, 'trainee');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = user_id 
    AND (raw_user_meta_data->>'role')::TEXT = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: CREATE TABLES
-- ============================================================================

-- Role aliases table for dynamic role display names
CREATE TABLE public.role_aliases (
    role_code TEXT PRIMARY KEY CHECK (role_code IN ('admin', 'training_officer', 'validator', 'trainee')),
    display_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    avatar TEXT,
    phone TEXT,
    address TEXT,
    skills TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Courses table
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    level course_level NOT NULL,
    duration INTEGER NOT NULL, -- hours
    instructor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    thumbnail TEXT,
    is_tesda_accredited BOOLEAN NOT NULL DEFAULT false,
    skills TEXT[] NOT NULL DEFAULT '{}',
    enrolled_count INTEGER NOT NULL DEFAULT 0,
    rating NUMERIC(3, 2) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    certificate_type certificate_type NOT NULL DEFAULT 'completion',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Modules table
CREATE TABLE public.modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    content TEXT,
    materials TEXT[],
    prerequisites TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enrollments table
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status enrollment_status NOT NULL DEFAULT 'enrolled',
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    certificate_id UUID,
    UNIQUE(user_id, course_id)
);

-- Module completions table
CREATE TABLE public.module_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    time_spent INTEGER, -- minutes
    UNIQUE(enrollment_id, module_id)
);

-- Submissions table (with validation fields)
CREATE TABLE public.submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    submission_type VARCHAR(50) NOT NULL DEFAULT 'completion',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content JSONB DEFAULT '{}'::jsonb,
    file_path TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status submission_status NOT NULL DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'normal',
    feedback TEXT,
    validator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Validations table
CREATE TABLE public.validations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
    validator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    validation_type VARCHAR(50) NOT NULL DEFAULT 'review',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    decision VARCHAR(50),
    feedback TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    metadata JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feedback table
CREATE TABLE public.feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    validation_id UUID REFERENCES public.validations(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
    validator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    feedback_type VARCHAR(50) NOT NULL DEFAULT 'general',
    title VARCHAR(255),
    content TEXT NOT NULL,
    template_id UUID,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feedback templates table
CREATE TABLE public.feedback_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Certificates table
CREATE TABLE public.certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    certificate_number TEXT NOT NULL UNIQUE,
    certificate_type certificate_type NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verification_code TEXT NOT NULL UNIQUE
);

-- Jobs table
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT NOT NULL,
    type job_type NOT NULL,
    salary TEXT,
    description TEXT NOT NULL,
    requirements TEXT[] NOT NULL DEFAULT '{}',
    skills TEXT[] NOT NULL DEFAULT '{}',
    posted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status job_status NOT NULL DEFAULT 'open'
);

-- Job applications table
CREATE TABLE public.job_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status application_status NOT NULL DEFAULT 'pending',
    UNIQUE(job_id, user_id)
);

-- Notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 5: CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_role_aliases_role_code ON public.role_aliases(role_code);
CREATE INDEX idx_courses_instructor ON public.courses(instructor_id);
CREATE INDEX idx_courses_category ON public.courses(category);
CREATE INDEX idx_modules_course ON public.modules(course_id);
CREATE INDEX idx_enrollments_user ON public.enrollments(user_id);
CREATE INDEX idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX idx_module_completions_enrollment ON public.module_completions(enrollment_id);
CREATE INDEX idx_submissions_enrollment ON public.submissions(enrollment_id);
CREATE INDEX idx_submissions_module_id ON public.submissions(module_id);
CREATE INDEX idx_submissions_user_id ON public.submissions(user_id);
CREATE INDEX idx_submissions_status ON public.submissions(status);
CREATE INDEX idx_submissions_submitted_at ON public.submissions(submitted_at DESC);
CREATE INDEX idx_submissions_priority ON public.submissions(priority);
CREATE INDEX idx_submissions_validator_id ON public.submissions(validator_id);
CREATE INDEX idx_validations_submission_id ON public.validations(submission_id);
CREATE INDEX idx_validations_validator_id ON public.validations(validator_id);
CREATE INDEX idx_validations_status ON public.validations(status);
CREATE INDEX idx_validations_decision ON public.validations(decision);
CREATE INDEX idx_validations_created_at ON public.validations(created_at DESC);
CREATE INDEX idx_feedback_validation_id ON public.feedback(validation_id);
CREATE INDEX idx_feedback_submission_id ON public.feedback(submission_id);
CREATE INDEX idx_feedback_validator_id ON public.feedback(validator_id);
CREATE INDEX idx_certificates_user ON public.certificates(user_id);
CREATE INDEX idx_certificates_course ON public.certificates(course_id);
CREATE INDEX idx_jobs_posted_by ON public.jobs(posted_by);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_job_applications_job ON public.job_applications(job_id);
CREATE INDEX idx_job_applications_user ON public.job_applications(user_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);

-- ============================================================================
-- STEP 6: CREATE TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_role_aliases_updated_at 
    BEFORE UPDATE ON public.role_aliases
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_courses_updated_at 
    BEFORE UPDATE ON public.courses
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at
    BEFORE UPDATE ON public.submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_validations_updated_at
    BEFORE UPDATE ON public.validations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at
    BEFORE UPDATE ON public.feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feedback_templates_updated_at
    BEFORE UPDATE ON public.feedback_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role_value TEXT;
BEGIN
  -- Get role from metadata, default to 'trainee'
  user_role_value := COALESCE(NEW.raw_user_meta_data->>'role', 'trainee');
  
  -- Insert user profile (trigger runs with SECURITY DEFINER, so it bypasses RLS)
  BEGIN
    INSERT INTO public.users (id, email, name, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1), 'User'),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, public.users.name),
      updated_at = NOW();
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to create user profile in handle_new_user trigger: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to increment enrolled_count
CREATE OR REPLACE FUNCTION public.increment_enrolled_count(course_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.courses
    SET enrolled_count = enrolled_count + 1
    WHERE id = course_id;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update submission status when validation is completed
CREATE OR REPLACE FUNCTION public.update_submission_status_on_validation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.decision IS NOT NULL THEN
    UPDATE public.submissions
    SET 
      status = CASE 
        WHEN NEW.decision = 'approved' THEN 'approved'
        WHEN NEW.decision = 'rejected' THEN 'rejected'
        WHEN NEW.decision = 'revision_requested' THEN 'revision_requested'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = NEW.submission_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_submission_status_trigger
    AFTER UPDATE ON public.validations
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
    EXECUTE FUNCTION public.update_submission_status_on_validation();

-- ============================================================================
-- STEP 7: USER MANAGEMENT FUNCTIONS (Payroll-Pal Style)
-- ============================================================================

-- Function to get all users (admin only)
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
  id UUID,
  email VARCHAR(255),
  role TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  email_confirmed_at TIMESTAMPTZ,
  is_active BOOLEAN
) AS $$
BEGIN
  -- Check if user is admin
  IF public.get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can view all users';
  END IF;

  RETURN QUERY
  SELECT 
    au.id,
    au.email::VARCHAR(255),
    COALESCE(au.raw_user_meta_data->>'role', 'trainee')::TEXT as role,
    au.created_at,
    au.last_sign_in_at,
    au.email_confirmed_at,
    COALESCE((au.raw_user_meta_data->>'is_active')::BOOLEAN, true) as is_active
  FROM auth.users au
  ORDER BY au.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user role (admin only)
CREATE OR REPLACE FUNCTION public.update_user_role(user_id UUID, new_role TEXT)
RETURNS void AS $$
BEGIN
  -- Check if user is admin
  IF public.get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  -- Validate role (4 roles only)
  IF new_role NOT IN ('admin', 'training_officer', 'validator', 'trainee') THEN
    RAISE EXCEPTION 'Invalid role. Must be one of: admin, training_officer, validator, trainee';
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(new_role)
  )
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user email (admin only)
CREATE OR REPLACE FUNCTION public.update_user_email(user_id UUID, new_email TEXT)
RETURNS void AS $$
BEGIN
  -- Check if user is admin
  IF public.get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update user emails';
  END IF;

  UPDATE auth.users
  SET email = new_email,
      email_change_token_new = NULL,
      email_change = NULL
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set user active status (admin only)
CREATE OR REPLACE FUNCTION public.set_user_active_status(user_id UUID, is_active BOOLEAN)
RETURNS void AS $$
BEGIN
  -- Check if user is admin
  IF public.get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update user status';
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{is_active}',
    to_jsonb(is_active)
  )
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete user (admin only)
CREATE OR REPLACE FUNCTION public.delete_user_account(user_id UUID)
RETURNS void AS $$
BEGIN
  -- Check if user is admin
  IF public.get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Prevent deleting yourself
  IF user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  -- Delete user (this will cascade to related records)
  DELETE FROM auth.users WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 8: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 9: ENABLE RLS FOR ROLE ALIASES
-- ============================================================================

ALTER TABLE public.role_aliases ENABLE ROW LEVEL SECURITY;

-- Role aliases policies (everyone can view, only admins can modify)
CREATE POLICY "Anyone can view role aliases" ON public.role_aliases
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage role aliases" ON public.role_aliases
    FOR ALL USING (public.get_user_role() = 'admin');

-- ============================================================================
-- STEP 10: CREATE RLS POLICIES
-- ============================================================================

-- Users Policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins can update all users" ON public.users
    FOR UPDATE USING (public.get_user_role() = 'admin')
    WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Service role can insert users" ON public.users
    FOR INSERT WITH CHECK (true);

-- Courses Policies
CREATE POLICY "Anyone can view courses" ON public.courses
    FOR SELECT USING (true);

CREATE POLICY "Training officers and admins can create courses" ON public.courses
    FOR INSERT WITH CHECK (
        public.get_user_role() IN ('training_officer', 'admin')
    );

CREATE POLICY "Training officers and admins can update courses" ON public.courses
    FOR UPDATE USING (
        public.get_user_role() IN ('training_officer', 'admin')
    );

CREATE POLICY "Admins can delete courses" ON public.courses
    FOR DELETE USING (public.get_user_role() = 'admin');

-- Modules Policies
CREATE POLICY "Anyone can view modules" ON public.modules
    FOR SELECT USING (true);

CREATE POLICY "Training officers and admins can manage modules" ON public.modules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = modules.course_id
            AND (
                courses.instructor_id = auth.uid()
                OR public.get_user_role() IN ('admin', 'training_officer')
            )
        )
    );

-- Enrollments Policies
CREATE POLICY "Users can view own enrollments" ON public.enrollments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can enroll in courses" ON public.enrollments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own enrollments" ON public.enrollments
    FOR UPDATE USING (auth.uid() = user_id);

-- Certificates Policies
CREATE POLICY "Users can view own certificates" ON public.certificates
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can verify certificates" ON public.certificates
    FOR SELECT USING (true);

-- Jobs Policies
CREATE POLICY "Anyone can view open jobs" ON public.jobs
    FOR SELECT USING (status = 'open' OR posted_by = auth.uid());

CREATE POLICY "Training officers and admins can create jobs" ON public.jobs
    FOR INSERT WITH CHECK (
        public.get_user_role() IN ('training_officer', 'admin')
    );

CREATE POLICY "Training officers and admins can update jobs" ON public.jobs
    FOR UPDATE USING (
        posted_by = auth.uid() OR public.get_user_role() = 'admin'
    );

-- Job Applications Policies
CREATE POLICY "Users can view own applications" ON public.job_applications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own applications" ON public.job_applications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Training officers and admins can view job applications" ON public.job_applications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.jobs
            WHERE jobs.id = job_applications.job_id
            AND (jobs.posted_by = auth.uid() OR public.get_user_role() IN ('admin', 'training_officer'))
        )
    );

-- Notifications Policies
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

-- Submissions Policies
CREATE POLICY "Users can view own submissions" ON public.submissions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Validators can view all submissions" ON public.submissions
    FOR SELECT USING (
        public.get_user_role() IN ('validator', 'admin')
    );

CREATE POLICY "Users can create own submissions" ON public.submissions
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pending submissions" ON public.submissions
    FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Validators can update all submissions" ON public.submissions
    FOR UPDATE USING (
        public.get_user_role() IN ('validator', 'admin')
    );

-- Validations Policies
CREATE POLICY "Validators can view all validations" ON public.validations
    FOR SELECT USING (
        public.get_user_role() IN ('validator', 'admin')
    );

CREATE POLICY "Users can view own submission validations" ON public.validations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.submissions
            WHERE submissions.id = validations.submission_id
            AND submissions.user_id = auth.uid()
        )
    );

CREATE POLICY "Validators can create validations" ON public.validations
    FOR INSERT WITH CHECK (
        public.get_user_role() IN ('validator', 'admin')
    );

CREATE POLICY "Validators can update own validations" ON public.validations
    FOR UPDATE USING (validator_id = auth.uid());

-- Feedback Policies
CREATE POLICY "Validators can view all feedback" ON public.feedback
    FOR SELECT USING (
        public.get_user_role() IN ('validator', 'admin')
    );

CREATE POLICY "Users can view own submission feedback" ON public.feedback
    FOR SELECT USING (
        is_public = true AND
        EXISTS (
            SELECT 1 FROM public.submissions
            WHERE submissions.id = feedback.submission_id
            AND submissions.user_id = auth.uid()
        )
    );

CREATE POLICY "Validators can create feedback" ON public.feedback
    FOR INSERT WITH CHECK (
        public.get_user_role() IN ('validator', 'admin')
    );

CREATE POLICY "Validators can update own feedback" ON public.feedback
    FOR UPDATE USING (validator_id = auth.uid());

-- Feedback Templates Policies
CREATE POLICY "Validators can view feedback templates" ON public.feedback_templates
    FOR SELECT USING (
        is_active = true OR
        public.get_user_role() IN ('validator', 'admin')
    );

CREATE POLICY "Validators can manage feedback templates" ON public.feedback_templates
    FOR ALL USING (
        public.get_user_role() IN ('validator', 'admin')
    );

-- ============================================================================
-- STEP 11: INSERT DEFAULT DATA
-- ============================================================================

-- Insert default role aliases (can be customized by admins)
INSERT INTO public.role_aliases (role_code, display_name, description) VALUES
  ('admin', 'Administrator', 'Assigns and manages roles and defines access permissions'),
  ('training_officer', 'Training Officer', 'Accesses training-related modules only'),
  ('validator', 'Validator', 'Accesses validation and review modules only'),
  ('trainee', 'Trainee', 'Accesses learning, assessment, and progress modules only')
ON CONFLICT (role_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================================================
-- STEP 12: INSERT DEFAULT DATA (FEEDBACK TEMPLATES)
-- ============================================================================

-- Insert default feedback templates
INSERT INTO public.feedback_templates (name, category, content, is_active) VALUES
  ('Excellent Work', 'general', 'Excellent work! Your submission demonstrates a strong understanding of the concepts and meets all requirements. Well done!', true),
  ('Good Effort', 'general', 'Good effort overall. Your submission shows understanding, but there are a few areas that could be improved for better results.', true),
  ('Needs Improvement', 'general', 'Your submission needs improvement. Please review the requirements and consider revising your work to better address the key points.', true),
  ('Technical Issue', 'technical', 'There are some technical issues in your submission that need to be addressed. Please review the technical requirements and make necessary corrections.', true),
  ('Content Quality', 'content', 'The content quality could be enhanced. Consider adding more detail, examples, or explanations to strengthen your submission.', true),
  ('Formatting Issue', 'technical', 'Please review the formatting requirements. Your submission would benefit from better structure and organization.', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 13: GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT SELECT ON public.role_aliases TO authenticated;
GRANT ALL ON public.role_aliases TO authenticated;
GRANT ALL ON public.courses TO authenticated;
GRANT ALL ON public.modules TO authenticated;
GRANT ALL ON public.enrollments TO authenticated;
GRANT ALL ON public.module_completions TO authenticated;
GRANT ALL ON public.submissions TO authenticated;
GRANT ALL ON public.validations TO authenticated;
GRANT ALL ON public.feedback TO authenticated;
GRANT ALL ON public.feedback_templates TO authenticated;
GRANT ALL ON public.certificates TO authenticated;
GRANT ALL ON public.jobs TO authenticated;
GRANT ALL ON public.job_applications TO authenticated;
GRANT ALL ON public.notifications TO authenticated;

-- ============================================================================
-- STEP 12: ROLE MANAGEMENT HELPER FUNCTIONS (Payroll-Pal Style)
-- ============================================================================

-- Function to get role display name (with alias support)
CREATE OR REPLACE FUNCTION public.get_role_display_name(role_code TEXT)
RETURNS TEXT AS $$
DECLARE
  display_name TEXT;
BEGIN
  SELECT ra.display_name INTO display_name
  FROM public.role_aliases ra
  WHERE ra.role_code = role_code;
  
  -- Return alias if found, otherwise return default name
  RETURN COALESCE(display_name, 
    CASE role_code
      WHEN 'admin' THEN 'Administrator'
      WHEN 'training_officer' THEN 'Training Officer'
      WHEN 'validator' THEN 'Validator'
      WHEN 'trainee' THEN 'Trainee'
      ELSE role_code
    END
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update role alias (admin only)
CREATE OR REPLACE FUNCTION public.update_role_alias(role_code TEXT, display_name TEXT, description TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
  -- Check if user is admin
  IF public.get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update role aliases';
  END IF;

  -- Validate role code
  IF role_code NOT IN ('admin', 'training_officer', 'validator', 'trainee') THEN
    RAISE EXCEPTION 'Invalid role code. Must be one of: admin, training_officer, validator, trainee';
  END IF;

  INSERT INTO public.role_aliases (role_code, display_name, description)
  VALUES (role_code, display_name, description)
  ON CONFLICT (role_code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = COALESCE(EXCLUDED.description, role_aliases.description),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all role aliases
CREATE OR REPLACE FUNCTION public.get_all_role_aliases()
RETURNS TABLE (
  role_code TEXT,
  display_name TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ra.role_code,
    ra.display_name,
    ra.description,
    ra.updated_at
  FROM public.role_aliases ra
  ORDER BY 
    CASE ra.role_code
      WHEN 'admin' THEN 1
      WHEN 'training_officer' THEN 2
      WHEN 'validator' THEN 3
      WHEN 'trainee' THEN 4
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to set a user's role by email
CREATE OR REPLACE FUNCTION public.set_user_role_by_email(user_email TEXT, user_role TEXT)
RETURNS void AS $$
BEGIN
  -- Validate role (4 roles only)
  IF user_role NOT IN ('admin', 'training_officer', 'validator', 'trainee') THEN
    RAISE EXCEPTION 'Invalid role. Must be one of: admin, training_officer, validator, trainee';
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(user_role)
  )
  WHERE email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set a user's role by user ID (UUID)
CREATE OR REPLACE FUNCTION public.set_user_role_by_id(user_id UUID, user_role TEXT)
RETURNS void AS $$
BEGIN
  -- Validate role (4 roles only)
  IF user_role NOT IN ('admin', 'training_officer', 'validator', 'trainee') THEN
    RAISE EXCEPTION 'Invalid role. Must be one of: admin, training_officer, validator, trainee';
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(user_role)
  )
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get a user's role by email
CREATE OR REPLACE FUNCTION public.get_user_role_by_email(user_email TEXT)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT raw_user_meta_data->>'role' INTO user_role
  FROM auth.users
  WHERE email = user_email;
  
  RETURN COALESCE(user_role, 'trainee');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
-- 
-- Next Steps:
-- 1. Create your first admin user in Supabase Auth dashboard
-- 2. Set the role in user metadata: {"role": "admin"}
-- 3. The user profile will be automatically created via trigger
-- 4. You can now use the admin functions to manage users
--
-- To set a user role manually:
-- Option 1: Using helper function
-- SELECT public.set_user_role_by_email('admin@peso.academy', 'admin');
--
-- Option 2: Direct SQL
-- UPDATE auth.users
-- SET raw_user_meta_data = jsonb_set(
--   COALESCE(raw_user_meta_data, '{}'::jsonb),
--   '{role}',
--   '"admin"'  -- or 'training_officer', 'validator', 'trainee'
-- )
-- WHERE email = 'your-email@example.com';
--
-- To customize role display names:
-- SELECT public.update_role_alias('admin', 'System Admin', 'Manages system settings');
-- SELECT public.update_role_alias('training_officer', 'Training Manager', 'Manages training programs');
-- SELECT public.update_role_alias('validator', 'Quality Reviewer', 'Reviews and validates submissions');
-- SELECT public.update_role_alias('trainee', 'Learner', 'Completes training courses');
--
-- To get role display name:
-- SELECT public.get_role_display_name('admin');
--
-- To get all role aliases:
-- SELECT * FROM public.get_all_role_aliases();
--
-- ============================================================================

