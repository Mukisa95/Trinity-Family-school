import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAndroidOfflineSession } from '../src/lib/offline/android-session-policy';
import { isAndroidOfflineSnapshot } from '../src/lib/offline/android-contracts';
import { dutyServiceCacheName, DUTY_SERVICE_COLLECTIONS } from '../src/lib/duty-service/contracts';
import { isAndroidSavedCacheKey } from '../src/lib/offline/android-sync-policy';
import { affectsAndroidSnapshot } from '../src/lib/offline/android-snapshot-changes';
import { offlineSections } from '../src/lib/pwa/sections';
import { setCircumferenceUser } from '../src/lib/access/circumference-session';
import type { SystemUser } from '../src/types';

const user: SystemUser = { id: 'teacher', username: 'Teacher', role: 'Staff', isActive: true, createdAt: '', granularPermissions: [
  { moduleId: 'duty_service', pages: [{ pageId: 'list', canAccess: true, actions: [{actionId: 'access_page', allowed: true}] }] },
] };
const grant = (account = user) => createAndroidOfflineSession(account, ['p4-pupil'], new Date(), {events: true, dutyService: true});

test('duty offline capability is negotiated; older clients and parents receive no duty records', () => {
  assert.equal(createAndroidOfflineSession(user, []).grants.dutyService, undefined);
  assert.equal(grant().grants.dutyService, true);
  assert.equal(grant({...user, role: 'Parent'}).grants.dutyService, false);
  assert.equal(grant({...user, granularPermissions: []}).grants.dutyService, false);
  assert.equal(grant({...user, isActive: false}).grants.dutyService, false);
  assert.notEqual(dutyServiceCacheName(user), dutyServiceCacheName({...user, granularPermissions: []}));
});

test('complete saved duty dataset is permitted without separate pupil-detail or timetable access', () => {
  const session = grant();
  const data: any = {...Object.fromEntries(DUTY_SERVICE_COLLECTIONS.map(name => [name, []])), staff: [{id: 't', name: 'Teacher'}], pupils: [{id:'p4-pupil', name:'Pupil', className:'P.4'}]};
  const snapshot: any = {schema:1, accountId:user.id, role:user.role, capturedAt:new Date().toISOString(), datasets:{dutyService:{preparedAt:new Date().toISOString(),data}}};
  assert.equal(isAndroidOfflineSnapshot(snapshot, session), true);
  assert.equal(offlineSections(session, snapshot).find(section => section.path === '/duty-service')?.saved, true);
  assert.equal(isAndroidOfflineSnapshot(snapshot, createAndroidOfflineSession(user, [])), false);
  data.staff[0] = {...data.staff[0], phone: 'private'} as any;
  assert.equal(isAndroidOfflineSnapshot(snapshot, session), false);
  data.staff[0] = {id: 't', name:'Teacher'};
  delete data.dutyAssignments;
  assert.equal(isAndroidOfflineSnapshot(snapshot, session), false);
});

test('only this account and permission snapshot dirties saved duty information', () => {
  setCircumferenceUser(user);
  const session = grant(); const project = 'trinity-family-schools';
  const key = `${project}::${dutyServiceCacheName(user)}::teacher:Staff`;
  assert.equal(isAndroidSavedCacheKey(key, session), true);
  assert.equal(affectsAndroidSnapshot(session, key, project), true);
  assert.equal(isAndroidSavedCacheKey(key.replace('::teacher:Staff','::other:Staff'), session), false);
  assert.equal(isAndroidSavedCacheKey(key.replace(dutyServiceCacheName(user), dutyServiceCacheName({...user, granularPermissions: []})), session), false);
  for (const reference of [`${project}::pupils::user:teacher`, `staff:${project}:teacher:Staff`, `academic-years:${project}:teacher:Staff`]) assert.equal(isAndroidSavedCacheKey(reference, session), true);
  setCircumferenceUser(null);
});

test('narrow pupil scope cannot be broadened in an offline duty projection', () => {
  const restricted = {...user, circumference:{classIds:['p4'], sections:null, genders:null}};
  const session = grant(restricted);
  const data: any = {...Object.fromEntries(DUTY_SERVICE_COLLECTIONS.map(name => [name, []])), staff:[], pupils:[{id:'outside-pupil',name:'Outside'}]};
  const snapshot: any = {schema:1,accountId:user.id,role:user.role,capturedAt:new Date().toISOString(),datasets:{dutyService:{preparedAt:new Date().toISOString(),data}}};
  assert.equal(isAndroidOfflineSnapshot(snapshot, session), false);
  data.pupils = [{id:'p4-pupil',name:'Allowed'}];
  assert.equal(isAndroidOfflineSnapshot(snapshot, session), true);
});
