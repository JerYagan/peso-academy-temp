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
  | "account_verified"
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
    routePath?: string;
    assessmentAttemptId?: string;
    moduleId?: string;
    responseId?: string;
    [key: string]: any;
  };
}

export type TestNotificationAudience = "self" | "admins" | "trainers" | "trainees" | "all";

const NOTIFICATION_SELECT_FIELDS = "id, user_id, type, message, read, created_at, metadata";

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

const sanitizeWritePayloads = (payloads: Record<string, unknown>[], unsupportedColumns: Set<string>) =>
  payloads.map((payload) => sanitizeWritePayload(payload, unsupportedColumns));

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

const executeNotificationBulkWriteWithFallback = async <T>(
  execute: (payloads: Record<string, unknown>[]) => Promise<{ data: T | null; error: any }>,
  payloads: Record<string, unknown>[],
): Promise<{ data: T | null; error: any }> => {
  let nextPayloads = sanitizeWritePayloads(payloads, unsupportedNotificationColumns);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await execute(nextPayloads);
    if (!result.error) {
      return result;
    }

    const missingColumn = getMissingColumnName(result.error, "notifications");
    if (!missingColumn || !nextPayloads.some((payload) => missingColumn in payload)) {
      return result;
    }

    unsupportedNotificationColumns.add(missingColumn);
    nextPayloads = nextPayloads.map((payload) => {
      const nextPayload = { ...payload };
      delete nextPayload[missingColumn];
      return nextPayload;
    });
  }

  return execute(nextPayloads);
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
        NOTIFICATION_SELECT_FIELDS,
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
          .select(NOTIFICATION_SELECT_FIELDS)
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

  sendTestNotification: async (
    senderId: string,
    audience: TestNotificationAudience,
    message: string,
  ): Promise<{ success: boolean; recipients: number; error?: string }> => {
    if (!supabase) {
      return { success: false, recipients: 0, error: "Supabase client not initialized." };
    }

    try {
      let recipientIds: string[] = [];

      if (audience === "self") {
        recipientIds = [senderId];
      } else {
        let query = supabase.from("users").select("id");

        if (audience === "admins") {
          query = query.eq("role", "admin");
        } else if (audience === "trainers") {
          query = query.eq("role", "trainer");
        } else if (audience === "trainees") {
          query = query.eq("role", "trainee");
        }

        const { data, error } = await query;

        if (error) {
          handleSupabaseError(error);
          return { success: false, recipients: 0, error: error.message || "Failed to load recipients." };
        }

        recipientIds = (data || []).map((row) => row.id).filter(Boolean);
      }

      const uniqueRecipientIds = [...new Set(recipientIds)];
      if (!uniqueRecipientIds.length) {
        return { success: false, recipients: 0, error: "No recipients matched the selected audience." };
      }

      const trimmedMessage = message.trim();
      const notificationMessage = trimmedMessage || "Notification test from Admin Settings.";
      const sentAt = new Date().toISOString();

      const payloads = uniqueRecipientIds.map((userId) => ({
        user_id: userId,
        type: "system_announcement",
        message: notificationMessage,
        metadata: {
          isTestNotification: true,
          senderId,
          audience,
          sentAt,
        },
      }));

      const { error } = await executeNotificationBulkWriteWithFallback(
        (nextPayloads) => supabase.from("notifications").insert(nextPayloads),
        payloads,
      );

      if (error) {
        if (isRecoverableNotificationError(error)) {
          return { success: false, recipients: 0, error: "Notifications table is unavailable." };
        }

        handleSupabaseError(error);
        return { success: false, recipients: 0, error: error.message || "Failed to send test notification." };
      }

      return { success: true, recipients: uniqueRecipientIds.length };
    } catch (error) {
      console.error("Error sending test notification:", error);
      return {
        success: false,
        recipients: 0,
        error: error instanceof Error ? error.message : "Failed to send test notification.",
      };
    }
  },

  /**
   * Mark notification as read
   */
  markAsRead: async (notificationId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) {
        if (isRecoverableNotificationError(error)) {
          return false;
        }

        handleSupabaseError(error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  markAllAsRead: async (userId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);

      if (error) {
        if (isRecoverableNotificationError(error)) {
          return false;
        }

        handleSupabaseError(error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      return false;
    }
  },

  /**
   * Delete a notification
   */
  deleteNotification: async (notificationId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
      const { error } = await supabase.from("notifications").delete().eq("id", notificationId);

      if (error) {
        if (isRecoverableNotificationError(error)) {
          return false;
        }

        handleSupabaseError(error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error deleting notification:", error);
      return false;
    }
  },

  /**
   * Delete all read notifications for a user
   */
  deleteAllRead: async (userId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", userId)
        .eq("read", true);

      if (error) {
        if (isRecoverableNotificationError(error)) {
          return false;
        }

        handleSupabaseError(error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error deleting read notifications:", error);
      return false;
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
    enrollmentId: string,
    courseId?: string,
  ): Promise<void> => {
    await notificationService.createNotification(
      userId,
      "enrollment_confirmed",
      `You have been enrolled in "${courseTitle}"`,
      { enrollmentId, courseTitle, courseId }
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

  notifyAccountVerified: async (userId: string): Promise<void> => {
    await notificationService.createNotification(
      userId,
      "account_verified",
      "Your learner account has been verified. You can now enroll in courses and start learning.",
      {
        routePath: "/courses",
      },
    );
  },

  notifyPracticeQuizEssayFeedbackReceived: async (
    userId: string,
    courseTitle: string,
    options: {
      courseId: string;
      moduleId: string;
      enrollmentId: string;
      responseId: string;
    },
  ): Promise<void> => {
    await notificationService.createNotification(
      userId,
      "feedback_received",
      `Your practice quiz essay in "${courseTitle}" has new feedback from your reviewer.`,
      {
        courseId: options.courseId,
        courseTitle,
        moduleId: options.moduleId,
        enrollmentId: options.enrollmentId,
        responseId: options.responseId,
        routePath: `/courses/${options.courseId}`,
      },
    );
  },

  notifyRecommendationsReady: async (
    userId: string,
    recommendations: Array<{ courseId: string; courseTitle: string }>,
    trigger: "profile_update" | "onboarding_completion",
  ): Promise<void> => {
    const [topRecommendation] = recommendations;
    if (!topRecommendation) {
      return;
    }

    const recommendationCount = recommendations.length;
    const message = trigger === "onboarding_completion"
      ? `Your personalized course recommendations are ready. Start with "${topRecommendation.courseTitle}"${recommendationCount > 1 ? ` and ${recommendationCount - 1} more matches.` : "."}`
      : `You have updated course recommendations. "${topRecommendation.courseTitle}" is a strong next match${recommendationCount > 1 ? `, plus ${recommendationCount - 1} more.` : "."}`;

    await notificationService.createNotification(
      userId,
      "course_assigned",
      message,
      {
        courseId: topRecommendation.courseId,
        courseTitle: topRecommendation.courseTitle,
        recommendedCourseIds: recommendations.map((recommendation) => recommendation.courseId),
        recommendationCount,
        trigger,
      },
    );
  },
};

