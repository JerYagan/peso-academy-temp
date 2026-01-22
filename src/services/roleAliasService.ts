import { supabase } from "@/lib/supabase";

export interface RoleAlias {
  role_code: string;
  display_name: string;
  description: string | null;
  updated_at: string;
}

/**
 * Role Alias Service
 * Manages dynamic role display names stored in role_aliases table
 */
export const roleAliasService = {
  /**
   * Get all role aliases
   */
  getAllAliases: async (): Promise<{ data: RoleAlias[] | null; error: Error | null }> => {
    if (!supabase) {
      return { data: null, error: new Error("Supabase client not initialized") };
    }

    try {
      const { data, error } = await supabase
        .from("role_aliases")
        .select("*")
        .order("role_code");

      if (error) {
        return { data: null, error: error as Error };
      }

      return { data: data as RoleAlias[], error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error("Unknown error occurred"),
      };
    }
  },

  /**
   * Get role alias by role code
   */
  getAlias: async (roleCode: string): Promise<{ data: RoleAlias | null; error: Error | null }> => {
    if (!supabase) {
      return { data: null, error: new Error("Supabase client not initialized") };
    }

    try {
      const { data, error } = await supabase
        .from("role_aliases")
        .select("*")
        .eq("role_code", roleCode)
        .single();

      if (error) {
        return { data: null, error: error as Error };
      }

      return { data: data as RoleAlias, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error("Unknown error occurred"),
      };
    }
  },

  /**
   * Update role alias (admin only)
   */
  updateAlias: async (
    roleCode: string,
    displayName: string,
    description?: string
  ): Promise<{ data: RoleAlias | null; error: Error | null }> => {
    if (!supabase) {
      return { data: null, error: new Error("Supabase client not initialized") };
    }

    try {
      // Use database function (admin check is done in SQL)
      const { data, error } = await supabase.rpc("update_role_alias", {
        role_code: roleCode,
        display_name: displayName,
        description: description || null,
      });

      if (error) {
        return { data: null, error: error as Error };
      }

      // Fetch updated alias
      return await roleAliasService.getAlias(roleCode);
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error("Unknown error occurred"),
      };
    }
  },

  /**
   * Get role display name (with alias support)
   * Falls back to default if alias not found
   */
  getDisplayName: async (
    roleCode: string,
    defaultName: string
  ): Promise<string> => {
    const { data } = await roleAliasService.getAlias(roleCode);
    return data?.display_name || defaultName;
  },
};

