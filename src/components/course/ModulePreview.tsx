import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Code, Video, FileQuestion, Type, ImageIcon, FileText, Link2 } from "lucide-react";
import { Module } from "@/types";
import { ContentBlock } from "./ContentBlock";
import DocumentViewer from "./DocumentViewer";
import { useMemo } from "react";
import { parseModuleContentBlocks } from "@/lib/contentBlocks";

interface ModulePreviewProps {
  module: {
    title: string;
    description: string;
    content?: string;
    materials: string[];
    prerequisites: string[];
    order: number;
    module_thumbnail?: string;
    module_document?: string;
  };
  allModules?: Module[];
}

export const ModulePreview = ({ module, allModules = [] }: ModulePreviewProps) => {
  // Parse content blocks from HTML content
  const contentBlocks = useMemo(() => {
    return parseModuleContentBlocks(module.content);
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
              {module.module_thumbnail && (
                <div className="mb-4 overflow-hidden rounded-xl border bg-muted">
                  <img src={module.module_thumbnail} alt={module.title} className="h-56 w-full object-cover" />
                </div>
              )}
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
          {/* Module Document (uploaded PDF/PPTX) - primary content */}
          {module.module_document && (
            <div className="mb-6">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Module Document
              </h4>
              <DocumentViewer url={module.module_document} title={module.title} />
            </div>
          )}

          {/* Content Blocks Preview */}
          {contentBlocks.length > 0 ? (
            <div className="space-y-4">
              {contentBlocks.map((block, idx) => (
                <div key={block.id || idx} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {block.type === "text" && <Type className="w-4 h-4 text-muted-foreground" />}
                    {block.type === "code" && <Code className="w-4 h-4 text-muted-foreground" />}
                    {block.type === "video" && <Video className="w-4 h-4 text-muted-foreground" />}
                    {block.type === "image" && <ImageIcon className="w-4 h-4 text-muted-foreground" />}
                    {block.type === "quiz" && <FileQuestion className="w-4 h-4 text-muted-foreground" />}
                    {block.type === "document" && <FileText className="w-4 h-4 text-muted-foreground" />}
                    {block.type === "learning_material" && <Link2 className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-sm font-medium capitalize">{block.type} Block</span>
                    {block.type === "code" && block.language && (
                      <Badge variant="outline" className="text-xs">
                        {block.language}
                      </Badge>
                    )}
                  </div>
                  
                  {block.type === "text" && (
                    <div className="space-y-2">
                      {block.title && <h3 className="text-lg font-semibold">{block.title}</h3>}
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: block.content }}
                      />
                    </div>
                  )}
                  
                  {block.type === "code" && (
                    <div className="space-y-2">
                      {block.title && <h3 className="font-semibold">{block.title}</h3>}
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                        <code className={`language-${block.language || "plaintext"}`}>
                          {block.content}
                        </code>
                      </pre>
                    </div>
                  )}
                  
                  {block.type === "video" && block.videoUrl && (
                    <div className="space-y-2">
                      {block.title && <h3 className="font-semibold">{block.title}</h3>}
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <Video className="w-12 h-12 text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">
                          Video: {block.videoUrl}
                        </span>
                      </div>
                    </div>
                  )}

                  {block.type === "image" && block.imageUrl && (
                    <figure className="space-y-2">
                      <img src={block.imageUrl} alt={block.altText || block.title || "Module image"} className="max-h-[420px] w-full rounded-lg object-cover" />
                      {(block.caption || block.altText) && (
                        <figcaption className="text-sm text-muted-foreground">{block.caption || block.altText}</figcaption>
                      )}
                    </figure>
                  )}

                  {block.type === "document" && block.documentUrl && (
                    <div className="space-y-2">
                      {block.title && <h3 className="font-semibold">{block.title}</h3>}
                      <DocumentViewer url={block.documentUrl} title={block.title || "Document"} />
                    </div>
                  )}

                  {block.type === "learning_material" && block.materialUrl && (
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-muted-foreground" />
                        <a href={block.materialUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                          {block.title || "Open learning material"}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {block.type === "quiz" && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{block.content || block.title || "Quiz Question"}</p>
                        <Badge variant="outline" className="text-xs">
                          {block.questionType === "true_false" ? "True / False" : "Multiple Choice"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {block.points || 1} pt{(block.points || 1) === 1 ? "" : "s"}
                        </Badge>
                      </div>
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
          ) : !module.module_document ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No content blocks or document yet</p>
            </div>
          ) : null}

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

