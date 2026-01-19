import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Play, FileText, Upload, FileQuestion, Clock } from "lucide-react";
import { Module, Enrollment } from "@/types";
import { supabase } from "@/lib/supabase";
import VideoPlayer from "./VideoPlayer";
import DocumentViewer from "./DocumentViewer";
import AssignmentSubmission from "./AssignmentSubmission";
import AssessmentInterface from "./AssessmentInterface";

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
          <Card>
            <CardHeader>
              <CardTitle>Module Content</CardTitle>
            </CardHeader>
            <CardContent>
              {module.content ? (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: module.content }}
                />
              ) : (
                <p className="text-muted-foreground">No content available for this module.</p>
              )}
            </CardContent>
          </Card>
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

