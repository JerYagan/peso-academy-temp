import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BookOpen,
  Clock,
  Users,
  Star,
  Award,
  ChevronRight,
  CheckCircle2,
  Circle,
  Play,
  FileText,
  Upload,
  LogOut,
  AlertCircle,
  Lock,
} from "lucide-react";
import TraineeVerificationBadge from "@/components/trainee/TraineeVerificationBadge";
import { canUserViewCourse } from "@/lib/courseAudience";
import { getOfficialHoursCreditLabel } from "@/lib/courseDuration";
import { canAccessModuleEntry, getBlockingModules, getRequiredModuleIds } from "@/lib/moduleProgress";
import {
  courseService,
  enrollmentService,
  getEnrollmentErrorFeedback,
  getTraineeEnrollmentVerificationFeedback,
  isTraineeEnrollmentBlocked,
  moduleService,
  moduleCompletionService,
} from "@/services/supabaseDatabaseService";
import AssessmentInterface from "@/components/course/AssessmentInterface";
import { Course, Module, Enrollment, EnrollmentAssessmentProgress, EnrollmentProgressDetail } from "@/types";
import { toast } from "sonner";
import ModuleContentViewer from "@/components/course/ModuleContentViewer";
import DocumentViewer from "@/components/course/DocumentViewer";
import CourseMaterialImage from "@/components/course/CourseMaterialImage";

const COURSE_PREVIEW_STORAGE_PREFIX = "peso-course-preview:";

const buildSidebarFallbackLabel = (title: string, fallback: string) => {
  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return fallback;
  }

  return words.map((word) => word[0]?.toUpperCase() || "").join("") || fallback;
};

const CourseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { language } = useLocale();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [progressDetail, setProgressDetail] = useState<EnrollmentProgressDetail | null>(null);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [loadingSelectedModuleId, setLoadingSelectedModuleId] = useState<string | null>(null);
  const [completedModuleIds, setCompletedModuleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showUnenrollConfirm, setShowUnenrollConfirm] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [practiceQuizState, setPracticeQuizState] = useState<{ canRetry: boolean; retry: (() => void) | null }>({ canRetry: false, retry: null });
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(null);
  const [enrollmentRecovery, setEnrollmentRecovery] = useState<ReturnType<typeof getEnrollmentErrorFeedback> | null>(null);
  const previewKey = searchParams.get("previewKey");
  const isPreviewMode = Boolean(searchParams.get("preview") && previewKey);
  const previewEnrollmentId = `preview-enrollment-${id || "course"}`;
  const locationState = location.state as { entrySource?: string; moduleId?: string } | null;
  const moduleRequestSequenceRef = useRef(0);
  const modulesListRef = useRef<HTMLDivElement | null>(null);

  const moduleEntrySource = (() => {
    if (typeof locationState?.entrySource === "string" && locationState.entrySource.trim()) {
      return locationState.entrySource;
    }

    if (isPreviewMode) {
      return "course_preview";
    }

    return "course_detail";
  })();

  const requestedModuleId =
    typeof locationState?.moduleId === "string" && locationState.moduleId.trim()
      ? locationState.moduleId
      : null;
  const verificationBlocked = isTraineeEnrollmentBlocked(user);
  const verificationFeedback = verificationBlocked
    ? getTraineeEnrollmentVerificationFeedback(user?.verificationStatus, course?.title)
    : null;
  const copy = language === "tl"
    ? {
        loadingCourse: "Ikinakarga ang kurso...",
        courseNotFound: "Hindi makita ang kurso",
        backToCourses: "Bumalik sa Mga Kurso",
        backToCatalog: "Bumalik sa Course Catalog",
        previewMode: "Preview Mode",
        previewBodyDraft: "Ito ay trainee-style preview ng kasalukuyang draft ng kurso.",
        previewBodyLocal: "Ginagamit ng preview na ito ang parehong learner course layout habang lokal lang sa tab na ito ang progress changes.",
        draftPreview: "Draft Preview",
        enrolledCount: (count: number) => `${count ?? 0} enrolled`,
        assignedTrainer: (role: string, name: string) => `Assigned ${role.toLowerCase()}: ${name}`,
        modulesTitle: (count: number) => `Mga Module (${count})`,
        retryEnrollment: "Subukan muli ang enrollment",
        updateProfile: "I-update ang profile",
        reviewProfile: "Suriin ang profile",
        dismiss: "Isara",
        enrolling: "Nag-e-enroll...",
        enrollInCourse: "Mag-enroll sa kursong ito",
        createAccount: "Gumawa ng Account para Mag-enroll",
        unenroll: "Mag-alis ng enrollment sa kursong ito",
        progressTitle: "Iyong Progreso",
        modulesCompleted: (done: number, total: number) => `${done} sa ${total} module ang tapos na`,
        learningTimeNote: "Hiwalay na tina-track ang iyong aktuwal na oras ng pag-aaral mula sa opisyal na course hours na kino-credit matapos ang trainer approval.",
        approvalNote: "Tapos na ang course requirements. Kailangan pa ring aprubahan ng iyong trainer ang completion bago mailabas ang anumang certificate.",
        assessmentActivitiesTitle: "Mga Graded Assessment",
        gradedAssessmentLabel: "Graded Assessment",
        assessmentSidebarTitle: "Assessment Activities",
        assessmentActivitiesDescription: "Hiwalay ang graded assessments sa module content. Kumpletuhin ang mga prerequisite modules para ma-unlock ang bawat activity.",
        noAssessmentActivities: "Wala pang graded assessment para sa kursong ito.",
        assessmentReady: "Handa na",
        assessmentLocked: "Naka-lock",
        assessmentSubmitted: "Naipasa na",
        assessmentNeedsReview: "Hinihintay ang review",
        assessmentNeedsRevision: "May follow-up",
        assessmentApproved: "Aprubado",
        courseAssessment: "Course assessment",
        moduleAssessment: (title: string) => `Assessment para sa ${title}`,
        lockedAssessmentMessage: (names: string) => `Tapusin muna ang mga module na ito para ma-unlock ang assessment: ${names}`,
        assessmentPanelTitle: "Assessment Activity",
        assessmentPanelDescription: "Kumpletuhin ang graded assessment na ito nang hiwalay sa practice quizzes sa module content.",
        nextModule: "Susunod na Module",
        backToModules: "Bumalik sa Mga Module",
        nextModuleHint: (title: string) => `Magpatuloy sa ${title} kapag handa ka na.`,
        noNextModuleHint: "Wala nang accessible na susunod na module ngayon. Bumalik sa module list o tapusin ang naka-lock na prerequisites.",
        modulesCardTitle: "Mga Module",
        modulesCardDescription: (count: number) => `${count} modules sa kursong ito`,
        moduleLabel: (index: number) => `Module ${index + 1}`,
        locked: "Naka-lock",
        completeEarlier: (count: number, names: string) => `Tapusin muna ang naunang module${count === 1 ? "" : "s"}: ${names}`,
        loadingModule: "Ikinakarga ang module...",
        selectModule: "Pumili ng module para magsimulang mag-aral",
        noContent: "Walang available na course content",
        completionTitle: "Handa na ang Kurso para sa Review",
        completionBody: "Kumpleto na ang iyong course requirements. Kailangan pa ring aprubahan ng trainer ang completion, at manu-manong inilalabas ang certificates pagkatapos ng approval.",
        returnDashboard: "Bumalik sa dashboard",
        stayOnCourse: "Manatili sa kurso",
        unenrollTitle: "Mag-alis ng enrollment sa kurso?",
        unenrollBody: "Aalisin ka sa kursong ito at mawawala ang iyong progreso. Maaari kang mag-enroll muli sa susunod.",
        cancel: "Kanselahin",
        unenrolling: "Ina-unenroll...",
        unenrollAction: "Unenroll",
        blockedRejected: "Tinanggihan ang verification",
        blockedPending: "Naghihintay ng verification",
      }
    : {
        loadingCourse: "Loading course...",
        courseNotFound: "Course not found",
        backToCourses: "Back to Courses",
        backToCatalog: "Back to Course Catalog",
        previewMode: "Preview Mode",
        previewBodyDraft: "This is a trainee-style preview of the current course draft.",
        previewBodyLocal: "This preview uses the same learner course layout while keeping progress changes local to this tab.",
        draftPreview: "Draft Preview",
        enrolledCount: (count: number) => `${count ?? 0} enrolled`,
        assignedTrainer: (role: string, name: string) => `Assigned ${role.toLowerCase()}: ${name}`,
        modulesTitle: (count: number) => `Modules (${count})`,
        retryEnrollment: "Retry enrollment",
        updateProfile: "Update profile",
        reviewProfile: "Review profile",
        dismiss: "Dismiss",
        enrolling: "Enrolling...",
        enrollInCourse: "Enroll in this course",
        createAccount: "Create Account to Enroll",
        unenroll: "Unenroll from course",
        progressTitle: "Your Progress",
        modulesCompleted: (done: number, total: number) => `${done} of ${total} modules completed`,
        learningTimeNote: "Your actual study time is tracked separately from the official course hours credited after trainer approval.",
        approvalNote: "Course requirements are complete. Your trainer still needs to approve completion before any certificate can be released.",
        assessmentActivitiesTitle: "Graded Assessments",
        gradedAssessmentLabel: "Graded Assessment",
        assessmentSidebarTitle: "Assessment Activities",
        assessmentActivitiesDescription: "Graded assessments live outside module content. Complete the required prerequisite modules to unlock each activity.",
        noAssessmentActivities: "No graded assessment activities are configured for this course yet.",
        assessmentReady: "Ready",
        assessmentLocked: "Locked",
        assessmentSubmitted: "Submitted",
        assessmentNeedsReview: "Awaiting review",
        assessmentNeedsRevision: "Needs follow-up",
        assessmentApproved: "Approved",
        courseAssessment: "Course assessment",
        moduleAssessment: (title: string) => `${title} assessment`,
        lockedAssessmentMessage: (names: string) => `Complete these modules to unlock this assessment: ${names}`,
        assessmentPanelTitle: "Assessment Activity",
        assessmentPanelDescription: "Complete this graded assessment separately from the practice quizzes inside module content.",
        nextModule: "Next Module",
        backToModules: "Back to Modules",
        nextModuleHint: (title: string) => `Continue into ${title} when you are ready.`,
        noNextModuleHint: "There is no next accessible module right now. Return to the module list or complete the locked prerequisites first.",
        modulesCardTitle: "Modules",
        modulesCardDescription: (count: number) => `${count} modules in this course`,
        moduleLabel: (index: number) => `Module ${index + 1}`,
        locked: "Locked",
        completeEarlier: (count: number, names: string) => `Complete earlier module${count === 1 ? "" : "s"} first: ${names}`,
        loadingModule: "Loading module...",
        selectModule: "Select a module to start learning",
        noContent: "No course content available",
        completionTitle: "Course Ready For Review",
        completionBody: "Your course requirements are complete. A trainer still needs to approve completion, and certificates are released manually after approval.",
        returnDashboard: "Return to dashboard",
        stayOnCourse: "Stay on course",
        unenrollTitle: "Unenroll from course?",
        unenrollBody: "You will be removed from this course and your progress will be lost. You can enroll again later.",
        cancel: "Cancel",
        unenrolling: "Unenrolling...",
        unenrollAction: "Unenroll",
        blockedRejected: "Verification rejected",
        blockedPending: "Awaiting verification",
      };
  const blockedEnrollLabel = user?.verificationStatus === "rejected"
    ? copy.blockedRejected
    : copy.blockedPending;

  function getPreferredModule(
    moduleList: Module[],
    completedIds: string[],
    preferredModuleId?: string | null,
  ): Module | null {
    if (moduleList.length === 0) {
      return null;
    }

    if (preferredModuleId) {
      const preferredModule = moduleList.find((module) => module.id === preferredModuleId) || null;
      if (preferredModule && canAccessModuleEntry(preferredModule, moduleList, completedIds)) {
        return preferredModule;
      }
    }

    return moduleList.find((module) => canAccessModuleEntry(module, moduleList, completedIds)) || moduleList[0] || null;
  }

  const refreshEnrollmentState = async (
    enrollmentId: string,
    options?: { openCompletionDialog?: boolean },
  ) => {
    if (!user) {
      return null;
    }

    const [enrollments, completed, detail] = await Promise.all([
      enrollmentService.getEnrollments(user.id),
      moduleCompletionService.getCompletedModules(enrollmentId),
      enrollmentService.getEnrollmentProgressDetail(enrollmentId).catch(() => null),
    ]);

    const updatedEnrollment = enrollments.find((candidate) => candidate.id === enrollmentId) || null;
    setCompletedModuleIds(completed);
    setProgressDetail(detail);

    if (updatedEnrollment) {
      setEnrollment(updatedEnrollment);
      if (options?.openCompletionDialog && updatedEnrollment.completionApprovalStatus === "pending") {
        setShowCompletionDialog(true);
      }
    }

    return updatedEnrollment;
  };

  useEffect(() => {
    if (id) {
      void loadCourseData();
    }
  }, [id, user, isPreviewMode, previewKey, requestedModuleId]);

  const loadModuleContent = async (moduleId: string): Promise<Module | null> => {
    setLoadingSelectedModuleId(moduleId);
    const requestSequence = moduleRequestSequenceRef.current + 1;
    moduleRequestSequenceRef.current = requestSequence;

    try {
      const module = await moduleService.getModule(moduleId);
      if (moduleRequestSequenceRef.current !== requestSequence) {
        return null;
      }

      return module;
    } finally {
      if (moduleRequestSequenceRef.current === requestSequence) {
        setLoadingSelectedModuleId(null);
      }
    }
  };

  const loadCourseData = async () => {
    if (!id) return;

    setLoading(true);
    try {
      let courseData: Course | null = null;
      let modulesSourceCourseId: string | null = id;

      if (isPreviewMode && typeof window !== "undefined" && previewKey) {
        const rawPreview =
          window.sessionStorage.getItem(previewKey) ||
          window.localStorage.getItem(`${COURSE_PREVIEW_STORAGE_PREFIX}${previewKey}`);

        if (rawPreview) {
          const previewData = JSON.parse(rawPreview) as Partial<Course> & {
            previewSourceCourseId?: string | null;
          };

          courseData = {
            id: previewData.id || id,
            title: previewData.title || "Course Preview",
            description: previewData.description || "",
            category: previewData.category || "Digital Skills",
            level: previewData.level || "Beginner",
            duration: previewData.duration || 0,
            instructor: previewData.instructor || "",
            instructorId: previewData.instructorId || "",
            assignedTrainer: previewData.assignedTrainer || {
              id: previewData.instructorId || null,
              displayName: previewData.instructor || "PESO Training Team",
              roleLabel: "Trainer",
            },
            thumbnail: previewData.thumbnail,
            courseDocument: previewData.courseDocument,
            isTESDAAccredited: previewData.isTESDAAccredited || false,
            skills: previewData.skills || [],
            enrolledCount: previewData.enrolledCount || 0,
            rating: previewData.rating || 0,
            createdAt: previewData.createdAt || new Date().toISOString(),
            published: previewData.published,
          };
          modulesSourceCourseId = previewData.previewSourceCourseId || (id !== "__preview__" ? id : null);
        }
      }

      if (!courseData) {
        courseData = await courseService.getCourse(id);
      }

      if (!courseData) {
        toast.error("Course not found");
        navigate("/courses");
        return;
      }

      if (!isPreviewMode && !canUserViewCourse(courseData, user)) {
        toast.error("Course not found");
        navigate("/courses");
        return;
      }

      setCourse(courseData);

      const [modulesData, enrollments] = await Promise.all([
        modulesSourceCourseId ? moduleService.getModulesByCourseSummary(modulesSourceCourseId) : Promise.resolve([]),
        !isPreviewMode && user ? enrollmentService.getEnrollments(user.id) : Promise.resolve([]),
      ]);
      setModules(modulesData);

      const initialModule = requestedModuleId
        ? modulesData.find((module) => module.id === requestedModuleId) || modulesData[0] || null
        : modulesData[0] || null;

      if (isPreviewMode) {
        const previewTargetModule = getPreferredModule(modulesData, [], requestedModuleId);
        setEnrollment({
          id: previewEnrollmentId,
          userId: user?.id || "preview-user",
          courseId: courseData.id,
          progress: 0,
          status: "enrolled",
          enrolledAt: new Date().toISOString(),
        });
        setProgressDetail(null);
        setSelectedModule(previewTargetModule);
        setCompletedModuleIds([]);

        if (previewTargetModule) {
          void loadModuleContent(previewTargetModule.id).then((hydratedModule) => {
            if (hydratedModule) {
              setSelectedModule(hydratedModule);
            }
          });
        }
        return;
      }

      if (!user) {
        setEnrollment(null);
        setProgressDetail(null);
        setSelectedModule(initialModule);
        setLoading(false);
        return;
      }

      const userEnrollment = enrollments.find((e) => e.courseId === id);
      
      if (!userEnrollment) {
        setEnrollment(null);
        setProgressDetail(null);
        setSelectedModule(initialModule);
        setLoading(false);
        return;
      }

      setEnrollment(userEnrollment);

      const [completed, detail] = await Promise.all([
        moduleCompletionService.getCompletedModules(userEnrollment.id),
        enrollmentService.getEnrollmentProgressDetail(userEnrollment.id).catch(() => null),
      ]);
      const preferredModule = getPreferredModule(modulesData, completed, requestedModuleId);
      setCompletedModuleIds(completed);
      setProgressDetail(detail);
      setSelectedModule(preferredModule);

      if (preferredModule) {
        void loadModuleContent(preferredModule.id).then((hydratedModule) => {
          if (hydratedModule) {
            setSelectedModule(hydratedModule);
          }
        });
      }
    } catch (error) {
      console.error("Error loading course data:", error);
      toast.error("Failed to load course data");
    } finally {
      setLoading(false);
    }
  };

  const handleModuleSelect = async (module: Module) => {
    if (!canAccessModuleEntry(module, modules, completedModuleIds)) {
      const blockingModules = getBlockingModules(module, modules, completedModuleIds);
      toast.info(
        blockingModules.length > 0
          ? `Complete ${blockingModules[0].title} before opening ${module.title}.`
          : "Finish the earlier modules in sequence before opening this module.",
      );
      return;
    }

    if (selectedModule?.id === module.id) {
      setSelectedModule(module);
      return;
    }

    setSelectedModule(module);
    const hydratedModule = await loadModuleContent(module.id);
    if (hydratedModule) {
      setSelectedModule(hydratedModule);
    }
  };

  const handleModuleComplete = async (moduleId: string, timeSpentMinutes?: number, options?: { silent?: boolean }) => {
    if (!enrollment) return;

    if (isPreviewMode) {
      if (completedModuleIds.includes(moduleId)) return;

      const newCompleted = [...completedModuleIds, moduleId];
      const previewProgress = modules.length > 0
        ? Math.round((newCompleted.length / modules.length) * 100)
        : 0;

      setCompletedModuleIds(newCompleted);
      setEnrollment((current) =>
        current
          ? {
              ...current,
              progress: previewProgress,
              status: newCompleted.length >= modules.length ? "completed" : "in-progress",
              completedAt: newCompleted.length >= modules.length ? new Date().toISOString() : current.completedAt,
            }
          : current,
      );

      if (!options?.silent) {
        toast.success("Preview progress updated");
      }
      if (modules.length > 0 && newCompleted.length >= modules.length) {
        setShowCompletionDialog(true);
      }
      return;
    }

    if (!user) return;

    try {
      await moduleCompletionService.markModuleComplete(
        enrollment.id,
        moduleId,
        timeSpentMinutes
      );
      const newCompleted = [...completedModuleIds, moduleId];
      setCompletedModuleIds(newCompleted);
      const updatedEnrollment = await refreshEnrollmentState(enrollment.id, { openCompletionDialog: true });

      if (!options?.silent) {
        toast.success("Module progress updated.");
      }
    } catch (error) {
      console.error("Error completing module:", error);
      toast.error("Failed to mark module as complete");
    }
  };

  const handleUnenroll = async () => {
    if (!enrollment) return;
    setUnenrolling(true);
    try {
      await enrollmentService.unenroll(enrollment.id, false);
      toast.success("You have been unenrolled from this course.");
      setShowUnenrollConfirm(false);
      navigate("/courses");
    } catch (error) {
      console.error("Error unenrolling:", error);
      toast.error("Failed to unenroll. Please try again.");
    } finally {
      setUnenrolling(false);
    }
  };

  const isModuleCompleted = (moduleId: string) => {
    return completedModuleIds.includes(moduleId);
  };

  const canAccessModule = (module: Module) => {
    return canAccessModuleEntry(module, modules, completedModuleIds);
  };

  const moduleLookup = useMemo(
    () => new Map(modules.map((module) => [module.id, module])),
    [modules],
  );

  const assessmentActivities = useMemo(
    () => [...(progressDetail?.assessments || [])].sort((left, right) => {
      const leftOrder = left.moduleId ? (moduleLookup.get(left.moduleId)?.order || Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER - 1;
      const rightOrder = right.moduleId ? (moduleLookup.get(right.moduleId)?.order || Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER - 1;
      return leftOrder - rightOrder || left.assessmentTitle.localeCompare(right.assessmentTitle);
    }),
    [moduleLookup, progressDetail?.assessments],
  );

  const isAssessmentUnlocked = (assessment: EnrollmentAssessmentProgress) =>
    (assessment.prerequisiteModuleIds || []).every((requiredId) => completedModuleIds.includes(requiredId));

  const activeAssessment = assessmentActivities.find((assessment) => assessment.assessmentId === activeAssessmentId) || null;

  useEffect(() => {
    if (assessmentActivities.length === 0) {
      setActiveAssessmentId(null);
      return;
    }

    setActiveAssessmentId((current) => {
      if (current && assessmentActivities.some((assessment) => assessment.assessmentId === current)) {
        return current;
      }

      const preferredAssessment = assessmentActivities.find((assessment) => isAssessmentUnlocked(assessment) && !assessment.submittedAt)
        || assessmentActivities.find((assessment) => isAssessmentUnlocked(assessment))
        || assessmentActivities[0];

      return preferredAssessment.assessmentId;
    });
  }, [assessmentActivities, completedModuleIds]);

  const sortedModules = useMemo(
    () => [...modules].sort((left, right) => left.order - right.order),
    [modules],
  );

  const nextAccessibleModule = useMemo(() => {
    if (!selectedModule) {
      return null;
    }

    const currentIndex = sortedModules.findIndex((module) => module.id === selectedModule.id);
    if (currentIndex < 0) {
      return null;
    }

    for (let index = currentIndex + 1; index < sortedModules.length; index += 1) {
      if (canAccessModuleEntry(sortedModules[index], sortedModules, completedModuleIds)) {
        return sortedModules[index];
      }
    }

    return null;
  }, [completedModuleIds, selectedModule, sortedModules]);

  const handleAssessmentRefresh = async () => {
    if (!enrollment) {
      return;
    }

    try {
      await refreshEnrollmentState(enrollment.id, { openCompletionDialog: true });
    } catch (error) {
      console.error("Error refreshing enrollment after assessment submission:", error);
    }
  };

  const handleBackToModules = () => {
    modulesListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleAssessmentSelect = (assessment: EnrollmentAssessmentProgress) => {
    if (!isAssessmentUnlocked(assessment)) {
      return;
    }

    setActiveAssessmentId(assessment.assessmentId);
    setSelectedModule(null);
  };

  const getAssessmentStatusBadge = (assessment: EnrollmentAssessmentProgress) => {
    const hasFinalApproval = assessment.reviewStatus === "approved" && Boolean(assessment.reviewedAt || assessment.reviewedBy);

    if (!isAssessmentUnlocked(assessment)) {
      return <Badge variant="outline">{copy.assessmentLocked}</Badge>;
    }

    if (hasFinalApproval) {
      return <Badge>{copy.assessmentApproved}</Badge>;
    }

    if (assessment.reviewStatus === "needs_revision") {
      return <Badge variant="outline">{copy.assessmentNeedsRevision}</Badge>;
    }

    if (assessment.submittedAt) {
      return <Badge variant="secondary">{copy.assessmentSubmitted}</Badge>;
    }

    return <Badge>{copy.assessmentReady}</Badge>;
  };

  const getAssessmentSidebarIcon = (assessment: EnrollmentAssessmentProgress, isSelected: boolean) => {
    const hasFinalApproval = assessment.reviewStatus === "approved" && Boolean(assessment.reviewedAt || assessment.reviewedBy);

    if (!isAssessmentUnlocked(assessment)) {
      return <Lock className={`h-5 w-5 ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`} />;
    }

    if (hasFinalApproval) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }

    return <Circle className={`h-5 w-5 ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`} />;
  };

  const handleEnrollInCourse = async () => {
    if (!id || !user) return;
    setEnrolling(true);
    setEnrollmentRecovery(null);
    try {
      await enrollmentService.enrollInCourse(user.id, id);
      toast.success("You are now enrolled!");
      await loadCourseData();
    } catch (error) {
      console.error("Error enrolling:", error);
      const feedback = getEnrollmentErrorFeedback(error, course?.title);
      if (feedback.code === "already_enrolled") {
        await loadCourseData();
      }
      setEnrollmentRecovery(feedback);
      toast.error(feedback.toastMessage);
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">{copy.loadingCourse}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!course) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{copy.courseNotFound}</p>
            <Button asChild className="mt-4">
              <Link to="/courses">{copy.backToCourses}</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const assignedTrainerName = course.assignedTrainer?.displayName || course.instructor || "PESO Training Team";
  const assignedTrainerRoleLabel = course.assignedTrainer?.roleLabel || "Trainer";

  // Course description view: not enrolled (guest or logged-in)
  if (!enrollment) {
    const signupUrl = `/signup?redirect=${encodeURIComponent(`/courses/${id}`)}`;
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {isPreviewMode && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium">{copy.previewMode}</p>
                  <p className="text-sm text-muted-foreground">{copy.previewBodyDraft}</p>
                </div>
                <Badge variant="outline">{copy.draftPreview}</Badge>
              </CardContent>
            </Card>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link to="/courses">
              <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
              {copy.backToCourses}
            </Link>
          </Button>
          <Card>
            <CardHeader>
              <h1 className="text-3xl font-bold">{course.title}</h1>
              <CardDescription>{course.description}</CardDescription>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Badge variant={course.isTESDAAccredited ? "default" : "secondary"}>
                  {course.isTESDAAccredited && <Award className="w-3 h-3 mr-1" />}
                  {course.category}
                </Badge>
                <Badge variant="outline">{course.level}</Badge>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {getOfficialHoursCreditLabel(course.duration)}
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {copy.enrolledCount(course.enrolledCount ?? 0)}
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {copy.assignedTrainer(assignedTrainerRoleLabel, assignedTrainerName)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {course.thumbnail && (
                <div className="overflow-hidden rounded-xl border bg-muted">
                  <CourseMaterialImage
                    src={course.thumbnail}
                    alt={course.title}
                    className="h-64 w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              {modules.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">{copy.modulesTitle(modules.length)}</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {modules.map((m, i) => (
                      <li key={m.id}>
                        {i + 1}. {m.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {enrollmentRecovery ? (
                <Alert variant={enrollmentRecovery.code === "unknown" ? "destructive" : "default"}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{enrollmentRecovery.title}</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-3">
                      <p>{enrollmentRecovery.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {enrollmentRecovery.canRetry ? (
                          <Button size="sm" onClick={() => void handleEnrollInCourse()} disabled={enrolling}>
                            {copy.retryEnrollment}
                          </Button>
                        ) : null}
                        {enrollmentRecovery.suggestedActions.includes("profile") ? (
                          <Button asChild size="sm" variant="outline">
                            <Link to="/profile">{copy.updateProfile}</Link>
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => setEnrollmentRecovery(null)}>
                          {copy.dismiss}
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}
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
                      <Button asChild size="sm" variant="outline">
                        <Link to="/profile">{copy.reviewProfile}</Link>
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-3">
                {isPreviewMode ? null : user ? (
                  <Button onClick={handleEnrollInCourse} disabled={enrolling || verificationBlocked}>
                    {verificationBlocked ? blockedEnrollLabel : enrolling ? copy.enrolling : copy.enrollInCourse}
                  </Button>
                ) : (
                  <Button asChild>
                    <Link to={signupUrl}>{copy.createAccount}</Link>
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link to="/courses">{copy.backToCatalog}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {isPreviewMode && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-medium">{copy.previewMode}</p>
                <p className="text-sm text-muted-foreground">{copy.previewBodyLocal}</p>
              </div>
              <Badge variant="outline">{copy.draftPreview}</Badge>
            </CardContent>
          </Card>
        )}

        {/* Course Header */}
        <div className="space-y-4">
          {course.thumbnail && (
            <div className="overflow-hidden rounded-2xl border bg-muted shadow-sm">
              <CourseMaterialImage
                src={course.thumbnail}
                alt={course.title}
                className="h-64 w-full object-cover lg:h-80"
                loading="lazy"
              />
            </div>
          )}

          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/courses">
                    <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
                    {copy.backToCourses}
                  </Link>
                </Button>
              </div>
              <h1 className="text-3xl font-bold">{course.title}</h1>
              <p className="text-muted-foreground">{course.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Badge variant={course.isTESDAAccredited ? "default" : "secondary"}>
              {course.isTESDAAccredited && <Award className="w-3 h-3 mr-1" />}
              {course.category}
            </Badge>
            <Badge variant="outline">{course.level}</Badge>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {getOfficialHoursCreditLabel(course.duration)}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {copy.enrolledCount(course.enrolledCount)}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {copy.assignedTrainer(assignedTrainerRoleLabel, assignedTrainerName)}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              {course.rating}
            </div>
            {!isPreviewMode && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground hover:text-destructive"
                onClick={() => setShowUnenrollConfirm(true)}
              >
                <LogOut className="w-4 h-4 mr-1" />
                {copy.unenroll}
              </Button>
            )}
          </div>

          {/* Progress Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{copy.progressTitle}</CardTitle>
                <span className="text-sm font-medium">{enrollment.progress}%</span>
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={enrollment.progress} className="mb-2" />
              <p className="text-sm text-muted-foreground">
                {copy.modulesCompleted(completedModuleIds.length, modules.length)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {copy.learningTimeNote}
              </p>
              {enrollment.completionApprovalStatus === "pending" ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {copy.approvalNote}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Modules Sidebar */}
          <div ref={modulesListRef} className="lg:col-span-1 lg:self-start lg:sticky lg:top-24">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{copy.modulesCardTitle}</CardTitle>
                <CardDescription>{copy.modulesCardDescription(modules.length)}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[420px] lg:h-[calc(100vh-12rem)]">
                  <div className="p-4 space-y-1">
                    {modules.map((module, index) => {
                      const completed = isModuleCompleted(module.id);
                      const canAccess = canAccessModule(module);
                      const isSelected = selectedModule?.id === module.id;
                      const blockingModules = getBlockingModules(module, modules, completedModuleIds);

                      return (
                        <button
                          key={module.id}
                          onClick={() => {
                            if (canAccess) {
                              void handleModuleSelect(module);
                            }
                          }}
                          disabled={!canAccess}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : canAccess
                              ? "hover:bg-accent"
                              : "opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1 shrink-0">
                              {completed ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <Circle className="w-5 h-5" />
                              )}
                            </div>
                            <div className="shrink-0 overflow-hidden rounded-md border bg-muted/60">
                              {module.module_thumbnail ? (
                                <img src={module.module_thumbnail} alt={module.title} className="h-12 w-16 object-cover" />
                              ) : (
                                <div className="flex h-12 w-16 items-center justify-center bg-muted text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                  {buildSidebarFallbackLabel(module.title, "M")}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium opacity-70">
                                  {copy.moduleLabel(index)}
                                </span>
                                {!canAccess && (
                                  <Badge variant="outline" className="text-xs">
                                    {copy.locked}
                                  </Badge>
                                )}
                              </div>
                              <p className={`text-sm font-medium ${isSelected ? "text-primary-foreground" : ""}`}>
                                {module.title}
                              </p>
                              {!canAccess && blockingModules.length > 0 ? (
                                <p className={`mt-1 text-xs ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                  {copy.completeEarlier(blockingModules.length, blockingModules.map((blockingModule) => blockingModule.title).join(", "))}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {assessmentActivities.length > 0 ? (
                      <>
                        <Separator className="my-4" />
                        <div className="px-1 pb-2 pt-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {copy.assessmentSidebarTitle}
                          </p>
                        </div>
                        {assessmentActivities.map((assessment) => {
                          const unlocked = isAssessmentUnlocked(assessment);
                          const isSelected = !selectedModule && activeAssessmentId === assessment.assessmentId;
                          const prerequisiteModules = (assessment.prerequisiteModuleIds || [])
                            .map((moduleId) => moduleLookup.get(moduleId) || null)
                            .filter((candidate): candidate is Module => Boolean(candidate));

                          return (
                            <button
                              key={assessment.assessmentId}
                              type="button"
                              onClick={() => handleAssessmentSelect(assessment)}
                              disabled={!unlocked}
                              className={`w-full rounded-lg p-3 text-left transition-colors ${
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : unlocked
                                    ? "hover:bg-accent"
                                    : "cursor-not-allowed opacity-50"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-1 shrink-0">
                                  {getAssessmentSidebarIcon(assessment, isSelected)}
                                </div>
                                <div className="shrink-0 overflow-hidden rounded-md border bg-muted/60">
                                  {assessment.assessmentThumbnail ? (
                                    <img src={assessment.assessmentThumbnail} alt={assessment.assessmentTitle} className="h-12 w-16 object-cover" />
                                  ) : (
                                    <div className="flex h-12 w-16 items-center justify-center bg-muted text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                      {buildSidebarFallbackLabel(assessment.assessmentTitle, "GA")}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-medium opacity-70">{copy.gradedAssessmentLabel}</span>
                                    {!unlocked ? (
                                      <Badge variant="outline" className="text-xs">
                                        {copy.assessmentLocked}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className={`text-sm font-medium ${isSelected ? "text-primary-foreground" : ""}`}>
                                    {assessment.assessmentTitle}
                                  </p>
                                  {!unlocked ? (
                                    <p className={`mt-1 text-xs ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                      {copy.lockedAssessmentMessage(prerequisiteModules.map((module) => module.title).join(", "))}
                                    </p>
                                  ) : assessment.submittedAt ? (
                                    <p className={`mt-1 text-xs ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                      {assessment.reviewStatus === "approved"
                                        && Boolean(assessment.reviewedAt || assessment.reviewedBy)
                                        ? copy.assessmentApproved
                                        : assessment.reviewStatus === "needs_revision"
                                          ? copy.assessmentNeedsRevision
                                          : copy.assessmentSubmitted}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </>
                    ) : null}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Module Content Area */}
          <div className="lg:col-span-3">
            {loadingSelectedModuleId && selectedModule?.id === loadingSelectedModuleId ? (
              <Card>
                <CardContent className="flex min-h-[400px] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">{copy.loadingModule}</p>
                  </div>
                </CardContent>
              </Card>
            ) : selectedModule ? (
              <div className="space-y-6">
                <ModuleContentViewer
                  module={selectedModule}
                  enrollment={enrollment}
                  isCompleted={isModuleCompleted(selectedModule.id)}
                  isPreviewMode={isPreviewMode}
                  entrySource={moduleEntrySource}
                  onComplete={(timeSpentMinutes, options) => handleModuleComplete(selectedModule.id, timeSpentMinutes, options)}
                  onPracticeQuizStateChange={setPracticeQuizState}
                />

                {course.courseDocument ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Course Document
                      </CardTitle>
                      <CardDescription>
                        {course.title} - Course Material
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DocumentViewer url={course.courseDocument} title={course.title} />
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-foreground">
                        {nextAccessibleModule
                          ? copy.nextModuleHint(nextAccessibleModule.title)
                          : copy.noNextModuleHint}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isModuleCompleted(selectedModule.id)
                          ? "This path follows the next module that is currently accessible from your completed prerequisites."
                          : "Finish this module or return to the module list to continue along the currently accessible learning path."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {practiceQuizState.canRetry && practiceQuizState.retry ? (
                        <Button variant="outline" onClick={() => practiceQuizState.retry?.()}>
                          Retry Quiz
                        </Button>
                      ) : null}
                      {nextAccessibleModule ? (
                        <Button onClick={() => void handleModuleSelect(nextAccessibleModule)}>
                          {copy.nextModule}
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button variant={nextAccessibleModule ? "outline" : "default"} onClick={handleBackToModules}>
                        {copy.backToModules}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : activeAssessment ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{activeAssessment.assessmentTitle}</CardTitle>
                      <CardDescription>{copy.assessmentActivitiesDescription}</CardDescription>
                    </div>
                    {getAssessmentStatusBadge(activeAssessment)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.gradedAssessmentLabel}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{copy.assessmentPanelDescription}</p>
                  </div>
                  {isAssessmentUnlocked(activeAssessment) ? (
                    <AssessmentInterface
                      enrollmentId={enrollment.id}
                      courseId={enrollment.courseId}
                      assessmentId={activeAssessment.assessmentId}
                      emptyStateMessage={copy.noAssessmentActivities}
                      onSubmitted={handleAssessmentRefresh}
                    />
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <div className="flex items-start gap-2">
                        <Lock className="mt-0.5 h-4 w-4" />
                        <p>
                          {copy.lockedAssessmentMessage(
                            (activeAssessment.prerequisiteModuleIds || [])
                              .map((moduleId) => moduleLookup.get(moduleId)?.title || moduleId)
                              .join(", "),
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              course.courseDocument ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Course Document
                    </CardTitle>
                    <CardDescription>
                      {course.title} - Course Material
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DocumentViewer url={course.courseDocument} title={course.title} />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {modules.length > 0 
                        ? copy.selectModule
                        : copy.noContent}
                    </p>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </div>
      </div>

      {/* Congratulations – course completed */}
      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              {copy.completionTitle}
            </DialogTitle>
            <DialogDescription>
              {copy.completionBody}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button asChild>
              <Link to="/dashboard">{copy.returnDashboard}</Link>
            </Button>
            <Button variant="outline" onClick={() => setShowCompletionDialog(false)}>
              {copy.stayOnCourse}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unenroll confirmation */}
      <AlertDialog open={showUnenrollConfirm} onOpenChange={setShowUnenrollConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.unenrollTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.unenrollBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unenrolling}>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenroll}
              disabled={unenrolling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unenrolling ? copy.unenrolling : copy.unenrollAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default CourseDetail;

