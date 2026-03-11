import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User } from "@/types/auth";
import { getDashboardRoute, type UserRole as AppUserRole } from "@/lib/roles";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ONBOARDING_CATEGORY_OPTIONS,
  ONBOARDING_INDUSTRY_OPTIONS,
  ONBOARDING_SKILL_LEVEL_OPTIONS,
} from "@/lib/onboarding";

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

const SignUp = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<User["gender"] | "">("");
  const [civilStatus, setCivilStatus] = useState<User["civilStatus"] | "">("");
  const [employmentStatus, setEmploymentStatus] = useState<User["employmentStatus"] | "">("");
  const [occupation, setOccupation] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [address, setAddress] = useState("");
  const [barangay, setBarangay] = useState("");
  const [cityMunicipality, setCityMunicipality] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [industryInterests, setIndustryInterests] = useState<string[]>([]);
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [onboardingSkillLevel, setOnboardingSkillLevel] = useState<User["onboardingSkillLevel"] | "">("");
  const [existingSkills, setExistingSkills] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const { signup, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");

  const toggleSelection = (value: string, currentValues: string[], setValues: (values: string[]) => void) => {
    if (currentValues.includes(value)) {
      setValues(currentValues.filter((currentValue) => currentValue !== value));
      return;
    }

    setValues([...currentValues, value]);
  };

  // Navigate after successful signup, or when returning from Google OAuth (already authenticated)
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (signupSuccess) {
      setSignupSuccess(false);
    }
    if (redirectTo && redirectTo.startsWith("/")) {
      navigate(redirectTo, { replace: true });
    } else {
      navigate(getDashboardRoute(user.role as AppUserRole), { replace: true });
    }
  }, [signupSuccess, isAuthenticated, user, navigate, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate password strength
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const now = new Date();
      if (Number.isNaN(birthDate.getTime()) || birthDate > now) {
        setError("Date of birth must be a valid past date.");
        setLoading(false);
        return;
      }
    }

    try {
      const normalizedSkills = Array.from(
        new Set(
          existingSkills
            .split(/[,\n]/)
            .map((skill) => skill.trim())
            .filter(Boolean),
        ),
      );

      const result = await signup(email, password, name, "trainee", {
        phone,
        address,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        civilStatus: civilStatus || undefined,
        employmentStatus: employmentStatus || undefined,
        occupation,
        educationLevel,
        barangay,
        cityMunicipality,
        province,
        postalCode,
        industryInterests,
        preferredCategories,
        onboardingSkillLevel: onboardingSkillLevel || undefined,
        skills: normalizedSkills.length > 0 ? normalizedSkills : undefined,
      });
      if (result.success) {
        setSignupSuccess(true);
        // Navigation will happen via useEffect when user state updates
      } else {
        setError(result.error || "Email already exists. Please use a different email.");
        setLoading(false);
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="Register"
      subtitle="Create your PESO Academy learner account and complete your trainee information in one step."
      maxWidthClass="max-w-4xl"
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
        <div className="space-y-1 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Create your account</h2>
          <p className="text-sm text-muted-foreground">All public signups are created as trainee accounts.</p>
        </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

        <section className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-5 sm:p-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Account information</h3>
            <p className="text-sm text-muted-foreground">Enter the core details you will use to sign in.</p>
          </div>

          <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Juan Dela Cruz"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-12 rounded-xl border-border/80 bg-background px-4"
              />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@peso.academy"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl border-border/80 bg-background px-4"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="09xx xxx xxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 rounded-xl border-border/80 bg-background px-4"
                />
            </div>
          </div>

          <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            <p className="text-xs text-muted-foreground">Use at least 6 characters for your account password.</p>
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-border/70 bg-background p-5 sm:p-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Trainee information</h3>
                <p className="text-sm text-muted-foreground">Capture the learner details needed for profiling and reporting.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date-of-birth">Date of Birth</Label>
                  <Input
                    id="date-of-birth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={gender} onValueChange={(value) => setGender(value as User["gender"])}>
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
                  <Select value={civilStatus} onValueChange={(value) => setCivilStatus(value as User["civilStatus"])}>
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
                  <Select value={employmentStatus} onValueChange={(value) => setEmploymentStatus(value as User["employmentStatus"])}>
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
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="education-level">Education Level</Label>
                  <Input
                    id="education-level"
                    type="text"
                    placeholder="e.g. College Graduate"
                    value={educationLevel}
                    onChange={(e) => setEducationLevel(e.target.value)}
                    className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  placeholder="House number, street, subdivision"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="min-h-28 rounded-xl border-border/80 bg-muted/20 px-4 py-3"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="barangay">Barangay</Label>
                  <Input
                    id="barangay"
                    type="text"
                    value={barangay}
                    onChange={(e) => setBarangay(e.target.value)}
                    className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city-municipality">City / Municipality</Label>
                  <Input
                    id="city-municipality"
                    type="text"
                    value={cityMunicipality}
                    onChange={(e) => setCityMunicipality(e.target.value)}
                    className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="province">Province</Label>
                  <Input
                    id="province"
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postal-code">Postal Code</Label>
                  <Input
                    id="postal-code"
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="h-12 rounded-xl border-border/80 bg-muted/20 px-4"
                  />
                </div>
              </div>

              <div className="space-y-5 rounded-2xl border border-border/60 bg-muted/10 p-5">
                <div>
                  <h4 className="text-base font-semibold text-foreground">Learning preferences</h4>
                  <p className="text-sm text-muted-foreground">
                    These onboarding signals help us recommend starter courses before you complete any modules or assessments.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skill-level">Current skill level</Label>
                  <Select
                    value={onboardingSkillLevel}
                    onValueChange={(value) => setOnboardingSkillLevel(value as User["onboardingSkillLevel"])}
                  >
                    <SelectTrigger id="skill-level" className="h-12 rounded-xl border-border/80 bg-muted/20 px-4">
                      <SelectValue placeholder="Select your current level" />
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

                <div className="space-y-3">
                  <Label>Industry interests</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    {ONBOARDING_INDUSTRY_OPTIONS.map((interest) => (
                      <label key={interest} className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3 text-sm">
                        <Checkbox
                          checked={industryInterests.includes(interest)}
                          onCheckedChange={() => toggleSelection(interest, industryInterests, setIndustryInterests)}
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
                          checked={preferredCategories.includes(category)}
                          onCheckedChange={() => toggleSelection(category, preferredCategories, setPreferredCategories)}
                          className="mt-0.5"
                        />
                        <span>{category}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="existing-skills">Existing skills</Label>
                  <Textarea
                    id="existing-skills"
                    placeholder="Add any skills you already have, separated by commas or new lines"
                    value={existingSkills}
                    onChange={(e) => setExistingSkills(e.target.value)}
                    className="min-h-24 rounded-xl border-border/80 bg-muted/20 px-4 py-3"
                  />
                </div>
              </div>
        </section>

        <Button type="submit" className="h-12 w-full rounded-xl text-base font-semibold" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
        </Button>
      </form>
    </AuthPageShell>
  );
};

export default SignUp;

