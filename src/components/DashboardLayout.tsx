import { ReactNode } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, User, BookOpen, Briefcase, Settings, BarChart3, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const getNavItems = () => {
    if (!user) return [];

    switch (user.role) {
      case "jobseeker":
        return [
          { path: "/dashboard", label: "My Dashboard", icon: BarChart3 },
          { path: "/courses", label: "Browse Courses", icon: BookOpen },
          { path: "/jobs", label: "Job Matching", icon: Briefcase },
          { path: "/profile", label: "Profile", icon: User },
        ];
      case "admin":
        return [
          { path: "/dashboard", label: "Admin Dashboard", icon: BarChart3 },
          { path: "/admin/users", label: "Users", icon: Users },
          { path: "/admin/courses", label: "Courses", icon: BookOpen },
          { path: "/admin/jobs", label: "Jobs", icon: Briefcase },
          { path: "/profile", label: "Profile", icon: User },
        ];
      case "trainer":
        return [
          { path: "/dashboard", label: "Trainer Dashboard", icon: BarChart3 },
          { path: "/trainer/courses", label: "My Courses", icon: BookOpen },
          { path: "/trainer/learners", label: "Learners", icon: Users },
          { path: "/profile", label: "Profile", icon: User },
        ];
      case "employer":
        return [
          { path: "/dashboard", label: "Employer Dashboard", icon: BarChart3 },
          { path: "/employer/jobs", label: "Job Postings", icon: Briefcase },
          { path: "/employer/candidates", label: "Candidates", icon: Users },
          { path: "/profile", label: "Profile", icon: User },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl hero-gradient flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">
                PESO <span className="text-primary">Academy</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <span className="hidden md:inline">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Home
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
};

export default DashboardLayout;

