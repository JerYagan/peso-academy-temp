import { Course, Enrollment, Certificate } from "@/types";

// Mock Courses
export const mockCourses: Course[] = [
  {
    id: "1",
    title: "Digital Skills Fundamentals",
    description: "Learn essential digital skills including computer basics, internet navigation, and productivity tools.",
    category: "Digital Skills",
    level: "Beginner",
    duration: 40,
    instructor: "Trainer Maria",
    instructorId: "3",
    isTESDAAccredited: true,
    skills: ["Computer Basics", "Microsoft Office", "Internet Navigation"],
    enrolledCount: 1250,
    rating: 4.5,
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    title: "Web Development Basics",
    description: "Introduction to HTML, CSS, and JavaScript for building modern websites.",
    category: "Technical Skills",
    level: "Beginner",
    duration: 60,
    instructor: "Trainer Maria",
    instructorId: "3",
    isTESDAAccredited: true,
    skills: ["HTML", "CSS", "JavaScript", "Web Development"],
    enrolledCount: 850,
    rating: 4.7,
    createdAt: "2024-02-01",
  },
  {
    id: "3",
    title: "Customer Service Excellence",
    description: "Master the art of customer service and communication skills for service industry roles.",
    category: "Employability Skills",
    level: "Intermediate",
    duration: 30,
    instructor: "Trainer Maria",
    instructorId: "3",
    isTESDAAccredited: true,
    skills: ["Communication", "Customer Service", "Problem Solving"],
    enrolledCount: 2100,
    rating: 4.6,
    createdAt: "2024-01-20",
  },
  {
    id: "4",
    title: "Entrepreneurship Fundamentals",
    description: "Learn how to start and manage your own business, from idea to execution.",
    category: "Entrepreneurship",
    level: "Intermediate",
    duration: 50,
    instructor: "Trainer Maria",
    instructorId: "3",
    isTESDAAccredited: true,
    skills: ["Business Planning", "Marketing", "Financial Management"],
    enrolledCount: 650,
    rating: 4.4,
    createdAt: "2024-02-10",
  },
  {
    id: "5",
    title: "Data Entry and Office Administration",
    description: "Essential skills for office work including data entry, filing, and administrative tasks.",
    category: "Employability Skills",
    level: "Beginner",
    duration: 35,
    instructor: "Trainer Maria",
    instructorId: "3",
    isTESDAAccredited: true,
    skills: ["Data Entry", "Office Administration", "Organization"],
    enrolledCount: 1800,
    rating: 4.5,
    createdAt: "2024-01-25",
  },
  {
    id: "6",
    title: "Mobile App Development",
    description: "Build mobile applications using modern frameworks and tools.",
    category: "Technical Skills",
    level: "Advanced",
    duration: 80,
    instructor: "Trainer Maria",
    instructorId: "3",
    isTESDAAccredited: true,
    skills: ["Mobile Development", "React Native", "API Integration"],
    enrolledCount: 320,
    rating: 4.8,
    createdAt: "2024-02-15",
  },
];

// Mock Enrollments (for user ID 1 - jobseeker)
export const mockEnrollments: Enrollment[] = [
  {
    id: "1",
    userId: "1",
    courseId: "1",
    progress: 75,
    status: "in-progress",
    enrolledAt: "2024-02-01",
  },
  {
    id: "2",
    userId: "1",
    courseId: "3",
    progress: 100,
    status: "completed",
    enrolledAt: "2024-01-20",
    completedAt: "2024-02-15",
    certificateId: "cert-001",
  },
];

// Mock Certificates
export const mockCertificates: Certificate[] = [
  {
    id: "cert-001",
    userId: "1",
    courseId: "3",
    courseTitle: "Customer Service Excellence",
    issuedAt: "2024-02-15",
    certificateNumber: "TESDA-CS-2024-001",
  },
];

// Storage keys
const COURSES_KEY = "peso_academy_courses";
const ENROLLMENTS_KEY = "peso_academy_enrollments";
const CERTIFICATES_KEY = "peso_academy_certificates";

// Initialize mock data in localStorage
export const initializeMockData = () => {
  if (!localStorage.getItem(COURSES_KEY)) {
    localStorage.setItem(COURSES_KEY, JSON.stringify(mockCourses));
  }
  if (!localStorage.getItem(ENROLLMENTS_KEY)) {
    localStorage.setItem(ENROLLMENTS_KEY, JSON.stringify(mockEnrollments));
  }
  if (!localStorage.getItem(CERTIFICATES_KEY)) {
    localStorage.setItem(CERTIFICATES_KEY, JSON.stringify(mockCertificates));
  }
};

// Data service functions
export const dataService = {
  getCourses: (): Course[] => {
    initializeMockData();
    const stored = localStorage.getItem(COURSES_KEY);
    return stored ? JSON.parse(stored) : mockCourses;
  },

  getCourse: (id: string): Course | undefined => {
    const courses = dataService.getCourses();
    return courses.find((c) => c.id === id);
  },

  getEnrollments: (userId?: string): Enrollment[] => {
    initializeMockData();
    const stored = localStorage.getItem(ENROLLMENTS_KEY);
    const enrollments = stored ? JSON.parse(stored) : mockEnrollments;
    return userId ? enrollments.filter((e: Enrollment) => e.userId === userId) : enrollments;
  },

  enrollInCourse: (userId: string, courseId: string): Enrollment => {
    const enrollments = dataService.getEnrollments();
    const newEnrollment: Enrollment = {
      id: Date.now().toString(),
      userId,
      courseId,
      progress: 0,
      status: "enrolled",
      enrolledAt: new Date().toISOString(),
    };
    enrollments.push(newEnrollment);
    localStorage.setItem(ENROLLMENTS_KEY, JSON.stringify(enrollments));
    return newEnrollment;
  },

  updateEnrollment: (enrollmentId: string, updates: Partial<Enrollment>): void => {
    const enrollments = dataService.getEnrollments();
    const index = enrollments.findIndex((e) => e.id === enrollmentId);
    if (index !== -1) {
      enrollments[index] = { ...enrollments[index], ...updates };
      localStorage.setItem(ENROLLMENTS_KEY, JSON.stringify(enrollments));
    }
  },

  getCertificates: (userId?: string): Certificate[] => {
    initializeMockData();
    const stored = localStorage.getItem(CERTIFICATES_KEY);
    const certificates = stored ? JSON.parse(stored) : mockCertificates;
    return userId ? certificates.filter((c: Certificate) => c.userId === userId) : certificates;
  },

  issueCertificate: (userId: string, courseId: string, courseTitle: string): Certificate => {
    const certificates = dataService.getCertificates();
    const newCertificate: Certificate = {
      id: `cert-${Date.now()}`,
      userId,
      courseId,
      courseTitle,
      issuedAt: new Date().toISOString(),
      certificateNumber: `TESDA-${courseId.toUpperCase()}-${Date.now()}`,
    };
    certificates.push(newCertificate);
    localStorage.setItem(CERTIFICATES_KEY, JSON.stringify(certificates));
    return newCertificate;
  },

  createCourse: (course: Omit<Course, "id" | "createdAt" | "enrolledCount" | "rating">): Course => {
    const courses = dataService.getCourses();
    const newCourse: Course = {
      ...course,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      enrolledCount: 0,
      rating: 0,
    };
    courses.push(newCourse);
    localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
    return newCourse;
  },
};

