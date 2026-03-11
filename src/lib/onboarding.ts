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