import { supabase, handleSupabaseError } from "@/lib/supabase";
import { UserRole } from "@/types/auth";

export interface DatabasePermission {
  id: string;
  name: string;
  description: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseRole {
  id: string;
  name: string;
  description: string;
  category: "internal" | "end_user";
  icon: string | null;
  color: string | null;
  dashboard_route: string;
  can_signup: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface RoleWithPermissions extends DatabaseRole {
  permissions: DatabasePermission[];
}

/**
 * Role and Permission Service
 * Handles all role and permission operations from database
 */
export const roleService = {
  /**
   * Get all permissions
   */
  getAllPermissions: async (): Promise<DatabasePermission[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    const { data, error } = await supabase
      .from("permissions")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return data || [];
  },

  /**
   * Get all roles
   */
  getAllRoles: async (): Promise<DatabaseRole[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    console.log("🔍 Fetching all roles from database...");
    const { data, error } = await supabase
      .from("roles")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("❌ Error fetching roles:", error);
      console.error("Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      handleSupabaseError(error);
      return [];
    }

    console.log("✅ Successfully fetched roles:", data?.length || 0, "roles");
    if (data && data.length > 0) {
      console.log("📋 Roles:", data.map(r => ({ id: r.id, name: r.name, category: r.category })));
    }
    return data || [];
  },

  /**
   * Get a single role by ID
   */
  getRoleById: async (roleId: string): Promise<DatabaseRole | null> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return null;
    }

    const { data, error } = await supabase
      .from("roles")
      .select("*")
      .eq("id", roleId)
      .single();

    if (error) {
      handleSupabaseError(error);
      return null;
    }

    return data;
  },

  /**
   * Get role with its permissions
   */
  getRoleWithPermissions: async (roleId: string): Promise<RoleWithPermissions | null> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return null;
    }

    // Get role
    const role = await roleService.getRoleById(roleId);
    if (!role) return null;

    // Get permissions for this role
    const { data, error } = await supabase
      .from("role_permissions")
      .select("permission_id, permissions(*)")
      .eq("role_id", roleId);

    if (error) {
      handleSupabaseError(error);
      return { ...role, permissions: [] };
    }

    // Handle both single object and array responses from Supabase
    const permissions = (data || [])
      .map((rp: any) => {
        // Supabase returns permissions as nested object
        return rp.permissions || rp;
      })
      .filter((p: any) => p && p.id); // Filter out null/undefined

    return {
      ...role,
      permissions: permissions as DatabasePermission[],
    };
  },

  /**
   * Get permissions for a role
   */
  getRolePermissions: async (roleId: string): Promise<DatabasePermission[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    const { data, error } = await supabase
      .from("role_permissions")
      .select("permission_id, permissions(*)")
      .eq("role_id", roleId);

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    // Handle Supabase response format
    return (data || [])
      .map((rp: any) => rp.permissions || rp)
      .filter((p: any) => p && p.id) as DatabasePermission[];
  },

  /**
   * Update role permissions
   */
  updateRolePermissions: async (
    roleId: string,
    permissionIds: string[]
  ): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    // Delete existing permissions
    const { error: deleteError } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId);

    if (deleteError) {
      handleSupabaseError(deleteError);
      throw deleteError;
    }

    // Insert new permissions
    if (permissionIds.length > 0) {
      const rolePermissions = permissionIds.map((permissionId) => ({
        role_id: roleId,
        permission_id: permissionId,
      }));

      const { error: insertError } = await supabase
        .from("role_permissions")
        .insert(rolePermissions);

      if (insertError) {
        handleSupabaseError(insertError);
        throw insertError;
      }
    }
  },

  /**
   * Update role details
   */
  updateRole: async (
    roleId: string,
    updates: Partial<DatabaseRole>
  ): Promise<DatabaseRole> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.icon !== undefined) updateData.icon = updates.icon;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.dashboard_route !== undefined) updateData.dashboard_route = updates.dashboard_route;
    if (updates.can_signup !== undefined) updateData.can_signup = updates.can_signup;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    const { data, error } = await supabase
      .from("roles")
      .update(updateData)
      .eq("id", roleId)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return data;
  },

  /**
   * Create a new role
   */
  createRole: async (roleData: Omit<DatabaseRole, "created_at" | "updated_at">): Promise<DatabaseRole> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { data, error } = await supabase
      .from("roles")
      .insert({
        ...roleData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return data;
  },

  /**
   * Delete a role
   */
  deleteRole: async (roleId: string): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    // Delete role permissions first (cascade should handle this, but being explicit)
    const { error: permError } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId);

    if (permError) {
      handleSupabaseError(permError);
      throw permError;
    }

    // Delete the role
    const { error: roleError } = await supabase
      .from("roles")
      .delete()
      .eq("id", roleId);

    if (roleError) {
      handleSupabaseError(roleError);
      throw roleError;
    }
  },

  /**
   * Get permissions grouped by category
   */
  getPermissionsByCategory: async (): Promise<Record<string, DatabasePermission[]>> => {
    const permissions = await roleService.getAllPermissions();
    const grouped: Record<string, DatabasePermission[]> = {};

    permissions.forEach((perm) => {
      if (!grouped[perm.category]) {
        grouped[perm.category] = [];
      }
      grouped[perm.category].push(perm);
    });

    return grouped;
  },

  /**
   * Get user permissions by user ID
   * Uses the database function get_user_permissions
   */
  getUserPermissions: async (userId: string): Promise<string[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    try {
      // Try RPC function first
      const { data, error } = await supabase.rpc('get_user_permissions', {
        user_id: userId
      });

      if (error) {
        console.error("❌ Error fetching user permissions via RPC:", error);
        console.error("Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        
        // Fallback: Query database directly
        console.log("🔄 Falling back to direct database query...");
        return await roleService.getUserPermissionsDirect(userId);
      }

      // Extract permission IDs from the result
      // Handle both old format (3 columns) and new format (4 columns with source)
      const permissions = (data || []).map((p: any) => {
        // Support both permission_id and id fields, and handle the new source column
        const permId = p.permission_id || p.id;
        if (!permId) {
          console.warn("⚠️ Permission object missing ID:", p);
        }
        return permId;
      }).filter(Boolean);
      
      console.log("📋 User permissions fetched:", { 
        userId, 
        count: permissions.length, 
        permissions,
        rawDataCount: data?.length || 0,
        rawDataSample: data?.slice(0, 3) // Show first 3 for debugging
      });
      
      if (permissions.length === 0 && data && data.length > 0) {
        console.error("❌ Failed to extract permission IDs from data:", data);
      }
      
      return permissions;
    } catch (error) {
      console.error("❌ Exception fetching user permissions:", error);
      // Try direct query as last resort
      try {
        return await roleService.getUserPermissionsDirect(userId);
      } catch (fallbackError) {
        console.error("❌ Direct query also failed:", fallbackError);
        return [];
      }
    }
  },

  /**
   * Get user permissions by querying database directly (fallback when RPC fails)
   * This queries role_permissions based on the user's role
   */
  getUserPermissionsDirect: async (userId: string): Promise<string[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    try {
      // First, get the user's role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        console.error("❌ Error fetching user role:", userError);
        return [];
      }

      const userRole = userData.role;
      if (!userRole) {
        console.warn("⚠️ User has no role assigned");
        return [];
      }

      // Get permissions for this role from role_permissions table
      const { data: rolePerms, error: rolePermsError } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', userRole);

      if (rolePermsError) {
        console.error("❌ Error fetching role permissions:", rolePermsError);
        return [];
      }

      // Extract permission IDs
      const permissions = (rolePerms || []).map((rp: any) => rp.permission_id).filter(Boolean);
      
      console.log("📋 User permissions fetched (direct query):", { 
        userId, 
        userRole,
        count: permissions.length, 
        permissions
      });

      return permissions;
    } catch (error) {
      console.error("❌ Exception in getUserPermissionsDirect:", error);
      return [];
    }
  },

  /**
   * Check if user has a specific permission
   * Uses the database function user_has_permission
   */
  userHasPermission: async (userId: string, permissionId: string): Promise<boolean> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return false;
    }

    try {
      const { data, error } = await supabase.rpc('user_has_permission', {
        user_id: userId,
        permission_id: permissionId
      });

      if (error) {
        console.error("❌ Error checking user permission via RPC:", error);
        console.error("Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          userId,
          permissionId,
        });
        
        // Fallback: Check permissions directly
        console.log("🔄 Falling back to direct permission check...");
        const userPermissions = await roleService.getUserPermissionsDirect(userId);
        const hasPermission = userPermissions.includes(permissionId);
        console.log("🔍 Permission check (direct):", { userId, permissionId, hasPermission });
        return hasPermission;
      }

      const hasPermission = data === true;
      console.log("🔍 Permission check:", { userId, permissionId, hasPermission });
      return hasPermission;
    } catch (error) {
      console.error("❌ Exception checking user permission:", error);
      // Try direct check as fallback
      try {
        const userPermissions = await roleService.getUserPermissionsDirect(userId);
        return userPermissions.includes(permissionId);
      } catch (fallbackError) {
        console.error("❌ Direct permission check also failed:", fallbackError);
        return false;
      }
    }
  },

  /**
   * Check if user has any of the required permissions
   * Uses getUserPermissions to get all user permissions, then checks if any match
   * This works even if permissions are assigned to the role (not directly to user)
   */
  userHasAnyPermission: async (userId: string, permissionIds: string[]): Promise<boolean> => {
    if (permissionIds.length === 0) return true; // No permissions required

    try {
      // Get all user permissions from database
      const userPermissions = await roleService.getUserPermissions(userId);
      
      console.log("🔍 Checking permissions:", {
        userId,
        requiredPermissions: permissionIds,
        userPermissions,
      });

      // If getUserPermissions returned empty array, it might be an error
      // Try fallback to individual checks
      if (userPermissions.length === 0) {
        console.warn("⚠️ No permissions found, trying individual permission checks as fallback");
        try {
          const checks = await Promise.all(
            permissionIds.map(permId => roleService.userHasPermission(userId, permId))
          );
          const hasAny = checks.some(hasPermission => hasPermission === true);
          console.log("✅ Fallback permission check result:", { hasAny, checks });
          return hasAny;
        } catch (fallbackError) {
          console.error("❌ Fallback permission check also failed:", fallbackError);
          return false;
        }
      }

      // Check if user has any of the required permissions
      const hasAny = permissionIds.some(permId => userPermissions.includes(permId));
      
      // Detailed matching info for debugging
      const matches = permissionIds.map(permId => ({
        required: permId,
        hasIt: userPermissions.includes(permId)
      }));
      
      console.log("✅ Permission check result:", {
        userId,
        hasAny,
        requiredPermissions: permissionIds,
        userHasPermissions: userPermissions,
        matches,
        matchCount: matches.filter(m => m.hasIt).length
      });

      return hasAny;
    } catch (error) {
      console.error("❌ Error in userHasAnyPermission:", error);
      // Fallback: try individual permission checks
      try {
        const checks = await Promise.all(
          permissionIds.map(permId => roleService.userHasPermission(userId, permId))
        );
        const hasAny = checks.some(hasPermission => hasPermission === true);
        console.log("✅ Fallback permission check result:", { hasAny, checks });
        return hasAny;
      } catch (fallbackError) {
        console.error("❌ Fallback permission check also failed:", fallbackError);
        return false;
      }
    }
  },
};

