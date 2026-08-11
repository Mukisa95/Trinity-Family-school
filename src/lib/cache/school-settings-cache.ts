import type { SchoolSettings } from '@/types';
import {
  persistentCollectionCacheKey,
  readPersistentCollection,
  writePersistentCollection,
} from './persistent-collection-cache';

const CACHE_SCHEMA = 1;

export type SchoolSettingsCacheSnapshot = {
  schema: number;
  revision: number;
  data: SchoolSettings;
};

function cacheKey(): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  // This is deliberately project-scoped, not user-scoped: the same public
  // school profile is rendered on the login page before an identity exists.
  return persistentCollectionCacheKey(projectId, 'school-settings', 'public-profile');
}

export async function readSchoolSettingsCache(): Promise<SchoolSettingsCacheSnapshot | null> {
  const snapshot = await readPersistentCollection<SchoolSettingsCacheSnapshot>(cacheKey());
  if (!snapshot || snapshot.schema !== CACHE_SCHEMA || !snapshot.data) return null;
  return snapshot;
}

export async function writeSchoolSettingsCache(
  revision: number,
  settings: SchoolSettings,
): Promise<void> {
  await writePersistentCollection(cacheKey(), {
    schema: CACHE_SCHEMA,
    revision,
    data: settings,
  } satisfies SchoolSettingsCacheSnapshot);
}
