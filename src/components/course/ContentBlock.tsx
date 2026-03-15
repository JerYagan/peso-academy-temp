import { useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { X, GripVertical, Type, Code, Video, FileQuestion, Plus, ImageIcon, FileText, Link2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TRUE_FALSE_QUIZ_OPTIONS,
  type ContentBlock,
  type ContentBlockType,
  type QuizBlockQuestionType,
} from "@/lib/contentBlocks";

export type { ContentBlock, ContentBlockType, QuizBlockQuestionType } from "@/lib/contentBlocks";

type UploadField = "videoUrl" | "imageUrl" | "documentUrl" | "materialUrl";

interface ContentBlockProps {
  block: ContentBlock;
  index: number;
  onUpdate: (block: ContentBlock) => void;
  onDelete: (id: string) => void;
  onMove?: (id: string, direction: "up" | "down") => void;
  onUploadAsset?: (blockId: string, field: UploadField, file: File) => Promise<void>;
  uploadingAssetKey?: string | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const codeLanguages = [
  "javascript",
  "typescript",
  "python",
  "java",
  "cpp",
  "c",
  "csharp",
  "php",
  "ruby",
  "go",
  "rust",
  "sql",
  "html",
  "css",
  "json",
  "xml",
  "bash",
  "plaintext",
];

export const ContentBlockComponent = ({
  block,
  index,
  onUpdate,
  onDelete,
  onMove,
  onUploadAsset,
  uploadingAssetKey,
  canMoveUp,
  canMoveDown,
}: ContentBlockProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const handleUpdate = (updates: Partial<ContentBlock>) => {
    onUpdate({ ...block, ...updates });
  };

  const triggerUpload = (field: UploadField) => {
    fileInputsRef.current[field]?.click();
  };

  const renderUrlUploadField = (
    label: string,
    field: UploadField,
    value: string | undefined,
    accept: string,
    placeholder: string,
  ) => {
    const uploadKey = `${block.id}:${field}`;
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex gap-2">
          <Input
            value={value || ""}
            onChange={(e) => handleUpdate({ [field]: e.target.value } as Partial<ContentBlock>)}
            placeholder={placeholder}
          />
          {onUploadAsset && (
            <>
              <input
                ref={(element) => {
                  fileInputsRef.current[field] = element;
                }}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  onUploadAsset(block.id, field, file).finally(() => {
                    if (event.target) event.target.value = "";
                  });
                }}
              />
              <Button type="button" variant="outline" onClick={() => triggerUpload(field)}>
                <Upload className="w-4 h-4 mr-2" />
                {uploadingAssetKey === uploadKey ? "Uploading..." : "Upload"}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderBlockContent = () => {
    switch (block.type) {
      case "text":
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Section Title (optional)</Label>
              <Input
                value={block.title || ""}
                onChange={(e) => handleUpdate({ title: e.target.value })}
                placeholder="Section title"
              />
            </div>
            <div className="space-y-2">
              <Label>Content Body</Label>
              <Textarea
                value={block.content}
                onChange={(e) => handleUpdate({ content: e.target.value })}
                placeholder="Write your content here..."
                rows={6}
              />
            </div>
          </div>
        );

      case "image":
        return (
          <div className="space-y-3">
            {renderUrlUploadField("Image URL or Upload", "imageUrl", block.imageUrl, "image/*", "https://example.com/image.jpg")}
            <div className="space-y-2">
              <Label>Alt Text</Label>
              <Input
                value={block.altText || ""}
                onChange={(e) => handleUpdate({ altText: e.target.value })}
                placeholder="Describe the image"
              />
            </div>
            <div className="space-y-2">
              <Label>Caption (optional)</Label>
              <Input
                value={block.caption || ""}
                onChange={(e) => handleUpdate({ caption: e.target.value })}
                placeholder="Optional caption"
              />
            </div>
          </div>
        );

      case "document":
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Document Title</Label>
              <Input
                value={block.title || ""}
                onChange={(e) => handleUpdate({ title: e.target.value })}
                placeholder="Document title"
              />
            </div>
            {renderUrlUploadField("Document URL or Upload", "documentUrl", block.documentUrl, ".pdf,.doc,.docx,.ppt,.pptx", "https://example.com/document.pdf")}
          </div>
        );

      case "learning_material":
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Learning Material Title</Label>
              <Input
                value={block.title || ""}
                onChange={(e) => handleUpdate({ title: e.target.value })}
                placeholder="Learning material title"
              />
            </div>
            {renderUrlUploadField("Learning Material URL or Upload", "materialUrl", block.materialUrl, ".pdf,.doc,.docx,.ppt,.pptx,.zip,.mp4,.webm,image/*", "https://example.com/resource")}
          </div>
        );

      case "video":
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Video Title</Label>
              <Input
                value={block.title || ""}
                onChange={(e) => handleUpdate({ title: e.target.value })}
                placeholder="Video title"
              />
            </div>
            {renderUrlUploadField("Video Link or Upload", "videoUrl", block.videoUrl, "video/*", "https://youtube.com/watch?v=...")}
          </div>
        );

      case "code":
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Code Title</Label>
              <Input
                value={block.title || ""}
                onChange={(e) => handleUpdate({ title: e.target.value })}
                placeholder="Code example title"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Programming Language</Label>
              <Select
                value={block.language || "plaintext"}
                onValueChange={(value) => handleUpdate({ language: value })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {codeLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={block.content}
              onChange={(e) => handleUpdate({ content: e.target.value })}
              placeholder="Enter code..."
              rows={10}
              className="font-mono text-sm"
            />
          </div>
        );

      case "quiz":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              Practice quiz only. Learner answers here are for inline feedback inside the module and are not used as graded assessment scores.
            </div>
            <div className="space-y-2">
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select
                  value={block.questionType || "multiple_choice"}
                  onValueChange={(value) => {
                    const questionType = value as QuizBlockQuestionType;
                    handleUpdate({
                      questionType,
                      options:
                        questionType === "true_false"
                          ? [...TRUE_FALSE_QUIZ_OPTIONS]
                          : questionType === "essay"
                            ? []
                            : block.options || ["", ""],
                      correctAnswer: questionType === "essay" ? undefined : block.correctAnswer ?? 0,
                      sourceQuestionKey: block.sourceQuestionKey || block.id,
                      isGradable: false,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select question type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="true_false">True / False</SelectItem>
                    <SelectItem value="essay">Essay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{block.questionType === "essay" ? "Essay Prompt" : "Question Text"}</Label>
              <Textarea
                value={block.content}
                onChange={(e) => handleUpdate({ content: e.target.value })}
                placeholder={block.questionType === "essay" ? "Enter the essay prompt" : "Enter the quiz question"}
                rows={3}
              />
            </div>
            {block.questionType === "essay" ? (
              <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                Learners will answer this question in a long-form text area. Scoring and feedback are handled through the trainer review workflow.
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Options</Label>
                <RadioGroup
                  value={block.correctAnswer?.toString() || ""}
                  onValueChange={(value) => handleUpdate({ correctAnswer: parseInt(value, 10) })}
                  className="space-y-3"
                >
                  {(block.options || []).map((option, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <RadioGroupItem value={idx.toString()} id={`${block.id}-correct-${idx}`} />
                      <Input
                        value={option}
                        disabled={block.questionType === "true_false"}
                        onChange={(e) => {
                          const newOptions = [...(block.options || [])];
                          newOptions[idx] = e.target.value;
                          handleUpdate({ options: newOptions });
                        }}
                        placeholder={`Option ${idx + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={block.questionType === "true_false"}
                        onClick={() => {
                          const nextOptions = (block.options || []).filter((_, optionIndex) => optionIndex !== idx);
                          const nextCorrect =
                            block.correctAnswer === undefined
                              ? undefined
                              : block.correctAnswer === idx
                                ? undefined
                                : block.correctAnswer > idx
                                  ? block.correctAnswer - 1
                                  : block.correctAnswer;
                          handleUpdate({ options: nextOptions, correctAnswer: nextCorrect });
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </RadioGroup>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={block.questionType === "true_false"}
                  onClick={() => {
                    handleUpdate({ options: [...(block.options || []), ""] });
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Option
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <Label>{block.questionType === "essay" ? "Learner Guidance (optional)" : "Feedback / Explanation (optional)"}</Label>
              <Textarea
                value={block.explanation || ""}
                onChange={(e) => handleUpdate({ explanation: e.target.value })}
                placeholder={block.questionType === "essay" ? "Add optional learner guidance or reflection instructions..." : "Explain the answer or add formative feedback..."}
                rows={3}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getBlockIcon = () => {
    switch (block.type) {
      case "text":
        return <Type className="w-4 h-4" />;
      case "code":
        return <Code className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      case "image":
        return <ImageIcon className="w-4 h-4" />;
      case "quiz":
        return <FileQuestion className="w-4 h-4" />;
      case "document":
        return <FileText className="w-4 h-4" />;
      case "learning_material":
        return <Link2 className="w-4 h-4" />;
    }
  };

  const getBlockTitle = () => {
    switch (block.type) {
      case "text":
        return "Text Block";
      case "code":
        return `Code Block${block.language ? ` (${block.language})` : ""}`;
      case "video":
        return "Video Block";
      case "image":
        return "Image Block";
      case "quiz":
        return "Practice Quiz Block";
      case "document":
        return "Document Block";
      case "learning_material":
        return "Learning Material Block";
    }
  };

  return (
    <Card className="group">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </button>
            <Badge variant="outline" className="gap-1">
              {getBlockIcon()}
              {getBlockTitle()}
            </Badge>
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
          </div>
          <div className="flex items-center gap-1">
            {onMove && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onMove(block.id, "up")}
                  disabled={!canMoveUp}
                  className="h-7 w-7 p-0"
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onMove(block.id, "down")}
                  disabled={!canMoveDown}
                  className="h-7 w-7 p-0"
                >
                  ↓
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(block.id)}
              className="h-7 w-7 p-0 text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>{renderBlockContent()}</CardContent>
    </Card>
  );
};

