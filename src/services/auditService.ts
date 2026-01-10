import { supabase, handleSupabaseError } from "@/lib/supabase";

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email?: string | null;
  user_name?: string | null;
  event_type: string;
  event_category: string;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any>;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface CreateAuditLogParams {
  userId?: string | null;
  eventType: string;
  eventCategory?: string;
  description?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any>;
  success?: boolean;
  errorMessage?: string | null;
}

/**
 * Audit Service
 * Handles logging of authentication and security events
 */
export const auditService = {
  /**
   * Get client IP address (for browser environments)
   */
  getClientIP: async (): Promise<string | null> => {
    try {
      // Try to get IP from a service (for production)
      // In development, this will likely return null
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      return data.ip || null;
    } catch (error) {
      console.warn("Could not fetch IP address:", error);
      return null;
    }
  },

  /**
   * Get user agent from browser
   */
  getUserAgent: (): string | null => {
    if (typeof window !== "undefined") {
      return window.navigator.userAgent;
    }
    return null;
  },

  /**
   * Log an audit event
   */
  logEvent: async (params: CreateAuditLogParams): Promise<{ id: string | null; error: Error | null }> => {
    if (!supabase) {
      console.warn("Supabase not initialized, skipping audit log");
      return { id: null, error: new Error("Supabase not initialized") };
    }

    try {
      const {
        userId,
        eventType,
        eventCategory = "authentication",
        description,
        ipAddress,
        userAgent,
        metadata = {},
        success = true,
        errorMessage,
      } = params;

      // Get IP and user agent if not provided
      const finalIP = ipAddress ?? (await auditService.getClientIP());
      const finalUserAgent = userAgent ?? auditService.getUserAgent();

      // Call the database function to log the event
      const { data, error } = await supabase.rpc("log_audit_event", {
        p_user_id: userId || null,
        p_event_type: eventType,
        p_event_category: eventCategory,
        p_description: description || null,
        p_ip_address: finalIP || null,
        p_user_agent: finalUserAgent || null,
        p_metadata: metadata,
        p_success: success,
        p_error_message: errorMessage || null,
      });

      if (error) {
        handleSupabaseError(error);
        console.error("Error logging audit event:", error);
        return { id: null, error };
      }

      return { id: data || null, error: null };
    } catch (error) {
      console.error("Error in auditService.logEvent:", error);
      return {
        id: null,
        error: error instanceof Error ? error : new Error("Unknown error occurred"),
      };
    }
  },

  /**
   * Log login event
   */
  logLogin: async (userId: string, success: boolean = true, errorMessage?: string): Promise<void> => {
    await auditService.logEvent({
      userId,
      eventType: success ? "login" : "login_failed",
      eventCategory: "authentication",
      description: success ? "User logged in successfully" : "Failed login attempt",
      success,
      errorMessage,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  },

  /**
   * Log logout event
   */
  logLogout: async (userId: string): Promise<void> => {
    await auditService.logEvent({
      userId,
      eventType: "logout",
      eventCategory: "authentication",
      description: "User logged out",
      success: true,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  },

  /**
   * Log failed login attempt
   */
  logFailedLogin: async (email: string, errorMessage: string): Promise<void> => {
    await auditService.logEvent({
      userId: null, // No user ID for failed logins
      eventType: "login_failed",
      eventCategory: "authentication",
      description: `Failed login attempt for email: ${email}`,
      success: false,
      errorMessage,
      metadata: {
        email,
        timestamp: new Date().toISOString(),
      },
    });
  },

  /**
   * Get audit logs (admin only)
   */
  getAuditLogs: async (options?: {
    limit?: number;
    offset?: number;
    eventType?: string;
    eventCategory?: string;
    userId?: string;
    success?: boolean;
    startDate?: string;
    endDate?: string;
  }): Promise<{ logs: AuditLog[]; error: Error | null }> => {
    if (!supabase) {
      return { logs: [], error: new Error("Supabase not initialized") };
    }

    try {
      let query = supabase.from("audit_logs_view").select("*");

      if (options?.eventType) {
        query = query.eq("event_type", options.eventType);
      }

      if (options?.eventCategory) {
        query = query.eq("event_category", options.eventCategory);
      }

      if (options?.userId) {
        query = query.eq("user_id", options.userId);
      }

      if (options?.success !== undefined) {
        query = query.eq("success", options.success);
      }

      if (options?.startDate) {
        query = query.gte("created_at", options.startDate);
      }

      if (options?.endDate) {
        query = query.lte("created_at", options.endDate);
      }

      query = query.order("created_at", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        handleSupabaseError(error);
        return { logs: [], error };
      }

      return {
        logs: (data || []) as AuditLog[],
        error: null,
      };
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      return {
        logs: [],
        error: error instanceof Error ? error : new Error("Unknown error occurred"),
      };
    }
  },

  /**
   * Get failed login attempts count for an email
   */
  getFailedLoginAttempts: async (email: string, timeWindowMinutes: number = 15): Promise<number> => {
    if (!supabase) {
      return 0;
    }

    try {
      const timeWindow = new Date();
      timeWindow.setMinutes(timeWindow.getMinutes() - timeWindowMinutes);

      const { data, error } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact" })
        .eq("event_type", "login_failed")
        .eq("success", false)
        .gte("created_at", timeWindow.toISOString())
        .contains("metadata", { email });

      if (error) {
        console.error("Error counting failed login attempts:", error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error("Error in getFailedLoginAttempts:", error);
      return 0;
    }
  },
};

