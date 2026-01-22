-- ============================================================================
-- Fix Admin Access Script
-- Run this in Supabase SQL Editor to fix admin access to user management
-- ============================================================================

-- Step 1: Update the is_admin function to handle TEXT role column
-- This function checks if a user is an admin by looking at their role in public.users
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

-- Step 2: Verify admin users exist in public.users table
-- Check if your admin users have records in public.users
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'role' as auth_role,
  pu.role as db_role,
  CASE 
    WHEN pu.id IS NULL THEN '❌ Missing in public.users'
    WHEN pu.role::text = 'admin' THEN '✅ Admin in DB'
    ELSE '⚠️ Not admin in DB'
  END as status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.raw_user_meta_data->>'role' = 'admin'
   OR au.email IN ('admin@peso.academy', 'zyrusinso@gmail.com');

-- Step 3: If admin users are missing from public.users, create their records
-- This will create records for admins that exist in auth.users but not in public.users
INSERT INTO public.users (id, email, name, role, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', SPLIT_PART(au.email, '@', 1), 'User') as name,
  COALESCE(au.raw_user_meta_data->>'role', 'admin') as role,
  au.created_at,
  NOW()
FROM auth.users au
WHERE (au.raw_user_meta_data->>'role' = 'admin' 
       OR au.email IN ('admin@peso.academy', 'zyrusinso@gmail.com'))
  AND NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.id = au.id
  )
ON CONFLICT (id) DO UPDATE
SET role = 'admin', updated_at = NOW();

-- Step 4: Ensure all admin users have 'admin' role in public.users
UPDATE public.users pu
SET role = 'admin', updated_at = NOW()
FROM auth.users au
WHERE pu.id = au.id
  AND au.raw_user_meta_data->>'role' = 'admin'
  AND pu.role::text != 'admin';

-- Step 5: Test the is_admin function
-- Replace 'YOUR_USER_ID' with your actual user UUID (from the query above)
-- SELECT public.is_admin('YOUR_USER_ID'::uuid);

-- Step 6: Final verification - check RLS policy will work
SELECT 
  au.email,
  au.id as user_id,
  pu.role as db_role,
  public.is_admin(au.id) as is_admin_check,
  CASE 
    WHEN public.is_admin(au.id) THEN '✅ Can access admin pages'
    ELSE '❌ Cannot access admin pages'
  END as access_status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.email IN ('admin@peso.academy', 'zyrusinso@gmail.com')
   OR au.raw_user_meta_data->>'role' = 'admin';

