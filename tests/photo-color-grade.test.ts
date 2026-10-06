import assert from 'node:assert/strict';
import test from 'node:test';
import { applyLumaCurve, applyPortraitLut, createPortraitLut, gradePortraitRgb, NEUTRAL_GRADE, srgbToLinear, type Rgb } from '../src/lib/photo/photo-color-grade';
import { DEFAULT_PHOTO_SETTINGS, enhancePhoto, PHOTO_FILTERS } from '../src/lib/photo/photo-processing';

const skinSamples: Rgb[] = [[55, 35, 25], [95, 60, 42], [140, 93, 66], [181, 132, 98], [218, 177, 149], [237, 203, 182]];
const patch = (rgb: Rgb) => { const p = new Uint8ClampedArray(32 * 32 * 4); for (let i = 0; i < p.length; i += 4) p.set([...rgb, 255], i); return p; };
const hue = (rgb: Rgb) => {
  const [r, g, b] = rgb, max = Math.max(...rgb), min = Math.min(...rgb), d = max - min;
  if (!d) return 0;
  return ((max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
};

test('linear-light exposure preserves chromaticity across skin tones without a common skin target', () => {
  for (const skin of skinSamples) {
    const rgb = skin.map(c => c / 255) as Rgb;
    const result = applyLumaCurve(rgb, y => y * 1.025);
    const before = rgb.map(srgbToLinear), after = result.map(srgbToLinear);
    for (const c of [1, 2]) assert.ok(Math.abs(before[c] / before[0] - after[c] / after[0]) < 1e-9);
  }
});

test('the neutral LUT is an identity across the full JPEG range, including black/white and alpha', () => {
  const source = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) source.set([i, 255 - i, (i * 73) % 256, i], i * 4);
  const result = source.slice(); applyPortraitLut(result, createPortraitLut(NEUTRAL_GRADE));
  assert.deepEqual(result, source);
});

test('LUT sampling stays close to direct grading, with no changed neutral axis or colour seams', () => {
  const grade = { ...NEUTRAL_GRADE, gamma: 0.94, exposure: 0.1, lookSaturation: 1.1, lookTemperature: 0.06 };
  const lut = createPortraitLut(grade);
  let error = 0;
  for (let i = 0; i < 1000; i++) {
    const rgb = [i * 23 % 256, i * 47 % 256, i * 101 % 256] as Rgb;
    const direct = gradePortraitRgb(rgb.map(c => c / 255) as Rgb, grade);
    const sampled = new Uint8ClampedArray([...rgb, 255]); applyPortraitLut(sampled, lut);
    for (let c = 0; c < 3; c++) error = Math.max(error, Math.abs(sampled[c] - direct[c] * 255));
  }
  assert.ok(error < 4, `Interpolation error: ${error}`);
  const neutralGrade = { ...NEUTRAL_GRADE, gamma: 0.94, contrast: 1.08 };
  for (let i = 0; i < 256; i++) {
    const p = new Uint8ClampedArray([i, i, i, 255]); applyPortraitLut(p, createPortraitLut(neutralGrade));
    assert.equal(p[0], p[1]); assert.equal(p[1], p[2]);
  }
});

test('portrait and beauty presets keep hue across darker and lighter skin samples', () => {
  for (const skin of skinSamples) for (const filter of PHOTO_FILTERS.filter(f => f.id !== 'natural')) {
    const result = enhancePhoto(patch(skin), 32, 32, { ...DEFAULT_PHOTO_SETTINGS, auto: false, filter: filter.id }).pixels;
    const delta = Math.abs(hue([result[0], result[1], result[2]]) - hue(skin));
    assert.ok(delta < 4, `${filter.label}, ${skin}: hue drift ${delta}`);
  }
});

test('warm portrait protection limits skin tint; vibrant still increases colours outside the warm range', () => {
  const rgb: Rgb = [0.55, 0.34, 0.22];
  const base = hue(rgb), look = { ...NEUTRAL_GRADE, lookTemperature: 0.12 };
  const safe = Math.abs(hue(gradePortraitRgb(rgb, look)) - base);
  const unprotected = Math.abs(hue(gradePortraitRgb(rgb, { ...look, protectSkin: false })) - base);
  assert.ok(safe < unprotected * 0.4);
  const source = patch([45, 95, 155]);
  const vivid = enhancePhoto(source, 32, 32, { ...DEFAULT_PHOTO_SETTINGS, auto: false, filter: 'vivid' }).pixels;
  assert.ok(vivid[2] - vivid[0] > source[2] - source[0]);
});

test('zero filter strength removes the whole preset and natural skin is never used as a grey reference', () => {
  for (const filter of PHOTO_FILTERS) for (const skin of skinSamples) {
    const source = patch(skin);
    assert.deepEqual(enhancePhoto(source, 32, 32, { ...DEFAULT_PHOTO_SETTINGS, auto: false, filter: filter.id, filterIntensity: 0 }).pixels, source);
  }
  // This near-neutral warm skin used to qualify for automatic grey balancing.
  const source = patch([200, 180, 175]);
  assert.deepEqual(enhancePhoto(source, 32, 32, DEFAULT_PHOTO_SETTINGS).pixels, source);
});

test('beauty smoothing reduces grain but preserves eye-like edges and does not accumulate', () => {
  let seed = 11; const source = new Uint8ClampedArray(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const grain = (seed % 15) - 7, darkEye = x >= 28 && x <= 35 && y >= 28 && y <= 35;
    source.set(darkEye ? [30, 25, 20, 255] : [150 + grain, 105 + grain, 78 + grain, 255], (y * 64 + x) * 4);
  }
  const settings = { ...DEFAULT_PHOTO_SETTINGS, auto: false, filter: 'beauty' as const };
  const result = enhancePhoto(source, 64, 64, settings).pixels;
  function variation(p: Uint8ClampedArray) { let sum = 0; for (let y = 2; y < 20; y++) for (let x = 2; x < 20; x++) sum += Math.abs(p[(y * 64 + x) * 4] - p[(y * 64 + x - 1) * 4]); return sum; }
  assert.ok(variation(result) < variation(source));
  assert.ok(result[(30 * 64 + 26) * 4] - result[(30 * 64 + 30) * 4] > 100);
  assert.deepEqual(enhancePhoto(source, 64, 64, settings).pixels, result);
});
