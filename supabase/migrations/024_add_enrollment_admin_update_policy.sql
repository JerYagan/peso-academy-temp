-- Allow admins to update enrollments (e.g. set status to 'dropped' when unenrolling with "Preserve progress")
-- Without this, only the enrolled user can update their row, so admin "mark as dropped" was silently failing.

DROP POLICY IF EXISTS "Admins can update enrollments" ON public.enrollments;
CREATE POLICY "Admins can update enrollments" ON public.enrollments
    FOR UPDATE USING (public.get_user_role() = 'admin');

-- Trainers can update enrollments for their courses (e.g. mark as dropped for their course)
DROP POLICY IF EXISTS "Trainers can update course enrollments" ON public.enrollments;
CREATE POLICY "Trainers can update course enrollments" ON public.enrollments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = enrollments.course_id
            AND courses.instructor_id = auth.uid()
        )
    );
