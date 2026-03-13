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

const unsupportedNotificationColumns = new Set<string>();

const normalizeMissingColumnName = (columnName: string | null | undefined): string | null => {
  const normalized = String(columnName || "")
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/^'|'$/g, "");

  if (!normalized) {
    return null;
  }

  const segments = normalized.split(".").filter(Boolean);
  return segments[segments.length - 1] || normalized;
};

const getMissingColumnName = (error: unknown, tableName: string): string | null => {
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: string }).message || "")
    : "";
  const details = typeof error === "object" && error !== null && "details" in error
    ? String((error as { details?: string }).details || "")
    : "";
  const haystack = `${message} ${details}`;

  const schemaCacheMatch = haystack.match(new RegExp(`'([^']+)' column of '${tableName}'`, "i"));
  if (schemaCacheMatch?.[1]) {
    return normalizeMissingColumnName(schemaCacheMatch[1]);
  }

  const quotedPostgresMatch = haystack.match(/column\s+"([^"]+)"\s+does not exist/i);
  if (quotedPostgresMatch?.[1]) {
    return normalizeMissingColumnName(quotedPostgresMatch[1]);
  }

  const unquotedPostgresMatch = haystack.match(/column\s+([a-zA-Z0-9_.]+)\s+does not exist/i);
  if (unquotedPostgresMatch?.[1]) {
    return normalizeMissingColumnName(unquotedPostgresMatch[1]);
  }

  return null;
};

const buildSelectWithFallback = (baseSelect: string, unsupportedColumns: Set<string>) => {
  const fields = baseSelect
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean)
    .filter((field) => !unsupportedColumns.has(field));

  return fields.join(", ");
};

const sanitizeWritePayload = (payload: Record<string, unknown>, unsupportedColumns: Set<string>) => {
  const nextPayload = { ...payload };

  for (const column of unsupportedColumns) {
    delete nextPayload[column];
  }

  return nextPayload;
};

const executeNotificationReadWithFallback = async <T>(
  execute: (selectClause: string) => Promise<{ data: T | null; error: any }>,
  selectClause: string,
): Promise<{ data: T | null; error: any }> => {
  let nextSelect = buildSelectWithFallback(selectClause, unsupportedNotificationColumns);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await execute(nextSelect);
    if (!result.error) {
      return result;
    }

    const missingColumn = getMissingColumnName(result.error, "notifications");
    if (!missingColumn) {
      return result;
    }

    unsupportedNotificationColumns.add(missingColumn);
    nextSelect = buildSelectWithFallback(selectClause, unsupportedNotificationColumns);
  }

  return execute(nextSelect);
};

const executeNotificationWriteWithFallback = async <T>(
  execute: (payload: Record<string, unknown>) => Promise<{ data: T | null; error: any }>,
  payload: Record<string, unknown>,
): Promise<{ data: T | null; error: any }> => {
  let nextPayload = sanitizeWritePayload(payload, unsupportedNotificationColumns);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await execute(nextPayload);
    if (!result.error) {
      return result;
    }

    const missingColumn = getMissingColumnName(result.error, "notifications");
    if (!missingColumn || !(missingColumn in nextPayload)) {
      return result;
    }

    unsupportedNotificationColumns.add(missingColumn);
    delete nextPayload[missingColumn];
  }

  return execute(nextPayload);
};

const mapNotificationRow = (notif: any): Notification => ({
  id: notif.id,
  userId: notif.user_id,
  type: notif.type as NotificationType,
  message: notif.message,
  read: notif.read ?? false,
  createdAt: notif.created_at,
  metadata: notif.metadata || undefined,
});

const isRecoverableNotificationError = (error: unknown) => {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: string }).code || "")
    : "";
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: string }).message || "")
    : "";

  return code === "PGRST116"
    || code === "42P01"
    || /relation .*notifications.* does not exist/i.test(message)
    || /Could not find the table .*notifications/i.test(message);
};

export const notificationService = {
  /**
   * Get all notifications for a user
   */
  getNotifications: async (userId: string, limit?: number): Promise<Notification[]> => {
    if (!supabase) return [];

    try {
      const { data, error } = await executeNotificationReadWithFallback(
        (selectClause) => {
          let query = supabase
            .from("notifications")
            .select(selectClause)
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          if (limit) {
            query = query.limit(limit);
          }

          return query;
        },
        "*",
      );

      if (error) {
        if (isRecoverableNotificationError(error)) {
          return [];
        }

        handleSupabaseError(error);
        return [];
      }

      return data?.map(mapNotificationRow) || [];
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
      const { data, error } = await executeNotificationReadWithFallback(
        (selectClause) => supabase
          .from("notifications")
          .select(selectClause)
          .eq("user_id", userId)
          .eq("read", false),
        "id",
      );

      if (error) {
        if (isRecoverableNotificationError(error)) {
          return 0;
        }

        handleSupabaseError(error);
        return 0;
      }

      return data?.length || 0;
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
      const { data, error } = await executeNotificationWriteWithFallback(
        (payload) => supabase
          .from("notifications")
          .insert(payload)
          .select("*")
          .single(),
        {
          user_id: userId,
          type,
          message,
          metadata: metadata || null,
        },
      );

      if (error) {
        if (isRecoverableNotificationError(error)) {
          return null;
        }

        handleSupabaseError(error);
        return null;
      }

      return mapNotificationRow(data);
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
          callback(mapNotificationRow(payload.new as any));
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

