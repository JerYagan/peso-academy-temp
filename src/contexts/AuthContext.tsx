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

// localStorage keys
const STORAGE_KEY = "peso_academy_auth_user";
const STORAGE_TIMESTAMP_KEY = "peso_academy_auth_timestamp";
const STORAGE_SESSION_KEY = "peso_academy_auth_session_id";

// Helper functions for localStorage
const getCachedUser = (): User | null => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    const timestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY);
    const cachedSessionId = localStorage.getItem(STORAGE_SESSION_KEY);
    
    if (!cached || !timestamp) return null;
    
    // Check if cache is older than 1 hour (3600000 ms)
    const cacheAge = Date.now() - parseInt(timestamp, 10);
    if (cacheAge > 3600000) {
      // Cache expired, clear it
      clearAuthCache();
      return null;
    }
    
    return JSON.parse(cached) as User;
  } catch (error) {
    console.error("Error reading cached user:", error);
    clearAuthCache();
    return null;
  }
};

const clearAuthCache = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
    localStorage.removeItem(STORAGE_SESSION_KEY);
  } catch (error) {
    console.error("Error clearing auth cache:", error);
  }
};

const setCachedUser = async (user: User | null, sessionId?: string | null) => {
  try {
    if (user) {
      // Get current session ID if not provided
      if (!sessionId) {
        const sessionResult = await supabaseAuthService.getSession();
        sessionId = sessionResult.data?.session?.access_token || null;
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(STORAGE_TIMESTAMP_KEY, Date.now().toString());
      if (sessionId) {
        localStorage.setItem(STORAGE_SESSION_KEY, sessionId);
      }
    } else {
      clearAuthCache();
    }
  } catch (error) {
    console.error("Error caching user:", error);
  }
};

function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize with cached user if available (for fast initial render)
  const cachedUser = getCachedUser();
  const [authState, setAuthState] = useState<AuthState>({
    user: cachedUser,
    isAuthenticated: !!cachedUser,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    let safetyTimeoutId: NodeJS.Timeout;
    
    // Force revalidation on hot reload by checking if this is a new mount
    // Store a flag to detect hot reload
    // Only clear cache if we're not in the middle of a login attempt
    const hotReloadKey = `auth_hot_reload_${Date.now()}`;
    const lastHotReload = sessionStorage.getItem('auth_last_hot_reload');
    const isHotReload = lastHotReload && lastHotReload !== hotReloadKey;
    const isLoggingIn = sessionStorage.getItem('auth_logging_in') === 'true';
    
    sessionStorage.setItem('auth_last_hot_reload', hotReloadKey);
    
    // On hot reload, clear cache to force fresh fetch (but not if actively logging in)
    if (isHotReload && !isLoggingIn) {
      console.log("Hot reload detected, forcing Supabase revalidation");
      clearAuthCache();
    }

    // Safety timeout - always set loading to false after 15 seconds max
    safetyTimeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn("Auth check safety timeout - setting loading to false");
        setLoading(false);
      }
    }, 15000);

    // Check if user is logged in from Supabase with timeout
    const checkUser = async () => {
      try {
        // ALWAYS check Supabase session first (this makes an API call to validate session)
        // This ensures we always make a request to Supabase, even on hot reload
        const sessionResult = await supabaseAuthService.getSession();
        const currentSessionId = sessionResult.data?.session?.access_token || null;
        const cachedSessionId = localStorage.getItem(STORAGE_SESSION_KEY);
        
        // Check if session ID changed (hot reload scenario)
        if (cachedSessionId && currentSessionId && cachedSessionId !== currentSessionId) {
          console.warn("Session ID changed, clearing cache");
          clearAuthCache();
        }
        
        // If we have cached session but no current session, clear cache
        if (cachedSessionId && !currentSessionId) {
          console.warn("Session expired, clearing cache");
          clearAuthCache();
          if (isMounted) {
            setAuthState({
              user: null,
              isAuthenticated: false,
            });
            setLoading(false);
          }
          return;
        }
        
        if (!sessionResult.data?.session) {
          // No session, user is not logged in - clear cache
          if (isMounted) {
            clearAuthCache();
            setAuthState({
              user: null,
              isAuthenticated: false,
            });
            setLoading(false);
          }
          return;
        }

        // Get cached user fresh from localStorage (after session validation)
        const currentCachedUser = getCachedUser();
        
        // If we have cached user and session matches, set loading to false immediately for fast UI
        // BUT we still ALWAYS fetch fresh data from Supabase below
        if (currentCachedUser && currentSessionId === cachedSessionId && isMounted) {
          setLoading(false);
        }

        // ALWAYS fetch user profile from Supabase (even if we have cache)
        // This ensures fresh data and API calls on every mount/hot reload
        console.log("Fetching user profile from Supabase...");
        const timeoutPromise = new Promise<{ user: null; error: Error }>((resolve) => {
          timeoutId = setTimeout(() => {
            resolve({ user: null, error: new Error("Database query timeout") });
          }, 5000); // 5 second timeout for profile fetch
        });

        const userPromise = supabaseAuthService.getCurrentUser();
        const result = await Promise.race([userPromise, timeoutPromise]);

        if (!isMounted) {
          setLoading(false);
          return;
        }

        clearTimeout(timeoutId);

        if (!result.error && result.user) {
          // Update cache and state with session ID
          await setCachedUser(result.user, currentSessionId);
          setAuthState({
            user: result.user,
            isAuthenticated: true,
          });
          setLoading(false);
        } else {
          // If timeout but we have cached user, use cache (session is valid)
          if (result.error?.message?.includes("timeout") && currentCachedUser) {
            console.warn("Profile fetch timeout, using cached user data");
            setAuthState({
              user: currentCachedUser,
              isAuthenticated: true,
            });
            setLoading(false);
            return;
          }

          // If timeout, try once more quickly
          if (result.error?.message?.includes("timeout")) {
            console.warn("Profile fetch timeout, retrying once...");
            try {
              const retryResult = await supabaseAuthService.getCurrentUser();
              if (!isMounted) {
                setLoading(false);
                return;
              }
              if (!retryResult.error && retryResult.user) {
                await setCachedUser(retryResult.user, currentSessionId);
                setAuthState({
                  user: retryResult.user,
                  isAuthenticated: true,
                });
                setLoading(false);
                return;
              }
            } catch (retryError) {
              console.error("Retry failed:", retryError);
              // If retry fails but we have cached user, use cache
              const retryCachedUser = getCachedUser();
              if (retryCachedUser && isMounted) {
                setAuthState({
                  user: retryCachedUser,
                  isAuthenticated: true,
                });
                setLoading(false);
                return;
              }
            }
          }
          
          // If user profile is missing, it's a data integrity issue
          if (result.error?.message?.includes("profile not found") || 
              result.error?.message?.includes("User profile not found")) {
            console.error("User profile missing - data integrity issue:", {
              error: result.error?.message,
            });
            // Clear auth session and cache since profile is required
            clearAuthCache();
            await supabaseAuthService.logout();
          }
          
          clearAuthCache();
          setAuthState({
            user: null,
            isAuthenticated: false,
          });
          setLoading(false);
        }
      } catch (error) {
        console.error("Error checking user:", error);
        // On error, if we have cached user, use it
        const errorCachedUser = getCachedUser();
        if (errorCachedUser && isMounted) {
          setAuthState({
            user: errorCachedUser,
            isAuthenticated: true,
          });
          setLoading(false);
        } else if (isMounted) {
          clearAuthCache();
          setAuthState({
            user: null,
            isAuthenticated: false,
          });
          setLoading(false);
        }
      }
    };

    checkUser();

    // Listen to auth state changes
    const { data: { subscription } } = supabaseAuthService.onAuthStateChange((user) => {
      if (!isMounted) return;
      
      // Only update state if we have a valid user or explicit logout (null)
      // Don't clear user state on temporary errors - only on explicit logout
      setAuthState((prevState) => {
        // If callback returns null and we had a user, it's a logout
        // If callback returns a user, update to that user
        // If callback returns null and we had no user, no change needed
        if (user === null && prevState.user === null) {
          return prevState; // Already logged out, no change
        }
        
        // Update cache when user changes
        if (user) {
          // Get session ID for cache validation (non-blocking)
          supabaseAuthService.getSession().then((sessionResult) => {
            const sessionId = sessionResult.data?.session?.access_token || null;
            setCachedUser(user, sessionId).catch(() => {
              // Silently fail cache update
            });
          }).catch(() => {
            // If session check fails, still cache user but without session ID
            setCachedUser(user, null).catch(() => {
              // Silently fail cache update
            });
          });
        } else {
          clearAuthCache();
        }
        
        return {
          user,
          isAuthenticated: !!user,
        };
      });
      setLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      clearTimeout(safetyTimeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: User | null }> => {
    try {
      console.log("Login attempt started for:", email);
      // Mark that we're logging in to prevent hot reload from clearing cache
      sessionStorage.setItem('auth_logging_in', 'true');
      setLoading(true); // Set loading during login attempt
      
      const { user, error } = await supabaseAuthService.login(email, password);
      
      if (error || !user) {
        console.error("Login failed:", error?.message || "No user returned");
        setLoading(false);
        // Clear login flag on failure
        sessionStorage.removeItem('auth_logging_in');
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
      
      // Update cache and state immediately (with session ID)
      try {
        const sessionResult = await supabaseAuthService.getSession();
        const sessionId = sessionResult.data?.session?.access_token || null;
        await setCachedUser(user, sessionId);
        
        setAuthState({
          user,
          isAuthenticated: true,
        });
        
        console.log("Auth state updated, user authenticated");
      } catch (cacheError) {
        console.error("Error updating cache/state:", cacheError);
        // Still update state even if cache fails
        setAuthState({
          user,
          isAuthenticated: true,
        });
      }
      
      setLoading(false); // IMPORTANT: Set loading to false so ProtectedRoute doesn't block
      
      // Log successful login (non-blocking, don't wait for it)
      auditService.logLogin(user.id, true).catch((err) => {
        console.error("Failed to log login event:", err);
      });
      
      console.log("Login function returning success");
      // Clear login flag
      sessionStorage.removeItem('auth_logging_in');
      // Return user so component can navigate immediately
      return { success: true, user };
    } catch (error) {
      console.error("Login error caught:", error);
      setLoading(false);
      // Clear login flag on error
      sessionStorage.removeItem('auth_logging_in');
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
      setLoading(true);
      
      // Clear cache and state immediately (optimistic update)
      clearAuthCache();
      setAuthState({
        user: null,
        isAuthenticated: false,
      });
      
      // Then sign out from Supabase
      const { error } = await supabaseAuthService.logout();
      if (error) {
        console.error("Logout error:", error);
        // Even if Supabase logout fails, we've already cleared local state
      }
      
      // Log logout event (non-blocking, only if we had a user)
      if (userId) {
        auditService.logLogout(userId).catch((err) => {
          console.error("Failed to log logout event:", err);
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
      // Clear cache even on error
      clearAuthCache();
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
      const { user, error } = await supabaseAuthService.signup(email, password, name, role);
      if (error || !user) {
        setLoading(false); // Set loading to false on error
        return {
          success: false,
          error: error?.message || "Failed to sign up",
          user: null,
        };
      }
      // Update cache and state (with session ID)
      const sessionResult = await supabaseAuthService.getSession();
      const sessionId = sessionResult.data?.session?.access_token || null;
      await setCachedUser(user, sessionId);
      setAuthState({
        user,
        isAuthenticated: true,
      });
      setLoading(false); // Set loading to false after successful signup
      return { success: true, user };
    } catch (error) {
      setLoading(false); // Set loading to false on error
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
        // Update cache and state (with session ID)
        const sessionResult = await supabaseAuthService.getSession();
        const sessionId = sessionResult.data?.session?.access_token || null;
        await setCachedUser(user, sessionId);
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

// Export hook separately to ensure Fast Refresh compatibility
function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Export both using named exports for Fast Refresh compatibility
export { AuthProvider, useAuth };

