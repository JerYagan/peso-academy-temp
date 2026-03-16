import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  FileQuestion,
  FileText,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Upload,
  Video,
  Code,
  Type,
  Link2,
  Eye,
  Settings,
  LayoutPanelTop,
  Trash2,
} from "lucide-react";
import { courseService, moduleService } from "@/services/supabaseDatabaseService";
import {
  assessmentService,
  type Assessment,
  type AssessmentQuestion,
  type CourseAssessmentInput,
} from "@/services/assessmentService";
import { ContentBlockComponent, type ContentBlock, type ContentBlockType } from "@/components/course/ContentBlock";
import { ModulePreview } from "@/components/course/ModulePreview";
import { TaxonomyTagField } from "@/components/course/TaxonomyTagField";
import { useAuth } from "@/contexts/AuthContext";
import { createDefaultContentBlock, importPracticeQuizQuestions, parseModuleContentBlocks } from "@/lib/contentBlocks";
import { hasCanonicalSkillMatch, hasCanonicalTopicMatch, normalizeSkillTags, normalizeTopicTags } from "@/lib/taxonomy";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Course, Module } from "@/types";

type EditorTab = "content" | "settings" | "preview";
type UploadField = "module_thumbnail" | "module_document";
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
  timeLimit: string;
  passingScore: number;
  maxAttempts: number;
  allowRetryAfterPassing: boolean;
  isActive: boolean;
  prerequisiteModuleIds: string[];
  questions: AssessmentQuestionDraft[];
};

const BLOCK_TYPE_OPTIONS: Array<{ value: ContentBlockType; label: string; icon: typeof Type }> = [
  { value: "text", label: "Text", icon: Type },
  { value: "video", label: "Video", icon: Video },
  { value: "code", label: "Code", icon: Code },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "quiz", label: "Quiz Question", icon: FileQuestion },
  { value: "document", label: "Document", icon: FileText },
  { value: "learning_material", label: "Learning Materials", icon: Link2 },
];

const getBaseModulePath = (role?: string) => (role === "admin" ? "/admin/courses" : "/trainer/courses");

const createEmptyBlock = (type: ContentBlockType): ContentBlock => {
  return createDefaultContentBlock(type, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
};

const DEFAULT_ASSESSMENT_CONFIG = {
  passingScore: 70,
  maxAttempts: 3,
  allowRetryAfterPassing: false,
};

const createAssessmentDraftId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const MODULE_EDITOR_AUTOSAVE_DELAY_MS = 1500;

type ModuleEditorDraftSnapshot = {
  formData: {
    title: string;
    description: string;
    materials: string[];
    prerequisites: string[];
    skillTags: string[];
    topicTags: string[];
    module_thumbnail: string;
    module_document: string;
  };
  contentBlocks: ContentBlock[];
  updatedAt: string;
};

const createEmptyAssessmentQuestion = (): AssessmentQuestionDraft => ({
  localId: createAssessmentDraftId(),
  question: "",
  questionType: "multiple_choice",
  options: ["", ""],
  correctAnswer: "",
  points: 1,
  explanation: "",
});

const createEmptyCourseAssessment = (): CourseAssessmentDraft => ({
  localId: createAssessmentDraftId(),
  title: "",
  description: "",
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
  options: question.questionType === "essay" ? [] : question.questionType === "true_false" ? ["True", "False"] : question.options || ["", ""],
  correctAnswer: question.correctAnswer || "",
  points: question.points,
  explanation: question.explanation || "",
});

const mapAssessmentToDraft = (assessment: Assessment, questions: AssessmentQuestion[]): CourseAssessmentDraft => ({
  localId: createAssessmentDraftId(),
  id: assessment.id,
  title: assessment.title,
  description: assessment.description || "",
  timeLimit: assessment.timeLimit ? String(assessment.timeLimit) : "",
  passingScore: assessment.passingScore,
  maxAttempts: assessment.maxAttempts,
  allowRetryAfterPassing: assessment.allowRetryAfterPassing,
  isActive: assessment.isActive,
  prerequisiteModuleIds: assessment.prerequisiteModuleIds || [],
  questions: questions.length > 0 ? questions.map(mapAssessmentQuestionToDraft) : [createEmptyAssessmentQuestion()],
});

const normalizeAssessmentDraft = (assessment: CourseAssessmentDraft): CourseAssessmentInput => ({
  id: assessment.id,
  title: assessment.title.trim(),
  description: assessment.description.trim() || undefined,
  timeLimit: assessment.timeLimit.trim() ? Math.max(1, Number.parseInt(assessment.timeLimit, 10) || 0) : undefined,
  passingScore: Math.min(100, Math.max(1, assessment.passingScore)),
  maxAttempts: Math.max(1, assessment.maxAttempts),
  allowRetryAfterPassing: assessment.allowRetryAfterPassing,
  isActive: assessment.isActive,
  prerequisiteModuleIds: assessment.prerequisiteModuleIds,
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

    const normalizedOptions = (question.questionType === "true_false" ? ["True", "False"] : question.options).map((option) => option.trim()).filter(Boolean);
    if (normalizedOptions.length < 2) {
      return `\"${assessment.title || "Untitled assessment"}\" has a question that needs at least two answer options.`;
    }

    if (!question.correctAnswer.trim()) {
      return `\"${assessment.title || "Untitled assessment"}\" has a question without a correct answer.`;
    }
  }

  return null;
};

const ModuleEditorPage = () => {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = Boolean(moduleId);
  const basePath = getBaseModulePath(user?.role);

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "local" | "pending" | "saving" | "saved" | "error">("idle");
  const [autosaveMessage, setAutosaveMessage] = useState<string>("");
  const [activeTab, setActiveTab] = useState<EditorTab>("content");
  const [uploadingAssetKey, setUploadingAssetKey] = useState<string | null>(null);
  const [newMaterial, setNewMaterial] = useState("");
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveHydratedRef = useRef(false);
  const latestSavedSignatureRef = useRef("");
  const editingModuleRef = useRef<Module | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    materials: [] as string[],
    prerequisites: [] as string[],
    skillTags: [] as string[],
    topicTags: [] as string[],
    module_thumbnail: "",
    module_document: "",
  });
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [courseAssessments, setCourseAssessments] = useState<CourseAssessmentDraft[]>([]);
  const [deletedAssessmentIds, setDeletedAssessmentIds] = useState<string[]>([]);
  const inheritedSkillOptions = useMemo(() => normalizeSkillTags(course?.skills || []), [course?.skills]);
  const inheritedTopicOptions = useMemo(() => normalizeTopicTags(course?.topicTags || []), [course?.topicTags]);
  const importedPracticeQuestions = useMemo(() => importPracticeQuizQuestions(contentBlocks), [contentBlocks]);
  const localDraftStorageKey = useMemo(
    () => (!moduleId && courseId ? `module-editor-draft:${courseId}:new` : null),
    [courseId, moduleId],
  );

  useEffect(() => {
    editingModuleRef.current = editingModule;
  }, [editingModule]);

  const loadCourseAssessments = useCallback(async (targetCourseId: string) => {
    try {
      const assessments = await assessmentService.getCourseAssessments(targetCourseId);
      const loadedAssessments = await Promise.all(
        assessments.map(async (assessment) => {
          const questions = await assessmentService.getAssessmentQuestions(assessment.id);
          return mapAssessmentToDraft(assessment, questions);
        }),
      );

      setCourseAssessments(loadedAssessments);
      setDeletedAssessmentIds([]);
    } catch (error) {
      console.error("Error loading course assessments:", error);
      toast.error("Failed to load course graded assessments");
      setCourseAssessments([]);
    }
  }, []);

  const loadEditor = useCallback(async () => {
    autosaveHydratedRef.current = false;
    latestSavedSignatureRef.current = "";
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (!courseId) {
      setCourse(null);
      setModules([]);
      setEditingModule(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [courseData, moduleList] = await Promise.all([
        courseService.getCourse(courseId),
        moduleService.getModulesByCourse(courseId),
      ]);

      if (!courseData) {
        toast.error("Course not found");
        navigate(basePath, { replace: true });
        return;
      }

      setCourse(courseData);
      setModules(moduleList);

      if (!moduleId) {
        let restoredDraftSnapshot: ModuleEditorDraftSnapshot | null = null;

        if (localDraftStorageKey && typeof window !== "undefined") {
          const rawDraft = window.localStorage.getItem(localDraftStorageKey);
          if (rawDraft) {
            try {
              restoredDraftSnapshot = JSON.parse(rawDraft) as ModuleEditorDraftSnapshot;
            } catch (error) {
              console.warn("Failed to parse module editor draft snapshot:", error);
              window.localStorage.removeItem(localDraftStorageKey);
            }
          }
        }

        setEditingModule(null);
        setFormData({
          title: restoredDraftSnapshot?.formData.title || "",
          description: restoredDraftSnapshot?.formData.description || "",
          materials: restoredDraftSnapshot?.formData.materials || [],
          prerequisites: restoredDraftSnapshot?.formData.prerequisites || [],
          skillTags: restoredDraftSnapshot?.formData.skillTags || normalizeSkillTags(courseData.skills || []),
          topicTags: restoredDraftSnapshot?.formData.topicTags || normalizeTopicTags(courseData.topicTags || []),
          module_thumbnail: restoredDraftSnapshot?.formData.module_thumbnail || "",
          module_document: restoredDraftSnapshot?.formData.module_document || "",
        });
        setContentBlocks(restoredDraftSnapshot?.contentBlocks || []);
        if (restoredDraftSnapshot) {
          setAutosaveState("local");
          setAutosaveMessage("Recovered unsaved local draft.");
        } else {
          setAutosaveState("idle");
          setAutosaveMessage("");
        }
        return;
      }

      const targetModule = moduleList.find((module) => module.id === moduleId) || await moduleService.getModule(moduleId);

      if (!targetModule) {
        toast.error("Module not found");
        navigate(`${basePath}/${courseId}/modules`, { replace: true });
        return;
      }

      setEditingModule(targetModule);
      setFormData({
        title: targetModule.title || "",
        description: targetModule.description || "",
        materials: targetModule.materials || [],
        prerequisites: targetModule.prerequisites || [],
        skillTags: normalizeSkillTags(targetModule.skillTags || []).filter((tag) => hasCanonicalSkillMatch(tag, courseData.skills || [])),
        topicTags: normalizeTopicTags(targetModule.topicTags || []).filter((tag) => hasCanonicalTopicMatch(tag, courseData.topicTags || [])),
        module_thumbnail: targetModule.module_thumbnail || "",
        module_document: targetModule.module_document || "",
      });
      setContentBlocks(parseModuleContentBlocks(targetModule.content));
      setAutosaveState("idle");
      setAutosaveMessage("");
    } catch (error) {
      console.error("Error loading module editor:", error);
      toast.error("Failed to load module editor");
    } finally {
      setLoading(false);
    }
  }, [basePath, courseId, loadCourseAssessments, moduleId, navigate]);

  useEffect(() => {
    void loadEditor();
  }, [loadEditor]);

  const uploadAssetToStorage = async (file: File, folder: string) => {
    if (!supabase || !user) throw new Error("Supabase or user not initialized");
    const ext = file.name.split(".").pop();
    const fileName = `${folder}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const filePath = `modules/${user.id}/${fileName}`;
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

  const handleModuleAssetUpload = async (field: UploadField, file: File) => {
    setUploadingAssetKey(field);
    try {
      const url = await uploadAssetToStorage(file, field === "module_thumbnail" ? "thumbnail" : "document");
      setFormData((current) => ({ ...current, [field]: url }));
      toast.success(field === "module_thumbnail" ? "Thumbnail uploaded" : "Document uploaded");
    } catch (error: any) {
      console.error("Module asset upload error:", error);
      toast.error(error.message || "Failed to upload asset");
    } finally {
      setUploadingAssetKey(null);
    }
  };

  const handleBlockAssetUpload = async (blockId: string, field: "videoUrl" | "imageUrl" | "documentUrl" | "materialUrl", file: File) => {
    setUploadingAssetKey(`${blockId}:${field}`);
    try {
      const folder = field === "videoUrl" ? "video" : field === "imageUrl" ? "image" : "asset";
      const url = await uploadAssetToStorage(file, folder);
      setContentBlocks((current) => current.map((block) => (block.id === blockId ? { ...block, [field]: url } : block)));
      toast.success("Content asset uploaded");
    } catch (error: any) {
      console.error("Content asset upload error:", error);
      toast.error(error.message || "Failed to upload content asset");
    } finally {
      setUploadingAssetKey(null);
    }
  };

  const previewModule = useMemo<Module>(() => ({
    id: editingModule?.id || "preview-module",
    course_id: courseId || "",
    title: formData.title || "Untitled module",
    description: formData.description || "Add a short module description to improve the preview.",
    order: editingModule?.order || modules.length + 1,
    content: JSON.stringify(contentBlocks),
    materials: formData.materials,
    prerequisites: formData.prerequisites,
    skillTags: formData.skillTags,
    topicTags: formData.topicTags,
    module_thumbnail: formData.module_thumbnail || undefined,
    module_document: formData.module_document || undefined,
    created_at: editingModule?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: editingModule?.status || "draft",
  }), [contentBlocks, courseId, editingModule, formData, modules.length]);

  const buildModulePayload = useCallback(
    (status: "draft" | "finalized") => ({
      course_id: courseId || "",
      title: formData.title.trim(),
      description: formData.description.trim(),
      order: editingModuleRef.current?.order || (modules.length > 0 ? Math.max(...modules.map((module) => module.order)) + 1 : 1),
      content: JSON.stringify(contentBlocks),
      materials: formData.materials,
      prerequisites: formData.prerequisites,
      skillTags: formData.skillTags,
      topicTags: formData.topicTags,
      module_thumbnail: formData.module_thumbnail || undefined,
      module_document: formData.module_document || undefined,
      status,
    }),
    [contentBlocks, courseId, formData, modules],
  );

  const getPayloadSignature = useCallback(
    (status: "draft" | "finalized") => JSON.stringify(buildModulePayload(status)),
    [buildModulePayload],
  );

  const addMaterial = () => {
    if (!newMaterial.trim() || formData.materials.includes(newMaterial.trim())) return;
    setFormData((current) => ({ ...current, materials: [...current.materials, newMaterial.trim()] }));
    setNewMaterial("");
  };

  const removeMaterial = (material: string) => {
    setFormData((current) => ({ ...current, materials: current.materials.filter((item) => item !== material) }));
  };

  const persistModule = useCallback(async (
    status: "draft" | "finalized",
    options?: { manual?: boolean; autosave?: boolean },
  ) => {
    if (!courseId) {
      return null;
    }

    const isManual = Boolean(options?.manual);
    const isAutosave = Boolean(options?.autosave);

    if (isManual && (!formData.title.trim() || !formData.description.trim())) {
      toast.error("Title and description are required");
      return null;
    }

    if (isManual && (formData.skillTags.length === 0 || formData.topicTags.length === 0)) {
      toast.error("Modules must include at least one approved skill tag and one approved topic tag");
      return null;
    }

    if (isAutosave && !editingModuleRef.current && (!formData.title.trim() || !formData.description.trim())) {
      setAutosaveState("local");
      setAutosaveMessage("Local draft saved. Add a title and description to enable draft autosave.");
      return null;
    }

    if (isManual) {
      setSaving(true);
    }

    if (isAutosave) {
      setAutosaveState("saving");
      setAutosaveMessage("Saving draft...");
    }

    try {
      const payload = buildModulePayload(status);
      let savedModule: Module;

      if (editingModuleRef.current) {
        savedModule = await moduleService.updateModule(editingModuleRef.current.id, payload);
        setEditingModule(savedModule);
        setModules((current) => current.map((module) => (module.id === savedModule.id ? savedModule : module)));
      } else {
        savedModule = await moduleService.createModule(payload as Omit<Module, "id" | "created_at">);
        setEditingModule(savedModule);
        setModules((current) => [...current, savedModule].sort((left, right) => left.order - right.order));
        navigate(`${basePath}/${courseId}/modules/${savedModule.id}/edit`, { replace: true });
      }

      editingModuleRef.current = savedModule;
      latestSavedSignatureRef.current = getPayloadSignature(status);

      if (localDraftStorageKey && typeof window !== "undefined") {
        window.localStorage.removeItem(localDraftStorageKey);
      }

      if (isAutosave) {
        setAutosaveState("saved");
        setAutosaveMessage("Draft saved automatically.");
      }

      if (isManual) {
        toast.success(status === "finalized" ? "Module saved" : "Module draft saved");
      }

      return savedModule;
    } catch (error) {
      console.error("Error saving module:", error);
      if (isAutosave) {
        setAutosaveState("error");
        setAutosaveMessage("Autosave failed. Your changes are still in the editor.");
      } else {
        toast.error(editingModuleRef.current ? "Failed to update module" : "Failed to create module");
      }
      return null;
    } finally {
      if (isManual) {
        setSaving(false);
      }
    }
  }, [basePath, buildModulePayload, courseId, formData.description, formData.skillTags.length, formData.title, formData.topicTags.length, getPayloadSignature, localDraftStorageKey, navigate]);

  const handleSaveModule = async (status: "draft" | "finalized") => {
    await persistModule(status, { manual: true });
  };

  useEffect(() => {
    if (!localDraftStorageKey || typeof window === "undefined") {
      return;
    }

    const snapshot: ModuleEditorDraftSnapshot = {
      formData,
      contentBlocks,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(localDraftStorageKey, JSON.stringify(snapshot));
  }, [contentBlocks, formData, localDraftStorageKey]);

  useEffect(() => {
    if (!courseId || loading) {
      return;
    }

    const autosaveStatus = editingModuleRef.current?.status === "finalized" ? "finalized" : "draft";
    const draftSignature = getPayloadSignature(autosaveStatus);

    if (!autosaveHydratedRef.current) {
      autosaveHydratedRef.current = true;
      latestSavedSignatureRef.current = editingModuleRef.current ? draftSignature : "";
      return;
    }

    if (draftSignature === latestSavedSignatureRef.current) {
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    setAutosaveState(editingModuleRef.current || formData.title.trim() || formData.description.trim() ? "pending" : "local");
    setAutosaveMessage(
      editingModuleRef.current || formData.title.trim() || formData.description.trim()
        ? "Unsaved changes. Autosave will run shortly."
        : "Local draft saved. Add a title and description to enable draft autosave.",
    );

    autosaveTimerRef.current = window.setTimeout(() => {
      void persistModule(autosaveStatus, { autosave: true });
    }, MODULE_EDITOR_AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [contentBlocks, courseId, editingModule, formData, getPayloadSignature, loading, persistModule]);

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

  const addAssessmentQuestion = (assessmentLocalId: string) => {
    setCourseAssessments((current) => current.map((assessment) => (
      assessment.localId === assessmentLocalId
        ? { ...assessment, questions: [...assessment.questions, createEmptyAssessmentQuestion()] }
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

  const importPracticeQuizzesIntoAssessment = (assessmentLocalId: string) => {
    if (importedPracticeQuestions.length === 0) {
      toast.error("Add at least one practice quiz block in the Content tab before importing.");
      return;
    }

    setCourseAssessments((current) => current.map((assessment) => {
      if (assessment.localId !== assessmentLocalId) {
        return assessment;
      }

      return {
        ...assessment,
        questions: importedPracticeQuestions.map((question) => ({
          localId: createAssessmentDraftId(),
          question: question.question,
          questionType: question.questionType,
          options: question.questionType === "essay" ? [] : question.questionType === "true_false" ? ["True", "False"] : question.options || ["", ""],
          correctAnswer: question.correctAnswer || "",
          points: question.points,
          explanation: question.explanation || "",
        })),
      };
    }));

    toast.success("Practice quiz wording imported into the graded assessment draft.");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[320px] items-center justify-center text-muted-foreground">Loading module editor...</div>
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
              <h1 className="text-3xl font-bold">{isEditing ? "Edit Module" : "Create Module"}</h1>
              <p className="mt-1 text-muted-foreground">{course.title}</p>
              {autosaveMessage ? (
                <p className={`mt-2 text-sm ${autosaveState === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                  {autosaveState === "saving" || autosaveState === "pending" ? (
                    <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {autosaveMessage}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setActiveTab("preview")}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button variant="outline" onClick={() => void handleSaveModule("draft")} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save as Draft
            </Button>
            <Button onClick={() => void handleSaveModule("finalized")} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Finalize
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden border-border/70">
          <div className="grid gap-0 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-5 p-6">
              <div className="space-y-2">
                <Label htmlFor="module-title">Module Title</Label>
                <Input
                  id="module-title"
                  value={formData.title}
                  onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Enter the module title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="module-description">Description</Label>
                <Textarea
                  id="module-description"
                  rows={4}
                  value={formData.description}
                  onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Summarize what learners will gain from this module"
                />
              </div>
            </div>

            <div className="border-l bg-muted/30 p-6">
              <div className="space-y-3">
                <Label>Thumbnail Image</Label>
                {formData.module_thumbnail ? (
                  <img src={formData.module_thumbnail} alt={formData.title || "Module thumbnail"} className="h-48 w-full rounded-xl border object-cover" />
                ) : (
                  <div className="flex h-48 w-full items-center justify-center rounded-xl border border-dashed bg-background text-muted-foreground">
                    <div className="text-center">
                      <ImageIcon className="mx-auto mb-2 h-8 w-8" />
                      <p className="text-sm">Add a thumbnail to improve module discoverability.</p>
                    </div>
                  </div>
                )}
                <Input
                  value={formData.module_thumbnail}
                  onChange={(event) => setFormData((current) => ({ ...current, module_thumbnail: event.target.value }))}
                  placeholder="Paste a thumbnail URL"
                />
                <div>
                  <input
                    id="module-thumbnail-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void handleModuleAssetUpload("module_thumbnail", file);
                      event.target.value = "";
                    }}
                  />
                  <Button variant="outline" type="button" onClick={() => document.getElementById("module-thumbnail-upload")?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingAssetKey === "module_thumbnail" ? "Uploading..." : "Upload Thumbnail"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EditorTab)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">
              <LayoutPanelTop className="mr-2 h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Content Blocks</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                      Practice quizzes live here for inline learner feedback only. Use the dedicated course assessment manager from the module list page to manage scored questions, passing rules, and prerequisite-based unlocks.
                    </div>
                    {contentBlocks.length > 0 ? (
                      <div className="space-y-4">
                        {contentBlocks.map((block, index) => (
                          <ContentBlockComponent
                            key={block.id}
                            block={block}
                            index={index}
                            onUpdate={(updatedBlock) => {
                              setContentBlocks((current) => current.map((candidate) => (candidate.id === updatedBlock.id ? updatedBlock : candidate)));
                            }}
                            onDelete={(blockId) => {
                              setContentBlocks((current) => current.filter((candidate) => candidate.id !== blockId));
                            }}
                            onMove={(blockId, direction) => {
                              setContentBlocks((current) => {
                                const currentIndex = current.findIndex((candidate) => candidate.id === blockId);
                                const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
                                if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
                                const reordered = [...current];
                                [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];
                                return reordered;
                              });
                            }}
                            onUploadAsset={handleBlockAssetUpload}
                            uploadingAssetKey={uploadingAssetKey}
                            canMoveUp={index > 0}
                            canMoveDown={index < contentBlocks.length - 1}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                        Select a content type from the panel to start building this module.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="xl:sticky xl:top-6">
                <CardHeader>
                  <CardTitle>Add Content Block</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {BLOCK_TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-start gap-3 px-3 py-3 text-left"
                        onClick={() => setContentBlocks((current) => [...current, createEmptyBlock(option.value)])}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{option.label}</span>
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Module Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Module Document</Label>
                  <Input
                    value={formData.module_document}
                    onChange={(event) => setFormData((current) => ({ ...current, module_document: event.target.value }))}
                    placeholder="Paste a module document URL"
                  />
                  <div>
                    <input
                      id="module-document-upload"
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.webm,image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        void handleModuleAssetUpload("module_document", file);
                        event.target.value = "";
                      }}
                    />
                    <Button variant="outline" type="button" onClick={() => document.getElementById("module-document-upload")?.click()}>
                      <Upload className="mr-2 h-4 w-4" />
                      {uploadingAssetKey === "module_document" ? "Uploading..." : "Upload Document"}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Learning Materials</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newMaterial}
                      onChange={(event) => setNewMaterial(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addMaterial();
                        }
                      }}
                      placeholder="Paste an external resource or downloadable URL"
                    />
                    <Button type="button" variant="outline" onClick={addMaterial}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.materials.map((material) => (
                      <Badge key={material} variant="secondary" className="gap-2">
                        {material}
                        <button type="button" onClick={() => removeMaterial(material)} aria-label={`Remove ${material}`}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <TaxonomyTagField
                  label="Module Skill Tags"
                  options={inheritedSkillOptions}
                  values={formData.skillTags}
                  onChange={(skillTags) => setFormData((current) => ({ ...current, skillTags }))}
                  placeholder={inheritedSkillOptions.length > 0 ? "Select course skill tags" : "Add skill tags on the course first"}
                  description="Module skill tags inherit from the parent course so module metadata stays aligned with course taxonomy."
                  termType="skill_tag"
                  allowCreate={false}
                  restrictToOptions
                />

                <TaxonomyTagField
                  label="Module Topic Tags"
                  options={inheritedTopicOptions}
                  values={formData.topicTags}
                  onChange={(topicTags) => setFormData((current) => ({ ...current, topicTags }))}
                  placeholder={inheritedTopicOptions.length > 0 ? "Select course topic tags" : "Add topic tags on the course first"}
                  description="Module topic tags inherit from the parent course so reporting stays consistent from course down to module level."
                  termType="topic_tag"
                  allowCreate={false}
                  restrictToOptions
                />

                <Separator />

                <div className="space-y-3">
                  <Label>Prerequisites</Label>
                  <div className="space-y-2">
                    {modules.filter((module) => module.id !== editingModule?.id).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No other modules are available for prerequisite selection yet.</p>
                    ) : (
                      modules
                        .filter((module) => module.id !== editingModule?.id)
                        .map((module) => (
                          <label key={module.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                            <input
                              type="checkbox"
                              checked={formData.prerequisites.includes(module.id)}
                              onChange={(event) => {
                                setFormData((current) => ({
                                  ...current,
                                  prerequisites: event.target.checked
                                    ? [...current.prerequisites, module.id]
                                    : current.prerequisites.filter((candidate) => candidate !== module.id),
                                }));
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <ModulePreview module={previewModule} allModules={modules} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ModuleEditorPage;