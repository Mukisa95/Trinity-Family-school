import type { Subject, SubjectAssignment } from '@/types';

export type AssignedSubject = Subject & {
  teacherIds: string[];
  teacherId: string | null;
  teacherName: null;
};

export function selectSubjectById(
  subjects: Subject[] | undefined,
  subjectId: string,
): Subject | undefined {
  if (!subjectId) return undefined;
  return subjects?.find(subject => subject.id === subjectId);
}

export function selectSubjectsByAssignments(
  subjects: Subject[],
  assignments: SubjectAssignment[] | undefined,
): AssignedSubject[] {
  if (!assignments?.length || !subjects.length) return [];
  const subjectsById = new Map(subjects.map(subject => [subject.id, subject]));

  return assignments.flatMap(assignment => {
    const subject = subjectsById.get(assignment.subjectId);
    if (!subject) return [];
    const teacherIds = Array.isArray(assignment.teacherIds) && assignment.teacherIds.length > 0
      ? assignment.teacherIds
      : assignment.teacherId
        ? [assignment.teacherId]
        : [];

    return [{
      ...subject,
      teacherIds,
      teacherId: teacherIds[0] ?? null,
      teacherName: null,
    }];
  });
}
