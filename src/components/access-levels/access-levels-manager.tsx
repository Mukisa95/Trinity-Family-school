'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Shield, Users, Settings } from 'lucide-react';
import { useAccessLevels, useCreateAccessLevel, useUpdateAccessLevel, useDeleteAccessLevel, useInitializePredefinedLevels } from '@/lib/hooks/use-access-levels';
import { AccessLevel, CreateAccessLevelData, UpdateAccessLevelData, PREDEFINED_ACCESS_LEVELS } from '@/types/access-levels';
import { GranularPermissionsEditor } from '@/components/users/granular-permissions-editor';
import { MODULE_ACTIONS } from '@/types/permissions';
import { ActionGuard } from '@/components/auth/action-guard';

export function AccessLevelsManager() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<AccessLevel | null>(null);
  const [selectedPredefinedLevel, setSelectedPredefinedLevel] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState<CreateAccessLevelData>({
    name: '',
    description: '',
    isDefault: false,
    modulePermissions: []
  });

  // Queries and mutations
  const { data: accessLevels, isLoading } = useAccessLevels();
  const createAccessLevelMutation = useCreateAccessLevel();
  const updateAccessLevelMutation = useUpdateAccessLevel();
  const deleteAccessLevelMutation = useDeleteAccessLevel();
  const initializePredefinedLevelsMutation = useInitializePredefinedLevels();

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      isDefault: false,
      modulePermissions: []
    });
    setSelectedPredefinedLevel('');
  };

  const handleCreateFromPredefined = () => {
    if (!selectedPredefinedLevel) return;
    
    const predefinedLevel = PREDEFINED_ACCESS_LEVELS[selectedPredefinedLevel as keyof typeof PREDEFINED_ACCESS_LEVELS];
    if (predefinedLevel) {
      setFormData({
        name: predefinedLevel.name,
        description: predefinedLevel.description,
        isDefault: false,
        modulePermissions: predefinedLevel.modulePermissions
      });
    }
  };

  const handleCreateAccessLevel = async () => {
    if (!formData.name || !formData.description) {
      toast({
        variant: "destructive",
        title: "Missing Fields",
        description: "Please fill in all required fields."
      });
      return;
    }

    try {
      await createAccessLevelMutation.mutateAsync(formData);
      toast({
        title: "Access Level Created",
        description: `Access level "${formData.name}" has been created successfully.`
      });
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create access level."
      });
    }
  };

  const handleEditAccessLevel = (level: AccessLevel) => {
    setEditingLevel(level);
    setFormData({
      name: level.name,
      description: level.description,
      isDefault: level.isDefault,
      modulePermissions: level.modulePermissions
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateAccessLevel = async () => {
    if (!editingLevel || !formData.name || !formData.description) {
      toast({
        variant: "destructive",
        title: "Missing Fields",
        description: "Please fill in all required fields."
      });
      return;
    }

    try {
      const updateData: UpdateAccessLevelData = {
        name: formData.name,
        description: formData.description,
        isDefault: formData.isDefault,
        modulePermissions: formData.modulePermissions
      };

      await updateAccessLevelMutation.mutateAsync({
        id: editingLevel.id,
        data: updateData
      });
      
      toast({
        title: "Access Level Updated",
        description: `Access level "${formData.name}" has been updated successfully.`
      });
      setIsEditDialogOpen(false);
      setEditingLevel(null);
      resetForm();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update access level."
      });
    }
  };

  const handleDeleteAccessLevel = async (level: AccessLevel) => {
    if (confirm(`Are you sure you want to delete the access level "${level.name}"?`)) {
      try {
        await deleteAccessLevelMutation.mutateAsync(level.id);
        toast({
          title: "Access Level Deleted",
          description: `Access level "${level.name}" has been deleted.`
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to delete access level."
        });
      }
    }
  };

  const handleInitializePredefined = async () => {
    try {
      await initializePredefinedLevelsMutation.mutateAsync();
      toast({
        title: "Predefined Levels Initialized",
        description: "Predefined access levels have been created successfully."
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to initialize predefined levels."
      });
    }
  };

  const getModuleCount = (level: AccessLevel) => {
    return level.modulePermissions.length;
  };

  const getPermissionCount = (level: AccessLevel) => {
    return level.modulePermissions.reduce((total, module) => {
      return total + module.pages.reduce((pageTotal, page) => {
        return pageTotal + page.actions.filter(action => action.allowed).length;
      }, 0);
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading access levels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Access Levels</h2>
          <p className="text-muted-foreground">
            Manage access levels to simplify user permission assignment
          </p>
        </div>
        <div className="flex gap-2">
          <ActionGuard module="users" page="list" action="manage_permissions">
            <Button
              variant="outline"
              onClick={handleInitializePredefined}
              disabled={initializePredefinedLevelsMutation.isPending}
            >
              <Settings className="h-4 w-4 mr-2" />
              Initialize Predefined
            </Button>
          </ActionGuard>
          <ActionGuard module="users" page="list" action="create_user">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Access Level
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Access Level</DialogTitle>
                  <DialogDescription>
                    Create a new access level with predefined permissions
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* Predefined Level Selection */}
                  <div className="space-y-2">
                    <Label>Start with Predefined Level (Optional)</Label>
                    <Select value={selectedPredefinedLevel} onValueChange={setSelectedPredefinedLevel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a predefined level to start with" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PREDEFINED_ACCESS_LEVELS).map(([key, level]) => (
                          <SelectItem key={key} value={key}>
                            {level.name} - {level.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedPredefinedLevel && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCreateFromPredefined}
                      >
                        Load Predefined Level
                      </Button>
                    )}
                  </div>

                  {/* Basic Information */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Teacher, Accountant"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="isDefault">Default Level</Label>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="isDefault"
                          checked={formData.isDefault}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
                        />
                        <Label htmlFor="isDefault">Set as default for new users</Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe what this access level is for..."
                      rows={3}
                    />
                  </div>

                  {/* Permissions Editor */}
                  <div className="space-y-2">
                    <Label>Module Permissions</Label>
                    <GranularPermissionsEditor
                      permissions={formData.modulePermissions}
                      onChange={(permissions) => setFormData(prev => ({ ...prev, modulePermissions: permissions }))}
                      modules={Object.keys(MODULE_ACTIONS)}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreateDialogOpen(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateAccessLevel}
                      disabled={createAccessLevelMutation.isPending}
                    >
                      {createAccessLevelMutation.isPending ? 'Creating...' : 'Create Access Level'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </ActionGuard>
        </div>
      </div>

      {/* Access Levels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accessLevels?.map((level) => (
          <Card key={level.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {level.name}
                    {level.isDefault && (
                      <Badge variant="secondary" className="text-xs">
                        Default
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {level.description}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <ActionGuard module="users" page="list" action="edit_user">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditAccessLevel(level)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </ActionGuard>
                  <ActionGuard module="users" page="list" action="delete_user">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAccessLevel(level)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </ActionGuard>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Modules</span>
                  <span className="font-medium">{getModuleCount(level)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Permissions</span>
                  <span className="font-medium">{getPermissionCount(level)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={level.isActive ? "default" : "secondary"}>
                    {level.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Access Level</DialogTitle>
            <DialogDescription>
              Update the access level permissions and settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Teacher, Accountant"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-isDefault">Default Level</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-isDefault"
                    checked={formData.isDefault}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
                  />
                  <Label htmlFor="edit-isDefault">Set as default for new users</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description *</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this access level is for..."
                rows={3}
              />
            </div>

            {/* Permissions Editor */}
            <div className="space-y-2">
              <Label>Module Permissions</Label>
              <GranularPermissionsEditor
                permissions={formData.modulePermissions}
                onChange={(permissions) => setFormData(prev => ({ ...prev, modulePermissions: permissions }))}
                modules={Object.keys(MODULE_ACTIONS)}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingLevel(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateAccessLevel}
                disabled={updateAccessLevelMutation.isPending}
              >
                {updateAccessLevelMutation.isPending ? 'Updating...' : 'Update Access Level'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
