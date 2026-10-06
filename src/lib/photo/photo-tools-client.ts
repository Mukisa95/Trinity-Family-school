import { enhancePhoto, type PersonMask, type PhotoFace, type PhotoRegion, type PhotoSettings } from './photo-processing';

export const PHOTO_TOOL_ASSETS = [
  '/photo-tools/v2/photo-worker.js', '/photo-tools/v1/vision.js', '/photo-tools/v1/face-detector.tflite',
  '/photo-tools/v1/wasm/vision_wasm_nosimd_internal.js', '/photo-tools/v1/wasm/vision_wasm_nosimd_internal.wasm',
];
export const PHOTO_TOOLS_CACHE = 'trinity-photo-tools-v1';
export const PHOTO_BACKGROUND_MODEL = '/photo-tools/v2/selfie-segmenter.tflite';
let preparation: Promise<void> | undefined;
let backgroundPreparation: Promise<void> | undefined;
async function cacheAsset(path: string) {
  const cache = await caches.open(PHOTO_TOOLS_CACHE);
  if (await cache.match(path)) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(path, { signal: controller.signal });
    if (!response.ok) throw new Error('Unable to download portrait tools. Connect once and try again.');
    await cache.put(path, response);
  } finally { clearTimeout(timer); }
}
// Reuse an idle detector between consecutive pupils; release its memory after two minutes.
let idleWorker: Worker | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
/** Only public processing tools are cached here, never pupil photos. */
export function preparePhotoTools(): Promise<void> {
  if (!preparation) preparation = (async () => {
    if (!('caches' in globalThis)) return;
    await Promise.all(PHOTO_TOOL_ASSETS.map(cacheAsset));
  })().catch(error => { preparation = undefined; throw error; });
  return preparation;
}
export async function prepareBackgroundTools(): Promise<void> {
  await preparePhotoTools();
  if (!backgroundPreparation) backgroundPreparation = (async () => {
    if ('caches' in globalThis) await cacheAsset(PHOTO_BACKGROUND_MODEL);
  })().catch(error => { backgroundPreparation = undefined; throw error; });
  return backgroundPreparation;
}

export class PhotoToolsClient {
  private worker?: Worker;
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private disposed = false;
  private lastMask?: { source: string; area: PhotoRegion; result: Promise<PersonMask> };
  private request<T>(type: string, payload: object, transfer: Transferable[] = [], timeout = 15000): Promise<T> {
    if (this.disposed) return Promise.reject(new Error('Photo editor closed.'));
    if (!this.worker) {
      clearTimeout(idleTimer);
      this.worker = idleWorker ?? new Worker('/photo-tools/v2/photo-worker.js');
      idleWorker = undefined;
      this.worker.onmessage = event => {
        const item = this.pending.get(event.data.id);
        if (!item) return;
        clearTimeout(item.timer); this.pending.delete(event.data.id);
        if (event.data.error) item.reject(new Error(event.data.error)); else item.resolve(event.data.result);
      };
      this.worker.onerror = () => this.stopWorker(new Error('Portrait tools could not start.'));
    }
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.stopWorker(new Error('Photo processing took too long. Please try again.')), timeout);
      this.pending.set(id, { resolve: value => resolve(value as T), reject, timer });
      try { this.worker!.postMessage({ id, type, ...payload }, transfer); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  async detect(canvas: HTMLCanvasElement): Promise<PhotoFace[]> {
    await preparePhotoTools();
    if (this.disposed) throw new Error('Photo editor closed.');
    const bitmap = await createImageBitmap(canvas);
    try { return await this.request<PhotoFace[]>('detect', { bitmap }, [bitmap], 25000); }
    catch (error) { bitmap.close(); throw error; }
  }
  segment(canvas: HTMLCanvasElement, key?: { source: string; area: PhotoRegion }): Promise<PersonMask> {
    const last = this.lastMask;
    if (key && last && last.source === key.source && (['x', 'y', 'width', 'height'] as const).every(field => last.area[field] === key.area[field])) return last.result;
    const result = (async () => {
      await prepareBackgroundTools();
      if (this.disposed) throw new Error('Photo editor closed.');
      const bitmap = await createImageBitmap(canvas);
      try { return await this.request<PersonMask>('segment', { bitmap }, [bitmap], 25000); }
      catch (error) { bitmap.close(); throw error; }
    })();
    if (key) {
      this.lastMask = { ...key, result };
      void result.catch(() => { if (this.lastMask?.result === result) this.lastMask = undefined; });
    }
    return result;
  }
  async enhance(pixels: Uint8ClampedArray, width: number, height: number, settings: PhotoSettings, region?: PhotoRegion): Promise<ReturnType<typeof enhancePhoto>> {
    if (typeof Worker === 'undefined') {
      await new Promise(resolve => setTimeout(resolve, 0));
      return enhancePhoto(pixels, width, height, settings, region);
    }
    // Keep the original pixels for comparison and a local fallback.
    const copy = new Uint8ClampedArray(pixels);
    try { return await this.request('enhance', { pixels: copy, width, height, settings, region }, [copy.buffer]); }
    catch (error) {
      if (this.disposed) throw error;
      await new Promise(resolve => setTimeout(resolve, 0));
      return enhancePhoto(pixels, width, height, settings, region);
    }
  }
  private stopWorker(error: Error) {
    this.worker?.terminate(); this.worker = undefined;
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
    this.pending.clear();
  }
  dispose() {
    this.disposed = true;
    if (this.worker && this.pending.size === 0) {
      idleWorker?.terminate();
      clearTimeout(idleTimer);
      idleWorker = this.worker; this.worker = undefined;
      idleWorker.onmessage = null; idleWorker.onerror = null;
      idleTimer = setTimeout(() => { idleWorker?.terminate(); idleWorker = undefined; }, 120000);
    } else this.stopWorker(new Error('Photo editor closed.'));
  }
}
