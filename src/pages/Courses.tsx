import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search, Award, Clock, Users, Star, Loader2 } from "lucide-react";
import { courseService, enrollmentService } from "@/services/supabaseDatabaseService";
import { Course } from "@/types";
import { toast } from "sonner";

const Courses = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  useEffect(() => {
    loadCourses();
    loadEnrollments();
  }, [user]);

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

  const loadEnrollments = async () => {
    if (!user) {
      setEnrolledCourseIds([]);
      return;
    }

    try {
      const enrollments = await enrollmentService.getEnrollments(user.id);
      setEnrolledCourseIds(enrollments.map((e) => e.courseId));
    } catch (error) {
      console.error("Error loading enrollments:", error);
      // Don't show error toast for enrollments, just log it
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) {
      toast.error("Please login to enroll in courses");
      return;
    }

    if (enrolledCourseIds.includes(courseId)) {
      toast.info("You are already enrolled in this course");
      return;
    }

    setEnrolling(courseId);
    try {
      await enrollmentService.enrollInCourse(user.id, courseId);
      setEnrolledCourseIds([...enrolledCourseIds, courseId]);
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
  const filteredCourses = courses.filter((course) => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || course.category === categoryFilter;
    const matchesLevel = levelFilter === "all" || course.level === levelFilter;
    return matchesSearch && matchesCategory && matchesLevel;
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

      {/* Courses Grid */}
      {loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
            <p className="text-muted-foreground">Loading courses...</p>
          </CardContent>
        </Card>
      ) : filteredCourses.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => {
            const isEnrolled = enrolledCourseIds.includes(course.id);
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
                  <div className="mt-auto">
                    {isEnrolled ? (
                      <Button asChild className="w-full">
                        <Link to={`/courses/${course.id}`}>Continue Learning</Link>
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleEnroll(course.id)}
                        className="w-full"
                        disabled={!user || isEnrolling}
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
            <p className="text-muted-foreground">No courses found matching your criteria</p>
          </CardContent>
        </Card>
      )}
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

