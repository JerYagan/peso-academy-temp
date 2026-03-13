import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ShieldCheck, Sparkles, UserRound } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import TraineeVerificationBadge from "@/components/trainee/TraineeVerificationBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
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
  <div className="space-y-3 rounded-2xl border border-border/70 bg-background p-4">
    <div>
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
    <RadioGroup value={value} onValueChange={onChange} className="space-y-2">
      {options.map((option) => (
        <div key={option.value} className="flex items-start gap-3 rounded-xl border border-border/70 px-3 py-3 text-sm">
          <RadioGroupItem value={option.value} id={`${name}-${option.value}`} className="mt-1" />
          <label htmlFor={`${name}-${option.value}`} className="cursor-pointer">
            <span className="block font-medium text-foreground">{option.label}</span>
            <span className="mt-1 block text-muted-foreground">{option.hint}</span>
          </label>
        </div>
      ))}
    </RadioGroup>
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

  const handleDismiss = () => {
    onDismiss();
  };

  const handleNext = () => {
    setCurrentStep((value) => Math.min(value + 1, stepCount - 1));
  };

  const progressValue = ((currentStep + 1) / stepCount) * 100;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !saving && handleDismiss()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden border-primary/15 p-0">
        <div className="bg-muted/55 p-6 sm:p-8 dark:bg-muted/35">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                {t("onboarding.badge")}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {resolvedTraineeType}
              </Badge>
              <TraineeVerificationBadge status={resolvedVerificationStatus} />
            </div>
            <DialogTitle className="text-2xl tracking-[-0.03em] sm:text-3xl">
              {t("onboarding.title")}
            </DialogTitle>
            <DialogDescription className="max-w-3xl text-sm leading-7 text-muted-foreground">
              {t("onboarding.description")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="border-b border-border/70 bg-background/80 px-6 py-4 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("onboarding.progressLabel", { current: currentStep + 1, total: stepCount })}
              </p>
              <p className="text-sm text-muted-foreground">{steps[currentStep]?.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {steps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${index === currentStep ? "border-primary bg-primary/10 text-primary" : index < currentStep ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-background text-muted-foreground"}`}
                  onClick={() => setCurrentStep(index)}
                  disabled={saving}
                >
                  {step.title}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progressValue}%` }} />
          </div>
        </div>

        <div className="max-h-[calc(90vh-18rem)] space-y-6 overflow-y-auto p-6 pt-5 sm:p-8 sm:pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background p-4">
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-sm font-medium">{t("onboarding.cards.verificationTitle")}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {t(`onboarding.verificationMessages.${resolvedVerificationStatus}`)}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background p-4">
              <div className="flex items-center gap-2 text-primary">
                <UserRound className="h-4 w-4" />
                <p className="text-sm font-medium">{t("onboarding.cards.coverageTitle")}</p>
              </div>
              <p className="mt-3 text-3xl font-semibold text-foreground">{signalCoverage}%</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("onboarding.cards.coverageBody")}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background p-4">
              <div className="flex items-center gap-2 text-primary">
                <BookOpen className="h-4 w-4" />
                <p className="text-sm font-medium">{t("onboarding.cards.unlockTitle")}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {t("onboarding.cards.unlockBody")}
              </p>
            </div>
          </div>

          {currentStep === 0 ? (
            <div className="space-y-5 rounded-2xl border border-border/70 bg-background p-5 sm:p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">{t("onboarding.interests.title")}</h3>
                  <Badge>{t("onboarding.interests.badge")}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{t("onboarding.interests.description")}</p>
              </div>

              <div className="space-y-3">
                <Label>{t("onboarding.interests.industryLabel")}</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  {ONBOARDING_INDUSTRY_OPTIONS.map((interest) => (
                    <label key={interest} className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3 text-sm">
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
                    <label key={category} className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3 text-sm">
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
                <p className="text-sm text-muted-foreground">{t("onboarding.readiness.description")}</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {readinessQuestions.map((question) => {
                  const fieldName = question.key as "confidenceLevel" | "weeklyCommitment" | "digitalComfort";
                  return renderReadinessQuestion(
                    question.key,
                    question.label,
                    question.description,
                    formData[fieldName],
                    question.options,
                    (value) => setField(fieldName, value as never),
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
                <p className="text-sm text-muted-foreground">{t("onboarding.skills.description")}</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
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

                  <div className="space-y-2">
                    <Label htmlFor="existing-skills">{t("onboarding.skills.skillsLabel")}</Label>
                    <Textarea
                      id="existing-skills"
                      placeholder={t("onboarding.skills.skillsPlaceholder")}
                      value={formData.existingSkills}
                      onChange={(event) => setField("existingSkills", event.target.value)}
                      className="min-h-28 rounded-xl border-border/80 bg-muted/20 px-4 py-3"
                    />
                    <p className="text-xs text-muted-foreground">{t("onboarding.skills.skillsHelp")}</p>
                  </div>
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

        <DialogFooter className="gap-3 border-t px-6 py-4 sm:justify-between sm:px-8">
          <Button variant="ghost" onClick={handleDismiss} disabled={saving}>
            {t("onboarding.actions.saveForLater")}
          </Button>
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