"use client";

import * as React from "react";
import { useState } from "react";
import { PlusCircle, MoreHorizontal, Edit, Trash2, UserCheck, Users, Shield, Eye, EyeOff, Key, Search, X } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogTrigger,
} from "@/components/ui/modern-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useUsers, useCreateStaffAccount, useCreateParentAccount, useCreateBulkParentAccounts, useUpdateUser, useDeleteUser } from "@/lib/hooks/use-users";
import { useStaff } from "@/lib/hooks/use-staff";
import { usePupils } from "@/lib/hooks/use-pupils";
import { useActiveAccessLevels } from "@/lib/hooks/use-access-levels";
import { useRecordSignatures } from "@/lib/hooks/use-digital-signature";
import { AccessLevelsService } from "@/lib/services/access-levels.service";
import { DigitalSignatureDisplay } from "@/components/common/digital-signature-display";
import { UserSignatureDisplay } from "@/components/users/UserSignatureDisplay";
import type { SystemUser, ModulePermission, Permission, ModulePermissions } from "@/types";
import { Loader2 } from "lucide-react";
import { SYSTEM_MODULES } from "@/lib/constants/modules";
import { GranularPermissionsEditor } from "@/components/users/granular-permissions-editor";
import { FilteredPupilSelector } from "@/components/users/filtered-pupil-selector";
import { BulkParentAccountCreator } from "@/components/users/bulk-parent-account-creator";
import { format } from "date-fns";
import { MODULE_ACTIONS } from "@/types/permissions";
import { useAuth } from "@/lib/contexts/auth-context";

const PERMISSION_LABELS = {
  view_only: 'View Only',
  edit: 'View & Edit',
  full_access: 'Full Access'
} as const;

export default function UsersPage() {
  const { toast } = useToast();
  const { user: currentUser, refreshUser } = useAuth();
  
  // Firebase hooks
  const { data: users = [], isLoading, error } = useUsers();
  const { data: staff = [] } = useStaff();
  const { data: pupils = [] } = usePupils();
  const { data: accessLevels = [] } = useActiveAccessLevels();
  const createStaffAccountMutation = useCreateStaffAccount();
  const createParentAccountMutation = useCreateParentAccount();
  const createBulkParentAccountsMutation = useCreateBulkParentAccounts();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [activeTab, setActiveTab] = useState("staff");

  // Form states for staff creation
  const [staffFormData, setStaffFormData] = useState({
    staffId: "",
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    accessLevelId: "",
    modulePermissions: [] as ModulePermission[],
    granularPermissions: [] as ModulePermissions[]
  });

  // Form states for parent creation
  const [parentFormData, setParentFormData] = useState({
    pupilId: "",
    guardianId: ""
  });

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [permissionFilter, setPermissionFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');

  // Form states for editing
  const [editFormData, setEditFormData] = useState<{
    newUsername?: string;
    newPassword?: string;
    isActive: boolean;
    modulePermissions?: ModulePermission[];
    granularPermissions?: ModulePermissions[];
  }>({
    isActive: true
  });

  // Initialize edit form when editing user changes
  React.useEffect(() => {
    if (editingUser) {
      setEditFormData({
        newUsername: editingUser.username,
        isActive: editingUser.isActive,
        modulePermissions: editingUser.modulePermissions || [],
        granularPermissions: editingUser.granularPermissions || []
      });
    }
  }, [editingUser]);

  // Filter users by role
  const staffUsers = users.filter(user => user.role === 'Staff');
  const parentUsers = users.filter(user => user.role === 'Parent');
  const adminUsers = users.filter(user => user.role === 'Admin');

  // Get available staff (not yet having user accounts)
  const availableStaff = staff.filter((s: any) => !staffUsers.some(u => u.staffId === s.id));
  
  // Get available pupils (not yet having parent accounts)
  const availablePupils = pupils.filter((p: any) => !parentUsers.some(u => u.pupilId === p.id));

  const resetStaffForm = () => {
    setStaffFormData({
      staffId: "",
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      accessLevelId: "",
      modulePermissions: [],
      granularPermissions: []
    });
  };

  const resetParentForm = () => {
    setParentFormData({
      pupilId: "",
      guardianId: ""
    });
  };

  const handleStaffSelection = (staffId: string) => {
    const selectedStaff = staff.find((s: any) => s.id === staffId);
    if (selectedStaff) {
      setStaffFormData(prev => ({
        ...prev,
        staffId,
        firstName: selectedStaff.firstName,
        lastName: selectedStaff.lastName,
        email: selectedStaff.email,
        username: `${selectedStaff.firstName.toLowerCase()}.${selectedStaff.lastName.toLowerCase()}`.replace(/\s+/g, '')
      }));
    }
  };

  const handleModulePermissionChange = (moduleId: string, permission: Permission | null) => {
    setStaffFormData(prev => {
      const newPermissions = prev.modulePermissions.filter(mp => mp.module !== moduleId);
      if (permission) {
        newPermissions.push({ module: moduleId as any, permission });
      }
      
      // Auto-generate granular permissions from legacy permissions
      const granularPermissions = convertLegacyToGranularPermissions(newPermissions);
      
      return { 
        ...prev, 
        modulePermissions: newPermissions,
        granularPermissions: granularPermissions
      };
    });
  };

  const handleAccessLevelChange = (accessLevelId: string) => {
    // Handle "none" value - means no access level (manual permissions)
    if (accessLevelId === "none") {
      setStaffFormData(prev => ({
        ...prev,
        accessLevelId: "",
        modulePermissions: [],
        granularPermissions: []
      }));
      return;
    }
    
    setStaffFormData(prev => ({ ...prev, accessLevelId }));
    
    if (accessLevelId) {
      const selectedAccessLevel = accessLevels.find(level => level.id === accessLevelId);
      if (selectedAccessLevel) {
        const levelPermissions = AccessLevelsService.getAccessLevelPermissions(selectedAccessLevel);
        setStaffFormData(prev => ({
          ...prev,
          accessLevelId,
          modulePermissions: levelPermissions.modulePermissions,
          granularPermissions: levelPermissions.granularPermissions
        }));
      }
    } else {
      // Clear permissions when no access level is selected
      setStaffFormData(prev => ({
        ...prev,
        accessLevelId: "",
        modulePermissions: [],
        granularPermissions: []
      }));
    }
  };

  const handleCreateStaffAccount = async () => {
    if (!staffFormData.staffId || !staffFormData.username || !staffFormData.password) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please fill in all required fields." });
      return;
    }

    try {
      let granularPermissions = staffFormData.granularPermissions;
      let modulePermissions = staffFormData.modulePermissions;

      // If access level is selected, use its permissions
      if (staffFormData.accessLevelId) {
        const selectedAccessLevel = accessLevels.find(level => level.id === staffFormData.accessLevelId);
        if (selectedAccessLevel) {
          const levelPermissions = AccessLevelsService.getAccessLevelPermissions(selectedAccessLevel);
          modulePermissions = levelPermissions.modulePermissions;
          granularPermissions = levelPermissions.granularPermissions;
        }
      } else {
        // Fallback to manual permissions - convert from legacy if needed
        if ((!granularPermissions || granularPermissions.length === 0) && 
            staffFormData.modulePermissions && staffFormData.modulePermissions.length > 0) {
          granularPermissions = convertLegacyToGranularPermissions(staffFormData.modulePermissions);
        }
      }

      await createStaffAccountMutation.mutateAsync({
        ...staffFormData,
        modulePermissions,
        granularPermissions: granularPermissions
      });
      toast({ title: "Staff Account Created", description: `Account created for ${staffFormData.firstName} ${staffFormData.lastName}` });
      setIsCreateDialogOpen(false);
      resetStaffForm();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to create staff account." });
    }
  };

  const handleCreateParentAccount = async () => {
    if (!parentFormData.pupilId) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please select a pupil." });
      return;
    }

    const selectedPupil = pupils.find(p => p.id === parentFormData.pupilId);
    if (!selectedPupil) return;

    // FIXED: Use complete pupil name with proper spacing for authentication compatibility
    const pupilName = `${selectedPupil.firstName} ${selectedPupil.lastName}${selectedPupil.otherNames ? ` ${selectedPupil.otherNames}` : ''}`.trim();

    try {
      await createParentAccountMutation.mutateAsync({
        pupilId: parentFormData.pupilId,
        pupilName,
        admissionNumber: selectedPupil.admissionNumber,
        guardianId: parentFormData.guardianId
      });
      toast({ 
        title: "Parent Account Created", 
        description: `Secure parent account created for ${selectedPupil.firstName} ${selectedPupil.lastName}'s family` 
      });
      setIsCreateDialogOpen(false);
      resetParentForm();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to create parent account." });
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to delete the account for ${userName}?`)) {
      try {
        await deleteUserMutation.mutateAsync(userId);
        toast({ title: "User Deleted", description: `Account for ${userName} has been deleted.` });
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete user account." });
      }
    }
  };

  const handleToggleUserStatus = async (userId: string, newStatus: boolean, userName: string) => {
    const action = newStatus ? "enable" : "disable";
    const actionPast = newStatus ? "enabled" : "disabled";
    
    if (confirm(`Are you sure you want to ${action} the account for ${userName}?`)) {
      try {
        await updateUserMutation.mutateAsync({
          userId,
          updates: { isActive: newStatus }
        });
        toast({ 
          title: `User ${actionPast.charAt(0).toUpperCase() + actionPast.slice(1)}`, 
          description: `Account for ${userName} has been ${actionPast}.` 
        });
      } catch (error) {
        toast({ 
          variant: "destructive", 
          title: "Error", 
          description: `Failed to ${action} user account.` 
        });
      }
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    const updates: any = {
      isActive: editFormData.isActive
    };

    // Include username if changed
    if (editFormData.newUsername && editFormData.newUsername !== editingUser.username) {
      updates.username = editFormData.newUsername;
    }

    // Include password if provided
    if (editFormData.newPassword) {
      updates.password = editFormData.newPassword;
    }

    // Include module permissions for staff
    if (editingUser.role === 'Staff') {
      updates.modulePermissions = editFormData.modulePermissions || [];
      
      // Ensure granular permissions exist - convert from legacy if needed
      let granularPermissions = editFormData.granularPermissions || [];
      if (granularPermissions.length === 0 && updates.modulePermissions.length > 0) {
        granularPermissions = convertLegacyToGranularPermissions(updates.modulePermissions);
      }
      updates.granularPermissions = granularPermissions;
    }

    try {
      await updateUserMutation.mutateAsync({
        userId: editingUser.id,
        updates
      });
      
      // If the current user edited their own account, refresh their data
      if (currentUser && editingUser.id === currentUser.id) {
        await refreshUser();
        toast({ 
          title: "User Updated", 
          description: `Your account has been updated. Sidebar will refresh with new permissions.` 
        });
      } else {
        toast({ 
          title: "User Updated", 
          description: `Account for ${getUserDisplayName(editingUser)} has been updated.` 
        });
      }
      
      setIsEditDialogOpen(false);
      setEditingUser(null);
      setEditFormData({ isActive: true, modulePermissions: [], granularPermissions: [] });
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: error.message || "Failed to update user account." 
      });
    }
  };

  const getUserDisplayName = (user: SystemUser) => {
    if (user.role === 'Staff') {
      return `${user.firstName} ${user.lastName}`;
    } else if (user.role === 'Parent') {
      const pupil = pupils.find(p => p.id === user.pupilId);
      return pupil ? `${pupil.firstName} ${pupil.lastName} (Parent)` : 'Parent Account';
    }
    return user.username;
  };

  const getModulePermission = (user: SystemUser, moduleId: string): Permission | null => {
    if (user.role === 'Admin') return 'full_access';
    if (user.role === 'Parent') return null;
    
    const permission = user.modulePermissions?.find(mp => mp.module === moduleId);
    return permission?.permission || null;
  };

  // Helper function to convert legacy permissions to granular format
  const convertLegacyToGranularPermissions = (modulePermissions: ModulePermission[]): ModulePermissions[] => {
    const granularPermissions: ModulePermissions[] = [];
    
    modulePermissions.forEach(legacyPerm => {
      const moduleActions = MODULE_ACTIONS[legacyPerm.module as keyof typeof MODULE_ACTIONS];
      if (moduleActions) {
        const modulePermission: ModulePermissions = {
          moduleId: legacyPerm.module,
          pages: moduleActions.pages.map(page => ({
            pageId: page.page,
            canAccess: true, // Legacy permissions grant access to all pages
            actions: page.actions.map(action => ({
              actionId: action.id,
              allowed: mapLegacyPermissionToAction(legacyPerm.permission, action.id)
            }))
          }))
        };
        granularPermissions.push(modulePermission);
      }
    });
    
    return granularPermissions;
  };

  // Helper function to map legacy permissions to actions
  const mapLegacyPermissionToAction = (permission: Permission, actionId: string): boolean => {
    const viewOnlyActions = [
      'view_list', 'search_filter', 'view_details_link', 'access_page', 
      'view_personal_info', 'view_academic_info', 'view_guardian_info',
      'view_medical_info', 'view_exam_records', 'view_siblings',
      'view_status_history', 'view_promotion_history', 'view_details',
      'view_balance', 'view_results', 'view_reports', 'view_pupils',
      'view_statistics', 'view_classes', 'view_history'
    ];
    
    const editActions = [
      ...viewOnlyActions,
      'create_pupil', 'edit_basic_info', 'edit_guardian', 'change_photo',
      'save_changes', 'add_guardian', 'upload_photo', 'select_pupils',
      'record_attendance', 'edit_attendance', 'enter_results', 'edit_results',
      'create_structure', 'edit_structure', 'record_payment', 'collect_fees',
      'create_exam', 'edit_exam', 'create_staff', 'edit_staff', 'create_class',
      'edit_class', 'assign_teachers', 'assign_subjects'
    ];
    
    const fullAccessActions = [
      ...editActions,
      'delete_from_list', 'delete_pupil', 'delete_structure', 'delete_exam',
      'delete_staff', 'delete_class', 'revert_payment', 'change_status',
      'promote_pupils', 'demote_pupils', 'transfer_pupils', 'manage_id_codes',
      'manage_assignments', 'publish_results', 'export_data', 'print_receipt',
      'print_reports', 'manage_adjustments', 'manage_types', 'assign_roles',
      'bulk_actions', 'add_sibling_from_list', 'add_sibling'
    ];
    
    if (permission === 'view_only') {
      return viewOnlyActions.includes(actionId);
    } else if (permission === 'edit') {
      return editActions.includes(actionId);
    } else if (permission === 'full_access') {
      return fullAccessActions.includes(actionId);
    }
    
    return false;
  };

  const getUserPermissionSummary = (user: SystemUser): string[] => {
    if (user.role === 'Admin') return ['Admin - Full Access'];
    if (user.role === 'Parent') return ['Parent Account'];
    
    const permissions: string[] = [];
    
    // Check granular permissions first
    if (user.granularPermissions && user.granularPermissions.length > 0) {
      user.granularPermissions.forEach((modulePerm) => {
        const hasAccess = modulePerm.pages.some(p => p.canAccess);
        if (hasAccess) {
          // Determine permission level based on actions
          let hasEdit = false;
          let hasDelete = false;
          
          modulePerm.pages.forEach(page => {
            if (page.canAccess) {
              page.actions.forEach(action => {
                if (action.allowed) {
                  if (action.actionId.includes('edit') || action.actionId.includes('create') || action.actionId.includes('update')) {
                    hasEdit = true;
                  }
                  if (action.actionId.includes('delete') || action.actionId.includes('remove')) {
                    hasDelete = true;
                  }
                }
              });
            }
          });
          
          let level = 'View Only';
          if (hasDelete) level = 'Full Access';
          else if (hasEdit) level = 'View & Edit';
          
          permissions.push(`${modulePerm.moduleId}: ${level}`);
        }
      });
    }
    
    // Fallback to legacy permissions if no granular permissions
    if (permissions.length === 0 && user.modulePermissions && user.modulePermissions.length > 0) {
      user.modulePermissions.forEach((mp) => {
        permissions.push(`${mp.module}: ${PERMISSION_LABELS[mp.permission]}`);
      });
    }
    
    return permissions;
  };

  // Filter users based on search and filter criteria
  const filteredUsers = users.filter(user => {
    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const userName = getUserDisplayName(user).toLowerCase();
      const username = user.username.toLowerCase();
      const email = (user.email || '').toLowerCase();
      
      if (!userName.includes(searchLower) && 
          !username.includes(searchLower) && 
          !email.includes(searchLower)) {
        return false;
      }
    }

    // Permission filter (for staff users)
    if (permissionFilter !== 'all' && user.role === 'Staff') {
      const hasPermission = user.granularPermissions?.some(modulePerm => {
        if (permissionFilter === 'view_only') {
          return modulePerm.pages.some(p => p.canAccess && 
            p.actions.every(a => !a.actionId.includes('edit') && !a.actionId.includes('create')));
        } else if (permissionFilter === 'edit') {
          return modulePerm.pages.some(p => p.canAccess && 
            p.actions.some(a => a.allowed && a.actionId.includes('edit')));
        } else if (permissionFilter === 'full_access') {
          return modulePerm.pages.some(p => p.canAccess && 
            p.actions.some(a => a.allowed && a.actionId.includes('delete')));
        }
        return false;
      });
      if (!hasPermission) return false;
    }

    // Module filter (for staff users)
    if (moduleFilter !== 'all' && user.role === 'Staff') {
      const hasModuleAccess = user.granularPermissions?.some(modulePerm => 
        modulePerm.moduleId.toLowerCase().includes(moduleFilter.toLowerCase()) && 
        modulePerm.pages.some(p => p.canAccess)
      );
      if (!hasModuleAccess) return false;
    }

    return true;
  });

  // Filter users by role
  const filteredStaffUsers = filteredUsers.filter(user => user.role === 'Staff');
  const filteredParentUsers = filteredUsers.filter(user => user.role === 'Parent');
  const filteredAdminUsers = filteredUsers.filter(user => user.role === 'Admin');

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setPermissionFilter('all');
    setModuleFilter('all');
  };

  return (
    <>
      <PageHeader
        title="User Management"
        description="Manage staff and parent access to the school management system"
        actions={
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create User Account
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading users...</span>
        </div>
      ) : error ? (
        <div className="text-center text-destructive py-8">
          <p>Error loading users data. Please try again.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className={`grid grid-cols-1 ${currentUser?.role === 'Admin' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3`}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{filteredStaffUsers.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {availableStaff.length} staff without accounts
                  </p>
                </div>
                <UserCheck className="h-5 w-5 text-muted-foreground" />
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{filteredParentUsers.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {availablePupils.length} pupils without parent accounts
                  </p>
                </div>
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
            </Card>
            
            {currentUser?.role === 'Admin' && (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">{filteredAdminUsers.length}</div>
                    <p className="text-xs text-muted-foreground">
                      Full system access
                    </p>
                  </div>
                  <Shield className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>
            )}
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              {/* All Filters on One Line */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="search">Search Users</Label>
                  <Input
                    id="search"
                    placeholder="Search by name, username, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="permission-filter">Permission Level</Label>
                  <Select value={permissionFilter} onValueChange={setPermissionFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Permissions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Permissions</SelectItem>
                      <SelectItem value="view_only">View Only</SelectItem>
                      <SelectItem value="edit">View & Edit</SelectItem>
                      <SelectItem value="full_access">Full Access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="module-filter">Module Access</Label>
                  <Select value={moduleFilter} onValueChange={setModuleFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Modules" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modules</SelectItem>
                      <SelectItem value="pupils">Pupils</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="classes">Classes</SelectItem>
                      <SelectItem value="fees">Fees</SelectItem>
                      <SelectItem value="exams">Exams</SelectItem>
                      <SelectItem value="attendance">Attendance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    variant="outline" 
                    onClick={clearFilters}
                    className="w-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* No Results Message */}
          {filteredUsers.length === 0 && (searchTerm || permissionFilter !== 'all' || moduleFilter !== 'all') && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Search className="h-12 w-12 mx-auto mb-4 text-orange-400" />
                  <h3 className="text-lg font-medium text-orange-900 mb-2">No Users Found</h3>
                  <p className="text-orange-700 mb-4">
                    No users match your current search and filter criteria.
                  </p>
                  <Button variant="outline" onClick={clearFilters} className="border-orange-300 text-orange-700 hover:bg-orange-100">
                    <X className="h-4 w-4 mr-2" />
                    Clear All Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Summary */}
          {(searchTerm || permissionFilter !== 'all' || moduleFilter !== 'all') && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-blue-700">
                    <span className="font-medium">Showing {filteredUsers.length} of {users.length} users</span>
                    {searchTerm && (
                      <span className="ml-2">matching "{searchTerm}"</span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={clearFilters} className="border-blue-300 text-blue-700 hover:bg-blue-100">
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

                    {/* Users Table */}
          <Tabs defaultValue="staff" className="space-y-4">
            <TabsList>
              <TabsTrigger value="staff">Staff Users ({filteredStaffUsers.length})</TabsTrigger>
              <TabsTrigger value="parents">Parent Users ({filteredParentUsers.length})</TabsTrigger>
              {currentUser?.role === 'Admin' && (
                <TabsTrigger value="admins">Admin Users ({filteredAdminUsers.length})</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="staff" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Staff User Accounts</CardTitle>
                  <CardDescription>
                    Manage staff access and permissions to different modules
                  </CardDescription>
                </CardHeader>
                <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
                        <TableHead>Permissions</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
                      {filteredStaffUsers.map((user) => (
              <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            <div>
                              {getUserDisplayName(user)}
                              <UserSignatureDisplay 
                                user={user} 
                                variant="inline" 
                                className="mt-1" 
                              />
                            </div>
                          </TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {getUserPermissionSummary(user).slice(0, 3).map((perm, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {perm}
                                </Badge>
                              ))}
                              {getUserPermissionSummary(user).length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{getUserPermissionSummary(user).length - 3} more
                                </Badge>
                              )}
                              {getUserPermissionSummary(user).length === 0 && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  No permissions
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? 'default' : 'secondary'}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                <TableCell>
                            {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => {
                                  setEditingUser(user);
                                  setIsEditDialogOpen(true);
                                }}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleUserStatus(user.id, !user.isActive, getUserDisplayName(user))}
                        className={user.isActive ? "text-orange-600 focus:text-orange-700" : "text-green-600 focus:text-green-700"}
                      >
                        {user.isActive ? (
                          <>
                            <EyeOff className="mr-2 h-4 w-4" /> Disable
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 h-4 w-4" /> Enable
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                                  onClick={() => handleDeleteUser(user.id, getUserDisplayName(user))}
                                  className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
                  {filteredStaffUsers.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No staff user accounts found.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="parents" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Parent User Accounts</CardTitle>
                  <CardDescription>
                    Parent accounts automatically created for pupil families
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pupil Name</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Admission Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredParentUsers.map((user) => {
                        const pupil = pupils.find(p => p.id === user.pupilId);
                        return (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              <div>
                                {pupil ? `${pupil.firstName} ${pupil.lastName}` : 'Unknown Pupil'}
                                <UserSignatureDisplay 
                                  user={user} 
                                  variant="inline" 
                                  className="mt-1" 
                                />
                              </div>
                            </TableCell>
                            <TableCell>{user.username}</TableCell>
                            <TableCell>{pupil?.admissionNumber}</TableCell>
                            <TableCell>
                              <Badge variant={user.isActive ? 'default' : 'secondary'}>
                                {user.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => {
                                    setEditingUser(user);
                                    setIsEditDialogOpen(true);
                                  }}>
                                    <Key className="mr-2 h-4 w-4" /> Reset Password
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleToggleUserStatus(user.id, !user.isActive, getUserDisplayName(user))}
                                    className={user.isActive ? "text-orange-600 focus:text-orange-700" : "text-green-600 focus:text-green-700"}
                                  >
                                    {user.isActive ? (
                                      <>
                                        <EyeOff className="mr-2 h-4 w-4" /> Disable
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="mr-2 h-4 w-4" /> Enable
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteUser(user.id, getUserDisplayName(user))}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {filteredParentUsers.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No parent user accounts found.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {currentUser?.role === 'Admin' && (
              <TabsContent value="admins" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Administrator Accounts</CardTitle>
                    <CardDescription>
                      Users with full system access and administrative privileges
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Username</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Login</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAdminUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              <div>
                                {user.username}
                                <UserSignatureDisplay 
                                  user={user} 
                                  variant="inline" 
                                  className="mt-1" 
                                />
                              </div>
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={user.isActive ? 'default' : 'secondary'}>
                                {user.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => {
                                    setEditingUser(user);
                                    setIsEditDialogOpen(true);
                                  }}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredAdminUsers.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        No administrator accounts found.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}

      {/* Create User Dialog */}
      <ModernDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <ModernDialogContent 
          size="xl" 
          className="w-[95vw] max-w-5xl" 
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
        >
          <ModernDialogHeader className="p-2">
            <ModernDialogTitle className="text-sm">Create User Account</ModernDialogTitle>
            <ModernDialogDescription className="text-[0.65rem]">
              Create a new user account for staff members or parents
            </ModernDialogDescription>
          </ModernDialogHeader>
          
          {/* Academic Context Banner */}
          <div className="mx-1 sm:mx-2 mt-1 sm:mt-2 p-1 border rounded-md text-[0.6rem] bg-indigo-50 border-indigo-200">
            <div className="flex flex-wrap gap-1 items-center">
              <div className="flex items-center gap-0.5">
                <Users className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="font-medium">User Account Management</span>
              </div>
              <div>
                <strong>Date:</strong> {format(new Date(), "MMM dd, yyyy")}
              </div>
              <div className="text-[0.5rem] px-1 py-0.5 rounded ml-auto text-indigo-700 bg-indigo-100">
                Create Mode
              </div>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2">
            <TabsList className="grid w-full grid-cols-3 h-6 text-[0.65rem]">
              <TabsTrigger value="staff" className="text-[0.65rem]">Staff Account</TabsTrigger>
              <TabsTrigger value="parent" className="text-[0.65rem]">Parent Account</TabsTrigger>
              <TabsTrigger value="bulk" className="text-[0.65rem]">Bulk Parent Accounts</TabsTrigger>
            </TabsList>

            <TabsContent value="staff" className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="staff-select">Select Staff Member *</Label>
                  <Select value={staffFormData.staffId} onValueChange={handleStaffSelection}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a staff member" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStaff.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} - {s.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      value={staffFormData.username}
                      onChange={(e) => setStaffFormData(prev => ({ ...prev, username: e.target.value.toUpperCase() }))}
                      placeholder="Enter username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={staffFormData.password}
                        onChange={(e) => setStaffFormData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="access-level">Access Level (Optional)</Label>
                  <Select value={staffFormData.accessLevelId || "none"} onValueChange={handleAccessLevelChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an access level to auto-assign permissions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No access level (manual permissions)</SelectItem>
                      {accessLevels.map((level) => (
                        <SelectItem key={level.id} value={level.id}>
                          {level.name} - {level.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {staffFormData.accessLevelId && staffFormData.accessLevelId !== "none" && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Permissions will be automatically assigned based on the selected access level.
                    </p>
                  )}
                </div>

                <Separator />

                <div>
                  <Label className="text-base font-medium">Module Permissions</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure detailed permissions for each module and page
                  </p>
                  
                  <GranularPermissionsEditor
                    permissions={staffFormData.granularPermissions}
                    onChange={(newPermissions) => 
                      setStaffFormData(prev => ({ ...prev, granularPermissions: newPermissions }))
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="parent" className="space-y-4">
              <div className="space-y-4">
                <FilteredPupilSelector
                  availablePupils={availablePupils}
                  selectedPupilId={parentFormData.pupilId}
                  onSelect={(pupil) => 
                    setParentFormData(prev => ({ ...prev, pupilId: pupil?.id || "" }))
                  }
                />

                {parentFormData.pupilId && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Account Details</h4>
                    {(() => {
                      const selectedPupil = pupils.find(p => p.id === parentFormData.pupilId);
                      if (!selectedPupil) return null;
                      
                      // IMPROVED: Generate simple, user-friendly username format
                      // Format: First 3 letters of surname + last 2 digits of birth year (e.g., MUK12)
                      const generateUsername = () => {
                        const surnamePrefix = selectedPupil.lastName.substring(0, 3).toUpperCase();
                        let birthYearSuffix = '';
                        if (selectedPupil.dateOfBirth) {
                          const birthYear = new Date(selectedPupil.dateOfBirth).getFullYear();
                          birthYearSuffix = birthYear.toString().slice(-2);
                        } else {
                          birthYearSuffix = new Date().getFullYear().toString().slice(-2);
                        }
                        return `${surnamePrefix}${birthYearSuffix}`;
                      };
                      
                      const username = generateUsername();
                      
                      return (
                        <div className="space-y-2 text-sm">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Generated Username</p>
                              <p className="font-mono text-lg font-bold text-blue-600">{username}</p>
                              <p className="text-xs text-muted-foreground">
                                {selectedPupil.lastName.substring(0, 3).toUpperCase()} (surname) + {selectedPupil.dateOfBirth ? new Date(selectedPupil.dateOfBirth).getFullYear().toString().slice(-2) : new Date().getFullYear().toString().slice(-2)} (birth year)
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Default Password</p>
                              <p className="font-mono text-lg font-bold text-green-600">{selectedPupil.admissionNumber}</p>
                              <p className="text-xs text-muted-foreground">Admission Number</p>
                            </div>
                          </div>
                          
                          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                            <p className="font-medium text-blue-800 mb-2">🎯 Simple Parent Login</p>
                            <div className="space-y-1 text-blue-700">
                              <p><strong>Username:</strong> {username} (short & memorable!)</p>
                              <p><strong>Password:</strong> {selectedPupil.admissionNumber}</p>
                              <p className="mt-2 text-blue-600">
                                ✨ Parents can also use the pupil's full name as username - the system will automatically find the correct account!
                              </p>
                            </div>
                          </div>
                          
                          <p className="text-muted-foreground text-xs">
                            Parents can change their password after first login
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">🚀 Bulk Parent Account Creation</h4>
                  <p className="text-sm text-blue-700">
                    Create multiple parent accounts at once by selecting individual pupils or entire classes. 
                    Each parent will get a unique username and password based on their child's information.
                  </p>
                </div>
                
                <BulkParentAccountCreator
                  onSuccess={() => {
                    setIsCreateDialogOpen(false);
                    resetParentForm();
                  }}
                  onCancel={() => setIsCreateDialogOpen(false)}
                />
              </div>
            </TabsContent>
          </Tabs>

          <ModernDialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            {activeTab !== "bulk" && (
              <Button 
                onClick={activeTab === "staff" ? handleCreateStaffAccount : handleCreateParentAccount}
                disabled={createStaffAccountMutation.isPending || createParentAccountMutation.isPending}
              >
                {(createStaffAccountMutation.isPending || createParentAccountMutation.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            )}
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>

      {/* Edit User Dialog */}
      <ModernDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <ModernDialogContent size="lg" open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <ModernDialogHeader>
            <ModernDialogTitle>
              {editingUser?.role === 'Parent' ? 'Reset Parent Password' : 'Edit User Account'}
            </ModernDialogTitle>
            <ModernDialogDescription>
              {editingUser?.role === 'Parent' 
                ? 'Reset password for parent account' 
                : 'Update user permissions and account settings'}
            </ModernDialogDescription>
          </ModernDialogHeader>
          
          {editingUser && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">User Information</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Name:</strong> {getUserDisplayName(editingUser)}</p>
                  <p><strong>Username:</strong> {editingUser.username}</p>
                  <p><strong>Role:</strong> {editingUser.role}</p>
                  {editingUser.email && <p><strong>Email:</strong> {editingUser.email}</p>}
                </div>
              </div>

              {/* Username Edit Section */}
              <div className="space-y-3">
                <Label>Username</Label>
                <Input
                  type="text"
                  placeholder="Enter username"
                  value={editFormData.newUsername || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, newUsername: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Change the username for this account
                </p>
              </div>

              {/* Password Reset Section */}
              <div className="space-y-3">
                <Label>Reset Password</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password (leave blank to keep current)"
                      value={editFormData.newPassword || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leave blank to keep the current password
                  </p>
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Account Status</Label>
                  <p className="text-sm text-muted-foreground">Enable or disable user access</p>
                </div>
                <Checkbox
                  checked={editFormData.isActive}
                  onCheckedChange={(checked) => 
                    setEditFormData(prev => ({ ...prev, isActive: !!checked }))
                  }
                />
              </div>

              {/* Module Permissions (Staff Only) */}
              {editingUser.role === 'Staff' && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-base font-medium">Module Permissions</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure detailed permissions for each module and page
                    </p>
                    
                    <div className="max-h-96 overflow-y-auto">
                      <GranularPermissionsEditor
                        permissions={editFormData.granularPermissions || []}
                        onChange={(newPermissions) => 
                          setEditFormData(prev => ({ ...prev, granularPermissions: newPermissions }))
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <ModernDialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setEditingUser(null);
              setEditFormData({ isActive: true, modulePermissions: [], granularPermissions: [] });
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateUser}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update User"
              )}
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>
    </>
  );
}
