import { supabase, handleSupabaseError } from "@/lib/supabase";
import { Submission } from "@/types";

const mapSubmissionRecord = (item: any): Submission => ({
  id: item.id,
  enrollment_id: item.enrollment_id,
  module_id: item.module_id,
  course_id: item.enrollments?.course_id || null,
  user_id: item.user_id,
  submission_type: item.submission_type || "completion",
  title: item.title || `Submission ${item.id.substring(0, 8)}`,
  description: item.description || undefined,
  content: item.content || {},
  attachments: item.attachments || (item.file_path ? [{ url: item.file_path, path: item.file_path, name: "Submission file", type: "file" }] : []),
  status: item.status,
  priority: item.priority || "normal",
  submitted_at: item.submitted_at,
  created_at: item.created_at || item.submitted_at,
  updated_at: item.updated_at || item.submitted_at,
  user_name: item.users?.name,
  user_email: item.users?.email,
  course_title: item.enrollments?.courses?.title,
  file_path: item.file_path || null,
});

export const submissionService = {
  getModuleSubmissions: async (options: {
    enrollmentId: string;
    moduleId: string;
    userId?: string;
  }): Promise<Submission[]> => {
    if (!supabase) {
      return [];
    }

    let query = supabase
      .from("submissions")
      .select(`
        *,
        users:user_id (name, email),
        enrollments:enrollment_id (
          course_id,
          courses:course_id (title)
        )
      `)
      .eq("enrollment_id", options.enrollmentId)
      .eq("module_id", options.moduleId)
      .order("submitted_at", { ascending: false });

    if (options.userId) {
      query = query.eq("user_id", options.userId);
    }

    const { data, error } = await query;
    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (data || []).map(mapSubmissionRecord);
  },

  getEnrollmentSubmissions: async (enrollmentId: string): Promise<Submission[]> => {
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from("submissions")
      .select(`
        *,
        users:user_id (name, email),
        enrollments:enrollment_id (
          course_id,
          courses:course_id (title)
        )
      `)
      .eq("enrollment_id", enrollmentId)
      .order("submitted_at", { ascending: false });

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (data || []).map(mapSubmissionRecord);
  },
};