import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, AuthState, UserRole } from "@/types/auth";
import { supabaseAuthService } from "@/services/supabaseAuthService";
import { auditService } from "@/services/auditService";
import { getUserRole, getUserPermissions, RolePermissions } from "@/lib/roles";
import { User as SupabaseUser } from "@supabase/supabase-js";

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User | null }>;
  loginWithGoogle: (redirectTo?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<{ success: boolean; error?: string; user?: User | null }>;
  updateUser: (user: Partial<User>) => Promise<void>;
  loading: boolean;
  role: UserRole;
  permissions: RolePermissions;
  authUser: SupabaseUser | null; // Supabase auth user (contains user_metadata with role)
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to create user from Supabase user (moved outside component)
const createUserFromSupabaseUser = (supabaseUser: SupabaseUser): User => {
  const rawRole = supabaseUser.user_metadata?.role || 'trainee';
  const roleFromMetadata = typeof rawRole === 'string' ? rawRole.toLowerCase().trim() : 'trainee';
  const validRoles: UserRole[] = ["admin", "training_officer", "validator", "trainee"];
  const userRole = validRoles.includes(roleFromMetadata) ? roleFromMetadata : 'trainee';
  
  // Full name: from Google (full_name) or custom name or email prefix
  const displayName =
    supabaseUser.user_metadata?.full_name ??
    supabaseUser.user_metadata?.name ??
    supabaseUser.email!.split("@")[0];

  return {
    id: supabaseUser.id,
    email: supabaseUser.email!,
    name: displayName,
    role: userRole,
    createdAt: supabaseUser.created_at || new Date().toISOString(),
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  });
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null); // Supabase auth user
  const [loading, setLoading] = useState(true);

  // Get role and permissions from auth user metadata (payroll-pal approach)
  const role = authUser ? getUserRole(authUser) : 'trainee';
  const permissions = authUser ? getUserPermissions(authUser) : getUserPermissions(null);

  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    // Helper function to update state from Supabase user
    const updateStateFromSupabaseUser = (supabaseUser: SupabaseUser | null) => {
      if (!isMounted) return;
      if (supabaseUser) {
        // Ensure Google OAuth users have trainee role and name in metadata (fire-and-forget)
        supabaseAuthService.ensureGoogleUserMetadata().then(({ error }) => {
          if (error) console.warn("ensureGoogleUserMetadata:", error);
        });
        setAuthUser(supabaseUser);
        const user = createUserFromSupabaseUser(supabaseUser);
        setAuthState({ user, isAuthenticated: true });
      } else {
        setAuthUser(null);
        setAuthState({ user: null, isAuthenticated: false });
      }
      setLoading(false);
    };

    // Get initial session (like payroll-pal does - SIMPLE!)
    supabaseAuthService.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      updateStateFromSupabaseUser(session?.user ?? null);
    });

    // Listen for auth changes (like payroll-pal does - SIMPLE!)
    try {
      const authStateChangeResult = supabaseAuthService.onAuthStateChange((_user, supabaseUser) => {
        if (!isMounted) return;
        updateStateFromSupabaseUser(supabaseUser);
      });
      
      subscription = authStateChangeResult.data?.subscription || null;
    } catch (error) {
      console.error("Error setting up auth state change listener:", error);
      if (isMounted) {
        setLoading(false);
      }
    }

    // Cleanup
    return () => {
      isMounted = false;
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error("Error unsubscribing from auth state changes:", error);
        }
      }
    };
  }, []);

  const loginWithGoogle = async (
    redirectTo?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { url, error } = await supabaseAuthService.signInWithGoogle(redirectTo);
      if (error) {
        return { success: false, error: error.message };
      }
      if (url) {
        window.location.href = url;
        return { success: true };
      }
      return { success: false, error: "Could not start Google sign-in" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  };

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: User | null }> => {
    try {
      setLoading(true);
      
      // Simple login - just sign in with Supabase (like payroll-pal)
      const { error } = await supabaseAuthService.signIn(email, password);
      
      if (error) {
        setLoading(false);
        // Log failed login attempt (non-blocking)
        auditService.logFailedLogin(email, error.message).catch((err) => {
          console.error("Failed to log failed login:", err);
        });
        return {
          success: false,
          error: error.message || "Failed to login",
          user: null,
        };
      }

      // Get the current user after login
      // The auth state change listener will also update state, but we get user here for return value
      const { data: { user: supabaseUser } } = await supabaseAuthService.getSupabaseUser();
      
      if (supabaseUser) {
        const user = createUserFromSupabaseUser(supabaseUser);
        
        // Log successful login (non-blocking)
        auditService.logLogin(user.id, true).catch((err) => {
          console.error("Failed to log login event:", err);
        });
        
        setLoading(false);
        return { success: true, user };
      }
      
      setLoading(false);
      return {
        success: false,
        error: "Failed to get user after login",
        user: null,
      };
    } catch (error) {
      setLoading(false);
      // Log failed login attempt (non-blocking)
      auditService.logFailedLogin(email, error instanceof Error ? error.message : "Unknown error").catch((err) => {
        console.error("Failed to log failed login:", err);
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred",
        user: null,
      };
    }
  };

  const logout = async (): Promise<void> => {
    const userId = authState.user?.id;
    
    try {
      // Sign out from Supabase
      const { error } = await supabaseAuthService.logout();
      
      if (error) {
        console.error("Logout error:", error);
      }
      
      // Clear state immediately (auth state change listener will also handle it, but this ensures it's immediate)
      setAuthUser(null);
      setAuthState({
        user: null,
        isAuthenticated: false,
      });
      
      // Log logout event (non-blocking, only if we had a user)
      if (userId) {
        auditService.logLogout(userId).catch((err) => {
          console.error("Failed to log logout event:", err);
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
      // Even on error, clear state
      setAuthUser(null);
      setAuthState({
        user: null,
        isAuthenticated: false,
      });
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    role: UserRole
  ): Promise<{ success: boolean; error?: string; user?: User | null }> => {
    try {
      setLoading(true);
      const { user, error } = await supabaseAuthService.signup(email, password, name, role);
      if (error || !user) {
        setLoading(false);
        return {
          success: false,
          error: error?.message || "Failed to sign up",
          user: null,
        };
      }
      // Update state
      setAuthState({
        user,
        isAuthenticated: true,
      });
      setLoading(false);
      return { success: true, user };
    } catch (error) {
      setLoading(false);
      return {
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred",
        user: null,
      };
    }
  };

  const updateUser = async (updates: Partial<User>): Promise<void> => {
    if (!authState.user) return;

    try {
      const { user, error } = await supabaseAuthService.updateUser(authState.user.id, updates);
      if (error) {
        console.error("Update user error:", error);
        throw error;
      }
      if (user) {
        setAuthState({
          user,
          isAuthenticated: true,
        });
      }
    } catch (error) {
      console.error("Update user error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        loginWithGoogle,
        logout,
        signup,
        updateUser,
        loading,
        role,
        permissions,
        authUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

