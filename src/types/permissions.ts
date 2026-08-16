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
      },
      {
        page: 'enrollment_trends',
        path: '/enrollment-trends',
        name: 'Enrollment Trends',
        actions: [
          { id: 'access_page', name: 'Access trends page', description: 'Can access enrollment trends page' },
          { id: 'view_statistics', name: 'View statistics', description: 'Can view enrollment statistics' },
          { id: 'view_charts', name: 'View charts', description: 'Can view enrollment charts and graphs' },
          { id: 'filter_data', name: 'Filter data', description: 'Can filter trends by year/class/section' },
          { id: 'export_data', name: 'Export data', description: 'Can export trends data' }
        ]
      },
      {
        page: 'birthdays',
        path: '/birthdays',
        name: 'Birthdays',
        actions: [
          { id: 'access_page', name: 'Access birthdays page', description: 'Can open the pupil birthdays page' },
          { id: 'view_birthdays', name: 'View birthdays', description: 'Can view birthday matches for active pupils' },
          { id: 'change_view', name: 'Change view', description: 'Can switch between day, week, and month birthday views' },
          { id: 'navigate_periods', name: 'Navigate periods', description: 'Can move between previous and next birthday periods' }
        ]
      },
      {
        page: 'historical_seeding',
        path: '/pupils/historical-seeding',
        name: 'Historical Pupil Seeding',
        actions: [
          { id: 'access_page', name: 'Open seeding workspace', description: 'Can open the historical pupil seeding workspace' },
          { id: 'create_historical_pupil', name: 'Add historical pupils', description: 'Can add a pupil and their verified academic history' }
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
          { id: 'collect_fees', name: 'Collect fees', description: 'Can collect fee payments' },
          { id: 'send_communications', name: 'Send communications', description: 'Can send bulk SMS to parents' }
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
      },
      {
        page: 'analytics',
        path: '/fees/analytics',
        name: 'Collection Analytics',
        actions: [
          { id: 'access_page', name: 'Access analytics page', description: 'Can access collection analytics dashboard' },
          { id: 'view_statistics', name: 'View statistics', description: 'Can view collection statistics' },
          { id: 'view_by_class', name: 'View by class', description: 'Can view class breakdown' },
          { id: 'view_by_date', name: 'View by date', description: 'Can view date-based analysis' },
          { id: 'view_payment_details', name: 'View payment details', description: 'Can expand and view detailed payments' },
          { id: 'filter_data', name: 'Filter data', description: 'Can filter by year/term/period' },
          { id: 'refresh_data', name: 'Refresh data', description: 'Can manually refresh analytics data' }
        ]
      },
      {
        page: 'schoolpay_feed',
        path: '/accounts/schoolpay-feed',
        name: 'SchoolPay Live Feed',
        actions: [
          { id: 'access_page', name: 'Access SchoolPay Feed', description: 'Can view the SchoolPay Live Feed page' },
          { id: 'view_payments', name: 'View payment stream', description: 'Can see all incoming SchoolPay payments in real time' },
          { id: 'view_distribution', name: 'View fee distribution', description: 'Can expand and see how payments were distributed across fee items' },
          { id: 'navigate_to_pupil', name: 'Navigate to pupil fees', description: 'Can click through to a pupil\'s fee collection page' }
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
  payroll: {
    pages: [
      {
        page: 'overview',
        path: '/payroll',
        name: 'Staff Payroll',
        actions: [
          { id: 'view_payroll', name: 'View payroll overview', description: 'Can view staff salary summaries and due dates' },
          { id: 'view_salary_amounts', name: 'View salary amounts', description: 'Can see salary and allowance amounts' },
          { id: 'record_payment', name: 'Record salary payment', description: 'Can record staff salary payments' },
          { id: 'export_payroll', name: 'Export payroll', description: 'Can export payroll records' }
        ]
      },
      {
        page: 'setup',
        path: '/payroll/new',
        name: 'Set Up Staff Salary',
        actions: [
          { id: 'create_salary', name: 'Create salary profile', description: 'Can set up a staff salary and allowances' },
          { id: 'edit_salary', name: 'Edit salary schedule', description: 'Can change salary schedules and exceptions' },
          { id: 'manage_allowances', name: 'Manage allowances', description: 'Can add, edit, or end staff allowances' },
          { id: 'manage_exceptions', name: 'Manage skipped dates', description: 'Can skip specified salary dates or months' }
        ]
      },
      {
        page: 'detail',
        path: '/payroll/staff',
        name: 'Staff Salary Details',
        actions: [
          { id: 'view_payment_history', name: 'View payment history', description: 'Can view a staff member’s salary history' },
          { id: 'record_payment', name: 'Record salary payment', description: 'Can record a payment from staff salary details' },
          { id: 'increase_salary', name: 'Increase salary', description: 'Can schedule a salary increase' },
          { id: 'reverse_payment', name: 'Reverse salary payment', description: 'Can reverse an incorrectly recorded salary payment' }
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
          { id: 'manage_notification_settings', name: 'Manage notification settings', description: 'Can configure automated notification categories and attendance reminders' },
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
          { id: 'view_charts', name: 'View charts', description: 'Can see analytical charts' },
          { id: 'view_stat_total_pupils', name: 'View total pupils', description: 'Can see the total number of pupils' },
          { id: 'view_stat_gender_breakdown', name: 'View gender breakdown', description: 'Can see male and female pupil stats' },
          { id: 'view_stat_total_staff', name: 'View total staff', description: 'Can see the total staff count' },
          { id: 'view_stat_attendance_today', name: 'View today attendance', description: 'Can see present, absent, and delayed stats for today' },
          { id: 'view_chart_class_enrollment', name: 'View class enrollment chart', description: 'Can see the class enrollment chart' },
          { id: 'view_chart_attendance', name: 'View attendance chart', description: 'Can see the today attendance chart' },
          { id: 'view_calendar_schedule', name: 'View calendar & schedule', description: 'Can see the month calendar and term schedule' }
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
      },
      {
        page: 'docx',
        path: '/docx',
        name: 'DocX',
        actions: [
          { id: 'view_documents', name: 'View documents', description: 'Can open the document studio' },
          { id: 'select_pupils', name: 'Select pupils', description: 'Can select pupils for personalised documents' },
          { id: 'print_documents', name: 'Print documents', description: 'Can print personalised pupil documents' }
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
  },
  duty_service: {
    pages: [
      {
        page: 'list',
        path: '/duty-service',
        name: 'Duty & Service',
        actions: [
          { id: 'access_page', name: 'Access duty & service', description: 'Can access duty and service page' },
          { id: 'view_duties', name: 'View duties', description: 'Can see duty assignments' },
          { id: 'assign_duties', name: 'Assign duties', description: 'Can assign duties to staff' },
          { id: 'view_schedule', name: 'View schedule', description: 'Can view duty schedule' },
          { id: 'edit_assignments', name: 'Edit assignments', description: 'Can edit duty assignments' },
          { id: 'view_reports', name: 'View reports', description: 'Can view duty reports' }
        ]
      }
    ]
  },
  access_levels: {
    pages: [
      {
        page: 'list',
        path: '/access-levels',
        name: 'Access Levels',
        actions: [
          { id: 'access_page', name: 'Access management page', description: 'Can access access levels page' },
          { id: 'view_levels', name: 'View access levels', description: 'Can see access levels list' },
          { id: 'create_level', name: 'Create access level', description: 'Can create new access levels' },
          { id: 'edit_level', name: 'Edit access level', description: 'Can edit access level permissions' },
          { id: 'delete_level', name: 'Delete access level', description: 'Can delete access levels' },
          { id: 'assign_to_users', name: 'Assign to users', description: 'Can assign access levels to users' }
        ]
      }
    ]
  },
  commentary: {
    pages: [
      {
        page: 'list',
        path: '/admin/commentary-box',
        name: 'Commentary Box',
        actions: [
          { id: 'access_page', name: 'Access commentary box', description: 'Can access commentary management' },
          { id: 'view_comments', name: 'View comments', description: 'Can see commentary templates' },
          { id: 'create_comment', name: 'Create comment', description: 'Can create new commentary templates' },
          { id: 'edit_comment', name: 'Edit comment', description: 'Can edit commentary templates' },
          { id: 'delete_comment', name: 'Delete comment', description: 'Can delete commentary templates' }
        ]
      }
    ]
  },
  timetable: {
    pages: [
      {
        page: 'list',
        path: '/timetable',
        name: 'Timetable',
        actions: [
          { id: 'access_page', name: 'Access timetable page', description: 'Can access the timetable page' },
          { id: 'view_timetable', name: 'View timetable', description: 'Can view the timetable grid and schedules' },
          { id: 'edit_timetable', name: 'Edit timetable', description: 'Can edit timetable entries and structure' },
          { id: 'manage_periods', name: 'Manage periods', description: 'Can create and manage timetable periods' },
          { id: 'view_live_tracker', name: 'View live tracker', description: 'Can see the live timetable tracker on the dashboard' }
        ]
      }
    ]
  },
  boarding: {
    pages: [
      {
        page: 'overview',
        path: '/boarding/list',
        name: 'In-House Overview',
        actions: [
          { id: 'access_page', name: 'Open In-House overview', description: 'Can open the boarding and In-House overview' },
          { id: 'view_boarders', name: 'View boarders', description: 'Can view boarding pupils and assignments' },
          { id: 'assign_boarding', name: 'Assign boarding', description: 'Can assign pupils to boarding' },
          { id: 'manage_boarding_status', name: 'Manage boarding status', description: 'Can update pupil boarding status' }
        ]
      },
      {
        page: 'dormitories',
        path: '/boarding/dormitory',
        name: 'Dormitories',
        actions: [
          { id: 'access_page', name: 'Open dormitories', description: 'Can open dormitory management' },
          { id: 'view_dormitories', name: 'View dormitories', description: 'Can view dormitories and occupancy' },
          { id: 'manage_dormitories', name: 'Manage dormitories', description: 'Can create and update dormitories' },
          { id: 'assign_beds', name: 'Assign beds', description: 'Can assign pupils to dormitories and beds' }
        ]
      }
    ]
  },
  inventory: {
    pages: [
      {
        page: 'dashboard',
        path: '/inventory',
        name: 'Inventory',
        actions: [
          { id: 'access_page', name: 'Open inventory', description: 'Can open the inventory dashboard' },
          { id: 'view_inventory', name: 'View inventory', description: 'Can view inventory levels and stock' },
          { id: 'manage_inventory', name: 'Manage inventory', description: 'Can add and update inventory records' },
          { id: 'view_inventory_reports', name: 'View inventory reports', description: 'Can view inventory summaries and reports' }
        ]
      }
    ]
  },
  account: {
    pages: [
      {
        page: 'profile',
        path: '/profile',
        name: 'My Profile',
        actions: [
          { id: 'access_page', name: 'Open profile', description: 'Can open the signed-in user profile' },
          { id: 'edit_profile', name: 'Edit profile', description: 'Can update the signed-in user profile' },
          { id: 'change_password', name: 'Change password', description: 'Can update the signed-in user password' }
        ]
      },
      {
        page: 'history_log',
        path: '/history-log',
        name: 'History Log',
        actions: [
          { id: 'access_page', name: 'Open history log', description: 'Can open the system history log' },
          { id: 'view_history', name: 'View history', description: 'Can view history log entries' },
          { id: 'export_history', name: 'Export history', description: 'Can export history log entries' }
        ]
      },
      {
        page: 'changelog',
        path: '/changelog',
        name: 'Change Log',
        actions: [
          { id: 'access_page', name: 'Open change log', description: 'Can open the application change log' },
          { id: 'view_changes', name: 'View changes', description: 'Can view application changes' }
        ]
      }
    ]
  }
} as const;

export type ModuleId = keyof typeof MODULE_ACTIONS; 

export type RoutePagePermission = {
  moduleId: ModuleId;
  pageId: string;
  pattern: RegExp;
};

const ROUTE_PAGE_ALIASES: RoutePagePermission[] = [
  { moduleId: 'pupils', pageId: 'detail', pattern: /^\/pupil-detail$/ },
  { moduleId: 'pupils', pageId: 'detail', pattern: /^\/pupils\/[^/]+$/ },
  { moduleId: 'pupils', pageId: 'enrollment_trends', pattern: /^\/enrollment-trends\/class\/[^/]+$/ },
  { moduleId: 'promotion', pageId: 'promote', pattern: /^\/pupils\/promotion-history\/[^/]+$/ },
  { moduleId: 'attendance', pageId: 'record', pattern: /^\/attendance\/(record|view|excluded-days)$/ },
  { moduleId: 'classes', pageId: 'detail', pattern: /^\/(class-detail|class\/edit|classes\/(graduates|history)\/[^/]+|classes\/pending)$/ },
  { moduleId: 'requirements', pageId: 'tracking', pattern: /^\/(class-requirements|requirement-tracking)$/ },
  { moduleId: 'boarding', pageId: 'overview', pattern: /^\/boarding(?:\/list)?$/ },
  { moduleId: 'boarding', pageId: 'dormitories', pattern: /^\/boarding\/dormitory(?:\/[^/]+)?$/ },
  { moduleId: 'staff', pageId: 'list', pattern: /^\/staff\/(form|mofus|[^/]+)$/ },
  { moduleId: 'payroll', pageId: 'detail', pattern: /^\/payroll\/staff\/[^/]+$/ },
  { moduleId: 'banking', pageId: 'list', pattern: /^\/banking\/(list|pupil-banking-details)$/ },
  { moduleId: 'procurement', pageId: 'items', pattern: /^\/procurement$/ },
  { moduleId: 'fees', pageId: 'collect', pattern: /^\/fees\/(collect(?:\/[^/]+)?|family\/.*)$/ },
  { moduleId: 'fees', pageId: 'list', pattern: /^\/(assign(?:\/[^/]+)?|fee-assignments(?:\/[^/]+)?|discounts)$/ },
  { moduleId: 'inventory', pageId: 'dashboard', pattern: /^\/inventory(?:\/uniforms)?$/ },
  { moduleId: 'uniforms', pageId: 'tracking', pattern: /^\/uniform-tracking$/ },
  { moduleId: 'exams', pageId: 'results', pattern: /^\/(remark-report|exams\/(?:[^/]+\/(?:edit-snapshot|pupil-results\/[^/]+|record-results|view-results)|ple-results(?:\/.*)?))$/ },
  { moduleId: 'commentary', pageId: 'list', pattern: /^\/commentary-management(?:\/seed-subjects)?$/ },
  { moduleId: 'bulk_sms', pageId: 'send', pattern: /^\/sms-templates$/ },
  { moduleId: 'notifications', pageId: 'list', pattern: /^\/push-notifications$/ },
  { moduleId: 'events', pageId: 'calendar', pattern: /^\/events\/[^/]+\/(attendance|view-attendance)$/ },
  { moduleId: 'settings', pageId: 'school', pattern: /^\/(settings\/(account|general)|about-trinity|nameorder)$/ },
];

export function getRoutePagePermission(pathname: string): RoutePagePermission | undefined {
  for (const [moduleId, module] of Object.entries(MODULE_ACTIONS) as [ModuleId, (typeof MODULE_ACTIONS)[ModuleId]][]) {
    const page = module.pages.find((item) => item.path === pathname);
    if (page) return { moduleId, pageId: page.page, pattern: new RegExp(`^${pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) };
  }

  return ROUTE_PAGE_ALIASES.find((route) => route.pattern.test(pathname));
}
