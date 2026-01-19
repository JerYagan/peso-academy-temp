import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Code, Video, FileQuestion, Type } from "lucide-react";
import { Module } from "@/types";
import { ContentBlock } from "./ContentBlock";
import { useMemo } from "react";

interface ModulePreviewProps {
  module: {
    title: string;
    description: string;
    content?: string;
    materials: string[];
    prerequisites: string[];
    order: number;
  };
  allModules?: Module[];
}

export const ModulePreview = ({ module, allModules = [] }: ModulePreviewProps) => {
  // Parse content blocks from HTML content
  const contentBlocks = useMemo(() => {
    if (!module.content) return [];
    
    try {
      // Try to parse JSON content blocks
      const parsed = JSON.parse(module.content);
      if (Array.isArray(parsed)) {
        return parsed as ContentBlock[];
      }
    } catch {
      // If not JSON, treat as HTML/text content
      return [
        {
          id: "1",
          type: "text" as const,
          content: module.content,
        },
      ];
    }
    return [];
  }, [module.content]);

  const prereqModules = useMemo(() => {
    return allModules.filter((m) => module.prerequisites.includes(m.id));
  }, [module.prerequisites, allModules]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-sm">
                  Module {module.order}
                </Badge>
                {prereqModules.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    Requires {prereqModules.length} prerequisite{prereqModules.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-2xl mb-2">{module.title}</CardTitle>
              <p className="text-muted-foreground">{module.description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Content Blocks Preview */}
          {contentBlocks.length > 0 ? (
            <div className="space-y-4">
              {contentBlocks.map((block, idx) => (
                <div key={block.id || idx} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {block.type === "text" && <Type className="w-4 h-4 text-muted-foreground" />}
                    {block.type === "code" && <Code className="w-4 h-4 text-muted-foreground" />}
                    {block.type === "video" && <Video className="w-4 h-4 text-muted-foreground" />}
                    {block.type === "quiz" && <FileQuestion className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-sm font-medium capitalize">{block.type} Block</span>
                    {block.type === "code" && block.language && (
                      <Badge variant="outline" className="text-xs">
                        {block.language}
                      </Badge>
                    )}
                  </div>
                  
                  {block.type === "text" && (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: block.content }}
                    />
                  )}
                  
                  {block.type === "code" && (
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                      <code className={`language-${block.language || "plaintext"}`}>
                        {block.content}
                      </code>
                    </pre>
                  )}
                  
                  {block.type === "video" && block.videoUrl && (
                    <div className="space-y-2">
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <Video className="w-12 h-12 text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">
                          Video: {block.videoUrl}
                        </span>
                      </div>
                      {block.content && (
                        <p className="text-sm text-muted-foreground">{block.content}</p>
                      )}
                    </div>
                  )}
                  
                  {block.type === "quiz" && (
                    <div className="space-y-3">
                      <p className="font-medium">{block.title || "Quiz Question"}</p>
                      <div className="space-y-2">
                        {(block.options || []).map((option, optIdx) => (
                          <div
                            key={optIdx}
                            className={`p-2 rounded border ${
                              optIdx === block.correctAnswer
                                ? "border-green-500 bg-green-50 dark:bg-green-950"
                                : "border-muted"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{String.fromCharCode(65 + optIdx)}.</span>
                              <span>{option}</span>
                              {optIdx === block.correctAnswer && (
                                <Badge variant="outline" className="ml-auto text-xs">
                                  Correct
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No content blocks yet</p>
            </div>
          )}

          {/* Materials */}
          {module.materials.length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Learning Materials ({module.materials.length})
                </h4>
                <div className="space-y-1">
                  {module.materials.map((material, idx) => (
                    <a
                      key={idx}
                      href={material}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-primary hover:underline truncate"
                    >
                      {material}
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

