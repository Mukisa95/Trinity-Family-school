// This worker uses the repository's pinned MediaPipe runtime and model entirely locally.
export {};
import { refinePersonMask, type PersonMask } from './photo-processing';
declare function importScripts(...urls: string[]): void;
interface ConfidenceMask { width: number; height: number; getAsFloat32Array: () => Float32Array }
declare const Vision: { InteractiveSegmenterLegacy: { createFromOptions: (files: object, options: object) => Promise<{ segment: (image: ImageBitmap, roi: object) => { confidenceMasks?: ConfidenceMask[]; close: () => void } }> } };
let segmenter: ReturnType<typeof Vision.InteractiveSegmenterLegacy.createFromOptions> | undefined;
async function initialise() {
  if (!segmenter) {
    const base = new URL('/photo-tools/v1/', globalThis.location.href).href;
    importScripts(`${base}vision.js`);
    segmenter = Vision.InteractiveSegmenterLegacy.createFromOptions({ wasmLoaderPath: `${base}wasm/vision_wasm_nosimd_internal.js`, wasmBinaryPath: `${base}wasm/vision_wasm_nosimd_internal.wasm` }, {
      baseOptions: { modelAssetPath: new URL('/photo-tools/studio-v1/magic-touch.tflite', globalThis.location.href).href, delegate: 'CPU' }, outputConfidenceMasks: true, outputCategoryMask: false,
    }).catch(error => { segmenter = undefined; throw error; });
  }
  return segmenter;
}
globalThis.onmessage = async event => {
  const { id, bitmap, point, type, pixels, width, height, mask } = event.data as { id: number; bitmap?: ImageBitmap; point: { x: number; y: number }; type?: string; pixels: Uint8ClampedArray; width: number; height: number; mask: PersonMask };
  try {
    if (type === 'refine') {
      const result = refinePersonMask(pixels, width, height, mask);
      postMessage({ id, result }, { transfer: [result.confidence.buffer] });
      return;
    }
    if (!bitmap) throw new Error('No layer image was supplied.');
    const result = (await initialise()).segment(bitmap, { keypoint: point });
    try {
      const masks = result.confidenceMasks;
      const mask = masks?.[masks.length === 1 ? 0 : 1]; // labels.txt: background, subject
      if (!mask) throw new Error('The object selector returned no mask.');
      const confidence = new Float32Array(mask.getAsFloat32Array());
      postMessage({ id, result: { width: mask.width, height: mask.height, confidence } }, { transfer: [confidence.buffer] });
    } finally { result.close(); }
  } catch (error) { postMessage({ id, error: error instanceof Error ? error.message : 'Object selection failed.' }); }
  finally { bitmap?.close(); }
};
