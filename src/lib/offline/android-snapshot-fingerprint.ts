import type { AndroidOfflineSnapshot } from './android-contracts';

/** Effect-scoped: never retain another account's pupil projection after cleanup. */
export function createSnapshotFingerprint() {
  const parts = new Map<string, { data: unknown; revision?: number; text: string }>();
  return (snapshot: AndroidOfflineSnapshot) => {
    const present = new Set(Object.keys(snapshot.datasets));
    for (const key of parts.keys()) if (!present.has(key)) parts.delete(key);
    return Object.entries(snapshot.datasets).map(([key, dataset]) => {
      const previous = parts.get(key);
      // Reused pupil projections are immutable; unrelated changes need not
      // stringify their photos and hundreds of records a second time.
      if (previous && previous.data === dataset.data && previous.revision === dataset.revision) return previous.text;
      const text = JSON.stringify([key, dataset.revision, dataset.data], (name, value) => name === 'preparedAt' ? undefined : value);
      parts.set(key, { data: dataset.data, revision: dataset.revision, text });
      return text;
    }).join('\n');
  };
}
