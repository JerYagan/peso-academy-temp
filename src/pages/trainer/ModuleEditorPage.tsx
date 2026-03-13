import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { DerivedAssessmentSummary } from "@/components/course/DerivedAssessmentSummary";
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
import { assessmentService, type Assessment } from "@/services/assessmentService";
import { ContentBlockComponent, type ContentBlock, type ContentBlockType } from "@/components/course/ContentBlock";
import { ModulePreview } from "@/components/course/ModulePreview";
import { TaxonomyTagField } from "@/components/course/TaxonomyTagField";
import { useAuth } from "@/contexts/AuthContext";
import { createDefaultContentBlock, getQuizAssessmentSummary, parseModuleContentBlocks } from "@/lib/contentBlocks";
import { getAllowedSkillTagsForCategory, getAllowedTopicTagsForCategory } from "@/lib/taxonomy";
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
  return createDefaultContentBlock(type, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
};

const DEFAULT_ASSESSMENT_CONFIG = {
  passingScore: 70,
  maxAttempts: 3,
  allowRetryAfterPassing: false,
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
    skillTags: [] as string[],
    topicTags: [] as string[],
    module_thumbnail: "",
    module_document: "",
  });
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);

  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null);
  const [assessmentConfig, setAssessmentConfig] = useState(DEFAULT_ASSESSMENT_CONFIG);
  const allowedSkillOptions = getAllowedSkillTagsForCategory(course?.category);
  const allowedTopicOptions = getAllowedTopicTagsForCategory(course?.category);
  const derivedAssessmentSummary = useMemo(() => getQuizAssessmentSummary(contentBlocks), [contentBlocks]);

  const loadModuleAssessment = useCallback(async (targetModuleId: string) => {
    try {
      const assessment = await assessmentService.getAssessmentByModule(targetModuleId, {
        syncDerivedFromModuleContent: true,
      });
      setCurrentAssessment(assessment);
      setAssessmentConfig({
        passingScore: assessment?.passingScore ?? DEFAULT_ASSESSMENT_CONFIG.passingScore,
        maxAttempts: assessment?.maxAttempts ?? DEFAULT_ASSESSMENT_CONFIG.maxAttempts,
        allowRetryAfterPassing: assessment?.allowRetryAfterPassing ?? DEFAULT_ASSESSMENT_CONFIG.allowRetryAfterPassing,
      });
    } catch (error) {
      console.error("Error loading assessment:", error);
      toast.error("Failed to load module assessment");
      setAssessmentConfig(DEFAULT_ASSESSMENT_CONFIG);
    }
  }, []);

  const loadEditor = useCallback(async () => {
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
        setEditingModule(null);
        setFormData({
          title: "",
          description: "",
          materials: [],
          prerequisites: [],
          skillTags: [],
          topicTags: [],
          module_thumbnail: "",
          module_document: "",
        });
        setContentBlocks([]);
        setCurrentAssessment(null);
        setAssessmentConfig(DEFAULT_ASSESSMENT_CONFIG);
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
        skillTags: targetModule.skillTags || [],
        topicTags: targetModule.topicTags || [],
        module_thumbnail: targetModule.module_thumbnail || "",
        module_document: targetModule.module_document || "",
      });
      setContentBlocks(parseModuleContentBlocks(targetModule.content));
      await loadModuleAssessment(targetModule.id);
    } catch (error) {
      console.error("Error loading module editor:", error);
      toast.error("Failed to load module editor");
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
    skillTags: formData.skillTags,
    topicTags: formData.topicTags,
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
    if (formData.skillTags.length === 0 || formData.topicTags.length === 0) {
      toast.error("Modules must include at least one approved skill tag and one approved topic tag");
      return;
    }
    if (status === "finalized" && derivedAssessmentSummary.gradableQuizBlockCount > 0 && !derivedAssessmentSummary.readyForAssessment) {
      toast.error(derivedAssessmentSummary.invalidIssues[0]?.message || "Finalize requires at least one valid quiz block for the assessment.");
      return;
    }

    setSaving(true);
    try {
      let assessmentSyncWarning: string | null = null;

      const payload = {
        course_id: courseId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        order: editingModule?.order || (modules.length > 0 ? Math.max(...modules.map((module) => module.order)) + 1 : 1),
        content: JSON.stringify(contentBlocks),
        materials: formData.materials,
        prerequisites: formData.prerequisites,
        skillTags: formData.skillTags,
        topicTags: formData.topicTags,
        module_thumbnail: formData.module_thumbnail || undefined,
        module_document: formData.module_document || undefined,
        status,
      };

      const assessmentSettings = {
        title: currentAssessment?.title,
        description: currentAssessment?.description,
        timeLimit: currentAssessment?.timeLimit,
        passingScore: assessmentConfig.passingScore,
        maxAttempts: assessmentConfig.maxAttempts,
        allowRetryAfterPassing: assessmentConfig.allowRetryAfterPassing,
        isActive: currentAssessment?.isActive,
        skillTags: formData.skillTags,
        topicTags: formData.topicTags,
      };

      if (editingModule) {
        const updatedModule = await moduleService.updateModule(editingModule.id, payload);
        if (derivedAssessmentSummary.readyForAssessment || derivedAssessmentSummary.gradableQuizBlockCount === 0) {
          try {
            const syncedAssessment = await assessmentService.syncDerivedAssessmentFromQuizBlocks(
              updatedModule.id,
              payload.title,
              contentBlocks,
              assessmentSettings,
            );
            setCurrentAssessment(syncedAssessment);
          } catch (error) {
            console.error("Assessment sync failed after module update:", error);
            assessmentSyncWarning = "Module saved, but the quiz-derived assessment could not be synced. Review the quiz blocks and save again.";
          }
        }
        setEditingModule(updatedModule);
        setModules((current) => current.map((module) => (module.id === updatedModule.id ? updatedModule : module)));
        toast.success(status === "finalized" ? "Module finalized" : "Module saved as draft");
        if (assessmentSyncWarning) {
          toast.warning(assessmentSyncWarning);
        }
      } else {
        const createdModule = await moduleService.createModule(payload as Omit<Module, "id" | "created_at">);
        if (derivedAssessmentSummary.readyForAssessment || derivedAssessmentSummary.gradableQuizBlockCount === 0) {
          try {
            await assessmentService.syncDerivedAssessmentFromQuizBlocks(
              createdModule.id,
              payload.title,
              contentBlocks,
              assessmentSettings,
            );
          } catch (error) {
            console.error("Assessment sync failed after module creation:", error);
            assessmentSyncWarning = "Module created, but the quiz-derived assessment could not be synced yet. Review the quiz blocks and save again.";
          }
        }
        toast.success(status === "finalized" ? "Module created and finalized" : "Module saved as draft");
        if (assessmentSyncWarning) {
          toast.warning(assessmentSyncWarning);
        }
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
              <div className="space-y-6">
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

                <DerivedAssessmentSummary
                  contentBlocks={contentBlocks}
                  emptyMessage="Add graded quiz blocks here to generate the module assessment automatically."
                />

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Assessment Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Trainers and admins can tune how the quiz-derived module assessment behaves for trainees.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="assessment-passing-score">Passing Score (%)</Label>
                        <Input
                          id="assessment-passing-score"
                          type="number"
                          min={1}
                          max={100}
                          value={assessmentConfig.passingScore}
                          onChange={(event) => {
                            const nextValue = Number.parseInt(event.target.value, 10);
                            setAssessmentConfig((current) => ({
                              ...current,
                              passingScore: Number.isFinite(nextValue) ? Math.min(100, Math.max(1, nextValue)) : DEFAULT_ASSESSMENT_CONFIG.passingScore,
                            }));
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assessment-max-attempts">Allowed Attempts</Label>
                        <Input
                          id="assessment-max-attempts"
                          type="number"
                          min={1}
                          max={20}
                          value={assessmentConfig.maxAttempts}
                          onChange={(event) => {
                            const nextValue = Number.parseInt(event.target.value, 10);
                            setAssessmentConfig((current) => ({
                              ...current,
                              maxAttempts: Number.isFinite(nextValue) ? Math.min(20, Math.max(1, nextValue)) : DEFAULT_ASSESSMENT_CONFIG.maxAttempts,
                            }));
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border p-4">
                      <Checkbox
                        id="assessment-allow-retry-after-pass"
                        checked={assessmentConfig.allowRetryAfterPassing}
                        onCheckedChange={(checked) => {
                          setAssessmentConfig((current) => ({
                            ...current,
                            allowRetryAfterPassing: checked === true,
                          }));
                        }}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="assessment-allow-retry-after-pass">Allow retry after passing</Label>
                        <p className="text-sm text-muted-foreground">
                          When disabled, trainees stop getting new attempts as soon as they pass. When enabled, they can retry until they exhaust the configured attempt limit.
                        </p>
                      </div>
                    </div>
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
                  options={allowedSkillOptions}
                  values={formData.skillTags}
                  onChange={(skillTags) => setFormData((current) => ({ ...current, skillTags }))}
                  placeholder="Select approved skill tags"
                  description="Use approved skill tags only so trainer analytics and recommendations stay consistent."
                  termType="skill_tag"
                />

                <TaxonomyTagField
                  label="Module Topic Tags"
                  options={allowedTopicOptions}
                  values={formData.topicTags}
                  onChange={(topicTags) => setFormData((current) => ({ ...current, topicTags }))}
                  placeholder="Select approved topic tags"
                  description="Topic-level learner performance summaries and analytics use these tags directly."
                  termType="topic_tag"
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