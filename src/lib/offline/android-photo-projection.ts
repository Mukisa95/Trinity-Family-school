import { yieldToInterface } from '@/lib/performance/background-task';
/** Private offline thumbnails derived from existing inline cache photos. Originals are untouched. */
const thumbnails = new Map<string, Promise<string | undefined>>();
let owner = '';
export async function offlinePupilPhoto(accountId: string, photo: unknown): Promise<string | undefined> {
  if (typeof photo !== 'string') return undefined;
  // Remote photos remain links; preparation never downloads another pupil image.
  if (!photo.startsWith('data:')) return photo;
  if (!/^data:image\/(jpeg|png|webp);base64,/i.test(photo)) return undefined;
  if (photo.length <= 8_192) return photo;
  if (owner !== accountId) { thumbnails.clear(); owner = accountId; }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(photo));
  const key = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  let result = thumbnails.get(key);
  if (!result) {
    result = (async () => {
      let bitmap: ImageBitmap | undefined;
      try {
        const comma = photo.indexOf(',');
        const bytes = Uint8Array.from(atob(photo.slice(comma + 1)), value => value.charCodeAt(0));
        bitmap = await createImageBitmap(new Blob([bytes], { type: photo.slice(5, photo.indexOf(';')) }));
        const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 96;
        const context = canvas.getContext('2d'); if (!context) return undefined;
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, 96, 96);
        const scale = Math.min(96 / bitmap.width, 96 / bitmap.height);
        const width = bitmap.width * scale, height = bitmap.height * scale;
        context.drawImage(bitmap, (96 - width) / 2, (96 - height) / 2, width, height);
        for (const quality of [0.65, 0.45, 0.25]) {
          const thumbnail = canvas.toDataURL('image/jpeg', quality);
          if (thumbnail.length <= 8_192) return thumbnail;
        }
      } catch { /* A damaged photo must not prevent the pupil record from being available. */ }
      finally { bitmap?.close(); }
      return undefined;
    })();
    if (thumbnails.size >= 1_500) thumbnails.delete(thumbnails.keys().next().value!);
    thumbnails.set(key, result);
  }
  return result;
}

export async function projectOfflinePhotos(accountId: string, pupils: Record<string, unknown>[]) {
  let index = 0, bytes = 0;
  const photos: (string | undefined)[] = new Array(pupils.length);
  // Bound concurrent image decoders and the aggregate photo payload to 5 MiB.
  await Promise.all(Array.from({ length: Math.min(4, pupils.length) }, async () => {
    while (index < pupils.length) {
      const current = index++;
      // Yield before decoding/hashing each batch; Promise continuations alone do not let input run.
      if (current % 8 === 0) await yieldToInterface();
      photos[current] = await offlinePupilPhoto(accountId, pupils[current].photo);
    }
  }));
  for (let i = 0; i < pupils.length; i++) {
    const photo = photos[i]; delete pupils[i].photo;
    if (photo && (!photo.startsWith('data:') || bytes + photo.length <= 5 * 1024 * 1024)) {
      pupils[i].photo = photo; if (photo.startsWith('data:')) bytes += photo.length;
    }
  }
  return pupils;
}
