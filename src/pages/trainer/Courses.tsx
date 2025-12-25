import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Users, Award } from "lucide-react";
import { dataService } from "@/services/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Course } from "@/types";

const TrainerCourses = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    if (user) {
      const allCourses = dataService.getCourses();
      setCourses(allCourses.filter((c) => c.instructorId === user.id));
    }
  }, [user]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Courses</h1>
            <p className="text-muted-foreground mt-2">Manage your training courses</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Course
          </Button>
        </div>

        {courses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {courses.map((course) => {
              const enrollments = dataService.getEnrollments().filter((e) => e.courseId === course.id);
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
                      <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="w-4 h-4" />
                          {enrollments.length} learners
                        </span>
                        <span className="text-muted-foreground">{course.duration}h</span>
                      </div>
                      <Button variant="outline" className="w-full">
                        Manage Course
                      </Button>
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
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Course
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TrainerCourses;

