'use client';

import * as React from 'react';
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from '@/components/common/glass-page-top-bar';
import { AccessLevelsManager } from '@/components/access-levels/access-levels-manager';
import { ActionGuard } from '@/components/auth/action-guard';
import { useInitializePredefinedLevels } from '@/lib/hooks/use-access-levels';
import { useToast } from '@/hooks/use-toast';
import { Settings, Plus, Loader2 } from 'lucide-react';

export default function AccessLevelsPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const initializePredefinedLevelsMutation = useInitializePredefinedLevels();

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

  return (
    <ActionGuard module="users" page="list" action="manage_permissions">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pb-12">
        <GlassPageTopBar
          title="Access Levels"
          subtitle="Create and manage access levels to simplify user permission assignment"
          backHref="/dashboard"
          backLabel="Dashboard"
          actions={
            <GlassActionDock>
              <ActionGuard module="users" page="list" action="manage_permissions">
                <GlassActionButton
                  label="Initialize Predefined"
                  icon={initializePredefinedLevelsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                  tone="slate"
                  disabled={initializePredefinedLevelsMutation.isPending}
                  onClick={handleInitializePredefined}
                />
              </ActionGuard>
              <ActionGuard module="users" page="list" action="create_user">
                <GlassActionButton
                  label="Create Access Level"
                  icon={<Plus className="h-4 w-4" />}
                  tone="blue"
                  onClick={() => setIsCreateDialogOpen(true)}
                />
              </ActionGuard>
            </GlassActionDock>
          }
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AccessLevelsManager 
            showHeader={false}
            isCreateDialogOpen={isCreateDialogOpen}
            onOpenCreateDialogChange={setIsCreateDialogOpen}
          />
        </div>
      </div>
    </ActionGuard>
  );
}
