import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, FileQuestion, ImageIcon, ListChecks, Loader2, MessageSquareQuote, Plus, Save, ToggleRight, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { courseService, moduleService } from "@/services/supabaseDatabaseService";
import {
  assessmentService,
  type Assessment,
  type AssessmentQuestion,
  type CourseAssessmentInput,
} from "@/services/assessmentService";
import { supabase } from "@/lib/supabase";
import type { Course, Module } from "@/types";

type AssessmentQuestionDraft = {
  localId: string;
  id?: string;
  question: string;
  questionType: AssessmentQuestion["questionType"];
  options: string[];
  correctAnswer: string;
  points: number;
  explanation: string;
};

type CourseAssessmentDraft = {
  localId: string;
  id?: string;
  title: string;
  description: string;
  thumbnail: string;
  timeLimit: string;
  passingScore: number;
  maxAttempts: number;
  allowRetryAfterPassing: boolean;
  isActive: boolean;
  prerequisiteModuleIds: string[];
  questions: AssessmentQuestionDraft[];
};

const DEFAULT_ASSESSMENT_CONFIG = {
  passingScore: 70,
  maxAttempts: 3,
  allowRetryAfterPassing: false,
};

const QUESTION_TYPE_OPTIONS: Array<{
  value: AssessmentQuestion["questionType"];
  label: string;
  description: string;
  icon: typeof FileQuestion;
}> = [
  {
    value: "multiple_choice",
    label: "Multiple Choice",
    description: "Single-answer question with custom options and auto-grading.",
    icon: ListChecks,
  },
  {
    value: "true_false",
    label: "True / False",
    description: "Quick binary question with automatic scoring.",
    icon: ToggleRight,
  },
  {
    value: "essay",
    label: "Essay",
    description: "Long-form response for trainer review and feedback.",
    icon: MessageSquareQuote,
  },
];

const createAssessmentDraftId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const createEmptyAssessmentQuestion = (
  questionType: AssessmentQuestion["questionType"] = "multiple_choice",
): AssessmentQuestionDraft => ({
  localId: createAssessmentDraftId(),
  question: "",
  questionType,
  options: questionType === "essay" ? [] : questionType === "true_false" ? ["True", "False"] : ["", ""],
  correctAnswer: questionType === "true_false" ? "True" : "",
  points: 1,
  explanation: "",
});

const createEmptyCourseAssessment = (): CourseAssessmentDraft => ({
  localId: createAssessmentDraftId(),
  title: "",
  description: "",
  thumbnail: "",
  timeLimit: "",
  passingScore: DEFAULT_ASSESSMENT_CONFIG.passingScore,
  maxAttempts: DEFAULT_ASSESSMENT_CONFIG.maxAttempts,
  allowRetryAfterPassing: DEFAULT_ASSESSMENT_CONFIG.allowRetryAfterPassing,
  isActive: true,
  prerequisiteModuleIds: [],
  questions: [createEmptyAssessmentQuestion()],
});

const mapAssessmentQuestionToDraft = (question: AssessmentQuestion): AssessmentQuestionDraft => ({
  localId: createAssessmentDraftId(),
  id: question.id,
  question: question.question,
  questionType: question.questionType,
  options:
    question.questionType === "essay"
      ? []
      : question.questionType === "true_false"
        ? ["True", "False"]
        : question.options || ["", ""],
  correctAnswer: question.correctAnswer || "",
  points: question.points,
  explanation: question.explanation || "",
});

const mapAssessmentToDraft = (assessment: Assessment, questions: AssessmentQuestion[]): CourseAssessmentDraft => ({
  localId: createAssessmentDraftId(),
  id: assessment.id,
  title: assessment.title,
  description: assessment.description || "",
  thumbnail: assessment.thumbnail || "",
  timeLimit: assessment.timeLimit ? String(assessment.timeLimit) : "",
  passingScore: assessment.passingScore,
  maxAttempts: assessment.maxAttempts,
  allowRetryAfterPassing: assessment.allowRetryAfterPassing,
  isActive: assessment.isActive,
  prerequisiteModuleIds: assessment.prerequisiteModuleIds || [],
  questions: questions.length > 0 ? questions.map(mapAssessmentQuestionToDraft) : [createEmptyAssessmentQuestion()],
});

const normalizeAssessmentDraft = (assessment: CourseAssessmentDraft, index: number): CourseAssessmentInput => ({
  id: assessment.id,
  title: assessment.title.trim(),
  description: assessment.description.trim() || undefined,
  thumbnail: assessment.thumbnail.trim() || undefined,
  timeLimit: assessment.timeLimit.trim() ? Math.max(1, Number.parseInt(assessment.timeLimit, 10) || 0) : undefined,
  passingScore: Math.min(100, Math.max(1, assessment.passingScore)),
  maxAttempts: Math.max(1, assessment.maxAttempts),
  allowRetryAfterPassing: assessment.allowRetryAfterPassing,
  isActive: assessment.isActive,
  prerequisiteModuleIds: assessment.prerequisiteModuleIds,
  order: index + 1,
  questions: assessment.questions.map((question, index) => ({
    id: question.id,
    question: question.question.trim(),
    questionType: question.questionType,
    options: question.questionType === "essay" ? [] : question.questionType === "true_false" ? ["True", "False"] : question.options,
    correctAnswer: question.questionType === "essay" ? undefined : question.correctAnswer,
    points: Math.max(1, question.points),
    order: index + 1,
    explanation: question.explanation.trim() || undefined,
  })),
});

const validateAssessmentDraft = (assessment: CourseAssessmentDraft): string | null => {
  if (!assessment.title.trim()) {
    return "Each graded assessment needs a title.";
  }

  if (assessment.questions.length === 0) {
    return `\"${assessment.title || "Untitled assessment"}\" needs at least one question.`;
  }

  for (const question of assessment.questions) {
    if (!question.question.trim()) {
      return `\"${assessment.title || "Untitled assessment"}\" has a question with no prompt.`;
    }

    if (question.points <= 0) {
      return `\"${assessment.title || "Untitled assessment"}\" has a question with invalid points.`;
    }

    if (question.questionType === "essay") {
      continue;
    }

    const normalizedOptions = (question.questionType === "true_false" ? ["True", "False"] : question.options)
      .map((option) => option.trim())
      .filter(Boolean);

    if (normalizedOptions.length < 2) {
      return `\"${assessment.title || "Untitled assessment"}\" has a question that needs at least two answer options.`;
    }

    if (!question.correctAnswer.trim()) {
      return `\"${assessment.title || "Untitled assessment"}\" has a question without a correct answer.`;
    }
  }

  return null;
};

const getBaseModulePath = (role?: string) => (role === "admin" ? "/admin/courses" : "/trainer/courses");

const CourseAssessmentEditorPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const basePath = getBaseModulePath(user?.role);

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [courseAssessments, setCourseAssessments] = useState<CourseAssessmentDraft[]>([]);
  const [deletedAssessmentIds, setDeletedAssessmentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingThumbnailKey, setUploadingThumbnailKey] = useState<string | null>(null);

  const loadAssessmentEditor = useCallback(async () => {
    if (!courseId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [courseData, moduleList, assessments] = await Promise.all([
        courseService.getCourse(courseId),
        moduleService.getModulesByCourse(courseId),
        assessmentService.getCourseAssessments(courseId),
      ]);

      if (!courseData) {
        toast.error("Course not found");
        navigate(basePath, { replace: true });
        return;
      }

      const assessmentDrafts = await Promise.all(
        assessments.map(async (assessment) => {
          const questions = await assessmentService.getAssessmentQuestions(assessment.id);
          return mapAssessmentToDraft(assessment, questions);
        }),
      );

      setCourse(courseData);
      setModules(moduleList);
      setCourseAssessments(assessmentDrafts);
      setDeletedAssessmentIds([]);
    } catch (error) {
      console.error("Error loading course assessment editor:", error);
      toast.error("Failed to load course assessments");
    } finally {
      setLoading(false);
    }
  }, [basePath, courseId, navigate]);

  useEffect(() => {
    void loadAssessmentEditor();
  }, [loadAssessmentEditor]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const targetAssessmentId = location.hash.replace("#", "").trim();
    if (!targetAssessmentId) {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById(`assessment-card-${targetAssessmentId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [courseAssessments, loading, location.hash]);

  const uploadAssessmentThumbnail = async (file: File) => {
    if (!supabase || !user) {
      throw new Error("Supabase or user not initialized");
    }

    if (!file.type.startsWith("image/")) {
      throw new Error("Please upload an image file for the assessment thumbnail");
    }

    const extension = file.name.split(".").pop();
    const fileName = `assessment-thumbnail-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`;
    const filePath = `assessments/${user.id}/${fileName}`;
    const { error } = await supabase.storage.from("course-materials").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      const message = error.message?.toLowerCase().includes("bucket not found")
        ? "Storage bucket 'course-materials' not found. Create it in Supabase Storage and apply the storage policies from STORAGE_SETUP.md."
        : error.message;
      throw new Error(message);
    }

    const { data } = supabase.storage.from("course-materials").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleAssessmentThumbnailUpload = async (assessmentLocalId: string, file: File) => {
    setUploadingThumbnailKey(assessmentLocalId);
    try {
      const url = await uploadAssessmentThumbnail(file);
      updateAssessmentDraft(assessmentLocalId, { thumbnail: url });
      toast.success("Assessment thumbnail uploaded");
    } catch (error) {
      console.error("Assessment thumbnail upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload assessment thumbnail");
    } finally {
      setUploadingThumbnailKey(null);
    }
  };

  const updateAssessmentDraft = (localId: string, updates: Partial<CourseAssessmentDraft>) => {
    setCourseAssessments((current) => current.map((assessment) => (
      assessment.localId === localId ? { ...assessment, ...updates } : assessment
    )));
  };

  const updateAssessmentQuestionDraft = (
    assessmentLocalId: string,
    questionLocalId: string,
    updates: Partial<AssessmentQuestionDraft>,
  ) => {
    setCourseAssessments((current) => current.map((assessment) => {
      if (assessment.localId !== assessmentLocalId) {
        return assessment;
      }

      return {
        ...assessment,
        questions: assessment.questions.map((question) => (
          question.localId === questionLocalId ? { ...question, ...updates } : question
        )),
      };
    }));
  };

  const addCourseAssessment = () => {
    setCourseAssessments((current) => [...current, createEmptyCourseAssessment()]);
  };

  const removeCourseAssessment = (assessment: CourseAssessmentDraft) => {
    if (assessment.id) {
      setDeletedAssessmentIds((current) => Array.from(new Set([...current, assessment.id!])));
    }

    setCourseAssessments((current) => current.filter((candidate) => candidate.localId !== assessment.localId));
  };

  const addAssessmentQuestion = (
    assessmentLocalId: string,
    questionType: AssessmentQuestion["questionType"] = "multiple_choice",
  ) => {
    setCourseAssessments((current) => current.map((assessment) => (
      assessment.localId === assessmentLocalId
        ? { ...assessment, questions: [...assessment.questions, createEmptyAssessmentQuestion(questionType)] }
        : assessment
    )));
  };

  const removeAssessmentQuestion = (assessmentLocalId: string, questionLocalId: string) => {
    setCourseAssessments((current) => current.map((assessment) => {
      if (assessment.localId !== assessmentLocalId) {
        return assessment;
      }

      const nextQuestions = assessment.questions.filter((question) => question.localId !== questionLocalId);
      return {
        ...assessment,
        questions: nextQuestions.length > 0 ? nextQuestions : [createEmptyAssessmentQuestion()],
      };
    }));
  };

  const handleSaveAssessments = async () => {
    if (!courseId) {
      return;
    }

    for (const assessment of courseAssessments) {
      const validationError = validateAssessmentDraft(assessment);
      if (validationError) {
        toast.error(validationError);
        return;
      }
    }

    setSaving(true);
    try {
      for (const assessmentId of deletedAssessmentIds) {
        await assessmentService.deactivateAssessment(assessmentId);
      }

      for (const [index, assessment] of courseAssessments.entries()) {
        await assessmentService.saveCourseAssessment(courseId, normalizeAssessmentDraft(assessment, index));
      }

      await loadAssessmentEditor();
      toast.success("Course assessments saved");
    } catch (error) {
      console.error("Error saving course assessments:", error);
      toast.error("Failed to save course assessments");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[320px] items-center justify-center text-muted-foreground">Loading course assessments...</div>
      </DashboardLayout>
    );
  }

  if (!course) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" asChild className="px-0">
              <Link to={`${basePath}/${courseId}/modules`}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back to Module List
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Course Graded Assessments</h1>
              <p className="mt-1 text-muted-foreground">{course.title}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={addCourseAssessment}>
              <Plus className="mr-2 h-4 w-4" />
              Add Assessment
            </Button>
            <Button onClick={() => void handleSaveAssessments()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Assessments
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm text-muted-foreground">
            <span>These graded assessments are course-level activities, separate from the inline practice quizzes inside each module.</span>
            <Badge variant="outline">{modules.length} module{modules.length === 1 ? "" : "s"}</Badge>
            <Badge variant="outline">{courseAssessments.length} assessment{courseAssessments.length === 1 ? "" : "s"}</Badge>
          </CardContent>
        </Card>

        {courseAssessments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileQuestion className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No course-level graded assessments yet.</p>
              <Button type="button" variant="outline" className="mt-4" onClick={addCourseAssessment}>
                <Plus className="mr-2 h-4 w-4" />
                Add Assessment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {courseAssessments.map((assessment, assessmentIndex) => (
              <Card
                key={assessment.localId}
                id={assessment.id ? `assessment-card-${assessment.id}` : undefined}
                className={assessment.id && location.hash === `#${assessment.id}` ? "ring-2 ring-primary/40" : undefined}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>Assessment {assessmentIndex + 1}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">Configure scored questions, grading rules, and prerequisite-based unlocks for this course activity.</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCourseAssessment(assessment)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
                    <div className="space-y-6">
                      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                        <div className="space-y-3">
                          <Label>Assessment Thumbnail</Label>
                          {assessment.thumbnail ? (
                            <img src={assessment.thumbnail} alt={assessment.title || "Assessment thumbnail"} className="h-36 w-full rounded-xl border object-cover" />
                          ) : (
                            <div className="flex h-36 w-full items-center justify-center rounded-xl border border-dashed bg-muted/40 text-muted-foreground">
                              <div className="text-center text-sm">
                                <ImageIcon className="mx-auto mb-2 h-5 w-5" />
                                <p>Add a thumbnail for this assessment</p>
                              </div>
                            </div>
                          )}

                          <Input
                            value={assessment.thumbnail}
                            onChange={(event) => updateAssessmentDraft(assessment.localId, { thumbnail: event.target.value })}
                            placeholder="Paste a thumbnail URL"
                          />

                          <input
                            id={`${assessment.localId}-thumbnail-upload`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                void handleAssessmentThumbnailUpload(assessment.localId, file);
                              }
                              event.currentTarget.value = "";
                            }}
                          />

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={uploadingThumbnailKey === assessment.localId}
                              onClick={() => document.getElementById(`${assessment.localId}-thumbnail-upload`)?.click()}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              {uploadingThumbnailKey === assessment.localId ? "Uploading..." : "Upload Thumbnail"}
                            </Button>
                            {assessment.thumbnail ? (
                              <Button type="button" variant="ghost" onClick={() => updateAssessmentDraft(assessment.localId, { thumbnail: "" })}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove Thumbnail
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Assessment Title</Label>
                              <Input
                                value={assessment.title}
                                onChange={(event) => updateAssessmentDraft(assessment.localId, { title: event.target.value })}
                                placeholder="Enter the assessment title"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Time Limit (minutes, optional)</Label>
                              <Input
                                value={assessment.timeLimit}
                                onChange={(event) => updateAssessmentDraft(assessment.localId, { timeLimit: event.target.value })}
                                placeholder="Leave blank for no time limit"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              rows={3}
                              value={assessment.description}
                              onChange={(event) => updateAssessmentDraft(assessment.localId, { description: event.target.value })}
                              placeholder="Explain what this graded assessment measures"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Passing Score (%)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={assessment.passingScore}
                            onChange={(event) => updateAssessmentDraft(assessment.localId, {
                              passingScore: Math.min(100, Math.max(1, Number.parseInt(event.target.value, 10) || DEFAULT_ASSESSMENT_CONFIG.passingScore)),
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Allowed Attempts</Label>
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            value={assessment.maxAttempts}
                            onChange={(event) => updateAssessmentDraft(assessment.localId, {
                              maxAttempts: Math.min(20, Math.max(1, Number.parseInt(event.target.value, 10) || DEFAULT_ASSESSMENT_CONFIG.maxAttempts)),
                            })}
                          />
                        </div>
                        <div className="flex items-start gap-3 rounded-lg border p-4">
                          <Checkbox
                            id={`${assessment.localId}-is-active`}
                            checked={assessment.isActive}
                            onCheckedChange={(checked) => updateAssessmentDraft(assessment.localId, { isActive: checked === true })}
                          />
                          <div className="space-y-1">
                            <Label htmlFor={`${assessment.localId}-is-active`}>Assessment is active</Label>
                            <p className="text-sm text-muted-foreground">Inactive assessments stay hidden from learners until you enable them.</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 rounded-lg border p-4">
                        <Checkbox
                          id={`${assessment.localId}-allow-retry-after-pass`}
                          checked={assessment.allowRetryAfterPassing}
                          onCheckedChange={(checked) => updateAssessmentDraft(assessment.localId, { allowRetryAfterPassing: checked === true })}
                        />
                        <div className="space-y-1">
                          <Label htmlFor={`${assessment.localId}-allow-retry-after-pass`}>Allow retry after passing</Label>
                          <p className="text-sm text-muted-foreground">When disabled, learners stop getting new attempts as soon as they pass.</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label>Unlock Prerequisite Modules</Label>
                          <p className="mt-1 text-sm text-muted-foreground">Select the modules learners must complete before this assessment appears as available in the course sidebar.</p>
                        </div>
                        <div className="space-y-2">
                          {modules.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Create modules first to use prerequisite-based unlock rules.</p>
                          ) : (
                            modules.map((module) => (
                              <label key={`${assessment.localId}-${module.id}`} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                                <input
                                  type="checkbox"
                                  checked={assessment.prerequisiteModuleIds.includes(module.id)}
                                  onChange={(event) => {
                                    updateAssessmentDraft(assessment.localId, {
                                      prerequisiteModuleIds: event.target.checked
                                        ? [...assessment.prerequisiteModuleIds, module.id]
                                        : assessment.prerequisiteModuleIds.filter((candidate) => candidate !== module.id),
                                    });
                                  }}
                                />
                                <div>
                                  <p className="font-medium">{module.title}</p>
                                  <p className="text-muted-foreground">Module {module.order}</p>
                                </div>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold">Scored Questions</h3>
                            <p className="text-sm text-muted-foreground">Build and number question blocks here so they are easier to reference in grading rules and review notes.</p>
                          </div>
                          <Badge variant="outline">{assessment.questions.length} question{assessment.questions.length === 1 ? "" : "s"}</Badge>
                        </div>

                        <div className="space-y-4">
                          {assessment.questions.map((question, questionIndex) => (
                            <Card key={question.localId} className="border-border/70">
                              <CardContent className="space-y-4 pt-6">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-semibold text-foreground">
                                      {questionIndex + 1}
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">Question {questionIndex + 1}</p>
                                      <p className="text-xs text-muted-foreground">Use this number when describing grading guidance or review expectations.</p>
                                    </div>
                                  </div>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => removeAssessmentQuestion(assessment.localId, question.localId)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove Question
                                  </Button>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label>Question Type</Label>
                                    <select
                                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                      value={question.questionType}
                                      onChange={(event) => {
                                        const questionType = event.target.value as AssessmentQuestion["questionType"];
                                        updateAssessmentQuestionDraft(assessment.localId, question.localId, {
                                          questionType,
                                          options: questionType === "essay" ? [] : questionType === "true_false" ? ["True", "False"] : question.options.length > 0 ? question.options : ["", ""],
                                          correctAnswer: questionType === "essay" ? "" : questionType === "true_false" ? question.correctAnswer || "True" : question.correctAnswer,
                                        });
                                      }}
                                    >
                                      <option value="multiple_choice">Multiple Choice</option>
                                      <option value="true_false">True / False</option>
                                      <option value="essay">Essay</option>
                                    </select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Points</Label>
                                    <Input
                                      type="number"
                                      min={1}
                                      value={question.points}
                                      onChange={(event) => updateAssessmentQuestionDraft(assessment.localId, question.localId, {
                                        points: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                                      })}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>{question.questionType === "essay" ? "Essay Prompt" : "Question Text"}</Label>
                                  <Textarea
                                    rows={3}
                                    value={question.question}
                                    onChange={(event) => updateAssessmentQuestionDraft(assessment.localId, question.localId, { question: event.target.value })}
                                    placeholder="Enter the learner-facing prompt"
                                  />
                                </div>

                                {question.questionType === "essay" ? (
                                  <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                                    Essay questions stay in the graded assessment workflow and can be reviewed manually by trainers later.
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <Label>Answer Options</Label>
                                      {question.questionType === "multiple_choice" ? (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => updateAssessmentQuestionDraft(assessment.localId, question.localId, { options: [...question.options, ""] })}
                                        >
                                          <Plus className="mr-2 h-4 w-4" />
                                          Add Option
                                        </Button>
                                      ) : null}
                                    </div>

                                    <div className="space-y-3">
                                      {(question.questionType === "true_false" ? ["True", "False"] : question.options).map((option, optionIndex) => (
                                        <div key={`${question.localId}-${optionIndex}`} className="flex items-center gap-3">
                                          <input
                                            type="radio"
                                            name={`${question.localId}-correct-answer`}
                                            checked={question.correctAnswer === option}
                                            onChange={() => updateAssessmentQuestionDraft(assessment.localId, question.localId, { correctAnswer: option })}
                                          />
                                          <Input
                                            value={option}
                                            disabled={question.questionType === "true_false"}
                                            onChange={(event) => {
                                              const nextOptions = [...question.options];
                                              nextOptions[optionIndex] = event.target.value;
                                              updateAssessmentQuestionDraft(assessment.localId, question.localId, {
                                                options: nextOptions,
                                                correctAnswer: question.correctAnswer === option ? event.target.value : question.correctAnswer,
                                              });
                                            }}
                                            placeholder={`Option ${optionIndex + 1}`}
                                          />
                                          {question.questionType === "multiple_choice" ? (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                const nextOptions = question.options.filter((_, index) => index !== optionIndex);
                                                updateAssessmentQuestionDraft(assessment.localId, question.localId, {
                                                  options: nextOptions,
                                                  correctAnswer: question.correctAnswer === option ? "" : question.correctAnswer,
                                                });
                                              }}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <Label>Explanation / Feedback (optional)</Label>
                                  <Textarea
                                    rows={3}
                                    value={question.explanation}
                                    onChange={(event) => updateAssessmentQuestionDraft(assessment.localId, question.localId, { explanation: event.target.value })}
                                    placeholder="Add learner feedback or reviewer guidance"
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </div>

                    <Card className="xl:sticky xl:top-6">
                      <CardHeader>
                        <CardTitle>Add Question Block</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {QUESTION_TYPE_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          return (
                            <Button
                              key={`${assessment.localId}-${option.value}`}
                              type="button"
                              variant="ghost"
                              className="h-auto w-full justify-start gap-3 px-3 py-3 text-left"
                              onClick={() => addAssessmentQuestion(assessment.localId, option.value)}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="space-y-1">
                                <span className="block font-medium text-foreground">{option.label}</span>
                              </span>
                            </Button>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CourseAssessmentEditorPage;