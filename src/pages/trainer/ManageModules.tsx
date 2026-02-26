import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { X, Plus, GripVertical, Edit, Trash2, Copy, MoreVertical, BookOpen, Eye, FileText, FileQuestion, Clock, Target, CheckCircle2, ChevronLeft, Upload, Loader2 } from "lucide-react";
import { Module, Course } from "@/types";
import { moduleService, courseService } from "@/services/supabaseDatabaseService";
import { assessmentService, Assessment, AssessmentQuestion } from "@/services/assessmentService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/course/RichTextEditor";
import { ContentBlockComponent, ContentBlock, ContentBlockType } from "@/components/course/ContentBlock";
import { ModulePreview } from "@/components/course/ModulePreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// Sortable Module Card Component
interface SortableModuleCardProps {
  module: Module;
  isEditing: boolean;
  onEdit: (module: Module) => void;
  onDelete: (moduleId: string) => void;
  onDuplicate: (module: Module) => void;
  prerequisites: Module[];
  onPreview: () => void;
}

const SortableModuleCard = ({
  module,
  isEditing,
  onEdit,
  onDelete,
  onDuplicate,
  prerequisites,
  onPreview,
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

              {/* Status badge (Finalized / Saved as Draft) */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant={module.status === "finalized" ? "default" : "secondary"} className="text-xs">
                  {module.status === "finalized" ? "Finalized" : "Saved as Draft"}
                </Badge>
                {(() => {
                  let blockCount = 0;
                  if (module.content) {
                    try {
                      const parsed = JSON.parse(module.content);
                      if (Array.isArray(parsed)) blockCount = parsed.length;
                    } catch {}
                  }
                  if (blockCount > 0) {
                    return (
                      <span className="text-xs text-muted-foreground">
                        {blockCount} content block{blockCount !== 1 ? "s" : ""}
                      </span>
                    );
                  }
                  return null;
                })()}
                {(module.updated_at || module.created_at) && (
                  <span className="text-xs text-muted-foreground">
                    Last modified {new Date(module.updated_at || module.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>

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
              <DropdownMenuItem onClick={onPreview}>
                <Eye className="w-4 h-4 mr-2" />
                Preview
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

const ManageModules = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [previewModuleId, setPreviewModuleId] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
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
  const [activeTab, setActiveTab] = useState<"edit" | "assessment">("edit");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentDocumentUrl, setCurrentDocumentUrl] = useState<string | null>(null);
  
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

  // Load course data
  useEffect(() => {
    if (!user) return;
    
    const loadCourse = async () => {
      if (!courseId) {
        toast.error("Course ID is required");
        navigate(user.role === "admin" ? "/admin/courses" : "/trainer/courses");
        return;
      }

      try {
        const courseData = await courseService.getCourse(courseId);
        if (!courseData) {
          toast.error("Course not found");
          navigate(user.role === "admin" ? "/admin/courses" : "/trainer/courses");
          return;
        }
        setCourse(courseData);
      } catch (error) {
        console.error("Error loading course:", error);
        toast.error("Failed to load course");
        navigate(user.role === "admin" ? "/admin/courses" : "/trainer/courses");
      }
    };

    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, user]);

  const loadModules = useCallback(async () => {
    if (!courseId) return;
    
    setLoadingModules(true);
    try {
      const courseModules = await moduleService.getModulesByCourse(courseId);
      setModules(courseModules);
    } catch (error) {
      console.error("Error loading modules:", error);
      toast.error("Failed to load modules");
    } finally {
      setLoadingModules(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) {
      loadModules();
    }
  }, [courseId, loadModules]);

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
    setPreviewModuleId(null);
    setNewMaterial("");
    setPreviewMode(false);
    setUseRichEditor(true);
    setUseContentBlocks(false);
    setActiveTab("edit");
    setCurrentAssessment(null);
    setAssessmentQuestions([]);
    setSelectedFile(null);
    setCurrentDocumentUrl(null);
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

  const ACCEPTED_MODULE_FILE_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "video/mp4",
    "video/webm",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  const ACCEPTED_MODULE_FILE_EXT = [".pdf", ".pptx", ".mp4", ".webm", ".jpg", ".jpeg", ".png", ".webp", ".gif"];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    if (!ACCEPTED_MODULE_FILE_TYPES.includes(file.type) && !ACCEPTED_MODULE_FILE_EXT.includes(ext)) {
      toast.error("Please upload a file (PDF/PPTX), video (MP4/WebM), or image (JPG/PNG/WebP/GIF)");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size must be less than 100MB");
      return;
    }
    setSelectedFile(file);
    setCurrentDocumentUrl(null);
  };

  const handleEditModule = async (module: Module) => {
    setEditingModule(module);
    setPreviewModuleId(module.id);
    setCurrentDocumentUrl(module.module_document || null);
    setSelectedFile(null);
    setFormData({
      title: module.title,
      description: module.description,
      content: module.content || "",
      materials: module.materials || [],
      prerequisites: module.prerequisites || [],
    });

    // Parse content blocks if content is JSON
    if (module.content) {
      try {
        const parsed = JSON.parse(module.content);
        if (Array.isArray(parsed)) {
          setContentBlocks(parsed);
          setUseContentBlocks(true);
          setUseRichEditor(false);
        } else {
          setContentBlocks([]);
          setUseRichEditor(true);
          setUseContentBlocks(false);
        }
      } catch {
        setContentBlocks([]);
        setUseRichEditor(true);
        setUseContentBlocks(false);
      }
    } else {
      setContentBlocks([]);
      setUseRichEditor(true);
      setUseContentBlocks(false);
    }

    // Load assessment if exists
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
          timeLimit: assessment.timeLimit || undefined,
          passingScore: assessment.passingScore,
          maxAttempts: assessment.maxAttempts,
          isActive: assessment.isActive,
        });

        // Load questions
        const questions = await assessmentService.getAssessmentQuestions(assessment.id);
        setAssessmentQuestions(questions);
      } else {
        setCurrentAssessment(null);
        setAssessmentQuestions([]);
      }
    } catch (error) {
      console.error("Error loading assessment:", error);
    } finally {
      setLoadingAssessment(false);
    }
  };

  const uploadModuleDocumentToStorage = async (file: File, folder: string): Promise<string> => {
    if (!supabase || !user) throw new Error("Supabase or user not initialized");
    const fileExt = file.name.split(".").pop();
    const fileName = `${folder}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `modules/${user.id}/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from("course-materials")
      .upload(filePath, file, { cacheControl: "3600", upsert: false });
    if (uploadError) {
      const msg = uploadError.message?.toLowerCase().includes("bucket not found")
        ? "Storage bucket 'course-materials' not found. Create it in Supabase: Dashboard → Storage → New bucket → name: course-materials (see STORAGE_SETUP.md)."
        : uploadError.message;
      throw new Error(msg);
    }
    const { data: urlData } = supabase.storage.from("course-materials").getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const handleSaveModule = async (saveAsFinalized: boolean) => {
    if (!courseId) return;

    if (!formData.title || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    let documentUrl: string | null | undefined = currentDocumentUrl ?? undefined;
    if (selectedFile) {
      setUploadingDocument(true);
      try {
        documentUrl = await uploadModuleDocumentToStorage(selectedFile, "doc");
      } catch (error: any) {
        console.error("Upload error:", error);
        toast.error(error.message || "Failed to upload file");
        setLoading(false);
        setUploadingDocument(false);
        return;
      } finally {
        setUploadingDocument(false);
      }
    } else if (!currentDocumentUrl && !selectedFile && editingModule) {
      documentUrl = null;
    }

    const status = saveAsFinalized ? "finalized" : "draft";

    try {
      let contentToSave = formData.content;

      if (useContentBlocks && contentBlocks.length > 0) {
        contentToSave = JSON.stringify(contentBlocks);
      }

      if (editingModule) {
        await moduleService.updateModule(editingModule.id, {
          title: formData.title,
          description: formData.description,
          content: contentToSave,
          materials: formData.materials,
          prerequisites: formData.prerequisites,
          status,
          ...(documentUrl !== undefined && { module_document: documentUrl }),
        });
        toast.success(saveAsFinalized ? "Module finalized" : "Module saved as draft");
      } else {
        const nextOrder = modules.length > 0 ? Math.max(...modules.map((m) => m.order)) + 1 : 1;
        await moduleService.createModule({
          course_id: courseId,
          title: formData.title,
          description: formData.description,
          order: nextOrder,
          content: contentToSave,
          materials: formData.materials,
          prerequisites: formData.prerequisites,
          module_document: documentUrl ?? undefined,
          status,
        } as Module);
        toast.success(saveAsFinalized ? "Module created and finalized" : "Module saved as draft");
      }

      await loadModules();
      resetForm();
    } catch (error) {
      console.error("Error saving module:", error);
      toast.error(editingModule ? "Failed to update module" : "Failed to create module");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModule = async () => {
    if (!deleteModuleId) return;

    setLoading(true);
    try {
      await moduleService.deleteModule(deleteModuleId);
      toast.success("Module deleted successfully");
      await loadModules();
      setDeleteModuleId(null);
      if (editingModule?.id === deleteModuleId) {
        resetForm();
      }
    } catch (error) {
      console.error("Error deleting module:", error);
      toast.error("Failed to delete module");
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateModule = async (module: Module) => {
    if (!courseId) return;

    setLoading(true);
    try {
      const nextOrder = modules.length > 0 ? Math.max(...modules.map((m) => m.order)) + 1 : 1;
      await moduleService.createModule({
          course_id: courseId,
          title: `${module.title} (Copy)`,
          description: module.description,
          order: nextOrder,
          content: module.content || "",
          materials: [...module.materials],
          prerequisites: [...module.prerequisites],
          module_document: module.module_document ?? undefined,
        });
      toast.success("Module duplicated successfully");
      await loadModules();
    } catch (error) {
      console.error("Error duplicating module:", error);
      toast.error("Failed to duplicate module");
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);

    const reorderedModules = arrayMove(modules, oldIndex, newIndex);
    setModules(reorderedModules);

    // Update order in database
    const moduleOrders = reorderedModules.map((m, idx) => ({
      id: m.id,
      order: idx + 1,
    }));

    try {
      await moduleService.reorderModules(courseId!, moduleOrders);
      toast.success("Modules reordered successfully");
    } catch (error) {
      console.error("Error reordering modules:", error);
      toast.error("Failed to reorder modules");
      await loadModules(); // Reload on error
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

  const handleSaveAssessment = async () => {
    if (!editingModule) return;

    if (!assessmentFormData.title) {
      toast.error("Please provide an assessment title");
      return;
    }

    setLoading(true);
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
        toast.success("Assessment updated successfully");
      } else {
        const assessment = await assessmentService.createAssessment(editingModule.id, {
          title: assessmentFormData.title,
          description: assessmentFormData.description || undefined,
          timeLimit: assessmentFormData.timeLimit,
          passingScore: assessmentFormData.passingScore,
          maxAttempts: assessmentFormData.maxAttempts,
        });
        setCurrentAssessment(assessment);
        toast.success("Assessment created successfully");
      }
      await loadModuleAssessment(editingModule.id);
    } catch (error) {
      console.error("Error saving assessment:", error);
      toast.error(currentAssessment ? "Failed to update assessment" : "Failed to create assessment");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssessment = async () => {
    if (!currentAssessment || !editingModule) return;

    setLoading(true);
    try {
      await assessmentService.deleteAssessment(currentAssessment.id);
      toast.success("Assessment deleted successfully");
      setCurrentAssessment(null);
      setAssessmentQuestions([]);
      await loadModuleAssessment(editingModule.id);
    } catch (error) {
      console.error("Error deleting assessment:", error);
      toast.error("Failed to delete assessment");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuestion = async () => {
    if (!currentAssessment) return;

    if (!questionFormData.question) {
      toast.error("Please provide a question");
      return;
    }

    if (questionFormData.questionType === "multiple_choice" && questionFormData.options.length < 2) {
      toast.error("Please provide at least 2 options for multiple choice questions");
      return;
    }

    setLoading(true);
    try {
      if (editingQuestion) {
        await assessmentService.updateQuestion(editingQuestion.id, {
          question: questionFormData.question,
          questionType: questionFormData.questionType,
          options: questionFormData.questionType === "multiple_choice" ? questionFormData.options : undefined,
          correctAnswer: questionFormData.correctAnswer,
          points: questionFormData.points,
          explanation: questionFormData.explanation || undefined,
        });
        toast.success("Question updated successfully");
      } else {
        await assessmentService.createQuestion(currentAssessment.id, {
          question: questionFormData.question,
          questionType: questionFormData.questionType,
          options: questionFormData.questionType === "multiple_choice" ? questionFormData.options : undefined,
          correctAnswer: questionFormData.correctAnswer,
          points: questionFormData.points,
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
      toast.error(editingQuestion ? "Failed to update question" : "Failed to add question");
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

  if (!course) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading course...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to={user?.role === "admin" ? "/admin/courses" : "/trainer/courses"}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back to Courses
                </Link>
              </Button>
            </div>
            <h1 className="text-3xl font-bold">Manage Modules</h1>
            <p className="text-muted-foreground">{course.title}</p>
          </div>
        </div>

        {/* Summary cards (Total, Finalized, Drafts) */}
        <div className="grid gap-4 grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Modules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{modules.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Finalized</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {modules.filter((m) => m.status === "finalized").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {modules.filter((m) => m.status !== "finalized").length}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-lg bg-primary/10 text-primary px-4 py-3 text-sm">
          Tip: Drag and drop modules to reorder them. The order will be reflected for learners.
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Modules List - Left Side */}
          <div className="space-y-4 min-w-0">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>All Modules ({modules.length})</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Drag to reorder
                    </p>
                  </div>
                  <Button onClick={handleCreateModule} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Module
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-300px)]">
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
                              onPreview={() => {
                                setPreviewModuleId(module.id);
                                setPreviewModalOpen(true);
                              }}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Module Form Sidebar - Right Side */}
          <div className="min-w-0 flex flex-col">
            <Card className="sticky top-6 flex flex-col h-fit max-h-[calc(100vh-120px)]">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {editingModule ? "Edit Module" : "Create Module"}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {editingModule && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPreviewModuleId(editingModule.id);
                          setPreviewModalOpen(true);
                        }}
                        className="h-7 text-xs"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Preview
                      </Button>
                    )}
                    {editingModule && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetForm}
                        className="h-7 text-xs text-muted-foreground"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-w-0">
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="pr-4 min-w-0">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "edit" | "assessment")} className="w-full min-w-0">
                      <TabsList className={cn("grid w-full mb-4", editingModule ? "grid-cols-2" : "grid-cols-1")}>
                        <TabsTrigger value="edit">Content</TabsTrigger>
                        {editingModule && <TabsTrigger value="assessment">Assessment</TabsTrigger>}
                      </TabsList>

                      <TabsContent value="edit" className="space-y-4 mt-0 w-full min-w-0">
                      <div className="space-y-2 w-full min-w-0">
                        <Label htmlFor="module-title">Title *</Label>
                        <Input
                          id="module-title"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="e.g., Introduction to JavaScript"
                          className="w-full min-w-0"
                        />
                      </div>

                      <div className="space-y-2 w-full min-w-0">
                        <Label htmlFor="module-description">Description *</Label>
                        <Textarea
                          id="module-description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Brief description of what learners will learn..."
                          rows={3}
                          className="w-full min-w-0"
                        />
                      </div>

                      {/* Content Mode Toggle */}
                      <div className="space-y-2 w-full min-w-0">
                        <div className="flex items-center justify-between w-full min-w-0">
                          <Label className="flex-shrink-0">Content Type</Label>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Rich Text</span>
                            <Switch
                              checked={useContentBlocks}
                              onCheckedChange={(checked) => {
                                setUseContentBlocks(checked);
                                setUseRichEditor(!checked);
                              }}
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Content Blocks</span>
                          </div>
                        </div>

                        {useContentBlocks ? (
                          <div className="space-y-3 w-full min-w-0">
                            {contentBlocks.map((block, index) => (
                              <ContentBlockComponent
                                key={block.id}
                                block={block}
                                index={index}
                                onUpdate={(updatedBlock) => {
                                  const newBlocks = [...contentBlocks];
                                  newBlocks[index] = updatedBlock;
                                  setContentBlocks(newBlocks);
                                }}
                                onDelete={(blockId) => {
                                  setContentBlocks(contentBlocks.filter((b) => b.id !== blockId));
                                }}
                                onMove={(blockId, direction) => {
                                  const currentIndex = contentBlocks.findIndex((b) => b.id === blockId);
                                  if (
                                    (direction === "up" && currentIndex > 0) ||
                                    (direction === "down" && currentIndex < contentBlocks.length - 1)
                                  ) {
                                    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
                                    const newBlocks = [...contentBlocks];
                                    [newBlocks[currentIndex], newBlocks[newIndex]] = [
                                      newBlocks[newIndex],
                                      newBlocks[currentIndex],
                                    ];
                                    setContentBlocks(newBlocks);
                                  }
                                }}
                                canMoveUp={index > 0}
                                canMoveDown={index < contentBlocks.length - 1}
                              />
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const newBlock: ContentBlock = {
                                  id: Date.now().toString(),
                                  type: "text",
                                  content: "",
                                };
                                setContentBlocks([...contentBlocks, newBlock]);
                              }}
                              className="w-full"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Content Block
                            </Button>
                          </div>
                        ) : (
                          <div className="w-full min-w-0">
                            <RichTextEditor
                              content={formData.content}
                              onChange={(content) => setFormData({ ...formData, content })}
                              placeholder="Start typing your content here... e.g., Introduction to JavaScript"
                              className="w-full min-w-0"
                            />
                          </div>
                        )}
                      </div>

                      {/* Module Document Upload */}
                      <div className="space-y-2 w-full min-w-0">
                        <Label htmlFor="moduleDocument">Module Document (file, video, or image)</Label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              id="moduleDocument"
                              type="file"
                              accept=".pdf,.pptx,.mp4,.webm,.jpg,.jpeg,.png,.webp,.gif,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,video/mp4,video/webm,image/jpeg,image/png,image/webp,image/gif"
                              onChange={handleFileSelect}
                              className="flex-1 min-w-0"
                              disabled={uploadingDocument}
                            />
                            {selectedFile && (
                              <Badge variant="secondary" className="gap-1">
                                <FileText className="w-3 h-3" />
                                {selectedFile.name}
                              </Badge>
                            )}
                          </div>
                          {currentDocumentUrl && !selectedFile && (
                            <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <a
                                  href={currentDocumentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary hover:underline truncate"
                                >
                                  Current document
                                </a>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCurrentDocumentUrl(null);
                                  setSelectedFile(null);
                                }}
                                className="h-7 w-7 p-0"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 w-full min-w-0">
                        <Label>Learning Materials</Label>
                        <div className="flex gap-2 w-full min-w-0">
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
                            className="flex-1 min-w-0"
                          />
                          <Button type="button" onClick={addMaterial} variant="outline" size="sm" className="flex-shrink-0">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        {formData.materials.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {formData.materials.map((material, idx) => (
                              <Badge key={idx} variant="secondary" className="gap-1">
                                {material}
                                <button
                                  type="button"
                                  onClick={() => removeMaterial(material)}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 w-full min-w-0">
                        <Label>Prerequisites</Label>
                        {modules.length > 0 ? (
                          <div className="space-y-2">
                            {modules
                              .filter((m) => m.id !== editingModule?.id)
                              .map((module) => (
                                <div key={module.id} className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`prereq-${module.id}`}
                                    checked={formData.prerequisites.includes(module.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormData({
                                          ...formData,
                                          prerequisites: [...formData.prerequisites, module.id],
                                        });
                                      } else {
                                        setFormData({
                                          ...formData,
                                          prerequisites: formData.prerequisites.filter((id) => id !== module.id),
                                        });
                                      }
                                    }}
                                    className="rounded border-gray-300"
                                  />
                                  <Label htmlFor={`prereq-${module.id}`} className="text-sm font-normal cursor-pointer">
                                    {module.title}
                                  </Label>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No other modules available</p>
                        )}
                      </div>

                      <div className="flex gap-2 pt-4 w-full min-w-0 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleSaveModule(false)}
                          disabled={loading || uploadingDocument}
                          className="min-w-0"
                        >
                          {uploadingDocument ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : loading ? (
                            "Saving..."
                          ) : (
                            "Save as Draft"
                          )}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleSaveModule(true)}
                          disabled={loading || uploadingDocument}
                          className="min-w-0"
                        >
                          {loading && !uploadingDocument ? (
                            "Saving..."
                          ) : (
                            "Finalize"
                          )}
                        </Button>
                      </div>
                    </TabsContent>


                    {editingModule && (
                      <TabsContent value="assessment" className="mt-0 space-y-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold">Assessment Settings</h3>
                              <p className="text-sm text-muted-foreground">
                                {currentAssessment ? "Edit assessment" : "Create an assessment for this module"}
                              </p>
                            </div>
                            {currentAssessment && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleDeleteAssessment}
                                disabled={loading}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </Button>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="assessment-title">Title *</Label>
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
                              rows={3}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="time-limit">Time Limit (minutes)</Label>
                              <Input
                                id="time-limit"
                                type="number"
                                min="1"
                                value={assessmentFormData.timeLimit || ""}
                                onChange={(e) =>
                                  setAssessmentFormData({
                                    ...assessmentFormData,
                                    timeLimit: e.target.value ? parseInt(e.target.value) : undefined,
                                  })
                                }
                                placeholder="Optional"
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
                              id="assessment-active"
                              checked={assessmentFormData.isActive}
                              onCheckedChange={(checked) =>
                                setAssessmentFormData({ ...assessmentFormData, isActive: checked })
                              }
                            />
                            <Label htmlFor="assessment-active" className="cursor-pointer">
                              Active
                            </Label>
                          </div>

                          <Button onClick={handleSaveAssessment} disabled={loading} className="w-full">
                            {loading ? "Saving..." : currentAssessment ? "Update Assessment" : "Create Assessment"}
                          </Button>

                          {currentAssessment && (
                            <div className="space-y-4 pt-4 border-t">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold">Questions ({assessmentQuestions.length})</h4>
                                <Button
                                  variant="outline"
                                  size="sm"
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
                                  <Plus className="w-4 h-4 mr-2" />
                                  Add Question
                                </Button>
                              </div>

                              {assessmentQuestions.length > 0 && (
                                <div className="space-y-2">
                                  {assessmentQuestions.map((question, idx) => (
                                    <Card key={question.id} className="p-3">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Badge variant="outline">Q{idx + 1}</Badge>
                                            <span className="text-sm font-medium">{question.question}</span>
                                            <Badge>{question.points} pts</Badge>
                                          </div>
                                          {question.questionType === "multiple_choice" && question.options && (
                                            <div className="text-xs text-muted-foreground ml-6">
                                              {question.options.length} options
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditQuestion(question)}
                                          >
                                            <Edit className="w-3 h-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteQuestion(question.id)}
                                          >
                                            <Trash2 className="w-3 h-3 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              )}

                              {(editingQuestion || assessmentQuestions.length === 0) && (
                                <Card className="p-4">
                                  <h5 className="font-semibold mb-4">
                                    {editingQuestion ? "Edit Question" : "Add Question"}
                                  </h5>
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Question Type</Label>
                                      <Select
                                        value={questionFormData.questionType}
                                        onValueChange={(value: any) =>
                                          setQuestionFormData({
                                            ...questionFormData,
                                            questionType: value,
                                            options: value === "multiple_choice" ? [""] : [],
                                            correctAnswer: "",
                                          })
                                        }
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
                                      <Label>Question *</Label>
                                      <Textarea
                                        value={questionFormData.question}
                                        onChange={(e) =>
                                          setQuestionFormData({ ...questionFormData, question: e.target.value })
                                        }
                                        placeholder="Enter question..."
                                        rows={3}
                                      />
                                    </div>

                                    {questionFormData.questionType === "multiple_choice" && (
                                      <div className="space-y-2">
                                        <Label>Options *</Label>
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
                                            {questionFormData.options.length > 1 && (
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  const newOptions = questionFormData.options.filter(
                                                    (_, i) => i !== idx
                                                  );
                                                  setQuestionFormData({
                                                    ...questionFormData,
                                                    options: newOptions,
                                                    correctAnswer:
                                                      questionFormData.correctAnswer === idx.toString()
                                                        ? ""
                                                        : questionFormData.correctAnswer,
                                                  });
                                                }}
                                              >
                                                <X className="w-4 h-4" />
                                              </Button>
                                            )}
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
                                          <Plus className="w-4 h-4 mr-2" />
                                          Add Option
                                        </Button>
                                      </div>
                                    )}

                                    {questionFormData.questionType === "true_false" && (
                                      <div className="space-y-2">
                                        <Label>Correct Answer *</Label>
                                        <Select
                                          value={questionFormData.correctAnswer}
                                          onValueChange={(value) =>
                                            setQuestionFormData({ ...questionFormData, correctAnswer: value })
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select answer" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="true">True</SelectItem>
                                            <SelectItem value="false">False</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}

                                    {(questionFormData.questionType === "multiple_choice" ||
                                      questionFormData.questionType === "short_answer") && (
                                      <div className="space-y-2">
                                        <Label>Correct Answer *</Label>
                                        {questionFormData.questionType === "multiple_choice" ? (
                                          <Select
                                            value={questionFormData.correctAnswer}
                                            onValueChange={(value) =>
                                              setQuestionFormData({ ...questionFormData, correctAnswer: value })
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select correct option" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {questionFormData.options.map((_, idx) => (
                                                <SelectItem key={idx} value={idx.toString()}>
                                                  Option {idx + 1}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        ) : (
                                          <Input
                                            value={questionFormData.correctAnswer}
                                            onChange={(e) =>
                                              setQuestionFormData({
                                                ...questionFormData,
                                                correctAnswer: e.target.value,
                                              })
                                            }
                                            placeholder="Correct answer..."
                                          />
                                        )}
                                      </div>
                                    )}

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

                                    <div className="space-y-2">
                                      <Label>Explanation (optional)</Label>
                                      <Textarea
                                        value={questionFormData.explanation}
                                        onChange={(e) =>
                                          setQuestionFormData({ ...questionFormData, explanation: e.target.value })
                                        }
                                        placeholder="Explain why this answer is correct..."
                                        rows={2}
                                      />
                                    </div>

                                    <div className="flex gap-2">
                                      <Button
                                        onClick={handleSaveQuestion}
                                        disabled={loading}
                                        className="flex-1"
                                      >
                                        {loading
                                          ? "Saving..."
                                          : editingQuestion
                                          ? "Update Question"
                                          : "Add Question"}
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
                                </Card>
                              )}
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    )}
                  </Tabs>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Module Preview</DialogTitle>
            <DialogDescription>
              This is how learners will see this module
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {(() => {
              const moduleToPreview = previewModuleId 
                ? modules.find((m) => m.id === previewModuleId) 
                : editingModule;
              
              return moduleToPreview ? (
                <ModulePreview module={moduleToPreview} allModules={modules} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No module selected for preview</p>
                </div>
              );
            })()}
          </div>
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
    </DashboardLayout>
  );
};

export default ManageModules;
