-- Migration: Add INSERT policy for certificates table
-- This allows certificates to be auto-generated when users complete courses

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can insert own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Admins and training officers can issue certificates" ON public.certificates;

-- Policy 1: Users can have certificates issued for themselves
-- This allows auto-generation when a user completes a course
CREATE POLICY "Users can insert own certificates" ON public.certificates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy 2: Admins and training officers can issue certificates for any user
-- This allows manual certificate issuance by authorized roles
CREATE POLICY "Admins and training officers can issue certificates" ON public.certificates
    FOR INSERT WITH CHECK (
        public.get_user_role() IN ('admin', 'training_officer')
    );

-- Policy 3: Allow updates to certificates (for admins/training officers)
-- This allows updating certificate details if needed
DROP POLICY IF EXISTS "Admins and training officers can update certificates" ON public.certificates;

CREATE POLICY "Admins and training officers can update certificates" ON public.certificates
    FOR UPDATE USING (
        public.get_user_role() IN ('admin', 'training_officer')
    ) WITH CHECK (
        public.get_user_role() IN ('admin', 'training_officer')
    );
