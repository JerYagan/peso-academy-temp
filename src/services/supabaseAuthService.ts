import { User } from "@/types/auth";
import { supabase, handleSupabaseError } from "@/lib/supabase";

if (!supabase) {
  console.warn("Supabase client not initialized. Please set up environment variables.");
}

/**
 * Supabase Authentication Service
 * Handles all authentication operations using Supabase Auth
 */
export const supabaseAuthService = {
  /**
   * Sign up a new user
   */
  signup: async (
    email: string,
    password: string,
    name: string,
    role: User["role"]
  ): Promise<{ user: User | null; error: Error | null }> => {
    if (!supabase) {
      return { user: null, error: new Error("Supabase client not initialized") };
    }
    try {
      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
          },
        },
      });

      if (authError) {
        // Log detailed error information for debugging
        console.error("Supabase Auth signup error:", {
          message: authError.message,
          status: authError.status,
          name: authError.name,
        });
        return { user: null, error: authError };
      }

      if (!authData.user) {
        return { user: null, error: new Error("Failed to create user") };
      }

      // Wait a bit for the trigger to create the profile automatically
      // The handle_new_user() trigger should create the profile
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try to fetch the profile (it should be created by the trigger)
      let profileData = null;
      let profileError = null;
      let retries = 5; // Increased retries

      while (retries > 0 && !profileData) {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", authData.user.id)
          .single();

        if (data && !error) {
          profileData = data;
          break;
        }

        profileError = error;
        retries--;
        if (retries > 0) {
          // Wait a bit longer before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 500 * (5 - retries)));
        }
      }
      
      // Log if trigger didn't create profile
      if (!profileData) {
        console.warn("Trigger did not create profile, will attempt manual insert", {
          userId: authData.user.id,
          email: authData.user.email,
          metadata: authData.user.user_metadata,
          role: role,
          name: name,
        });
      }

      // If profile still doesn't exist, try to create it manually (for admin-created users)
      if (!profileData) {
        console.warn("Profile not created by trigger, attempting manual insert...");
        console.warn("Auth user created:", {
          id: authData.user.id,
          email: authData.user.email,
          confirmed: authData.user.email_confirmed_at,
          metadata: authData.user.user_metadata,
        });
        
        // Check current user to verify admin status
        const { data: currentUser } = await supabase.auth.getUser();
        console.log("Current user making the request:", currentUser?.user?.id);
        
        const { data: insertedData, error: insertError } = await supabase
          .from("users")
          .insert({
            id: authData.user.id,
            email: authData.user.email!,
            name,
            role,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)
          .select()
          .single();

        if (insertError || !insertedData) {
          console.error("Profile creation error:", insertError);
          console.error("Insert error details:", {
            code: insertError?.code,
            message: insertError?.message,
            details: insertError?.details,
            hint: insertError?.hint,
          });
          
          // Check if it's an RLS policy error
          if (insertError?.code === "42501" || insertError?.message?.includes("policy") || insertError?.message?.includes("permission")) {
            return { 
              user: null, 
              error: new Error(`Permission denied: ${insertError?.message || "RLS policy blocked the insert. Make sure you're logged in as an admin and the admin insert policy is active."}`)
            };
          }
          
          // Try to get more details about the error
          const errorMessage = insertError?.message || "Failed to create user profile";
          const errorDetails = insertError?.details ? ` Details: ${insertError.details}` : "";
          const errorHint = insertError?.hint ? ` Hint: ${insertError.hint}` : "";
          const errorCode = insertError?.code ? ` Code: ${insertError.code}` : "";
          
          return { 
            user: null, 
            error: new Error(`Database error saving new user: ${errorMessage}${errorCode}${errorDetails}${errorHint}`)
          };
        }
        profileData = insertedData;
      }

      const user: User = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        role: profileData.role as User["role"],
        avatar: profileData.avatar || undefined,
        phone: profileData.phone || undefined,
        address: profileData.address || undefined,
        skills: profileData.skills || undefined,
        createdAt: profileData.created_at,
      };

      return { user, error: null };
    } catch (error) {
      return {
        user: null,
        error: error instanceof Error ? error : new Error("Unknown error occurred"),
      };
    }
  },

  /**
   * Sign in an existing user
   */
  login: async (
    email: string,
    password: string
  ): Promise<{ user: User | null; error: Error | null }> => {
    if (!supabase) {
      return { user: null, error: new Error("Supabase client not initialized") };
    }
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        return { user: null, error: authError };
      }

      if (!authData.user) {
        return { user: null, error: new Error("Failed to sign in") };
      }

      // Fetch user profile from users table
      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authData.user.id)
        .single();

      // If profile doesn't exist or has invalid role, create a temporary user with default role
      if (profileError || !profileData) {
        console.warn("User profile not found for user ID:", authData.user.id, "Creating temporary user with default role");
        
        // Return a temporary user with default role so they can access the dashboard
        // They can complete their profile later
        const tempUser: User = {
          id: authData.user.id,
          email: authData.user.email!,
          name: authData.user.user_metadata?.name || authData.user.email!.split("@")[0],
          role: "jobseeker", // Default role - can be updated later
          createdAt: new Date().toISOString(),
        };
        
        return { user: tempUser, error: null };
      }

      // Validate role - if invalid, use default
      const validRoles: User["role"][] = ["jobseeker", "admin", "trainer", "employer", "validator", "spd"];
      const userRole = profileData.role as User["role"];
      const isValidRole = validRoles.includes(userRole);

      const user: User = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        role: isValidRole ? userRole : "jobseeker", // Fallback to jobseeker if invalid role
        avatar: profileData.avatar || undefined,
        phone: profileData.phone || undefined,
        address: profileData.address || undefined,
        skills: profileData.skills || undefined,
        createdAt: profileData.created_at,
      };

      if (!isValidRole) {
        console.warn("Invalid role found:", userRole, "Using default role: jobseeker");
      }

      return { user, error: null };
    } catch (error) {
      return {
        user: null,
        error: error instanceof Error ? error : new Error("Unknown error occurred"),
      };
    }
  },

  /**
   * Sign out the current user
   */
  logout: async (): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return { error: new Error("Supabase client not initialized") };
    }
    try {
      const { error } = await supabase.auth.signOut();
      return { error: error || null };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error("Unknown error occurred"),
      };
    }
  },

  /**
   * Get the current session (without fetching user profile)
   */
  getSession: async () => {
    if (!supabase) {
      return { data: { session: null }, error: new Error("Supabase not initialized") };
    }
    return await supabase.auth.getSession();
  },

  /**
   * Get the current authenticated user
   */
  getCurrentUser: async (): Promise<{ user: User | null; error: Error | null }> => {
    if (!supabase) {
      return { user: null, error: new Error("Supabase client not initialized") };
    }
    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        return { user: null, error: authError || new Error("No user found") };
      }

      // Fetch user profile from users table with timeout
      const profilePromise = supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) => {
        setTimeout(() => {
          resolve({ data: null, error: new Error("Database query timeout") });
        }, 5000); // 5 second timeout
      });

      const { data: profileData, error: profileError } = await Promise.race([
        profilePromise,
        timeoutPromise,
      ]) as any;

      if (profileError || !profileData) {
        // Log the error for admin review
        // This should not happen if database trigger is working correctly
        console.error("User profile not found - data integrity issue:", {
          userId: authUser.id,
          email: authUser.email,
          error: profileError?.message || "Profile not found",
          errorCode: profileError?.code,
        });

        // Return error - profile should be created by database trigger during signup
        // If missing, admin needs to create it manually or fix the trigger
        return { 
          user: null, 
          error: new Error(
            "User profile not found. Please contact an administrator to set up your account."
          ) 
        };
      }

      const user: User = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        role: profileData.role as User["role"],
        avatar: profileData.avatar || undefined,
        phone: profileData.phone || undefined,
        address: profileData.address || undefined,
        skills: profileData.skills || undefined,
        createdAt: profileData.created_at,
      };

      return { user, error: null };
    } catch (error) {
      return {
        user: null,
        error: error instanceof Error ? error : new Error("Unknown error occurred"),
      };
    }
  },

  /**
   * Update user profile
   */
  updateUser: async (userId: string, updates: Partial<User>): Promise<{ user: User | null; error: Error | null }> => {
    if (!supabase) {
      return { user: null, error: new Error("Supabase client not initialized") };
    }
    try {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.phone !== undefined) updateData.phone = updates.phone;
      if (updates.address !== undefined) updateData.address = updates.address;
      if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
      if (updates.skills !== undefined) updateData.skills = updates.skills;
      if (updates.role !== undefined) updateData.role = updates.role;

      const { data, error } = await supabase
        .from("users")
        .update(updateData as any)
        .eq("id", userId)
        .select()
        .single();

      if (error || !data) {
        return { user: null, error: error || new Error("Failed to update user") };
      }

      const user: User = {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role as User["role"],
        avatar: data.avatar || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        skills: data.skills || undefined,
        createdAt: data.created_at,
      };

      return { user, error: null };
    } catch (error) {
      return {
        user: null,
        error: error instanceof Error ? error : new Error("Unknown error occurred"),
      };
    }
  },

  /**
   * Reset password (sends password reset email)
   */
  resetPassword: async (email: string): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return { error: new Error("Supabase client not initialized") };
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error: error || null };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error("Unknown error occurred"),
      };
    }
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange: (callback: (user: User | null) => void) => {
    if (!supabase) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle explicit sign out - always clear user
      if (event === "SIGNED_OUT") {
        callback(null);
        return;
      }
      
      // If no session, clear user
      if (!session?.user) {
        callback(null);
        return;
      }

      // For SIGNED_IN events, fetch user profile
      if (event === "SIGNED_IN") {
        try {
          const { user, error } = await supabaseAuthService.getCurrentUser();
          if (!error && user) {
            callback(user);
          } else {
            console.warn("Auth state change: user fetch failed on SIGNED_IN", error?.message);
            // Don't logout on SIGNED_IN errors - let the session persist
            // The user might still be authenticated, just profile fetch failed
          }
        } catch (error) {
          console.error("Error in auth state change (SIGNED_IN):", error);
          // Don't logout on errors - session might still be valid
        }
        return;
      }

      // For TOKEN_REFRESHED events, don't refetch user - just keep current state
      // Token refresh is automatic and shouldn't trigger logout
      if (event === "TOKEN_REFRESHED") {
        // Token was refreshed successfully, user is still authenticated
        // Don't refetch user profile to avoid unnecessary database calls
        // The existing user state should remain valid
        return;
      }

      // For other events (USER_UPDATED, etc.), try to refresh user if session exists
      if (session?.user) {
        try {
          const { user, error } = await supabaseAuthService.getCurrentUser();
          if (!error && user) {
            callback(user);
          }
          // If error, don't logout - keep existing state
        } catch (error) {
          console.error("Error in auth state change:", error);
          // Don't logout on errors
        }
      }
    });
  },
};

