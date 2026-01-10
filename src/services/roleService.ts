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

    const { data, error } = await supabase
      .from("roles")
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
};

