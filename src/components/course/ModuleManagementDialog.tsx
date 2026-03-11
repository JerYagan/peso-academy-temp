import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { X, Plus, GripVertical, Edit, Trash2, Copy, MoreVertical, BookOpen, Eye, FileText, FileQuestion } from "lucide-react";
import { Module, Course } from "@/types";
import { moduleService } from "@/services/supabaseDatabaseService";
import { assessmentService, Assessment } from "@/services/assessmentService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./RichTextEditor";
import { ContentBlockComponent, ContentBlock, ContentBlockType } from "./ContentBlock";
import { DerivedAssessmentSummary } from "./DerivedAssessmentSummary";
import { ModulePreview } from "./ModulePreview";
import { TaxonomyTagField } from "./TaxonomyTagField";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createDefaultContentBlock, getQuizAssessmentSummary, parseModuleContentBlocks } from "@/lib/contentBlocks";
import { getAllowedSkillTagsForCategory, getAllowedTopicTagsForCategory } from "@/lib/taxonomy";

interface ModuleManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course;
  onSuccess?: () => void;
}

// Sortable Module Card Component
interface SortableModuleCardProps {
  module: Module;
  isEditing: boolean;
  onEdit: (module: Module) => void;
  onDelete: (moduleId: string) => void;
  onDuplicate: (module: Module) => void;
  prerequisites: Module[];
}

const SortableModuleCard = ({
  module,
  isEditing,
  onEdit,
  onDelete,
  onDuplicate,
  prerequisites,
}: SortableModuleCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const prereqNames = prerequisites
    .filter((p) => module.prerequisites.includes(p.id))
    .map((p) => p.title);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group cursor-move transition-all hover:shadow-md",
        isEditing && "ring-2 ring-primary",
        isDragging && "shadow-lg"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="mt-1 p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Module Number Badge */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
              {module.order}
            </div>

            {/* Module Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-base leading-tight mb-1">{module.title}</h4>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{module.description}</p>
              
              {/* Prerequisites */}
              {prereqNames.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {prereqNames.map((name, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      Requires: {name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Materials Count */}
              {module.materials.length > 0 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <BookOpen className="w-3 h-3" />
                  <span>{module.materials.length} material{module.materials.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(module)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(module)}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(module.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
    </Card>
  );
};

export const ModuleManagementDialog = ({
  open,
  onOpenChange,
  course,
  onSuccess,
}: ModuleManagementDialogProps) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [deleteModuleId, setDeleteModuleId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    materials: [] as string[],
    prerequisites: [] as string[],
    skillTags: [] as string[],
    topicTags: [] as string[],
  });
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [useRichEditor, setUseRichEditor] = useState(true);
  const [useContentBlocks, setUseContentBlocks] = useState(false);
  const [newMaterial, setNewMaterial] = useState("");
  const [loadingModules, setLoadingModules] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview" | "assessment">("edit");
  
  // Assessment management state
  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [assessmentFormData, setAssessmentFormData] = useState({
    title: "",
    description: "",
    timeLimit: undefined as number | undefined,
    passingScore: 70,
    maxAttempts: 3,
    isActive: true,
    skillTags: [] as string[],
    topicTags: [] as string[],
  });
  const allowedSkillOptions = getAllowedSkillTagsForCategory(course.category);
  const allowedTopicOptions = getAllowedTopicTagsForCategory(course.category);
  const derivedAssessmentSummary = useMemo(() => getQuizAssessmentSummary(contentBlocks), [contentBlocks]);
  const nextModuleOrder = useMemo(() => {
    if (modules.length === 0) {
      return 1;
    }

    return Math.max(...modules.map((module) => module.order || 0)) + 1;
  }, [modules]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadModules = useCallback(async () => {
    setLoadingModules(true);
    try {
      const courseModules = await moduleService.getModulesByCourse(course.id);
      setModules(courseModules);
    } catch (error) {
      console.error("Error loading modules:", error);
      toast.error("Failed to load modules");
    } finally {
      setLoadingModules(false);
    }
  }, [course.id]);

  useEffect(() => {
    if (open && course.id) {
      loadModules();
    }
  }, [open, course.id, loadModules]);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      content: "",
      materials: [],
      prerequisites: [],
      skillTags: [],
      topicTags: [],
    });
    setContentBlocks([]);
    setEditingModule(null);
    setNewMaterial("");
    setPreviewMode(false);
    setUseRichEditor(true);
    setUseContentBlocks(false);
    setActiveTab("edit");
    setCurrentAssessment(null);
    setAssessmentFormData({
      title: "",
      description: "",
      timeLimit: undefined,
      passingScore: 70,
      maxAttempts: 3,
      isActive: true,
      skillTags: [],
      topicTags: [],
    });
  };

  const handleCreateModule = () => {
    resetForm();
    setEditingModule(null);
  };

  const handleEditModule = async (module: Module) => {
    setEditingModule(module);
    setFormData({
      title: module.title,
      description: module.description,
      content: module.content || "",
      materials: module.materials || [],
      prerequisites: module.prerequisites || [],
      skillTags: module.skillTags || [],
      topicTags: module.topicTags || [],
    });
    
    // Try to parse content blocks
    const parsedBlocks = parseModuleContentBlocks(module.content);
    if (parsedBlocks.length > 0) {
      setContentBlocks(parsedBlocks);
      setUseContentBlocks(true);
      setUseRichEditor(false);
    } else {
      setContentBlocks([]);
      setUseContentBlocks(false);
      setUseRichEditor(true);
    }
    
    setPreviewMode(false);
    
    // Load assessment for this module
    await loadModuleAssessment(module.id);
  };

  const loadModuleAssessment = async (moduleId: string) => {
    setLoadingAssessment(true);
    try {
      const assessment = await assessmentService.getAssessmentByModule(moduleId);
      if (assessment) {
        setCurrentAssessment(assessment);
        setAssessmentFormData({
          title: assessment.title,
          description: assessment.description || "",
          timeLimit: assessment.timeLimit,
          passingScore: assessment.passingScore,
          maxAttempts: assessment.maxAttempts,
          isActive: assessment.isActive,
          skillTags: assessment.skillTags || [],
          topicTags: assessment.topicTags || [],
        });
      } else {
        setCurrentAssessment(null);
      }
    } catch (error) {
      console.error("Error loading assessment:", error);
      // Don't show error if no assessment exists
    } finally {
      setLoadingAssessment(false);
    }
  };

  const handleDuplicateModule = async (module: Module) => {
    try {
      setLoading(true);
      const duplicatedModule = await moduleService.createModule({
        course_id: course.id,
        title: `${module.title} (Copy)`,
        description: module.description,
        content: module.content || undefined,
        materials: module.materials,
        prerequisites: module.prerequisites,
        skillTags: module.skillTags || [],
        topicTags: module.topicTags || [],
        order: nextModuleOrder,
      });
      toast.success("Module duplicated successfully");
      loadModules();
      onSuccess?.();
    } catch (error) {
      console.error("Error duplicating module:", error);
      toast.error("Failed to duplicate module");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveModule = async () => {
    if (!formData.title || !formData.description) {
      toast.error("Please fill in title and description");
      return;
    }
    if (formData.skillTags.length === 0 || formData.topicTags.length === 0) {
      toast.error("Please add at least one approved skill tag and one approved topic tag");
      return;
    }

    setLoading(true);
    try {
      // Determine content based on mode
      let finalContent = formData.content;
      if (useContentBlocks && contentBlocks.length > 0) {
        // Save content blocks as JSON
        finalContent = JSON.stringify(contentBlocks);
      }

      if (editingModule) {
        await moduleService.updateModule(editingModule.id, {
          title: formData.title,
          description: formData.description,
          content: finalContent || undefined,
          materials: formData.materials,
          prerequisites: formData.prerequisites,
          skillTags: formData.skillTags,
          topicTags: formData.topicTags,
        });
        if (derivedAssessmentSummary.readyForAssessment) {
          await assessmentService.syncDerivedAssessmentFromQuizBlocks(
            editingModule.id,
            formData.title,
            contentBlocks,
            {
              ...assessmentFormData,
              skillTags: assessmentFormData.skillTags.length > 0 ? assessmentFormData.skillTags : formData.skillTags,
              topicTags: assessmentFormData.topicTags.length > 0 ? assessmentFormData.topicTags : formData.topicTags,
            },
          );
        }
        toast.success("Module updated successfully");
      } else {
        const createdModule = await moduleService.createModule({
          course_id: course.id,
          title: formData.title,
          description: formData.description,
          content: finalContent || undefined,
          materials: formData.materials,
          prerequisites: formData.prerequisites,
          skillTags: formData.skillTags,
          topicTags: formData.topicTags,
          order: nextModuleOrder,
        });
        if (derivedAssessmentSummary.readyForAssessment) {
          await assessmentService.syncDerivedAssessmentFromQuizBlocks(
            createdModule.id,
            formData.title,
            contentBlocks,
            {
              ...assessmentFormData,
              skillTags: assessmentFormData.skillTags.length > 0 ? assessmentFormData.skillTags : formData.skillTags,
              topicTags: assessmentFormData.topicTags.length > 0 ? assessmentFormData.topicTags : formData.topicTags,
            },
          );
        }
        toast.success("Module created successfully");
      }
      resetForm();
      loadModules();
      onSuccess?.();
      // Don't close dialog - allow users to continue managing modules
    } catch (error) {
      console.error("Error saving module:", error);
      toast.error(editingModule ? "Failed to update module" : "Failed to create module");
    } finally {
      setLoading(false);
    }
  };

  const addContentBlock = (type: ContentBlockType) => {
    const newBlock = createDefaultContentBlock(type, Date.now().toString());
    setContentBlocks([...contentBlocks, newBlock]);
    setUseContentBlocks(true);
    setUseRichEditor(false);
  };

  const updateContentBlock = (updatedBlock: ContentBlock) => {
    setContentBlocks(contentBlocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)));
  };

  const deleteContentBlock = (id: string) => {
    setContentBlocks(contentBlocks.filter((b) => b.id !== id));
  };

  const moveContentBlock = (id: string, direction: "up" | "down") => {
    const index = contentBlocks.findIndex((b) => b.id === id);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= contentBlocks.length) return;

    const newBlocks = [...contentBlocks];
    [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
    setContentBlocks(newBlocks);
  };

  const handleDeleteModule = async () => {
    if (!deleteModuleId) return;

    setLoading(true);
    try {
      await moduleService.deleteModule(deleteModuleId);
      toast.success("Module deleted successfully");
      setDeleteModuleId(null);
      loadModules();
      onSuccess?.();
    } catch (error) {
      console.error("Error deleting module:", error);
      toast.error("Failed to delete module");
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);

    const reorderedModules = arrayMove(modules, oldIndex, newIndex);
    setModules(reorderedModules);

    // Update order values
    const moduleOrders = reorderedModules.map((m, idx) => ({
      id: m.id,
      order: idx + 1,
    }));

    try {
      await moduleService.reorderModules(course.id, moduleOrders);
      toast.success("Module order updated");
      onSuccess?.();
    } catch (error) {
      console.error("Error reordering modules:", error);
      toast.error("Failed to reorder modules");
      // Revert on error
      loadModules();
    }
  };

  const addMaterial = () => {
    if (newMaterial.trim() && !formData.materials.includes(newMaterial.trim())) {
      setFormData({ ...formData, materials: [...formData.materials, newMaterial.trim()] });
      setNewMaterial("");
    }
  };

  const removeMaterial = (material: string) => {
    setFormData({ ...formData, materials: formData.materials.filter((m) => m !== material) });
  };

  const togglePrerequisite = (moduleId: string) => {
    if (formData.prerequisites.includes(moduleId)) {
      setFormData({
        ...formData,
        prerequisites: formData.prerequisites.filter((id) => id !== moduleId),
      });
    } else {
      setFormData({
        ...formData,
        prerequisites: [...formData.prerequisites, moduleId],
      });
    }
  };

  // Assessment management functions
  const handleSaveAssessment = async () => {
    if (!editingModule) return;
    if (!assessmentFormData.title.trim()) {
      toast.error("Please enter an assessment title");
      return;
    }
    if (assessmentFormData.topicTags.length === 0) {
      toast.error("Please assign at least one approved topic tag to the assessment");
      return;
    }
    if (!derivedAssessmentSummary.readyForAssessment) {
      toast.error(derivedAssessmentSummary.invalidIssues[0]?.message || "Add at least one valid quiz block before saving assessment settings.");
      return;
    }

    setLoading(true);
    try {
      const syncedAssessment = await assessmentService.syncDerivedAssessmentFromQuizBlocks(
        editingModule.id,
        formData.title || editingModule.title,
        contentBlocks,
        assessmentFormData,
      );
      setCurrentAssessment(syncedAssessment);
      toast.success(currentAssessment ? "Assessment updated successfully" : "Assessment created successfully");
      await loadModuleAssessment(editingModule.id);
    } catch (error) {
      console.error("Error saving assessment:", error);
      toast.error("Failed to save assessment");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssessment = async () => {
    if (!currentAssessment) return;

    setLoading(true);
    try {
      await assessmentService.deleteAssessment(currentAssessment.id);
      toast.success("Assessment deleted successfully");
      setCurrentAssessment(null);
      setAssessmentFormData({
        title: "",
        description: "",
        timeLimit: undefined,
        passingScore: 70,
        maxAttempts: 3,
        isActive: true,
        skillTags: [],
        topicTags: [],
      });
    } catch (error) {
      console.error("Error deleting assessment:", error);
      toast.error("Failed to delete assessment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">Manage Modules - {course.title}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex gap-6">
            {/* Modules List - Sololearn Style */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Modules</h3>
                  <p className="text-sm text-muted-foreground">
                    {modules.length} {modules.length === 1 ? "module" : "modules"} • Drag to reorder
                  </p>
                </div>
                <Button onClick={handleCreateModule} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Module
                </Button>
              </div>

              <ScrollArea className="flex-1">
                {loadingModules ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <div className="animate-pulse">Loading modules...</div>
                  </div>
                ) : modules.length === 0 ? (
                  <div className="p-12 text-center">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mb-4">No modules yet</p>
                    <Button onClick={handleCreateModule} variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Create your first module
                    </Button>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3 pr-4">
                        {modules.map((module) => (
                          <SortableModuleCard
                            key={module.id}
                            module={module}
                            isEditing={editingModule?.id === module.id}
                            onEdit={handleEditModule}
                            onDelete={setDeleteModuleId}
                            onDuplicate={handleDuplicateModule}
                            prerequisites={modules}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </ScrollArea>
            </div>

            {/* Module Form Sidebar */}
            <div className="w-96 border-l pl-6 flex flex-col">
              <div className="mb-4">
                <h3 className="font-semibold text-lg mb-1">
                  {editingModule ? "Edit Module" : "Create Module"}
                </h3>
                {editingModule && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                    className="h-7 text-xs text-muted-foreground"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Create New Instead
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "edit" | "preview" | "assessment")}>
                  <TabsList className={cn("grid w-full mb-4", editingModule ? "grid-cols-3" : "grid-cols-2")}>
                    <TabsTrigger value="edit">
                      <FileText className="w-4 h-4 mr-2" />
                      Edit
                    </TabsTrigger>
                    <TabsTrigger value="preview">
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </TabsTrigger>
                    {editingModule && (
                      <TabsTrigger value="assessment">
                        <FileQuestion className="w-4 h-4 mr-2" />
                        Assessment
                      </TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="edit" className="space-y-4 pr-4 mt-0">
                    <div className="space-y-2">
                      <Label htmlFor="module-title">Title *</Label>
                      <Input
                        id="module-title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g., Introduction to JavaScript"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="module-description">Description *</Label>
                      <Textarea
                        id="module-description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Brief description of what learners will learn..."
                        rows={3}
                      />
                    </div>

                    <TaxonomyTagField
                      label="Module Skill Tags"
                      options={allowedSkillOptions}
                      values={formData.skillTags}
                      onChange={(skillTags) => setFormData({ ...formData, skillTags })}
                      placeholder="Select approved skill tags"
                      description="Use only approved skill tags so module analytics stay consistent across courses."
                    />

                    <TaxonomyTagField
                      label="Module Topic Tags"
                      options={allowedTopicOptions}
                      values={formData.topicTags}
                      onChange={(topicTags) => setFormData({ ...formData, topicTags })}
                      placeholder="Select approved topic tags"
                      description="Topic-level learner performance depends on these tags, not on free-text titles."
                    />

                    {/* Content Mode Toggle */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Content</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={useContentBlocks ? "outline" : "default"}
                            size="sm"
                            onClick={() => {
                              setUseContentBlocks(false);
                              setUseRichEditor(true);
                            }}
                          >
                            Rich Editor
                          </Button>
                          <Button
                            type="button"
                            variant={useContentBlocks ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setUseContentBlocks(true);
                              setUseRichEditor(false);
                            }}
                          >
                            Content Blocks
                          </Button>
                        </div>
                      </div>

                      {useContentBlocks ? (
                        <div className="space-y-3">
                          {/* Add Content Block Buttons */}
                          <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addContentBlock("text")}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Text
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addContentBlock("code")}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Code
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addContentBlock("video")}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Video
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addContentBlock("quiz")}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Quiz
                            </Button>
                          </div>

                          {/* Content Blocks */}
                          {contentBlocks.length > 0 ? (
                            <div className="space-y-3">
                              {contentBlocks.map((block, idx) => (
                                <ContentBlockComponent
                                  key={block.id}
                                  block={block}
                                  index={idx}
                                  onUpdate={updateContentBlock}
                                  onDelete={deleteContentBlock}
                                  onMove={moveContentBlock}
                                  canMoveUp={idx > 0}
                                  canMoveDown={idx < contentBlocks.length - 1}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground border rounded-lg">
                              <p>No content blocks yet. Add one above to get started.</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <RichTextEditor
                          content={formData.content}
                          onChange={(content) => setFormData({ ...formData, content })}
                          placeholder="Start typing your content here... e.g., Introduction to JavaScript"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Learning Materials</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newMaterial}
                          onChange={(e) => setNewMaterial(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addMaterial();
                            }
                          }}
                          placeholder="Material URL"
                        />
                        <Button type="button" onClick={addMaterial} variant="outline" size="sm">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      {formData.materials.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.materials.map((material) => (
                            <Badge key={material} variant="secondary" className="gap-1 pr-1">
                              <span className="max-w-[120px] truncate">{material}</span>
                              <button
                                type="button"
                                onClick={() => removeMaterial(material)}
                                className="ml-1 hover:text-destructive rounded-full p-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {modules.length > 0 && (
                      <div className="space-y-2">
                        <Label>Prerequisites</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Select modules that must be completed first
                        </p>
                        <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3 bg-muted/30">
                          {modules
                            .filter((m) => !editingModule || m.id !== editingModule.id)
                            .map((module) => (
                              <div key={module.id} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`prereq-${module.id}`}
                                  checked={formData.prerequisites.includes(module.id)}
                                  onChange={() => togglePrerequisite(module.id)}
                                  className="rounded"
                                />
                                <Label
                                  htmlFor={`prereq-${module.id}`}
                                  className="text-sm cursor-pointer flex-1"
                                >
                                  {module.order}. {module.title}
                                </Label>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                  </TabsContent>

                  <TabsContent value="preview" className="pr-4 mt-0">
                    <ModulePreview
                      module={{
                        title: formData.title || "Untitled Module",
                        description: formData.description || "",
                        content: useContentBlocks ? JSON.stringify(contentBlocks) : formData.content,
                        materials: formData.materials,
                        prerequisites: formData.prerequisites,
                        order: editingModule?.order || modules.length + 1,
                      }}
                      allModules={modules}
                    />
                  </TabsContent>

                  {editingModule && (
                    <TabsContent value="assessment" className="pr-4 mt-0 space-y-4">
                      {/* Assessment Settings */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Assessment Settings</CardTitle>
                            {currentAssessment && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleDeleteAssessment}
                                disabled={loading}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Assessment
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <DerivedAssessmentSummary contentBlocks={contentBlocks} />

                          <div className="space-y-2">
                            <Label htmlFor="assessment-title">Assessment Title *</Label>
                            <Input
                              id="assessment-title"
                              value={assessmentFormData.title}
                              onChange={(e) =>
                                setAssessmentFormData({ ...assessmentFormData, title: e.target.value })
                              }
                              placeholder="e.g., Module 1 Quiz"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="assessment-description">Description</Label>
                            <Textarea
                              id="assessment-description"
                              value={assessmentFormData.description}
                              onChange={(e) =>
                                setAssessmentFormData({ ...assessmentFormData, description: e.target.value })
                              }
                              placeholder="Assessment description..."
                              rows={2}
                            />
                          </div>

                          <TaxonomyTagField
                            label="Assessment Skill Tags"
                            options={allowedSkillOptions}
                            values={assessmentFormData.skillTags}
                            onChange={(skillTags) => setAssessmentFormData({ ...assessmentFormData, skillTags })}
                            placeholder="Select approved skill tags"
                            description="Keep assessment skill tags aligned with the approved course taxonomy."
                          />

                          <TaxonomyTagField
                            label="Assessment Topic Tags"
                            options={allowedTopicOptions}
                            values={assessmentFormData.topicTags}
                            onChange={(topicTags) => setAssessmentFormData({ ...assessmentFormData, topicTags })}
                            placeholder="Select approved topic tags"
                            description="Assessment topic tags are required for stable topic-performance analytics."
                          />

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="time-limit">Time Limit (minutes)</Label>
                              <Input
                                id="time-limit"
                                type="number"
                                min="0"
                                value={assessmentFormData.timeLimit || ""}
                                onChange={(e) =>
                                  setAssessmentFormData({
                                    ...assessmentFormData,
                                    timeLimit: e.target.value ? parseInt(e.target.value) : undefined,
                                  })
                                }
                                placeholder="No limit"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="passing-score">Passing Score (%)</Label>
                              <Input
                                id="passing-score"
                                type="number"
                                min="0"
                                max="100"
                                value={assessmentFormData.passingScore}
                                onChange={(e) =>
                                  setAssessmentFormData({
                                    ...assessmentFormData,
                                    passingScore: parseInt(e.target.value) || 70,
                                  })
                                }
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="max-attempts">Max Attempts</Label>
                            <Input
                              id="max-attempts"
                              type="number"
                              min="1"
                              value={assessmentFormData.maxAttempts}
                              onChange={(e) =>
                                setAssessmentFormData({
                                  ...assessmentFormData,
                                  maxAttempts: parseInt(e.target.value) || 3,
                                })
                              }
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            <Switch
                              id="is-active"
                              checked={assessmentFormData.isActive}
                              onCheckedChange={(checked) =>
                                setAssessmentFormData({ ...assessmentFormData, isActive: checked })
                              }
                            />
                            <Label htmlFor="is-active" className="cursor-pointer">
                              Active (visible to students)
                            </Label>
                          </div>

                          <Button onClick={handleSaveAssessment} disabled={loading} className="w-full">
                            {currentAssessment ? "Update Assessment" : "Create Assessment"}
                          </Button>

                          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            Quiz blocks in the Edit tab are now the source of assessment questions. This panel only stores assessment metadata such as passing score, time limit, attempts, active state, and taxonomy tags.
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  )}
                </Tabs>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Close
            </Button>
            <Button
              onClick={handleSaveModule}
              disabled={loading || !formData.title || !formData.description}
            >
              {loading ? "Saving..." : editingModule ? "Update Module" : "Create Module"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteModuleId} onOpenChange={(open) => !open && setDeleteModuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this module. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteModule}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
