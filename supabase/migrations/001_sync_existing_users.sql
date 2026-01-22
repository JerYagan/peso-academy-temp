-- Sync Existing Auth Users to Users Table
-- Run this script to create user profiles for existing auth users
-- This fixes the 406 error by creating profiles for users that were created before the trigger was set up

-- Step 1: Create user profiles for all auth users that don't have profiles
INSERT INTO public.users (id, email, name, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'name',
    SPLIT_PART(au.email, '@', 1),
    'User'
  ) as name,
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = COALESCE(EXCLUDED.name, public.users.name),
  updated_at = NOW();

-- Step 2: Verify users were created
SELECT 
  u.id,
  u.email,
  u.name,
  au.raw_user_meta_data->>'role' as role_in_metadata,
  au.created_at as auth_created_at,
  u.created_at as profile_created_at
FROM public.users u
JOIN auth.users au ON au.id = u.id
ORDER BY u.created_at DESC;

-- Step 3: Check if trigger exists (should return 1 row)
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
