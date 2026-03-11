import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, BookOpen, Loader2, RefreshCw, Award, CheckCircle2, Clock3 } from "lucide-react";
import { courseService, moduleService, userService } from "@/services/supabaseDatabaseService";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useMemo } from "react";
import { Course, Enrollment, Module } from "@/types";
import { User } from "@/types/auth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { moduleSessionService, type ModuleSession, type TrainerLearnerSessionSummary } from "@/services/moduleSessionService";
import { useSearchParams } from "react-router-dom";

interface LearnerData extends User {
  enrollments: Enrollment[];
}

interface LearnerCourseProgress {
  enrollment: Enrollment;
  course: Course | null;
  certificateReleased: boolean;
  certificateIssuedAt?: string;
  modules: Array<{
    module: Module;
    completed: boolean;
    completedAt?: string;
    timeSpent?: number;
  }>;
}

interface LearnerSessionInsight {
  learnerId: string;
  totalSessions: number;
  totalDurationSeconds: number;
  lastSeenAt: string | null;
  lastCourseTitle: string | null;
  lastModuleTitle: string | null;
  repeatedShortSessionCount: number;
  needsAttention: boolean;
}

interface RecentLearnerSessionCard {
  id: string;
  courseTitle: string | null;
  moduleTitle: string | null;
  lastSeenAt: string;
  durationSeconds: number;
  sessionStatus: ModuleSession["sessionStatus"];
}

const SHORT_SESSION_SECONDS = 5 * 60;
const SHORT_SESSION_REPEAT_THRESHOLD = 3;

const formatRelativeActivity = (value: string | null) => {
  if (!value) return "No recent activity";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent activity";

  return formatDistanceToNow(date, { addSuffix: true });
};

const formatSessionDuration = (seconds: number) => {
  if (seconds <= 0) return "0m";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${Math.max(1, minutes)}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
};

const formatSessionStatus = (status: ModuleSession["sessionStatus"]) => {
  switch (status) {
    case "completed":
      return "Completed";
    case "timed_out":
      return "Timed out";
    case "abandoned":
      return "Left mid-session";
    default:
      return "In progress";
  }
};

const loadManagerEnrollments = async (courseIds: string[], learnerId?: string): Promise<Enrollment[]> => {
  if (!supabase || courseIds.length === 0) {
    return [];
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_course_manager_enrollments", {
    p_course_ids: courseIds,
    p_user_id: learnerId || null,
  });

  const rows = Array.isArray(rpcData) && !rpcError
    ? rpcData
    : (await supabase
        .from("enrollments")
        .select("id, user_id, course_id, progress, status, enrolled_at, completed_at, certificate_id")
        .in("course_id", courseIds)
        .order("enrolled_at", { ascending: false })).data || [];

  return rows.map((enrollment: any) => ({
    id: enrollment.id,
    userId: enrollment.user_id,
    courseId: enrollment.course_id,
    progress: enrollment.progress,
    status: enrollment.status,
    enrolledAt: enrollment.enrolled_at,
    completedAt: enrollment.completed_at || undefined,
    certificateId: enrollment.certificate_id || undefined,
  }));
};

const loadManagerCertificates = async (courseIds: string[], learnerId: string) => {
  if (!supabase || courseIds.length === 0) {
    return [] as Array<{ id: string; user_id: string; course_id: string; issued_at: string | null }>;
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_course_manager_certificates", {
    p_course_ids: courseIds,
    p_user_id: learnerId,
  });

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData as Array<{ id: string; user_id: string; course_id: string; issued_at: string | null }>;
  }

  const { data } = await supabase
    .from("certificates")
    .select("id, user_id, course_id, issued_at")
    .eq("user_id", learnerId)
    .in("course_id", courseIds)
    .order("issued_at", { ascending: false });

  return data || [];
};

const TrainerLearners = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [learners, setLearners] = useState<LearnerData[]>([]);
  const [visibleCourses, setVisibleCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [selectedLearner, setSelectedLearner] = useState<LearnerData | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [learnerProgress, setLearnerProgress] = useState<LearnerCourseProgress[]>([]);
  const [learnerSessionInsights, setLearnerSessionInsights] = useState<Record<string, LearnerSessionInsight>>({});
  const [selectedLearnerSessionSummaries, setSelectedLearnerSessionSummaries] = useState<Record<string, TrainerLearnerSessionSummary>>({});
  const [selectedLearnerRecentSessions, setSelectedLearnerRecentSessions] = useState<RecentLearnerSessionCard[]>([]);
  const focusedCourseId = searchParams.get("courseId");
  const attentionOnly = searchParams.get("attention") === "1";
  const focusedCourse = focusedCourseId ? visibleCourses.find((course) => course.id === focusedCourseId) || null : null;

  const filteredLearners = useMemo(() => {
    let nextLearners = learners;

    if (focusedCourseId) {
      nextLearners = nextLearners.filter((learner) => learner.enrollments.some((enrollment) => enrollment.courseId === focusedCourseId));
    }

    if (attentionOnly) {
      nextLearners = nextLearners.filter((learner) => learnerSessionInsights[learner.id]?.needsAttention);
    }

    return nextLearners;
  }, [attentionOnly, focusedCourseId, learnerSessionInsights, learners]);

  useEffect(() => {
    if (user) {
      void loadLearners();
    }
  }, [user]);

  const loadLearners = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const allCourses = await courseService.getCourses();
      const visibleCourses = allCourses;
      setVisibleCourses(visibleCourses);
      
      if (visibleCourses.length === 0) {
        setLearners([]);
        setLearnerSessionInsights({});
        setLoading(false);
        return;
      }

      // Get enrollments directly for trainer's courses using a direct join query
      const myCourseIds = visibleCourses.map(c => c.id);
      
      const myEnrollments = await loadManagerEnrollments(myCourseIds);

      // Get unique learner IDs
      const uniqueLearnerIds = Array.from(new Set(myEnrollments.map((e) => e.userId)));
      const trainerSessionSummaries = await moduleSessionService.getTrainerLearnerSessionSummaries({
        limit: Math.max(myEnrollments.length * 2, 50),
      });

      // Fetch user data for each learner
      const learnersData: LearnerData[] = [];
      
      for (const learnerId of uniqueLearnerIds) {
        try {
          const userData = await userService.getUserById(learnerId);
          if (userData) {
            const userEnrollments = myEnrollments.filter((e) => e.userId === learnerId);
            learnersData.push({
              ...userData,
              enrollments: userEnrollments,
            });
          }
        } catch (error) {
          console.error(`Error fetching user ${learnerId}:`, error);
        }
      }

      setLearners(learnersData);

      const learnerEnrollmentMap = new Map<string, Enrollment[]>();
      for (const enrollment of myEnrollments) {
        const current = learnerEnrollmentMap.get(enrollment.userId) || [];
        current.push(enrollment);
        learnerEnrollmentMap.set(enrollment.userId, current);
      }

      const insightMap = new Map<string, LearnerSessionInsight>();
      for (const summary of trainerSessionSummaries) {
        const learnerEnrollments = learnerEnrollmentMap.get(summary.learnerId) || [];
        const matchingEnrollment = learnerEnrollments.find((enrollment) => enrollment.courseId === summary.courseId);
        const courseNeedsAttention =
          summary.totalSessions >= SHORT_SESSION_REPEAT_THRESHOLD &&
          summary.totalDurationSeconds / summary.totalSessions <= SHORT_SESSION_SECONDS &&
          matchingEnrollment?.status !== "completed";
        const existing = insightMap.get(summary.learnerId);

        if (!existing) {
          insightMap.set(summary.learnerId, {
            learnerId: summary.learnerId,
            totalSessions: summary.totalSessions,
            totalDurationSeconds: summary.totalDurationSeconds,
            lastSeenAt: summary.lastSeenAt,
            lastCourseTitle: summary.courseTitle,
            lastModuleTitle: summary.lastModuleTitle,
            repeatedShortSessionCount: courseNeedsAttention ? 1 : 0,
            needsAttention: courseNeedsAttention,
          });
          continue;
        }

        existing.totalSessions += summary.totalSessions;
        existing.totalDurationSeconds += summary.totalDurationSeconds;
        existing.repeatedShortSessionCount += courseNeedsAttention ? 1 : 0;
        existing.needsAttention = existing.needsAttention || courseNeedsAttention;

        if (!existing.lastSeenAt || summary.lastSeenAt > existing.lastSeenAt) {
          existing.lastSeenAt = summary.lastSeenAt;
          existing.lastCourseTitle = summary.courseTitle;
          existing.lastModuleTitle = summary.lastModuleTitle;
        }
      }

      setLearnerSessionInsights(Object.fromEntries(Array.from(insightMap.entries())));
    } catch (error) {
      console.error("Error loading learners:", error);
      toast.error("Failed to load learners");
    } finally {
      setLoading(false);
    }
  };

  const handleViewProgress = async (learner: LearnerData) => {
    setSelectedLearner(learner);
    setProgressDialogOpen(true);
    setProgressLoading(true);

    try {
      const managerCourseIds = visibleCourses.map((course) => course.id);
      const [learnerEnrollments, learnerCertificates, allCourses, trainerSessionSummaries, recentSessions] = await Promise.all([
        loadManagerEnrollments(managerCourseIds, learner.id),
        loadManagerCertificates(managerCourseIds, learner.id),
        courseService.getCourses(),
        moduleSessionService.getTrainerLearnerSessionSummaries({ learnerId: learner.id, limit: 50 }),
        moduleSessionService.getLearnerSessionsForTrainer(user?.id || "", learner.id, 8),
      ]);

      const normalizedLearnerCertificates = learnerCertificates.map((certificate) => ({
        id: certificate.id,
        userId: certificate.user_id,
        courseId: certificate.course_id,
        issuedAt: certificate.issued_at,
      }));

      const enrollmentIds = learnerEnrollments.map((enrollment) => enrollment.id);
      const courseIds = Array.from(new Set(learnerEnrollments.map((enrollment) => enrollment.courseId)));
      const completionsLookup = new Map<string, Map<string, { completedAt?: string; timeSpent?: number }>>();

      if (supabase && enrollmentIds.length > 0) {
        const { data: completionRows, error } = await supabase
          .from("module_completions")
          .select("enrollment_id, module_id, completed_at, time_spent")
          .in("enrollment_id", enrollmentIds);

        if (error) {
          throw error;
        }

        for (const row of completionRows || []) {
          const enrollmentMap = completionsLookup.get(row.enrollment_id) || new Map<string, { completedAt?: string; timeSpent?: number }>();
          enrollmentMap.set(row.module_id, {
            completedAt: row.completed_at || undefined,
            timeSpent: row.time_spent || undefined,
          });
          completionsLookup.set(row.enrollment_id, enrollmentMap);
        }
      }

      const courseLookup = new Map(
        [...visibleCourses, ...allCourses].map((course) => [course.id, course]),
      );
      const modulesByCourse = new Map<string, Module[]>();

      const moduleResults = await Promise.allSettled(
        courseIds.map(async (courseId) => {
          const modules = await moduleService.getModulesByCourse(courseId);
          modulesByCourse.set(courseId, modules);
        }),
      );

      moduleResults.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`Error loading modules for course ${courseIds[index]}:`, result.reason);
        }
      });

      const progressRows = learnerEnrollments
        .map((enrollment) => {
          const course = courseLookup.get(enrollment.courseId) || null;
          const certificate = normalizedLearnerCertificates.find((item) => item.courseId === enrollment.courseId);
          const completionMap = completionsLookup.get(enrollment.id) || new Map<string, { completedAt?: string; timeSpent?: number }>();
          const modules = (modulesByCourse.get(enrollment.courseId) || []).map((module) => {
            const completion = completionMap.get(module.id);
            return {
              module,
              completed: Boolean(completion),
              completedAt: completion?.completedAt,
              timeSpent: completion?.timeSpent,
            };
          });

          return {
            enrollment,
            course,
            certificateReleased: Boolean(enrollment.certificateId || certificate),
            certificateIssuedAt: certificate?.issuedAt,
            modules,
          } satisfies LearnerCourseProgress;
        })
        .sort((left, right) => new Date(right.enrollment.enrolledAt).getTime() - new Date(left.enrollment.enrolledAt).getTime());

      setLearnerProgress(progressRows);
      setSelectedLearnerSessionSummaries(
        Object.fromEntries(trainerSessionSummaries.map((summary) => [summary.courseId, summary]))
      );
      setSelectedLearnerRecentSessions(
        recentSessions
          .map((session) => ({
            id: session.id,
            courseTitle: courseLookup.get(session.courseId)?.title || null,
            moduleTitle:
              (modulesByCourse.get(session.courseId) || []).find((module) => module.id === session.moduleId)?.title || null,
            lastSeenAt: session.lastSeenAt,
            durationSeconds: session.durationSeconds,
            sessionStatus: session.sessionStatus,
          }))
      );
    } catch (error) {
      console.error("Error loading learner progress:", error);
      toast.error("Failed to load learner progress");
      setLearnerProgress([]);
      setSelectedLearnerSessionSummaries({});
      setSelectedLearnerRecentSessions([]);
    } finally {
      setProgressLoading(false);
    }
  };

  const handleProgressDialogChange = (open: boolean) => {
    setProgressDialogOpen(open);
    if (!open) {
      setSelectedLearner(null);
      setLearnerProgress([]);
      setProgressLoading(false);
      setSelectedLearnerSessionSummaries({});
      setSelectedLearnerRecentSessions([]);
    }
  };

  const completedCourses = learnerProgress.filter((item) => item.enrollment.status === "completed").length;
  const releasedCertificates = learnerProgress.filter((item) => item.certificateReleased).length;
  const averageProgress = learnerProgress.length > 0
    ? Math.round(learnerProgress.reduce((sum, item) => sum + item.enrollment.progress, 0) / learnerProgress.length)
    : 0;

  const formatTimeSpent = (minutes?: number) => {
    if (!minutes || minutes <= 0) return "No time tracked";
    if (minutes < 60) return `${minutes} min`;
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Learners</h1>
            <p className="text-muted-foreground mt-2">View and manage learners across all courses</p>
          </div>
          <Button onClick={loadLearners} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {focusedCourse || attentionOnly ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Focused learner review</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {focusedCourse
                    ? `Showing learners tied to ${focusedCourse.title}${attentionOnly ? " with attention flags only" : ""}.`
                    : "Showing only learners with current attention flags from session behavior."}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.delete("courseId");
                  nextParams.delete("attention");
                  setSearchParams(nextParams);
                }}
              >
                Clear focus
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>All Learners ({filteredLearners.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                <p className="ml-3 text-muted-foreground">Loading learners...</p>
              </div>
            ) : filteredLearners.length > 0 ? (
              <div className="space-y-4">
                {filteredLearners.map((learner) => (
                  <div
                    key={learner.id}
                    className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        {learner.avatar ? (
                          <img 
                            src={learner.avatar} 
                            alt={learner.name} 
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <Users className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{learner.name}</p>
                        <p className="text-sm text-muted-foreground">{learner.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <BookOpen className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {learner.enrollments.length} course{learner.enrollments.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {learnerSessionInsights[learner.id] ? (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <p>
                              Last activity {formatRelativeActivity(learnerSessionInsights[learner.id].lastSeenAt)}
                            </p>
                            <p>
                              Last accessed {learnerSessionInsights[learner.id].lastModuleTitle || "module"}
                              {learnerSessionInsights[learner.id].lastCourseTitle
                                ? ` • ${learnerSessionInsights[learner.id].lastCourseTitle}`
                                : ""}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {learnerSessionInsights[learner.id]?.needsAttention ? (
                        <Badge variant="secondary" className="border-amber-300 bg-amber-50 text-amber-700">
                          Repeated short sessions
                        </Badge>
                      ) : null}
                      <Button variant="outline" onClick={() => void handleViewProgress(learner)}>View Progress</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {focusedCourse || attentionOnly
                    ? "No learners match the current dashboard focus."
                    : "No learners enrolled in your courses yet"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={progressDialogOpen} onOpenChange={handleProgressDialogChange}>
          <DialogContent className="flex h-[calc(100vh-1.5rem)] min-h-0 w-[calc(100vw-1.5rem)] max-w-5xl flex-col overflow-hidden p-0 sm:h-[90vh] sm:w-full">
            <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
              <DialogTitle>{selectedLearner ? `${selectedLearner.name}'s Progress` : "Learner Progress"}</DialogTitle>
              <DialogDescription>
                View all enrolled courses, per-module progress, and certificate release status for this trainee.
              </DialogDescription>
            </DialogHeader>

            {progressLoading ? (
              <div className="flex items-center justify-center px-4 py-16 sm:px-6">
                <Loader2 className="mr-3 h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading learner progress...</p>
              </div>
            ) : learnerProgress.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground sm:px-6">
                No enrollment progress data is available for this learner.
              </div>
            ) : (
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-6 px-4 py-4 pb-6 sm:px-6">
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Courses</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-semibold">{learnerProgress.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Completed Courses</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-semibold">{completedCourses}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Certificates Released</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-semibold">{releasedCertificates}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-semibold">{averageProgress}%</div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Recent Session History</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedLearnerRecentSessions.length > 0 ? (
                          selectedLearnerRecentSessions.map((session) => (
                            <div key={session.id} className="rounded-lg border p-3">
                              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <p className="font-medium">{session.moduleTitle || "Untitled module"}</p>
                                  <p className="text-sm text-muted-foreground">{session.courseTitle || "Untitled course"}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="secondary">{formatSessionDuration(session.durationSeconds)}</Badge>
                                  <Badge variant="outline">{formatSessionStatus(session.sessionStatus)}</Badge>
                                </div>
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">
                                Last opened {formatRelativeActivity(session.lastSeenAt)}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No recent trainer-visible session history is available for this learner yet.</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Session Signals</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {learnerSessionInsights[selectedLearner?.id || ""] ? (
                          <>
                            <div className="rounded-lg border p-3">
                              <p className="text-sm text-muted-foreground">Last accessed module</p>
                              <p className="mt-1 font-medium">
                                {learnerSessionInsights[selectedLearner?.id || ""].lastModuleTitle || "No recorded session"}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {learnerSessionInsights[selectedLearner?.id || ""].lastCourseTitle || "No recorded course context"}
                              </p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <p className="text-sm text-muted-foreground">Last activity</p>
                              <p className="mt-1 font-medium">
                                {formatRelativeActivity(learnerSessionInsights[selectedLearner?.id || ""].lastSeenAt)}
                              </p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <p className="text-sm text-muted-foreground">Intervention signal</p>
                              <p className="mt-1 font-medium">
                                {learnerSessionInsights[selectedLearner?.id || ""].needsAttention
                                  ? `${learnerSessionInsights[selectedLearner?.id || ""].repeatedShortSessionCount} course signal(s) need review`
                                  : "No repeated short-session pattern detected"}
                              </p>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">Session signals will appear after the learner opens tracked modules.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4 pb-1">
                    {learnerProgress.map((item) => (
                      <Card key={item.enrollment.id}>
                        <CardHeader>
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <CardTitle className="text-lg">{item.course?.title || "Unknown Course"}</CardTitle>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {item.course?.category || "Course"} • Enrolled {new Date(item.enrollment.enrolledAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{item.enrollment.status}</Badge>
                              <Badge variant={item.certificateReleased ? "default" : "secondary"}>
                                {item.certificateReleased ? "Certificate Released" : "Certificate Not Released"}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {selectedLearnerSessionSummaries[item.enrollment.courseId] ? (
                            <div className="grid gap-3 md:grid-cols-4 text-sm">
                              <div className="rounded-lg border p-3">
                                <p className="text-muted-foreground">Last accessed module</p>
                                <p className="mt-1 font-medium">
                                  {selectedLearnerSessionSummaries[item.enrollment.courseId].lastModuleTitle || "No tracked module"}
                                </p>
                              </div>
                              <div className="rounded-lg border p-3">
                                <p className="text-muted-foreground">Last activity</p>
                                <p className="mt-1 font-medium">
                                  {formatRelativeActivity(selectedLearnerSessionSummaries[item.enrollment.courseId].lastSeenAt)}
                                </p>
                              </div>
                              <div className="rounded-lg border p-3">
                                <p className="text-muted-foreground">Session depth</p>
                                <p className="mt-1 font-medium">
                                  {selectedLearnerSessionSummaries[item.enrollment.courseId].totalSessions} sessions • {formatSessionDuration(selectedLearnerSessionSummaries[item.enrollment.courseId].totalDurationSeconds)}
                                </p>
                              </div>
                              <div className="rounded-lg border p-3">
                                <p className="text-muted-foreground">Attention flag</p>
                                <p className="mt-1 font-medium">
                                  {selectedLearnerSessionSummaries[item.enrollment.courseId].totalSessions >= SHORT_SESSION_REPEAT_THRESHOLD &&
                                  selectedLearnerSessionSummaries[item.enrollment.courseId].totalDurationSeconds / selectedLearnerSessionSummaries[item.enrollment.courseId].totalSessions <= SHORT_SESSION_SECONDS &&
                                  item.enrollment.status !== "completed"
                                    ? "Repeated short sessions"
                                    : "No issue detected"}
                                </p>
                              </div>
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Course Progress</span>
                              <span className="font-medium">{item.enrollment.progress}%</span>
                            </div>
                            <Progress value={item.enrollment.progress} />
                          </div>

                          <div className="grid gap-3 md:grid-cols-3 text-sm">
                            <div className="rounded-lg border p-3">
                              <p className="text-muted-foreground">Modules Completed</p>
                              <p className="mt-1 font-medium">
                                {item.modules.filter((moduleItem) => moduleItem.completed).length}/{item.modules.length}
                              </p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <p className="text-muted-foreground">Certificate Status</p>
                              <p className="mt-1 font-medium">
                                {item.certificateReleased
                                  ? item.certificateIssuedAt
                                    ? `Released ${new Date(item.certificateIssuedAt).toLocaleDateString()}`
                                    : "Released"
                                  : "Not released"}
                              </p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <p className="text-muted-foreground">Completion Status</p>
                              <p className="mt-1 font-medium">{item.enrollment.status}</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                              <p className="font-medium">Module Progress</p>
                            </div>
                            {item.modules.length > 0 ? (
                              <div className="space-y-2">
                                {item.modules.map((moduleItem, index) => (
                                  <div key={moduleItem.module.id} className="rounded-lg border p-3">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                      <div>
                                        <p className="font-medium">Module {index + 1}: {moduleItem.module.title}</p>
                                        <p className="text-sm text-muted-foreground">{moduleItem.module.description}</p>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <Badge variant={moduleItem.completed ? "default" : "secondary"}>
                                          {moduleItem.completed ? (
                                            <>
                                              <CheckCircle2 className="mr-1 h-3 w-3" />
                                              Completed
                                            </>
                                          ) : "Pending"}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Clock3 className="h-3 w-3" />
                                        {formatTimeSpent(moduleItem.timeSpent)}
                                      </span>
                                      <span>
                                        {moduleItem.completedAt
                                          ? `Completed ${new Date(moduleItem.completedAt).toLocaleDateString()}`
                                          : "Not completed yet"}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No modules are available for this course yet.</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default TrainerLearners;

