import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User } from "@/types/auth";
import { getDashboardRoute, type UserRole as AppUserRole } from "@/lib/roles";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { analyticsService } from "@/services/analyticsService";
import { recommendationSyncService } from "@/services/recommendationSyncService";
import {
  ONBOARDING_CATEGORY_OPTIONS,
  ONBOARDING_INDUSTRY_OPTIONS,
  ONBOARDING_SKILL_LEVEL_OPTIONS,
} from "@/lib/onboarding";

const SIGNUP_DRAFT_STORAGE_KEY = "peso-signup-onboarding-draft-v1";

const genderOptions: Array<{ value: NonNullable<User["gender"]>; label: string }> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "other", label: "Other" },
];

const civilStatusOptions: Array<{ value: NonNullable<User["civilStatus"]>; label: string }> = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Separated" },
  { value: "divorced", label: "Divorced" },
  { value: "annulled", label: "Annulled" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const employmentStatusOptions: Array<{ value: NonNullable<User["employmentStatus"]>; label: string }> = [
  { value: "employed", label: "Employed" },
  { value: "unemployed", label: "Unemployed" },
  { value: "self_employed", label: "Self-employed" },
  { value: "student", label: "Student" },
  { value: "underemployed", label: "Underemployed" },
  { value: "not_applicable", label: "Not applicable" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

type SignUpStepId = "account" | "profile" | "preferences" | "readiness";

type SignUpFormData = {
  name: string;
  email: string;
  password: string;
  phone: string;
  dateOfBirth: string;
  gender: User["gender"] | "";
  civilStatus: User["civilStatus"] | "";
  employmentStatus: User["employmentStatus"] | "";
  occupation: string;
  educationLevel: string;
  address: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  postalCode: string;
  industryInterests: string[];
  preferredCategories: string[];
  onboardingSkillLevel: User["onboardingSkillLevel"] | "";
  existingSkills: string;
  confidenceLevel: "needs_guidance" | "some_exposure" | "ready_for_projects" | "";
  weeklyCommitment: "under_2" | "2_to_4" | "5_plus" | "";
  digitalComfort: "needs_support" | "comfortable" | "advanced_tools" | "";
};

type SignUpDraft = {
  formData: SignUpFormData;
  activeStepId: SignUpStepId;
};

const createInitialFormData = (): SignUpFormData => ({
  name: "",
  email: "",
  password: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  civilStatus: "",
  employmentStatus: "",
  occupation: "",
  educationLevel: "",
  address: "",
  barangay: "",
  cityMunicipality: "",
  province: "",
  postalCode: "",
  industryInterests: [],
  preferredCategories: [],
  onboardingSkillLevel: "",
  existingSkills: "",
  confidenceLevel: "",
  weeklyCommitment: "",
  digitalComfort: "",
});

const parseListInput = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getSuggestedSkillLevel = (formData: SignUpFormData): User["onboardingSkillLevel"] | "" => {
  const score =
    (formData.confidenceLevel === "ready_for_projects" ? 2 : formData.confidenceLevel === "some_exposure" ? 1 : 0) +
    (formData.weeklyCommitment === "5_plus" ? 2 : formData.weeklyCommitment === "2_to_4" ? 1 : 0) +
    (formData.digitalComfort === "advanced_tools" ? 2 : formData.digitalComfort === "comfortable" ? 1 : 0);

  if (!formData.confidenceLevel && !formData.weeklyCommitment && !formData.digitalComfort) {
    return "";
  }

  if (score <= 1) return "exploring";
  if (score <= 3) return "beginner";
  if (score <= 5) return "intermediate";
  return "advanced";
};

const getStepValidationError = (stepId: SignUpStepId, formData: SignUpFormData): string | null => {
  if (stepId === "account") {
    if (!formData.name.trim()) {
      return "Full name is required before continuing.";
    }
    if (!formData.email.trim()) {
      return "Email is required before continuing.";
    }
    if (!isValidEmail(formData.email.trim())) {
      return "Enter a valid email address before continuing.";
    }
    if (formData.password.length < 6) {
      return "Password must be at least 6 characters long.";
    }
  }

  if (stepId === "profile" && formData.dateOfBirth) {
    const birthDate = new Date(formData.dateOfBirth);
    const now = new Date();
    if (Number.isNaN(birthDate.getTime()) || birthDate > now) {
      return "Date of birth must be a valid past date.";
    }
  }

  return null;
};

const SignUp = () => {
  const { signup, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [formData, setFormData] = useState<SignUpFormData>(() => createInitialFormData());
  const [activeStepId, setActiveStepId] = useState<SignUpStepId>("account");
  const [draftReady, setDraftReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupInProgress, setSignupInProgress] = useState(false);

  const steps = useMemo(
    () => [
      {
        id: "account" as const,
        title: "Account setup",
        eyebrow: "Required",
        description: "Set up the name, email, and password you will use to sign in.",
      },
      {
        id: "profile" as const,
        title: "Learner profile",
        eyebrow: "Optional but recommended",
        description: "Add personal and location details so support and reporting stay accurate.",
      },
      {
        id: "preferences" as const,
        title: "Learning interests",
        eyebrow: "Helps recommendations",
        description: "Tell us what you want to learn so we can suggest better starter courses.",
      },
      {
        id: "readiness" as const,
        title: "Quick readiness check",
        eyebrow: "Optional",
        description: "Answer a few simple questions so we can match your starting level.",
      },
    ],
    [],
  );

  const activeStepIndex = steps.findIndex((step) => step.id === activeStepId);
  const progressValue = ((activeStepIndex + 1) / steps.length) * 100;
  const suggestedSkillLevel = useMemo(() => getSuggestedSkillLevel(formData), [formData]);
  const effectiveSkillLevel = formData.onboardingSkillLevel || suggestedSkillLevel;
  const recommendationSignalCoverage = Math.round(
    ([
      Boolean(effectiveSkillLevel),
      formData.industryInterests.length > 0,
      formData.preferredCategories.length > 0,
      parseListInput(formData.existingSkills).length > 0,
    ].filter(Boolean).length / 4) * 100,
  );

  const setField = <K extends keyof SignUpFormData>(field: K, value: SignUpFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const toggleSelection = (field: "industryInterests" | "preferredCategories", value: string) => {
    setFormData((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((entry) => entry !== value)
        : [...current[field], value],
    }));
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      setDraftReady(true);
      return;
    }

    try {
      const rawDraft = window.localStorage.getItem(SIGNUP_DRAFT_STORAGE_KEY);
      if (rawDraft) {
        const parsedDraft = JSON.parse(rawDraft) as Partial<SignUpDraft>;
        if (parsedDraft.formData) {
          setFormData({ ...createInitialFormData(), ...parsedDraft.formData });
        }
        if (parsedDraft.activeStepId && steps.some((step) => step.id === parsedDraft.activeStepId)) {
          setActiveStepId(parsedDraft.activeStepId);
        }
      }
    } catch (draftError) {
      console.warn("Failed to load signup draft:", draftError);
    } finally {
      setDraftReady(true);
    }
  }, [steps]);

  useEffect(() => {
    if (!draftReady || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      SIGNUP_DRAFT_STORAGE_KEY,
      JSON.stringify({ formData, activeStepId } satisfies SignUpDraft),
    );
  }, [draftReady, formData, activeStepId]);

  useEffect(() => {
    if (!isAuthenticated || !user || signupInProgress) return;
    if (redirectTo && redirectTo.startsWith("/")) {
      navigate(redirectTo, { replace: true });
    } else {
      navigate(getDashboardRoute(user.role as AppUserRole), { replace: true });
    }
  }, [isAuthenticated, user, navigate, redirectTo, signupInProgress]);

  const goToStep = (nextStepId: SignUpStepId) => {
    const requestedIndex = steps.findIndex((step) => step.id === nextStepId);
    if (requestedIndex === -1) {
      return;
    }

    if (requestedIndex > activeStepIndex) {
      const validationError = getStepValidationError(activeStepId, formData);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setError("");
    setActiveStepId(nextStepId);
  };

  const handleNextStep = () => {
    const validationError = getStepValidationError(activeStepId, formData);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    const nextStep = steps[activeStepIndex + 1];
    if (nextStep) {
      setActiveStepId(nextStep.id);
    }
  };

  const handlePreviousStep = () => {
    setError("");
    const previousStep = steps[activeStepIndex - 1];
    if (previousStep) {
      setActiveStepId(previousStep.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError =
      getStepValidationError(activeStepId, formData) ||
      getStepValidationError("account", formData) ||
      getStepValidationError("profile", formData);

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setSignupInProgress(true);
    let completedNavigation = false;

    try {
      const normalizedSkills = parseListInput(formData.existingSkills);
      const onboardingCompletedAt = new Date().toISOString();
      const result = await signup(formData.email, formData.password, formData.name, "trainee", {
        phone: formData.phone,
        address: formData.address,
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender || undefined,
        civilStatus: formData.civilStatus || undefined,
        employmentStatus: formData.employmentStatus || undefined,
        occupation: formData.occupation,
        educationLevel: formData.educationLevel,
        barangay: formData.barangay,
        cityMunicipality: formData.cityMunicipality,
        province: formData.province,
        postalCode: formData.postalCode,
        industryInterests: formData.industryInterests,
        preferredCategories: formData.preferredCategories,
        onboardingSkillLevel: effectiveSkillLevel || undefined,
        onboardingConfidenceLevel: formData.confidenceLevel || undefined,
        onboardingWeeklyCommitment: formData.weeklyCommitment || undefined,
        onboardingDigitalComfort: formData.digitalComfort || undefined,
        onboardingCompletedAt,
        skills: normalizedSkills.length > 0 ? normalizedSkills : undefined,
      });

      if (result.success && result.user) {
        const onboardingUser: User = {
          ...result.user,
          industryInterests: formData.industryInterests,
          preferredCategories: formData.preferredCategories,
          onboardingSkillLevel: effectiveSkillLevel || undefined,
          onboardingConfidenceLevel: formData.confidenceLevel || undefined,
          onboardingWeeklyCommitment: formData.weeklyCommitment || undefined,
          onboardingDigitalComfort: formData.digitalComfort || undefined,
          onboardingCompletedAt,
          skills: normalizedSkills.length > 0 ? normalizedSkills : undefined,
        };

        const persistedRecommendations = await recommendationSyncService.refreshProfileDrivenRecommendations(
          onboardingUser,
          ["dashboard_recommendations"],
          {
            trigger: "onboarding_completion",
            extraContext: {
              onboardingSignalCoverage: recommendationSignalCoverage,
              readinessResponses: {
                confidenceLevel: formData.confidenceLevel || null,
                weeklyCommitment: formData.weeklyCommitment || null,
                digitalComfort: formData.digitalComfort || null,
              },
              initialRecommendationSource: "signup_onboarding",
            },
          },
        );

        await analyticsService.trackEvent({
          eventName: "onboarding_completed",
          userId: onboardingUser.id,
          surface: "signup_onboarding",
          metadata: {
            industryInterestCount: formData.industryInterests.length,
            preferredCategoryCount: formData.preferredCategories.length,
            onboardingSkillLevel: effectiveSkillLevel || null,
            onboardingConfidenceLevel: formData.confidenceLevel || null,
            onboardingWeeklyCommitment: formData.weeklyCommitment || null,
            onboardingDigitalComfort: formData.digitalComfort || null,
            profileSkillsCount: normalizedSkills.length,
            onboardingSignalCoverage: recommendationSignalCoverage,
            generatedRecommendationCount: persistedRecommendations.length,
          },
        });

        if (typeof window !== "undefined") {
          window.localStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY);
        }

        completedNavigation = true;
        if (redirectTo && redirectTo.startsWith("/")) {
          navigate(redirectTo, { replace: true });
        } else {
          navigate("/dashboard", {
            replace: true,
            state: {
              onboardingSummary: {
                generatedRecommendationCount: persistedRecommendations.length,
                onboardingSkillLevel: effectiveSkillLevel || null,
                onboardingConfidenceLevel: formData.confidenceLevel || null,
                onboardingWeeklyCommitment: formData.weeklyCommitment || null,
                onboardingDigitalComfort: formData.digitalComfort || null,
                industryInterestCount: formData.industryInterests.length,
                preferredCategoryCount: formData.preferredCategories.length,
                hasExistingSkills: normalizedSkills.length > 0,
              },
            },
          });
        }
      } else {
        setError(result.error || "Email already exists. Please use a different email.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
      if (!completedNavigation) {
        setSignupInProgress(false);
      }
    }
  };

  const renderAccountStep = () => (
    <section className="space-y-5 rounded-2xl border border-border/70 bg-muted/20 p-5 sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">Account information</h3>
          <Badge variant="outline">Required</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Start with the basics so you can create your account quickly.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          type="text"
          placeholder="Juan Dela Cruz"
          value={formData.name}
          onChange={(e) => setField("name", e.target.value)}
          required
          className="h-12 rounded-xl border-border/80 bg-background px-4"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="your.email@peso.academy"
          value={formData.email}
          onChange={(e) => setField("email", e.target.value)}
          required
          className="h-12 rounded-xl border-border/80 bg-background px-4"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Create a password"
            value={formData.password}
            onChange={(e) => setField("password", e.target.value)}
            required
            minLength={6}
            className="h-12 rounded-xl border-border/80 bg-background px-4 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Use at least 6 characters for your account password.</p>
      </div>
    </section>
  );

  const renderProfileStep = () => (
    <section className="space-y-5 rounded-2xl border border-border/70 bg-background p-5 sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">Learner profile details</h3>
          <Badge variant="secondary">Optional</Badge>
        </div>
        <p className="text-sm text-muted-foreground">These details help us support you better, but you can skip them for now.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="09xx xxx xxxx"
            value={formData.phone}
            onChange={(e) => setField("phone", e.target.value)}
            className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date-of-birth">Date of Birth</Label>
          <Input
            id="date-of-birth"
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => setField("dateOfBirth", e.target.value)}
            className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select value={formData.gender} onValueChange={(value) => setField("gender", value as User["gender"])}>
            <SelectTrigger id="gender" className="h-12 rounded-xl border-border/80 bg-muted/20 px-4">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              {genderOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="civil-status">Civil Status</Label>
          <Select value={formData.civilStatus} onValueChange={(value) => setField("civilStatus", value as User["civilStatus"])}>
            <SelectTrigger id="civil-status" className="h-12 rounded-xl border-border/80 bg-muted/20 px-4">
              <SelectValue placeholder="Select civil status" />
            </SelectTrigger>
            <SelectContent>
              {civilStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="employment-status">Employment Status</Label>
          <Select value={formData.employmentStatus} onValueChange={(value) => setField("employmentStatus", value as User["employmentStatus"])}>
            <SelectTrigger id="employment-status" className="h-12 rounded-xl border-border/80 bg-muted/20 px-4">
              <SelectValue placeholder="Select employment status" />
            </SelectTrigger>
            <SelectContent>
              {employmentStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="occupation">Occupation</Label>
          <Input
            id="occupation"
            type="text"
            placeholder="Current job or primary occupation"
            value={formData.occupation}
            onChange={(e) => setField("occupation", e.target.value)}
            className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="education-level">Education Level</Label>
          <Input
            id="education-level"
            type="text"
            placeholder="e.g. College Graduate"
            value={formData.educationLevel}
            onChange={(e) => setField("educationLevel", e.target.value)}
            className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          placeholder="House number, street, subdivision"
          value={formData.address}
          onChange={(e) => setField("address", e.target.value)}
          className="min-h-28 rounded-xl border-border/80 bg-muted/20 px-4 py-3"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="barangay">Barangay</Label>
          <Input
            id="barangay"
            type="text"
            value={formData.barangay}
            onChange={(e) => setField("barangay", e.target.value)}
            className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city-municipality">City / Municipality</Label>
          <Input
            id="city-municipality"
            type="text"
            value={formData.cityMunicipality}
            onChange={(e) => setField("cityMunicipality", e.target.value)}
            className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="province">Province</Label>
          <Input
            id="province"
            type="text"
            value={formData.province}
            onChange={(e) => setField("province", e.target.value)}
            className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="postal-code">Postal Code</Label>
          <Input
            id="postal-code"
            type="text"
            value={formData.postalCode}
            onChange={(e) => setField("postalCode", e.target.value)}
            className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
          />
        </div>
      </div>
    </section>
  );

  const renderPreferencesStep = () => (
    <section className="space-y-5 rounded-2xl border border-border/70 bg-background p-5 sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">Learning interests</h3>
          <Badge>Optional</Badge>
        </div>
        <p className="text-sm text-muted-foreground">These answers are optional, but they help us suggest better courses before you build a learning history.</p>
      </div>

      <div className="space-y-3">
        <Label>Industry interests</Label>
        <div className="grid gap-3 md:grid-cols-2">
          {ONBOARDING_INDUSTRY_OPTIONS.map((interest) => (
            <label key={interest} className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3 text-sm">
              <Checkbox
                checked={formData.industryInterests.includes(interest)}
                onCheckedChange={() => toggleSelection("industryInterests", interest)}
                className="mt-0.5"
              />
              <span>{interest}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Preferred course categories</Label>
        <div className="grid gap-3 md:grid-cols-2">
          {ONBOARDING_CATEGORY_OPTIONS.map((category) => (
            <label key={category} className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3 text-sm">
              <Checkbox
                checked={formData.preferredCategories.includes(category)}
                onCheckedChange={() => toggleSelection("preferredCategories", category)}
                className="mt-0.5"
              />
              <span>{category}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
        <p className="text-sm font-medium text-foreground">Recommendation profile progress</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {recommendationSignalCoverage}% of the optional recommendation profile is filled in. You can continue even if you skip this step.
        </p>
      </div>
    </section>
  );

  const renderReadinessQuestion = (
    name: string,
    label: string,
    description: string,
    value: string,
    options: Array<{ value: string; label: string; hint: string }>,
    onChange: (value: string) => void,
  ) => (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-background p-4">
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <RadioGroup value={value} onValueChange={onChange} className="space-y-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-start gap-3 rounded-xl border border-border/70 px-3 py-3 text-sm">
            <RadioGroupItem value={option.value} id={`${name}-${option.value}`} className="mt-1" />
            <span>
              <span className="block font-medium text-foreground">{option.label}</span>
              <span className="mt-1 block text-muted-foreground">{option.hint}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );

  const renderReadinessStep = () => (
    <section className="space-y-5 rounded-2xl border border-border/70 bg-background p-5 sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">Quick readiness check</h3>
          <Badge variant="secondary">Optional</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Answer a few simple questions so we can suggest a starting level that feels right for you.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {renderReadinessQuestion(
          "confidence",
          "How confident are you with this kind of training?",
          "Choose the best description of your current starting point.",
          formData.confidenceLevel,
          [
            { value: "needs_guidance", label: "I need guided basics", hint: "I am new and want beginner-friendly starting points." },
            { value: "some_exposure", label: "I have some exposure", hint: "I know some basics but still need structured practice." },
            { value: "ready_for_projects", label: "I am ready for applied work", hint: "I can move into more demanding exercises or projects." },
          ],
          (value) => setField("confidenceLevel", value as SignUpFormData["confidenceLevel"]),
        )}

        {renderReadinessQuestion(
          "commitment",
          "How much time can you commit each week?",
          "This helps us avoid recommending a path that is too heavy too early.",
          formData.weeklyCommitment,
          [
            { value: "under_2", label: "Under 2 hours", hint: "I need short, low-friction starter modules." },
            { value: "2_to_4", label: "2 to 4 hours", hint: "I can handle a steady but moderate learning pace." },
            { value: "5_plus", label: "5+ hours", hint: "I can move through a more demanding training sequence." },
          ],
          (value) => setField("weeklyCommitment", value as SignUpFormData["weeklyCommitment"]),
        )}

        {renderReadinessQuestion(
          "digital-comfort",
          "How comfortable are you with digital tools?",
          "This gives the cold-start recommender another signal before you finish any modules.",
          formData.digitalComfort,
          [
            { value: "needs_support", label: "I need support with digital tools", hint: "Begin with very guided, low-complexity content." },
            { value: "comfortable", label: "I am comfortable with standard tools", hint: "A normal beginner or intermediate starting point is fine." },
            { value: "advanced_tools", label: "I already use advanced tools", hint: "I can usually handle faster progression and more technical tasks." },
          ],
          (value) => setField("digitalComfort", value as SignUpFormData["digitalComfort"]),
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-2 rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground">Suggested starting level</p>
          <p className="mt-2 text-3xl font-semibold capitalize">{effectiveSkillLevel || "Not set yet"}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {suggestedSkillLevel
              ? "We suggested a starting level based on your answers. You can keep it or change it below."
              : "Answer the questions above for a suggested level, or choose one yourself below."}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="skill-level">Preferred starting level</Label>
            <Select
              value={formData.onboardingSkillLevel}
              onValueChange={(value) => setField("onboardingSkillLevel", value as User["onboardingSkillLevel"])}
            >
              <SelectTrigger id="skill-level" className="h-12 rounded-xl border-border/80 bg-muted/20 px-4">
                <SelectValue placeholder={suggestedSkillLevel ? `Use suggested: ${suggestedSkillLevel}` : "Select your current level"} />
              </SelectTrigger>
              <SelectContent>
                {ONBOARDING_SKILL_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="existing-skills">Existing skills</Label>
            <Textarea
              id="existing-skills"
              placeholder="List any skills you already have, separated by commas or new lines"
              value={formData.existingSkills}
              onChange={(e) => setField("existingSkills", e.target.value)}
              className="min-h-28 rounded-xl border-border/80 bg-muted/20 px-4 py-3"
            />
            <p className="text-xs text-muted-foreground">This is optional and only helps us suggest better courses.</p>
          </div>
        </div>
      </div>
    </section>
  );

  const renderActiveStep = () => {
    switch (activeStepId) {
      case "account":
        return renderAccountStep();
      case "profile":
        return renderProfileStep();
      case "preferences":
        return renderPreferencesStep();
      case "readiness":
        return renderReadinessStep();
      default:
        return null;
    }
  };

  return (
    <AuthPageShell
      title="Create your account"
      subtitle="Create your PESO Academy learner account in a few simple steps. We keep login details, profile info, interests, and readiness questions separate so the process stays easy to follow."
      maxWidthClass="max-w-5xl"
      switchPrompt={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary transition-colors hover:text-primary/80">
            Login here
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4 rounded-2xl border border-border/70 bg-background/80 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Create your account</h2>
              <p className="text-sm text-muted-foreground">All public signups create learner accounts. Your progress is saved on this device while you move between steps.</p>
            </div>
            <Badge variant="outline">Step {activeStepIndex + 1} of {steps.length}</Badge>
          </div>

          <Progress value={progressValue} className="h-2" />

          <div className="grid gap-3 md:grid-cols-4">
            {steps.map((step, index) => {
              const isCompleted = index < activeStepIndex;
              const isActive = step.id === activeStepId;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(step.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : isCompleted
                        ? "border-primary/30 bg-background"
                        : "border-border/70 bg-muted/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{step.eyebrow}</span>
                    {isCompleted ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                  </div>
                  <p className="mt-3 font-medium text-foreground">{step.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {draftReady ? renderActiveStep() : null}

        <div className="grid gap-4 rounded-2xl border border-border/70 bg-muted/20 p-5 sm:grid-cols-[1.2fr_0.8fr] sm:p-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Why the flow is split</p>
            <p className="text-sm leading-6 text-muted-foreground">
              We keep account setup short, then place profile details and optional recommendation questions in separate steps so the process feels simpler and easier to finish.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeStepIndex > 0 ? (
              <Button type="button" variant="outline" onClick={handlePreviousStep} disabled={loading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            ) : null}

            {activeStepIndex < steps.length - 1 ? (
              <Button type="button" onClick={handleNextStep} disabled={loading}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" className="min-w-56" disabled={loading}>
                {loading ? "Finishing onboarding..." : "Finish onboarding"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </AuthPageShell>
  );
};

export default SignUp;

