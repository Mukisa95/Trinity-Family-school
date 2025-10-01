// Granular Permission System Types

export interface ActionPermission {
  action: string;
  allowed: boolean;
}

export interface PagePermission {
  page: string;
  canAccess: boolean;
  actions: ActionPermission[];
}

export interface ModulePermissions {
  module: string;
  pages: PagePermission[];
}

// Define all actions for each module
export const MODULE_ACTIONS = {
  pupils: {
    pages: [
      {
        page: 'list',
        path: '/pupils',
        name: 'Pupils List',
        actions: [
          { id: 'view_list', name: 'View pupils list', description: 'Can see the list of pupils' },
          { id: 'search_filter', name: 'Search and filter', description: 'Can search and filter pupils' },
          { id: 'export_data', name: 'Export data', description: 'Can export pupils data to Excel/CSV' },
          { id: 'view_details_link', name: 'View details link', description: 'Can click to view pupil details' },
          { id: 'edit_from_list', name: 'Edit from list', description: 'Can access edit option from list' },
          { id: 'delete_from_list', name: 'Delete from list', description: 'Can delete pupils from list' },
          { id: 'add_sibling_from_list', name: 'Add sibling from list', description: 'Can add siblings from list' },
          { id: 'bulk_actions', name: 'Bulk actions', description: 'Can select multiple pupils for bulk operations' },
          { id: 'view_class_link', name: 'View class details', description: 'Can navigate to class details' }
        ]
      },
      {
        page: 'create',
        path: '/pupils/new',
        name: 'Create Pupil',
        actions: [
          { id: 'access_page', name: 'Access create page', description: 'Can access the create pupil page' },
          { id: 'create_pupil', name: 'Create new pupil', description: 'Can submit new pupil form' },
          { id: 'add_guardian', name: 'Add guardian info', description: 'Can add guardian information' },
          { id: 'upload_photo', name: 'Upload photo', description: 'Can upload pupil photo' }
        ]
      },
      {
        page: 'edit',
        path: '/pupils/edit',
        name: 'Edit Pupil',
        actions: [
          { id: 'access_page', name: 'Access edit page', description: 'Can access the edit pupil page' },
          { id: 'edit_basic_info', name: 'Edit basic info', description: 'Can edit basic pupil information' },
          { id: 'edit_guardian', name: 'Edit guardian info', description: 'Can edit guardian information' },
          { id: 'change_photo', name: 'Change photo', description: 'Can change pupil photo' },
          { id: 'save_changes', name: 'Save changes', description: 'Can save edits to pupil record' }
        ]
      },
      {
        page: 'detail',
        path: '/pupil-detail',
        name: 'Pupil Details',
        actions: [
          { id: 'access_page', name: 'Access details page', description: 'Can view pupil details page' },
          { id: 'view_personal_info', name: 'View personal info', description: 'Can see personal information' },
          { id: 'view_academic_info', name: 'View academic info', description: 'Can see academic information' },
          { id: 'view_guardian_info', name: 'View guardian info', description: 'Can see guardian information' },
          { id: 'view_medical_info', name: 'View medical info', description: 'Can see medical information' },
          { id: 'view_exam_records', name: 'View exam records', description: 'Can see examination records' },
          { id: 'view_siblings', name: 'View siblings', description: 'Can see sibling information' },
          { id: 'fee_collection', name: 'Fee collection', description: 'Can access fee collection' },
          { id: 'manage_assignments', name: 'Manage fee assignments', description: 'Can manage fee assignments' },
          { id: 'uniform_tracking', name: 'Uniform tracking', description: 'Can access uniform tracking' },
          { id: 'requirement_tracking', name: 'Requirement tracking', description: 'Can access requirement tracking' },
          { id: 'print_id_card', name: 'Print ID card', description: 'Can print student ID card' },
          { id: 'edit_details', name: 'Edit details', description: 'Can edit from details page' },
          { id: 'change_status', name: 'Change status', description: 'Can change pupil status' },
          { id: 'manage_id_codes', name: 'Manage ID codes', description: 'Can manage additional IDs' },
          { id: 'add_sibling', name: 'Add sibling', description: 'Can add new sibling' },
          { id: 'delete_pupil', name: 'Delete pupil', description: 'Can delete pupil record' },
          { id: 'view_status_history', name: 'View status history', description: 'Can see status change history' },
          { id: 'view_promotion_history', name: 'View promotion history', description: 'Can see promotion history' }
        ]
      },
      {
        page: 'promote',
        path: '/pupils/promote',
        name: 'Promote Pupils',
        actions: [
          { id: 'access_page', name: 'Access promote page', description: 'Can access promotion page' },
          { id: 'select_pupils', name: 'Select pupils', description: 'Can select pupils for promotion' },
          { id: 'promote_pupils', name: 'Promote pupils', description: 'Can promote pupils to higher class' },
          { id: 'demote_pupils', name: 'Demote pupils', description: 'Can demote pupils to lower class' },
          { id: 'transfer_pupils', name: 'Transfer pupils', description: 'Can transfer pupils between classes' }
        ]
      }
    ]
  },
  fees: {
    pages: [
      {
        page: 'list',
        path: '/fees',
        name: 'Fee Structures',
        actions: [
          { id: 'view_list', name: 'View fee structures', description: 'Can see fee structure list' },
          { id: 'create_structure', name: 'Create fee structure', description: 'Can create new fee structures' },
          { id: 'edit_structure', name: 'Edit fee structure', description: 'Can edit fee structures' },
          { id: 'delete_structure', name: 'Delete fee structure', description: 'Can delete fee structures' },
          { id: 'manage_adjustments', name: 'Manage adjustments', description: 'Can manage fee adjustments' },
          { id: 'view_reports', name: 'View reports', description: 'Can view fee reports' }
        ]
      },
      {
        page: 'collection',
        path: '/fees/collection',
        name: 'Fee Collection',
        actions: [
          { id: 'access_page', name: 'Access collection page', description: 'Can access fee collection' },
          { id: 'search_pupils', name: 'Search pupils', description: 'Can search for pupils' },
          { id: 'view_balance', name: 'View balance', description: 'Can view fee balances' },
          { id: 'collect_fees', name: 'Collect fees', description: 'Can collect fee payments' }
        ]
      },
      {
        page: 'collect',
        path: '/fees/collect',
        name: 'Collect Payment',
        actions: [
          { id: 'access_page', name: 'Access payment page', description: 'Can access payment collection' },
          { id: 'record_payment', name: 'Record payment', description: 'Can record fee payments' },
          { id: 'print_receipt', name: 'Print receipt', description: 'Can print payment receipts' },
          { id: 'revert_payment', name: 'Revert payment', description: 'Can revert payments' },
          { id: 'view_history', name: 'View payment history', description: 'Can view payment history' }
        ]
      }
    ]
  },
  exams: {
    pages: [
      {
        page: 'list',
        path: '/exams',
        name: 'Exams List',
        actions: [
          { id: 'view_list', name: 'View exams', description: 'Can see exam list' },
          { id: 'create_exam', name: 'Create exam', description: 'Can create new exams' },
          { id: 'edit_exam', name: 'Edit exam', description: 'Can edit exam details' },
          { id: 'delete_exam', name: 'Delete exam', description: 'Can delete exams' },
          { id: 'manage_types', name: 'Manage exam types', description: 'Can manage exam types' }
        ]
      },
      {
        page: 'results',
        path: '/exams/results',
        name: 'Exam Results',
        actions: [
          { id: 'view_results', name: 'View results', description: 'Can view exam results' },
          { id: 'enter_results', name: 'Enter results', description: 'Can enter exam results' },
          { id: 'edit_results', name: 'Edit results', description: 'Can edit exam results' },
          { id: 'publish_results', name: 'Publish results', description: 'Can publish results' },
          { id: 'generate_reports', name: 'Generate reports', description: 'Can generate result reports' },
          { id: 'print_reports', name: 'Print reports', description: 'Can print report cards' }
        ]
      }
    ]
  },
  staff: {
    pages: [
      {
        page: 'list',
        path: '/staff',
        name: 'Staff List',
        actions: [
          { id: 'view_list', name: 'View staff list', description: 'Can see staff members' },
          { id: 'create_staff', name: 'Create staff', description: 'Can add new staff' },
          { id: 'edit_staff', name: 'Edit staff', description: 'Can edit staff information' },
          { id: 'delete_staff', name: 'Delete staff', description: 'Can delete staff records' },
          { id: 'assign_roles', name: 'Assign roles', description: 'Can assign staff roles' }
        ]
      }
    ]
  },
  classes: {
    pages: [
      {
        page: 'list',
        path: '/classes',
        name: 'Classes List',
        actions: [
          { id: 'view_list', name: 'View classes', description: 'Can see class list' },
          { id: 'create_class', name: 'Create class', description: 'Can create new classes' },
          { id: 'edit_class', name: 'Edit class', description: 'Can edit class details' },
          { id: 'delete_class', name: 'Delete class', description: 'Can delete classes' },
          { id: 'assign_teachers', name: 'Assign teachers', description: 'Can assign class teachers' },
          { id: 'assign_subjects', name: 'Assign subjects', description: 'Can assign subjects to classes' }
        ]
      },
      {
        page: 'detail',
        path: '/class-detail',
        name: 'Class Details',
        actions: [
          { id: 'view_details', name: 'View details', description: 'Can view class details' },
          { id: 'view_pupils', name: 'View pupils', description: 'Can see pupils in class' },
          { id: 'manage_subjects', name: 'Manage subjects', description: 'Can manage class subjects' },
          { id: 'view_statistics', name: 'View statistics', description: 'Can view class statistics' }
        ]
      }
    ]
  },
  attendance: {
    pages: [
      {
        page: 'record',
        path: '/attendance',
        name: 'Record Attendance',
        actions: [
          { id: 'view_page', name: 'View attendance page', description: 'Can access attendance page' },
          { id: 'record_attendance', name: 'Record attendance', description: 'Can mark attendance' },
          { id: 'edit_attendance', name: 'Edit attendance', description: 'Can edit attendance records' },
          { id: 'view_reports', name: 'View reports', description: 'Can view attendance reports' },
          { id: 'export_data', name: 'Export data', description: 'Can export attendance data' }
        ]
      }
    ]
  },
  subjects: {
    pages: [
      {
        page: 'list',
        path: '/subjects',
        name: 'Subjects List',
        actions: [
          { id: 'view_list', name: 'View subjects', description: 'Can see subject list' },
          { id: 'create_subject', name: 'Create subject', description: 'Can create new subjects' },
          { id: 'edit_subject', name: 'Edit subject', description: 'Can edit subject details' },
          { id: 'delete_subject', name: 'Delete subject', description: 'Can delete subjects' }
        ]
      }
    ]
  },
  academic_years: {
    pages: [
      {
        page: 'list',
        path: '/academic-years',
        name: 'Academic Years',
        actions: [
          { id: 'view_list', name: 'View academic years', description: 'Can see academic years' },
          { id: 'create_year', name: 'Create academic year', description: 'Can create new academic years' },
          { id: 'edit_year', name: 'Edit academic year', description: 'Can edit academic year details' },
          { id: 'delete_year', name: 'Delete academic year', description: 'Can delete academic years' },
          { id: 'activate_year', name: 'Activate year', description: 'Can set active academic year' },
          { id: 'lock_year', name: 'Lock year', description: 'Can lock academic years' },
          { id: 'manage_terms', name: 'Manage terms', description: 'Can manage terms within years' }
        ]
      }
    ]
  },
  banking: {
    pages: [
      {
        page: 'list',
        path: '/banking',
        name: 'Banking List',
        actions: [
          { id: 'view_accounts', name: 'View accounts', description: 'Can see pupil accounts' },
          { id: 'create_account', name: 'Create account', description: 'Can create new accounts' },
          { id: 'view_transactions', name: 'View transactions', description: 'Can see transactions' },
          { id: 'make_deposit', name: 'Make deposit', description: 'Can make deposits' },
          { id: 'make_withdrawal', name: 'Make withdrawal', description: 'Can make withdrawals' },
          { id: 'view_statements', name: 'View statements', description: 'Can view account statements' },
          { id: 'print_statements', name: 'Print statements', description: 'Can print statements' }
        ]
      },
      {
        page: 'loans',
        path: '/banking/loans',
        name: 'Loans Management',
        actions: [
          { id: 'view_loans', name: 'View loans', description: 'Can see loans' },
          { id: 'create_loan', name: 'Create loan', description: 'Can create new loans' },
          { id: 'process_repayment', name: 'Process repayment', description: 'Can process loan repayments' },
          { id: 'view_loan_reports', name: 'View reports', description: 'Can view loan reports' }
        ]
      }
    ]
  },
  users: {
    pages: [
      {
        page: 'list',
        path: '/users',
        name: 'Users List',
        actions: [
          { id: 'view_users', name: 'View users', description: 'Can see user list' },
          { id: 'create_user', name: 'Create user', description: 'Can create new users' },
          { id: 'edit_user', name: 'Edit user', description: 'Can edit user permissions' },
          { id: 'delete_user', name: 'Delete user', description: 'Can delete users' },
          { id: 'reset_password', name: 'Reset password', description: 'Can reset user passwords' },
          { id: 'manage_permissions', name: 'Manage permissions', description: 'Can manage user permissions' }
        ]
      }
    ]
  },
  notifications: {
    pages: [
      {
        page: 'list',
        path: '/notifications',
        name: 'Notifications',
        actions: [
          { id: 'view_notifications', name: 'View notifications', description: 'Can see notifications' },
          { id: 'send_notification', name: 'Send notification', description: 'Can send notifications' },
          { id: 'manage_groups', name: 'Manage groups', description: 'Can manage notification groups' },
          { id: 'view_history', name: 'View history', description: 'Can view notification history' },
          { id: 'manage_templates', name: 'Manage templates', description: 'Can manage notification templates' }
        ]
      }
    ]
  },
  bulk_sms: {
    pages: [
      {
        page: 'send',
        path: '/bulk-sms',
        name: 'Bulk SMS',
        actions: [
          { id: 'view_page', name: 'Access bulk SMS', description: 'Can access bulk SMS page' },
          { id: 'send_sms', name: 'Send SMS', description: 'Can send bulk SMS messages' },
          { id: 'view_history', name: 'View history', description: 'Can view SMS history' },
          { id: 'manage_templates', name: 'Manage templates', description: 'Can manage SMS templates' },
          { id: 'view_balance', name: 'View balance', description: 'Can view SMS credit balance' }
        ]
      }
    ]
  },
  procurement: {
    pages: [
      {
        page: 'items',
        path: '/procurement/items',
        name: 'Procurement Items',
        actions: [
          { id: 'view_items', name: 'View items', description: 'Can see procurement items' },
          { id: 'create_item', name: 'Create item', description: 'Can create new items' },
          { id: 'edit_item', name: 'Edit item', description: 'Can edit items' },
          { id: 'delete_item', name: 'Delete item', description: 'Can delete items' }
        ]
      },
      {
        page: 'purchases',
        path: '/procurement/purchases',
        name: 'Purchases',
        actions: [
          { id: 'view_purchases', name: 'View purchases', description: 'Can see purchases' },
          { id: 'create_purchase', name: 'Create purchase', description: 'Can record new purchases' },
          { id: 'edit_purchase', name: 'Edit purchase', description: 'Can edit purchase records' },
          { id: 'delete_purchase', name: 'Delete purchase', description: 'Can delete purchases' },
          { id: 'approve_purchase', name: 'Approve purchase', description: 'Can approve purchases' }
        ]
      },
      {
        page: 'budget',
        path: '/procurement/budget',
        name: 'Budget Management',
        actions: [
          { id: 'view_budget', name: 'View budget', description: 'Can see budgets' },
          { id: 'create_budget', name: 'Create budget', description: 'Can create budgets' },
          { id: 'edit_budget', name: 'Edit budget', description: 'Can edit budgets' },
          { id: 'approve_budget', name: 'Approve budget', description: 'Can approve budgets' },
          { id: 'view_comparison', name: 'View comparison', description: 'Can view budget vs actual' }
        ]
      }
    ]
  },
  uniforms: {
    pages: [
      {
        page: 'list',
        path: '/uniforms',
        name: 'Uniforms List',
        actions: [
          { id: 'view_uniforms', name: 'View uniforms', description: 'Can see uniform items' },
          { id: 'create_uniform', name: 'Create uniform', description: 'Can add new uniforms' },
          { id: 'edit_uniform', name: 'Edit uniform', description: 'Can edit uniform details' },
          { id: 'delete_uniform', name: 'Delete uniform', description: 'Can delete uniforms' }
        ]
      },
      {
        page: 'tracking',
        path: '/uniform-tracking',
        name: 'Uniform Tracking',
        actions: [
          { id: 'view_tracking', name: 'View tracking', description: 'Can see uniform tracking' },
          { id: 'record_payment', name: 'Record payment', description: 'Can record uniform payments' },
          { id: 'record_collection', name: 'Record collection', description: 'Can record uniform collection' },
          { id: 'view_history', name: 'View history', description: 'Can view tracking history' }
        ]
      }
    ]
  },
  requirements: {
    pages: [
      {
        page: 'list',
        path: '/requirements',
        name: 'Requirements List',
        actions: [
          { id: 'view_requirements', name: 'View requirements', description: 'Can see requirement items' },
          { id: 'create_requirement', name: 'Create requirement', description: 'Can add new requirements' },
          { id: 'edit_requirement', name: 'Edit requirement', description: 'Can edit requirement details' },
          { id: 'delete_requirement', name: 'Delete requirement', description: 'Can delete requirements' }
        ]
      },
      {
        page: 'tracking',
        path: '/requirement-tracking',
        name: 'Requirement Tracking',
        actions: [
          { id: 'view_tracking', name: 'View tracking', description: 'Can see requirement tracking' },
          { id: 'record_payment', name: 'Record payment', description: 'Can record requirement payments' },
          { id: 'record_release', name: 'Record release', description: 'Can record requirement release' },
          { id: 'view_history', name: 'View history', description: 'Can view tracking history' }
        ]
      }
    ]
  },
  settings: {
    pages: [
      {
        page: 'school',
        path: '/about-school',
        name: 'School Settings',
        actions: [
          { id: 'view_settings', name: 'View settings', description: 'Can see school settings' },
          { id: 'edit_general', name: 'Edit general info', description: 'Can edit general information' },
          { id: 'edit_contact', name: 'Edit contact', description: 'Can edit contact details' },
          { id: 'edit_vision', name: 'Edit vision/mission', description: 'Can edit vision and mission' },
          { id: 'manage_logo', name: 'Manage logo', description: 'Can manage school logo' }
        ]
      },
      {
        page: 'photos',
        path: '/admin/photos',
        name: 'Photo Management',
        actions: [
          { id: 'view_photos', name: 'View photos', description: 'Can see photos' },
          { id: 'upload_photos', name: 'Upload photos', description: 'Can upload new photos' },
          { id: 'edit_photos', name: 'Edit photos', description: 'Can edit photo details' },
          { id: 'delete_photos', name: 'Delete photos', description: 'Can delete photos' },
          { id: 'set_primary', name: 'Set primary', description: 'Can set primary photos' }
        ]
      }
    ]
  },
  reports: {
    pages: [
      {
        page: 'dashboard',
        path: '/',
        name: 'Dashboard',
        actions: [
          { id: 'view_dashboard', name: 'View dashboard', description: 'Can see dashboard' },
          { id: 'view_statistics', name: 'View statistics', description: 'Can see system statistics' },
          { id: 'view_charts', name: 'View charts', description: 'Can see analytical charts' }
        ]
      },
      {
        page: 'reports',
        path: '/reports',
        name: 'Reports Center',
        actions: [
          { id: 'view_reports', name: 'View reports', description: 'Can see reports' },
          { id: 'generate_reports', name: 'Generate reports', description: 'Can generate new reports' },
          { id: 'export_reports', name: 'Export reports', description: 'Can export reports' },
          { id: 'print_reports', name: 'Print reports', description: 'Can print reports' }
        ]
      }
    ]
  },
  pupil_history: {
    pages: [
      {
        page: 'list',
        path: '/pupil-history',
        name: 'Pupil History',
        actions: [
          { id: 'view_history', name: 'View pupil history', description: 'Can see complete pupil history and timelines' },
          { id: 'search_filter', name: 'Search and filter', description: 'Can search and filter pupil history records' },
          { id: 'view_personal_info', name: 'View personal info', description: 'Can see personal information in history' },
          { id: 'view_class_history', name: 'View class history', description: 'Can see class progression history' },
          { id: 'view_status_history', name: 'View status history', description: 'Can see status change history' },
          { id: 'view_achievements', name: 'View achievements', description: 'Can see pupil achievements' },
          { id: 'view_fees_history', name: 'View fees history', description: 'Can see fees payment history' },
          { id: 'export_history', name: 'Export history', description: 'Can export pupil history data' },
          { id: 'expand_details', name: 'Expand details', description: 'Can expand and view detailed information' },
          { id: 'view_academic_summary', name: 'View academic summary', description: 'Can see academic performance summary' }
        ]
      }
    ]
  },
  events: {
    pages: [
      {
        page: 'calendar',
        path: '/events',
        name: 'Events & Calendar',
        actions: [
          { id: 'view_calendar', name: 'View calendar', description: 'Can see events calendar' },
          { id: 'view_events', name: 'View events', description: 'Can see event list' },
          { id: 'create_event', name: 'Create event', description: 'Can create new events' },
          { id: 'edit_event', name: 'Edit event', description: 'Can edit event details' },
          { id: 'delete_event', name: 'Delete event', description: 'Can delete events' },
          { id: 'view_event_details', name: 'View event details', description: 'Can see detailed event information' },
          { id: 'manage_event_types', name: 'Manage event types', description: 'Can manage event categories and types' },
          { id: 'schedule_recurring', name: 'Schedule recurring events', description: 'Can create recurring events' },
          { id: 'invite_participants', name: 'Invite participants', description: 'Can invite people to events' },
          { id: 'export_calendar', name: 'Export calendar', description: 'Can export calendar data' },
          { id: 'view_attendance', name: 'View event attendance', description: 'Can see who attended events' },
          { id: 'send_reminders', name: 'Send reminders', description: 'Can send event reminders' }
        ]
      }
    ]
  },
  promotion: {
    pages: [
      {
        page: 'promote',
        path: '/pupils/promote',
        name: 'Promote/Demote Pupils',
        actions: [
          { id: 'view_page', name: 'View promotion page', description: 'Can access the promotion/demotion page' },
          { id: 'select_pupils', name: 'Select pupils', description: 'Can select pupils for promotion/demotion' },
          { id: 'promote_pupils', name: 'Promote pupils', description: 'Can promote pupils to next class' },
          { id: 'demote_pupils', name: 'Demote pupils', description: 'Can demote pupils to previous class' },
          { id: 'bulk_promote', name: 'Bulk promote', description: 'Can promote multiple pupils at once' },
          { id: 'bulk_demote', name: 'Bulk demote', description: 'Can demote multiple pupils at once' },
          { id: 'view_promotion_history', name: 'View promotion history', description: 'Can see historical promotion data' },
          { id: 'undo_promotion', name: 'Undo promotion', description: 'Can reverse recent promotions' },
          { id: 'transfer_pupils', name: 'Transfer pupils', description: 'Can transfer pupils between classes' },
          { id: 'view_criteria', name: 'View promotion criteria', description: 'Can see promotion requirements' },
          { id: 'export_promotion_data', name: 'Export promotion data', description: 'Can export promotion reports' }
        ]
      }
    ]
  }
} as const;

export type ModuleId = keyof typeof MODULE_ACTIONS; 