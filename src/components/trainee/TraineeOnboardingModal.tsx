import { useEffect, useMemo, useState } from "react";
import { BookOpen, ShieldCheck, Sparkles, UserRound } from "lucide-react";
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
import {
  buildTraineeOnboardingSummary,
  createInitialTraineeOnboardingFormData,
  getOnboardingSignalCoverage,
  getSuggestedOnboardingSkillLevel,
  ONBOARDING_CATEGORY_OPTIONS,
  ONBOARDING_INDUSTRY_OPTIONS,
  ONBOARDING_SKILL_LEVEL_OPTIONS,
  parseOnboardingSkillsInput,
  TRAINEE_ONBOARDING_MODAL_PENDING_KEY,
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

const traineeTypeLabel: Record<NonNullable<User["traineeType"]>, string> = {
  peso_client: "PESO Client",
  peso_employee: "PESO Employee",
};

const verificationMessageByStatus: Record<NonNullable<User["verificationStatus"]>, string> = {
  pending: "Your account can browse courses now, but enrollment stays locked until a trainer or admin verifies you.",
  verified: "Your account is verified, so you can browse courses and start enrolling right away.",
  rejected: "Your verification was rejected. Review your profile details before trying to enroll again.",
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
  const { updateUser } = useAuth();
  const [formData, setFormData] = useState<TraineeOnboardingFormData>(() => createInitialTraineeOnboardingFormData(user));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(createInitialTraineeOnboardingFormData(user));
    }
  }, [open, user]);

  const resolvedVerificationStatus = user.verificationStatus ?? "pending";
  const resolvedTraineeType = user.traineeType ? traineeTypeLabel[user.traineeType] : "Trainee";
  const suggestedSkillLevel = useMemo(() => getSuggestedOnboardingSkillLevel(formData), [formData]);
  const effectiveSkillLevel = formData.onboardingSkillLevel || suggestedSkillLevel;
  const signalCoverage = useMemo(() => getOnboardingSignalCoverage(formData), [formData]);

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
      }

      const summary = buildTraineeOnboardingSummary(formData, persistedRecommendations.length);
      onCompleted?.(summary);
      toast.success("Onboarding completed. Your recommendations are now ready.");
    } catch (error) {
      console.error("Failed to complete trainee onboarding:", error);
      toast.error("We could not save your onboarding answers. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !saving && onDismiss()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden border-primary/15 p-0">
        <div className="bg-[linear-gradient(135deg,rgba(15,118,110,0.12)_0%,rgba(29,78,216,0.12)_100%)] p-6 sm:p-8">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Dashboard onboarding
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {resolvedTraineeType}
              </Badge>
              <TraineeVerificationBadge status={resolvedVerificationStatus} />
            </div>
            <DialogTitle className="text-2xl tracking-[-0.03em] sm:text-3xl">
              Finish your onboarding profile
            </DialogTitle>
            <DialogDescription className="max-w-3xl text-sm leading-7 text-muted-foreground">
              Complete this short onboarding flow from the dashboard so PESO Academy can unlock recommendation prompts, starter pathways, and better cold-start guidance without bloating registration.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[calc(90vh-12rem)] space-y-6 overflow-y-auto p-6 pt-5 sm:p-8 sm:pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background p-4">
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-sm font-medium">Verification</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {verificationMessageByStatus[resolvedVerificationStatus]}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background p-4">
              <div className="flex items-center gap-2 text-primary">
                <UserRound className="h-4 w-4" />
                <p className="text-sm font-medium">Recommendation signal coverage</p>
              </div>
              <p className="mt-3 text-3xl font-semibold text-foreground">{signalCoverage}%</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Interests, category choices, starting level, and skills all improve your dashboard recommendations.
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background p-4">
              <div className="flex items-center gap-2 text-primary">
                <BookOpen className="h-4 w-4" />
                <p className="text-sm font-medium">Recommendation unlock</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                You can skip for now and resume later, but recommendation cards stay hidden until you complete this step.
              </p>
            </div>
          </div>

          <div className="space-y-5 rounded-2xl border border-border/70 bg-background p-5 sm:p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">Learning interests</h3>
                <Badge>Recommendation inputs</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Choose the industries and course categories you want the dashboard to prioritize.</p>
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
          </div>

          <div className="space-y-5 rounded-2xl border border-border/70 bg-background p-5 sm:p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">Quick readiness check</h3>
                <Badge variant="secondary">Used for cold-start recommendations</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Answer a few questions so the system can suggest a starting level before you build activity history.</p>
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
                (value) => setField("confidenceLevel", value as TraineeOnboardingFormData["confidenceLevel"]),
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
                (value) => setField("weeklyCommitment", value as TraineeOnboardingFormData["weeklyCommitment"]),
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
                (value) => setField("digitalComfort", value as TraineeOnboardingFormData["digitalComfort"]),
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
                    onValueChange={(value) => setField("onboardingSkillLevel", value as TraineeOnboardingFormData["onboardingSkillLevel"])}
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
                    onChange={(event) => setField("existingSkills", event.target.value)}
                    className="min-h-28 rounded-xl border-border/80 bg-muted/20 px-4 py-3"
                  />
                  <p className="text-xs text-muted-foreground">This helps the system avoid repeating topics you already know.</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-3 border-t px-6 py-4 sm:justify-between sm:px-8">
            <Button variant="ghost" onClick={onDismiss} disabled={saving}>
              Later
            </Button>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="outline" onClick={onDismiss} disabled={saving}>
                Save for later
              </Button>
              <Button onClick={() => void handleComplete()} disabled={saving}>
                {saving ? "Saving onboarding..." : "Complete onboarding"}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}