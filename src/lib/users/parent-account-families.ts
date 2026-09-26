import type { Pupil, SystemUser } from '@/types';

const FAMILY_KEY_PREFIX = 'family:';
const PUPIL_KEY_PREFIX = 'pupil:';

function normalizedId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * A real family ID is the shared account identity for siblings. Pupils without
 * a family ID remain independently eligible for their own parent account.
 */
export function getPupilParentAccountKey(pupil: Pick<Pupil, 'id' | 'familyId'>): string {
  const familyId = normalizedId(pupil.familyId);
  return familyId ? `${FAMILY_KEY_PREFIX}${familyId}` : `${PUPIL_KEY_PREFIX}${pupil.id}`;
}

export function getActiveParentAccountId(
  pupil: Pick<Pupil, 'parentAccountId' | 'parentAccountActive'>,
): string | null {
  if (pupil.parentAccountActive !== true) return null;
  const accountId = normalizedId(pupil.parentAccountId);
  return accountId || null;
}

export function getParentAccountKey(
  user: Pick<SystemUser, 'familyId' | 'pupilId'>,
  pupils: readonly Pick<Pupil, 'id' | 'familyId'>[],
): string | null {
  const familyId = normalizedId(user.familyId);
  if (familyId) return `${FAMILY_KEY_PREFIX}${familyId}`;

  const pupilId = normalizedId(user.pupilId);
  if (!pupilId) return null;
  const linkedPupil = pupils.find(pupil => pupil.id === pupilId);
  return linkedPupil
    ? getPupilParentAccountKey(linkedPupil)
    : `${PUPIL_KEY_PREFIX}${pupilId}`;
}

export function getParentAccountChildren(
  user: Pick<SystemUser, 'familyId' | 'pupilId'>,
  pupils: readonly Pupil[],
): Pupil[] {
  const accountKey = getParentAccountKey(user, pupils);
  if (!accountKey) return [];
  return pupils.filter(pupil => getPupilParentAccountKey(pupil) === accountKey);
}

export function getPupilsWithoutParentAccounts(
  pupils: readonly Pupil[],
  users: readonly SystemUser[],
): Pupil[] {
  const parentUsers = users.filter(user => user.role === 'Parent');
  const accountKeys = new Set(
    parentUsers
      .map(user => getParentAccountKey(user, pupils))
      .filter((key): key is string => Boolean(key)),
  );

  return pupils.filter(pupil => !accountKeys.has(getPupilParentAccountKey(pupil)));
}

export function collapsePupilsToParentAccountFamilies(pupils: readonly Pupil[]): Pupil[] {
  const seen = new Set<string>();
  return pupils.filter(pupil => {
    const key = getPupilParentAccountKey(pupil);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function findParentAccountForPupil(
  pupil: Pupil,
  pupils: readonly Pupil[],
  users: readonly SystemUser[],
): SystemUser | undefined {
  const pupilKey = getPupilParentAccountKey(pupil);
  return users.find(user => (
    user.role === 'Parent' && getParentAccountKey(user, pupils) === pupilKey
  ));
}
