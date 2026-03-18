import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import {
  analyticsService,
  type PersistedLearnerRecommendation,
} from "@/services/analyticsService";
import { filterCoursesForUser } from "@/lib/courseAudience";
import { canonicalizeCourseCategory } from "@/lib/taxonomy";
import DashboardLayout from "@/components/DashboardLayout";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Eye,
  GraduationCap,
  ImageIcon,
  Laptop2,
  Loader2,
  MessageSquareHeart,
  Ribbon,
  Users,
} from "lucide-react";
import TraineeVerificationBadge from "@/components/trainee/TraineeVerificationBadge";
import { getFlexibleCourseDurationLabel, getOfficialHoursCreditLabel } from "@/lib/courseDuration";
import {
  buildLearnerCourseRecommendations,
  reportingService,
  type CollaborativeRecommendationSignal,
  type LearnerCourseRecommendation,
  type LearnerPerformanceSummary,
} from "@/services/reportingService";
import {
  courseService,
  enrollmentService,
  getEnrollmentErrorFeedback,
  getTraineeEnrollmentVerificationFeedback,
  isTraineeEnrollmentBlocked,
  moduleService,
} from "@/services/supabaseDatabaseService";
import { moduleSessionService, type ModuleSessionAggregate } from "@/services/moduleSessionService";
import { Course, Enrollment } from "@/types";
import { toast } from "sonner";

type CourseTab = "all" | "technical" | "business" | "personal";
type EnrollmentFilter = "all" | "available" | "enrolled" | "completed";

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
      surfaceClass: "bg-indigo-50 dark:bg-indigo-950/30",
      iconWrapClass: "bg-indigo-600/10 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
    };
  }

  if (value.includes("business") || value.includes("entrepreneur") || value.includes("bookkeeping") || value.includes("accounting")) {
    return {
      icon: BriefcaseBusiness,
      surfaceClass: "bg-amber-50 dark:bg-amber-950/30",
      iconWrapClass: "bg-amber-600/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    };
  }

  if (value.includes("customer") || value.includes("communication") || value.includes("career")) {
    return {
      icon: MessageSquareHeart,
      surfaceClass: "bg-rose-50 dark:bg-rose-950/30",
      iconWrapClass: "bg-rose-600/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
    };
  }

  return {
    icon: GraduationCap,
    surfaceClass: "bg-slate-100 dark:bg-slate-900/60",
    iconWrapClass: "bg-slate-700/10 text-slate-700 dark:bg-slate-300/15 dark:text-slate-300",
  };
};

const Courses = () => {
  const { user } = useAuth();
  const { language } = useLocale();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeTab, setActiveTab] = useState<CourseTab>("all");
  const [enrollmentFilter, setEnrollmentFilter] = useState<EnrollmentFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState<LearnerPerformanceSummary | null>(null);
  const [sessionAggregates, setSessionAggregates] = useState<ModuleSessionAggregate[]>([]);
  const [collaborativeSignals, setCollaborativeSignals] = useState<Record<string, CollaborativeRecommendationSignal>>({});
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  const [previewSourceSurface, setPreviewSourceSurface] = useState<"course_catalog" | "browse_recommendations">("course_catalog");
  const [previewRecommendation, setPreviewRecommendation] = useState<PersistedLearnerRecommendation | null>(null);
  const [previewModuleCount, setPreviewModuleCount] = useState(0);
  const [persistedBrowseRecommendations, setPersistedBrowseRecommendations] = useState<PersistedLearnerRecommendation[]>([]);
  const [enrollmentRecovery, setEnrollmentRecovery] = useState<{
    courseId: string;
    courseTitle: string;
    feedback: ReturnType<typeof getEnrollmentErrorFeedback>;
  } | null>(null);
  const copy = language === "tl"
    ? {
        tabs: {
          all: "Lahat ng Kurso",
          technical: "Technical Skills",
          business: "Business at Management",
          personal: "Personal Development",
        },
        toasts: {
          loadFailed: "Hindi ma-load ang mga kurso",
          alreadyEnrolled: "Naka-enroll ka na sa kursong ito",
          enrolledSuccess: "Matagumpay kang naka-enroll sa kurso!",
        },
        actions: {
          continueLearning: "Ipagpatuloy ang Pag-aaral",
          enrollNow: "Mag-enroll Ngayon",
          enrolling: "Nag-e-enroll...",
          close: "Isara",
          preview: "Preview",
          viewProgress: "Tingnan ang progreso",
          openDashboard: "Buksan ang dashboard",
          updateProfile: "I-update ang profile",
          reviewProfile: "Suriin ang profile",
          browseAllCourses: "Tingnan ang lahat ng kurso",
          viewCertificates: "Tingnan ang certificates",
          dismiss: "Isara",
          retryEnrollment: "Subukan muli ang enrollment",
          browseCourses: "Tingnan ang mga kurso",
        },
        labels: {
          learnerCount: (count: number) => `${count || 0} learner ang naka-enroll`,
          tesdaCertificate: "TESDA-recognized certificate",
          completionCertificate: "May certificate kapag natapos",
          modules: (count: number) => `${count} ${count === 1 ? "module" : "modules"}`,
        },
        publicPage: {
          title: "Training Courses",
          subtitle: "Palawakin ang iyong kakayahan sa pamamagitan ng mga komprehensibong training program na idinisenyo para mapataas ang iyong employability at career prospects.",
          ctaTitle: "Makakuha ng Kinikilalang Certificates",
          ctaBody: "Kapag matagumpay mong natapos ang anumang kurso, makakatanggap ka ng opisyal na certificate mula sa PESO Academy na maaari mong idagdag sa iyong resume at professional portfolio.",
          ctaButton: "Alamin ang Certification",
        },
        dashboardPage: {
          title: "Training Courses",
          subtitle: "Tingnan ang mga available na training program, maghanap ng tamang kurso, at pumili ng susunod mong learning move nang hindi magulo ang screen.",
          primaryNextStep: "Pangunahing susunod na hakbang",
          browseTitle: "Pumili ng kursong bubuo sa susunod mong hakbang",
          browseDescription: "Mag-browse ayon sa category, i-preview ang course details, at mag-enroll kapag may nakita kang tugma sa iyong kasalukuyang goals.",
          browseLabel: "Buksan ang dashboard",
          searchLabel: "Maghanap ng kurso",
          searchPlaceholder: "Maghanap ayon sa title, category, o description",
          filtersLabel: "I-filter ayon sa status",
          filters: {
            all: "Lahat",
            available: "Available",
            enrolled: "Enrolled",
            completed: "Completed",
          },
          certificatesTitle: "Subaybayan ang natapos mong kurso at certificates",
          certificatesBody: "Kapag na-release na ang certificate mo, makikita mo ito sa certifications page kasama ng completion records mo para hindi mo na kailangang bumalik sa bawat course card.",
          recommendationsTitle: "Inirerekomenda para sa iyo",
          recommendationsBody: "Nakabatay ang mga pagpiling ito sa iyong onboarding profile at kamakailang learning activity, at ipinapakita na ngayon dito habang nagba-browse ka ng mga kurso.",
          recommendationsLockedTitle: "Tapusin ang onboarding para ma-unlock ang recommendations.",
          recommendationsLockedBody: "Idagdag muna ang iyong interests, categories, at skill signals para mas ma-rank ng browse page ang mas angkop na mga kurso para sa iyo.",
        },
        states: {
          noCourses: "Wala pang kurso sa category na ito.",
          blockedPending: "Naghihintay ng verification",
          blockedRejected: "Tinanggihan ang verification",
        },
      }
    : {
        tabs: {
          all: "All Courses",
          technical: "Technical Skills",
          business: "Business & Management",
          personal: "Personal Development",
        },
        toasts: {
          loadFailed: "Failed to load courses",
          alreadyEnrolled: "You are already enrolled in this course",
          enrolledSuccess: "Successfully enrolled in course!",
        },
        actions: {
          continueLearning: "Continue Learning",
          enrollNow: "Enroll Now",
          enrolling: "Enrolling...",
          close: "Close",
          preview: "Preview",
          viewProgress: "View progress",
          openDashboard: "Open dashboard",
          updateProfile: "Update profile",
          reviewProfile: "Review profile",
          browseAllCourses: "Browse all courses",
          viewCertificates: "View Certificates",
          dismiss: "Dismiss",
          retryEnrollment: "Retry enrollment",
          browseCourses: "Browse Courses",
        },
        labels: {
          learnerCount: (count: number) => `${count || 0} learners enrolled`,
          tesdaCertificate: "TESDA-recognized certificate",
          completionCertificate: "Certificate available upon completion",
          modules: (count: number) => `${count} ${count === 1 ? "module" : "modules"}`,
        },
        publicPage: {
          title: "Training Courses",
          subtitle: "Enhance your skills with our comprehensive training programs designed to boost your employability and career prospects.",
          ctaTitle: "Earn Recognized Certificates",
          ctaBody: "Upon successful completion of any course, you'll receive an official certificate from PESO Academy that you can add to your resume and professional portfolio.",
          ctaButton: "Learn More About Certification",
        },
        dashboardPage: {
          title: "Training Courses",
          subtitle: "Browse available training programs, search for the right fit, and choose your next learning move without extra dashboard filler.",
          primaryNextStep: "Primary next step",
          browseTitle: "Pick a course that creates your next step",
          browseDescription: "Browse by category, preview the course details, then enroll when you find a fit for your current skill goals.",
          browseLabel: "Open dashboard",
          searchLabel: "Search courses",
          searchPlaceholder: "Search by title, category, or description",
          filtersLabel: "Filter by status",
          filters: {
            all: "All",
            available: "Available",
            enrolled: "Enrolled",
            completed: "Completed",
          },
          certificatesTitle: "Track your completed courses and certificates",
          certificatesBody: "Once your certificate is released, you can find it on the certifications page together with your completion records instead of going back through each course card.",
          recommendationsTitle: "Recommended for you",
          recommendationsBody: "These picks are based on your onboarding profile and recent learning activity, now surfaced here where you browse courses.",
          recommendationsLockedTitle: "Complete onboarding to unlock recommendations.",
          recommendationsLockedBody: "Add your interests, categories, and skill signals first so the browse page can rank better-fit courses for you.",
        },
        states: {
          noCourses: "No courses found for this category yet.",
          blockedPending: "Awaiting verification",
          blockedRejected: "Verification rejected",
        },
      };

  const courseTabs: Array<{ key: CourseTab; label: string }> = [
    { key: "all", label: copy.tabs.all },
    { key: "technical", label: copy.tabs.technical },
    { key: "business", label: copy.tabs.business },
    { key: "personal", label: copy.tabs.personal },
  ];

  useEffect(() => {
    loadCourses();
    loadEnrollments();
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "trainee") {
      setPerformanceSummary(null);
      setSessionAggregates([]);
      setCollaborativeSignals({});
      setPersistedBrowseRecommendations([]);
      return;
    }

    let cancelled = false;

    const loadRecommendationInputs = async () => {
      setLoadingRecommendations(true);
      try {
        const [summary, collaborative, aggregates, persistedRecommendations] = await Promise.all([
          reportingService.getLearnerPerformanceSummary(user.id),
          reportingService.getCollaborativeRecommendationSignals(user.id),
          moduleSessionService.getSessionAggregatesByModule(user.id),
          analyticsService.getPersistedRecommendations(user.id, "browse_recommendations"),
        ]);

        if (cancelled) {
          return;
        }

        setPerformanceSummary(summary);
        setCollaborativeSignals(collaborative);
        setSessionAggregates(aggregates);
        setPersistedBrowseRecommendations(persistedRecommendations);
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading browse-page recommendation inputs:", error);
          setPerformanceSummary(null);
          setCollaborativeSignals({});
          setSessionAggregates([]);
          setPersistedBrowseRecommendations([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingRecommendations(false);
        }
      }
    };

    void loadRecommendationInputs();

    return () => {
      cancelled = true;
    };
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
    moduleService.getModuleCountByCourse(previewCourse.id).then((count) => {
      if (!cancelled) setPreviewModuleCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [previewCourse?.id]);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const allCourses = await courseService.getCourses();
      setCourses(filterCoursesForUser(allCourses, user));
    } catch (error) {
      console.error("Error loading courses:", error);
      toast.error(copy.toasts.loadFailed);
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

  const handleEnrollClick = (
    course: Course,
    sourceSurface: "course_catalog" | "browse_recommendations" = "course_catalog",
    originatingRecommendationId?: string,
  ) => {
    if (!user) {
      navigate(`/signup?redirect=${encodeURIComponent(`/courses/${course.id}`)}`);
      return;
    }
    void handleEnroll(course, sourceSurface, originatingRecommendationId);
  };

  const handleEnroll = async (
    course: Course,
    sourceSurface: "course_catalog" | "browse_recommendations" = "course_catalog",
    originatingRecommendationId?: string,
  ) => {
    if (!user) return;

    if (enrollments.some((enrollment) => enrollment.courseId === course.id)) {
      toast.info(copy.toasts.alreadyEnrolled);
      return;
    }

    setEnrolling(course.id);
    setEnrollmentRecovery(null);
    try {
      await enrollmentService.enrollInCourse(
        user.id,
        course.id,
        { sourceSurface, originatingRecommendationId },
      );
      await loadEnrollments();
      await loadCourses();
      toast.success(copy.toasts.enrolledSuccess);
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

  const recommendedCourses = useMemo<LearnerCourseRecommendation[]>(() => {
    if (!user || user.role !== "trainee") {
      return [];
    }

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

  const browseRecommendations = useMemo(
    () => analyticsService.hydrateRecommendationCards(recommendedCourses, persistedBrowseRecommendations).slice(0, 3),
    [persistedBrowseRecommendations, recommendedCourses],
  );

  const persistedBrowseCards = useMemo(
    () => browseRecommendations
      .map((recommendation) => recommendation.persisted)
      .filter((recommendation): recommendation is PersistedLearnerRecommendation => Boolean(recommendation)),
    [browseRecommendations],
  );

  useEffect(() => {
    if (!user || persistedBrowseCards.length === 0) {
      return;
    }

    void analyticsService.logRecommendationImpressions(
      user.id,
      persistedBrowseCards,
      "browse_recommendations",
    );
  }, [persistedBrowseCards, user]);

  const handleRecommendationClick = (recommendation?: PersistedLearnerRecommendation) => {
    if (!user || !recommendation) {
      return;
    }

    void analyticsService.logRecommendationClick(user.id, recommendation, "browse_recommendations");
  };

  const displayedCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return courses.filter((course) => {
      if (!matchesTab(course, activeTab)) {
        return false;
      }

      const enrollment = enrollmentByCourseId[course.id];
      if (enrollmentFilter === "available" && enrollment) {
        return false;
      }
      if (enrollmentFilter === "enrolled" && (!enrollment || enrollment.status === "completed")) {
        return false;
      }
      if (enrollmentFilter === "completed" && enrollment?.status !== "completed") {
        return false;
      }

      if (!query) {
        return true;
      }

      return [course.title, course.category, course.description]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [activeTab, courses, enrollmentByCourseId, enrollmentFilter, searchQuery]);

  const verificationBlocked = isTraineeEnrollmentBlocked(user);
  const verificationFeedback = verificationBlocked
    ? getTraineeEnrollmentVerificationFeedback(user?.verificationStatus)
    : null;
  const blockedEnrollLabel = user?.verificationStatus === "rejected"
    ? copy.states.blockedRejected
    : copy.states.blockedPending;

  const activeEnrollment = enrollments.find((enrollment) => enrollment.status !== "completed") || enrollments[0] || null;
  const browsePrimaryAction = activeEnrollment
    ? {
        title: "Choose between resuming and exploring",
        description: "You already have an active course. Resume it first if you want momentum, or stay here if you are intentionally looking for another learning path.",
        href: `/courses/${activeEnrollment.courseId}`,
        label: copy.actions.continueLearning,
      }
    : {
        title: copy.dashboardPage.browseTitle,
        description: copy.dashboardPage.browseDescription,
        href: "/dashboard",
        label: copy.dashboardPage.browseLabel,
      };

  const renderCourseEnrollmentAction = (
    course: Course,
    sourceSurface: "course_catalog" | "browse_recommendations" = "course_catalog",
    className = "h-12 w-full rounded-xl text-base font-semibold",
    onAction?: () => void,
    recommendation?: PersistedLearnerRecommendation,
  ) => {
    const enrollment = enrollmentByCourseId[course.id];
    const isEnrolled = !!enrollment;
    const isEnrolling = enrolling === course.id;

    if (isEnrolled) {
      return (
        <Button asChild className={className}>
          <Link
            to={`/courses/${course.id}`}
            state={{ entrySource: "courses_continue_learning" }}
            onClick={onAction}
          >
            {copy.actions.continueLearning}
          </Link>
        </Button>
      );
    }

    return (
      <Button
        onClick={() => {
          if (sourceSurface === "browse_recommendations") {
            handleRecommendationClick(recommendation);
          }
          handleEnrollClick(course, sourceSurface, recommendation?.id);
          onAction?.();
        }}
        className={className}
        disabled={isEnrolling || verificationBlocked}
      >
        {verificationBlocked ? (
          blockedEnrollLabel
        ) : isEnrolling ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {copy.actions.enrolling}
          </>
        ) : (
          copy.actions.enrollNow
        )}
      </Button>
    );
  };

  const renderCourseCard = (course: Course) => {
    const enrollment = enrollmentByCourseId[course.id];
    const isEnrolled = !!enrollment;
    const visual = getCourseVisual(course);
    const VisualIcon = visual.icon;

    return (
      <article
        key={course.id}
        className="flex h-full flex-col overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-[0_18px_50px_-30px_rgba(30,41,59,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_60px_-28px_rgba(30,41,59,0.45)]"
      >
        <button
          type="button"
          onClick={() => {
            setPreviewCourse(course);
            setPreviewSourceSurface("course_catalog");
            setPreviewRecommendation(null);
          }}
          className="block w-full text-left"
        >
          <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-muted">
            {course.thumbnail ? (
              <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover" />
            ) : (
              <div className={`flex h-full w-full items-end justify-between p-6 ${visual.surfaceClass}`}>
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
              <span>{getFlexibleCourseDurationLabel(course.duration)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{copy.labels.learnerCount(course.enrolledCount)}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span>{course.isTESDAAccredited ? copy.labels.tesdaCertificate : copy.labels.completionCertificate}</span>
            </div>
          </div>

          <div className="mt-auto pt-5">
            {renderCourseEnrollmentAction(course)}
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
                <div className="flex h-52 items-center justify-center bg-muted">
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
                <span>{getOfficialHoursCreditLabel(previewCourse.duration)}</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span>{copy.labels.modules(previewModuleCount)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{copy.labels.learnerCount(previewCourse.enrolledCount)}</span>
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
                {copy.actions.close}
              </Button>
              {renderCourseEnrollmentAction(
                previewCourse,
                previewSourceSurface,
                "w-full sm:w-auto",
                () => setPreviewCourse(null),
                previewRecommendation || undefined,
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
            <p className="text-muted-foreground">{copy.states.noCourses}</p>
          </div>
        </div>
      );
    }

    return <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{displayedCourses.map(renderCourseCard)}</div>;
  };

  const renderRecommendationSection = () => {
    if (!user || user.role !== "trainee") {
      return null;
    }

    if (!user.onboardingCompletedAt) {
      return (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">{copy.dashboardPage.recommendationsLockedTitle}</p>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{copy.dashboardPage.recommendationsLockedBody}</p>
            </div>
            <Button asChild className="h-12 rounded-xl px-6 text-base font-semibold">
              <Link to="/dashboard">Open dashboard onboarding</Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (loadingRecommendations) {
      return (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-[1.6rem] border border-border bg-card">
              <Skeleton className="aspect-[16/10] w-full rounded-none" />
              <div className="space-y-4 p-5 sm:p-6">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (browseRecommendations.length === 0) {
      return null;
    }

    return (
      <section className="space-y-4 rounded-[1.5rem] border border-border bg-[linear-gradient(135deg,rgba(15,118,110,0.06)_0%,rgba(29,78,216,0.06)_100%)] p-5 sm:p-6">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Ribbon className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-[0.18em]">{copy.dashboardPage.recommendationsTitle}</span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{copy.dashboardPage.recommendationsBody}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {browseRecommendations.map(({ course, reasons, persisted }) => (
            (() => {
              const enrollment = enrollmentByCourseId[course.id];
              const isEnrolled = !!enrollment;

              return (
            <article
              key={course.id}
              className="flex h-full flex-col overflow-hidden rounded-[1.6rem] border border-border bg-background/95 shadow-[0_18px_50px_-30px_rgba(30,41,59,0.35)]"
            >
              <button
                type="button"
                onClick={() => {
                  handleRecommendationClick(persisted);
                  setPreviewCourse(course);
                  setPreviewSourceSurface("browse_recommendations");
                  setPreviewRecommendation(persisted || null);
                }}
                className="block w-full text-left"
              >
                <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-muted">
                  {course.thumbnail ? (
                    <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                      <BookOpen className="h-10 w-10" />
                    </div>
                  )}
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <Badge className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary">
                      Recommended
                    </Badge>
                    {isEnrolled ? (
                      <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-semibold">
                        {enrollment?.status === "completed" ? copy.dashboardPage.filters.completed : copy.dashboardPage.filters.enrolled}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </button>

              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <div className="space-y-3">
                  <h3 className="line-clamp-2 text-[1.5rem] font-semibold leading-tight tracking-[-0.03em] text-foreground">{course.title}</h3>
                  <p className="line-clamp-3 text-sm leading-7 text-muted-foreground">{course.description}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {reasons.slice(0, 3).map((reason) => (
                    <Badge key={reason} variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                      {reason}
                    </Badge>
                  ))}
                </div>

                <div className="mt-auto pt-5">
                  {renderCourseEnrollmentAction(
                    course,
                    "browse_recommendations",
                    "h-12 w-full rounded-xl text-base font-semibold",
                    undefined,
                    persisted,
                  )}
                </div>
              </div>
            </article>
              );
            })()
          ))}
        </div>
      </section>
    );
  };

  const publicPage = (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-[74px]">
        <section className="border-b border-border bg-muted/60 py-14 sm:py-20 dark:bg-muted/35">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <h1 className="text-4xl font-extrabold tracking-[-0.04em] text-foreground sm:text-6xl">
              {copy.publicPage.title.split(" ")[0]} <span className="text-primary">{copy.publicPage.title.split(" ").slice(1).join(" ")}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-muted-foreground sm:text-xl">
              {copy.publicPage.subtitle}
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
                  {copy.publicPage.ctaTitle}
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-primary-foreground/80 sm:text-lg">
                  {copy.publicPage.ctaBody}
                </p>
                <Button asChild variant="secondary" className="mt-8 h-12 rounded-xl bg-white px-8 text-base font-semibold text-primary hover:bg-white/90">
                  <Link to="/certificates">{copy.publicPage.ctaButton}</Link>
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
        <div className="rounded-[1.8rem] border border-primary/15 bg-card p-6 sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{copy.dashboardPage.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {copy.dashboardPage.subtitle}
              </p>
            </div>

            <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base font-semibold">
              <Link to="/progress">{copy.actions.viewProgress}</Link>
            </Button>
          </div>

        </div>

        {verificationFeedback ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              {verificationFeedback.title}
              <TraineeVerificationBadge status={user?.verificationStatus} />
            </AlertTitle>
            <AlertDescription>
              <div className="space-y-3">
                <p>{verificationFeedback.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/profile">{copy.actions.reviewProfile}</Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setActiveTab("all")}>
                    {copy.actions.browseAllCourses}
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {renderRecommendationSection()}

        <div className="flex flex-col gap-4 rounded-[1.6rem] border border-border bg-card p-5 sm:p-6">
          <div className="space-y-3">
            <Label htmlFor="course-search" className="text-sm font-medium">{copy.dashboardPage.searchLabel}</Label>
            <Input
              id="course-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={copy.dashboardPage.searchPlaceholder}
              className="h-12 rounded-xl"
            />
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium">{copy.dashboardPage.filtersLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">{displayedCourses.length} course{displayedCourses.length === 1 ? "" : "s"} match your current filters.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "available", "enrolled", "completed"] as EnrollmentFilter[]).map((filterValue) => (
                <Button
                  key={filterValue}
                  type="button"
                  variant={enrollmentFilter === filterValue ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setEnrollmentFilter(filterValue)}
                >
                  {copy.dashboardPage.filters[filterValue]}
                </Button>
              ))}
            </div>
          </div>

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
                      {copy.actions.retryEnrollment}
                    </Button>
                  ) : null}
                  {enrollmentRecovery.feedback.suggestedActions.includes("profile") ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/profile">{copy.actions.updateProfile}</Link>
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setEnrollmentRecovery(null)}>
                    {copy.actions.dismiss}
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {renderCourseGrid()}

        <div className="rounded-[1.8rem] bg-primary px-6 py-10 text-primary-foreground">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">{copy.dashboardPage.certificatesTitle}</h2>
              <p className="mt-3 text-primary-foreground/80">
                {copy.dashboardPage.certificatesBody}
              </p>
            </div>
            <Button asChild variant="secondary" className="rounded-xl bg-white text-primary hover:bg-white/90">
              <Link to="/certificates">{copy.actions.viewCertificates}</Link>
            </Button>
          </div>
        </div>

        {renderPreviewDialog()}
      </div>
    </DashboardLayout>
  );
};

export default Courses;