import { enhancePhoto, type PhotoSettings, type PhotoRegion, type PersonMask } from './photo-processing';

declare const Vision: {
  FaceDetector: { createFromOptions: (files: unknown, options: unknown) => Promise<{ detect: (image: ImageBitmap) => { detections: Array<{ boundingBox: { originX: number; originY: number; width: number; height: number }; keypoints: Array<{ x: number; y: number }> }> } }> };
  ImageSegmenter: { createFromOptions: (files: unknown, options: unknown) => Promise<{ segment: (image: ImageBitmap) => {
    confidenceMasks?: Array<{ width: number; height: number; getAsFloat32Array: () => Float32Array }>;
    close: () => void;
  } }> };
};
declare function importScripts(...urls: string[]): void;
let detector: ReturnType<typeof Vision.FaceDetector.createFromOptions> | undefined;
let segmenter: ReturnType<typeof Vision.ImageSegmenter.createFromOptions> | undefined;
let visionLoaded = false;
// The v3 worker reuses the immutable v1 runtime/detector and v2 segmenter.
const base = new URL('/photo-tools/v1/', globalThis.location.href).href;
function files() {
  if (!visionLoaded) {
    importScripts(`${base}vision.js`);
    visionLoaded = true;
  }
  return { wasmLoaderPath: `${base}wasm/vision_wasm_nosimd_internal.js`, wasmBinaryPath: `${base}wasm/vision_wasm_nosimd_internal.wasm` };
}
function initialise() {
  if (!detector) {
    const wasmFiles = files();
    detector = Vision.FaceDetector.createFromOptions(wasmFiles, {
      baseOptions: { modelAssetPath: `${base}face-detector.tflite`, delegate: 'CPU' }, runningMode: 'IMAGE', minDetectionConfidence: 0.65,
    }).catch(error => { detector = undefined; throw error; });
  }
  return detector;
}
function initialiseSegmenter() {
  if (!segmenter) {
    const wasmFiles = files();
    segmenter = Vision.ImageSegmenter.createFromOptions(wasmFiles, {
      baseOptions: { modelAssetPath: new URL('/photo-tools/v2/selfie-segmenter.tflite', globalThis.location.href).href, delegate: 'CPU' },
      runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false,
    }).catch(error => { segmenter = undefined; throw error; });
  }
  return segmenter;
}
globalThis.onmessage = async (event: MessageEvent) => {
  const { id, type } = event.data;
  try {
    if (type === 'enhance') {
      const { pixels, width, height, settings, region, mask } = event.data as { pixels: Uint8ClampedArray; width: number; height: number; settings: PhotoSettings; region?: PhotoRegion; mask?: PersonMask };
      const result = enhancePhoto(pixels, width, height, settings, region, mask);
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
    } else if (type === 'segment') {
      const bitmap = event.data.bitmap as ImageBitmap;
      try {
        const result = (await initialiseSegmenter()).segment(bitmap);
        try {
          const masks = result.confidenceMasks;
          // The binary model's single channel is person confidence. Runtimes
          // that expose both categories place person at index 1.
          const mask = masks?.[masks.length === 1 ? 0 : 1];
          if (!mask) throw new Error('No person mask was returned.');
          const confidence = new Float32Array(mask.getAsFloat32Array());
          postMessage({ id, result: { width: mask.width, height: mask.height, confidence } }, { transfer: [confidence.buffer] });
        } finally { result.close(); }
      } finally { bitmap.close(); }
    }
  } catch (error) {
    postMessage({ id, error: error instanceof Error ? error.message : 'Photo processing failed.' });
  }
};
