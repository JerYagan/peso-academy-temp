import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Plus, Trash2, Trophy } from "lucide-react";
import { TAXONOMY_COURSE_CATEGORIES } from "@/lib/taxonomy";
import { programService } from "@/services/supabaseDatabaseService";
import type { Program } from "@/types";
import { toast } from "sonner";

type ProgramManagementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programs: Program[];
  currentUserId?: string;
  onRefresh: () => Promise<void> | void;
  onViewLeaderboard: (program: Program) => void;
};

const emptyProgramForm = {
  title: "",
  description: "",
  category: "",
};

export const ProgramManagementDialog = ({
  open,
  onOpenChange,
  programs,
  currentUserId,
  onRefresh,
  onViewLeaderboard,
}: ProgramManagementDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState(emptyProgramForm);

  useEffect(() => {
    if (!open) {
      setEditingProgram(null);
      setFormData(emptyProgramForm);
    }
  }, [open]);

  const handleEditProgram = (program: Program) => {
    setEditingProgram(program);
    setFormData({
      title: program.title,
      description: program.description,
      category: program.category || "",
    });
  };

  const resetForm = () => {
    setEditingProgram(null);
    setFormData(emptyProgramForm);
  };

  const handleSaveProgram = async () => {
    if (!formData.title.trim()) {
      toast.error("Program title is required");
      return;
    }

    setLoading(true);
    try {
      if (editingProgram) {
        await programService.updateProgram(editingProgram.id, {
          title: formData.title.trim(),
          description: formData.description.trim(),
          category: formData.category || null,
        });
        toast.success("Program updated successfully");
      } else {
        await programService.createProgram({
          title: formData.title.trim(),
          description: formData.description.trim(),
          category: formData.category || null,
          createdBy: currentUserId || null,
        });
        toast.success("Program created successfully");
      }

      await onRefresh();
      resetForm();
    } catch (error) {
      console.error("Error saving program:", error);
      toast.error(editingProgram ? "Failed to update program" : "Failed to create program");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProgram = async (program: Program) => {
    setLoading(true);
    try {
      await programService.deleteProgram(program.id);
      toast.success("Program deleted successfully");
      await onRefresh();
      if (editingProgram?.id === program.id) {
        resetForm();
      }
    } catch (error) {
      console.error("Error deleting program:", error);
      toast.error("Failed to delete program. Remove or reassign linked courses first if needed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Programs</DialogTitle>
          <DialogDescription>
            Create real program groupings for courses, then use them for program-level learner rankings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <div className="space-y-4 rounded-2xl border p-4">
            <div>
              <h3 className="text-lg font-semibold">{editingProgram ? "Edit program" : "New program"}</h3>
              <p className="text-sm text-muted-foreground">
                Use programs to group related courses and unlock program-scoped rankings.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="program-title">Title</Label>
              <Input
                id="program-title"
                value={formData.title}
                onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                placeholder="e.g. Digital Skills Bootcamp"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="program-category">Category</Label>
              <Select
                value={formData.category || "none"}
                onValueChange={(value) => setFormData((current) => ({ ...current, category: value === "none" ? "" : value }))}
              >
                <SelectTrigger id="program-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {TAXONOMY_COURSE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="program-description">Description</Label>
              <Textarea
                id="program-description"
                rows={4}
                value={formData.description}
                onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                placeholder="Describe how the linked courses fit together."
              />
            </div>

            <div className="flex gap-2">
              <Button type="button" onClick={handleSaveProgram} disabled={loading}>
                <Plus className="mr-2 h-4 w-4" />
                {editingProgram ? "Save changes" : "Create program"}
              </Button>
              {editingProgram ? (
                <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border p-4">
            <div>
              <h3 className="text-lg font-semibold">Existing programs</h3>
              <p className="text-sm text-muted-foreground">
                Assign courses to these programs in the course editor, then open their leaderboards from here.
              </p>
            </div>

            {programs.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                No programs created yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Courses</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programs.map((program) => (
                    <TableRow key={program.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{program.title}</p>
                          <p className="text-xs text-muted-foreground">{program.description || "No description provided"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {program.category ? <Badge variant="outline">{program.category}</Badge> : <span className="text-sm text-muted-foreground">None</span>}
                      </TableCell>
                      <TableCell>{program.courseCount || 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => onViewLeaderboard(program)}>
                            <Trophy className="mr-2 h-4 w-4" />
                            Ranking
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => handleEditProgram(program)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => void handleDeleteProgram(program)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};