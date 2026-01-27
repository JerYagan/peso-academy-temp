-- Add RLS policies for module_completions table
-- This allows users to mark modules as complete for their own enrollments

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own module completions" ON public.module_completions;
DROP POLICY IF EXISTS "Users can create own module completions" ON public.module_completions;
DROP POLICY IF EXISTS "Users can update own module completions" ON public.module_completions;
DROP POLICY IF EXISTS "Trainers can view course module completions" ON public.module_completions;

-- Policy 1: Users can view their own module completions
-- (via enrollment relationship - user must own the enrollment)
CREATE POLICY "Users can view own module completions" ON public.module_completions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.enrollments
            WHERE enrollments.id = module_completions.enrollment_id
            AND enrollments.user_id = auth.uid()
        )
    );

-- Policy 2: Users can insert module completions for their own enrollments
CREATE POLICY "Users can create own module completions" ON public.module_completions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.enrollments
            WHERE enrollments.id = module_completions.enrollment_id
            AND enrollments.user_id = auth.uid()
        )
    );

-- Policy 3: Users can update their own module completions
CREATE POLICY "Users can update own module completions" ON public.module_completions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.enrollments
            WHERE enrollments.id = module_completions.enrollment_id
            AND enrollments.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.enrollments
            WHERE enrollments.id = module_completions.enrollment_id
            AND enrollments.user_id = auth.uid()
        )
    );

-- Policy 4: Trainers and admins can view module completions for their courses
CREATE POLICY "Trainers can view course module completions" ON public.module_completions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.enrollments e
            JOIN public.courses c ON e.course_id = c.id
            WHERE e.id = module_completions.enrollment_id
            AND (
                c.instructor_id = auth.uid()
                OR public.get_user_role() IN ('admin', 'training_officer')
            )
        )
    );
