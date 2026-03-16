import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { moduleSessionService } from "@/services/moduleSessionService";
import { Course, Module, Enrollment, EnrollmentAssessmentProgress, EnrollmentProgressDetail } from "@/types";
import { toast } from "sonner";
import CourseMaterialImage from "@/components/course/CourseMaterialImage";

const AssessmentInterface = lazy(() => import("@/components/course/AssessmentInterface"));
const ModuleContentViewer = lazy(() => import("@/components/course/ModuleContentViewer"));
const DocumentViewer = lazy(() => import("@/components/course/DocumentViewer"));

const COURSE_PREVIEW_STORAGE_PREFIX = "peso-course-preview:";
const COURSE_RESUME_STORAGE_PREFIX = "peso-course-resume:";

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

const CoursePanelLoadingState = ({ label }: { label: string }) => (
  <Card>
    <CardContent className="flex min-h-[240px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  </Card>
);

const areStringArraysEqual = (left: string[] = [], right: string[] = []) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
};

const mergeSelectedModuleState = (nextModule: Module | null, currentModule: Module | null): Module | null => {
  if (!nextModule || !currentModule || nextModule.id !== currentModule.id) {
    return nextModule;
  }

  const mergedModule: Module = {
    ...currentModule,
    ...nextModule,
    content: currentModule.content ?? nextModule.content,
    module_document: currentModule.module_document ?? nextModule.module_document,
    module_thumbnail: currentModule.module_thumbnail ?? nextModule.module_thumbnail,
  };

  if (
    mergedModule.title === currentModule.title
    && mergedModule.description === currentModule.description
    && mergedModule.order === currentModule.order
    && mergedModule.status === currentModule.status
    && mergedModule.created_at === currentModule.created_at
    && mergedModule.updated_at === currentModule.updated_at
    && mergedModule.content === currentModule.content
    && mergedModule.module_document === currentModule.module_document
    && mergedModule.module_thumbnail === currentModule.module_thumbnail
    && areStringArraysEqual(mergedModule.materials, currentModule.materials)
    && areStringArraysEqual(mergedModule.prerequisites, currentModule.prerequisites)
  ) {
    return currentModule;
  }

  return mergedModule;
};

const mergeModuleListState = (nextModules: Module[], currentModules: Module[]) => {
  const currentModuleMap = new Map(currentModules.map((module) => [module.id, module]));

  return nextModules.map((module) => mergeSelectedModuleState(module, currentModuleMap.get(module.id) || null) || module);
};

const SelectedModulePanel = memo(({
  selectedModule,
  loadingSelectedModuleId,
  enrollment,
  isPreviewMode,
  moduleEntrySource,
  onComplete,
  onPracticeQuizStateChange,
  onCompletionActionStateChange,
  isModuleCompleted,
  courseDocument,
  courseTitle,
  copy,
  shouldShowCompletionAction,
  moduleCompletionAction,
  nextAccessibleModule,
  onBackToModules,
  onSelectNextModule,
  practiceQuizState,
}: {
  selectedModule: Module;
  loadingSelectedModuleId: string | null;
  enrollment: Pick<Enrollment, "id" | "courseId">;
  isPreviewMode: boolean;
  moduleEntrySource: string;
  onComplete: (timeSpentMinutes?: number, options?: { silent?: boolean; practiceQuizSnapshot?: import("@/types").PracticeQuizCompletionSnapshot }) => void | Promise<void>;
  onPracticeQuizStateChange: (state: { canRetry: boolean; retry: (() => void) | null }) => void;
  onCompletionActionStateChange: (state: {
    canComplete: boolean;
    isCompleting: boolean;
    complete: (() => void) | null;
    blockedReason?: string | null;
  }) => void;
  isModuleCompleted: (moduleId: string) => boolean;
  courseDocument?: string;
  courseTitle: string;
  copy: ReturnType<typeof buildCourseDetailCopy>;
  shouldShowCompletionAction: boolean;
  moduleCompletionAction: {
    canComplete: boolean;
    isCompleting: boolean;
    complete: (() => void) | null;
    blockedReason?: string | null;
  };
  nextAccessibleModule: Module | null;
  onBackToModules: () => void;
  onSelectNextModule: (module: Module) => void;
  practiceQuizState: { canRetry: boolean; retry: (() => void) | null };
}) => (
  <div className="space-y-6">
    <Suspense fallback={<CoursePanelLoadingState label={copy.loadingModule} />}>
      <ModuleContentViewer
        module={selectedModule}
        enrollment={enrollment}
        isCompleted={isModuleCompleted(selectedModule.id)}
        isPreviewMode={isPreviewMode}
        entrySource={moduleEntrySource}
        onComplete={onComplete}
        onPracticeQuizStateChange={onPracticeQuizStateChange}
        onCompletionActionStateChange={onCompletionActionStateChange}
      />
    </Suspense>

    {courseDocument ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Course Document
          </CardTitle>
          <CardDescription>{courseTitle} - Course Material</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<CoursePanelLoadingState label="Loading course document..." />}>
            <DocumentViewer url={courseDocument} title={courseTitle} />
          </Suspense>
        </CardContent>
      </Card>
    ) : null}

    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-medium text-foreground">
              {shouldShowCompletionAction
                ? copy.completeModuleHint
                : nextAccessibleModule
                  ? copy.nextModuleHint(nextAccessibleModule.title)
                  : copy.noNextModuleHint}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {shouldShowCompletionAction ? copy.moduleCompletionFlowHint : copy.completedModuleFlowHint}
            </p>
            {shouldShowCompletionAction && moduleCompletionAction.blockedReason ? (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{moduleCompletionAction.blockedReason}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {practiceQuizState.canRetry && practiceQuizState.retry ? (
              <Button variant="outline" onClick={() => practiceQuizState.retry?.()}>
                Retry Quiz
              </Button>
            ) : null}
            {shouldShowCompletionAction ? (
              <>
                <Button variant="outline" onClick={onBackToModules}>
                  {copy.backToModules}
                </Button>
                <Button onClick={() => moduleCompletionAction.complete?.()} disabled={!moduleCompletionAction.complete || moduleCompletionAction.isCompleting}>
                  {moduleCompletionAction.isCompleting ? copy.savingProgress : copy.markAsComplete}
                </Button>
              </>
            ) : nextAccessibleModule ? (
              <>
                <Button variant="outline" onClick={onBackToModules}>
                  {copy.backToModules}
                </Button>
                <Button onClick={() => onSelectNextModule(nextAccessibleModule)}>
                  {copy.continueToNextModule}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button onClick={onBackToModules}>{copy.backToModules}</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
), (prev, next) => (
  prev.selectedModule === next.selectedModule
  && prev.loadingSelectedModuleId === next.loadingSelectedModuleId
  && prev.enrollment === next.enrollment
  && prev.isPreviewMode === next.isPreviewMode
  && prev.moduleEntrySource === next.moduleEntrySource
  && prev.onComplete === next.onComplete
  && prev.onPracticeQuizStateChange === next.onPracticeQuizStateChange
  && prev.onCompletionActionStateChange === next.onCompletionActionStateChange
  && prev.isModuleCompleted === next.isModuleCompleted
  && prev.courseDocument === next.courseDocument
  && prev.courseTitle === next.courseTitle
  && prev.copy === next.copy
  && prev.shouldShowCompletionAction === next.shouldShowCompletionAction
  && prev.moduleCompletionAction === next.moduleCompletionAction
  && prev.nextAccessibleModule === next.nextAccessibleModule
  && prev.onBackToModules === next.onBackToModules
  && prev.onSelectNextModule === next.onSelectNextModule
  && prev.practiceQuizState === next.practiceQuizState
));

const buildCourseDetailCopy = (language: string) => (
  language === "tl"
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
        continueToNextModule: "Magpatuloy sa Susunod na Module",
        backToModules: "Bumalik sa Mga Module",
        markAsComplete: "Markahan bilang Kumpleto",
        savingProgress: "Sine-save...",
        nextModuleHint: (title: string) => `Magpatuloy sa ${title} kapag handa ka na.`,
        noNextModuleHint: "Wala nang accessible na susunod na module ngayon. Bumalik sa module list o tapusin ang naka-lock na prerequisites.",
        completeModuleHint: "Kapag handa ka nang magpatuloy, markahan ang module na ito bilang kumpleto.",
        moduleCompletionFlowHint: "Mananatiling available ang practice quizzes para sa review. Magpapakita ang footer ng susunod na hakbang kapag nakumpirma na ang completion.",
        completedModuleFlowHint: "Kumpleto na ang module na ito. Maaari ka nang bumalik sa listahan o magpatuloy sa susunod na available na module.",
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
        continueToNextModule: "Continue to Next Module",
        backToModules: "Back to Modules",
        markAsComplete: "Mark as Complete",
        savingProgress: "Saving...",
        nextModuleHint: (title: string) => `Continue into ${title} when you are ready.`,
        noNextModuleHint: "There is no next accessible module right now. Return to the module list or complete the locked prerequisites first.",
        completeModuleHint: "Mark this module complete when you are ready to move forward.",
        moduleCompletionFlowHint: "Practice quizzes stay available for review. The footer action switches to the next available step after completion is confirmed.",
        completedModuleFlowHint: "This module is already complete. You can return to the module list or continue into the next available module.",
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
      }
);

const buildCourseResumeStorageKey = (userId: string, enrollmentId: string, courseId: string) =>
  `${COURSE_RESUME_STORAGE_PREFIX}${userId}:${enrollmentId}:${courseId}`;

const readStoredCourseResumeModuleId = (userId: string, enrollmentId: string, courseId: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(buildCourseResumeStorageKey(userId, enrollmentId, courseId));
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as { moduleId?: string };
    return typeof parsed.moduleId === "string" && parsed.moduleId.trim() ? parsed.moduleId : null;
  } catch {
    return null;
  }
};

const writeStoredCourseResumeModuleId = (userId: string, enrollmentId: string, courseId: string, moduleId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      buildCourseResumeStorageKey(userId, enrollmentId, courseId),
      JSON.stringify({ moduleId, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Ignore storage write failures for resume hints.
  }
};

const clearStoredCourseResumeModuleId = (userId: string, enrollmentId: string, courseId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(buildCourseResumeStorageKey(userId, enrollmentId, courseId));
  } catch {
    // Ignore storage cleanup failures.
  }
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
  const [moduleCompletionAction, setModuleCompletionAction] = useState<{
    canComplete: boolean;
    isCompleting: boolean;
    complete: (() => void) | null;
    blockedReason?: string | null;
  }>({ canComplete: false, isCompleting: false, complete: null, blockedReason: null });
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(null);
  const [enrollmentRecovery, setEnrollmentRecovery] = useState<ReturnType<typeof getEnrollmentErrorFeedback> | null>(null);
  const previewKey = searchParams.get("previewKey");
  const isPreviewMode = Boolean(searchParams.get("preview") && previewKey);
  const previewEnrollmentId = `preview-enrollment-${id || "course"}`;
  const locationState = location.state as { entrySource?: string; moduleId?: string } | null;
  const moduleRequestSequenceRef = useRef(0);
  const courseLoadRequestSequenceRef = useRef(0);
  const modulesListRef = useRef<HTMLDivElement | null>(null);
  const attemptedModuleHydrationIdsRef = useRef<Set<string>>(new Set());
  const courseRef = useRef<Course | null>(null);
  const selectedModuleRef = useRef<Module | null>(null);
  const moduleHydrationAbortControllerRef = useRef<AbortController | null>(null);
  const moduleHydrationRequestRef = useRef<{ moduleId: string; promise: Promise<Module | null> } | null>(null);

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
  const userId = user?.id ?? null;
  const userRole = user?.role ?? null;
  const userTraineeType = user?.traineeType ?? null;
  const userVerificationStatus = user?.verificationStatus ?? null;
  const userLoadKey = useMemo(
    () => (user ? `${user.id}:${user.role}:${user.traineeType ?? "unknown"}:${user.verificationStatus ?? "unknown"}` : "guest"),
    [user?.id, user?.role, user?.traineeType, user?.verificationStatus],
  );
  const verificationBlocked = isTraineeEnrollmentBlocked(user);
  const verificationFeedback = verificationBlocked
    ? getTraineeEnrollmentVerificationFeedback(user?.verificationStatus, course?.title)
    : null;
  const copy = useMemo(() => buildCourseDetailCopy(language), [language]);
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

  const refreshEnrollmentState = useCallback(async (
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
  }, [user]);

  useEffect(() => {
    courseRef.current = course;
  }, [course]);

  useEffect(() => {
    selectedModuleRef.current = selectedModule;
  }, [selectedModule]);

  const loadCourseData = useCallback(async (options?: { preserveUi?: boolean }) => {
    if (!id) return;

    const requestSequence = courseLoadRequestSequenceRef.current + 1;
    courseLoadRequestSequenceRef.current = requestSequence;
    const isLatestRequest = () => courseLoadRequestSequenceRef.current === requestSequence;
    const shouldShowBlockingLoader = !options?.preserveUi && (!courseRef.current || courseRef.current.id !== id);

    if (shouldShowBlockingLoader) {
      setLoading(true);
    }

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

      if (!isLatestRequest()) {
        return;
      }

      if (!courseData) {
        toast.error("Course not found");
        navigate("/courses");
        return;
      }

      if (!isPreviewMode && !canUserViewCourse(courseData, user ? { role: userRole ?? "trainee", traineeType: userTraineeType ?? undefined } : null)) {
        toast.error("Course not found");
        navigate("/courses");
        return;
      }

      if (!isLatestRequest()) {
        return;
      }

      setCourse(courseData);

      const [modulesResult, enrollmentsResult] = await Promise.allSettled([
        modulesSourceCourseId ? moduleService.getModulesByCourseSummary(modulesSourceCourseId) : Promise.resolve([]),
        !isPreviewMode && userId ? enrollmentService.getEnrollments(userId) : Promise.resolve([]),
      ]);

      if (!isLatestRequest()) {
        return;
      }

      if (modulesResult.status !== "fulfilled") {
        throw modulesResult.reason;
      }

      const modulesData = modulesResult.value;
      const enrollments = enrollmentsResult.status === "fulfilled" ? enrollmentsResult.value : [];
      const preservedSelectedModule = selectedModuleRef.current
        ? mergeSelectedModuleState(
            modulesData.find((module) => module.id === selectedModuleRef.current?.id) || null,
            selectedModuleRef.current,
          )
        : null;

      setModules((current) => mergeModuleListState(modulesData, current));

      const initialModule = requestedModuleId
        ? modulesData.find((module) => module.id === requestedModuleId) || modulesData[0] || null
        : preservedSelectedModule || modulesData[0] || null;

      if (isPreviewMode) {
        const previewTargetModule = requestedModuleId
          ? getPreferredModule(modulesData, [], requestedModuleId)
          : preservedSelectedModule || getPreferredModule(modulesData, [], null);

        setEnrollment({
          id: previewEnrollmentId,
          userId: userId || "preview-user",
          courseId: courseData.id,
          progress: 0,
          status: "enrolled",
          enrolledAt: new Date().toISOString(),
        });
        setProgressDetail(null);
        setSelectedModule(previewTargetModule);
        setCompletedModuleIds([]);
        return;
      }

      if (!userId) {
        setEnrollment(null);
        setProgressDetail(null);
        setSelectedModule(initialModule);
        return;
      }

      const userEnrollment = enrollments.find((candidate) => candidate.courseId === id);

      if (!userEnrollment) {
        setEnrollment(null);
        setProgressDetail(null);
        setSelectedModule(initialModule);
        return;
      }

      setEnrollment(userEnrollment);

      const [completedResult, detailResult, lastAccessedSessionResult] = await Promise.allSettled([
        moduleCompletionService.getCompletedModules(userEnrollment.id),
        enrollmentService.getEnrollmentProgressDetail(userEnrollment.id),
        moduleSessionService.getLastAccessedModule(userId, userEnrollment.id),
      ]);

      if (!isLatestRequest()) {
        return;
      }

      const completed = completedResult.status === "fulfilled" ? completedResult.value : [];
      const detail = detailResult.status === "fulfilled" ? detailResult.value : null;
      const lastAccessedSession = lastAccessedSessionResult.status === "fulfilled" ? lastAccessedSessionResult.value : null;
      const storedResumeModuleId = readStoredCourseResumeModuleId(userId, userEnrollment.id, courseData.id);
      const resumeCandidateId = requestedModuleId || storedResumeModuleId || lastAccessedSession?.moduleId || null;
      const preferredModule = mergeSelectedModuleState(
        getPreferredModule(modulesData, completed, resumeCandidateId),
        selectedModuleRef.current,
      );
      const nextSelectedModule = requestedModuleId
        ? preferredModule
        : preservedSelectedModule && canAccessModuleEntry(preservedSelectedModule, modulesData, completed)
        ? preservedSelectedModule
        : preferredModule;

      setCompletedModuleIds(completed);
      setProgressDetail(detail);
      setSelectedModule(nextSelectedModule);
    } catch (error) {
      console.error("Error loading course data:", error);
      toast.error("Failed to load course data");
    } finally {
      if (shouldShowBlockingLoader && isLatestRequest()) {
        setLoading(false);
      }
    }
  }, [id, isPreviewMode, navigate, previewEnrollmentId, previewKey, requestedModuleId, userId, userRole, userTraineeType]);

  useEffect(() => {
    if (id) {
      attemptedModuleHydrationIdsRef.current = new Set();
      void loadCourseData({ preserveUi: courseRef.current?.id === id });
    }
  }, [id, isPreviewMode, loadCourseData, previewKey, requestedModuleId, userLoadKey]);

  useEffect(() => {
    if (!selectedModule || selectedModule.content !== undefined) {
      if (selectedModule?.content !== undefined) {
        attemptedModuleHydrationIdsRef.current.add(selectedModule.id);
      }
      return;
    }

    if (attemptedModuleHydrationIdsRef.current.has(selectedModule.id)) {
      return;
    }

    attemptedModuleHydrationIdsRef.current.add(selectedModule.id);

    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      void loadModuleContent(selectedModule.id).then((hydratedModule) => {
        if (!cancelled && hydratedModule) {
          setSelectedModule((current) => {
            if (current?.id !== hydratedModule.id) {
              return current;
            }

            const didModuleMeaningfullyChange =
              current.content !== hydratedModule.content
              || current.module_document !== hydratedModule.module_document
              || current.module_thumbnail !== hydratedModule.module_thumbnail
              || current.updated_at !== hydratedModule.updated_at;

            return didModuleMeaningfullyChange ? mergeSelectedModuleState(hydratedModule, current) : current;
          });
        }
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [selectedModule]);

  useEffect(() => {
    if (
      isPreviewMode ||
      !user?.id ||
      !enrollment?.id ||
      !enrollment.courseId ||
      !selectedModule?.id
    ) {
      return;
    }

    writeStoredCourseResumeModuleId(user.id, enrollment.id, enrollment.courseId, selectedModule.id);
  }, [enrollment?.courseId, enrollment?.id, isPreviewMode, selectedModule?.id, user?.id]);

  const loadModuleContent = async (moduleId: string): Promise<Module | null> => {
    if (moduleHydrationRequestRef.current?.moduleId === moduleId) {
      return moduleHydrationRequestRef.current.promise;
    }

    moduleHydrationAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    moduleHydrationAbortControllerRef.current = abortController;

    setLoadingSelectedModuleId(moduleId);
    const requestSequence = moduleRequestSequenceRef.current + 1;
    moduleRequestSequenceRef.current = requestSequence;

    const request = (async () => {
      try {
        const module = await moduleService.getModule(moduleId, { signal: abortController.signal });
        if (abortController.signal.aborted || moduleRequestSequenceRef.current !== requestSequence) {
          return null;
        }

        return module;
      } catch (error) {
        if (abortController.signal.aborted) {
          return null;
        }

        throw error;
      } finally {
        if (moduleRequestSequenceRef.current === requestSequence) {
          setLoadingSelectedModuleId(null);
        }

        if (moduleHydrationRequestRef.current?.moduleId === moduleId) {
          moduleHydrationRequestRef.current = null;
        }
      }
    })();

    moduleHydrationRequestRef.current = { moduleId, promise: request };
    return request;
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
      return;
    }

    attemptedModuleHydrationIdsRef.current.delete(module.id);
    setSelectedModule(module);
  };

  const handleModuleComplete = useCallback(async (moduleId: string, timeSpentMinutes?: number, options?: { silent?: boolean; practiceQuizSnapshot?: import("@/types").PracticeQuizCompletionSnapshot }) => {
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
        timeSpentMinutes,
        options?.practiceQuizSnapshot,
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
  }, [completedModuleIds, enrollment, isPreviewMode, modules.length, refreshEnrollmentState, user]);

  const handleSelectedModuleComplete = useCallback(
    (timeSpentMinutes?: number, options?: { silent?: boolean; practiceQuizSnapshot?: import("@/types").PracticeQuizCompletionSnapshot }) => {
      if (!selectedModule) {
        return Promise.resolve();
      }

      return handleModuleComplete(selectedModule.id, timeSpentMinutes, options);
    },
    [handleModuleComplete, selectedModule],
  );

  const handleUnenroll = async () => {
    if (!enrollment) return;
    setUnenrolling(true);
    try {
      await enrollmentService.unenroll(enrollment.id, false);
      if (user?.id) {
        clearStoredCourseResumeModuleId(user.id, enrollment.id, enrollment.courseId);
      }
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

  const isModuleCompleted = useCallback((moduleId: string) => {
    return completedModuleIds.includes(moduleId);
  }, [completedModuleIds]);

  const canAccessModule = useCallback((module: Module) => {
    return canAccessModuleEntry(module, modules, completedModuleIds);
  }, [completedModuleIds, modules]);

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

  const moduleViewerEnrollment = useMemo(
    () => (enrollment ? { id: enrollment.id, courseId: enrollment.courseId } : null),
    [enrollment?.courseId, enrollment?.id],
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

  const isSelectedModuleCompleted = selectedModule ? isModuleCompleted(selectedModule.id) : false;
  const shouldShowCompletionAction = Boolean(selectedModule) && !isSelectedModuleCompleted;

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

  const handleBackToModules = useCallback(() => {
    modulesListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleSelectNextModule = useCallback((module: Module) => {
    void handleModuleSelect(module);
  }, [handleModuleSelect]);

  const handleModuleCompletionActionStateChange = useCallback((state: {
    canComplete: boolean;
    isCompleting: boolean;
    complete: (() => void) | null;
    blockedReason?: string | null;
  }) => {
    setModuleCompletionAction((current) => {
      if (
        current.canComplete === state.canComplete
        && current.isCompleting === state.isCompleting
        && current.complete === state.complete
        && current.blockedReason === state.blockedReason
      ) {
        return current;
      }

      return state;
    });
  }, []);

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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 lg:items-start">
          {/* Modules Sidebar */}
          <div ref={modulesListRef} className="lg:col-span-1 lg:self-start">
            <Card className="lg:sticky lg:top-6 lg:self-start">
              <CardHeader>
                <CardTitle className="text-lg">{copy.modulesCardTitle}</CardTitle>
                <CardDescription>{copy.modulesCardDescription(modules.length)}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[420px] overflow-y-auto lg:h-[calc(100vh-12rem)]">
                  <div className="space-y-1 p-4">
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
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Module Content Area */}
          <div className="lg:col-span-3">
            {loadingSelectedModuleId && selectedModule?.id === loadingSelectedModuleId ? (
              <CoursePanelLoadingState label={copy.loadingModule} />
            ) : selectedModule && moduleViewerEnrollment ? (
              <SelectedModulePanel
                selectedModule={selectedModule}
                loadingSelectedModuleId={loadingSelectedModuleId}
                enrollment={moduleViewerEnrollment}
                isPreviewMode={isPreviewMode}
                moduleEntrySource={moduleEntrySource}
                onComplete={handleSelectedModuleComplete}
                onPracticeQuizStateChange={setPracticeQuizState}
                onCompletionActionStateChange={handleModuleCompletionActionStateChange}
                isModuleCompleted={isModuleCompleted}
                courseDocument={course.courseDocument}
                courseTitle={course.title}
                copy={copy}
                shouldShowCompletionAction={shouldShowCompletionAction}
                moduleCompletionAction={moduleCompletionAction}
                nextAccessibleModule={nextAccessibleModule}
                onBackToModules={handleBackToModules}
                onSelectNextModule={handleSelectNextModule}
                practiceQuizState={practiceQuizState}
              />
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
                    <Suspense fallback={<CoursePanelLoadingState label="Loading assessment activity..." />}>
                      <AssessmentInterface
                        enrollmentId={enrollment.id}
                        courseId={enrollment.courseId}
                        assessmentId={activeAssessment.assessmentId}
                        emptyStateMessage={copy.noAssessmentActivities}
                        onSubmitted={handleAssessmentRefresh}
                      />
                    </Suspense>
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
                    <Suspense fallback={<CoursePanelLoadingState label="Loading course document..." />}>
                      <DocumentViewer url={course.courseDocument} title={course.title} />
                    </Suspense>
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

