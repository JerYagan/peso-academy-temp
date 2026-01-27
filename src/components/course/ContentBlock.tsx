import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, GripVertical, Type, Code, Video, FileQuestion, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type ContentBlockType = "text" | "code" | "video" | "quiz";

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  content: string;
  language?: string; // For code blocks
  title?: string; // For quiz blocks
  options?: string[]; // For quiz blocks
  correctAnswer?: number; // For quiz blocks
  explanation?: string; // For quiz blocks - explanation shown after answering
  videoUrl?: string; // For video blocks
}

interface ContentBlockProps {
  block: ContentBlock;
  index: number;
  onUpdate: (block: ContentBlock) => void;
  onDelete: (id: string) => void;
  onMove?: (id: string, direction: "up" | "down") => void;
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
  canMoveUp,
  canMoveDown,
}: ContentBlockProps) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleUpdate = (updates: Partial<ContentBlock>) => {
    onUpdate({ ...block, ...updates });
  };

  const renderBlockContent = () => {
    switch (block.type) {
      case "text":
        return (
          <div className="space-y-2">
            <Label>Text Content</Label>
            <Textarea
              value={block.content}
              onChange={(e) => handleUpdate({ content: e.target.value })}
              placeholder="Enter text content..."
              rows={6}
            />
          </div>
        );

      case "code":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Code Content</Label>
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

      case "video":
        return (
          <div className="space-y-2">
            <Label>Video URL</Label>
            <Input
              value={block.videoUrl || ""}
              onChange={(e) => handleUpdate({ videoUrl: e.target.value })}
              placeholder="https://youtube.com/watch?v=..."
            />
            <Label>Description (optional)</Label>
            <Textarea
              value={block.content}
              onChange={(e) => handleUpdate({ content: e.target.value })}
              placeholder="Video description..."
              rows={3}
            />
          </div>
        );

      case "quiz":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Question</Label>
              <Input
                value={block.title || ""}
                onChange={(e) => handleUpdate({ title: e.target.value })}
                placeholder="Enter question..."
              />
            </div>
            <div className="space-y-2">
              <Label>Options</Label>
              {(block.options || []).map((option, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    value={option}
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
                    onClick={() => {
                      const newOptions = block.options?.filter((_, i) => i !== idx) || [];
                      handleUpdate({ options: newOptions });
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
                  handleUpdate({ options: [...(block.options || []), ""] });
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Option
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Correct Answer</Label>
              <Select
                value={block.correctAnswer?.toString() || ""}
                onValueChange={(value) => handleUpdate({ correctAnswer: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select correct answer" />
                </SelectTrigger>
                <SelectContent>
                  {(block.options || []).map((_, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      Option {idx + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Explanation (optional)</Label>
              <Textarea
                value={block.explanation || ""}
                onChange={(e) => handleUpdate({ explanation: e.target.value })}
                placeholder="Explain why this answer is correct..."
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
      case "quiz":
        return <FileQuestion className="w-4 h-4" />;
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
      case "quiz":
        return "Quiz Block";
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

