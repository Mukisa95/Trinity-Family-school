import type { Pupil } from '@/types';

type StreamPupil = Pick<Pupil, 'id' | 'classId' | 'streamId' | 'streamClassId' | 'streamAcademicYearId'>;

/** Retain edits, hydrate late pupil records, and ignore assignments from another class/year. */
export function reconcileStreamDraft(
  pupils: StreamPupil[],
  activeStreamIds: string[],
  current: Record<string, string>,
  classId: string,
  academicYearId: string,
  editedPupilIds?: ReadonlySet<string>,
): Record<string, string> {
  const fallback = activeStreamIds.length <= 2 ? activeStreamIds[0] || '' : '';
  return Object.fromEntries(pupils.map(pupil => {
    const edited = current[pupil.id];
    if (edited !== undefined && (!editedPupilIds || editedPupilIds.has(pupil.id))) {
      return [pupil.id, activeStreamIds.includes(edited) ? edited : fallback];
    }
    const saved = pupil.classId === classId
      && (!pupil.streamClassId || pupil.streamClassId === classId)
      && (!pupil.streamAcademicYearId || pupil.streamAcademicYearId === academicYearId)
      && pupil.streamId && activeStreamIds.includes(pupil.streamId)
      ? pupil.streamId : fallback;
    return [pupil.id, saved];
  }));
}

/** Compatibility for callers with an explicitly edited assignment map. */
export function reconcileStreamDraftAssignments(
  current: Record<string, string>,
  pupils: Pick<Pupil, 'id' | 'streamId' | 'streamClassId' | 'streamAcademicYearId'>[],
  activeStreamIds: string[],
  classId: string,
  academicYearId: string,
): Record<string, string> {
  const edited = Object.fromEntries(Object.entries(current).filter(([, streamId]) => activeStreamIds.includes(streamId)));
  return reconcileStreamDraft(pupils.map(pupil => ({ ...pupil, classId })), activeStreamIds, edited, classId, academicYearId);
}
