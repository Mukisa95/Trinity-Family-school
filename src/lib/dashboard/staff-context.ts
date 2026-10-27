import type { Class, Event, Staff, SystemUser } from '@/types';
import { getSubjectTeacherIds } from '@/lib/utils/teaching-assignments';

const words = (value: unknown): string[] => (Array.isArray(value) ? value : [value])
  .filter((item): item is string => typeof item === 'string')
  .map(item => item.toUpperCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim());

export function isDirectorOfStudies(staff?: Pick<Staff, 'role' | 'status'> | null): boolean {
  return !!staff && (!staff.status || staff.status === 'active') && words(staff.role)
    .some(role => role === 'DIRECTOR OF STUDIES' || role === 'DOS' || role === 'D O S');
}

export function isTeachingStaff(staff?: Pick<Staff, 'role' | 'department'> | null): boolean {
  return !!staff && (words(staff.department).includes('TEACHING') || words(staff.role)
    .some(role => /\bTEACHER\b|TEACHING ASSISTANT|DIRECTOR OF STUDIES|^DOS$/.test(role)));
}

/** Keep school-wide notices/holidays and only the teacher's class-specific events. */
export function isEventRelevantToClasses(event: Pick<Event, 'classIds' | 'examIntegration'>, classIds?: string[]): boolean {
  if (classIds === undefined) return true;
  const targets = event.classIds?.length ? event.classIds : event.examIntegration?.classIds || [];
  return !targets.length || targets.some(id => classIds.includes(id));
}

export function getStaffDashboardContext(user: SystemUser | null, staff: Staff[], classes: Class[]) {
  const linkedStaff = user?.staffId ? staff.find(item => item.id === user.staffId) : undefined;
  const staffId = linkedStaff?.id;
  const classTeacherIds = staffId ? classes.filter(item => item.classTeacherId === staffId || item.coClassTeacherId === staffId).map(item => item.id) : [];
  const subjectClassIds = staffId ? classes.filter(item => item.subjectAssignments?.some(assignment => getSubjectTeacherIds(assignment).includes(staffId))).map(item => item.id) : [];
  const assignedClassIds = [...new Set([...classTeacherIds, ...subjectClassIds])];
  const isAdmin = user?.role === 'Admin';
  const isDOS = user?.role === 'Staff' && isDirectorOfStudies(linkedStaff);
  const isTeacher = user?.role === 'Staff' && (isTeachingStaff(linkedStaff) || assignedClassIds.length > 0);
  return { linkedStaff, staffId, isAdmin, isDOS, isTeacher, schoolWide: isAdmin || isDOS, classTeacherIds, assignedClassIds };
}
