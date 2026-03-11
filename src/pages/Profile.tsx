import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Award,
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Clock3,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  MapPin,
  PencilLine,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  User,
} from "lucide-react";
import { enrollmentService, certificateService } from "@/services/supabaseDatabaseService";
import { supabaseAuthService } from "@/services/supabaseAuthService";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Certificate, Enrollment } from "@/types";
import { User as AuthUser } from "@/types/auth";
import { reportingService, type LearnerPerformanceSummary } from "@/services/reportingService";
import {
  ONBOARDING_CATEGORY_OPTIONS,
  ONBOARDING_INDUSTRY_OPTIONS,
  ONBOARDING_SKILL_LEVEL_OPTIONS,
} from "@/lib/onboarding";
import { recommendationSyncService } from "@/services/recommendationSyncService";
import { Link } from "react-router-dom";

const genderOptions: Array<{ value: NonNullable<AuthUser["gender"]>; label: string }> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "other", label: "Other" },
];

const civilStatusOptions: Array<{ value: NonNullable<AuthUser["civilStatus"]>; label: string }> = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Separated" },
  { value: "divorced", label: "Divorced" },
  { value: "annulled", label: "Annulled" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const employmentStatusOptions: Array<{ value: NonNullable<AuthUser["employmentStatus"]>; label: string }> = [
  { value: "employed", label: "Employed" },
  { value: "unemployed", label: "Unemployed" },
  { value: "self_employed", label: "Self-employed" },
  { value: "student", label: "Student" },
  { value: "underemployed", label: "Underemployed" },
  { value: "not_applicable", label: "Not applicable" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const prettifyValue = (value?: string) => {
  if (!value) return "Not provided";

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatDateValue = (value?: string) => {
  if (!value) return "Not provided";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsedDate);
};

const calculateAge = (dateOfBirth?: string) => {
  if (!dateOfBirth) return null;

  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age >= 0 ? age : null;
};

type InfoCardItem = {
  label: string;
  value: string;
  icon: typeof Mail;
};

const renderInfoGrid = (items: InfoCardItem[]) => {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div key={item.label} className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.16em]">{item.label}</p>
            </div>
            <p className="mt-3 text-sm font-medium leading-6">{item.value}</p>
          </div>
        );
      })}
    </div>
  );
};

const formatLearningTime = (minutes: number) => {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;

  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
};

const parseListInput = (value: string) => {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
};

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState<LearnerPerformanceSummary | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    dateOfBirth: "",
    gender: "" as AuthUser["gender"] | "",
    civilStatus: "" as AuthUser["civilStatus"] | "",
    employmentStatus: "" as AuthUser["employmentStatus"] | "",
    occupation: "",
    educationLevel: "",
    barangay: "",
    cityMunicipality: "",
    province: "",
    postalCode: "",
    industryInterests: [] as string[],
    preferredCategories: [] as string[],
    onboardingSkillLevel: "" as AuthUser["onboardingSkillLevel"] | "",
    skillsInput: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);

  const isLearner = user?.role === "trainee" || user?.role === "jobseeker";

  const loadProfileData = async () => {
    if (!user) return;

    setLoadingData(true);
    try {
      if (isLearner) {
        const [certs, enrolls, learnerPerformance] = await Promise.all([
          certificateService.getCertificates(user.id),
          enrollmentService.getEnrollments(user.id),
          reportingService.getLearnerPerformanceSummary(user.id),
        ]);
        setCertificates(certs);
        setEnrollments(enrolls);
        setPerformanceSummary(learnerPerformance);
      } else {
        setCertificates([]);
        setEnrollments([]);
        setPerformanceSummary(null);
      }
    } catch (error) {
      console.error("Error loading profile data:", error);
      toast.error("Failed to load profile data");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    setFormData({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      address: user.address || "",
      dateOfBirth: user.dateOfBirth || "",
      gender: user.gender || "",
      civilStatus: user.civilStatus || "",
      employmentStatus: user.employmentStatus || "",
      occupation: user.occupation || "",
      educationLevel: user.educationLevel || "",
      barangay: user.barangay || "",
      cityMunicipality: user.cityMunicipality || "",
      province: user.province || "",
      postalCode: user.postalCode || "",
      industryInterests: user.industryInterests || [],
      preferredCategories: user.preferredCategories || [],
      onboardingSkillLevel: user.onboardingSkillLevel || "",
      skillsInput: (user.skills || []).join(", "),
    });

    void loadProfileData();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      if (formData.dateOfBirth) {
        const birthDate = new Date(formData.dateOfBirth);
        if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
          toast.error("Date of birth must be a valid past date.");
          setLoading(false);
          return;
        }
      }

      const parsedSkills = parseListInput(formData.skillsInput);
      const nextUserProfile: AuthUser = {
        ...user,
        name: formData.name,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender || undefined,
        civilStatus: formData.civilStatus || undefined,
        employmentStatus: formData.employmentStatus || undefined,
        occupation: formData.occupation || undefined,
        educationLevel: formData.educationLevel || undefined,
        barangay: formData.barangay || undefined,
        cityMunicipality: formData.cityMunicipality || undefined,
        province: formData.province || undefined,
        postalCode: formData.postalCode || undefined,
        industryInterests: formData.industryInterests,
        preferredCategories: formData.preferredCategories,
        onboardingSkillLevel: formData.onboardingSkillLevel || undefined,
        skills: parsedSkills,
      };

      await updateUser({
        name: formData.name,
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
        onboardingSkillLevel: formData.onboardingSkillLevel || undefined,
        skills: parsedSkills,
      });

      if (isLearner) {
        try {
          await recommendationSyncService.refreshProfileDrivenRecommendations(nextUserProfile);
        } catch (recommendationError) {
          console.error("Error refreshing learner recommendations after profile update:", recommendationError);
          toast.warning("Profile saved, but recommendations will refresh the next time your dashboard loads.");
        }

        await loadProfileData();
      }

      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }

    setChangingPassword(true);
    try {
      if (supabase) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (signInError) {
          toast.error("Current password is incorrect");
          return;
        }
      }

      const { error } = await supabaseAuthService.updatePassword(newPassword);
      if (error) {
        toast.error(error.message || "Failed to update password");
        return;
      }

      toast.success("Password updated successfully");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      console.error("Change password error:", err);
      toast.error("Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) return null;

  const completedEnrollments = enrollments.filter((enrollment) => enrollment.status === "completed").length;
  const inProgressEnrollments = enrollments.filter((enrollment) => enrollment.status === "in-progress").length;
  const age = calculateAge(user.dateOfBirth);
  const completionRate = enrollments.length > 0 ? Math.round((completedEnrollments / enrollments.length) * 100) : 0;
  const averageAssessmentScore = performanceSummary?.averageAssessmentScore || 0;
  const completedModules = performanceSummary?.modulesCompleted || 0;
  const totalModules = performanceSummary?.totalModules || 0;
  const totalLearningMinutes = performanceSummary?.totalLearningMinutes || 0;
  const moduleCompletionRate = performanceSummary?.overallModuleCompletionRate || 0;
  const strongestTopic = performanceSummary?.strongestTopic?.topic || null;
  const needsImprovementTopic = performanceSummary?.needsImprovementTopic?.topic || null;
  const industryInterestCount = user.industryInterests?.length || 0;
  const preferredCategoryCount = user.preferredCategories?.length || 0;
  const profileSkillCount = user.skills?.length || 0;
  const recommendationProfileFields = [
    industryInterestCount > 0,
    preferredCategoryCount > 0,
    Boolean(user.onboardingSkillLevel),
    profileSkillCount > 0,
  ];
  const recommendationSignalCoverage = Math.round(
    (recommendationProfileFields.filter(Boolean).length / recommendationProfileFields.length) * 100,
  );
  const profileCompletionFields = [
    user.phone,
    user.address,
    user.dateOfBirth,
    user.gender,
    user.civilStatus,
    user.employmentStatus,
    user.occupation,
    user.educationLevel,
    user.barangay,
    user.cityMunicipality,
    user.province,
    user.postalCode,
    industryInterestCount > 0 ? "interests" : "",
    preferredCategoryCount > 0 ? "categories" : "",
    user.onboardingSkillLevel,
    profileSkillCount > 0 ? "skills" : "",
  ];
  const completedProfileFields = profileCompletionFields.filter(
    (field) => typeof field === "string" && field.trim().length > 0,
  ).length;
  const profileCompletion = Math.round((completedProfileFields / profileCompletionFields.length) * 100);
  const hasLearningHistory = Boolean(
    performanceSummary &&
      (performanceSummary.modulesCompleted > 0 ||
        performanceSummary.assessmentsTaken > 0 ||
        performanceSummary.totalLearningMinutes > 0 ||
        enrollments.length > 0),
  );
  const predictiveReadiness = Math.round(
    (profileCompletion + recommendationSignalCoverage + (hasLearningHistory ? 100 : 0)) / 3,
  );
  const profilePrimaryAction = profileCompletion < 100
    ? {
        title: "Complete the profile fields that drive recommendations",
        description: "Fill the missing identity, location, and preference fields so personalized suggestions and predictive insights stay grounded in current learner data.",
        href: "#profile-editor",
        label: isEditing ? "Continue editing" : "Edit profile",
      }
    : inProgressEnrollments > 0
      ? {
          title: "Return to your active learning path",
          description: "Your learner profile is already in good shape. The next high-value step is to continue an in-progress course or review progress detail.",
          href: "/dashboard",
          label: "Open dashboard",
        }
      : {
          title: "Use your finished profile to start training",
          description: "Your profile has the core signals needed for stronger recommendations. Enroll in a course to begin generating learning history.",
          href: "/courses",
          label: "Browse courses",
        };

  const toggleFormListValue = (field: "industryInterests" | "preferredCategories", value: string) => {
    setFormData((current) => {
      const existingValues = current[field];
      const nextValues = existingValues.includes(value)
        ? existingValues.filter((item) => item !== value)
        : [...existingValues, value];

      return {
        ...current,
        [field]: nextValues,
      };
    });
  };

  const identityItems: InfoCardItem[] = [
    { label: "Email", value: user.email, icon: Mail },
    { label: "Phone", value: user.phone || "Not provided", icon: Phone },
    { label: "Date of Birth", value: formatDateValue(user.dateOfBirth), icon: CalendarDays },
    { label: "Age", value: age !== null ? `${age} years old` : "Not provided", icon: BadgeCheck },
    { label: "Gender", value: prettifyValue(user.gender), icon: User },
    { label: "Civil Status", value: prettifyValue(user.civilStatus), icon: BadgeCheck },
  ];

  const workItems: InfoCardItem[] = [
    { label: "Employment Status", value: prettifyValue(user.employmentStatus), icon: BriefcaseBusiness },
    { label: "Occupation", value: user.occupation || "Not provided", icon: BriefcaseBusiness },
    { label: "Education Level", value: user.educationLevel || "Not provided", icon: GraduationCap },
  ];

  const locationItems: InfoCardItem[] = [
    { label: "Address", value: user.address || "Not provided", icon: MapPin },
    { label: "Barangay", value: user.barangay || "Not provided", icon: Building2 },
    { label: "City / Municipality", value: user.cityMunicipality || "Not provided", icon: Building2 },
    { label: "Province", value: user.province || "Not provided", icon: MapPin },
    { label: "Postal Code", value: user.postalCode || "Not provided", icon: MapPin },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                {prettifyValue(user.role)} profile
              </Badge>
              {isLearner && (
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {profileCompletion}% complete
                </Badge>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Maintain your learner information, keep your demographic details current, and review your training activity in one place.
              </p>
            </div>
          </div>
          {!isEditing && (
            <Button className="gap-2 self-start md:self-auto" onClick={() => setIsEditing(true)}>
              <PencilLine className="h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>

        {isLearner && (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card">
              <CardContent className="space-y-4 p-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Next profile action</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{profilePrimaryAction.title}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{profilePrimaryAction.description}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Profile completion</p>
                    <p className="mt-2 text-3xl font-semibold">{profileCompletion}%</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recommendation signals</p>
                    <p className="mt-2 text-3xl font-semibold">{recommendationSignalCoverage}%</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Predictive readiness</p>
                    <p className="mt-2 text-3xl font-semibold">{predictiveReadiness}%</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profilePrimaryAction.href.startsWith("#") ? (
                    <Button onClick={() => setIsEditing(true)}>{profilePrimaryAction.label}</Button>
                  ) : (
                    <Button asChild>
                      <Link to={profilePrimaryAction.href}>{profilePrimaryAction.label}</Link>
                    </Button>
                  )}
                  <Button asChild variant="outline">
                    <Link to={hasLearningHistory ? "/progress" : "/courses"}>
                      {hasLearningHistory ? "View progress" : "Browse courses"}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profile routing</CardTitle>
                <CardDescription>Use the profile page for data quality, then switch surfaces for learning or review.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-border/70 p-4">
                  <p className="font-medium">Edit here</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Identity details, location, interests, categories, skill level, and skills all belong on this page.</p>
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  <p className="font-medium">Learn from dashboard</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Use the dashboard when you want the fastest route back into a course or recommendation.</p>
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  <p className="font-medium">Review from progress</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Open the progress page for session history, completion trends, and course-by-course detail.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="space-y-6">
            <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card">
              <CardContent className="p-0">
                <div className="border-b border-border/60 px-6 py-5">
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/15 text-primary shadow-inner">
                        <User className="h-10 w-10" />
                      </div>
                      <div className="space-y-2">
                        <div>
                          <h2 className="text-2xl font-semibold tracking-tight">{user.name}</h2>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="rounded-full">{prettifyValue(user.role)}</Badge>
                          {user.cityMunicipality && (
                            <Badge variant="outline" className="rounded-full">
                              {user.cityMunicipality}
                            </Badge>
                          )}
                          {user.employmentStatus && (
                            <Badge variant="outline" className="rounded-full">
                              {prettifyValue(user.employmentStatus)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Age</p>
                        <p className="mt-2 text-lg font-semibold">{age !== null ? age : "--"}</p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                        <p className="mt-2 text-lg font-semibold">{prettifyValue(user.civilStatus)}</p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Location</p>
                        <p className="mt-2 text-lg font-semibold">{user.province || "--"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-6">
                  {isEditing ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="name">Full Name</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            disabled
                          />
                          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+63 912 345 6789"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="date-of-birth">Date of Birth</Label>
                          <Input
                            id="date-of-birth"
                            type="date"
                            value={formData.dateOfBirth}
                            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Textarea
                          id="address"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          placeholder="House number, street, subdivision"
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="gender">Gender</Label>
                          <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value as AuthUser["gender"] })}>
                            <SelectTrigger id="gender">
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
                          <Select value={formData.civilStatus} onValueChange={(value) => setFormData({ ...formData, civilStatus: value as AuthUser["civilStatus"] })}>
                            <SelectTrigger id="civil-status">
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
                          <Select
                            value={formData.employmentStatus}
                            onValueChange={(value) => setFormData({ ...formData, employmentStatus: value as AuthUser["employmentStatus"] })}
                          >
                            <SelectTrigger id="employment-status">
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

                        <div className="space-y-2 xl:col-span-2">
                          <Label htmlFor="occupation">Occupation</Label>
                          <Input
                            id="occupation"
                            value={formData.occupation}
                            onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                            placeholder="Current job or primary occupation"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="education-level">Education Level</Label>
                          <Input
                            id="education-level"
                            value={formData.educationLevel}
                            onChange={(e) => setFormData({ ...formData, educationLevel: e.target.value })}
                            placeholder="Highest level completed"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="barangay">Barangay</Label>
                          <Input
                            id="barangay"
                            value={formData.barangay}
                            onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="city-municipality">City / Municipality</Label>
                          <Input
                            id="city-municipality"
                            value={formData.cityMunicipality}
                            onChange={(e) => setFormData({ ...formData, cityMunicipality: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="province">Province</Label>
                          <Input
                            id="province"
                            value={formData.province}
                            onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="postal-code">Postal Code</Label>
                          <Input
                            id="postal-code"
                            value={formData.postalCode}
                            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                          />
                        </div>
                      </div>

                      {isLearner && (
                        <div className="space-y-5 rounded-3xl border border-border/60 bg-background/50 p-5">
                          <div>
                            <h3 className="text-lg font-semibold">Recommendation profile</h3>
                            <p className="text-sm text-muted-foreground">
                              These learner inputs feed personalized recommendations and predictive reporting.
                            </p>
                          </div>

                          <div className="space-y-3">
                            <Label>Industry interests</Label>
                            <div className="flex flex-wrap gap-2">
                              {ONBOARDING_INDUSTRY_OPTIONS.map((option) => {
                                const isSelected = formData.industryInterests.includes(option);
                                return (
                                  <Button
                                    key={option}
                                    type="button"
                                    variant={isSelected ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => toggleFormListValue("industryInterests", option)}
                                  >
                                    {option}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label>Preferred categories</Label>
                            <div className="flex flex-wrap gap-2">
                              {ONBOARDING_CATEGORY_OPTIONS.map((option) => {
                                const isSelected = formData.preferredCategories.includes(option);
                                return (
                                  <Button
                                    key={option}
                                    type="button"
                                    variant={isSelected ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => toggleFormListValue("preferredCategories", option)}
                                  >
                                    {option}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                            <div className="space-y-2">
                              <Label htmlFor="onboarding-skill-level">Current skill level</Label>
                              <Select
                                value={formData.onboardingSkillLevel}
                                onValueChange={(value) =>
                                  setFormData({
                                    ...formData,
                                    onboardingSkillLevel: value as AuthUser["onboardingSkillLevel"],
                                  })
                                }
                              >
                                <SelectTrigger id="onboarding-skill-level">
                                  <SelectValue placeholder="Select learning stage" />
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
                              <Label htmlFor="skills-input">Skills</Label>
                              <Textarea
                                id="skills-input"
                                value={formData.skillsInput}
                                onChange={(e) => setFormData({ ...formData, skillsInput: e.target.value })}
                                placeholder="Add skills separated by commas or line breaks"
                              />
                              <p className="text-xs text-muted-foreground">
                                Example: Communication, Spreadsheet basics, Customer service
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                        <Button className="gap-2" onClick={handleSave} disabled={loading}>
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              Save Changes
                            </>
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => setIsEditing(false)} disabled={loading}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            Identity
                          </Badge>
                        </div>
                        {renderInfoGrid(identityItems)}
                      </div>

                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            Education & Work
                          </Badge>
                        </div>
                        {renderInfoGrid(workItems)}
                      </div>

                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            Location
                          </Badge>
                        </div>
                        {renderInfoGrid(locationItems)}
                      </div>

                      {isLearner && (
                        <div>
                          <div className="mb-3 flex items-center gap-2">
                            <Badge variant="outline" className="rounded-full px-3 py-1">
                              Recommendation profile
                            </Badge>
                          </div>
                          <div className="space-y-3 rounded-2xl border border-border/60 bg-background/50 p-4">
                            <div className="flex flex-wrap gap-2">
                              {(user.industryInterests || []).map((interest) => (
                                <Badge key={interest} variant="secondary" className="rounded-full px-3 py-1">
                                  {interest}
                                </Badge>
                              ))}
                              {(user.preferredCategories || []).map((category) => (
                                <Badge key={category} variant="outline" className="rounded-full px-3 py-1">
                                  {category}
                                </Badge>
                              ))}
                              {(!user.industryInterests || user.industryInterests.length === 0) &&
                              (!user.preferredCategories || user.preferredCategories.length === 0) ? (
                                <p className="text-sm text-muted-foreground">
                                  Add interests and preferred categories to strengthen personalized recommendations.
                                </p>
                              ) : null}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Learning stage</p>
                                <p className="mt-2 text-lg font-semibold">
                                  {user.onboardingSkillLevel
                                    ? ONBOARDING_SKILL_LEVEL_OPTIONS.find((option) => option.value === user.onboardingSkillLevel)?.label || prettifyValue(user.onboardingSkillLevel)
                                    : "Not provided"}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Skills recorded</p>
                                <p className="mt-2 text-lg font-semibold">{profileSkillCount}</p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                  {profileSkillCount > 0 ? user.skills?.join(", ") : "No skills added yet"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Security
                </CardTitle>
                <CardDescription>Change your password and keep your account protected.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="grid gap-4 lg:grid-cols-[1fr_1.35fr_auto] lg:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      placeholder="Enter current password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="At least 6 characters"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm new password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Confirm new password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="gap-2" disabled={changingPassword}>
                    {changingPassword ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4" />
                        Change password
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Profile Health</CardTitle>
                <CardDescription>Track how complete and ready your learner record is.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Profile completion</span>
                    <span className="font-medium">{profileCompletion}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${profileCompletion}%` }} />
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Required coverage</p>
                    <p className="mt-2 text-lg font-semibold">
                      {completedProfileFields} of {profileCompletionFields.length} fields filled
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recommended action</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {profileCompletion < 100
                        ? "Complete missing demographic and location details to support trainee analytics and reporting."
                        : "Your trainee record is fully populated and ready for reporting use."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {isLearner && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Learner Profile Analytics
                  </CardTitle>
                  <CardDescription>
                    These profile signals now feed recommendation refreshes and downstream predictive reporting inputs.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <p className="text-sm text-muted-foreground">Recommendation signal coverage</p>
                      <p className="mt-3 text-3xl font-semibold">{recommendationSignalCoverage}%</p>
                      <p className="mt-2 text-xs text-muted-foreground">Interests, categories, stage, and skills populated</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <p className="text-sm text-muted-foreground">Predictive readiness</p>
                      <p className="mt-3 text-3xl font-semibold">{predictiveReadiness}%</p>
                      <p className="mt-2 text-xs text-muted-foreground">Blends profile completion, recommendation inputs, and learning history</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <p className="text-sm text-muted-foreground">Industry interests</p>
                      <p className="mt-3 text-3xl font-semibold">{industryInterestCount}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <p className="text-sm text-muted-foreground">Preferred categories</p>
                      <p className="mt-3 text-3xl font-semibold">{preferredCategoryCount}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Why this matters</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Updating your learner profile now triggers an explicit recommendation refresh, so changes to interests, category preferences, skill level, and skills are reflected in personalized course suggestions without waiting for the next learning event.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {isLearner && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Training Snapshot</CardTitle>
                  <CardDescription>Your learning activity and completion metrics.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingData ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="rounded-2xl border border-border/60 bg-background/60 p-4 space-y-3">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-8 w-20" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Enrolled Courses</p>
                            <BookOpen className="h-4 w-4 text-primary" />
                          </div>
                          <p className="mt-3 text-3xl font-semibold">{enrollments.length}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Certificates</p>
                            <Award className="h-4 w-4 text-amber-500" />
                          </div>
                          <p className="mt-3 text-3xl font-semibold">{certificates.length}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Completed</p>
                            <BadgeCheck className="h-4 w-4 text-emerald-500" />
                          </div>
                          <p className="mt-3 text-3xl font-semibold">{completedEnrollments}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">In Progress</p>
                            <GraduationCap className="h-4 w-4 text-sky-500" />
                          </div>
                          <p className="mt-3 text-3xl font-semibold">{inProgressEnrollments}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Average Assessment Score</p>
                            <Target className="h-4 w-4 text-primary" />
                          </div>
                          <p className="mt-3 text-3xl font-semibold">{averageAssessmentScore}%</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Total Learning Time</p>
                            <Clock3 className="h-4 w-4 text-primary" />
                          </div>
                          <p className="mt-3 text-3xl font-semibold">{formatLearningTime(totalLearningMinutes)}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Completed Modules</p>
                            <BookOpen className="h-4 w-4 text-primary" />
                          </div>
                          <p className="mt-3 text-3xl font-semibold">{completedModules}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Module Progress</p>
                            <TrendingUp className="h-4 w-4 text-primary" />
                          </div>
                          <p className="mt-3 text-3xl font-semibold">{moduleCompletionRate}%</p>
                          <p className="mt-2 text-xs text-muted-foreground">{completedModules} of {totalModules} modules completed</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Completion rate</span>
                          <span className="font-medium">{completionRate}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${completionRate}%` }} />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                          <p className="text-xs uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Strong Skill</p>
                          <p className="mt-2 text-lg font-semibold text-emerald-900 dark:text-emerald-100">{strongestTopic || "Build more history"}</p>
                          <p className="mt-2 text-sm leading-6 text-emerald-800/80 dark:text-emerald-200/80">
                            {strongestTopic
                              ? "Your recommendation signals currently treat this as a strength to extend with higher-fit follow-on courses."
                              : "Complete more scored work to identify a reliable strength signal."}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                          <p className="text-xs uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Needs Improvement</p>
                          <p className="mt-2 text-lg font-semibold text-amber-900 dark:text-amber-100">{needsImprovementTopic || "No focus area yet"}</p>
                          <p className="mt-2 text-sm leading-6 text-amber-800/80 dark:text-amber-200/80">
                            {needsImprovementTopic
                              ? "This focus area now feeds remedial course suggestions and progress tracking across your learner profile."
                              : "Finish more than one scored topic to surface a consistent improvement target."}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Account Summary</CardTitle>
                <CardDescription>Quick details tied to your current learner account.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                  <Mail className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Primary email</p>
                    <p className="mt-1 text-sm font-medium">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                  <Phone className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Contact number</p>
                    <p className="mt-1 text-sm font-medium">{user.phone || "Not provided"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                  <MapPin className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Primary location</p>
                    <p className="mt-1 text-sm font-medium">{user.cityMunicipality || user.province || "Not provided"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
