export type PupilCacheChange = {
  id: string;
  revision: number;
  pupilId?: string;
  pupilIds?: string[];
  revisionSpan?: number;
  operation: 'upsert' | 'delete';
  changedAt?: unknown;
};

export function getPupilCacheChangeIds(change: PupilCacheChange): string[] {
  const ids = change.pupilIds?.length ? change.pupilIds : change.pupilId ? [change.pupilId] : [];
  return Array.from(new Set(ids.filter(Boolean)));
}

export function hasCompletePupilCacheChangeRange(
  changes: PupilCacheChange[],
  fromRevision: number,
  toRevision: number,
): boolean {
  if (toRevision <= fromRevision) return changes.length === 0;

  let cursor = fromRevision;
  for (const change of changes) {
    const ids = getPupilCacheChangeIds(change);
    const span = change.revisionSpan ?? 1;
    if (!Number.isInteger(span) || span < 1 || ids.length !== span) return false;
    if (change.revision !== cursor + span) return false;
    cursor = change.revision;
  }

  return cursor === toRevision;
}
