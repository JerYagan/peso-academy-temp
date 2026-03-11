import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Eye,
  GraduationCap,
  ImageIcon,
  Laptop2,
  Loader2,
  MessageSquareHeart,
  Ribbon,
  Sparkles,
  Users,
} from "lucide-react";
import { analyticsService, type PersistedLearnerRecommendation } from "@/services/analyticsService";
import { courseService, enrollmentService, moduleService } from "@/services/supabaseDatabaseService";
import { Course, Enrollment } from "@/types";
import { toast } from "sonner";
import { buildLearnerCourseRecommendations, reportingService, type CollaborativeRecommendationSignal, type LearnerCourseRecommendation, type LearnerPerformanceSummary } from "@/services/reportingService";
import { moduleSessionService, type ModuleSessionAggregate } from "@/services/moduleSessionService";

type CourseTab = "all" | "technical" | "business" | "personal";

const courseTabs: Array<{ key: CourseTab; label: string }> = [
  { key: "all", label: "All Courses" },
  { key: "technical", label: "Technical Skills" },
  { key: "business", label: "Business & Management" },
  { key: "personal", label: "Personal Development" },
];

const matchesTab = (course: Course, activeTab: CourseTab) => {
  if (activeTab === "all") return true;

  const category = course.category.toLowerCase();

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
  const [previewRecommendation, setPreviewRecommendation] = useState<PersistedLearnerRecommendation | null>(null);
  const [previewModuleCount, setPreviewModuleCount] = useState(0);
  const [persistedRecommendations, setPersistedRecommendations] = useState<PersistedLearnerRecommendation[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState<LearnerPerformanceSummary | null>(null);
  const [sessionAggregates, setSessionAggregates] = useState<ModuleSessionAggregate[]>([]);
  const [collaborativeSignals, setCollaborativeSignals] = useState<Record<string, CollaborativeRecommendationSignal>>({});

  useEffect(() => {
    loadCourses();
    loadEnrollments();
    void loadRecommendationSignals();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => {
      void loadEnrollments();
      void loadRecommendationSignals();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user]);

  useEffect(() => {
    if (!previewCourse) {
      setPreviewModuleCount(0);
      setPreviewRecommendation(null);
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

  const loadRecommendationSignals = async () => {
    if (!user || user.role !== "trainee") {
      setPerformanceSummary(null);
      setSessionAggregates([]);
      return;
    }

    try {
      const [summary, aggregates, collaborative] = await Promise.all([
        reportingService.getLearnerPerformanceSummary(user.id),
        moduleSessionService.getSessionAggregatesByModule(user.id),
        reportingService.getCollaborativeRecommendationSignals(user.id),
      ]);
      setPerformanceSummary(summary);
      setSessionAggregates(aggregates);
      setCollaborativeSignals(collaborative);
    } catch (error) {
      console.error("Error loading recommendation signals:", error);
    }
  };

  const handleEnrollClick = (
    course: Course,
    recommendation?: PersistedLearnerRecommendation,
    sourceSurface = "course_catalog",
  ) => {
    if (!user) {
      navigate(`/signup?redirect=${encodeURIComponent(`/courses/${course.id}`)}`);
      return;
    }
    void handleEnroll(course.id, recommendation, sourceSurface);
  };

  const handleEnroll = async (
    courseId: string,
    recommendation?: PersistedLearnerRecommendation,
    sourceSurface = "course_catalog",
  ) => {
    if (!user) return;

    if (enrollments.some((enrollment) => enrollment.courseId === courseId)) {
      toast.info("You are already enrolled in this course");
      return;
    }

    setEnrolling(courseId);
    try {
      await enrollmentService.enrollInCourse(
        user.id,
        courseId,
        analyticsService.getOriginatingRecommendationOptions(recommendation, sourceSurface),
      );
      await loadEnrollments();
      await loadCourses();
      toast.success("Successfully enrolled in course!");
    } catch (error) {
      console.error("Error enrolling in course:", error);
      toast.error("Failed to enroll in course. Please try again.");
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

  const recommendedCourses = useMemo<LearnerCourseRecommendation[]>(() => {
    return buildLearnerCourseRecommendations(
      user,
      courses,
      enrollments,
      performanceSummary,
      3,
      sessionAggregates,
      collaborativeSignals,
    );
  }, [collaborativeSignals, courses, enrollments, performanceSummary, sessionAggregates, user]);

  const hasOnboardingSignals = Boolean(
    user &&
      ((user.industryInterests && user.industryInterests.length > 0) ||
        (user.preferredCategories && user.preferredCategories.length > 0) ||
        user.onboardingSkillLevel ||
        (user.skills && user.skills.length > 0)),
  );

  const recommendationCards = useMemo(
    () => analyticsService.hydrateRecommendationCards(recommendedCourses, persistedRecommendations),
    [persistedRecommendations, recommendedCourses],
  );

  useEffect(() => {
    if (!user || user.role !== "trainee" || recommendedCourses.length === 0) {
      setPersistedRecommendations([]);
      return;
    }

    let cancelled = false;

    const syncRecommendations = async () => {
      try {
        const syncedRecommendations = await analyticsService.syncLearnerRecommendations(
          user.id,
          recommendedCourses,
          "browse_recommendations",
          {
            totalEnrollments: enrollments.length,
            industryInterestCount: user.industryInterests?.length || 0,
            preferredCategoryCount: user.preferredCategories?.length || 0,
            onboardingSkillLevel: user.onboardingSkillLevel || null,
            hasProfileSkills: Boolean(user.skills && user.skills.length > 0),
            hasPerformanceSummary: Boolean(performanceSummary),
            recentSessionCount: sessionAggregates.reduce((sum, aggregate) => sum + aggregate.sessionCount, 0),
            repeatedIncompleteModules: sessionAggregates.filter((aggregate) => aggregate.lastSessionStatus !== "completed" && aggregate.sessionCount >= 2).length,
            collaborativeCandidateCount: Object.keys(collaborativeSignals).length,
            hybridRecommendationEngine: true,
          },
        );

        if (cancelled) {
          return;
        }

        setPersistedRecommendations(syncedRecommendations);
        await analyticsService.logRecommendationImpressions(user.id, syncedRecommendations, "browse_recommendations");
      } catch (error) {
        console.error("Error syncing browse recommendations:", error);
      }
    };

    void syncRecommendations();

    return () => {
      cancelled = true;
    };
  }, [collaborativeSignals, enrollments.length, performanceSummary, recommendedCourses, sessionAggregates, user]);

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
                    state={{ entrySource: previewRecommendation ? "browse_recommendations" : "courses_continue_learning" }}
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
        <div className="flex min-h-[260px] items-center justify-center rounded-[1.8rem] border border-border bg-card">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Loading courses...</p>
          </div>
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

  const renderRecommendedSection = () => {
    if (!user || user.role !== "trainee" || recommendedCourses.length === 0) {
      return null;
    }

    return (
      <section className="rounded-[1.8rem] border border-border bg-[linear-gradient(135deg,rgba(15,118,110,0.08)_0%,rgba(29,78,216,0.08)_100%)] p-6 sm:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-[0.18em]">Recommended for You</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
              {hasOnboardingSignals
                ? "Starter courses picked from your onboarding profile"
                : "Starter courses picked from beginner-friendly learner paths"}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
              {hasOnboardingSignals
                ? "These recommendations use the interests, preferred categories, skill level, and skills you shared during signup so you can start with relevant training immediately."
                : "These recommendations fall back to curated starter courses and popular beginner pathways so new trainees can begin learning right away."}
            </p>
          </div>
          <Badge variant="outline" className="w-fit rounded-full bg-background/80 px-3 py-1 text-xs font-semibold">
            {hasOnboardingSignals ? "Cold-start onboarding signals" : "Curated starter defaults"}
          </Badge>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {recommendationCards.map(({ course, reasons, persisted }) => (
            <article key={course.id} className="rounded-[1.6rem] border border-border/80 bg-background/90 p-4 shadow-[0_16px_50px_-35px_rgba(15,23,42,0.45)] backdrop-blur">
              <div className="mb-4 flex items-center justify-between gap-3">
                <Badge className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary">
                  {course.level}
                </Badge>
                {course.isTESDAAccredited && (
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold">
                    <Award className="mr-1 h-3 w-3" />
                    TESDA
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-semibold leading-tight tracking-[-0.03em] text-foreground">
                  {course.title}
                </h3>
                <p className="line-clamp-3 text-sm leading-7 text-muted-foreground">
                  {course.description}
                </p>
              </div>

              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  <span>{getDurationLabel(course.duration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{formatLearnerCount(course.enrolledCount)}</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {reasons.map((reason) => (
                  <Badge key={reason} variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                    {reason}
                  </Badge>
                ))}
              </div>

              <div className="mt-5 flex gap-3">
                <Button
                  className="flex-1 rounded-xl"
                  onClick={() => handleEnrollClick(course, persisted, "browse_recommendations")}
                  disabled={enrolling === course.id}
                >
                  {enrolling === course.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enrolling...
                    </>
                  ) : (
                    "Enroll Now"
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setPreviewCourse(course);
                    setPreviewRecommendation(persisted || null);
                    if (user && persisted) {
                      void analyticsService.logRecommendationClick(user.id, persisted, "browse_recommendations");
                    }
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Training Courses</h1>
          <p className="mt-2 text-muted-foreground">
            Browse available training programs and continue learning from your dashboard.
          </p>
        </div>

        {renderRecommendedSection()}

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