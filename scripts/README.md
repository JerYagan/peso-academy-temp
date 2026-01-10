# Scripts Directory

This directory contains utility scripts for PESO Academy.

## Available Scripts

### `create-test-users.ts`

Creates initial test users for authentication testing.

**Usage:**

```bash
# Set environment variables
export SUPABASE_URL="your_supabase_project_url"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"

# Run the script
npm run seed:users

# Or directly with tsx
npx tsx scripts/create-test-users.ts
```

**Environment Variables Required:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (get from Dashboard → Settings → API)

**What it does:**
- Creates 6 test users (one for each role)
- Sets up user profiles in the database
- Auto-confirms email addresses
- Prints test credentials

**Test Users Created:**
- `jobseeker@peso.academy` / `password123`
- `admin@peso.academy` / `admin123`
- `trainer@peso.academy` / `trainer123`
- `employer@peso.academy` / `employer123`
- `validator@peso.academy` / `validator123`
- `spd@peso.academy` / `spd123`

## Security Notes

⚠️ **Never commit your service role key to version control!**

The service role key has admin privileges and should be kept secret. Use environment variables or `.env.local` file (which is gitignored).

