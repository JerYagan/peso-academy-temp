# Dynamic Role Module Guide

## Overview

The Dynamic Role Module provides a centralized, configurable system for managing roles, permissions, and access control in PESO Academy. All role-related functionality is now driven by a single configuration file, making it easy to add, modify, or remove roles and permissions.

## Architecture

### Core Components

1. **`src/lib/roleConfig.ts`** - Central role configuration
   - Defines all roles with their permissions
   - Permission definitions
   - Role metadata and configurations

2. **`src/lib/roles.ts`** - Role utilities (updated to use dynamic config)
   - Backward-compatible functions
   - Uses dynamic configuration internally

3. **`src/hooks/useRole.ts`** - React hook for role checks
   - Enhanced with permission checks
   - Provides role configuration

4. **`src/components/RoleGuard.tsx`** - Component for conditional rendering
   - Role-based rendering
   - Permission-based rendering

5. **`src/pages/admin/Roles.tsx`** - Admin interface for viewing roles
   - View all roles and permissions
   - Role management interface

## Features

### ✅ Dynamic Role Configuration

All roles are defined in `roleConfig.ts` with:
- Role metadata (name, description, category)
- Permissions list
- Dashboard routes
- Signup eligibility
- Visual properties (icon, color)

### ✅ Permission System

Granular permissions for:
- User management
- Course management
- Training management
- Job management
- Reporting
- System administration

### ✅ Easy Extension

To add a new role:

1. Add role type to `src/types/auth.ts`:
```typescript
export type UserRole = "jobseeker" | "admin" | "trainer" | "employer" | "validator" | "spd" | "newrole";
```

2. Add role configuration to `src/lib/roleConfig.ts`:
```typescript
newrole: {
  id: "newrole",
  name: "New Role",
  description: "Description of new role",
  category: "end_user",
  icon: "User",
  color: "blue",
  permissions: ["courses.view", "courses.enroll"],
  dashboardRoute: "/dashboard",
  canSignup: true,
}
```

3. Update database enum (if needed):
```sql
ALTER TYPE user_role ADD VALUE 'newrole';
```

### ✅ Backward Compatibility

All existing code continues to work:
- `useRole()` hook works as before
- `hasRole()`, `canManageCourses()`, etc. still work
- New permission-based methods available

## Usage Examples

### Using RoleGuard Component

```tsx
import { RoleGuard } from "@/components/RoleGuard";

// By role
<RoleGuard allowedRoles={["admin", "trainer"]}>
  <AdminPanel />
</RoleGuard>

// By permission
<RoleGuard requiredPermission="courses.create">
  <CreateCourseButton />
</RoleGuard>

// Multiple permissions (any)
<RoleGuard requiredPermissions={["courses.create", "courses.update"]}>
  <CourseActions />
</RoleGuard>

// Multiple permissions (all)
<RoleGuard requiredPermissions={["users.view", "users.update"]} requireAll>
  <UserManagement />
</RoleGuard>
```

### Using useRole Hook

```tsx
import { useRole } from "@/hooks/useRole";

const MyComponent = () => {
  const { 
    role, 
    roleConfig,
    hasPermission,
    hasAnyPermission,
    getPermissions 
  } = useRole();

  // Check single permission
  if (hasPermission("courses.create")) {
    // Show create button
  }

  // Check multiple permissions (any)
  if (hasAnyPermission(["courses.create", "courses.update"])) {
    // Show edit options
  }

  // Get all permissions for current role
  const permissions = getPermissions();
  
  // Access role configuration
  if (roleConfig) {
    console.log(roleConfig.name, roleConfig.description);
  }
};
```

### Using Permission Checks Directly

```tsx
import { roleHasPermission } from "@/lib/roleConfig";

// Check if a role has permission
if (roleHasPermission("admin", "users.manage_roles")) {
  // Admin can manage roles
}
```

## Admin Interface

Access the Role Management page at `/admin/roles` (admin only).

Features:
- View all roles
- Filter by category (Internal/End User)
- View role details
- See all permissions for each role
- Role statistics

## Permission Reference

### User Management
- `users.view` - View user profiles
- `users.create` - Create users
- `users.update` - Update users
- `users.delete` - Delete users
- `users.manage_roles` - Change user roles

### Course Management
- `courses.view` - View courses
- `courses.create` - Create courses
- `courses.update` - Update courses
- `courses.delete` - Delete courses
- `courses.enroll` - Enroll in courses

### Training Management
- `training.manage` - Manage training programs
- `training.validate` - Validate completions
- `training.certify` - Issue certificates

### Job Management
- `jobs.view` - View jobs
- `jobs.create` - Post jobs
- `jobs.update` - Update jobs
- `jobs.delete` - Delete jobs
- `jobs.apply` - Apply to jobs

### Reporting
- `reports.view` - View reports
- `reports.export` - Export reports

### System Administration
- `system.settings` - System settings
- `system.audit` - View audit logs

## Migration Notes

### Existing Code

All existing code continues to work without changes:
- `canManageCourses()`, `canValidate()`, etc. still work
- They now use the dynamic permission system internally

### New Features

New permission-based methods available:
- `hasPermission(permission)` - Check single permission
- `hasAnyPermission(permissions[])` - Check if has any permission
- `hasAllPermissions(permissions[])` - Check if has all permissions

## Best Practices

1. **Use RoleGuard for UI** - Use `RoleGuard` component for conditional rendering
2. **Use useRole Hook** - Use `useRole()` hook in components for role checks
3. **Use Permissions** - Prefer permission checks over role checks for flexibility
4. **Centralize Config** - All role changes should be made in `roleConfig.ts`
5. **Document Permissions** - Document new permissions in `PERMISSIONS` object

## Future Enhancements

Potential future improvements:
- Database-driven roles (store in Supabase)
- Role hierarchy system
- Custom permission groups
- Role templates
- Permission inheritance

