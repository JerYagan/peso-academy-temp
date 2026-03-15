import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, Plus, Search, Eye, MoreHorizontal } from "lucide-react";
import { Enrollment, Course } from "@/types";
import { certificateService, enrollmentService, courseService } from "@/services/supabaseDatabaseService";
import { BulkEnrollmentDialog } from "@/components/enrollment/BulkEnrollmentDialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type EnrollmentWithDetails = Enrollment & {
  userName?: string;
  userEmail?: string;
  courseTitle?: string;
  lastActivityAt?: string;
};

const AdminEnrollments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentWithDetails[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bulkEnrollOpen, setBulkEnrollOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [unenrollId, setUnenrollId] = useState<string | null>(null);
  const [preserveProgress, setPreserveProgress] = useState(false);
  const [courseActionEnrollmentId, setCourseActionEnrollmentId] = useState<string | null>(null);

  useEffect(() => {
    void initializePage();
  }, []);

  const initializePage = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCourses(), loadEnrollments()]);
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const allCourses = await courseService.getCourses();
      setCourses(allCourses);
    } catch (error) {
      console.error("Error loading courses:", error);
    }
  };

  const loadEnrollments = async () => {
    try {
      const enrollmentRows = await enrollmentService.getEnrollmentsWithDetails();
      setEnrollments(enrollmentRows);
    } catch (error) {
      console.error("Error loading enrollments:", error);
      toast.error("Failed to load enrollments");
    }
  };

  const filteredEnrollments = enrollments.filter((enrollment) => {
    const matchesSearch =
      enrollment.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.courseTitle?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = courseFilter === "all" || enrollment.courseId === courseFilter;
    const matchesStatus = statusFilter === "all" || enrollment.status === statusFilter;
    return matchesSearch && matchesCourse && matchesStatus;
  });

  const enrollmentStatusSummary = useMemo(() => {
    return filteredEnrollments.reduce(
      (summary, enrollment) => {
        summary.total += 1;
        summary[enrollment.status] += 1;
        return summary;
      },
      {
        total: 0,
        enrolled: 0,
        "in-progress": 0,
        completed: 0,
        dropped: 0,
      } as Record<"total" | Enrollment["status"], number>,
    );
  }, [filteredEnrollments]);

  const handleUnenroll = async () => {
    if (!unenrollId) return;

    try {
      const enrollmentId = unenrollId;
      await enrollmentService.unenroll(unenrollId, preserveProgress);
      setEnrollments((current) => {
        if (preserveProgress) {
          return current.map((enrollment) =>
            enrollment.id === enrollmentId
              ? { ...enrollment, status: "dropped" }
              : enrollment,
          );
        }

        return current.filter((enrollment) => enrollment.id !== enrollmentId);
      });
      toast.success(preserveProgress ? "Enrollment marked as dropped" : "User unenrolled successfully");
      setUnenrollId(null);
      setPreserveProgress(false);
      await loadEnrollments();
    } catch (error) {
      console.error("Error unenrolling:", error);
      toast.error("Failed to unenroll user");
    }
  };

  const handleCompletionAction = async (enrollmentId: string, decision: "approved" | "needs_revision") => {
    if (!user) {
      return;
    }

    setCourseActionEnrollmentId(enrollmentId);

    try {
      await enrollmentService.reviewCompletion(
        enrollmentId,
        user.id,
        decision,
        decision === "needs_revision" ? "Returned for follow-up from enrollment management." : undefined,
      );
      toast.success(decision === "approved" ? "Completion approved" : "Enrollment marked for follow-up");
      await loadEnrollments();
    } catch (error: any) {
      console.error("Error updating completion status:", error);
      toast.error(error?.message || "Failed to update completion status");
    } finally {
      setCourseActionEnrollmentId(null);
    }
  };

  const handleIssueCertificate = async (enrollmentId: string) => {
    if (!user) {
      return;
    }

    setCourseActionEnrollmentId(enrollmentId);

    try {
      await certificateService.issueCertificateForEnrollment(enrollmentId, user.id);
      toast.success("Certificate released");
      await loadEnrollments();
    } catch (error: any) {
      console.error("Error releasing certificate:", error);
      toast.error(error?.message || "Failed to release certificate");
    } finally {
      setCourseActionEnrollmentId(null);
    }
  };

  const getStatusBadge = (status: Enrollment["status"]) => {
    const variants: Record<Enrollment["status"], "default" | "secondary" | "outline" | "destructive"> = {
      enrolled: "default",
      "in-progress": "secondary",
      completed: "default",
      dropped: "destructive",
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getLastActiveLabel = (lastActivityAt?: string) => {
    if (!lastActivityAt) return { text: "—", color: "text-muted-foreground" };
    const at = new Date(lastActivityAt).getTime();
    const now = Date.now();
    const hours = (now - at) / (1000 * 60 * 60);
    const days = hours / 24;
    if (hours < 6) return { text: "Active (within 6h)", color: "text-green-600 font-medium" };
    if (hours < 24) return { text: `${Math.round(hours)}h ago`, color: "text-green-600" };
    if (days < 7) return { text: `${Math.round(days)} day(s) ago`, color: "text-yellow-600 dark:text-yellow-500" };
    if (days < 14) return { text: `${Math.round(days)} days ago`, color: "text-orange-600 dark:text-orange-500" };
    return { text: `${Math.round(days / 7)} week(s) ago`, color: "text-red-600 font-medium" };
  };

  const getCompletionBadge = (enrollment: Enrollment) => {
    if (enrollment.completionApprovalStatus === "approved") {
      return <Badge>Completion Approved</Badge>;
    }

    if (enrollment.completionApprovalStatus === "pending") {
      return <Badge variant="secondary">Awaiting Trainer Approval</Badge>;
    }

    if (enrollment.completionApprovalStatus === "needs_revision") {
      return <Badge variant="outline">Needs Follow-up</Badge>;
    }

    return <Badge variant="outline">Not Ready</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Enrollment Management</h1>
            <p className="mt-2 text-muted-foreground">Manage enrollment approvals, follow-up decisions, and certificate release from one queue.</p>
          </div>
          <Button
            onClick={() => {
              if (courses.length > 0) {
                setSelectedCourse(courses[0]);
                setBulkEnrollOpen(true);
              } else {
                toast.error("Please wait for courses to load");
              }
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Bulk Enroll
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by name, email, or course..."
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={courseFilter} onValueChange={setCourseFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="enrolled">Enrolled</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="dropped">Dropped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enrollments ({filteredEnrollments.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
              Use this page for enrollment workflow actions. Open Learner Review only when you need the full learner activity and module-by-module evidence.
            </div>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading enrollments...</div>
            ) : filteredEnrollments.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                <p className="text-muted-foreground">No enrollments found</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Shown</p>
                    <p className="mt-2 text-2xl font-semibold">{enrollmentStatusSummary.total}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Enrolled</p>
                    <p className="mt-2 text-2xl font-semibold">{enrollmentStatusSummary.enrolled}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">In progress</p>
                    <p className="mt-2 text-2xl font-semibold">{enrollmentStatusSummary["in-progress"]}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Completed</p>
                    <p className="mt-2 text-2xl font-semibold">{enrollmentStatusSummary.completed}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredEnrollments.map((enrollment) => {
                    const lastActive = getLastActiveLabel(enrollment.lastActivityAt || enrollment.enrolledAt);

                    return (
                      <div key={enrollment.id} className="grid gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]">
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-lg font-semibold leading-tight">{enrollment.userName || "Unknown"}</p>
                                <p className="text-sm text-muted-foreground">{enrollment.userEmail || "No email available"}</p>
                              </div>
                              {getStatusBadge(enrollment.status)}
                            </div>
                            <p className="text-sm font-medium text-foreground">{enrollment.courseTitle || "Unknown Course"}</p>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium text-foreground">{enrollment.progress}%</span>
                            </div>
                            <Progress value={enrollment.progress} />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {getCompletionBadge(enrollment)}
                            {enrollment.certificateId ? <Badge variant="secondary">Certificate released</Badge> : null}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                          <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Last active</p>
                            <p className={`mt-2 text-sm ${lastActive.color}`}>{lastActive.text}</p>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Enrolled</p>
                            <p className="mt-2 text-sm font-medium text-foreground">{new Date(enrollment.enrolledAt).toLocaleDateString()}</p>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-background/50 p-3 sm:col-span-2 xl:col-span-1">
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Workflow</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {getCompletionBadge(enrollment)}
                              {enrollment.certificateId ? <Badge variant="secondary">Certificate released</Badge> : <Badge variant="outline">Certificate pending</Badge>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start justify-end xl:items-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" disabled={courseActionEnrollmentId === enrollment.id}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => navigate(`/admin/learners/${enrollment.userId}`)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Open Learner Review
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!(enrollment.progress >= 100 && enrollment.completionApprovalStatus !== "approved")}
                                onClick={() => void handleCompletionAction(enrollment.id, "approved")}
                              >
                                Approve Completion
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!(enrollment.completionApprovalStatus !== "approved" && enrollment.status !== "dropped")}
                                onClick={() => void handleCompletionAction(enrollment.id, "needs_revision")}
                              >
                                Mark Follow-up
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!(enrollment.completionApprovalStatus === "approved" && !enrollment.certificateId)}
                                onClick={() => void handleIssueCertificate(enrollment.id)}
                              >
                                Release Certificate
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setUnenrollId(enrollment.id)}>
                                Unenroll
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedCourse && (
        <BulkEnrollmentDialog
          open={bulkEnrollOpen}
          onOpenChange={(open) => {
            setBulkEnrollOpen(open);
            if (!open) setSelectedCourse(null);
          }}
          course={selectedCourse}
          onSuccess={loadEnrollments}
        />
      )}

      <AlertDialog open={!!unenrollId} onOpenChange={(open) => !open && setUnenrollId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unenroll User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unenroll this user from the course?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="preserve"
                checked={preserveProgress}
                onCheckedChange={(checked) => setPreserveProgress(Boolean(checked))}
              />
              <Label htmlFor="preserve">Preserve progress and mark as dropped instead</Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPreserveProgress(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleUnenroll()}>
              {preserveProgress ? "Mark as Dropped" : "Unenroll"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminEnrollments;

