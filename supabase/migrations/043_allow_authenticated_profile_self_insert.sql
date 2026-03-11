-- Allow authenticated users to create their own public.users profile row
-- when a linked profile is missing and the app needs a fallback owner id.

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

CREATE POLICY "Users can insert own profile" ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
);