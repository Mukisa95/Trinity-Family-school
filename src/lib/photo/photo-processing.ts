/** Pure, bounded photo corrections. No network, face recognition, or generated detail. */
export type PhotoFilter = 'natural' | 'clean' | 'soft' | 'vivid' | 'warm' | 'cool' | 'mono';
export type PassportFraming = 'tight' | 'standard' | 'headroom';
export type PhotoBackground = 'white' | 'grey' | 'blue';
export interface PhotoSettings {
  auto: boolean; brightness: number; warmth: number; removeBackground?: boolean;
  contrast?: number; shadows?: number; highlights?: number; saturation?: number; tint?: number;
  sharpness?: number; smoothing?: number; filter?: PhotoFilter;
  backgroundColor?: PhotoBackground; backgroundEdge?: number; backgroundFeather?: number;
}
export const DEFAULT_PHOTO_SETTINGS: PhotoSettings = { auto: true, brightness: 0, warmth: 0, removeBackground: false,
  contrast: 0, shadows: 0, highlights: 0, saturation: 0, tint: 0, sharpness: 0, smoothing: 0,
  filter: 'natural', backgroundColor: 'white', backgroundEdge: 0, backgroundFeather: 35 };
export const PHOTO_FILTERS: ReadonlyArray<{ id: PhotoFilter; label: string; values: Partial<PhotoSettings> }> = [
  { id: 'natural', label: 'Natural', values: {} },
  { id: 'clean', label: 'Clean', values: { shadows: 10, highlights: -8, contrast: 4, sharpness: 12, saturation: -3 } },
  { id: 'soft', label: 'Soft', values: { smoothing: 25, contrast: -5, highlights: -8 } },
  { id: 'vivid', label: 'Vivid', values: { contrast: 8, saturation: 16, sharpness: 10 } },
  { id: 'warm', label: 'Warm', values: { warmth: 8, saturation: 4 } },
  { id: 'cool', label: 'Cool', values: { warmth: -8, saturation: 4 } },
  { id: 'mono', label: 'B&W', values: { saturation: -100, contrast: 5 } },
];
export interface PhotoRegion { x: number; y: number; width: number; height: number }
export interface PhotoFace extends PhotoRegion { eyesY?: number }
export interface PhotoWarning { code: string; message: string }
export interface PersonMask { width: number; height: number; confidence: Float32Array }
const clamp = (value: number, min = 0, max = 255) => Math.max(min, Math.min(max, value));
const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function suggestFaceCrop(face: PhotoFace, width: number, height: number, headTop?: number, framing: PassportFraming = 'standard'): PhotoRegion {
  // Place the crown near the top and chin at about 81% of the square. This
  // preserves the full head while limiting the body to the upper shoulders.
  const crown = clamp(headTop ?? face.y - face.height * 0.25, 0, face.y);
  const headHeight = face.y + face.height - crown;
  const proportions = { tight: { head: 0.76, top: 0.08, face: 0.58 }, standard: { head: 0.72, top: 0.09, face: 0.56 }, headroom: { head: 0.65, top: 0.13, face: 0.52 } }[framing];
  const size = Math.min(width, height, Math.max(500, headHeight / proportions.head, face.width / proportions.face));
  return { x: clamp(face.x + face.width / 2 - size / 2, 0, width - size),
    y: clamp(crown - size * proportions.top, 0, height - size), width: size, height: size };
}

/** Estimate the crown from the person silhouette above a single detected face. */
export function findHeadTop(mask: PersonMask, face: PhotoFace, width: number, height: number): number | undefined {
  const sx = mask.width / width, sy = mask.height / height;
  const x0 = Math.max(0, Math.floor((face.x - face.width * 0.15) * sx));
  const x1 = Math.min(mask.width, Math.ceil((face.x + face.width * 1.15) * sx));
  const y0 = Math.max(0, Math.floor((face.y - face.height * 0.75) * sy));
  const y1 = Math.min(mask.height, Math.ceil((face.eyesY ?? face.y + face.height * 0.36) * sy));
  const minimum = Math.max(2, Math.ceil(face.width * sx * 0.12));
  for (let y = y0; y < y1 - 1; y++) {
    let count = 0, nextCount = 0;
    for (let x = x0; x < x1; x++) {
      if (mask.confidence[y * mask.width + x] > 0.8) count++;
      if (mask.confidence[(y + 1) * mask.width + x] > 0.8) nextCount++;
    }
    if (count >= minimum && nextCount >= minimum) return Math.min(face.y, y / sy);
  }
  return undefined;
}

function upsampleMask(width: number, height: number, mask: PersonMask) {
  if (mask.width < 1 || mask.height < 1 || mask.confidence.length !== mask.width * mask.height) throw new Error('Invalid background mask.');
  const output = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const mx = clamp((x + 0.5) * mask.width / width - 0.5, 0, mask.width - 1);
    const my = clamp((y + 0.5) * mask.height / height - 0.5, 0, mask.height - 1);
    const x0 = Math.floor(mx), y0 = Math.floor(my), x1 = Math.min(x0 + 1, mask.width - 1), y1 = Math.min(y0 + 1, mask.height - 1);
    const tx = mx - x0, ty = my - y0;
    const top = mask.confidence[y0 * mask.width + x0] * (1 - tx) + mask.confidence[y0 * mask.width + x1] * tx;
    const bottom = mask.confidence[y1 * mask.width + x0] * (1 - tx) + mask.confidence[y1 * mask.width + x1] * tx;
    const confidence = top * (1 - ty) + bottom * ty;
    if (!Number.isFinite(confidence)) throw new Error('Invalid background confidence.');
    output[y * width + x] = clamp(confidence, 0, 1);
  }
  return output;
}

// Separable sliding windows keep the guided matte refinement linear in pixel count.
function boxMean(input: Float32Array, width: number, height: number, radius: number) {
  const horizontal = new Float32Array(input.length), output = new Float32Array(input.length);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < Math.min(width, radius + 1); x++) sum += input[y * width + x];
    for (let x = 0; x < width; x++) {
      horizontal[y * width + x] = sum / (Math.min(width - 1, x + radius) - Math.max(0, x - radius) + 1);
      if (x - radius >= 0) sum -= input[y * width + x - radius];
      if (x + radius + 1 < width) sum += input[y * width + x + radius + 1];
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = 0; y < Math.min(height, radius + 1); y++) sum += horizontal[y * width + x];
    for (let y = 0; y < height; y++) {
      output[y * width + x] = sum / (Math.min(height - 1, y + radius) - Math.max(0, y - radius) + 1);
      if (y - radius >= 0) sum -= horizontal[(y - radius) * width + x];
      if (y + radius + 1 < height) sum += horizontal[(y + radius + 1) * width + x];
    }
  }
  return output;
}

/** Guided filtering aligns uncertain matte edges with the untouched source photo.
 * He, Sun, Tang: https://people.csail.mit.edu/kaiming/eccv10/index.html
 * Confident subject/background pixels stay anchored; only uncertainty is refined.
 */
export function refinePersonMask(pixels: Uint8ClampedArray, width: number, height: number, mask: PersonMask): PersonMask {
  if (pixels.length !== width * height * 4) throw new Error('Invalid photo pixels.');
  const original = upsampleMask(width, height, mask);
  const confidence = new Float32Array(original);
  // Remove tiny, disconnected foreground specks without stripping nearby hair.
  if (width * height >= 256) {
    const visited = new Uint8Array(original.length), queue = new Int32Array(original.length);
    const components: Int32Array[] = []; let largest = 0;
    for (let start = 0; start < original.length; start++) {
      if (visited[start] || original[start] < 0.7) continue;
      let read = 0, write = 1; queue[0] = start; visited[start] = 1;
      while (read < write) {
        const i = queue[read++], x = i % width;
        for (const neighbour of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
          if (neighbour < 0 || neighbour >= original.length || visited[neighbour] || original[neighbour] < 0.7) continue;
          visited[neighbour] = 1; queue[write++] = neighbour;
        }
      }
      largest = Math.max(largest, write); components.push(queue.slice(0, write));
    }
    for (const component of components) if (component.length < Math.max(4, largest * 0.0002)) {
      let nearby = false;
      for (const i of component) {
        const x = i % width, y = Math.floor(i / width);
        for (let dy = -5; dy <= 5 && !nearby; dy++) for (let dx = -5; dx <= 5; dx++) {
          const nx = x + dx, ny = y + dy, n = ny * width + nx;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && visited[n] && original[n] >= 0.7 && !component.includes(n)) { nearby = true; break; }
        }
      }
      if (!nearby) for (const i of component) confidence[i] = 0;
    }
  }
  const guide = new Float32Array(original.length), squared = new Float32Array(original.length), product = new Float32Array(original.length);
  for (let i = 0; i < guide.length; i++) {
    guide[i] = luminance(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]) / 255;
    squared[i] = guide[i] * guide[i]; product[i] = guide[i] * confidence[i];
  }
  const radius = 4;
  const meanI = boxMean(guide, width, height, radius), meanP = boxMean(confidence, width, height, radius);
  const corrI = boxMean(squared, width, height, radius), corrIP = boxMean(product, width, height, radius);
  const a = new Float32Array(original.length), b = new Float32Array(original.length);
  for (let i = 0; i < a.length; i++) {
    a[i] = (corrIP[i] - meanI[i] * meanP[i]) / (Math.max(0, corrI[i] - meanI[i] * meanI[i]) + 0.001);
    b[i] = meanP[i] - a[i] * meanI[i];
  }
  const meanA = boxMean(a, width, height, radius), meanB = boxMean(b, width, height, radius);
  for (let i = 0; i < confidence.length; i++) {
    const value = clamp(meanA[i] * guide[i] + meanB[i], 0, 1);
    confidence[i] = confidence[i] < 0.01 ? Math.min(value, 0.01) : confidence[i] > 0.99 ? Math.max(value, 0.99) : value;
  }
  return { width, height, confidence };
}

/** Composite an opaque passport JPEG; no alpha is persisted in the photo. */
export function applyWhiteBackground(pixels: Uint8ClampedArray, width: number, height: number, mask: PersonMask, settings?: Pick<PhotoSettings, 'backgroundColor' | 'backgroundEdge' | 'backgroundFeather'>) {
  if (pixels.length !== width * height * 4 || mask.width < 1 || mask.height < 1 || mask.confidence.length !== mask.width * mask.height) {
    throw new Error('Invalid background mask.');
  }
  const output = new Uint8ClampedArray(pixels);
  const confidenceMap = upsampleMask(width, height, mask);
  const color = { white: [255, 255, 255], grey: [238, 240, 243], blue: [220, 235, 248] }[settings?.backgroundColor ?? 'white'] ?? [255, 255, 255];
  const edge = Number.isFinite(settings?.backgroundEdge) ? settings!.backgroundEdge! : 0;
  const softness = Number.isFinite(settings?.backgroundFeather) ? settings!.backgroundFeather! : 35;
  const centre = 0.5 + clamp(edge, -20, 20) * 0.008;
  const feather = settings ? 0.12 + clamp(softness, 0, 100) * 0.0028 : 0.3;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const confidence = confidenceMap[y * width + x];
    const t = clamp((confidence - centre + feather) / (feather * 2), 0, 1);
    const alpha = t * t * (3 - 2 * t);
    const i = (y * width + x) * 4;
    for (let channel = 0; channel < 3; channel++) output[i + channel] = pixels[i + channel] * alpha + color[channel] * (1 - alpha);
    output[i + 3] = 255;
  }
  return output;
}

export function analysePhoto(pixels: Uint8ClampedArray, width: number, height: number, region?: PhotoRegion) {
  const x0 = Math.floor(clamp(region?.x ?? width * 0.2, 1, width - 2));
  const y0 = Math.floor(clamp(region?.y ?? height * 0.15, 1, height - 2));
  const x1 = Math.ceil(clamp(region ? region.x + region.width : width * 0.8, x0 + 1, width - 1));
  const y1 = Math.ceil(clamp(region ? region.y + region.height : height * 0.8, y0 + 1, height - 1));
  const histogram = new Uint32Array(256);
  let count = 0, sum = 0, dark = 0, clipped = 0, lap = 0, lapSquared = 0, noiseSum = 0, flatCount = 0;
  const at = (x: number, y: number) => { const i = (y * width + x) * 4; return luminance(pixels[i], pixels[i + 1], pixels[i + 2]); };
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const value = at(x, y), left = at(x - 1, y), right = at(x + 1, y), top = at(x, y - 1), bottom = at(x, y + 1);
    histogram[Math.round(value)]++; sum += value; count++;
    if (value < 30) dark++; if (value > 245) clipped++;
    const l = left + right + top + bottom - 4 * value;
    lap += l; lapSquared += l * l;
    if (Math.max(left, right, top, bottom) - Math.min(left, right, top, bottom) < 18) {
      noiseSum += Math.abs(value - (left + right + top + bottom) / 4); flatCount++;
    }
  }
  function percentile(fraction: number) { let cumulative = 0; for (let i = 0; i < 256; i++) { cumulative += histogram[i]; if (cumulative >= count * fraction) return i; } return 255; }
  return { mean: sum / Math.max(count, 1), darkFraction: dark / Math.max(count, 1), clippedFraction: clipped / Math.max(count, 1),
    p10: percentile(0.1), p90: percentile(0.9), sharpness: lapSquared / Math.max(count, 1) - (lap / Math.max(count, 1)) ** 2,
    noise: noiseSum / Math.max(flatCount, 1) };
}

export function photoQualityWarnings(stats: ReturnType<typeof analysePhoto>): PhotoWarning[] {
  const warnings: PhotoWarning[] = [];
  if (stats.mean < 48 || stats.darkFraction > 0.55) warnings.push({ code: 'dark', message: 'The face area is very dark. More light and a retake may preserve more detail.' });
  if (stats.clippedFraction > 0.18) warnings.push({ code: 'clipped', message: 'Bright areas have lost detail. Avoid strong light behind or directly on the face.' });
  // Flat backgrounds are not evidence of blur; require a meaningful tonal range.
  if (stats.p90 - stats.p10 > 30 && stats.sharpness < 32) warnings.push({ code: 'soft', message: 'The selected area may be blurry. Check the eyes in the preview and retake if needed.' });
  if (stats.noise > 7) warnings.push({ code: 'noise', message: 'This photo has visible grain. Gentle smoothing helps, but better light will give a clearer result.' });
  return warnings;
}

export function enhancePhoto(pixels: Uint8ClampedArray, width: number, height: number, settings: PhotoSettings, region?: PhotoRegion, mask?: PersonMask) {
  if (width < 3 || height < 3 || pixels.length !== width * height * 4) throw new Error('Invalid photo pixels.');
  const stats = analysePhoto(pixels, width, height, region);
  const output = new Uint8ClampedArray(pixels);
  const preset = PHOTO_FILTERS.find(filter => filter.id === settings.filter)?.values ?? {};
  const adjustment = (key: 'brightness' | 'warmth' | 'contrast' | 'shadows' | 'highlights' | 'saturation' | 'tint' | 'sharpness' | 'smoothing', min: number, max: number) =>
    clamp((Number.isFinite(settings[key]) ? settings[key]! : 0) + (preset[key] ?? 0), min, max);
  const brightness = adjustment('brightness', -30, 30) * 0.8;
  const warmth = adjustment('warmth', -20, 20) * 0.45, tint = adjustment('tint', -20, 20) * 0.3;
  const contrast = 1 + adjustment('contrast', -30, 30) * 0.012;
  const shadows = adjustment('shadows', -40, 40) * 0.55, highlights = adjustment('highlights', -40, 40) * 0.55;
  const saturation = 1 + adjustment('saturation', -100, 40) / 100;
  const manualSmooth = adjustment('smoothing', 0, 50) / 100, sharpness = adjustment('sharpness', 0, 50);
  const finish = () => {
    // Analyse the corrected subject before applying a bright replacement backdrop.
    const warnings = photoQualityWarnings(analysePhoto(output, width, height, region));
    if (stats.clippedFraction > 0.18 && !warnings.some(w => w.code === 'clipped')) warnings.push({ code: 'clipped', message: 'Highlights have lost detail.' });
    let finished = output;
    if (settings.removeBackground) {
      if (!mask) throw new Error('Background mask unavailable. Turn off Remove background or try again.');
      if (!mask.confidence.some(value => value >= 0.65)) throw new Error('No clear subject found. Turn off Remove background or try another photo.');
      finished = applyWhiteBackground(output, width, height, refinePersonMask(pixels, width, height, mask), settings);
    }
    return { pixels: finished, warnings, stats };
  };
  if (!settings.auto && !brightness && !warmth && !tint && contrast === 1 && !shadows && !highlights && saturation === 1 && !manualSmooth && !sharpness) return finish();
  // Conservative shadow lifting, without targeting a single skin brightness.
  const gamma = !settings.auto ? 1 : stats.p90 < 145 ? clamp(1 - (145 - stats.p90) / 350, 0.82, 1)
    : stats.mean > 190 && stats.p10 > 100 ? clamp(1 + (stats.mean - 190) / 400, 1, 1.08) : 1;
  let red = 0, green = 0, blue = 0, neutralCount = 0;
  if (settings.auto) for (let i = 0; i < pixels.length; i += 16) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (min > 45 && max < 230 && max - min < max * 0.18) { red += r; green += g; blue += b; neutralCount++; }
  }
  const neutral = (red + green + blue) / 3;
  const hasNeutral = neutralCount > pixels.length / 4 * 0.01;
  const gains = hasNeutral ? [clamp(neutral / red, 0.95, 1.05), clamp(neutral / green, 0.95, 1.05), clamp(neutral / blue, 0.95, 1.05)] : [1, 1, 1];
  const smoothing = clamp((settings.auto ? clamp((stats.noise - 1.5) / 18, 0, 0.4) : 0) + manualSmooth, 0, 0.7);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    let r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (smoothing > 0 && x > 0 && y > 0 && x < width - 1 && y < height - 1) {
      let rs = 0, gs = 0, bs = 0, weightSum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const j = ((y + dy) * width + x + dx) * 4;
        const difference = Math.abs(pixels[j] - r) + Math.abs(pixels[j + 1] - g) + Math.abs(pixels[j + 2] - b);
        const weight = Math.exp(-difference / 24) * (dx === 0 && dy === 0 ? 2 : 1);
        rs += pixels[j] * weight; gs += pixels[j + 1] * weight; bs += pixels[j + 2] * weight; weightSum += weight;
      }
      r += (rs / weightSum - r) * smoothing; g += (gs / weightSum - g) * smoothing; b += (bs / weightSum - b) * smoothing;
    }
    // Apply the same tone curve as a luminance gain to preserve hue.
    const l = luminance(r, g, b);
    const toneGain = l > 0 ? (255 * (l / 255) ** gamma) / l : 1;
    const shadowWeight = (1 - l / 255) ** 2, highlightWeight = (l / 255) ** 2;
    const tone = brightness + shadows * shadowWeight + highlights * highlightWeight;
    r = (r * toneGain * gains[0] + tone - 128) * contrast + 128;
    g = (g * toneGain * gains[1] + tone - 128) * contrast + 128;
    b = (b * toneGain * gains[2] + tone - 128) * contrast + 128;
    const grey = luminance(r, g, b);
    output[i] = clamp(grey + (r - grey) * saturation + warmth + tint);
    output[i + 1] = clamp(grey + (g - grey) * saturation - tint);
    output[i + 2] = clamp(grey + (b - grey) * saturation - warmth + tint);
  }
  if (settings.auto || sharpness) {
    const softened = new Uint8ClampedArray(output);
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) for (let c = 0; c < 3; c++) {
      const i = (y * width + x) * 4 + c;
      const average = (softened[i - 4] + softened[i + 4] + softened[i - width * 4] + softened[i + width * 4]) / 4;
      const detail = softened[i] - average;
      // Do not sharpen small fluctuations that are likely camera grain.
      const amount = (settings.auto ? 0.18 : 0) + sharpness / 100;
      const limit = 4 + sharpness * 0.15;
      if (Math.abs(detail) > Math.max(3, stats.noise * 3)) output[i] = clamp(softened[i] + clamp(detail * amount, -limit, limit));
    }
  }
  return finish();
}
