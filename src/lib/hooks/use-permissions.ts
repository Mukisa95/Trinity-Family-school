import { useAuth } from '@/lib/contexts/auth-context';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';

export function usePermissions() {
  const { user, canAccessModule, canEdit, canDelete, canAccessPage, canPerformAction } = useAuth();

  return {
    // Legacy permission checks
    canAccessModule,
    canEdit,
    canDelete,
    
    // Granular permission checks
    canAccessPage,
    canPerformAction,
    
    // Helper functions
    isAdmin: () => user?.role === 'Admin',
    isStaff: () => user?.role === 'Staff',
    isParent: () => user?.role === 'Parent',
    
    // Get all permissions for current user
    getAllPermissions: () => GranularPermissionService.getAllPermissions(user),
    
    // Check multiple actions at once
    canPerformAnyAction: (module: string, page: string, actions: string[]) => {
      if (!user) return false;
      return actions.some(action => canPerformAction(module, page, action));
    },
    
    canPerformAllActions: (module: string, page: string, actions: string[]) => {
      if (!user) return false;
      return actions.every(action => canPerformAction(module, page, action));
    }
  };
} 