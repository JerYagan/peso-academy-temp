import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BookOpen,
  Clock,
  Users,
  Star,
  Award,
  ChevronRight,
  CheckCircle2,
  Circle,
  Play,
  FileText,
  Upload,
  FileQuestion,
  LogOut,
  AlertCircle,
} from "lucide-react";
import { courseService, enrollmentService, getEnrollmentErrorFeedback, moduleService, moduleCompletionService } from "@/services/supabaseDatabaseService";
import { Course, Module, Enrollment } from "@/types";
import { toast } from "sonner";
import ModuleContentViewer from "@/components/course/ModuleContentViewer";
import DocumentViewer from "@/components/course/DocumentViewer";
import { supabase } from "@/lib/supabase";

const COURSE_PREVIEW_STORAGE_PREFIX = "peso-course-preview:";

const CourseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [loadingSelectedModuleId, setLoadingSelectedModuleId] = useState<string | null>(null);
  const [completedModuleIds, setCompletedModuleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showUnenrollConfirm, setShowUnenrollConfirm] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [enrollmentRecovery, setEnrollmentRecovery] = useState<ReturnType<typeof getEnrollmentErrorFeedback> | null>(null);
  const previewKey = searchParams.get("previewKey");
  const isPreviewMode = Boolean(searchParams.get("preview") && previewKey);
  const previewEnrollmentId = `preview-enrollment-${id || "course"}`;
  const locationState = location.state as { entrySource?: string; moduleId?: string } | null;
  const moduleRequestSequenceRef = useRef(0);

  const moduleEntrySource = (() => {
    if (typeof locationState?.entrySource === "string" && locationState.entrySource.trim()) {
      return locationState.entrySource;
    }

    if (isPreviewMode) {
      return "course_preview";
    }

    return "course_detail";
  })();

  const requestedModuleId =
    typeof locationState?.moduleId === "string" && locationState.moduleId.trim()
      ? locationState.moduleId
      : null;

  useEffect(() => {
    if (id) {
      void loadCourseData();
    }
  }, [id, user, isPreviewMode, previewKey, requestedModuleId]);

  const loadModuleContent = async (moduleId: string): Promise<Module | null> => {
    setLoadingSelectedModuleId(moduleId);
    const requestSequence = moduleRequestSequenceRef.current + 1;
    moduleRequestSequenceRef.current = requestSequence;

    try {
      const module = await moduleService.getModule(moduleId);
      if (moduleRequestSequenceRef.current !== requestSequence) {
        return null;
      }

      return module;
    } finally {
      if (moduleRequestSequenceRef.current === requestSequence) {
        setLoadingSelectedModuleId(null);
      }
    }
  };

  const loadCourseData = async () => {
    if (!id) return;

    setLoading(true);
    try {
      let courseData: Course | null = null;
      let modulesSourceCourseId: string | null = id;

      if (isPreviewMode && typeof window !== "undefined" && previewKey) {
        const rawPreview =
          window.sessionStorage.getItem(previewKey) ||
          window.localStorage.getItem(`${COURSE_PREVIEW_STORAGE_PREFIX}${previewKey}`);

        if (rawPreview) {
          const previewData = JSON.parse(rawPreview) as Partial<Course> & {
            previewSourceCourseId?: string | null;
          };

          courseData = {
            id: previewData.id || id,
            title: previewData.title || "Course Preview",
            description: previewData.description || "",
            category: previewData.category || "Digital Skills",
            level: previewData.level || "Beginner",
            duration: previewData.duration || 0,
            instructor: previewData.instructor || "",
            instructorId: previewData.instructorId || "",
            assignedTrainer: previewData.assignedTrainer || {
              id: previewData.instructorId || null,
              displayName: previewData.instructor || "PESO Training Team",
              roleLabel: "Trainer",
            },
            thumbnail: previewData.thumbnail,
            courseDocument: previewData.courseDocument,
            isTESDAAccredited: previewData.isTESDAAccredited || false,
            skills: previewData.skills || [],
            enrolledCount: previewData.enrolledCount || 0,
            rating: previewData.rating || 0,
            createdAt: previewData.createdAt || new Date().toISOString(),
            published: previewData.published,
          };
          modulesSourceCourseId = previewData.previewSourceCourseId || (id !== "__preview__" ? id : null);
        }
      }

      if (!courseData) {
        courseData = await courseService.getCourse(id);
      }

      if (!courseData) {
        toast.error("Course not found");
        navigate("/courses");
        return;
      }
      setCourse(courseData);

      const [modulesData, enrollments] = await Promise.all([
        modulesSourceCourseId ? moduleService.getModulesByCourseSummary(modulesSourceCourseId) : Promise.resolve([]),
        !isPreviewMode && user ? enrollmentService.getEnrollments(user.id) : Promise.resolve([]),
      ]);
      setModules(modulesData);

      const initialModule = requestedModuleId
        ? modulesData.find((module) => module.id === requestedModuleId) || modulesData[0] || null
        : modulesData[0] || null;

      if (isPreviewMode) {
        const previewModule = !courseData.courseDocument && initialModule
          ? await loadModuleContent(initialModule.id)
          : initialModule;
        setEnrollment({
          id: previewEnrollmentId,
          userId: user?.id || "preview-user",
          courseId: courseData.id,
          progress: 0,
          status: "enrolled",
          enrolledAt: new Date().toISOString(),
        });
        setSelectedModule(previewModule);
        setCompletedModuleIds([]);
        setLoading(false);
        return;
      }

      if (!user) {
        setEnrollment(null);
        setSelectedModule(initialModule);
        setLoading(false);
        return;
      }

      const userEnrollment = enrollments.find((e) => e.courseId === id);
      
      if (!userEnrollment) {
        setEnrollment(null);
        setSelectedModule(initialModule);
        setLoading(false);
        return;
      }

      setEnrollment(userEnrollment);

      const [completed, hydratedModule] = await Promise.all([
        moduleCompletionService.getCompletedModules(userEnrollment.id),
        !courseData.courseDocument && initialModule
          ? loadModuleContent(initialModule.id)
          : Promise.resolve(initialModule),
      ]);
      setCompletedModuleIds(completed);
      
      if (supabase) {
        await supabase
          .from("module_completions")
          .select("module_id, time_spent")
          .eq("enrollment_id", userEnrollment.id);
      }

      setSelectedModule(hydratedModule);
    } catch (error) {
      console.error("Error loading course data:", error);
      toast.error("Failed to load course data");
    } finally {
      setLoading(false);
    }
  };

  const handleModuleSelect = async (module: Module) => {
    if (course?.courseDocument || selectedModule?.id === module.id) {
      setSelectedModule(module);
      return;
    }

    setSelectedModule(module);
    const hydratedModule = await loadModuleContent(module.id);
    if (hydratedModule) {
      setSelectedModule(hydratedModule);
    }
  };

  const handleModuleComplete = async (moduleId: string, timeSpentMinutes?: number) => {
    if (!enrollment) return;

    if (isPreviewMode) {
      if (completedModuleIds.includes(moduleId)) return;

      const newCompleted = [...completedModuleIds, moduleId];
      const previewProgress = modules.length > 0
        ? Math.round((newCompleted.length / modules.length) * 100)
        : 0;

      setCompletedModuleIds(newCompleted);
      setEnrollment((current) =>
        current
          ? {
              ...current,
              progress: previewProgress,
              status: newCompleted.length >= modules.length ? "completed" : "in-progress",
              completedAt: newCompleted.length >= modules.length ? new Date().toISOString() : current.completedAt,
            }
          : current,
      );

      toast.success("Preview progress updated");
      if (modules.length > 0 && newCompleted.length >= modules.length) {
        setShowCompletionDialog(true);
      }
      return;
    }

    if (!user) return;

    try {
      await moduleCompletionService.markModuleComplete(
        enrollment.id,
        moduleId,
        timeSpentMinutes
      );
      const newCompleted = [...completedModuleIds, moduleId];
      setCompletedModuleIds(newCompleted);

      // Reload enrollment to get updated progress
      const enrollments = await enrollmentService.getEnrollments(user.id);
      const updatedEnrollment = enrollments.find((e) => e.courseId === id);
      if (updatedEnrollment) {
        setEnrollment(updatedEnrollment);
      }

      toast.success("Module marked as completed!");
      // If all modules are now completed, show congratulations dialog
      if (modules.length > 0 && newCompleted.length >= modules.length) {
        setShowCompletionDialog(true);
      }
    } catch (error) {
      console.error("Error completing module:", error);
      toast.error("Failed to mark module as complete");
    }
  };

  const handleUnenroll = async () => {
    if (!enrollment) return;
    setUnenrolling(true);
    try {
      await enrollmentService.unenroll(enrollment.id, false);
      toast.success("You have been unenrolled from this course.");
      setShowUnenrollConfirm(false);
      navigate("/courses");
    } catch (error) {
      console.error("Error unenrolling:", error);
      toast.error("Failed to unenroll. Please try again.");
    } finally {
      setUnenrolling(false);
    }
  };

  const isModuleCompleted = (moduleId: string) => {
    return completedModuleIds.includes(moduleId);
  };

  const canAccessModule = (module: Module) => {
    if (module.prerequisites.length === 0) return true;
    return module.prerequisites.every((prereqId) => completedModuleIds.includes(prereqId));
  };

  const handleEnrollInCourse = async () => {
    if (!id || !user) return;
    setEnrolling(true);
    setEnrollmentRecovery(null);
    try {
      await enrollmentService.enrollInCourse(user.id, id);
      toast.success("You are now enrolled!");
      await loadCourseData();
    } catch (error) {
      console.error("Error enrolling:", error);
      const feedback = getEnrollmentErrorFeedback(error, course?.title);
      if (feedback.code === "already_enrolled") {
        await loadCourseData();
      }
      setEnrollmentRecovery(feedback);
      toast.error(feedback.toastMessage);
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading course...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!course) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Course not found</p>
            <Button asChild className="mt-4">
              <Link to="/courses">Back to Courses</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const assignedTrainerName = course.assignedTrainer?.displayName || course.instructor || "PESO Training Team";
  const assignedTrainerRoleLabel = course.assignedTrainer?.roleLabel || "Trainer";

  // Course description view: not enrolled (guest or logged-in)
  if (!enrollment) {
    const signupUrl = `/signup?redirect=${encodeURIComponent(`/courses/${id}`)}`;
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {isPreviewMode && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium">Preview Mode</p>
                  <p className="text-sm text-muted-foreground">This is a trainee-style preview of the current course draft.</p>
                </div>
                <Badge variant="outline">Draft Preview</Badge>
              </CardContent>
            </Card>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link to="/courses">
              <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
              Back to Courses
            </Link>
          </Button>
          <Card>
            <CardHeader>
              <h1 className="text-3xl font-bold">{course.title}</h1>
              <CardDescription>{course.description}</CardDescription>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Badge variant={course.isTESDAAccredited ? "default" : "secondary"}>
                  {course.isTESDAAccredited && <Award className="w-3 h-3 mr-1" />}
                  {course.category}
                </Badge>
                <Badge variant="outline">{course.level}</Badge>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {course.duration}h
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {course.enrolledCount ?? 0} enrolled
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  Assigned {assignedTrainerRoleLabel.toLowerCase()}: {assignedTrainerName}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {course.thumbnail && (
                <div className="overflow-hidden rounded-xl border bg-muted">
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="h-64 w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              {modules.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Modules ({modules.length})</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {modules.map((m, i) => (
                      <li key={m.id}>
                        {i + 1}. {m.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {enrollmentRecovery ? (
                <Alert variant={enrollmentRecovery.code === "unknown" ? "destructive" : "default"}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{enrollmentRecovery.title}</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-3">
                      <p>{enrollmentRecovery.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {enrollmentRecovery.canRetry ? (
                          <Button size="sm" onClick={() => void handleEnrollInCourse()} disabled={enrolling}>
                            Retry enrollment
                          </Button>
                        ) : null}
                        {enrollmentRecovery.suggestedActions.includes("profile") ? (
                          <Button asChild size="sm" variant="outline">
                            <Link to="/profile">Update profile</Link>
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => setEnrollmentRecovery(null)}>
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-3">
                {isPreviewMode ? null : user ? (
                  <Button onClick={handleEnrollInCourse} disabled={enrolling}>
                    {enrolling ? "Enrolling..." : "Enroll in this course"}
                  </Button>
                ) : (
                  <Button asChild>
                    <Link to={signupUrl}>Create Account to Enroll</Link>
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link to="/courses">Back to Course Catalog</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {isPreviewMode && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-medium">Preview Mode</p>
                <p className="text-sm text-muted-foreground">This preview uses the same learner course layout while keeping progress changes local to this tab.</p>
              </div>
              <Badge variant="outline">Draft Preview</Badge>
            </CardContent>
          </Card>
        )}

        {/* Course Header */}
        <div className="space-y-4">
          {course.thumbnail && (
            <div className="overflow-hidden rounded-2xl border bg-muted shadow-sm">
              <img
                src={course.thumbnail}
                alt={course.title}
                className="h-64 w-full object-cover lg:h-80"
                loading="lazy"
              />
            </div>
          )}

          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/courses">
                    <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
                    Back to Courses
                  </Link>
                </Button>
              </div>
              <h1 className="text-3xl font-bold">{course.title}</h1>
              <p className="text-muted-foreground">{course.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Badge variant={course.isTESDAAccredited ? "default" : "secondary"}>
              {course.isTESDAAccredited && <Award className="w-3 h-3 mr-1" />}
              {course.category}
            </Badge>
            <Badge variant="outline">{course.level}</Badge>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {course.duration}h
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {course.enrolledCount} enrolled
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              Assigned {assignedTrainerRoleLabel.toLowerCase()}: {assignedTrainerName}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              {course.rating}
            </div>
            {!isPreviewMode && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground hover:text-destructive"
                onClick={() => setShowUnenrollConfirm(true)}
              >
                <LogOut className="w-4 h-4 mr-1" />
                Unenroll from course
              </Button>
            )}
          </div>

          {/* Progress Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Your Progress</CardTitle>
                <span className="text-sm font-medium">{enrollment.progress}%</span>
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={enrollment.progress} className="mb-2" />
              <p className="text-sm text-muted-foreground">
                {completedModuleIds.length} of {modules.length} modules completed
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Modules Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Modules</CardTitle>
                <CardDescription>{modules.length} modules in this course</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="p-4 space-y-1">
                    {modules.map((module, index) => {
                      const completed = isModuleCompleted(module.id);
                      const canAccess = canAccessModule(module);
                      const isSelected = selectedModule?.id === module.id;

                      return (
                        <button
                          key={module.id}
                          onClick={() => {
                            if (canAccess) {
                              void handleModuleSelect(module);
                            }
                          }}
                          disabled={!canAccess}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : canAccess
                              ? "hover:bg-accent"
                              : "opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              {completed ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <Circle className="w-5 h-5" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium opacity-70">
                                  Module {index + 1}
                                </span>
                                {!canAccess && (
                                  <Badge variant="outline" className="text-xs">
                                    Locked
                                  </Badge>
                                )}
                              </div>
                              <p className={`text-sm font-medium ${isSelected ? "text-primary-foreground" : ""}`}>
                                {module.title}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Module Content Area */}
          <div className="lg:col-span-3">
            {course.courseDocument ? (
              // Show course document if available
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Course Document
                  </CardTitle>
                  <CardDescription>
                    {course.title} - Course Material
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DocumentViewer url={course.courseDocument} title={course.title} />
                </CardContent>
              </Card>
            ) : loadingSelectedModuleId && selectedModule?.id === loadingSelectedModuleId ? (
              <Card>
                <CardContent className="flex min-h-[400px] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">Loading module...</p>
                  </div>
                </CardContent>
              </Card>
            ) : selectedModule ? (
              // Show module content if no course document
              <ModuleContentViewer
                module={selectedModule}
                enrollment={enrollment}
                isCompleted={isModuleCompleted(selectedModule.id)}
                isPreviewMode={isPreviewMode}
                entrySource={moduleEntrySource}
                onComplete={(timeSpentMinutes) => handleModuleComplete(selectedModule.id, timeSpentMinutes)}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {modules.length > 0 
                      ? "Select a module to start learning" 
                      : "No course content available"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Congratulations – course completed */}
      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              Congratulations!
            </DialogTitle>
            <DialogDescription>
              You have completed this course. Your certificate is ready to view and download.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button asChild>
              <Link to="/certificates">View Certificate</Link>
            </Button>
            <Button variant="outline" onClick={() => setShowCompletionDialog(false)}>
              Stay on course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unenroll confirmation */}
      <AlertDialog open={showUnenrollConfirm} onOpenChange={setShowUnenrollConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unenroll from course?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be removed from this course and your progress will be lost. You can enroll again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unenrolling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenroll}
              disabled={unenrolling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unenrolling ? "Unenrolling..." : "Unenroll"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default CourseDetail;

