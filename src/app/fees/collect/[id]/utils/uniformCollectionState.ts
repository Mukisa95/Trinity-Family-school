import type { UniformTracking } from '@/types';

type UniformCollectionRecord = Pick<
  UniformTracking,
  'uniformId' | 'collectionStatus' | 'collectedItems' | 'history'
>;

/**
 * Resolves the authoritative collected item IDs for both current and legacy
 * tracking records. Older records may only retain individual collections in
 * history, while newer records also maintain the top-level collectedItems.
 */
export const getCollectedUniformItemIds = (
  record: UniformCollectionRecord
): string[] => {
  const explicitItems = record.collectedItems || [];
  const historicalItems =
    record.history?.flatMap(entry => entry.collectedItems || []) || [];
  const collectedItems = [
    ...new Set([...explicitItems, ...historicalItems].filter(Boolean)),
  ];

  if (collectedItems.length > 0) {
    return collectedItems;
  }

  if (record.collectionStatus === 'collected') {
    return Array.isArray(record.uniformId)
      ? record.uniformId
      : [record.uniformId];
  }

  return [];
};
