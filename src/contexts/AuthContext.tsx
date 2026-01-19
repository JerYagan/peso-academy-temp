import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, AuthState, UserRole } from "@/types/auth";
import { supabaseAuthService } from "@/services/supabaseAuthService";
import { auditService } from "@/services/auditService";

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User | null }>;
  logout: () => Promise<void>;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<{ success: boolean; error?: string; user?: User | null }>;
  updateUser: (user: Partial<User>) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    // Immediately check for existing session (like payroll-pal does)
    // This ensures session persists across hot reloads
    const initializeSession = async () => {
      try {
        const sessionResult = await supabaseAuthService.getSession();
        
        if (!isMounted) return;

        if (sessionResult.data?.session) {
          // Session exists, fetch user profile
          const { user, error } = await supabaseAuthService.getCurrentUser();
          
          if (!isMounted) return;

          if (!error && user) {
            // User found, set authenticated state immediately
            setAuthState({
              user,
              isAuthenticated: true,
            });
            setLoading(false);
            // Clear timeout since we got the user
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            return;
          }
        }

        // No session or user fetch failed
        if (isMounted) {
          setAuthState({
            user: null,
            isAuthenticated: false,
          });
          setLoading(false);
        }
      } catch (error) {
        console.error("Error initializing session:", error);
        if (isMounted) {
          setAuthState({
            user: null,
            isAuthenticated: false,
          });
          setLoading(false);
        }
      }
    };

    // Check session immediately
    initializeSession();

    // Listen to auth state changes from Supabase for future updates
    // This handles SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED events
    try {
      const authStateChangeResult = supabaseAuthService.onAuthStateChange((user) => {
        if (!isMounted) return;
        
        // Clear timeout since auth state change fired
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        setAuthState({
          user,
          isAuthenticated: !!user,
        });
        setLoading(false);
      });
      
      subscription = authStateChangeResult.data?.subscription || null;
      
      // Set a timeout to ensure loading state is cleared even if auth state change doesn't fire
      // This prevents infinite loading states
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn("Auth state change listener timeout - forcing loading to false");
          setLoading(false);
        }
      }, 3000); // 3 second timeout - shorter to fail faster
      
    } catch (error) {
      console.error("Error setting up auth state change listener:", error);
      // Ensure loading is set to false even if subscription setup fails
      if (isMounted) {
        setLoading(false);
      }
    }

    // Single cleanup function
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error("Error unsubscribing from auth state changes:", error);
        }
      }
    };
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: User | null }> => {
    try {
      console.log("Login attempt started for:", email);
      setLoading(true);
      
      // Add timeout to prevent hanging
      const loginPromise = supabaseAuthService.login(email, password);
      const timeoutPromise = new Promise<{ user: null; error: Error }>((_, reject) => {
        setTimeout(() => reject(new Error("Login request timed out")), 10000);
      });
      
      const { user, error } = await Promise.race([loginPromise, timeoutPromise]);
      
      if (error || !user) {
        console.error("Login failed:", error?.message || "No user returned");
        setLoading(false);
        // Log failed login attempt (non-blocking)
        auditService.logFailedLogin(email, error?.message || "Invalid credentials").catch((err) => {
          console.error("Failed to log failed login:", err);
        });
        return {
          success: false,
          error: error?.message || "Failed to login",
          user: null,
        };
      }

      console.log("Login successful, user:", user.email, "role:", user.role);
      
      // Update state immediately - use functional update to ensure state is set
      setAuthState((prevState) => {
        // Only update if user actually changed to prevent unnecessary re-renders
        if (prevState.user?.id === user.id) {
          return prevState;
        }
        return {
          user,
          isAuthenticated: true,
        };
      });
      
      // Force a small delay to ensure state is updated before setting loading to false
      await new Promise(resolve => setTimeout(resolve, 50));
      setLoading(false);
      
      // Log successful login (non-blocking, don't wait for it)
      auditService.logLogin(user.id, true).catch((err) => {
        console.error("Failed to log login event:", err);
      });
      
      console.log("Login function returning success");
      return { success: true, user };
    } catch (error) {
      console.error("Login error caught:", error);
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
      console.log("Logout started");
      setLoading(true);
      
      // Sign out from Supabase first (wait for it to complete)
      const { error } = await supabaseAuthService.logout();
      
      if (error) {
        console.error("Logout error:", error);
      } else {
        console.log("Supabase signOut completed successfully");
      }
      
      // Clear state after signOut completes
      // The onAuthStateChange listener will also handle SIGNED_OUT event,
      // but we clear state here to ensure it's immediate
      setAuthState({
        user: null,
        isAuthenticated: false,
      });
      
      console.log("Logout completed, state cleared");
      
      // Log logout event (non-blocking, only if we had a user)
      if (userId) {
        auditService.logLogout(userId).catch((err) => {
          console.error("Failed to log logout event:", err);
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
      // Clear state even on error
      setAuthState({
        user: null,
        isAuthenticated: false,
      });
    } finally {
      setLoading(false);
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
        logout,
        signup,
        updateUser,
        loading,
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

