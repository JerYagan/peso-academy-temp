export type UserRole = "admin" | "trainer" | "trainee";

export type TraineeType = "peso_client" | "peso_employee";

export type VerificationStatus = "pending" | "verified" | "rejected";

export type AppLanguage = "en" | "tl";

export type AppThemePreference = "system" | "light" | "dark";

export const USER_ROLES: UserRole[] = [
  "admin",
  "trainer",
  "trainee",
];

const ROLE_ALIASES: Record<string, UserRole> = {
  "training officer": "trainer",
  training_officer: "trainer",
  trainingofficer: "trainer",
  spd: "trainer",
  validator: "admin",
  learner: "trainee",
  student: "trainee",
  "job seeker": "trainee",
  jobseeker: "trainee",
  employer: "trainee",
};

export function normalizeUserRole(rawRole: unknown): UserRole {
  if (typeof rawRole !== "string") {
    return "trainee";
  }

  const normalizedRole = rawRole.toLowerCase().trim();

  if (USER_ROLES.includes(normalizedRole as UserRole)) {
    return normalizedRole as UserRole;
  }

  return ROLE_ALIASES[normalizedRole] ?? "trainee";
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  traineeType?: TraineeType;
  verificationStatus?: VerificationStatus;
  employeeId?: string;
  physicalId?: string;
  verificationSubmittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verificationNotes?: string;
  avatar?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "non_binary" | "prefer_not_to_say" | "other";
  civilStatus?: "single" | "married" | "widowed" | "separated" | "divorced" | "annulled" | "prefer_not_to_say";
  employmentStatus?: "employed" | "unemployed" | "self_employed" | "student" | "underemployed" | "not_applicable" | "prefer_not_to_say";
  occupation?: string;
  educationLevel?: string;
  barangay?: string;
  cityMunicipality?: string;
  province?: string;
  postalCode?: string;
  industryInterests?: string[];
  preferredCategories?: string[];
  onboardingSkillLevel?: "exploring" | "beginner" | "intermediate" | "advanced";
  onboardingConfidenceLevel?: "needs_guidance" | "some_exposure" | "ready_for_projects";
  onboardingWeeklyCommitment?: "under_2" | "2_to_4" | "5_plus";
  onboardingDigitalComfort?: "needs_support" | "comfortable" | "advanced_tools";
  onboardingCompletedAt?: string;
  onboardingModalSeenAt?: string;
  skills?: string[];
  languagePreference?: AppLanguage;
  themePreference?: AppThemePreference;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

