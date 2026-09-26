export type PupilAccountMarker = {
  id: string;
  parentAccountId?: unknown;
  parentAccountActive?: unknown;
};

/** The server may only fill missing legacy links; it cannot seize another active account's pupil. */
export function planParentAccountScopeRepair(
  accountId: string,
  pupils: PupilAccountMarker[],
  hasCompetingActiveAccount: boolean,
): string[] {
  if (hasCompetingActiveAccount) throw new Error('ACCOUNT_SCOPE_CONFLICT');
  return pupils.flatMap(pupil => {
    const owner = typeof pupil.parentAccountId === 'string'
      ? pupil.parentAccountId.trim()
      : '';
    if (owner && owner !== accountId && pupil.parentAccountActive === true) {
      throw new Error('ACCOUNT_SCOPE_CONFLICT');
    }
    return owner === accountId && pupil.parentAccountActive === true ? [] : [pupil.id];
  });
}
