import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { BookOpen, Plus, Users, Award, Edit, Trash2, Settings, Clock3, Laptop2, BriefcaseBusiness, MessageSquareHeart, GraduationCap, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { courseService } from "@/services/supabaseDatabaseService";
import { CourseCreateEditDialog } from "@/components/course/CourseCreateEditDialog";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Course } from "@/types";
import { toast } from "sonner";

const AdminCourses = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const allCourses = await courseService.getCourses();
      setCourses(allCourses);
    } catch (error) {
      console.error("Error loading courses:", error);
      toast.error("Failed to load courses");
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
      loadCourses();
    } catch (error) {
      console.error("Error deleting course:", error);
      toast.error("Failed to delete course");
    }
  };

  const handleManageModules = (course: Course) => {
    navigate(`/admin/courses/${course.id}/modules`);
  };

  const getCourseVisual = (course: Course) => {
    const value = `${course.category} ${course.title}`.toLowerCase();

    if (value.includes("technical") || value.includes("web") || value.includes("digital") || value.includes("mobile")) {
      return {
        icon: Laptop2,
        gradient: "linear-gradient(135deg, #eef2ff 0%, #dbeafe 100%)",
        iconWrapClass: "bg-indigo-600/10 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
      };
    }

    if (value.includes("business") || value.includes("entrepreneur") || value.includes("bookkeeping") || value.includes("accounting")) {
      return {
        icon: BriefcaseBusiness,
        gradient: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
        iconWrapClass: "bg-amber-600/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
      };
    }

    if (value.includes("customer") || value.includes("communication") || value.includes("career")) {
      return {
        icon: MessageSquareHeart,
        gradient: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
        iconWrapClass: "bg-rose-600/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
      };
    }

    return {
      icon: GraduationCap,
      gradient: "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)",
      iconWrapClass: "bg-slate-700/10 text-slate-700 dark:bg-slate-300/15 dark:text-slate-300",
    };
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Course Management</h1>
            <p className="text-muted-foreground mt-2">Manage all platform courses</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Course
          </Button>
        </div>

        {/* Quick Actions - Manage Enrollments (admin access) */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">Quick Actions</span>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link to="/admin/enrollments">
                  <Users className="w-4 h-4" />
                  Manage Enrollments
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">All Courses ({courses.length})</h2>
                <p className="mt-1 text-sm text-muted-foreground">Manage course covers, metadata, and module access.</p>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading courses...</div>
            ) : courses.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No courses yet</p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Course
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {courses.map((course) => (
                  (() => {
                    const visual = getCourseVisual(course);
                    const VisualIcon = visual.icon;
                    return <article
                    key={course.id}
                    className="overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-[0_18px_50px_-30px_rgba(30,41,59,0.35)]"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-muted">
                      {course.thumbnail ? (
                        <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-end justify-between p-6" style={{ background: visual.gradient }}>
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
                            <Award className="w-3 h-3 mr-1" />
                            TESDA
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 p-5 sm:p-6">
                      <div>
                        <h3 className="text-2xl font-semibold leading-tight tracking-[-0.03em]">{course.title}</h3>
                        <p className="mt-3 line-clamp-3 text-sm leading-7 text-muted-foreground">
                        {course.description}
                        </p>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {course.enrolledCount} enrolled
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock3 className="w-4 h-4" />
                          {course.duration} hours
                        </span>
                        <span className="block">{course.category}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => handleManageModules(course)}>
                          <Settings className="mr-2 h-4 w-4" />
                          Modules
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditCourse(course)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleteCourseId(course.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </article>;
                  })()
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
          loadCourses();
          setCreateDialogOpen(false);
          setEditCourse(null);
        }}
      />


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

export default AdminCourses;

