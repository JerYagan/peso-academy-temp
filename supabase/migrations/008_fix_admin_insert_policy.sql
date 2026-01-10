-- Fix Admin Insert Policy for User Creation
-- This migration fixes the RLS policy to allow admins to create users properly

-- Step 1: Drop the existing admin insert policy
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;

-- Step 2: Improve the is_admin function to handle edge cases better
-- Make sure it can check admin status even when querying might be restricted
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Use SECURITY DEFINER to bypass RLS when checking admin status
  -- This ensures the function can always check if a user is an admin
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id AND role = 'admin'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error, return false to be safe
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 3: Create a more permissive admin insert policy
-- This policy allows admins to insert users by checking their role directly
-- Note: Triggers use SECURITY DEFINER and bypass RLS, so they don't need a policy
CREATE POLICY "Admins can insert users" ON public.users
    FOR INSERT
    WITH CHECK (public.is_admin(auth.uid()));

-- Step 4: Ensure the service role policy is still in place
-- This policy allows service role and triggers to insert
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;
CREATE POLICY "Service role can insert users" ON public.users
    FOR INSERT
    WITH CHECK (true);

-- Step 5: Verify the trigger function can handle errors gracefully
-- Update the handle_new_user function to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role_value user_role;
  role_text TEXT;
  user_name TEXT;
BEGIN
  -- Safely extract and validate role from metadata
  role_text := NEW.raw_user_meta_data->>'role';
  
  -- Try to cast to user_role enum, default to 'jobseeker' if invalid
  BEGIN
    IF role_text IS NOT NULL AND role_text != '' THEN
      user_role_value := role_text::user_role;
    ELSE
      user_role_value := 'jobseeker';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- If role is invalid, default to jobseeker
      user_role_value := 'jobseeker';
  END;

  -- Extract name from metadata or generate from email
  user_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    SPLIT_PART(NEW.email, '@', 1),
    'User'
  );

  -- Insert user profile (trigger runs with SECURITY DEFINER, so it bypasses RLS)
  -- Use ON CONFLICT to handle cases where profile already exists
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
    WHEN unique_violation THEN
      -- Email already exists - try to update existing record
      UPDATE public.users
      SET 
        name = COALESCE(NULLIF(user_name, ''), public.users.name),
        role = COALESCE(user_role_value, public.users.role),
        updated_at = NOW()
      WHERE email = NEW.email;
    WHEN OTHERS THEN
      -- Log the error but don't fail the auth user creation
      RAISE WARNING 'Failed to create user profile in handle_new_user trigger for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

