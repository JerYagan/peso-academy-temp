import DashboardLayout from "@/components/DashboardLayout";
import { LearnerLeaderboardCard } from "@/components/course/LearnerLeaderboardCard";
import { ProgramManagementDialog } from "@/components/course/ProgramManagementDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { BookOpen, Plus, Users, Edit, Trash2, Settings, Eye, EyeOff, Award, Clock3, Laptop2, BriefcaseBusiness, MessageSquareHeart, GraduationCap, BarChart3, FolderKanban } from "lucide-react";
import { courseService, programService } from "@/services/supabaseDatabaseService";
import { reportingService, type CourseContentCompletenessReport, type LearnerLeaderboard } from "@/services/reportingService";
import { CourseCreateEditDialog } from "@/components/course/CourseCreateEditDialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useMemo } from "react";
import { Course, Program } from "@/types";
import { toast } from "sonner";

const getCourseAudienceLabel = (audience: Course["traineeAudience"]) => {
  switch (audience) {
    case "peso_client":
      return "PESO Clients";
    case "peso_employee":
      return "PESO Employees";
    default:
      return "General Public";
  }
};

const TrainerCourses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null);
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [leaderboardContext, setLeaderboardContext] = useState<{ scope: "course" | "program"; title: string; description: string } | null>(null);
  const [courseLeaderboard, setCourseLeaderboard] = useState<LearnerLeaderboard | null>(null);
  const [contentReportsByCourseId, setContentReportsByCourseId] = useState<Record<string, CourseContentCompletenessReport>>({});
  const [publishBlockedReport, setPublishBlockedReport] = useState<CourseContentCompletenessReport | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const highlightedCourseId = searchParams.get("courseId");

  const sortedCourses = useMemo(() => {
    if (!highlightedCourseId) {
      return courses;
    }

    return [...courses].sort((left, right) => {
      if (left.id === highlightedCourseId) return -1;
      if (right.id === highlightedCourseId) return 1;
      return left.title.localeCompare(right.title);
    });
  }, [courses, highlightedCourseId]);
  const highlightedCourse = highlightedCourseId ? courses.find((course) => course.id === highlightedCourseId) || null : null;

  useEffect(() => {
    if (user) {
      void refreshProgramsAndCourses();
    }
  }, [user]);

  const refreshProgramsAndCourses = async () => {
    setLoading(true);
    try {
      const [allCourses, allPrograms] = await Promise.all([
        courseService.getCourses(),
        programService.getPrograms(),
      ]);
      setCourses(allCourses);
      setPrograms(allPrograms);

      const contentReports = await reportingService.getCourseContentCompletenessReports();
      setContentReportsByCourseId(
        Object.fromEntries(contentReports.map((report) => [report.courseId, report])),
      );
    } catch (error) {
      console.error("Error loading course data:", error);
      toast.error("Failed to load courses and programs");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!deleteCourseId) return;

    try {
      await courseService.deleteCourse(deleteCourseId);
      toast.success("Course deleted successfully");
      setDeleteCourseId(null);
      void refreshProgramsAndCourses();
    } catch (error) {
      console.error("Error deleting course:", error);
      const message = error instanceof Error ? error.message : "Failed to delete course";
      toast.error(message);
    }
  };

  const handleManageModules = (course: Course) => {
    navigate(`/trainer/courses/${course.id}/modules`);
  };

  const handleTogglePublish = async (course: Course) => {
    const next = !(course.published !== false);

    if (next) {
      const contentReport = contentReportsByCourseId[course.id];
      if (contentReport && !contentReport.readyToPublish) {
        setPublishBlockedReport(contentReport);
        return;
      }
    }

    try {
      await courseService.updateCourse(course.id, { published: next });
      toast.success(next ? "Course is now visible to trainees" : "Course is now hidden from trainees");
      void refreshProgramsAndCourses();
    } catch (error) {
      console.error("Error updating publish state:", error);
      toast.error("Failed to update course visibility");
    }
  };

  const loadLeaderboard = async (course: Course) => {
    setLeaderboardContext({
      scope: "course",
      title: `${course.title} learner leaderboard`,
      description: "Staff-only course ranking based on completion, assessment performance, tracked learning time, certificate completion, and recency.",
    });
    setLeaderboardLoading(true);

    try {
      const leaderboard = await reportingService.getLearnerCourseLeaderboard(course.id, {
        includeIncomplete: true,
        limit: 12,
      });
      setCourseLeaderboard(leaderboard);
    } catch (error) {
      console.error("Error loading learner leaderboard:", error);
      toast.error("Failed to load learner leaderboard");
      setCourseLeaderboard(null);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const loadProgramLeaderboard = async (program: Program) => {
    setLeaderboardContext({
      scope: "program",
      title: `${program.title} learner leaderboard`,
      description: "Staff-only program ranking based on aggregated course completion, assessment performance, tracked learning time, certificate completion, and recency.",
    });
    setLeaderboardLoading(true);

    try {
      const leaderboard = await reportingService.getLearnerProgramLeaderboard(program.id, {
        includeIncomplete: true,
        limit: 12,
      });
      setCourseLeaderboard(leaderboard);
    } catch (error) {
      console.error("Error loading program leaderboard:", error);
      toast.error("Failed to load program leaderboard");
      setCourseLeaderboard(null);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const getCourseVisual = (course: Course) => {
    const value = `${course.category} ${course.title}`.toLowerCase();

    if (value.includes("technical") || value.includes("web") || value.includes("digital") || value.includes("mobile")) {
      return {
        icon: Laptop2,
        surfaceClass: "bg-indigo-50 dark:bg-indigo-950/30",
        iconWrapClass: "bg-indigo-600/10 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
      };
    }

    if (value.includes("business") || value.includes("entrepreneur") || value.includes("bookkeeping") || value.includes("accounting")) {
      return {
        icon: BriefcaseBusiness,
        surfaceClass: "bg-amber-50 dark:bg-amber-950/30",
        iconWrapClass: "bg-amber-600/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
      };
    }

    if (value.includes("customer") || value.includes("communication") || value.includes("career")) {
      return {
        icon: MessageSquareHeart,
        surfaceClass: "bg-rose-50 dark:bg-rose-950/30",
        iconWrapClass: "bg-rose-600/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
      };
    }

    return {
      icon: GraduationCap,
      surfaceClass: "bg-slate-100 dark:bg-slate-900/60",
      iconWrapClass: "bg-slate-700/10 text-slate-700 dark:bg-slate-300/15 dark:text-slate-300",
    };
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Courses</h1>
            <p className="text-muted-foreground mt-2">Manage all training courses</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setProgramDialogOpen(true)}>
              <FolderKanban className="w-4 h-4 mr-2" />
              Manage Programs
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Course
            </Button>
          </div>
        </div>

        {highlightedCourse ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Focused from analytics</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Highlighting {highlightedCourse.title} so you can review modules, publishing state, and course settings directly from the dashboard.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.delete("courseId");
                  setSearchParams(nextParams);
                }}
              >
                Clear focus
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              Loading courses...
            </CardContent>
          </Card>
        ) : courses.length > 0 ? (
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Trainer Courses ({courses.length})</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Manage course covers, metadata, publishing, and modules.</p>
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {sortedCourses.map((course) => {
                  const visual = getCourseVisual(course);
                  const VisualIcon = visual.icon;
                  const isHighlighted = course.id === highlightedCourseId;
                  const contentReport = contentReportsByCourseId[course.id];
                  const isReadyToPublish = contentReport?.readyToPublish ?? false;
                  const publishGapCount = contentReport?.missingSummary.length ?? 0;

                  return (
                    <article
                      key={course.id}
                      className={
                        isHighlighted
                          ? "overflow-hidden rounded-[1.6rem] border border-primary bg-primary/5 shadow-[0_18px_50px_-30px_rgba(15,118,110,0.45)]"
                          : "overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-[0_18px_50px_-30px_rgba(30,41,59,0.35)]"
                      }
                    >
                      <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-muted">
                        {course.thumbnail ? (
                          <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className={`flex h-full w-full items-end justify-between p-6 ${visual.surfaceClass}`}>
                            <div className="max-w-[75%]">
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700/70">{course.category}</p>
                              <p className="mt-2 text-xl font-extrabold leading-tight text-slate-900">{course.title}</p>
                            </div>
                            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${visual.iconWrapClass}`}>
                              <VisualIcon className="h-6 w-6" />
                            </div>
                          </div>
                        )}
                        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                          {isHighlighted ? (
                            <Badge className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                              Dashboard focus
                            </Badge>
                          ) : null}
                          <Badge variant="outline" className="rounded-full bg-background/90 px-3 py-1 text-[11px] font-semibold backdrop-blur">
                            {course.level}
                          </Badge>
                          <Badge variant={course.published !== false ? "default" : "secondary"} className="rounded-full px-3 py-1 text-[11px] font-semibold">
                            {course.published !== false ? (
                              <>
                                <Eye className="mr-1 h-3 w-3" />
                                Published
                              </>
                            ) : (
                              <>
                                <EyeOff className="mr-1 h-3 w-3" />
                                Draft
                              </>
                            )}
                          </Badge>
                          {course.isTESDAAccredited && (
                            <Badge className="rounded-full px-3 py-1 text-[11px] font-semibold">
                              <Award className="mr-1 h-3 w-3" />
                              TESDA
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex h-full min-h-[290px] flex-col space-y-4 p-5 sm:p-6">
                        <div>
                          <h3 className="text-2xl font-semibold leading-tight tracking-[-0.03em]">{course.title}</h3>
                          <p className="mt-3 line-clamp-3 text-sm leading-7 text-muted-foreground">
                            {course.description}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-semibold">
                              Audience: {getCourseAudienceLabel(course.traineeAudience)}
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {course.enrolledCount} enrolled
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock3 className="h-4 w-4" />
                            {course.duration} hours
                          </span>
                          <span className="block">{course.category}</span>
                          {course.programTitle ? <span className="block">Program: {course.programTitle}</span> : null}
                          {contentReport ? (
                            <span className="block">
                              Content readiness: {contentReport.completenessRate}% ({contentReport.publishReadyModules}/{contentReport.totalModules || 0} modules publish-ready)
                            </span>
                          ) : null}
                        </div>

                        {contentReport ? (
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={isReadyToPublish ? "default" : "secondary"}>
                              {isReadyToPublish ? "Ready to publish" : `${publishGapCount} publish gap${publishGapCount === 1 ? "" : "s"}`}
                            </Badge>
                            {contentReport.draftModules > 0 ? <Badge variant="outline">{contentReport.draftModules} drafts</Badge> : null}
                            {contentReport.modulesWithoutAssessmentOrActivity > 0 ? <Badge variant="outline">{contentReport.modulesWithoutAssessmentOrActivity} missing activity</Badge> : null}
                          </div>
                        ) : null}

                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full justify-center"
                          onClick={() => loadLeaderboard(course)}
                        >
                          <BarChart3 className="mr-2 h-4 w-4" />
                          View leaderboard
                        </Button>

                        <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-center"
                            onClick={() => handleTogglePublish(course)}
                            title={course.published !== false ? "Hide from trainee dashboard" : isReadyToPublish ? "Show on trainee dashboard" : "Blocked until content is publish-ready"}
                          >
                            {course.published !== false ? (
                              <>
                                <EyeOff className="mr-2 h-4 w-4" />
                                Unpublish
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 h-4 w-4" />
                                Publish
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-center"
                            onClick={() => handleManageModules(course)}
                          >
                            <Settings className="mr-2 h-4 w-4" />
                            Modules
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-center"
                            onClick={() => setEditCourse(course)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="justify-center"
                            onClick={() => setDeleteCourseId(course.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">You haven't created any courses yet</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Course
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Course Dialog */}
      <CourseCreateEditDialog
        open={createDialogOpen || !!editCourse}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditCourse(null);
          }
        }}
        course={editCourse}
        onSuccess={() => {
          void refreshProgramsAndCourses();
          setCreateDialogOpen(false);
          setEditCourse(null);
        }}
      />

      <ProgramManagementDialog
        open={programDialogOpen}
        onOpenChange={setProgramDialogOpen}
        programs={programs}
        currentUserId={user?.id}
        onRefresh={refreshProgramsAndCourses}
        onViewLeaderboard={loadProgramLeaderboard}
      />

      <Dialog
        open={Boolean(leaderboardContext)}
        onOpenChange={(open) => {
          if (!open) {
            setLeaderboardContext(null);
            setCourseLeaderboard(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {leaderboardContext?.title || "Learner leaderboard"}
            </DialogTitle>
            <DialogDescription>
              {leaderboardContext?.description || "Staff-only learner ranking."}
            </DialogDescription>
          </DialogHeader>
          <LearnerLeaderboardCard
            leaderboard={courseLeaderboard}
            loading={leaderboardLoading}
            emptyMessage="No leaderboard data is available for this course yet."
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(publishBlockedReport)} onOpenChange={(open) => !open && setPublishBlockedReport(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Course is not publish-ready</DialogTitle>
            <DialogDescription>
              {publishBlockedReport
                ? `${publishBlockedReport.courseTitle} must satisfy the production completeness checklist before it can be published to trainees.`
                : "Resolve the remaining content gaps before publishing."}
            </DialogDescription>
          </DialogHeader>

          {publishBlockedReport ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Completeness</p>
                    <p className="mt-1 text-2xl font-semibold">{publishBlockedReport.completenessRate}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Publish-ready modules</p>
                    <p className="mt-1 text-2xl font-semibold">{publishBlockedReport.publishReadyModules}/{publishBlockedReport.totalModules}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Draft modules</p>
                    <p className="mt-1 text-2xl font-semibold">{publishBlockedReport.draftModules}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Publish-ready checklist</p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {publishBlockedReport.publishReadyChecklist.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Remaining gaps</p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {publishBlockedReport.missingSummary.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Modules needing attention</p>
                <div className="space-y-3">
                  {publishBlockedReport.moduleChecks.filter((module) => !module.isPublishReady).slice(0, 6).map((module) => (
                    <div key={module.moduleId} className="rounded-xl border p-3">
                      <p className="font-medium">{module.moduleTitle}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{module.missingItems.join(" • ")}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPublishBlockedReport(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const courseToReview = publishBlockedReport.courseId;
                    setPublishBlockedReport(null);
                    navigate(`/trainer/courses/${courseToReview}/modules`);
                  }}
                >
                  Review modules
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>


      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCourseId} onOpenChange={(open) => !open && setDeleteCourseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this course and all its modules. This action cannot be undone.
              Enrolled learners will lose access to this course.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCourse}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default TrainerCourses;

