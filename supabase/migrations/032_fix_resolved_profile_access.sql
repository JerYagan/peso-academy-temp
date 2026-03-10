-- Allow the application to read and update the resolved public.users profile row
-- when auth.uid() and the application profile id differ.

GRANT EXECUTE ON FUNCTION public.get_current_user_profile_id() TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can view own profile" ON public.users
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR id = public.get_current_user_profile_id()
);

CREATE POLICY "Users can update own profile" ON public.users
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR id = public.get_current_user_profile_id()
)
WITH CHECK (
  id = auth.uid()
  OR id = public.get_current_user_profile_id()
);
