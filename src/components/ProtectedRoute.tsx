import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types/auth";
import { ReactNode } from "react";
import { getDashboardRoute, hasAnyRole } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, user, loading } = useAuth();

  // Debug logging
  console.log("🛡️ ProtectedRoute check", {
    loading,
    isAuthenticated,
    hasUser: !!user,
    userRole: user?.role,
    allowedRoles,
    willAllow: allowedRoles ? hasAnyRole(user || { role: 'trainee' }, allowedRoles) : true
  });

  // Show loading state while checking authentication
  if (loading) {
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

  // Check role-based access
  // hasAnyRole expects a user object, but our User type already has role property
  const userRole = user.role;
  const hasAccess = allowedRoles ? allowedRoles.includes(userRole) : true;
  
  console.log("🛡️ ProtectedRoute: Role check", {
    userRole,
    allowedRoles,
    hasAccess,
    userObject: user
  });
  
  if (allowedRoles && !hasAccess) {
    console.warn("🛡️ ProtectedRoute: Role mismatch - redirecting", {
      userRole: user.role,
      allowedRoles,
      redirectingTo: getDashboardRoute(user.role)
    });
    // Redirect to user's appropriate dashboard
    const dashboardRoute = getDashboardRoute(user.role);
    return <Navigate to={dashboardRoute} replace />;
  }

  console.log("🛡️ ProtectedRoute: Access granted, rendering children");
  return <>{children}</>;
};

