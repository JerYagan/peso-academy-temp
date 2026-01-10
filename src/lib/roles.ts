import { UserRole } from "@/types/auth";
import {
  getRoleConfig,
  getAllRoles,
  getRolesByCategory,
  getPublicSignupRoles as getPublicSignupRolesConfig,
  roleHasPermission,
  getRoleDisplayName,
  getRoleDescription,
  getDashboardRoute as getDashboardRouteConfig,
} from "./roleConfig";

/**
 * Role-based access control utilities
 * Now uses dynamic role configuration from roleConfig.ts
 */

// Role categories - dynamically generated from config
export const INTERNAL_ROLES: UserRole[] = getRolesByCategory("internal").map((r) => r.id) as UserRole[];
export const END_USER_ROLES: UserRole[] = getRolesByCategory("end_user").map((r) => r.id) as UserRole[];

// Role display names - dynamically generated from config
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  jobseeker: getRoleDisplayName("jobseeker"),
  admin: getRoleDisplayName("admin"),
  trainer: getRoleDisplayName("trainer"),
  employer: getRoleDisplayName("employer"),
  validator: getRoleDisplayName("validator"),
  spd: getRoleDisplayName("spd"),
};

// Role descriptions - dynamically generated from config
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  jobseeker: getRoleDescription("jobseeker"),
  admin: getRoleDescription("admin"),
  trainer: getRoleDescription("trainer"),
  employer: getRoleDescription("employer"),
  validator: getRoleDescription("validator"),
  spd: getRoleDescription("spd"),
};

/**
 * Check if a user has one of the allowed roles
 */
export const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole);
};

/**
 * Check if user is an internal user (admin or validator)
 */
export const isInternalUser = (role: UserRole): boolean => {
  return INTERNAL_ROLES.includes(role);
};

/**
 * Check if user is an end user
 */
export const isEndUser = (role: UserRole): boolean => {
  return END_USER_ROLES.includes(role);
};

/**
 * Check if user can manage courses
 * Uses dynamic permission system
 */
export const canManageCourses = (role: UserRole): boolean => {
  return roleHasPermission(role, "courses.create") || roleHasPermission(role, "courses.update");
};

/**
 * Check if user can validate submissions
 * Uses dynamic permission system
 */
export const canValidate = (role: UserRole): boolean => {
  return roleHasPermission(role, "training.validate");
};

/**
 * Check if user can manage users
 * Uses dynamic permission system
 */
export const canManageUsers = (role: UserRole): boolean => {
  return roleHasPermission(role, "users.manage_roles") || roleHasPermission(role, "users.update");
};

/**
 * Check if user can post jobs
 * Uses dynamic permission system
 */
export const canPostJobs = (role: UserRole): boolean => {
  return roleHasPermission(role, "jobs.create");
};

/**
 * Get dashboard route based on user role
 * Uses dynamic configuration
 */
export const getDashboardRoute = (role: UserRole): string => {
  return getDashboardRouteConfig(role);
};

/**
 * Get available roles for signup (public roles only)
 * Uses dynamic configuration
 */
export const getPublicSignupRoles = (): UserRole[] => {
  return getPublicSignupRolesConfig().map((r) => r.id) as UserRole[];
};

/**
 * Check if role can be selected during signup
 */
export const isPublicSignupRole = (role: UserRole): boolean => {
  return getPublicSignupRoles().includes(role);
};

