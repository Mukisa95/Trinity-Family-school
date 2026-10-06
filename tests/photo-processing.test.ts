import assert from 'node:assert/strict';
import test from 'node:test';
import { analysePhoto, enhancePhoto, suggestFaceCrop, DEFAULT_PHOTO_SETTINGS, photoQualityWarnings } from '../src/lib/photo/photo-processing';

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
test('head framing keeps the estimated crown and head sides inside the circular avatar at different distances', () => {
  for (const scale of [1, 1.8, 2.4]) {
    const face = { x: 900, y: 700, width: 300 * scale, height: 360 * scale, eyesY: 700 + 130 * scale };
    const crop = suggestFaceCrop(face, 4000, 3000);
    // Face boxes can start below the crown. Test a full head outline extending
    // above and beside the detected face, rather than only the face rectangle.
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 50) {
      const x = face.x + face.width / 2 + Math.cos(angle) * face.width * 0.7;
      const y = face.y + face.height * 0.25 + Math.sin(angle) * face.height * 0.8;
      const distance = Math.hypot(x - crop.x - crop.width / 2, y - crop.y - crop.height / 2);
      assert.ok(distance < crop.width / 2, 'The head outline must fit inside the circle');
    }
    assert.ok(crop.width >= 500 && crop.x >= 0 && crop.y >= 0);
  }
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
  assert.equal(result[0], 153); assert.equal(result[1], 144); assert.equal(result[2], 135);
  assert.equal(result[3], 255);
  assert.throws(() => enhancePhoto(new Uint8ClampedArray(4), 64, 64, DEFAULT_PHOTO_SETTINGS));
});
