import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { BookOpen, Plus, Users, Award, Edit, Trash2, Settings } from "lucide-react";
import { courseService, enrollmentService } from "@/services/supabaseDatabaseService";
import { CourseCreateEditDialog } from "@/components/course/CourseCreateEditDialog";
import { ModuleManagementDialog } from "@/components/course/ModuleManagementDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Course, Enrollment } from "@/types";
import { toast } from "sonner";

const TrainerCourses = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  useEffect(() => {
    if (user) {
      loadCourses();
      loadEnrollments();
    }
  }, [user]);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const allCourses = await courseService.getCourses();
      const myCourses = allCourses.filter((c) => c.instructorId === user?.id);
      setCourses(myCourses);
    } catch (error) {
      console.error("Error loading courses:", error);
      toast.error("Failed to load courses");
    } finally {
      setLoading(false);
    }
  };

  const loadEnrollments = async () => {
    try {
      const allEnrollments = await enrollmentService.getEnrollments();
      setEnrollments(allEnrollments);
    } catch (error) {
      console.error("Error loading enrollments:", error);
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
    setSelectedCourse(course);
    setModuleDialogOpen(true);
  };

  const getEnrollmentCount = (courseId: string) => {
    return enrollments.filter((e) => e.courseId === courseId).length;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Courses</h1>
            <p className="text-muted-foreground mt-2">Manage your training courses</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Course
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              Loading courses...
            </CardContent>
          </Card>
        ) : courses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {courses.map((course) => {
              const enrollmentCount = getEnrollmentCount(course.id);
              return (
                <Card key={course.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant={course.isTESDAAccredited ? "default" : "secondary"}>
                        {course.category}
                      </Badge>
                      <Badge variant="outline">{course.level}</Badge>
                    </div>
                    <CardTitle>{course.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {course.description}
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="w-4 h-4" />
                          {enrollmentCount} learners
                        </span>
                        <span className="text-muted-foreground">{course.duration}h</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleManageModules(course)}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Modules
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditCourse(course)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteCourseId(course.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
          loadCourses();
          setCreateDialogOpen(false);
          setEditCourse(null);
        }}
      />

      {/* Module Management Dialog */}
      {selectedCourse && (
        <ModuleManagementDialog
          open={moduleDialogOpen}
          onOpenChange={(open) => {
            setModuleDialogOpen(open);
            if (!open) setSelectedCourse(null);
          }}
          course={selectedCourse}
          onSuccess={loadCourses}
        />
      )}

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

