import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Play, FileText, Upload, FileQuestion, Clock, Type, Code, Video } from "lucide-react";
import { Module, Enrollment } from "@/types";
import { supabase } from "@/lib/supabase";
import VideoPlayer from "./VideoPlayer";
import DocumentViewer from "./DocumentViewer";
import AssignmentSubmission from "./AssignmentSubmission";
import AssessmentInterface from "./AssessmentInterface";
import { ContentBlock } from "./ContentBlock";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface ModuleContentViewerProps {
  module: Module;
  enrollment: Enrollment;
  isCompleted: boolean;
  onComplete: (timeSpentMinutes?: number) => void;
}

const ModuleContentViewer = ({
  module,
  enrollment,
  isCompleted,
  onComplete,
}: ModuleContentViewerProps) => {
  const [activeTab, setActiveTab] = useState("content");
  const [timeSpent, setTimeSpent] = useState<number | null>(null);
  const [currentTimeSpent, setCurrentTimeSpent] = useState(0); // Current session time in seconds
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({}); // Store quiz answers by block ID
  const [quizResults, setQuizResults] = useState<Record<string, boolean>>({}); // Store quiz results (answered correctly)

  const loadTimeSpent = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data } = await supabase
        .from("module_completions")
        .select("time_spent")
        .eq("enrollment_id", enrollment.id)
        .eq("module_id", module.id)
        .single();

      if (data?.time_spent) {
        setTimeSpent(data.time_spent);
      }
    } catch (error) {
      // Module not completed yet, no time spent recorded
    }
  }, [module.id, enrollment.id]);

  // Load time spent for this module
  useEffect(() => {
    loadTimeSpent();
  }, [loadTimeSpent]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Categorize materials (materials are stored as string[] in database)
  const videoMaterials = module.materials.filter((m) => {
    const url = typeof m === "string" ? m : String(m);
    return (
      url.includes("youtube.com") ||
      url.includes("youtu.be") ||
      url.includes("vimeo.com") ||
      url.match(/\.(mp4|webm|ogg)$/i)
    );
  });

  const documentMaterials = module.materials.filter((m) => {
    const url = typeof m === "string" ? m : String(m);
    return url.match(/\.(pdf|doc|docx|ppt|pptx)$/i);
  });

  const hasAssignments = module.materials.some((m) => {
    const url = typeof m === "string" ? m : String(m);
    return url.includes("assignment") || url.includes("submit");
  });

  const hasAssessments = module.materials.some((m) => {
    const url = typeof m === "string" ? m : String(m);
    return url.includes("assessment") || url.includes("quiz") || url.includes("test");
  });

  // Parse content blocks from JSON content
  const contentBlocks = useMemo(() => {
    if (!module.content) return [];
    
    try {
      // Try to parse JSON content blocks
      const parsed = JSON.parse(module.content);
      if (Array.isArray(parsed) && parsed.length > 0) {
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

  const renderContentBlock = (block: ContentBlock, index: number) => {
    switch (block.type) {
      case "text":
        return (
          <div
            key={block.id || index}
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: block.content }}
          />
        );

      case "code":
        return (
          <div key={block.id || index} className="space-y-2">
            {block.language && (
              <Badge variant="outline" className="mb-2">
                {block.language}
              </Badge>
            )}
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
              <code className={`language-${block.language || "plaintext"}`}>
                {block.content}
              </code>
            </pre>
          </div>
        );

      case "video":
        if (block.videoUrl) {
          return (
            <div key={block.id || index} className="space-y-2">
              {block.content && (
                <p className="text-sm text-muted-foreground">{block.content}</p>
              )}
              <VideoPlayer 
                url={block.videoUrl} 
                enrollmentId={enrollment.id}
                moduleId={module.id}
              />
            </div>
          );
        }
        return null;

      case "quiz":
        const blockId = block.id || `quiz-${index}`;
        const userAnswer = quizAnswers[blockId];
        const hasAnswered = userAnswer !== undefined;
        const isCorrect = hasAnswered && quizResults[blockId];
        const correctAnswerIndex = block.correctAnswer?.toString();
        
        return (
          <Card key={blockId} className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileQuestion className="w-5 h-5" />
                Quiz Question
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-base font-semibold">{block.title || "Question"}</Label>
              </div>
              {block.options && block.options.length > 0 && (
                <RadioGroup 
                  disabled={hasAnswered}
                  value={userAnswer || ""}
                  onValueChange={(value) => {
                    if (!hasAnswered) {
                      setQuizAnswers(prev => ({ ...prev, [blockId]: value }));
                      const correct = value === correctAnswerIndex;
                      setQuizResults(prev => ({ ...prev, [blockId]: correct }));
                    }
                  }}
                >
                  {block.options.map((option, optIdx) => {
                    const optionValue = optIdx.toString();
                    const isSelected = userAnswer === optionValue;
                    const isCorrectOption = optionValue === correctAnswerIndex;
                    const showCorrect = hasAnswered && isCorrectOption;
                    const showIncorrect = hasAnswered && isSelected && !isCorrectOption;
                    
                    return (
                      <div key={optIdx} className="flex items-center space-x-2">
                        <RadioGroupItem 
                          value={optionValue} 
                          id={`${blockId}-option-${optIdx}`} 
                        />
                        <Label
                          htmlFor={`${blockId}-option-${optIdx}`}
                          className={`cursor-pointer flex-1 ${
                            showCorrect
                              ? "font-semibold text-green-600 dark:text-green-400"
                              : showIncorrect
                              ? "font-semibold text-red-600 dark:text-red-400"
                              : isSelected
                              ? "font-semibold"
                              : ""
                          }`}
                        >
                          {option}
                        </Label>
                        {showCorrect && (
                          <Badge variant="default" className="ml-2 bg-green-600">
                            Correct
                          </Badge>
                        )}
                        {showIncorrect && (
                          <Badge variant="destructive" className="ml-2">
                            Incorrect
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </RadioGroup>
              )}
              {hasAnswered && (
                <div className={`mt-4 p-3 rounded-lg ${
                  isCorrect 
                    ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800" 
                    : "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
                }`}>
                  <p className={`text-sm font-medium mb-1 ${
                    isCorrect 
                      ? "text-green-800 dark:text-green-200" 
                      : "text-red-800 dark:text-red-200"
                  }`}>
                    {isCorrect ? "✓ Correct!" : "✗ Incorrect"}
                  </p>
                  {block.explanation && (
                    <p className={`text-sm ${
                      isCorrect 
                        ? "text-green-700 dark:text-green-300" 
                        : "text-red-700 dark:text-red-300"
                    }`}>
                      {block.explanation}
                    </p>
                  )}
                </div>
              )}
              {!hasAnswered && block.explanation && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Hint:</p>
                  <p className="text-sm text-muted-foreground">{block.explanation}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">{module.title}</CardTitle>
                {isCompleted && (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Completed
                  </Badge>
                )}
              </div>
              <CardDescription>{module.description}</CardDescription>
              {(timeSpent !== null || currentTimeSpent > 0) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <Clock className="w-4 h-4" />
                  <span>
                    Time spent: {timeSpent !== null ? formatTime(timeSpent * 60) : formatTime(currentTimeSpent)}
                    {timeSpent !== null && currentTimeSpent > 0 && ` (+ ${formatTime(currentTimeSpent)})`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Module Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="content">Content</TabsTrigger>
          {videoMaterials.length > 0 && <TabsTrigger value="videos">Videos</TabsTrigger>}
          {documentMaterials.length > 0 && <TabsTrigger value="documents">Documents</TabsTrigger>}
          {(hasAssignments || hasAssessments) && (
            <TabsTrigger value="activities">Activities</TabsTrigger>
          )}
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-4">
          {contentBlocks.length > 0 ? (
            <div className="space-y-4">
              {contentBlocks.map((block, idx) => (
                <Card key={block.id || idx}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      {block.type === "text" && <Type className="w-4 h-4 text-muted-foreground" />}
                      {block.type === "code" && <Code className="w-4 h-4 text-muted-foreground" />}
                      {block.type === "video" && <Video className="w-4 h-4 text-muted-foreground" />}
                      {block.type === "quiz" && <FileQuestion className="w-4 h-4 text-muted-foreground" />}
                      <CardTitle className="text-lg capitalize">
                        {block.type === "quiz" ? block.title || "Quiz Question" : `${block.type} Block`}
                      </CardTitle>
                      {block.type === "code" && block.language && (
                        <Badge variant="outline" className="ml-2">
                          {block.language}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {renderContentBlock(block, idx)}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : module.content ? (
            <Card>
              <CardHeader>
                <CardTitle>Module Content</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: module.content }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center py-8">
                  No content available for this module.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Videos Tab */}
        {videoMaterials.length > 0 && (
          <TabsContent value="videos" className="space-y-4">
            {videoMaterials.map((material, index) => {
              const url = typeof material === "string" ? material : String(material);
              const title = `Video ${index + 1}`;
              
              return (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="w-5 h-5" />
                      {title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VideoPlayer 
                      url={url} 
                      enrollmentId={enrollment.id}
                      moduleId={module.id}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        )}

        {/* Documents Tab */}
        {documentMaterials.length > 0 && (
          <TabsContent value="documents" className="space-y-4">
            {documentMaterials.map((material, index) => {
              const url = typeof material === "string" ? material : String(material);
              const title = `Document ${index + 1}`;
              
              return (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      {title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DocumentViewer url={url} title={title} />
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        )}

        {/* Activities Tab */}
        {(hasAssignments || hasAssessments) && (
          <TabsContent value="activities" className="space-y-4">
            {hasAssignments && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Assignment Submission
                  </CardTitle>
                  <CardDescription>
                    Submit your assignment for this module
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AssignmentSubmission
                    enrollmentId={enrollment.id}
                    moduleId={module.id}
                    courseId={enrollment.courseId}
                  />
                </CardContent>
              </Card>
            )}

            {hasAssessments && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileQuestion className="w-5 h-5" />
                    Assessment
                  </CardTitle>
                  <CardDescription>
                    Take the assessment for this module
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AssessmentInterface
                    enrollmentId={enrollment.id}
                    moduleId={module.id}
                    courseId={enrollment.courseId}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Complete Module Button */}
      {!isCompleted && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mark this module as complete when you're done reviewing all content
              </p>
              <Button 
                onClick={() => {
                  const totalMinutes = timeSpent !== null 
                    ? timeSpent + Math.ceil(currentTimeSpent / 60)
                    : Math.ceil(currentTimeSpent / 60);
                  onComplete(totalMinutes);
                }} 
                className="gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark as Complete
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ModuleContentViewer;

