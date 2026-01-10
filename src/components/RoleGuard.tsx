import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types/auth";
import { roleHasPermission, hasAnyPermission, hasAllPermissions } from "@/lib/roleConfig";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: string;
  requiredPermissions?: string[];
  requireAll?: boolean;
  fallback?: ReactNode;
}

/**
 * RoleGuard Component
 * Conditionally renders children based on user role or permissions
 * 
 * @example
 * // By role
 * <RoleGuard allowedRoles={["admin", "trainer"]}>
 *   <AdminPanel />
 * </RoleGuard>
 * 
 * @example
 * // By permission
 * <RoleGuard requiredPermission="courses.create">
 *   <CreateCourseButton />
 * </RoleGuard>
 * 
 * @example
 * // Multiple permissions (any)
 * <RoleGuard requiredPermissions={["courses.create", "courses.update"]}>
 *   <CourseActions />
 * </RoleGuard>
 * 
 * @example
 * // Multiple permissions (all)
 * <RoleGuard requiredPermissions={["users.view", "users.update"]} requireAll>
 *   <UserManagement />
 * </RoleGuard>
 */
export const RoleGuard = ({
  children,
  allowedRoles,
  requiredPermission,
  requiredPermissions,
  requireAll = false,
  fallback = null,
}: RoleGuardProps) => {
  const { user } = useAuth();

  if (!user) {
    return <>{fallback}</>;
  }

  // Check by role
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      return <>{fallback}</>;
    }
  }

  // Check by single permission
  if (requiredPermission) {
    if (!roleHasPermission(user.role, requiredPermission)) {
      return <>{fallback}</>;
    }
  }

  // Check by multiple permissions
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasPermission = requireAll
      ? hasAllPermissions(user.role, requiredPermissions)
      : hasAnyPermission(user.role, requiredPermissions);

    if (!hasPermission) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};

