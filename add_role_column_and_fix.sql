-- ============================================================================
-- Add Role Column to public.users and Fix Admin Access
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Add role column to public.users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE public.users ADD COLUMN role TEXT NOT NULL DEFAULT 'jobseeker';
        RAISE NOTICE '✅ Added role column to public.users table';
    ELSE
        RAISE NOTICE '⚠️ Role column already exists';
    END IF;
END $$;

-- Step 2: Set admin role for admin users
UPDATE public.users
SET role = 'admin'
WHERE email IN ('admin@peso.academy', 'zyrusinso@gmail.com');

-- Step 3: Set roles for other users based on their emails/names
UPDATE public.users
SET role = 'trainer'
WHERE email = 'trainer@gmail.com';

UPDATE public.users
SET role = 'employer'
WHERE email = 'employer@gmail.com';

-- Step 4: Update is_admin function to work with TEXT role
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

-- Step 5: Verify the fix
SELECT 
  'Verification' as test,
  pu.id,
  pu.email,
  pu.role,
  public.is_admin(pu.id) as is_admin_check,
  CASE 
    WHEN public.is_admin(pu.id) THEN '✅ Admin access granted'
    ELSE '❌ No admin access'
  END as status
FROM public.users pu
WHERE pu.email IN ('admin@peso.academy', 'zyrusinso@gmail.com');

-- Step 6: Test RLS policy
SELECT 
  'RLS Test' as test_name,
  COUNT(*) as visible_users,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ RLS Policy Working - You can see users!'
    ELSE '❌ RLS Policy Still Blocking'
  END as rls_status
FROM public.users
WHERE public.is_admin(auth.uid());

