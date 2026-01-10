# Authentication and Role Setup Guide

This guide explains how authentication and role-based access control (RBAC) is implemented in PESO Academy.

## Overview

The authentication system uses Supabase Auth for secure user authentication and role-based access control. Each user has a role that determines what they can access and do in the system.

## User Roles

### Available Roles

1. **jobseeker** - Job seekers accessing training courses
2. **admin** - System administrators with full access
3. **trainer** - Trainers who create and manage courses
4. **employer** - Employers posting jobs and viewing candidates
5. **validator** - Internal users who validate training completions
6. **spd** - Special Projects Division managing training programs

### Role Categories

- **Internal Users**: `admin`, `validator`
- **End Users**: `jobseeker`, `trainer`, `employer`, `spd`

## Authentication Flow

### 1. Sign Up Process

1. User fills out signup form with:
   - Full name
   - Email address
   - Password (minimum 6 characters)
   - Role selection (only public roles available: `jobseeker`, `employer`)

2. System validates:
   - Email format
   - Password strength
   - Role availability (only public roles can be selected)

3. Supabase Auth creates user account

4. User profile is created in `users` table with selected role

5. User is automatically logged in and redirected to their role-specific dashboard

### 2. Login Process

1. User enters email and password

2. Supabase Auth validates credentials

3. User profile is fetched from `users` table

4. User is redirected to their role-specific dashboard:
   - `admin` → `/admin/users`
   - `trainer`/`spd` → `/trainer/courses`
   - `employer` → `/employer/jobs`
   - `validator` → `/validator/dashboard`
   - `jobseeker` → `/dashboard`

### 3. Protected Routes

Routes are protected using the `ProtectedRoute` component:

```tsx
<ProtectedRoute allowedRoles={["admin"]}>
  <AdminComponent />
</ProtectedRoute>
```

- If user is not authenticated → redirect to `/login`
- If user doesn't have required role → redirect to their dashboard
- Shows loading state while checking authentication

## Role-Based Access Control

### Permission Functions

Located in `src/lib/roles.ts`:

- `hasRole(userRole, allowedRoles)` - Check if user has one of the allowed roles
- `canManageCourses(role)` - Check if user can create/edit courses
- `canValidate(role)` - Check if user can validate submissions
- `canManageUsers(role)` - Check if user can manage other users
- `canPostJobs(role)` - Check if user can post job listings

### Using Role Checks

#### In Components

```tsx
import { useRole } from "@/hooks/useRole";

const MyComponent = () => {
  const { canManageCourses, hasRole } = useRole();
  
  if (canManageCourses()) {
    // Show course management UI
  }
  
  if (hasRole(["admin", "trainer"])) {
    // Show admin/trainer specific content
  }
};
```

#### In Routes

```tsx
<Route
  path="/admin/users"
  element={
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminUsers />
    </ProtectedRoute>
  }
/>
```

## Route Protection

### Public Routes
- `/` - Landing page
- `/login` - Login page
- `/signup` - Sign up page
- `/courses` - Course catalog (public)
- `/jobs` - Job listings (public)

### Protected Routes (Requires Authentication)
- `/dashboard` - User dashboard (all authenticated users)
- `/profile` - User profile (all authenticated users)

### Role-Specific Routes

#### Admin Routes (`allowedRoles={["admin"]}`)
- `/admin/users` - User management
- `/admin/courses` - Course management
- `/admin/jobs` - Job management

#### Trainer/SPD Routes (`allowedRoles={["trainer", "spd"]}`)
- `/trainer/courses` - Course management
- `/trainer/learners` - Learner management

#### Validator Routes (`allowedRoles={["validator", "admin"]}`)
- `/validator/dashboard` - Validation dashboard

#### Employer Routes (`allowedRoles={["employer"]}`)
- `/employer/jobs` - Job posting management
- `/employer/candidates` - Candidate search

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role user_role NOT NULL,
  avatar TEXT,
  phone TEXT,
  address TEXT,
  skills TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Row Level Security (RLS)

RLS policies ensure:
- Users can only view/edit their own profile
- Admins can view all users
- Public data (courses, jobs) is accessible to everyone
- Role-based access is enforced at the database level

## Environment Variables

Required in `.env`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Testing Authentication

### Creating Test Users

1. **Via Sign Up Page** (for public roles):
   - Go to `/signup`
   - Fill in details
   - Select role: `jobseeker` or `employer`

2. **Via Supabase Dashboard** (for all roles):
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add User"
   - Create user in `auth.users`
   - Manually create profile in `users` table with desired role

### Default Test Users

For development, you can create these users:

```sql
-- Admin user
INSERT INTO users (id, email, name, role) 
VALUES ('admin-uuid', 'admin@peso.academy', 'Admin User', 'admin');

-- Trainer user
INSERT INTO users (id, email, name, role) 
VALUES ('trainer-uuid', 'trainer@peso.academy', 'Trainer Maria', 'trainer');

-- Validator user
INSERT INTO users (id, email, name, role) 
VALUES ('validator-uuid', 'validator@peso.academy', 'Validator John', 'validator');
```

## Security Considerations

1. **Password Requirements**: Minimum 6 characters (can be enhanced)
2. **Email Verification**: Can be enabled in Supabase Auth settings
3. **Role Assignment**: Only public roles (`jobseeker`, `employer`) can be selected during signup
4. **RLS Policies**: Database-level security prevents unauthorized access
5. **JWT Tokens**: Supabase handles token management automatically

## Troubleshooting

### User can't login
- Check Supabase project is active
- Verify email/password are correct
- Check browser console for errors
- Verify RLS policies are set up correctly

### User redirected to wrong dashboard
- Check user's role in database
- Verify `getDashboardRoute` function in `src/lib/roles.ts`
- Check route configuration in `src/App.tsx`

### Role-based access not working
- Verify `ProtectedRoute` component is wrapping the route
- Check `allowedRoles` prop includes the user's role
- Verify RLS policies allow the operation

### Signup fails
- Check password meets requirements (min 6 characters)
- Verify email is not already registered
- Check Supabase logs for errors
- Ensure role is in `getPublicSignupRoles()` list

## Next Steps

1. **Email Verification**: Enable email verification in Supabase Auth
2. **Password Reset**: Implement password reset flow
3. **Role Management**: Create admin interface for role assignment
4. **Session Management**: Add session timeout and refresh logic
5. **Audit Logging**: Track authentication events

