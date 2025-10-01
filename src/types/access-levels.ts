// Access Level System Types

export interface AccessLevel {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
  modulePermissions: ModulePermissions[];
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CreateAccessLevelData {
  name: string;
  description: string;
  isDefault?: boolean;
  modulePermissions: ModulePermissions[];
}

export interface UpdateAccessLevelData {
  name?: string;
  description?: string;
  isDefault?: boolean;
  isActive?: boolean;
  modulePermissions?: ModulePermissions[];
}

// Predefined access levels for common roles
export const PREDEFINED_ACCESS_LEVELS = {
  TEACHER: {
    name: 'Teacher',
    description: 'Standard teacher access with pupil management and attendance recording',
    modulePermissions: [
      {
        moduleId: 'pupils',
        pages: [
          {
            pageId: 'list',
            canAccess: true,
            actions: [
              { actionId: 'view_list', allowed: true },
              { actionId: 'search_filter', allowed: true },
              { actionId: 'view_details_link', allowed: true }
            ]
          },
          {
            pageId: 'detail',
            canAccess: true,
            actions: [
              { actionId: 'access_page', allowed: true },
              { actionId: 'view_personal_info', allowed: true },
              { actionId: 'view_academic_info', allowed: true },
              { actionId: 'view_guardian_info', allowed: true },
              { actionId: 'view_exam_records', allowed: true },
              { actionId: 'view_siblings', allowed: true }
            ]
          }
        ]
      },
      {
        moduleId: 'attendance',
        pages: [
          {
            pageId: 'record',
            canAccess: true,
            actions: [
              { actionId: 'view_page', allowed: true },
              { actionId: 'record_attendance', allowed: true },
              { actionId: 'edit_attendance', allowed: true }
            ]
          }
        ]
      },
      {
        moduleId: 'exams',
        pages: [
          {
            pageId: 'results',
            canAccess: true,
            actions: [
              { actionId: 'view_results', allowed: true },
              { actionId: 'enter_results', allowed: true },
              { actionId: 'edit_results', allowed: true }
            ]
          }
        ]
      }
    ]
  },
  ACCOUNTANT: {
    name: 'Accountant',
    description: 'Financial management access for fee collection and banking',
    modulePermissions: [
      {
        moduleId: 'fees',
        pages: [
          {
            pageId: 'list',
            canAccess: true,
            actions: [
              { actionId: 'view_list', allowed: true },
              { actionId: 'view_reports', allowed: true }
            ]
          },
          {
            pageId: 'collection',
            canAccess: true,
            actions: [
              { actionId: 'access_page', allowed: true },
              { actionId: 'search_pupils', allowed: true },
              { actionId: 'view_balance', allowed: true },
              { actionId: 'collect_fees', allowed: true }
            ]
          },
          {
            pageId: 'collect',
            canAccess: true,
            actions: [
              { actionId: 'access_page', allowed: true },
              { actionId: 'record_payment', allowed: true },
              { actionId: 'print_receipt', allowed: true },
              { actionId: 'view_history', allowed: true }
            ]
          }
        ]
      },
      {
        moduleId: 'banking',
        pages: [
          {
            pageId: 'list',
            canAccess: true,
            actions: [
              { actionId: 'view_accounts', allowed: true },
              { actionId: 'view_transactions', allowed: true },
              { actionId: 'make_deposit', allowed: true },
              { actionId: 'make_withdrawal', allowed: true },
              { actionId: 'view_statements', allowed: true },
              { actionId: 'print_statements', allowed: true }
            ]
          },
          {
            pageId: 'loans',
            canAccess: true,
            actions: [
              { actionId: 'view_loans', allowed: true },
              { actionId: 'create_loan', allowed: true },
              { actionId: 'process_repayment', allowed: true },
              { actionId: 'view_loan_reports', allowed: true }
            ]
          }
        ]
      }
    ]
  },
  ADMINISTRATOR: {
    name: 'Administrator',
    description: 'Administrative access with user management and system settings',
    modulePermissions: [
      {
        moduleId: 'users',
        pages: [
          {
            pageId: 'list',
            canAccess: true,
            actions: [
              { actionId: 'view_users', allowed: true },
              { actionId: 'create_user', allowed: true },
              { actionId: 'edit_user', allowed: true },
              { actionId: 'delete_user', allowed: true },
              { actionId: 'reset_password', allowed: true },
              { actionId: 'manage_permissions', allowed: true }
            ]
          }
        ]
      },
      {
        moduleId: 'staff',
        pages: [
          {
            pageId: 'list',
            canAccess: true,
            actions: [
              { actionId: 'view_list', allowed: true },
              { actionId: 'create_staff', allowed: true },
              { actionId: 'edit_staff', allowed: true },
              { actionId: 'delete_staff', allowed: true },
              { actionId: 'assign_roles', allowed: true }
            ]
          }
        ]
      },
      {
        moduleId: 'settings',
        pages: [
          {
            pageId: 'school',
            canAccess: true,
            actions: [
              { actionId: 'view_settings', allowed: true },
              { actionId: 'edit_general', allowed: true },
              { actionId: 'edit_contact', allowed: true },
              { actionId: 'edit_vision', allowed: true },
              { actionId: 'manage_logo', allowed: true }
            ]
          }
        ]
      }
    ]
  },
  PROCUREMENT_OFFICER: {
    name: 'Procurement Officer',
    description: 'Procurement and inventory management access',
    modulePermissions: [
      {
        moduleId: 'procurement',
        pages: [
          {
            pageId: 'items',
            canAccess: true,
            actions: [
              { actionId: 'view_items', allowed: true },
              { actionId: 'create_item', allowed: true },
              { actionId: 'edit_item', allowed: true },
              { actionId: 'delete_item', allowed: true }
            ]
          },
          {
            pageId: 'purchases',
            canAccess: true,
            actions: [
              { actionId: 'view_purchases', allowed: true },
              { actionId: 'create_purchase', allowed: true },
              { actionId: 'edit_purchase', allowed: true },
              { actionId: 'delete_purchase', allowed: true },
              { actionId: 'approve_purchase', allowed: true }
            ]
          },
          {
            pageId: 'budget',
            canAccess: true,
            actions: [
              { actionId: 'view_budget', allowed: true },
              { actionId: 'create_budget', allowed: true },
              { actionId: 'edit_budget', allowed: true },
              { actionId: 'view_comparison', allowed: true }
            ]
          }
        ]
      }
    ]
  }
} as const;
