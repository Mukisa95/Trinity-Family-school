export type RevisionCachePolicy = {
  hasCachedData: boolean;
  revisionChanged: boolean;
  shouldFetch: boolean;
};

/**
 * Rarely-changing data remains read-free while its published revision is
 * unchanged. A cold cache and a confirmed revision change are the only normal
 * reasons to contact Firestore.
 */
export function getRevisionCachePolicy({
  hasCachedData,
  cachedRevision,
  currentRevision,
  revisionsReady,
}: {
  hasCachedData: boolean;
  cachedRevision?: number;
  currentRevision: number;
  revisionsReady: boolean;
}): RevisionCachePolicy {
  // A mutation may patch the local cache with currentRevision + 1 immediately
  // after its atomic commit. That cache is ahead only until the shared revision
  // listener catches up, so it must not cause a redundant reconciliation read.
  const revisionChanged =
    hasCachedData &&
    revisionsReady &&
    (cachedRevision === undefined || cachedRevision < currentRevision);

  return {
    hasCachedData,
    revisionChanged,
    shouldFetch: !hasCachedData || revisionChanged,
  };
}
