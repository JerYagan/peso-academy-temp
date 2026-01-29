-- Migration: Add RLS policy for trainers to view users enrolled in their courses
-- This allows trainers to see learner profiles for users enrolled in courses they teach

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Trainers can view enrolled learners" ON public.users;

-- Policy: Trainers can view users who are enrolled in courses they teach
CREATE POLICY "Trainers can view enrolled learners" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.enrollments e
            JOIN public.courses c ON e.course_id = c.id
            WHERE e.user_id = users.id
            AND c.instructor_id = auth.uid()
        )
    );
