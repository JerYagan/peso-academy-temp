import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield,
  Users,
  CheckCircle,
  GraduationCap,
  Briefcase,
  FolderKanban,
  User,
  Eye,
  Edit,
  Save,
  X,
  Loader2,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  roleService,
  DatabaseRole,
  DatabasePermission,
  RoleWithPermissions,
} from "@/services/roleService";
import { getAllRoles, getRolePermissions, PERMISSIONS } from "@/lib/roleConfig";
import { refreshDashboardRoutes } from "@/lib/roles";
import { normalizeUserRole } from "@/types/auth";
import { toast } from "sonner";

const roleIcons: Record<string, any> = {
  Shield,
  CheckCircle,
  GraduationCap,
  Briefcase,
  FolderKanban,
  User,
};

const roleColors: Record<string, string> = {
  red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

// Only these 3 roles are shown: Internal = admin + trainer, End User = trainee
const FIXED_ROLE_IDS = ["admin", "trainer", "trainee"] as const;
const FIXED_ROLE_ICON: Record<string, keyof typeof roleIcons> = {
  admin: "Shield",
  trainer: "GraduationCap",
  trainee: "User",
};
const FIXED_ROLE_COLOR: Record<string, keyof typeof roleColors> = {
  admin: "blue",
  trainer: "gray",
  trainee: "green",
};

const normalizeRoleRecord = (role: DatabaseRole): DatabaseRole => ({
  ...role,
  id: normalizeUserRole(role.id),
  name: normalizeUserRole(role.id) === "trainer" ? "Trainer" : normalizeUserRole(role.id) === "trainee" ? "Trainee" : role.name,
  dashboard_route: normalizeUserRole(role.id) === "admin" ? "/admin/dashboard" : normalizeUserRole(role.id) === "trainer" ? "/trainer/dashboard" : "/dashboard",
  can_signup: normalizeUserRole(role.id) === "trainee",
});

const AdminRoles = () => {
  const [roles, setRoles] = useState<DatabaseRole[]>([]);
  const [permissions, setPermissions] = useState<DatabasePermission[]>([]);
  const [permissionsByCategory, setPermissionsByCategory] = useState<Record<string, DatabasePermission[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<DatabaseRole | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  
  // Form state for create/edit role
  const [roleForm, setRoleForm] = useState<{
    id: string;
    name: string;
    description: string;
    category: "internal" | "end_user";
    icon: string;
    color: string;
    dashboard_route: string;
    can_signup: boolean;
    metadata: Record<string, any> | null;
  }>({
    id: "",
    name: "",
    description: "",
    category: "end_user",
    icon: "User",
    color: "gray",
    dashboard_route: "/dashboard",
    can_signup: false,
    metadata: null,
  });

  // Load data from database
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rolesData, permissionsData, groupedPermissions] = await Promise.all([
        roleService.getAllRoles(),
        roleService.getAllPermissions(),
        roleService.getPermissionsByCategory(),
      ]);

      // Check if database tables are empty (not set up yet)
      if (rolesData.length === 0 || permissionsData.length === 0) {
        console.warn("Database tables empty. Using config fallback.");
        // Use config fallback
        const configRoles = getAllRoles();
        const configPerms = Object.values(PERMISSIONS);
        
        setRoles(configRoles.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          category: r.category,
          icon: r.icon || null,
          color: r.color || null,
          dashboard_route: r.dashboardRoute,
          can_signup: r.canSignup,
          metadata: r.metadata || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })));
        
        setPermissions(configPerms.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.id.split(".")[0] || "system",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })));
        
        // Group config permissions
        const grouped: Record<string, DatabasePermission[]> = {};
        configPerms.forEach((perm) => {
          const category = perm.id.split(".")[0] || "system";
          if (!grouped[category]) grouped[category] = [];
          grouped[category].push({
            id: perm.id,
            name: perm.name,
            description: perm.description,
            category,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        });
        setPermissionsByCategory(grouped);
      } else {
        const normalizedRoles = Array.from(
          new Map(
            rolesData.map((role) => {
              const normalizedRole = normalizeRoleRecord(role);
              return [normalizedRole.id, normalizedRole];
            }),
          ).values(),
        );

        setRoles(normalizedRoles);
        setPermissions(permissionsData);
        setPermissionsByCategory(groupedPermissions);
      }
    } catch (error) {
      console.error("Error loading roles and permissions:", error);
      toast.error("Failed to load from database. Using config fallback.");
      // Fallback to config-based roles and permissions
      const configRoles = getAllRoles();
      const configPerms = Object.values(PERMISSIONS);
      
      setRoles(configRoles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category,
        icon: r.icon || null,
        color: r.color || null,
        dashboard_route: r.dashboardRoute,
        can_signup: r.canSignup,
        metadata: r.metadata || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })));
      
      setPermissions(configPerms.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.id.split(".")[0] || "system",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })));
      
      // Group config permissions by category
      const grouped: Record<string, DatabasePermission[]> = {};
      configPerms.forEach((perm) => {
        const category = perm.id.split(".")[0] || "system";
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push({
          id: perm.id,
          name: perm.name,
          description: perm.description,
          category,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });
      setPermissionsByCategory(grouped);
    } finally {
      setLoading(false);
    }
  };

  const viewRolePermissions = async (role: DatabaseRole) => {
    try {
      const roleWithPerms = await roleService.getRoleWithPermissions(role.id);
      if (roleWithPerms) {
        setSelectedRole(roleWithPerms);
        setSelectedPermissions(new Set(roleWithPerms.permissions.map((p) => p.id)));
        setIsPermissionDialogOpen(true);
      }
    } catch (error) {
      console.error("Error loading role permissions:", error);
      toast.error("Failed to load role permissions");
    }
  };

  const editRolePermissions = async (role: DatabaseRole) => {
    try {
      const roleWithPerms = await roleService.getRoleWithPermissions(role.id);
      if (roleWithPerms) {
        setSelectedRole(roleWithPerms);
        setSelectedPermissions(new Set(roleWithPerms.permissions.map((p) => p.id)));
        setIsEditDialogOpen(true);
      }
    } catch (error) {
      console.error("Error loading role permissions:", error);
      toast.error("Failed to load role permissions");
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;

    // Check if we're using database (permissions loaded from DB)
    if (permissions.length === 0 || roles.length === 0) {
      toast.error("Database tables not set up. Please run the SQL migration first.");
      return;
    }

    try {
      setSaving(true);
      await roleService.updateRolePermissions(
        selectedRole.id,
        Array.from(selectedPermissions)
      );
      toast.success(`Permissions updated for ${selectedRole.name}`);
      setIsEditDialogOpen(false);
      setSelectedRole(null);
      loadData(); // Reload to refresh data
    } catch (error: any) {
      console.error("Error updating permissions:", error);
      const errorMsg = error?.message || "Failed to update permissions";
      if (errorMsg.includes("relation") || errorMsg.includes("does not exist")) {
        toast.error("Database tables not set up. Please run the SQL migration first.");
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setSaving(false);
    }
  };

  // Only 3 fixed roles: Internal = admin + trainer, End User = trainee
  const fixedRoles = roles.filter((r) => FIXED_ROLE_IDS.includes(r.id as any));
  const internalRoles = fixedRoles.filter((r) => r.category === "internal"); // admin, trainer
  const endUserRoles = fixedRoles.filter((r) => r.category === "end_user"); // trainee

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading roles and permissions...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
            <h1 className="text-3xl font-bold">Role Management</h1>
            <p className="text-muted-foreground mt-2">
              View and manage system roles, permissions, and access controls
            </p>
          </div>

        {/* Statistics - aligned with tabs: Total 3, Internal 2, End Users 1 */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fixedRoles.length}</div>
              <p className="text-xs text-muted-foreground">System roles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Internal Roles</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{internalRoles.length}</div>
              <p className="text-xs text-muted-foreground">Trainer, Administrator</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">End User Roles</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{endUserRoles.length}</div>
              <p className="text-xs text-muted-foreground">Trainee only</p>
            </CardContent>
          </Card>
        </div>

        {/* Roles Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Roles</CardTitle>
            <CardDescription>System roles with their permissions and configurations</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList>
                <TabsTrigger value="all">All Roles</TabsTrigger>
                <TabsTrigger value="internal">Internal</TabsTrigger>
                <TabsTrigger value="end_user">End Users</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <RolesTable
                  roles={fixedRoles}
                  onViewPermissions={viewRolePermissions}
                />
              </TabsContent>

              <TabsContent value="internal" className="mt-4">
                <RolesTable
                  roles={internalRoles}
                  onViewPermissions={viewRolePermissions}
                />
              </TabsContent>

              <TabsContent value="end_user" className="mt-4">
                <RolesTable
                  roles={endUserRoles}
                  onViewPermissions={viewRolePermissions}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* View Permissions Dialog */}
        <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedRole?.name} - Permissions</DialogTitle>
              <DialogDescription>{selectedRole?.description}</DialogDescription>
            </DialogHeader>
            {selectedRole && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Role Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <Badge variant="secondary">
                        {selectedRole.category === "internal" ? "Internal User" : "End User"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dashboard Route:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {selectedRole.dashboard_route}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Public Signup:</span>
                      <Badge variant={selectedRole.can_signup ? "default" : "secondary"}>
                        {selectedRole.can_signup ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">
                    Permissions ({selectedRole.permissions.length})
                  </h4>
                  <div className="grid gap-2">
                    {selectedRole.permissions.map((permission) => (
                      <div
                        key={permission.id}
                        className="flex items-start gap-3 p-3 border rounded-lg"
                      >
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{permission.name}</p>
                          <p className="text-xs text-muted-foreground">{permission.description}</p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {permission.category}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Permissions Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Edit Permissions - {selectedRole?.name}</DialogTitle>
              <DialogDescription>
                Select the permissions for this role. Changes will be saved immediately.
              </DialogDescription>
            </DialogHeader>
            {selectedRole && (
              <div className="space-y-4">
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-6">
                    {Object.entries(permissionsByCategory)
                      .filter(([category]) => category !== "jobs")
                      .map(([category, categoryPermissions]) => (
                      <div key={category}>
                        <h4 className="font-semibold mb-3 capitalize">{category} Permissions</h4>
                        <div className="space-y-3">
                          {categoryPermissions.map((permission) => (
                            <div
                              key={permission.id}
                              className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <Checkbox
                                id={permission.id}
                                checked={selectedPermissions.has(permission.id)}
                                onCheckedChange={() => handlePermissionToggle(permission.id)}
                                className="mt-1"
                              />
                              <Label
                                htmlFor={permission.id}
                                className="flex-1 cursor-pointer"
                              >
                                <div>
                                  <p className="font-medium text-sm">{permission.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {permission.description}
                                  </p>
                                </div>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="text-sm text-muted-foreground">
                  Selected: {selectedPermissions.size} of {permissions.length} permissions
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setSelectedRole(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSavePermissions} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Permissions
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Role Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>
                Create a new role with custom permissions and settings
              </DialogDescription>
            </DialogHeader>
            <RoleForm
              formData={roleForm}
              onChange={setRoleForm}
              permissions={permissions}
              permissionsByCategory={permissionsByCategory}
              selectedPermissions={selectedPermissions}
              onPermissionToggle={handlePermissionToggle}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setRoleForm({
                    id: "",
                    name: "",
                    description: "",
                    category: "end_user",
                    icon: "User",
                    color: "gray",
                    dashboard_route: "/dashboard",
                    can_signup: false,
                    metadata: null,
                  });
                  setSelectedPermissions(new Set());
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!roleForm.id || !roleForm.name) {
                    toast.error("Role ID and Name are required");
                    return;
                  }
                  try {
                    setSaving(true);
                    await roleService.createRole(roleForm);
                    await roleService.updateRolePermissions(
                      roleForm.id,
                      Array.from(selectedPermissions)
                    );
                    // Refresh dashboard routes cache when role is created
                    await refreshDashboardRoutes();
                    toast.success(`Role "${roleForm.name}" created successfully`);
                    setIsCreateDialogOpen(false);
                    setRoleForm({
                      id: "",
                      name: "",
                      description: "",
                      category: "end_user",
                      icon: "User",
                      color: "gray",
                      dashboard_route: "/dashboard",
                      can_signup: false,
                      metadata: null,
                    });
                    setSelectedPermissions(new Set());
                    loadData();
                  } catch (error: any) {
                    console.error("Error creating role:", error);
                    toast.error(error?.message || "Failed to create role");
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Role
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Role Dialog */}
        <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Role</DialogTitle>
              <DialogDescription>
                Update role details and permissions
              </DialogDescription>
            </DialogHeader>
            <RoleForm
              formData={roleForm}
              onChange={setRoleForm}
              permissions={permissions}
              permissionsByCategory={permissionsByCategory}
              selectedPermissions={selectedPermissions}
              onPermissionToggle={handlePermissionToggle}
              isEdit={true}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditRoleDialogOpen(false);
                  setSelectedRole(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!roleForm.id || !roleForm.name) {
                    toast.error("Role ID and Name are required");
                    return;
                  }
                  try {
                    setSaving(true);
                    await roleService.updateRole(roleForm.id, roleForm);
                    await roleService.updateRolePermissions(
                      roleForm.id,
                      Array.from(selectedPermissions)
                    );
                    // Refresh dashboard routes cache when role is updated
                    await refreshDashboardRoutes();
                    toast.success(`Role "${roleForm.name}" updated successfully`);
                    setIsEditRoleDialogOpen(false);
                    setRoleForm({
                      id: "",
                      name: "",
                      description: "",
                      category: "end_user",
                      icon: "User",
                      color: "gray",
                      dashboard_route: "/dashboard",
                      can_signup: false,
                      metadata: null,
                    });
                    setSelectedPermissions(new Set());
                    loadData();
                  } catch (error: any) {
                    console.error("Error updating role:", error);
                    toast.error(error?.message || "Failed to update role");
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Role Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Role</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the role "{roleToDelete?.name}"? This action cannot be undone.
                <br />
                <br />
                <strong className="text-destructive">
                  Warning: Users with this role will need to be reassigned before deletion.
                </strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!roleToDelete) return;
                  try {
                    setSaving(true);
                    await roleService.deleteRole(roleToDelete.id);
                    // Refresh dashboard routes cache when role is deleted
                    await refreshDashboardRoutes();
                    toast.success(`Role "${roleToDelete.name}" deleted successfully`);
                    setIsDeleteDialogOpen(false);
                    setRoleToDelete(null);
                    loadData();
                  } catch (error: any) {
                    console.error("Error deleting role:", error);
                    toast.error(error?.message || "Failed to delete role");
                  } finally {
                    setSaving(false);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Role"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

interface RoleFormProps {
  formData: {
    id: string;
    name: string;
    description: string;
    category: "internal" | "end_user";
    icon: string;
    color: string;
    dashboard_route: string;
    can_signup: boolean;
    metadata: Record<string, any> | null;
  };
  onChange: (data: RoleFormProps["formData"]) => void;
  permissions: DatabasePermission[];
  permissionsByCategory: Record<string, DatabasePermission[]>;
  selectedPermissions: Set<string>;
  onPermissionToggle: (permissionId: string) => void;
  isEdit?: boolean;
}

const RoleForm = ({
  formData,
  onChange,
  permissions,
  permissionsByCategory,
  selectedPermissions,
  onPermissionToggle,
  isEdit = false,
}: RoleFormProps) => {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="role-id">Role ID *</Label>
          <Input
            id="role-id"
            value={formData.id}
            onChange={(e) => onChange({ ...formData, id: e.target.value })}
            placeholder="e.g., moderator"
            disabled={isEdit}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Unique identifier (lowercase, no spaces)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="role-name">Role Name *</Label>
          <Input
            id="role-name"
            value={formData.name}
            onChange={(e) => onChange({ ...formData, name: e.target.value })}
            placeholder="e.g., Moderator"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role-description">Description</Label>
        <Textarea
          id="role-description"
          value={formData.description}
          onChange={(e) => onChange({ ...formData, description: e.target.value })}
          placeholder="Describe the role's purpose and responsibilities"
          rows={3}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="role-category">Category</Label>
          <Select
            value={formData.category}
            onValueChange={(value: "internal" | "end_user") =>
              onChange({ ...formData, category: value })
            }
          >
            <SelectTrigger id="role-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Internal User</SelectItem>
              <SelectItem value="end_user">End User</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="role-icon">Icon</Label>
          <Select
            value={formData.icon}
            onValueChange={(value) => onChange({ ...formData, icon: value })}
          >
            <SelectTrigger id="role-icon">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Shield">Shield</SelectItem>
              <SelectItem value="User">User</SelectItem>
              <SelectItem value="Users">Users</SelectItem>
              <SelectItem value="CheckCircle">CheckCircle</SelectItem>
              <SelectItem value="GraduationCap">GraduationCap</SelectItem>
              <SelectItem value="Briefcase">Briefcase</SelectItem>
              <SelectItem value="FolderKanban">FolderKanban</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="role-color">Color</Label>
          <Select
            value={formData.color}
            onValueChange={(value) => onChange({ ...formData, color: value })}
          >
            <SelectTrigger id="role-color">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="red">Red</SelectItem>
              <SelectItem value="blue">Blue</SelectItem>
              <SelectItem value="green">Green</SelectItem>
              <SelectItem value="purple">Purple</SelectItem>
              <SelectItem value="orange">Orange</SelectItem>
              <SelectItem value="gray">Gray</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="role-signup">Public Signup</Label>
          <Select
            value={formData.can_signup ? "yes" : "no"}
            onValueChange={(value) =>
              onChange({ ...formData, can_signup: value === "yes" })
            }
          >
            <SelectTrigger id="role-signup">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role-route">Dashboard Route</Label>
        <Input
          id="role-route"
          value={formData.dashboard_route}
          onChange={(e) => onChange({ ...formData, dashboard_route: e.target.value })}
          placeholder="/dashboard"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Route users with this role will be redirected to
        </p>
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label>Permissions</Label>
          <Badge variant="outline">
            {selectedPermissions.size} of {permissions.length} selected
          </Badge>
        </div>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-6">
            {Object.entries(permissionsByCategory)
              .filter(([category]) => category !== "jobs")
              .map(([category, categoryPermissions]) => (
              <div key={category}>
                <h4 className="font-semibold mb-3 capitalize">{category} Permissions</h4>
                <div className="space-y-3">
                  {categoryPermissions.map((permission) => (
                    <div
                      key={permission.id}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={`perm-${permission.id}`}
                        checked={selectedPermissions.has(permission.id)}
                        onCheckedChange={() => onPermissionToggle(permission.id)}
                        className="mt-1"
                      />
                      <Label
                        htmlFor={`perm-${permission.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div>
                          <p className="font-medium text-sm">{permission.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {permission.description}
                          </p>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

interface RolesTableProps {
  roles: DatabaseRole[];
  onViewPermissions: (role: DatabaseRole) => void;
}

const RolesTable = ({ roles, onViewPermissions }: RolesTableProps) => {
  const [rolePermissionCounts, setRolePermissionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadCounts = async () => {
      const counts: Record<string, number> = {};
      for (const role of roles) {
        try {
          const perms = await roleService.getRolePermissions(role.id);
          counts[role.id] = perms.length;
        } catch (error) {
          counts[role.id] = 0;
        }
      }
      setRolePermissionCounts(counts);
    };
    loadCounts();
  }, [roles]);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead>Signup</TableHead>
            <TableHead>Dashboard</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => {
            const iconKey = FIXED_ROLE_ICON[role.id] || "User";
            const colorKey = FIXED_ROLE_COLOR[role.id] || "gray";
            const IconComponent = roleIcons[iconKey] || User;
            const colorClass = roleColors[colorKey] || roleColors.gray;
            const isEndUser = role.category === "end_user";
            const signupLabel = isEndUser ? "Yes" : "No";

            return (
              <TableRow key={role.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center`}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">{role.name}</p>
                      <p className="text-xs text-muted-foreground">{role.id}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={role.category === "internal" ? "default" : "secondary"}>
                    {role.category === "internal" ? "Internal" : "End User"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {rolePermissionCounts[role.id] ?? "..."} permissions
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={signupLabel === "Yes" ? "default" : "outline"}>
                    {signupLabel}
                  </Badge>
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{role.dashboard_route}</code>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewPermissions(role)}
                    className="gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default AdminRoles;
