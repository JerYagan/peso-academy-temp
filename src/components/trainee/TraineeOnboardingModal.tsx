import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Search } from "lucide-react";
import { TaxonomyTagField } from "@/components/course/TaxonomyTagField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TraineeVerificationBadge from "@/components/trainee/TraineeVerificationBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";
import {
  buildTraineeOnboardingSummary,
  createInitialTraineeOnboardingFormData,
  getOnboardingSignalCoverage,
  getSuggestedOnboardingSkillLevel,
  ONBOARDING_SKILL_LEVEL_OPTIONS,
  parseOnboardingSkillsInput,
  TRAINEE_ONBOARDING_DRAFT_KEY,
  TRAINEE_ONBOARDING_MODAL_PENDING_KEY,
  TRAINEE_ONBOARDING_STEP_KEY,
  type TraineeOnboardingFormData,
  type TraineeOnboardingSummary,
} from "@/lib/onboarding";
import { analyticsService } from "@/services/analyticsService";
import { recommendationSyncService } from "@/services/recommendationSyncService";
import { taxonomyService } from "@/services/taxonomyService";
import { toast } from "sonner";
import type { User } from "@/types/auth";

type TraineeOnboardingModalProps = {
  open: boolean;
  user: User;
  onDismiss: () => void;
  onCompleted?: (summary: TraineeOnboardingSummary) => void;
};

const mergeOptions = (...groups: Array<readonly string[] | undefined>) => {
  const seen = new Set<string>();

  return groups.flat().reduce<string[]>((result, value) => {
    if (!value) {
      return result;
    }

    const normalized = value.trim().replace(/\s+/g, " ");
    const key = normalized.toLowerCase();

    if (!normalized || seen.has(key)) {
      return result;
    }

    seen.add(key);
    result.push(normalized);
    return result;
  }, []);
};

const pickRandomOptions = (options: string[], limit: number) => {
  if (options.length <= limit) {
    return [...options];
  }

  const shuffled = [...options];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled.slice(0, limit);
};

const renderReadinessQuestion = (
  label: string,
  description: string,
  value: string,
  options: Array<{ value: string; label: string; hint: string }>,
  onChange: (value: string) => void,
) => (
  <div className="space-y-4 rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {value ? (
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-semibold">
          {options.find((option) => option.value === value)?.label}
        </Badge>
      ) : null}
    </div>
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-xl border px-3 py-3 text-left transition-colors",
              isSelected
                ? "border-primary bg-primary/8 text-foreground shadow-sm"
                : "border-border/70 bg-muted/18 text-foreground hover:border-primary/35 hover:bg-primary/5",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="block font-medium text-foreground">{option.label}</span>
              <CheckCircle2 className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground/35")} />
            </div>
          </button>
        );
      })}
    </div>
    <p className="min-h-5 text-xs leading-5 text-muted-foreground">
      {options.find((option) => option.value === value)?.hint || description}
    </p>
  </div>
);

type SearchableSelectionFieldProps = {
  label: string;
  options: string[];
  sampledOptions: string[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedValues: string[];
  onToggle: (value: string) => void;
  searchPlaceholder: string;
  emptyMessage: string;
  displayValue: (value: string) => string;
  maxVisibleOptions?: number;
  dropdownMaxResults?: number;
};

const SearchableSelectionField = ({
  label,
  options,
  sampledOptions,
  searchValue,
  onSearchChange,
  selectedValues,
  onToggle,
  searchPlaceholder,
  emptyMessage,
  displayValue,
  maxVisibleOptions = 10,
  dropdownMaxResults = 5,
}: SearchableSelectionFieldProps) => {
  const normalizedSearch = searchValue.trim().toLowerCase();
  const sampledGridOptions = mergeOptions(selectedValues, sampledOptions).slice(0, Math.max(maxVisibleOptions, selectedValues.length));
  const dropdownOptions = normalizedSearch
    ? options.filter((option) => displayValue(option).toLowerCase().includes(normalizedSearch)).slice(0, dropdownMaxResults)
    : [];

  return (
    <div className="space-y-3">
      <Label>{label}</Label>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-11 rounded-xl border-border/80 bg-muted/20 pl-10"
        />

        {normalizedSearch ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-xl border border-border/80 bg-background p-2 shadow-lg">
            {dropdownOptions.length > 0 ? (
              <div className="space-y-1">
                {dropdownOptions.map((option) => {
                  const isSelected = selectedValues.includes(option);

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        onToggle(option);
                        onSearchChange("");
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        isSelected
                          ? "bg-primary/8 text-foreground"
                          : "hover:bg-muted/60 text-foreground",
                      )}
                    >
                      <Checkbox checked={isSelected} className="mt-0.5 pointer-events-none" />
                      <span>{displayValue(option)}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</div>
            )}
          </div>
        ) : null}
      </div>

      {sampledGridOptions.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {sampledGridOptions.map((option) => {
            const isSelected = selectedValues.includes(option);

            return (
              <label
                key={option}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-sm text-foreground transition-colors",
                  isSelected
                    ? "border-primary/45 bg-primary/6"
                    : "border-border/70 bg-muted/20 hover:border-primary/35 hover:bg-primary/5 dark:bg-muted/10 dark:hover:bg-primary/10",
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggle(option)}
                  className="mt-0.5"
                />
                <span>{displayValue(option)}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </div>
  );
};

export default function TraineeOnboardingModal({
  open,
  user,
  onDismiss,
  onCompleted,
}: TraineeOnboardingModalProps) {
  const { t, getMessage, language } = useLocale();
  const { updateUser } = useAuth();
  const [formData, setFormData] = useState<TraineeOnboardingFormData>(() => createInitialTraineeOnboardingFormData(user));
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [skillTagOptions, setSkillTagOptions] = useState<string[]>([]);
  const [industryOptions, setIndustryOptions] = useState<string[]>(() => mergeOptions(user.industryInterests));
  const [categoryOptions, setCategoryOptions] = useState<string[]>(() => mergeOptions(user.preferredCategories));
  const [industrySampledOptions, setIndustrySampledOptions] = useState<string[]>(() => pickRandomOptions(mergeOptions(user.industryInterests), 10));
  const [categorySampledOptions, setCategorySampledOptions] = useState<string[]>(() => pickRandomOptions(mergeOptions(user.preferredCategories), 10));
  const [industrySearch, setIndustrySearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");

  useEffect(() => {
    if (open) {
      const initialData = createInitialTraineeOnboardingFormData(user);

      if (typeof window !== "undefined") {
        const storedDraft = window.sessionStorage.getItem(TRAINEE_ONBOARDING_DRAFT_KEY);
        const storedStep = window.sessionStorage.getItem(TRAINEE_ONBOARDING_STEP_KEY);

        if (storedDraft) {
          try {
            const parsedDraft = JSON.parse(storedDraft) as Partial<TraineeOnboardingFormData>;
            setFormData({
              ...initialData,
              ...parsedDraft,
              industryInterests: Array.isArray(parsedDraft.industryInterests) ? parsedDraft.industryInterests : initialData.industryInterests,
              preferredCategories: Array.isArray(parsedDraft.preferredCategories) ? parsedDraft.preferredCategories : initialData.preferredCategories,
            });
          } catch {
            setFormData(initialData);
          }
        } else {
          setFormData(initialData);
        }

        const parsedStep = Number(storedStep);
        setCurrentStep(Number.isInteger(parsedStep) && parsedStep >= 0 && parsedStep <= 2 ? parsedStep : 0);
        return;
      }

      setFormData(initialData);
      setCurrentStep(0);
    }
  }, [open, user]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(TRAINEE_ONBOARDING_DRAFT_KEY, JSON.stringify(formData));
  }, [formData, open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(TRAINEE_ONBOARDING_STEP_KEY, String(currentStep));
  }, [currentStep, open]);

  useEffect(() => {
    let active = true;

    if (!open) {
      return () => {
        active = false;
      };
    }

    const loadOnboardingOptions = async () => {
      try {
        const options = await taxonomyService.getOptions();
        if (active) {
          setSkillTagOptions(options.skillTags);
          const resolvedIndustryOptions = mergeOptions(options.industryTags, user.industryInterests);
          const resolvedCategoryOptions = mergeOptions(options.courseCategories, user.preferredCategories);

          setIndustryOptions(resolvedIndustryOptions);
          setCategoryOptions(resolvedCategoryOptions);
          setIndustrySampledOptions(pickRandomOptions(resolvedIndustryOptions, 10));
          setCategorySampledOptions(pickRandomOptions(resolvedCategoryOptions, 10));
        }
      } catch (error) {
        console.warn("Failed to load onboarding taxonomy options:", error);
        if (active) {
          setSkillTagOptions([]);
          const fallbackIndustryOptions = mergeOptions(user.industryInterests);
          const fallbackCategoryOptions = mergeOptions(user.preferredCategories);

          setIndustryOptions(fallbackIndustryOptions);
          setCategoryOptions(fallbackCategoryOptions);
          setIndustrySampledOptions(pickRandomOptions(fallbackIndustryOptions, 10));
          setCategorySampledOptions(pickRandomOptions(fallbackCategoryOptions, 10));
        }
      }
    };

    void loadOnboardingOptions();

    return () => {
      active = false;
    };
  }, [open, user.industryInterests, user.preferredCategories]);

  const resolvedVerificationStatus = user.verificationStatus ?? "pending";
  const resolvedTraineeType = user.traineeType ? t(`onboarding.traineeTypes.${user.traineeType}`) : t("onboarding.traineeTypes.default");
  const suggestedSkillLevel = useMemo(() => getSuggestedOnboardingSkillLevel(formData), [formData]);
  const effectiveSkillLevel = formData.onboardingSkillLevel || suggestedSkillLevel;
  const signalCoverage = useMemo(() => getOnboardingSignalCoverage(formData), [formData]);
  const skillLevelLabels = getMessage<Record<string, string>>("onboarding.skillLevelLabels");
  const industryLabels = getMessage<Record<string, string>>("onboarding.industryLabels");
  const categoryLabels = getMessage<Record<string, string>>("onboarding.categoryLabels");
  const readinessQuestions = getMessage<Array<{
    key: string;
    label: string;
    description: string;
    options: Array<{ value: string; label: string; hint: string }>;
  }>>("onboarding.readinessQuestions");
  const steps = getMessage<Array<{ title: string; description: string }>>("onboarding.steps");
  const stepCount = steps.length;
  const canGoBack = currentStep > 0;
  const isLastStep = currentStep === stepCount - 1;
  const interestsSearchPlaceholder = t("onboarding.interests.searchPlaceholder");
  const interestsEmpty = t("onboarding.interests.emptyState");

  const setField = <K extends keyof TraineeOnboardingFormData>(field: K, value: TraineeOnboardingFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const onboardingValidationCopy = language === "tl"
    ? {
        interests: "Pumili ng kahit isang industry interest at isang preferred category bago magpatuloy.",
        readiness: "Sagutin ang lahat ng readiness questions bago magpatuloy.",
        skills: "Pumili ng skill level at magdagdag ng kahit isang skill bago tapusin ang onboarding.",
      }
    : {
        interests: "Select at least one industry interest and one preferred category before continuing.",
        readiness: "Answer all readiness questions before continuing.",
        skills: "Select a skill level and add at least one skill before completing onboarding.",
      };

  const validateStep = (step: number) => {
    if (step === 0) {
      if (formData.industryInterests.length === 0 || formData.preferredCategories.length === 0) {
        toast.error(onboardingValidationCopy.interests);
        return false;
      }

      return true;
    }

    if (step === 1) {
      if (!formData.confidenceLevel || !formData.weeklyCommitment || !formData.digitalComfort) {
        toast.error(onboardingValidationCopy.readiness);
        return false;
      }

      return true;
    }

    if (!effectiveSkillLevel || parseOnboardingSkillsInput(formData.existingSkills).length === 0) {
      toast.error(onboardingValidationCopy.skills);
      return false;
    }

    return true;
  };

  const toggleSelection = (field: "industryInterests" | "preferredCategories", value: string) => {
    setFormData((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((entry) => entry !== value)
        : [...current[field], value],
    }));
  };

  const handleComplete = async () => {
    setSaving(true);

    try {
      const normalizedSkills = parseOnboardingSkillsInput(formData.existingSkills);
      const onboardingCompletedAt = new Date().toISOString();

      const onboardingUpdates: Partial<User> = {
        industryInterests: formData.industryInterests,
        preferredCategories: formData.preferredCategories,
        onboardingSkillLevel: effectiveSkillLevel || undefined,
        onboardingConfidenceLevel: formData.confidenceLevel || undefined,
        onboardingWeeklyCommitment: formData.weeklyCommitment || undefined,
        onboardingDigitalComfort: formData.digitalComfort || undefined,
        onboardingCompletedAt,
        onboardingModalSeenAt: user.onboardingModalSeenAt || onboardingCompletedAt,
        skills: normalizedSkills.length > 0 ? normalizedSkills : undefined,
      };

      await updateUser(onboardingUpdates);

      const onboardingUser: User = {
        ...user,
        ...onboardingUpdates,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      };

      let persistedRecommendations = [] as Awaited<ReturnType<typeof recommendationSyncService.refreshProfileDrivenRecommendations>>;

      try {
        persistedRecommendations = await recommendationSyncService.refreshProfileDrivenRecommendations(
          onboardingUser,
          ["dashboard_recommendations"],
          {
            trigger: "onboarding_completion",
            extraContext: {
              onboardingSignalCoverage: signalCoverage,
              readinessResponses: {
                confidenceLevel: formData.confidenceLevel || null,
                weeklyCommitment: formData.weeklyCommitment || null,
                digitalComfort: formData.digitalComfort || null,
              },
              initialRecommendationSource: "dashboard_onboarding_modal",
            },
          },
        );
      } catch (sideEffectError) {
        console.warn("Failed to refresh onboarding recommendations after dashboard completion:", sideEffectError);
      }

      try {
        await analyticsService.trackEvent({
          eventName: "onboarding_completed",
          userId: onboardingUser.id,
          surface: "dashboard_onboarding_modal",
          metadata: {
            industryInterestCount: formData.industryInterests.length,
            preferredCategoryCount: formData.preferredCategories.length,
            onboardingSkillLevel: effectiveSkillLevel || null,
            onboardingConfidenceLevel: formData.confidenceLevel || null,
            onboardingWeeklyCommitment: formData.weeklyCommitment || null,
            onboardingDigitalComfort: formData.digitalComfort || null,
            onboardingCompletedAt,
            profileSkillsCount: normalizedSkills.length,
            onboardingSignalCoverage: signalCoverage,
            generatedRecommendationCount: persistedRecommendations.length,
          },
        });
      } catch (analyticsError) {
        console.warn("Failed to log onboarding analytics after dashboard completion:", analyticsError);
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(TRAINEE_ONBOARDING_MODAL_PENDING_KEY);
        window.sessionStorage.removeItem(TRAINEE_ONBOARDING_DRAFT_KEY);
        window.sessionStorage.removeItem(TRAINEE_ONBOARDING_STEP_KEY);
      }

      const summary = buildTraineeOnboardingSummary(formData, persistedRecommendations.length);
      onCompleted?.(summary);
      toast.success(t("onboarding.toasts.completed"));
    } catch (error) {
      console.error("Failed to complete trainee onboarding:", error);
      toast.error(t("onboarding.toasts.failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      return;
    }

    setCurrentStep((value) => Math.min(value + 1, stepCount - 1));
  };

  const progressValue = ((currentStep + 1) / stepCount) * 100;

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        hideCloseButton
        className="flex max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-4xl flex-col overflow-hidden border-primary/15 bg-background p-0"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-border/70 bg-background px-5 py-4 sm:px-6">
            <DialogHeader className="space-y-3 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                  {t("onboarding.badge")}
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold">
                  {resolvedTraineeType}
                </Badge>
                <TraineeVerificationBadge status={resolvedVerificationStatus} />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
                  {t("onboarding.title")}
                </DialogTitle>
                <DialogDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {t("onboarding.description")}
                </DialogDescription>
              </div>
              <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/25 p-3">
                <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <span>{t("onboarding.progressLabel", { current: currentStep + 1, total: stepCount })}</span>
                  <span>{Math.round(progressValue)}%</span>
                </div>
                <Progress value={progressValue} className="h-2.5 bg-muted" />
                <p className="text-sm text-foreground/80">{steps[currentStep]?.description}</p>
              </div>
            </DialogHeader>

            <div className="mt-4 grid w-full gap-2 sm:grid-cols-3">
              {steps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  className={`min-h-14 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${index === currentStep ? "border-primary/60 bg-primary text-primary-foreground shadow-sm" : index < currentStep ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-border bg-muted/35 text-foreground/72 hover:border-primary/30 hover:text-foreground"}`}
                  onClick={() => {
                    if (index <= currentStep) {
                      setCurrentStep(index);
                      return;
                    }

                    if (validateStep(currentStep)) {
                      setCurrentStep(index);
                    }
                  }}
                  disabled={saving}
                >
                  <span className="block">{step.title}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-5 bg-background px-5 py-4 sm:px-6 sm:py-5">
            {currentStep === 0 ? (
              <div className="space-y-5 rounded-2xl border border-border/70 bg-background p-5 sm:p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{t("onboarding.interests.title")}</h3>
                    <Badge>{t("onboarding.interests.badge")}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-foreground/72">{t("onboarding.interests.description")}</p>
                </div>

                <div className="grid gap-4">
                  <SearchableSelectionField
                    label={t("onboarding.interests.industryLabel")}
                    options={industryOptions}
                    sampledOptions={industrySampledOptions}
                    searchValue={industrySearch}
                    onSearchChange={setIndustrySearch}
                    selectedValues={formData.industryInterests}
                    onToggle={(value) => toggleSelection("industryInterests", value)}
                    searchPlaceholder={interestsSearchPlaceholder.replace("{{label}}", t("onboarding.interests.industryLabel").toLowerCase())}
                    emptyMessage={interestsEmpty}
                    displayValue={(value) => industryLabels[value] || value}
                  />

                  <SearchableSelectionField
                    label={t("onboarding.interests.categoryLabel")}
                    options={categoryOptions}
                    sampledOptions={categorySampledOptions}
                    searchValue={categorySearch}
                    onSearchChange={setCategorySearch}
                    selectedValues={formData.preferredCategories}
                    onToggle={(value) => toggleSelection("preferredCategories", value)}
                    searchPlaceholder={interestsSearchPlaceholder.replace("{{label}}", t("onboarding.interests.categoryLabel").toLowerCase())}
                    emptyMessage={interestsEmpty}
                    displayValue={(value) => categoryLabels[value] || value}
                  />
                </div>
              </div>
            ) : null}

            {currentStep === 1 ? (
              <div className="space-y-5 rounded-2xl border border-border/70 bg-background p-5 sm:p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{t("onboarding.readiness.title")}</h3>
                    <Badge variant="secondary">{t("onboarding.readiness.badge")}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-foreground/72">{t("onboarding.readiness.description")}</p>
                </div>

                <div className="grid gap-4">
                  {readinessQuestions.map((question) => {
                    const fieldName = question.key as "confidenceLevel" | "weeklyCommitment" | "digitalComfort";
                    return (
                      <div key={question.key}>
                        {renderReadinessQuestion(
                          question.label,
                          question.description,
                          formData[fieldName],
                          question.options,
                          (value) => setField(fieldName, value as never),
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div className="space-y-5 rounded-2xl border border-border/70 bg-background p-5 sm:p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{t("onboarding.skills.title")}</h3>
                    <Badge variant="secondary">{t("onboarding.skills.badge")}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-foreground/72">{t("onboarding.skills.description")}</p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-2 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <p className="text-sm font-medium text-foreground">{t("onboarding.skills.suggestedLevelTitle")}</p>
                    <p className="mt-2 text-3xl font-semibold capitalize">{effectiveSkillLevel ? skillLevelLabels[effectiveSkillLevel] || effectiveSkillLevel : t("onboarding.skills.notSet")}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {suggestedSkillLevel ? t("onboarding.skills.suggestedLevelBody") : t("onboarding.skills.suggestedLevelEmpty")}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="skill-level">{t("onboarding.skills.levelLabel")}</Label>
                      <Select
                        value={formData.onboardingSkillLevel}
                        onValueChange={(value) => setField("onboardingSkillLevel", value as TraineeOnboardingFormData["onboardingSkillLevel"])}
                      >
                        <SelectTrigger id="skill-level" className="h-12 rounded-xl border-border/80 bg-muted/20 px-4">
                          <SelectValue placeholder={suggestedSkillLevel ? t("onboarding.skills.levelPlaceholderSuggested", { level: skillLevelLabels[suggestedSkillLevel] || suggestedSkillLevel }) : t("onboarding.skills.levelPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {ONBOARDING_SKILL_LEVEL_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {skillLevelLabels[option.value] || option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <TaxonomyTagField
                      label={t("onboarding.skills.skillsLabel")}
                      options={skillTagOptions}
                      values={parseOnboardingSkillsInput(formData.existingSkills)}
                      onChange={(values) => setField("existingSkills", values.join(", "))}
                      placeholder={t("onboarding.skills.skillsPlaceholder")}
                      description={t("onboarding.skills.skillsHelp")}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-100">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{t("onboarding.skills.resumeNote")}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-3 border-t bg-background px-5 py-3 sm:justify-between sm:px-6">
          <p className="text-sm leading-5 text-foreground/72">
            {t("onboarding.actions.requiredNote")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" onClick={() => setCurrentStep((value) => Math.max(value - 1, 0))} disabled={saving || !canGoBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("onboarding.actions.back")}
            </Button>
            {isLastStep ? (
              <Button
                onClick={() => {
                  if (!validateStep(currentStep)) {
                    return;
                  }

                  void handleComplete();
                }}
                disabled={saving}
              >
                {saving ? t("onboarding.actions.saving") : t("onboarding.actions.complete")}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={saving}>
                {t("onboarding.actions.next")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}