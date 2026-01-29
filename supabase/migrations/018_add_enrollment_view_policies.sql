-- Migration: Add additional RLS policies for enrollments table
-- This ensures admins and trainers can view enrollments for their courses

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Admins can view all enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Trainers can view course enrollments" ON public.enrollments;

-- Policy 1: Admins can view all enrollments
CREATE POLICY "Admins can view all enrollments" ON public.enrollments
    FOR SELECT USING (
        public.get_user_role() = 'admin'
    );

-- Policy 2: Trainers can view enrollments for their courses
-- This policy allows trainers to see enrollments for courses they teach
-- It checks if the course instructor_id matches auth.uid()
CREATE POLICY "Trainers can view course enrollments" ON public.enrollments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = enrollments.course_id
            AND courses.instructor_id = auth.uid()
        )
    );
