import type { Pupil } from '@/types';

export type PupilFilters = {
  status?: string;
  section?: string;
  gender?: string;
};

export const selectPupilById = (pupils: Pupil[] | undefined, pupilId: string) =>
  pupilId ? pupils?.find(pupil => pupil.id === pupilId) : undefined;

export const selectPupilsByClass = (pupils: Pupil[] | undefined, classId: string) =>
  !classId ? [] : (pupils ?? []).filter(pupil => pupil.classId === classId);

export const selectPupilsByFamily = (pupils: Pupil[] | undefined, familyId: string) =>
  !familyId ? [] : (pupils ?? []).filter(pupil => pupil.familyId === familyId);

export const selectPupilByAdmissionNumber = (
  pupils: Pupil[] | undefined,
  admissionNumber: string,
) => !admissionNumber
  ? undefined
  : pupils?.find(pupil => pupil.admissionNumber === admissionNumber);

export function selectPupilsByIds(pupils: Pupil[] | undefined, pupilIds: string[]): Pupil[] {
  if (!pupilIds.length) return [];
  const pupilsById = new Map((pupils ?? []).map(pupil => [pupil.id, pupil]));
  return pupilIds.flatMap(id => {
    const pupil = pupilsById.get(id);
    return pupil ? [pupil] : [];
  });
}

export const selectPupilsByStatus = (pupils: Pupil[] | undefined, status: string) =>
  !status ? [] : (pupils ?? []).filter(pupil => pupil.status === status);

export const selectActivePupils = (pupils: Pupil[] | undefined) =>
  selectPupilsByStatus(pupils, 'Active');

export const selectActivePupilsByClass = (pupils: Pupil[] | undefined, classId: string) =>
  selectPupilsByClass(pupils, classId).filter(pupil => pupil.status === 'Active');

export function selectPupilsWithFilters(
  pupils: Pupil[] | undefined,
  classId: string,
  filters?: PupilFilters,
): Pupil[] {
  return selectPupilsByClass(pupils, classId).filter(pupil => {
    if (filters?.status && filters.status !== 'all' && pupil.status !== filters.status) return false;
    if (
      filters?.section &&
      filters.section !== 'all' &&
      pupil.section?.toLowerCase() !== filters.section.toLowerCase()
    ) return false;
    if (
      filters?.gender &&
      filters.gender !== 'all' &&
      pupil.gender?.toLowerCase() !== filters.gender.toLowerCase()
    ) return false;
    return true;
  });
}

export function searchPupilSnapshot(pupils: Pupil[] | undefined, searchTerm: string): Pupil[] {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return [];
  return (pupils ?? []).filter(pupil => [
    pupil.firstName,
    pupil.lastName,
    pupil.otherNames,
    pupil.admissionNumber,
    pupil.className,
    pupil.classCode,
  ].some(value => value?.toLowerCase().includes(term)));
}

export function selectPupilPhoto(pupils: Pupil[] | undefined, pupilId: string) {
  return selectPupilById(pupils, pupilId)?.photo;
}

export function selectPupilPhotos(
  pupils: Pupil[] | undefined,
  pupilIds: string[],
): Map<string, string> {
  const requested = new Set(pupilIds);
  return new Map(
    (pupils ?? [])
      .filter(pupil => requested.has(pupil.id) && Boolean(pupil.photo))
      .map(pupil => [pupil.id, pupil.photo as string]),
  );
}

export const selectPupilsWithoutPhotos = (pupils: Pupil[] | undefined): Pupil[] =>
  (pupils ?? []).map(pupil => {
    const { photo: _photo, ...withoutPhoto } = pupil;
    return withoutPhoto as Pupil;
  });
