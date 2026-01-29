import { useState, useEffect, useCallback } from "react";
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
import { X, Plus, GripVertical, Edit, Trash2, Copy, MoreVertical, BookOpen, Eye, FileText, FileQuestion, Clock, Target, CheckCircle2 } from "lucide-react";
import { Module, Course } from "@/types";
import { moduleService } from "@/services/supabaseDatabaseService";
import { assessmentService, Assessment, AssessmentQuestion } from "@/services/assessmentService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./RichTextEditor";
import { ContentBlockComponent, ContentBlock, ContentBlockType } from "./ContentBlock";
import { ModulePreview } from "./ModulePreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

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
  const [assessmentQuestions, setAssessmentQuestions] = useState<AssessmentQuestion[]>([]);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
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
    options: [""] as string[],
    correctAnswer: "",
    points: 1,
    explanation: "",
  });

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
    });
    setContentBlocks([]);
    setEditingModule(null);
    setNewMaterial("");
    setPreviewMode(false);
    setUseRichEditor(true);
    setUseContentBlocks(false);
    setActiveTab("edit");
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
    setEditingQuestion(null);
    setQuestionFormData({
      question: "",
      questionType: "multiple_choice",
      options: [""],
      correctAnswer: "",
      points: 1,
      explanation: "",
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
    });
    
    // Try to parse content blocks
    try {
      const parsed = JSON.parse(module.content || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) {
        setContentBlocks(parsed);
        setUseContentBlocks(true);
        setUseRichEditor(false);
      } else {
        setContentBlocks([]);
        setUseContentBlocks(false);
        setUseRichEditor(true);
      }
    } catch {
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
        });
        const questions = await assessmentService.getAssessmentQuestions(assessment.id);
        setAssessmentQuestions(questions);
      } else {
        setCurrentAssessment(null);
        setAssessmentQuestions([]);
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
        order: modules.length + 1,
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
        });
        toast.success("Module updated successfully");
      } else {
        await moduleService.createModule({
          course_id: course.id,
          title: formData.title,
          description: formData.description,
          content: finalContent || undefined,
          materials: formData.materials,
          prerequisites: formData.prerequisites,
          order: modules.length + 1,
        });
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
    const newBlock: ContentBlock = {
      id: Date.now().toString(),
      type,
      content: "",
      ...(type === "code" && { language: "javascript" }),
      ...(type === "quiz" && { title: "", options: [""], correctAnswer: 0 }),
      ...(type === "video" && { videoUrl: "" }),
    };
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

    setLoading(true);
    try {
      if (currentAssessment) {
        await assessmentService.updateAssessment(currentAssessment.id, assessmentFormData);
        toast.success("Assessment updated successfully");
      } else {
        const newAssessment = await assessmentService.createAssessment(editingModule.id, assessmentFormData);
        setCurrentAssessment(newAssessment);
        toast.success("Assessment created successfully");
      }
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
      setAssessmentQuestions([]);
      setAssessmentFormData({
        title: "",
        description: "",
        timeLimit: undefined,
        passingScore: 70,
        maxAttempts: 3,
        isActive: true,
      });
    } catch (error) {
      console.error("Error deleting assessment:", error);
      toast.error("Failed to delete assessment");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuestion = async () => {
    if (!currentAssessment) {
      toast.error("Please create an assessment first");
      return;
    }
    if (!questionFormData.question.trim()) {
      toast.error("Please enter a question");
      return;
    }

    setLoading(true);
    try {
      if (editingQuestion) {
        await assessmentService.updateQuestion(editingQuestion.id, {
          question: questionFormData.question,
          questionType: questionFormData.questionType,
          options: questionFormData.questionType === "multiple_choice" ? questionFormData.options : undefined,
          correctAnswer: questionFormData.correctAnswer || undefined,
          points: questionFormData.points,
          explanation: questionFormData.explanation || undefined,
        });
        toast.success("Question updated successfully");
      } else {
        await assessmentService.createQuestion(currentAssessment.id, {
          question: questionFormData.question,
          questionType: questionFormData.questionType,
          options: questionFormData.questionType === "multiple_choice" ? questionFormData.options : undefined,
          correctAnswer: questionFormData.correctAnswer || undefined,
          points: questionFormData.points,
          order: assessmentQuestions.length,
          explanation: questionFormData.explanation || undefined,
        });
        toast.success("Question added successfully");
      }
      await loadModuleAssessment(editingModule!.id);
      setEditingQuestion(null);
      setQuestionFormData({
        question: "",
        questionType: "multiple_choice",
        options: [""],
        correctAnswer: "",
        points: 1,
        explanation: "",
      });
    } catch (error) {
      console.error("Error saving question:", error);
      toast.error("Failed to save question");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    setLoading(true);
    try {
      await assessmentService.deleteQuestion(questionId);
      toast.success("Question deleted successfully");
      await loadModuleAssessment(editingModule!.id);
    } catch (error) {
      console.error("Error deleting question:", error);
      toast.error("Failed to delete question");
    } finally {
      setLoading(false);
    }
  };

  const handleEditQuestion = (question: AssessmentQuestion) => {
    setEditingQuestion(question);
    setQuestionFormData({
      question: question.question,
      questionType: question.questionType,
      options: question.options || [""],
      correctAnswer: question.correctAnswer || "",
      points: question.points,
      explanation: question.explanation || "",
    });
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
                        </CardContent>
                      </Card>

                      {/* Questions Section */}
                      {currentAssessment && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Questions ({assessmentQuestions.length})</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Question Form */}
                            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                              <div className="space-y-2">
                                <Label>Question</Label>
                                <Textarea
                                  value={questionFormData.question}
                                  onChange={(e) =>
                                    setQuestionFormData({ ...questionFormData, question: e.target.value })
                                  }
                                  placeholder="Enter question..."
                                  rows={2}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Question Type</Label>
                                  <Select
                                    value={questionFormData.questionType}
                                    onValueChange={(value: any) => {
                                      setQuestionFormData({
                                        ...questionFormData,
                                        questionType: value,
                                        options: value === "multiple_choice" ? [""] : [],
                                        correctAnswer: "",
                                      });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                      <SelectItem value="true_false">True/False</SelectItem>
                                      <SelectItem value="short_answer">Short Answer</SelectItem>
                                      <SelectItem value="essay">Essay</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label>Points</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={questionFormData.points}
                                    onChange={(e) =>
                                      setQuestionFormData({
                                        ...questionFormData,
                                        points: parseInt(e.target.value) || 1,
                                      })
                                    }
                                  />
                                </div>
                              </div>

                              {/* Multiple Choice Options */}
                              {questionFormData.questionType === "multiple_choice" && (
                                <div className="space-y-2">
                                  <Label>Options</Label>
                                  {questionFormData.options.map((option, idx) => (
                                    <div key={idx} className="flex gap-2">
                                      <Input
                                        value={option}
                                        onChange={(e) => {
                                          const newOptions = [...questionFormData.options];
                                          newOptions[idx] = e.target.value;
                                          setQuestionFormData({ ...questionFormData, options: newOptions });
                                        }}
                                        placeholder={`Option ${idx + 1}`}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const newOptions = questionFormData.options.filter((_, i) => i !== idx);
                                          setQuestionFormData({ ...questionFormData, options: newOptions });
                                        }}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setQuestionFormData({
                                        ...questionFormData,
                                        options: [...questionFormData.options, ""],
                                      });
                                    }}
                                  >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add Option
                                  </Button>

                                  <div className="space-y-2">
                                    <Label>Correct Answer</Label>
                                    <Select
                                      value={questionFormData.correctAnswer}
                                      onValueChange={(value) =>
                                        setQuestionFormData({ ...questionFormData, correctAnswer: value })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select correct answer" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {questionFormData.options.map((_, idx) => (
                                          <SelectItem key={idx} value={idx.toString()}>
                                            Option {idx + 1}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              )}

                              {/* True/False Options */}
                              {questionFormData.questionType === "true_false" && (
                                <div className="space-y-2">
                                  <Label>Correct Answer</Label>
                                  <Select
                                    value={questionFormData.correctAnswer}
                                    onValueChange={(value) =>
                                      setQuestionFormData({ ...questionFormData, correctAnswer: value })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select correct answer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="true">True</SelectItem>
                                      <SelectItem value="false">False</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* Short Answer / Essay */}
                              {(questionFormData.questionType === "short_answer" ||
                                questionFormData.questionType === "essay") && (
                                <div className="space-y-2">
                                  <Label>Expected Answer (optional, for reference)</Label>
                                  <Input
                                    value={questionFormData.correctAnswer}
                                    onChange={(e) =>
                                      setQuestionFormData({ ...questionFormData, correctAnswer: e.target.value })
                                    }
                                    placeholder="Expected answer (for manual grading)"
                                  />
                                </div>
                              )}

                              <div className="space-y-2">
                                <Label>Explanation (optional)</Label>
                                <Textarea
                                  value={questionFormData.explanation}
                                  onChange={(e) =>
                                    setQuestionFormData({ ...questionFormData, explanation: e.target.value })
                                  }
                                  placeholder="Explanation shown after answering..."
                                  rows={2}
                                />
                              </div>

                              <div className="flex gap-2">
                                <Button onClick={handleSaveQuestion} disabled={loading} className="flex-1">
                                  {editingQuestion ? "Update Question" : "Add Question"}
                                </Button>
                                {editingQuestion && (
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setEditingQuestion(null);
                                      setQuestionFormData({
                                        question: "",
                                        questionType: "multiple_choice",
                                        options: [""],
                                        correctAnswer: "",
                                        points: 1,
                                        explanation: "",
                                      });
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Questions List */}
                            {assessmentQuestions.length > 0 ? (
                              <div className="space-y-2">
                                {assessmentQuestions.map((question, idx) => (
                                  <Card key={question.id}>
                                    <CardContent className="p-4">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Badge variant="outline">Q{idx + 1}</Badge>
                                            <Badge variant="secondary">{question.questionType}</Badge>
                                            <Badge variant="outline">{question.points} pts</Badge>
                                          </div>
                                          <p className="font-medium mb-2">{question.question}</p>
                                          {question.options && question.options.length > 0 && (
                                            <div className="text-sm text-muted-foreground space-y-1">
                                              {question.options.map((opt, optIdx) => (
                                                <div key={optIdx} className="flex items-center gap-2">
                                                  <span>{optIdx + 1}.</span>
                                                  <span className={optIdx.toString() === question.correctAnswer ? "font-semibold text-primary" : ""}>
                                                    {opt}
                                                  </span>
                                                  {optIdx.toString() === question.correctAnswer && (
                                                    <CheckCircle2 className="w-4 h-4 text-primary" />
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {question.explanation && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                              <strong>Explanation:</strong> {question.explanation}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditQuestion(question)}
                                          >
                                            <Edit className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteQuestion(question.id)}
                                            className="text-destructive"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                                <FileQuestion className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>No questions yet. Add questions above.</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
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
