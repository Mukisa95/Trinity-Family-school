import test from 'node:test';
import assert from 'node:assert/strict';
import { StudioPhotoTreatmentCache, studioPhotoTreatmentKey } from '../src/components/docx/studio-photo-treatment';
import { createBlankTemplate, createImageLayer, getStudioRasterOverride, normalizeCustomPhotoTemplate, normalizeStudioPupilPhotoTreatment, type RenderPupilData } from '../src/components/docx/custom-photo-types';

test('a saved document keeps shared instructions, with safe bounds and individual corrections', () => {
  const template=createBlankTemplate();
  assert.equal(normalizeCustomPhotoTemplate(template).pupilPhotoTreatment,undefined,'Legacy designs stay unchanged');
  template.pupilPhotoTreatment={removeBackground:true,feather:9,edgeShift:-2};
  template.pages[0].layers[0].pupilImageEdits={amina:'individual-image'};
  const saved=normalizeCustomPhotoTemplate(JSON.parse(JSON.stringify(template)));
  assert.deepEqual(saved.pupilPhotoTreatment,template.pupilPhotoTreatment);
  assert.equal(getStudioRasterOverride(saved.pages[0].layers[0],{pupil:{id:'amina'}} as RenderPupilData),'individual-image');
  assert.equal(getStudioRasterOverride(saved.pages[0].layers[0],{pupil:{id:'john'}} as RenderPupilData),undefined,'Another pupil never receives a copied portrait');
  assert.deepEqual(normalizeStudioPupilPhotoTreatment({removeBackground:true,feather:Infinity,edgeShift:-100}),{removeBackground:true,feather:0,edgeShift:-12});
  assert.deepEqual(normalizeStudioPupilPhotoTreatment({feather:500,edgeShift:50}),{removeBackground:false,feather:50,edgeShift:12});
});

test('processing keys follow each original photo, crop, frame and edge treatment', () => {
  const layer=createImageLayer('avatar'),settings={removeBackground:true,feather:8,edgeShift:0},size={widthMm:210,heightMm:297};
  const key=studioPhotoTreatmentKey(layer,'pupil-A-photo',size,settings);
  assert.notEqual(studioPhotoTreatmentKey(layer,'pupil-B-photo',size,settings),key);
  assert.notEqual(studioPhotoTreatmentKey(layer,'pupil-A-updated',size,settings),key);
  assert.notEqual(studioPhotoTreatmentKey({...layer,imageZoom:2},'pupil-A-photo',size,settings),key);
  assert.notEqual(studioPhotoTreatmentKey({...layer,shape:'rectangle'},'pupil-A-photo',size,settings),key);
  assert.notEqual(studioPhotoTreatmentKey(layer,'pupil-A-photo',size,{...settings,feather:25}),key);
  assert.notEqual(studioPhotoTreatmentKey(layer,'pupil-A-photo',{widthMm:100,heightMm:297},settings),key);
  assert.equal(studioPhotoTreatmentKey({...layer,id:'duplicate',x:.5,opacity:.3,pupilImageEdits:{john:'other-edit'}},'pupil-A-photo',size,settings),key,'Moving or duplicating an identical layer reuses processing');
});

test('cache shares in-flight work, serializes pupils, bounds memory and retries failures', async () => {
  const cache=new StudioPhotoTreatmentCache(2);let active=0,maxActive=0,calls=0;
  const create=async(name:string)=>{calls++;active++;maxActive=Math.max(active,maxActive);await new Promise(resolve=>setTimeout(resolve,2));active--;return name;};
  const a=cache.get('A',()=>create('portrait-A'));
  assert.equal(cache.get('A',()=>create('wrong-portrait')),a);
  const b=cache.get('B',()=>create('portrait-B'));
  assert.deepEqual(await Promise.all([a,b]),['portrait-A','portrait-B']);assert.equal(calls,2);assert.equal(maxActive,1);
  await cache.get('C',()=>create('portrait-C'));
  assert.equal(await cache.get('A',()=>create('rebuilt-A')),'rebuilt-A');assert.equal(calls,4,'Old portraits are evicted');
  await assert.rejects(cache.get('failure',async()=>{throw new Error('Offline');}),/Offline/);
  assert.equal(await cache.get('failure',async()=> 'retry-success'),'retry-success');
  cache.clear();assert.equal(await cache.get('failure',async()=> 'after-close'),'after-close');
});
