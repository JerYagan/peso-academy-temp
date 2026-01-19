import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload, File, X, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { validatorService } from "@/services/validatorService";
import { supabase } from "@/lib/supabase";

interface AssignmentSubmissionProps {
  enrollmentId: string;
  moduleId: string;
  courseId: string;
}

interface FileWithPreview {
  file: File;
  preview: string;
  id: string;
}

const AssignmentSubmission = ({
  enrollmentId,
  moduleId,
  courseId,
}: AssignmentSubmissionProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "success" | "error">("idle");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    selectedFiles.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
        return;
      }

      const preview = URL.createObjectURL(file);
      const id = Math.random().toString(36).substr(2, 9);
      setFiles((prev) => [...prev, { file, preview, id }]);
    });
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    
    droppedFiles.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
        return;
      }

      const preview = URL.createObjectURL(file);
      const id = Math.random().toString(36).substr(2, 9);
      setFiles((prev) => [...prev, { file, preview, id }]);
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please provide a title for your submission");
      return;
    }

    setIsSubmitting(true);
    setSubmissionStatus("idle");

    try {
      // Upload files to Supabase Storage
      const uploadedFiles: Array<{ url: string; name: string; type?: string }> = [];

      for (const fileWithPreview of files) {
        const file = fileWithPreview.file;
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `submissions/${enrollmentId}/${fileName}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("submissions")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error(`Failed to upload ${file.name}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("submissions")
          .getPublicUrl(filePath);

        uploadedFiles.push({
          url: urlData.publicUrl,
          name: file.name,
          type: file.type,
        });
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Create submission record
      const submissionData = {
        enrollment_id: enrollmentId,
        module_id: moduleId,
        user_id: user.id,
        title: title,
        description: description || null,
        content: {
          files: uploadedFiles,
          submittedAt: new Date().toISOString(),
        },
        attachments: uploadedFiles,
        submission_type: "assignment" as const,
        status: "pending" as const,
        priority: "normal" as const,
      };

      // Use validatorService to create submission
      // Note: We need to check if validatorService has a createSubmission method
      // For now, we'll insert directly
      const { error: insertError } = await supabase
        .from("submissions")
        .insert({
          enrollment_id: enrollmentId,
          module_id: moduleId,
          user_id: user.id,
          file_path: uploadedFiles.length > 0 ? uploadedFiles[0].url : null,
          submitted_at: new Date().toISOString(),
          status: "pending",
        });

      if (insertError) {
        throw insertError;
      }

      // Clean up file previews
      files.forEach((f) => URL.revokeObjectURL(f.preview));

      // Reset form
      setTitle("");
      setDescription("");
      setFiles([]);
      setSubmissionStatus("success");
      toast.success("Assignment submitted successfully!");
    } catch (error) {
      console.error("Error submitting assignment:", error);
      setSubmissionStatus("error");
      const errorMessage = error instanceof Error ? error.message : "Failed to submit assignment";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Title Input */}
        <div className="space-y-2">
          <Label htmlFor="title">Assignment Title *</Label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter assignment title"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Description Input */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter assignment description or notes"
            rows={4}
          />
        </div>

        {/* File Upload Area */}
        <div className="space-y-2">
          <Label>Attachments</Label>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
          >
            <input
              type="file"
              id="file-upload"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">
                Drag and drop files here, or click to select
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum file size: 10MB per file
              </p>
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2 mt-4">
              {files.map((fileWithPreview) => (
                <div
                  key={fileWithPreview.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <File className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{fileWithPreview.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(fileWithPreview.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(fileWithPreview.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !title.trim()}
          className="w-full"
        >
          {isSubmitting ? (
            <>Submitting...</>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Submit Assignment
            </>
          )}
        </Button>

        {/* Status Messages */}
        {submissionStatus === "success" && (
          <Card className="border-green-500 bg-green-50 dark:bg-green-950">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <p className="text-sm font-medium">
                  Assignment submitted successfully! It will be reviewed by a validator.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {submissionStatus === "error" && (
          <Card className="border-red-500 bg-red-50 dark:bg-red-950">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm font-medium">
                  Failed to submit assignment. Please try again.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AssignmentSubmission;

