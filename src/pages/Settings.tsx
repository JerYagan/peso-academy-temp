import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, Languages, Loader2, Lock, Monitor, Moon, Palette, Send, ShieldCheck, Sun, UserRound } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { isPasswordPolicySatisfied } from "@/lib/passwordPolicy";
import { supabase } from "@/lib/supabase";
import { notificationService, type TestNotificationAudience } from "@/services/notificationService";
import { supabaseAuthService } from "@/services/supabaseAuthService";
import { toast } from "sonner";

const SettingsPage = () => {
  const { user } = useAuth();
  const { language, t, isPersisting } = useLocale();
  const { resolvedTheme, setThemePreference, themePreference, isPersisting: isThemePersisting } = useThemePreference();
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [testNotificationAudience, setTestNotificationAudience] = useState<TestNotificationAudience>("all");
  const [testNotificationMessage, setTestNotificationMessage] = useState(
    "Admin notification test: please confirm this alert is visible in your notification center.",
  );
  const [sendingTestNotification, setSendingTestNotification] = useState(false);

  const themeOptions = [
    { value: "system", label: t("settings.themeSystem"), icon: Monitor },
    { value: "light", label: t("settings.themeLight"), icon: Sun },
    { value: "dark", label: t("settings.themeDark"), icon: Moon },
  ] as const;
  const isThemeSavedToProfile = user?.themePreference === themePreference;
  const showLanguageSettings = user?.role === "trainee";
  const showAdminNotificationTools = user?.role === "admin";
  const pageSubtitle = showLanguageSettings
    ? t("settings.pageSubtitle")
    : language === "tl"
      ? "Pamahalaan ang appearance at security preferences ng account mula sa iisang lugar."
      : "Manage your appearance and account security preferences from one place.";

  const activeThemeLabel =
    resolvedTheme === "dark"
      ? t("settings.themeDark")
      : resolvedTheme === "light"
        ? t("settings.themeLight")
        : t("settings.themeSystem");

  const testNotificationAudienceOptions = useMemo(
    () => [
      { value: "all", label: "All users", description: "Broadcast to every user profile in the system." },
      { value: "trainees", label: "Learners only", description: "Send only to trainee accounts." },
      { value: "trainers", label: "Trainers only", description: "Send only to trainer accounts." },
      { value: "admins", label: "Admins only", description: "Send only to admin accounts." },
      { value: "self", label: "My account only", description: "Quick self-check without notifying other users." },
    ] satisfies Array<{ value: TestNotificationAudience; label: string; description: string }>,
    [],
  );

  const selectedTestAudience = testNotificationAudienceOptions.find((option) => option.value === testNotificationAudience);

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.email) return;

    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t("settings.passwordValidationRequired"));
      return;
    }
    if (!isPasswordPolicySatisfied(newPassword)) {
      toast.error(t("settings.passwordValidationLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("settings.passwordValidationMatch"));
      return;
    }

    setChangingPassword(true);
    try {
      if (supabase) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (signInError) {
          toast.error(t("settings.passwordValidationCurrent"));
          return;
        }
      }

      const { error } = await supabaseAuthService.updatePassword(newPassword);
      if (error) {
        toast.error(error.message || t("settings.passwordUpdateError"));
        return;
      }

      toast.success(t("settings.passwordUpdateSuccess"));
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      console.error("Change password error:", error);
      toast.error(t("settings.passwordUpdateError"));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSendTestNotification = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user?.id || user.role !== "admin") {
      toast.error("Only admins can send test notifications.");
      return;
    }

    const trimmedMessage = testNotificationMessage.trim();
    if (!trimmedMessage) {
      toast.error("Enter a test message before sending the notification.");
      return;
    }

    setSendingTestNotification(true);
    try {
      const result = await notificationService.sendTestNotification(user.id, testNotificationAudience, trimmedMessage);

      if (!result.success) {
        toast.error(result.error || "Failed to send test notification.");
        return;
      }

      toast.success(
        result.recipients === 1
          ? "Test notification sent to 1 recipient."
          : `Test notification sent to ${result.recipients} recipients.`,
      );
    } finally {
      setSendingTestNotification(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("settings.pageTitle")}</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{pageSubtitle}</p>
        </div>

        <div className={`grid gap-6 ${showLanguageSettings ? "xl:grid-cols-[1.05fr_0.95fr]" : "xl:grid-cols-1"}`}>
          {showLanguageSettings ? (
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
          ) : null}

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
                      disabled={isThemePersisting}
                    >
                      {isThemePersisting && isActive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
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

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-4 w-4" />
              <CardTitle>{t("settings.securityTitle")}</CardTitle>
            </div>
            <CardDescription>{t("settings.securityBody")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="grid gap-4 xl:grid-cols-[1fr_1.35fr_auto] xl:items-end">
              <div className="space-y-2">
                <Label htmlFor="settings-current-password">{t("settings.currentPassword")}</Label>
                <Input
                  id="settings-current-password"
                  type="password"
                  placeholder={t("settings.currentPasswordPlaceholder")}
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                  autoComplete="current-password"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="settings-new-password">{t("settings.newPassword")}</Label>
                  <Input
                    id="settings-new-password"
                    type="password"
                    placeholder={t("settings.newPasswordPlaceholder")}
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-confirm-password">{t("settings.confirmPassword")}</Label>
                  <Input
                    id="settings-confirm-password"
                    type="password"
                    placeholder={t("settings.confirmPasswordPlaceholder")}
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <Button type="submit" className="gap-2" disabled={changingPassword}>
                {changingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("settings.updating")}
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    {t("settings.changePassword")}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {showAdminNotificationTools ? (
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <BellRing className="h-4 w-4" />
                <CardTitle>Notification Test</CardTitle>
              </div>
              <CardDescription>
                Send a system announcement from Admin Settings to verify notification delivery for the selected audience.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendTestNotification} className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr_auto] xl:items-end">
                <div className="space-y-2">
                  <Label htmlFor="settings-test-notification-audience">Audience</Label>
                  <Select
                    value={testNotificationAudience}
                    onValueChange={(value) => setTestNotificationAudience(value as TestNotificationAudience)}
                  >
                    <SelectTrigger id="settings-test-notification-audience">
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent>
                      {testNotificationAudienceOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{selectedTestAudience?.description}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-test-notification-message">Message</Label>
                  <Textarea
                    id="settings-test-notification-message"
                    value={testNotificationMessage}
                    onChange={(event) => setTestNotificationMessage(event.target.value)}
                    placeholder="Enter a message that recipients can confirm in their notification center."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    This creates a system announcement notification and includes test metadata for audit purposes.
                  </p>
                </div>

                <Button type="submit" className="gap-2" disabled={sendingTestNotification}>
                  {sendingTestNotification ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send test
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

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