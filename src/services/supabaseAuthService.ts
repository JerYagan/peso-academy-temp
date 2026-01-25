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
    
    // Basic email validation and normalization
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { 
        user: null, 
        error: new Error("Invalid email format. Please enter a valid email address.") 
      };
    }
    
    // Trim and normalize email
    const trimmedEmail = email.trim().toLowerCase();
    
    try {
      // IMPORTANT: Save the current admin session before creating user
      // signUp() will automatically log in as the new user, so we need to restore admin session
      const { data: currentSession } = await supabase.auth.getSession();
      const adminSession = currentSession?.session;
      const adminUserId = adminSession?.user?.id;
      
      // Sign up with Supabase Auth
      // Note: In development, Supabase may restrict emails to pre-authorized addresses
      // To allow any email, configure custom SMTP or disable email confirmation in Supabase dashboard
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            name,
            role,
          },
          // For development: auto-confirm email if email confirmation is disabled
          // This requires Supabase project settings to have "Enable email confirmations" disabled
        },
      });
      
      // Immediately restore the admin session to prevent being logged in as the new user
      // This ensures the admin stays logged in as themselves without any visual glitches
      if (authData?.user && adminSession && adminUserId) {
        // Restore admin session immediately (this will replace the new user's session)
        // Do this synchronously to prevent any auth state changes from propagating
        try {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: adminSession.access_token,
            refresh_token: adminSession.refresh_token,
          });
          
          if (sessionError) {
            console.warn("Session restoration failed, trying sign out approach:", sessionError);
            // Fallback: sign out first, then restore
            await supabase.auth.signOut();
            await supabase.auth.setSession({
              access_token: adminSession.access_token,
              refresh_token: adminSession.refresh_token,
            });
          }
          
          // Small delay to ensure session is fully restored before continuing
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error("Error restoring admin session:", err);
          // Try fallback approach
          await supabase.auth.signOut();
          if (adminSession) {
            await supabase.auth.setSession({
              access_token: adminSession.access_token,
              refresh_token: adminSession.refresh_token,
            });
          }
        }
      } else if (authData?.user && !adminSession) {
        // No admin session to restore, just sign out
        await supabase.auth.signOut();
      }

      // IMPORTANT: Check if user was created FIRST, even if there's an error
      // Supabase sometimes returns errors even when user creation succeeds
      const userWasCreated = !!(authData?.user);
      
      if (authError) {
        // Log detailed error information for debugging
        console.error("Supabase Auth signup error:", {
          message: authError.message,
          status: authError.status,
          name: authError.name,
          code: authError.status,
          userWasCreated: userWasCreated,
          userId: authData?.user?.id,
          hasAuthData: !!authData,
        });
        
        // If user was created despite the error, continue with profile creation
        // This handles cases where Supabase returns an error but still creates the auth user
        if (userWasCreated) {
          console.warn("Auth error occurred but user was created. Continuing with profile creation.", {
            errorMessage: authError.message,
            userId: authData.user.id,
            email: authData.user.email,
          });
          // Don't return error, continue to profile creation below
        } else {
          // User was NOT created, handle the error
          let errorMessage = authError.message;
          
          if (authError.message.includes("already registered") || 
              authError.message.includes("already exists") ||
              authError.message.includes("User already registered")) {
            errorMessage = "A user with this email already exists";
          } else if (authError.message.includes("Password")) {
            errorMessage = "Password does not meet requirements";
          } else if (authError.message.includes("invalid") && authError.message.includes("email")) {
            errorMessage = `Email validation failed: ${trimmedEmail}. This may be because:\n1. Supabase default SMTP only allows pre-authorized emails\n2. Email confirmation is enabled and the domain is not verified\n\nSolution: In Supabase Dashboard → Authentication → Settings, either:\n- Disable "Enable email confirmations" for development, OR\n- Configure custom SMTP provider, OR\n- Add this email to authorized recipients list`;
          }
          
          return { 
            user: null, 
            error: new Error(errorMessage || "Failed to create user account. Please try again.") 
          };
        }
      }

      // Final safety check: If no user was created (shouldn't happen if no error, but check anyway)
      if (!authData?.user) {
        console.error("No user created and no error was returned - unexpected state");
        return { user: null, error: new Error("Failed to create user account") };
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

        if (insertError) {
          console.error("Profile creation error:", insertError);
          console.error("Insert error details:", {
            code: insertError?.code,
            message: insertError?.message,
            details: insertError?.details,
            hint: insertError?.hint,
          });
          
          // Check if it's a unique constraint violation (user already exists)
          if (insertError.code === "23505" || insertError.message?.includes("duplicate") || insertError.message?.includes("unique")) {
            // User already exists, try to fetch it
            console.log("User profile already exists, fetching...");
            const { data: existingUser } = await supabase
              .from("users")
              .select("*")
              .eq("id", authData.user.id)
              .single();
            
            if (existingUser) {
              profileData = existingUser;
            } else {
              // Try by email
              const { data: userByEmail } = await supabase
                .from("users")
                .select("*")
                .eq("email", authData.user.email!)
                .single();
              
              if (userByEmail) {
                profileData = userByEmail;
              }
            }
          } else if (insertError?.code === "42501" || insertError?.message?.includes("policy") || insertError?.message?.includes("permission")) {
            // RLS policy error - but auth user was created, so return success with warning
            console.warn("RLS policy blocked profile creation, but auth user was created");
            // Don't return error - auth user exists, profile can be created later
          } else {
            // Other errors - log but don't fail since auth user was created
            console.warn("Could not create profile, but auth user was created:", insertError);
          }
        } else if (insertedData) {
          profileData = insertedData;
        }
      }

      // If we still don't have profile data, create a minimal user object from auth data
      // This allows the user to log in, and the profile can be created on first access
      if (!profileData) {
        console.warn("Profile not created, but auth user exists. Creating minimal user object.");
        const minimalUser: User = {
          id: authData.user.id,
          email: authData.user.email!,
          name: name,
          role: role,
          createdAt: authData.user.created_at || new Date().toISOString(),
        };
        return { user: minimalUser, error: null };
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
   * Simple sign in (like payroll-pal) - just signs in, doesn't fetch profile
   */
  signIn: async (
    email: string,
    password: string
  ): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return { error: new Error("Supabase client not initialized") };
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error || null };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error("Unknown error occurred"),
      };
    }
  },

  /**
   * Sign in an existing user (legacy - kept for compatibility)
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

      // Get role from user_metadata (payroll-pal approach)
      const roleFromMetadata = authData.user.user_metadata?.role || 'trainee';
      const validRoles: User["role"][] = ["admin", "training_officer", "validator", "trainee"];
      const userRole = validRoles.includes(roleFromMetadata) ? roleFromMetadata : 'trainee';

      // Fetch user profile from users table (for other profile data, not role)
      // Add timeout to prevent hanging
      const profilePromise = supabase
        .from("users")
        .select("*")
        .eq("id", authData.user.id)
        .single();

      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) => {
        setTimeout(() => {
          resolve({ data: null, error: new Error("Profile fetch timeout") });
        }, 5000); // 5 second timeout for profile fetch
      });

      let profileData = null;
      let profileError = null;

      try {
        const result = await Promise.race([profilePromise, timeoutPromise]) as any;
        profileData = result.data;
        profileError = result.error;
      } catch (err) {
        profileError = err instanceof Error ? err : new Error("Profile fetch failed");
      }

      // If profile doesn't exist or fetch timed out, create a temporary user
      if (profileError || !profileData) {
        console.warn("User profile not found or fetch timed out for user ID:", authData.user.id, "Creating temporary user");
        
        // Return a temporary user - profile will be created by trigger or can be fetched later
        const tempUser: User = {
          id: authData.user.id,
          email: authData.user.email!,
          name: authData.user.user_metadata?.name || authData.user.email!.split("@")[0],
          role: userRole, // Role from metadata
          createdAt: authData.user.created_at || new Date().toISOString(),
        };
        
        return { user: tempUser, error: null };
      }

      // Build user object with role from metadata (not database)
      const user: User = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        role: userRole, // Role from user_metadata, not database
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

      // Get role from user_metadata (payroll-pal approach)
      const roleFromMetadata = authUser.user_metadata?.role || 'trainee';
      const validRoles: User["role"][] = ["admin", "training_officer", "validator", "trainee"];
      const userRole = validRoles.includes(roleFromMetadata) ? roleFromMetadata : 'trainee';

      // Fetch user profile from users table with timeout (for other profile data, not role)
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
        // Profile doesn't exist, but we can still return user with role from metadata
        // Profile will be created by trigger or can be created later
        console.warn("User profile not found, using auth user data:", {
          userId: authUser.id,
          email: authUser.email,
          role: userRole,
        });

        const user: User = {
          id: authUser.id,
          email: authUser.email!,
          name: authUser.user_metadata?.name || authUser.email!.split("@")[0],
          role: userRole, // Role from metadata
          createdAt: authUser.created_at || new Date().toISOString(),
        };

        return { user, error: null };
      }

      // Build user object with role from metadata (not database)
      const user: User = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        role: userRole, // Role from user_metadata, not database
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

      // If role is being updated, sync it to auth metadata FIRST
      if (updates.role !== undefined) {
        const { error: roleError } = await supabase.rpc('set_user_role_by_id', {
          user_id: userId,
          user_role: updates.role
        });

        if (roleError) {
          console.error("Error updating role in auth metadata:", roleError);
          // Don't return error here - continue with database update
          // The role might still be updated in the database table
        }
      }

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
   * Get Supabase auth user (contains user_metadata with role)
   */
  getSupabaseUser: async () => {
    if (!supabase) {
      return { data: { user: null }, error: new Error("Supabase client not initialized") };
    }
    return await supabase.auth.getUser();
  },

  /**
   * Listen to auth state changes
   * Simplified like payroll-pal - just pass the session user directly
   */
  onAuthStateChange: (callback: (user: User | null, supabaseUser: any) => void) => {
    if (!supabase) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Simple: just pass the session user (or null if no session)
      // AuthContext will handle creating the User object from Supabase user
      callback(null, session?.user ?? null);
    });
    
    return { data: { subscription } };
  },
};

