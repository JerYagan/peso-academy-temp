import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Star,
  FileText,
  Download,
  User,
  Calendar,
  Clock,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import { validatorService } from "@/services/validatorService";
import { Submission, Validation } from "@/types";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { createSubmissionAccessUrl, downloadSubmissionFile, getSubmissionAttachmentName } from "@/lib/submissionFiles";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const SubmissionReview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [decision, setDecision] = useState<"approved" | "rejected" | "revision_requested" | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null);
  const [courseInfo, setCourseInfo] = useState<{ title: string } | null>(null);

  useEffect(() => {
    if (id && user) {
      loadSubmission();
    }
  }, [id, user]);

  const loadSubmission = async () => {
    if (!id || !user) return;

    setLoading(true);
    try {
      const submissions = await validatorService.getPendingSubmissions({ limit: 1000 });
      const foundSubmission = submissions.find((s) => s.id === id);

      if (!foundSubmission) {
        toast.error("Submission not found");
        navigate("/validator/submissions");
        return;
      }

      setSubmission(foundSubmission);

      // Load user info
      if (foundSubmission.user_id) {
        const { data: userData } = await supabase
          .from("users")
          .select("name, email")
          .eq("id", foundSubmission.user_id)
          .single();
        if (userData) {
          setUserInfo({ name: userData.name, email: userData.email });
        }
      }

      // Load course info
      if (foundSubmission.course_id) {
        const { data: courseData } = await supabase
          .from("courses")
          .select("title")
          .eq("id", foundSubmission.course_id)
          .single();
        if (courseData) {
          setCourseInfo({ title: courseData.title });
        }
      }

      // Load existing validation
      const validations = await validatorService.getSubmissionValidations(id);
      const activeValidation = validations.find((v) => v.status === "in_progress");
      if (activeValidation) {
        setValidation(activeValidation);
        setFeedback(activeValidation.feedback || "");
        setRating(activeValidation.rating || 0);
      } else if (validations.length > 0) {
        const lastValidation = validations[0];
        setValidation(lastValidation);
        setFeedback(lastValidation.feedback || "");
        setRating(lastValidation.rating || 0);
        setDecision(lastValidation.decision);
      }

      // Start validation if not started
      if (!activeValidation && foundSubmission.status === "pending") {
        try {
          const newValidation = await validatorService.startValidation(id, user.id);
          if (newValidation) {
            setValidation(newValidation);
          }
        } catch (error) {
          console.error("Error starting validation:", error);
        }
      }
    } catch (error) {
      console.error("Error loading submission:", error);
      toast.error("Failed to load submission");
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = (newDecision: "approved" | "rejected" | "revision_requested") => {
    setDecision(newDecision);
    setShowConfirmDialog(true);
  };

  const confirmDecision = async () => {
    if (!validation || !decision) return;

    setProcessing(true);
    try {
      await validatorService.completeValidation(validation.id, decision, feedback || undefined, rating || undefined);
      
      // Update submission feedback
      if (feedback) {
        await validatorService.addFeedback(validation.id, feedback);
      }

      toast.success(`Submission ${decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "sent for revision"} successfully`);
      navigate("/validator/submissions");
    } catch (error: any) {
      console.error("Error processing decision:", error);
      toast.error(error.message || "Failed to process decision");
    } finally {
      setProcessing(false);
      setShowConfirmDialog(false);
    }
  };

  const downloadFile = async () => {
    if (!submission?.file_path) return;

    try {
      await downloadSubmissionFile(submission.file_path, getSubmissionAttachmentName(submission.file_path));
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  const viewFile = async () => {
    if (!submission?.file_path) return;

    try {
      const accessUrl = await createSubmissionAccessUrl(submission.file_path);
      if (!accessUrl) {
        throw new Error("No file access URL available.");
      }

      window.open(accessUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error opening file:", error);
      toast.error("Failed to open file");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading submission...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!submission) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Submission not found</p>
            <Button asChild>
              <Link to="/validator/submissions">Back to Submissions</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-600">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "revision_requested":
        return <Badge variant="outline">Revision Requested</Badge>;
      case "under_review":
        return <Badge variant="secondary">Under Review</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/validator/submissions")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Review Submission</h1>
              <p className="text-muted-foreground mt-1">Evaluate and provide feedback</p>
            </div>
          </div>
          {getStatusBadge(submission.status)}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Submission Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Submission Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Title</Label>
                  <p className="font-semibold text-lg">{submission.title}</p>
                </div>

                {submission.description && (
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="text-sm whitespace-pre-wrap">{submission.description}</p>
                  </div>
                )}

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Learner
                    </Label>
                    <p className="font-medium">{userInfo?.name || submission.user_name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">{userInfo?.email || submission.user_email}</p>
                  </div>

                  <div>
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Course
                    </Label>
                    <p className="font-medium">{courseInfo?.title || submission.course_title || "Unknown Course"}</p>
                  </div>

                  <div>
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Submitted
                    </Label>
                    <p className="font-medium">
                      {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(submission.submitted_at).toLocaleString()}
                    </p>
                  </div>

                  {submission.priority && (
                    <div>
                      <Label className="text-muted-foreground">Priority</Label>
                      <Badge variant={submission.priority === "urgent" ? "destructive" : "secondary"}>
                        {submission.priority}
                      </Badge>
                    </div>
                  )}
                </div>

                {submission.file_path && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-muted-foreground">Attached File</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{getSubmissionAttachmentName(submission.file_path)}</span>
                        <Button variant="outline" size="sm" onClick={viewFile}>
                          View
                        </Button>
                        <Button variant="outline" size="sm" onClick={downloadFile}>
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Feedback Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Feedback & Rating
                </CardTitle>
                <CardDescription>Provide detailed feedback and rating for this submission</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Rating (1-5 stars)</Label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`p-1 ${
                          star <= rating ? "text-yellow-500" : "text-muted-foreground"
                        } hover:text-yellow-500 transition-colors`}
                      >
                        <Star className={`w-6 h-6 ${star <= rating ? "fill-current" : ""}`} />
                      </button>
                    ))}
                    {rating > 0 && <span className="text-sm text-muted-foreground ml-2">({rating}/5)</span>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback">Feedback</Label>
                  <Textarea
                    id="feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Provide detailed feedback for the learner..."
                    rows={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Be constructive and specific. This feedback will be visible to the learner.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review Actions</CardTitle>
                <CardDescription>Make your decision</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Decision</Label>
                  <RadioGroup value={decision || ""} onValueChange={(v) => setDecision(v as any)}>
                    <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                      <RadioGroupItem value="approved" id="approved" />
                      <Label htmlFor="approved" className="flex-1 cursor-pointer flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        Approve
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                      <RadioGroupItem value="revision_requested" id="revision" />
                      <Label htmlFor="revision" className="flex-1 cursor-pointer flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-yellow-600" />
                        Request Revision
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                      <RadioGroupItem value="rejected" id="rejected" />
                      <Label htmlFor="rejected" className="flex-1 cursor-pointer flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-600" />
                        Reject
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Button
                    onClick={() => decision && handleDecision(decision)}
                    disabled={!decision || processing}
                    className="w-full"
                    variant={decision === "approved" ? "default" : decision === "rejected" ? "destructive" : "outline"}
                  >
                    {processing ? (
                      "Processing..."
                    ) : decision === "approved" ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve Submission
                      </>
                    ) : decision === "revision_requested" ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Request Revision
                      </>
                    ) : decision === "rejected" ? (
                      <>
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject Submission
                      </>
                    ) : (
                      "Select a decision"
                    )}
                  </Button>

                  {decision === "revision_requested" && !feedback && (
                    <Alert>
                      <AlertDescription className="text-xs">
                        Please provide feedback when requesting revision.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Validation History */}
            {validation && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Validation Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <p className="font-medium">{validation.status}</p>
                  </div>
                  {validation.started_at && (
                    <div>
                      <Label className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Started
                      </Label>
                      <p className="text-xs">
                        {formatDistanceToNow(new Date(validation.started_at), { addSuffix: true })}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Decision</AlertDialogTitle>
            <AlertDialogDescription>
              {decision === "approved" && "Are you sure you want to approve this submission?"}
              {decision === "rejected" && "Are you sure you want to reject this submission? This action cannot be undone."}
              {decision === "revision_requested" && "Are you sure you want to request a revision? The learner will need to resubmit."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDecision}
              className={decision === "rejected" ? "bg-destructive text-destructive-foreground" : ""}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default SubmissionReview;

