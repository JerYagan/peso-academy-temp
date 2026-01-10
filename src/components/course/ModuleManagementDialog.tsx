import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { X, Plus, GripVertical, Edit, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Module, Course } from "@/types";
import { moduleService } from "@/services/supabaseDatabaseService";
import { toast } from "sonner";

interface ModuleManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course;
  onSuccess?: () => void;
}

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
  const [newMaterial, setNewMaterial] = useState("");
  const [loadingModules, setLoadingModules] = useState(false);

  useEffect(() => {
    if (open && course.id) {
      loadModules();
    }
  }, [open, course.id]);

  const loadModules = async () => {
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
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      content: "",
      materials: [],
      prerequisites: [],
    });
    setEditingModule(null);
    setNewMaterial("");
  };

  const handleCreateModule = () => {
    resetForm();
    setEditingModule(null);
  };

  const handleEditModule = (module: Module) => {
    setEditingModule(module);
    setFormData({
      title: module.title,
      description: module.description,
      content: module.content || "",
      materials: module.materials || [],
      prerequisites: module.prerequisites || [],
    });
  };

  const handleSaveModule = async () => {
    if (!formData.title || !formData.description) {
      toast.error("Please fill in title and description");
      return;
    }

    setLoading(true);
    try {
      if (editingModule) {
        await moduleService.updateModule(editingModule.id, {
          title: formData.title,
          description: formData.description,
          content: formData.content || undefined,
          materials: formData.materials,
          prerequisites: formData.prerequisites,
        });
        toast.success("Module updated successfully");
      } else {
        await moduleService.createModule({
          course_id: course.id,
          title: formData.title,
          description: formData.description,
          content: formData.content || undefined,
          materials: formData.materials,
          prerequisites: formData.prerequisites,
          order: modules.length + 1,
        });
        toast.success("Module created successfully");
      }
      resetForm();
      loadModules();
      onSuccess?.();
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

  const handleReorder = async (moduleId: string, direction: "up" | "down") => {
    const moduleIndex = modules.findIndex((m) => m.id === moduleId);
    if (moduleIndex === -1) return;

    const newIndex = direction === "up" ? moduleIndex - 1 : moduleIndex + 1;
    if (newIndex < 0 || newIndex >= modules.length) return;

    const reorderedModules = [...modules];
    const [moved] = reorderedModules.splice(moduleIndex, 1);
    reorderedModules.splice(newIndex, 0, moved);

    // Update order values
    const moduleOrders = reorderedModules.map((m, idx) => ({
      id: m.id,
      order: idx + 1,
    }));

    try {
      await moduleService.reorderModules(course.id, moduleOrders);
      setModules(reorderedModules);
      toast.success("Module order updated");
      onSuccess?.();
    } catch (error) {
      console.error("Error reordering modules:", error);
      toast.error("Failed to reorder modules");
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Modules - {course.title}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex gap-4">
            {/* Modules List */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Modules ({modules.length})</h3>
                <Button onClick={handleCreateModule} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Module
                </Button>
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                {loadingModules ? (
                  <div className="p-8 text-center text-muted-foreground">Loading modules...</div>
                ) : modules.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No modules yet. Create your first module!
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Order</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Prerequisites</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modules.map((module, index) => (
                        <TableRow key={module.id}>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReorder(module.id, "up")}
                                disabled={index === 0}
                                className="h-6 w-6 p-0"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </Button>
                              <span className="text-sm font-medium">{module.order}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReorder(module.id, "down")}
                                disabled={index === modules.length - 1}
                                className="h-6 w-6 p-0"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{module.title}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {module.description}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {module.prerequisites.length > 0 ? (
                              <Badge variant="outline" className="text-xs">
                                {module.prerequisites.length} required
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditModule(module)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteModuleId(module.id)}
                                className="h-8 w-8 p-0 text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </div>

            {/* Module Form */}
            <div className="w-96 border-l pl-4 flex flex-col">
              <h3 className="font-semibold mb-4">
                {editingModule ? "Edit Module" : "Create Module"}
              </h3>

              <ScrollArea className="flex-1">
                <div className="space-y-4 pr-4">
                  <div className="space-y-2">
                    <Label htmlFor="module-title">Title *</Label>
                    <Input
                      id="module-title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Module title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="module-description">Description *</Label>
                    <Textarea
                      id="module-description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Module description"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="module-content">Content</Label>
                    <Textarea
                      id="module-content"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Module content (HTML/text)"
                      rows={6}
                    />
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
                          <Badge key={material} variant="secondary" className="gap-1">
                            {material.substring(0, 20)}...
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

                  {modules.length > 0 && (
                    <div className="space-y-2">
                      <Label>Prerequisites (select modules that must be completed first)</Label>
                      <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-2">
                        {modules
                          .filter((m) => !editingModule || m.id !== editingModule.id)
                          .map((module) => (
                            <div key={module.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={formData.prerequisites.includes(module.id)}
                                onChange={() => togglePrerequisite(module.id)}
                                className="rounded"
                              />
                              <Label className="text-sm cursor-pointer">
                                {module.order}. {module.title}
                              </Label>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleSaveModule}
                      disabled={loading || !formData.title || !formData.description}
                      className="flex-1"
                    >
                      {loading ? "Saving..." : editingModule ? "Update" : "Create"}
                    </Button>
                    {editingModule && (
                      <Button variant="outline" onClick={resetForm}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
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
            <AlertDialogAction onClick={handleDeleteModule} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

