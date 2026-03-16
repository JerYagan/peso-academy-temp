import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Mail, UserRound } from "lucide-react";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import SecurityCriteriaPanel from "@/components/auth/SecurityCriteriaPanel";
import { useAuth } from "@/contexts/AuthContext";
import { formatAllowedEmployeeDomains, isAllowedEmployeeRegistrationEmail } from "@/lib/employeeRegistration";
import { TRAINEE_ONBOARDING_MODAL_PENDING_KEY } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { getPasswordRequirementChecks, getPasswordStrengthLevel, isPasswordPolicySatisfied } from "@/lib/passwordPolicy";
import {
  PROFILE_FIELD_LIMITS,
  sanitizeDigitsOnlyInput,
  sanitizeNameInput,
  validateDigitsOnlyField,
  validateHumanName,
  validateMaxLength,
} from "@/lib/profileFieldValidation";
import { getDashboardRoute, type UserRole as AppUserRole } from "@/lib/roles";
import { uploadTraineePhysicalIdDocument, validatePhysicalIdFile } from "@/lib/traineeVerificationDocuments";
import { systemSettingsService } from "@/services/systemSettingsService";
import type { User } from "@/types/auth";
import { useLocale } from "@/contexts/LocaleContext";

type SignUpFormData = {
  traineeType: User["traineeType"] | "";
  name: string;
  email: string;
  password: string;
  employeeId: string;
  physicalId: string;
};

const createInitialFormData = (): SignUpFormData => ({
  traineeType: "",
  name: "",
  email: "",
  password: "",
  employeeId: "",
  physicalId: "",
});

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isEmployeeTrainee = (formData: SignUpFormData) => formData.traineeType === "peso_employee";

const SignUp = () => {
  const { signup, updateUser, user, isAuthenticated, loading: authLoading } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [formData, setFormData] = useState<SignUpFormData>(createInitialFormData);
  const [allowedEmployeeDomains, setAllowedEmployeeDomains] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [physicalIdFile, setPhysicalIdFile] = useState<File | null>(null);
  const [physicalIdPreviewUrl, setPhysicalIdPreviewUrl] = useState<string | null>(null);
  const [verificationEmailSentTo, setVerificationEmailSentTo] = useState("");
  const [verificationPendingTraineeType, setVerificationPendingTraineeType] = useState<User["traineeType"] | "">("");
  const [suppressAuthenticatedSignupRedirect, setSuppressAuthenticatedSignupRedirect] = useState(false);

  const allowedDomainLabel = useMemo(
    () => formatAllowedEmployeeDomains(allowedEmployeeDomains),
    [allowedEmployeeDomains],
  );
  const passwordRequirementChecks = useMemo(() => getPasswordRequirementChecks(formData.password), [formData.password]);
  const passwordStrengthLevel = useMemo(() => getPasswordStrengthLevel(formData.password), [formData.password]);
  const passwordStrengthSegments = {
    empty: 0,
    weak: 1,
    fair: 2,
    good: 3,
    strong: 4,
  }[passwordStrengthLevel];
  const passwordStrengthTone = {
    empty: "bg-muted",
    weak: "bg-red-500",
    fair: "bg-amber-500",
    good: "bg-sky-500",
    strong: "bg-emerald-500",
  }[passwordStrengthLevel];
  const passwordRequirementLabels = {
    length: t("signup.passwordRequirements.length"),
    uppercase: t("signup.passwordRequirements.uppercase"),
    lowercase: t("signup.passwordRequirements.lowercase"),
    number: t("signup.passwordRequirements.number"),
    special: t("signup.passwordRequirements.special"),
  };
  const emailCriteriaItems = useMemo(() => {
    const trimmedEmail = formData.email.trim();
    const employeeFlow = isEmployeeTrainee(formData);

    return [
      {
        id: "email-format",
        label: t("authCriteria.emailFormat"),
        met: trimmedEmail ? isValidEmail(trimmedEmail) : undefined,
      },
      ...(employeeFlow
        ? [{
            id: "employee-domain",
            label: t("authCriteria.employeeDomainAllowed", { domains: allowedDomainLabel }),
            met: trimmedEmail ? isAllowedEmployeeRegistrationEmail(trimmedEmail, allowedEmployeeDomains) : undefined,
          }]
        : []),
    ];
  }, [allowedDomainLabel, allowedEmployeeDomains, formData, t]);
  const passwordCriteriaItems = useMemo(
    () => passwordRequirementChecks.map((requirement) => ({
      id: requirement.id,
      label: passwordRequirementLabels[requirement.id],
      met: formData.password ? requirement.met : undefined,
    })),
    [formData.password, passwordRequirementChecks, passwordRequirementLabels],
  );

  useEffect(() => {
    let active = true;

    void systemSettingsService.getEmployeeRegistrationAllowedDomains().then((domains) => {
      if (active) {
        setAllowedEmployeeDomains(domains);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!physicalIdFile) {
      setPhysicalIdPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(physicalIdFile);
    setPhysicalIdPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [physicalIdFile]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) {
      return;
    }

    if (suppressAuthenticatedSignupRedirect) {
      return;
    }

    if (redirectTo && redirectTo.startsWith("/")) {
      navigate(redirectTo, { replace: true });
      return;
    }

    navigate(getDashboardRoute(user.role as AppUserRole), { replace: true });
  }, [authLoading, isAuthenticated, navigate, redirectTo, suppressAuthenticatedSignupRedirect, user]);

  const setField = <K extends keyof SignUpFormData>(field: K, value: SignUpFormData[K]) => {
    const nextValue = typeof value === "string"
      ? field === "name"
        ? sanitizeNameInput(value)
        : field === "employeeId"
          ? sanitizeDigitsOnlyInput(value)
          : value
      : value;

    setFormData((current) => ({ ...current, [field]: nextValue }));
  };

  const validateForm = () => {
    if (!formData.traineeType) {
      return t("signup.validation.chooseTraineeType");
    }

    if (!formData.name.trim()) {
      return t("signup.validation.fullNameRequired");
    }

    const nameValidationError = validateHumanName(formData.name);
    if (nameValidationError) {
      return nameValidationError;
    }

    if (!formData.email.trim()) {
      return t("signup.validation.emailRequired");
    }

    if (!isValidEmail(formData.email.trim())) {
      return t("signup.validation.emailInvalid");
    }

    if (!isPasswordPolicySatisfied(formData.password)) {
      return t("signup.validation.passwordShort");
    }

    if (isEmployeeTrainee(formData) && !isAllowedEmployeeRegistrationEmail(formData.email.trim(), allowedEmployeeDomains)) {
      return t("signup.validation.employeeDomain", { domains: allowedDomainLabel });
    }

    if (isEmployeeTrainee(formData) && !formData.employeeId.trim()) {
      return t("signup.validation.employeeIdRequired");
    }

    if (isEmployeeTrainee(formData)) {
      const employeeIdLengthError = validateMaxLength("Employee ID", formData.employeeId, PROFILE_FIELD_LIMITS.employeeId);
      if (employeeIdLengthError) {
        return employeeIdLengthError;
      }

      const employeeIdValidationError = validateDigitsOnlyField("Employee ID", formData.employeeId);
      if (employeeIdValidationError) {
        return employeeIdValidationError;
      }

      if (!physicalIdFile) {
        return t("signup.validation.physicalIdRequired");
      }
    }

    return null;
  };

  const handlePhysicalIdFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;

    if (!nextFile) {
      setPhysicalIdFile(null);
      setField("physicalId", "");
      return;
    }

    const validationError = validatePhysicalIdFile(nextFile);
    if (validationError) {
      setPhysicalIdFile(null);
      setField("physicalId", "");
      setError(validationError);
      event.target.value = "";
      return;
    }

    setError("");
    setPhysicalIdFile(nextFile);
    setField("physicalId", nextFile.name);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSuppressAuthenticatedSignupRedirect(true);
    setLoading(true);

    try {
      const verificationSubmittedAt = new Date().toISOString();
      const result = await signup(formData.email.trim(), formData.password, formData.name.trim(), "trainee", {
        traineeType: formData.traineeType || "peso_client",
        verificationStatus: "pending",
        verificationSubmittedAt,
        employeeId: isEmployeeTrainee(formData) ? formData.employeeId.trim() : undefined,
        physicalId: isEmployeeTrainee(formData) ? formData.physicalId : undefined,
      });

      if (result.error) {
        setError(typeof result.error === "string" ? result.error : t("signup.validation.signupFailed"));
        setSuppressAuthenticatedSignupRedirect(false);
        return;
      }

      if (result.requiresEmailVerification) {
        setVerificationEmailSentTo(formData.email.trim());
        setVerificationPendingTraineeType(formData.traineeType || "peso_client");
        setPhysicalIdFile(null);
        setFormData(createInitialFormData());
        setSuppressAuthenticatedSignupRedirect(false);
        return;
      }

      if (!result.user) {
        setError(t("signup.validation.signupFailed"));
        setSuppressAuthenticatedSignupRedirect(false);
        return;
      }

      if (isEmployeeTrainee(formData) && physicalIdFile) {
        const uploadedPath = await uploadTraineePhysicalIdDocument(result.user.id, physicalIdFile);
        await updateUser({
          physicalId: uploadedPath,
          verificationSubmittedAt,
        });
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(TRAINEE_ONBOARDING_MODAL_PENDING_KEY, "1");
      }

      navigate(getDashboardRoute("trainee"), { replace: true });
    } catch (signupError) {
      console.error("Signup failed:", signupError);
      setError(signupError instanceof Error ? signupError.message : t("signup.validation.signupUnexpected"));
      setSuppressAuthenticatedSignupRedirect(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title={t("signup.pageTitle")}
      subtitle={t("signup.pageSubtitle")}
      maxWidthClass="max-w-4xl"
      switchPrompt={
        <>
          {t("signup.switchPrompt")} {" "}
          <Link to="/login" className="font-semibold text-primary transition-colors hover:text-primary/80">
            {t("signup.switchLink")}
          </Link>
        </>
      }
    >
      {verificationEmailSentTo ? (
        <div className="space-y-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>{t("signup.emailVerificationTitle")}</AlertTitle>
            <AlertDescription>{t("signup.emailVerificationDescription", { email: verificationEmailSentTo })}</AlertDescription>
          </Alert>

          <div className="space-y-3 text-sm leading-6 text-muted-foreground dark:text-slate-300">
            <p>
              {verificationPendingTraineeType === "peso_employee"
                ? t("signup.emailVerificationEmployeeNextStep")
                : t("signup.emailVerificationClientNextStep")}
            </p>
            <p>{t("signup.emailVerificationReminder")}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/login">{t("signup.switchLink")}</Link>
            </Button>
            <Button type="button" variant="outline" onClick={() => setVerificationEmailSentTo("") }>
              {t("signup.createAnotherAccount")}
            </Button>
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-5 rounded-2xl border border-border/70 bg-background p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t("signup.sectionTitle")}</h2>
            <Badge variant="outline">{t("common.required")}</Badge>
          </div>
          <p className="text-sm leading-6 text-muted-foreground dark:text-slate-300">
            {t("signup.sectionSubtitle")}
          </p>

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label>{t("signup.traineeType")}</Label>
                <RadioGroup
                  value={formData.traineeType}
                  onValueChange={(value) => {
                    const nextTraineeType = value as User["traineeType"];
                    if (nextTraineeType !== "peso_employee") {
                      setPhysicalIdFile(null);
                    }
                    setFormData((current) => ({
                      ...current,
                      traineeType: nextTraineeType,
                      employeeId: nextTraineeType === "peso_employee" ? current.employeeId : "",
                      physicalId: nextTraineeType === "peso_employee" ? current.physicalId : "",
                    }));
                  }}
                  className="grid gap-3 md:grid-cols-2"
                >
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm">
                    <RadioGroupItem value="peso_client" id="trainee-type-peso-client" className="mt-1" />
                    <span>
                      <span className="block font-medium text-foreground">{t("signup.pesoClient")}</span>
                      <span className="mt-1 block text-muted-foreground dark:text-slate-300">
                        {t("signup.pesoClientDescription")}
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm">
                    <RadioGroupItem value="peso_employee" id="trainee-type-peso-employee" className="mt-1" />
                    <span>
                      <span className="block font-medium text-foreground">{t("signup.pesoEmployee")}</span>
                      <span className="mt-1 block text-muted-foreground dark:text-slate-300">
                        {t("signup.pesoEmployeeDescription")}
                      </span>
                    </span>
                  </label>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t("signup.fullName")}</Label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-slate-300" />
                  <Input
                    id="name"
                    type="text"
                    placeholder={t("signup.fullNamePlaceholder")}
                    value={formData.name}
                    onChange={(event) => setField("name", event.target.value)}
                    className="h-12 rounded-xl border-border/80 bg-background pl-10 pr-4"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("signup.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-slate-300" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={isEmployeeTrainee(formData) ? `your.name${allowedEmployeeDomains[0] || "@peso.academy"}` : t("signup.clientEmailPlaceholder")}
                    value={formData.email}
                    onChange={(event) => setField("email", event.target.value)}
                    className="h-12 rounded-xl border-border/80 bg-background pl-10 pr-4"
                    required
                  />
                </div>
                <SecurityCriteriaPanel
                  title={t("authCriteria.emailTitle")}
                  items={emailCriteriaItems}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("signup.password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("signup.passwordPlaceholder")}
                    value={formData.password}
                    onChange={(event) => setField("password", event.target.value)}
                    className="h-12 rounded-xl border-border/80 bg-background px-4 pr-10"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground dark:text-slate-300 dark:hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    tabIndex={-1}
                    aria-label={showPassword ? t("signup.hidePassword") : t("signup.showPassword")}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <span>{t("signup.passwordStrengthLabel")}</span>
                    <span>{t(`signup.passwordStrengthLevels.${passwordStrengthLevel === "empty" ? "weak" : passwordStrengthLevel}`)}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={`password-strength-${index}`}
                        className={cn(
                          "h-2 rounded-full transition-colors",
                          index < passwordStrengthSegments ? passwordStrengthTone : "bg-muted",
                        )}
                      />
                    ))}
                  </div>
                  <SecurityCriteriaPanel
                    title={t("authCriteria.passwordTitle")}
                    items={passwordCriteriaItems}
                    columns={2}
                    className="border-0 bg-transparent p-0"
                  />
                </div>
              </div>

              {isEmployeeTrainee(formData) ? (
                <div className="grid gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 md:grid-cols-2 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <div className="space-y-2">
                    <Label htmlFor="employee-id">{t("signup.employeeId")}</Label>
                    <Input
                      id="employee-id"
                      type="text"
                      placeholder={t("signup.employeeIdPlaceholder")}
                      value={formData.employeeId}
                      onChange={(event) => setField("employeeId", event.target.value)}
                      className="h-12 rounded-xl border-amber-200 bg-white/90 px-4 text-foreground shadow-sm dark:border-amber-800/60 dark:bg-slate-950/70 dark:text-amber-50"
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="physical-id">{t("signup.physicalIdImage")}</Label>
                    <Input
                      id="physical-id"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhysicalIdFileChange}
                      className="h-12 rounded-xl border-amber-200 bg-white/90 px-4 text-foreground shadow-sm file:mr-4 file:rounded-md file:border-0 file:bg-amber-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-amber-900 dark:border-amber-800/60 dark:bg-slate-950/70 dark:text-amber-50 dark:file:bg-amber-500/20 dark:file:text-amber-100"
                      required
                    />
                    <p className="text-sm text-amber-900/75 dark:text-amber-100/80">
                      {t("signup.physicalIdHelp")}
                    </p>
                    {physicalIdFile ? (
                      <div className="rounded-2xl border border-amber-200/80 bg-white/90 p-4 dark:border-amber-800/50 dark:bg-slate-950/70">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start">
                          {physicalIdPreviewUrl ? (
                            <img
                              src={physicalIdPreviewUrl}
                              alt={t("signup.physicalIdPreview")}
                              className="h-40 w-full rounded-xl border border-amber-200/80 object-cover md:w-64 dark:border-amber-800/50"
                            />
                          ) : null}
                          <div className="space-y-2 text-sm text-muted-foreground dark:text-slate-300">
                            <p className="font-medium text-foreground">{physicalIdFile.name}</p>
                            <p className="text-amber-900/75 dark:text-amber-100/80">{(physicalIdFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                            <p className="text-amber-900/75 dark:text-amber-100/80">{t("signup.physicalIdStoredForVerification")}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <input type="hidden" value={formData.physicalId} readOnly />
                  </div>
                </div>
              ) : null}
            </div>

          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" className="min-w-56" disabled={loading}>
            {loading ? t("signup.creatingAccount") : t("signup.createAccount")}
          </Button>
        </div>
      </form>
      )}
    </AuthPageShell>
  );
};

export default SignUp;
