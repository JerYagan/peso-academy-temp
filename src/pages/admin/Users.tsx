import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Mail, Search, Edit2, Shield, User as UserIcon, Settings, Plus, Loader2, Trash2 } from "lucide-react";
import { User, UserRole } from "@/types/auth";
import { userService } from "@/services/supabaseDatabaseService";
import { defaultRoleDisplayNames, getRoleDisplayName } from "@/lib/roles";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabaseAuthService } from "@/services/supabaseAuthService";
import { roleService, DatabaseRole } from "@/services/roleService";

const AdminUsers = () => {
  const { user: currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("trainee");
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "trainee",
  });
  const [availableRoles, setAvailableRoles] = useState<DatabaseRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  // Fetch available roles from database
  useEffect(() => {
    const loadRoles = async () => {
      try {
        setRolesLoading(true);
        console.log("🔄 Starting to load roles from database...");
        const roles = await roleService.getAllRoles();
        console.log("📋 Loaded roles from database:", {
          count: roles.length,
          roles: roles.map(r => ({ id: r.id, name: r.name, category: r.category }))
        });
        
        if (roles.length === 0) {
          console.warn("⚠️ No roles found in database! Using fallback roles.");
          toast.warning("No roles found in database. Using default roles.", {
            description: "Please add roles in the Roles management page.",
            duration: 5000,
          });
        } else {
          console.log("✅ Successfully loaded", roles.length, "roles from database");
        }
        
        setAvailableRoles(roles);
        
        // Set default role for new user if current role doesn't exist in database
        if (roles.length > 0) {
          const currentRoleExists = roles.find(r => r.id === newUser.role);
          if (!currentRoleExists) {
            // Try to find 'trainee' first, otherwise use first available role
            const defaultRole = roles.find(r => r.id === 'trainee') || roles[0];
            setNewUser(prev => ({ ...prev, role: defaultRole.id }));
          }
        }
      } catch (error: any) {
        console.error("❌ Error loading roles:", error);
        console.error("Error details:", {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
        });
        toast.error("Failed to load roles from database", {
          description: error?.message || "Check console for details. Using fallback roles.",
          duration: 5000,
        });
        // Don't set to empty array - keep fallback roles visible
        setAvailableRoles([]);
      } finally {
        setRolesLoading(false);
        console.log("🏁 Finished loading roles. Loading state:", false);
      }
    };
    
    loadRoles();
  }, []);

  // Fetch users from Supabase
  useEffect(() => {
    console.log("🔍 AdminUsers useEffect triggered", { 
      authLoading, 
      hasCurrentUser: !!currentUser,
      currentUserRole: currentUser?.role,
      currentUserId: currentUser?.id 
    });
    
    // Wait for auth to be ready before fetching users
    if (authLoading) {
      console.log("⏳ Auth still loading, waiting...");
      return;
    }
    
    if (!currentUser) {
      console.warn("⚠️ No current user, cannot fetch users");
      setLoading(false);
      return;
    }
    
    console.log("✅ Auth loaded, fetching users...", { 
      currentUser: {
        id: currentUser.id,
        email: currentUser.email,
        role: currentUser.role
      }, 
      authLoading 
    });
    
    // Small delay to ensure Supabase is ready after hot reload
    const timer = setTimeout(() => {
      console.log("🚀 Calling loadUsers()...");
      loadUsers();
    }, 100);
    
    return () => {
      console.log("🧹 Cleaning up timer");
      clearTimeout(timer);
    };
  }, [authLoading, currentUser]);

  // Filter users based on search and role
  useEffect(() => {
    let filtered = users;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by role
    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter]);

  const loadUsers = async (retryCount = 0) => {
    try {
      setLoading(true);
      console.log(`Loading users (attempt ${retryCount + 1})...`);
      
      // Wait a bit if retrying (for hot reload scenarios)
      if (retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
      }
      
      console.log("Calling userService.getAllUsers()...");
      const allUsers = await userService.getAllUsers();
      console.log("Received users:", allUsers.length, allUsers);
      
      // If we got an empty array and we're retrying, it might be a timing issue
      if (allUsers.length === 0 && retryCount < 2) {
        console.warn(`No users found, retrying... (attempt ${retryCount + 1})`);
        return loadUsers(retryCount + 1);
      }
      
      // Filter out specific user
      const filteredUsers = allUsers.filter(
        (user) => user.email.toLowerCase() !== "zyrusinso@gmail.com"
      );
      setUsers(filteredUsers);
      setFilteredUsers(filteredUsers);
    } catch (error: any) {
      console.error("Error loading users:", error);
      console.error("Error details:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      
      // Retry on error if we haven't retried too many times
      if (retryCount < 2) {
        console.warn(`Error loading users, retrying... (attempt ${retryCount + 1})`);
        return loadUsers(retryCount + 1);
      }
      
      // Show more detailed error message
      const errorMessage = error?.message || "Failed to load users";
      const errorHint = error?.hint || "";
      toast.error(errorMessage, {
        description: errorHint || "Please check your permissions and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = async () => {
    if (!editingUser) return;

    try {
      // Cast to UserRole for type safety (database will validate)
      await userService.updateUser(editingUser.id, { role: selectedRole as UserRole });
      toast.success(`Role updated to ${getRoleDisplayName(selectedRole)}`);
      setIsRoleDialogOpen(false);
      setEditingUser(null);
      loadUsers();
      
      // If editing current user's role, reload the page to update auth context
      if (editingUser.id === currentUser?.id) {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  const handleEditUser = async (updates: Partial<User>) => {
    if (!editingUser) return;

    try {
      await userService.updateUser(editingUser.id, updates);
      toast.success("User updated successfully");
      setIsEditDialogOpen(false);
      setEditingUser(null);
      loadUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    }
  };

  const openRoleDialog = async (user: User) => {
    console.log("🔓 Opening role dialog for user:", user);
    
    // Force refresh roles if they're empty or incomplete (we know there are 7 roles in DB)
    if ((availableRoles.length === 0 || availableRoles.length < 5) && !rolesLoading) {
      console.log("⚠️ No roles loaded, refreshing...");
      try {
        setRolesLoading(true);
        const roles = await roleService.getAllRoles();
        console.log("📋 Refreshed roles:", {
          count: roles.length,
          roles: roles.map(r => ({ id: r.id, name: r.name }))
        });
        setAvailableRoles(roles);
      } catch (error) {
        console.error("Error refreshing roles:", error);
      } finally {
        setRolesLoading(false);
      }
    }
    
    console.log("📋 Available roles at dialog open:", {
      count: availableRoles.length,
      roles: availableRoles.map(r => ({ id: r.id, name: r.name })),
      allRoles,
      rolesLoading
    });
    setEditingUser(user);
    // Only admin and training_officer are assignable; default to training_officer if current role isn't one of them
    const assignable = user.role === "admin" || user.role === "training_officer";
    setSelectedRole(assignable ? user.role : "training_officer");
    setIsRoleDialogOpen(true);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (user: User) => {
    setDeletingUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    // Prevent deleting yourself
    if (deletingUser.id === currentUser?.id) {
      toast.error("You cannot delete your own account");
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
      return;
    }

    try {
      setDeleting(true);
      const result = await userService.deleteUser(deletingUser.id);

      if (result.error) {
        console.error("Error deleting user:", result.error);
        toast.error(result.error.message || "Failed to delete user");
        setDeleting(false);
        return;
      }

      toast.success(`User "${deletingUser.name}" deleted successfully`);
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
      loadUsers(); // Refresh the user list
      setDeleting(false);
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
      setDeleting(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setCreating(true);
      console.log("Starting user creation for:", newUser.email);
      
      const result = await supabaseAuthService.signup(
        newUser.email,
        newUser.password,
        newUser.name,
        newUser.role as UserRole
      );

      console.log("User creation result:", { 
        hasUser: !!result.user, 
        hasError: !!result.error,
        userId: result.user?.id,
        errorMessage: result.error?.message 
      });

      if (result.error) {
        console.error("User creation error:", result.error);
        console.error("Full error object:", JSON.stringify(result.error, null, 2));
        // Show more detailed error message
        const errorMsg = result.error.message || "Failed to create user";
        toast.error(errorMsg, {
          description: result.error instanceof Error ? result.error.stack : undefined,
          duration: 5000,
        });
        setCreating(false);
        return;
      }

      if (result.user) {
        console.log("User created successfully:", result.user.id);
        toast.success(`User "${newUser.name}" created successfully`);
        setIsCreateDialogOpen(false);
        setNewUser({
          name: "",
          email: "",
          password: "",
          role: "trainee",
        });
        loadUsers();
        setCreating(false);
        return;
      }

      // Fallback: If no error but also no user, something unexpected happened
      console.warn("User creation returned no error but also no user:", result);
      toast.error("User creation completed but no user data was returned. Please refresh and check if the user was created.");
      setCreating(false);
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error("Failed to create user");
      setCreating(false);
    }
  };

  // Calculate statistics
  const stats = {
    total: users.length,
    byRole: users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<UserRole, number>),
  };

  // Get roles dynamically from database, fallback to default if empty
  // Map database role IDs to UserRole type (allows any string from database)
  // IMPORTANT: Only use fallback if roles have finished loading AND are still empty
  const allRoles: string[] = availableRoles.length > 0
    ? availableRoles.map(r => r.id)
    : ['admin', 'training_officer', 'validator', 'trainee']; // Fallback if no roles loaded
  
  // Debug: Log roles for troubleshooting (log when roles change)
  useEffect(() => {
    console.log("🔍 Roles Debug (State Change):", {
      availableRolesCount: availableRoles.length,
      availableRoles: availableRoles.map(r => ({ id: r.id, name: r.name })),
      allRoles,
      rolesLoading,
      willUseFallback: availableRoles.length === 0,
      timestamp: new Date().toISOString()
    });
  }, [availableRoles.length, rolesLoading]); // Only log when roles count or loading state changes
  
  // Get role display name (from database or fallback)
  const getRoleDisplayName = (roleId: string): string => {
    const dbRole = availableRoles.find(r => r.id === roleId);
    if (dbRole) return dbRole.name;
    // Fallback to default display names
    return defaultRoleDisplayNames[roleId as UserRole] || roleId;
  };

  // Only Administrator and Training Officer can be assigned in Change Role dialog
  const assignableRolesForChange = allRoles.filter(
    (r) => r === "admin" || r === "training_officer"
  );

  // Account status for list (extend with last_activity when available for "Inactive X months ago")
  const getAccountStatusLabel = (_createdAt: string): string => {
    return "Active";
  };

  // Debug: Log render state
  console.log("🎨 AdminUsers render", { 
    loading, 
    usersCount: users.length, 
    filteredCount: filteredUsers.length,
    authLoading,
    hasCurrentUser: !!currentUser,
    currentUserRole: currentUser?.role
  });

  return (
    <DashboardLayout>
      {/* Loading overlay during user creation to prevent redirects/glitches */}
      {creating && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">Creating user account...</p>
              <p className="text-sm text-muted-foreground mt-2">Please wait, this will only take a moment.</p>
            </CardContent>
          </Card>
        </div>
      )}
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">Manage all platform users and roles</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button
              onClick={() => {
                setNewUser({
                  name: "",
                  email: "",
                  password: "",
                  role: "trainee",
                });
                setIsCreateDialogOpen(true);
              }}
              className="gap-2 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create User</span>
              <span className="sm:hidden">Create</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/roles")}
              className="gap-2 w-full sm:w-auto"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Manage Roles</span>
              <span className="sm:hidden">Roles</span>
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Registered users</p>
            </CardContent>
          </Card>

          {allRoles.map((role) => (
            <Card key={role}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{getRoleDisplayName(role)}</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.byRole[role] || 0}</div>
                <p className="text-xs text-muted-foreground">Users with this role</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search and Filter */}
        <Card>
          <CardHeader>
            <CardTitle>All Users ({filteredUsers.length})</CardTitle>
            <CardDescription>Search and filter users by name, email, or role</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {allRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {getRoleDisplayName(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No users found</p>
                <p className="text-sm text-muted-foreground">
                  {currentUser?.role === 'admin' 
                    ? 'This might be an RLS policy issue. Check console for errors.'
                    : 'You may not have permission to view users.'}
                </p>
                <Button 
                  onClick={() => loadUsers()} 
                  variant="outline" 
                  className="mt-4"
                >
                  Retry Loading
                </Button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No users match your filters</p>
                <Button 
                  onClick={() => {
                    setSearchTerm("");
                    setRoleFilter("all");
                  }} 
                  variant="outline" 
                  className="mt-4"
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Account status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              {user.avatar ? (
                                <img
                                  src={user.avatar}
                                  alt={user.name}
                                  className="w-10 h-10 rounded-full"
                                />
                              ) : (
                                <UserIcon className="w-5 h-5 text-primary" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{user.name}</p>
                              {user.id === currentUser?.id && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  You
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {getRoleDisplayName(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {getAccountStatusLabel(user.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {user.role !== "trainee" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openRoleDialog(user)}
                                className="gap-2"
                              >
                                <Shield className="w-4 h-4" />
                                Change Role
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(user)}
                              className="gap-2"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteDialog(user)}
                              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={user.id === currentUser?.id}
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Role Dialog */}
        <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change User Role</DialogTitle>
              <DialogDescription>
                Change the role for {editingUser?.name}. This will affect their access permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Current Role</Label>
                <div>
                  <Badge variant="secondary">{editingUser && getRoleDisplayName(editingUser.role)}</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">New Role</Label>
                {rolesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading roles...
                  </div>
                ) : (
                  <Select 
                    value={selectedRole} 
                    onValueChange={(value) => {
                      console.log("🔄 Role changed:", value);
                      setSelectedRole(value);
                    }}
                    key={`role-select-${availableRoles.length}-${allRoles.join(',')}`} // Force re-render when roles change
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent key={`role-content-${assignableRolesForChange.length}`}>
                      {assignableRolesForChange.length === 0 ? (
                        <SelectItem value="" disabled>No roles available</SelectItem>
                      ) : (
                        assignableRolesForChange.map((role) => (
                          <SelectItem key={role} value={role}>
                            {getRoleDisplayName(role)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditRole} disabled={selectedRole === editingUser?.role}>
                Update Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user information for {editingUser?.name}</DialogDescription>
            </DialogHeader>
            {editingUser && (
              <EditUserForm
                user={editingUser}
                onSave={handleEditUser}
                onCancel={() => {
                  setIsEditDialogOpen(false);
                  setEditingUser(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Create User Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Create a new user account. The user will be able to log in with the provided credentials.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Full Name *</Label>
                <Input
                  id="new-name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">Email *</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Password *</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Role *</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: string) => setNewUser({ ...newUser, role: value })}
                >
                  <SelectTrigger id="new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {getRoleDisplayName(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setNewUser({
                    name: "",
                    email: "",
                    password: "",
                    role: "trainee",
                  });
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateUser} disabled={creating}>
                {creating ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {deletingUser?.name} ({deletingUser?.email})? 
                This action cannot be undone and will permanently delete the user account and all associated data.
              </DialogDescription>
            </DialogHeader>
            {deletingUser?.id === currentUser?.id && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                You cannot delete your own account.
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setDeletingUser(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteUser}
                disabled={deleting || deletingUser?.id === currentUser?.id}
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete User
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

// Edit User Form Component
const EditUserForm = ({
  user,
  onSave,
  onCancel,
}: {
  user: User;
  onSave: (updates: Partial<User>) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [address, setAddress] = useState(user.address || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      phone: phone || undefined,
      address: address || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} disabled />
          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+63 912 345 6789"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="City, Province, Philippines"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save Changes</Button>
      </div>
    </form>
  );
};

export default AdminUsers;
