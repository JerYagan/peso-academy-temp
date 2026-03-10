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
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Plus, Search, Trash2 } from "lucide-react";
import { Enrollment, Course } from "@/types";
import { enrollmentService, courseService } from "@/services/supabaseDatabaseService";
import { BulkEnrollmentDialog } from "@/components/enrollment/BulkEnrollmentDialog";
import { toast } from "sonner";

type EnrollmentWithDetails = Enrollment & {
  userName?: string;
  userEmail?: string;
  courseTitle?: string;
  lastActivityAt?: string;
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
                    <TableHead>Last Active</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnrollments.map((enrollment) => {
                    const lastActive = getLastActiveLabel(enrollment.lastActivityAt || enrollment.enrolledAt);
                    return (
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
                          <span className={lastActive.color}>{lastActive.text}</span>
                        </TableCell>
                        <TableCell>
                          {new Date(enrollment.enrolledAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setUnenrollId(enrollment.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

