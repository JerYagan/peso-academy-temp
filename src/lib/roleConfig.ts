import { UserRole } from "@/types/auth";

/**
 * Dynamic Role Configuration Module
 * Centralized role definitions with permissions and metadata
 */

export interface RolePermission {
  id: string;
  name: string;
  description: string;
}

export interface RoleConfig {
  id: UserRole;
  name: string;
  description: string;
  category: "internal" | "end_user";
  icon?: string;
  color?: string;
  permissions: string[];
  dashboardRoute: string;
  canSignup: boolean;
  metadata?: Record<string, any>;
}

/**
 * Available Permissions
 * Define all possible permissions in the system
 */
export const PERMISSIONS: Record<string, RolePermission> = {
  // User Management
  "users.view": {
    id: "users.view",
    name: "View Users",
    description: "View user profiles and information",
  },
  "users.create": {
    id: "users.create",
    name: "Create Users",
    description: "Create new user accounts",
  },
  "users.update": {
    id: "users.update",
    name: "Update Users",
    description: "Update user information",
  },
  "users.delete": {
    id: "users.delete",
    name: "Delete Users",
    description: "Delete user accounts",
  },
  "users.manage_roles": {
    id: "users.manage_roles",
    name: "Manage User Roles",
    description: "Change user roles and permissions",
  },

  // Course Management
  "courses.view": {
    id: "courses.view",
    name: "View Courses",
    description: "View course catalog and details",
  },
  "courses.create": {
    id: "courses.create",
    name: "Create Courses",
    description: "Create new courses",
  },
  "courses.update": {
    id: "courses.update",
    name: "Update Courses",
    description: "Edit existing courses",
  },
  "courses.delete": {
    id: "courses.delete",
    name: "Delete Courses",
    description: "Delete courses",
  },
  "courses.enroll": {
    id: "courses.enroll",
    name: "Enroll in Courses",
    description: "Enroll in available courses",
  },

  // Training Management
  "training.manage": {
    id: "training.manage",
    name: "Manage Training",
    description: "Manage training programs and content",
  },
  "training.validate": {
    id: "training.validate",
    name: "Validate Training",
    description: "Validate training completions",
  },
  "training.certify": {
    id: "training.certify",
    name: "Issue Certificates",
    description: "Issue completion certificates",
  },

  // Reporting
  "reports.view": {
    id: "reports.view",
    name: "View Reports",
    description: "Access system reports",
  },
  "reports.export": {
    id: "reports.export",
    name: "Export Reports",
    description: "Export report data",
  },

  // System Administration
  "system.settings": {
    id: "system.settings",
    name: "System Settings",
    description: "Manage system configuration",
  },
  "system.audit": {
    id: "system.audit",
    name: "View Audit Logs",
    description: "Access audit logs",
  },
};

/**
 * Role Configurations
 * Define each role with its permissions and metadata
 */
export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  admin: {
    id: "admin",
    name: "Administrator",
    description: "Full system access and management capabilities",
    category: "internal",
    icon: "Shield",
    color: "red",
    permissions: [
      "users.view",
      "users.create",
      "users.update",
      "users.delete",
      "users.manage_roles",
      "courses.view",
      "courses.create",
      "courses.update",
      "courses.delete",
      "training.manage",
      "training.validate",
      "training.certify",
      "jobs.view",
      "jobs.create",
      "jobs.update",
      "jobs.delete",
      "reports.view",
      "reports.export",
      "system.settings",
      "system.audit",
    ],
    dashboardRoute: "/admin/users",
    canSignup: false,
    metadata: {
      level: "highest",
      requiresApproval: true,
    },
  },

  validator: {
    id: "validator",
    name: "Validator",
    description: "Review and validate training completions",
    category: "internal",
    icon: "CheckCircle",
    color: "blue",
    permissions: [
      "courses.view",
      "training.validate",
      "training.certify",
      "reports.view",
    ],
    dashboardRoute: "/validator/dashboard",
    canSignup: false,
    metadata: {
      level: "internal",
      requiresApproval: true,
    },
  },

  trainer: {
    id: "trainer",
    name: "Trainer",
    description: "Create courses, manage content, and track learner progress",
    category: "end_user",
    icon: "GraduationCap",
    color: "green",
    permissions: [
      "courses.view",
      "courses.create",
      "courses.update",
      "training.manage",
      "training.validate",
      "reports.view",
    ],
    dashboardRoute: "/trainer/courses",
    canSignup: false,
    metadata: {
      level: "moderate",
      requiresApproval: true,
    },
  },

  spd: {
    id: "spd",
    name: "Special Projects Division",
    description: "Manage modules, training programs, and content delivery",
    category: "end_user",
    icon: "FolderKanban",
    color: "purple",
    permissions: [
      "courses.view",
      "courses.create",
      "courses.update",
      "training.manage",
      "training.validate",
      "reports.view",
    ],
    dashboardRoute: "/trainer/courses",
    canSignup: false,
    metadata: {
      level: "moderate",
      requiresApproval: true,
    },
  },

  employer: {
    id: "employer",
    name: "Employer",
    description: "Post jobs and access skill-verified candidate pool",
    category: "end_user",
    icon: "Briefcase",
    color: "orange",
    permissions: [
      "jobs.view",
      "jobs.create",
      "jobs.update",
      "jobs.delete",
      "reports.view",
    ],
    dashboardRoute: "/dashboard",
    canSignup: true,
    metadata: {
      level: "basic",
      requiresApproval: false,
    },
  },

  jobseeker: {
    id: "jobseeker",
    name: "Job Seeker",
    description: "Access learning materials and complete training courses",
    category: "end_user",
    icon: "User",
    color: "gray",
    permissions: [
      "courses.view",
      "courses.enroll",
    ],
    dashboardRoute: "/dashboard",
    canSignup: true,
    metadata: {
      level: "basic",
      requiresApproval: false,
    },
  },
};

/**
 * Get role configuration
 */
export const getRoleConfig = (role: UserRole): RoleConfig => {
  return ROLE_CONFIGS[role];
};

/**
 * Get all roles
 */
export const getAllRoles = (): RoleConfig[] => {
  return Object.values(ROLE_CONFIGS);
};

/**
 * Get roles by category
 */
export const getRolesByCategory = (category: "internal" | "end_user"): RoleConfig[] => {
  return getAllRoles().filter((role) => role.category === category);
};

/**
 * Get public signup roles
 */
export const getPublicSignupRoles = (): RoleConfig[] => {
  return getAllRoles().filter((role) => role.canSignup);
};

/**
 * Check if role has permission
 */
export const roleHasPermission = (role: UserRole, permission: string): boolean => {
  const config = getRoleConfig(role);
  return config.permissions.includes(permission);
};

/**
 * Check if user has any of the required permissions
 */
export const hasAnyPermission = (role: UserRole, permissions: string[]): boolean => {
  return permissions.some((permission) => roleHasPermission(role, permission));
};

/**
 * Check if user has all required permissions
 */
export const hasAllPermissions = (role: UserRole, permissions: string[]): boolean => {
  return permissions.every((permission) => roleHasPermission(role, permission));
};

/**
 * Get permissions for a role
 */
export const getRolePermissions = (role: UserRole): RolePermission[] => {
  const config = getRoleConfig(role);
  return config.permissions
    .map((permId) => PERMISSIONS[permId])
    .filter((perm) => perm !== undefined);
};

/**
 * Get role display name
 */
export const getRoleDisplayName = (role: UserRole): string => {
  return getRoleConfig(role).name;
};

/**
 * Get role description
 */
export const getRoleDescription = (role: UserRole): string => {
  return getRoleConfig(role).description;
};

/**
 * Get dashboard route for role
 */
export const getDashboardRoute = (role: UserRole): string => {
  return getRoleConfig(role).dashboardRoute;
};

