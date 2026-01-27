import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, BookOpen, Loader2, RefreshCw } from "lucide-react";
import { courseService, enrollmentService, userService } from "@/services/supabaseDatabaseService";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Course, Enrollment } from "@/types";
import { User } from "@/types/auth";
import { toast } from "sonner";

interface LearnerData extends User {
  enrollments: Enrollment[];
}

const TrainerLearners = () => {
  const { user } = useAuth();
  const [learners, setLearners] = useState<LearnerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadLearners();
    }
  }, [user]);

  const loadLearners = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get all courses for this trainer
      const allCourses = await courseService.getCourses();
      
      // Filter courses where instructor_id matches the logged-in user's ID
      let myCourses = allCourses.filter((c) => c.instructorId === user.id);
      
      // If no courses found by ID, try matching by email (fallback)
      if (myCourses.length === 0 && user.email && supabase) {
        console.warn("No courses found by ID match. Trying email match...");
        // Get trainer's user record from database to verify ID
        const { data: trainerData } = await supabase
          .from("users")
          .select("id, email")
          .eq("email", user.email)
          .single();
        
        if (trainerData && trainerData.id !== user.id) {
          console.warn("ID mismatch detected:", {
            authUserId: user.id,
            databaseUserId: trainerData.id,
            email: user.email
          });
          // Try filtering with database user ID
          myCourses = allCourses.filter((c) => c.instructorId === trainerData.id);
        }
      }
      
      console.log("=== TRAINER LEARNERS DEBUG ===");
      console.log("Logged-in trainer:", {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      });
      console.log("All courses in database:", {
        count: allCourses.length,
        courses: allCourses.map(c => ({ 
          id: c.id, 
          title: c.title, 
          instructorId: c.instructorId 
        }))
      });
      console.log("My courses (filtered):", {
        count: myCourses.length,
        courses: myCourses.map(c => ({ 
          id: c.id, 
          title: c.title, 
          instructorId: c.instructorId 
        }))
      });
      
      if (myCourses.length === 0) {
        console.log("No courses found for trainer");
        setLearners([]);
        setLoading(false);
        return;
      }

      // Get enrollments directly for trainer's courses using a direct join query
      const myCourseIds = myCourses.map(c => c.id);
      
      let myEnrollments: Enrollment[] = [];
      if (myCourseIds.length > 0 && supabase) {
        // Use a direct query that joins enrollments with courses to ensure we get the right data
        const { data, error } = await supabase
          .from("enrollments")
          .select(`
            *,
            courses!inner(id, instructor_id)
          `)
          .in("course_id", myCourseIds)
          .eq("courses.instructor_id", user.id) // Double-check instructor match
          .order("enrolled_at", { ascending: false });
        
        if (error) {
          console.error("Error fetching enrollments with join:", error);
          // Fallback to simple query
          const { data: simpleData, error: simpleError } = await supabase
            .from("enrollments")
            .select("*")
            .in("course_id", myCourseIds)
            .order("enrolled_at", { ascending: false });
          
          if (simpleError) {
            console.error("Error fetching enrollments (fallback):", simpleError);
            toast.error("Failed to load enrollments");
          } else {
            myEnrollments = (simpleData || []).map((enrollment) => ({
              id: enrollment.id,
              userId: enrollment.user_id,
              courseId: enrollment.course_id,
              progress: enrollment.progress,
              status: enrollment.status,
              enrolledAt: enrollment.enrolled_at,
              completedAt: enrollment.completed_at || undefined,
              certificateId: enrollment.certificate_id || undefined,
            }));
          }
        } else {
          myEnrollments = (data || []).map((enrollment: any) => ({
            id: enrollment.id,
            userId: enrollment.user_id,
            courseId: enrollment.course_id,
            progress: enrollment.progress,
            status: enrollment.status,
            enrolledAt: enrollment.enrolled_at,
            completedAt: enrollment.completed_at || undefined,
            certificateId: enrollment.certificate_id || undefined,
          }));
        }
        
        // Verify enrollments match courses
        console.log("Enrollment verification:", {
          myCourseIds: myCourseIds,
          enrollmentsFound: myEnrollments.length,
          enrollmentCourseIds: myEnrollments.map(e => e.courseId),
          allMatch: myEnrollments.every(e => myCourseIds.includes(e.courseId))
        });
      }
      
      console.log("Enrollments for my courses:", {
        myCourseIds: myCourseIds,
        myCourseTitles: myCourses.map(c => c.title),
        myEnrollmentsCount: myEnrollments.length,
        myEnrollments: myEnrollments.map(e => ({ 
          id: e.id, 
          userId: e.userId, 
          courseId: e.courseId,
          status: e.status 
        }))
      });
      
      // Additional check: Verify enrollment-course relationship
      if (myEnrollments.length > 0) {
        console.log("Enrollment-Course verification:", 
          myEnrollments.map(e => {
            const course = myCourses.find(c => c.id === e.courseId);
            return {
              enrollmentId: e.id,
              courseId: e.courseId,
              courseTitle: course?.title || "NOT FOUND",
              courseInstructorId: course?.instructorId,
              matchesTrainer: course?.instructorId === user.id
            };
          })
        );
      }

      // Get unique learner IDs
      const uniqueLearnerIds = Array.from(new Set(myEnrollments.map((e) => e.userId)));
      console.log("Unique learner IDs:", uniqueLearnerIds);

      // Fetch user data for each learner
      const learnersData: LearnerData[] = [];
      
      for (const learnerId of uniqueLearnerIds) {
        const userData = await userService.getUserById(learnerId);
        if (userData) {
          const userEnrollments = myEnrollments.filter((e) => e.userId === learnerId);
          learnersData.push({
            ...userData,
            enrollments: userEnrollments,
          });
          console.log("Added learner:", {
            id: userData.id,
            email: userData.email,
            enrollmentsCount: userEnrollments.length
          });
        } else {
          console.warn("User data not found for learner ID:", learnerId);
        }
      }

      console.log("Final learners data:", learnersData.length);
      setLearners(learnersData);
    } catch (error) {
      console.error("Error loading learners:", error);
      toast.error("Failed to load learners");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Learners</h1>
            <p className="text-muted-foreground mt-2">View and manage your course learners</p>
          </div>
          <Button onClick={loadLearners} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Learners ({learners.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                <p className="ml-3 text-muted-foreground">Loading learners...</p>
              </div>
            ) : learners.length > 0 ? (
              <div className="space-y-4">
                {learners.map((learner) => (
                  <div
                    key={learner.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        {learner.avatar ? (
                          <img 
                            src={learner.avatar} 
                            alt={learner.name} 
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <Users className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{learner.name}</p>
                        <p className="text-sm text-muted-foreground">{learner.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <BookOpen className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {learner.enrollments.length} course{learner.enrollments.length !== 1 ? 's' : ''}
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

