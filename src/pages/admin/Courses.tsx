import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Users, Award } from "lucide-react";
import { dataService } from "@/services/mockData";
import { useState, useEffect } from "react";
import { Course } from "@/types";

const AdminCourses = () => {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    setCourses(dataService.getCourses());
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Course Management</h1>
            <p className="text-muted-foreground mt-2">Manage all platform courses</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Course
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Courses ({courses.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{course.title}</h3>
                      {course.isTESDAAccredited && (
                        <Badge variant="default">
                          <Award className="w-3 h-3 mr-1" />
                          TESDA
                        </Badge>
                      )}
                      <Badge variant="outline">{course.level}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{course.description}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {course.enrolledCount} enrolled
                      </span>
                      <span>{course.category}</span>
                      <span>{course.duration}h duration</span>
                    </div>
                  </div>
                  <Button variant="outline">Edit</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminCourses;

