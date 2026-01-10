# Quick User Setup - Step by Step

## Step 1: Create Users in Supabase Auth

You're currently on the Users page. Follow these steps:

### For Each User:

1. **Click the green "Add user" button** (top right)
2. **Select "Create new user"** from the dropdown
3. **Fill in the form:**
   - **Email**: Enter the email (e.g., `jobseeker@peso.academy`)
   - **Password**: Enter the password (e.g., `password123`)
   - **Auto Confirm User**: ✅ **CHECK THIS BOX** (important!)
   - **Send invitation email**: ❌ Leave unchecked
4. **Click "Create user"**
5. **Copy the User UUID** (you'll see it in the user list after creation)

### Create These 6 Users:

| # | Email | Password | Role | Auto Confirm |
|---|-------|----------|------|--------------|
| 1 | `jobseeker@peso.academy` | `password123` | jobseeker | ✅ Yes |
| 2 | `admin@peso.academy` | `admin123` | admin | ✅ Yes |
| 3 | `trainer@peso.academy` | `trainer123` | trainer | ✅ Yes |
| 4 | `employer@peso.academy` | `employer123` | employer | ✅ Yes |
| 5 | `validator@peso.academy` | `validator123` | validator | ✅ Yes |
| 6 | `spd@peso.academy` | `spd123` | spd | ✅ Yes |

## Step 2: Create User Profiles in Database

After creating all 6 auth users, you need to create their profiles in the `users` table.

### Option A: Use SQL Editor (Easiest)

1. **Go to SQL Editor** (left sidebar)
2. **Click "New Query"**
3. **Copy and paste this SQL** (it will automatically find users by email):

```sql
-- This script will automatically find users by email and create their profiles
-- Run this entire script at once

-- Job Seeker
DO $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM auth.users WHERE email = 'jobseeker@peso.academy' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.users (id, email, name, role, phone, address, skills, created_at, updated_at)
    VALUES (user_id, 'jobseeker@peso.academy', 'Juan Dela Cruz', 'jobseeker', '+63 912 345 6789', 'Manila, Philippines', 
            ARRAY['Basic Computer Skills', 'Communication', 'Customer Service'], NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      skills = EXCLUDED.skills,
      updated_at = NOW();
    RAISE NOTICE 'Created/Updated jobseeker user';
  END IF;
END $$;

-- Admin
DO $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM auth.users WHERE email = 'admin@peso.academy' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.users (id, email, name, role, phone, address, created_at, updated_at)
    VALUES (user_id, 'admin@peso.academy', 'Admin User', 'admin', '+63 912 345 6788', 'Manila, Philippines', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      updated_at = NOW();
    RAISE NOTICE 'Created/Updated admin user';
  END IF;
END $$;

-- Trainer
DO $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM auth.users WHERE email = 'trainer@peso.academy' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.users (id, email, name, role, phone, address, skills, created_at, updated_at)
    VALUES (user_id, 'trainer@peso.academy', 'Trainer Maria', 'trainer', '+63 912 345 6787', 'Manila, Philippines',
            ARRAY['Training', 'Course Development', 'Education'], NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      skills = EXCLUDED.skills,
      updated_at = NOW();
    RAISE NOTICE 'Created/Updated trainer user';
  END IF;
END $$;

-- Employer
DO $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM auth.users WHERE email = 'employer@peso.academy' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.users (id, email, name, role, phone, address, created_at, updated_at)
    VALUES (user_id, 'employer@peso.academy', 'ABC Company', 'employer', '+63 912 345 6786', 'Makati, Philippines', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      updated_at = NOW();
    RAISE NOTICE 'Created/Updated employer user';
  END IF;
END $$;

-- Validator
DO $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM auth.users WHERE email = 'validator@peso.academy' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.users (id, email, name, role, phone, address, skills, created_at, updated_at)
    VALUES (user_id, 'validator@peso.academy', 'Validator John', 'validator', '+63 912 345 6785', 'Manila, Philippines',
            ARRAY['Validation', 'Quality Assurance'], NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      skills = EXCLUDED.skills,
      updated_at = NOW();
    RAISE NOTICE 'Created/Updated validator user';
  END IF;
END $$;

-- SPD
DO $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM auth.users WHERE email = 'spd@peso.academy' LIMIT 1;
  IF user_id IS NOT NULL THEN
    INSERT INTO public.users (id, email, name, role, phone, address, skills, created_at, updated_at)
    VALUES (user_id, 'spd@peso.academy', 'SPD Manager', 'spd', '+63 912 345 6784', 'Manila, Philippines',
            ARRAY['Program Management', 'Content Development'], NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      skills = EXCLUDED.skills,
      updated_at = NOW();
    RAISE NOTICE 'Created/Updated SPD user';
  END IF;
END $$;
```

4. **Click "Run"** (or press Ctrl+Enter)
5. **Check the results** - you should see "Created/Updated" messages for each user

### Option B: Manual Insert (If Option A doesn't work)

If the automatic script doesn't work, you can manually insert each user:

1. **Get the UUID** of each user from the Users table
2. **Go to Table Editor** → **users** table
3. **Click "Insert"** → **"Insert row"**
4. **Fill in the fields** for each user:

**Example for Job Seeker:**
- `id`: (paste UUID from auth.users)
- `email`: `jobseeker@peso.academy`
- `name`: `Juan Dela Cruz`
- `role`: `jobseeker`
- `phone`: `+63 912 345 6789`
- `address`: `Manila, Philippines`
- `skills`: `["Basic Computer Skills", "Communication", "Customer Service"]`
- `created_at`: (leave as default)
- `updated_at`: (leave as default)

Repeat for all 6 users.

## Step 3: Verify Users

After creating profiles, verify everything works:

1. **Check users table**: Go to Table Editor → users → you should see 6 users
2. **Test login**: Go to your app and try logging in with:
   - `jobseeker@peso.academy` / `password123`

## Troubleshooting

### "User not found" error in SQL
- Make sure you created the auth user first
- Check the email spelling matches exactly
- Verify the user exists in Authentication → Users

### "Role does not exist" error
- Make sure you ran the initial schema migration first (`001_initial_schema.sql`)
- The role enum should include all 6 roles

### Can't insert into users table
- Check RLS policies are set up correctly
- Try using the SQL Editor with the script above (it bypasses some RLS checks)

## Quick Checklist

- [ ] Created 6 auth users in Authentication → Users
- [ ] All users have "Auto Confirm User" checked
- [ ] Ran the SQL script to create profiles
- [ ] Verified users appear in Table Editor → users
- [ ] Tested login with jobseeker@peso.academy

Once done, you can test authentication in your app! 🎉

