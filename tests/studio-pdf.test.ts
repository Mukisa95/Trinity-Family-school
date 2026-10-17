import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePdfPageRange } from '../src/components/docx/studio-pdf';
import { cloneStudioTemplate, createBlankTemplate, getStudioPageDimensions, normalizeCustomPhotoTemplate, normalizePdfCutout } from '../src/components/docx/custom-photo-types';

test('page selection supports ranges, deduplicates, and rejects invalid or excessive selections', () => {
  assert.deepEqual(parsePdfPageRange('1-3, 2, 5', 6), [1, 2, 3, 5]);
  for (const value of ['', '0', '31', '3-1', '1,,2', '1.5', 'a', '1-999999999']) assert.throws(() => parsePdfPageRange(value, 30));
  assert.throws(() => parsePdfPageRange('1-20,21', 30), /up to 20/);
  assert.equal(parsePdfPageRange('10-29', 30).length, 20);
});

test('local PDF Blobs survive snapshots and normalization without becoming base64 strings', async () => {
  const template=createBlankTemplate();
  const bytes=new Uint8Array([37,80,68,70,45,49,0,255]);
  template.pdfSources={local:{id:'local',name:'original.pdf',blob:new Blob([bytes],{type:'application/pdf'})}};
  const snapshot=normalizeCustomPhotoTemplate(cloneStudioTemplate(template));
  const source=snapshot.pdfSources!.local;
  assert.ok(source.blob instanceof Blob);assert.equal(source.dataUrl,undefined);
  assert.deepEqual(new Uint8Array(await source.blob!.arrayBuffer()),bytes);
  snapshot.pages[0].layers[0].label='Changed snapshot';
  assert.notEqual(snapshot.pages[0].layers[0].label,template.pages[0].layers[0].label);
  assert.equal(template.pdfSources.local.blob!.size,bytes.length);
});

test('cutouts retain bounded geometry including overlapping and invalid inputs', () => {
  const cutout = normalizePdfCutout({ id: 'hole', shape: 'oval', x: -1, y: 0.9, width: 2, height: 2 });
  assert.equal(cutout.x, 0); assert.equal(cutout.width, 1);
  assert.equal(cutout.y + cutout.height, 1);
  const invalid = normalizePdfCutout({ ...cutout, x: NaN, y: Infinity, width: NaN, height: -2 });
  assert.equal(invalid.x, 0); assert.equal(invalid.y, 0);
  assert.ok(invalid.width > 0 && invalid.height > 0);
});

test('legacy templates and PDF artwork survive normalization without altering the source', () => {
  const template = createBlankTemplate();
  assert.equal(normalizeCustomPhotoTemplate(template).pages[0].layers.length, template.pages[0].layers.length);
  template.pdfSources = { source: { id: 'source', name: 'original.pdf', dataUrl: 'data:application/pdf;base64,ORIGINAL' } };
  template.pages[0].pdfArtwork = { sourceId: 'source', fileName: 'original.pdf', pageNumber: 2, widthMm: 297, heightMm: 210, image: 'data:image/png;base64,ART', cutouts: [{ id: 'hole', x: 0.3, y: 0.3, width: 0.4, height: 0.4, shape: 'rectangle' }] };
  template.pages[0].layers[0].pdfPlacement = 'below';
  const result = normalizeCustomPhotoTemplate(JSON.parse(JSON.stringify(template)));
  assert.equal(result.pdfSources?.source.dataUrl, template.pdfSources.source.dataUrl);
  assert.equal(result.pages[0].pdfArtwork?.image, template.pages[0].pdfArtwork.image);
  assert.equal(result.pages[0].pdfArtwork?.cutouts.length, 1);
  assert.equal(result.pages[0].layers[0].pdfPlacement, 'below');
  assert.deepEqual(getStudioPageDimensions(result, result.pages[0]), { widthMm: 297, heightMm: 210 });
  assert.deepEqual(getStudioPageDimensions(result, { ...result.pages[0], pdfArtwork: undefined }), { widthMm: 210, heightMm: 297 });
});
