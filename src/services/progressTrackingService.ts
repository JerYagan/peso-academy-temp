import { supabase, handleSupabaseError } from "@/lib/supabase";

export interface ProgressStats {
  totalTimeSpent: number; // in minutes
  averageTimePerModule: number; // in minutes
  modulesCompleted: number;
  totalModules: number;
  completionPercentage: number;
  lastActivityAt: string | null;
  timeSpentByModule: Array<{
    moduleId: string;
    moduleTitle: string;
    timeSpent: number; // in minutes
    completedAt: string | null;
  }>;
}

export interface CourseProgress {
  courseId: string;
  courseTitle: string;
  progress: number;
  timeSpent: number;
  modulesCompleted: number;
  totalModules: number;
  lastActivityAt: string | null;
  enrolledAt: string;
}

export const progressTrackingService = {
  /**
   * Track time spent on a module (incrementally)
   */
  trackModuleTime: async (
    enrollmentId: string,
    moduleId: string,
    timeSpentSeconds: number
  ): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    // Get existing time spent
    const { data: existing } = await supabase
      .from("module_completions")
      .select("time_spent")
      .eq("enrollment_id", enrollmentId)
      .eq("module_id", moduleId)
      .single();

    const currentTimeSpent = existing?.time_spent || 0; // in minutes
    const newTimeSpent = currentTimeSpent + Math.round(timeSpentSeconds / 60); // Convert to minutes

    // Update or insert
    if (existing) {
      await supabase
        .from("module_completions")
        .update({ time_spent: newTimeSpent })
        .eq("enrollment_id", enrollmentId)
        .eq("module_id", moduleId);
    } else {
      await supabase.from("module_completions").insert({
        enrollment_id: enrollmentId,
        module_id: moduleId,
        time_spent: newTimeSpent,
        completed_at: null, // Not completed yet, just tracking time
      });
    }

    // Update last activity
    await supabase
      .from("enrollments")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", enrollmentId);
  },

  /**
   * Update last activity timestamp for an enrollment
   */
  updateLastActivity: async (enrollmentId: string): Promise<void> => {
    if (!supabase) return;

    await supabase
      .from("enrollments")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", enrollmentId);
  },

  /**
   * Get detailed progress statistics for an enrollment
   */
  getProgressStats: async (enrollmentId: string): Promise<ProgressStats | null> => {
    if (!supabase) {
      return null;
    }

    try {
      // Get enrollment and course info
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("course_id, updated_at")
        .eq("id", enrollmentId)
        .single();

      if (!enrollment) return null;

      const { data: course } = await supabase
        .from("courses")
        .select("id, title")
        .eq("id", enrollment.course_id)
        .single();

      if (!course) return null;

      // Get all modules for the course
      const { data: modules } = await supabase
        .from("modules")
        .select("id, title")
        .eq("course_id", enrollment.course_id)
        .order("order", { ascending: true });

      if (!modules) return null;

      // Get all completions with time spent
      const { data: completions } = await supabase
        .from("module_completions")
        .select("module_id, time_spent, completed_at")
        .eq("enrollment_id", enrollmentId);

      const completedModules = completions?.filter((c) => c.completed_at) || [];
      const totalTimeSpent = completions?.reduce((sum, c) => sum + (c.time_spent || 0), 0) || 0;
      const averageTimePerModule =
        completedModules.length > 0 ? totalTimeSpent / completedModules.length : 0;

      const timeSpentByModule = modules.map((module) => {
        const completion = completions?.find((c) => c.module_id === module.id);
        return {
          moduleId: module.id,
          moduleTitle: module.title,
          timeSpent: completion?.time_spent || 0,
          completedAt: completion?.completed_at || null,
        };
      });

      return {
        totalTimeSpent,
        averageTimePerModule: Math.round(averageTimePerModule),
        modulesCompleted: completedModules.length,
        totalModules: modules.length,
        completionPercentage: Math.round((completedModules.length / modules.length) * 100),
        lastActivityAt: enrollment.updated_at,
        timeSpentByModule,
      };
    } catch (error) {
      console.error("Error getting progress stats:", error);
      return null;
    }
  },

  /**
   * Get progress for all courses for a user
   */
  getUserCourseProgress: async (userId: string): Promise<CourseProgress[]> => {
    if (!supabase) {
      return [];
    }

    try {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("id, course_id, progress, enrolled_at, updated_at")
        .eq("user_id", userId);

      if (!enrollments || enrollments.length === 0) return [];

      const courseIds = enrollments.map((e) => e.course_id);
      const { data: courses } = await supabase
        .from("courses")
        .select("id, title")
        .in("id", courseIds);

      if (!courses) return [];

      const courseMap = new Map(courses.map((c) => [c.id, c.title]));

      // Get time spent and module counts for each enrollment
      const progressPromises = enrollments.map(async (enrollment) => {
        // Get total time spent
        const { data: completions } = await supabase
          .from("module_completions")
          .select("time_spent")
          .eq("enrollment_id", enrollment.id);

        const totalTimeSpent = completions?.reduce((sum, c) => sum + (c.time_spent || 0), 0) || 0;

        // Get module counts
        const { count: totalModules } = await supabase
          .from("modules")
          .select("id", { count: "exact", head: true })
          .eq("course_id", enrollment.course_id);

        const { count: modulesCompleted } = await supabase
          .from("module_completions")
          .select("id", { count: "exact", head: true })
          .eq("enrollment_id", enrollment.id)
          .not("completed_at", "is", null);

        return {
          courseId: enrollment.course_id,
          courseTitle: courseMap.get(enrollment.course_id) || "Unknown Course",
          progress: enrollment.progress,
          timeSpent: totalTimeSpent,
          modulesCompleted: modulesCompleted || 0,
          totalModules: totalModules || 0,
          lastActivityAt: enrollment.updated_at,
          enrolledAt: enrollment.enrolled_at,
        };
      });

      return Promise.all(progressPromises);
    } catch (error) {
      console.error("Error getting user course progress:", error);
      return [];
    }
  },
};

