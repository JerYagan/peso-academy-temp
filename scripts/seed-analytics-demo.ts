/**
 * Seed realistic demo data for dashboard analytics across trainee, trainer, validator, and admin views.
 *
 * Usage:
 * 1. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
 * 2. Run: npm run seed:analytics
 */

import { createClient } from "@supabase/supabase-js";

type SeedRole = "admin" | "trainer" | "validator" | "trainee" | "spd";

type SeedUser = {
  email: string;
  password: string;
  name: string;
  role: SeedRole;
  phone?: string;
  address?: string;
  skills?: string[];
};

type SeedCourse = {
  title: string;
  description: string;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: number;
  isTESDAAccredited: boolean;
  skills: string[];
  certificateType: "completion" | "participation";
  published: boolean;
  modules: Array<{
    title: string;
    description: string;
    order: number;
  }>;
};

const CORE_USERS: SeedUser[] = [
  {
    email: "admin@peso.academy",
    password: "admin123",
    name: "Admin User",
    role: "admin",
    phone: "+63 912 345 6788",
    address: "Manila, Philippines",
  },
  {
    email: "trainer@peso.academy",
    password: "trainer123",
    name: "Trainer Maria",
    role: "trainer",
    phone: "+63 912 345 6787",
    address: "Manila, Philippines",
    skills: ["Training", "Course Development", "Education"],
  },
  {
    email: "validator@peso.academy",
    password: "validator123",
    name: "Validator John",
    role: "validator",
    phone: "+63 912 345 6785",
    address: "Quezon City, Philippines",
    skills: ["Validation", "Assessment Review", "Quality Assurance"],
  },
  {
    email: "spd@peso.academy",
    password: "spd123",
    name: "SPD Manager",
    role: "spd",
    phone: "+63 912 345 6784",
    address: "Quezon City, Philippines",
    skills: ["Program Management", "Curriculum Planning"],
  },
  {
    email: "trainee01@peso.academy",
    password: "trainee123",
    name: "Ana Santos",
    role: "trainee",
    phone: "+63 917 100 0001",
    address: "Pasig City",
    skills: ["Microsoft Office", "Customer Service"],
  },
  {
    email: "trainee02@peso.academy",
    password: "trainee123",
    name: "Mark Reyes",
    role: "trainee",
    phone: "+63 917 100 0002",
    address: "Quezon City",
    skills: ["Communication", "Sales"],
  },
  {
    email: "trainee03@peso.academy",
    password: "trainee123",
    name: "Lea Villanueva",
    role: "trainee",
    phone: "+63 917 100 0003",
    address: "Makati City",
    skills: ["Bookkeeping", "Attention to Detail"],
  },
  {
    email: "trainee04@peso.academy",
    password: "trainee123",
    name: "Paolo Dizon",
    role: "trainee",
    phone: "+63 917 100 0004",
    address: "Taguig City",
    skills: ["Digital Literacy", "Graphic Design"],
  },
  {
    email: "trainee05@peso.academy",
    password: "trainee123",
    name: "Joy Mendoza",
    role: "trainee",
    phone: "+63 917 100 0005",
    address: "Caloocan City",
    skills: ["Entrepreneurship", "Marketing"],
  },
  {
    email: "trainee06@peso.academy",
    password: "trainee123",
    name: "Carlo Bautista",
    role: "trainee",
    phone: "+63 917 100 0006",
    address: "Marikina City",
    skills: ["Customer Support", "Teamwork"],
  },
  {
    email: "trainee07@peso.academy",
    password: "trainee123",
    name: "Mae Flores",
    role: "trainee",
    phone: "+63 917 100 0007",
    address: "San Juan City",
    skills: ["Office Administration", "Data Entry"],
  },
  {
    email: "trainee08@peso.academy",
    password: "trainee123",
    name: "Rico Garcia",
    role: "trainee",
    phone: "+63 917 100 0008",
    address: "Manila City",
    skills: ["Web Basics", "Problem Solving"],
  },
];

const DEMO_COURSES: SeedCourse[] = [
  {
    title: "Digital Skills Fundamentals",
    description: "Build a foundation in workplace digital literacy and online collaboration.",
    category: "Digital Skills",
    level: "Beginner",
    duration: 40,
    isTESDAAccredited: true,
    skills: ["Computer Basics", "Email", "Productivity Tools"],
    certificateType: "completion",
    published: true,
    modules: [
      { title: "Digital Basics", description: "Core device and browser basics.", order: 1 },
      { title: "Email and Messaging", description: "Professional communication online.", order: 2 },
      { title: "Office Productivity", description: "Documents, sheets, and presentations.", order: 3 },
      { title: "Online Safety", description: "Safe browsing and account protection.", order: 4 },
    ],
  },
  {
    title: "Customer Service Excellence",
    description: "Develop frontline communication, empathy, and service recovery skills.",
    category: "Employability Skills",
    level: "Intermediate",
    duration: 30,
    isTESDAAccredited: true,
    skills: ["Communication", "Empathy", "Problem Solving"],
    certificateType: "completion",
    published: true,
    modules: [
      { title: "Service Mindset", description: "Understanding customer expectations.", order: 1 },
      { title: "Handling Concerns", description: "Resolving issues with clarity and empathy.", order: 2 },
      { title: "Professional Responses", description: "Tone, escalation, and follow-through.", order: 3 },
      { title: "Retention Practices", description: "Turning complaints into loyalty.", order: 4 },
    ],
  },
  {
    title: "Bookkeeping for Small Businesses",
    description: "Track income, expenses, and cash flow for small business operations.",
    category: "Entrepreneurship",
    level: "Beginner",
    duration: 36,
    isTESDAAccredited: true,
    skills: ["Bookkeeping", "Budgeting", "Cash Flow"],
    certificateType: "completion",
    published: true,
    modules: [
      { title: "Financial Records", description: "Organizing core transaction records.", order: 1 },
      { title: "Cash Flow Tracking", description: "Managing inflows and outflows.", order: 2 },
      { title: "Basic Reports", description: "Reading summaries for decision making.", order: 3 },
      { title: "Small Business Controls", description: "Accuracy and reconciliation habits.", order: 4 },
    ],
  },
  {
    title: "Web Development Basics",
    description: "Introduction to HTML, CSS, and JavaScript for entry-level web work.",
    category: "Technical Skills",
    level: "Beginner",
    duration: 60,
    isTESDAAccredited: true,
    skills: ["HTML", "CSS", "JavaScript"],
    certificateType: "completion",
    published: true,
    modules: [
      { title: "HTML Foundations", description: "Semantic page structure.", order: 1 },
      { title: "CSS Layout", description: "Styling and responsive layout basics.", order: 2 },
      { title: "JavaScript Interaction", description: "Dynamic behavior and events.", order: 3 },
      { title: "Project Build", description: "Assembling a complete beginner project.", order: 4 },
    ],
  },
];

const envUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const envServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!envUrl || !envServiceKey) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(envUrl, envServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const randomFrom = <T,>(items: T[], index: number) => items[index % items.length];

const monthOffsetDate = (monthOffset: number, dayOffset: number) => {
  const date = new Date();
  date.setMonth(date.getMonth() - monthOffset);
  date.setDate(Math.min(28, 4 + dayOffset));
  date.setHours(9 + (dayOffset % 6), 0, 0, 0);
  return date;
};

async function columnExists(table: string, column: string) {
  const { error } = await supabase.from(table).select(column).limit(1);
  return !error;
}

async function ensureUser(userData: SeedUser) {
  const existing = await supabase.auth.admin.getUserByEmail(userData.email);
  let userId = existing.data.user?.id;

  if (!userId) {
    const created = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: { name: userData.name, role: userData.role },
    });

    if (created.error || !created.data.user) {
      throw created.error || new Error(`Failed to create ${userData.email}`);
    }

    userId = created.data.user.id;
  } else {
    await supabase.auth.admin.updateUserById(userId, {
      password: userData.password,
      email_confirm: true,
      user_metadata: { name: userData.name, role: userData.role },
    });
  }

  const profilePayload: Record<string, unknown> = {
    id: userId,
    email: userData.email,
    name: userData.name,
    role: userData.role,
    phone: userData.phone || null,
    address: userData.address || null,
    skills: userData.skills || null,
    updated_at: new Date().toISOString(),
  };

  const { error: profileError } = await supabase.from("users").upsert(profilePayload, { onConflict: "id" });
  if (profileError) throw profileError;

  return userId;
}

async function ensureCourse(course: SeedCourse, instructorId: string) {
  const existing = await supabase.from("courses").select("id").eq("title", course.title).maybeSingle();
  const payload = {
    title: course.title,
    description: course.description,
    category: course.category,
    level: course.level,
    duration: course.duration,
    instructor_id: instructorId,
    is_tesda_accredited: course.isTESDAAccredited,
    skills: course.skills,
    enrolled_count: 0,
    rating: 4.4,
    certificate_type: course.certificateType,
    published: course.published,
    updated_at: new Date().toISOString(),
  };

  if (existing.data?.id) {
    const updated = await supabase.from("courses").update(payload).eq("id", existing.data.id).select("id").single();
    if (updated.error) throw updated.error;
    return updated.data.id;
  }

  const inserted = await supabase
    .from("courses")
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data.id;
}

async function ensureModulesAndAssessments(courseId: string, course: SeedCourse) {
  const moduleIds: string[] = [];
  const hasModuleUpdatedAt = await columnExists("modules", "updated_at");
  const hasModuleStatus = await columnExists("modules", "status");

  for (const moduleDefinition of course.modules) {
    const existingModule = await supabase
      .from("modules")
      .select("id")
      .eq("course_id", courseId)
      .eq("title", moduleDefinition.title)
      .maybeSingle();

    let moduleId = existingModule.data?.id;
    if (!moduleId) {
      const modulePayload: Record<string, unknown> = {
        course_id: courseId,
        title: moduleDefinition.title,
        description: moduleDefinition.description,
        order: moduleDefinition.order,
        content: `${moduleDefinition.title} content`,
        materials: [],
        prerequisites: [],
        created_at: new Date().toISOString(),
      };

      if (hasModuleUpdatedAt) {
        modulePayload.updated_at = new Date().toISOString();
      }

      if (hasModuleStatus) {
        modulePayload.status = "finalized";
      }

      const insertedModule = await supabase
        .from("modules")
        .insert(modulePayload)
        .select("id")
        .single();
      if (insertedModule.error) throw insertedModule.error;
      moduleId = insertedModule.data.id;
    } else {
      const moduleUpdatePayload: Record<string, unknown> = {
        description: moduleDefinition.description,
        order: moduleDefinition.order,
      };

      if (hasModuleUpdatedAt) {
        moduleUpdatePayload.updated_at = new Date().toISOString();
      }

      if (hasModuleStatus) {
        moduleUpdatePayload.status = "finalized";
      }

      await supabase
        .from("modules")
        .update(moduleUpdatePayload)
        .eq("id", moduleId);
    }

    moduleIds.push(moduleId);

    const existingAssessment = await supabase
      .from("assessments")
      .select("id")
      .eq("module_id", moduleId)
      .maybeSingle();

    let assessmentId = existingAssessment.data?.id;
    if (!assessmentId) {
      const insertedAssessment = await supabase
        .from("assessments")
        .insert({
          module_id: moduleId,
          title: `${moduleDefinition.title} Assessment`,
          description: `Assessment for ${moduleDefinition.title}`,
          passing_score: 70,
          max_attempts: 3,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insertedAssessment.error) throw insertedAssessment.error;
      assessmentId = insertedAssessment.data.id;
    }

    const existingQuestions = await supabase
      .from("assessment_questions")
      .select("id", { count: "exact" })
      .eq("assessment_id", assessmentId);

    if ((existingQuestions.count || 0) === 0) {
      const questionPayload = [1, 2, 3].map((order) => ({
        assessment_id: assessmentId,
        question: `${moduleDefinition.title} question ${order}`,
        question_type: "multiple_choice",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correct_answer: "Option A",
        points: 1,
        order,
        explanation: `Explanation for question ${order}`,
      }));

      const insertedQuestions = await supabase.from("assessment_questions").insert(questionPayload);
      if (insertedQuestions.error) throw insertedQuestions.error;
    }
  }

  return moduleIds;
}

async function main() {
  console.log("Seeding analytics demo data...");

  const hasEnrollmentUpdatedAt = await columnExists("enrollments", "updated_at");
  const hasNotificationMetadata = await columnExists("notifications", "metadata");
  const hasModuleUpdatedAt = await columnExists("modules", "updated_at");
  const hasModuleStatus = await columnExists("modules", "status");

  const userIds = new Map<string, string>();
  for (const userData of CORE_USERS) {
    const userId = await ensureUser(userData);
    userIds.set(userData.email, userId);
  }

  const trainerId = userIds.get("trainer@peso.academy");
  const validatorId = userIds.get("validator@peso.academy");
  if (!trainerId || !validatorId) {
    throw new Error("Trainer or validator user could not be ensured.");
  }

  const traineeIds = CORE_USERS.filter((user) => user.role === "trainee").map((user) => userIds.get(user.email)!);

  const courseIds: string[] = [];
  const courseModuleMap = new Map<string, string[]>();
  for (const course of DEMO_COURSES) {
    const courseId = await ensureCourse(course, trainerId);
    courseIds.push(courseId);
    const moduleIds = await ensureModulesAndAssessments(courseId, course);
    courseModuleMap.set(courseId, moduleIds);
  }

  const existingEnrollments = await supabase
    .from("enrollments")
    .select("id")
    .in("user_id", traineeIds);

  const enrollmentIds = existingEnrollments.data?.map((row) => row.id) || [];
  if (enrollmentIds.length > 0) {
    await supabase.from("assessment_answers").delete().in("attempt_id", (
      await supabase.from("assessment_attempts").select("id").in("enrollment_id", enrollmentIds)
    ).data?.map((row) => row.id) || []);
    await supabase.from("assessment_attempts").delete().in("enrollment_id", enrollmentIds);
    await supabase.from("module_completions").delete().in("enrollment_id", enrollmentIds);
    await supabase.from("submissions").delete().in("enrollment_id", enrollmentIds);
    await supabase.from("certificates").delete().in("user_id", traineeIds);
    await supabase.from("enrollments").delete().in("id", enrollmentIds);
  }
  await supabase.from("notifications").delete().in("user_id", traineeIds);

  const enrollmentsToInsert: Record<string, unknown>[] = [];
  traineeIds.forEach((traineeId, traineeIndex) => {
    const firstCourse = courseIds[traineeIndex % courseIds.length];
    const secondCourse = courseIds[(traineeIndex + 1) % courseIds.length];
    [firstCourse, secondCourse].forEach((courseId, courseOffset) => {
      const enrollmentDate = monthOffsetDate((traineeIndex + courseOffset) % 6, traineeIndex + courseOffset);
      const statusCycle = ["completed", "completed", "in-progress", "enrolled"] as const;
      const status = randomFrom(statusCycle, traineeIndex + courseOffset);
      const progress = status === "completed" ? 100 : status === "in-progress" ? 55 + ((traineeIndex * 7) % 35) : 10 + ((traineeIndex * 5) % 25);
      const completedAt = status === "completed" ? new Date(enrollmentDate.getTime() + 18 * 24 * 60 * 60 * 1000) : null;
      const basePayload: Record<string, unknown> = {
        user_id: traineeId,
        course_id: courseId,
        progress,
        status,
        enrolled_at: enrollmentDate.toISOString(),
        completed_at: completedAt ? completedAt.toISOString() : null,
      };

      if (hasEnrollmentUpdatedAt) {
        const updatedAt = completedAt || new Date(enrollmentDate.getTime() + (6 + courseOffset) * 24 * 60 * 60 * 1000);
        basePayload.updated_at = updatedAt.toISOString();
      }

      enrollmentsToInsert.push(basePayload);
    });
  });

  const insertedEnrollments = await supabase
    .from("enrollments")
    .insert(enrollmentsToInsert)
    .select("id, user_id, course_id, progress, status, enrolled_at, completed_at");

  if (insertedEnrollments.error || !insertedEnrollments.data) {
    throw insertedEnrollments.error || new Error("Failed to insert enrollments.");
  }

  const assessmentMap = new Map<string, string>();
  const assessments = await supabase.from("assessments").select("id, module_id").in(
    "module_id",
    Array.from(courseModuleMap.values()).flat()
  );
  if (assessments.error) throw assessments.error;
  (assessments.data || []).forEach((assessment) => assessmentMap.set(assessment.module_id, assessment.id));

  const moduleCompletions: Record<string, unknown>[] = [];
  const assessmentAttempts: Record<string, unknown>[] = [];
  const certificates: Record<string, unknown>[] = [];
  const notifications: Record<string, unknown>[] = [];
  const submissions: Record<string, unknown>[] = [];

  insertedEnrollments.data.forEach((enrollment, index) => {
    const moduleIds = courseModuleMap.get(enrollment.course_id) || [];
    const moduleTarget = enrollment.status === "completed"
      ? moduleIds.length
      : enrollment.status === "in-progress"
        ? Math.max(2, Math.min(moduleIds.length - 1, Math.round((moduleIds.length * Number(enrollment.progress || 0)) / 100)))
        : 1;

    moduleIds.forEach((moduleId, moduleIndex) => {
      if (moduleIndex >= moduleTarget) return;

      const completedAt = new Date(new Date(enrollment.enrolled_at).getTime() + (moduleIndex + 2) * 24 * 60 * 60 * 1000);
      const isFinished = enrollment.status === "completed" || moduleIndex < moduleTarget - 1;
      moduleCompletions.push({
        enrollment_id: enrollment.id,
        module_id: moduleId,
        time_spent: 35 + ((index + moduleIndex) % 5) * 18,
        completed_at: isFinished ? completedAt.toISOString() : null,
      });

      const assessmentId = assessmentMap.get(moduleId);
      if (!assessmentId) return;

      const score = Math.min(98, 68 + ((index * 9 + moduleIndex * 6) % 28));
      const submittedAt = new Date(completedAt.getTime() + 2 * 60 * 60 * 1000);
      assessmentAttempts.push({
        assessment_id: assessmentId,
        enrollment_id: enrollment.id,
        user_id: enrollment.user_id,
        started_at: new Date(submittedAt.getTime() - 18 * 60 * 1000).toISOString(),
        submitted_at: submittedAt.toISOString(),
        score,
        passed: score >= 70,
        answers: {},
        time_spent: 900 + moduleIndex * 120,
      });
    });

    if (enrollment.status === "completed") {
      certificates.push({
        user_id: enrollment.user_id,
        course_id: enrollment.course_id,
        certificate_number: `PESO-${String(index + 1).padStart(5, "0")}`,
        certificate_type: index % 4 === 0 ? "participation" : "completion",
        issued_at: new Date(new Date(enrollment.completed_at || enrollment.enrolled_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        verification_code: `VERIFY-${String(index + 1).padStart(6, "0")}`,
      });
    }

    const notificationBase: Record<string, unknown> = {
      user_id: enrollment.user_id,
      type: enrollment.status === "completed" ? "course_completed" : "enrollment_confirmed",
      message: enrollment.status === "completed"
        ? "You have completed a course. Your certificate is ready for release review."
        : "You have been enrolled in a new course. Continue learning from your dashboard.",
      read: index % 3 === 0,
      created_at: new Date(enrollment.enrolled_at).toISOString(),
    };
    if (hasNotificationMetadata) {
      notificationBase.metadata = { courseId: enrollment.course_id, enrollmentId: enrollment.id };
    }
    notifications.push(notificationBase);

    if (index % 3 === 0) {
      submissions.push({
        enrollment_id: enrollment.id,
        module_id: moduleIds[Math.max(0, moduleTarget - 1)],
        user_id: enrollment.user_id,
        submitted_at: new Date(new Date(enrollment.enrolled_at).getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        status: index % 2 === 0 ? "approved" : "revision_requested",
        submission_type: "assignment",
        title: "Portfolio Output",
        description: "Demo seeded submission for validation and analytics.",
        content: { summary: "Seeded demo submission" },
        attachments: [],
        priority: index % 4 === 0 ? "high" : "normal",
        validator_id: validatorId,
        created_at: new Date(enrollment.enrolled_at).toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  });

  if (moduleCompletions.length > 0) {
    const completionInsert = await supabase.from("module_completions").insert(moduleCompletions);
    if (completionInsert.error) throw completionInsert.error;
  }

  if (assessmentAttempts.length > 0) {
    const attemptsInsert = await supabase.from("assessment_attempts").insert(assessmentAttempts);
    if (attemptsInsert.error) throw attemptsInsert.error;
  }

  if (certificates.length > 0) {
    const certificateInsert = await supabase.from("certificates").insert(certificates);
    if (certificateInsert.error) throw certificateInsert.error;
  }

  if (notifications.length > 0) {
    const notificationInsert = await supabase.from("notifications").insert(notifications);
    if (notificationInsert.error) throw notificationInsert.error;
  }

  let insertedSubmissions: Array<{ id: string }> = [];
  if (submissions.length > 0) {
    const submissionInsert = await supabase.from("submissions").insert(submissions).select("id");
    if (submissionInsert.error) throw submissionInsert.error;
    insertedSubmissions = submissionInsert.data || [];
  }

  if (insertedSubmissions.length > 0) {
    const validationsPayload = insertedSubmissions.map((submission, index) => ({
      submission_id: submission.id,
      validator_id: validatorId,
      validation_type: "review",
      status: "completed",
      decision: index % 2 === 0 ? "approved" : "revision_requested",
      feedback: index % 2 === 0 ? "Well organized output." : "Please revise the final section.",
      rating: index % 2 === 0 ? 5 : 3,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const validationInsert = await supabase.from("validations").insert(validationsPayload).select("id, submission_id");
    if (validationInsert.error) throw validationInsert.error;

    const feedbackPayload = (validationInsert.data || []).map((validation, index) => ({
      validation_id: validation.id,
      submission_id: validation.submission_id,
      validator_id: validatorId,
      feedback_type: "general",
      title: index % 2 === 0 ? "Approved submission" : "Revision needed",
      content: index % 2 === 0 ? "Your submission meets the requirements." : "Please improve the explanation in your final section.",
      rating: index % 2 === 0 ? 5 : 3,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const feedbackInsert = await supabase.from("feedback").insert(feedbackPayload);
    if (feedbackInsert.error) throw feedbackInsert.error;
  }

  if (hasModuleUpdatedAt || hasModuleStatus) {
    for (const [courseId, moduleIds] of courseModuleMap.entries()) {
      await supabase.from("courses").update({ enrolled_count: insertedEnrollments.data.filter((e) => e.course_id === courseId).length }).eq("id", courseId);
      if (hasModuleUpdatedAt || hasModuleStatus) {
        for (const moduleId of moduleIds) {
          await supabase.from("modules").update({
            ...(hasModuleUpdatedAt ? { updated_at: new Date().toISOString() } : {}),
            ...(hasModuleStatus ? { status: "finalized" } : {}),
          }).eq("id", moduleId);
        }
      }
    }
  }

  console.log(`Seeded ${traineeIds.length} trainees, ${courseIds.length} courses, ${insertedEnrollments.data.length} enrollments.`);
  console.log("Analytics demo seed complete.");
}

main().catch((error) => {
  console.error("Analytics demo seed failed:", error);
  process.exit(1);
});