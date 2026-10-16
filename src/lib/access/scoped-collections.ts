/** Shared browser/server registry. Unknown collections never inherit scoped access. */
export const PUPIL_COLLECTION_MODULES: Record<string, string[]> = {
  pupils: ['pupils', 'classes', 'fees', 'exams', 'attendance', 'banking', 'boarding', 'requirements', 'uniforms', 'promotion', 'pupil_history', 'reports', 'users', 'staff', 'bulk_sms', 'events', 'notifications', 'timetable'],
  classes: ['classes', 'pupils', 'fees', 'exams', 'attendance', 'banking', 'boarding', 'requirements', 'uniforms', 'promotion', 'reports', 'users', 'staff', 'subjects', 'notifications', 'bulk_sms', 'timetable'],
  exams: ['exams', 'reports', 'classes', 'timetable'],
  examResults: ['exams', 'reports'],
  payments: ['fees', 'banking', 'reports'],
  feesHolidays: ['fees', 'staff', 'pupils'],
  feeAdjustments: ['fees', 'reports'],
  pupilTermSnapshots: ['fees', 'pupils', 'classes', 'exams', 'reports', 'promotion'],
  pupilSnapshots: ['fees', 'pupils', 'classes', 'exams', 'reports', 'promotion'],
  attendanceRecords: ['attendance', 'classes', 'reports'],
  attendanceDailySummaries: ['attendance', 'classes', 'reports'],
  uniformTracking: ['uniforms', 'fees', 'classes', 'reports'],
  requirementTracking: ['requirements', 'fees', 'classes', 'reports'],
  'requirement-tracking': ['requirements', 'fees', 'classes', 'reports'],
  bankAccounts: ['banking'], bankLoans: ['banking'], bankTransactions: ['banking'],
  pupilHistory: ['pupil_history', 'pupils', 'reports'],
  resultReleases: ['exams', 'reports'],
  timetableProfiles: ['timetable', 'classes'], timetableEntries: ['timetable', 'classes'], timetablePeriods: ['timetable', 'classes'],
  pupilCacheChanges: ['pupils', 'classes', 'fees', 'exams', 'attendance', 'boarding', 'reports', 'users'],
  dormitories: ['boarding', 'pupils', 'classes'],
  schoolPayInboundTransactions: ['fees'],
};
export function circumferenceCollectionKind(path: string): string {
  if (/^academicYears\/[^/]+\/terms\/[^/]+\/timetables$/.test(path)) return 'timetableProfiles';
  if (/^academicYears\/[^/]+\/terms\/[^/]+\/timetables\/[^/]+\/(entries|periods)$/.test(path)) return path.endsWith('/entries') ? 'timetableEntries' : 'timetablePeriods';
  return path;
}
export const isCircumferenceCollection = (collection: string) => Object.prototype.hasOwnProperty.call(PUPIL_COLLECTION_MODULES, circumferenceCollectionKind(collection));
