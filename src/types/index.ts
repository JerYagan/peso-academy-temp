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
}

