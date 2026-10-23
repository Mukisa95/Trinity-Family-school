import type { PersonMask, PhotoFace } from './photo-processing';

type Detection = { boundingBox: { originX: number; originY: number; width: number; height: number }; keypoints?: Array<{ x: number; y: number }> };
type MaskResult = { confidenceMasks?: Array<{ width: number; height: number; getAsFloat32Array(): Float32Array }>; close(): void };
type Detector = { detect(image: HTMLCanvasElement): { detections: Detection[] }; close(): void };
type Segmenter = { segment(image: HTMLCanvasElement): MaskResult; close(): void };
type VisionApi = {
  FaceDetector: { createFromOptions(files: object, options: object): Promise<Detector> };
  ImageSegmenter: { createFromOptions(files: object, options: object): Promise<Segmenter> };
};

let runtime: Promise<VisionApi> | undefined;
let detector: Promise<Detector> | undefined;
let segmenter: Promise<Segmenter> | undefined;
let idle: ReturnType<typeof setTimeout> | undefined;
let active = 0;
const files = { wasmLoaderPath: '/photo-tools/v1/wasm/vision_wasm_nosimd_internal.js', wasmBinaryPath: '/photo-tools/v1/wasm/vision_wasm_nosimd_internal.wasm' };

function loadRuntime() {
  const scope = globalThis as typeof globalThis & { Vision?: VisionApi };
  if (scope.Vision) return Promise.resolve(scope.Vision);
  if (!runtime) runtime = new Promise<VisionApi>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => { clearTimeout(timer); script.remove(); reject(new Error('Portrait tools could not start.')); };
    const timer = setTimeout(fail, 15000);
    script.src = '/photo-tools/v1/vision.js';
    script.onload = () => { if (!scope.Vision) { fail(); return; } clearTimeout(timer); resolve(scope.Vision); };
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch(error => { runtime = undefined; throw error; });
  return runtime;
}

async function withVision<T>(work: () => Promise<T>) {
  clearTimeout(idle); active++;
  try {
    // Give the editor a paint before a browser without worker canvases runs inference.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    return await work();
  } finally {
    active--;
    if (!active) idle = setTimeout(() => {
      if (detector) void detector.then(value => value.close()).catch(() => {});
      if (segmenter) void segmenter.then(value => value.close()).catch(() => {});
      detector = undefined; segmenter = undefined;
    }, 120000);
  }
}

/** Compatibility path for browsers whose worker cannot create a vision canvas. */
export function detectPhotoOnMain(canvas: HTMLCanvasElement): Promise<PhotoFace[]> {
  return withVision(async () => {
    if (!detector) detector = loadRuntime().then(vision => vision.FaceDetector.createFromOptions(files, {
      canvas: document.createElement('canvas'),
      baseOptions: { modelAssetPath: '/photo-tools/v1/face-detector.tflite', delegate: 'CPU' },
      runningMode: 'IMAGE', minDetectionConfidence: 0.65,
    })).catch(error => { detector = undefined; throw error; });
    return (await detector).detect(canvas).detections.map(({ boundingBox: box, keypoints }) => ({
      x: box.originX, y: box.originY, width: box.width, height: box.height,
      eyesY: keypoints && keypoints.length >= 2 ? (keypoints[0].y + keypoints[1].y) / 2 * canvas.height : undefined,
    }));
  });
}

export function segmentPhotoOnMain(canvas: HTMLCanvasElement): Promise<PersonMask> {
  return withVision(async () => {
    if (!segmenter) segmenter = loadRuntime().then(vision => vision.ImageSegmenter.createFromOptions(files, {
      canvas: document.createElement('canvas'),
      baseOptions: { modelAssetPath: '/photo-tools/v2/selfie-segmenter.tflite', delegate: 'CPU' },
      runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false,
    })).catch(error => { segmenter = undefined; throw error; });
    const result = (await segmenter).segment(canvas);
    try {
      const masks = result.confidenceMasks, mask = masks?.[masks.length === 1 ? 0 : 1];
      if (!mask) throw new Error('No person mask was returned.');
      return { width: mask.width, height: mask.height, confidence: new Float32Array(mask.getAsFloat32Array()) };
    } finally { result.close(); }
  });
}
