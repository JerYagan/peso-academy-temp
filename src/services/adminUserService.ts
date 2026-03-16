import { supabase } from "@/lib/supabase";
import type { User, UserRole } from "@/types/auth";

type CreateAdminUserPayload = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

export const adminUserService = {
  createUser: async (payload: CreateAdminUserPayload): Promise<{ user: User | null; error: Error | null }> => {
    if (!supabase) {
      return { user: null, error: new Error("Supabase not initialized") };
    }

    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: payload,
      });

      if (error) {
        return {
          user: null,
          error: new Error(error.message || "Failed to create user account."),
        };
      }

      if (!data?.user) {
        return {
          user: null,
          error: new Error(data?.error || "Failed to create user account."),
        };
      }

      return {
        user: data.user as User,
        error: null,
      };
    } catch (error) {
      return {
        user: null,
        error: error instanceof Error ? error : new Error("Failed to create user account."),
      };
    }
  },
};