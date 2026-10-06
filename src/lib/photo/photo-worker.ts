import { enhancePhoto, type PhotoSettings, type PhotoRegion } from './photo-processing';

declare const Vision: {
  FaceDetector: { createFromOptions: (files: unknown, options: unknown) => Promise<{ detect: (image: ImageBitmap) => { detections: Array<{ boundingBox: { originX: number; originY: number; width: number; height: number }; keypoints: Array<{ x: number; y: number }> }> } }> };
};
declare function importScripts(...urls: string[]): void;
let detector: Awaited<ReturnType<typeof Vision.FaceDetector.createFromOptions>> | undefined;
const base = new URL('.', globalThis.location.href).href;
async function initialise() {
  if (!detector) {
    importScripts(`${base}vision.js`);
    detector = await Vision.FaceDetector.createFromOptions({
      wasmLoaderPath: `${base}wasm/vision_wasm_nosimd_internal.js`,
      wasmBinaryPath: `${base}wasm/vision_wasm_nosimd_internal.wasm`,
    }, { baseOptions: { modelAssetPath: `${base}face-detector.tflite`, delegate: 'CPU' }, runningMode: 'IMAGE', minDetectionConfidence: 0.65 });
  }
  return detector;
}
globalThis.onmessage = async (event: MessageEvent) => {
  const { id, type } = event.data;
  try {
    if (type === 'enhance') {
      const { pixels, width, height, settings, region } = event.data as { pixels: Uint8ClampedArray; width: number; height: number; settings: PhotoSettings; region?: PhotoRegion };
      const result = enhancePhoto(pixels, width, height, settings, region);
      postMessage({ id, result }, { transfer: [result.pixels.buffer] });
    } else if (type === 'detect') {
      const bitmap = event.data.bitmap as ImageBitmap;
      try {
        const result = (await initialise()).detect(bitmap);
        const faces = result.detections.map(({ boundingBox: box, keypoints }) => ({
          x: box.originX, y: box.originY, width: box.width, height: box.height,
          eyesY: keypoints?.length >= 2 ? (keypoints[0].y + keypoints[1].y) / 2 * bitmap.height : undefined,
        }));
        postMessage({ id, result: faces });
      } finally { bitmap.close(); }
    }
  } catch (error) {
    postMessage({ id, error: error instanceof Error ? error.message : 'Photo processing failed.' });
  }
};
