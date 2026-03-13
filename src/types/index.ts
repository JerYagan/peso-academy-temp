export interface Program {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  createdBy?: string | null;
  courseCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseTrainerSummary {
  id?: string | null;
  displayName: string;
  roleLabel: string;
  email?: string | null;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  programId?: string | null;
  programTitle?: string | null;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: number; // hours
  instructor: string;
  instructorId: string;
  assignedTrainer?: CourseTrainerSummary | null;
  thumbnail?: string;
  courseDocument?: string; // URL to uploaded PDF/PPTX document
  isTESDAAccredited: boolean;
  skills: string[];
  topicTags?: string[];
  industryTags?: string[];
  careerPaths?: string[];
  enrolledCount: number;
  rating: number;
  createdAt: string;
  /** When false, course is hidden from trainee Browse Courses; only trainers/admins see it */
  published?: boolean;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  progress: number; // 0-100
  status: "enrolled" | "in-progress" | "completed" | "dropped";
  enrolledAt: string;
  completedAt?: string;
  certificateId?: string;
  sourceRecommendationId?: string;
  completionApprovalStatus?: "not_ready" | "pending" | "approved" | "needs_revision";
  completionRequestedAt?: string;
  completionReviewedAt?: string;
  completionReviewedBy?: string;
  completionFeedback?: string;
  creditedDurationHours?: number;
  actualLearningMinutes?: number;
  lastActivityAt?: string;
}

export interface EnrollmentModuleProgress {
  module: Module;
  completed: boolean;
  completedAt?: string;
  timeSpent?: number;
  blockedByModuleIds: string[];
}

export interface EnrollmentAssessmentProgress {
  assessmentId: string;
  moduleId: string;
  assessmentTitle: string;
  latestAttemptId?: string;
  requiresManualReview: boolean;
  submittedAt?: string;
  reviewStatus?: "submitted" | "under_review" | "needs_revision" | "approved";
  passed?: boolean;
  score?: number;
}

export interface EnrollmentProgressDetail {
  enrollment: Enrollment;
  course: Course | null;
  modules: EnrollmentModuleProgress[];
  assessments: EnrollmentAssessmentProgress[];
}

export type ModuleStatus = "draft" | "finalized";

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string;
  order: number;
  content?: string;
  materials: string[]; // Array of file URLs or material references
  prerequisites: string[]; // Array of module IDs that must be completed first
  module_thumbnail?: string; // Optional thumbnail shown in module management and previews
  module_document?: string; // URL to the module document (PDF/PPTX)
  skillTags?: string[];
  topicTags?: string[];
  created_at: string;
  /** When set, last update time (for "Last modified" in Module Management) */
  updated_at?: string;
  /** draft = saved but not finalized; finalized = ready for learners */
  status?: ModuleStatus;
}

export interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  issuedAt: string;
  certificateNumber: string;
  certificateType?: "completion" | "participation";
  verificationCode?: string;
  issuedBy?: string;
  /** Course category for display (e.g. "AI & Data Science") */
  courseCategory?: string;
  /** Course thumbnail URL for certificate card */
  courseThumbnail?: string;
}

export interface Submission {
  id: string;
  enrollment_id: string;
  course_id: string | null; // Retrieved through enrollment relationship
  user_id: string;
  submission_type: "completion" | "assignment" | "assessment";
  title: string;
  description?: string;
  content: Record<string, any>;
  attachments: Array<{ url: string; name: string; type?: string }>;
  status: "pending" | "under_review" | "approved" | "rejected" | "revision_requested";
  priority: "low" | "normal" | "high" | "urgent";
  submitted_at: string;
  created_at: string;
  updated_at: string;
  // Joined data
  user_name?: string;
  user_email?: string;
  course_title?: string;
}

export interface Validation {
  id: string;
  submission_id: string;
  validator_id: string | null;
  validation_type: "review" | "approval" | "rejection" | "revision";
  status: "pending" | "in_progress" | "completed";
  decision: "approved" | "rejected" | "revision_requested" | null;
  feedback?: string;
  rating?: number;
  metadata: Record<string, any>;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  validator_name?: string;
  validator_email?: string;
}

export interface Feedback {
  id: string;
  validation_id: string;
  submission_id: string;
  validator_id: string | null;
  feedback_type: "general" | "technical" | "content" | "improvement";
  title?: string;
  content: string;
  template_id?: string;
  rating?: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  validator_name?: string;
}

export interface FeedbackTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

