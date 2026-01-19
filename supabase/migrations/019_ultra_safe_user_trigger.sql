-- Ultra-safe user creation trigger that NEVER fails
-- This ensures auth user creation always succeeds even if profile creation fails
-- The application will handle profile creation manually if needed

-- Step 0: CRITICAL - Ensure user_role enum exists BEFORE creating the trigger
-- This fixes the error: ERROR: type "user_role" does not exist
-- Check in pg_type with schema qualification to be sure
DO $$ 
BEGIN
    -- Check if enum exists in public schema
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'user_role'
    ) THEN
        -- Create the enum in public schema explicitly
        CREATE TYPE public.user_role AS ENUM ('jobseeker', 'admin', 'trainer', 'employer', 'validator', 'spd');
        RAISE NOTICE 'Created user_role enum type in public schema';
    ELSE
        RAISE NOTICE 'user_role enum type already exists in public schema';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Enum already exists, that's fine
        RAISE NOTICE 'user_role enum already exists';
    WHEN OTHERS THEN
        -- Log the error but try to continue
        RAISE WARNING 'Error checking/creating user_role enum: %', SQLERRM;
END $$;

-- Step 1: Drop and recreate the trigger function with maximum error tolerance
-- Set search_path to ensure we can access public schema
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  user_role_value user_role := 'jobseeker';
  role_text TEXT;
  user_name TEXT;
  user_email TEXT;
BEGIN
  -- Extract email safely
  BEGIN
    user_email := COALESCE(NEW.email, '');
  EXCEPTION
    WHEN OTHERS THEN
      user_email := '';
  END;

  -- Extract and validate role from metadata with maximum safety
  BEGIN
    role_text := COALESCE(NEW.raw_user_meta_data->>'role', '');
    
    IF role_text IS NOT NULL AND role_text != '' AND role_text != 'null' THEN
      BEGIN
        -- Try to cast to user_role enum
        user_role_value := role_text::user_role;
      EXCEPTION
        WHEN OTHERS THEN
          -- If casting fails, use default
          user_role_value := 'jobseeker';
      END;
    ELSE
      user_role_value := 'jobseeker';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      user_role_value := 'jobseeker';
  END;

  -- Extract name from metadata or generate from email
  BEGIN
    user_name := COALESCE(
      NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'name', '')), ''),
      NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
      NULLIF(SPLIT_PART(user_email, '@', 1), ''),
      'User'
    );
    
    -- Ensure name is not empty
    IF user_name IS NULL OR TRIM(user_name) = '' THEN
      user_name := COALESCE(SPLIT_PART(user_email, '@', 1), 'User');
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      user_name := COALESCE(SPLIT_PART(user_email, '@', 1), 'User');
  END;

  -- Ensure we have valid data before attempting insert
  IF user_email IS NULL OR TRIM(user_email) = '' THEN
    user_email := NEW.id::text || '@temp.local';
  END IF;
  
  IF user_name IS NULL OR TRIM(user_name) = '' THEN
    user_name := 'User';
  END IF;

  -- Try to insert user profile - use the simplest possible approach
  -- ON CONFLICT DO NOTHING ensures we never fail, even if user already exists
  -- This is wrapped in a block to catch any unexpected errors
  BEGIN
    INSERT INTO public.users (id, email, name, role, created_at, updated_at)
    VALUES (
      NEW.id,
      user_email,
      user_name,
      user_role_value,
      COALESCE(NEW.created_at, NOW()),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN OTHERS THEN
      -- If insert fails for any reason, just continue
      -- The application will handle profile creation manually if needed
      NULL;
  END;
  
  -- ALWAYS return NEW to allow auth user creation to succeed
  -- Even if profile creation failed, the auth user should still be created
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Ultimate fallback: if anything goes wrong, just return NEW
    -- This ensures auth user creation never fails due to trigger issues
    RETURN NEW;
END;
$$;

-- Step 2: Ensure trigger exists and is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Ensure function has proper security settings and ownership
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Step 4: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, anon, authenticated, service_role;
