import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types/auth";
import {
  hasRole,
  isInternalUser,
  isEndUser,
  canManageCourses,
  canValidate,
  canManageUsers,
  canPostJobs,
  getDashboardRoute,
} from "@/lib/roles";
import {
  roleHasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRoleConfig,
  getRolePermissions,
} from "@/lib/roleConfig";

/**
 * Hook for role-based access control
 */
export const useRole = () => {
  const { user } = useAuth();

  const roleConfig = user ? getRoleConfig(user.role) : null;

  return {
    user,
    role: user?.role,
    roleConfig,
    isAuthenticated: !!user,
    
    // Role checks (legacy)
    hasRole: (allowedRoles: UserRole[]) => user ? hasRole(user.role, allowedRoles) : false,
    isInternalUser: () => user ? isInternalUser(user.role) : false,
    isEndUser: () => user ? isEndUser(user.role) : false,
    canManageCourses: () => user ? canManageCourses(user.role) : false,
    canValidate: () => user ? canValidate(user.role) : false,
    canManageUsers: () => user ? canManageUsers(user.role) : false,
    canPostJobs: () => user ? canPostJobs(user.role) : false,
    
    // Permission checks (new dynamic system)
    hasPermission: (permission: string) => user ? roleHasPermission(user.role, permission) : false,
    hasAnyPermission: (permissions: string[]) => user ? hasAnyPermission(user.role, permissions) : false,
    hasAllPermissions: (permissions: string[]) => user ? hasAllPermissions(user.role, permissions) : false,
    getPermissions: () => user ? getRolePermissions(user.role) : [],
    
    // Navigation
    getDashboardRoute: () => user ? getDashboardRoute(user.role) : "/dashboard",
  };
};

