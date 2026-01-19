import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { courseService, enrollmentService, moduleService, moduleCompletionService } from "@/services/supabaseDatabaseService";
import { Course, Module, Enrollment } from "@/types";
import { toast } from "sonner";
import ModuleContentViewer from "@/components/course/ModuleContentViewer";

const CourseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [completedModuleIds, setCompletedModuleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadCourseData();
    }
  }, [id, user]);

  const loadCourseData = async () => {
    if (!id || !user) return;

    setLoading(true);
    try {
      // Load course
      const courseData = await courseService.getCourse(id);
      if (!courseData) {
        toast.error("Course not found");
        navigate("/courses");
        return;
      }
      setCourse(courseData);

      // Load modules
      const modulesData = await moduleService.getModulesByCourse(id);
      setModules(modulesData);

      // Load enrollment
      const enrollments = await enrollmentService.getEnrollments(user.id);
      const userEnrollment = enrollments.find((e) => e.courseId === id);
      
      if (!userEnrollment) {
        toast.error("You are not enrolled in this course");
        navigate("/courses");
        return;
      }

      setEnrollment(userEnrollment);

      // Load completed modules with time spent
      const completed = await moduleCompletionService.getCompletedModules(userEnrollment.id);
      setCompletedModuleIds(completed);
      
      // Load module time tracking data
      if (supabase) {
        const { data: completions } = await supabase
          .from("module_completions")
          .select("module_id, time_spent")
          .eq("enrollment_id", userEnrollment.id);
        
        // Store time spent data (we'll use this later for display)
        if (completions) {
          // Time tracking data is available in completions
        }
      }

      // Set first module as selected if available
      if (modulesData.length > 0) {
        setSelectedModule(modulesData[0]);
      }
    } catch (error) {
      console.error("Error loading course data:", error);
      toast.error("Failed to load course data");
    } finally {
      setLoading(false);
    }
  };

  const handleModuleSelect = (module: Module) => {
    setSelectedModule(module);
  };

  const handleModuleComplete = async (moduleId: string, timeSpentMinutes?: number) => {
    if (!enrollment || !user) return;

    try {
      await moduleCompletionService.markModuleComplete(
        enrollment.id, 
        moduleId,
        timeSpentMinutes
      );
      setCompletedModuleIds([...completedModuleIds, moduleId]);
      
      // Reload enrollment to get updated progress
      const enrollments = await enrollmentService.getEnrollments(user.id);
      const updatedEnrollment = enrollments.find((e) => e.courseId === id);
      if (updatedEnrollment) {
        setEnrollment(updatedEnrollment);
      }

      toast.success("Module marked as completed!");
    } catch (error) {
      console.error("Error completing module:", error);
      toast.error("Failed to mark module as complete");
    }
  };

  const isModuleCompleted = (moduleId: string) => {
    return completedModuleIds.includes(moduleId);
  };

  const canAccessModule = (module: Module) => {
    if (module.prerequisites.length === 0) return true;
    return module.prerequisites.every((prereqId) => completedModuleIds.includes(prereqId));
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

  if (!course || !enrollment) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Course not found or you are not enrolled</p>
            <Button asChild className="mt-4">
              <Link to="/courses">Back to Courses</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Course Header */}
        <div className="space-y-4">
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
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              {course.rating}
            </div>
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
                          onClick={() => canAccess && handleModuleSelect(module)}
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
            {selectedModule ? (
              <ModuleContentViewer
                module={selectedModule}
                enrollment={enrollment}
                isCompleted={isModuleCompleted(selectedModule.id)}
                onComplete={() => handleModuleComplete(selectedModule.id)}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a module to start learning</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CourseDetail;

