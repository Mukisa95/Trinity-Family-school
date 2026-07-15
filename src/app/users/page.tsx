"use client";

import * as React from "react";
import { useState } from "react";
import { PlusCircle, MoreHorizontal, Edit, Trash2, UserCheck, Users, Shield, Eye, EyeOff, Key, Search, X, Filter, Save, Copy } from "lucide-react";
import { GlassPageTopBar, GlassActionDock, GlassActionButton, GlassPageSearchInput } from "@/components/common/glass-page-top-bar";
import { GlassSummaryBar } from "@/components/common/glass-summary-bar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ActionGuard } from "@/components/auth/action-guard";
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

type PermissionSummaryItem = {
  title: string;
  description: string;
  actionNames?: string;
};

function formatLastLogin(lastLogin: unknown): string {
  if (!lastLogin) return 'Never';

  const value = lastLogin as {
    toDate?: () => Date;
    seconds?: number;
  };
  const date = lastLogin instanceof Date
    ? lastLogin
    : typeof value.toDate === 'function'
      ? value.toDate()
      : typeof value.seconds === 'number'
        ? new Date(value.seconds * 1000)
        : new Date(String(lastLogin));

  return Number.isNaN(date.getTime()) ? 'Never' : format(date, 'd MMM yyyy');
}

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
  const [permissionsUser, setPermissionsUser] = useState<SystemUser | null>(null);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [permissionsDraft, setPermissionsDraft] = useState<ModulePermissions[]>([]);
  const [activeTab, setActiveTab] = useState("staff");
  const [isMorphOpen, setIsMorphOpen] = useState(false);
  const [morphUserId, setMorphUserId] = useState("");

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
  const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);
  const activeFiltersCount = (permissionFilter !== 'all' ? 1 : 0) + (moduleFilter !== 'all' ? 1 : 0);

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
    setMorphUserId("");
    setIsMorphOpen(false);
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
    setMorphUserId("");
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
          pages: moduleActions.pages
            .filter(page => !(legacyPerm.module === 'pupils' && page.page === 'historical_seeding'))
            .map(page => ({
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

  const openPermissionsWorkspace = (user: SystemUser) => {
    setPermissionsUser(user);
    setPermissionsDraft(getEditablePermissions(user));
    setIsPermissionsDialogOpen(true);
  };

  const getEditablePermissions = (user: SystemUser): ModulePermissions[] => {
    const granularPermissions = user.granularPermissions || [];
    const granularModuleIds = new Set(granularPermissions.map((permission) => permission.moduleId));
    const legacyOnlyPermissions = convertLegacyToGranularPermissions(user.modulePermissions || [])
      .filter((permission) => !granularModuleIds.has(permission.moduleId));

    return [...legacyOnlyPermissions, ...granularPermissions];
  };

  const cloneGranularPermissions = (permissions: ModulePermissions[]): ModulePermissions[] =>
    permissions.map((module) => ({
      ...module,
      pages: module.pages.map((page) => ({
        ...page,
        actions: page.actions.map((action) => ({ ...action })),
      })),
    }));

  const handleMorphPermissions = (sourceUserId: string) => {
    setMorphUserId(sourceUserId);

    if (sourceUserId === 'none') {
      setStaffFormData((current) => ({
        ...current,
        accessLevelId: '',
        modulePermissions: [],
        granularPermissions: [],
      }));
      return;
    }

    const sourceUser = staffUsers.find((user) => user.id === sourceUserId);
    if (!sourceUser) return;

    setStaffFormData((current) => ({
      ...current,
      accessLevelId: '',
      modulePermissions: (sourceUser.modulePermissions || []).map((permission) => ({ ...permission })),
      granularPermissions: cloneGranularPermissions(getEditablePermissions(sourceUser)),
    }));

    toast({
      title: 'Permissions copied',
      description: `Copied ${getUserDisplayName(sourceUser)}'s permission setup. You can still adjust it below.`,
    });
  };

  const permissionSummary = (user: SystemUser, permissions: ModulePermissions[]): PermissionSummaryItem[] => {
    if (user.role === 'Admin') {
      return [{ title: 'Full system access', description: 'Administrators can open every workspace and perform every available action.' }];
    }

    if (user.role === 'Parent') {
      return [{ title: 'Parent portal access', description: 'Parent accounts can access only their linked family and pupil information.' }];
    }

    return permissions.flatMap((modulePermission) => {
      const module = MODULE_ACTIONS[modulePermission.moduleId as keyof typeof MODULE_ACTIONS];
      if (!module) return [];

      return modulePermission.pages.flatMap((pagePermission) => {
        if (!pagePermission.canAccess) return [];
        const page = module.pages.find((item) => item.page === pagePermission.pageId);
        if (!page) return [];

        const allowedActions = page.actions.filter((action) =>
          pagePermission.actions.some((permission) => permission.actionId === action.id && permission.allowed)
        );
        const actionNames = allowedActions.map((action) => action.name).join(', ');

        return [{
          title: page.name,
          description: allowedActions.length
            ? `Can ${allowedActions.map((action) => action.description.charAt(0).toLowerCase() + action.description.slice(1)).join('; ')}.`
            : 'Can open this workspace, but no additional actions are enabled.',
          actionNames,
        }];
      });
    });
  };

  const handleSavePermissions = async () => {
    if (!permissionsUser || permissionsUser.role !== 'Staff') return;

    try {
      await updateUserMutation.mutateAsync({
        userId: permissionsUser.id,
        updates: {
          modulePermissions: permissionsUser.modulePermissions || [],
          granularPermissions: permissionsDraft,
        },
      });

      if (currentUser?.id === permissionsUser.id) {
        await refreshUser();
      }

      toast({
        title: 'Permissions updated',
        description: `Access for ${getUserDisplayName(permissionsUser)} has been saved.`,
      });
      setIsPermissionsDialogOpen(false);
      setPermissionsUser(null);
      setPermissionsDraft([]);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not update permissions',
        description: error.message || 'Please try again.',
      });
    }
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
      <GlassPageTopBar
        title="User Management"
        subtitle="Manage staff and parent access to the school management system"
        className="mb-1.5"
        center={
          <GlassPageSearchInput
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        }
        actionsLeading={
          <GlassPageSearchInput
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            containerClassName="lg:hidden"
          />
        }
        actions={
          <GlassActionDock>
            <ActionGuard module="users" page="list" action="manage_permissions">
              <GlassActionButton
                label="Access"
                icon={<Shield className="h-4 w-4" />}
                tone="violet"
                href="/access-levels"
                title="Access Levels"
              />
            </ActionGuard>
            <GlassActionButton
              label="Filters"
              tone="blue"
              icon={<Filter className="h-4 w-4" />}
              badge={activeFiltersCount > 0 ? activeFiltersCount : undefined}
              onClick={() => setIsFilterPopupOpen(true)}
              aria-label="Filter Users"
            />
            <GlassActionButton
              label="User"
              icon={<PlusCircle className="h-4 w-4" />}
              tone="blue"
              onClick={() => setIsCreateDialogOpen(true)}
              title="Create User Account"
            />
          </GlassActionDock>
        }
      />

      <GlassSummaryBar
        left={
          <div className="flex flex-wrap items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" />
            <span className="text-xs sm:text-sm font-black tracking-wider text-indigo-900 uppercase mr-2">
              Users Overview
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 bg-blue-50/80 border border-blue-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-blue-700">{availableStaff.length}</span>
                <span className="text-blue-700/85 font-medium">staff without accounts</span>
              </div>
              <div className="flex items-center gap-1 bg-amber-50/80 border border-amber-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-amber-700">{availablePupils.length}</span>
                <span className="text-amber-700/85 font-medium">pupils without parent accounts</span>
              </div>
              {currentUser?.role === 'Admin' && (
                <div className="flex items-center gap-1 bg-emerald-50/80 border border-emerald-100/50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                  <span className="font-bold text-emerald-700">{filteredAdminUsers.length}</span>
                  <span className="text-emerald-700/85 font-medium">Full system access</span>
                </div>
              )}
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-full border border-slate-200/50 backdrop-blur-sm">
            {[
              { id: 'staff', label: `Staff Users (${filteredStaffUsers.length})` },
              { id: 'parents', label: `Parent Users (${filteredParentUsers.length})` },
              ...(currentUser?.role === 'Admin' ? [{ id: 'admins', label: `Admin Users (${filteredAdminUsers.length})` }] : [])
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-all duration-300",
                    isActive
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading users...</span>
        </div>
      ) : (
        <div className="max-w-none px-4 sm:px-6 lg:px-8 py-4 space-y-6">


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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">

            <TabsContent value="staff" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
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
                            <Badge variant={user.isActive ? 'default' : 'secondary'}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                <TableCell>
                            {formatLastLogin(user.lastLogin)}
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
                      <DropdownMenuItem onClick={() => openPermissionsWorkspace(user)}>
                        <Shield className="mr-2 h-4 w-4" /> Permissions
                      </DropdownMenuItem>
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
                <CardContent className="pt-6">
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
                              {formatLastLogin(user.lastLogin)}
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
                  <CardContent className="pt-6">
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
                              {formatLastLogin(user.lastLogin)}
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
      {/* Filters Modal */}
      <ModernDialog
        open={isFilterPopupOpen}
        onOpenChange={setIsFilterPopupOpen}
      >
        <ModernDialogContent size="md">
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center gap-2 text-indigo-900">
              <Filter className="h-5 w-5 text-indigo-600 animate-[pulse_2s_infinite]" />
              Filter Users
            </ModernDialogTitle>
            <ModernDialogDescription className="text-gray-500">
              Apply filters to narrow down the list of users.
            </ModernDialogDescription>
          </ModernDialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            {/* Permission Level Filter */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-indigo-950">Permission Level</label>
              <Select value={permissionFilter} onValueChange={setPermissionFilter}>
                <SelectTrigger className="w-full">
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

            {/* Module Access Filter */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-indigo-950">Module Access</label>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger className="w-full">
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
          </div>

          <ModernDialogFooter className="flex justify-between items-center mt-2">
            {activeFiltersCount > 0 ? (
              <Button
                variant="outline"
                onClick={() => {
                  clearFilters();
                  setIsFilterPopupOpen(false);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-full border border-rose-100 transition-all duration-200 h-8"
              >
                <X size={12} />
                <span>Clear All ({activeFiltersCount})</span>
              </Button>
            ) : (
              <div />
            )}
            <Button
              onClick={() => setIsFilterPopupOpen(false)}
              className="inline-flex items-center justify-center h-8 px-4 rounded-full font-semibold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all duration-200"
            >
              Done
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>
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

                <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Label className="text-base font-semibold text-slate-900">Morph permissions</Label>
                      <p className="mt-1 text-sm text-slate-600">Copy another staff user&apos;s effective page and action permissions, then adjust them if needed.</p>
                    </div>
                    <Button
                      type="button"
                      variant={isMorphOpen ? "secondary" : "outline"}
                      className="gap-2 border-violet-200 bg-white text-violet-700 hover:bg-violet-100"
                      onClick={() => setIsMorphOpen((open) => !open)}
                    >
                      <Copy className="h-4 w-4" /> {isMorphOpen ? 'Hide morph' : 'Morph'}
                    </Button>
                  </div>

                  {isMorphOpen && (
                    <div className="mt-4 space-y-2 border-t border-violet-200 pt-4">
                      <Label htmlFor="morph-permissions">Copy permissions from</Label>
                      <Select value={morphUserId || 'none'} onValueChange={handleMorphPermissions}>
                        <SelectTrigger id="morph-permissions" className="bg-white">
                          <SelectValue placeholder="Select an existing staff user" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Clear copied permissions</SelectItem>
                          {staffUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {getUserDisplayName(user)} · {user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {morphUserId && morphUserId !== 'none' && (
                        <p className="text-sm text-violet-800">Permissions copied. Continue below to review or make changes before creating the account.</p>
                      )}
                    </div>
                  )}
                </section>

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

      <ModernDialog
        open={isPermissionsDialogOpen}
        onOpenChange={(open) => {
          setIsPermissionsDialogOpen(open);
          if (!open) {
            setPermissionsUser(null);
            setPermissionsDraft([]);
          }
        }}
      >
        <ModernDialogContent size="responsive">
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-600" /> Permissions
            </ModernDialogTitle>
            <ModernDialogDescription>
              Review what this user can do, then change or revoke access here without opening their account editor.
            </ModernDialogDescription>
          </ModernDialogHeader>

          {permissionsUser && (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1">
              <section className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                <p className="font-semibold text-slate-900">{getUserDisplayName(permissionsUser)}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{permissionsUser.username} · {permissionsUser.role}</p>
              </section>

              <section className="space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-900">Current access</h3>
                  <p className="text-sm text-muted-foreground">A plain-language summary of each workspace this account can use.</p>
                </div>
                {permissionSummary(permissionsUser, permissionsDraft).length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">This user has no active system permissions.</div>
                ) : (
                  <div className="space-y-2">
                    {permissionSummary(permissionsUser, permissionsDraft).map((permission) => (
                      <div key={permission.title} className="rounded-lg border bg-card p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">{permission.title}</p>
                          {permission.actionNames && <Badge variant="secondary" className="font-normal">{permission.actionNames}</Badge>}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{permission.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <Separator />

              <section className="space-y-3 pb-2">
                <div>
                  <h3 className="font-semibold text-slate-900">Change access</h3>
                  <p className="text-sm text-muted-foreground">Use a section, menu, page, or individual action checkbox to grant or revoke access.</p>
                </div>
                <GranularPermissionsEditor
                  permissions={permissionsDraft}
                  onChange={setPermissionsDraft}
                />
              </section>
            </div>
          )}

          <ModernDialogFooter>
            <Button variant="outline" onClick={() => setIsPermissionsDialogOpen(false)} disabled={updateUserMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={updateUserMutation.isPending || !permissionsUser}>
              {updateUserMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save permissions
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>
    </>
  );
}
