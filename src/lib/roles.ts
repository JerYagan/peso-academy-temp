/**
 * User roles and permissions
 * Roles are stored in user metadata in Supabase (auth.users.raw_user_meta_data->>'role')
 * Following payroll-pal's authentication approach
 * 
 * System has 3 roles:
 * - admin (Administrator)
 * - trainer (Trainer)
 * - trainee (Trainee)
 * 
 * Display names can be customized via role_aliases table
 */

import type { UserRole } from "@/types/auth";
import { normalizeUserRole } from "@/types/auth";
import { roleService } from "@/services/roleService";

export type { UserRole } from "@/types/auth";

type PermissionRole = "admin" | "trainer" | "trainee";

// Cache for dashboard routes to avoid repeated database calls
const dashboardRouteCache: Map<string, string> = new Map();
let cacheInitialized = false;

export interface RolePermissions {
  canManageUsers: boolean;
  canManageCourses: boolean;
  canManageTraining: boolean;
  canValidate: boolean;
  canViewReports: boolean;
  canManageSettings: boolean;
}

const permissionRoleAliases: Record<UserRole, PermissionRole> = {
  admin: "admin",
  trainer: "trainer",
  trainee: "trainee",
};

export const rolePermissions: Record<PermissionRole, RolePermissions> = {
  admin: {
    canManageUsers: true,
    canManageCourses: true,
    canManageTraining: true,
    canValidate: true,
    canViewReports: true,
    canManageSettings: true,
  },
  trainer: {
    canManageUsers: false,
    canManageCourses: true,
    canManageTraining: true,
    canValidate: false,
    canViewReports: true,
    canManageSettings: false,
  },
  trainee: {
    canManageUsers: false,
    canManageCourses: false,
    canManageTraining: false,
    canValidate: false,
    canViewReports: false,
    canManageSettings: false,
  },
};

/**
 * Default role display names (can be overridden by role_aliases table)
 */
export const defaultRoleDisplayNames: Record<UserRole, string> = {
  admin: 'Administrator',
  trainer: 'Trainer',
  trainee: 'Trainee',
};

/**
 * Default role descriptions
 */
export const defaultRoleDescriptions: Record<UserRole, string> = {
  admin: 'Assigns and manages roles and defines access permissions',
  trainer: 'Creates courses, manages training content, and supports learners',
  trainee: 'Accesses learning, assessment, and progress modules only',
};

function getPermissionRole(role: UserRole): PermissionRole {
  return permissionRoleAliases[role] ?? 'trainee';
}

/**
 * Get user role from user metadata
 * Defaults to 'trainee' if no role is set
 * Handles both Supabase user objects (with user_metadata) and User objects (with role property)
 */
export function getUserRole(user: any): UserRole {
  // Check if it's a User object with direct role property (from AuthContext)
  if (user?.role) {
    return normalizeUserRole(user.role);
  }
  
  // Otherwise, check for Supabase user metadata
  return normalizeUserRole(user?.user_metadata?.role);
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
  const role = getPermissionRole(getUserRole(user));
  return rolePermissions[role];
}

const localDashboardRouteOverrides: Partial<Record<UserRole, string>> = {
  admin: '/admin/dashboard',
  trainer: '/trainer/dashboard',
};

/**
 * Fallback dashboard routes (used when database is unavailable or role not found)
 */
const fallbackDashboardRoutes: Record<string, string> = {
  'admin': '/admin/dashboard',
  'trainer': '/trainer/dashboard',
  'trainee': '/dashboard',
};

/**
 * Initialize dashboard route cache from database
 * Call this on app startup to preload routes
 */
export async function initializeDashboardRoutes(): Promise<void> {
  if (cacheInitialized) return;
  
  try {
    const roles = await roleService.getAllRoles();
    roles.forEach(role => {
      if (role.dashboard_route) {
        dashboardRouteCache.set(role.id, role.dashboard_route);
      }
    });
    cacheInitialized = true;
    console.log('✅ Dashboard routes cache initialized:', dashboardRouteCache.size, 'roles');
  } catch (error) {
    console.warn('⚠️ Failed to initialize dashboard routes cache, using fallback:', error);
    cacheInitialized = true; // Mark as initialized to prevent retry loops
  }
}

/**
 * Refresh dashboard route cache from database
 * Call this when roles are updated in the database
 */
export async function refreshDashboardRoutes(): Promise<void> {
  dashboardRouteCache.clear();
  cacheInitialized = false;
  await initializeDashboardRoutes();
}

/**
 * Get dashboard route from database (async)
 * Fetches from database and caches the result
 */
export async function getDashboardRouteAsync(role: UserRole | string): Promise<string> {
  const normalizedRole = normalizeUserRole(role);

  if (localDashboardRouteOverrides[normalizedRole]) {
    return localDashboardRouteOverrides[normalizedRole]!;
  }

  // Check cache first
  if (dashboardRouteCache.has(normalizedRole)) {
    return dashboardRouteCache.get(normalizedRole)!;
  }

  // Try to fetch from database
  try {
    const dbRole = await roleService.getRoleById(normalizedRole);
    if (dbRole?.dashboard_route) {
      // Cache the result
      dashboardRouteCache.set(normalizedRole, dbRole.dashboard_route);
      return dbRole.dashboard_route;
    }
  } catch (error) {
    console.warn(`Failed to fetch dashboard route for role "${normalizedRole}" from database:`, error);
  }

  // Fallback to hardcoded routes
  return fallbackDashboardRoutes[normalizedRole] || fallbackDashboardRoutes['trainee'] || '/dashboard';
}

/**
 * Get dashboard route based on user role
 * Uses cache if available, otherwise falls back to hardcoded routes
 * For async database fetching, use getDashboardRouteAsync instead
 * 
 * NOTE: This sync version uses cache. For fresh data, use getDashboardRouteAsync()
 * The cache is refreshed when roles are updated in the database
 */
export function getDashboardRoute(role: UserRole | string): string {
  const normalizedRole = normalizeUserRole(role);

  if (localDashboardRouteOverrides[normalizedRole]) {
    return localDashboardRouteOverrides[normalizedRole]!;
  }

  // Check cache first (should be populated on app startup)
  if (dashboardRouteCache.has(normalizedRole)) {
    return dashboardRouteCache.get(normalizedRole)!;
  }

  // Fallback to hardcoded routes
  return fallbackDashboardRoutes[normalizedRole] || fallbackDashboardRoutes['trainee'] || '/dashboard';
}

/**
 * Get dashboard route for a user (always fetches fresh from database)
 * This ensures we get the latest dashboard_route from the roles table
 */
export async function getDashboardRouteForUser(userId: string, userRole: string): Promise<string> {
  const normalizedRole = normalizeUserRole(userRole);

  if (localDashboardRouteOverrides[normalizedRole]) {
    return localDashboardRouteOverrides[normalizedRole]!;
  }

  try {
    // First try to get the role's dashboard_route from database
    const dbRole = await roleService.getRoleById(normalizedRole);
    if (dbRole?.dashboard_route) {
      // Update cache
      dashboardRouteCache.set(normalizedRole, dbRole.dashboard_route);
      return dbRole.dashboard_route;
    }
  } catch (error) {
    console.warn(`Failed to fetch dashboard route for role "${normalizedRole}":`, error);
  }

  // Fallback to cache or hardcoded routes
  return getDashboardRoute(normalizedRole);
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
  return defaultRoleDisplayNames[normalizeUserRole(role)];
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
  return defaultRoleDescriptions[normalizeUserRole(role)];
}
