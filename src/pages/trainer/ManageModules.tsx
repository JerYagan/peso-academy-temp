import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  BookOpen,
  ChevronLeft,
  Copy,
  Edit,
  Eye,
  FileText,
  GripVertical,
  ImageIcon,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { courseService, moduleService } from "@/services/supabaseDatabaseService";
import { ModulePreview } from "@/components/course/ModulePreview";
import { useAuth } from "@/contexts/AuthContext";
import { parseModuleContentBlocks } from "@/lib/contentBlocks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Course, Module } from "@/types";

interface SortableModuleCardProps {
  module: Module;
  prerequisites: Module[];
  onEdit: (module: Module) => void;
  onDelete: (moduleId: string) => void;
  onDuplicate: (module: Module) => void;
  onPreview: (module: Module) => void;
}

const getBaseModulePath = (role?: string) => (role === "admin" ? "/admin/courses" : "/trainer/courses");

const SortableModuleCard = ({ module, prerequisites, onEdit, onDelete, onDuplicate, onPreview }: SortableModuleCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const blockCount = useMemo(() => {
    if (!module.content) return 0;
    return parseModuleContentBlocks(module.content).length;
  }, [module.content]);

  const prerequisiteLabels = prerequisites
    .filter((candidate) => module.prerequisites.includes(candidate.id))
    .map((candidate) => candidate.title);

  return (
    <Card ref={setNodeRef} style={style} className={cn("transition-all hover:shadow-md", isDragging && "shadow-lg")}>
      <CardContent className="p-5">
        <div className="flex gap-4">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="mt-1 rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label={`Reorder ${module.title}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Module {module.order}</Badge>
                  <Badge variant={module.status === "finalized" ? "default" : "secondary"}>
                    {module.status === "finalized" ? "Finalized" : "Draft"}
                  </Badge>
                  {blockCount > 0 && <Badge variant="outline">{blockCount} block{blockCount === 1 ? "" : "s"}</Badge>}
                </div>
                <div className="flex items-start gap-4">
                  {module.module_thumbnail ? (
                    <img src={module.module_thumbnail} alt={module.title} className="h-20 w-32 rounded-lg border object-cover" />
                  ) : (
                    <div className="flex h-20 w-32 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-semibold">{module.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{module.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {module.module_document && (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Attached document
                        </span>
                      )}
                      {module.materials.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {module.materials.length} resource{module.materials.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(module)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPreview(module)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate(module)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(module.id)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {prerequisiteLabels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {prerequisiteLabels.map((label) => (
                  <Badge key={label} variant="outline" className="text-xs">
                    Requires: {label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ManageModules = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const basePath = getBaseModulePath(user?.role);

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [loadingModules, setLoadingModules] = useState(true);
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);
  const [previewModule, setPreviewModule] = useState<Module | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const loadCourse = async () => {
      if (!courseId) return;

      setLoadingCourse(true);
      try {
        const courseRecord = await courseService.getCourse(courseId);
        if (!courseRecord) {
          toast.error("Course not found");
          navigate(basePath);
          return;
        }
        setCourse(courseRecord);
      } catch (error) {
        console.error("Error loading course:", error);
        toast.error("Failed to load course");
        navigate(basePath);
      } finally {
        setLoadingCourse(false);
      }
    };

    void loadCourse();
  }, [basePath, courseId, navigate]);

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
    void loadModules();
  }, [loadModules]);

  const finalizedCount = modules.filter((module) => module.status === "finalized").length;
  const draftCount = modules.length - finalizedCount;

  const handleCreateModule = () => {
    navigate(`${basePath}/${courseId}/modules/new`);
  };

  const handleEditModule = (module: Module) => {
    navigate(`${basePath}/${courseId}/modules/${module.id}/edit`);
  };

  const handleDeleteModule = async () => {
    if (!deletingModuleId) return;

    try {
      await moduleService.deleteModule(deletingModuleId);
      toast.success("Module deleted successfully");
      setDeletingModuleId(null);
      await loadModules();
    } catch (error) {
      console.error("Error deleting module:", error);
      toast.error("Failed to delete module");
    }
  };

  const handleDuplicateModule = async (module: Module) => {
    if (!courseId) return;

    try {
      const nextOrder = modules.length > 0 ? Math.max(...modules.map((candidate) => candidate.order)) + 1 : 1;
      await moduleService.createModule({
        course_id: courseId,
        title: `${module.title} (Copy)`,
        description: module.description,
        order: nextOrder,
        content: module.content || "",
        materials: [...module.materials],
        prerequisites: [...module.prerequisites],
        skillTags: [...(module.skillTags || [])],
        topicTags: [...(module.topicTags || [])],
        module_thumbnail: module.module_thumbnail,
        module_document: module.module_document,
        status: module.status || "draft",
      });
      toast.success("Module duplicated successfully");
      await loadModules();
    } catch (error) {
      console.error("Error duplicating module:", error);
      toast.error("Failed to duplicate module");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !courseId) return;

    const oldIndex = modules.findIndex((module) => module.id === active.id);
    const newIndex = modules.findIndex((module) => module.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedModules = arrayMove(modules, oldIndex, newIndex);
    setModules(reorderedModules);

    try {
      await moduleService.reorderModules(
        courseId,
        reorderedModules.map((module, index) => ({ id: module.id, order: index + 1 })),
      );
      toast.success("Modules reordered successfully");
    } catch (error) {
      console.error("Error reordering modules:", error);
      toast.error("Failed to reorder modules");
      await loadModules();
    }
  };

  if (loadingCourse) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[320px] items-center justify-center text-muted-foreground">Loading course...</div>
      </DashboardLayout>
    );
  }

  if (!course) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" asChild className="px-0">
              <Link to={basePath}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back to Courses
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Manage Modules</h1>
              <p className="mt-1 text-muted-foreground">{course.title}</p>
            </div>
          </div>

          <Button onClick={handleCreateModule}>
            <Plus className="mr-2 h-4 w-4" />
            Create Module
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Modules</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{modules.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Finalized</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{finalizedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">{draftCount}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-sm text-primary">
            Drag and drop modules to reorder them. Create and edit now open in a dedicated authoring page with content, settings, and preview tabs.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Modules</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingModules ? (
              <div className="py-16 text-center text-muted-foreground">Loading modules...</div>
            ) : modules.length === 0 ? (
              <div className="py-16 text-center">
                <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">No modules yet for this course.</p>
                <Button variant="outline" className="mt-4" onClick={handleCreateModule}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create the first module
                </Button>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={modules.map((module) => module.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                    {modules.map((module) => (
                      <SortableModuleCard
                        key={module.id}
                        module={module}
                        prerequisites={modules.filter((candidate) => candidate.id !== module.id)}
                        onEdit={handleEditModule}
                        onDelete={setDeletingModuleId}
                        onDuplicate={handleDuplicateModule}
                        onPreview={setPreviewModule}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(previewModule)} onOpenChange={(open) => !open && setPreviewModule(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Module Preview</DialogTitle>
              <DialogDescription>Review how this module will appear before finalizing it.</DialogDescription>
            </DialogHeader>
            {previewModule && <ModulePreview module={previewModule} allModules={modules} />}
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(deletingModuleId)} onOpenChange={(open) => !open && setDeletingModuleId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete module?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The module content and attached resources will be removed from the course.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteModule} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default ManageModules;