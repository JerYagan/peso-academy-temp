import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
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
  Mail,
  MapPin,
  PencilLine,
  Phone,
  Save,
  ShieldCheck,
  Target,
  TrendingUp,
  User,
} from "lucide-react";
import { enrollmentService, certificateService } from "@/services/supabaseDatabaseService";
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
import {
  PROFILE_FIELD_LIMITS,
  normalizePhoneNumber,
  normalizePostalCode,
  sanitizeAddressInput,
  sanitizeDigitsOnlyInput,
  sanitizeGeneralTextInput,
  sanitizeNameInput,
  validateHumanName,
  validateMaxLength,
  validatePhoneNumber,
  validatePostalCode,
} from "@/lib/profileFieldValidation";
import { uploadTraineePhysicalIdDocument, validatePhysicalIdFile } from "@/lib/traineeVerificationDocuments";

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
  const { language } = useLocale();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState<LearnerPerformanceSummary | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [verificationDocumentFile, setVerificationDocumentFile] = useState<File | null>(null);
  const [uploadingVerificationDocument, setUploadingVerificationDocument] = useState(false);
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
  const copy = language === "tl"
    ? {
        recommendationProfile: "Recommendation profile",
        recommendationProfileBody: "Ang learner inputs na ito ang nagpapakain sa personalized recommendations at mas relevant na learning guidance.",
        industryInterests: "Industry interests",
        preferredCategories: "Preferred categories",
        currentSkillLevel: "Current skill level",
        selectLearningStage: "Piliin ang learning stage",
        skills: "Skills",
        skillsPlaceholder: "Magdagdag ng skills na pinaghihiwalay ng kuwit o bagong linya",
        skillsHelp: "Halimbawa: Communication, Spreadsheet basics, Customer service",
        saving: "Sine-save...",
        saveChanges: "I-save ang mga Binago",
        cancel: "Kanselahin",
        identity: "Identity",
        educationAndWork: "Education at Work",
        location: "Lokasyon",
        addSignals: "Magdagdag ng interests at preferred categories para mas tumibay ang personalized recommendations.",
        notProvided: "Walang ibinigay",
        skillsRecorded: "Naitalang skills",
        noSkillsYet: "Wala pang naidagdag na skills",
        security: "Security",
        securityBody: "Palitan ang iyong password at panatilihing protektado ang iyong account.",
        currentPassword: "Kasalukuyang password",
        currentPasswordPlaceholder: "Ilagay ang kasalukuyang password",
        newPassword: "Bagong password",
        newPasswordPlaceholder: "Hindi bababa sa 6 na character",
        confirmPassword: "Kumpirmahin ang bagong password",
        confirmPasswordPlaceholder: "Kumpirmahin ang bagong password",
        updating: "Ina-update...",
        changePassword: "Palitan ang password",
        profileHealth: "Profile Health",
        profileHealthBody: "Subaybayan kung gaano kakumpleto at kahanda ang iyong learner record.",
        profileCompletion: "Pagkakumpleto ng profile",
        requiredCoverage: "Required coverage",
        recommendedAction: "Inirerekomendang aksyon",
        recommendedActionIncomplete: "Kumpletuhin ang kulang na demographic at location details para mas tumpak ang learner recommendations at progress guidance.",
        recommendedActionComplete: "Kumpleto na ang iyong learner record at handa na para sa recommendations at progress review.",
        learnerAnalytics: "Learner Profile Analytics",
        learnerAnalyticsBody: "Ang profile signals na ito ay ginagamit na ngayon sa recommendation refreshes at downstream predictive reporting inputs.",
        recommendationSignalCoverage: "Recommendation signal coverage",
        predictiveReadiness: "Predictive readiness",
        predictiveReadinessBody: "Pinaghahalo ang profile completion, recommendation inputs, at learning history",
        recommendationCoverageBody: "May laman na interests, categories, stage, at skills",
        whyThisMatters: "Bakit ito mahalaga",
        whyThisMattersBody: "Ang pag-update sa learner profile mo ay nagti-trigger na ngayon ng explicit recommendation refresh, kaya ang mga pagbabago sa interests, category preferences, skill level, at skills ay agad na naipapakita sa personalized course suggestions.",
        trainingSnapshot: "Training Snapshot",
        trainingSnapshotBody: "Ang iyong learning activity at completion metrics.",
        enrolledCourses: "Mga Enrolled na Kurso",
        certificates: "Certificates",
        completed: "Natapos",
        inProgress: "Kasalukuyang Ginagawa",
        averageAssessmentScore: "Average Assessment Score",
        totalLearningTime: "Kabuuang Oras ng Pag-aaral",
        completedModules: "Completed Modules",
        moduleProgress: "Module Progress",
        completionRate: "Completion rate",
        pageTitle: "Profile",
        pageSubtitle: "Pamahalaan ang iyong learner information, panatilihing updated ang demographic details, at suriin ang iyong training activity sa iisang lugar.",
        editProfile: "I-edit ang Profile",
          browseCourses: "Mag-browse ng Courses",
          viewProgress: "Tingnan ang Progress",
        nextProfileAction: "Susunod na aksyon sa profile",
        profileLabel: "Profile",
        signalsLabel: "Signals",
        readinessLabel: "Readiness",
        fullName: "Buong Pangalan",
        emailLabel: "Email",
        emailCannotChange: "Hindi mababago ang email",
        phoneLabel: "Phone",
        dateOfBirthLabel: "Petsa ng Kapanganakan",
        addressLabel: "Address",
        addressPlaceholder: "House number, street, subdivision",
        genderLabel: "Kasarian",
        selectGender: "Piliin ang kasarian",
        civilStatusLabel: "Katayuang Sibil",
        selectCivilStatus: "Piliin ang katayuang sibil",
        employmentStatusLabel: "Katayuan sa Trabaho",
        selectEmploymentStatus: "Piliin ang katayuan sa trabaho",
        occupationLabel: "Trabaho",
        occupationPlaceholder: "Kasalukuyang trabaho o pangunahing hanapbuhay",
        educationLevelLabel: "Antas ng Edukasyon",
        educationLevelPlaceholder: "Pinakamataas na natapos na antas",
        barangayLabel: "Barangay",
        cityMunicipalityLabel: "Lungsod / Munisipalidad",
        provinceLabel: "Probinsya",
        postalCodeLabel: "Postal Code",
        verificationDocumentTitle: "Verification document",
        verificationDocumentBody: "I-upload o palitan dito ang iyong PESO employee ID image kung kailangan pa ng supporting document ang verification ng account mo.",
        verificationStatusLabel: "Verification status",
        verificationDocumentOnFile: "May dokumentong naka-file",
        verificationDocumentMissing: "Walang dokumento",
        verificationDocumentReady: "May employee verification document ka nang naka-file. Mag-upload lamang ng kapalit kung humingi ang staff ng mas malinaw na kopya.",
        verificationDocumentPrompt: "Kung nakapag-register ka bago ma-upload ang employee ID mo, isumite ito rito para makumpleto ng staff ang verification ng account mo.",
        verificationRejectedBody: "Na-reject ang dati mong verification submission. Mag-upload ng kapalit na larawan at tingnan ang notes sa ibaba.",
        verificationDocumentInput: "Larawan ng employee ID",
        verificationDocumentHelp: "Mag-upload ng malinaw na JPG, PNG, o WebP image hanggang 5 MB.",
        verificationUploading: "Ina-upload...",
        verificationUploadAction: "I-upload ang dokumento",
        verificationUploadSuccess: "Na-upload ang verification document. Ibinalik ang account mo sa pending review.",
        verificationUploadError: "Hindi namin ma-upload ang verification document mo. Pakisubukang muli.",
      }
    : {
        recommendationProfile: "Recommendation profile",
        recommendationProfileBody: "These learner inputs feed personalized recommendations and more relevant learning guidance.",
        industryInterests: "Industry interests",
        preferredCategories: "Preferred categories",
        currentSkillLevel: "Current skill level",
        selectLearningStage: "Select learning stage",
        skills: "Skills",
        skillsPlaceholder: "Add skills separated by commas or line breaks",
        skillsHelp: "Example: Communication, Spreadsheet basics, Customer service",
        saving: "Saving...",
        saveChanges: "Save Changes",
        cancel: "Cancel",
        identity: "Identity",
        educationAndWork: "Education & Work",
        location: "Location",
        addSignals: "Add interests and preferred categories to strengthen personalized recommendations.",
        notProvided: "Not provided",
        skillsRecorded: "Skills recorded",
        noSkillsYet: "No skills added yet",
        security: "Security",
        securityBody: "Change your password and keep your account protected.",
        currentPassword: "Current password",
        currentPasswordPlaceholder: "Enter current password",
        newPassword: "New password",
        newPasswordPlaceholder: "At least 6 characters",
        confirmPassword: "Confirm new password",
        confirmPasswordPlaceholder: "Confirm new password",
        updating: "Updating...",
        changePassword: "Change password",
        profileHealth: "Profile Health",
        profileHealthBody: "Track how complete and ready your learner record is.",
        profileCompletion: "Profile completion",
        requiredCoverage: "Required coverage",
        recommendedAction: "Recommended action",
        recommendedActionIncomplete: "Complete missing demographic and location details so learner recommendations and progress guidance stay accurate.",
        recommendedActionComplete: "Your learner record is fully populated and ready for recommendations and progress review.",
        learnerAnalytics: "Learner Profile Analytics",
        learnerAnalyticsBody: "These profile signals now feed recommendation refreshes and downstream predictive reporting inputs.",
        recommendationSignalCoverage: "Recommendation signal coverage",
        predictiveReadiness: "Predictive readiness",
        predictiveReadinessBody: "Blends profile completion, recommendation inputs, and learning history",
        recommendationCoverageBody: "Interests, categories, stage, and skills populated",
        whyThisMatters: "Why this matters",
        whyThisMattersBody: "Updating your learner profile now triggers an explicit recommendation refresh, so changes to interests, category preferences, skill level, and skills are reflected in personalized course suggestions without waiting for the next learning event.",
        trainingSnapshot: "Training Snapshot",
        trainingSnapshotBody: "Your learning activity and completion metrics.",
        enrolledCourses: "Enrolled Courses",
        certificates: "Certificates",
        completed: "Completed",
        inProgress: "In Progress",
        averageAssessmentScore: "Average Assessment Score",
        totalLearningTime: "Total Learning Time",
        completedModules: "Completed Modules",
        moduleProgress: "Module Progress",
        completionRate: "Completion rate",
        pageTitle: "Profile",
        pageSubtitle: "Maintain your learner information, keep your demographic details current, and review your training activity in one place.",
        editProfile: "Edit Profile",
          browseCourses: "Browse Courses",
          viewProgress: "View Progress",
        nextProfileAction: "Next profile action",
        profileLabel: "Profile",
        signalsLabel: "Signals",
        readinessLabel: "Readiness",
        fullName: "Full Name",
        emailLabel: "Email",
        emailCannotChange: "Email cannot be changed",
        phoneLabel: "Phone",
        dateOfBirthLabel: "Date of Birth",
        addressLabel: "Address",
        addressPlaceholder: "House number, street, subdivision",
        genderLabel: "Gender",
        selectGender: "Select gender",
        civilStatusLabel: "Civil Status",
        selectCivilStatus: "Select civil status",
        employmentStatusLabel: "Employment Status",
        selectEmploymentStatus: "Select employment status",
        occupationLabel: "Occupation",
        occupationPlaceholder: "Current job or primary occupation",
        educationLevelLabel: "Education Level",
        educationLevelPlaceholder: "Highest level completed",
        barangayLabel: "Barangay",
        cityMunicipalityLabel: "City / Municipality",
        provinceLabel: "Province",
        postalCodeLabel: "Postal Code",
        verificationDocumentTitle: "Verification document",
        verificationDocumentBody: "Upload or replace your PESO employee ID image here if account verification still needs supporting documents.",
        verificationStatusLabel: "Verification status",
        verificationDocumentOnFile: "Document on file",
        verificationDocumentMissing: "Document missing",
        verificationDocumentReady: "Your employee verification document is already on file. Upload a replacement only if staff asked for a clearer copy.",
        verificationDocumentPrompt: "If you registered before uploading your employee ID, submit it here so staff can finish verifying your account.",
        verificationRejectedBody: "Your previous verification submission was rejected. Upload a replacement image and review the notes below.",
        verificationDocumentInput: "Employee ID image",
        verificationDocumentHelp: "Upload a clear JPG, PNG, or WebP image up to 5 MB.",
        verificationUploading: "Uploading...",
        verificationUploadAction: "Upload document",
        verificationUploadSuccess: "Verification document uploaded. Your account has been returned to pending review.",
        verificationUploadError: "We could not upload your verification document. Please try again.",
      };

  const updateFormField = <K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) => {
    const nextValue = typeof value === "string"
      ? (() => {
          if (field === "name") return sanitizeNameInput(value);
          if (field === "phone" || field === "postalCode") return sanitizeDigitsOnlyInput(value);
          if (field === "address") return sanitizeAddressInput(value);
          if (field === "occupation" || field === "educationLevel" || field === "barangay" || field === "cityMunicipality" || field === "province") {
            return sanitizeGeneralTextInput(value);
          }

          return value;
        })()
      : value;

    setFormData((current) => ({ ...current, [field]: nextValue }));
  };

  const isLearner = user?.role === "trainee";
  const isEmployeeLearner = isLearner && user?.traineeType === "peso_employee";
  const hasUploadedVerificationDocument = Boolean(user?.physicalId && user.physicalId.includes("/"));

  useEffect(() => {
    if (!isEmployeeLearner) {
      setVerificationDocumentFile(null);
    }
  }, [isEmployeeLearner]);

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
      const nameValidationError = validateHumanName(formData.name);
      if (nameValidationError) {
        toast.error(nameValidationError);
        setLoading(false);
        return;
      }

      const normalizedPhone = normalizePhoneNumber(formData.phone);
      const normalizedPostalCode = normalizePostalCode(formData.postalCode);

      const nameLengthError = validateMaxLength("Name", formData.name, PROFILE_FIELD_LIMITS.name);
      if (nameLengthError) {
        toast.error(nameLengthError);
        setLoading(false);
        return;
      }

      const addressLengthError = validateMaxLength("Address", formData.address, PROFILE_FIELD_LIMITS.address);
      if (addressLengthError) {
        toast.error(addressLengthError);
        setLoading(false);
        return;
      }

      const occupationLengthError = validateMaxLength("Occupation", formData.occupation, PROFILE_FIELD_LIMITS.occupation);
      if (occupationLengthError) {
        toast.error(occupationLengthError);
        setLoading(false);
        return;
      }

      const educationLengthError = validateMaxLength("Education level", formData.educationLevel, PROFILE_FIELD_LIMITS.educationLevel);
      if (educationLengthError) {
        toast.error(educationLengthError);
        setLoading(false);
        return;
      }

      for (const [label, value] of [["Barangay", formData.barangay], ["City/Municipality", formData.cityMunicipality], ["Province", formData.province]] as const) {
        const locationLengthError = validateMaxLength(label, value, PROFILE_FIELD_LIMITS.location);
        if (locationLengthError) {
          toast.error(locationLengthError);
          setLoading(false);
          return;
        }
      }

      const phoneFormatError = validatePhoneNumber(formData.phone);
      if (phoneFormatError) {
        toast.error(phoneFormatError);
        setLoading(false);
        return;
      }

      const postalCodeValidationError = validatePostalCode(formData.postalCode);
      if (postalCodeValidationError) {
        toast.error(postalCodeValidationError);
        setLoading(false);
        return;
      }

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
        phone: normalizedPhone || undefined,
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
        postalCode: normalizedPostalCode || undefined,
        industryInterests: formData.industryInterests,
        preferredCategories: formData.preferredCategories,
        onboardingSkillLevel: formData.onboardingSkillLevel || undefined,
        skills: parsedSkills,
      };

      await updateUser({
        name: formData.name,
        phone: normalizedPhone,
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
        postalCode: normalizedPostalCode,
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

  const handleVerificationDocumentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;

    if (!nextFile) {
      setVerificationDocumentFile(null);
      return;
    }

    const validationError = validatePhysicalIdFile(nextFile);
    if (validationError) {
      toast.error(validationError);
      setVerificationDocumentFile(null);
      event.target.value = "";
      return;
    }

    setVerificationDocumentFile(nextFile);
  };

  const handleVerificationDocumentUpload = async () => {
    if (!user || !verificationDocumentFile) {
      return;
    }

    setUploadingVerificationDocument(true);
    try {
      const verificationSubmittedAt = new Date().toISOString();
      const uploadedPath = await uploadTraineePhysicalIdDocument(user.id, verificationDocumentFile);

      await updateUser({
        physicalId: uploadedPath,
        verificationSubmittedAt,
        verificationStatus: "pending",
      });

      setVerificationDocumentFile(null);
      toast.success(copy.verificationUploadSuccess);
    } catch (error) {
      console.error("Error uploading verification document:", error);
      toast.error(error instanceof Error ? error.message : copy.verificationUploadError);
    } finally {
      setUploadingVerificationDocument(false);
    }
  };

  if (!user) return null;

  const completedEnrollments = enrollments.filter((enrollment) => enrollment.status === "completed").length;
  const inProgressEnrollments = enrollments.filter((enrollment) => enrollment.status === "in-progress").length;
  const age = calculateAge(user.dateOfBirth);
  const completionRate = enrollments.length > 0 ? Math.round((completedEnrollments / enrollments.length) * 100) : 0;
  const totalLearningMinutes = performanceSummary?.totalLearningMinutes || 0;
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
        title: language === "tl" ? "Kumpletuhin ang mga profile field na nagpapagana sa recommendations" : "Complete the profile fields that drive recommendations",
        description: language === "tl"
          ? "Punan ang kulang na identity, location, at preference fields para manatiling nakabatay sa kasalukuyang learner data ang personalized suggestions at progress guidance."
          : "Fill the missing identity, location, and preference fields so personalized suggestions and progress guidance stay grounded in current learner data.",
        href: "#profile-editor",
        label: isEditing ? (language === "tl" ? "Ipagpatuloy ang pag-edit" : "Continue editing") : copy.editProfile,
      }
    : inProgressEnrollments > 0
      ? {
          title: language === "tl" ? "Bumalik sa iyong aktibong learning path" : "Return to your active learning path",
          description: language === "tl"
            ? "Maayos na ang learner profile mo. Ang susunod na high-value step ay ipagpatuloy ang kasalukuyang kurso o suriin ang detalye ng progreso."
            : "Your learner profile is already in good shape. The next high-value step is to continue an in-progress course or review progress detail.",
          href: "/dashboard",
          label: language === "tl" ? "Buksan ang dashboard" : "Open dashboard",
        }
      : {
          title: language === "tl" ? "Gamitin ang kumpletong profile mo para magsimulang mag-training" : "Use your finished profile to start training",
          description: language === "tl"
            ? "Mayroon na sa profile mo ang pangunahing signals na kailangan para sa mas matibay na recommendations. Mag-enroll sa kurso para makapagsimulang bumuo ng learning history."
            : "Your profile has the core signals needed for stronger recommendations. Enroll in a course to begin generating learning history.",
          href: "/courses",
          label: copy.browseCourses,
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
              <h1 className="text-3xl font-semibold tracking-tight">{copy.pageTitle}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {copy.pageSubtitle}
              </p>
            </div>
          </div>
          {!isEditing && (
            <Button className="gap-2 self-start md:self-auto" onClick={() => setIsEditing(true)}>
              <PencilLine className="h-4 w-4" />
              {copy.editProfile}
            </Button>
          )}
        </div>

        {isLearner && profileCompletion < 100 ? (
          <Card className="border-primary/15 bg-card">
            <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="max-w-2xl">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{copy.nextProfileAction}</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">{profilePrimaryAction.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{profilePrimaryAction.description}</p>
              </div>

              <div className="flex w-full flex-col gap-4 sm:w-auto sm:min-w-[320px]">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-3.5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{copy.profileLabel}</p>
                    <p className="mt-1.5 text-2xl font-semibold">{profileCompletion}%</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-3.5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{copy.signalsLabel}</p>
                    <p className="mt-1.5 text-2xl font-semibold">{recommendationSignalCoverage}%</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-3.5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{copy.readinessLabel}</p>
                    <p className="mt-1.5 text-2xl font-semibold">{predictiveReadiness}%</p>
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
                      {hasLearningHistory ? copy.viewProgress : copy.browseCourses}
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="space-y-6">
            <Card className="overflow-hidden border-primary/15 bg-card">
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
                          <Label htmlFor="name">{copy.fullName}</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => updateFormField("name", e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email">{copy.emailLabel}</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => updateFormField("email", e.target.value)}
                            disabled
                          />
                          <p className="text-xs text-muted-foreground">{copy.emailCannotChange}</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="phone">{copy.phoneLabel}</Label>
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => updateFormField("phone", e.target.value)}
                            placeholder="+63 912 345 6789"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="date-of-birth">{copy.dateOfBirthLabel}</Label>
                          <Input
                            id="date-of-birth"
                            type="date"
                            value={formData.dateOfBirth}
                            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="address">{copy.addressLabel}</Label>
                        <Textarea
                          id="address"
                          value={formData.address}
                          onChange={(e) => updateFormField("address", e.target.value)}
                          placeholder={copy.addressPlaceholder}
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="gender">{copy.genderLabel}</Label>
                          <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value as AuthUser["gender"] })}>
                            <SelectTrigger id="gender">
                              <SelectValue placeholder={copy.selectGender} />
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
                          <Label htmlFor="civil-status">{copy.civilStatusLabel}</Label>
                          <Select value={formData.civilStatus} onValueChange={(value) => setFormData({ ...formData, civilStatus: value as AuthUser["civilStatus"] })}>
                            <SelectTrigger id="civil-status">
                              <SelectValue placeholder={copy.selectCivilStatus} />
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
                          <Label htmlFor="employment-status">{copy.employmentStatusLabel}</Label>
                          <Select
                            value={formData.employmentStatus}
                            onValueChange={(value) => setFormData({ ...formData, employmentStatus: value as AuthUser["employmentStatus"] })}
                          >
                            <SelectTrigger id="employment-status">
                              <SelectValue placeholder={copy.selectEmploymentStatus} />
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
                          <Label htmlFor="occupation">{copy.occupationLabel}</Label>
                          <Input
                            id="occupation"
                            value={formData.occupation}
                            onChange={(e) => updateFormField("occupation", e.target.value)}
                            placeholder={copy.occupationPlaceholder}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="education-level">{copy.educationLevelLabel}</Label>
                          <Input
                            id="education-level"
                            value={formData.educationLevel}
                            onChange={(e) => updateFormField("educationLevel", e.target.value)}
                            placeholder={copy.educationLevelPlaceholder}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="barangay">{copy.barangayLabel}</Label>
                          <Input
                            id="barangay"
                            value={formData.barangay}
                            onChange={(e) => updateFormField("barangay", e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="city-municipality">{copy.cityMunicipalityLabel}</Label>
                          <Input
                            id="city-municipality"
                            value={formData.cityMunicipality}
                            onChange={(e) => updateFormField("cityMunicipality", e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="province">{copy.provinceLabel}</Label>
                          <Input
                            id="province"
                            value={formData.province}
                            onChange={(e) => updateFormField("province", e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="postal-code">{copy.postalCodeLabel}</Label>
                          <Input
                            id="postal-code"
                            value={formData.postalCode}
                            onChange={(e) => updateFormField("postalCode", e.target.value)}
                          />
                        </div>
                      </div>

                      {isLearner && (
                        <div className="space-y-5 rounded-3xl border border-border/60 bg-background/50 p-5">
                          <div>
                            <h3 className="text-lg font-semibold">{copy.recommendationProfile}</h3>
                            <p className="text-sm text-muted-foreground">
                              {copy.recommendationProfileBody}
                            </p>
                          </div>

                          <div className="space-y-3">
                            <Label>{copy.industryInterests}</Label>
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
                            <Label>{copy.preferredCategories}</Label>
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
                              <Label htmlFor="onboarding-skill-level">{copy.currentSkillLevel}</Label>
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
                                  <SelectValue placeholder={copy.selectLearningStage} />
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
                              <Label htmlFor="skills-input">{copy.skills}</Label>
                              <Textarea
                                id="skills-input"
                                value={formData.skillsInput}
                                onChange={(e) => setFormData({ ...formData, skillsInput: e.target.value })}
                                placeholder={copy.skillsPlaceholder}
                              />
                              <p className="text-xs text-muted-foreground">
                                {copy.skillsHelp}
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
                              {copy.saving}
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              {copy.saveChanges}
                            </>
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => setIsEditing(false)} disabled={loading}>
                          {copy.cancel}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            {copy.identity}
                          </Badge>
                        </div>
                        {renderInfoGrid(identityItems)}
                      </div>

                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            {copy.educationAndWork}
                          </Badge>
                        </div>
                        {renderInfoGrid(workItems)}
                      </div>

                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            {copy.location}
                          </Badge>
                        </div>
                        {renderInfoGrid(locationItems)}
                      </div>

                      {isLearner && (
                        <div>
                          <div className="mb-3 flex items-center gap-2">
                            <Badge variant="outline" className="rounded-full px-3 py-1">
                              {copy.recommendationProfile}
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
                                  {copy.addSignals}
                                </p>
                              ) : null}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.currentSkillLevel}</p>
                                <p className="mt-2 text-lg font-semibold">
                                  {user.onboardingSkillLevel
                                    ? ONBOARDING_SKILL_LEVEL_OPTIONS.find((option) => option.value === user.onboardingSkillLevel)?.label || prettifyValue(user.onboardingSkillLevel)
                                    : copy.notProvided}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.skillsRecorded}</p>
                                <p className="mt-2 text-lg font-semibold">{profileSkillCount}</p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                  {profileSkillCount > 0 ? user.skills?.join(", ") : copy.noSkillsYet}
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

          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{copy.profileHealth}</CardTitle>
                <CardDescription>{copy.profileHealthBody}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{copy.profileCompletion}</span>
                    <span className="font-medium">{profileCompletion}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${profileCompletion}%` }} />
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.requiredCoverage}</p>
                    <p className="mt-2 text-lg font-semibold">
                      {completedProfileFields} of {profileCompletionFields.length} fields filled
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.recommendedAction}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {profileCompletion < 100
                        ? copy.recommendedActionIncomplete
                        : copy.recommendedActionComplete}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {isEmployeeLearner ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">{copy.verificationDocumentTitle}</CardTitle>
                  <CardDescription>{copy.verificationDocumentBody}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={user.verificationStatus === "verified" ? "default" : user.verificationStatus === "rejected" ? "destructive" : "secondary"}>
                      {copy.verificationStatusLabel}: {prettifyValue(user.verificationStatus || "pending")}
                    </Badge>
                    <Badge variant={hasUploadedVerificationDocument ? "outline" : "secondary"}>
                      {hasUploadedVerificationDocument ? copy.verificationDocumentOnFile : copy.verificationDocumentMissing}
                    </Badge>
                  </div>

                  <p className="text-sm leading-6 text-muted-foreground">
                    {user.verificationStatus === "rejected" && user.verificationNotes
                      ? `${copy.verificationRejectedBody} ${user.verificationNotes}`
                      : hasUploadedVerificationDocument
                        ? copy.verificationDocumentReady
                        : copy.verificationDocumentPrompt}
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="profile-verification-document">{copy.verificationDocumentInput}</Label>
                    <Input
                      id="profile-verification-document"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleVerificationDocumentChange}
                      className="h-12 rounded-xl border-border/80 bg-muted/30 px-4"
                      disabled={uploadingVerificationDocument}
                    />
                    <p className="text-xs text-muted-foreground">{copy.verificationDocumentHelp}</p>
                  </div>

                  {verificationDocumentFile ? (
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">{verificationDocumentFile.name}</p>
                      <p>{(verificationDocumentFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  ) : null}

                  <Button className="gap-2" onClick={handleVerificationDocumentUpload} disabled={!verificationDocumentFile || uploadingVerificationDocument}>
                    {uploadingVerificationDocument ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {copy.verificationUploading}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        {copy.verificationUploadAction}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {!isLearner ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Account Summary</CardTitle>
                  <CardDescription>Quick details tied to your current account.</CardDescription>
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
            ) : null}
          </div>
        </div>

        {isLearner ? (
          <div className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{copy.trainingSnapshot}</CardTitle>
                <CardDescription>{copy.trainingSnapshotBody}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingData ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">{copy.enrolledCourses}</p>
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                        <p className="mt-3 text-3xl font-semibold">{enrollments.length}</p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">{copy.certificates}</p>
                          <Award className="h-4 w-4 text-amber-500" />
                        </div>
                        <p className="mt-3 text-3xl font-semibold">{certificates.length}</p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">{copy.completed}</p>
                          <BadgeCheck className="h-4 w-4 text-emerald-500" />
                        </div>
                        <p className="mt-3 text-3xl font-semibold">{completedEnrollments}</p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">{copy.inProgress}</p>
                          <GraduationCap className="h-4 w-4 text-sky-500" />
                        </div>
                        <p className="mt-3 text-3xl font-semibold">{inProgressEnrollments}</p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4 sm:col-span-2 xl:col-span-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">{copy.totalLearningTime}</p>
                          <Clock3 className="h-4 w-4 text-primary" />
                        </div>
                        <p className="mt-3 text-3xl font-semibold">{formatLearningTime(totalLearningMinutes)}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{copy.completionRate}</span>
                        <span className="font-medium">{completionRate}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${completionRate}%` }} />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{language === "tl" ? "Account Summary" : "Account Summary"}</CardTitle>
                <CardDescription>
                  {language === "tl" ? "Mabilisang detalye na nakakabit sa kasalukuyan mong learner account." : "Quick details tied to your current learner account."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-4 xl:col-span-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{language === "tl" ? "Primary email" : "Primary email"}</p>
                    <p className="mt-1 text-sm font-medium">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                  <Phone className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{language === "tl" ? "Contact number" : "Contact number"}</p>
                    <p className="mt-1 text-sm font-medium">{user.phone || copy.notProvided}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                  <MapPin className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{language === "tl" ? "Primary location" : "Primary location"}</p>
                    <p className="mt-1 text-sm font-medium">{user.cityMunicipality || user.province || copy.notProvided}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 md:col-span-2 xl:col-span-2">
                  <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.signalsLabel}</p>
                    <p className="mt-2 text-2xl font-semibold">{recommendationSignalCoverage}%</p>
                    <p className="mt-1 text-xs text-muted-foreground">{copy.recommendationCoverageBody}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.readinessLabel}</p>
                    <p className="mt-2 text-2xl font-semibold">{predictiveReadiness}%</p>
                    <p className="mt-1 text-xs text-muted-foreground">{copy.predictiveReadinessBody}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default Profile;
