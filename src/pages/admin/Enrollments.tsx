import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Plus, Search, MoreVertical, Pause, Play, Trash2, History } from "lucide-react";
import { Enrollment, Course } from "@/types";
import { enrollmentService, courseService } from "@/services/supabaseDatabaseService";
import { BulkEnrollmentDialog } from "@/components/enrollment/BulkEnrollmentDialog";
import { toast } from "sonner";

type EnrollmentWithDetails = Enrollment & {
  userName?: string;
  userEmail?: string;
  courseTitle?: string;
};

const AdminEnrollments = () => {
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
  const [statusChangeDialog, setStatusChangeDialog] = useState<{
    open: boolean;
    enrollment: EnrollmentWithDetails | null;
    newStatus: Enrollment["status"] | null;
  }>({ open: false, enrollment: null, newStatus: null });

  useEffect(() => {
    loadCourses();
    loadEnrollments();
  }, []);

  const loadCourses = async () => {
    try {
      const allCourses = await courseService.getCourses();
      setCourses(allCourses);
    } catch (error) {
      console.error("Error loading courses:", error);
    }
  };

  const loadEnrollments = async () => {
    setLoading(true);
    try {
      // Get all enrollments with details
      const allEnrollments: EnrollmentWithDetails[] = [];
      
      // Get enrollments for each course
      for (const course of courses.length > 0 ? courses : await courseService.getCourses()) {
        const courseEnrollments = await enrollmentService.getCourseEnrollments(course.id);
        allEnrollments.push(
          ...courseEnrollments.map((e) => ({
            ...e,
            courseTitle: course.title,
          }))
        );
      }

      // If no courses loaded yet, try getting all enrollments directly
      if (allEnrollments.length === 0) {
        const allEnrolls = await enrollmentService.getEnrollments();
        // We'll need to fetch course titles separately
        const enrollmentsWithDetails = await Promise.all(
          allEnrolls.map(async (enrollment) => {
            const course = await courseService.getCourse(enrollment.courseId);
            return {
              ...enrollment,
              courseTitle: course?.title || "Unknown Course",
            };
          })
        );
        setEnrollments(enrollmentsWithDetails);
      } else {
        setEnrollments(allEnrollments);
      }
    } catch (error) {
      console.error("Error loading enrollments:", error);
      toast.error("Failed to load enrollments");
    } finally {
      setLoading(false);
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

  const handleStatusChange = async () => {
    if (!statusChangeDialog.enrollment || !statusChangeDialog.newStatus) return;

    try {
      await enrollmentService.updateEnrollment(statusChangeDialog.enrollment.id, {
        status: statusChangeDialog.newStatus,
      });
      toast.success("Enrollment status updated");
      setStatusChangeDialog({ open: false, enrollment: null, newStatus: null });
      loadEnrollments();
    } catch (error) {
      console.error("Error updating enrollment status:", error);
      toast.error("Failed to update enrollment status");
    }
  };

  const handleUnenroll = async () => {
    if (!unenrollId) return;

    try {
      await enrollmentService.unenroll(unenrollId, preserveProgress);
      toast.success(preserveProgress ? "Enrollment marked as dropped" : "User unenrolled successfully");
      setUnenrollId(null);
      setPreserveProgress(false);
      loadEnrollments();
    } catch (error) {
      console.error("Error unenrolling:", error);
      toast.error("Failed to unenroll user");
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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Enrollment Management</h1>
            <p className="text-muted-foreground mt-2">Manage course enrollments</p>
          </div>
          <Button onClick={() => {
            if (courses.length > 0) {
              setSelectedCourse(courses[0]);
              setBulkEnrollOpen(true);
            } else {
              toast.error("Please wait for courses to load");
            }
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Bulk Enroll
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by user or course..."
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

        {/* Enrollments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollments ({filteredEnrollments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading enrollments...</div>
            ) : filteredEnrollments.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No enrollments found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnrollments.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{enrollment.userName || "Unknown"}</div>
                          <div className="text-sm text-muted-foreground">{enrollment.userEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>{enrollment.courseTitle || "Unknown Course"}</TableCell>
                      <TableCell>{getStatusBadge(enrollment.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${enrollment.progress}%` }}
                            />
                          </div>
                          <span className="text-sm">{enrollment.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(enrollment.enrolledAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {enrollment.status === "enrolled" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setStatusChangeDialog({
                                  open: true,
                                  enrollment,
                                  newStatus: "in-progress",
                                })
                              }
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Resume
                            </Button>
                          )}
                          {enrollment.status === "in-progress" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setStatusChangeDialog({
                                  open: true,
                                  enrollment,
                                  newStatus: "enrolled",
                                })
                              }
                            >
                              <Pause className="w-4 h-4 mr-1" />
                              Pause
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setUnenrollId(enrollment.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bulk Enrollment Dialog */}
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

      {/* Status Change Dialog */}
      <Dialog
        open={statusChangeDialog.open}
        onOpenChange={(open) =>
          setStatusChangeDialog({ open, enrollment: null, newStatus: null })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Enrollment Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Change status from <strong>{statusChangeDialog.enrollment?.status}</strong> to{" "}
              <strong>{statusChangeDialog.newStatus}</strong>?
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setStatusChangeDialog({ open: false, enrollment: null, newStatus: null })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleStatusChange}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unenroll Confirmation Dialog */}
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
                onCheckedChange={(checked) => setPreserveProgress(checked === true)}
              />
              <Label htmlFor="preserve" className="cursor-pointer">
                Preserve progress (mark as dropped instead of deleting)
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenroll}
              className="bg-destructive text-destructive-foreground"
            >
              Unenroll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminEnrollments;

