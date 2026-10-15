import test from 'node:test';
import assert from 'node:assert/strict';
import { createForegroundClock } from '../src/lib/startup/foreground-clock';
import { projectAndroidRecords, yieldAndroidPreparation } from '../src/lib/offline/android-preparation-work';
import { setNavigationPending } from '../src/lib/navigation/navigation-work';
import { savedWorkspaceAccessStatus, workspaceCacheAccessScope } from '../src/lib/startup/workspace-cache-access';

test('foreground clock excludes several background intervals and initially hidden visits', () => {
  const clock = createForegroundClock(100, true);
  clock.setVisible(200, false); clock.setVisible(1000, true);
  assert.deepEqual(clock.sample(1100), {elapsed:1000,foreground:200,background:800});
  clock.setVisible(1200,false); clock.setVisible(1500,true);
  assert.deepEqual(clock.sample(1600), {elapsed:1500,foreground:400,background:1100});
  const hidden = createForegroundClock(0,false); hidden.setVisible(500,true);
  assert.deepEqual(hidden.sample(550), {elapsed:550,foreground:50,background:500});
});

test('record projection stops between batches during navigation and resumes in order', { timeout: 3000 }, async () => {
  const seen:number[]=[]; const records=Array.from({length:96},(_,i)=>i);
  let reachBatch!: () => void;
  const firstBatch = new Promise<void>(resolve => { reachBatch = resolve; });
  const done=projectAndroidRecords(records,i=>{seen.push(i);if(i===31){setNavigationPending(true);reachBatch();}return i*2;});
  await firstBatch;
  await new Promise(r=>setTimeout(r,25)); assert.equal(seen.length,32);
  setNavigationPending(false); assert.deepEqual(await done,records.map(i=>i*2));
});

test('cancelled exports cannot resume after a navigation or account switch', async () => {
  const controller=new AbortController(); setNavigationPending(true);
  const pending=yieldAndroidPreparation(controller.signal); controller.abort();
  await assert.rejects(pending,{name:'AbortError'});setNavigationPending(false);
  await assert.rejects(projectAndroidRecords([1],i=>i,controller.signal),{name:'AbortError'});
});

test('saved viewing diagnostics preserve expiry and permission boundaries', () => {
  const user={id:'private-account',role:'Admin' as const,isActive:true};const now=1000;
  const receipt={version:1,scope:workspaceCacheAccessScope(user),verifiedAt:now,expiresAt:now+7*86400000};
  assert.equal(savedWorkspaceAccessStatus(receipt,user,now),'eligible');
  assert.equal(savedWorkspaceAccessStatus(null,user,now),'missing-receipt');
  assert.equal(savedWorkspaceAccessStatus(receipt,user,receipt.expiresAt),'expired-receipt');
  assert.equal(savedWorkspaceAccessStatus(receipt,{...user,role:'Staff'},now),'scope-changed');
  assert.equal(savedWorkspaceAccessStatus({...receipt,version:2},user,now),'invalid-receipt');
  assert.equal(savedWorkspaceAccessStatus(receipt,{...user,isActive:false},now),'scope-changed');
});
