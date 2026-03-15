import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Users, CheckCircle2, XCircle } from "lucide-react";
import { Course, User } from "@/types";
import { enrollmentService } from "@/services/supabaseDatabaseService";
import { userService } from "@/services/supabaseDatabaseService";
import { toast } from "sonner";

interface BulkEnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course;
  onSuccess?: () => void;
}

export const BulkEnrollmentDialog = ({
  open,
  onOpenChange,
  course,
  onSuccess,
}: BulkEnrollmentDialogProps) => {
  const [users, setUsers] = useState<Array<User & { selected?: boolean }>>([]);
  const [filteredUsers, setFilteredUsers] = useState<Array<User & { selected?: boolean }>>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [submissionErrors, setSubmissionErrors] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSubmissionErrors([]);
      loadUsers();
    }
  }, [open]);

  useEffect(() => {
    // Filter users based on search term
    if (searchTerm.trim()) {
      const filtered = users.filter(
        (user) =>
          user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchTerm, users]);

  useEffect(() => {
    const count = users.filter((u) => u.selected).length;
    setSelectedCount(count);
  }, [users]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const allUsers = await userService.getAllUsers();
      // Filter out users who are already enrolled (we'll check this later)
      setUsers(allUsers.map((u) => ({ ...u, selected: false })));
      setFilteredUsers(allUsers.map((u) => ({ ...u, selected: false })));
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId ? { ...user, selected: !user.selected } : user
      )
    );
  };

  const selectAll = () => {
    const allSelected = filteredUsers.every((u) => u.selected);
    setUsers((prev) =>
      prev.map((user) => {
        const filteredUser = filteredUsers.find((u) => u.id === user.id);
        return filteredUser
          ? { ...user, selected: !allSelected }
          : user;
      })
    );
  };

  const handleBulkEnroll = async () => {
    const selectedUserIds = users.filter((u) => u.selected).map((u) => u.id);

    if (selectedUserIds.length === 0) {
      toast.error("Please select at least one user");
      return;
    }

    setEnrolling(true);
    setSubmissionErrors([]);
    try {
      const result = await enrollmentService.bulkEnroll(selectedUserIds, course.id);
      setSubmissionErrors(result.errors);
      
      if (result.success > 0) {
        toast.success(`Successfully enrolled ${result.success} user(s)`);
        if (result.failed > 0) {
          toast.warning(`${result.failed} user(s) were blocked, already enrolled, or failed validation`);
        }
        onSuccess?.();
      } else {
        toast.error("Failed to enroll users: " + result.errors.join(", "));
      }
    } catch (error) {
      console.error("Error bulk enrolling:", error);
      toast.error("Failed to enroll users");
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Enroll Users - {course.title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <Label>Search Users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or email..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Selection Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {selectedCount} selected
              </Badge>
              <Badge variant="secondary">
                {filteredUsers.length} users
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={selectAll}>
              {filteredUsers.every((u) => u.selected) ? "Deselect All" : "Select All"}
            </Button>
          </div>

          {submissionErrors.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Enrollment issues</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {submissionErrors.map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Users List */}
          <ScrollArea className="flex-1 border rounded-lg">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No users found</div>
            ) : (
              <div className="divide-y">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleUserSelection(user.id)}
                  >
                    <Checkbox
                      checked={user.selected || false}
                      onCheckedChange={() => toggleUserSelection(user.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{user.name || "No name"}</div>
                      <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {user.role ? (
                          <Badge variant="outline" className="text-xs">
                            {user.role}
                          </Badge>
                        ) : null}
                        {user.traineeType ? (
                          <Badge variant="secondary" className="text-xs">
                            {user.traineeType === "peso_client" ? "PESO Client" : "PESO Employee"}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    {user.selected && (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkEnroll}
            disabled={enrolling || selectedCount === 0}
          >
            {enrolling ? (
              "Enrolling..."
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                Enroll {selectedCount} User{selectedCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

