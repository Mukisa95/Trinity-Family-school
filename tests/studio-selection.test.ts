import test from 'node:test';
import assert from 'node:assert/strict';
import { combineSelection, extractSelectedPixels, MAX_SELECTION_FEATHER, normalizeSelectionFeather, paintSelectionStroke, refineSelection, selectConnectedColour, selectPolygon, selectRegion } from '../src/components/docx/studio-selection';
import { createBlankTemplate, createImageLayer, getStudioRasterOverride, getStudioLayerData, isPupilDataLayer, normalizeCustomPhotoTemplate, type RenderPupilData } from '../src/components/docx/custom-photo-types';

test('connected colour selection separates disconnected objects and respects transparent pixels', () => {
  const pixels = new Uint8ClampedArray([255,0,0,255, 0,0,255,255, 255,0,0,255, 255,0,0,0]);
  assert.deepEqual([...selectConnectedColour(pixels, 4, 1, { x: 0, y: 0 }, 0)], [255,0,0,0]);
  assert.deepEqual([...selectConnectedColour(pixels, 4, 1, { x: 0.6, y: 0 }, 0)], [0,0,255,0]);
});

test('cut and copy preserve RGB and source alpha without modifying original pixels', () => {
  const pixels = new Uint8ClampedArray([200,30,10,255, 10,50,200,128, 70,80,90,0]);
  const before = new Uint8ClampedArray(pixels), mask = new Uint8ClampedArray([255,0,255]);
  assert.deepEqual([...extractSelectedPixels(pixels, mask)], [200,30,10,255, 10,50,200,0, 70,80,90,0]);
  assert.deepEqual([...extractSelectedPixels(pixels, mask, false)], [200,30,10,0, 10,50,200,128, 70,80,90,0]);
  assert.deepEqual(pixels, before);
});

test('polygon, box, ellipse, add/subtract and brush selections stay bounded', () => {
  const rectangle = selectRegion(10, 10, { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 });
  const polygon = selectPolygon(10, 10, [{x:.2,y:.2},{x:.8,y:.2},{x:.8,y:.8},{x:.2,y:.8}]);
  assert.deepEqual(polygon, rectangle);
  const ellipse = selectRegion(10,10,{x:.2,y:.2},{x:.8,y:.8},true);
  assert.ok(ellipse.reduce((a,b)=>a+b,0) < rectangle.reduce((a,b)=>a+b,0));
  assert.equal(combineSelection(rectangle, ellipse, 'subtract')[55], 0);
  assert.deepEqual(combineSelection(ellipse, rectangle, 'add'), rectangle);
  const brush = new Uint8ClampedArray(100);
  paintSelectionStroke(brush,10,10,{x:0,y:0},{x:1,y:1},1);
  assert.equal(brush[55],255); assert.equal(brush[9],0);
  paintSelectionStroke(brush,10,10,{x:.5,y:.5},{x:.5,y:.5},2,true);assert.equal(brush[55],0);
});

test('edge expansion and contraction are monotonic, feathering preserves empty and full masks', () => {
  const mask = new Uint8ClampedArray(49);mask[24]=255;
  const grown = refineSelection(mask,7,7,0,1);
  assert.equal(grown.reduce((sum,value)=>sum+Number(value>0),0),9);
  assert.deepEqual(refineSelection(grown,7,7,0,-1),mask);
  const soft = refineSelection(mask,7,7,1,0);
  assert.ok(soft[24]>0&&soft[24]<255);assert.ok(soft[23]>0);
  assert.deepEqual(refineSelection(new Uint8ClampedArray(12),4,3,12,12),new Uint8ClampedArray(12));
  assert.deepEqual(refineSelection(new Uint8ClampedArray(12).fill(255),4,3,12,-12),new Uint8ClampedArray(12).fill(255));
});

test('chosen feather radius is bounded, non-destructive and controls the saved cut transition', () => {
  const width=240, mask=new Uint8ClampedArray(width).fill(255,0,120), before=new Uint8ClampedArray(mask);
  const soft=refineSelection(mask,width,1,5), wide=refineSelection(mask,width,1,40);
  assert.equal(soft[100],255);assert.ok(wide[100]>0&&wide[100]<255);
  assert.equal(soft[140],0);assert.ok(wide[140]>0&&wide[140]<255);
  assert.deepEqual(refineSelection(mask,width,1,0),before);
  assert.deepEqual(mask,before,'Changing feather never accumulates blur in the source mask');
  assert.deepEqual(refineSelection(mask,width,1,500),refineSelection(mask,width,1,MAX_SELECTION_FEATHER));
  for(const amount of [-4,NaN,Infinity,-Infinity]) assert.deepEqual(refineSelection(mask,width,1,amount),before);
  assert.equal(normalizeSelectionFeather(4.7),5);
  const pixels=new Uint8ClampedArray(width*4).fill(255);
  const selected=extractSelectedPixels(pixels,wide),remainder=extractSelectedPixels(pixels,wide,false);
  assert.equal(selected[140*4+3],wide[140]);assert.equal(remainder[140*4+3],255-wide[140]);
  // No additional feathering at zero must retain AI confidence around hair.
  const ai=new Uint8ClampedArray([0,30,150,255]);assert.deepEqual(refineSelection(ai,4,1,0),ai);
});

test('pupil edits stay per pupil across save/load; legacy fill defaults remain enabled', () => {
  const layer = createImageLayer('avatar');layer.pupilImageEdits={amina:'data:image/png;base64,amina'};
  const template=createBlankTemplate();template.pages[0].layers=[layer];
  const saved=normalizeCustomPhotoTemplate(JSON.parse(JSON.stringify(template)));
  assert.equal(saved.pages[0].layers[0].appearance.fillEnabled,true);
  assert.equal(getStudioRasterOverride(saved.pages[0].layers[0],{pupil:{id:'amina'}} as RenderPupilData),'data:image/png;base64,amina');
  assert.equal(getStudioRasterOverride(saved.pages[0].layers[0],{pupil:{id:'john'}} as RenderPupilData),undefined);
  const copy=createImageLayer('image','snapshot');copy.pupilScopeId='amina';
  assert.equal(isPupilDataLayer(copy),true);
  copy.x=.8; // Moving an extracted object into another column never changes its owner.
  const pupils=[{pupil:{id:'amina'}},{pupil:{id:'john'}}] as RenderPupilData[];
  assert.equal(getStudioLayerData(copy,pupils,2)?.pupil.id,'amina');
  assert.equal(getStudioLayerData(copy,[pupils[1]],1),undefined);
});
