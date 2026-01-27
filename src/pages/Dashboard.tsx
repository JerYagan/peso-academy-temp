import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, Award, Briefcase, TrendingUp, ArrowRight, Shield, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { enrollmentService, certificateService, courseService } from "@/services/supabaseDatabaseService";
import { dataService } from "@/services/mockData"; // TODO: Replace with Supabase services for admin/training officer dashboards
import { useEffect, useState } from "react";
import { Course, Enrollment } from "@/types";
import { toast } from "sonner";
import { User } from "@/types/auth";

interface TraineeDashboardProps {
  user: User;
  stats: {
    enrolledCourses: number;
    completedCourses: number;
    certificates: number;
    jobsApplied: number;
  };
}

const TraineeDashboard = ({ user, stats }: TraineeDashboardProps) => {
  const [myCourses, setMyCourses] = useState<Array<Course & { enrollment: Enrollment }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyCourses();
  }, [user]);

  const loadMyCourses = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const enrollments = await enrollmentService.getEnrollments(user.id);
      const allCourses = await courseService.getCourses();
      
      const coursesWithEnrollments = enrollments
        .map((e) => {
          const course = allCourses.find((c) => c.id === e.courseId);
          return course ? { ...course, enrollment: e } : null;
        })
        .filter((c): c is Course & { enrollment: Enrollment } => c !== null)
        .slice(0, 3);
      
      setMyCourses(coursesWithEnrollments);
    } catch (error) {
      console.error("Error loading trainee courses:", error);
      toast.error("Failed to load courses");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {user.name}!</h1>
          <p className="text-muted-foreground mt-2">Continue your learning journey</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enrolled Courses</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enrolledCourses}</div>
              <p className="text-xs text-muted-foreground">Active enrollments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedCourses}</div>
              <p className="text-xs text-muted-foreground">Courses finished</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Certificates</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.certificates}</div>
              <p className="text-xs text-muted-foreground">TESDA certificates</p>
            </CardContent>
          </Card>

          {/* Job Matches card hidden - Future Phase */}
          {/* <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Job Matches</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Available positions</p>
            </CardContent>
          </Card> */}
        </div>

        {/* My Courses */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">My Courses</h2>
            <Button asChild variant="outline">
              <Link to="/courses">View All</Link>
            </Button>
          </div>
          {loading ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
                <p className="text-muted-foreground">Loading courses...</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myCourses.length > 0 ? (
                myCourses.map((course) => (
                  <Card key={course.id}>
                    <CardHeader>
                      <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                      <CardDescription>{course.category} • {course.level}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{course.enrollment.progress}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${course.enrollment.progress}%` }}
                          />
                        </div>
                        <Button asChild className="w-full mt-4">
                          <Link to={`/courses/${course.id}`}>Continue Learning</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="col-span-full">
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">You haven't enrolled in any courses yet</p>
                    <Button asChild>
                      <Link to="/courses">Browse Courses</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    enrolledCourses: 0,
    completedCourses: 0,
    certificates: 0,
    jobsApplied: 0,
  });

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    if (!user) return;
    
    try {
      const enrollments = await enrollmentService.getEnrollments(user.id);
      const certificates = await certificateService.getCertificates(user.id);
      setStats({
        enrolledCourses: enrollments.length,
        completedCourses: enrollments.filter((e) => e.status === "completed").length,
        certificates: certificates.length,
        jobsApplied: 0, // TODO: Implement job applications
      });
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    }
  };

  if (!user) return null;

  // Trainee Dashboard (replaces old "jobseeker" role)
  if (user.role === "trainee") {
    return <TraineeDashboard user={user} stats={stats} />;
  }

  // Admin Dashboard
  if (user.role === "admin") {
    const courses = dataService.getCourses();
    const jobs = dataService.getJobs();
    const enrollments = dataService.getEnrollments();
    const totalUsers = 4; // Mock data

    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-2">Manage PESO Academy platform</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUsers}</div>
                <p className="text-xs text-muted-foreground">Registered users</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Courses</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{courses.length}</div>
                <p className="text-xs text-muted-foreground">Available courses</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Enrollments</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{enrollments.length}</div>
                <p className="text-xs text-muted-foreground">Total enrollments</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Job Postings</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{jobs.length}</div>
                <p className="text-xs text-muted-foreground">Active jobs</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link to="/admin/users">
                    <Users className="mr-2 h-4 w-4" />
                    Manage Users
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link to="/admin/courses">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Manage Courses
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link to="/admin/jobs">
                    <Briefcase className="mr-2 h-4 w-4" />
                    Manage Jobs
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link to="/admin/roles">
                    <Shield className="mr-2 h-4 w-4" />
                    Manage Roles
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link to="/admin/audit-logs">
                    <FileText className="mr-2 h-4 w-4" />
                    Audit Logs
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link to="/admin/enrollments">
                    <Users className="mr-2 h-4 w-4" />
                    Manage Enrollments
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link to="/admin/reports">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Reports & Analytics
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Training Officer Dashboard (replaces old "trainer" and "spd" roles)
  if (user.role === "training_officer") {
    const courses = dataService.getCourses().filter((c) => c.instructorId === user.id);
    const enrollments = dataService.getEnrollments();
    const myEnrollments = enrollments.filter((e) => courses.some((c) => c.id === e.courseId));

    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Training Officer Dashboard</h1>
            <p className="text-muted-foreground mt-2">Manage your courses and learners</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">My Courses</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{courses.length}</div>
                <p className="text-xs text-muted-foreground">Courses created</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Learners</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{myEnrollments.length}</div>
                <p className="text-xs text-muted-foreground">Total learners</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {myEnrollments.length > 0
                    ? Math.round(
                        (myEnrollments.filter((e) => e.status === "completed").length /
                          myEnrollments.length) *
                          100
                      )
                    : 0}
                  %
                </div>
                <p className="text-xs text-muted-foreground">Course completion</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>My Courses</CardTitle>
            </CardHeader>
            <CardContent>
              {courses.length > 0 ? (
                <div className="space-y-4">
                  {courses.map((course) => (
                    <div key={course.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-semibold">{course.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {myEnrollments.filter((e) => e.courseId === course.id).length} learners
                        </p>
                      </div>
                      <Button asChild variant="outline">
                        <Link to={`/trainer/courses/${course.id}`}>Manage</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">You haven't created any courses yet</p>
                  <Button asChild>
                    <Link to="/trainer/courses">Create Course</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Validator Dashboard
  if (user.role === "validator") {
    // Redirect to validator dashboard page instead
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Validator Dashboard</h1>
            <p className="text-muted-foreground mt-2">Review and validate submissions</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">Awaiting validation</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">Validated submissions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">Reviews completed</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild className="w-full justify-start" variant="outline">
                <Link to="/validator/submissions">
                  <FileText className="mr-2 h-4 w-4" />
                  Review Submissions
                </Link>
                      </Button>
              <Button asChild className="w-full justify-start" variant="outline">
                <Link to="/validator/dashboard">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  View Dashboard
                </Link>
                  </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Fallback: If role doesn't match any dashboard, show a default message
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {user.name}!</h1>
          <p className="text-muted-foreground mt-2">Your dashboard is being set up</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-muted-foreground">Role: {user.role}</p>
            <p className="text-sm text-muted-foreground mt-2">If you believe this is an error, please contact an administrator.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;

