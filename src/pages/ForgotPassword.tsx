import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { supabaseAuthService } from "@/services/supabaseAuthService";

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

const ForgotPassword = () => {
  const { authUser } = useAuth();
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const authProvider = useMemo(() => resolveAuthProvider(authUser), [authUser]);
  const passwordResetDisabled = Boolean(authUser && authProvider && authProvider !== "email");

  useEffect(() => {
    if (authUser?.email) {
      setEmail(authUser.email);
      return;
    }

    const rememberedEmail = window.localStorage.getItem("pesoRememberedEmail");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
    }
  }, [authUser]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwordResetDisabled) {
      return;
    }

    const nextEmail = email.trim();
    if (!nextEmail) {
      setError(t("forgotPassword.validation.emailRequired"));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError(t("forgotPassword.validation.emailInvalid"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const { error: resetError } = await supabaseAuthService.resetPassword(nextEmail);
      if (resetError) {
        setError(resetError.message || t("forgotPassword.validation.requestFailed"));
        setSuccess(false);
        return;
      }

      setSuccess(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("forgotPassword.validation.requestFailed"));
      setSuccess(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell
      title={t("forgotPassword.pageTitle")}
      subtitle={t("forgotPassword.pageSubtitle")}
      switchPrompt={
        <>
          {t("forgotPassword.switchPrompt")} {" "}
          <Link to="/login" className="font-semibold text-primary transition-colors hover:text-primary/80">
            {t("forgotPassword.switchLink")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-1 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t("forgotPassword.heading")}</h2>
          <p className="text-sm text-muted-foreground dark:text-slate-300">{t("forgotPassword.headingSubtitle")}</p>
        </div>

        {passwordResetDisabled ? (
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertTitle>{t("forgotPassword.providerOnlyTitle")}</AlertTitle>
            <AlertDescription>{t("forgotPassword.providerOnlyDescription")}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("forgotPassword.errorTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {success ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>{t("forgotPassword.successTitle")}</AlertTitle>
            <AlertDescription>{t("forgotPassword.successDescription", { email: email.trim() })}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="forgot-password-email">{t("forgotPassword.email")}</Label>
          <Input
            id="forgot-password-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("forgotPassword.emailPlaceholder")}
            autoComplete="email"
            disabled={submitting || passwordResetDisabled}
            className="h-12 rounded-xl border-border/80 bg-muted/30 px-4"
          />
          <p className="text-xs text-muted-foreground dark:text-slate-300">{t("forgotPassword.emailHint")}</p>
        </div>

        <Button type="submit" className="h-12 w-full rounded-xl text-base font-semibold" disabled={submitting || passwordResetDisabled}>
          {submitting ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
        </Button>

        <div className="flex justify-center">
          <Button asChild type="button" variant="ghost" className="rounded-xl">
            <Link to="/login">{t("forgotPassword.backToLogin")}</Link>
          </Button>
        </div>
      </form>
    </AuthPageShell>
  );
};

export default ForgotPassword;