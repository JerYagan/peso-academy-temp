import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import TraineeVerificationBadge from "@/components/trainee/TraineeVerificationBadge";
import { useAuth } from "@/contexts/AuthContext";
import { downloadPhysicalIdDocument } from "@/lib/traineeVerificationDocuments";
import { userService } from "@/services/supabaseDatabaseService";
import { cn } from "@/lib/utils";
import type { User, VerificationStatus } from "@/types/auth";

const traineeTypeLabel: Record<NonNullable<User["traineeType"]>, string> = {
  peso_client: "PESO Client",
  peso_employee: "PESO Employee",
};

const PAGE_SIZE = 15;

export default function TraineeVerification() {
  const { user: currentUser } = useAuth();
  const [trainees, setTrainees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [traineeTypeFilter, setTraineeTypeFilter] = useState("all");
  const [verificationStatusFilter, setVerificationStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedTrainee, setSelectedTrainee] = useState<User | null>(null);
  const [nextStatus, setNextStatus] = useState<VerificationStatus>("verified");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [physicalIdPreviewUrl, setPhysicalIdPreviewUrl] = useState<string | null>(null);
  const [physicalIdPreviewLoading, setPhysicalIdPreviewLoading] = useState(false);

  const loadTrainees = async () => {
    try {
      setLoading(true);
      const result = await userService.getTraineesForVerification();
      setTrainees(result);
    } catch (error) {
      console.error("Failed to load trainee verification queue:", error);
      toast.error("Failed to load the trainee verification queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTrainees();
  }, []);

  const filteredTrainees = useMemo(() => {
    return trainees.filter((trainee) => {
      const matchesSearch =
        trainee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trainee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trainee.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trainee.employeeId || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTraineeType = traineeTypeFilter === "all" || trainee.traineeType === traineeTypeFilter;
      const matchesVerificationStatus =
        verificationStatusFilter === "all" ||
        (trainee.verificationStatus || "pending") === verificationStatusFilter;

      return matchesSearch && matchesTraineeType && matchesVerificationStatus;
    });
  }, [searchTerm, traineeTypeFilter, trainees, verificationStatusFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, traineeTypeFilter, verificationStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTrainees.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedTrainees = filteredTrainees.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const stats = useMemo(() => {
    return trainees.reduce(
      (acc, trainee) => {
        const verificationStatus = trainee.verificationStatus || "pending";
        acc.total += 1;
        acc[verificationStatus] += 1;
        return acc;
      },
      { total: 0, pending: 0, verified: 0, rejected: 0 } as Record<"total" | VerificationStatus, number>,
    );
  }, [trainees]);

  const openStatusDialog = (trainee: User, status: VerificationStatus) => {
    setSelectedTrainee(trainee);
    setNextStatus(status);
    setVerificationNotes(status === "rejected" ? trainee.verificationNotes || "" : "");
    setPhysicalIdPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return null;
    });
  };

  const closeStatusDialog = () => {
    setSelectedTrainee(null);
    setNextStatus("verified");
    setVerificationNotes("");
    setPhysicalIdPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return null;
    });
  };

  useEffect(() => {
    let isActive = true;

    const loadPhysicalIdPreview = async () => {
      if (!selectedTrainee?.physicalId) {
        setPhysicalIdPreviewUrl(null);
        return;
      }

      try {
        setPhysicalIdPreviewLoading(true);
        setPhysicalIdPreviewUrl((currentUrl) => {
          if (currentUrl) {
            URL.revokeObjectURL(currentUrl);
          }

          return null;
        });
        const fileBlob = await downloadPhysicalIdDocument(selectedTrainee.physicalId, selectedTrainee.id);

        if (!isActive) {
          return;
        }

        const objectUrl = URL.createObjectURL(fileBlob);
        setPhysicalIdPreviewUrl((currentUrl) => {
          if (currentUrl) {
            URL.revokeObjectURL(currentUrl);
          }

          return objectUrl;
        });
      } catch (error) {
        console.error("Failed to load uploaded physical ID image:", error);
        if (isActive) {
          toast.error("Failed to load the uploaded physical ID image.");
        }
      } finally {
        if (isActive) {
          setPhysicalIdPreviewLoading(false);
        }
      }
    };

    void loadPhysicalIdPreview();

    return () => {
      isActive = false;
    };
  }, [selectedTrainee]);

  const handleStatusUpdate = async () => {
    if (!selectedTrainee) return;

    try {
      setSaving(true);
      await userService.updateTraineeVerification(
        selectedTrainee.id,
        nextStatus,
        nextStatus === "rejected" ? verificationNotes.trim() || undefined : undefined,
        currentUser?.id,
      );
      toast.success(`Trainee marked as ${nextStatus}.`);
      closeStatusDialog();
      await loadTrainees();
    } catch (error) {
      console.error("Failed to update trainee verification:", error);
      toast.error("Failed to update trainee verification status.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Trainee Verification</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Review PESO Client and PESO Employee registrations before unlocking course participation.
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadTrainees()} disabled={loading}>
            Refresh queue
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total trainees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Verified</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700">{stats.verified}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-700">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Verification Queue</CardTitle>
            <CardDescription>Filter by trainee type or verification status, then verify or reject the account.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.4fr_0.4fr]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-10"
                  placeholder="Search by name, email, learner ID, or employee ID"
                />
              </div>

              <Select value={traineeTypeFilter} onValueChange={setTraineeTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All trainee types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All trainee types</SelectItem>
                  <SelectItem value="peso_client">PESO Client</SelectItem>
                  <SelectItem value="peso_employee">PESO Employee</SelectItem>
                </SelectContent>
              </Select>

              <Select value={verificationStatusFilter} onValueChange={setVerificationStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading trainee verification queue...</div>
            ) : filteredTrainees.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No trainees match the current filters.</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trainee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Identifiers</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTrainees.map((trainee) => (
                      <TableRow key={trainee.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{trainee.name}</p>
                            <p className="text-sm text-muted-foreground">{trainee.email}</p>
                            <p className="text-xs text-muted-foreground">Learner ID: <span className="font-mono text-foreground">{trainee.id}</span></p>
                          </div>
                        </TableCell>
                        <TableCell>{trainee.traineeType ? traineeTypeLabel[trainee.traineeType] : "Not set"}</TableCell>
                        <TableCell>
                          {trainee.traineeType === "peso_employee" ? (
                            <div className="space-y-1 text-sm">
                              <p><span className="text-muted-foreground">Learner ID:</span> <span className="font-mono text-foreground">{trainee.id}</span></p>
                              <p><span className="text-muted-foreground">Employee ID:</span> {trainee.employeeId || "Not provided"}</p>
                              <p><span className="text-muted-foreground">Physical ID:</span> {trainee.physicalId ? "Available" : "Not uploaded"}</p>
                            </div>
                          ) : (
                            <div className="space-y-1 text-sm">
                              <p><span className="text-muted-foreground">Learner ID:</span> <span className="font-mono text-foreground">{trainee.id}</span></p>
                              <p className="text-muted-foreground">Employee details not required</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <TraineeVerificationBadge status={trainee.verificationStatus} />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {trainee.verificationSubmittedAt
                              ? new Date(trainee.verificationSubmittedAt).toLocaleDateString()
                              : new Date(trainee.createdAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => openStatusDialog(trainee, "verified")} className="gap-2">
                              <UserCheck className="h-4 w-4" />
                              Verify
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openStatusDialog(trainee, "rejected")} className="gap-2 text-rose-700">
                              <UserX className="h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {filteredTrainees.length > PAGE_SIZE ? (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (safePage > 1) {
                              setPage(safePage - 1);
                            }
                          }}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            href="#"
                            isActive={pageNumber === safePage}
                            onClick={(event) => {
                              event.preventDefault();
                              setPage(pageNumber);
                            }}
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (safePage < totalPages) {
                              setPage(safePage + 1);
                            }
                          }}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(selectedTrainee)} onOpenChange={(open) => !open && closeStatusDialog()}>
          <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {nextStatus === "verified" ? <UserCheck className="h-5 w-5" /> : <UserX className="h-5 w-5" />}
                {nextStatus === "verified" ? "Verify trainee" : "Reject trainee"}
              </DialogTitle>
              <DialogDescription>
                {selectedTrainee
                  ? nextStatus === "verified"
                    ? `Confirm verification for ${selectedTrainee.name}.`
                    : `Confirm rejection for ${selectedTrainee.name}.`
                  : "Update trainee verification status."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {selectedTrainee ? (
                <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{selectedTrainee.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedTrainee.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedTrainee.traineeType ? traineeTypeLabel[selectedTrainee.traineeType] : "Trainee type not set"}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Learner ID</p>
                      <p className="mt-1 font-mono text-sm text-foreground">{selectedTrainee.id}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Employee ID</p>
                      <p className="mt-1 text-sm text-foreground">
                        {selectedTrainee.traineeType === "peso_employee"
                          ? selectedTrainee.employeeId || "Not provided"
                          : "Not required"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Physical ID image</p>
                      {selectedTrainee.traineeType === "peso_employee" ? (
                        <span className="text-xs text-muted-foreground">Optional review aid</span>
                      ) : null}
                    </div>
                    {selectedTrainee.traineeType !== "peso_employee" ? (
                      <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                        No employee verification document is required for PESO Client registrations.
                      </div>
                    ) : physicalIdPreviewLoading ? (
                      <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                        Loading uploaded physical ID image...
                      </div>
                    ) : physicalIdPreviewUrl ? (
                      <div className="overflow-hidden rounded-xl border border-border/60 bg-background/70 p-3">
                        <img
                          src={physicalIdPreviewUrl}
                          alt={`Uploaded physical ID for ${selectedTrainee.name}`}
                          className="max-h-[18rem] w-full rounded-lg object-contain"
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                        No uploaded physical ID image found.
                      </div>
                    )}
                  </div>

                  <div className={cn(
                    "rounded-xl border px-4 py-3 text-sm",
                    nextStatus === "verified"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100"
                      : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-100",
                  )}>
                    {nextStatus === "verified"
                      ? "This will unlock course participation for the trainee if all other requirements are satisfied."
                      : "This will keep course participation locked until the trainee is reviewed again."}
                  </div>
                </div>
              ) : null}

              {nextStatus === "rejected" ? (
                <div className="space-y-2">
                  <label htmlFor="verification-notes" className="text-sm font-medium text-foreground">
                    Rejection notes
                  </label>
                  <Textarea
                    id="verification-notes"
                    value={verificationNotes}
                    onChange={(event) => setVerificationNotes(event.target.value)}
                    placeholder="Optionally explain what the trainee needs to fix before another review."
                    rows={4}
                  />
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeStatusDialog} disabled={saving}>Cancel</Button>
              <Button onClick={() => void handleStatusUpdate()} disabled={saving}>
                {saving ? "Saving..." : nextStatus === "verified" ? "Confirm verify" : "Confirm reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}