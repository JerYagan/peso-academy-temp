export const ONBOARDING_INDUSTRY_OPTIONS = [
  "Digital Services",
  "Office Administration",
  "Customer Service",
  "Retail and Sales",
  "Entrepreneurship",
  "Hospitality and Tourism",
  "Construction and Trades",
  "Creative and Design",
] as const;

import { TAXONOMY_COURSE_CATEGORIES } from "@/lib/taxonomy";

export const ONBOARDING_CATEGORY_OPTIONS = TAXONOMY_COURSE_CATEGORIES;

export const ONBOARDING_SKILL_LEVEL_OPTIONS = [
  { value: "exploring", label: "Exploring options" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

export const CURATED_STARTER_CATEGORIES = [
  "digital skills",
  "employability skills",
  "technical skills",
] as const;

export type OnboardingIndustryInterest = (typeof ONBOARDING_INDUSTRY_OPTIONS)[number];
export type OnboardingCategoryPreference = (typeof ONBOARDING_CATEGORY_OPTIONS)[number];
export type OnboardingSkillLevel = (typeof ONBOARDING_SKILL_LEVEL_OPTIONS)[number]["value"];

export const TRAINEE_ONBOARDING_MODAL_PENDING_KEY = "peso-trainee-onboarding-modal-pending";
export const TRAINEE_ONBOARDING_DRAFT_KEY = "peso-trainee-onboarding-draft";
export const TRAINEE_ONBOARDING_STEP_KEY = "peso-trainee-onboarding-step";

export type TraineeOnboardingFormData = {
  industryInterests: string[];
  preferredCategories: string[];
  onboardingSkillLevel: OnboardingSkillLevel | "";
  existingSkills: string;
  confidenceLevel: "needs_guidance" | "some_exposure" | "ready_for_projects" | "";
  weeklyCommitment: "under_2" | "2_to_4" | "5_plus" | "";
  digitalComfort: "needs_support" | "comfortable" | "advanced_tools" | "";
};

export type TraineeOnboardingSummary = {
  generatedRecommendationCount: number;
  onboardingSkillLevel: OnboardingSkillLevel | null;
  onboardingConfidenceLevel: TraineeOnboardingFormData["confidenceLevel"] | null;
  onboardingWeeklyCommitment: TraineeOnboardingFormData["weeklyCommitment"] | null;
  onboardingDigitalComfort: TraineeOnboardingFormData["digitalComfort"] | null;
  industryInterestCount: number;
  preferredCategoryCount: number;
  hasExistingSkills: boolean;
};

export const createInitialTraineeOnboardingFormData = (user?: {
  industryInterests?: string[];
  preferredCategories?: string[];
  onboardingSkillLevel?: OnboardingSkillLevel;
  onboardingConfidenceLevel?: TraineeOnboardingFormData["confidenceLevel"];
  onboardingWeeklyCommitment?: TraineeOnboardingFormData["weeklyCommitment"];
  onboardingDigitalComfort?: TraineeOnboardingFormData["digitalComfort"];
  skills?: string[];
}): TraineeOnboardingFormData => ({
  industryInterests: user?.industryInterests || [],
  preferredCategories: user?.preferredCategories || [],
  onboardingSkillLevel: user?.onboardingSkillLevel || "",
  existingSkills: (user?.skills || []).join(", "),
  confidenceLevel: user?.onboardingConfidenceLevel || "",
  weeklyCommitment: user?.onboardingWeeklyCommitment || "",
  digitalComfort: user?.onboardingDigitalComfort || "",
});

export const parseOnboardingSkillsInput = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

export const getSuggestedOnboardingSkillLevel = (
  formData: TraineeOnboardingFormData,
): OnboardingSkillLevel | "" => {
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

export const getOnboardingSignalCoverage = (formData: TraineeOnboardingFormData) => {
  const suggestedSkillLevel = getSuggestedOnboardingSkillLevel(formData);
  const effectiveSkillLevel = formData.onboardingSkillLevel || suggestedSkillLevel;

  return Math.round(
    ([
      Boolean(effectiveSkillLevel),
      formData.industryInterests.length > 0,
      formData.preferredCategories.length > 0,
      parseOnboardingSkillsInput(formData.existingSkills).length > 0,
    ].filter(Boolean).length / 4) * 100,
  );
};

export const buildTraineeOnboardingSummary = (
  formData: TraineeOnboardingFormData,
  generatedRecommendationCount: number,
): TraineeOnboardingSummary => {
  const suggestedSkillLevel = getSuggestedOnboardingSkillLevel(formData);
  const normalizedSkills = parseOnboardingSkillsInput(formData.existingSkills);

  return {
    generatedRecommendationCount,
    onboardingSkillLevel: (formData.onboardingSkillLevel || suggestedSkillLevel || null) as OnboardingSkillLevel | null,
    onboardingConfidenceLevel: formData.confidenceLevel || null,
    onboardingWeeklyCommitment: formData.weeklyCommitment || null,
    onboardingDigitalComfort: formData.digitalComfort || null,
    industryInterestCount: formData.industryInterests.length,
    preferredCategoryCount: formData.preferredCategories.length,
    hasExistingSkills: normalizedSkills.length > 0,
  };
};