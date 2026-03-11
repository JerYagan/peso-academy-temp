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

### `seed-analytics-demo.ts`

Creates a fuller demo dataset for dashboard analytics and cross-role testing.

**Usage:**

```bash
npm run seed:analytics
```

**What it does:**
- Ensures admin, trainer, validator, SPD, and multiple trainee accounts exist
- Creates or updates demo courses, modules, assessments, and assessment questions
- Seeds enrollments across several months to populate trend charts
- Seeds module completions, assessment attempts, certificates, notifications, submissions, validations, and feedback
- Produces realistic enough data for trainee, trainer, validator, and admin dashboards

**Environment Variables Required:**
- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### `seed-course-content.ts`

Creates reusable demo courses with modules, content blocks, inline quiz blocks, and module assessments.

**Usage:**

```bash
npm run seed:courses
```

**What it does:**
- Ensures at least one trainer/admin/SPD instructor exists, creating a fallback trainer if needed
- Creates or updates demo courses by title
- Creates or updates modules by course and title
- Stores rich module content in `modules.content` as JSON content blocks
- Seeds inline quiz blocks inside module content and module-level assessments in the assessment tables
- Rewrites assessment questions for the seeded modules so reruns stay deterministic

**Environment Variables Required:**
- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### `audit-derived-assessments.ts`

Audits module quiz blocks against `assessments` and `assessment_questions`, then optionally backfills safe `quiz_blocks_only` modules.

**Usage:**

```bash
# Audit only and write a markdown report under temp_markdowns/
npm run audit:derived-assessments

# Audit and backfill modules that only have valid gradable quiz blocks
npm run backfill:derived-assessments

# Optional custom report path
npx tsx scripts/audit-derived-assessments.ts --report temp_markdowns/custom-derived-audit.md
```

**What it does:**
- Classifies modules into `quiz_blocks_only`, `assessment_tables_only`, `both_in_sync`, `both_mismatched`, or `no_assessment_source`
- Writes a cleanup-oriented markdown report for legacy and mismatched modules
- Backfills derived assessment rows/questions only for safe `quiz_blocks_only` modules when `--apply-backfill` is used
- Leaves `assessment_tables_only` and mismatched modules untouched so staff can review them before cleanup

**Environment Variables Required:**
- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Security Notes

⚠️ **Never commit your service role key to version control!**

The service role key has admin privileges and should be kept secret. Use environment variables or `.env.local` file (which is gitignored).

