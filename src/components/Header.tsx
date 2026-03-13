import { Button } from "@/components/ui/button";
import { Menu, X, User, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { getDashboardRoute } from "@/lib/roles";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const { resolvedTheme, setThemePreference } = useThemePreference();
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const logoSrc = resolvedTheme === "dark" ? "/images/logo_dark.png" : "/images/logo.png";
  const toggleTheme = () => {
    void setThemePreference(resolvedTheme === "dark" ? "light" : "dark");
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
    setIsMenuOpen(false);
  };

  const handleSectionClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    setIsMenuOpen(false);
    
    // If we're not on the homepage, navigate to homepage first
    if (location.pathname !== "/") {
      navigate("/");
      // Wait for navigation to complete, then scroll to section
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          // Scroll to top first, then to the section
          window.scrollTo({ top: 0, behavior: "instant" });
          setTimeout(() => {
            element.scrollIntoView({ behavior: "smooth" });
          }, 50);
        }
      }, 300);
    } else {
      // If we're on homepage, just scroll to section
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-3 sm:h-16 lg:h-[74px]">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src={logoSrc}
              alt="PESO Academy"
              className="h-7 w-auto max-w-[110px] object-contain sm:h-11 sm:max-w-none"
            />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a 
              href="#features" 
              onClick={(e) => handleSectionClick(e, "features")}
              className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("header.nav.features")}
            </a>
            <a 
              href="#how-it-works" 
              onClick={(e) => handleSectionClick(e, "how-it-works")}
              className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("header.nav.howItWorks")}
            </a>
            <Link to="/courses" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {t("common.courses")}
            </Link>
            <a 
              href="#about" 
              onClick={(e) => handleSectionClick(e, "about")}
              className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("header.nav.about")}
            </a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <LanguageSwitcher compact />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="relative h-10 w-10 rounded-full border border-border/70 bg-muted/50"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">{t("header.themeToggle")}</span>
            </Button>

            {isAuthenticated ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2 rounded-full border border-border/70 px-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <span>{user?.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to={user?.role ? getDashboardRoute(user.role as string) : "/dashboard"} className="cursor-pointer">{t("common.dashboard")}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="cursor-pointer">{t("common.profile")}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                      {t("common.logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild className="rounded-full px-4 text-sm font-semibold">
                  <Link to="/login">{t("common.login")}</Link>
                </Button>
                <Button variant="default" asChild className="rounded-full px-5 text-sm font-semibold">
                  <Link to="/signup">{t("common.account")}</Link>
                </Button>
              </>
            )}
          </div>

          <button
            className="rounded-lg p-1.5 text-foreground transition-colors hover:bg-muted md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? t("header.mobileMenuClose") : t("header.mobileMenu")}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="animate-fade-in border-t border-border py-3 md:hidden">
            <nav className="flex flex-col gap-4">
              <a 
                href="#features" 
                onClick={(e) => handleSectionClick(e, "features")}
                className="cursor-pointer py-2 text-foreground font-medium"
              >
                {t("header.nav.features")}
              </a>
              <a 
                href="#how-it-works" 
                onClick={(e) => handleSectionClick(e, "how-it-works")}
                className="cursor-pointer py-2 text-foreground font-medium"
              >
                {t("header.nav.howItWorks")}
              </a>
              <Link to="/courses" className="text-foreground font-medium py-2">{t("common.courses")}</Link>
              <a 
                href="#about" 
                onClick={(e) => handleSectionClick(e, "about")}
                className="cursor-pointer py-2 text-foreground font-medium"
              >
                {t("header.nav.about")}
              </a>
              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">{t("common.theme")}</span>
                <div className="flex items-center gap-2">
                  <LanguageSwitcher compact />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    className="relative h-10 w-10 rounded-full border border-border/70 bg-muted/50"
                  >
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">{t("header.themeToggle")}</span>
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2 pb-1">
                {isAuthenticated ? (
                  <>
                    <Button variant="ghost" className="w-full justify-center" asChild>
                      <Link to={user?.role ? getDashboardRoute(user.role as string) : "/dashboard"}>{t("common.dashboard")}</Link>
                    </Button>
                    <Button variant="ghost" className="w-full justify-center" asChild>
                      <Link to="/profile">{t("common.profile")}</Link>
                    </Button>
                    <Button variant="destructive" className="w-full justify-center" onClick={handleLogout}>
                      {t("common.logout")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" className="w-full justify-center" asChild>
                      <Link to="/login">{t("common.login")}</Link>
                    </Button>
                    <Button variant="default" className="w-full justify-center" asChild>
                      <Link to="/signup">{t("common.account")}</Link>
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
