/** Private offline thumbnails derived from existing inline cache photos. Originals are untouched. */
import { persistentCollectionCacheKey, readPersistentCollection, writePersistentCollection } from '@/lib/cache/persistent-collection-cache';
import { measureWorkspaceOperation } from '@/lib/startup/workspace-timing';
import { yieldAndroidPreparation } from './android-preparation-work';

const MAX_THUMBNAILS = 600, MAX_SOURCE_CHARS = 12 * 1024 * 1024;
function newCache(accountId: string) {
  return { accountId, thumbnails: new Map<string, Promise<string | undefined>>(),
    sources: new Map<string, Promise<string | undefined>>(), sourceChars: 0,
    loaded: undefined as Promise<void> | undefined, revision: 0, persistedRevision: 0 };
}
let cache = newCache('');
function accountCache(accountId: string) {
  if (cache.accountId !== accountId) cache = newCache(accountId);
  return cache;
}
function cacheKey(accountId: string) {
  return persistentCollectionCacheKey(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools', 'android-photo-thumbnails-v1', `user:${accountId}`);
}
async function loadThumbnails(current: ReturnType<typeof newCache>) {
  current.loaded ||= measureWorkspaceOperation('android:photo-cache-read', async () => {
    const entries = await readPersistentCollection<unknown>(cacheKey(current.accountId));
    if (!Array.isArray(entries)) return;
    for (const entry of entries.slice(-MAX_THUMBNAILS)) {
      if (!Array.isArray(entry) || !/^[a-f0-9]{64}$/.test(entry[0]) || typeof entry[1] !== 'string'
        || !entry[1].startsWith('data:image/jpeg;base64,') || entry[1].length > 8192) continue;
      if (!current.thumbnails.has(entry[0])) current.thumbnails.set(entry[0], Promise.resolve(entry[1]));
    }
  });
  await current.loaded;
}

export async function offlinePupilPhoto(accountId: string, photo: unknown, signal?: AbortSignal): Promise<string | undefined> {
  if (typeof photo !== 'string') return undefined;
  // Remote photos remain links; preparation never downloads another pupil image.
  if (!photo.startsWith('data:')) return photo;
  if (!/^data:image\/(jpeg|png|webp);base64,/i.test(photo)) return undefined;
  if (photo.length <= 8192) return photo;
  const current = accountCache(accountId);
  const existing = current.sources.get(photo);
  if (existing) {
    if (signal?.aborted) throw new DOMException('Preparation cancelled', 'AbortError');
    return existing;
  }
  const prepare = async () => {
    await yieldAndroidPreparation(signal);
    await loadThumbnails(current);
    const digest = await measureWorkspaceOperation('android:photo-source-hash', () => crypto.subtle.digest('SHA-256', new TextEncoder().encode(photo)));
    const key = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    let result = current.thumbnails.get(key);
    if (!result) {
      result = (async () => {
        let bitmap: ImageBitmap | undefined;
        try {
          await yieldAndroidPreparation(signal);
          // Fetching an inline data URL decodes locally, without a network request.
          bitmap = await measureWorkspaceOperation('android:photo-decode', async () => createImageBitmap(await (await fetch(photo)).blob()));
          await yieldAndroidPreparation(signal);
          const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 96;
          const context = canvas.getContext('2d'); if (!context) return undefined;
          context.fillStyle = '#ffffff'; context.fillRect(0, 0, 96, 96);
          const scale = Math.min(96 / bitmap.width, 96 / bitmap.height);
          const width = bitmap.width * scale, height = bitmap.height * scale;
          context.drawImage(bitmap, (96 - width) / 2, (96 - height) / 2, width, height);
          return await measureWorkspaceOperation('android:photo-thumbnail', async () => {
            for (const quality of [0.65, 0.45, 0.25]) {
              await yieldAndroidPreparation(signal);
              // This is a bounded 96x96 thumbnail, not the original photo.
              // WebView may defer HTMLCanvas.toBlob callbacks for seconds;
              // encode this tiny image within its yielded task instead.
              const thumbnail = await measureWorkspaceOperation('android:photo-encode', () => canvas.toDataURL('image/jpeg', quality));
              if (thumbnail.startsWith('data:image/jpeg;base64,') && thumbnail.length <= 8192) { current.revision++; return thumbnail; }
            }
            return undefined;
          });
        } catch (error) {
          if (signal?.aborted) throw error;
          return undefined; // Damaged photos must not prevent their records from being available.
        } finally { bitmap?.close(); }
      })();
      if (current.thumbnails.size >= MAX_THUMBNAILS) current.thumbnails.delete(current.thumbnails.keys().next().value!);
      current.thumbnails.set(key, result);
      void result.catch(() => { if (current.thumbnails.get(key) === result) current.thumbnails.delete(key); });
    }
    return result;
  };
  const pending = prepare();
  // Avoid rehashing unchanged inline images on repeated exports. Bound retained originals.
  if (photo.length <= MAX_SOURCE_CHARS) {
    while (current.sources.size && current.sourceChars + photo.length > MAX_SOURCE_CHARS) {
      const oldest = current.sources.keys().next().value!;
      current.sources.delete(oldest); current.sourceChars -= oldest.length;
    }
    current.sources.set(photo, pending); current.sourceChars += photo.length;
    void pending.catch(() => { if (current.sources.get(photo) === pending) { current.sources.delete(photo); current.sourceChars -= photo.length; } });
  }
  return pending;
}

export async function projectOfflinePhotos(accountId: string, pupils: Record<string, unknown>[], signal?: AbortSignal) {
  const current = accountCache(accountId);
  let index = 0, bytes = 0;
  const photos: (string | undefined)[] = new Array(pupils.length);
  // Two decoders leave more CPU available to the foreground page than the former four.
  await measureWorkspaceOperation('android:photo-preparation', () => Promise.all(Array.from({ length: Math.min(2, pupils.length) }, async () => {
    while (index < pupils.length) {
      const next = index++;
      photos[next] = await offlinePupilPhoto(accountId, pupils[next].photo, signal);
      if (next % 16 === 0) await yieldAndroidPreparation(signal);
    }
  })));
  const result: Record<string, unknown>[] = [];
  for (let i = 0; i < pupils.length; i++) {
    if (i % 32 === 0) await yieldAndroidPreparation(signal);
    const { photo: original, ...record } = pupils[i];
    const photo = photos[i];
    if (photo && (!photo.startsWith('data:') || bytes + photo.length <= 5 * 1024 * 1024)) {
      record.photo = photo; if (photo.startsWith('data:')) bytes += photo.length;
    }
    result.push(record);
  }
  if (current.revision !== current.persistedRevision) {
    const revision = current.revision;
    const entries = await Promise.all([...current.thumbnails].map(async ([key, value]) => [key, await value]));
    await yieldAndroidPreparation(signal);
    await measureWorkspaceOperation('android:photo-cache-write', () => writePersistentCollection(cacheKey(accountId), entries.filter(entry => typeof entry[1] === 'string'), undefined, true, false));
    current.persistedRevision = revision;
  }
  return result;
}
