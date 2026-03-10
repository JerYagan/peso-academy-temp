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
import { certificateService, courseService, enrollmentService, moduleService, userService } from "@/services/supabaseDatabaseService";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Course, Enrollment, Module } from "@/types";
import { User } from "@/types/auth";
import { toast } from "sonner";
import { resolveTrainerOwnership } from "@/lib/trainerOwnership";

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

const TrainerLearners = () => {
  const { user } = useAuth();
  const [learners, setLearners] = useState<LearnerData[]>([]);
  const [visibleCourses, setVisibleCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showingAllCoursesFallback, setShowingAllCoursesFallback] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [selectedLearner, setSelectedLearner] = useState<LearnerData | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [learnerProgress, setLearnerProgress] = useState<LearnerCourseProgress[]>([]);

  useEffect(() => {
    if (user) {
      void loadLearners();
    }
  }, [user]);

  const loadLearners = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const ownership = await resolveTrainerOwnership(user);

      // Get all courses for this trainer
      const allCourses = await courseService.getCourses();
      
      // Filter courses for any profile row that belongs to this trainer account
      const myCourses = allCourses.filter((course) => ownership.ownerIds.includes(course.instructorId));
      const visibleCourses = myCourses.length > 0 ? myCourses : allCourses;
      setVisibleCourses(visibleCourses);
      setShowingAllCoursesFallback(myCourses.length === 0 && allCourses.length > 0);
      
      if (visibleCourses.length === 0) {
        setLearners([]);
        setLoading(false);
        return;
      }

      // Get enrollments directly for trainer's courses using a direct join query
      const myCourseIds = visibleCourses.map(c => c.id);
      
      let myEnrollments: Enrollment[] = [];
      if (myCourseIds.length > 0 && supabase) {
        // Query enrollments for the already-resolved trainer course ids.
        const { data, error } = await supabase
          .from("enrollments")
          .select("*")
          .in("course_id", myCourseIds)
          .order("enrolled_at", { ascending: false });
        
        if (error) {
          console.error("Error fetching enrollments with join:", error);
          // Fallback to simple query
          const { data: simpleData, error: simpleError } = await supabase
            .from("enrollments")
            .select("*")
            .in("course_id", myCourseIds)
            .order("enrolled_at", { ascending: false });
          
          if (simpleError) {
            console.error("Error fetching enrollments (fallback):", simpleError);
            toast.error("Failed to load enrollments");
          } else {
            myEnrollments = (simpleData || []).map((enrollment) => ({
              id: enrollment.id,
              userId: enrollment.user_id,
              courseId: enrollment.course_id,
              progress: enrollment.progress,
              status: enrollment.status,
              enrolledAt: enrollment.enrolled_at,
              completedAt: enrollment.completed_at || undefined,
              certificateId: enrollment.certificate_id || undefined,
            }));
          }
        } else {
          myEnrollments = (data || []).map((enrollment: any) => ({
            id: enrollment.id,
            userId: enrollment.user_id,
            courseId: enrollment.course_id,
            progress: enrollment.progress,
            status: enrollment.status,
            enrolledAt: enrollment.enrolled_at,
            completedAt: enrollment.completed_at || undefined,
            certificateId: enrollment.certificate_id || undefined,
          }));
        }
        
      }

      // Get unique learner IDs
      const uniqueLearnerIds = Array.from(new Set(myEnrollments.map((e) => e.userId)));

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
      const [learnerEnrollments, learnerCertificates, allCourses] = await Promise.all([
        enrollmentService.getEnrollments(learner.id),
        certificateService.getCertificates(learner.id),
        courseService.getCourses(),
      ]);

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

      await Promise.all(
        courseIds.map(async (courseId) => {
          const modules = await moduleService.getModulesByCourse(courseId);
          modulesByCourse.set(courseId, modules);
        }),
      );

      const progressRows = learnerEnrollments
        .map((enrollment) => {
          const course = courseLookup.get(enrollment.courseId) || null;
          const certificate = learnerCertificates.find((item) => item.courseId === enrollment.courseId);
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
    } catch (error) {
      console.error("Error loading learner progress:", error);
      toast.error("Failed to load learner progress");
      setLearnerProgress([]);
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
            <h1 className="text-3xl font-bold">My Learners</h1>
            <p className="text-muted-foreground mt-2">
              {showingAllCoursesFallback
                ? "Showing learners across all manageable courses because no direct trainer ownership match was found."
                : "View and manage your course learners"}
            </p>
          </div>
          <Button onClick={loadLearners} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Learners ({learners.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                <p className="ml-3 text-muted-foreground">Loading learners...</p>
              </div>
            ) : learners.length > 0 ? (
              <div className="space-y-4">
                {learners.map((learner) => (
                  <div
                    key={learner.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
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
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => void handleViewProgress(learner)}>View Progress</Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No learners enrolled in your courses yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={progressDialogOpen} onOpenChange={handleProgressDialogChange}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>{selectedLearner ? `${selectedLearner.name}'s Progress` : "Learner Progress"}</DialogTitle>
              <DialogDescription>
                View all enrolled courses, per-module progress, and certificate release status for this trainee.
              </DialogDescription>
            </DialogHeader>

            {progressLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="mr-3 h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading learner progress...</p>
              </div>
            ) : learnerProgress.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No enrollment progress data is available for this learner.
              </div>
            ) : (
              <div className="space-y-6">
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

                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-4">
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
                </ScrollArea>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default TrainerLearners;

