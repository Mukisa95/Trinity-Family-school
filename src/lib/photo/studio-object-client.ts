import { preparePhotoTools } from './photo-tools-client';
import type { PersonMask } from './photo-processing';
const ASSETS = ['/photo-tools/studio-v1/selection-worker.js', '/photo-tools/studio-v1/magic-touch.tflite'];
let preparation: Promise<void> | undefined;
async function cacheAssets(urls: string[]) {
    if (!('caches' in globalThis)) return;
    const cache = await caches.open('trinity-photo-tools-v1');
    for (const url of urls) {
      if (await cache.match(url)) continue;
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error('Object selection tools are unavailable. Connect once to download them, or use the manual selection tools.');
        await cache.put(url, response);
      } finally { clearTimeout(timer); }
    }
}
async function prepare() {
  await preparePhotoTools();
  if (!preparation) preparation = cacheAssets(ASSETS).catch(error => { preparation = undefined; throw error; });
  return preparation;
}

export class StudioObjectClient {
  private worker?: Worker;
  private disposed = false;
  private rejectPending?: (reason: Error) => void;
  private request(payload: object, transfer: Transferable[]): Promise<PersonMask> {
    if (this.disposed) return Promise.reject(new Error('Selection workspace closed.'));
    this.worker ||= new Worker(ASSETS[0]);
    return new Promise((resolve, reject) => {
      const fail = (reason: Error) => { clearTimeout(timer); this.worker?.terminate(); this.worker = undefined; this.rejectPending = undefined; reject(reason); };
      const timer = setTimeout(() => fail(new Error('Object selection took too long. Use the brush or polygon selection, or try again.')), 45000);
      this.rejectPending = fail;
      this.worker!.onerror = () => fail(new Error('Object selection could not start. The manual selection tools are still available.'));
      this.worker!.onmessage = event => { clearTimeout(timer); this.rejectPending = undefined; if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.result); };
      try { this.worker!.postMessage({ id: 1, ...payload }, transfer); }
      catch (error) { fail(error instanceof Error ? error : new Error('Could not read this layer.')); }
    });
  }
  async select(canvas: HTMLCanvasElement, point: { x: number; y: number }) {
    await prepare();
    if (this.disposed) throw new Error('Selection workspace closed.');
    const bitmap = await createImageBitmap(canvas);
    if (this.disposed) { bitmap.close(); throw new Error('Selection workspace closed.'); }
    try { return await this.request({ bitmap, point }, [bitmap]); }
    catch (error) { bitmap.close(); throw error; }
  }
  async refine(canvas: HTMLCanvasElement, mask: PersonMask) {
    await cacheAssets([ASSETS[0]]);
    if (this.disposed) throw new Error('Selection workspace closed.');
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    const confidence = new Float32Array(mask.confidence);
    return this.request({ type: 'refine', pixels, width: canvas.width, height: canvas.height, mask: { ...mask, confidence } }, [pixels.buffer, confidence.buffer]);
  }
  dispose() { this.disposed = true; this.rejectPending?.(new Error('Selection workspace closed.')); this.worker?.terminate(); this.worker = undefined; }
}
