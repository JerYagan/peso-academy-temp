import { User, normalizeUserRole } from "@/types/auth";
import { supabase, handleSupabaseError } from "@/lib/supabase";

if (!supabase) {
  console.warn("Supabase client not initialized. Please set up environment variables.");
}

type UserProfileRecord = {
  id: string;
  email: string;
  name: string;
  role?: string | null;
  avatar?: string | null;
  phone?: string | null;
  address?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  civil_status?: string | null;
  employment_status?: string | null;
  occupation?: string | null;
  education_level?: string | null;
  barangay?: string | null;
  city_municipality?: string | null;
  province?: string | null;
  postal_code?: string | null;
  industry_interests?: string[] | null;
  preferred_categories?: string[] | null;
  onboarding_skill_level?: string | null;
  skills?: string[] | null;
  created_at: string;
};

const getMetadataString = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const getMetadataStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const entries = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return entries.length > 0 ? entries : undefined;
};

const resolveUserRole = (profileRole: unknown, metadataRole: unknown): User["role"] => {
  if (typeof profileRole === "string" && profileRole.trim().length > 0) {
    return normalizeUserRole(profileRole);
  }

  return normalizeUserRole(metadataRole);
};

const buildUserFromSources = (
  authUser: { id: string; email?: string | null; created_at?: string | null; user_metadata?: Record<string, any> | null },
  profileData: UserProfileRecord | null,
): User => {
  const displayName =
    profileData?.name ||
    authUser.user_metadata?.full_name ||
    authUser.user_metadata?.name ||
    authUser.email?.split("@")[0] ||
    "User";

  return {
    id: profileData?.id || authUser.id,
    email: profileData?.email || authUser.email || "",
    name: displayName,
    role: resolveUserRole(profileData?.role, authUser.user_metadata?.role),
    avatar: profileData?.avatar || undefined,
    phone: profileData?.phone || undefined,
    address: profileData?.address || undefined,
    dateOfBirth: profileData?.date_of_birth || undefined,
    gender: (profileData?.gender as User["gender"] | undefined) || undefined,
    civilStatus: (profileData?.civil_status as User["civilStatus"] | undefined) || undefined,
    employmentStatus: (profileData?.employment_status as User["employmentStatus"] | undefined) || undefined,
    occupation: profileData?.occupation || undefined,
    educationLevel: profileData?.education_level || undefined,
    barangay: profileData?.barangay || undefined,
    cityMunicipality: profileData?.city_municipality || undefined,
    province: profileData?.province || undefined,
    postalCode: profileData?.postal_code || undefined,
    industryInterests: profileData?.industry_interests || getMetadataStringArray(authUser.user_metadata?.industry_interests),
    preferredCategories: profileData?.preferred_categories || getMetadataStringArray(authUser.user_metadata?.preferred_categories),
    onboardingSkillLevel:
      (profileData?.onboarding_skill_level as User["onboardingSkillLevel"] | undefined) ||
      (typeof authUser.user_metadata?.onboarding_skill_level === "string"
        ? (authUser.user_metadata.onboarding_skill_level as User["onboardingSkillLevel"])
        : undefined),
    onboardingConfidenceLevel: getMetadataString(authUser.user_metadata?.onboarding_confidence_level) as User["onboardingConfidenceLevel"] | undefined,
    onboardingWeeklyCommitment: getMetadataString(authUser.user_metadata?.onboarding_weekly_commitment) as User["onboardingWeeklyCommitment"] | undefined,
    onboardingDigitalComfort: getMetadataString(authUser.user_metadata?.onboarding_digital_comfort) as User["onboardingDigitalComfort"] | undefined,
    onboardingCompletedAt: getMetadataString(authUser.user_metadata?.onboarding_completed_at),
    skills: profileData?.skills || getMetadataStringArray(authUser.user_metadata?.skills),
    createdAt: profileData?.created_at || authUser.created_at || new Date().toISOString(),
  };
};

const resolveCurrentProfileId = async (): Promise<string | null> => {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc("get_current_user_profile_id");

    if (error) {
      return null;
    }

    return typeof data === "string" && data.length > 0 ? data : null;
  } catch {
    return null;
  }
};

const ensureUserProfileRecord = async (
  authUser: { id: string; email?: string | null; created_at?: string | null; user_metadata?: Record<string, any> | null },
): Promise<UserProfileRecord | null> => {
  if (!supabase) {
    return null;
  }

  const email = authUser.email || `${authUser.id}@temp.local`;
  const name =
    getMetadataString(authUser.user_metadata?.name) ||
    getMetadataString(authUser.user_metadata?.full_name) ||
    email.split("@")[0] ||
    "User";

  const payload = {
    id: authUser.id,
    email,
    name,
    role: normalizeUserRole(authUser.user_metadata?.role),
    phone: getMetadataString(authUser.user_metadata?.phone) || null,
    address: getMetadataString(authUser.user_metadata?.address) || null,
    date_of_birth: getMetadataString(authUser.user_metadata?.date_of_birth) || null,
    gender: getMetadataString(authUser.user_metadata?.gender) || null,
    civil_status: getMetadataString(authUser.user_metadata?.civil_status) || null,
    employment_status: getMetadataString(authUser.user_metadata?.employment_status) || null,
    occupation: getMetadataString(authUser.user_metadata?.occupation) || null,
    education_level: getMetadataString(authUser.user_metadata?.education_level) || null,
    barangay: getMetadataString(authUser.user_metadata?.barangay) || null,
    city_municipality: getMetadataString(authUser.user_metadata?.city_municipality) || null,
    province: getMetadataString(authUser.user_metadata?.province) || null,
    postal_code: getMetadataString(authUser.user_metadata?.postal_code) || null,
    industry_interests: getMetadataStringArray(authUser.user_metadata?.industry_interests) || [],
    preferred_categories: getMetadataStringArray(authUser.user_metadata?.preferred_categories) || [],
    onboarding_skill_level: getMetadataString(authUser.user_metadata?.onboarding_skill_level) || null,
    skills: getMetadataStringArray(authUser.user_metadata?.skills) || [],
    created_at: authUser.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("users")
    .upsert(payload as any, { onConflict: "id" })
    .select("*")
    .maybeSingle();

  if (error) {
    console.warn("Could not self-heal missing user profile row:", error);
    return null;
  }

  return (data as UserProfileRecord | null) || null;
};

const loadUserProfile = async (userId: string, email?: string | null): Promise<{ profileData: UserProfileRecord | null; profileError: Error | null }> => {
  if (!supabase) {
    return { profileData: null, profileError: new Error("Supabase client not initialized") };
  }

  const profilePromise = supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) => {
    setTimeout(() => {
      resolve({ data: null, error: new Error("Profile fetch timeout") });
    }, 5000);
  });

  try {
    const result = await Promise.race([profilePromise, timeoutPromise]) as {
      data: UserProfileRecord | null;
      error: Error | null;
    };

    if (result.data) {
      return {
        profileData: result.data,
        profileError: result.error,
      };
    }

    if (email) {
      const emailResult = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (emailResult.data) {
        return {
          profileData: emailResult.data as UserProfileRecord,
          profileError: result.error,
        };
      }

      return {
        profileData: null,
        profileError: (emailResult.error as Error | null) || result.error,
      };
    }

    const resolvedProfileId = await resolveCurrentProfileId();
    if (resolvedProfileId && resolvedProfileId !== userId) {
      const resolvedResult = await supabase
        .from("users")
        .select("*")
        .eq("id", resolvedProfileId)
        .maybeSingle();

      if (resolvedResult.data) {
        return {
          profileData: resolvedResult.data as UserProfileRecord,
          profileError: result.error,
        };
      }
    }

    return {
      profileData: result.data,
      profileError: result.error,
    };
  } catch (error) {
    return {
      profileData: null,
      profileError: error instanceof Error ? error : new Error("Profile fetch failed"),
    };
  }
};

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
    role: User["role"],
    profile?: Partial<User>
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
      const canonicalRole = normalizeUserRole(role);
      const adminCreateInProgress =
        typeof window !== "undefined" && window.sessionStorage.getItem("admin_creating_user") === "1";

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
            role: canonicalRole,
            phone: profile?.phone ?? null,
            address: profile?.address ?? null,
            date_of_birth: profile?.dateOfBirth ?? null,
            gender: profile?.gender ?? null,
            civil_status: profile?.civilStatus ?? null,
            employment_status: profile?.employmentStatus ?? null,
            occupation: profile?.occupation ?? null,
            education_level: profile?.educationLevel ?? null,
            barangay: profile?.barangay ?? null,
            city_municipality: profile?.cityMunicipality ?? null,
            province: profile?.province ?? null,
            postal_code: profile?.postalCode ?? null,
            industry_interests: profile?.industryInterests ?? [],
            preferred_categories: profile?.preferredCategories ?? [],
            onboarding_skill_level: profile?.onboardingSkillLevel ?? null,
            onboarding_confidence_level: profile?.onboardingConfidenceLevel ?? null,
            onboarding_weekly_commitment: profile?.onboardingWeeklyCommitment ?? null,
            onboarding_digital_comfort: profile?.onboardingDigitalComfort ?? null,
            onboarding_completed_at: profile?.onboardingCompletedAt ?? null,
            skills: profile?.skills ?? [],
          },
          // For development: auto-confirm email if email confirmation is disabled
          // This requires Supabase project settings to have "Enable email confirmations" disabled
        },
      });
      
      // Only restore the previous session during admin-created user flows.
      // Public signup must keep the new user authenticated so missing public.users
      // rows can be self-healed by the fallback insert path if the trigger misses.
      if (authData?.user && adminCreateInProgress && adminSession && adminUserId) {
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
          } else if (authError.message.toLowerCase().includes("rate limit") || authError.message.toLowerCase().includes("email rate limit exceeded")) {
            errorMessage = "Supabase email rate limit was exceeded while creating the user. This usually means email confirmations are enabled in the project. Disable email confirmations for admin-created accounts or wait for the rate limit window to reset.";
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
        const profileResult = await loadUserProfile(authData.user.id, authData.user.email);

        if (profileResult.profileData) {
          profileData = profileResult.profileData;
          break;
        }

        profileError = profileResult.profileError;
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
          role: canonicalRole,
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
            role: canonicalRole,
            phone: profile?.phone,
            address: profile?.address,
            date_of_birth: profile?.dateOfBirth,
            gender: profile?.gender,
            civil_status: profile?.civilStatus,
            employment_status: profile?.employmentStatus,
            occupation: profile?.occupation,
            education_level: profile?.educationLevel,
            barangay: profile?.barangay,
            city_municipality: profile?.cityMunicipality,
            province: profile?.province,
            postal_code: profile?.postalCode,
            industry_interests: profile?.industryInterests || [],
            preferred_categories: profile?.preferredCategories || [],
            onboarding_skill_level: profile?.onboardingSkillLevel || null,
            skills: profile?.skills || [],
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

      // Ensure role in users table matches the one we set in auth (trigger may have defaulted to trainee)
      if (profileData && normalizeUserRole(profileData.role) !== canonicalRole) {
        const { error: updateRoleError } = await supabase
          .from("users")
          .update({ role: canonicalRole, updated_at: new Date().toISOString() })
          .eq("id", authData.user.id);
        if (updateRoleError) {
          console.warn("Could not sync role to users table:", updateRoleError);
        } else {
          profileData = { ...profileData, role: canonicalRole };
        }
      }

      const onboardingUpdateData: Record<string, unknown> = {};
      if (profile?.industryInterests !== undefined) onboardingUpdateData.industry_interests = profile.industryInterests;
      if (profile?.preferredCategories !== undefined) onboardingUpdateData.preferred_categories = profile.preferredCategories;
      if (profile?.onboardingSkillLevel !== undefined) onboardingUpdateData.onboarding_skill_level = profile.onboardingSkillLevel || null;
      if (profile?.skills !== undefined) onboardingUpdateData.skills = profile.skills;

      if (profileData && Object.keys(onboardingUpdateData).length > 0) {
        const { data: syncedProfile, error: onboardingSyncError } = await supabase
          .from("users")
          .update({
            ...onboardingUpdateData,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", authData.user.id)
          .select()
          .single();

        if (!onboardingSyncError && syncedProfile) {
          profileData = syncedProfile;
        } else if (onboardingSyncError) {
          console.warn("Could not sync onboarding fields to users table:", onboardingSyncError);
        }
      }

      // If we still don't have profile data, create a minimal user object from auth data
      // This allows the user to log in, and the profile can be created on first access
      if (!profileData) {
        const ensuredProfile = await ensureUserProfileRecord(authData.user);

        if (ensuredProfile) {
          return { user: buildUserFromSources(authData.user, ensuredProfile), error: null };
        }

        console.warn("Profile not created, but auth user exists. Creating minimal user object.");
        const minimalUser: User = {
          id: authData.user.id,
          email: authData.user.email!,
          name: name,
          role: canonicalRole,
          phone: profile?.phone,
          address: profile?.address,
          dateOfBirth: profile?.dateOfBirth,
          gender: profile?.gender,
          civilStatus: profile?.civilStatus,
          employmentStatus: profile?.employmentStatus,
          occupation: profile?.occupation,
          educationLevel: profile?.educationLevel,
          barangay: profile?.barangay,
          cityMunicipality: profile?.cityMunicipality,
          province: profile?.province,
          postalCode: profile?.postalCode,
          industryInterests: profile?.industryInterests,
          preferredCategories: profile?.preferredCategories,
          onboardingSkillLevel: profile?.onboardingSkillLevel,
          onboardingConfidenceLevel: profile?.onboardingConfidenceLevel,
          onboardingWeeklyCommitment: profile?.onboardingWeeklyCommitment,
          onboardingDigitalComfort: profile?.onboardingDigitalComfort,
          onboardingCompletedAt: profile?.onboardingCompletedAt,
          skills: profile?.skills,
          createdAt: authData.user.created_at || new Date().toISOString(),
        };
        return { user: minimalUser, error: null };
      }

      const user: User = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        role: normalizeUserRole(profileData.role),
        avatar: profileData.avatar || undefined,
        phone: profileData.phone || undefined,
        address: profileData.address || undefined,
        dateOfBirth: profileData.date_of_birth || undefined,
        gender: (profileData.gender as User["gender"] | undefined) || undefined,
        civilStatus: (profileData.civil_status as User["civilStatus"] | undefined) || undefined,
        employmentStatus: (profileData.employment_status as User["employmentStatus"] | undefined) || undefined,
        occupation: profileData.occupation || undefined,
        educationLevel: profileData.education_level || undefined,
        barangay: profileData.barangay || undefined,
        cityMunicipality: profileData.city_municipality || undefined,
        province: profileData.province || undefined,
        postalCode: profileData.postal_code || undefined,
        industryInterests: profileData.industry_interests || undefined,
        preferredCategories: profileData.preferred_categories || undefined,
        onboardingSkillLevel: (profileData.onboarding_skill_level as User["onboardingSkillLevel"] | undefined) || undefined,
        onboardingConfidenceLevel: getMetadataString(authData.user.user_metadata?.onboarding_confidence_level) as User["onboardingConfidenceLevel"] | undefined,
        onboardingWeeklyCommitment: getMetadataString(authData.user.user_metadata?.onboarding_weekly_commitment) as User["onboardingWeeklyCommitment"] | undefined,
        onboardingDigitalComfort: getMetadataString(authData.user.user_metadata?.onboarding_digital_comfort) as User["onboardingDigitalComfort"] | undefined,
        onboardingCompletedAt: getMetadataString(authData.user.user_metadata?.onboarding_completed_at),
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

      const { profileData, profileError } = await loadUserProfile(authData.user.id, authData.user.email);

      // If profile doesn't exist or fetch timed out, create a temporary user
      if (profileError || !profileData) {
        const ensuredProfile = await ensureUserProfileRecord(authData.user);
        if (ensuredProfile) {
          return { user: buildUserFromSources(authData.user, ensuredProfile), error: null };
        }

        console.warn("User profile not found or fetch timed out for user ID:", authData.user.id, "Creating temporary user");

        return { user: buildUserFromSources(authData.user, null), error: null };
      }

      const user = buildUserFromSources(authData.user, profileData);

      return { user, error: null };
    } catch (error) {
      return {
        user: null,
        error: error instanceof Error ? error : new Error("Unknown error occurred"),
      };
    }
  },

  /**
   * Sign in with Google (OAuth). Redirects the browser to Google; after callback,
   * the session is established and onAuthStateChange fires.
   */
  signInWithGoogle: async (redirectTo?: string): Promise<{ url: string | null; error: Error | null }> => {
    if (!supabase) {
      return { url: null, error: new Error("Supabase client not initialized") };
    }
    try {
      const redirectUrl = redirectTo ?? `${window.location.origin}${window.location.pathname || "/"}`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) return { url: null, error };
      return { url: data?.url ?? null, error: null };
    } catch (error) {
      return {
        url: null,
        error: error instanceof Error ? error : new Error("Unknown error occurred"),
      };
    }
  },

  /**
   * Ensure a user signed in via Google has role 'trainee' and name set in metadata.
   * Call this after session is established (e.g. on auth state change) for Google users.
   */
  ensureGoogleUserMetadata: async (): Promise<{ error: Error | null }> => {
    if (!supabase) return { error: new Error("Supabase client not initialized") };
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: null };

      const provider = user.app_metadata?.provider ?? user.identities?.[0]?.provider;
      if (provider !== "google") return { error: null };

      const meta = user.user_metadata ?? {};
      const displayName =
        meta.full_name ?? meta.name ?? (user.email ? user.email.split("@")[0] : "User");
      const role = meta.role;
      const normalizedRole = normalizeUserRole(role);
      const needsRole = !role || normalizedRole !== role;
      const needsName = !meta.name && !meta.full_name;

      if (!needsRole && !needsName) return { error: null };

      const updates: Record<string, string> = {};
      if (needsRole) updates.role = normalizedRole;
      if (needsName) updates.name = displayName;

      const { error } = await supabase.auth.updateUser({
        data: { ...meta, ...updates },
      });
      return { error: error || null };
    } catch (error) {
      return {
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

      const { profileData, profileError } = await loadUserProfile(authUser.id, authUser.email);

      if (profileError || !profileData) {
        const ensuredProfile = await ensureUserProfileRecord(authUser);
        if (ensuredProfile) {
          return { user: buildUserFromSources(authUser, ensuredProfile), error: null };
        }

        // Profile doesn't exist, but we can still return user with role from metadata
        // Profile will be created by trigger or can be created later
        console.warn("User profile not found, using auth user data:", {
          userId: authUser.id,
          email: authUser.email,
          role: normalizeUserRole(authUser.user_metadata?.role),
        });

        return { user: buildUserFromSources(authUser, null), error: null };
      }

      const user = buildUserFromSources(authUser, profileData);

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
      if (updates.dateOfBirth !== undefined) updateData.date_of_birth = updates.dateOfBirth || null;
      if (updates.gender !== undefined) updateData.gender = updates.gender || null;
      if (updates.civilStatus !== undefined) updateData.civil_status = updates.civilStatus || null;
      if (updates.employmentStatus !== undefined) updateData.employment_status = updates.employmentStatus || null;
      if (updates.occupation !== undefined) updateData.occupation = updates.occupation || null;
      if (updates.educationLevel !== undefined) updateData.education_level = updates.educationLevel || null;
      if (updates.barangay !== undefined) updateData.barangay = updates.barangay || null;
      if (updates.cityMunicipality !== undefined) updateData.city_municipality = updates.cityMunicipality || null;
      if (updates.province !== undefined) updateData.province = updates.province || null;
      if (updates.postalCode !== undefined) updateData.postal_code = updates.postalCode || null;
      if (updates.industryInterests !== undefined) updateData.industry_interests = updates.industryInterests;
      if (updates.preferredCategories !== undefined) updateData.preferred_categories = updates.preferredCategories;
      if (updates.onboardingSkillLevel !== undefined) updateData.onboarding_skill_level = updates.onboardingSkillLevel || null;
      if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
      if (updates.skills !== undefined) updateData.skills = updates.skills;
      if (updates.role !== undefined) updateData.role = updates.role;

      const metadataUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) metadataUpdates.name = updates.name;
      if (updates.phone !== undefined) metadataUpdates.phone = updates.phone || null;
      if (updates.address !== undefined) metadataUpdates.address = updates.address || null;
      if (updates.dateOfBirth !== undefined) metadataUpdates.date_of_birth = updates.dateOfBirth || null;
      if (updates.gender !== undefined) metadataUpdates.gender = updates.gender || null;
      if (updates.civilStatus !== undefined) metadataUpdates.civil_status = updates.civilStatus || null;
      if (updates.employmentStatus !== undefined) metadataUpdates.employment_status = updates.employmentStatus || null;
      if (updates.occupation !== undefined) metadataUpdates.occupation = updates.occupation || null;
      if (updates.educationLevel !== undefined) metadataUpdates.education_level = updates.educationLevel || null;
      if (updates.barangay !== undefined) metadataUpdates.barangay = updates.barangay || null;
      if (updates.cityMunicipality !== undefined) metadataUpdates.city_municipality = updates.cityMunicipality || null;
      if (updates.province !== undefined) metadataUpdates.province = updates.province || null;
      if (updates.postalCode !== undefined) metadataUpdates.postal_code = updates.postalCode || null;
      if (updates.industryInterests !== undefined) metadataUpdates.industry_interests = updates.industryInterests || [];
      if (updates.preferredCategories !== undefined) metadataUpdates.preferred_categories = updates.preferredCategories || [];
      if (updates.onboardingSkillLevel !== undefined) metadataUpdates.onboarding_skill_level = updates.onboardingSkillLevel || null;
      if (updates.onboardingConfidenceLevel !== undefined) metadataUpdates.onboarding_confidence_level = updates.onboardingConfidenceLevel || null;
      if (updates.onboardingWeeklyCommitment !== undefined) metadataUpdates.onboarding_weekly_commitment = updates.onboardingWeeklyCommitment || null;
      if (updates.onboardingDigitalComfort !== undefined) metadataUpdates.onboarding_digital_comfort = updates.onboardingDigitalComfort || null;
      if (updates.onboardingCompletedAt !== undefined) metadataUpdates.onboarding_completed_at = updates.onboardingCompletedAt || null;
      if (updates.skills !== undefined) metadataUpdates.skills = updates.skills || [];

      if (Object.keys(metadataUpdates).length > 0) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: metadataUpdates,
        });

        if (metadataError) {
          console.warn("Error updating auth metadata:", metadataError);
        }
      }

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
        dateOfBirth: data.date_of_birth || undefined,
        gender: (data.gender as User["gender"] | undefined) || undefined,
        civilStatus: (data.civil_status as User["civilStatus"] | undefined) || undefined,
        employmentStatus: (data.employment_status as User["employmentStatus"] | undefined) || undefined,
        occupation: data.occupation || undefined,
        educationLevel: data.education_level || undefined,
        barangay: data.barangay || undefined,
        cityMunicipality: data.city_municipality || undefined,
        province: data.province || undefined,
        postalCode: data.postal_code || undefined,
        industryInterests: data.industry_interests || undefined,
        preferredCategories: data.preferred_categories || undefined,
        onboardingSkillLevel: (data.onboarding_skill_level as User["onboardingSkillLevel"] | undefined) || undefined,
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
   * Update password for the currently signed-in user.
   * Caller should verify current password (e.g. via signInWithPassword) before calling this.
   */
  updatePassword: async (newPassword: string): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return { error: new Error("Supabase client not initialized") };
    }
    if (!newPassword || newPassword.length < 6) {
      return { error: new Error("Password must be at least 6 characters") };
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return { error: error ? error : null };
    } catch (error) {
      return {
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

  hydrateUserFromAuthUser: async (authUser: { id: string; email?: string | null; created_at?: string | null; user_metadata?: Record<string, any> | null }) => {
    const { profileData } = await loadUserProfile(authUser.id, authUser.email);
    const ensuredProfile = profileData || await ensureUserProfileRecord(authUser);
    return buildUserFromSources(authUser, ensuredProfile);
  },

  /**
   * Listen to auth state changes
   * Simplified like payroll-pal - just pass the session user directly
   */
  onAuthStateChange: (callback: (user: User | null, supabaseUser: any, event: string) => void) => {
    if (!supabase) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Simple: just pass the session user (or null if no session)
      // AuthContext will handle creating the User object from Supabase user
      callback(null, session?.user ?? null, event);
    });
    
    return { data: { subscription } };
  },
};

