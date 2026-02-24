import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, Award, TrendingUp, ArrowRight, Shield, FileText, FileSpreadsheet, Loader2, CheckCircle2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Link } from "react-router-dom";
import { enrollmentService, certificateService, courseService } from "@/services/supabaseDatabaseService";
import { dataService } from "@/services/mockData"; // TODO: Replace with Supabase services for admin/training officer dashboards
import { useEffect, useState } from "react";
import { Course, Enrollment } from "@/types";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User } from "@/types/auth";
import { startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

interface TraineeDashboardProps {
  user: User;
  stats: {
    enrolledCourses: number;
    completedCourses: number;
    certificates: number;
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
        .sort((a, b) => (a.enrollment.status === "completed" ? 1 : 0) - (b.enrollment.status === "completed" ? 1 : 0))
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
              <p className="text-xs text-muted-foreground">Certifications earned</p>
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
                myCourses.map((course) => {
                  const isCompleted = course.enrollment.status === "completed";
                  return (
                    <Card key={course.id} className={isCompleted ? "border-green-200 dark:border-green-900/30" : ""}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                            <CardDescription>{course.category} • {course.level}</CardDescription>
                          </div>
                          {isCompleted && (
                            <Badge variant="outline" className="shrink-0 text-green-600 border-green-300">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Completed
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{course.enrollment.progress}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isCompleted ? "bg-green-600" : "bg-primary"}`}
                              style={{ width: `${course.enrollment.progress}%` }}
                            />
                          </div>
                          {isCompleted ? (
                            <Button asChild className="w-full mt-4" variant="secondary">
                              <Link to="/certificates">View Certificate</Link>
                            </Button>
                          ) : (
                            <Button asChild className="w-full mt-4">
                              <Link to={`/courses/${course.id}`}>Continue Learning</Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
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

interface TrainingOfficerDashboardProps {
  user: User;
}

const TrainingOfficerDashboard = ({ user }: TrainingOfficerDashboardProps) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [certificatesIssued, setCertificatesIssued] = useState<{ courseId: string; issuedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const [allCourses, allEnrollments, allCerts] = await Promise.all([
          courseService.getCourses(),
          enrollmentService.getEnrollments(),
          certificateService.getCertificates(),
        ]);
        if (cancelled) return;
        const myCourses = allCourses.filter((c) => c.instructorId === user.id);
        const myCourseIds = new Set(myCourses.map((c) => c.id));
        const myEnrollments = allEnrollments.filter((e) => myCourseIds.has(e.courseId));
        setCourses(myCourses);
        setEnrollments(myEnrollments);
        setCertificatesIssued(
          allCerts.filter((c) => myCourseIds.has(c.courseId)).map((c) => ({ courseId: c.courseId, issuedAt: c.issuedAt }))
        );
      } catch (e) {
        if (!cancelled) toast.error("Failed to load dashboard data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const inThisMonth = (dateStr: string) =>
    isWithinInterval(new Date(dateStr), { start: monthStart, end: monthEnd });

  const joinedThisMonth = enrollments.filter((e) => inThisMonth(e.enrolledAt)).length;
  const droppedThisMonth = enrollments.filter((e) => e.status === "dropped").length; // all-time dropped; could narrow to month if we had updated_at
  const completedThisMonth = enrollments.filter(
    (e) => e.status === "completed" && e.completedAt && inThisMonth(e.completedAt)
  ).length;
  const certificatesThisMonth = certificatesIssued.filter((c) => inThisMonth(c.issuedAt)).length;

  const completedTotal = enrollments.filter((e) => e.status === "completed").length;
  const completionRate = enrollments.length > 0 ? Math.round((completedTotal / enrollments.length) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Training Officer Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage your courses and learners</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Courses</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{courses.length}</div>
                  <p className="text-xs text-muted-foreground">Courses you teach</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Learners</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{enrollments.length}</div>
                  <p className="text-xs text-muted-foreground">Total learners</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completionRate}%</div>
                  <p className="text-xs text-muted-foreground">Course completion</p>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Monthly Report</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {now.toLocaleString("default", { month: "long", year: "numeric" })}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Joined</CardTitle>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{joinedThisMonth}</div>
                    <p className="text-xs text-muted-foreground">Learners this month</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Dropped</CardTitle>
                    <ArrowDownRight className="h-4 w-4 text-muted-foreground text-amber-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{droppedThisMonth}</div>
                    <p className="text-xs text-muted-foreground">Dropped (all time)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completed</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{completedThisMonth}</div>
                    <p className="text-xs text-muted-foreground">Completed this month</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Certificates</CardTitle>
                    <Award className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{certificatesThisMonth}</div>
                    <p className="text-xs text-muted-foreground">Issued this month</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Shortcuts to manage courses and learners</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link to="/trainer/courses">
                    <BookOpen className="mr-2 h-4 w-4" />
                    My Courses
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/trainer/learners">
                    <Users className="mr-2 h-4 w-4" />
                    Learners
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/admin/reports">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Reports
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
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

          </div>

          {/* Quick Actions - informative cards */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Manage Users
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="mb-4">
                    Manage registered users, assign/change roles, and oversee account status.
                  </CardDescription>
                  <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                    <Link to="/admin/users">Open</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Manage Courses
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="mb-4">
                    Create and edit courses, manage modules, and control course visibility.
                  </CardDescription>
                  <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                    <Link to="/admin/courses">Open</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Manage Roles
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="mb-4">
                    Define user roles, job functions, and system access permissions.
                  </CardDescription>
                  <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                    <Link to="/admin/roles">Open</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Audit Logs
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="mb-4">
                    Track system activities and review user actions for security and accountability.
                  </CardDescription>
                  <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                    <Link to="/admin/audit-logs">Open</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Manage Enrollments
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="mb-4">
                    Monitor trainee enrollments and manage course participation.
                  </CardDescription>
                  <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                    <Link to="/admin/enrollments">Open</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Reports & Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="mb-4">
                    Access summarized data and insights on users, courses, and system performance.
                  </CardDescription>
                  <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                    <Link to="/admin/reports">Open</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Training Officer / Trainer Dashboard (real data from Supabase; no redundant My Courses section)
  if (user.role === "training_officer" || user.role === "trainer") {
    return <TrainingOfficerDashboard user={user} />;
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

