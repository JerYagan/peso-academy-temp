import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search, Award, Clock, Users, Star, Loader2, CheckCircle2, Eye } from "lucide-react";
import { courseService, enrollmentService, moduleService } from "@/services/supabaseDatabaseService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Course, Enrollment } from "@/types";
import { toast } from "sonner";

const Courses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  const [previewModuleCount, setPreviewModuleCount] = useState(0);

  useEffect(() => {
    loadCourses();
    loadEnrollments();
  }, [user]);

  useEffect(() => {
    if (!previewCourse) {
      setPreviewModuleCount(0);
      return;
    }
    let cancelled = false;
    moduleService.getModulesByCourse(previewCourse.id).then((modules) => {
      if (!cancelled) setPreviewModuleCount(modules.length);
    });
    return () => { cancelled = true; };
  }, [previewCourse?.id]);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const allCourses = await courseService.getCourses();
      setCourses(allCourses.filter((c) => c.published !== false));
    } catch (error) {
      console.error("Error loading courses:", error);
      toast.error("Failed to load courses");
    } finally {
      setLoading(false);
    }
  };

  const loadEnrollments = async () => {
    if (!user) {
      setEnrollments([]);
      return;
    }

    try {
      const list = await enrollmentService.getEnrollments(user.id);
      setEnrollments(list);
    } catch (error) {
      console.error("Error loading enrollments:", error);
    }
  };

  const handleEnrollClick = (course: Course) => {
    if (!user) {
      navigate(`/signup?redirect=${encodeURIComponent(`/courses/${course.id}`)}`);
      return;
    }
    handleEnroll(course.id);
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) return;

    if (enrollments.some((e) => e.courseId === courseId)) {
      toast.info("You are already enrolled in this course");
      return;
    }

    setEnrolling(courseId);
    try {
      await enrollmentService.enrollInCourse(user.id, courseId);
      await loadEnrollments();
      toast.success("Successfully enrolled in course!");
      // Reload courses to update enrollment count
      await loadCourses();
    } catch (error) {
      console.error("Error enrolling in course:", error);
      toast.error("Failed to enroll in course. Please try again.");
    } finally {
      setEnrolling(null);
    }
  };

  const categories = Array.from(new Set(courses.map((c) => c.category)));
  const completedEnrollmentByCourseId: Record<string, Enrollment> = {};
  enrollments.filter((e) => e.status === "completed").forEach((e) => {
    completedEnrollmentByCourseId[e.courseId] = e;
  });
  const completedCourseIds = new Set(Object.keys(completedEnrollmentByCourseId));

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || course.category === categoryFilter;
    const matchesLevel = levelFilter === "all" || course.level === levelFilter;
    return matchesSearch && matchesCategory && matchesLevel;
  });

  // Browse list: exclude completed courses (they appear in Completed section)
  const browseCourses = filteredCourses.filter((c) => !completedCourseIds.has(c.id));
  const completedCourses = filteredCourses.filter((c) => completedCourseIds.has(c.id));
  const enrollmentByCourseId: Record<string, Enrollment> = {};
  enrollments.forEach((e) => {
    enrollmentByCourseId[e.courseId] = e;
  });

  const content = (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Course Catalog</h1>
        <p className="text-muted-foreground mt-2">Browse and enroll in free courses</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="Beginner">Beginner</SelectItem>
            <SelectItem value="Intermediate">Intermediate</SelectItem>
            <SelectItem value="Advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Completed Courses (no longer in Browse; link to Certifications) */}
      {user && completedCourses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Completed Courses
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedCourses.map((course) => (
              <Card key={course.id} className="flex flex-col border-green-200 dark:border-green-900/30">
                <CardHeader>
                  <Badge variant="outline" className="w-fit text-green-600 border-green-300">
                    Completed
                  </Badge>
                  <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button asChild variant="default" className="w-full gap-2">
                    <Link to="/certificates">
                      <Award className="h-4 w-4" />
                      View Certificate
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Courses Grid (excludes completed – they are above) */}
      {loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
            <p className="text-muted-foreground">Loading courses...</p>
          </CardContent>
        </Card>
      ) : browseCourses.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {browseCourses.map((course) => {
            const enrollment = enrollmentByCourseId[course.id];
            const isEnrolled = !!enrollment;
            const isEnrolling = enrolling === course.id;
            return (
              <Card key={course.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant={course.isTESDAAccredited ? "default" : "secondary"}>
                      {course.isTESDAAccredited && <Award className="w-3 h-3 mr-1" />}
                      {course.category}
                    </Badge>
                    <Badge variant="outline">{course.level}</Badge>
                  </div>
                  <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {course.duration}h
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {course.enrolledCount || 0}
                      </div>
                      {course.rating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          {course.rating.toFixed(1)}
                        </div>
                      )}
                    </div>
                    {course.skills && course.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {course.skills.slice(0, 3).map((skill, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-auto flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => setPreviewCourse(course)}
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </Button>
                    {isEnrolled ? (
                      <Button asChild className="flex-1">
                        <Link to={`/courses/${course.id}`}>Continue Learning</Link>
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleEnrollClick(course)}
                        className="flex-1"
                        disabled={isEnrolling}
                      >
                        {isEnrolling ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Enrolling...
                          </>
                        ) : (
                          "Enroll Now"
                        )}
                      </Button>
                    )}
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
            <p className="text-muted-foreground">
              {completedCourses.length > 0
                ? "No more courses to browse. Your completed courses are listed above."
                : "No courses found matching your criteria"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Course preview modal */}
      <Dialog open={!!previewCourse} onOpenChange={(open) => !open && setPreviewCourse(null)}>
        <DialogContent className="sm:max-w-lg">
          {previewCourse && (
            <>
              {previewCourse.thumbnail && (
                <div className="rounded-md overflow-hidden border bg-muted -mx-1 -mt-1">
                  <img
                    src={previewCourse.thumbnail}
                    alt=""
                    className="w-full h-32 object-cover"
                  />
                </div>
              )}
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={previewCourse.isTESDAAccredited ? "default" : "secondary"}>
                    {previewCourse.isTESDAAccredited && <Award className="w-3 h-3 mr-1" />}
                    {previewCourse.category}
                  </Badge>
                  <Badge variant="outline">{previewCourse.level}</Badge>
                </div>
                <DialogTitle className="text-left pt-1">{previewCourse.title}</DialogTitle>
                <DialogDescription className="text-left">
                  {previewCourse.description}
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {previewCourse.duration}h
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  {previewModuleCount} {previewModuleCount === 1 ? "module" : "modules"}
                </div>
              </div>
              {previewCourse.skills && previewCourse.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {previewCourse.skills.slice(0, 5).map((skill, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}
              <DialogFooter className="flex-col sm:flex-row gap-2">
                {enrollmentByCourseId[previewCourse.id] ? (
                  <Button asChild className="w-full sm:w-auto">
                    <Link to={`/courses/${previewCourse.id}`} onClick={() => setPreviewCourse(null)}>
                      Continue Learning
                    </Link>
                  </Button>
                ) : (
                  <Button
                    className="w-full sm:w-auto"
                    disabled={enrolling === previewCourse.id}
                    onClick={() => {
                      handleEnrollClick(previewCourse);
                      setPreviewCourse(null);
                    }}
                  >
                    {enrolling === previewCourse.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enrolling...
                      </>
                    ) : (
                      "Enroll Now"
                    )}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  if (user) {
    return <DashboardLayout>{content}</DashboardLayout>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-8">
        {content}
      </main>
      <Footer />
    </div>
  );
};

export default Courses;

