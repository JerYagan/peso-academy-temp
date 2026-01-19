import { supabase, handleSupabaseError } from "@/lib/supabase";

if (!supabase) {
  console.warn("Supabase client not initialized. Please set up environment variables.");
}

/**
 * Notification Service
 * Handles all notification-related database operations
 */

export type NotificationType =
  | "course_completed"
  | "certificate_issued"
  | "submission_approved"
  | "submission_rejected"
  | "submission_revision_requested"
  | "enrollment_confirmed"
  | "feedback_received"
  | "assessment_graded"
  | "system_announcement"
  | "course_assigned";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: {
    courseId?: string;
    courseTitle?: string;
    certificateId?: string;
    submissionId?: string;
    enrollmentId?: string;
    [key: string]: any;
  };
}

export const notificationService = {
  /**
   * Get all notifications for a user
   */
  getNotifications: async (userId: string, limit?: number): Promise<Notification[]> => {
    if (!supabase) return [];

    try {
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        handleSupabaseError(error);
        return [];
      }

      return (
        data?.map((notif) => ({
          id: notif.id,
          userId: notif.user_id,
          type: notif.type as NotificationType,
          message: notif.message,
          read: notif.read,
          createdAt: notif.created_at,
          metadata: notif.metadata || undefined,
        })) || []
      );
    } catch (error) {
      console.error("Error getting notifications:", error);
      return [];
    }
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async (userId: string): Promise<number> => {
    if (!supabase) return 0;

    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);

      if (error) {
        handleSupabaseError(error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }
  },

  /**
   * Create a notification
   */
  createNotification: async (
    userId: string,
    type: NotificationType,
    message: string,
    metadata?: Record<string, any>
  ): Promise<Notification | null> => {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          type,
          message,
          metadata: metadata || null,
        })
        .select()
        .single();

      if (error) {
        handleSupabaseError(error);
        return null;
      }

      return {
        id: data.id,
        userId: data.user_id,
        type: data.type as NotificationType,
        message: data.message,
        read: data.read,
        createdAt: data.created_at,
        metadata: data.metadata || undefined,
      };
    } catch (error) {
      console.error("Error creating notification:", error);
      return null;
    }
  },

  /**
   * Mark notification as read
   */
  markAsRead: async (notificationId: string): Promise<void> => {
    if (!supabase) return;

    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  markAllAsRead: async (userId: string): Promise<void> => {
    if (!supabase) return;

    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  },

  /**
   * Delete a notification
   */
  deleteNotification: async (notificationId: string): Promise<void> => {
    if (!supabase) return;

    try {
      await supabase.from("notifications").delete().eq("id", notificationId);
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  },

  /**
   * Delete all read notifications for a user
   */
  deleteAllRead: async (userId: string): Promise<void> => {
    if (!supabase) return;

    try {
      await supabase
        .from("notifications")
        .delete()
        .eq("user_id", userId)
        .eq("read", true);
    } catch (error) {
      console.error("Error deleting read notifications:", error);
    }
  },

  /**
   * Subscribe to real-time notifications for a user
   */
  subscribeToNotifications: (
    userId: string,
    callback: (notification: Notification) => void
  ) => {
    if (!supabase) return () => {};

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as any;
          callback({
            id: newNotification.id,
            userId: newNotification.user_id,
            type: newNotification.type as NotificationType,
            message: newNotification.message,
            read: newNotification.read,
            createdAt: newNotification.created_at,
            metadata: newNotification.metadata || undefined,
          });
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  },
};

/**
 * Helper functions to create specific notification types
 */
export const notificationHelpers = {
  /**
   * Notify user about course completion
   */
  notifyCourseCompleted: async (
    userId: string,
    courseTitle: string,
    courseId: string
  ): Promise<void> => {
    await notificationService.createNotification(
      userId,
      "course_completed",
      `Congratulations! You have completed the course "${courseTitle}"`,
      { courseId, courseTitle }
    );
  },

  /**
   * Notify user about certificate issuance
   */
  notifyCertificateIssued: async (
    userId: string,
    courseTitle: string,
    certificateId: string,
    certificateType: "completion" | "participation"
  ): Promise<void> => {
    const typeText =
      certificateType === "completion" ? "Certificate of Completion" : "Certificate of Participation";
    await notificationService.createNotification(
      userId,
      "certificate_issued",
      `Your ${typeText} for "${courseTitle}" has been issued!`,
      { certificateId, courseTitle, certificateType }
    );
  },

  /**
   * Notify user about submission approval
   */
  notifySubmissionApproved: async (
    userId: string,
    courseTitle: string,
    submissionId: string
  ): Promise<void> => {
    await notificationService.createNotification(
      userId,
      "submission_approved",
      `Your submission for "${courseTitle}" has been approved!`,
      { submissionId, courseTitle }
    );
  },

  /**
   * Notify user about submission rejection
   */
  notifySubmissionRejected: async (
    userId: string,
    courseTitle: string,
    submissionId: string,
    feedback?: string
  ): Promise<void> => {
    await notificationService.createNotification(
      userId,
      "submission_rejected",
      `Your submission for "${courseTitle}" has been rejected. ${feedback ? "Please check feedback." : ""}`,
      { submissionId, courseTitle, feedback }
    );
  },

  /**
   * Notify user about revision request
   */
  notifyRevisionRequested: async (
    userId: string,
    courseTitle: string,
    submissionId: string,
    feedback?: string
  ): Promise<void> => {
    await notificationService.createNotification(
      userId,
      "submission_revision_requested",
      `Revision requested for your submission in "${courseTitle}". Please check feedback.`,
      { submissionId, courseTitle, feedback }
    );
  },

  /**
   * Notify user about enrollment confirmation
   */
  notifyEnrollmentConfirmed: async (
    userId: string,
    courseTitle: string,
    enrollmentId: string
  ): Promise<void> => {
    await notificationService.createNotification(
      userId,
      "enrollment_confirmed",
      `You have been enrolled in "${courseTitle}"`,
      { enrollmentId, courseTitle }
    );
  },

  /**
   * Notify user about feedback received
   */
  notifyFeedbackReceived: async (
    userId: string,
    courseTitle: string,
    submissionId: string
  ): Promise<void> => {
    await notificationService.createNotification(
      userId,
      "feedback_received",
      `You have received feedback on your submission for "${courseTitle}"`,
      { submissionId, courseTitle }
    );
  },

  /**
   * Notify user about assessment graded
   */
  notifyAssessmentGraded: async (
    userId: string,
    courseTitle: string,
    score: number,
    passed: boolean
  ): Promise<void> => {
    await notificationService.createNotification(
      userId,
      "assessment_graded",
      `Your assessment for "${courseTitle}" has been graded. Score: ${score}% ${passed ? "✅ Passed" : "❌ Failed"}`,
      { courseTitle, score, passed }
    );
  },
};

