import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Play, FileText, Upload, FileQuestion, Clock, Code, Video, ImageIcon, Link2 } from "lucide-react";
import { Module, Enrollment } from "@/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { MODULE_SESSION_HEARTBEAT_MS, moduleSessionService } from "@/services/moduleSessionService";
import VideoPlayer from "./VideoPlayer";
import DocumentViewer from "./DocumentViewer";
import CourseMaterialImage from "./CourseMaterialImage";
import AssignmentSubmission from "./AssignmentSubmission";
import { ContentBlock } from "./ContentBlock";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseModuleContentBlocks } from "@/lib/contentBlocks";

interface ModuleContentViewerProps {
  module: Module;
  enrollment: Enrollment;
  isCompleted: boolean;
  isPreviewMode?: boolean;
  entrySource?: string;
  onComplete: (timeSpentMinutes?: number, options?: { silent?: boolean }) => void | Promise<void>;
  onPracticeQuizStateChange?: (state: { canRetry: boolean; retry: (() => void) | null }) => void;
}

const ModuleContentViewer = ({
  module,
  enrollment,
  isCompleted,
  isPreviewMode = false,
  entrySource = "course_module_viewer",
  onComplete,
  onPracticeQuizStateChange,
}: ModuleContentViewerProps) => {
  const { user } = useAuth();
  const [timeSpent, setTimeSpent] = useState<number | null>(null);
  const [currentTimeSpent, setCurrentTimeSpent] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResults, setQuizResults] = useState<Record<string, boolean>>({});
  const [completingModule, setCompletingModule] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const displayIntervalRef = useRef<number | null>(null);
  const endingSessionRef = useRef(false);
  const latestResumePositionRef = useRef<number | undefined>(undefined);

  const loadTimeSpent = useCallback(async () => {
    if (!supabase || isPreviewMode) return;

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
  }, [isPreviewMode, module.id, enrollment.id]);

  // Load time spent for this module
  useEffect(() => {
    loadTimeSpent();
  }, [loadTimeSpent]);

  const getElapsedSeconds = useCallback(() => {
    if (!sessionStartedAtRef.current) {
      return 0;
    }

    return Math.max(0, Math.floor((Date.now() - sessionStartedAtRef.current) / 1000));
  }, []);

  const stopLocalTimers = useCallback(() => {
    if (displayIntervalRef.current) {
      window.clearInterval(displayIntervalRef.current);
      displayIntervalRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const flushActiveSession = useCallback(async () => {
    if (!sessionIdRef.current) {
      return;
    }

    const durationSeconds = getElapsedSeconds();
    setCurrentTimeSpent(durationSeconds);

    await moduleSessionService.heartbeatSession(
      sessionIdRef.current,
      durationSeconds,
      latestResumePositionRef.current,
    );
  }, [getElapsedSeconds]);

  const endActiveSession = useCallback(
    async (status: "completed" | "abandoned" | "timed_out") => {
      if (!sessionIdRef.current || endingSessionRef.current) {
        return;
      }

      endingSessionRef.current = true;
      stopLocalTimers();

      const sessionId = sessionIdRef.current;
      const durationSeconds = getElapsedSeconds();

      setCurrentTimeSpent(durationSeconds);

      await moduleSessionService.endSession(
        sessionId,
        durationSeconds,
        status,
        latestResumePositionRef.current,
      );

      sessionIdRef.current = null;
      sessionStartedAtRef.current = null;
      endingSessionRef.current = false;
    },
    [getElapsedSeconds, stopLocalTimers],
  );

  useEffect(() => {
    if (isPreviewMode || !user?.id) {
      return;
    }

    let cancelled = false;

    const startSession = async () => {
      setCurrentTimeSpent(0);

      const session = await moduleSessionService.startSession({
        userId: user.id,
        enrollmentId: enrollment.id,
        courseId: enrollment.courseId,
        moduleId: module.id,
        entrySource,
      });

      if (cancelled || !session) {
        return;
      }

      sessionIdRef.current = session.id;
      sessionStartedAtRef.current = Date.now() - session.durationSeconds * 1000;
      setCurrentTimeSpent(session.durationSeconds);

      displayIntervalRef.current = window.setInterval(() => {
        setCurrentTimeSpent(getElapsedSeconds());
      }, 1000);

      heartbeatIntervalRef.current = window.setInterval(() => {
        if (!sessionIdRef.current) {
          return;
        }

        void flushActiveSession();
      }, MODULE_SESSION_HEARTBEAT_MS);
    };

    void startSession();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        void flushActiveSession();
      }
    };

    const handleBeforeUnload = () => {
      void endActiveSession("timed_out");
    };

    const handlePageHide = () => {
      void endActiveSession("timed_out");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void endActiveSession(isCompleted ? "completed" : "abandoned");
    };
  }, [endActiveSession, enrollment.courseId, enrollment.id, entrySource, flushActiveSession, getElapsedSeconds, isCompleted, isPreviewMode, module.id, user?.id]);

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

  const hasAssignments = !isPreviewMode && module.materials.some((m) => {
    const url = typeof m === "string" ? m : String(m);
    return url.includes("assignment") || url.includes("submit");
  });

  // Parse content blocks from JSON content
  const contentBlocks = useMemo(() => {
    return parseModuleContentBlocks(module.content);
  }, [module.content]);

  const handleMarkModuleComplete = async () => {
    if (isCompleted || completingModule) {
      return;
    }

    setCompletingModule(true);

    try {
      const totalMinutes = timeSpent !== null
        ? Math.max(timeSpent, timeSpent + Math.ceil(currentTimeSpent / 60))
        : Math.ceil(currentTimeSpent / 60);

      await onComplete(totalMinutes > 0 ? totalMinutes : undefined);
    } finally {
      setCompletingModule(false);
    }
  };

  const handleRetryAllPracticeQuizzes = useCallback(() => {
    setQuizAnswers({});
    setQuizResults({});
  }, []);

  useEffect(() => {
    onPracticeQuizStateChange?.({
      canRetry: Object.keys(quizAnswers).length > 0,
      retry: Object.keys(quizAnswers).length > 0 ? handleRetryAllPracticeQuizzes : null,
    });

    return () => {
      onPracticeQuizStateChange?.({ canRetry: false, retry: null });
    };
  }, [handleRetryAllPracticeQuizzes, onPracticeQuizStateChange, quizAnswers]);

  // Get first heading (h1/h2/h3) text from HTML for use as section title
  const getFirstHeadingFromHtml = (html: string): string | null => {
    if (!html?.trim()) return null;
    try {
      const div = document.createElement("div");
      div.innerHTML = html;
      const heading = div.querySelector("h1, h2, h3");
      return heading?.textContent?.trim() || null;
    } catch {
      return null;
    }
  };

  // Remove first h1/h2/h3 from HTML to avoid duplicating it when we show it as header
  const stripFirstHeadingFromHtml = (html: string): string => {
    if (!html?.trim()) return html;
    try {
      const div = document.createElement("div");
      div.innerHTML = html;
      const heading = div.querySelector("h1, h2, h3");
      if (heading) heading.remove();
      return div.innerHTML;
    } catch {
      return html;
    }
  };

  const renderContentBlock = (block: ContentBlock, index: number) => {
    const blockType = (block.type?.toLowerCase?.() ?? block.type) as ContentBlock["type"];
    switch (blockType) {
      case "text": {
        const headerText = block.title || getFirstHeadingFromHtml(block.content) || null;
        const contentHtml = headerText && getFirstHeadingFromHtml(block.content)
          ? stripFirstHeadingFromHtml(block.content)
          : block.content;
        return (
          <div key={block.id || index} className="space-y-3">
            {headerText && (
              <h2 className="text-xl font-semibold tracking-tight scroll-mt-20">
                {headerText}
              </h2>
            )}
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </div>
        );
      }

      case "code":
        return (
          <div key={block.id || index} className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Code className="h-4 w-4" />
              <span>{block.title || "Code Block"}</span>
            </div>
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
            <div key={block.id || index} className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Video className="h-4 w-4" />
                <span>{block.title || "Video"}</span>
              </div>
              <VideoPlayer 
                url={block.videoUrl} 
                enrollmentId={isPreviewMode ? undefined : enrollment.id}
                moduleId={isPreviewMode ? undefined : module.id}
                onPlaybackPositionChange={(seconds) => {
                  latestResumePositionRef.current = seconds;
                }}
              />
            </div>
          );
        }
        return null;

      case "image":
        if (block.imageUrl) {
          return (
            <figure key={block.id || index} className="space-y-3">
              {(block.title || block.caption || block.altText) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                  <span>{block.title || "Image"}</span>
                </div>
              )}
              <CourseMaterialImage
                src={block.imageUrl}
                alt={block.altText || block.title || "Module image"}
                className="max-h-[520px] w-full rounded-lg object-cover"
              />
              {(block.caption || block.altText) && (
                <figcaption className="text-sm text-muted-foreground">{block.caption || block.altText}</figcaption>
              )}
            </figure>
          );
        }
        return null;

      case "document":
        if (block.documentUrl) {
          return (
            <div key={block.id || index} className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{block.title || "Document"}</span>
              </div>
              <DocumentViewer url={block.documentUrl} />
            </div>
          );
        }
        return null;

      case "learning_material":
        if (block.materialUrl) {
          return (
            <div key={block.id || index} className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Link2 className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{block.title || "Learning Material"}</p>
                  <a href={block.materialUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
                    {block.materialUrl}
                  </a>
                </div>
              </div>
            </div>
          );
        }
        return null;

      case "quiz":
        const blockId = block.id || `quiz-${index}`;
        const userAnswer = quizAnswers[blockId];
        const hasAnswered = userAnswer !== undefined;
        const isEssayQuestion = block.questionType === "essay";
        const isCorrect = !isEssayQuestion && hasAnswered && quizResults[blockId];
        const correctAnswerIndex = block.correctAnswer?.toString();
        
        return (
          <Card key={blockId} className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileQuestion className="w-5 h-5" />
                {block.title || "Quiz Question"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-base font-semibold">{block.content || "Question"}</Label>
              </div>
              {isEssayQuestion ? (
                <div className="space-y-3">
                  <Textarea
                    value={userAnswer || ""}
                    onChange={(event) => {
                      setQuizAnswers((prev) => ({ ...prev, [blockId]: event.target.value }));
                    }}
                    placeholder="Write your response here"
                    rows={6}
                  />
                  <p className="text-sm text-muted-foreground">
                    Essay responses entered here are for content preview only. Graded essay submissions happen through the graded assessment activity in the course sidebar.
                  </p>
                </div>
              ) : block.options && block.options.length > 0 && (
                <RadioGroup 
                  value={userAnswer || ""}
                  onValueChange={(value) => {
                    setQuizAnswers(prev => ({ ...prev, [blockId]: value }));
                    const correct = value === correctAnswerIndex;
                    setQuizResults(prev => ({ ...prev, [blockId]: correct }));
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
              {hasAnswered && !isEssayQuestion && (
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
              {hasAnswered && isEssayQuestion && block.explanation && (
                <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  {block.explanation}
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

      <div className="space-y-4">
        {module.module_document && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Module Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentViewer url={module.module_document} title={module.title} />
            </CardContent>
          </Card>
        )}

        {contentBlocks.length > 0 ? (
          <div className="space-y-4">
            {contentBlocks.map((block, idx) => {
              const blockType = (block.type?.toLowerCase?.() ?? block.type) as ContentBlock["type"];
              const renderedBlock = renderContentBlock(block, idx);

              if (!renderedBlock) return null;

              if (blockType === "text" || blockType === "quiz" || blockType === "learning_material") {
                return <div key={block.id || idx}>{renderedBlock}</div>;
              }

              return (
                <div key={block.id || idx} className="rounded-xl border p-4">
                  {renderedBlock}
                </div>
              );
            })}
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
        ) : !module.module_document ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center py-8">
                No content available for this module.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {videoMaterials.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                Videos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {videoMaterials.map((material, index) => {
                const url = typeof material === "string" ? material : String(material);
                const title = `Video ${index + 1}`;

                return (
                  <div key={index} className="space-y-3 rounded-xl border p-4">
                    <p className="text-sm font-medium">{title}</p>
                    <VideoPlayer
                      url={url}
                      enrollmentId={isPreviewMode ? undefined : enrollment.id}
                      moduleId={isPreviewMode ? undefined : module.id}
                      onPlaybackPositionChange={(seconds) => {
                        latestResumePositionRef.current = seconds;
                      }}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {documentMaterials.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Supporting Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {documentMaterials.map((material, index) => {
                const url = typeof material === "string" ? material : String(material);
                const title = `Document ${index + 1}`;

                return (
                  <div key={index} className="space-y-3 rounded-xl border p-4">
                    <p className="text-sm font-medium">{title}</p>
                    <DocumentViewer url={url} title={title} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {hasAssignments && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Assignment Submission
              </CardTitle>
              <CardDescription>
                Submit your assignment for this module.
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
      </div>

      {!isCompleted && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {isPreviewMode
                ? "Preview mode keeps completion changes local to this tab."
                : "Practice quizzes stay inline for immediate feedback. Mark the module complete when you are ready to move forward."}
            </p>
            <Button type="button" onClick={() => void handleMarkModuleComplete()} disabled={completingModule}>
              {completingModule ? "Saving..." : "Mark Module Complete"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ModuleContentViewer;

