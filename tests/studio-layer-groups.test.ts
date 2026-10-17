import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankTemplate, createImageLayer, createCustomTextLayer, normalizeCustomPhotoTemplate } from '../src/components/docx/custom-photo-types';
import { duplicateStudioGroup, duplicateStudioPageGroups, groupStudioLayers, moveStudioLayers, removeStudioGroup, studioGroupBounds, studioLayerTree, ungroupStudioLayers } from '../src/components/docx/studio-layer-groups';

function fixture() {
  const page = createBlankTemplate().pages[0], a = createImageLayer('avatar'), b = createCustomTextLayer();
  Object.assign(a, { x: .1, y: .2, width: .2, height: .3 }); Object.assign(b, { x: .4, y: .6, width: .2, height: .1 });
  page.layers = [a, b]; return { page, a, b };
}

test('grouping stores an ordered block without changing appearance or source pupil binding', () => {
  const { page, a, b } = fixture(), other = createCustomTextLayer(); page.layers.splice(1, 0, other);
  const grouped = groupStudioLayers(page, [a.id, b.id], 'Card', 'g');
  assert.deepEqual(grouped.layers.map(layer => layer.id), [other.id, a.id, b.id]);
  assert.deepEqual(grouped.groups, [{ id: 'g', name: 'Card' }]); assert.equal(a.groupId, undefined);
  assert.equal(grouped.layers[1].pupilDataMode, a.pupilDataMode);
  assert.equal(grouped.layers[1].appearance, a.appearance);
});

test('moving clamps the whole group at page edges and keeps internal distances', () => {
  const { page, a, b } = fixture(); const grouped = groupStudioLayers(page, [a.id, b.id], 'Card', 'g');
  const moved = moveStudioLayers(grouped, [a.id, b.id], 2, -2);
  assert.ok(Math.abs(moved.layers[1].x - moved.layers[0].x - .3) < 1e-9);
  assert.ok(Math.abs(moved.layers[1].y - moved.layers[0].y - .4) < 1e-9);
  assert.equal(moved.layers[0].y, 0); assert.equal(moved.layers[1].x + moved.layers[1].width, 1);
  assert.ok(Math.abs(studioGroupBounds(moved.layers).width - .5) < 1e-9);
});

test('duplicating copies every member, photo correction and group with independent IDs', () => {
  const { page, a, b } = fixture(); a.pupilImageEdits = { amina: 'individual pixels' }; b.pupilDataMode = 'duplicate';
  const grouped = groupStudioLayers(page, [a.id, b.id], 'Card', 'g'), result = duplicateStudioGroup(grouped, 'g');
  assert.equal(result.page.layers.length, 4); assert.notEqual(result.groupId, 'g');
  assert.equal(result.page.layers[2].groupId, result.groupId); assert.equal(result.page.layers[3].groupId, result.groupId);
  assert.equal(result.page.layers[3].pupilDataMode, 'duplicate');
  result.page.layers[2].pupilImageEdits!.amina = 'changed'; assert.equal(a.pupilImageEdits.amina, 'individual pixels');
  assert.equal(new Set(result.page.layers.map(layer => layer.id)).size, 4);
});

test('ungroup preserves members while deleting a group removes all members atomically', () => {
  const { page, a, b } = fixture(), grouped = groupStudioLayers(page, [a.id, b.id], 'Card', 'g');
  const ungrouped = ungroupStudioLayers(grouped, 'g'); assert.equal(ungrouped.layers.length, 2); assert.ok(ungrouped.layers.every(layer => !layer.groupId));
  assert.equal(removeStudioGroup(grouped, 'g').layers.length, 0); assert.equal(grouped.layers.length, 2);
});

test('saving, reopening and copying a page retain groups and remap page-copy identities', () => {
  const { page, a, b } = fixture(), template = createBlankTemplate(); template.pages = [groupStudioLayers(page, [a.id, b.id], 'Card', 'g')];
  const saved = normalizeCustomPhotoTemplate(JSON.parse(JSON.stringify(template)));
  assert.equal(saved.pages[0].groups![0].name, 'Card'); assert.equal(saved.pages[0].layers[1].groupId, 'g');
  const copy = duplicateStudioPageGroups(saved.pages[0]); assert.notEqual(copy.groups![0].id, 'g'); assert.equal(copy.layers[0].groupId, copy.groups![0].id);
  assert.notEqual(copy.layers[0].id, a.id);
});

test('locked members cannot move, and a mixed PDF group preserves both artwork planes', () => {
  const { page, a, b } = fixture(); a.locked = true;
  assert.throws(() => groupStudioLayers(page, [a.id, b.id]), /unlock/); assert.equal(moveStudioLayers(page, [a.id, b.id], .1, .1), page);
  a.locked = false; page.pdfArtwork = { sourceId: 'pdf', fileName: 'art.pdf', pageNumber: 1, image: '', widthMm: 210, heightMm: 297, cutouts: [] }; a.pdfPlacement = 'below'; b.pdfPlacement = 'above';
  const mixed = groupStudioLayers(page, [a.id, b.id], 'Mixed', 'g');
  assert.deepEqual(mixed.layers.map(layer => layer.pdfPlacement), ['below', 'above']);
  assert.deepEqual(studioLayerTree(mixed).map(layer => layer.groupId), ['g', 'g']);
  const copy = duplicateStudioGroup(mixed, 'g');
  assert.deepEqual(copy.page.layers.slice(2).map(layer => layer.pdfPlacement), ['below', 'above']);
  assert.throws(() => groupStudioLayers(page, [a.id]), /two layers/);
});
