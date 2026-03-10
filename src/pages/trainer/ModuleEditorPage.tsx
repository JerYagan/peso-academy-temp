import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  Edit,
} from "lucide-react";
import { courseService, moduleService } from "@/services/supabaseDatabaseService";
import { assessmentService, type Assessment, type AssessmentQuestion } from "@/services/assessmentService";
import { ContentBlockComponent, type ContentBlock, type ContentBlockType } from "@/components/course/ContentBlock";
import { ModulePreview } from "@/components/course/ModulePreview";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Course, Module } from "@/types";

type EditorTab = "content" | "settings" | "preview";
type UploadField = "module_thumbnail" | "module_document";

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
  const base: ContentBlock = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    content: "",
  };

  if (type === "quiz") {
    return {
      ...base,
      options: ["", ""],
      correctAnswer: 0,
    };
  }

  return base;
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
  const [activeTab, setActiveTab] = useState<EditorTab>("content");
  const [uploadingAssetKey, setUploadingAssetKey] = useState<string | null>(null);
  const [newMaterial, setNewMaterial] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    materials: [] as string[],
    prerequisites: [] as string[],
    module_thumbnail: "",
    module_document: "",
  });
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);

  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null);
  const [assessmentQuestions, setAssessmentQuestions] = useState<AssessmentQuestion[]>([]);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentFormData, setAssessmentFormData] = useState({
    title: "",
    description: "",
    timeLimit: undefined as number | undefined,
    passingScore: 70,
    maxAttempts: 3,
    isActive: true,
  });
  const [editingQuestion, setEditingQuestion] = useState<AssessmentQuestion | null>(null);
  const [questionFormData, setQuestionFormData] = useState({
    question: "",
    questionType: "multiple_choice" as "multiple_choice" | "true_false" | "short_answer" | "essay",
    options: ["", ""],
    correctAnswer: "",
    points: 1,
    explanation: "",
  });

  const loadModuleAssessment = useCallback(async (targetModuleId: string) => {
    setAssessmentLoading(true);
    try {
      const assessment = await assessmentService.getAssessmentByModule(targetModuleId);
      if (!assessment) {
        setCurrentAssessment(null);
        setAssessmentQuestions([]);
        setAssessmentFormData({
          title: "",
          description: "",
          timeLimit: undefined,
          passingScore: 70,
          maxAttempts: 3,
          isActive: true,
        });
        return;
      }

      setCurrentAssessment(assessment);
      setAssessmentFormData({
        title: assessment.title,
        description: assessment.description || "",
        timeLimit: assessment.timeLimit || undefined,
        passingScore: assessment.passingScore,
        maxAttempts: assessment.maxAttempts,
        isActive: assessment.isActive,
      });
      const questions = await assessmentService.getAssessmentQuestions(assessment.id);
      setAssessmentQuestions(questions);
    } catch (error) {
      console.error("Error loading assessment:", error);
      toast.error("Failed to load module assessment");
    } finally {
      setAssessmentLoading(false);
    }
  }, []);

  const loadEditor = useCallback(async () => {
    if (!courseId) return;

    setLoading(true);
    try {
      const [courseRecord, courseModules] = await Promise.all([
        courseService.getCourse(courseId),
        moduleService.getModulesByCourse(courseId),
      ]);

      if (!courseRecord) {
        toast.error("Course not found");
        navigate(basePath);
        return;
      }

      setCourse(courseRecord);
      setModules(courseModules);

      if (!moduleId) {
        setEditingModule(null);
        setContentBlocks([createEmptyBlock("text")]);
        setFormData({
          title: "",
          description: "",
          materials: [],
          prerequisites: [],
          module_thumbnail: "",
          module_document: "",
        });
        setCurrentAssessment(null);
        setAssessmentQuestions([]);
        return;
      }

      const existingModule = await moduleService.getModule(moduleId);
      if (!existingModule) {
        toast.error("Module not found");
        navigate(`${basePath}/${courseId}/modules`);
        return;
      }

      setEditingModule(existingModule);
      setFormData({
        title: existingModule.title,
        description: existingModule.description,
        materials: existingModule.materials || [],
        prerequisites: existingModule.prerequisites || [],
        module_thumbnail: existingModule.module_thumbnail || "",
        module_document: existingModule.module_document || "",
      });

      if (existingModule.content) {
        try {
          const parsed = JSON.parse(existingModule.content);
          if (Array.isArray(parsed)) {
            setContentBlocks(parsed);
          } else {
            setContentBlocks([{ ...createEmptyBlock("text"), title: "Content", content: existingModule.content }]);
          }
        } catch {
          setContentBlocks([{ ...createEmptyBlock("text"), title: "Content", content: existingModule.content }]);
        }
      } else {
        setContentBlocks([createEmptyBlock("text")]);
      }

      await loadModuleAssessment(existingModule.id);
    } catch (error) {
      console.error("Error loading module editor:", error);
      toast.error("Failed to load module editor");
      navigate(`${basePath}/${courseId}/modules`);
    } finally {
      setLoading(false);
    }
  }, [basePath, courseId, loadModuleAssessment, moduleId, navigate]);

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
    module_thumbnail: formData.module_thumbnail || undefined,
    module_document: formData.module_document || undefined,
    created_at: editingModule?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: editingModule?.status || "draft",
  }), [contentBlocks, courseId, editingModule, formData, modules.length]);

  const addMaterial = () => {
    if (!newMaterial.trim() || formData.materials.includes(newMaterial.trim())) return;
    setFormData((current) => ({ ...current, materials: [...current.materials, newMaterial.trim()] }));
    setNewMaterial("");
  };

  const removeMaterial = (material: string) => {
    setFormData((current) => ({ ...current, materials: current.materials.filter((item) => item !== material) }));
  };

  const handleSaveModule = async (status: "draft" | "finalized") => {
    if (!courseId) return;
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Title and description are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        course_id: courseId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        order: editingModule?.order || (modules.length > 0 ? Math.max(...modules.map((module) => module.order)) + 1 : 1),
        content: JSON.stringify(contentBlocks),
        materials: formData.materials,
        prerequisites: formData.prerequisites,
        module_thumbnail: formData.module_thumbnail || undefined,
        module_document: formData.module_document || undefined,
        status,
      };

      if (editingModule) {
        const updatedModule = await moduleService.updateModule(editingModule.id, payload);
        setEditingModule(updatedModule);
        setModules((current) => current.map((module) => (module.id === updatedModule.id ? updatedModule : module)));
        toast.success(status === "finalized" ? "Module finalized" : "Module saved as draft");
      } else {
        const createdModule = await moduleService.createModule(payload as Omit<Module, "id" | "created_at">);
        toast.success(status === "finalized" ? "Module created and finalized" : "Module saved as draft");
        navigate(`${basePath}/${courseId}/modules/${createdModule.id}/edit`, { replace: true });
        return;
      }
    } catch (error) {
      console.error("Error saving module:", error);
      toast.error(editingModule ? "Failed to update module" : "Failed to create module");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAssessment = async () => {
    if (!editingModule) return;
    if (!assessmentFormData.title.trim()) {
      toast.error("Assessment title is required");
      return;
    }

    setSaving(true);
    try {
      if (currentAssessment) {
        await assessmentService.updateAssessment(currentAssessment.id, {
          title: assessmentFormData.title,
          description: assessmentFormData.description || undefined,
          timeLimit: assessmentFormData.timeLimit,
          passingScore: assessmentFormData.passingScore,
          maxAttempts: assessmentFormData.maxAttempts,
          isActive: assessmentFormData.isActive,
        });
      } else {
        await assessmentService.createAssessment(editingModule.id, {
          title: assessmentFormData.title,
          description: assessmentFormData.description || undefined,
          timeLimit: assessmentFormData.timeLimit,
          passingScore: assessmentFormData.passingScore,
          maxAttempts: assessmentFormData.maxAttempts,
        });
      }
      toast.success(currentAssessment ? "Assessment updated" : "Assessment created");
      await loadModuleAssessment(editingModule.id);
    } catch (error) {
      console.error("Error saving assessment:", error);
      toast.error("Failed to save assessment");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssessment = async () => {
    if (!currentAssessment || !editingModule) return;

    setSaving(true);
    try {
      await assessmentService.deleteAssessment(currentAssessment.id);
      toast.success("Assessment deleted");
      await loadModuleAssessment(editingModule.id);
    } catch (error) {
      console.error("Error deleting assessment:", error);
      toast.error("Failed to delete assessment");
    } finally {
      setSaving(false);
    }
  };

  const resetQuestionForm = () => {
    setEditingQuestion(null);
    setQuestionFormData({
      question: "",
      questionType: "multiple_choice",
      options: ["", ""],
      correctAnswer: "",
      points: 1,
      explanation: "",
    });
  };

  const handleSaveQuestion = async () => {
    if (!currentAssessment) return;
    if (!questionFormData.question.trim()) {
      toast.error("Question text is required");
      return;
    }

    if (questionFormData.questionType === "multiple_choice" && questionFormData.options.filter((option) => option.trim()).length < 2) {
      toast.error("Multiple choice questions need at least two options");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        question: questionFormData.question,
        questionType: questionFormData.questionType,
        options: questionFormData.questionType === "multiple_choice" ? questionFormData.options : undefined,
        correctAnswer: questionFormData.correctAnswer,
        points: questionFormData.points,
        explanation: questionFormData.explanation || undefined,
      };

      if (editingQuestion) {
        await assessmentService.updateQuestion(editingQuestion.id, payload);
        toast.success("Question updated");
      } else {
        await assessmentService.createQuestion(currentAssessment.id, payload);
        toast.success("Question added");
      }

      if (editingModule) {
        await loadModuleAssessment(editingModule.id);
      }
      resetQuestionForm();
    } catch (error) {
      console.error("Error saving question:", error);
      toast.error("Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!editingModule) return;
    setSaving(true);
    try {
      await assessmentService.deleteQuestion(questionId);
      toast.success("Question deleted");
      await loadModuleAssessment(editingModule.id);
    } catch (error) {
      console.error("Error deleting question:", error);
      toast.error("Failed to delete question");
    } finally {
      setSaving(false);
    }
  };

  const handleEditQuestion = (question: AssessmentQuestion) => {
    setEditingQuestion(question);
    setQuestionFormData({
      question: question.question,
      questionType: question.questionType,
      options: question.options || ["", ""],
      correctAnswer: question.correctAnswer || "",
      points: question.points,
      explanation: question.explanation || "",
    });
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
              <Card>
                <CardHeader>
                  <CardTitle>Content Blocks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Assessment</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {editingModule ? "Configure the module assessment, time limit, scoring, and questions." : "Save the module first to configure an assessment."}
                    </p>
                  </div>
                  {currentAssessment && editingModule && (
                    <Button variant="destructive" onClick={() => void handleDeleteAssessment()} disabled={saving}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Assessment
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {!editingModule ? (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    Create the module as a draft first. Once it exists, this tab will let you define the assessment and add questions.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label>Assessment Title</Label>
                        <Input
                          value={assessmentFormData.title}
                          onChange={(event) => setAssessmentFormData((current) => ({ ...current, title: event.target.value }))}
                          placeholder="Module assessment title"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Description</Label>
                        <Textarea
                          rows={3}
                          value={assessmentFormData.description}
                          onChange={(event) => setAssessmentFormData((current) => ({ ...current, description: event.target.value }))}
                          placeholder="Optional instructions or notes"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Time Limit (minutes)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={assessmentFormData.timeLimit || ""}
                          onChange={(event) =>
                            setAssessmentFormData((current) => ({
                              ...current,
                              timeLimit: event.target.value ? parseInt(event.target.value, 10) : undefined,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Passing Score (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={assessmentFormData.passingScore}
                          onChange={(event) =>
                            setAssessmentFormData((current) => ({
                              ...current,
                              passingScore: parseInt(event.target.value, 10) || 70,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Attempts</Label>
                        <Input
                          type="number"
                          min="1"
                          value={assessmentFormData.maxAttempts}
                          onChange={(event) =>
                            setAssessmentFormData((current) => ({
                              ...current,
                              maxAttempts: parseInt(event.target.value, 10) || 3,
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center gap-3 rounded-lg border p-3">
                        <Switch
                          checked={assessmentFormData.isActive}
                          onCheckedChange={(checked) => setAssessmentFormData((current) => ({ ...current, isActive: checked }))}
                        />
                        <div>
                          <p className="font-medium">Assessment Active</p>
                          <p className="text-sm text-muted-foreground">Learners can only take active assessments.</p>
                        </div>
                      </div>
                    </div>

                    <Button onClick={() => void handleSaveAssessment()} disabled={saving || assessmentLoading}>
                      {(saving || assessmentLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {currentAssessment ? "Update Assessment" : "Create Assessment"}
                    </Button>

                    {currentAssessment && (
                      <>
                        <Separator />
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">Questions</h3>
                              <p className="text-sm text-muted-foreground">{assessmentQuestions.length} total question(s)</p>
                            </div>
                            <Button variant="outline" onClick={resetQuestionForm}>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Question
                            </Button>
                          </div>

                          <div className="space-y-3">
                            {assessmentQuestions.map((question, index) => (
                              <Card key={question.id}>
                                <CardContent className="flex items-start justify-between gap-4 p-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline">Q{index + 1}</Badge>
                                      <Badge>{question.points} pts</Badge>
                                    </div>
                                    <p className="font-medium">{question.question}</p>
                                    <p className="text-sm capitalize text-muted-foreground">{question.questionType.replace("_", " ")}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleEditQuestion(question)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => void handleDeleteQuestion(question.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>

                          <Card>
                            <CardHeader>
                              <CardTitle>{editingQuestion ? "Edit Question" : "New Question"}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="space-y-2">
                                <Label>Question Type</Label>
                                <Select
                                  value={questionFormData.questionType}
                                  onValueChange={(value: "multiple_choice" | "true_false" | "short_answer" | "essay") =>
                                    setQuestionFormData((current) => ({
                                      ...current,
                                      questionType: value,
                                      options: value === "multiple_choice" ? (current.options.length > 0 ? current.options : ["", ""]) : [],
                                      correctAnswer: "",
                                    }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                    <SelectItem value="true_false">True or False</SelectItem>
                                    <SelectItem value="short_answer">Short Answer</SelectItem>
                                    <SelectItem value="essay">Essay</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Question</Label>
                                <Textarea
                                  rows={3}
                                  value={questionFormData.question}
                                  onChange={(event) => setQuestionFormData((current) => ({ ...current, question: event.target.value }))}
                                  placeholder="Write the assessment question"
                                />
                              </div>

                              {questionFormData.questionType === "multiple_choice" && (
                                <div className="space-y-3">
                                  <Label>Options</Label>
                                  {questionFormData.options.map((option, index) => (
                                    <div key={`${index}-${option}`} className="flex gap-2">
                                      <Input
                                        value={option}
                                        onChange={(event) => {
                                          setQuestionFormData((current) => ({
                                            ...current,
                                            options: current.options.map((candidate, candidateIndex) => candidateIndex === index ? event.target.value : candidate),
                                          }));
                                        }}
                                        placeholder={`Option ${index + 1}`}
                                      />
                                      {questionFormData.options.length > 2 && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          onClick={() => {
                                            setQuestionFormData((current) => ({
                                              ...current,
                                              options: current.options.filter((_, candidateIndex) => candidateIndex !== index),
                                            }));
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setQuestionFormData((current) => ({ ...current, options: [...current.options, ""] }))}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Option
                                  </Button>
                                  <div className="space-y-2">
                                    <Label>Correct Answer</Label>
                                    <Select
                                      value={questionFormData.correctAnswer}
                                      onValueChange={(value) => setQuestionFormData((current) => ({ ...current, correctAnswer: value }))}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select the correct answer" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {questionFormData.options.map((option, index) => (
                                          <SelectItem key={`${index}-${option || "empty"}`} value={option}>
                                            {option || `Option ${index + 1}`}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              )}

                              {(questionFormData.questionType === "true_false" || questionFormData.questionType === "short_answer" || questionFormData.questionType === "essay") && (
                                <div className="space-y-2">
                                  <Label>Correct Answer</Label>
                                  <Input
                                    value={questionFormData.correctAnswer}
                                    onChange={(event) => setQuestionFormData((current) => ({ ...current, correctAnswer: event.target.value }))}
                                    placeholder="Reference answer"
                                  />
                                </div>
                              )}

                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>Points</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={questionFormData.points}
                                    onChange={(event) => setQuestionFormData((current) => ({ ...current, points: parseInt(event.target.value, 10) || 1 }))}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Explanation</Label>
                                  <Input
                                    value={questionFormData.explanation}
                                    onChange={(event) => setQuestionFormData((current) => ({ ...current, explanation: event.target.value }))}
                                    placeholder="Optional learner feedback"
                                  />
                                </div>
                              </div>

                              <Button onClick={() => void handleSaveQuestion()} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingQuestion ? "Update Question" : "Save Question"}
                              </Button>
                            </CardContent>
                          </Card>
                        </div>
                      </>
                    )}
                  </>
                )}
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