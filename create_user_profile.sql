-- ============================================
-- Create User Profile for Existing Auth User
-- ============================================
-- This script creates a profile in public.users for zyrusinso@gmail.com
-- Run this to ensure the user has a profile with a role

-- Step 1: Create profile for zyrusinso@gmail.com if it doesn't exist
INSERT INTO public.users (id, email, name, role, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'name',
    SPLIT_PART(au.email, '@', 1),
    'User'
  ) as name,
  'admin' as role,  -- Set to admin so you can access admin features
  au.created_at,
  NOW()
FROM auth.users au
WHERE au.email = 'zyrusinso@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.id = au.id
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = COALESCE(EXCLUDED.name, public.users.name),
  updated_at = NOW();

-- Step 2: Update role if profile already exists
UPDATE public.users 
SET role = 'admin', updated_at = NOW()
WHERE email = 'zyrusinso@gmail.com';

-- Step 3: Verify the profile was created/updated
SELECT 
  id,
  email,
  name,
  role,
  created_at,
  updated_at
FROM public.users
WHERE email = 'zyrusinso@gmail.com';

-- Step 4: Also sync any other users that might be missing
INSERT INTO public.users (id, email, name, role, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'name',
    SPLIT_PART(au.email, '@', 1),
    'User'
  ) as name,
  COALESCE(
    (au.raw_user_meta_data->>'role')::user_role,
    'jobseeker'
  ) as role,
  au.created_at,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Step 5: View all users
SELECT 
  id,
  email,
  name,
  role,
  created_at
FROM public.users
ORDER BY created_at DESC;

