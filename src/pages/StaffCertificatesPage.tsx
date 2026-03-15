import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Award, CheckCircle2, Clock3, Loader2, Search, ShieldCheck } from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { certificateService, courseService } from "@/services/supabaseDatabaseService";
import { supabase } from "@/lib/supabase";
import type { Course, Enrollment } from "@/types";
import { toast } from "sonner";

type WorkflowStatus = "eligible" | "pending" | "needs_revision" | "released";

interface WorkflowCertificateRow {
  id: string;
  user_id: string;
  course_id: string;
  issued_at: string | null;
  certificate_number?: string | null;
}

interface WorkflowRow {
  enrollment: Enrollment;
  learnerId: string;
  learnerName: string;
  learnerEmail: string;
  courseTitle: string;
  courseCategory: string | null;
  certificateId?: string;
  certificateNumber?: string | null;
  certificateIssuedAt?: string | null;
  status: WorkflowStatus;
}

const loadManagerEnrollments = async (courseIds: string[]): Promise<Enrollment[]> => {
  if (!supabase || courseIds.length === 0) {
    return [];
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_course_manager_enrollments", {
    p_course_ids: courseIds,
    p_user_id: null,
  });

  const rows = Array.isArray(rpcData) && !rpcError
    ? rpcData
    : (await supabase
        .from("enrollments")
        .select("id, user_id, course_id, progress, status, enrolled_at, completed_at, certificate_id, completion_approval_status, completion_requested_at, completion_reviewed_at, completion_reviewed_by, completion_feedback, updated_at")
        .in("course_id", courseIds)
        .order("enrolled_at", { ascending: false })).data || [];

  const enrollmentIds = rows.map((enrollment: any) => enrollment.id).filter(Boolean);
  const detailMap = new Map<string, any>();

  if (enrollmentIds.length > 0) {
    const { data: enrollmentDetails } = await supabase
      .from("enrollments")
      .select("id, completion_approval_status, completion_requested_at, completion_reviewed_at, completion_reviewed_by, completion_feedback, updated_at")
      .in("id", enrollmentIds);

    for (const enrollmentDetail of enrollmentDetails || []) {
      detailMap.set(enrollmentDetail.id, enrollmentDetail);
    }
  }

  return rows.map((enrollment: any) => {
    const details = detailMap.get(enrollment.id) || {};

    return {
      id: enrollment.id,
      userId: enrollment.user_id,
      courseId: enrollment.course_id,
      progress: enrollment.progress,
      status: enrollment.status,
      enrolledAt: enrollment.enrolled_at,
      completedAt: enrollment.completed_at || undefined,
      certificateId: enrollment.certificate_id || undefined,
      completionApprovalStatus: details.completion_approval_status || enrollment.completion_approval_status || undefined,
      completionRequestedAt: details.completion_requested_at || undefined,
      completionReviewedAt: details.completion_reviewed_at || undefined,
      completionReviewedBy: details.completion_reviewed_by || undefined,
      completionFeedback: details.completion_feedback || undefined,
      lastActivityAt: details.updated_at || enrollment.updated_at || enrollment.enrolled_at,
    } satisfies Enrollment;
  });
};

const normalizeCertificateRow = (row: any): WorkflowCertificateRow | null => {
  if (!row?.id || !row?.user_id || !row?.course_id) {
    return null;
  }

  return {
    id: row.id,
    user_id: row.user_id,
    course_id: row.course_id,
    issued_at: row.issued_at || null,
    certificate_number: row.certificate_number || null,
  };
};

const loadManagerCertificates = async (courseIds: string[]) => {
  if (!supabase || courseIds.length === 0) {
    return [] as WorkflowCertificateRow[];
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_course_manager_certificates", {
    p_course_ids: courseIds,
    p_user_id: null,
  });

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData
      .map(normalizeCertificateRow)
      .filter((row): row is WorkflowCertificateRow => Boolean(row));
  }

  const { data } = await supabase
    .from("certificates")
    .select("id, user_id, course_id, issued_at, certificate_number")
    .in("course_id", courseIds)
    .order("issued_at", { ascending: false });

  return (data || [])
    .map(normalizeCertificateRow)
    .filter((row): row is WorkflowCertificateRow => Boolean(row));
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return "Not available";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const resolveWorkflowStatus = (enrollment: Enrollment, certificate?: WorkflowCertificateRow): WorkflowStatus | null => {
  if (enrollment.certificateId || certificate) {
    return "released";
  }

  if (enrollment.completionApprovalStatus === "approved") {
    return "eligible";
  }

  if (enrollment.completionApprovalStatus === "pending") {
    return "pending";
  }

  if (enrollment.completionApprovalStatus === "needs_revision") {
    return "needs_revision";
  }

  if (enrollment.status === "completed") {
    return "eligible";
  }

  return null;
};

const statusConfig: Record<WorkflowStatus, { label: string; badgeClass: string }> = {
  eligible: {
    label: "Eligible for release",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  },
  pending: {
    label: "Awaiting approval",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
  },
  needs_revision: {
    label: "Needs revision",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50",
  },
  released: {
    label: "Released",
    badgeClass: "border-primary/20 bg-primary/10 text-primary hover:bg-primary/10",
  },
};

const StaffCertificatesPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [issuingEnrollmentId, setIssuingEnrollmentId] = useState<string | null>(null);
  const [workflowRows, setWorkflowRows] = useState<WorkflowRow[]>([]);

  const portalPrefix = user?.role === "admin" ? "/admin" : "/trainer";
  const isAdmin = user?.role === "admin";

  const loadWorkflow = async () => {
    if (!user) {
      return;
    }

    setLoading(true);

    try {
      const visibleCourses = await courseService.getCourses();
      const courseMap = new Map<string, Course>(visibleCourses.map((course) => [course.id, course]));
      const courseIds = visibleCourses.map((course) => course.id);

      if (courseIds.length === 0) {
        setWorkflowRows([]);
        return;
      }

      const [enrollments, certificates] = await Promise.all([
        loadManagerEnrollments(courseIds),
        loadManagerCertificates(courseIds),
      ]);

      const learnerIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.userId).filter(Boolean)));
      const learnerMap = new Map<string, { name: string; email: string }>();

      if (supabase && learnerIds.length > 0) {
        const { data: learnersData, error: learnersError } = await supabase
          .from("users")
          .select("id, name, email")
          .in("id", learnerIds);

        if (learnersError) {
          console.warn("Failed to load certificate workflow learners:", learnersError);
        } else {
          for (const learner of learnersData || []) {
            learnerMap.set(learner.id, {
              name: learner.name || learner.email || learner.id,
              email: learner.email || "No email available",
            });
          }
        }
      }

      const certificateMap = new Map<string, WorkflowCertificateRow>();
      for (const certificate of certificates) {
        const key = `${certificate.user_id}:${certificate.course_id}`;
        if (!certificateMap.has(key)) {
          certificateMap.set(key, certificate);
        }
      }

      const nextRows = enrollments
        .map((enrollment) => {
          const certificate = certificateMap.get(`${enrollment.userId}:${enrollment.courseId}`);
          const status = resolveWorkflowStatus(enrollment, certificate);

          if (!status) {
            return null;
          }

          const learner = learnerMap.get(enrollment.userId);
          const course = courseMap.get(enrollment.courseId);

          return {
            enrollment,
            learnerId: enrollment.userId,
            learnerName: learner?.name || enrollment.userId,
            learnerEmail: learner?.email || "No email available",
            courseTitle: course?.title || "Untitled course",
            courseCategory: course?.category || null,
            certificateId: enrollment.certificateId || certificate?.id,
            certificateNumber: certificate?.certificate_number || null,
            certificateIssuedAt: certificate?.issued_at || null,
            status,
          } satisfies WorkflowRow;
        })
        .filter((row): row is WorkflowRow => Boolean(row))
        .sort((left, right) => {
          const priority = { eligible: 0, pending: 1, needs_revision: 2, released: 3 } as const;
          const statusDelta = priority[left.status] - priority[right.status];
          if (statusDelta !== 0) {
            return statusDelta;
          }

          const leftDate = new Date(left.enrollment.completedAt || left.enrollment.enrolledAt).getTime();
          const rightDate = new Date(right.enrollment.completedAt || right.enrollment.enrolledAt).getTime();
          return rightDate - leftDate;
        });

      setWorkflowRows(nextRows);
    } catch (error) {
      console.error("Failed to load certificate workflow:", error);
      toast.error("Failed to load certificate workflow");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "trainer") {
      void loadWorkflow();
    }
  }, [user?.id, user?.role]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return workflowRows;
    }

    return workflowRows.filter((row) => {
      const searchableText = [
        row.learnerName,
        row.learnerEmail,
        row.courseTitle,
        row.courseCategory || "",
        row.certificateNumber || "",
      ].join(" ").toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [searchQuery, workflowRows]);

  const eligibleRows = filteredRows.filter((row) => row.status === "eligible");
  const pendingRows = filteredRows.filter((row) => row.status === "pending" || row.status === "needs_revision");
  const releasedRows = filteredRows.filter((row) => row.status === "released");

  const allCounts = useMemo(() => ({
    eligible: workflowRows.filter((row) => row.status === "eligible").length,
    pending: workflowRows.filter((row) => row.status === "pending" || row.status === "needs_revision").length,
    released: workflowRows.filter((row) => row.status === "released").length,
  }), [workflowRows]);

  const handleIssueCertificate = async (row: WorkflowRow) => {
    if (!user) {
      return;
    }

    setIssuingEnrollmentId(row.enrollment.id);

    try {
      await certificateService.issueCertificateForEnrollment(row.enrollment.id, user.id);
      toast.success(`Certificate released for ${row.learnerName}`);
      await loadWorkflow();
    } catch (error: any) {
      console.error("Failed to release certificate:", error);
      toast.error(error?.message || "Failed to release certificate");
    } finally {
      setIssuingEnrollmentId(null);
    }
  };

  const renderWorkflowTable = (rows: WorkflowRow[], emptyTitle: string, emptyBody: string) => {
    if (rows.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center">
          <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
          <p className="mt-2 text-sm text-muted-foreground">{emptyBody}</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-2xl border border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Learner</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Certificate</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.enrollment.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{row.learnerName}</p>
                    <p className="text-xs text-muted-foreground">{row.learnerEmail}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{row.courseTitle}</p>
                    <p className="text-xs text-muted-foreground">{row.courseCategory || "Uncategorized"}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm text-foreground">{formatDateLabel(row.enrollment.completedAt || row.enrollment.completionRequestedAt)}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.enrollment.completedAt ? "Completion recorded" : row.enrollment.completionRequestedAt ? "Completion submitted" : "Legacy completion record"}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusConfig[row.status].badgeClass}>
                    {statusConfig[row.status].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.status === "released" ? (
                    <div>
                      <p className="text-sm font-medium text-foreground">{formatDateLabel(row.certificateIssuedAt)}</p>
                      <p className="text-xs text-muted-foreground">{row.certificateNumber || "Certificate linked to enrollment"}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not released yet</p>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {row.status === "eligible" ? (
                      <Button
                        size="sm"
                        onClick={() => void handleIssueCertificate(row)}
                        disabled={issuingEnrollmentId === row.enrollment.id}
                      >
                        {issuingEnrollmentId === row.enrollment.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Release certificate
                      </Button>
                    ) : row.status === "pending" || row.status === "needs_revision" ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={isAdmin ? `${portalPrefix}/enrollments/${row.enrollment.id}` : `${portalPrefix}/learners/${row.learnerId}`}>
                          Review progress
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">Released</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading certificate workflow...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
              {isAdmin ? "Admin portal" : "Trainer portal"}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Certificate workflow
            </Badge>
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Certificates</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
              Review completion-ready enrollments, release certificates from one shared page, and track which certificates are still pending versus already released.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{allCounts.eligible}</p>
                  <p className="text-sm text-muted-foreground">Eligible for release</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/60">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <Clock3 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{allCounts.pending}</p>
                  <p className="text-sm text-muted-foreground">Pending or needs revision</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{allCounts.released}</p>
                  <p className="text-sm text-muted-foreground">Certificates released</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Workflow guidance</CardTitle>
            <CardDescription>
              Eligible rows can be released immediately. Pending rows are still waiting on completion approval, and released rows already have a certificate linked to the enrollment. Repeated clicks reuse the same certificate record instead of generating duplicates.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Eligible now</p>
              <p className="mt-2 text-sm text-muted-foreground">Completion is approved or already marked complete in a legacy record, so the certificate can be released now.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Pending review</p>
              <p className="mt-2 text-sm text-muted-foreground">Completion was submitted but still needs staff review, or it was sent back for revision before release.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Released</p>
              <p className="mt-2 text-sm text-muted-foreground">A certificate has already been issued and linked to the enrollment, so staff can monitor issuance without reissuing it.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Certificate release queue</CardTitle>
                <CardDescription>
                  Search learners or courses, then switch between the release-ready, pending, and released views.
                </CardDescription>
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search learners or courses"
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="eligible" className="space-y-4">
              <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl bg-muted/60 p-1 md:grid-cols-3">
                <TabsTrigger value="eligible" className="rounded-xl">Eligible ({eligibleRows.length})</TabsTrigger>
                <TabsTrigger value="pending" className="rounded-xl">Pending ({pendingRows.length})</TabsTrigger>
                <TabsTrigger value="released" className="rounded-xl">Released ({releasedRows.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="eligible">
                {renderWorkflowTable(
                  eligibleRows,
                  "No eligible certificates right now",
                  "Approved completions will appear here as soon as they are ready for release."
                )}
              </TabsContent>

              <TabsContent value="pending">
                {renderWorkflowTable(
                  pendingRows,
                  "No pending certificate items right now",
                  "Rows awaiting completion approval or revision will appear here for tracking."
                )}
              </TabsContent>

              <TabsContent value="released">
                {renderWorkflowTable(
                  releasedRows,
                  "No released certificates found",
                  "Once certificates are issued, they will appear here with their release date and linked record."
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardContent className="flex flex-col gap-3 py-6 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium text-foreground">Completion review and certificate release stay aligned</p>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Pending items link back to the underlying progress or enrollment record so staff can review before releasing, while released items remain visible for audit and follow-up.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StaffCertificatesPage;