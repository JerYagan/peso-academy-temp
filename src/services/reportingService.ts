import { supabase, handleSupabaseError } from "@/lib/supabase";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

if (!supabase) {
  console.warn("Supabase client not initialized. Please set up environment variables.");
}

/**
 * Reporting Service
 * Handles all reporting and analytics data aggregation
 */

export interface CompletionReport {
  courseId: string;
  courseTitle: string;
  totalEnrollments: number;
  completedEnrollments: number;
  completionRate: number;
  averageProgress: number;
  averageTimeSpent: number; // in minutes
  completionTrends: Array<{
    date: string;
    completions: number;
  }>;
}

export interface UserActivityReport {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  totalEnrollments: number;
  completedCourses: number;
  totalTimeSpent: number; // in minutes
  lastActivityDate: string | null;
  certificatesEarned: number;
}

export interface CertificateReport {
  certificateId: string;
  certificateNumber: string;
  userId: string;
  userName: string;
  courseTitle: string;
  certificateType: string;
  issuedDate: string;
  verificationCode: string | null;
}

export interface ComplianceReportData {
  period: string;
  totalTrainings: number;
  totalParticipants: number;
  totalCompletions: number;
  completionRate: number;
  tesdaAccreditedTrainings: number;
  certificatesIssued: number;
  averageTrainingDuration: number;
  courses: Array<{
    courseTitle: string;
    participants: number;
    completions: number;
    completionRate: number;
  }>;
}

export interface EnrollmentReport {
  enrollmentId: string;
  userId: string;
  userName: string;
  courseId: string;
  courseTitle: string;
  enrolledDate: string;
  completedDate: string | null;
  progress: number;
  status: string;
  timeSpent: number; // in minutes
}

export const reportingService = {
  /**
   * Get training completion reports
   */
  getCompletionReports: async (
    startDate?: Date,
    endDate?: Date,
    courseId?: string
  ): Promise<CompletionReport[]> => {
    if (!supabase) return [];

    try {
      // Build date filter
      let enrollmentsQuery = supabase
        .from("enrollments")
        .select(`
          id,
          course_id,
          progress,
          status,
          completed_at,
          courses:course_id (
            id,
            title
          )
        `);

      if (startDate) {
        enrollmentsQuery = enrollmentsQuery.gte("enrolled_at", startDate.toISOString());
      }
      if (endDate) {
        enrollmentsQuery = enrollmentsQuery.lte("enrolled_at", endDate.toISOString());
      }
      if (courseId) {
        enrollmentsQuery = enrollmentsQuery.eq("course_id", courseId);
      }

      const { data: enrollments, error } = await enrollmentsQuery;

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      if (!enrollments) return [];

      // Group by course
      const courseMap = new Map<string, CompletionReport>();

      for (const enrollment of enrollments) {
        const course = enrollment.courses as any;
        if (!course) continue;

        const courseId = course.id;
        const courseTitle = course.title;

        if (!courseMap.has(courseId)) {
          courseMap.set(courseId, {
            courseId,
            courseTitle,
            totalEnrollments: 0,
            completedEnrollments: 0,
            completionRate: 0,
            averageProgress: 0,
            averageTimeSpent: 0,
            completionTrends: [],
          });
        }

        const report = courseMap.get(courseId)!;
        report.totalEnrollments++;
        if (enrollment.status === "completed" || enrollment.progress === 100) {
          report.completedEnrollments++;
        }
      }

      // Calculate averages and get time spent data
      for (const [courseId, report] of courseMap.entries()) {
        report.completionRate =
          report.totalEnrollments > 0
            ? Math.round((report.completedEnrollments / report.totalEnrollments) * 100)
            : 0;

        // Get average progress
        const courseEnrollments = enrollments.filter((e) => e.course_id === courseId);
        const totalProgress = courseEnrollments.reduce((sum, e) => sum + (e.progress || 0), 0);
        report.averageProgress =
          courseEnrollments.length > 0 ? Math.round(totalProgress / courseEnrollments.length) : 0;

        // Get time spent data
        const { data: completions } = await supabase
          .from("module_completions")
          .select("time_spent, enrollment_id")
          .in(
            "enrollment_id",
            courseEnrollments.map((e) => e.id)
          );

        const totalTimeSpent = completions?.reduce((sum, c) => sum + (c.time_spent || 0), 0) || 0;
        const uniqueEnrollments = new Set(completions?.map((c) => c.enrollment_id) || []).size;
        report.averageTimeSpent =
          uniqueEnrollments > 0 ? Math.round(totalTimeSpent / uniqueEnrollments) : 0;

        // Get completion trends (last 30 days)
        const trendStartDate = subDays(new Date(), 30);
        const completedEnrollments = courseEnrollments.filter(
          (e) => e.status === "completed" && e.completed_at
        );

        const trendsMap = new Map<string, number>();
        completedEnrollments.forEach((e) => {
          if (e.completed_at) {
            const date = format(new Date(e.completed_at), "yyyy-MM-dd");
            trendsMap.set(date, (trendsMap.get(date) || 0) + 1);
          }
        });

        report.completionTrends = Array.from(trendsMap.entries())
          .map(([date, completions]) => ({ date, completions }))
          .sort((a, b) => a.date.localeCompare(b.date));
      }

      return Array.from(courseMap.values());
    } catch (error) {
      console.error("Error getting completion reports:", error);
      return [];
    }
  },

  /**
   * Get user activity reports
   */
  getUserActivityReports: async (
    startDate?: Date,
    endDate?: Date,
    role?: string
  ): Promise<UserActivityReport[]> => {
    if (!supabase) return [];

    try {
      let usersQuery = supabase.from("users").select("id, name, email, role, created_at");

      if (role) {
        usersQuery = usersQuery.eq("role", role);
      }

      const { data: users, error: usersError } = await usersQuery;

      if (usersError) {
        handleSupabaseError(usersError);
        return [];
      }

      if (!users) return [];

      const reports: UserActivityReport[] = [];

      for (const user of users) {
        // Get enrollments
        let enrollmentsQuery = supabase
          .from("enrollments")
          .select("id, progress, status, completed_at, updated_at")
          .eq("user_id", user.id);

        if (startDate) {
          enrollmentsQuery = enrollmentsQuery.gte("enrolled_at", startDate.toISOString());
        }
        if (endDate) {
          enrollmentsQuery = enrollmentsQuery.lte("enrolled_at", endDate.toISOString());
        }

        const { data: enrollments } = await enrollmentsQuery;

        const totalEnrollments = enrollments?.length || 0;
        const completedCourses = enrollments?.filter((e) => e.status === "completed").length || 0;

        // Get time spent
        const enrollmentIds = enrollments?.map((e) => e.id) || [];
        let totalTimeSpent = 0;
        if (enrollmentIds.length > 0) {
          const { data: completions } = await supabase
            .from("module_completions")
            .select("time_spent")
            .in("enrollment_id", enrollmentIds);

          totalTimeSpent = completions?.reduce((sum, c) => sum + (c.time_spent || 0), 0) || 0;
        }

        // Get last activity
        const lastActivityDates = enrollments
          ?.map((e) => e.updated_at)
          .filter((d) => d !== null) || [];
        const lastActivityDate =
          lastActivityDates.length > 0
            ? lastActivityDates.sort().reverse()[0]
            : user.created_at;

        // Get certificates
        const { data: certificates } = await supabase
          .from("certificates")
          .select("id")
          .eq("user_id", user.id);

        reports.push({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          role: user.role,
          totalEnrollments,
          completedCourses,
          totalTimeSpent,
          lastActivityDate,
          certificatesEarned: certificates?.length || 0,
        });
      }

      return reports;
    } catch (error) {
      console.error("Error getting user activity reports:", error);
      return [];
    }
  },

  /**
   * Get certificate issuance reports
   */
  getCertificateReports: async (
    startDate?: Date,
    endDate?: Date,
    certificateType?: string
  ): Promise<CertificateReport[]> => {
    if (!supabase) return [];

    try {
      let certificatesQuery = supabase
        .from("certificates")
        .select(`
          id,
          certificate_number,
          user_id,
          course_title,
          certificate_type,
          issued_at,
          verification_code,
          users:user_id (name)
        `)
        .order("issued_at", { ascending: false });

      if (startDate) {
        certificatesQuery = certificatesQuery.gte("issued_at", startDate.toISOString());
      }
      if (endDate) {
        certificatesQuery = certificatesQuery.lte("issued_at", endDate.toISOString());
      }
      if (certificateType) {
        certificatesQuery = certificatesQuery.eq("certificate_type", certificateType);
      }

      const { data: certificates, error } = await certificatesQuery;

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      if (!certificates) return [];

      return certificates.map((cert: any) => ({
        certificateId: cert.id,
        certificateNumber: cert.certificate_number,
        userId: cert.user_id,
        userName: cert.users?.name || "Unknown",
        courseTitle: cert.course_title,
        certificateType: cert.certificate_type,
        issuedDate: cert.issued_at,
        verificationCode: cert.verification_code,
      }));
    } catch (error) {
      console.error("Error getting certificate reports:", error);
      return [];
    }
  },

  /**
   * Get compliance reports (DOLE/LGU format)
   */
  getComplianceReport: async (
    period: "month" | "quarter" | "year",
    periodStart?: Date
  ): Promise<ComplianceReportData | null> => {
    if (!supabase) return null;

    try {
      let startDate: Date;
      let endDate: Date;
      let periodLabel: string;

      const now = periodStart || new Date();

      if (period === "month") {
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        periodLabel = format(now, "MMMM yyyy");
      } else if (period === "quarter") {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        periodLabel = `Q${quarter + 1} ${now.getFullYear()}`;
      } else {
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        periodLabel = format(now, "yyyy");
      }

      // Get enrollments in period (include user_id so Total Participants = unique users)
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`
          id,
          user_id,
          course_id,
          status,
          completed_at,
          courses:course_id (
            id,
            title,
            is_tesda_accredited,
            duration
          )
        `)
        .gte("enrolled_at", startDate.toISOString())
        .lte("enrolled_at", endDate.toISOString());

      if (!enrollments) return null;

      // Exclude dropped so summary and course breakdown match active participants only
      const activeEnrollments = enrollments.filter((e: any) => e.status !== "dropped");

      const uniqueUsers = new Set(activeEnrollments.map((e: any) => e.user_id));
      const completedEnrollments = activeEnrollments.filter((e: any) => e.status === "completed");

      // Get courses data (from active enrollments only)
      const courseMap = new Map<string, any>();
      activeEnrollments.forEach((e: any) => {
        const course = e.courses as any;
        if (!course) return;

        if (!courseMap.has(course.id)) {
          courseMap.set(course.id, {
            courseTitle: course.title,
            participants: 0,
            completions: 0,
            completionRate: 0,
          });
        }

        const courseData = courseMap.get(course.id)!;
        courseData.participants++;
        if (e.status === "completed") {
          courseData.completions++;
        }
      });

      // Calculate completion rates
      courseMap.forEach((courseData) => {
        courseData.completionRate =
          courseData.participants > 0
            ? Math.round((courseData.completions / courseData.participants) * 100)
            : 0;
      });

      // Get TESDA supported courses (from active enrollments)
      const tesdaCourses = activeEnrollments.filter(
        (e: any) => (e.courses as any)?.is_tesda_accredited === true
      );
      const uniqueTesdaCourses = new Set(tesdaCourses.map((e) => e.course_id));

      // Get certificates issued
      const { data: certificates } = await supabase
        .from("certificates")
        .select("id")
        .gte("issued_at", startDate.toISOString())
        .lte("issued_at", endDate.toISOString());

      // Calculate average duration (from courses in active enrollments)
      const coursesWithDuration = activeEnrollments
        .map((e: any) => (e.courses as any)?.duration)
        .filter((d) => d !== null && d !== undefined);
      const averageDuration =
        coursesWithDuration.length > 0
          ? Math.round(
              coursesWithDuration.reduce((sum, d) => sum + Number(d), 0) /
                coursesWithDuration.length
            )
          : 0;

      return {
        period: periodLabel,
        totalTrainings: courseMap.size,
        totalParticipants: uniqueUsers.size,
        totalCompletions: completedEnrollments.length,
        completionRate:
          activeEnrollments.length > 0
            ? Math.round((completedEnrollments.length / activeEnrollments.length) * 100)
            : 0,
        tesdaAccreditedTrainings: uniqueTesdaCourses.size,
        certificatesIssued: certificates?.length || 0,
        averageTrainingDuration: averageDuration,
        courses: Array.from(courseMap.values()),
      };
    } catch (error) {
      console.error("Error getting compliance report:", error);
      return null;
    }
  },

  /**
   * Get enrollment reports
   */
  getEnrollmentReports: async (
    startDate?: Date,
    endDate?: Date,
    courseId?: string,
    status?: string
  ): Promise<EnrollmentReport[]> => {
    if (!supabase) return [];

    try {
      let enrollmentsQuery = supabase
        .from("enrollments")
        .select(`
          id,
          user_id,
          course_id,
          progress,
          status,
          enrolled_at,
          completed_at,
          courses:course_id (title),
          users:user_id (name)
        `)
        .order("enrolled_at", { ascending: false });

      if (startDate) {
        enrollmentsQuery = enrollmentsQuery.gte("enrolled_at", startDate.toISOString());
      }
      if (endDate) {
        enrollmentsQuery = enrollmentsQuery.lte("enrolled_at", endDate.toISOString());
      }
      if (courseId) {
        enrollmentsQuery = enrollmentsQuery.eq("course_id", courseId);
      }
      if (status) {
        enrollmentsQuery = enrollmentsQuery.eq("status", status);
      }

      const { data: enrollments, error } = await enrollmentsQuery;

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      if (!enrollments) return [];

      const reports: EnrollmentReport[] = [];

      for (const enrollment of enrollments) {
        const course = enrollment.courses as any;
        const user = enrollment.users as any;

        // Get time spent
        const { data: completions } = await supabase
          .from("module_completions")
          .select("time_spent")
          .eq("enrollment_id", enrollment.id);

        const timeSpent =
          completions?.reduce((sum, c) => sum + (c.time_spent || 0), 0) || 0;

        reports.push({
          enrollmentId: enrollment.id,
          userId: enrollment.user_id,
          userName: user?.name || "Unknown",
          courseId: enrollment.course_id,
          courseTitle: course?.title || "Unknown Course",
          enrolledDate: enrollment.enrolled_at,
          completedDate: enrollment.completed_at || null,
          progress: enrollment.progress || 0,
          status: enrollment.status,
          timeSpent,
        });
      }

      return reports;
    } catch (error) {
      console.error("Error getting enrollment reports:", error);
      return [];
    }
  },
};

