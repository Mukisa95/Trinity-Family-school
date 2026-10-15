// Real IndexedDB, thumbnail preparation, cooperative scheduler and foreground clock in Chromium.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const esbuild=require('esbuild'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
async function run(){
 const contents=`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {projectOfflinePhotos} from './src/lib/offline/android-photo-projection';
import {projectAndroidRecords} from './src/lib/offline/android-preparation-work';
import {setNavigationPending} from './src/lib/navigation/navigation-work';
import {usePageDataTiming} from './src/lib/hooks/use-page-data-timing';
window.nativeEvents=0;window.TrinityOffline={};window.addEventListener('trinity-native-cache-written',()=>window.nativeEvents++);
const bitmap=window.createImageBitmap.bind(window);window.decodes=0;window.createImageBitmap=(...args)=>{window.decodes++;return bitmap(...args);};
const digest=crypto.subtle.digest.bind(crypto.subtle);window.hashes=0;crypto.subtle.digest=(...args)=>{window.hashes++;return digest(...args);};
window.makePhoto=(seed=0)=>{const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');const im=ctx.createImageData(256,256);for(let i=0;i<im.data.length;i++)im.data[i]=(i*17+i%199+seed)%256;ctx.putImageData(im,0,0);return c.toDataURL('image/png');};
window.prepare=(account,photo)=>projectOfflinePhotos(account,[{id:'synthetic',photo,firstName:'Fixture'}]);
window.prepareRecords=(account,records)=>projectOfflinePhotos(account,records);
window.setPending=setNavigationPending;window.startRecords=()=>{window.projected=0;window.projectDone=false;window.projectPromise=projectAndroidRecords(Array.from({length:160},(_,i)=>i),i=>{window.projected++;if(i===31)setNavigationPending(true);return i;}).then(r=>{window.projectDone=true;return r;});};
function App(){const[ready,setReady]=useState(false),[visit,setVisit]=useState('first');window.ready=setReady;window.visit=setVisit;
usePageDataTiming('fixture',ready,visit);return <div data-workspace-visible='true'>{ready?'Ready':'Loading'}</div>;}
createRoot(document.getElementById('root')).render(<App/>);`;
 const built=await esbuild.build({stdin:{contents,loader:'tsx',resolveDir:root},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID':'"trinity-family-schools"'}});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?built.outputFiles[0].text:'<!doctype html><div id="root"></div><script src="/fixture.js"></script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
 try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready);
  const first=await page.evaluate(async()=>{window.photo=window.makePhoto();window.original={id:'synthetic',photo:window.photo};const result=await window.prepare('account-A',window.photo);return {photo:result[0].photo,hashes:window.hashes,decodes:window.decodes,events:window.nativeEvents};});
  assert.ok(first.photo.startsWith('data:image/jpeg;base64,'));assert.ok(first.photo.length<=8192);assert.equal(first.events,0);
  const warm=await page.evaluate(async()=>{await window.prepare('account-A',window.photo);return {hashes:window.hashes,decodes:window.decodes};});assert.equal(warm.hashes,first.hashes);assert.equal(warm.decodes,first.decodes);
  await page.evaluate(async()=>window.prepare('account-B',window.photo));assert.equal(await page.evaluate(()=>window.decodes),first.decodes+1,'Another account must not share the first account thumbnail cache');
  await page.evaluate(async()=>window.prepare('account-A',window.photo));assert.equal(await page.evaluate(()=>window.decodes),first.decodes+1,'A returning account must reuse its persisted thumbnail');
  const boundaries=await page.evaluate(async()=>{
    const source=[{id:'one',photo:window.photo},{id:'two',photo:'https://example.invalid/pupil.jpg'},{id:'three',photo:'data:image/jpeg;base64,broken'.padEnd(9000,'!')}];
    const before=JSON.stringify(source);const output=await window.prepareRecords('account-A',source);
    return {unmodified:JSON.stringify(source)===before,remote:output[1].photo,damaged:output[2].photo};
  });assert.equal(boundaries.unmodified,true);assert.equal(boundaries.remote,'https://example.invalid/pupil.jpg');assert.equal(boundaries.damaged,undefined);
  await page.reload();await page.waitForFunction(()=>window.ready);await page.evaluate(async()=>{window.photo=window.makePhoto();await window.prepare('account-A',window.photo);});assert.equal(await page.evaluate(()=>window.decodes),0,'Restart must reuse saved thumbnails');
  const changed=await page.evaluate(async()=>{const result=await window.prepare('account-A',window.makePhoto(42));return {photo:result[0].photo,decodes:window.decodes};});
  assert.equal(changed.decodes,1,'A changed source photo must be decoded again');assert.notEqual(changed.photo,first.photo);
  await page.evaluate(()=>window.startRecords());await page.waitForFunction(()=>window.projected===32);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.projected),32);await page.evaluate(()=>window.setPending(false));await page.waitForFunction(()=>window.projectDone);assert.equal(await page.evaluate(()=>window.projected),160);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));window.ready(true);});
  await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>performance.getEntriesByName('trinity:workspace:page:fixture:first-data-visible').length),0);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>performance.getEntriesByName('trinity:workspace:page:fixture:foreground-to-visible').length===1);
  const timings=await page.evaluate(()=>Object.fromEntries(['first-data-visible','foreground-to-visible','background-wait'].map(name=>{const e=performance.getEntriesByName('trinity:workspace:page:fixture:'+name)[0];return[name,{duration:e.duration,start:e.startTime,end:e.detail.observedEnd}];})));
  assert.ok(timings['background-wait'].duration>=400);assert.ok(timings['first-data-visible'].duration-timings['foreground-to-visible'].duration>=400);
  assert.ok(timings['foreground-to-visible'].end-timings['foreground-to-visible'].start>timings['foreground-to-visible'].duration+400);
  assert.deepEqual(errors,[]);const out=path.join(root,'output/android-preparation-qa');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({thumbnailFits:true,warmHashReuse:true,persistentRestartReuse:true,accountIsolation:true,noSaveFeedback:true,navigationYield:true,timings,errors},null,2));console.log('Android preparation browser checks passed.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
