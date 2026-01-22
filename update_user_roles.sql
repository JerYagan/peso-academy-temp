-- ============================================================================
-- Update User Roles Script (SIMPLIFIED)
-- Run this in Supabase SQL Editor to fix user roles
-- This updates both auth.users (auth metadata) and public.users (database table)
-- ============================================================================

-- Step 0: Add role column if it doesn't exist (as TEXT to avoid enum issues)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE public.users ADD COLUMN role TEXT NOT NULL DEFAULT 'trainee';
        RAISE NOTICE 'Added role column to users table';
    ELSE
        RAISE NOTICE 'Role column already exists';
    END IF;
END $$;

-- Step 1: Update admin user roles in auth.users (auth metadata)
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email IN ('admin@peso.academy', 'zyrusinso@gmail.com');

-- Step 2: Update admin user roles in public.users (database table)
UPDATE public.users
SET role = 'admin'
WHERE email IN ('admin@peso.academy', 'zyrusinso@gmail.com');

-- Step 3: Update training officer role
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"training_officer"'
)
WHERE email = 'trainer@gmail.com';

UPDATE public.users
SET role = 'training_officer'
WHERE email = 'trainer@gmail.com';

-- Step 4: Sync all existing users (ensures roles match between both tables)
UPDATE auth.users au
SET raw_user_meta_data = jsonb_set(
  COALESCE(au.raw_user_meta_data, '{}'::jsonb),
  '{role}',
  to_jsonb(pu.role)
)
FROM public.users pu
WHERE au.id = pu.id
  AND pu.role IS NOT NULL
  AND (au.raw_user_meta_data->>'role' IS NULL 
       OR au.raw_user_meta_data->>'role' != pu.role);

-- Step 5: Verify the roles were updated correctly
SELECT 
  au.email,
  au.raw_user_meta_data->>'role' as auth_role,
  pu.role as db_role,
  CASE 
    WHEN au.raw_user_meta_data->>'role' = pu.role THEN '✅ Synced'
    ELSE '❌ Mismatch'
  END as sync_status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
ORDER BY au.email;
