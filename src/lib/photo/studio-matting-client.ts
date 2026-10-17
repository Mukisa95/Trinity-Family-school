import type { PersonMask } from './photo-processing';
const BASE = '/photo-tools/studio-v2/';
const ASSETS = ['matting-worker.js', 'ort.wasm.min.js', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm', 'modnet.onnx'];
let worker: Worker | undefined, preparation: Promise<void> | undefined, idle: ReturnType<typeof setTimeout> | undefined;
let queue: Promise<unknown> = Promise.resolve(), rejectPending: ((reason: Error) => void) | undefined;
async function prepare() {
  if (!preparation) preparation = (async () => {
    if (!('caches' in globalThis)) return;
    const cache = await caches.open('trinity-photo-tools-v1');
    for (const name of ASSETS) {
      const url = BASE + name;
      if (await cache.match(url)) continue;
      const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error('Portrait tools could not download. Connect once and retry, or use manual selection.');
      await cache.put(url, response);
    }
  })().catch(error => { preparation = undefined; throw error; });
  return preparation;
}
export function disposeStudioMatting() {
  clearTimeout(idle); rejectPending?.(new Error('Photo Studio closed.')); rejectPending = undefined;
  worker?.terminate(); worker = undefined;
}
/** Serialize interactive and batch requests; reuse one model rather than loading one per pupil. */
export function segmentStudioPortrait(canvas: HTMLCanvasElement): Promise<PersonMask> {
  const task = queue.then(async () => {
    clearTimeout(idle); await prepare();
    const bitmap = await createImageBitmap(canvas);
    worker ||= new Worker(`${BASE}matting-worker.js`);
    return new Promise<PersonMask>((resolve, reject) => {
      const finish = (error?: Error, result?: PersonMask) => {
        clearTimeout(timer); rejectPending = undefined;
        if (error) { worker?.terminate(); worker = undefined; reject(error); }
        else resolve(result!);
        idle = setTimeout(disposeStudioMatting, 120000);
      };
      const timer = setTimeout(() => finish(new Error('Portrait matting took too long. Retry or use an individual selection.')), 120000);
      rejectPending = reason => finish(reason);
      worker!.onerror = () => finish(new Error('Portrait tools could not start on this device. Manual selection remains available.'));
      worker!.onmessage = event => finish(event.data.error ? new Error(event.data.error) : undefined, event.data.result);
      try { worker!.postMessage({ id: 1, bitmap }, [bitmap]); } catch (error) { bitmap.close(); finish(error instanceof Error ? error : new Error('Photo could not be read.')); }
    });
  });
  queue = task.catch(() => undefined);
  return task;
}
