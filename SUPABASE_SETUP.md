# Supabase Integration Setup Guide

This guide will help you set up Supabase for the PESO Academy project.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. Node.js and npm installed
3. Basic knowledge of SQL

## Step 1: Install Dependencies

```bash
npm install @supabase/supabase-js
```

## Step 2: Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in your project details:
   - Name: `peso-academy` (or your preferred name)
   - Database Password: (save this securely)
   - Region: Choose closest to your users
4. Wait for the project to be created (takes a few minutes)

## Step 3: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys")

## Step 4: Set Up Environment Variables

1. Create a `.env` file in the root directory of your project
2. Add the following:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Replace `your_project_url_here` and `your_anon_key_here` with the values from Step 3.

**Important**: Never commit your `.env` file to version control. It's already in `.gitignore`.

## Step 5: Run Database Migration

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste it into the SQL Editor
5. Click "Run" to execute the migration

This will create all the necessary tables, indexes, and Row Level Security (RLS) policies.

## Step 6: Verify Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Try to sign up a new user or log in
3. Check the Supabase dashboard → **Table Editor** to see if data is being created

## Database Schema Overview

The migration creates the following tables:

- **users** - User profiles (extends Supabase auth.users)
- **courses** - Training courses
- **modules** - Course modules
- **enrollments** - User course enrollments
- **module_completions** - Module completion tracking
- **submissions** - Assignment submissions
- **certificates** - Digital certificates
- **jobs** - Job postings
- **job_applications** - Job applications
- **notifications** - User notifications

## Row Level Security (RLS)

RLS policies are automatically created to ensure:
- Users can only access their own data
- Admins can access all data
- Public data (like courses) is accessible to everyone
- Role-based access control is enforced

## Troubleshooting

### Error: "Supabase client not initialized"
- Make sure your `.env` file exists and has the correct values
- Restart your development server after creating/updating `.env`

### Error: "relation does not exist"
- Make sure you've run the migration SQL script
- Check that all tables were created in the Supabase dashboard

### Authentication not working
- Verify your Supabase project is active
- Check that the API keys are correct
- Ensure RLS policies are set up correctly

### Type errors
- The database types are defined in `src/types/database.ts`
- Update this file if you modify the database schema

## Next Steps

1. **Test Authentication**: Try signing up and logging in
2. **Create Test Data**: Add some courses and enroll users
3. **Configure Storage**: Set up Supabase Storage for file uploads (videos, documents)
4. **Set Up Email Templates**: Configure email templates in Supabase Auth settings

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

## Migration from Mock Data

The old mock data services (`authService.ts` and `mockData.ts`) are still available for fallback. To fully migrate:

1. Update all components to use `supabaseAuthService` instead of `authService`
2. Update all components to use `supabaseDatabaseService` instead of `mockData`
3. Test thoroughly before removing old services

## Support

If you encounter issues, check:
1. Supabase project status in the dashboard
2. Browser console for error messages
3. Supabase logs in the dashboard → Logs

