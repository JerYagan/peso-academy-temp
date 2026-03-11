-- Run this in Supabase SQL Editor if the migration has not yet been applied.
-- Allows authenticated users to self-heal a missing public.users row for their own auth account.

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

CREATE POLICY "Users can insert own profile" ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
);