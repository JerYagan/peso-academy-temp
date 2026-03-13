import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, Mail, UserRound } from "lucide-react";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { formatAllowedEmployeeDomains, isAllowedEmployeeRegistrationEmail } from "@/lib/employeeRegistration";
import { TRAINEE_ONBOARDING_MODAL_PENDING_KEY } from "@/lib/onboarding";
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

  const allowedDomainLabel = useMemo(
    () => formatAllowedEmployeeDomains(allowedEmployeeDomains),
    [allowedEmployeeDomains],
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

    if (redirectTo && redirectTo.startsWith("/")) {
      navigate(redirectTo, { replace: true });
      return;
    }

    navigate(getDashboardRoute(user.role as AppUserRole), { replace: true });
  }, [authLoading, isAuthenticated, navigate, redirectTo, user]);

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

    if (formData.password.length < 6) {
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

      if (result.error || !result.user) {
        setError(typeof result.error === "string" ? result.error : t("signup.validation.signupFailed"));
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
      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-5 rounded-2xl border border-border/70 bg-background p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t("signup.sectionTitle")}</h2>
            <Badge variant="outline">{t("common.required")}</Badge>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
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
                      <span className="mt-1 block text-muted-foreground">
                        {t("signup.pesoClientDescription")}
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm">
                    <RadioGroupItem value="peso_employee" id="trainee-type-peso-employee" className="mt-1" />
                    <span>
                      <span className="block font-medium text-foreground">{t("signup.pesoEmployee")}</span>
                      <span className="mt-1 block text-muted-foreground">
                        {t("signup.pesoEmployeeDescription")}
                      </span>
                    </span>
                  </label>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t("signup.fullName")}</Label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                {isEmployeeTrainee(formData) ? (
                  <p className="text-xs text-muted-foreground">{t("signup.employeeDomainHint", { domains: allowedDomainLabel })}</p>
                ) : null}
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
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    tabIndex={-1}
                    aria-label={showPassword ? t("signup.hidePassword") : t("signup.showPassword")}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isEmployeeTrainee(formData) ? (
                <div className="grid gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="employee-id">{t("signup.employeeId")}</Label>
                    <Input
                      id="employee-id"
                      type="text"
                      placeholder={t("signup.employeeIdPlaceholder")}
                      value={formData.employeeId}
                      onChange={(event) => setField("employeeId", event.target.value)}
                      className="h-12 rounded-xl border-border/80 bg-background px-4"
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
                      className="h-12 rounded-xl border-border/80 bg-background px-4 file:mr-4 file:border-0 file:bg-transparent file:text-sm file:font-medium"
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      {t("signup.physicalIdHelp")}
                    </p>
                    {physicalIdFile ? (
                      <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start">
                          {physicalIdPreviewUrl ? (
                            <img
                              src={physicalIdPreviewUrl}
                              alt={t("signup.physicalIdPreview")}
                              className="h-40 w-full rounded-xl border border-border/60 object-cover md:w-64"
                            />
                          ) : null}
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">{physicalIdFile.name}</p>
                            <p>{(physicalIdFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                            <p>{t("signup.physicalIdStoredForVerification")}</p>
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
    </AuthPageShell>
  );
};

export default SignUp;
