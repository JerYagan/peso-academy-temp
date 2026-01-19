import { supabase, handleSupabaseError } from "@/lib/supabase";
import { Submission, Validation, Feedback, FeedbackTemplate } from "@/types";
import { notificationHelpers } from "@/services/notificationService";

if (!supabase) {
  console.warn("Supabase client not initialized. Please set up environment variables.");
}

/**
 * Validator Service
 * Handles all validation-related database operations
 */
export const validatorService = {
  /**
   * Get all pending submissions
   */
  getPendingSubmissions: async (options?: {
    limit?: number;
    offset?: number;
    priority?: string;
    courseId?: string;
  }): Promise<Submission[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    try {
      let query = supabase
        .from("submissions")
        .select(`
          *,
          users:user_id (name, email),
          enrollments:enrollment_id (
            course_id,
            courses:course_id (title, description)
          )
        `)
        .in("status", ["pending", "under_review", "revision_requested"])
        .order("priority", { ascending: false })
        .order("submitted_at", { ascending: true });

      if (options?.priority) {
        query = query.eq("priority", options.priority);
      }

      // Handle courseId filter by first getting enrollment IDs
      let enrollmentIds: string[] | undefined;
      if (options?.courseId) {
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("id")
          .eq("course_id", options.courseId);
        
        if (enrollments && enrollments.length > 0) {
          enrollmentIds = enrollments.map(e => e.id);
          query = query.in("enrollment_id", enrollmentIds);
        } else {
          // No enrollments for this course, return empty
          return [];
        }
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        enrollment_id: item.enrollment_id,
        course_id: item.enrollments?.course_id || null,
        user_id: item.user_id,
        submission_type: item.submission_type || "completion",
        title: item.title || `Submission ${item.id.substring(0, 8)}`,
        description: item.description,
        content: item.content || {},
        attachments: item.attachments || (item.file_path ? [{ url: item.file_path, name: "Submission file", type: "file" }] : []),
        status: item.status,
        priority: item.priority || "normal",
        submitted_at: item.submitted_at,
        created_at: item.created_at || item.submitted_at,
        updated_at: item.updated_at || item.submitted_at,
        user_name: item.users?.name,
        user_email: item.users?.email,
        course_title: item.enrollments?.courses?.title,
      }));
    } catch (error) {
      console.error("Error fetching pending submissions:", error);
      return [];
    }
  },

  /**
   * Get submission by ID with full details
   */
  getSubmissionById: async (submissionId: string): Promise<Submission | null> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("submissions")
        .select(`
          *,
          users:user_id (name, email),
          enrollments:enrollment_id (
            course_id,
            courses:course_id (title, description)
          )
        `)
        .eq("id", submissionId)
        .single();

      if (error) {
        handleSupabaseError(error);
        return null;
      }

      if (!data) return null;

      return {
        id: data.id,
        enrollment_id: data.enrollment_id,
        course_id: data.enrollments?.course_id || null,
        user_id: data.user_id,
        submission_type: data.submission_type || "completion",
        title: data.title || `Submission ${data.id.substring(0, 8)}`,
        description: data.description,
        content: data.content || {},
        attachments: data.attachments || (data.file_path ? [{ url: data.file_path, name: "Submission file", type: "file" }] : []),
        status: data.status,
        priority: data.priority || "normal",
        submitted_at: data.submitted_at,
        created_at: data.created_at || data.submitted_at,
        updated_at: data.updated_at || data.submitted_at,
        user_name: data.users?.name,
        user_email: data.users?.email,
        course_title: data.enrollments?.courses?.title,
      };
    } catch (error) {
      console.error("Error fetching submission:", error);
      return null;
    }
  },

  /**
   * Get validation statistics for validator dashboard
   */
  getValidationStats: async (validatorId?: string): Promise<{
    pending: number;
    completed: number;
    approved: number;
    rejected: number;
    inProgress: number;
  }> => {
    if (!supabase) {
      return { pending: 0, completed: 0, approved: 0, rejected: 0, inProgress: 0 };
    }

    try {
      // Get pending submissions count
      const { count: pendingCount } = await supabase
        .from("submissions")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "under_review", "revision_requested"]);

      // Get validations stats
      let validationQuery = supabase
        .from("validations")
        .select("*", { count: "exact", head: true });

      if (validatorId) {
        validationQuery = validationQuery.eq("validator_id", validatorId);
      }

      const { count: completedCount } = await validationQuery.eq("status", "completed");

      const { count: approvedCount } = await validationQuery
        .eq("status", "completed")
        .eq("decision", "approved");

      const { count: rejectedCount } = await validationQuery
        .eq("status", "completed")
        .eq("decision", "rejected");

      const { count: inProgressCount } = await validationQuery.eq("status", "in_progress");

      return {
        pending: pendingCount || 0,
        completed: completedCount || 0,
        approved: approvedCount || 0,
        rejected: rejectedCount || 0,
        inProgress: inProgressCount || 0,
      };
    } catch (error) {
      console.error("Error fetching validation stats:", error);
      return { pending: 0, completed: 0, approved: 0, rejected: 0, inProgress: 0 };
    }
  },

  /**
   * Start validation (assign validator to submission)
   */
  startValidation: async (
    submissionId: string,
    validatorId: string
  ): Promise<Validation | null> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    try {
      // Update submission status to under_review
      await supabase
        .from("submissions")
        .update({ status: "under_review", updated_at: new Date().toISOString() })
        .eq("id", submissionId);

      // Create validation record
      const { data, error } = await supabase
        .from("validations")
        .insert({
          submission_id: submissionId,
          validator_id: validatorId,
          validation_type: "review",
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        handleSupabaseError(error);
        throw error;
      }

      return data as Validation;
    } catch (error) {
      console.error("Error starting validation:", error);
      throw error;
    }
  },

  /**
   * Complete validation with decision
   */
  completeValidation: async (
    validationId: string,
    decision: "approved" | "rejected" | "revision_requested",
    feedback?: string,
    rating?: number
  ): Promise<Validation | null> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    try {
      // Get validation with submission details first
      const { data: validationData } = await supabase
        .from("validations")
        .select(`
          *,
          submissions:submission_id (
            id,
            user_id,
            enrollment_id,
            enrollments:enrollment_id (
              course_id,
              courses:course_id (title)
            )
          )
        `)
        .eq("id", validationId)
        .single();

      if (!validationData) {
        throw new Error("Validation not found");
      }

      // Update validation
      const { data, error } = await supabase
        .from("validations")
        .update({
          status: "completed",
          decision,
          feedback: feedback || null,
          rating: rating || null,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", validationId)
        .select()
        .single();

      if (error) {
        handleSupabaseError(error);
        throw error;
      }

      // Update submission status based on decision
      let submissionStatus: string;
      if (decision === "approved") {
        submissionStatus = "approved";
      } else if (decision === "rejected") {
        submissionStatus = "rejected";
      } else {
        submissionStatus = "revision_requested";
      }

      const submission = (validationData as any).submissions;
      if (submission) {
        await supabase
          .from("submissions")
          .update({ 
            status: submissionStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", submission.id);

        // Send notification to user
        try {
          const courseTitle = submission.enrollments?.courses?.title || "the course";
          const submissionId = submission.id;
          const userId = submission.user_id;

          if (decision === "approved") {
            await notificationHelpers.notifySubmissionApproved(
              userId,
              courseTitle,
              submissionId
            );
          } else if (decision === "rejected") {
            await notificationHelpers.notifySubmissionRejected(
              userId,
              courseTitle,
              submissionId,
              feedback
            );
          } else if (decision === "revision_requested") {
            await notificationHelpers.notifyRevisionRequested(
              userId,
              courseTitle,
              submissionId,
              feedback
            );
          }
        } catch (notifError) {
          console.error("Error sending submission notification:", notifError);
          // Don't throw - notification failure shouldn't block validation
        }
      }

      return data as Validation;
    } catch (error) {
      console.error("Error completing validation:", error);
      throw error;
    }
  },

  /**
   * Add feedback to a submission
   */
  addFeedback: async (
    submissionId: string,
    validationId: string,
    validatorId: string,
    feedbackData: {
      feedback_type: "general" | "technical" | "content" | "improvement";
      title?: string;
      content: string;
      template_id?: string;
      rating?: number;
      is_public?: boolean;
    }
  ): Promise<Feedback | null> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    try {
      // Get submission details for notification
      const { data: submissionData } = await supabase
        .from("submissions")
        .select(`
          id,
          user_id,
          enrollment_id,
          enrollments:enrollment_id (
            course_id,
            courses:course_id (title)
          )
        `)
        .eq("id", submissionId)
        .single();

      const { data, error } = await supabase
        .from("feedback")
        .insert({
          validation_id: validationId,
          submission_id: submissionId,
          validator_id: validatorId,
          ...feedbackData,
          is_public: feedbackData.is_public ?? true,
        })
        .select()
        .single();

      if (error) {
        handleSupabaseError(error);
        throw error;
      }

      // Notify user about feedback received
      if (submissionData && feedbackData.is_public !== false) {
        try {
          const courseTitle = (submissionData as any).enrollments?.courses?.title || "the course";
          await notificationHelpers.notifyFeedbackReceived(
            (submissionData as any).user_id,
            courseTitle,
            submissionId
          );
        } catch (notifError) {
          console.error("Error sending feedback notification:", notifError);
          // Don't throw - notification failure shouldn't block feedback
        }
      }

      return data as Feedback;
    } catch (error) {
      console.error("Error adding feedback:", error);
      throw error;
    }
  },

  /**
   * Get validations for a submission
   */
  getSubmissionValidations: async (submissionId: string): Promise<Validation[]> => {
    if (!supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from("validations")
        .select(`
          *,
          users:validator_id (name, email)
        `)
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false });

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        submission_id: item.submission_id,
        validator_id: item.validator_id,
        validation_type: item.validation_type,
        status: item.status,
        decision: item.decision,
        feedback: item.feedback,
        rating: item.rating,
        metadata: item.metadata || {},
        started_at: item.started_at,
        completed_at: item.completed_at,
        created_at: item.created_at,
        updated_at: item.updated_at,
        validator_name: item.users?.name,
        validator_email: item.users?.email,
      }));
    } catch (error) {
      console.error("Error fetching validations:", error);
      return [];
    }
  },

  /**
   * Get feedback for a submission
   */
  getSubmissionFeedback: async (submissionId: string): Promise<Feedback[]> => {
    if (!supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from("feedback")
        .select(`
          *,
          users:validator_id (name)
        `)
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false });

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        validation_id: item.validation_id,
        submission_id: item.submission_id,
        validator_id: item.validator_id,
        feedback_type: item.feedback_type,
        title: item.title,
        content: item.content,
        template_id: item.template_id,
        rating: item.rating,
        is_public: item.is_public,
        created_at: item.created_at,
        updated_at: item.updated_at,
        validator_name: item.users?.name,
      }));
    } catch (error) {
      console.error("Error fetching feedback:", error);
      return [];
    }
  },

  /**
   * Get recent validations history
   */
  getRecentValidations: async (limit: number = 10): Promise<Validation[]> => {
    if (!supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from("validations")
        .select(`
          *,
          users:validator_id (name, email),
          submissions:submission_id (title, course_id, courses:course_id (title))
        `)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(limit);

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        submission_id: item.submission_id,
        validator_id: item.validator_id,
        validation_type: item.validation_type,
        status: item.status,
        decision: item.decision,
        feedback: item.feedback,
        rating: item.rating,
        metadata: item.metadata || {},
        started_at: item.started_at,
        completed_at: item.completed_at,
        created_at: item.created_at,
        updated_at: item.updated_at,
        validator_name: item.users?.name,
        validator_email: item.users?.email,
      }));
    } catch (error) {
      console.error("Error fetching recent validations:", error);
      return [];
    }
  },

  /**
   * Get all feedback templates
   */
  getFeedbackTemplates: async (category?: string): Promise<FeedbackTemplate[]> => {
    if (!supabase) {
      return [];
    }

    try {
      let query = supabase
        .from("feedback_templates")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      return (data || []) as FeedbackTemplate[];
    } catch (error) {
      console.error("Error fetching feedback templates:", error);
      return [];
    }
  },
};

