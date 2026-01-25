-- ============================================================================
-- Fix RLS Policy for Roles Table
-- This allows admins to insert/update/delete roles
-- ============================================================================

-- Step 1: Ensure is_admin() function checks public.users table (not auth.users)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id 
    AND role::text = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 2: Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;

-- Step 3: Create new policy using is_admin() function
CREATE POLICY "Admins can manage roles" ON public.roles
    FOR ALL USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- Step 4: Ensure admin users exist in public.users with admin role
-- Option A: If auth.uid() is available (you're logged in)
DO $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT := auth.email();
BEGIN
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.users (id, email, role, created_at, updated_at)
    SELECT 
      v_user_id,
      v_user_email,
      'admin',
      COALESCE((SELECT created_at FROM auth.users WHERE id = v_user_id), NOW()),
      NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_user_id)
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin', updated_at = NOW();
    
    RAISE NOTICE '✅ Updated user % to admin role', v_user_email;
  ELSE
    RAISE NOTICE '⚠️ auth.uid() is NULL. Use Option B below to set admin by email.';
  END IF;
END $$;

-- Option B: Set admin role for specific users by email (uncomment and modify as needed)
-- This works even if auth.uid() is NULL
UPDATE public.users
SET role = 'admin', updated_at = NOW()
WHERE email IN ('admin@peso.academy', 'zyrusinso@gmail.com');

-- Create records for admins that exist in auth.users but not in public.users
INSERT INTO public.users (id, email, role, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  'admin',
  au.created_at,
  NOW()
FROM auth.users au
WHERE au.email IN ('admin@peso.academy', 'zyrusinso@gmail.com')
  AND NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id);

-- Step 5: Verify the policy works
SELECT 
  'Policy Test' as test,
  auth.uid() as user_id,
  auth.email() as user_email,
  public.is_admin(auth.uid()) as is_admin_check,
  CASE 
    WHEN public.is_admin(auth.uid()) THEN '✅ You can manage roles'
    ELSE '❌ You cannot manage roles - check your admin status in public.users table'
  END as status;

-- Test: Try to insert a test role (will be rolled back)
-- Uncomment to test:
-- BEGIN;
-- INSERT INTO public.roles (id, name, description, category, dashboard_route, can_signup) 
-- VALUES ('test_role', 'Test Role', 'Test', 'internal', '/dashboard', false);
-- ROLLBACK;

