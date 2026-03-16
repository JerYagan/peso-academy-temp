import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  Award,
  BarChart3,
  BookOpen,
  ChevronDown,
  ClipboardList,
  FileQuestion,
  FileSpreadsheet,
  LogOut,
  Settings,
  ShieldCheck,
  Tags,
  TrendingUp,
  User,
  Users,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import NotificationCenter from "./NotificationCenter";

interface DashboardLayoutProps {
  children: ReactNode;
}

type NavLinkItem = {
  type: "link";
  path: string;
  label: string;
  icon: typeof BarChart3;
};

type NavSubmenuItem = {
  type: "submenu";
  label: string;
  icon: typeof BarChart3;
  items: NavLinkItem[];
};

type NavGroupChild = NavLinkItem | NavSubmenuItem;

type NavGroupItem = {
  type: "group";
  label: string;
  icon: typeof BarChart3;
  items: NavGroupChild[];
};

type NavItem = NavLinkItem | NavGroupItem;

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user, logout } = useAuth();
  const { resolvedTheme } = useTheme();
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const logoSrc = resolvedTheme === "dark" ? "/images/logo_dark.png" : "/images/logo.png";

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isPathActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const isGroupChildActive = (item: NavGroupChild) =>
    item.type === "link" ? isPathActive(item.path) : item.items.some((child) => isPathActive(child.path));

  const getNavItems = (): NavItem[] => {
    if (!user) {
      return [];
    }

    switch (user.role) {
      case "trainee":
        return [
          { type: "link", path: "/dashboard", label: t("dashboardLayout.traineeNav.dashboard"), icon: BarChart3 },
          { type: "link", path: "/courses", label: t("dashboardLayout.traineeNav.courses"), icon: BookOpen },
          { type: "link", path: "/progress", label: t("dashboardLayout.traineeNav.progress"), icon: TrendingUp },
          { type: "link", path: "/certificates", label: t("dashboardLayout.traineeNav.certificates"), icon: Award },
        ];
      case "admin":
        return [
          { type: "link", path: "/admin/dashboard", label: "Admin Dashboard", icon: BarChart3 },
          { type: "link", path: "/verification", label: "Verification", icon: ShieldCheck },
          {
            type: "group",
            label: "Manage",
            icon: ClipboardList,
            items: [
              { type: "link", path: "/admin/users", label: "Users", icon: Users },
              {
                type: "submenu",
                label: "Learners & Assessments",
                icon: Users,
                items: [
                  { type: "link", path: "/admin/learners", label: "Learners", icon: Users },
                  { type: "link", path: "/admin/certificates", label: "Certificates", icon: Award },
                  { type: "link", path: "/admin/assessment-reviews", label: "Assessment Reviews", icon: FileQuestion },
                ],
              },
              { type: "link", path: "/admin/courses", label: "Courses", icon: BookOpen },
              { type: "link", path: "/admin/taxonomy", label: "Taxonomy", icon: Tags },
            ],
          },
          {
            type: "group",
            label: "Insights",
            icon: FileSpreadsheet,
            items: [
              { type: "link", path: "/admin/reports", label: "Reports", icon: FileSpreadsheet },
            ],
          },
        ];
      case "trainer":
        return [
          { type: "link", path: "/trainer/dashboard", label: "Trainer Dashboard", icon: BarChart3 },
          {
            type: "group",
            label: "Manage",
            icon: ClipboardList,
            items: [
              { type: "link", path: "/trainer/courses", label: "My Courses", icon: BookOpen },
              {
                type: "submenu",
                label: "Learners & Assessments",
                icon: Users,
                items: [
                  { type: "link", path: "/trainer/learners", label: "Learners", icon: Users },
                  { type: "link", path: "/trainer/certificates", label: "Certificates", icon: Award },
                  { type: "link", path: "/trainer/assessment-reviews", label: "Assessment Reviews", icon: FileQuestion },
                ],
              },
            ],
          },
          {
            type: "group",
            label: "Configure",
            icon: Tags,
            items: [
              { type: "link", path: "/trainer/taxonomy", label: "Taxonomy", icon: Tags },
            ],
          },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3">
              <img src={logoSrc} alt="PESO Academy" className="h-12 w-auto object-contain sm:h-14" />
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                if (item.type === "group") {
                  const Icon = item.icon;
                  const isActive = item.items.some((child) => isGroupChildActive(child));

                  return (
                    <DropdownMenu key={item.label}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className={`gap-2 rounded-lg px-4 py-2 ${
                            isActive
                              ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
                        {item.items.map((child) => {
                          const ChildIcon = child.icon;

                          if (child.type === "submenu") {
                            const isSubmenuActive = child.items.some((grandchild) => isPathActive(grandchild.path));

                            return (
                              <DropdownMenuSub key={child.label}>
                                <DropdownMenuSubTrigger className={isSubmenuActive ? "bg-muted font-medium text-foreground" : undefined}>
                                  <ChildIcon className="h-4 w-4" />
                                  <span>{child.label}</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-56">
                                  {child.items.map((grandchild) => {
                                    const GrandchildIcon = grandchild.icon;

                                    return (
                                      <DropdownMenuItem key={grandchild.path} asChild>
                                        <Link to={grandchild.path} className="cursor-pointer gap-2">
                                          <GrandchildIcon className="h-4 w-4" />
                                          {grandchild.label}
                                        </Link>
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            );
                          }

                          return (
                            <DropdownMenuItem key={child.path} asChild>
                              <Link to={child.path} className="cursor-pointer gap-2">
                                <ChildIcon className="h-4 w-4" />
                                {child.label}
                              </Link>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                }

                const Icon = item.icon;
                const isActive = isPathActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <NotificationCenter />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
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
                      {t("dashboardLayout.menuProfile")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      {t("dashboardLayout.menuSettings")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("common.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
};

export default DashboardLayout;

