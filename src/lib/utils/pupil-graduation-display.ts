import type { Class, Pupil } from '@/types';

type GraduationIdentity = Pick<Pupil,
  'classId' | 'className' | 'graduationClassId' | 'graduationClassName' | 'graduationYear'
>;

/** Use the saved graduation identity, even when the current class has changed. */
export function getPupilGraduationDisplay(
  pupil: GraduationIdentity,
  classes: readonly Pick<Class, 'id' | 'name'>[],
) {
  const classId = pupil.graduationClassId || pupil.classId;
  const savedName = pupil.graduationClassName?.trim();
  const matchingClass = classes.find(schoolClass => schoolClass.id === classId);
  const legacyName = !pupil.graduationClassId || pupil.graduationClassId === pupil.classId
    ? pupil.className?.trim()
    : undefined;
  const className = savedName || matchingClass?.name || legacyName || 'Graduated';
  // graduationDate is the action date; it can differ from the selected cohort year.
  const year = typeof pupil.graduationYear === 'number' && Number.isInteger(pupil.graduationYear) && pupil.graduationYear > 0
    ? pupil.graduationYear
    : undefined;

  return {
    name: `${className} Class of ${year ?? 'Unknown'}`,
    href: classId ? `/classes/graduates/${encodeURIComponent(classId)}` : undefined,
    year,
    academicTitle: year ? `Academic Information of ${year}` : 'Academic Information',
  };
}
