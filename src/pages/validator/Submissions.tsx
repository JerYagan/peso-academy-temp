import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Search,
  Eye,
  Clock,
  AlertCircle,
  FileText,
  Filter
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { validatorService } from "@/services/validatorService";
import { Submission } from "@/types";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

const ValidatorSubmissions = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "all";
  
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadSubmissions();
  }, [statusFilter]);

  const loadSubmissions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const options: any = { limit: 50 };
      
      if (statusFilter !== "all") {
        if (statusFilter === "pending") {
          // Get pending submissions
          const pending = await validatorService.getPendingSubmissions({ limit: 50 });
          setSubmissions(pending);
        } else {
          // For other statuses, we'd need to filter
          const all = await validatorService.getPendingSubmissions({ limit: 100 });
          setSubmissions(all.filter(s => s.status === statusFilter));
        }
      } else {
        const all = await validatorService.getPendingSubmissions({ limit: 50 });
        setSubmissions(all);
      }
    } catch (error) {
      console.error("Error loading submissions:", error);
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

  const filteredSubmissions = submissions.filter((submission) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        submission.title.toLowerCase().includes(term) ||
        submission.course_title?.toLowerCase().includes(term) ||
        submission.user_name?.toLowerCase().includes(term) ||
        submission.user_email?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Submissions</h1>
          <p className="text-muted-foreground mt-2">
            Review and validate training submissions
          </p>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>Filter Submissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                asChild
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
              >
                <Link to="/validator/submissions">All</Link>
              </Button>
              <Button
                asChild
                variant={statusFilter === "pending" ? "default" : "outline"}
                size="sm"
              >
                <Link to="/validator/submissions?status=pending">
                  <Clock className="mr-2 h-4 w-4" />
                  Pending
                </Link>
              </Button>
              <Button
                asChild
                variant={statusFilter === "under_review" ? "default" : "outline"}
                size="sm"
              >
                <Link to="/validator/submissions?status=under_review">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  In Review
                </Link>
              </Button>
              <Button
                asChild
                variant={statusFilter === "revision_requested" ? "default" : "outline"}
                size="sm"
              >
                <Link to="/validator/submissions?status=revision_requested">
                  <FileText className="mr-2 h-4 w-4" />
                  Revision
                </Link>
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, course, or learner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submissions List */}
        <Card>
          <CardHeader>
            <CardTitle>
              {statusFilter === "all" ? "All Submissions" : `${statusFilter.replace("_", " ")} Submissions`}
            </CardTitle>
            <CardDescription>
              {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading submissions...</p>
              </div>
            ) : filteredSubmissions.length > 0 ? (
              <div className="space-y-4">
                {filteredSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{submission.title}</h3>
                        <Badge variant={getPriorityBadgeVariant(submission.priority)}>
                          {submission.priority}
                        </Badge>
                        <Badge variant={getStatusBadgeVariant(submission.status)}>
                          {submission.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Course:</span> {submission.course_title || "N/A"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Learner:</span> {submission.user_name || submission.user_email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Submitted {formatDistanceToNow(new Date(submission.submitted_at), {
                          addSuffix: true,
                        })}
                      </p>
                      {submission.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {submission.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/validator/submissions/${submission.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Review
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? "No submissions match your search" : "No submissions found"}
                </p>
                {searchTerm && (
                  <Button
                    variant="outline"
                    onClick={() => setSearchTerm("")}
                    className="mt-4"
                  >
                    Clear Search
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ValidatorSubmissions;

