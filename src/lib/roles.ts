/**
 * User roles and permissions
 * Roles are stored in user metadata in Supabase (auth.users.raw_user_meta_data->>'role')
 * Following payroll-pal's authentication approach
 * 
 * System has 4 roles:
 * - admin (Administrator)
 * - training_officer (Training Officer)
 * - validator (Validator)
 * - trainee (Trainee)
 * 
 * Display names can be customized via role_aliases table
 */

export type UserRole = 'admin' | 'training_officer' | 'validator' | 'trainee';

export interface RolePermissions {
  canManageUsers: boolean;
  canManageCourses: boolean;
  canManageTraining: boolean;
  canValidate: boolean;
  canPostJobs: boolean;
  canViewReports: boolean;
  canManageSettings: boolean;
}

export const rolePermissions: Record<UserRole, RolePermissions> = {
  admin: {
    canManageUsers: true,
    canManageCourses: true,
    canManageTraining: true,
    canValidate: true,
    canPostJobs: true,
    canViewReports: true,
    canManageSettings: true,
  },
  training_officer: {
    canManageUsers: false,
    canManageCourses: true,
    canManageTraining: true,
    canValidate: false,
    canPostJobs: true,
    canViewReports: true,
    canManageSettings: false,
  },
  validator: {
    canManageUsers: false,
    canManageCourses: false,
    canManageTraining: false,
    canValidate: true,
    canPostJobs: false,
    canViewReports: true,
    canManageSettings: false,
  },
  trainee: {
    canManageUsers: false,
    canManageCourses: false,
    canManageTraining: false,
    canValidate: false,
    canPostJobs: false,
    canViewReports: false,
    canManageSettings: false,
  },
};

/**
 * Default role display names (can be overridden by role_aliases table)
 */
export const defaultRoleDisplayNames: Record<UserRole, string> = {
  admin: 'Administrator',
  training_officer: 'Training Officer',
  validator: 'Validator',
  trainee: 'Trainee',
};

/**
 * Default role descriptions
 */
export const defaultRoleDescriptions: Record<UserRole, string> = {
  admin: 'Assigns and manages roles and defines access permissions',
  training_officer: 'Accesses training-related modules only',
  validator: 'Accesses validation and review modules only',
  trainee: 'Accesses learning, assessment, and progress modules only',
};

/**
 * Get user role from user metadata
 * Defaults to 'trainee' if no role is set
 * Handles both Supabase user objects (with user_metadata) and User objects (with role property)
 */
export function getUserRole(user: any): UserRole {
  // Check if it's a User object with direct role property (from AuthContext)
  if (user?.role) {
    const role = user.role;
    const validRoles: UserRole[] = ['admin', 'training_officer', 'validator', 'trainee'];
    return validRoles.includes(role) ? role : 'trainee';
  }
  
  // Otherwise, check for Supabase user metadata
  const role = user?.user_metadata?.role || 'trainee';
  // Validate role is one of the 4 valid roles
  const validRoles: UserRole[] = ['admin', 'training_officer', 'validator', 'trainee'];
  return validRoles.includes(role) ? role : 'trainee';
}

/**
 * Check if user has a specific role
 */
export function hasRole(user: any, role: UserRole): boolean {
  return getUserRole(user) === role;
}

/**
 * Check if user has any of the allowed roles
 */
export function hasAnyRole(user: any, roles: UserRole[]): boolean {
  const userRole = getUserRole(user);
  return roles.includes(userRole);
}

/**
 * Check if user has admin role
 */
export function isAdmin(user: any): boolean {
  return hasRole(user, 'admin');
}

/**
 * Get permissions for a user
 */
export function getUserPermissions(user: any): RolePermissions {
  const role = getUserRole(user);
  return rolePermissions[role];
}

/**
 * Get dashboard route based on user role
 */
export function getDashboardRoute(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin/users';
    case 'training_officer':
      return '/trainer/courses';
    case 'validator':
      return '/validator/dashboard';
    case 'trainee':
    default:
      return '/dashboard';
  }
}

/**
 * Get public signup roles (roles that can be selected during signup)
 * Only trainee can sign up publicly
 */
export function getPublicSignupRoles(): UserRole[] {
  return ['trainee'];
}

/**
 * Check if role can be selected during signup
 */
export function isPublicSignupRole(role: UserRole): boolean {
  return getPublicSignupRoles().includes(role);
}

/**
 * Get role display name (with alias support)
 * This should be called with a service that fetches from role_aliases table
 * For now, returns default display name
 */
export function getRoleDisplayName(role: UserRole): string {
  return defaultRoleDisplayNames[role];
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
  return defaultRoleDescriptions[role];
}
