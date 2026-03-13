import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
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
  ONBOARDING_CATEGORY_OPTIONS,
  ONBOARDING_INDUSTRY_OPTIONS,
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

const renderReadinessQuestion = (
  name: string,
  label: string,
  description: string,
  value: string,
  options: Array<{ value: string; label: string; hint: string }>,
  onChange: (value: string) => void,
) => (
  <div className="space-y-4 rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
    <div>
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
    <div className="grid gap-2">
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="block font-medium text-foreground">{option.label}</span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">{option.hint}</span>
              </div>
              <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground/35")} />
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

export default function TraineeOnboardingModal({
  open,
  user,
  onDismiss,
  onCompleted,
}: TraineeOnboardingModalProps) {
  const { t, getMessage } = useLocale();
  const { updateUser } = useAuth();
  const [formData, setFormData] = useState<TraineeOnboardingFormData>(() => createInitialTraineeOnboardingFormData(user));
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [skillTagOptions, setSkillTagOptions] = useState<string[]>([]);

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

    const loadSkillTags = async () => {
      try {
        const options = await taxonomyService.getOptions();
        if (active) {
          setSkillTagOptions(options.skillTags);
        }
      } catch (error) {
        console.warn("Failed to load onboarding skill taxonomy options:", error);
        if (active) {
          setSkillTagOptions([]);
        }
      }
    };

    void loadSkillTags();

    return () => {
      active = false;
    };
  }, [open]);

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

  const setField = <K extends keyof TraineeOnboardingFormData>(field: K, value: TraineeOnboardingFormData[K]) => {
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
                  onClick={() => setCurrentStep(index)}
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

                <div className="space-y-3">
                  <Label>{t("onboarding.interests.industryLabel")}</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    {ONBOARDING_INDUSTRY_OPTIONS.map((interest) => (
                      <label key={interest} className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 dark:bg-muted/10 dark:hover:bg-primary/10">
                        <Checkbox
                          checked={formData.industryInterests.includes(interest)}
                          onCheckedChange={() => toggleSelection("industryInterests", interest)}
                          className="mt-0.5"
                        />
                        <span>{industryLabels[interest] || interest}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>{t("onboarding.interests.categoryLabel")}</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    {ONBOARDING_CATEGORY_OPTIONS.map((category) => (
                      <label key={category} className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 dark:bg-muted/10 dark:hover:bg-primary/10">
                        <Checkbox
                          checked={formData.preferredCategories.includes(category)}
                          onCheckedChange={() => toggleSelection("preferredCategories", category)}
                          className="mt-0.5"
                        />
                        <span>{categoryLabels[category] || category}</span>
                      </label>
                    ))}
                  </div>
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

                <div className="grid gap-4 lg:grid-cols-3">
                  {readinessQuestions.map((question) => {
                    const fieldName = question.key as "confidenceLevel" | "weeklyCommitment" | "digitalComfort";
                    return (
                      <div key={question.key}>
                        {renderReadinessQuestion(
                          question.key,
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
              <Button onClick={() => void handleComplete()} disabled={saving}>
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