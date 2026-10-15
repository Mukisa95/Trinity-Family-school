import type { Class, Staff } from '@/types';

export type SubjectTeachingRole = 'subjectTeacher' | 'assistant' | 'none';
type TeacherAssignmentValue = { teacherIds?: readonly string[]; teacherId?: string | null };

/** Preserve legacy single-teacher records; new writes remove obsolete single IDs. */
export function getSubjectTeacherIds(assignment?: TeacherAssignmentValue): string[] {
  const ids = Array.isArray(assignment?.teacherIds) && assignment.teacherIds.length > 0
    ? assignment.teacherIds
    : assignment?.teacherId ? [assignment.teacherId] : [];
  return [...new Set(ids.filter(id => typeof id === 'string' && id.trim()))];
}

export function getSubjectTeacherId(assignment?: TeacherAssignmentValue): string | null {
  return getSubjectTeacherIds(assignment)[0] ?? null;
}

/** Exam choices use primary teachers; retain an existing snapshot override. */
export function getExamTeacherIds(assignments: readonly TeacherAssignmentValue[] = [], currentTeacherId?: string | null): string[] {
  return [...new Set([
    ...assignments.map(getSubjectTeacherId).filter((id): id is string => !!id),
    ...(currentTeacherId ? [currentTeacherId] : []),
  ])];
}

export function getSubjectTeachingRole(assignment: TeacherAssignmentValue | undefined, staffId: string): SubjectTeachingRole {
  const index = getSubjectTeacherIds(assignment).indexOf(staffId);
  return index === 0 ? 'subjectTeacher' : index > 0 ? 'assistant' : 'none';
}

export function getSubjectTeacherRoleLabel(index: number): string {
  return index === 0 ? 'Subject teacher' : `Assistant subject teacher ${index}`;
}

export type StaffClassAssignmentChanges = {
  classTeacher?: { assigned: boolean; expectedTeacherId: string };
  subjects: { subjectId: string; role: SubjectTeachingRole; expectedTeacherIds: string[] }[];
};

export function applyStaffClassAssignmentChanges(
  classItem: Class,
  staff: Pick<Staff, 'id' | 'firstName' | 'lastName'>,
  changes: StaffClassAssignmentChanges,
): Partial<Class> {
  const patch: Partial<Class> = {};
  if (changes.classTeacher) {
    if ((classItem.classTeacherId || '') !== changes.classTeacher.expectedTeacherId) {
      throw new Error('The class teacher changed while you were editing. Reopen the assignment and try again.');
    }
    if (changes.classTeacher.assigned) {
      patch.classTeacherId = staff.id;
      patch.classTeacherName = `${staff.firstName} ${staff.lastName}`.trim();
      if (classItem.coClassTeacherId === staff.id) {
        patch.coClassTeacherId = '';
        patch.coClassTeacherName = '';
      }
    } else if (classItem.classTeacherId === staff.id) {
      patch.classTeacherId = '';
      patch.classTeacherName = '';
    }
  }

  if (changes.subjects.length) {
    const assignments = (classItem.subjectAssignments || []).map(assignment => ({
      ...assignment, teacherIds: getSubjectTeacherIds(assignment),
    }));
    for (const change of changes.subjects) {
      const index = assignments.findIndex(assignment => assignment.subjectId === change.subjectId);
      const current = index < 0 ? undefined : assignments[index];
      const currentIds = getSubjectTeacherIds(current);
      if (JSON.stringify(currentIds) !== JSON.stringify(change.expectedTeacherIds)) {
        throw new Error('Subject teachers changed while you were editing. Reopen the assignment and try again.');
      }
      const otherIds = currentIds.filter(id => id !== staff.id);
      if (change.role === 'assistant' && !otherIds.length) {
        throw new Error('Assign a subject teacher before adding an assistant.');
      }
      const teacherIds = change.role === 'subjectTeacher' ? [staff.id, ...otherIds]
        : change.role === 'assistant' ? [...otherIds, staff.id] : otherIds;
      if (index < 0) {
        if (change.role !== 'none') assignments.push({ subjectId: change.subjectId, teacherIds });
      } else {
        // Drop the obsolete single ID so cleared assignments cannot resurrect it.
        const { teacherId: _legacyTeacherId, ...rest } = current!;
        assignments[index] = { ...rest, teacherIds };
      }
    }
    patch.subjectAssignments = assignments;
  }
  return patch;
}
