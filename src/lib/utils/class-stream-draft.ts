import type { Pupil } from '@/types';

type AssignedPupil = Pick<Pupil, 'id' | 'streamId' | 'streamClassId' | 'streamAcademicYearId'>;

/** Preserve ID-based choices and seed newly visible pupils from their saved
 * assignment. The result contains only pupils still in the active class.
 */
export function reconcileStreamDraftAssignments(
  current: Record<string, string>, pupils: AssignedPupil[], activeStreamIds: string[],
  classId: string, academicYearId: string,
): Record<string, string> {
  const active = new Set(activeStreamIds);
  const fallback = activeStreamIds.length > 0 && activeStreamIds.length <= 2 ? activeStreamIds[0] : '';
  return Object.fromEntries(pupils.map(pupil => {
    const saved = pupil.streamId && active.has(pupil.streamId)
      && (!pupil.streamClassId || pupil.streamClassId === classId)
      && (!pupil.streamAcademicYearId || pupil.streamAcademicYearId === academicYearId)
      ? pupil.streamId : '';
    return [pupil.id, active.has(current[pupil.id]) ? current[pupil.id] : saved || fallback];
  }));
}
