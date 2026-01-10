-- Setup Roles and Admin Policies for PESO Academy
-- This migration ensures roles are properly set up and admins can manage users

-- Step 1: Create the user_role enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('jobseeker', 'admin', 'trainer', 'employer', 'validator', 'spd');
        RAISE NOTICE 'Created user_role enum type';
    ELSE
        RAISE NOTICE 'user_role enum type already exists';
    END IF;
END $$;

-- Step 2: Ensure users table exists with role column
-- If the table doesn't exist, create it
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'jobseeker',
    avatar TEXT,
    phone TEXT,
    address TEXT,
    skills TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Add role column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE public.users ADD COLUMN role user_role NOT NULL DEFAULT 'jobseeker';
        RAISE NOTICE 'Added role column to users table';
    ELSE
        RAISE NOTICE 'Role column already exists in users table';
    END IF;
END $$;

-- Step 4: Update existing users without roles to have 'jobseeker' role
UPDATE public.users 
SET role = 'jobseeker' 
WHERE role IS NULL;

-- Step 5: Enable Row Level Security if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies if they exist (to recreate them properly)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;

-- Step 7: Create helper function to check if user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 8: Create RLS Policies for Users Table

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT 
    USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy 3: Admins can view all users (using helper function to avoid recursion)
CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT 
    USING (public.is_admin(auth.uid()));

-- Policy 4: Admins can update all users (using helper function to avoid recursion)
CREATE POLICY "Admins can update all users" ON public.users
    FOR UPDATE 
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- Policy 5: Allow admins to insert users (for admin-created users)
CREATE POLICY "Admins can insert users" ON public.users
    FOR INSERT
    WITH CHECK (public.is_admin(auth.uid()));

-- Policy 6: Allow service role and triggers to insert (for signup and triggers)
-- The trigger function uses SECURITY DEFINER, so it runs with the function owner's privileges
-- But we still need a policy for the insert to work
CREATE POLICY "Service role can insert users" ON public.users
    FOR INSERT
    WITH CHECK (true);

-- Step 9: Create function to prevent users from changing their own role
CREATE OR REPLACE FUNCTION prevent_role_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow updates when running as service role (auth.uid() is NULL)
    -- This allows SQL scripts and admin operations to work
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- If user is not an admin, prevent role changes (use helper function to avoid recursion)
    IF NOT public.is_admin(auth.uid()) THEN
        -- If role is being changed, raise error
        IF OLD.role IS DISTINCT FROM NEW.role THEN
            RAISE EXCEPTION 'Users cannot change their own role. Only admins can change user roles.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Create trigger to prevent role changes (before updated_at trigger)
DROP TRIGGER IF EXISTS prevent_role_change_trigger ON public.users;
CREATE TRIGGER prevent_role_change_trigger 
    BEFORE UPDATE ON public.users
    FOR EACH ROW 
    EXECUTE FUNCTION prevent_role_change();

-- Step 12: Create trigger for updated_at (if it doesn't exist)
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Step 13: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;

-- Step 14: Create index on role for better query performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Step 15: Create function to automatically create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role_value user_role;
  role_text TEXT;
BEGIN
  -- Safely extract and validate role from metadata
  role_text := NEW.raw_user_meta_data->>'role';
  
  -- Try to cast to user_role enum, default to 'jobseeker' if invalid
  BEGIN
    IF role_text IS NOT NULL THEN
      user_role_value := role_text::user_role;
    ELSE
      user_role_value := 'jobseeker';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- If role is invalid, default to jobseeker
      user_role_value := 'jobseeker';
  END;

  -- Insert user profile (trigger runs with SECURITY DEFINER, so it bypasses RLS)
  BEGIN
    INSERT INTO public.users (id, email, name, role, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1), 'User'),
      user_role_value,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, public.users.name),
      role = EXCLUDED.role,
      updated_at = NOW();
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the auth user creation
      -- The manual insert in the application will handle it
      RAISE WARNING 'Failed to create user profile in handle_new_user trigger: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 16: Create trigger to auto-create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 17: Sync existing auth users to public.users table
-- This will create profiles for users that already exist in auth.users
INSERT INTO public.users (id, email, name, role, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', au.email, 'User'),
  COALESCE((au.raw_user_meta_data->>'role')::user_role, 'jobseeker'),
  au.created_at,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Verification queries (run these to check if everything is set up correctly)
-- SELECT * FROM pg_type WHERE typname = 'user_role';
-- SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role';
-- SELECT tablename, policyname FROM pg_policies WHERE tablename = 'users';
-- Check if users were synced: SELECT COUNT(*) FROM public.users;

