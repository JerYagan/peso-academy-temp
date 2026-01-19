export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: number; // hours
  instructor: string;
  instructorId: string;
  thumbnail?: string;
  isTESDAAccredited: boolean;
  skills: string[];
  enrolledCount: number;
  rating: number;
  createdAt: string;
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
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string;
  order: number;
  content?: string;
  materials: string[]; // Array of file URLs or material references
  prerequisites: string[]; // Array of module IDs that must be completed first
  created_at: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: "Full-time" | "Part-time" | "Contract";
  salary?: string;
  description: string;
  requirements: string[];
  skills: string[];
  postedBy: string; // employer ID
  postedAt: string;
  status: "open" | "closed";
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

