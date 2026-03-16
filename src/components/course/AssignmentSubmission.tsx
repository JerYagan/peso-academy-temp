import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload, File, X, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { SUBMISSIONS_BUCKET } from "@/lib/submissionFiles";

interface AssignmentSubmissionProps {
  enrollmentId: string;
  moduleId: string;
  courseId: string;
  defaultTitle?: string;
  titleLabel?: string;
  titlePlaceholder?: string;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
  submitLabel?: string;
  successMessage?: string;
  metadata?: Record<string, unknown>;
  onSubmitted?: () => void | Promise<void>;
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
  defaultTitle,
  titleLabel = "Assignment Title *",
  titlePlaceholder = "Enter assignment title",
  descriptionLabel = "Description",
  descriptionPlaceholder = "Enter assignment description or notes",
  submitLabel = "Submit Assignment",
  successMessage = "Assignment submitted successfully! It will be reviewed by a validator.",
  metadata,
  onSubmitted,
}: AssignmentSubmissionProps) => {
  const [title, setTitle] = useState(defaultTitle || "");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "success" | "error">("idle");
  const fileUploadId = useId();
  const titleFieldId = useId();
  const descriptionFieldId = useId();

  useEffect(() => {
    setTitle(defaultTitle || "");
  }, [defaultTitle]);

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

    if (files.length === 0) {
      toast.error("Please upload at least one file before submitting.");
      return;
    }

    setIsSubmitting(true);
    setSubmissionStatus("idle");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Upload files to Supabase Storage
      const uploadedFiles: Array<{ url: string; path: string; name: string; type?: string; size?: number | null }> = [];

      for (const fileWithPreview of files) {
        const file = fileWithPreview.file;
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${user.id}/${enrollmentId}/${moduleId}/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(SUBMISSIONS_BUCKET)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error(uploadError.message || `Failed to upload ${file.name}`);
        }

        uploadedFiles.push({
          url: filePath,
          path: filePath,
          name: file.name,
          type: file.type,
          size: file.size,
        });
      }

      // Create submission record
      const submissionData = {
        enrollment_id: enrollmentId,
        module_id: moduleId,
        user_id: user.id,
        title: title.trim(),
        description: description || null,
        content: {
          files: uploadedFiles,
          submittedAt: new Date().toISOString(),
          courseId,
          ...(metadata || {}),
        },
        attachments: uploadedFiles,
        submission_type: "assignment" as const,
        status: "pending" as const,
        priority: "normal" as const,
        file_path: uploadedFiles.length > 0 ? uploadedFiles[0].path : null,
        submitted_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from("submissions")
        .insert(submissionData as any);

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
      toast.success(successMessage);
      await onSubmitted?.();
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
          <Label htmlFor={titleFieldId}>{titleLabel}</Label>
          <input
            id={titleFieldId}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={titlePlaceholder}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Description Input */}
        <div className="space-y-2">
          <Label htmlFor={descriptionFieldId}>{descriptionLabel}</Label>
          <Textarea
            id={descriptionFieldId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={descriptionPlaceholder}
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
              id={fileUploadId}
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <label htmlFor={fileUploadId} className="cursor-pointer">
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
              {submitLabel}
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
                  {successMessage}
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

