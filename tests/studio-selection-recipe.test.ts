import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStudioSharedSelection, replayStudioSelection } from '../src/components/docx/studio-selection-recipe';
import { createBlankTemplate, createImageLayer, normalizeCustomPhotoTemplate, normalizeStudioPupilPhotoTreatment, type StudioSelectionStep } from '../src/components/docx/custom-photo-types';

test('shared AI instructions infer each photo independently and preserve selection order', async () => {
  const recipe: StudioSelectionStep[] = [{ tool: 'object', point: { x: .5, y: .5 }, mode: 'replace' }, { tool: 'rectangle', points: [{ x: 0, y: 0 }, { x: .5, y: 1 }], mode: 'subtract' }];
  let calls = 0;
  const apply = (alpha: number[]) => replayStudioSelection(4, 1, new Uint8ClampedArray(16), recipe, async step => { calls++; assert.equal(step.tool, 'object'); return new Uint8ClampedArray(alpha); });
  assert.deepEqual([...await apply([255, 255, 255, 0])], [0, 0, 255, 0]);
  assert.deepEqual([...await apply([0, 255, 0, 255])], [0, 0, 0, 255]);
  assert.equal(calls, 2, 'The second pupil never receives the first pupil mask');
});

test('normalized shapes, brush corrections, invert and colour selection replay at each image size', async () => {
  const infer = async () => { throw new Error('Geometry must not run AI'); };
  const steps: StudioSelectionStep[] = [{ tool: 'rectangle', mode: 'replace', points: [{ x: .25, y: 0 }, { x: .75, y: 1 }] }, { tool: 'invert', mode: 'replace' }];
  assert.deepEqual([...await replayStudioSelection(4, 1, new Uint8ClampedArray(16), steps, infer)], [255, 0, 0, 255]);
  const doubled = await replayStudioSelection(8, 2, new Uint8ClampedArray(64), steps, infer);
  assert.deepEqual([...doubled.slice(0, 8)], [255, 255, 0, 0, 0, 0, 255, 255]);
  const brush: StudioSelectionStep[] = [{ tool: 'all', mode: 'replace' }, { tool: 'brush', mode: 'replace', points: [{ x: .5, y: .5 }], radius: .15, erase: true }];
  const painted = await replayStudioSelection(10, 10, new Uint8ClampedArray(400), brush, infer);
  assert.equal(painted[55], 0); assert.equal(painted[0], 255);
  const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
  assert.deepEqual([...await replayStudioSelection(2, 1, pixels, [{ tool: 'wand', mode: 'replace', point: { x: 0, y: 0 }, tolerance: 0 }], infer)], [255, 0]);
});

test('shared cut/copy recipes survive saving with opposite sides and no fixed pupil identity', () => {
  const template = createBlankTemplate(), original = createImageLayer('avatar');
  const treatment = normalizeStudioPupilPhotoTreatment({ removeBackground: true, feather: 6, edgeShift: -1, selection: [{ tool: 'object', mode: 'replace', point: { x: .5, y: .6 } }] });
  original.photoSelection = { ...treatment, keep: false };
  const copy = { ...original, id: 'copy', photoSelection: treatment };
  template.pages[0].layers = [original, copy];
  const saved = normalizeCustomPhotoTemplate(JSON.parse(JSON.stringify(template)));
  assert.equal(saved.pages[0].layers[0].photoSelection?.keep, false);
  assert.deepEqual(saved.pages[0].layers[1].photoSelection, treatment);
  assert.equal(saved.pages[0].layers[1].pupilScopeId, undefined);
  assert.equal(saved.pages[0].layers[1].rasterOverride, undefined);
});

test('reapplying shared removal can replace legacy snapshots across pages or preserve individual exceptions', () => {
  const template = createBlankTemplate(), a = createImageLayer('avatar'), b = createImageLayer('avatar');
  a.pupilImageEdits = { amina: 'old-removal', john: 'manual-correction' };
  b.pupilImageEdits = { john: 'another-page-removal' };
  const derived = { ...createImageLayer('avatar'), photoSelection: { removeBackground: true, feather: 2, edgeShift: 0, keep: false } };
  template.pages[0].layers = [a, derived]; template.pages.push({ ...template.pages[0], id: 'other', layers: [b] });
  const settings = { removeBackground: true, feather: 3, edgeShift: -1 };
  const replaced = applyStudioSharedSelection(template, template.pages[0].id, a.id, settings, true, 'amina');
  assert.equal(replaced.pages[0].layers[0].pupilImageEdits, undefined);
  assert.equal(replaced.pages[1].layers[0].pupilImageEdits, undefined);
  assert.equal(replaced.pages[0].layers[1], derived, 'Existing extracted layers keep their own selection');
  assert.deepEqual(a.pupilImageEdits, { amina: 'old-removal', john: 'manual-correction' }, 'Undo still has the complete original');
  const preserved = applyStudioSharedSelection(template, template.pages[0].id, a.id, settings, false, 'amina');
  assert.deepEqual(preserved.pages[0].layers[0].pupilImageEdits, { john: 'manual-correction' });
  assert.equal(preserved.pages[1].layers[0], b);
});
