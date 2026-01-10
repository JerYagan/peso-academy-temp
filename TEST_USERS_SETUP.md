# Test Users Setup Guide

This guide explains how to create initial test users for authentication testing in PESO Academy.

## Quick Setup Methods

### Method 1: Using Supabase Dashboard (Easiest) ⭐ Recommended

1. **Go to Supabase Dashboard**
   - Navigate to your project → **Authentication** → **Users**

2. **Create Users One by One**
   - Click **"Add User"** → **"Create New User"**
   - Fill in the details for each test user (see list below)
   - **Important**: Copy the User UUID after creation

3. **Update User Profiles**
   - Go to **SQL Editor** in Supabase Dashboard
   - Run the SQL script from `supabase/migrations/002_seed_initial_users.sql`
   - Or manually insert user profiles using the UUIDs you copied

#### Test Users to Create:

| Email | Password | Role | Name |
|-------|----------|------|------|
| `jobseeker@peso.academy` | `password123` | jobseeker | Juan Dela Cruz |
| `admin@peso.academy` | `admin123` | admin | Admin User |
| `trainer@peso.academy` | `trainer123` | trainer | Trainer Maria |
| `employer@peso.academy` | `employer123` | employer | ABC Company |
| `validator@peso.academy` | `validator123` | validator | Validator John |
| `spd@peso.academy` | `spd123` | spd | SPD Manager |

### Method 2: Using SQL Script (Automated)

1. **Create users in Supabase Auth first** (via Dashboard or API)

2. **Run the seed migration**:
   ```sql
   -- The script will automatically find users by email and update their profiles
   -- Run this in Supabase SQL Editor
   ```
   Copy and run `supabase/migrations/002_seed_initial_users.sql`

### Method 3: Using TypeScript Script (Most Automated)

1. **Install dependencies** (if not already installed):
   ```bash
   npm install tsx --save-dev
   ```

2. **Set environment variables**:
   ```bash
   export SUPABASE_URL="your_supabase_project_url"
   export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
   ```
   
   Or create a `.env.local` file:
   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
   
   **⚠️ Important**: Get your service role key from:
   - Supabase Dashboard → Settings → API → `service_role` key (secret)
   - **Never commit this key to version control!**

3. **Run the script**:
   ```bash
   npx tsx scripts/create-test-users.ts
   ```

   Or with environment variables:
   ```bash
   SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key npx tsx scripts/create-test-users.ts
   ```

## Manual SQL Insert (Alternative)

If you prefer to manually insert users, here's the SQL:

```sql
-- Example: Insert jobseeker user profile
-- Replace 'user-uuid-here' with the actual UUID from auth.users

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
) VALUES (
  'user-uuid-here',  -- Get this from auth.users table
  'jobseeker@peso.academy',
  'Juan Dela Cruz',
  'jobseeker',
  '+63 912 345 6789',
  'Manila, Philippines',
  ARRAY['Basic Computer Skills', 'Communication', 'Customer Service'],
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  skills = EXCLUDED.skills,
  updated_at = NOW();
```

## Step-by-Step: Dashboard Method (Detailed)

### Step 1: Create Auth Users

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Click **"Add User"** → **"Create New User"**
3. For each test user:
   - **Email**: Enter the email (e.g., `jobseeker@peso.academy`)
   - **Password**: Enter the password (e.g., `password123`)
   - **Auto Confirm User**: ✅ Check this (so email verification is skipped)
   - Click **"Create User"**
   - **Copy the User UUID** (you'll need this)

### Step 2: Create User Profiles

1. Go to **SQL Editor** in Supabase Dashboard
2. Click **"New Query"**
3. For each user, run this SQL (replace UUID and details):

```sql
INSERT INTO public.users (
  id, email, name, role, phone, address, skills, created_at, updated_at
) VALUES (
  'PASTE_UUID_HERE',  -- UUID from Step 1
  'jobseeker@peso.academy',
  'Juan Dela Cruz',
  'jobseeker',
  '+63 912 345 6789',
  'Manila, Philippines',
  ARRAY['Basic Computer Skills', 'Communication'],
  NOW(),
  NOW()
);
```

4. Repeat for all 6 test users

### Step 3: Verify Users

Run this query to verify all users are created:

```sql
SELECT id, email, name, role, created_at 
FROM public.users 
ORDER BY role, email;
```

## Test Credentials Summary

After setup, you can use these credentials to test:

### Job Seeker
- **Email**: `jobseeker@peso.academy`
- **Password**: `password123`
- **Dashboard**: `/dashboard`

### Admin
- **Email**: `admin@peso.academy`
- **Password**: `admin123`
- **Dashboard**: `/admin/users`

### Trainer
- **Email**: `trainer@peso.academy`
- **Password**: `trainer123`
- **Dashboard**: `/trainer/courses`

### Employer
- **Email**: `employer@peso.academy`
- **Password**: `employer123`
- **Dashboard**: `/employer/jobs`

### Validator
- **Email**: `validator@peso.academy`
- **Password**: `validator123`
- **Dashboard**: `/validator/dashboard`

### SPD (Special Projects Division)
- **Email**: `spd@peso.academy`
- **Password**: `spd123`
- **Dashboard**: `/trainer/courses`

## Troubleshooting

### User can't login
- ✅ Check user exists in `auth.users` table
- ✅ Check user profile exists in `public.users` table
- ✅ Verify password is correct
- ✅ Check email is confirmed (or auto-confirm was enabled)

### "User profile not found" error
- ✅ Ensure user profile was created in `public.users` table
- ✅ Verify the UUID matches between `auth.users` and `public.users`
- ✅ Check RLS policies allow the user to read their own profile

### Role not working
- ✅ Verify `role` field in `public.users` matches expected role
- ✅ Check role is one of: `jobseeker`, `admin`, `trainer`, `employer`, `validator`, `spd`
- ✅ Ensure role matches the enum type in database

### Script fails with "permission denied"
- ✅ Make sure you're using `service_role` key (not `anon` key)
- ✅ Verify the key has admin privileges
- ✅ Check RLS policies allow inserts (or temporarily disable RLS for testing)

## Security Notes

⚠️ **Important Security Reminders**:

1. **Never commit service role keys** to version control
2. **Change passwords** in production
3. **Disable test users** in production
4. **Use environment variables** for sensitive data
5. **Enable email verification** in production

## Next Steps

After creating test users:

1. ✅ Test login with each role
2. ✅ Verify role-based navigation works
3. ✅ Test protected routes
4. ✅ Verify dashboard access per role
5. ✅ Test signup flow for public roles

## Quick Test Checklist

- [ ] All 6 test users created in `auth.users`
- [ ] All 6 user profiles created in `public.users`
- [ ] Can login with each test user
- [ ] Each user redirected to correct dashboard
- [ ] Role-based routes work correctly
- [ ] Protected routes block unauthorized access

Happy testing! 🎉

