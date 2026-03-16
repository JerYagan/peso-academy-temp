import { createClient } from "npm:@supabase/supabase-js@2.89.0";

type UserRole = "admin" | "trainer" | "trainee";

type CreateAdminUserRequest = {
  email?: string;
  password?: string;
  name?: string;
  role?: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  trainee_type: string | null;
  verification_status: string | null;
  employee_id: string | null;
  physical_id: string | null;
  verification_submitted_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  verification_notes: string | null;
  avatar: string | null;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  gender: string | null;
  civil_status: string | null;
  employment_status: string | null;
  occupation: string | null;
  education_level: string | null;
  barangay: string | null;
  city_municipality: string | null;
  province: string | null;
  postal_code: string | null;
  industry_interests: string[] | null;
  preferred_categories: string[] | null;
  onboarding_skill_level: string | null;
  onboarding_modal_seen_at: string | null;
  skills: string[] | null;
  created_at: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordPolicyRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const normalizeRole = (rawRole: unknown): UserRole => {
  if (typeof rawRole !== "string") {
    return "trainee";
  }

  const normalizedRole = rawRole.toLowerCase().trim();

  if (normalizedRole === "admin" || normalizedRole === "trainer" || normalizedRole === "trainee") {
    return normalizedRole;
  }

  if (normalizedRole === "training_officer" || normalizedRole === "spd") {
    return "trainer";
  }

  if (normalizedRole === "validator") {
    return "admin";
  }

  return "trainee";
};

const mapUserRow = (user: UserRow) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: normalizeRole(user.role),
  traineeType: user.trainee_type ?? undefined,
  verificationStatus: user.verification_status ?? undefined,
  employeeId: user.employee_id ?? undefined,
  physicalId: user.physical_id ?? undefined,
  verificationSubmittedAt: user.verification_submitted_at ?? undefined,
  verifiedAt: user.verified_at ?? undefined,
  verifiedBy: user.verified_by ?? undefined,
  verificationNotes: user.verification_notes ?? undefined,
  avatar: user.avatar ?? undefined,
  phone: user.phone ?? undefined,
  address: user.address ?? undefined,
  dateOfBirth: user.date_of_birth ?? undefined,
  gender: user.gender ?? undefined,
  civilStatus: user.civil_status ?? undefined,
  employmentStatus: user.employment_status ?? undefined,
  occupation: user.occupation ?? undefined,
  educationLevel: user.education_level ?? undefined,
  barangay: user.barangay ?? undefined,
  cityMunicipality: user.city_municipality ?? undefined,
  province: user.province ?? undefined,
  postalCode: user.postal_code ?? undefined,
  industryInterests: user.industry_interests ?? undefined,
  preferredCategories: user.preferred_categories ?? undefined,
  onboardingSkillLevel: user.onboarding_skill_level ?? undefined,
  onboardingModalSeenAt: user.onboarding_modal_seen_at ?? undefined,
  skills: user.skills ?? undefined,
  createdAt: user.created_at,
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: "Supabase Edge Function environment is incomplete." });
  }

  const authorizationHeader = request.headers.get("Authorization");
  const accessToken = authorizationHeader?.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) {
    return jsonResponse(401, { error: "Authentication is required to create users." });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: actorAuthData, error: actorAuthError } = await supabaseAdmin.auth.getUser(accessToken);
  if (actorAuthError || !actorAuthData.user) {
    return jsonResponse(401, { error: "Your session is invalid or expired." });
  }

  const { data: actorProfile, error: actorProfileError } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("id", actorAuthData.user.id)
    .maybeSingle();

  if (actorProfileError) {
    return jsonResponse(500, { error: "Failed to verify your admin access." });
  }

  if (!actorProfile || normalizeRole(actorProfile.role) !== "admin") {
    return jsonResponse(403, { error: "Only authenticated admins can create users." });
  }

  let requestBody: CreateAdminUserRequest;
  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse(400, { error: "Invalid request body." });
  }

  const name = typeof requestBody.name === "string" ? requestBody.name.trim() : "";
  const email = typeof requestBody.email === "string" ? requestBody.email.trim().toLowerCase() : "";
  const password = typeof requestBody.password === "string" ? requestBody.password : "";
  const role = normalizeRole(requestBody.role);

  if (!name) {
    return jsonResponse(400, { error: "Name is required." });
  }

  if (!emailRegex.test(email)) {
    return jsonResponse(400, { error: "Invalid email format. Please enter a valid email address." });
  }

  if (!passwordPolicyRegex.test(password)) {
    return jsonResponse(400, {
      error:
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.",
    });
  }

  const verificationStatus = role === "trainee" ? "pending" : "verified";
  const verificationSubmittedAt = role === "trainee" ? new Date().toISOString() : null;
  const verifiedAt = role === "trainee" ? null : new Date().toISOString();
  const traineeType = role === "trainee" ? "peso_client" : null;

  const { data: createdAuthData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      role,
      trainee_type: traineeType,
      verification_status: verificationStatus,
      verification_submitted_at: verificationSubmittedAt,
      verified_at: verifiedAt,
      language_preference: "en",
      theme_preference: "system",
      industry_interests: [],
      preferred_categories: [],
      skills: [],
    },
  });

  if (createAuthError || !createdAuthData.user) {
    return jsonResponse(400, {
      error: createAuthError?.message || "Failed to create user account.",
    });
  }

  const createdAt = createdAuthData.user.created_at ?? new Date().toISOString();

  const { error: upsertProfileError } = await supabaseAdmin
    .from("users")
    .upsert(
      {
        id: createdAuthData.user.id,
        email,
        name,
        role,
        trainee_type: traineeType,
        verification_status: verificationStatus,
        verification_submitted_at: verificationSubmittedAt,
        verified_at: verifiedAt,
        verified_by: null,
        verification_notes: null,
        language_preference: "en",
        theme_preference: "system",
        created_at: createdAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

  if (upsertProfileError) {
    await supabaseAdmin.auth.admin.deleteUser(createdAuthData.user.id);
    return jsonResponse(500, { error: "User auth record was created, but profile creation failed." });
  }

  const { data: createdProfile, error: createdProfileError } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", createdAuthData.user.id)
    .single<UserRow>();

  if (createdProfileError || !createdProfile) {
    return jsonResponse(500, { error: "User account was created, but the profile could not be returned." });
  }

  return jsonResponse(200, { user: mapUserRow(createdProfile) });
});