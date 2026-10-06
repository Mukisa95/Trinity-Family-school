/*!
MIT License

Copyright (c) 2026 Isaac Rowntree

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
/**
 * Linear-light tone curves, gamut compression and LUT lattice adapted from
 * isaacrowntree/color-grade-ai/pipeline.mjs, revision a6eef94e0d773b1a9475cd9bac8bc15bc3944f46.
 * Copyright (c) 2026 Isaac Rowntree. MIT; full notice: public/photo-tools/v4/COLOR-GRADE-AI-LICENSE.
 * Phone JPEGs use sRGB transfer functions, rather than the upstream video gamma 2.4.
 */
export type Rgb = [number, number, number];
export interface PortraitGrade {
  gamma: number; exposure: number; contrast: number; shadows: number; highlights: number;
  temperature: number; tint: number; saturation: number; gains: Rgb;
  lookGamma: number; lookExposure: number; lookContrast: number; lookSaturation: number; lookTemperature: number;
  protectSkin: boolean;
}
export const NEUTRAL_GRADE: PortraitGrade = { gamma: 1, exposure: 0, contrast: 1, shadows: 0, highlights: 0,
  temperature: 0, tint: 0, saturation: 1, gains: [1, 1, 1], lookGamma: 1, lookExposure: 0, lookContrast: 1,
  lookSaturation: 1, lookTemperature: 0, protectSkin: true };
const clamp = (v: number, low = 0, high = 1) => Math.min(high, Math.max(low, v));
export const srgbToLinear = (v: number) => v <= 0.04045 ? clamp(v) / 12.92 : ((clamp(v) + 0.055) / 1.055) ** 2.4;
export const linearToSrgb = (v: number) => v <= 0.0031308 ? clamp(v) * 12.92 : 1.055 * clamp(v) ** (1 / 2.4) - 0.055;
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Compress to the target luminance instead of clipping individual colour channels. */
function compressGamut(r: number, g: number, b: number, target: number): Rgb {
  const peak = Math.max(r, g, b);
  if (peak > 1 && peak > target) {
    const k = clamp((1 - target) / (peak - target));
    r = target + (r - target) * k; g = target + (g - target) * k; b = target + (b - target) * k;
  }
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];
}

/** No skin brightness/hue target: the same luminance gain preserves chromaticity. */
export function applyLumaCurve(rgb: Rgb, curve: (encodedLuma: number) => number): Rgb {
  const [r, g, b] = rgb.map(srgbToLinear) as Rgb;
  const y = luma(r, g, b), target = srgbToLinear(clamp(curve(linearToSrgb(y))));
  if (Math.abs(target - y) < 1e-12) return rgb;
  if (y <= 1e-12) { const v = linearToSrgb(target); return [v, v, v]; }
  const gain = target / y;
  return compressGamut(r * gain, g * gain, b * gain, target);
}

function rgbToHsl(r: number, g: number, b: number): Rgb {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h: number, s: number, l: number): Rgb {
  if (!s) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, hk = h / 360;
  return [hk + 1 / 3, hk, hk - 1 / 3].map(t => {
    if (t < 0) t++; if (t > 1) t--;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  }) as Rgb;
}
const smoothstep = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
/** Broad warm colour protection, including darker tones; this is not a skin classifier. */
export function portraitSkinWeight(r: number, g: number, b: number) {
  const [h, s] = rgbToHsl(r, g, b);
  const distance = Math.min(Math.abs(h - 30), 360 - Math.abs(h - 30));
  return (1 - smoothstep((distance - 25) / 25)) * smoothstep((s - 0.025) / 0.1) * (1 - smoothstep((s - 0.8) / 0.18));
}

export function gradePortraitRgb(rgb: Rgb, grade: PortraitGrade): Rgb {
  const protection = grade.protectSkin ? portraitSkinWeight(...rgb) * 0.85 : 0;
  const temperature = grade.temperature + grade.lookTemperature * (1 - protection);
  const tint = grade.tint;
  let result = rgb;
  if (temperature || tint || grade.gains.some(gain => gain !== 1)) {
    const [r, g, b] = rgb.map(srgbToLinear) as Rgb;
    const target = luma(r, g, b);
    const rr = r * grade.gains[0] * 2 ** (temperature + tint);
    const gg = g * grade.gains[1] * 2 ** -tint;
    const bb = b * grade.gains[2] * 2 ** (-temperature + tint);
    const gain = target / Math.max(1e-12, luma(rr, gg, bb));
    result = compressGamut(rr * gain, gg * gain, bb * gain, target);
  }
  result = applyLumaCurve(result, y => {
    let tone = y ** (grade.gamma * grade.lookGamma);
    const linear = srgbToLinear(tone) * 2 ** (grade.exposure + grade.lookExposure);
    tone = linearToSrgb(linear);
    tone += grade.shadows * (1 - y) ** 2 + grade.highlights * y ** 2;
    return (tone - 0.5) * grade.contrast * grade.lookContrast + 0.5;
  });
  const saturation = grade.saturation * (1 + (grade.lookSaturation - 1) * (1 - protection));
  if (Math.abs(saturation - 1) > 1e-12) {
    const [h, s, l] = rgbToHsl(...result);
    result = hslToRgb(h, clamp(s * saturation), l);
  }
  return result;
}

export interface PortraitLut { size: number; table: Float32Array; grade: PortraitGrade }
const recentLuts = new Map<string, PortraitLut>();
/** .cube order: red fastest, then green, then blue. No external LUT download. */
export function createPortraitLut(grade: PortraitGrade, size = 33): PortraitLut {
  const key = `${size}:${JSON.stringify(grade)}`, cached = recentLuts.get(key);
  if (cached) return cached;
  const table = new Float32Array(size ** 3 * 3); let i = 0;
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    for (const value of gradePortraitRgb([r / (size - 1), g / (size - 1), b / (size - 1)], grade)) table[i++] = clamp(value);
  }
  const lut = { size, table, grade }; recentLuts.set(key, lut);
  if (recentLuts.size > 3) recentLuts.delete(recentLuts.keys().next().value!);
  return lut;
}

/** Trilinear sampling avoids expensive colour transforms per full-resolution pixel. */
export function applyPortraitLut(pixels: Uint8ClampedArray, lut: PortraitLut) {
  const { size: n, table } = lut, last = n - 1;
  for (let i = 0; i < pixels.length; i += 4) {
    const high = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]), low = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
    // A coarse lattice can miss the steep gamut shoulder of bright, colourful
    // clothes. Grade these pixels exactly rather than allow interpolation halos.
    if (high === low || (high > 215 && high - low > 12)) {
      const exact = gradePortraitRgb([pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255], lut.grade);
      for (let c = 0; c < 3; c++) pixels[i + c] = exact[c] * 255;
      continue;
    }
    const r = pixels[i] / 255 * last, g = pixels[i + 1] / 255 * last, b = pixels[i + 2] / 255 * last;
    const r0 = Math.min(Math.floor(r), last - 1), g0 = Math.min(Math.floor(g), last - 1), b0 = Math.min(Math.floor(b), last - 1);
    const rf = r - r0, gf = g - g0, bf = b - b0;
    const base = (b0 * n * n + g0 * n + r0) * 3, rs = 3, gs = n * 3, bs = n * n * 3;
    for (let c = 0; c < 3; c++) {
      const j = base + c;
      const c00 = table[j] * (1 - rf) + table[j + rs] * rf;
      const c10 = table[j + gs] * (1 - rf) + table[j + gs + rs] * rf;
      const c01 = table[j + bs] * (1 - rf) + table[j + bs + rs] * rf;
      const c11 = table[j + bs + gs] * (1 - rf) + table[j + bs + gs + rs] * rf;
      pixels[i + c] = ((c00 * (1 - gf) + c10 * gf) * (1 - bf) + (c01 * (1 - gf) + c11 * gf) * bf) * 255;
    }
  }
}
