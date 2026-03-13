import { Link } from "react-router-dom";
import { Languages, Monitor, Moon, Palette, Sun, UserRound } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";

const SettingsPage = () => {
  const { user } = useAuth();
  const { language, t, isPersisting } = useLocale();
  const { resolvedTheme, setThemePreference, themePreference, isPersisting: isThemePersisting } = useThemePreference();

  const themeOptions = [
    { value: "system", label: t("settings.themeSystem"), icon: Monitor },
    { value: "light", label: t("settings.themeLight"), icon: Sun },
    { value: "dark", label: t("settings.themeDark"), icon: Moon },
  ] as const;
  const isThemeSavedToProfile = user?.themePreference === themePreference;

  const activeThemeLabel =
    resolvedTheme === "dark"
      ? t("settings.themeDark")
      : resolvedTheme === "light"
        ? t("settings.themeLight")
        : t("settings.themeSystem");

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("settings.pageTitle")}</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{t("settings.pageSubtitle")}</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Languages className="h-4 w-4" />
                <CardTitle>{t("settings.languageTitle")}</CardTitle>
              </div>
              <CardDescription>{t("settings.languageBody")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LanguageSwitcher />
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>
                  {t("settings.currentLanguage")}: {t(`common.languages.${language}`)}
                </span>
                <Badge variant={isPersisting ? "secondary" : "outline"}>
                  {isPersisting ? t("settings.profileSyncSaving") : t("settings.profileSyncReady")}
                </Badge>
                {user?.languagePreference ? <Badge variant="outline">{user.email}</Badge> : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Palette className="h-4 w-4" />
                <CardTitle>{t("settings.themeTitle")}</CardTitle>
              </div>
              <CardDescription>{t("settings.themeBody")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = themePreference === option.value;

                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={isActive ? "default" : "outline"}
                      onClick={() => void setThemePreference(option.value)}
                      className="min-w-32 justify-start"
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {option.label}
                    </Button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{t("settings.selectedTheme")}: {themeOptions.find((option) => option.value === themePreference)?.label ?? t("settings.themeSystem")}</span>
                <Badge variant={isThemePersisting ? "secondary" : "outline"}>
                  {isThemePersisting
                    ? t("settings.themeSyncSaving")
                    : isThemeSavedToProfile
                      ? t("settings.themeSyncReady")
                      : t("settings.themeLocalFallback")}
                </Badge>
                <Badge variant="outline">{user?.email}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {t("settings.activeTheme")}: <span className="font-medium text-foreground">{activeThemeLabel}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/15 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <UserRound className="h-4 w-4" />
              <CardTitle>{t("settings.futureTitle")}</CardTitle>
            </div>
            <CardDescription>{t("settings.futureBody")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/profile">{t("settings.openProfile")}</Link>
            </Button>
            <Button asChild>
              <Link to="/courses">{t("settings.browseCourses")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;