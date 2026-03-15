import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { isPasswordPolicySatisfied } from "@/lib/passwordPolicy";
import { supabaseAuthService } from "@/services/supabaseAuthService";

type ResetPasswordStatus = "checking" | "ready" | "invalid" | "provider" | "complete";

const resolveAuthProvider = (authUser: ReturnType<typeof useAuth>["authUser"]): string | null => {
  if (!authUser) {
    return null;
  }

  const providerFromMetadata = authUser.app_metadata?.provider;
  if (typeof providerFromMetadata === "string" && providerFromMetadata.length > 0) {
    return providerFromMetadata;
  }

  const firstIdentity = authUser.identities?.[0]?.provider;
  return typeof firstIdentity === "string" && firstIdentity.length > 0 ? firstIdentity : null;
};

const readRecoveryState = (search: string, hash: string) => {
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

  const errorDescription =
    searchParams.get("error_description") ||
    hashParams.get("error_description") ||
    searchParams.get("error") ||
    hashParams.get("error") ||
    "";

  const hasRecoveryToken =
    hashParams.get("type") === "recovery" ||
    searchParams.get("type") === "recovery" ||
    Boolean(hashParams.get("access_token"));

  return {
    errorDescription,
    hasRecoveryToken,
  };
};

const ResetPassword = () => {
  const location = useLocation();
  const { authUser } = useAuth();
  const { t } = useLocale();
  const [status, setStatus] = useState<ResetPasswordStatus>("checking");
  const [statusMessage, setStatusMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const authProvider = useMemo(() => resolveAuthProvider(authUser), [authUser]);

  useEffect(() => {
    const evaluateRecoveryState = (recoveryEvent = false, providerOverride?: string | null) => {
      const { errorDescription, hasRecoveryToken } = readRecoveryState(location.search, window.location.hash);
      const provider = providerOverride ?? authProvider;

      if (errorDescription) {
        setStatus("invalid");
        setStatusMessage(errorDescription);
        return;
      }

      if (provider && provider !== "email" && (hasRecoveryToken || recoveryEvent)) {
        setStatus("provider");
        setStatusMessage(t("resetPassword.providerOnlyDescription"));
        return;
      }

      if (hasRecoveryToken || recoveryEvent) {
        setStatus("ready");
        setStatusMessage("");
        return;
      }

      setStatus("invalid");
      setStatusMessage(t("resetPassword.invalidDescription"));
    };

    evaluateRecoveryState();

    const authStateChange = supabaseAuthService.onAuthStateChange((_user, nextUser, event) => {
      if (event === "PASSWORD_RECOVERY") {
        evaluateRecoveryState(true, resolveAuthProvider(nextUser));
      }
    });

    return () => {
      authStateChange.data?.subscription?.unsubscribe();
    };
  }, [authProvider, location.search, t]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status !== "ready") {
      return;
    }

    setError("");

    if (!password || !confirmPassword) {
      setError(t("resetPassword.validation.required"));
      return;
    }

    if (!isPasswordPolicySatisfied(password)) {
      setError(t("resetPassword.validation.length"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("resetPassword.validation.match"));
      return;
    }

    setSubmitting(true);

    try {
      const { error: updateError } = await supabaseAuthService.updatePassword(password);
      if (updateError) {
        setError(updateError.message || t("resetPassword.updateError"));
        return;
      }

      await supabaseAuthService.logout();
      window.history.replaceState(null, document.title, window.location.pathname);
      setStatus("complete");
      setStatusMessage("");
      setPassword("");
      setConfirmPassword("");
    } catch (updatePasswordError) {
      setError(updatePasswordError instanceof Error ? updatePasswordError.message : t("resetPassword.updateError"));
    } finally {
      setSubmitting(false);
    }
  };

  const statusAlert = (() => {
    if (status === "invalid") {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("resetPassword.invalidTitle")}</AlertTitle>
          <AlertDescription>{statusMessage || t("resetPassword.invalidDescription")}</AlertDescription>
        </Alert>
      );
    }

    if (status === "provider") {
      return (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{t("resetPassword.providerOnlyTitle")}</AlertTitle>
          <AlertDescription>{statusMessage || t("resetPassword.providerOnlyDescription")}</AlertDescription>
        </Alert>
      );
    }

    if (status === "complete") {
      return (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>{t("resetPassword.successTitle")}</AlertTitle>
          <AlertDescription>{t("resetPassword.successDescription")}</AlertDescription>
        </Alert>
      );
    }

    return null;
  })();

  return (
    <AuthPageShell
      title={t("resetPassword.pageTitle")}
      subtitle={t("resetPassword.pageSubtitle")}
      switchPrompt={
        <>
          {t("resetPassword.switchPrompt")} {" "}
          <Link to="/login" className="font-semibold text-primary transition-colors hover:text-primary/80">
            {t("resetPassword.switchLink")}
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <div className="space-y-1 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t("resetPassword.heading")}</h2>
          <p className="text-sm text-muted-foreground dark:text-slate-300">{t("resetPassword.headingSubtitle")}</p>
        </div>

        {status === "checking" ? (
          <div className="flex items-center justify-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-6 text-sm text-muted-foreground dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("resetPassword.checking")}</span>
          </div>
        ) : null}

        {statusAlert}

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("resetPassword.errorTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {status === "ready" ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="reset-password-new">{t("resetPassword.newPassword")}</Label>
              <Input
                id="reset-password-new"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("resetPassword.newPasswordPlaceholder")}
                autoComplete="new-password"
                disabled={submitting}
                className="h-12 rounded-xl border-border/80 bg-muted/30 px-4"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-password-confirm">{t("resetPassword.confirmPassword")}</Label>
              <Input
                id="reset-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={t("resetPassword.confirmPasswordPlaceholder")}
                autoComplete="new-password"
                disabled={submitting}
                className="h-12 rounded-xl border-border/80 bg-muted/30 px-4"
              />
            </div>

            <p className="text-xs text-muted-foreground dark:text-slate-300">{t("resetPassword.passwordHint")}</p>

            <Button type="submit" className="h-12 w-full rounded-xl text-base font-semibold" disabled={submitting}>
              {submitting ? t("resetPassword.submitting") : t("resetPassword.submit")}
            </Button>
          </form>
        ) : null}

        <div className="flex flex-wrap justify-center gap-3">
          {status !== "complete" ? (
            <Button asChild type="button" variant="outline" className="rounded-xl">
              <Link to="/forgot-password">{t("resetPassword.requestAnotherLink")}</Link>
            </Button>
          ) : null}
          <Button asChild type="button" variant={status === "complete" ? "default" : "ghost"} className="rounded-xl">
            <Link to="/login">{t("resetPassword.backToLogin")}</Link>
          </Button>
        </div>
      </div>
    </AuthPageShell>
  );
};

export default ResetPassword;