import { readPersistentCollection, writePersistentCollection } from './persistent-collection-cache';

type Snapshot<T> = { schema: 1; revision: string; data: T };
type Store = {
  read: <T>(key: string) => Promise<T | null>;
  write: <T>(key: string, value: T) => Promise<void>;
};
const store: Store = { read: readPersistentCollection, write: writePersistentCollection };

/** Cached API responses are private and already scoped by project, account,
 * staff link, permissions and request parameters in the supplied key. */
export async function loadStaffClockingCache<T>(key: string, revision: string, fetchData: () => Promise<T>, storage: Store = store): Promise<T> {
  const cached = await storage.read<Snapshot<T>>(key).catch(() => null);
  if (cached?.schema === 1 && cached.revision === revision) return cached.data;
  const data = await fetchData();
  await storage.write(key, { schema: 1, revision, data } satisfies Snapshot<T>).catch(() => undefined);
  return data;
}
