import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, BookOpen } from "lucide-react";
import { dataService } from "@/services/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";

const TrainerLearners = () => {
  const { user } = useAuth();
  const [learners, setLearners] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      const courses = dataService.getCourses().filter((c) => c.instructorId === user.id);
      const enrollments = dataService.getEnrollments();
      const myEnrollments = enrollments.filter((e) => courses.some((c) => c.id === e.courseId));
      
      // Get unique learners
      const uniqueLearnerIds = Array.from(new Set(myEnrollments.map((e) => e.userId)));
      const stored = localStorage.getItem("peso_academy_users");
      const users = stored ? JSON.parse(stored) : [];
      
      setLearners(
        uniqueLearnerIds.map((id) => {
          const userData = users.find((u: any) => u.id === id);
          const userEnrollments = myEnrollments.filter((e) => e.userId === id);
          return {
            ...userData,
            enrollments: userEnrollments,
          };
        })
      );
    }
  }, [user]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">My Learners</h1>
          <p className="text-muted-foreground mt-2">View and manage your course learners</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Learners ({learners.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {learners.length > 0 ? (
              <div className="space-y-4">
                {learners.map((learner) => (
                  <div
                    key={learner.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{learner.name}</p>
                        <p className="text-sm text-muted-foreground">{learner.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <BookOpen className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {learner.enrollments.length} course(s)
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline">View Progress</Button>
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
      </div>
    </DashboardLayout>
  );
};

export default TrainerLearners;

