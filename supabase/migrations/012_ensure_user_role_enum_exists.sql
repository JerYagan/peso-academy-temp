-- Ensure user_role enum exists before triggers try to use it
-- This fixes the error: ERROR: type "user_role" does not exist

-- Step 1: Create the user_role enum if it doesn't exist
-- Use DO block to avoid errors if it already exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('jobseeker', 'admin', 'trainer', 'employer', 'validator', 'spd');
        RAISE NOTICE 'Created user_role enum type';
    ELSE
        RAISE NOTICE 'user_role enum type already exists';
    END IF;
END $$;

-- Step 2: Verify the enum was created
-- Run this query to check: SELECT typname FROM pg_type WHERE typname = 'user_role';

-- Step 3: If the users table exists but doesn't have the role column with correct type, fix it
DO $$
BEGIN
    -- Check if users table exists and has role column
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
    ) THEN
        -- Check if role column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'role'
        ) THEN
            -- Check if the column type is correct
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'users' 
                AND column_name = 'role'
                AND udt_name = 'user_role'
            ) THEN
                -- Column exists but wrong type - alter it
                ALTER TABLE public.users 
                ALTER COLUMN role TYPE user_role 
                USING role::text::user_role;
                RAISE NOTICE 'Updated role column to use user_role enum type';
            ELSE
                RAISE NOTICE 'Role column already has correct type';
            END IF;
        ELSE
            -- Column doesn't exist - add it
            ALTER TABLE public.users 
            ADD COLUMN role user_role NOT NULL DEFAULT 'jobseeker';
            RAISE NOTICE 'Added role column to users table';
        END IF;
    ELSE
        RAISE NOTICE 'Users table does not exist yet';
    END IF;
END $$;

-- Step 4: Update any NULL roles to 'jobseeker' (safety check)
UPDATE public.users 
SET role = 'jobseeker' 
WHERE role IS NULL;

