import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { canonicalizeCourseCategory } from "@/lib/taxonomy";
import DashboardLayout from "@/components/DashboardLayout";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Award,
  AlertCircle,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  GraduationCap,
  ImageIcon,
  Laptop2,
  Loader2,
  MessageSquareHeart,
  Ribbon,
  Users,
} from "lucide-react";
import { courseService, enrollmentService, getEnrollmentErrorFeedback, moduleService } from "@/services/supabaseDatabaseService";
import { Course, Enrollment } from "@/types";
import { toast } from "sonner";

type CourseTab = "all" | "technical" | "business" | "personal";

const courseTabs: Array<{ key: CourseTab; label: string }> = [
  { key: "all", label: "All Courses" },
  { key: "technical", label: "Technical Skills" },
  { key: "business", label: "Business & Management" },
  { key: "personal", label: "Personal Development" },
];

const matchesTab = (course: Course, activeTab: CourseTab) => {
  if (activeTab === "all") return true;

  const category = (canonicalizeCourseCategory(course.category) || course.category).toLowerCase();

  if (activeTab === "technical") {
    return ["technical", "digital", "vocational", "web", "mobile"].some((term) =>
      category.includes(term),
    );
  }

  if (activeTab === "business") {
    return ["business", "entrepreneur", "management", "bookkeeping", "accounting"].some((term) =>
      category.includes(term) || course.title.toLowerCase().includes(term),
    );
  }

  return ["employability", "career", "soft", "personal", "customer", "communication"].some((term) =>
    category.includes(term) || course.title.toLowerCase().includes(term),
  );
};

const getCourseVisual = (course: Course) => {
  const value = `${course.category} ${course.title}`.toLowerCase();

  if (value.includes("technical") || value.includes("web") || value.includes("digital") || value.includes("mobile")) {
    return {
      icon: Laptop2,
      gradient: "linear-gradient(135deg, #eef2ff 0%, #dbeafe 100%)",
      iconWrapClass: "bg-indigo-600/10 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
    };
  }

  if (value.includes("business") || value.includes("entrepreneur") || value.includes("bookkeeping") || value.includes("accounting")) {
    return {
      icon: BriefcaseBusiness,
      gradient: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
      iconWrapClass: "bg-amber-600/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    };
  }

  if (value.includes("customer") || value.includes("communication") || value.includes("career")) {
    return {
      icon: MessageSquareHeart,
      gradient: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
      iconWrapClass: "bg-rose-600/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
    };
  }

  return {
    icon: GraduationCap,
    gradient: "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)",
    iconWrapClass: "bg-slate-700/10 text-slate-700 dark:bg-slate-300/15 dark:text-slate-300",
  };
};

const getDurationLabel = (duration: number) => {
  const weeks = Math.max(1, Math.round(duration / 10));
  return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
};

const formatLearnerCount = (count: number) => `${count || 0} learners enrolled`;

const Courses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeTab, setActiveTab] = useState<CourseTab>("all");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  const [previewModuleCount, setPreviewModuleCount] = useState(0);
  const [enrollmentRecovery, setEnrollmentRecovery] = useState<{
    courseId: string;
    courseTitle: string;
    feedback: ReturnType<typeof getEnrollmentErrorFeedback>;
  } | null>(null);

  useEffect(() => {
    loadCourses();
    loadEnrollments();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => {
      void loadEnrollments();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
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
    return () => {
      cancelled = true;
    };
  }, [previewCourse?.id]);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const allCourses = await courseService.getCourses();
      setCourses(allCourses.filter((course) => course.published !== false));
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
    void handleEnroll(course);
  };

  const handleEnroll = async (course: Course) => {
    if (!user) return;

    if (enrollments.some((enrollment) => enrollment.courseId === course.id)) {
      toast.info("You are already enrolled in this course");
      return;
    }

    setEnrolling(course.id);
    setEnrollmentRecovery(null);
    try {
      await enrollmentService.enrollInCourse(user.id, course.id, { sourceSurface: "course_catalog" });
      await loadEnrollments();
      await loadCourses();
      toast.success("Successfully enrolled in course!");
    } catch (error) {
      console.error("Error enrolling in course:", error);
      const feedback = getEnrollmentErrorFeedback(error, course.title);
      if (feedback.code === "already_enrolled") {
        await loadEnrollments();
      }
      setEnrollmentRecovery({
        courseId: course.id,
        courseTitle: course.title,
        feedback,
      });
      toast.error(feedback.toastMessage);
    } finally {
      setEnrolling(null);
    }
  };

  const enrollmentByCourseId = useMemo(() => {
    const map: Record<string, Enrollment> = {};
    enrollments.forEach((enrollment) => {
      map[enrollment.courseId] = enrollment;
    });
    return map;
  }, [enrollments]);

  const displayedCourses = useMemo(
    () => courses.filter((course) => matchesTab(course, activeTab)),
    [courses, activeTab],
  );

  const profileSignalCoverage = Math.round(
    ([
      Boolean(user?.onboardingSkillLevel),
      Boolean(user?.industryInterests && user.industryInterests.length > 0),
      Boolean(user?.preferredCategories && user.preferredCategories.length > 0),
      Boolean(user?.skills && user.skills.length > 0),
    ].filter(Boolean).length / 4) * 100,
  );
  const activeEnrollment = enrollments.find((enrollment) => enrollment.status !== "completed") || enrollments[0] || null;
  const browsePrimaryAction = activeEnrollment
    ? {
        title: "Choose between resuming and exploring",
        description: "You already have an active course. Resume it first if you want momentum, or stay here if you are intentionally looking for another learning path.",
        href: `/courses/${activeEnrollment.courseId}`,
        label: "Continue current course",
      }
    : {
        title: "Pick a course that creates your next step",
        description: "Browse by category, preview the course details, then enroll when you find a fit for your current skill goals.",
        href: "/dashboard",
        label: "Open dashboard",
      };

  const renderCourseCard = (course: Course) => {
    const enrollment = enrollmentByCourseId[course.id];
    const isEnrolled = !!enrollment;
    const isEnrolling = enrolling === course.id;
    const visual = getCourseVisual(course);
    const VisualIcon = visual.icon;

    return (
      <article
        key={course.id}
        className="flex h-full flex-col overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-[0_18px_50px_-30px_rgba(30,41,59,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_60px_-28px_rgba(30,41,59,0.45)]"
      >
        <button
          type="button"
          onClick={() => setPreviewCourse(course)}
          className="block w-full text-left"
        >
          <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-muted">
            {course.thumbnail ? (
              <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-end justify-between p-6" style={{ background: visual.gradient }}>
                <div className="max-w-[75%]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-700/70 dark:text-slate-800/70">
                    {course.category}
                  </p>
                  <p className="mt-2 text-xl font-extrabold leading-tight text-slate-900">
                    {course.title}
                  </p>
                </div>
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${visual.iconWrapClass}`}>
                  <VisualIcon className="h-6 w-6" />
                </div>
              </div>
            )}

            <div className="absolute left-4 top-4 flex items-center gap-2">
              <Badge className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary">
                {course.level}
              </Badge>
            </div>
          </div>
        </button>

        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <div className="space-y-3">
            <h3 className="line-clamp-2 text-[1.7rem] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[2rem]">
              {course.title}
            </h3>
            <p className="line-clamp-3 text-sm leading-7 text-muted-foreground">
              {course.description}
            </p>
          </div>

          <div className="mt-5 space-y-2.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              <span>{getDurationLabel(course.duration)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{formatLearnerCount(course.enrolledCount)}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span>{course.isTESDAAccredited ? "TESDA-recognized certificate" : "Certificate available upon completion"}</span>
            </div>
          </div>

          <div className="mt-auto pt-5">
            {isEnrolled ? (
              <Button asChild className="h-12 w-full rounded-xl text-base font-semibold">
                <Link to={`/courses/${course.id}`} state={{ entrySource: "courses_continue_learning" }}>
                  Continue Learning
                </Link>
              </Button>
            ) : (
              <Button
                onClick={() => handleEnrollClick(course)}
                className="h-12 w-full rounded-xl text-base font-semibold"
                disabled={isEnrolling}
              >
                {isEnrolling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enrolling...
                  </>
                ) : (
                  "Enroll Now"
                )}
              </Button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const renderPreviewDialog = () => (
    <Dialog open={!!previewCourse} onOpenChange={(open) => !open && setPreviewCourse(null)}>
      <DialogContent className="sm:max-w-xl">
        {previewCourse && (
          <>
            <div className="overflow-hidden rounded-xl border bg-muted">
              {previewCourse.thumbnail ? (
                <img
                  src={previewCourse.thumbnail}
                  alt={previewCourse.title}
                  className="h-52 w-full object-cover"
                />
              ) : (
                <div className="flex h-52 items-center justify-center bg-[linear-gradient(135deg,#e2e8f0_0%,#cbd5e1_100%)]">
                  <ImageIcon className="h-12 w-12 text-slate-500" />
                </div>
              )}
            </div>

            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary">
                  {previewCourse.level}
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold">
                  {previewCourse.category}
                </Badge>
                {previewCourse.isTESDAAccredited && (
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-semibold">
                    <Award className="mr-1 h-3 w-3" />
                    TESDA
                  </Badge>
                )}
              </div>
              <DialogTitle className="pt-2 text-left text-2xl">{previewCourse.title}</DialogTitle>
              <DialogDescription className="text-left text-sm leading-7 text-muted-foreground">
                {previewCourse.description}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                <span>{previewCourse.duration} hours</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span>{previewModuleCount} {previewModuleCount === 1 ? "module" : "modules"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{formatLearnerCount(previewCourse.enrolledCount)}</span>
              </div>
            </div>

            {previewCourse.skills?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previewCourse.skills.slice(0, 6).map((skill) => (
                  <Badge key={skill} variant="secondary" className="rounded-full px-3 py-1 text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}

            <DialogFooter className="gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setPreviewCourse(null)}
              >
                Close
              </Button>
              {enrollmentByCourseId[previewCourse.id] ? (
                <Button asChild className="w-full sm:w-auto">
                  <Link
                    to={`/courses/${previewCourse.id}`}
                    state={{ entrySource: "courses_continue_learning" }}
                    onClick={() => setPreviewCourse(null)}
                  >
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
  );

  const renderCourseGrid = () => {
    if (loading) {
      return (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-[1.6rem] border border-border bg-card">
              <Skeleton className="aspect-[16/10] w-full rounded-none" />
              <div className="space-y-4 p-5 sm:p-6">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (displayedCourses.length === 0) {
      return (
        <div className="flex min-h-[260px] items-center justify-center rounded-[1.8rem] border border-border bg-card px-6 text-center">
          <div className="space-y-3">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No courses found for this category yet.</p>
          </div>
        </div>
      );
    }

    return <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{displayedCourses.map(renderCourseCard)}</div>;
  };

  const publicPage = (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-[74px]">
        <section className="border-b border-border bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted))_100%)] py-14 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <h1 className="text-4xl font-extrabold tracking-[-0.04em] text-foreground sm:text-6xl">
              Training <span className="text-primary">Courses</span>
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-muted-foreground sm:text-xl">
              Enhance your skills with our comprehensive training programs designed to boost your employability and career prospects.
            </p>
          </div>
        </section>

        <section className="border-b border-border bg-background py-6">
          <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-3 px-4 sm:px-6 lg:px-8">
            {courseTabs.map((tab) => (
              <Button
                key={tab.key}
                type="button"
                variant={activeTab === tab.key ? "default" : "secondary"}
                className="rounded-xl px-5 text-sm font-medium"
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{renderCourseGrid()}</div>
        </section>

        <section className="pb-20 sm:pb-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-[2rem] bg-primary px-6 py-12 text-center text-primary-foreground shadow-[0_22px_70px_-30px_rgba(31,41,95,0.55)] sm:px-10 lg:px-16">
              <div className="mx-auto flex max-w-3xl flex-col items-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/5">
                  <Ribbon className="h-8 w-8" />
                </div>
                <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
                  Earn Recognized Certificates
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-primary-foreground/80 sm:text-lg">
                  Upon successful completion of any course, you'll receive an official certificate from PESO Academy that you can add to your resume and professional portfolio.
                </p>
                <Button asChild variant="secondary" className="mt-8 h-12 rounded-xl bg-white px-8 text-base font-semibold text-primary hover:bg-white/90">
                  <Link to="/certificates">Learn More About Certification</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {renderPreviewDialog()}
      </main>
      <Footer />
    </div>
  );

  if (!user) {
    return publicPage;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.8rem] border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-7">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Course catalog</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Training Courses</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Browse available training programs, compare options by category, and keep your next move explicit: resume a current course or intentionally start a new one.
            </p>

            <div className="mt-5 rounded-3xl border border-primary/15 bg-background/80 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Primary next step</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{browsePrimaryAction.title}</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{browsePrimaryAction.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={browsePrimaryAction.href}>{browsePrimaryAction.label}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/progress">View progress</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[1.5rem] border border-border bg-card p-5">
              <p className="font-medium">Recommendation readiness</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {profileSignalCoverage >= 75
                  ? `Your profile signals are ${profileSignalCoverage}% complete, so course discovery can stay more targeted.`
                  : `Your profile signals are ${profileSignalCoverage}% complete. Add interests, categories, and skills for sharper recommendations.`}
              </p>
              <Button asChild size="sm" variant="outline" className="mt-4">
                <Link to="/profile">Update profile</Link>
              </Button>
            </div>
            <div className="rounded-[1.5rem] border border-border bg-card p-5">
              <p className="font-medium">When to use this page</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Stay here when you are comparing options. Switch back to the dashboard when you already know which course or module you need to continue.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-4">
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            </div>
          </div>
        </div>

        {enrollmentRecovery ? (
          <Alert variant={enrollmentRecovery.feedback.code === "unknown" ? "destructive" : "default"}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{enrollmentRecovery.feedback.title}</AlertTitle>
            <AlertDescription>
              <div className="space-y-3">
                <p>{enrollmentRecovery.feedback.description}</p>
                <div className="flex flex-wrap gap-2">
                  {enrollmentRecovery.feedback.canRetry ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        const course = courses.find((item) => item.id === enrollmentRecovery.courseId);
                        if (course) {
                          void handleEnroll(course);
                        }
                      }}
                    >
                      Retry enrollment
                    </Button>
                  ) : null}
                  {enrollmentRecovery.feedback.suggestedActions.includes("profile") ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/profile">Update profile</Link>
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setEnrollmentRecovery(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {courseTabs.map((tab) => (
            <Button
              key={tab.key}
              type="button"
              variant={activeTab === tab.key ? "default" : "secondary"}
              className="rounded-xl px-5 text-sm font-medium"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {renderCourseGrid()}

        <div className="rounded-[1.8rem] bg-primary px-6 py-10 text-primary-foreground">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">Earn Recognized Certificates</h2>
              <p className="mt-3 text-primary-foreground/80">
                Complete courses and add PESO Academy certificates to your portfolio.
              </p>
            </div>
            <Button asChild variant="secondary" className="rounded-xl bg-white text-primary hover:bg-white/90">
              <Link to="/certificates">View Certificates</Link>
            </Button>
          </div>
        </div>

        {renderPreviewDialog()}
      </div>
    </DashboardLayout>
  );
};

export default Courses;