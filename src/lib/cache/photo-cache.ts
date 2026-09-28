import type { Photo } from '@/types';
import { liteInvalidate, liteRead, liteReadMetadata, liteWrite, LITE_KEYS, LITE_TTL } from './lite-cache';

const PHOTO_CACHE_SCHEMA = 1;

export type PhotoCacheSnapshot = {
  schema: number;
  revision: number;
  data: Photo[];
};

function photoCacheKey(): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  return `photos:${encodeURIComponent(projectId)}`;
}

export function readPhotoCache(): PhotoCacheSnapshot | null {
  const cacheKey = photoCacheKey();
  const current = liteRead<PhotoCacheSnapshot | Photo[]>(cacheKey);
  const cached = current ?? liteRead<PhotoCacheSnapshot | Photo[]>(LITE_KEYS.photos);
  if (!cached) return null;

  // One-time migration from the former array-only, 24-hour photo cache. The
  // unknown revision deliberately reconciles once after the shared revision
  // channel is ready, while still painting the old snapshot immediately.
  if (Array.isArray(cached)) {
    const migrated: PhotoCacheSnapshot = {
      schema: PHOTO_CACHE_SCHEMA,
      revision: -1,
      data: cached,
    };
    liteWrite(cacheKey, migrated, LITE_TTL.photos);
    liteInvalidate(LITE_KEYS.photos);
    return migrated;
  }

  if (cached.schema !== PHOTO_CACHE_SCHEMA || !Array.isArray(cached.data)) return null;

  if (current === null || liteReadMetadata(cacheKey)?.ttlMs !== LITE_TTL.photos) {
    liteWrite(cacheKey, cached, LITE_TTL.photos);
    liteInvalidate(LITE_KEYS.photos);
  }
  return cached;
}

export function writePhotoCache(revision: number, photos: Photo[]): void {
  liteWrite(
    photoCacheKey(),
    { schema: PHOTO_CACHE_SCHEMA, revision, data: photos } satisfies PhotoCacheSnapshot,
    LITE_TTL.photos,
  );
}

export function nextPhotoCacheRevision(currentRevision: number, cachedRevision?: number): number {
  return Math.max(currentRevision, cachedRevision ?? currentRevision) + 1;
}

export function upsertPhotoInList(photos: Photo[], photo: Photo): Photo[] {
  return [photo, ...photos.filter(existing => existing.id !== photo.id)];
}

export function updatePhotoInList(
  photos: Photo[],
  id: string,
  updates: Partial<Photo>,
): Photo[] {
  return photos.map(photo => photo.id === id ? { ...photo, ...updates, id } : photo);
}

export function setPrimaryPhotoInList(
  photos: Photo[],
  id: string,
  category: Photo['category'],
): Photo[] {
  return photos.map(photo => photo.category === category
    ? { ...photo, isPrimary: photo.id === id }
    : photo);
}

export function removePhotoFromList(photos: Photo[], id: string): Photo[] {
  return photos.filter(photo => photo.id !== id);
}
