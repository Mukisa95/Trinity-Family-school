export const SYSTEM_MODULES = [
  {
    id: 'pupils',
    name: 'Pupils Management',
    description: 'Manage student records, profiles, and enrollment',
    route: '/pupils',
    actions: {
      view: 'View pupil records',
      create: 'Add new pupils',
      edit: 'Edit pupil information',
      delete: 'Delete pupil records',
      export: 'Export pupil data',
      changeStatus: 'Change pupil status',
      assignFees: 'Assign fees to pupils',
      manageIds: 'Manage pupil ID codes'
    }
  },
  {
    id: 'classes',
    name: 'Classes Management',
    description: 'Manage classes and class assignments',
    route: '/classes',
    actions: {
      view: 'View class information',
      create: 'Create new classes',
      edit: 'Edit class details',
      delete: 'Delete classes',
      assignTeachers: 'Assign teachers to classes',
      assignSubjects: 'Assign subjects to classes'
    }
  },
  {
    id: 'staff',
    name: 'Staff Management',
    description: 'Manage staff records and information',
    route: '/staff',
    actions: {
      view: 'View staff records',
      create: 'Add new staff members',
      edit: 'Edit staff information',
      delete: 'Delete staff records',
      assignRoles: 'Assign staff roles'
    }
  },
  {
    id: 'subjects',
    name: 'Subjects Management',
    description: 'Manage school subjects',
    route: '/subjects',
    actions: {
      view: 'View subjects',
      create: 'Add new subjects',
      edit: 'Edit subject details',
      delete: 'Delete subjects'
    }
  },
  {
    id: 'fees',
    name: 'Fees Management',
    description: 'Manage fee structures and payments',
    route: '/fees',
    actions: {
      view: 'View fee structures',
      create: 'Create fee structures',
      edit: 'Edit fee structures',
      delete: 'Delete fee structures',
      collect: 'Collect fees',
      generateReceipts: 'Generate receipts',
      viewReports: 'View fee reports',
      revertPayments: 'Revert payments'
    }
  },
  {
    id: 'exams',
    name: 'Exams Management',
    description: 'Manage examinations and results',
    route: '/exams',
    actions: {
      view: 'View exams',
      create: 'Create exams',
      edit: 'Edit exam details',
      delete: 'Delete exams',
      enterResults: 'Enter exam results',
      publishResults: 'Publish results',
      generateReports: 'Generate exam reports'
    }
  },
  {
    id: 'attendance',
    name: 'Attendance Management',
    description: 'Track student attendance',
    route: '/attendance',
    actions: {
      view: 'View attendance records',
      record: 'Record attendance',
      edit: 'Edit attendance',
      generateReports: 'Generate attendance reports'
    }
  },
  {
    id: 'academic_years',
    name: 'Academic Years',
    description: 'Manage academic years and terms',
    route: '/academic-years',
    actions: {
      view: 'View academic years',
      create: 'Create academic years',
      edit: 'Edit academic years',
      delete: 'Delete academic years',
      activateYear: 'Activate academic year',
      lockYear: 'Lock academic year'
    }
  },
  {
    id: 'users',
    name: 'User Management',
    description: 'Manage system users and permissions',
    route: '/users',
    actions: {
      view: 'View users',
      create: 'Create user accounts',
      edit: 'Edit user permissions',
      delete: 'Delete user accounts',
      resetPasswords: 'Reset user passwords'
    }
  },
  {
    id: 'banking',
    name: 'Banking Management',
    description: 'Manage pupil banking and savings',
    route: '/banking',
    actions: {
      view: 'View banking records',
      createAccount: 'Create accounts',
      deposit: 'Make deposits',
      withdraw: 'Make withdrawals',
      loan: 'Manage loans',
      viewReports: 'View banking reports'
    }
  },
  {
    id: 'procurement',
    name: 'Procurement Management',
    description: 'Manage procurement and purchases',
    route: '/procurement',
    actions: {
      view: 'View procurement records',
      create: 'Create purchases',
      edit: 'Edit purchases',
      delete: 'Delete purchases',
      manageBudgets: 'Manage budgets',
      viewReports: 'View procurement reports'
    }
  },
  {
    id: 'requirements',
    name: 'Requirements Tracking',
    description: 'Track academic requirements',
    route: '/requirements',
    actions: {
      view: 'View requirements',
      create: 'Add requirements',
      edit: 'Edit requirements',
      delete: 'Delete requirements',
      track: 'Track requirement status'
    }
  },
  {
    id: 'uniforms',
    name: 'Uniform Management',
    description: 'Manage school uniforms',
    route: '/uniforms',
    actions: {
      view: 'View uniforms',
      create: 'Add uniforms',
      edit: 'Edit uniforms',
      delete: 'Delete uniforms',
      track: 'Track uniform distribution'
    }
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Send and manage notifications',
    route: '/notifications',
    actions: {
      view: 'View notifications',
      create: 'Send notifications',
      edit: 'Edit notifications',
      delete: 'Delete notifications',
      managePush: 'Manage push notifications'
    }
  },
  {
    id: 'bulk_sms',
    name: 'Bulk SMS',
    description: 'Send bulk SMS messages',
    route: '/bulk-sms',
    actions: {
      view: 'View SMS history',
      send: 'Send SMS messages',
      manageTemplates: 'Manage SMS templates',
      viewReports: 'View SMS reports'
    }
  },
  {
    id: 'reports',
    name: 'Reports',
    description: 'Generate and view system reports',
    route: '/reports',
    actions: {
      view: 'View reports',
      generate: 'Generate reports',
      export: 'Export reports'
    }
  },
  {
    id: 'settings',
    name: 'School Settings',
    description: 'Manage school settings and configurations',
    route: '/about-school',
    actions: {
      view: 'View settings',
      edit: 'Edit school settings',
      managePhotos: 'Manage school photos'
    }
  },
  {
    id: 'pupil_history',
    name: 'Pupil History',
    description: 'View comprehensive pupil history and timelines',
    route: '/pupil-history',
    actions: {
      view: 'View pupil history',
      search: 'Search and filter history',
      viewPersonal: 'View personal information',
      viewClass: 'View class history',
      viewStatus: 'View status history',
      viewAchievements: 'View achievements',
      viewFees: 'View fees history',
      export: 'Export history data'
    }
  },
  {
    id: 'events',
    name: 'Events & Calendar',
    description: 'Manage school events and calendar',
    route: '/events',
    actions: {
      view: 'View events and calendar',
      create: 'Create events',
      edit: 'Edit events',
      delete: 'Delete events',
      manageTypes: 'Manage event types',
      recurring: 'Schedule recurring events',
      invite: 'Invite participants',
      export: 'Export calendar data'
    }
  },
  {
    id: 'promotion',
    name: 'Pupil Promotion',
    description: 'Promote and demote pupils between classes',
    route: '/pupils/promote',
    actions: {
      view: 'View promotion page',
      promote: 'Promote pupils',
      demote: 'Demote pupils',
      bulk: 'Bulk operations',
      transfer: 'Transfer pupils',
      history: 'View promotion history',
      undo: 'Undo promotions'
    }
  }
] as const;

export type SystemModuleId = typeof SYSTEM_MODULES[number]['id'];

export const getModuleById = (id: string) => {
  return SYSTEM_MODULES.find(module => module.id === id);
};

export const getModuleActions = (moduleId: string) => {
  const module = getModuleById(moduleId);
  return module ? Object.keys(module.actions) : [];
}; 