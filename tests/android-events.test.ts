import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAndroidOfflineSession } from '../src/lib/offline/android-session-policy';
import { isAndroidOfflineSnapshot } from '../src/lib/offline/android-contracts';
import { canOpenAndroidOfflineRoute } from '../src/lib/offline/android-app-shell';
import { isAndroidSavedDataQuery, isAndroidSavedCacheKey, androidSnapshotRevision } from '../src/lib/offline/android-sync-policy';
import type { SystemUser, Event } from '../src/types';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { hasCircumference } from '../src/lib/access/circumference';
const user: SystemUser={id:'events-staff',username:'Events',role:'Staff',isActive:true,createdAt:'2026-01-01',granularPermissions:[{moduleId:'events',pages:[{pageId:'calendar',canAccess:true,actions:[{actionId:'view_events',allowed:true}]}]}]};
test('event-only staff access follows existing permission and identity scope',()=>{
  const session=createAndroidOfflineSession(user,[]);
  assert.equal(session.grants.events,true); assert.equal(session.grants.timetable,false);
  assert.equal(canOpenAndroidOfflineRoute('/events',session),true);
  assert.equal(canOpenAndroidOfflineRoute('/events/x/attendance',session),false);
  assert.equal(isAndroidSavedDataQuery(['events','base',session.grants.eventCacheScope],session),true);
  assert.equal(isAndroidSavedCacheKey(`events:${session.grants.eventCacheScope}`,session),true);
  assert.equal(isAndroidSavedCacheKey(`events:other-user`,session),false);
  assert.equal(createAndroidOfflineSession({...user,granularPermissions:[]},[]).grants.events,false);
  assert.equal(createAndroidOfflineSession({...user,role:'Parent'},[]).grants.events,false);
});
test('saved events reject revoked grants and changing revisions trigger synchronization',()=>{
  const session=createAndroidOfflineSession(user,[]);
  const snapshot={schema:1 as const,accountId:user.id,role:user.role,capturedAt:new Date().toISOString(),datasets:{events:{data:[] as Event[],preparedAt:new Date().toISOString(),revision:1}}};
  assert.equal(isAndroidOfflineSnapshot(snapshot,session),true);
  assert.equal(isAndroidOfflineSnapshot(snapshot,{...session,grants:{...session.grants,events:false}}),false);
  const before=androidSnapshotRevision(snapshot); snapshot.datasets.events.revision=2;
  assert.notEqual(before,androidSnapshotRevision(snapshot));
});

test('older APKs retain the original grant shape and supported offline sections',()=>{
  const session=createAndroidOfflineSession({...user,role:'Admin'},[],new Date(),{events:false});
  assert.deepEqual(Object.keys(session.grants),['dashboard','pupils','timetable','pupilFields','dashboardCounts']);
  assert.equal(canOpenAndroidOfflineRoute('/events',session),false);
  assert.equal(canOpenAndroidOfflineRoute('/timetable',session),true);
});
test('the session endpoint negotiates native event support without changing authorization',async()=>{
  const module={exports:{} as {GET:(request:Request)=>Promise<{data:any}>}};
  runInNewContext(transformSync(readFileSync('src/app/api/offline/session/route.ts','utf8'),{loader:'ts',format:'cjs'}).code,{
    module,exports:module.exports,require:(name:string)=>{
      if(name==='next/server') return {NextResponse:{json:(data:any)=>({data})}};
      if(name.endsWith('/app-auth')) return {requireAppUser:async()=>({user})};
      if(name.endsWith('/android-session-policy')) return {createAndroidOfflineSession};
      if(name.endsWith('/access/circumference')) return {hasCircumference};
      return {};
    },
  });
  const older=await module.exports.GET(new Request('https://school.invalid/api/offline/session'));
  assert.equal('events' in older.data.grants,false);
  const updated=await module.exports.GET(new Request('https://school.invalid/api/offline/session',{headers:{'X-Trinity-Offline-Features':'events'}}));
  assert.equal(updated.data.grants.events,true);
  assert.equal(updated.data.grants.pupils,false);
});
