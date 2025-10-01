import { SystemUser, ModulePermissions, PagePermission, ActionPermission, UserRole } from '@/types';
import { MODULE_ACTIONS } from '@/types/permissions';

export class GranularPermissionService {
  /**
   * Check if user can access a specific page
   */
  static canAccessPage(user: SystemUser | null, moduleId: string, pageId: string): boolean {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    if (user.role === 'Parent') return false; // Parents use a different system
    
    // Check granular permissions first
    if (user.granularPermissions) {
      const modulePerms = user.granularPermissions.find(m => m.moduleId === moduleId);
      if (modulePerms) {
        const pagePerms = modulePerms.pages.find(p => p.pageId === pageId);
        return pagePerms?.canAccess || false;
      }
    }
    
    // Fallback to legacy permissions
    if (user.modulePermissions) {
      const modulePerms = user.modulePermissions.find(m => m.module === moduleId);
      return !!modulePerms;
    }
    
    return false;
  }
  
  /**
   * Check if user can perform a specific action on a page
   */
  static canPerformAction(user: SystemUser | null, moduleId: string, pageId: string, actionId: string): boolean {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    if (user.role === 'Parent') return false;
    
    // Check granular permissions
    if (user.granularPermissions) {
      const modulePerms = user.granularPermissions.find(m => m.moduleId === moduleId);
      if (modulePerms) {
        const pagePerms = modulePerms.pages.find(p => p.pageId === pageId);
        if (pagePerms && pagePerms.canAccess) {
          const actionPerm = pagePerms.actions.find(a => a.actionId === actionId);
          return actionPerm?.allowed || false;
        }
      }
    }
    
    // Fallback to legacy permissions with mapping
    if (user.modulePermissions) {
      const modulePerms = user.modulePermissions.find(m => m.module === moduleId);
      if (modulePerms) {
        // Map legacy permissions to actions
        return this.mapLegacyPermissionToAction(modulePerms.permission, actionId);
      }
    }
    
    return false;
  }
  
  /**
   * Map legacy permissions to specific actions
   */
  private static mapLegacyPermissionToAction(permission: 'view_only' | 'edit' | 'full_access', actionId: string): boolean {
    // Define which actions are allowed for each legacy permission level
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
  }
  
  /**
   * Get all permissions for a user in a structured format
   */
  static getAllPermissions(user: SystemUser | null) {
    if (!user) return {};
    if (user.role === 'Admin') {
      // Admin has all permissions
      const allPerms: any = {};
      Object.entries(MODULE_ACTIONS).forEach(([moduleId, module]) => {
        allPerms[moduleId] = {
          pages: module.pages.map(page => ({
            pageId: page.page,
            canAccess: true,
            actions: page.actions.map(action => ({
              actionId: action.id,
              allowed: true
            }))
          }))
        };
      });
      return allPerms;
    }
    
    // For staff, merge granular and legacy permissions
    const permissions: any = {};
    
    // Process granular permissions
    if (user.granularPermissions) {
      user.granularPermissions.forEach(modulePerm => {
        permissions[modulePerm.moduleId] = modulePerm;
      });
    }
    
    // Process legacy permissions
    if (user.modulePermissions) {
      user.modulePermissions.forEach(modulePerm => {
        if (!permissions[modulePerm.module]) {
          // Convert legacy to granular format
          const moduleActions = MODULE_ACTIONS[modulePerm.module as keyof typeof MODULE_ACTIONS];
          if (moduleActions) {
            permissions[modulePerm.module] = {
              moduleId: modulePerm.module,
              pages: moduleActions.pages.map(page => ({
                pageId: page.page,
                canAccess: true, // Legacy permissions grant access to all pages in module
                actions: page.actions.map(action => ({
                  actionId: action.id,
                  allowed: this.mapLegacyPermissionToAction(modulePerm.permission, action.id)
                }))
              }))
            };
          }
        }
      });
    }
    
    return permissions;
  }
  
  /**
   * Initialize default permissions for a new user
   */
  static getDefaultPermissions(role: UserRole): ModulePermissions[] {
    if (role === 'Admin' || role === 'Parent') return [];
    
    // Default minimal permissions for new staff
    return [
      {
        moduleId: 'pupils',
        pages: [
          {
            pageId: 'list',
            canAccess: true,
            actions: [
              { actionId: 'view_list', allowed: true },
              { actionId: 'search_filter', allowed: true }
            ]
          }
        ]
      }
    ];
  }
} 