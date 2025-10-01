"use client";

import React from "react";
import { useAuth } from "@/lib/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, Info, Shield, Users } from "lucide-react";
import { GranularPermissionService } from "@/lib/services/granular-permissions.service";
import { MODULE_ACTIONS } from "@/types/permissions";
import { UsersService } from "@/lib/services/users.service";
import type { ModulePermissions, SystemUser } from "@/types";
import { useUsers } from "@/lib/hooks/use-users";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DebugPermissionsPage() {
  const { user, canAccessModule, refreshUser } = useAuth();
  const { data: allUsers = [] } = useUsers();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isMigrating, setIsMigrating] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState<string>("");

  if (!user) {
    return <div className="container mx-auto p-6">Please log in to view this page</div>;
  }

  // Define the module mapping from sidebar
  const moduleMap: Record<string, string> = {
    '/pupils': 'pupils',
    '/pupil-history': 'pupils',
    '/pupils/promote': 'pupils',
    '/classes': 'classes',
    '/staff': 'staff',
    '/subjects': 'subjects',
    '/fees': 'fees',
    '/fees/collection': 'fees',
    '/fees/collect': 'fees',
    '/exams': 'exams',
    '/events': 'events',
    '/attendance': 'attendance',
    '/academic-years': 'academic_years',
    '/users': 'users',
    '/banking/list': 'banking',
    '/banking': 'banking',
    '/bulk-sms': 'bulk_sms',
    '/notifications': 'notifications',
    '/procurement': 'procurement',
    '/procurement/items': 'procurement',
    '/procurement/purchases': 'procurement',
    '/procurement/budget': 'procurement',
    '/requirements': 'requirements',
    '/requirement-tracking': 'requirements',
    '/uniforms': 'uniforms',
    '/uniform-tracking': 'uniforms',
    '/about-school': 'settings',
    '/admin/photos': 'settings',
    '/admin/commentary-box': 'settings',
  };

  const uniqueModules = Array.from(new Set(Object.values(moduleMap)));

  const copyUserData = () => {
    navigator.clipboard.writeText(JSON.stringify(user, null, 2));
  };

  const handleRefreshUser = async () => {
    try {
      setIsRefreshing(true);
      await refreshUser();
      // Show a success message or reload the page to see changes
      alert('User data refreshed successfully! Reloading page...');
      window.location.reload();
    } catch (error) {
      console.error('Error refreshing user:', error);
      alert('Error refreshing user data. Check console for details.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Helper function to map legacy permissions to actions
  const mapLegacyPermissionToAction = (permission: 'view_only' | 'edit' | 'full_access', actionId: string): boolean => {
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

  const convertLegacyToGranular = async (targetUser?: SystemUser) => {
    const userToConvert = targetUser || user;
    
    if (!userToConvert || !userToConvert.modulePermissions || userToConvert.modulePermissions.length === 0) {
      alert('No legacy permissions to convert for this user');
      return;
    }

    try {
      setIsMigrating(true);
      
      // Convert legacy permissions to granular format
      const granularPermissions: ModulePermissions[] = [];
      
      userToConvert.modulePermissions.forEach(legacyPerm => {
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

      // Update user with granular permissions (keeping legacy for backward compatibility)
      await UsersService.updateUser(userToConvert.id, {
        granularPermissions: granularPermissions
      });

      alert(`Successfully converted ${granularPermissions.length} modules to granular permissions for ${userToConvert.firstName} ${userToConvert.lastName}!`);
      
      if (targetUser) {
        // If converting another user, don't refresh current user
        window.location.reload();
      } else {
        await handleRefreshUser();
      }
      
    } catch (error) {
      console.error('Error converting permissions:', error);
      alert('Error converting permissions. Check console for details.');
    } finally {
      setIsMigrating(false);
    }
  };

  const convertSelectedUser = async () => {
    if (!selectedUserId) {
      alert('Please select a user to convert');
      return;
    }
    
    const targetUser = allUsers.find(u => u.id === selectedUserId);
    if (!targetUser) {
      alert('Selected user not found');
      return;
    }
    
    await convertLegacyToGranular(targetUser);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Permission Debug Tool</h1>
          <p className="text-muted-foreground">
            Debug sidebar navigation permissions for current user
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefreshUser} variant="outline" disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing...' : 'Refresh User Data'}
          </Button>
          <Button onClick={copyUserData} variant="outline">
            Copy User Data
          </Button>
                      {user?.modulePermissions && user.modulePermissions.length > 0 && (
              <Button onClick={() => convertLegacyToGranular()} variant="default" disabled={isMigrating}>
                {isMigrating ? 'Converting...' : 'Convert to Granular Permissions'}
              </Button>
            )}
        </div>
      </div>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Current User Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Username:</strong> {user.username}
            </div>
            <div>
              <strong>Role:</strong> <Badge>{user.role}</Badge>
            </div>
            <div>
              <strong>Staff ID:</strong> {user.staffId || 'N/A'}
            </div>
            <div>
              <strong>Active:</strong> {user.isActive ? 'Yes' : 'No'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Tool: Convert Any User's Permissions */}
      {user?.role === 'Admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Admin Tool: Convert User Permissions
            </CardTitle>
            <CardDescription>
              Convert any staff user's legacy permissions to granular permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Staff User to Convert:</label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a staff user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers
                      .filter(u => u.role === 'Staff' && u.modulePermissions && u.modulePermissions.length > 0)
                      .map(staffUser => (
                        <SelectItem key={staffUser.id} value={staffUser.id}>
                          {staffUser.firstName} {staffUser.lastName} ({staffUser.username})
                          {staffUser.granularPermissions && staffUser.granularPermissions.length > 0 
                            ? ' - Already has granular permissions' 
                            : ' - Legacy permissions only'
                          }
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
              
              {selectedUserId && (
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Selected User Details:</h4>
                  {(() => {
                    const selectedUser = allUsers.find(u => u.id === selectedUserId);
                    if (!selectedUser) return null;
                    
                    return (
                      <div className="text-sm space-y-1">
                        <p><strong>Name:</strong> {selectedUser.firstName} {selectedUser.lastName}</p>
                        <p><strong>Username:</strong> {selectedUser.username}</p>
                        <p><strong>Legacy Permissions:</strong> {selectedUser.modulePermissions?.length || 0} modules</p>
                        <p><strong>Granular Permissions:</strong> {selectedUser.granularPermissions?.length || 0} modules</p>
                        <div className="mt-2">
                          <strong>Current Permissions:</strong>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedUser.modulePermissions?.map(mp => (
                              <Badge key={mp.module} variant="outline" className="text-xs">
                                {mp.module}: {mp.permission}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              <Button 
                onClick={convertSelectedUser} 
                disabled={!selectedUserId || isMigrating}
                className="w-full"
              >
                {isMigrating ? 'Converting...' : 'Convert Selected User to Granular Permissions'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Module Access Check */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Module Access Check (What Sidebar Uses)
          </CardTitle>
          <CardDescription>
            This shows what the sidebar navigation uses to determine access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {uniqueModules.map((module) => {
              const hasAccess = canAccessModule(module);
              return (
                <div key={module} className="flex items-center justify-between p-3 border rounded">
                  <span className="font-medium">{module}</span>
                  {hasAccess ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Granular Permissions Check */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Granular Permissions Check
          </CardTitle>
          <CardDescription>
            This shows granular permissions that may have been granted
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {uniqueModules.map((module) => {
              const hasLegacyAccess = canAccessModule(module);
              const hasGranularAccess = user.granularPermissions?.some(
                gp => gp.moduleId === module && gp.pages.some(p => p.canAccess)
              );
              
              return (
                <div key={module} className="border rounded p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{module}</h4>
                    <div className="flex gap-2">
                      <Badge variant={hasLegacyAccess ? "default" : "outline"}>
                        Legacy: {hasLegacyAccess ? "Yes" : "No"}
                      </Badge>
                      <Badge variant={hasGranularAccess ? "default" : "outline"}>
                        Granular: {hasGranularAccess ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                  
                  {user.granularPermissions?.find(gp => gp.moduleId === module)?.pages.map(page => (
                    <div key={page.pageId} className="ml-4 text-sm">
                      <span className="font-mono">{page.pageId}</span>: {page.canAccess ? "✓" : "✗"}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Raw Permission Data */}
      <Card>
        <CardHeader>
          <CardTitle>Raw Permission Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Legacy Module Permissions:</h4>
              <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                {JSON.stringify(user.modulePermissions || null, null, 2)}
              </pre>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Granular Permissions:</h4>
              <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                {JSON.stringify(user.granularPermissions || null, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            System Status & Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">✅ Automatic Permission Conversion Enabled</h4>
              <p className="text-sm text-green-700">
                All new users created from now on will automatically have both legacy and granular permissions. 
                The sidebar navigation issue has been permanently resolved for future users.
              </p>
            </div>
            
            <div className="space-y-2 text-sm">
              <h4 className="font-medium">Troubleshooting Steps for Existing Users:</h4>
              <p><strong>1.</strong> Use the "Admin Tool" above to convert existing staff users</p>
              <p><strong>2.</strong> Check if the user has granular permissions but no legacy permissions</p>
              <p><strong>3.</strong> Verify that the canAccessModule function is checking granular permissions</p>
              <p><strong>4.</strong> Ensure the user account was saved properly with the new permissions</p>
              <p><strong>5.</strong> Ask the user to log out and log back in after conversion</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 