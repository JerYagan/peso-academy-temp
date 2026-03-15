/**
 * Route to Permission Mapping
 * Maps each route to the required permission(s) needed to access it
 * This allows dynamic permission-based access control from the database
 */

export interface RoutePermissionConfig {
  path: string;
  requiredPermissions: string[]; // Array of permission IDs (any one is sufficient)
  requireAll?: boolean; // If true, user must have ALL permissions, otherwise ANY permission is sufficient
}

/**
 * Route to Permission Mapping
 * Each route maps to one or more permissions from the database
 * Users must have at least one of the listed permissions to access the route
 */
export const routePermissions: RoutePermissionConfig[] = [
  // Public routes (no permissions required)
  { path: "/", requiredPermissions: [] },
  { path: "/login", requiredPermissions: [] },
  { path: "/signup", requiredPermissions: [] },
  { path: "/courses", requiredPermissions: [] },
  { path: "/verify-certificate", requiredPermissions: [] },

  // Protected routes (require authentication only)
  { path: "/dashboard", requiredPermissions: [] },
  { path: "/profile", requiredPermissions: [] },
  { path: "/settings", requiredPermissions: [] },
  { path: "/progress", requiredPermissions: [] },
  { path: "/certificates", requiredPermissions: [] },
  { path: "/courses/:id", requiredPermissions: [] },
  { path: "/verification", requiredPermissions: ["users.view", "training.manage"] },

  // Admin routes - require ANY related permission (if you can create/update/delete, you can access the dashboard)
  { path: "/admin/users", requiredPermissions: ["users.view", "users.create", "users.update", "users.delete", "users.manage_roles"] },
  { path: "/admin/courses", requiredPermissions: ["courses.view", "courses.create", "courses.update", "courses.delete"] },
  { path: "/admin/taxonomy", requiredPermissions: ["courses.create", "courses.update", "training.manage"] },
  { path: "/admin/roles", requiredPermissions: ["users.manage_roles", "users.view"] },
  { path: "/admin/audit-logs", requiredPermissions: ["system.audit"] },
  { path: "/admin/enrollments", requiredPermissions: ["training.manage", "courses.view"] },
  { path: "/admin/learners", requiredPermissions: ["training.manage", "courses.view"] },
  { path: "/admin/learners/:learnerId", requiredPermissions: ["training.manage", "courses.view"] },
  { path: "/admin/certificates", requiredPermissions: ["training.manage", "courses.view"] },
  { path: "/admin/assessment-reviews", requiredPermissions: ["training.manage", "courses.view"] },
  { path: "/admin/assessment-reviews/:attemptId", requiredPermissions: ["training.manage", "courses.view"] },
  { path: "/admin/reports", requiredPermissions: ["reports.view", "reports.export"] },

  // Trainer routes - if you can manage training or courses, you can access
  { path: "/trainer/courses", requiredPermissions: ["courses.view", "courses.create", "courses.update", "courses.delete", "training.manage"] },
  { path: "/trainer/certificates", requiredPermissions: ["training.manage", "courses.view"] },
  { path: "/trainer/taxonomy", requiredPermissions: ["courses.create", "courses.update", "training.manage"] },
  { path: "/trainer/learners", requiredPermissions: ["training.manage", "courses.view"] },
  { path: "/trainer/learners/:learnerId", requiredPermissions: ["training.manage", "courses.view"] },
  { path: "/trainer/assessment-reviews", requiredPermissions: ["training.manage", "courses.view"] },
  { path: "/trainer/assessment-reviews/:attemptId", requiredPermissions: ["training.manage", "courses.view"] },
];

/**
 * Get required permissions for a route path
 * Handles dynamic routes (e.g., /courses/:id) by pattern matching
 * Returns the permissions required for the route (user needs ANY of these permissions)
 */
export function getRequiredPermissionsForRoute(pathname: string): string[] {
  // Try exact match first
  const exactMatch = routePermissions.find(r => r.path === pathname);
  if (exactMatch) {
    return exactMatch.requiredPermissions;
  }

  // Try pattern matching for dynamic routes
  for (const route of routePermissions) {
    if (route.path.includes(":")) {
      // Convert route pattern to regex
      const pattern = route.path
        .replace(/\//g, "\\/")
        .replace(/:[\w]+/g, "[^/]+");
      const regex = new RegExp(`^${pattern}$`);
      
      if (regex.test(pathname)) {
        return route.requiredPermissions;
      }
    }
  }

  // Default: require authentication but no specific permissions
  return [];
}

/**
 * Check if a route requires authentication
 */
export function routeRequiresAuth(pathname: string): boolean {
  const permissions = getRequiredPermissionsForRoute(pathname);
  // If route has no permission mapping, it's public
  const routeConfig = routePermissions.find(r => {
    if (r.path === pathname) return true;
    if (r.path.includes(":")) {
      const pattern = r.path
        .replace(/\//g, "\\/")
        .replace(/:[\w]+/g, "[^/]+");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(pathname);
    }
    return false;
  });
  
  // If route is not in the mapping, it's public
  if (!routeConfig) return false;
  
  // If route has no required permissions, it still requires auth (protected route)
  return true;
}

