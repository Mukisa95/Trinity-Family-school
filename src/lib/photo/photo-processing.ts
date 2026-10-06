/** Pure, bounded photo corrections. No network, face recognition, or generated detail. */
export interface PhotoSettings { auto: boolean; brightness: number; warmth: number }
export const DEFAULT_PHOTO_SETTINGS: PhotoSettings = { auto: true, brightness: 0, warmth: 0 };
export interface PhotoRegion { x: number; y: number; width: number; height: number }
export interface PhotoFace extends PhotoRegion { eyesY?: number }
export interface PhotoWarning { code: string; message: string }
const clamp = (value: number, min = 0, max = 255) => Math.max(min, Math.min(max, value));
const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function suggestFaceCrop(face: PhotoFace, width: number, height: number): PhotoRegion {
  // Face detectors can exclude hair and the crown. Reserve room for the whole
  // head, including the narrower space near the top of a circular avatar.
  const size = Math.min(width, height, Math.max(500, face.height / 0.43, face.width / 0.4));
  const eyeY = face.eyesY ?? face.y + face.height * 0.36;
  return { x: clamp(face.x + face.width / 2 - size / 2, 0, width - size),
    y: clamp(eyeY - size * 0.46, 0, height - size), width: size, height: size };
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

export function enhancePhoto(pixels: Uint8ClampedArray, width: number, height: number, settings: PhotoSettings, region?: PhotoRegion) {
  if (width < 3 || height < 3 || pixels.length !== width * height * 4) throw new Error('Invalid photo pixels.');
  const stats = analysePhoto(pixels, width, height, region);
  const output = new Uint8ClampedArray(pixels);
  if (!settings.auto && !settings.brightness && !settings.warmth) return { pixels: output, warnings: photoQualityWarnings(stats), stats };
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
  const brightness = clamp(settings.brightness, -30, 30) * 0.8;
  const warmth = clamp(settings.warmth, -20, 20) * 0.45;
  const smoothing = settings.auto ? clamp((stats.noise - 1.5) / 18, 0, 0.4) : 0;
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
    output[i] = clamp(r * toneGain * gains[0] + brightness + warmth);
    output[i + 1] = clamp(g * toneGain * gains[1] + brightness);
    output[i + 2] = clamp(b * toneGain * gains[2] + brightness - warmth);
  }
  if (settings.auto) {
    const softened = new Uint8ClampedArray(output);
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) for (let c = 0; c < 3; c++) {
      const i = (y * width + x) * 4 + c;
      const average = (softened[i - 4] + softened[i + 4] + softened[i - width * 4] + softened[i + width * 4]) / 4;
      const detail = softened[i] - average;
      // Do not sharpen small fluctuations that are likely camera grain.
      if (Math.abs(detail) > Math.max(3, stats.noise * 3)) output[i] = clamp(softened[i] + clamp(detail * 0.18, -4, 4));
    }
  }
  return { pixels: output, warnings: photoQualityWarnings(stats), stats };
}
