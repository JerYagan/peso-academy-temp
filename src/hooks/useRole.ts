import { useAuth } from "@/contexts/AuthContext";
import { UserRole, getUserPermissions, getDashboardRoute, hasAnyRole as checkHasAnyRole } from "@/lib/roles";

/**
 * Hook to check user roles and permissions
 * Following payroll-pal's authentication approach
 */
export function useRole() {
  const { user, role, permissions } = useAuth();

  const hasRole = (requiredRole: UserRole) => {
    return role === requiredRole;
  };

  const hasAnyRole = (roles: UserRole[]) => {
    return roles.includes(role);
  };

  const isAdmin = () => {
    return role === 'admin';
  };

  const can = (permission: keyof typeof permissions) => {
    return permissions[permission];
  };

  return {
    role,
    permissions,
    hasRole,
    hasAnyRole,
    isAdmin,
    can,
    getDashboardRoute: () => getDashboardRoute(role),
  };
}
