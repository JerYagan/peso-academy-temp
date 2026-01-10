-- Seed Initial Test Users for PESO Academy
-- This migration creates test users for all roles
-- IMPORTANT: Run this AFTER setting up Supabase Auth and creating the users table

-- Note: You need to create these users in Supabase Auth first, then update their profiles here
-- Or use the Supabase Dashboard to create users, then run this script to update their profiles

-- Function to create or update user profile
CREATE OR REPLACE FUNCTION create_test_user(
  p_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_role TEXT,
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_skills TEXT[] DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    name,
    role,
    phone,
    address,
    skills,
    created_at,
    updated_at
  )
  VALUES (
    p_id,
    p_email,
    p_name,
    p_role::user_role,
    p_phone,
    p_address,
    p_skills,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    skills = EXCLUDED.skills,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INSTRUCTIONS FOR CREATING TEST USERS:
-- ============================================
-- 
-- Method 1: Using Supabase Dashboard (Recommended)
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add User" → "Create New User"
-- 3. For each user below, create the auth user first, then copy the UUID
-- 4. Replace the UUIDs in the INSERT statements below with the actual UUIDs
-- 5. Run this SQL script
--
-- Method 2: Using Supabase Auth API
-- Use the supabaseAuthService.signup() function or Supabase CLI
--
-- ============================================
-- TEST USERS (Update UUIDs after creating in Auth)
-- ============================================

-- Job Seeker User
-- Email: jobseeker@peso.academy
-- Password: password123
-- UUID: Replace with actual UUID from Supabase Auth
DO $$
DECLARE
  jobseeker_id UUID;
BEGIN
  -- Try to find existing user by email, or use a placeholder UUID
  SELECT id INTO jobseeker_id FROM auth.users WHERE email = 'jobseeker@peso.academy' LIMIT 1;
  
  IF jobseeker_id IS NULL THEN
    -- If user doesn't exist in auth.users, you need to create it first
    RAISE NOTICE 'User jobseeker@peso.academy not found in auth.users. Please create the user in Supabase Auth first.';
  ELSE
    PERFORM create_test_user(
      jobseeker_id,
      'jobseeker@peso.academy',
      'Juan Dela Cruz',
      'jobseeker',
      '+63 912 345 6789',
      'Manila, Philippines',
      ARRAY['Basic Computer Skills', 'Communication', 'Customer Service']
    );
    RAISE NOTICE 'Created/Updated jobseeker user: %', jobseeker_id;
  END IF;
END $$;

-- Admin User
-- Email: admin@peso.academy
-- Password: admin123
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@peso.academy' LIMIT 1;
  
  IF admin_id IS NULL THEN
    RAISE NOTICE 'User admin@peso.academy not found in auth.users. Please create the user in Supabase Auth first.';
  ELSE
    PERFORM create_test_user(
      admin_id,
      'admin@peso.academy',
      'Admin User',
      'admin',
      '+63 912 345 6788',
      'Manila, Philippines',
      NULL
    );
    RAISE NOTICE 'Created/Updated admin user: %', admin_id;
  END IF;
END $$;

-- Trainer User
-- Email: trainer@peso.academy
-- Password: trainer123
DO $$
DECLARE
  trainer_id UUID;
BEGIN
  SELECT id INTO trainer_id FROM auth.users WHERE email = 'trainer@peso.academy' LIMIT 1;
  
  IF trainer_id IS NULL THEN
    RAISE NOTICE 'User trainer@peso.academy not found in auth.users. Please create the user in Supabase Auth first.';
  ELSE
    PERFORM create_test_user(
      trainer_id,
      'trainer@peso.academy',
      'Trainer Maria',
      'trainer',
      '+63 912 345 6787',
      'Manila, Philippines',
      ARRAY['Training', 'Course Development', 'Education']
    );
    RAISE NOTICE 'Created/Updated trainer user: %', trainer_id;
  END IF;
END $$;

-- Employer User
-- Email: employer@peso.academy
-- Password: employer123
DO $$
DECLARE
  employer_id UUID;
BEGIN
  SELECT id INTO employer_id FROM auth.users WHERE email = 'employer@peso.academy' LIMIT 1;
  
  IF employer_id IS NULL THEN
    RAISE NOTICE 'User employer@peso.academy not found in auth.users. Please create the user in Supabase Auth first.';
  ELSE
    PERFORM create_test_user(
      employer_id,
      'employer@peso.academy',
      'ABC Company',
      'employer',
      '+63 912 345 6786',
      'Makati, Philippines',
      NULL
    );
    RAISE NOTICE 'Created/Updated employer user: %', employer_id;
  END IF;
END $$;

-- Validator User
-- Email: validator@peso.academy
-- Password: validator123
DO $$
DECLARE
  validator_id UUID;
BEGIN
  SELECT id INTO validator_id FROM auth.users WHERE email = 'validator@peso.academy' LIMIT 1;
  
  IF validator_id IS NULL THEN
    RAISE NOTICE 'User validator@peso.academy not found in auth.users. Please create the user in Supabase Auth first.';
  ELSE
    PERFORM create_test_user(
      validator_id,
      'validator@peso.academy',
      'Validator John',
      'validator',
      '+63 912 345 6785',
      'Manila, Philippines',
      ARRAY['Validation', 'Quality Assurance']
    );
    RAISE NOTICE 'Created/Updated validator user: %', validator_id;
  END IF;
END $$;

-- SPD (Special Projects Division) User
-- Email: spd@peso.academy
-- Password: spd123
DO $$
DECLARE
  spd_id UUID;
BEGIN
  SELECT id INTO spd_id FROM auth.users WHERE email = 'spd@peso.academy' LIMIT 1;
  
  IF spd_id IS NULL THEN
    RAISE NOTICE 'User spd@peso.academy not found in auth.users. Please create the user in Supabase Auth first.';
  ELSE
    PERFORM create_test_user(
      spd_id,
      'spd@peso.academy',
      'SPD Manager',
      'spd',
      '+63 912 345 6784',
      'Manila, Philippines',
      ARRAY['Program Management', 'Content Development']
    );
    RAISE NOTICE 'Created/Updated SPD user: %', spd_id;
  END IF;
END $$;

-- Clean up helper function (optional, can be removed)
-- DROP FUNCTION IF EXISTS create_test_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]);

