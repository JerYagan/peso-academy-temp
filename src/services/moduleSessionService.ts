import { supabase, handleSupabaseError } from "@/lib/supabase";
import { analyticsService } from "@/services/analyticsService";

export type ModuleSessionStatus = "active" | "completed" | "abandoned" | "timed_out";

export interface ModuleSession {
  id: string;
  userId: string;
  enrollmentId: string;
  courseId: string;
  moduleId: string;
  sessionDate: string;
  startedAt: string;
  lastSeenAt: string;
  endedAt: string | null;
  durationSeconds: number;
  sessionStatus: ModuleSessionStatus;
  entrySource: string | null;
  resumePositionSeconds: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EnrichedModuleSession extends ModuleSession {
  courseTitle: string | null;
  moduleTitle: string | null;
}

export interface ModuleSessionAggregate {
  userId: string;
  enrollmentId: string;
  courseId: string;
  courseTitle: string | null;
  moduleId: string;
  moduleTitle: string | null;
  sessionCount: number;
  totalDurationSeconds: number;
  lastSeenAt: string;
  lastSessionStatus: ModuleSessionStatus;
}

export interface TrainerLearnerSessionSummary {
  learnerId: string;
  courseId: string;
  courseTitle: string | null;
  totalSessions: number;
  totalDurationSeconds: number;
  lastSeenAt: string;
  lastModuleId: string;
  lastModuleTitle: string | null;
  activeSessionCount: number;
}

export interface AdminRecentSessionSummary {
  learnerId: string;
  courseId: string;
  courseTitle: string | null;
  moduleId: string;
  moduleTitle: string | null;
  lastSeenAt: string;
  totalSessions: number;
  totalDurationSeconds: number;
  latestSessionStatus: ModuleSessionStatus;
}

type StartSessionInput = {
  userId: string;
  enrollmentId: string;
  courseId: string;
  moduleId: string;
  entrySource?: string;
};

type TrainerSessionQuery = {
  learnerId?: string;
  courseId?: string;
  limit?: number;
};

type SessionRow = {
  id: string;
  user_id: string;
  enrollment_id: string;
  course_id: string;
  module_id: string;
  session_date: string;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  duration_seconds: number;
  session_status: ModuleSessionStatus;
  entry_source: string | null;
  resume_position_seconds: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export const MODULE_SESSION_HEARTBEAT_MS = 60 * 1000;
export const MODULE_SESSION_STALE_MINUTES = 15;

const closeStaleSessionsForUser = async (userId: string) => {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.rpc("close_stale_module_sessions", {
    p_user_id: userId,
    p_stale_before: new Date(Date.now() - MODULE_SESSION_STALE_MINUTES * 60 * 1000).toISOString(),
  });

  if (error) {
    handleSupabaseError(error);
  }
};

const closeOverlappingActiveSessions = async (userId: string, enrollmentId: string, moduleId: string) => {
  if (!supabase) {
    return;
  }

  const endedAt = new Date().toISOString();
  const { error } = await supabase
    .from("module_sessions")
    .update({
      ended_at: endedAt,
      last_seen_at: endedAt,
      session_status: "abandoned",
    })
    .eq("user_id", userId)
    .eq("enrollment_id", enrollmentId)
    .eq("session_status", "active")
    .neq("module_id", moduleId);

  if (error) {
    handleSupabaseError(error);
  }
};

const mapSessionRow = (row: SessionRow): ModuleSession => ({
  id: row.id,
  userId: row.user_id,
  enrollmentId: row.enrollment_id,
  courseId: row.course_id,
  moduleId: row.module_id,
  sessionDate: row.session_date,
  startedAt: row.started_at,
  lastSeenAt: row.last_seen_at,
  endedAt: row.ended_at,
  durationSeconds: row.duration_seconds,
  sessionStatus: row.session_status,
  entrySource: row.entry_source,
  resumePositionSeconds: row.resume_position_seconds,
  metadata: row.metadata || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const selectSessionFields =
  "id, user_id, enrollment_id, course_id, module_id, session_date, started_at, last_seen_at, ended_at, duration_seconds, session_status, entry_source, resume_position_seconds, metadata, created_at, updated_at";

const fetchCourseTitles = async (courseIds: string[]) => {
  const courseTitleMap = new Map<string, string>();

  if (!supabase || courseIds.length === 0) {
    return courseTitleMap;
  }

  const { data, error } = await supabase.from("courses").select("id, title").in("id", Array.from(new Set(courseIds)));
  if (error) {
    handleSupabaseError(error);
    return courseTitleMap;
  }

  (data || []).forEach((course) => {
    courseTitleMap.set(course.id, course.title);
  });

  return courseTitleMap;
};

const fetchModuleTitles = async (moduleIds: string[]) => {
  const moduleTitleMap = new Map<string, string>();

  if (!supabase || moduleIds.length === 0) {
    return moduleTitleMap;
  }

  const { data, error } = await supabase.from("modules").select("id, title").in("id", Array.from(new Set(moduleIds)));
  if (error) {
    handleSupabaseError(error);
    return moduleTitleMap;
  }

  (data || []).forEach((module) => {
    moduleTitleMap.set(module.id, module.title);
  });

  return moduleTitleMap;
};

const enrichSessions = async (sessions: ModuleSession[]): Promise<EnrichedModuleSession[]> => {
  const [courseTitleMap, moduleTitleMap] = await Promise.all([
    fetchCourseTitles(sessions.map((session) => session.courseId)),
    fetchModuleTitles(sessions.map((session) => session.moduleId)),
  ]);

  return sessions.map((session) => ({
    ...session,
    courseTitle: courseTitleMap.get(session.courseId) || null,
    moduleTitle: moduleTitleMap.get(session.moduleId) || null,
  }));
};

const summarizeSessionsByModule = async (sessions: ModuleSession[]): Promise<ModuleSessionAggregate[]> => {
  const [courseTitleMap, moduleTitleMap] = await Promise.all([
    fetchCourseTitles(sessions.map((session) => session.courseId)),
    fetchModuleTitles(sessions.map((session) => session.moduleId)),
  ]);

  const aggregateMap = new Map<string, ModuleSessionAggregate>();

  sessions.forEach((session) => {
    const key = `${session.userId}:${session.enrollmentId}:${session.moduleId}`;
    const existing = aggregateMap.get(key);

    if (!existing) {
      aggregateMap.set(key, {
        userId: session.userId,
        enrollmentId: session.enrollmentId,
        courseId: session.courseId,
        courseTitle: courseTitleMap.get(session.courseId) || null,
        moduleId: session.moduleId,
        moduleTitle: moduleTitleMap.get(session.moduleId) || null,
        sessionCount: 1,
        totalDurationSeconds: session.durationSeconds,
        lastSeenAt: session.lastSeenAt,
        lastSessionStatus: session.sessionStatus,
      });
      return;
    }

    existing.sessionCount += 1;
    existing.totalDurationSeconds += session.durationSeconds;

    if (session.lastSeenAt > existing.lastSeenAt) {
      existing.lastSeenAt = session.lastSeenAt;
      existing.lastSessionStatus = session.sessionStatus;
    }
  });

  return Array.from(aggregateMap.values()).sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));
};

const summarizeTrainerLearnerSessions = async (sessions: ModuleSession[]): Promise<TrainerLearnerSessionSummary[]> => {
  const [courseTitleMap, moduleTitleMap] = await Promise.all([
    fetchCourseTitles(sessions.map((session) => session.courseId)),
    fetchModuleTitles(sessions.map((session) => session.moduleId)),
  ]);

  const summaryMap = new Map<string, TrainerLearnerSessionSummary>();

  sessions.forEach((session) => {
    const key = `${session.userId}:${session.courseId}`;
    const existing = summaryMap.get(key);

    if (!existing) {
      summaryMap.set(key, {
        learnerId: session.userId,
        courseId: session.courseId,
        courseTitle: courseTitleMap.get(session.courseId) || null,
        totalSessions: 1,
        totalDurationSeconds: session.durationSeconds,
        lastSeenAt: session.lastSeenAt,
        lastModuleId: session.moduleId,
        lastModuleTitle: moduleTitleMap.get(session.moduleId) || null,
        activeSessionCount: session.sessionStatus === "active" ? 1 : 0,
      });
      return;
    }

    existing.totalSessions += 1;
    existing.totalDurationSeconds += session.durationSeconds;
    if (session.sessionStatus === "active") {
      existing.activeSessionCount += 1;
    }

    if (session.lastSeenAt > existing.lastSeenAt) {
      existing.lastSeenAt = session.lastSeenAt;
      existing.lastModuleId = session.moduleId;
      existing.lastModuleTitle = moduleTitleMap.get(session.moduleId) || null;
    }
  });

  return Array.from(summaryMap.values()).sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));
};

const summarizeAdminRecentSessions = async (sessions: ModuleSession[]): Promise<AdminRecentSessionSummary[]> => {
  const [courseTitleMap, moduleTitleMap] = await Promise.all([
    fetchCourseTitles(sessions.map((session) => session.courseId)),
    fetchModuleTitles(sessions.map((session) => session.moduleId)),
  ]);

  const summaryMap = new Map<string, AdminRecentSessionSummary>();

  sessions.forEach((session) => {
    const key = `${session.userId}:${session.courseId}:${session.moduleId}`;
    const existing = summaryMap.get(key);

    if (!existing) {
      summaryMap.set(key, {
        learnerId: session.userId,
        courseId: session.courseId,
        courseTitle: courseTitleMap.get(session.courseId) || null,
        moduleId: session.moduleId,
        moduleTitle: moduleTitleMap.get(session.moduleId) || null,
        lastSeenAt: session.lastSeenAt,
        totalSessions: 1,
        totalDurationSeconds: session.durationSeconds,
        latestSessionStatus: session.sessionStatus,
      });
      return;
    }

    existing.totalSessions += 1;
    existing.totalDurationSeconds += session.durationSeconds;

    if (session.lastSeenAt > existing.lastSeenAt) {
      existing.lastSeenAt = session.lastSeenAt;
      existing.latestSessionStatus = session.sessionStatus;
    }
  });

  return Array.from(summaryMap.values()).sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));
};

export const moduleSessionService = {
  startSession: async ({
    userId,
    enrollmentId,
    courseId,
    moduleId,
    entrySource = "course_module_viewer",
  }: StartSessionInput): Promise<ModuleSession | null> => {
    if (!supabase) {
      return null;
    }

    const staleThreshold = new Date(Date.now() - MODULE_SESSION_STALE_MINUTES * 60 * 1000).toISOString();

    await closeStaleSessionsForUser(userId);
    await closeOverlappingActiveSessions(userId, enrollmentId, moduleId);

    const { data: activeSessions, error: activeSessionError } = await supabase
      .from("module_sessions")
      .select(selectSessionFields)
      .eq("user_id", userId)
      .eq("enrollment_id", enrollmentId)
      .eq("module_id", moduleId)
      .eq("session_status", "active")
      .order("started_at", { ascending: false });

    if (activeSessionError) {
      handleSupabaseError(activeSessionError);
      return null;
    }

    const reusableSession = (activeSessions || []).find((session) => session.last_seen_at >= staleThreshold);
    if (reusableSession) {
      const duplicateActiveIds = (activeSessions || [])
        .filter((session) => session.id !== reusableSession.id)
        .map((session) => session.id);

      if (duplicateActiveIds.length > 0) {
        const endedAt = new Date().toISOString();
        await supabase
          .from("module_sessions")
          .update({
            ended_at: endedAt,
            last_seen_at: endedAt,
            session_status: "abandoned",
          })
          .in("id", duplicateActiveIds);
      }

      await analyticsService.trackEvent({
        eventName: "module_resume",
        userId,
        courseId,
        moduleId,
        enrollmentId,
        surface: entrySource,
        metadata: {
          sessionId: reusableSession.id,
        },
      });

      return mapSessionRow(reusableSession as SessionRow);
    }

    const { data, error } = await supabase
      .from("module_sessions")
      .insert({
        user_id: userId,
        enrollment_id: enrollmentId,
        course_id: courseId,
        module_id: moduleId,
        entry_source: entrySource,
      })
      .select(selectSessionFields)
      .single();

    if (error) {
      handleSupabaseError(error);
      return null;
    }

    await analyticsService.trackEvent({
      eventName: "module_session_start",
      userId,
      courseId,
      moduleId,
      enrollmentId,
      surface: entrySource,
      metadata: {
        sessionId: data.id,
      },
    });

    return mapSessionRow(data as SessionRow);
  },

  heartbeatSession: async (
    sessionId: string,
    durationSeconds: number,
    resumePositionSeconds?: number,
  ): Promise<void> => {
    if (!supabase) {
      return;
    }

    const payload: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
      duration_seconds: Math.max(0, Math.floor(durationSeconds)),
    };

    if (typeof resumePositionSeconds === "number") {
      payload.resume_position_seconds = Math.max(0, Math.floor(resumePositionSeconds));
    }

    const { data, error } = await supabase
      .from("module_sessions")
      .update(payload)
      .eq("id", sessionId)
      .eq("session_status", "active")
      .select("id, user_id, course_id, module_id, enrollment_id")
      .single();

    if (error) {
      handleSupabaseError(error);
      return;
    }
  },

  endSession: async (
    sessionId: string,
    durationSeconds: number,
    status: Exclude<ModuleSessionStatus, "active">,
    resumePositionSeconds?: number,
  ): Promise<void> => {
    if (!supabase) {
      return;
    }

    const endedAt = new Date().toISOString();
    const payload: Record<string, unknown> = {
      ended_at: endedAt,
      last_seen_at: endedAt,
      duration_seconds: Math.max(0, Math.floor(durationSeconds)),
      session_status: status,
    };

    if (typeof resumePositionSeconds === "number") {
      payload.resume_position_seconds = Math.max(0, Math.floor(resumePositionSeconds));
    }

    const { data, error } = await supabase
      .from("module_sessions")
      .update(payload)
      .eq("id", sessionId)
      .select("id, user_id, course_id, module_id, enrollment_id")
      .single();

    if (error) {
      handleSupabaseError(error);
      return;
    }

    await analyticsService.trackEvent({
      eventName: "module_session_end",
      userId: data.user_id,
      courseId: data.course_id,
      moduleId: data.module_id,
      enrollmentId: data.enrollment_id,
      surface: "course_module_viewer",
      metadata: {
        sessionId,
        durationSeconds: Math.max(0, Math.floor(durationSeconds)),
        status,
        resumePositionSeconds:
          typeof resumePositionSeconds === "number" ? Math.max(0, Math.floor(resumePositionSeconds)) : null,
      },
    });
  },

  getUserRecentSessions: async (userId: string, limit = 10): Promise<ModuleSession[]> => {
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from("module_sessions")
      .select(selectSessionFields)
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (data || []).map((row) => mapSessionRow(row as SessionRow));
  },

  getUserRecentSessionCards: async (userId: string, limit = 10): Promise<EnrichedModuleSession[]> => {
    const sessions = await moduleSessionService.getUserRecentSessions(userId, limit);
    return enrichSessions(sessions);
  },

  getTrainerAccessibleSessions: async ({
    learnerId,
    courseId,
    limit = 20,
  }: TrainerSessionQuery = {}): Promise<ModuleSession[]> => {
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase.rpc("get_trainer_accessible_module_sessions", {
      p_learner_id: learnerId || null,
      p_course_id: courseId || null,
    });

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (Array.isArray(data) ? data : [])
      .map((row) => mapSessionRow(row as SessionRow))
      .slice(0, Math.max(1, limit));
  },

  getLearnerSessionsForTrainer: async (trainerId: string, learnerId?: string, limit = 20): Promise<ModuleSession[]> => {
    if (!trainerId) {
      return [];
    }

    return moduleSessionService.getTrainerAccessibleSessions({
      learnerId,
      limit,
    });
  },

  closeStaleSessions: async (userId: string) => {
    await closeStaleSessionsForUser(userId);
  },

  getTrainerLearnerSessionSummaries: async ({
    learnerId,
    courseId,
    limit = 20,
  }: TrainerSessionQuery = {}): Promise<TrainerLearnerSessionSummary[]> => {
    const sessions = await moduleSessionService.getTrainerAccessibleSessions({
      learnerId,
      courseId,
      limit: Math.max(limit * 5, limit),
    });

    const summaries = await summarizeTrainerLearnerSessions(sessions);
    return summaries.slice(0, Math.max(1, limit));
  },

  getLastAccessedModule: async (userId: string, enrollmentId?: string): Promise<ModuleSession | null> => {
    if (!supabase) {
      return null;
    }

    let query = supabase
      .from("module_sessions")
      .select(selectSessionFields)
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false })
      .order("started_at", { ascending: false })
      .limit(1);

    if (enrollmentId) {
      query = query.eq("enrollment_id", enrollmentId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      handleSupabaseError(error);
      return null;
    }

    return data ? mapSessionRow(data as SessionRow) : null;
  },

  getLastAccessedModuleCard: async (userId: string, enrollmentId?: string): Promise<EnrichedModuleSession | null> => {
    const session = await moduleSessionService.getLastAccessedModule(userId, enrollmentId);
    if (!session) {
      return null;
    }

    const [courseTitleMap, moduleTitleMap] = await Promise.all([
      fetchCourseTitles([session.courseId]),
      fetchModuleTitles([session.moduleId]),
    ]);

    return {
      ...session,
      courseTitle: courseTitleMap.get(session.courseId) || null,
      moduleTitle: moduleTitleMap.get(session.moduleId) || null,
    };
  },

  getSessionAggregatesByModule: async (userId: string, enrollmentId?: string): Promise<ModuleSessionAggregate[]> => {
    if (!supabase) {
      return [];
    }

    let query = supabase
      .from("module_sessions")
      .select(selectSessionFields)
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false });

    if (enrollmentId) {
      query = query.eq("enrollment_id", enrollmentId);
    }

    const { data, error } = await query;

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return summarizeSessionsByModule((data || []).map((row) => mapSessionRow(row as SessionRow)));
  },

  getAdminRecentSessionActivity: async (limit = 20): Promise<AdminRecentSessionSummary[]> => {
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from("module_sessions")
      .select(selectSessionFields)
      .order("last_seen_at", { ascending: false })
      .limit(Math.max(limit * 5, limit));

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    const summaries = await summarizeAdminRecentSessions((data || []).map((row) => mapSessionRow(row as SessionRow)));
    return summaries.slice(0, Math.max(1, limit));
  },
};