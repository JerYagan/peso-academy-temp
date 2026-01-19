import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  FileText, 
  AlertCircle,
  ArrowRight,
  Eye,
  CheckCircle,
  XCircle as XCircleIcon,
  RefreshCw
} from "lucide-react";
import { Link } from "react-router-dom";
import { validatorService } from "@/services/validatorService";
import { Submission, Validation } from "@/types";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

const ValidatorDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    pending: 0,
    completed: 0,
    approved: 0,
    rejected: 0,
    inProgress: 0,
  });
  const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([]);
  const [recentValidations, setRecentValidations] = useState<Validation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Load stats
      const validationStats = await validatorService.getValidationStats(user.id);
      setStats(validationStats);

      // Load pending submissions (limit to 10 for dashboard)
      const submissions = await validatorService.getPendingSubmissions({ limit: 10 });
      setPendingSubmissions(submissions);

      // Load recent validations
      const recent = await validatorService.getRecentValidations(5);
      setRecentValidations(recent);
    } catch (error) {
      console.error("Error loading validator dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "default";
      case "normal":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      case "under_review":
        return "secondary";
      case "revision_requested":
        return "outline";
      default:
        return "outline";
    }
  };

  const getDecisionBadge = (decision: string | null) => {
    if (!decision) return null;
    
    switch (decision) {
      case "approved":
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircleIcon className="h-3 w-3" /> Rejected</Badge>;
      case "revision_requested":
        return <Badge variant="outline" className="gap-1"><RefreshCw className="h-3 w-3" /> Revision</Badge>;
      default:
        return null;
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Validator Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Review and validate training completions and submissions
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground">Under review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">Total validated</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              <p className="text-xs text-muted-foreground">Successfully approved</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground">Rejected submissions</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common validation tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/validator/submissions">
                <FileText className="mr-2 h-4 w-4" />
                Review Submissions
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/validator/submissions?status=pending">
                <Clock className="mr-2 h-4 w-4" />
                Pending Queue
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/validator/submissions?status=under_review">
                <AlertCircle className="mr-2 h-4 w-4" />
                In Progress
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/validator/validations">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Validation History
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Pending Submissions Queue */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pending Submissions</CardTitle>
                  <CardDescription>Submissions awaiting validation</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/validator/submissions">
                    View All <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : pendingSubmissions.length > 0 ? (
                <div className="space-y-4">
                  {pendingSubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{submission.title}</h3>
                          <Badge variant={getPriorityBadgeVariant(submission.priority)}>
                            {submission.priority}
                          </Badge>
                          <Badge variant={getStatusBadgeVariant(submission.status)}>
                            {submission.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {submission.course_title || "Course"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {submission.user_name || submission.user_email} •{" "}
                          {formatDistanceToNow(new Date(submission.submitted_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/validator/submissions/${submission.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No pending submissions</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    All submissions have been reviewed
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Validations */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Validations</CardTitle>
                  <CardDescription>Your recent validation activity</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/validator/validations">
                    View All <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : recentValidations.length > 0 ? (
                <div className="space-y-4">
                  {recentValidations.map((validation) => (
                    <div
                      key={validation.id}
                      className="flex items-start justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {getDecisionBadge(validation.decision)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {validation.completed_at
                            ? formatDistanceToNow(new Date(validation.completed_at), {
                                addSuffix: true,
                              })
                            : "In progress"}
                        </p>
                        {validation.feedback && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {validation.feedback}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No recent validations</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start reviewing submissions to see your activity here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ValidatorDashboard;

