import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Upload, FileText, Loader2 } from "lucide-react";
import { Course } from "@/types";
import { courseService } from "@/services/supabaseDatabaseService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface CourseCreateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course?: Course | null;
  onSuccess?: () => void;
}

const COURSE_CATEGORIES = [
  "Technical Skills",
  "Soft Skills",
  "Entrepreneurship",
  "Digital Literacy",
  "Vocational Training",
  "Career Development",
  "Other",
];

const COURSE_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

export const CourseCreateEditDialog = ({
  open,
  onOpenChange,
  course,
  onSuccess,
}: CourseCreateEditDialogProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentDocumentUrl, setCurrentDocumentUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    level: "Beginner" as Course["level"],
    duration: "",
    isTESDAAccredited: false,
    skills: [] as string[],
    thumbnail: "",
  });
  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    if (course) {
      setFormData({
        title: course.title,
        description: course.description,
        category: course.category,
        level: course.level,
        duration: course.duration.toString(),
        isTESDAAccredited: course.isTESDAAccredited,
        skills: course.skills || [],
        thumbnail: course.thumbnail || "",
      });
      setCurrentDocumentUrl(course.courseDocument || null);
    } else {
      setFormData({
        title: "",
        description: "",
        category: "",
        level: "Beginner",
        duration: "",
        isTESDAAccredited: false,
        skills: [],
        thumbnail: "",
      });
      setCurrentDocumentUrl(null);
    }
    setSelectedFile(null);
  }, [course, open]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
    const validExtensions = [".pdf", ".pptx"];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      toast.error("Please upload a PDF or PPTX file");
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size must be less than 50MB");
      return;
    }

    setSelectedFile(file);
    setCurrentDocumentUrl(null); // Clear current document URL when new file is selected
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("You must be logged in to create/edit courses");
      return;
    }

    if (!formData.title || !formData.description || !formData.category || !formData.duration) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    let documentUrl = currentDocumentUrl || undefined;

    // Upload file if a new file is selected
    if (selectedFile && supabase) {
      setUploadingDocument(true);
      try {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `courses/${user.id}/${fileName}`;

        // Upload to Supabase Storage (using course-materials bucket or create courses bucket)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("course-materials")
          .upload(filePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          // If bucket doesn't exist, try creating it or use a different approach
          console.error("Upload error:", uploadError);
          throw new Error(`Failed to upload document: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("course-materials")
          .getPublicUrl(filePath);

        documentUrl = urlData.publicUrl;
        toast.success("Document uploaded successfully");
      } catch (error: any) {
        console.error("Error uploading document:", error);
        toast.error(error.message || "Failed to upload document");
        setLoading(false);
        setUploadingDocument(false);
        return;
      } finally {
        setUploadingDocument(false);
      }
    }

    try {
      const courseData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        level: formData.level,
        duration: parseInt(formData.duration),
        instructorId: user.id,
        instructor: user.name || user.email,
        thumbnail: formData.thumbnail || undefined,
        courseDocument: documentUrl,
        isTESDAAccredited: formData.isTESDAAccredited,
        skills: formData.skills,
      };

      if (course) {
        await courseService.updateCourse(course.id, courseData);
        toast.success("Course updated successfully");
      } else {
        await courseService.createCourse(courseData);
        toast.success("Course created successfully");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving course:", error);
      toast.error(course ? "Failed to update course" : "Failed to create course");
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, newSkill.trim()] });
      setNewSkill("");
    }
  };

  const removeSkill = (skill: string) => {
    setFormData({ ...formData, skills: formData.skills.filter((s) => s !== skill) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course ? "Edit Course" : "Create New Course"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Course Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter course title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter course description"
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {COURSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="level">Level *</Label>
              <Select
                value={formData.level}
                onValueChange={(value) => setFormData({ ...formData, level: value as Course["level"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COURSE_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (hours) *</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g., 40"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="thumbnail">Thumbnail URL</Label>
              <Input
                id="thumbnail"
                value={formData.thumbnail}
                onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="courseDocument">Course Document (PDF/PPTX)</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  id="courseDocument"
                  type="file"
                  accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={handleFileSelect}
                  className="flex-1"
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
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground flex-1 truncate">
                    Current: {currentDocumentUrl.split("/").pop()}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCurrentDocumentUrl(null);
                      setSelectedFile(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Upload a PDF or PPTX file to serve as the main course content. Max size: 50MB
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="tesda"
              checked={formData.isTESDAAccredited}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isTESDAAccredited: checked === true })
              }
            />
            <Label htmlFor="tesda" className="cursor-pointer">
              TESDA Accredited
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Skills</Label>
            <div className="flex gap-2">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Add a skill"
              />
              <Button type="button" onClick={addSkill} variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {formData.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1">
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || uploadingDocument}>
              {uploadingDocument ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : loading ? (
                "Saving..."
              ) : course ? (
                "Update Course"
              ) : (
                "Create Course"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

