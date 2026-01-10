-- Fix trigger to work even if enum doesn't exist initially
-- This migration should be run AFTER 012_ensure_user_role_enum_exists.sql

-- Step 1: Ensure user_role enum exists (safety check)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('jobseeker', 'admin', 'trainer', 'employer', 'validator', 'spd');
        RAISE NOTICE 'Created user_role enum type';
    END IF;
END $$;

-- Step 2: Recreate the trigger function with better error handling
-- This version handles the case where enum might not exist during function creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role_value user_role := 'jobseeker';
  role_text TEXT;
  user_name TEXT;
BEGIN
  -- Extract and validate role from metadata
  BEGIN
    role_text := NEW.raw_user_meta_data->>'role';
    
    IF role_text IS NOT NULL AND role_text != '' THEN
      BEGIN
        user_role_value := role_text::user_role;
      EXCEPTION
        WHEN OTHERS THEN
          -- If casting fails (enum doesn't exist or invalid value), use default
          user_role_value := 'jobseeker';
      END;
    ELSE
      user_role_value := 'jobseeker';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- If anything fails, use default
      user_role_value := 'jobseeker';
  END;

  -- Extract name from metadata or generate from email
  BEGIN
    user_name := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      SPLIT_PART(NEW.email, '@', 1),
      'User'
    );
  EXCEPTION
    WHEN OTHERS THEN
      user_name := COALESCE(SPLIT_PART(NEW.email, '@', 1), 'User');
  END;

  -- Insert user profile (trigger runs with SECURITY DEFINER, so it bypasses RLS)
  BEGIN
    INSERT INTO public.users (id, email, name, role, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      user_name,
      user_role_value,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(NULLIF(EXCLUDED.name, ''), public.users.name),
      role = COALESCE(EXCLUDED.role, public.users.role),
      updated_at = NOW();
  EXCEPTION
    WHEN OTHERS THEN
      -- Silently ignore all errors - don't fail auth user creation
      -- The application will handle profile creation manually
      NULL;
  END;
  
  -- Always return NEW to allow auth user creation to succeed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

