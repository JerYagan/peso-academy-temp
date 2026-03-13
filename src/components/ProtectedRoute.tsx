import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types/auth";
import { ReactNode, useEffect, useState } from "react";
import { getDashboardRoute, getDashboardRouteForUser } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { getRequiredPermissionsForRoute, routeRequiresAuth, routePermissions } from "@/lib/routePermissions";
import { roleService } from "@/services/roleService";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[]; // Deprecated: kept for backward compatibility, use requiredPermissions instead
  requiredPermissions?: string[]; // New: permission IDs required to access this route
}

export const ProtectedRoute = ({ children, allowedRoles, requiredPermissions }: ProtectedRouteProps) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [dashboardRoute, setDashboardRoute] = useState<string>(user?.role ? getDashboardRoute(user.role) : "/dashboard");

  // Load dashboard route from database when user changes
  useEffect(() => {
    if (!user?.role) {
      setDashboardRoute("/dashboard");
      return;
    }

    const fallbackRoute = getDashboardRoute(user.role);
    setDashboardRoute(fallbackRoute);

    if (!user.id) {
      return;
    }

    let isActive = true;

    getDashboardRouteForUser(user.id, user.role).then(route => {
      if (isActive) {
        setDashboardRoute(route);
      }
    }).catch(() => {
      if (isActive) {
        setDashboardRoute(fallbackRoute);
      }
    });

    return () => {
      isActive = false;
    };
  }, [user?.id, user?.role]);

  // Determine required permissions for this route
  useEffect(() => {
    const checkPermissions = async () => {
      if (loading) {
        setPermissionLoading(true);
        return;
      }

      if (!user) {
        setPermissionLoading(false);
        setHasAccess(false);
        return;
      }

      try {
        setPermissionLoading(true);
        let permissionsToCheck: string[] = [];

        // Priority: requiredPermissions prop > route-based permissions > allowedRoles (deprecated)
        if (requiredPermissions && requiredPermissions.length > 0) {
          permissionsToCheck = requiredPermissions;
        } else {
          // Get permissions from route mapping
          const routePermissions = getRequiredPermissionsForRoute(location.pathname);
          permissionsToCheck = routePermissions;
        }

        console.log("🔍 Permission check:", {
          pathname: location.pathname,
          userId: user.id,
          userRole: user.role,
          userEmail: user.email,
          permissionsToCheck,
        });
        
        // Debug: Also log what route permissions were found
        const routePerms = getRequiredPermissionsForRoute(location.pathname);
        console.log("📍 Route permissions mapping:", {
          pathname: location.pathname,
          foundPermissions: routePerms,
          routeExists: routePermissions.find(r => r.path === location.pathname || location.pathname.match(new RegExp(r.path.replace(/:[^/]+/g, "[^/]+"))))
        });

        // If no permissions required, check if route requires auth
        if (permissionsToCheck.length === 0) {
          const requiresAuth = routeRequiresAuth(location.pathname);
          setHasAccess(!requiresAuth || isAuthenticated);
          setPermissionLoading(false);
          return;
        }

        // Quick admin check - admins get access to everything
        if (user.role === "admin") {
          console.log("✅ Admin user - granting full access");
          setHasAccess(true);
          setPermissionLoading(false);
          return;
        }

        // Check if user has required permissions
        if (permissionsToCheck.length > 0 && user.id) {
          try {
            // Add timeout to prevent infinite loading
            const timeoutPromise = new Promise<boolean>((resolve) => {
              setTimeout(() => {
                console.warn("⏱️ Permission check timeout, using fallback");
                resolve(false);
              }, 5000); // 5 second timeout (increased from 3)
            });

            const permissionPromise = roleService.userHasAnyPermission(user.id, permissionsToCheck);
            
            const hasPermission = await Promise.race([permissionPromise, timeoutPromise]);
            
            console.log("✅ Permission check result:", {
              hasPermission,
              permissionsToCheck,
              userId: user.id,
              userRole: user.role,
            });

            if (hasPermission) {
              setHasAccess(true);
            } else {
              // If permission check fails, try fallback to role-based check
              console.warn("⚠️ Permission check failed, trying role-based fallback");
              if (allowedRoles && allowedRoles.length > 0) {
                const userRole = user.role;
                const hasRoleAccess = allowedRoles.includes(userRole as UserRole);
                console.log("🔄 Role-based fallback:", { userRole, allowedRoles, hasRoleAccess });
                setHasAccess(hasRoleAccess);
              } else {
                // If no allowedRoles fallback, deny access
                console.warn("🚫 Access denied - no permissions and no role fallback");
                setHasAccess(false);
              }
            }
          } catch (permError) {
            console.error("❌ Error in permission check:", permError);
            // On error, try role-based fallback
            if (allowedRoles && allowedRoles.length > 0 && user) {
              const userRole = user.role;
              setHasAccess(allowedRoles.includes(userRole as UserRole));
            } else if (user) {
              // Admin gets access by default on error
              const isAdmin = user.role === ("admin" as UserRole);
              if (isAdmin) {
                console.warn("⚠️ Admin user - granting access due to permission check error");
                setHasAccess(true);
              } else {
                setHasAccess(false);
              }
            } else {
              setHasAccess(false);
            }
          }
        } else {
          // Fallback to role-based check for backward compatibility
          if (allowedRoles && allowedRoles.length > 0) {
            const userRole = user.role;
            setHasAccess(allowedRoles.includes(userRole as UserRole));
          } else {
            setHasAccess(true);
          }
        }
      } catch (error) {
        console.error("❌ Error checking permissions:", error);
        // Fallback to role-based check on error
        if (allowedRoles && allowedRoles.length > 0 && user) {
          const userRole = user.role;
          setHasAccess(allowedRoles.includes(userRole as UserRole));
        } else if (user && user.role === "admin") {
          // Admin gets access by default on error
          console.warn("⚠️ Admin user - granting access due to error");
          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
      } finally {
        setPermissionLoading(false);
      }
    };

    checkPermissions();
  }, [loading, isAuthenticated, user, location.pathname, requiredPermissions, allowedRoles]);

  // Debug logging
  console.log("🛡️ ProtectedRoute check", {
    loading,
    permissionLoading,
    isAuthenticated,
    hasUser: !!user,
    userRole: user?.role,
    pathname: location.pathname,
    requiredPermissions,
    allowedRoles,
    hasAccess
  });

  // Show loading state while checking authentication or permissions
  if (loading || permissionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    console.warn("🛡️ ProtectedRoute: Not authenticated, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  // Check if user has access
  if (!hasAccess) {
    // Admin is creating a user: session may briefly switch to new user. Don't redirect; show loading until session is restored.
    const adminCreatingUser = typeof window !== "undefined" && location.pathname.startsWith("/admin") && sessionStorage.getItem("admin_creating_user") === "1";
    if (adminCreatingUser) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30">
          <Card className="max-w-sm">
            <CardContent className="pt-6 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground text-center">Restoring your session...</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    console.warn("🛡️ ProtectedRoute: Access denied - redirecting", {
      userRole: user.role,
      pathname: location.pathname,
      redirectingTo: dashboardRoute,
      hasAccess,
      permissionLoading
    });
    
    // Ensure dashboardRoute is valid before redirecting
    const targetRoute = dashboardRoute || getDashboardRoute(user.role);
    
    // Redirect to user's appropriate dashboard (from database)
    return <Navigate to={targetRoute} replace />;
  }

  console.log("🛡️ ProtectedRoute: Access granted, rendering children");
  return <>{children}</>;
};

