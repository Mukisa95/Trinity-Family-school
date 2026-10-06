import assert from 'node:assert/strict';
import test from 'node:test';
import { analysePhoto, applyWhiteBackground, findHeadTop, refinePersonMask, enhancePhoto, suggestFaceCrop, DEFAULT_PHOTO_SETTINGS, PHOTO_FILTERS, photoQualityWarnings } from '../src/lib/photo/photo-processing';

function image(width: number, height: number, sample: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set([...sample(x, y), 255], (y * width + x) * 4);
  return data;
}
test('an unchanged original survives comparisons and repeated editing', () => {
  const original = image(64, 64, (x, y) => [x + 30, y + 30, 40]);
  const copy = new Uint8ClampedArray(original);
  assert.deepEqual(enhancePhoto(original, 64, 64, { auto: false, brightness: 0, warmth: 0 }).pixels, original);
  const first = enhancePhoto(original, 64, 64, DEFAULT_PHOTO_SETTINGS);
  assert.deepEqual(enhancePhoto(original, 64, 64, DEFAULT_PHOTO_SETTINGS).pixels, first.pixels);
  assert.deepEqual(original, copy);
});
test('dark photos gain bounded luminance while maintaining colour proportions', () => {
  const original = image(64, 64, () => [60, 40, 25]);
  const result = enhancePhoto(original, 64, 64, DEFAULT_PHOTO_SETTINGS).pixels;
  assert.ok(result[0] > original[0] && result[0] < 100);
  assert.ok(Math.abs(result[0] / result[1] - 60 / 40) < 0.06);
});
test('a well exposed neutral photo does not get indiscriminately brightened', () => {
  const original = image(64, 64, () => [170, 170, 170]);
  assert.deepEqual(enhancePhoto(original, 64, 64, DEFAULT_PHOTO_SETTINGS).pixels, original);
});
test('bright photos receive mild correction without claiming to restore clipped detail', () => {
  const original = image(64, 64, () => [215, 215, 215]);
  const processed = enhancePhoto(original, 64, 64, DEFAULT_PHOTO_SETTINGS).pixels;
  assert.ok(processed[0] < 215 && processed[0] > 200);
  const clipped = image(64, 64, () => [255, 255, 255]);
  const result = enhancePhoto(clipped, 64, 64, DEFAULT_PHOTO_SETTINGS);
  assert.equal(result.pixels[0], 255);
  assert.ok(result.warnings.some(warning => warning.code === 'clipped'));
});
test('gentle denoising reduces flat-region grain and preserves a strong edge', () => {
  let seed = 32;
  const original = image(96, 96, x => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = (x < 48 ? 150 : 210) + (seed % 21) - 10;
    return [value, value, value];
  });
  const processed = enhancePhoto(original, 96, 96, DEFAULT_PHOTO_SETTINGS).pixels;
  const statsBefore = analysePhoto(original, 96, 96, { x: 5, y: 5, width: 35, height: 80 });
  const statsAfter = analysePhoto(processed, 96, 96, { x: 5, y: 5, width: 35, height: 80 });
  assert.ok(statsAfter.noise < statsBefore.noise, JSON.stringify({ statsBefore, statsAfter }));
  assert.ok(processed[(48 * 96 + 50) * 4] - processed[(48 * 96 + 45) * 4] > 40);
});
test('source quality warnings distinguish dark, clipped and a soft tonal gradient', () => {
  assert.ok(photoQualityWarnings(analysePhoto(image(64, 64, () => [15, 15, 15]), 64, 64)).some(w => w.code === 'dark'));
  assert.ok(photoQualityWarnings(analysePhoto(image(64, 64, () => [252, 252, 252]), 64, 64)).some(w => w.code === 'clipped'));
  assert.ok(photoQualityWarnings(analysePhoto(image(64, 64, x => [50 + x * 2, 50 + x * 2, 50 + x * 2]), 64, 64)).some(w => w.code === 'soft'));
  assert.ok(!photoQualityWarnings(analysePhoto(image(64, 64, () => [150, 150, 150]), 64, 64)).some(w => w.code === 'soft'));
});
test('passport framing preserves the head inside the circle and leaves only upper shoulders at different distances', () => {
  for (const scale of [1, 1.8, 2.4]) {
    const face = { x: 900, y: 700, width: 300 * scale, height: 360 * scale, eyesY: 700 + 130 * scale };
    const crown = face.y - face.height * 0.25;
    const crop = suggestFaceCrop(face, 4000, 3000, crown);
    // Face boxes can start below the crown. Test a full head outline extending
    // above and beside the detected face, rather than only the face rectangle.
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 50) {
      const x = face.x + face.width / 2 + Math.cos(angle) * face.width * 0.65;
      const y = face.y + face.height * 0.375 + Math.sin(angle) * face.height * 0.625;
      const distance = Math.hypot(x - crop.x - crop.width / 2, y - crop.y - crop.height / 2);
      assert.ok(distance < crop.width / 2, 'The head outline must fit inside the circle');
    }
    assert.ok((face.y + face.height - crop.y) / crop.height > 0.79, 'Chin should leave less than 21% of the crop for shoulders');
    assert.ok((crown - crop.y) / crop.height > 0.07, 'Keep breathing room above the crown');
    assert.ok(crop.width >= 500 && crop.x >= 0 && crop.y >= 0);
  }
});
test('a measured higher hairline expands the head allowance while keeping the same passport proportions', () => {
  const face = { x: 900, y: 700, width: 300, height: 360 };
  const crown = 500;
  const crop = suggestFaceCrop(face, 4000, 3000, crown);
  assert.ok(Math.abs((face.y + face.height - crown) / crop.height - 0.72) < 0.001);
  assert.ok(Math.abs((face.y + face.height - crop.y) / crop.height - 0.81) < 0.001);
});
test('crown estimation ignores isolated confident pixels and respects mask scaling', () => {
  const confidence = new Float32Array(100 * 100);
  confidence[10 * 100 + 50] = 1;
  for (let y = 25; y < 70; y++) for (let x = 40; x < 60; x++) confidence[y * 100 + x] = 0.95;
  const face = { x: 400, y: 400, width: 200, height: 300, eyesY: 500 };
  assert.equal(findHeadTop({ width: 100, height: 100, confidence }, face, 1000, 1000), 250);
  assert.equal(findHeadTop({ width: 100, height: 100, confidence: new Float32Array(10000) }, face, 1000, 1000), undefined);
});
test('background replacement preserves confident pupil pixels, makes background white, and feathers uncertain edges', () => {
  const original = image(3, 1, () => [70, 40, 20]);
  const copy = new Uint8ClampedArray(original);
  const output = applyWhiteBackground(original, 3, 1, { width: 3, height: 1, confidence: new Float32Array([0, 0.5, 1]) });
  assert.deepEqual([...output.slice(0, 4)], [255, 255, 255, 255]);
  assert.deepEqual([...output.slice(8, 12)], [70, 40, 20, 255]);
  assert.ok(output[4] > 70 && output[4] < 255);
  assert.deepEqual(original, copy);
  assert.throws(() => applyWhiteBackground(original, 3, 1, { width: 3, height: 1, confidence: new Float32Array(1) }));
});
test('edge framing stays inside the original and never invents extra source pixels', () => {
  for (const face of [{ x: 0, y: 0, width: 200, height: 240 }, { x: 780, y: 670, width: 210, height: 320 }]) {
    const crop = suggestFaceCrop(face, 1000, 1000);
    assert.ok(crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= 1000 && crop.y + crop.height <= 1000);
  }
});
test('manual warmth, brightness, and extreme inputs remain bounded with alpha intact', () => {
  const pixels = image(64, 64, () => [120, 120, 120]);
  const result = enhancePhoto(pixels, 64, 64, { auto: false, brightness: 1000, warmth: 1000 }).pixels;
  assert.deepEqual(result, enhancePhoto(pixels, 64, 64, { auto: false, brightness: 30, warmth: 20 }).pixels, 'Extreme inputs are clamped to the supported adjustments');
  assert.ok(result[0] > result[1] && result[1] > result[2]);
  assert.ok(result[0] < 180 && result[2] > 120, 'Colour balance remains gentle');
  assert.equal(result[3], 255);
  assert.throws(() => enhancePhoto(new Uint8ClampedArray(4), 64, 64, DEFAULT_PHOTO_SETTINGS));
});

test('all passport presets keep a square crop around the full head and upper shoulders', () => {
  const face = { x: 900, y: 700, width: 300, height: 360 }, crown = 500;
  const crops = ['tight', 'standard', 'headroom'].map(framing => suggestFaceCrop(face, 4000, 3000, crown, framing as 'tight' | 'standard' | 'headroom'));
  assert.ok(crops[0].width < crops[1].width && crops[1].width < crops[2].width);
  for (const crop of crops) {
    assert.equal(crop.width, crop.height);
    assert.ok((face.y + face.height - crop.y) / crop.height >= 0.77, 'Keep most of the body outside the crop');
    assert.ok((crown - crop.y) / crop.height >= 0.079, 'Keep the crown clear of the top');
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 50) {
      const x = face.x + face.width / 2 + Math.cos(a) * face.width * 0.65;
      const y = (crown + face.y + face.height) / 2 + Math.sin(a) * (face.y + face.height - crown) / 2;
      assert.ok(Math.hypot(x - crop.x - crop.width / 2, y - crop.y - crop.height / 2) < crop.width / 2);
    }
  }
});

test('portrait filter presets change the JPEG pixels without changing the source', () => {
  const source = image(64, 64, (x, y) => [65 + x * 2, 70 + y, 60 + x]);
  const original = source.slice();
  const natural = enhancePhoto(source, 64, 64, { ...DEFAULT_PHOTO_SETTINGS, auto: false }).pixels;
  assert.deepEqual(natural, source);
  for (const filter of PHOTO_FILTERS.filter(filter => filter.id !== 'natural')) {
    const result = enhancePhoto(source, 64, 64, { ...DEFAULT_PHOTO_SETTINGS, auto: false, filter: filter.id }).pixels;
    assert.notDeepEqual(result, natural, filter.label);
  }
  assert.deepEqual(source, original);
});

test('shadows and highlights target their own tones; corrected quality warnings can disappear', () => {
  const source = image(64, 64, x => x < 32 ? [25, 25, 25] : [230, 230, 230]);
  const shadows = enhancePhoto(source, 64, 64, { auto: false, brightness: 0, warmth: 0, shadows: 40 }).pixels;
  const highlights = enhancePhoto(source, 64, 64, { auto: false, brightness: 0, warmth: 0, highlights: -40 }).pixels;
  assert.ok(shadows[0] - 25 > shadows[60 * 4] - 230);
  assert.ok(230 - highlights[60 * 4] > 25 - highlights[0]);
  const dark = image(64, 64, () => [38, 38, 38]);
  assert.ok(enhancePhoto(dark, 64, 64, { auto: false, brightness: 0, warmth: 0 }).warnings.some(w => w.code === 'dark'));
  assert.ok(!enhancePhoto(dark, 64, 64, { auto: false, brightness: 30, warmth: 0 }).warnings.some(w => w.code === 'dark'));
});

test('guided refinement reduces a blurred matte halo at a source edge while preserving confident pixels', () => {
  const width = 64, height = 32;
  const source = image(width, height, x => x < 32 ? [220, 220, 220] : [40, 40, 40]);
  const confidence = Float32Array.from({ length: width * height }, (_, i) => Math.max(0, Math.min(1, ((i % width) - 26) / 12)));
  const before = confidence.slice();
  const refined = refinePersonMask(source, width, height, { width, height, confidence });
  const left = 16 * width + 31, right = left + 1;
  assert.ok(refined.confidence[left] < confidence[left], 'Reduce background leakage');
  assert.ok(refined.confidence[right] > confidence[right], 'Preserve the subject edge');
  assert.ok(refined.confidence[16 * width + 10] <= 0.01);
  assert.ok(refined.confidence[16 * width + 50] >= 0.99);
  assert.deepEqual(confidence, before);
});

test('refinement removes a distant speck and preserves disconnected hair close to the subject', () => {
  const width = 64, height = 64;
  const confidence = new Float32Array(width * height);
  for (let y = 15; y < 60; y++) for (let x = 20; x < 45; x++) confidence[y * width + x] = 1;
  confidence[3 * width + 3] = 1; confidence[12 * width + 30] = 1;
  const result = refinePersonMask(image(width, height, () => [100, 100, 100]), width, height, { width, height, confidence });
  assert.ok(result.confidence[3 * width + 3] <= 0.01);
  assert.ok(result.confidence[12 * width + 30] >= 0.99);
});

test('background colour, edge and feather controls work, and removal never silently saves an absent subject', () => {
  const source = image(3, 3, () => [50, 60, 70]);
  const mask = { width: 3, height: 3, confidence: new Float32Array([0, 0.35, 1, 0, 0.35, 1, 0, 0.35, 1]) };
  const blue = applyWhiteBackground(source, 3, 3, mask, { backgroundColor: 'blue' });
  assert.deepEqual([...blue.slice(0, 4)], [220, 235, 248, 255]);
  const contracted = applyWhiteBackground(source, 3, 3, mask, { backgroundEdge: 20 });
  const expanded = applyWhiteBackground(source, 3, 3, mask, { backgroundEdge: -20 });
  assert.ok(contracted[4] > expanded[4]);
  const soft = applyWhiteBackground(source, 3, 3, mask, { backgroundFeather: 100 });
  const hard = applyWhiteBackground(source, 3, 3, mask, { backgroundFeather: 0 });
  assert.ok(soft[4] < hard[4]);
  assert.deepEqual([...blue.slice(8, 12)], [...source.slice(8, 12)]);
  const settings = { ...DEFAULT_PHOTO_SETTINGS, removeBackground: true };
  assert.throws(() => enhancePhoto(source, 3, 3, settings), /mask unavailable/);
  assert.throws(() => enhancePhoto(source, 3, 3, settings, undefined, { ...mask, confidence: new Float32Array(9) }), /No clear subject/);
  assert.throws(() => refinePersonMask(source, 3, 3, { ...mask, confidence: new Float32Array(9).fill(NaN) }), /confidence/);
});
