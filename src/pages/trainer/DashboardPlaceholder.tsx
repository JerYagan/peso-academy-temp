import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { endOfMonth, isWithinInterval, startOfMonth } from "date-fns";
import {
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { certificateService, courseService, enrollmentService } from "@/services/supabaseDatabaseService";
import { resolveTrainerOwnership } from "@/lib/trainerOwnership";
import { Course, Enrollment } from "@/types";
import { toast } from "sonner";

const statusColors = ["#0f766e", "#2563eb", "#f59e0b", "#dc2626"];

const TrainerDashboardPlaceholder = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [certificateCount, setCertificateCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showingAllCoursesFallback, setShowingAllCoursesFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const ownership = await resolveTrainerOwnership(user);
        const [allCourses, allEnrollments, allCertificates] = await Promise.all([
          courseService.getCourses(),
          enrollmentService.getEnrollments(),
          certificateService.getCertificates(),
        ]);

        if (cancelled) return;

        const ownedCourses = allCourses.filter((course) => ownership.ownerIds.includes(course.instructorId));
        const visibleCourses = ownedCourses.length > 0 ? ownedCourses : allCourses;
        const courseIds = new Set(visibleCourses.map((course) => course.id));
        const visibleEnrollments = allEnrollments.filter((enrollment) => courseIds.has(enrollment.courseId));
        const visibleCertificates = allCertificates.filter((certificate) => courseIds.has(certificate.courseId));

        setCourses(visibleCourses);
        setEnrollments(visibleEnrollments);
        setCertificateCount(visibleCertificates.length);
        setShowingAllCoursesFallback(ownedCourses.length === 0 && allCourses.length > 0);
      } catch (error) {
        console.error("Error loading trainer dashboard:", error);
        if (!cancelled) {
          toast.error("Failed to load trainer dashboard");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const uniqueLearners = useMemo(
    () => new Set(enrollments.map((enrollment) => enrollment.userId)).size,
    [enrollments],
  );

  const averageProgress = useMemo(() => {
    if (enrollments.length === 0) return 0;
    return Math.round(enrollments.reduce((sum, enrollment) => sum + enrollment.progress, 0) / enrollments.length);
  }, [enrollments]);

  const completionRate = useMemo(() => {
    if (enrollments.length === 0) return 0;
    const completed = enrollments.filter((enrollment) => enrollment.status === "completed").length;
    return Math.round((completed / enrollments.length) * 100);
  }, [enrollments]);

  const currentMonth = new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const isInCurrentMonth = (value?: string) => {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return isWithinInterval(date, { start: monthStart, end: monthEnd });
  };

  const monthlyJoined = enrollments.filter((enrollment) => isInCurrentMonth(enrollment.enrolledAt)).length;
  const monthlyCompleted = enrollments.filter((enrollment) => enrollment.status === "completed" && isInCurrentMonth(enrollment.completedAt)).length;
  const monthlyDropped = enrollments.filter((enrollment) => enrollment.status === "dropped").length;

  const statusData = useMemo(
    () => [
      { name: "Enrolled", value: enrollments.filter((enrollment) => enrollment.status === "enrolled").length },
      { name: "In Progress", value: enrollments.filter((enrollment) => enrollment.status === "in-progress").length },
      { name: "Completed", value: enrollments.filter((enrollment) => enrollment.status === "completed").length },
      { name: "Dropped", value: enrollments.filter((enrollment) => enrollment.status === "dropped").length },
    ].filter((item) => item.value > 0),
    [enrollments],
  );

  const coursePerformance = useMemo(() => {
    return courses
      .map((course) => {
        const courseEnrollments = enrollments.filter((enrollment) => enrollment.courseId === course.id);
        const completion = courseEnrollments.filter((enrollment) => enrollment.status === "completed").length;
        const avgProgress = courseEnrollments.length > 0
          ? Math.round(courseEnrollments.reduce((sum, enrollment) => sum + enrollment.progress, 0) / courseEnrollments.length)
          : 0;

        return {
          name: course.title.length > 20 ? `${course.title.slice(0, 20)}...` : course.title,
          enrollments: courseEnrollments.length,
          completionRate: courseEnrollments.length > 0 ? Math.round((completion / courseEnrollments.length) * 100) : 0,
          averageProgress: avgProgress,
        };
      })
      .sort((left, right) => right.enrollments - left.enrollments)
      .slice(0, 6);
  }, [courses, enrollments]);

  const recentCourses = useMemo(() => {
    return [...courses]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 5)
      .map((course) => {
        const courseEnrollments = enrollments.filter((enrollment) => enrollment.courseId === course.id);
        const completed = courseEnrollments.filter((enrollment) => enrollment.status === "completed").length;
        return {
          ...course,
          learnerCount: courseEnrollments.length,
          completionRate: courseEnrollments.length > 0 ? Math.round((completed / courseEnrollments.length) * 100) : 0,
        };
      });
  }, [courses, enrollments]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
              Trainer portal
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Live dashboard
            </Badge>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Trainer dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                Monitor course delivery, learner participation, completion performance, and certificate release activity in one place.
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="h-7 w-7" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {showingAllCoursesFallback
              ? "Showing all manageable courses because no direct trainer ownership match was found."
              : "Showing your current course and learner metrics."}
          </p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading trainer dashboard...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Courses</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{courses.length}</div>
                  <p className="text-xs text-muted-foreground">Courses currently managed</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Learners</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{uniqueLearners}</div>
                  <p className="text-xs text-muted-foreground">Unique enrolled trainees</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completionRate}%</div>
                  <p className="text-xs text-muted-foreground">Across active course enrollments</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Certificates Released</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{certificateCount}</div>
                  <p className="text-xs text-muted-foreground">Certificate records tied to your courses</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Joined This Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{monthlyJoined}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Completed This Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{monthlyCompleted}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Dropped</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{monthlyDropped}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Average Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{averageProgress}%</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Course Performance</CardTitle>
                  <CardDescription>Enrollment volume and completion outcomes across your most active courses.</CardDescription>
                </CardHeader>
                <CardContent>
                  {coursePerformance.length > 0 ? (
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={coursePerformance}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Bar dataKey="enrollments" fill="#0f766e" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="completionRate" fill="#2563eb" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No course performance data is available yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Learner Status Distribution</CardTitle>
                  <CardDescription>Current enrollment mix across active learner records.</CardDescription>
                </CardHeader>
                <CardContent>
                  {statusData.length > 0 ? (
                    <>
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={4}>
                              {statusData.map((entry, index) => (
                                <Cell key={entry.name} fill={statusColors[index % statusColors.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid gap-2">
                        {statusData.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColors[index % statusColors.length] }} />
                              <span>{item.name}</span>
                            </div>
                            <span className="font-medium">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No learner status data is available yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Courses</CardTitle>
                  <CardDescription>Latest managed courses with learner volume and completion context.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentCourses.length > 0 ? (
                    recentCourses.map((course) => (
                      <div key={course.id} className="rounded-xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{course.title}</p>
                            <p className="text-sm text-muted-foreground">{course.category} • {course.level}</p>
                          </div>
                          <Badge variant={course.published !== false ? "default" : "secondary"}>
                            {course.published !== false ? "Published" : "Draft"}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Learners</p>
                            <p className="font-medium">{course.learnerCount}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Completion</p>
                            <p className="font-medium">{course.completionRate}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Duration</p>
                            <p className="font-medium">{course.duration} hrs</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">You do not have any courses to summarize yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Move from the dashboard into course and learner management.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button asChild className="w-full justify-start">
                    <Link to="/trainer/courses">
                      <BookOpen className="mr-2 h-4 w-4" />
                      Manage Courses
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start">
                    <Link to="/trainer/learners">
                      <Users className="mr-2 h-4 w-4" />
                      View Learners
                    </Link>
                  </Button>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Dashboard notes</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          This dashboard uses the actual course, enrollment, and certificate records currently available in the system. Demographic charts were not added because age and gender fields are not stored in the user model.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-foreground">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Current focus</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Use the learner page to inspect per-course and per-module progress, including certificate release status, for individual trainees.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TrainerDashboardPlaceholder;