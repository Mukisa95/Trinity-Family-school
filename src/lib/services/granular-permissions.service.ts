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
    
    // Historical seeding is deliberately opt-in for non-admin users. Existing
    // broad/legacy Pupil permissions must never expose it accidentally.
    if (moduleId === 'pupils' && pageId === 'historical_seeding') return false;

    // DocX is admin-only by default. Non-admin staff can receive access only
    // through an explicit granular page grant above; legacy Reports access is
    // intentionally not broad enough to expose personalised pupil documents.
    if (moduleId === 'reports' && pageId === 'docx') return false;

    // Payroll is deliberately explicit-only. Salary information must never be
    // inherited from an ordinary Staff or Fees legacy module grant.
    if (moduleId === 'payroll') return false;

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
    
    // Historical seeding is deliberately opt-in for non-admin users. Existing
    // broad/legacy Pupil permissions must never expose it accidentally.
    if (moduleId === 'pupils' && pageId === 'historical_seeding') return false;

    if (moduleId === 'reports' && pageId === 'docx') return false;
    if (moduleId === 'payroll') return false;

    // Fallback to legacy permissions with mapping
    if (user.modulePermissions) {
      const modulePerms = user.modulePermissions.find(m => m.module === moduleId);
      if (modulePerms) {
        // For the reports/dashboard module, all view_* actions are allowed
        // when the user has any level of reports access via legacy permissions.
        // This ensures dashboard stats/charts granted via Module Permissions are visible.
        if (moduleId === 'reports' && pageId === 'dashboard' && actionId.startsWith('view_')) {
          return true;
        }
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
      'view_statistics', 'view_classes', 'view_history',
      // Dashboard view actions
      'view_dashboard', 'view_stat_total_pupils', 'view_stat_gender_breakdown',
      'view_stat_total_staff', 'view_stat_attendance_today',
      'view_chart_class_enrollment', 'view_chart_attendance', 'view_calendar_schedule',
      // Timetable view actions
      'view_timetable', 'view_live_tracker'
    ];
    
    const editActions = [
      ...viewOnlyActions,
      'create_pupil', 'edit_basic_info', 'edit_guardian', 'change_photo',
      'save_changes', 'add_guardian', 'upload_photo', 'select_pupils',
      'record_attendance', 'edit_attendance', 'enter_results', 'edit_results',
      'create_structure', 'edit_structure', 'record_payment', 'collect_fees',
      'create_exam', 'edit_exam', 'create_staff', 'edit_staff', 'create_class',
      'edit_class', 'assign_teachers', 'assign_subjects',
      'manage_streams',
      // Timetable edit actions
      'edit_timetable', 'manage_periods'
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
              pages: moduleActions.pages
                .filter(page => !(modulePerm.module === 'pupils' && page.page === 'historical_seeding'))
                .filter(page => !(modulePerm.module === 'reports' && page.page === 'docx'))
                .filter(page => modulePerm.module !== 'payroll')
                .map(page => ({
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
