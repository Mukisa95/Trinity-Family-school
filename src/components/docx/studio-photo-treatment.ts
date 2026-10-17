import { segmentStudioPortrait, disposeStudioMatting } from '@/lib/photo/studio-matting-client';
import { StudioObjectClient } from '@/lib/photo/studio-object-client';
import type { PersonMask } from '@/lib/photo/photo-processing';
import { normalizeStudioPupilPhotoTreatment, type CustomPhotoLayer, type StudioPupilPhotoTreatment } from './custom-photo-types';
import { extractSelectedPixels, refineSelection } from './studio-selection';
import { replayStudioSelection } from './studio-selection-recipe';

/** Share the exact confidence conversion between interactive and batch removal. */
export function studioPersonSelection(value: PersonMask, width: number, height: number) {
  const small = document.createElement('canvas'); small.width = value.width; small.height = value.height;
  const ctx = small.getContext('2d')!, data = ctx.createImageData(small.width, small.height);
  for (let i = 0; i < value.confidence.length; i++) {
    const confidence = Math.max(0, Math.min(1, value.confidence[i]));
    data.data[i * 4] = data.data[i * 4 + 1] = data.data[i * 4 + 2] = 255;
    data.data[i * 4 + 3] = confidence * 255;
  }
  ctx.putImageData(data, 0, 0);
  const large = document.createElement('canvas'); large.width = width; large.height = height;
  const out = large.getContext('2d', { willReadFrequently: true })!;
  out.imageSmoothingEnabled = true; out.imageSmoothingQuality = 'high'; out.drawImage(small, 0, 0, width, height);
  const pixels = out.getImageData(0, 0, width, height).data;
  const result = new Uint8ClampedArray(width * height);
  for (let i = 0; i < result.length; i++) result[i] = pixels[i * 4 + 3];
  return result;
}

/** A bounded device-memory cache. Serialize AI work instead of spawning a worker per pupil. */
export class StudioPhotoTreatmentCache {
  private entries = new Map<string, Promise<string>>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private limit = 12) {}
  get(key: string, create: () => Promise<string>) {
    const cached = this.entries.get(key);
    if (cached) { this.entries.delete(key); this.entries.set(key, cached); return cached; }
    const pending = this.queue.then(create);
    this.queue = pending.then(() => undefined, () => undefined);
    this.entries.set(key, pending);
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!);
    void pending.catch(() => { if (this.entries.get(key) === pending) this.entries.delete(key); });
    return pending;
  }
  clear() { this.entries.clear(); }
}

export function studioPhotoTreatmentKey(layer: CustomPhotoLayer, photo: string, dimensions: { widthMm: number; heightMm: number }, settings: StudioPupilPhotoTreatment) {
  // Position, selection and individual raster edits never belong to the reusable recipe.
  const { id, label, x, y, opacity, hidden, locked, pdfPlacement, pupilImageEdits, rasterOverride, pupilScopeId, pupilDataMode, outerRotation, constrainToPage, ...pixels } = layer;
  return JSON.stringify([photo, dimensions.widthMm / dimensions.heightMm, pixels, normalizeStudioPupilPhotoTreatment(settings)]);
}

const treatmentCache = new StudioPhotoTreatmentCache();
export function clearStudioPhotoTreatments() { treatmentCache.clear(); disposeStudioMatting(); }

export function treatStudioPupilPhoto(key: string, createSource: () => Promise<HTMLCanvasElement>, settings: StudioPupilPhotoTreatment) {
  return treatmentCache.get(key, async () => {
    const objects = new StudioObjectClient();
    let canvas: HTMLCanvasElement | undefined;
    try {
      canvas = await createSource();
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      const original = context.getImageData(0, 0, canvas.width, canvas.height);
      const selection = await replayStudioSelection(canvas.width, canvas.height, original.data, settings.selection || [{ tool: 'person', mode: 'replace' }], async step => {
        const mask = step.tool === 'object' ? await objects.select(canvas!, step.point) : await segmentStudioPortrait(canvas!);
        return studioPersonSelection(mask, canvas!.width, canvas!.height);
      });
      if (!selection.some((value, index) => value > 128 && original.data[index * 4 + 3] > 0)) throw new Error('No clear person was found. Use an individual correction for this pupil.');
      const refined = refineSelection(selection, canvas.width, canvas.height, settings.feather, settings.edgeShift);
      context.putImageData(new ImageData(extractSelectedPixels(original.data, refined, settings.keep !== false), canvas.width, canvas.height), 0, 0);
      return canvas.toDataURL('image/png');
    } finally {
      objects.dispose();
      if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
  });
}
