import { Suspense, lazy, memo, useEffect, useCallback, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Play, FileText, Upload, FileQuestion, Clock, Code, Video, ImageIcon, Link2, AlertCircle } from "lucide-react";
import { Module, Enrollment, PracticeQuizCompletionSnapshot, PracticeQuizDraftSnapshot, PracticeQuizEssayResponse, Submission } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { MODULE_SESSION_HEARTBEAT_MS, moduleSessionService } from "@/services/moduleSessionService";
import CourseMaterialImage from "./CourseMaterialImage";
import AssignmentSubmission from "./AssignmentSubmission";
import { ContentBlock } from "./ContentBlock";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { parseModuleContentBlocks } from "@/lib/contentBlocks";
import { isSupportedCourseVideoUrl } from "@/lib/videoEmbeds";
import { moduleViewerStateService } from "@/services/moduleViewerStateService";
import { practiceQuizEssayReviewService } from "@/services/practiceQuizEssayReviewService";
import { toast } from "sonner";

const PRACTICE_QUIZ_PROGRESS_STORAGE_PREFIX = "peso-practice-quiz-progress:";
const LARGE_TEXT_BLOCK_THRESHOLD = 4000;
const HEAVY_VIEWER_ROOT_MARGIN = "320px 0px";
const BLOCK_REVEAL_ROOT_MARGIN = "520px 0px";
const INITIAL_BLOCK_RENDER_BUDGET = 6;
const REVEAL_BLOCK_RENDER_BUDGET = 7;
const MIN_INITIAL_BLOCKS = 3;
const MIN_REVEAL_BLOCKS = 2;
const HYBRID_VIRTUALIZATION_MIN_BLOCKS = 28;
const HYBRID_VIRTUALIZATION_MIN_SIMPLE_BLOCKS = 18;
const VIRTUALIZATION_OVERSCAN_PX = 1400;
const EMPTY_SUBMISSIONS: Submission[] = [];

const VideoPlayer = lazy(() => import("./VideoPlayer"));
const DocumentViewer = lazy(() => import("./DocumentViewer"));

type PracticeQuizProgressSnapshot = {
  selections: Record<string, string>;
  submittedAnswers: Record<string, string>;
  updatedAt: string;
};

const buildPracticeQuizProgressStorageKey = (userId: string, enrollmentId: string, moduleId: string) =>
  `${PRACTICE_QUIZ_PROGRESS_STORAGE_PREFIX}${userId}:${enrollmentId}:${moduleId}`;

type ModuleViewerEnrollmentContext = Pick<Enrollment, "id" | "courseId">;

const readStoredPracticeQuizProgressSnapshot = (
  storageKey: string | null,
  objectivePracticeQuizBlockIds: Set<string>,
): PracticeQuizProgressSnapshot | null => {
  if (!storageKey || typeof window === "undefined") {
    return null;
  }

  try {
    const rawSnapshot = window.localStorage.getItem(storageKey);
    if (!rawSnapshot) {
      return null;
    }

    const parsedSnapshot = JSON.parse(rawSnapshot) as Partial<PracticeQuizProgressSnapshot>;
    return {
      selections: Object.fromEntries(
        Object.entries(parsedSnapshot.selections || {}).filter(([blockId]) => objectivePracticeQuizBlockIds.has(blockId)),
      ),
      submittedAnswers: Object.fromEntries(
        Object.entries(parsedSnapshot.submittedAnswers || {}).filter(([blockId]) => objectivePracticeQuizBlockIds.has(blockId)),
      ),
      updatedAt: typeof parsedSnapshot.updatedAt === "string" && parsedSnapshot.updatedAt.trim()
        ? parsedSnapshot.updatedAt
        : new Date(0).toISOString(),
    };
  } catch (error) {
    console.warn("Failed to restore practice quiz progress snapshot:", error);
    return null;
  }
};

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

const stripFirstHeadingFromHtml = (html: string): string => {
  if (!html?.trim()) return html;

  try {
    const div = document.createElement("div");
    div.innerHTML = html;
    const heading = div.querySelector("h1, h2, h3");
    if (heading) {
      heading.remove();
    }
    return div.innerHTML;
  } catch {
    return html;
  }
};

const ViewerMountPlaceholder = ({ label, minHeight = 280 }: { label: string; minHeight?: number }) => (
  <div
    className="flex items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground"
    style={{ minHeight }}
  >
    {label}
  </div>
);

const getBlockRenderWeight = (block: ContentBlock) => {
  const blockType = (block.type?.toLowerCase?.() ?? block.type) as ContentBlock["type"];

  switch (blockType) {
    case "document":
    case "video":
      return 3;
    case "image":
      return block.imageUrl ? 2 : 1;
    case "text":
      return block.content.length >= LARGE_TEXT_BLOCK_THRESHOLD ? 3 : 1;
    case "quiz":
      return block.questionType === "essay" ? 2 : 1;
    default:
      return 1;
  }
};

const getBlockPlaceholderHeight = (block: ContentBlock) => {
  const blockType = (block.type?.toLowerCase?.() ?? block.type) as ContentBlock["type"];

  switch (blockType) {
    case "video":
      return 320;
    case "document":
      return block.allowLearnerUpload ? 300 : 360;
    case "image":
      return 260;
    case "quiz":
      return block.questionType === "essay" ? 280 : 220;
    case "text":
      return block.content.length >= LARGE_TEXT_BLOCK_THRESHOLD ? 260 : 180;
    case "code":
      return 220;
    default:
      return 140;
  }
};

const getBlockPlaceholderLabel = (block: ContentBlock) => {
  const blockType = (block.type?.toLowerCase?.() ?? block.type) as ContentBlock["type"];

  switch (blockType) {
    case "document":
      return "Document section loads as you approach it.";
    case "video":
      return "Video section loads as you approach it.";
    case "image":
      return "Image section loads as you approach it.";
    case "quiz":
      return block.questionType === "essay"
        ? "Essay prompt loads as you approach it."
        : "Quiz question loads as you approach it.";
    case "text":
      return block.content.length >= LARGE_TEXT_BLOCK_THRESHOLD
        ? "Large text section loads as you approach it."
        : "Content section loads as you approach it.";
    default:
      return "Content block loads as you approach it.";
  }
};

const computeProgressiveRevealCount = (
  blocks: ContentBlock[],
  startIndex: number,
  budget: number,
  minimumCount: number,
) => {
  if (startIndex >= blocks.length) {
    return startIndex;
  }

  let nextIndex = startIndex;
  let currentBudget = 0;

  while (nextIndex < blocks.length) {
    currentBudget += getBlockRenderWeight(blocks[nextIndex]);
    nextIndex += 1;

    if (nextIndex - startIndex >= minimumCount && currentBudget >= budget) {
      break;
    }
  }

  return nextIndex;
};

const isBlockHybridVirtualizable = (block: ContentBlock) => {
  const blockType = (block.type?.toLowerCase?.() ?? block.type) as ContentBlock["type"];
  return blockType === "text" || blockType === "quiz" || blockType === "learning_material";
};

const getBlockEstimatedHeight = (block: ContentBlock) => {
  const blockType = (block.type?.toLowerCase?.() ?? block.type) as ContentBlock["type"];

  switch (blockType) {
    case "text":
      return block.content.length >= LARGE_TEXT_BLOCK_THRESHOLD ? 280 : 180;
    case "quiz":
      return block.questionType === "essay" ? 320 : 240;
    case "learning_material":
      return 120;
    case "code":
      return 220;
    case "image":
      return 280;
    case "document":
      return 360;
    case "video":
      return 340;
    default:
      return 160;
  }
};

const areStringSetsEqual = (left: Set<string>, right: Set<string>) => {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
};

const DeferredViewportMount = ({
  children,
  enabled = true,
  placeholder,
}: {
  children: React.ReactNode;
  enabled?: boolean;
  placeholder?: React.ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setIsVisible(true);
      return;
    }

    if (isVisible) {
      return;
    }

    const element = containerRef.current;
    if (!element) {
      return;
    }

    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            setIsVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      {
        rootMargin: HEAVY_VIEWER_ROOT_MARGIN,
        threshold: 0.01,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [enabled, isVisible]);

  return <div ref={containerRef}>{isVisible ? children : placeholder}</div>;
};

const MemoTextBlock = memo(({ block }: { block: ContentBlock }) => {
  const { headerText, contentHtml, deferMount } = useMemo(() => {
    const derivedHeading = getFirstHeadingFromHtml(block.content);
    const resolvedHeaderText = block.title || derivedHeading || null;
    const resolvedContentHtml = resolvedHeaderText && derivedHeading
      ? stripFirstHeadingFromHtml(block.content)
      : block.content;

    return {
      headerText: resolvedHeaderText,
      contentHtml: resolvedContentHtml,
      deferMount: resolvedContentHtml.length >= LARGE_TEXT_BLOCK_THRESHOLD,
    };
  }, [block.content, block.title]);

  const content = (
    <div
      className="prose prose-sm max-w-none leading-7 prose-p:my-4 prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6 prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6 prose-li:my-1 dark:prose-invert [&_ul_ul]:my-2 [&_ul_ul]:list-[circle] [&_ul_ul]:pl-6 [&_ol_ol]:my-2 [&_ol_ol]:list-[lower-alpha] [&_ol_ol]:pl-6 [&_ol_ul]:my-2 [&_ol_ul]:list-disc [&_ol_ul]:pl-6 [&_ul_ol]:my-2 [&_ul_ol]:list-decimal [&_ul_ol]:pl-6 [&_p:empty]:block [&_p:empty]:h-6"
      dangerouslySetInnerHTML={{ __html: contentHtml }}
    />
  );

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="space-y-4">
        {headerText ? <h2 className="scroll-mt-20 text-xl font-semibold tracking-tight">{headerText}</h2> : null}
        <DeferredViewportMount
          enabled={deferMount}
          placeholder={<ViewerMountPlaceholder label="Preparing content section..." minHeight={220} />}
        >
          {content}
        </DeferredViewportMount>
      </div>
    </div>
  );
});

const MemoCodeBlock = memo(({ block }: { block: ContentBlock }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Code className="h-4 w-4" />
      <span>{block.title || "Code Block"}</span>
    </div>
    {block.language ? (
      <Badge variant="outline" className="mb-2">
        {block.language}
      </Badge>
    ) : null}
    <pre className="overflow-x-auto rounded-lg bg-muted p-4">
      <code className={`language-${block.language || "plaintext"}`}>{block.content}</code>
    </pre>
  </div>
));

const MemoImageBlock = memo(({ block }: { block: ContentBlock }) => {
  if (!block.imageUrl) {
    return null;
  }

  return (
    <figure className="space-y-3">
      {block.title || block.caption || block.altText ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          <span>{block.title || "Image"}</span>
        </div>
      ) : null}
      <CourseMaterialImage
        src={block.imageUrl}
        alt={block.altText || block.title || "Module image"}
        className="max-h-[520px] w-full rounded-lg object-cover"
      />
      {block.caption || block.altText ? (
        <figcaption className="text-sm text-muted-foreground">{block.caption || block.altText}</figcaption>
      ) : null}
    </figure>
  );
});

const MemoLearningMaterialBlock = memo(({ block }: { block: ContentBlock }) => {
  if (!block.materialUrl) {
    return null;
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <Link2 className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="font-medium">{block.title || "Learning Material"}</p>
          <a
            href={block.materialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-sm text-primary hover:underline"
          >
            {block.materialUrl}
          </a>
        </div>
      </div>
    </div>
  );
});

const MemoVideoBlock = memo(({
  block,
  enrollmentId,
  moduleId,
  isPreviewMode,
  onPlaybackPositionChange,
}: {
  block: ContentBlock;
  enrollmentId: string;
  moduleId: string;
  isPreviewMode: boolean;
  onPlaybackPositionChange: (seconds: number) => void;
}) => {
  if (!block.videoUrl) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Video className="h-4 w-4" />
        <span>{block.title || "Video"}</span>
      </div>
      <DeferredViewportMount placeholder={<ViewerMountPlaceholder label="Video loads when you reach this section." minHeight={320} />}>
        <Suspense fallback={<ViewerMountPlaceholder label="Loading video player..." minHeight={320} />}>
          <VideoPlayer
            url={block.videoUrl}
            enrollmentId={isPreviewMode ? undefined : enrollmentId}
            moduleId={isPreviewMode ? undefined : moduleId}
            onPlaybackPositionChange={onPlaybackPositionChange}
          />
        </Suspense>
      </DeferredViewportMount>
    </div>
  );
});

const MemoDocumentBlock = memo(({
  block,
  enrollment,
  module,
  isPreviewMode,
  submissions,
  onSubmitted,
}: {
  block: ContentBlock;
  enrollment: ModuleViewerEnrollmentContext;
  module: Module;
  isPreviewMode: boolean;
  submissions: Submission[];
  onSubmitted: () => void;
}) => {
  if (!block.documentUrl && !block.allowLearnerUpload) {
    return null;
  }

  const latestSubmission = submissions[0];

  return (
    <div className="space-y-3">
      {block.title || block.documentUrl ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>{block.title || "Document"}</span>
        </div>
      ) : null}
      {block.documentUrl ? (
        <DeferredViewportMount placeholder={<ViewerMountPlaceholder label="Document preview loads when visible." minHeight={360} />}>
          <Suspense fallback={<ViewerMountPlaceholder label="Loading document preview..." minHeight={360} />}>
            <DocumentViewer url={block.documentUrl} title={block.title || "Document"} />
          </Suspense>
        </DeferredViewportMount>
      ) : null}
      {!isPreviewMode && block.allowLearnerUpload ? (
        <Card className="border-dashed bg-muted/20 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Upload Your File
              {submissions.length ? <Badge variant="secondary">Uploaded</Badge> : null}
            </CardTitle>
            <CardDescription>
              {block.learnerUploadInstructions?.trim() || "Submit your own file for this document activity. Trainers and admins do not review inline practice-quiz essays, but uploaded document submissions continue through the assignment review flow."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {latestSubmission ? (
              <div className="mb-4 rounded-lg border bg-background p-3 text-sm">
                <p className="font-medium">Latest upload</p>
                <p className="mt-1 text-muted-foreground">
                  Submitted {new Date(latestSubmission.submitted_at || "").toLocaleString()} • Status: {latestSubmission.status.replace(/_/g, " ")}
                </p>
              </div>
            ) : null}
            <AssignmentSubmission
              enrollmentId={enrollment.id}
              moduleId={module.id}
              courseId={enrollment.courseId}
              defaultTitle={block.title ? `${block.title} submission` : `${module.title} document submission`}
              titleLabel="Submission Title *"
              titlePlaceholder="Enter a title for your uploaded document"
              descriptionPlaceholder="Add notes about your upload if needed"
              submitLabel="Submit File"
              successMessage="File submitted successfully. It is now available in the assignment review queue."
              metadata={{
                source: "document_block",
                documentBlockId: block.id,
                documentBlockTitle: block.title || null,
                documentUrl: block.documentUrl || null,
              }}
              onSubmitted={onSubmitted}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
});

const MemoQuizBlock = memo(({
  block,
  blockId,
  selectedAnswer,
  submittedAnswer,
  isCorrect,
  savedEssayResponse,
  savingEssay,
  essaySaveError,
  onObjectiveSelectionChange,
  onObjectiveSubmit,
  onEssayDraftChange,
  onEssayBlur,
}: {
  block: ContentBlock;
  blockId: string;
  selectedAnswer?: string;
  submittedAnswer?: string;
  isCorrect?: boolean;
  savedEssayResponse?: PracticeQuizEssayResponse;
  savingEssay?: boolean;
  essaySaveError?: string | null;
  onObjectiveSelectionChange: (blockId: string, value: string) => void;
  onObjectiveSubmit: (blockId: string, value: string) => void;
  onEssayDraftChange: (blockId: string, value: string) => void;
  onEssayBlur: (block: ContentBlock, responseText: string) => void;
}) => {
  const hasSelection = selectedAnswer !== undefined;
  const isSubmitted = submittedAnswer !== undefined;
  const isEssayQuestion = block.questionType === "essay";
  const correctAnswerIndex = block.correctAnswer?.toString();
  const questionPoints = Math.max(1, Number(block.points) || 1);

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <FileQuestion className="h-5 w-5" />
          {block.title || "Quiz Question"}
          <Badge variant="outline">{questionPoints} pt{questionPoints === 1 ? "" : "s"}</Badge>
          {isEssayQuestion ? <Badge variant="secondary">Formative review</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-base font-semibold">{block.content || "Question"}</Label>
        </div>
        {isEssayQuestion ? (
          <div className="space-y-3">
            <Textarea
              value={selectedAnswer || ""}
              onChange={(event) => onEssayDraftChange(blockId, event.target.value)}
              onBlur={() => onEssayBlur(block, selectedAnswer || "")}
              placeholder="Write your response here"
              rows={6}
            />
            <p className="text-sm text-muted-foreground">
              Essay responses are saved for separate trainer and admin review in the learner progress pages. This feedback is formative only and stays separate from graded assessments, completion, and certificate decisions.
            </p>
            {savingEssay ? (
              <p className="text-xs text-muted-foreground">Saving essay response for review...</p>
            ) : savedEssayResponse?.updated_at ? (
              <p className="text-xs text-muted-foreground">Last saved {new Date(savedEssayResponse.updated_at).toLocaleString()}</p>
            ) : null}
            {essaySaveError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{essaySaveError}</div>
            ) : null}
            {savedEssayResponse?.review_feedback ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <p className="font-medium">Staff feedback</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{savedEssayResponse.review_feedback}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {savedEssayResponse.reviewer_name ? `Reviewed by ${savedEssayResponse.reviewer_name}` : "Reviewed by staff"}
                  {savedEssayResponse.reviewed_at ? ` • ${new Date(savedEssayResponse.reviewed_at as string).toLocaleString()}` : ""}
                </p>
              </div>
            ) : null}
          </div>
        ) : block.options && block.options.length > 0 ? (
          <RadioGroup
            value={selectedAnswer || ""}
            onValueChange={(value) => {
              if (!isSubmitted) {
                onObjectiveSelectionChange(blockId, value);
              }
            }}
          >
            {block.options.map((option, optIdx) => {
              const optionValue = optIdx.toString();
              const isSelected = selectedAnswer === optionValue;
              const isCorrectOption = optionValue === correctAnswerIndex;
              const showCorrect = isSubmitted && isCorrectOption;
              const showIncorrect = isSubmitted && submittedAnswer === optionValue && !isCorrectOption;

              return (
                <div key={optIdx} className="flex items-center space-x-2">
                  <RadioGroupItem value={optionValue} id={`${blockId}-option-${optIdx}`} disabled={isSubmitted} />
                  <Label
                    htmlFor={`${blockId}-option-${optIdx}`}
                    className={`flex-1 cursor-pointer ${
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
                  {showCorrect ? (
                    <Badge variant="default" className="ml-2 bg-green-600">
                      Correct
                    </Badge>
                  ) : null}
                  {showIncorrect ? (
                    <Badge variant="destructive" className="ml-2">
                      Incorrect
                    </Badge>
                  ) : null}
                </div>
              );
            })}
          </RadioGroup>
        ) : null}
        {hasSelection && !isSubmitted && !isEssayQuestion ? (
          <Button
            type="button"
            onClick={() => {
              if (selectedAnswer) {
                onObjectiveSubmit(blockId, selectedAnswer);
              }
            }}
          >
            Submit Answer
          </Button>
        ) : null}
        {isSubmitted && !isEssayQuestion ? (
          <div
            className={`mt-4 rounded-lg p-3 ${
              isCorrect
                ? "border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
                : "border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
            }`}
          >
            <p
              className={`mb-1 text-sm font-medium ${
                isCorrect ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"
              }`}
            >
              {isCorrect ? "✓ Correct!" : "✗ Incorrect"}
            </p>
            <p
              className={`mb-1 text-sm ${
                isCorrect ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
              }`}
            >
              Score: {isCorrect ? questionPoints : 0} / {questionPoints} pt{questionPoints === 1 ? "" : "s"}
            </p>
            {block.explanation ? (
              <p
                className={`text-sm ${
                  isCorrect ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                }`}
              >
                {block.explanation}
              </p>
            ) : null}
          </div>
        ) : null}
        {hasSelection && isEssayQuestion && block.explanation ? (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">{block.explanation}</div>
        ) : null}
      </CardContent>
    </Card>
  );
});

const MemoModuleContentBlockItem = memo(({
  block,
  index,
  enrollment,
  module,
  isPreviewMode,
  documentBlockSubmissions,
  selectedAnswer,
  submittedAnswer,
  isCorrect,
  essayResponse,
  savingEssay,
  essaySaveError,
  onObjectiveSelectionChange,
  onObjectiveSubmit,
  onEssayDraftChange,
  onEssayBlur,
  onDocumentSubmissionSaved,
  onPlaybackPositionChange,
}: {
  block: ContentBlock;
  index: number;
  enrollment: ModuleViewerEnrollmentContext;
  module: Module;
  isPreviewMode: boolean;
  documentBlockSubmissions: Submission[];
  selectedAnswer?: string;
  submittedAnswer?: string;
  isCorrect?: boolean;
  essayResponse?: PracticeQuizEssayResponse;
  savingEssay?: boolean;
  essaySaveError?: string | null;
  onObjectiveSelectionChange: (blockId: string, value: string) => void;
  onObjectiveSubmit: (blockId: string, value: string) => void;
  onEssayDraftChange: (blockId: string, value: string) => void;
  onEssayBlur: (block: ContentBlock, responseText: string) => void;
  onDocumentSubmissionSaved: () => void;
  onPlaybackPositionChange: (seconds: number) => void;
}) => {
  const blockType = (block.type?.toLowerCase?.() ?? block.type) as ContentBlock["type"];
  const blockId = block.id || `block-${index}`;

  switch (blockType) {
    case "text":
      return <MemoTextBlock block={block} />;
    case "code":
      return <MemoCodeBlock block={block} />;
    case "image":
      return <MemoImageBlock block={block} />;
    case "learning_material":
      return <MemoLearningMaterialBlock block={block} />;
    case "video":
      return (
        <MemoVideoBlock
          block={block}
          enrollmentId={enrollment.id}
          moduleId={module.id}
          isPreviewMode={isPreviewMode}
          onPlaybackPositionChange={onPlaybackPositionChange}
        />
      );
    case "document":
      return (
        <MemoDocumentBlock
          block={block}
          enrollment={enrollment}
          module={module}
          isPreviewMode={isPreviewMode}
          submissions={documentBlockSubmissions}
          onSubmitted={onDocumentSubmissionSaved}
        />
      );
    case "quiz":
      return (
        <MemoQuizBlock
          block={block}
          blockId={blockId}
          selectedAnswer={selectedAnswer}
          submittedAnswer={submittedAnswer}
          isCorrect={isCorrect}
          savedEssayResponse={essayResponse}
          savingEssay={savingEssay}
          essaySaveError={essaySaveError}
          onObjectiveSelectionChange={onObjectiveSelectionChange}
          onObjectiveSubmit={onObjectiveSubmit}
          onEssayDraftChange={onEssayDraftChange}
          onEssayBlur={onEssayBlur}
        />
      );
    default:
      return null;
  }
});

const MemoSupplementalVideoSection = memo(({
  videoMaterials,
  enrollment,
  moduleId,
  isPreviewMode,
  onPlaybackPositionChange,
}: {
  videoMaterials: string[];
  enrollment: ModuleViewerEnrollmentContext;
  moduleId: string;
  isPreviewMode: boolean;
  onPlaybackPositionChange: (seconds: number) => void;
}) => {
  if (videoMaterials.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Videos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {videoMaterials.map((material, index) => {
          const title = `Video ${index + 1}`;

          return (
            <div key={`${material}:${index}`} className="space-y-3 rounded-xl border p-4">
              <p className="text-sm font-medium">{title}</p>
              <DeferredViewportMount placeholder={<ViewerMountPlaceholder label="Video loads when you reach this section." minHeight={320} />}>
                <Suspense fallback={<ViewerMountPlaceholder label="Loading video player..." minHeight={320} />}>
                  <VideoPlayer
                    url={material}
                    enrollmentId={isPreviewMode ? undefined : enrollment.id}
                    moduleId={isPreviewMode ? undefined : moduleId}
                    onPlaybackPositionChange={onPlaybackPositionChange}
                  />
                </Suspense>
              </DeferredViewportMount>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
});

const MemoSupplementalDocumentSection = memo(({ documentMaterials }: { documentMaterials: string[] }) => {
  if (documentMaterials.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Supporting Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {documentMaterials.map((material, index) => {
          const title = `Document ${index + 1}`;

          return (
            <div key={`${material}:${index}`} className="space-y-3 rounded-xl border p-4">
              <p className="text-sm font-medium">{title}</p>
              <DeferredViewportMount placeholder={<ViewerMountPlaceholder label="Document preview loads when visible." minHeight={360} />}>
                <Suspense fallback={<ViewerMountPlaceholder label="Loading document preview..." minHeight={360} />}>
                  <DocumentViewer url={material} title={title} />
                </Suspense>
              </DeferredViewportMount>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
});

const MemoBlockSkeleton = memo(({ block }: { block: ContentBlock }) => {
  const blockType = (block.type?.toLowerCase?.() ?? block.type) as ContentBlock["type"];
  const minHeight = getBlockPlaceholderHeight(block);
  const label = getBlockPlaceholderLabel(block);
  const isFramed = !(blockType === "text" || blockType === "quiz" || blockType === "learning_material");

  const placeholder = (
    <div className="space-y-4 rounded-xl border border-dashed bg-muted/20 p-4" style={{ minHeight }}>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );

  return isFramed ? <div className="rounded-xl border p-4">{placeholder}</div> : placeholder;
});

const VirtualizedBlockSpacer = memo(({
  height,
  label,
}: {
  height: number;
  label: string;
}) => (
  <div
    aria-hidden="true"
    className="rounded-xl border border-dashed bg-muted/10 px-4 py-3"
    style={{ minHeight: height, height }}
  >
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{label}</div>
  </div>
));

const HybridVirtualizedBlockSlot = memo(({
  block,
  index,
  blockKey,
  isMounted,
  shouldRenderContent,
  placeholderHeight,
  renderBlock,
  onWrapperRefChange,
  onMeasuredHeight,
  totalCount,
}: {
  block: ContentBlock;
  index: number;
  blockKey: string;
  isMounted: boolean;
  shouldRenderContent: boolean;
  placeholderHeight: number;
  renderBlock: (block: ContentBlock, index: number) => React.ReactNode;
  onWrapperRefChange: (blockKey: string, node: HTMLDivElement | null) => void;
  onMeasuredHeight: (blockKey: string, height: number) => void;
  totalCount: number;
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMounted || !shouldRenderContent) {
      return;
    }

    const element = wrapperRef.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      const nextHeight = element.getBoundingClientRect().height;
      if (nextHeight > 0) {
        onMeasuredHeight(blockKey, nextHeight);
      }
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [blockKey, isMounted, onMeasuredHeight, shouldRenderContent]);

  return (
    <div
      ref={(node) => {
        wrapperRef.current = node;
        onWrapperRefChange(blockKey, node);
      }}
      role="listitem"
      aria-posinset={index + 1}
      aria-setsize={totalCount}
      data-block-key={blockKey}
    >
      {!isMounted ? (
        <MemoBlockSkeleton block={block} />
      ) : shouldRenderContent ? (
        renderBlock(block, index)
      ) : (
        <VirtualizedBlockSpacer height={placeholderHeight} label={getBlockPlaceholderLabel(block)} />
      )}
    </div>
  );
});

const ProgressiveContentBlockList = memo(({
  blocks,
  renderBlock,
  contentKey,
}: {
  blocks: ContentBlock[];
  renderBlock: (block: ContentBlock, index: number) => React.ReactNode;
  contentKey: string;
}) => {
  const revealBoundaryRef = useRef<HTMLDivElement | null>(null);
  const wrapperRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [mountedCount, setMountedCount] = useState(() =>
    computeProgressiveRevealCount(blocks, 0, INITIAL_BLOCK_RENDER_BUDGET, MIN_INITIAL_BLOCKS),
  );
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const [renderedVirtualizedBlockKeys, setRenderedVirtualizedBlockKeys] = useState<Set<string>>(new Set());
  const [keyboardAccessibilityMode, setKeyboardAccessibilityMode] = useState(false);

  const shouldEnableHybridVirtualization = useMemo(() => {
    const simpleBlockCount = blocks.filter(isBlockHybridVirtualizable).length;
    return blocks.length >= HYBRID_VIRTUALIZATION_MIN_BLOCKS && simpleBlockCount >= HYBRID_VIRTUALIZATION_MIN_SIMPLE_BLOCKS;
  }, [blocks]);

  const virtualizationEnabled = shouldEnableHybridVirtualization && !keyboardAccessibilityMode;

  useEffect(() => {
    setMountedCount(computeProgressiveRevealCount(blocks, 0, INITIAL_BLOCK_RENDER_BUDGET, MIN_INITIAL_BLOCKS));
    setMeasuredHeights({});
    setRenderedVirtualizedBlockKeys(new Set());
    setKeyboardAccessibilityMode(false);
    wrapperRefs.current = {};
  }, [blocks, contentKey]);

  const revealNextGroup = useCallback(() => {
    setMountedCount((current) => {
      if (current >= blocks.length) {
        return current;
      }

      return computeProgressiveRevealCount(blocks, current, REVEAL_BLOCK_RENDER_BUDGET, MIN_REVEAL_BLOCKS);
    });
  }, [blocks]);

  const registerWrapperRef = useCallback((blockKey: string, node: HTMLDivElement | null) => {
    if (node) {
      wrapperRefs.current[blockKey] = node;
      return;
    }

    delete wrapperRefs.current[blockKey];
  }, []);

  const recordMeasuredHeight = useCallback((blockKey: string, height: number) => {
    setMeasuredHeights((current) => {
      if (current[blockKey] === height) {
        return current;
      }

      return {
        ...current,
        [blockKey]: height,
      };
    });
  }, []);

  const updateRenderedVirtualizedBlockKeys = useCallback(() => {
    const nextKeys = new Set<string>();

    blocks.slice(0, mountedCount).forEach((block, index) => {
      const blockKey = block.id || index.toString();

      if (!virtualizationEnabled || !isBlockHybridVirtualizable(block)) {
        nextKeys.add(blockKey);
        return;
      }

      const element = wrapperRefs.current[blockKey];
      const activeElement = typeof document !== "undefined" ? document.activeElement : null;

      if (!element) {
        nextKeys.add(blockKey);
        return;
      }

      if (activeElement instanceof Node && element.contains(activeElement)) {
        nextKeys.add(blockKey);
        return;
      }

      const rect = element.getBoundingClientRect();
      if (rect.bottom >= -VIRTUALIZATION_OVERSCAN_PX && rect.top <= window.innerHeight + VIRTUALIZATION_OVERSCAN_PX) {
        nextKeys.add(blockKey);
      }
    });

    setRenderedVirtualizedBlockKeys((current) => (areStringSetsEqual(current, nextKeys) ? current : nextKeys));
  }, [blocks, mountedCount, virtualizationEnabled]);

  useEffect(() => {
    if (mountedCount >= blocks.length) {
      return;
    }

    const element = revealBoundaryRef.current;
    if (!element) {
      return;
    }

    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      revealNextGroup();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            revealNextGroup();
            break;
          }
        }
      },
      {
        rootMargin: BLOCK_REVEAL_ROOT_MARGIN,
        threshold: 0.01,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [blocks.length, mountedCount, revealNextGroup]);

  useEffect(() => {
    updateRenderedVirtualizedBlockKeys();

    if (typeof window === "undefined") {
      return;
    }

    let frameId: number | null = null;
    const scheduleUpdate = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updateRenderedVirtualizedBlockKeys();
      });
    };

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [updateRenderedVirtualizedBlockKeys]);

  const handleFocusCapture = useCallback(() => {
    if (!shouldEnableHybridVirtualization) {
      return;
    }

    setKeyboardAccessibilityMode(true);
    setMountedCount(blocks.length);
  }, [blocks.length, shouldEnableHybridVirtualization]);

  const handleBlurCapture = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    if (!shouldEnableHybridVirtualization) {
      return;
    }

    const nextTarget = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(nextTarget)) {
      setKeyboardAccessibilityMode(false);
    }
  }, [shouldEnableHybridVirtualization]);

  return (
    <div className="space-y-4" role="list" onFocusCapture={handleFocusCapture} onBlurCapture={handleBlurCapture}>
      {blocks.slice(0, mountedCount).map((block, index) => {
        const blockKey = block.id || index.toString();
        return (
          <HybridVirtualizedBlockSlot
            key={blockKey}
            block={block}
            index={index}
            blockKey={blockKey}
            isMounted={true}
            shouldRenderContent={!virtualizationEnabled || renderedVirtualizedBlockKeys.has(blockKey)}
            placeholderHeight={measuredHeights[blockKey] ?? getBlockEstimatedHeight(block)}
            renderBlock={renderBlock}
            onWrapperRefChange={registerWrapperRef}
            onMeasuredHeight={recordMeasuredHeight}
            totalCount={blocks.length}
          />
        );
      })}

      {mountedCount < blocks.length ? <div ref={revealBoundaryRef} className="h-1 w-full" aria-hidden="true" /> : null}

      {blocks.slice(mountedCount).map((block, index) => {
        const actualIndex = mountedCount + index;
        const blockKey = block.id || actualIndex.toString();
        return (
          <HybridVirtualizedBlockSlot
            key={blockKey}
            block={block}
            index={actualIndex}
            blockKey={blockKey}
            isMounted={false}
            shouldRenderContent={false}
            placeholderHeight={measuredHeights[blockKey] ?? getBlockEstimatedHeight(block)}
            renderBlock={renderBlock}
            onWrapperRefChange={registerWrapperRef}
            onMeasuredHeight={recordMeasuredHeight}
            totalCount={blocks.length}
          />
        );
      })}
    </div>
  );
});

const MemoModuleContentBody = memo(({
  module,
  enrollment,
  isPreviewMode,
  practiceQuizSummary,
  contentBlocks,
  quizSelections,
  quizSubmittedAnswers,
  quizResults,
  essayResponsesByBlockId,
  savingEssayBlockIds,
  essaySaveErrors,
  documentBlockSubmissionIds,
  videoMaterials,
  documentMaterials,
  hasAssignments,
  legacyAssignmentSubmissions,
  completionBlockedReason,
  onObjectiveSelectionChange,
  onObjectiveSubmit,
  onEssayDraftChange,
  onEssayBlur,
  onDocumentSubmissionSaved,
  onPlaybackPositionChange,
  moduleContentKey,
}: {
  module: Module;
  enrollment: ModuleViewerEnrollmentContext;
  isPreviewMode: boolean;
  practiceQuizSummary: {
    totalQuestions: number;
    scoredQuestions: number;
    submittedQuestions: number;
    correctQuestions: number;
    totalPoints: number;
    earnedPoints: number;
    percentageScore: number | null;
    essayQuestionCount: number;
    essayAnsweredCount: number;
  };
  contentBlocks: ContentBlock[];
  quizSelections: Record<string, string>;
  quizSubmittedAnswers: Record<string, string>;
  quizResults: Record<string, boolean>;
  essayResponsesByBlockId: Record<string, PracticeQuizEssayResponse>;
  savingEssayBlockIds: Record<string, boolean>;
  essaySaveErrors: Record<string, string | null>;
  documentBlockSubmissionIds: Map<string, Submission[]>;
  videoMaterials: string[];
  documentMaterials: string[];
  hasAssignments: boolean;
  legacyAssignmentSubmissions: Submission[];
  completionBlockedReason: string | null;
  onObjectiveSelectionChange: (blockId: string, value: string) => void;
  onObjectiveSubmit: (blockId: string, value: string) => void;
  onEssayDraftChange: (blockId: string, value: string) => void;
  onEssayBlur: (block: ContentBlock, responseText: string) => void;
  onDocumentSubmissionSaved: () => void;
  onPlaybackPositionChange: (seconds: number) => void;
  moduleContentKey: string;
}) => {
  const renderContentBlock = useCallback((block: ContentBlock, index: number) => {
    const blockKey = block.id || index.toString();
    const blockType = (block.type?.toLowerCase?.() ?? block.type) as ContentBlock["type"];
    const content = (
      <MemoModuleContentBlockItem
        block={block}
        index={index}
        enrollment={enrollment}
        module={module}
        isPreviewMode={isPreviewMode}
        documentBlockSubmissions={documentBlockSubmissionIds.get(block.id) || EMPTY_SUBMISSIONS}
        selectedAnswer={quizSelections[blockKey]}
        submittedAnswer={quizSubmittedAnswers[blockKey]}
        isCorrect={quizResults[blockKey]}
        essayResponse={essayResponsesByBlockId[blockKey]}
        savingEssay={savingEssayBlockIds[blockKey]}
        essaySaveError={essaySaveErrors[blockKey]}
        onObjectiveSelectionChange={onObjectiveSelectionChange}
        onObjectiveSubmit={onObjectiveSubmit}
        onEssayDraftChange={onEssayDraftChange}
        onEssayBlur={onEssayBlur}
        onDocumentSubmissionSaved={onDocumentSubmissionSaved}
        onPlaybackPositionChange={onPlaybackPositionChange}
      />
    );

    if (blockType === "text" || blockType === "quiz" || blockType === "learning_material") {
      return content;
    }

    return <div className="rounded-xl border p-4">{content}</div>;
  }, [documentBlockSubmissionIds, enrollment, essayResponsesByBlockId, essaySaveErrors, isPreviewMode, module, onDocumentSubmissionSaved, onEssayBlur, onEssayDraftChange, onObjectiveSelectionChange, onObjectiveSubmit, onPlaybackPositionChange, quizResults, quizSelections, quizSubmittedAnswers, savingEssayBlockIds]);

  return (
    <div className="space-y-4">
    {practiceQuizSummary.totalQuestions > 0 ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileQuestion className="h-5 w-5" />
            Practice Quiz Summary
          </CardTitle>
          <CardDescription>
            Formative only. This score stays inside the module and does not affect graded assessments or completion.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Score</p>
              <p className="mt-1 text-lg font-semibold">
                {practiceQuizSummary.earnedPoints} / {practiceQuizSummary.totalPoints} pts
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Percentage</p>
              <p className="mt-1 text-lg font-semibold">
                {practiceQuizSummary.percentageScore !== null ? `${practiceQuizSummary.percentageScore}%` : "—"}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Auto-Scored</p>
              <p className="mt-1 text-lg font-semibold">
                {practiceQuizSummary.correctQuestions} / {practiceQuizSummary.submittedQuestions}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Essay Reflections</p>
              <p className="mt-1 text-lg font-semibold">
                {practiceQuizSummary.essayAnsweredCount} / {practiceQuizSummary.essayQuestionCount}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
            Multiple-choice and true/false questions contribute to the score summary. Essay prompts are reviewed separately with formative staff feedback and remain excluded from the automatic score.
          </div>
        </CardContent>
      </Card>
    ) : null}

    {module.module_document ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Module Document
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeferredViewportMount placeholder={<ViewerMountPlaceholder label="Document preview loads when visible." minHeight={360} />}>
            <Suspense fallback={<ViewerMountPlaceholder label="Loading document preview..." minHeight={360} />}>
              <DocumentViewer url={module.module_document} title={module.title} />
            </Suspense>
          </DeferredViewportMount>
        </CardContent>
      </Card>
    ) : null}

    {contentBlocks.length > 0 ? (
      <ProgressiveContentBlockList
        blocks={contentBlocks}
        renderBlock={renderContentBlock}
        contentKey={moduleContentKey}
      />
    ) : module.content ? (
      <Card>
        <CardHeader>
          <CardTitle>Module Content</CardTitle>
        </CardHeader>
        <CardContent>
          <DeferredViewportMount
            enabled={module.content.length >= LARGE_TEXT_BLOCK_THRESHOLD}
            placeholder={<ViewerMountPlaceholder label="Preparing content section..." minHeight={220} />}
          >
            <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: module.content }} />
          </DeferredViewportMount>
        </CardContent>
      </Card>
    ) : !module.module_document ? (
      <Card>
        <CardContent className="pt-6">
          <p className="py-8 text-center text-muted-foreground">No content available for this module.</p>
        </CardContent>
      </Card>
    ) : null}

    {completionBlockedReason ? (
      <Card className="border-amber-200 bg-amber-50/80 shadow-none dark:border-amber-900 dark:bg-amber-950/30">
        <CardContent className="flex items-start gap-3 pt-6 text-sm text-amber-900 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Module completion is currently blocked.</p>
            <p className="mt-1">{completionBlockedReason}</p>
          </div>
        </CardContent>
      </Card>
    ) : null}

    <MemoSupplementalVideoSection
      videoMaterials={videoMaterials}
      enrollment={enrollment}
      moduleId={module.id}
      isPreviewMode={isPreviewMode}
      onPlaybackPositionChange={onPlaybackPositionChange}
    />

    <MemoSupplementalDocumentSection documentMaterials={documentMaterials} />

    {hasAssignments ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Assignment Submission
            {legacyAssignmentSubmissions.length > 0 ? <Badge variant="secondary">Uploaded</Badge> : null}
          </CardTitle>
          <CardDescription>Submit your assignment for this module.</CardDescription>
        </CardHeader>
        <CardContent>
          {legacyAssignmentSubmissions.length > 0 ? (
            <div className="mb-4 rounded-lg border bg-muted/20 p-3 text-sm">
              <p className="font-medium">Latest assignment upload</p>
              <p className="mt-1 text-muted-foreground">
                Submitted {new Date(legacyAssignmentSubmissions[0].submitted_at).toLocaleString()} • Status: {legacyAssignmentSubmissions[0].status.replace(/_/g, " ")}
              </p>
            </div>
          ) : null}
          <AssignmentSubmission
            enrollmentId={enrollment.id}
            moduleId={module.id}
            courseId={enrollment.courseId}
            metadata={{ source: "module_assignment" }}
            onSubmitted={onDocumentSubmissionSaved}
          />
        </CardContent>
      </Card>
    ) : null}
    </div>
  );
});

interface ModuleContentViewerProps {
  module: Module;
  enrollment: ModuleViewerEnrollmentContext;
  isCompleted: boolean;
  isPreviewMode?: boolean;
  entrySource?: string;
  onComplete: (timeSpentMinutes?: number, options?: { silent?: boolean; practiceQuizSnapshot?: PracticeQuizCompletionSnapshot }) => void | Promise<void>;
  onPracticeQuizStateChange?: (state: { canRetry: boolean; retry: (() => void) | null }) => void;
  onCompletionActionStateChange?: (state: {
    canComplete: boolean;
    isCompleting: boolean;
    complete: (() => void) | null;
    blockedReason?: string | null;
  }) => void;
}

const ModuleContentViewer = ({
  module,
  enrollment,
  isCompleted,
  isPreviewMode = false,
  entrySource = "course_module_viewer",
  onComplete,
  onPracticeQuizStateChange,
  onCompletionActionStateChange,
}: ModuleContentViewerProps) => {
  const { user } = useAuth();
  const [timeSpent, setTimeSpent] = useState<number | null>(null);
  const [currentTimeSpent, setCurrentTimeSpent] = useState(0);
  const [quizSelections, setQuizSelections] = useState<Record<string, string>>({});
  const [quizSubmittedAnswers, setQuizSubmittedAnswers] = useState<Record<string, string>>({});
  const [moduleSubmissions, setModuleSubmissions] = useState<Submission[]>([]);
  const [essayResponsesByBlockId, setEssayResponsesByBlockId] = useState<Record<string, PracticeQuizEssayResponse>>({});
  const [savingEssayBlockIds, setSavingEssayBlockIds] = useState<Record<string, boolean>>({});
  const [essaySaveErrors, setEssaySaveErrors] = useState<Record<string, string | null>>({});
  const [completingModule, setCompletingModule] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const displayIntervalRef = useRef<number | null>(null);
  const endingSessionRef = useRef(false);
  const latestResumePositionRef = useRef<number | undefined>(undefined);
  const timeSpentRef = useRef<number | null>(null);
  const currentTimeSpentRef = useRef(0);
  const sessionMetadataRef = useRef<Record<string, unknown>>({});
  const essayResponsesRef = useRef<Record<string, PracticeQuizEssayResponse>>({});
  const essaySaveTimersRef = useRef<Record<string, number>>({});
  const practiceQuizDraftSaveTimerRef = useRef<number | null>(null);
  const moduleViewerStateRequestSequenceRef = useRef(0);
  const hasHydratedViewerStateRef = useRef(false);
  const completionActionStateRef = useRef<{
    canComplete: boolean;
    isCompleting: boolean;
    complete: (() => void) | null;
    blockedReason?: string | null;
  } | null>(null);
  const practiceQuizStateRef = useRef<{ canRetry: boolean; retry: (() => void) | null } | null>(null);

  useEffect(() => {
    timeSpentRef.current = timeSpent;
  }, [timeSpent]);

  useEffect(() => {
    currentTimeSpentRef.current = currentTimeSpent;
  }, [currentTimeSpent]);

  useEffect(() => {
    essayResponsesRef.current = essayResponsesByBlockId;
  }, [essayResponsesByBlockId]);

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
      sessionMetadataRef.current,
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
        sessionMetadataRef.current,
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
      sessionMetadataRef.current = session.metadata || {};
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
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
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

  const moduleContentKey = useMemo(
    () => `${module.id}:${module.updated_at || ""}:${module.content || ""}:${module.module_document || ""}:${module.materials.join("|")}`,
    [module.content, module.id, module.materials, module.module_document, module.updated_at],
  );

  const {
    contentBlocks,
    practiceQuizBlocks,
    practiceQuizEssayBlocks,
    objectivePracticeQuizBlocks,
    objectivePracticeQuizBlockIds,
    requiredUploadBlocks,
    videoMaterials,
    documentMaterials,
    hasAssignments,
  } = useMemo(() => {
    const parsedContentBlocks = parseModuleContentBlocks(module.content);
    const parsedPracticeQuizBlocks = parsedContentBlocks.filter((block) => block.type === "quiz");
    const parsedPracticeQuizEssayBlocks = parsedPracticeQuizBlocks.filter((block) => block.questionType === "essay");
    const parsedObjectivePracticeQuizBlocks = parsedPracticeQuizBlocks.filter((block) => block.questionType !== "essay");

    return {
      contentBlocks: parsedContentBlocks,
      practiceQuizBlocks: parsedPracticeQuizBlocks,
      practiceQuizEssayBlocks: parsedPracticeQuizEssayBlocks,
      objectivePracticeQuizBlocks: parsedObjectivePracticeQuizBlocks,
      objectivePracticeQuizBlockIds: new Set(
        parsedObjectivePracticeQuizBlocks.map((block) => block.id).filter((blockId): blockId is string => Boolean(blockId)),
      ),
      requiredUploadBlocks: parsedContentBlocks.filter((block) => block.type === "document" && block.allowLearnerUpload),
      videoMaterials: module.materials.filter((material) => {
        const url = typeof material === "string" ? material : String(material);
        return isSupportedCourseVideoUrl(url);
      }),
      documentMaterials: module.materials.filter((material) => {
        const url = typeof material === "string" ? material : String(material);
        return Boolean(url.match(/\.(pdf|doc|docx|ppt|pptx)$/i));
      }),
      hasAssignments: !isPreviewMode && module.materials.some((material) => {
        const url = typeof material === "string" ? material : String(material);
        return url.includes("assignment") || url.includes("submit");
      }),
    };
  }, [isPreviewMode, module.content, module.materials]);

  const practiceQuizProgressStorageKey = useMemo(
    () => (!isPreviewMode && user?.id ? buildPracticeQuizProgressStorageKey(user.id, enrollment.id, module.id) : null),
    [enrollment.id, isPreviewMode, module.id, user?.id],
  );

  const loadModuleViewerState = useCallback(async (options?: { forceRefresh?: boolean }) => {
    if (isPreviewMode || !user?.id) {
      setTimeSpent(null);
      setModuleSubmissions([]);
      setEssayResponsesByBlockId({});
      setEssaySaveErrors({});
      setQuizSelections({});
      setQuizSubmittedAnswers({});
      hasHydratedViewerStateRef.current = true;
      return;
    }

    const requestSequence = moduleViewerStateRequestSequenceRef.current + 1;
    moduleViewerStateRequestSequenceRef.current = requestSequence;

    if (options?.forceRefresh) {
      moduleViewerStateService.invalidate({
        userId: user.id,
        enrollmentId: enrollment.id,
        moduleId: module.id,
      });
    }

    const localSnapshot = readStoredPracticeQuizProgressSnapshot(practiceQuizProgressStorageKey, objectivePracticeQuizBlockIds);
    const state = await moduleViewerStateService.getModuleViewerState({
      userId: user.id,
      enrollmentId: enrollment.id,
      courseId: enrollment.courseId,
      moduleId: module.id,
    });

    if (moduleViewerStateRequestSequenceRef.current !== requestSequence) {
      return;
    }

    const remoteDraftSnapshot = state.practiceQuizDraftSnapshot;
    const preferredObjectiveSnapshot = remoteDraftSnapshot && localSnapshot
      ? new Date(remoteDraftSnapshot.updatedAt).getTime() >= new Date(localSnapshot.updatedAt).getTime()
        ? remoteDraftSnapshot
        : localSnapshot
      : remoteDraftSnapshot || localSnapshot;

    const nextSelections = {
      ...(preferredObjectiveSnapshot?.selections || {}),
    } as Record<string, string>;

    const draftEssayResponseMap = new Map(
      (remoteDraftSnapshot?.essayResponses || []).map((response) => [response.blockId, response]),
    );
    const savedEssayResponseMap = new Map(state.essayResponses.map((response) => [response.block_id, response]));

    for (const block of practiceQuizEssayBlocks) {
      if (!block.id) {
        continue;
      }

      const savedResponse = savedEssayResponseMap.get(block.id);
      const draftResponse = draftEssayResponseMap.get(block.id);
      const shouldUseDraft = Boolean(
        draftResponse
        && (!savedResponse?.updated_at || new Date(draftResponse.updatedAt || remoteDraftSnapshot?.updatedAt || 0).getTime() > new Date(savedResponse.updated_at).getTime()),
      );

      if (shouldUseDraft) {
        nextSelections[block.id] = draftResponse?.responseText || "";
      } else if (savedResponse?.response_text?.trim()) {
        nextSelections[block.id] = savedResponse.response_text;
      }
    }

    setTimeSpent(state.timeSpentMinutes);
    setModuleSubmissions(state.submissions);
    setEssayResponsesByBlockId(Object.fromEntries(state.essayResponses.map((response) => [response.block_id, response])));
    setEssaySaveErrors({});
    setQuizSelections(nextSelections);
    setQuizSubmittedAnswers(preferredObjectiveSnapshot?.submittedAnswers || {});
    hasHydratedViewerStateRef.current = true;
  }, [enrollment.courseId, enrollment.id, isPreviewMode, module.id, objectivePracticeQuizBlockIds, practiceQuizEssayBlocks, practiceQuizProgressStorageKey, user?.id]);

  useEffect(() => {
    void loadModuleViewerState();
  }, [loadModuleViewerState]);

  const quizResults = useMemo(() => {
    const nextResults: Record<string, boolean> = {};

    for (const block of objectivePracticeQuizBlocks) {
      const blockId = block.id;
      const submittedAnswer = quizSubmittedAnswers[blockId];

      if (submittedAnswer === undefined) {
        continue;
      }

      nextResults[blockId] = submittedAnswer === block.correctAnswer?.toString();
    }

    return nextResults;
  }, [objectivePracticeQuizBlocks, quizSubmittedAnswers]);

  useEffect(() => {
    if (!practiceQuizProgressStorageKey || typeof window === "undefined") {
      return;
    }

    const persistedSelections = Object.fromEntries(
      Object.entries(quizSelections).filter(([blockId]) => objectivePracticeQuizBlockIds.has(blockId)),
    );
    const persistedSubmittedAnswers = Object.fromEntries(
      Object.entries(quizSubmittedAnswers).filter(([blockId]) => objectivePracticeQuizBlockIds.has(blockId)),
    );

    if (Object.keys(persistedSelections).length === 0 && Object.keys(persistedSubmittedAnswers).length === 0) {
      window.localStorage.removeItem(practiceQuizProgressStorageKey);
      return;
    }

    const snapshot: PracticeQuizProgressSnapshot = {
      selections: persistedSelections,
      submittedAnswers: persistedSubmittedAnswers,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(practiceQuizProgressStorageKey, JSON.stringify(snapshot));
  }, [objectivePracticeQuizBlockIds, practiceQuizProgressStorageKey, quizSelections, quizSubmittedAnswers]);

  const practiceQuizSummary = useMemo(() => {
    let totalQuestions = 0;
    let scoredQuestions = 0;
    let submittedQuestions = 0;
    let correctQuestions = 0;
    let totalPoints = 0;
    let earnedPoints = 0;
    let essayQuestionCount = 0;
    let essayAnsweredCount = 0;

    for (const block of practiceQuizBlocks) {
      totalQuestions += 1;

      const blockId = block.id;
      const points = Math.max(1, Number(block.points) || 1);
      const isEssayQuestion = block.questionType === "essay";

      if (isEssayQuestion) {
        essayQuestionCount += 1;
        if ((quizSelections[blockId] || "").trim()) {
          essayAnsweredCount += 1;
        }
        continue;
      }

      scoredQuestions += 1;
      totalPoints += points;

      if (quizSubmittedAnswers[blockId] !== undefined) {
        submittedQuestions += 1;
        if (quizResults[blockId]) {
          correctQuestions += 1;
          earnedPoints += points;
        }
      }
    }

    const percentageScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : null;

    return {
      totalQuestions,
      scoredQuestions,
      submittedQuestions,
      correctQuestions,
      totalPoints,
      earnedPoints,
      percentageScore,
      essayQuestionCount,
      essayAnsweredCount,
    };
  }, [practiceQuizBlocks, quizResults, quizSelections, quizSubmittedAnswers]);

  useEffect(() => {
    sessionMetadataRef.current = moduleSessionService.withPracticeQuizSummaryMetadata(
      sessionMetadataRef.current,
      practiceQuizSummary,
    );
  }, [practiceQuizSummary]);

  const requiredEssayBlocks = practiceQuizEssayBlocks;

  const documentBlockSubmissionIds = useMemo(() => {
    const mapping = new Map<string, Submission[]>();

    for (const submission of moduleSubmissions) {
      const documentBlockId = typeof submission.content?.documentBlockId === "string"
        ? submission.content.documentBlockId
        : null;

      if (!documentBlockId) {
        continue;
      }

      const existing = mapping.get(documentBlockId) || [];
      existing.push(submission);
      mapping.set(documentBlockId, existing);
    }

    return mapping;
  }, [moduleSubmissions]);

  const legacyAssignmentSubmissions = useMemo(
    () => moduleSubmissions.filter((submission) => submission.content?.source !== "document_block"),
    [moduleSubmissions],
  );

  const savePracticeQuizEssayResponse = useCallback(
    async (block: ContentBlock, responseText: string) => {
      if (isPreviewMode || !user?.id || !block.id) {
        return;
      }

      const existingResponse = essayResponsesRef.current[block.id];
      if (!responseText.trim() && !existingResponse) {
        return;
      }

      setSavingEssayBlockIds((prev) => ({ ...prev, [block.id]: true }));
      setEssaySaveErrors((prev) => ({ ...prev, [block.id]: null }));

      try {
        const savedResponse = await practiceQuizEssayReviewService.upsertLearnerResponse({
          enrollmentId: enrollment.id,
          courseId: enrollment.courseId,
          moduleId: module.id,
          userId: user.id,
          blockId: block.id,
          promptTitle: block.title || null,
          promptText: block.content,
          guidanceText: block.explanation || null,
          responseText,
        });

        setEssayResponsesByBlockId((prev) => ({
          ...prev,
          [block.id]: savedResponse,
        }));
        return savedResponse;
      } catch (error) {
        console.error("Error saving practice quiz essay response:", error);
        setEssaySaveErrors((prev) => ({
          ...prev,
          [block.id]: "Failed to save your essay response for staff review.",
        }));
        return null;
      } finally {
        setSavingEssayBlockIds((prev) => ({ ...prev, [block.id]: false }));
      }
    },
    [enrollment.courseId, enrollment.id, isPreviewMode, module.id, user?.id],
  );

  const flushPracticeQuizEssayResponses = useCallback(async () => {
    Object.values(essaySaveTimersRef.current).forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    essaySaveTimersRef.current = {};

    let allSaved = true;

    for (const block of practiceQuizEssayBlocks) {
      if (!block.id) {
        continue;
      }

      const draftResponse = quizSelections[block.id] ?? "";
      const savedResponse = essayResponsesRef.current[block.id]?.response_text ?? "";

      if (draftResponse === savedResponse) {
        continue;
      }

      const persistedResponse = await savePracticeQuizEssayResponse(block, draftResponse);
      if (draftResponse.trim().length > 0 && !persistedResponse) {
        allSaved = false;
      }
    }

    return allSaved;
  }, [practiceQuizEssayBlocks, quizSelections, savePracticeQuizEssayResponse]);

  const buildPracticeQuizCompletionSnapshot = useCallback((): PracticeQuizCompletionSnapshot => {
    const updatedAt = new Date().toISOString();
    const objectiveSelections = Object.fromEntries(
      Object.entries(quizSelections).filter(([blockId]) => objectivePracticeQuizBlockIds.has(blockId)),
    );
    const objectiveSubmittedAnswers = Object.fromEntries(
      Object.entries(quizSubmittedAnswers).filter(([blockId]) => objectivePracticeQuizBlockIds.has(blockId)),
    );

    return {
      summary: {
        ...practiceQuizSummary,
        updatedAt,
      },
      selections: objectiveSelections,
      submittedAnswers: objectiveSubmittedAnswers,
      essayResponses: practiceQuizEssayBlocks
        .filter((block) => Boolean(block.id))
        .map((block) => {
          const savedResponse = essayResponsesRef.current[block.id];
          return {
            blockId: block.id,
            responseId: savedResponse?.id,
            responseText: savedResponse?.response_text ?? quizSelections[block.id] ?? "",
            updatedAt: savedResponse?.updated_at,
          };
        })
        .filter((response) => response.responseText.trim().length > 0),
      completedAt: updatedAt,
    };
  }, [objectivePracticeQuizBlockIds, practiceQuizEssayBlocks, practiceQuizSummary, quizSelections, quizSubmittedAnswers]);

  const buildPracticeQuizDraftSnapshot = useCallback((): PracticeQuizDraftSnapshot => {
    const updatedAt = new Date().toISOString();

    return {
      summary: {
        ...practiceQuizSummary,
        updatedAt,
      },
      selections: { ...quizSelections },
      submittedAnswers: Object.fromEntries(
        Object.entries(quizSubmittedAnswers).filter(([blockId]) => objectivePracticeQuizBlockIds.has(blockId)),
      ),
      essayResponses: practiceQuizEssayBlocks
        .filter((block) => Boolean(block.id))
        .map((block) => {
          const savedResponse = essayResponsesRef.current[block.id];
          return {
            blockId: block.id,
            responseId: savedResponse?.id,
            responseText: quizSelections[block.id] ?? savedResponse?.response_text ?? "",
            updatedAt: savedResponse?.updated_at,
          };
        })
        .filter((response) => response.responseText.trim().length > 0),
      updatedAt,
    };
  }, [objectivePracticeQuizBlockIds, practiceQuizEssayBlocks, practiceQuizSummary, quizSelections, quizSubmittedAnswers]);

  useEffect(() => {
    if (isPreviewMode || !user?.id) {
      return;
    }

    practiceQuizEssayBlocks.forEach((block) => {
      if (!block.id) {
        return;
      }

      const draftResponse = quizSelections[block.id] ?? "";
      const savedResponse = essayResponsesByBlockId[block.id]?.response_text ?? "";

      if (draftResponse === savedResponse) {
        if (essaySaveTimersRef.current[block.id]) {
          window.clearTimeout(essaySaveTimersRef.current[block.id]);
          delete essaySaveTimersRef.current[block.id];
        }
        return;
      }

      if (essaySaveTimersRef.current[block.id]) {
        window.clearTimeout(essaySaveTimersRef.current[block.id]);
      }

      essaySaveTimersRef.current[block.id] = window.setTimeout(() => {
        delete essaySaveTimersRef.current[block.id];
        void savePracticeQuizEssayResponse(block, draftResponse);
      }, 700);
    });

    return () => {
      Object.values(essaySaveTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      essaySaveTimersRef.current = {};
    };
  }, [essayResponsesByBlockId, isPreviewMode, practiceQuizEssayBlocks, quizSelections, savePracticeQuizEssayResponse, user?.id]);

  useEffect(() => {
    if (practiceQuizDraftSaveTimerRef.current) {
      window.clearTimeout(practiceQuizDraftSaveTimerRef.current);
    }

    if (!hasHydratedViewerStateRef.current || isPreviewMode || !user?.id) {
      return;
    }

    practiceQuizDraftSaveTimerRef.current = window.setTimeout(() => {
      practiceQuizDraftSaveTimerRef.current = null;

      const hasObjectiveState = Object.keys(quizSelections).some((blockId) => objectivePracticeQuizBlockIds.has(blockId))
        || Object.keys(quizSubmittedAnswers).some((blockId) => objectivePracticeQuizBlockIds.has(blockId));
      const hasEssayState = practiceQuizEssayBlocks.some((block) => (quizSelections[block.id] || "").trim().length > 0);
      const snapshot = hasObjectiveState || hasEssayState
        ? buildPracticeQuizDraftSnapshot()
        : null;

      void moduleViewerStateService.savePracticeQuizDraftSnapshot({
        userId: user.id,
        enrollmentId: enrollment.id,
        courseId: enrollment.courseId,
        moduleId: module.id,
        snapshot,
      });
    }, 900);

    return () => {
      if (practiceQuizDraftSaveTimerRef.current) {
        window.clearTimeout(practiceQuizDraftSaveTimerRef.current);
        practiceQuizDraftSaveTimerRef.current = null;
      }
    };
  }, [buildPracticeQuizDraftSnapshot, enrollment.courseId, enrollment.id, isPreviewMode, module.id, objectivePracticeQuizBlockIds, practiceQuizEssayBlocks, quizSelections, quizSubmittedAnswers, user?.id]);

  const handleObjectiveSelectionChange = useCallback((blockId: string, value: string) => {
    setQuizSelections((prev) => (prev[blockId] === value ? prev : { ...prev, [blockId]: value }));
  }, []);

  const handleObjectiveSubmit = useCallback((blockId: string, value: string) => {
    setQuizSubmittedAnswers((prev) => (prev[blockId] === value ? prev : { ...prev, [blockId]: value }));
  }, []);

  const handleEssayDraftChange = useCallback((blockId: string, value: string) => {
    setEssaySaveErrors((prev) => (prev[blockId] === null ? prev : { ...prev, [blockId]: null }));
    setQuizSelections((prev) => (prev[blockId] === value ? prev : { ...prev, [blockId]: value }));
  }, []);

  const handleEssayBlur = useCallback((block: ContentBlock, responseText: string) => {
    void savePracticeQuizEssayResponse(block, responseText);
  }, [savePracticeQuizEssayResponse]);

  const handlePlaybackPositionChange = useCallback((seconds: number) => {
    latestResumePositionRef.current = seconds;
  }, []);

  const handleModuleSubmissionRefresh = useCallback(() => {
    void loadModuleViewerState({ forceRefresh: true });
  }, [loadModuleViewerState]);

  const hasPendingEssaySaves = useMemo(
    () => Object.values(savingEssayBlockIds).some(Boolean),
    [savingEssayBlockIds],
  );

  const hasEssaySaveErrors = useMemo(
    () => Object.values(essaySaveErrors).some(Boolean),
    [essaySaveErrors],
  );

  const missingEssayBlocks = useMemo(
    () => requiredEssayBlocks.filter((block) => !(quizSelections[block.id] || "").trim()),
    [quizSelections, requiredEssayBlocks],
  );

  const missingUploadBlocks = useMemo(
    () => requiredUploadBlocks.filter((block) => !documentBlockSubmissionIds.get(block.id)?.length),
    [documentBlockSubmissionIds, requiredUploadBlocks],
  );

  const needsLegacyAssignmentSubmission = hasAssignments && legacyAssignmentSubmissions.length === 0;

  const completionBlockedReason = useMemo(() => {
    const requirements: string[] = [];

    if (hasEssaySaveErrors) {
      requirements.push("resolve the essay response save errors");
    }

    if (hasPendingEssaySaves) {
      requirements.push("wait for essay responses to finish saving");
    }

    if (missingEssayBlocks.length > 0) {
      requirements.push(
        missingEssayBlocks.length === 1
          ? `answer the remaining essay prompt: ${missingEssayBlocks[0].title || "Untitled essay"}`
          : `answer all ${missingEssayBlocks.length} remaining essay prompts`,
      );
    }

    if (missingUploadBlocks.length > 0) {
      requirements.push(
        missingUploadBlocks.length === 1
          ? `upload the required file for ${missingUploadBlocks[0].title || "the document activity"}`
          : `upload the required files for ${missingUploadBlocks.length} document activities`,
      );
    }

    if (needsLegacyAssignmentSubmission) {
      requirements.push("upload the required assignment file");
    }

    if (requirements.length === 0) {
      return null;
    }

    return `Complete this module after you ${requirements.join(" and ")}.`;
  }, [hasEssaySaveErrors, hasPendingEssaySaves, missingEssayBlocks, missingUploadBlocks, needsLegacyAssignmentSubmission]);

  const handleMarkModuleComplete = useCallback(async () => {
    if (isCompleted || completingModule) {
      return;
    }

    if (completionBlockedReason) {
      toast.error(completionBlockedReason);
      return;
    }

    setCompletingModule(true);

    try {
      const essaysFlushed = await flushPracticeQuizEssayResponses();
      if (!essaysFlushed) {
        toast.error("Resolve the essay save errors before completing this module.");
        return;
      }

      await flushActiveSession();

      const persistedTimeSpent = timeSpentRef.current;
      const liveTimeSpent = currentTimeSpentRef.current;
      const totalMinutes = persistedTimeSpent !== null
        ? Math.max(persistedTimeSpent, persistedTimeSpent + Math.ceil(liveTimeSpent / 60))
        : Math.ceil(liveTimeSpent / 60);

      await onComplete(totalMinutes > 0 ? totalMinutes : undefined, {
        practiceQuizSnapshot: buildPracticeQuizCompletionSnapshot(),
      });
    } finally {
      setCompletingModule(false);
    }
  }, [buildPracticeQuizCompletionSnapshot, completionBlockedReason, completingModule, flushActiveSession, flushPracticeQuizEssayResponses, isCompleted, onComplete]);

  const handleRetryAllPracticeQuizzes = useCallback(() => {
    setQuizSelections({});
    setQuizSubmittedAnswers({});
  }, []);

  useEffect(() => {
    const nextState = {
      canComplete: !isCompleted && !completionBlockedReason,
      isCompleting: completingModule,
      complete: !isCompleted && !completionBlockedReason ? handleMarkModuleComplete : null,
      blockedReason: completionBlockedReason,
    };

    const previousState = completionActionStateRef.current;
    if (
      previousState?.canComplete !== nextState.canComplete
      || previousState?.isCompleting !== nextState.isCompleting
      || previousState?.complete !== nextState.complete
      || previousState?.blockedReason !== nextState.blockedReason
    ) {
      completionActionStateRef.current = nextState;
      onCompletionActionStateChange?.(nextState);
    }
  }, [completingModule, completionBlockedReason, handleMarkModuleComplete, isCompleted, onCompletionActionStateChange]);

  useEffect(() => {
    return () => {
      completionActionStateRef.current = null;
      onCompletionActionStateChange?.({
        canComplete: false,
        isCompleting: false,
        complete: null,
        blockedReason: null,
      });
    };
  }, [onCompletionActionStateChange]);

  useEffect(() => {
    const nextState = {
      canRetry: Object.keys(quizSelections).length > 0 || Object.keys(quizSubmittedAnswers).length > 0,
      retry:
        Object.keys(quizSelections).length > 0 || Object.keys(quizSubmittedAnswers).length > 0
          ? handleRetryAllPracticeQuizzes
          : null,
    };

    const previousState = practiceQuizStateRef.current;
    if (
      previousState?.canRetry !== nextState.canRetry
      || previousState?.retry !== nextState.retry
    ) {
      practiceQuizStateRef.current = nextState;
      onPracticeQuizStateChange?.(nextState);
    }
  }, [handleRetryAllPracticeQuizzes, onPracticeQuizStateChange, quizSelections, quizSubmittedAnswers]);

  useEffect(() => {
    return () => {
      practiceQuizStateRef.current = null;
      onPracticeQuizStateChange?.({ canRetry: false, retry: null });
    };
  }, [onPracticeQuizStateChange]);

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

      <MemoModuleContentBody
        module={module}
        enrollment={enrollment}
        isPreviewMode={isPreviewMode}
        practiceQuizSummary={practiceQuizSummary}
        contentBlocks={contentBlocks}
        quizSelections={quizSelections}
        quizSubmittedAnswers={quizSubmittedAnswers}
        quizResults={quizResults}
        essayResponsesByBlockId={essayResponsesByBlockId}
        savingEssayBlockIds={savingEssayBlockIds}
        essaySaveErrors={essaySaveErrors}
        documentBlockSubmissionIds={documentBlockSubmissionIds}
        videoMaterials={videoMaterials}
        documentMaterials={documentMaterials}
        hasAssignments={hasAssignments}
        legacyAssignmentSubmissions={legacyAssignmentSubmissions}
        completionBlockedReason={completionBlockedReason}
        onObjectiveSelectionChange={handleObjectiveSelectionChange}
        onObjectiveSubmit={handleObjectiveSubmit}
        onEssayDraftChange={handleEssayDraftChange}
        onEssayBlur={handleEssayBlur}
        onDocumentSubmissionSaved={handleModuleSubmissionRefresh}
        onPlaybackPositionChange={handlePlaybackPositionChange}
        moduleContentKey={moduleContentKey}
      />
    </div>
  );
};

export default ModuleContentViewer;

