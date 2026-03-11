/**
 * Seed demo courses, modules, content blocks, and assessments.
 *
 * Usage:
 * 1. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
 * 2. Run: npm run seed:courses
 */

import { createClient } from "@supabase/supabase-js";

type CourseLevel = "Beginner" | "Intermediate" | "Advanced";
type CertificateType = "completion" | "participation";
type ContentBlockType = "text" | "code" | "video" | "image" | "quiz" | "document" | "learning_material";
type QuestionType = "multiple_choice" | "true_false" | "short_answer" | "essay";

type ContentBlockSeed = {
  id: string;
  type: ContentBlockType;
  content: string;
  title?: string;
  language?: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  videoUrl?: string;
  imageUrl?: string;
  altText?: string;
  caption?: string;
  documentUrl?: string;
  materialUrl?: string;
};

type AssessmentQuestionSeed = {
  question: string;
  questionType: QuestionType;
  options?: string[];
  correctAnswer?: string;
  points: number;
  explanation?: string;
};

type AssessmentSeed = {
  title: string;
  description?: string;
  timeLimit?: number;
  passingScore: number;
  maxAttempts: number;
  questions: AssessmentQuestionSeed[];
};

type ModuleSeed = {
  title: string;
  description: string;
  order: number;
  status?: "draft" | "finalized";
  materials: string[];
  moduleThumbnail?: string;
  moduleDocument?: string;
  skillTags?: string[];
  topicTags?: string[];
  prerequisiteOrders?: number[];
  contentBlocks: ContentBlockSeed[];
  assessment?: AssessmentSeed;
};

type CourseSeed = {
  title: string;
  description: string;
  category: string;
  level: CourseLevel;
  duration: number;
  thumbnail: string;
  courseDocument?: string;
  isTESDAAccredited: boolean;
  skills: string[];
  skillTags?: string[];
  topicTags?: string[];
  enrolledCount: number;
  rating: number;
  certificateType: CertificateType;
  published: boolean;
  modules: ModuleSeed[];
};

const SAMPLE_PDF = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

const COURSE_SEEDS: CourseSeed[] = [
  {
    title: "Digital Job Search Readiness",
    description:
      "Prepare learners for online job applications with a practical workflow for profiles, resumes, email communication, and interview preparation.",
    category: "Employability Skills",
    level: "Beginner",
    duration: 24,
    thumbnail: "/images/course-service.svg",
    courseDocument: SAMPLE_PDF,
    isTESDAAccredited: true,
    skills: ["Resume Writing", "Email Communication", "Interview Skills", "Digital Literacy"],
    skillTags: ["resume-writing", "email-communication", "interview-skills", "digital-literacy"],
    topicTags: ["job-readiness", "application-workflow"],
    enrolledCount: 180,
    rating: 4.7,
    certificateType: "completion",
    published: true,
    modules: [
      {
        title: "Build a Job-Ready Digital Profile",
        description: "Set up a professional profile, prepare contact details, and organize job search requirements.",
        order: 1,
        status: "finalized",
        materials: [
          SAMPLE_PDF,
          "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          "quiz-activity",
          "module-assessment",
        ],
        moduleThumbnail: "/images/course-service.svg",
        moduleDocument: SAMPLE_PDF,
        skillTags: ["digital-literacy", "profile-setup"],
        topicTags: ["jobseeker-profile", "readiness-checklist"],
        contentBlocks: [
          {
            id: "job-ready-profile-text",
            type: "text",
            title: "Why your digital profile matters",
            content:
              "<p>A complete and accurate digital profile helps employers reach you faster and reduces delays during screening. Always use your current phone number, a working email address, and a professional name format.</p><p>Keep a simple folder for IDs, certificates, and resume files so you can submit requirements quickly.</p>",
          },
          {
            id: "job-ready-profile-image",
            type: "image",
            title: "Checklist snapshot",
            content: "",
            imageUrl: "/images/logo.png",
            altText: "PESO Academy logo used as a placeholder checklist visual",
            caption: "Replace with a custom learner onboarding visual when branded assets are available.",
          },
          {
            id: "job-ready-profile-material",
            type: "learning_material",
            title: "Job search readiness checklist",
            content: "",
            materialUrl: SAMPLE_PDF,
          },
          {
            id: "job-ready-profile-quiz",
            type: "quiz",
            title: "Quick check",
            content: "Which profile detail should be updated first before sending applications?",
            options: [
              "Old email address that no longer works",
              "A favorite quote",
              "Your browser theme",
              "The folder color of your files",
            ],
            correctAnswer: 0,
            explanation: "Employers need a reliable way to contact you. Outdated contact information creates immediate friction.",
          },
        ],
        assessment: {
          title: "Profile Setup Assessment",
          description: "Check whether the learner can identify the essentials of a professional job search profile.",
          timeLimit: 10,
          passingScore: 70,
          maxAttempts: 3,
          questions: [
            {
              question: "What is the most important purpose of a professional job search profile?",
              questionType: "multiple_choice",
              options: [
                "To make it easy for employers to verify and contact the applicant",
                "To list every hobby in detail",
                "To avoid updating application files",
                "To replace the resume entirely",
              ],
              correctAnswer: "To make it easy for employers to verify and contact the applicant",
              points: 2,
              explanation: "A strong profile supports screening and communication.",
            },
            {
              question: "True or false: It is acceptable to use an email address you rarely check for job applications.",
              questionType: "true_false",
              correctAnswer: "false",
              points: 1,
              explanation: "Application emails should go to an address the learner monitors consistently.",
            },
            {
              question: "Which file set is best to prepare before applying online?",
              questionType: "multiple_choice",
              options: [
                "Resume, IDs, and relevant certificates in one organized folder",
                "Only screenshots from social media",
                "A folder containing music and unrelated photos",
                "Nothing until the employer asks again",
              ],
              correctAnswer: "Resume, IDs, and relevant certificates in one organized folder",
              points: 2,
              explanation: "Organized files reduce delays and missed opportunities.",
            },
          ],
        },
      },
      {
        title: "Resume and Email Essentials",
        description: "Write concise resumes and send complete application emails with the right attachments.",
        order: 2,
        status: "finalized",
        materials: [SAMPLE_PDF, "module-assessment"],
        moduleThumbnail: "/images/course-service.svg",
        moduleDocument: SAMPLE_PDF,
        skillTags: ["resume-writing", "email-communication"],
        topicTags: ["resume", "application-email"],
        prerequisiteOrders: [1],
        contentBlocks: [
          {
            id: "resume-email-text",
            type: "text",
            title: "Resume structure",
            content:
              "<p>A beginner-friendly resume should highlight contact information, a short summary, skills, education, and relevant experience or training. Keep language direct and results-focused.</p><p>Your application email should mention the role, attach the correct files, and end with a professional sign-off.</p>",
          },
          {
            id: "resume-email-code",
            type: "code",
            title: "Sample email template",
            language: "plaintext",
            content:
              "Subject: Application for Office Assistant\n\nGood day,\n\nI am applying for the Office Assistant position. Attached are my resume and supporting documents for your review.\n\nThank you for your time.\n\nSincerely,\nAna Santos",
          },
          {
            id: "resume-email-document",
            type: "document",
            title: "Resume reference sheet",
            content: "",
            documentUrl: SAMPLE_PDF,
          },
          {
            id: "resume-email-quiz",
            type: "quiz",
            title: "Email check",
            content: "What should appear clearly in an application email subject line?",
            options: [
              "The role being applied for",
              "A random emoji",
              "Only the applicant's nickname",
              "The file size of the resume",
            ],
            correctAnswer: 0,
            explanation: "A clear subject line helps employers sort and review applications quickly.",
          },
        ],
        assessment: {
          title: "Resume and Email Assessment",
          description: "Validate learner understanding of resume basics and professional email habits.",
          timeLimit: 12,
          passingScore: 75,
          maxAttempts: 3,
          questions: [
            {
              question: "Which resume section should always be easy to find?",
              questionType: "multiple_choice",
              options: ["Contact details", "Favorite movies", "Daily meal plan", "Browser history"],
              correctAnswer: "Contact details",
              points: 1,
              explanation: "Employers need immediate access to contact information.",
            },
            {
              question: "True or false: A vague email subject line like 'Hello' is acceptable for a formal application.",
              questionType: "true_false",
              correctAnswer: "false",
              points: 1,
              explanation: "The subject line should identify the application clearly.",
            },
            {
              question: "What makes a resume easier to review?",
              questionType: "multiple_choice",
              options: [
                "Short sections with relevant information",
                "Long paragraphs without headings",
                "Only decorative design elements",
                "Unrelated personal stories",
              ],
              correctAnswer: "Short sections with relevant information",
              points: 2,
              explanation: "A clear structure helps recruiters scan quickly.",
            },
          ],
        },
      },
      {
        title: "Interview Preparation Workflow",
        description: "Practice common interview responses and prepare a repeatable pre-interview checklist.",
        order: 3,
        status: "finalized",
        materials: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "module-assessment"],
        moduleThumbnail: "/images/course-service.svg",
        skillTags: ["interview-skills", "communication"],
        topicTags: ["interview-prep", "self-presentation"],
        prerequisiteOrders: [1, 2],
        contentBlocks: [
          {
            id: "interview-prep-text",
            type: "text",
            title: "Before the interview",
            content:
              "<p>Review the job role, prepare two or three examples of your work habits, and test your internet or travel route ahead of time. Bring only the files and details that support the conversation.</p>",
          },
          {
            id: "interview-prep-video",
            type: "video",
            title: "Interview confidence guide",
            content: "",
            videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
          {
            id: "interview-prep-quiz",
            type: "quiz",
            title: "Interview readiness",
            content: "What is the best reason to review the job description before an interview?",
            options: [
              "To tailor examples to the employer's needs",
              "To memorize the company logo color",
              "To avoid preparing questions",
              "To skip researching the role",
            ],
            correctAnswer: 0,
            explanation: "Reviewing the role helps the learner answer with relevant examples.",
          },
        ],
        assessment: {
          title: "Interview Preparation Assessment",
          description: "Measure whether learners know how to prepare and present themselves well in interviews.",
          timeLimit: 15,
          passingScore: 70,
          maxAttempts: 3,
          questions: [
            {
              question: "Why should a learner prepare examples of previous tasks or achievements?",
              questionType: "multiple_choice",
              options: [
                "To answer behavior-based questions with evidence",
                "To avoid listening to questions",
                "To make the interview longer",
                "To replace personal introductions",
              ],
              correctAnswer: "To answer behavior-based questions with evidence",
              points: 2,
              explanation: "Concrete examples make answers more credible.",
            },
            {
              question: "True or false: Testing the interview setup or route before the schedule helps reduce avoidable problems.",
              questionType: "true_false",
              correctAnswer: "true",
              points: 1,
              explanation: "Preparation reduces preventable stress and delays.",
            },
            {
              question: "Which question from the learner shows preparation and interest?",
              questionType: "multiple_choice",
              options: [
                "What would success in this role look like in the first few months?",
                "Can I skip training?",
                "Do I really need to arrive on time?",
                "Can I ignore the role description?",
              ],
              correctAnswer: "What would success in this role look like in the first few months?",
              points: 2,
              explanation: "Thoughtful questions show interest and professionalism.",
            },
          ],
        },
      },
    ],
  },
  {
    title: "Front Desk Digital Operations",
    description:
      "Train learners to manage front desk tasks using shared devices, digital forms, schedules, and clear service communication.",
    category: "Digital Skills",
    level: "Intermediate",
    duration: 30,
    thumbnail: "/images/course-office.svg",
    courseDocument: SAMPLE_PDF,
    isTESDAAccredited: true,
    skills: ["Records Management", "Scheduling", "Customer Service", "Data Entry"],
    skillTags: ["records-management", "scheduling", "customer-service", "data-entry"],
    topicTags: ["front-desk", "office-operations"],
    enrolledCount: 95,
    rating: 4.6,
    certificateType: "completion",
    published: true,
    modules: [
      {
        title: "Operate Shared Devices Safely",
        description: "Use public or office devices responsibly while protecting files, passwords, and session data.",
        order: 1,
        status: "finalized",
        materials: [SAMPLE_PDF, "module-assessment"],
        moduleThumbnail: "/images/course-office.svg",
        moduleDocument: SAMPLE_PDF,
        skillTags: ["digital-safety", "device-use"],
        topicTags: ["shared-computers", "file-security"],
        contentBlocks: [
          {
            id: "shared-devices-text",
            type: "text",
            title: "Shared device habits",
            content:
              "<p>Log out of accounts after every session, avoid saving passwords on shared browsers, and confirm that downloaded files are stored in the correct team folder.</p>",
          },
          {
            id: "shared-devices-quiz",
            type: "quiz",
            title: "Security check",
            content: "What should you do before leaving a shared workstation?",
            options: ["Log out of all accounts", "Leave tabs open", "Save personal passwords", "Disable updates forever"],
            correctAnswer: 0,
            explanation: "Logging out protects both user and office data.",
          },
        ],
        assessment: {
          title: "Shared Device Safety Assessment",
          passingScore: 70,
          maxAttempts: 3,
          questions: [
            {
              question: "What is the safest practice on a shared device?",
              questionType: "multiple_choice",
              options: [
                "Log out and clear sensitive files after use",
                "Keep accounts signed in for convenience",
                "Share passwords with coworkers",
                "Store personal files on the desktop",
              ],
              correctAnswer: "Log out and clear sensitive files after use",
              points: 2,
              explanation: "This reduces unauthorized access and file leakage.",
            },
            {
              question: "True or false: Browser password saving is recommended on a public workstation.",
              questionType: "true_false",
              correctAnswer: "false",
              points: 1,
              explanation: "Shared devices should not retain credentials.",
            },
          ],
        },
      },
      {
        title: "Records and Scheduling Workflow",
        description: "Capture inquiries accurately and manage schedules using a consistent digital process.",
        order: 2,
        status: "finalized",
        materials: [SAMPLE_PDF, "module-assessment"],
        moduleThumbnail: "/images/course-office.svg",
        moduleDocument: SAMPLE_PDF,
        skillTags: ["records-management", "scheduling", "data-entry"],
        topicTags: ["service-logs", "calendar-management"],
        prerequisiteOrders: [1],
        contentBlocks: [
          {
            id: "records-scheduling-text",
            type: "text",
            title: "Accurate entries",
            content:
              "<p>Front desk records should capture the request, contact detail, action owner, and due time. Good scheduling depends on complete entries and clean handoffs.</p>",
          },
          {
            id: "records-scheduling-material",
            type: "learning_material",
            title: "Daily scheduling template",
            content: "",
            materialUrl: SAMPLE_PDF,
          },
          {
            id: "records-scheduling-quiz",
            type: "quiz",
            title: "Workflow check",
            content: "Which detail is most important to capture when logging a service request?",
            options: [
              "The action owner and due time",
              "The browser wallpaper",
              "The learner's favorite color",
              "The office snack preference",
            ],
            correctAnswer: 0,
            explanation: "Ownership and timing keep requests moving.",
          },
        ],
        assessment: {
          title: "Records and Scheduling Assessment",
          passingScore: 75,
          maxAttempts: 3,
          questions: [
            {
              question: "Why is an action owner important in a service log?",
              questionType: "multiple_choice",
              options: [
                "It clarifies responsibility for the next step",
                "It replaces the request description",
                "It makes duplicate entries easier",
                "It removes the need for schedules",
              ],
              correctAnswer: "It clarifies responsibility for the next step",
              points: 2,
              explanation: "Assigned ownership prevents dropped requests.",
            },
            {
              question: "True or false: Incomplete contact information can delay service follow-up.",
              questionType: "true_false",
              correctAnswer: "true",
              points: 1,
              explanation: "Follow-up depends on complete records.",
            },
          ],
        },
      },
      {
        title: "Customer Messaging and Escalation",
        description: "Write clear status updates and escalate urgent concerns without losing context.",
        order: 3,
        status: "finalized",
        materials: ["module-assessment"],
        moduleThumbnail: "/images/course-office.svg",
        skillTags: ["customer-service", "communication"],
        topicTags: ["status-updates", "escalation"],
        prerequisiteOrders: [2],
        contentBlocks: [
          {
            id: "messaging-escalation-text",
            type: "text",
            title: "Clear updates",
            content:
              "<p>Status updates should tell the client what happened, what happens next, and when they can expect another update. Escalations should include the original concern and all actions taken.</p>",
          },
          {
            id: "messaging-escalation-code",
            type: "code",
            title: "Escalation note example",
            language: "plaintext",
            content:
              "Concern: Walk-in client needs certificate reprint today\nAction taken: Verified identity and searched prior record\nEscalation reason: Original record missing in queue\nOwner: Validation desk\nNext update: 2:00 PM",
          },
          {
            id: "messaging-escalation-quiz",
            type: "quiz",
            title: "Message quality",
            content: "What makes a status update useful to the client?",
            options: [
              "It states the current status and next step clearly",
              "It uses vague wording only",
              "It removes all timelines",
              "It avoids naming the action taken",
            ],
            correctAnswer: 0,
            explanation: "Useful updates reduce confusion and repeat inquiries.",
          },
        ],
        assessment: {
          title: "Customer Messaging Assessment",
          passingScore: 70,
          maxAttempts: 3,
          questions: [
            {
              question: "Which status update is strongest?",
              questionType: "multiple_choice",
              options: [
                "We verified your request and will send the next update by 2:00 PM.",
                "Please wait.",
                "We are busy.",
                "No details available.",
              ],
              correctAnswer: "We verified your request and will send the next update by 2:00 PM.",
              points: 2,
              explanation: "It explains progress and gives a next update time.",
            },
            {
              question: "True or false: An escalation should preserve the context of what already happened.",
              questionType: "true_false",
              correctAnswer: "true",
              points: 1,
              explanation: "Context prevents rework and confusion.",
            },
          ],
        },
      },
    ],
  },
  {
    title: "Social Selling for Micro Business Owners",
    description:
      "Help entrepreneurs define offers, create social selling content, and manage orders with reliable follow-up.",
    category: "Entrepreneurship",
    level: "Intermediate",
    duration: 28,
    thumbnail: "/images/course-business.svg",
    courseDocument: SAMPLE_PDF,
    isTESDAAccredited: true,
    skills: ["Audience Research", "Content Creation", "Pricing", "Order Management"],
    skillTags: ["audience-research", "content-creation", "pricing", "order-management"],
    topicTags: ["social-selling", "micro-business"],
    enrolledCount: 74,
    rating: 4.8,
    certificateType: "completion",
    published: true,
    modules: [
      {
        title: "Define Offer and Audience",
        description: "Clarify the problem solved by the product and identify the most likely buyer segment.",
        order: 1,
        status: "finalized",
        materials: [SAMPLE_PDF, "module-assessment"],
        moduleThumbnail: "/images/course-business.svg",
        moduleDocument: SAMPLE_PDF,
        skillTags: ["audience-research", "offer-design"],
        topicTags: ["customer-needs", "value-proposition"],
        contentBlocks: [
          {
            id: "offer-audience-text",
            type: "text",
            title: "Start with the buyer problem",
            content:
              "<p>A strong social selling offer is clear about who it serves, what problem it solves, and why it is worth the price. When the audience is vague, content and offers become weak.</p>",
          },
          {
            id: "offer-audience-quiz",
            type: "quiz",
            title: "Offer check",
            content: "What is the best starting point when shaping a product offer?",
            options: [
              "The customer's problem or need",
              "The seller's favorite font",
              "A random trend unrelated to the product",
              "The number of social media apps installed",
            ],
            correctAnswer: 0,
            explanation: "Useful offers start from a real buyer need.",
          },
        ],
        assessment: {
          title: "Offer and Audience Assessment",
          passingScore: 70,
          maxAttempts: 3,
          questions: [
            {
              question: "Why is it useful to identify a target buyer segment?",
              questionType: "multiple_choice",
              options: [
                "It helps tailor the message and offer",
                "It removes the need to describe the product",
                "It guarantees instant sales",
                "It makes pricing unnecessary",
              ],
              correctAnswer: "It helps tailor the message and offer",
              points: 2,
              explanation: "Clear targeting improves relevance.",
            },
            {
              question: "True or false: A broad message with no specific buyer can weaken the sales pitch.",
              questionType: "true_false",
              correctAnswer: "true",
              points: 1,
              explanation: "Specificity improves resonance and clarity.",
            },
          ],
        },
      },
      {
        title: "Create Posts That Convert",
        description: "Write product posts with clear value, proof, and calls to action.",
        order: 2,
        status: "finalized",
        materials: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "module-assessment"],
        moduleThumbnail: "/images/course-business.svg",
        skillTags: ["content-creation", "copywriting"],
        topicTags: ["social-posts", "calls-to-action"],
        prerequisiteOrders: [1],
        contentBlocks: [
          {
            id: "convert-posts-text",
            type: "text",
            title: "Simple content formula",
            content:
              "<p>A useful sales post usually includes a clear product outcome, one proof point, and one action for the buyer to take. Avoid clutter and keep the next step obvious.</p>",
          },
          {
            id: "convert-posts-video",
            type: "video",
            title: "Content pacing reference",
            content: "",
            videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
          {
            id: "convert-posts-quiz",
            type: "quiz",
            title: "Post quality",
            content: "Which element helps a social selling post convert better?",
            options: [
              "A clear call to action",
              "Several unrelated hashtags only",
              "No product benefit",
              "An empty caption",
            ],
            correctAnswer: 0,
            explanation: "A clear next step helps buyers act.",
          },
        ],
        assessment: {
          title: "Converting Post Assessment",
          passingScore: 75,
          maxAttempts: 3,
          questions: [
            {
              question: "What should a call to action do in a sales post?",
              questionType: "multiple_choice",
              options: [
                "Tell the buyer the next step",
                "Hide the product price completely",
                "Remove all context",
                "Avoid response prompts",
              ],
              correctAnswer: "Tell the buyer the next step",
              points: 2,
              explanation: "A CTA guides the buyer toward inquiry or purchase.",
            },
            {
              question: "True or false: A strong post can be short as long as the value is clear.",
              questionType: "true_false",
              correctAnswer: "true",
              points: 1,
              explanation: "Clarity matters more than length.",
            },
          ],
        },
      },
      {
        title: "Manage Orders and Follow-Up",
        description: "Track inquiries, confirm payments, and maintain trust with consistent after-sales communication.",
        order: 3,
        status: "finalized",
        materials: [SAMPLE_PDF, "module-assessment"],
        moduleThumbnail: "/images/course-business.svg",
        moduleDocument: SAMPLE_PDF,
        skillTags: ["order-management", "customer-follow-up"],
        topicTags: ["order-tracking", "after-sales"],
        prerequisiteOrders: [2],
        contentBlocks: [
          {
            id: "orders-followup-text",
            type: "text",
            title: "Reliable order handling",
            content:
              "<p>Track the inquiry date, item ordered, payment status, delivery status, and promised update time. Small businesses build repeat sales when buyers trust the follow-up process.</p>",
          },
          {
            id: "orders-followup-material",
            type: "learning_material",
            title: "Order tracking sheet",
            content: "",
            materialUrl: SAMPLE_PDF,
          },
          {
            id: "orders-followup-quiz",
            type: "quiz",
            title: "Operations check",
            content: "Which record helps avoid missed updates for buyers?",
            options: [
              "A log with payment and delivery status",
              "A list of unrelated social pages",
              "Only the product photo folder",
              "A blank notebook page",
            ],
            correctAnswer: 0,
            explanation: "Order logs keep follow-up accurate and timely.",
          },
        ],
        assessment: {
          title: "Order Handling Assessment",
          passingScore: 70,
          maxAttempts: 3,
          questions: [
            {
              question: "What is the main purpose of an order tracking log?",
              questionType: "multiple_choice",
              options: [
                "To monitor status and keep commitments visible",
                "To replace customer communication entirely",
                "To avoid checking payments",
                "To hide delivery issues",
              ],
              correctAnswer: "To monitor status and keep commitments visible",
              points: 2,
              explanation: "A log supports reliable operations and trust.",
            },
            {
              question: "True or false: After-sales follow-up can help create repeat buyers.",
              questionType: "true_false",
              correctAnswer: "true",
              points: 1,
              explanation: "Good follow-up improves trust and repeat purchase likelihood.",
            },
          ],
        },
      },
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

const columnCache = new Map<string, boolean>();

async function columnExists(table: string, column: string) {
  const cacheKey = `${table}.${column}`;
  if (columnCache.has(cacheKey)) {
    return columnCache.get(cacheKey) as boolean;
  }

  const { error } = await supabase.from(table).select(column).limit(1);
  const exists = !error;
  columnCache.set(cacheKey, exists);
  return exists;
}

async function withExistingColumns<T extends Record<string, unknown>>(table: string, values: T) {
  const payload: Record<string, unknown> = {};

  for (const [column, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (await columnExists(table, column)) {
      payload[column] = value;
    }
  }

  return payload;
}

async function ensureInstructorUser() {
  const { data: existingUsers, error: existingUsersError } = await supabase
    .from("users")
    .select("id, email, role")
    .in("role", ["trainer", "spd", "admin"])
    .order("created_at", { ascending: true })
    .limit(1);

  if (existingUsersError) {
    throw existingUsersError;
  }

  const existingInstructorId = existingUsers?.[0]?.id;
  if (existingInstructorId) {
    return existingInstructorId;
  }

  const fallbackUser = {
    email: "trainer@peso.academy",
    password: "trainer123",
    name: "Trainer Maria",
    role: "trainer",
    phone: "+63 912 345 6787",
    address: "Manila, Philippines",
    skills: ["Training", "Course Development", "Education"],
  };

  const authLookup = await supabase.auth.admin.getUserByEmail(fallbackUser.email);
  let userId = authLookup.data.user?.id;

  if (!userId) {
    const created = await supabase.auth.admin.createUser({
      email: fallbackUser.email,
      password: fallbackUser.password,
      email_confirm: true,
      user_metadata: {
        name: fallbackUser.name,
        role: fallbackUser.role,
      },
    });

    if (created.error || !created.data.user) {
      throw created.error || new Error("Failed to create fallback trainer account.");
    }

    userId = created.data.user.id;
  }

  const { error: profileError } = await supabase.from("users").upsert(
    {
      id: userId,
      email: fallbackUser.email,
      name: fallbackUser.name,
      role: fallbackUser.role,
      phone: fallbackUser.phone,
      address: fallbackUser.address,
      skills: fallbackUser.skills,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (profileError) {
    throw profileError;
  }

  return userId;
}

async function upsertCourse(course: CourseSeed, instructorId: string) {
  const now = new Date().toISOString();
  const basePayload = {
    title: course.title,
    description: course.description,
    category: course.category,
    level: course.level,
    duration: course.duration,
    instructor_id: instructorId,
    thumbnail: course.thumbnail,
    course_document: course.courseDocument,
    is_tesda_accredited: course.isTESDAAccredited,
    skills: course.skills,
    enrolled_count: course.enrolledCount,
    rating: course.rating,
    certificate_type: course.certificateType,
    published: course.published,
    skill_tags: course.skillTags,
    topic_tags: course.topicTags,
    updated_at: now,
  };

  const { data: existingCourse, error: existingCourseError } = await supabase
    .from("courses")
    .select("id")
    .eq("title", course.title)
    .limit(1);

  if (existingCourseError) {
    throw existingCourseError;
  }

  const payload = await withExistingColumns("courses", basePayload);

  if (existingCourse && existingCourse.length > 0) {
    const courseId = existingCourse[0].id;
    const { error: updateError } = await supabase.from("courses").update(payload).eq("id", courseId);
    if (updateError) {
      throw updateError;
    }
    return courseId;
  }

  const insertPayload = {
    ...payload,
    created_at: now,
  };

  const { data: insertedCourse, error: insertError } = await supabase
    .from("courses")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError || !insertedCourse) {
    throw insertError || new Error(`Failed to insert course ${course.title}.`);
  }

  return insertedCourse.id;
}

async function upsertModule(courseId: string, module: ModuleSeed) {
  const now = new Date().toISOString();
  const basePayload = {
    course_id: courseId,
    title: module.title,
    description: module.description,
    order: module.order,
    content: JSON.stringify(module.contentBlocks),
    materials: module.materials,
    prerequisites: [],
    module_thumbnail: module.moduleThumbnail,
    module_document: module.moduleDocument,
    status: module.status,
    skill_tags: module.skillTags,
    topic_tags: module.topicTags,
    updated_at: now,
  };

  const { data: existingModules, error: existingModulesError } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", courseId)
    .eq("title", module.title)
    .limit(1);

  if (existingModulesError) {
    throw existingModulesError;
  }

  const payload = await withExistingColumns("modules", basePayload);

  if (existingModules && existingModules.length > 0) {
    const moduleId = existingModules[0].id;
    const { error: updateError } = await supabase.from("modules").update(payload).eq("id", moduleId);
    if (updateError) {
      throw updateError;
    }
    return moduleId;
  }

  const insertPayload = {
    ...payload,
    created_at: now,
  };

  const { data: insertedModule, error: insertError } = await supabase
    .from("modules")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError || !insertedModule) {
    throw insertError || new Error(`Failed to insert module ${module.title}.`);
  }

  return insertedModule.id;
}

async function updateModulePrerequisites(moduleId: string, prerequisiteIds: string[]) {
  const payload = await withExistingColumns("modules", { prerequisites: prerequisiteIds, updated_at: new Date().toISOString() });
  const { error } = await supabase.from("modules").update(payload).eq("id", moduleId);
  if (error) {
    throw error;
  }
}

async function upsertAssessment(moduleId: string, assessment: AssessmentSeed) {
  const now = new Date().toISOString();
  const { data: existingAssessment, error: existingAssessmentError } = await supabase
    .from("assessments")
    .select("id")
    .eq("module_id", moduleId)
    .limit(1);

  if (existingAssessmentError) {
    throw existingAssessmentError;
  }

  const basePayload = {
    module_id: moduleId,
    title: assessment.title,
    description: assessment.description || null,
    time_limit: assessment.timeLimit || null,
    passing_score: assessment.passingScore,
    max_attempts: assessment.maxAttempts,
    is_active: true,
    updated_at: now,
  };

  let assessmentId: string;

  if (existingAssessment && existingAssessment.length > 0) {
    assessmentId = existingAssessment[0].id;
    const { error: updateError } = await supabase.from("assessments").update(basePayload).eq("id", assessmentId);
    if (updateError) {
      throw updateError;
    }
  } else {
    const { data: insertedAssessment, error: insertError } = await supabase
      .from("assessments")
      .insert({
        ...basePayload,
        created_at: now,
      })
      .select("id")
      .single();

    if (insertError || !insertedAssessment) {
      throw insertError || new Error(`Failed to insert assessment ${assessment.title}.`);
    }

    assessmentId = insertedAssessment.id;
  }

  const { error: deleteQuestionsError } = await supabase.from("assessment_questions").delete().eq("assessment_id", assessmentId);
  if (deleteQuestionsError) {
    throw deleteQuestionsError;
  }

  const questionRows = assessment.questions.map((question, index) => ({
    assessment_id: assessmentId,
    question: question.question,
    question_type: question.questionType,
    options: question.options || null,
    correct_answer: question.correctAnswer || null,
    points: question.points,
    order: index + 1,
    explanation: question.explanation || null,
    created_at: now,
  }));

  if (questionRows.length > 0) {
    const { error: questionInsertError } = await supabase.from("assessment_questions").insert(questionRows);
    if (questionInsertError) {
      throw questionInsertError;
    }
  }

  return assessmentId;
}

async function main() {
  const instructorId = await ensureInstructorUser();

  let courseCount = 0;
  let moduleCount = 0;
  let assessmentCount = 0;
  let questionCount = 0;

  for (const course of COURSE_SEEDS) {
    const courseId = await upsertCourse(course, instructorId);
    courseCount += 1;

    const moduleIdsByOrder = new Map<number, string>();

    for (const module of course.modules) {
      const moduleId = await upsertModule(courseId, module);
      moduleIdsByOrder.set(module.order, moduleId);
      moduleCount += 1;
    }

    for (const module of course.modules) {
      const moduleId = moduleIdsByOrder.get(module.order);
      if (!moduleId) {
        throw new Error(`Missing module id for ${course.title} / ${module.title}.`);
      }

      const prerequisiteIds = (module.prerequisiteOrders || [])
        .map((order) => moduleIdsByOrder.get(order))
        .filter((value): value is string => Boolean(value));

      await updateModulePrerequisites(moduleId, prerequisiteIds);

      if (module.assessment) {
        await upsertAssessment(moduleId, module.assessment);
        assessmentCount += 1;
        questionCount += module.assessment.questions.length;
      }
    }
  }

  console.log("Seed complete.");
  console.log(`Courses: ${courseCount}`);
  console.log(`Modules: ${moduleCount}`);
  console.log(`Assessments: ${assessmentCount}`);
  console.log(`Questions: ${questionCount}`);
}

main().catch((error) => {
  console.error("Course content seed failed:", error);
  process.exit(1);
});