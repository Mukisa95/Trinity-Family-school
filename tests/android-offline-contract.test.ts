import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SystemUser } from '../src/types';
import { createAndroidOfflineSession } from '../src/lib/offline/android-session-policy';
import { isAndroidOfflineSnapshot, projectOfflinePupil } from '../src/lib/offline/android-contracts';
import { readFileSync } from 'node:fs';

const staff: SystemUser = {
  id: 'staff-a', username: 'Example', role: 'Staff', isActive: true, createdAt: '2026-01-01',
  granularPermissions: [{ moduleId: 'pupils', pages: [{ pageId: 'detail', canAccess: true, actions: [{ actionId: 'access_page', allowed: true }, { actionId: 'view_personal_info', allowed: true }] }] }],
};
test('server grants follow page and action permissions; tokens and credentials are excluded', () => {
  const session = createAndroidOfflineSession({ ...staff, passwordHash: 'never-copy' }, []);
  assert.equal(session.grants.pupils, true);
  assert.equal(session.grants.timetable, false);
  const pupil = projectOfflinePupil({ id: 'a', firstName: 'Test', medicalConditions: 'private', guardians: [], dateOfBirth: '2014-01-01' }, session);
  assert.equal(pupil.dateOfBirth, '2014-01-01');
  assert.equal('guardians' in pupil, false);
  assert.equal('medicalConditions' in pupil, false);
  assert.equal(JSON.stringify(session).includes('never-copy'), false);
});
test('parents can export only their authorized family and prepared child projections', () => {
  const session = createAndroidOfflineSession({ ...staff, id: 'parent-a', role: 'Parent' }, ['child-a']);
  const snapshot: any = { schema: 1, accountId: 'parent-a', role: 'Parent', capturedAt: new Date().toISOString(), datasets: {
    parent: { preparedAt: new Date().toISOString(), data: {
      family: { schema: 1, accountId: 'parent-a', preparedAt: new Date().toISOString(), pupils: [{ id: 'child-a' }] },
      fees: [], banking: [], attendance: [], results: [],
    } },
  } };
  assert.equal(isAndroidOfflineSnapshot(snapshot, session), true);
  snapshot.datasets.parent.data.family.pupils.push({ id: 'child-b' });
  assert.equal(isAndroidOfflineSnapshot(snapshot, session), false);
  snapshot.datasets.parent.data.family.pupils.pop();
  snapshot.datasets.parent.data.fees.push({ accountId: 'other-parent', pupilId: 'child-a' });
  assert.equal(isAndroidOfflineSnapshot(snapshot, session), false);
  snapshot.datasets.parent.data.fees = [];
  snapshot.datasets.pupils = { data: [] };
  assert.equal(isAndroidOfflineSnapshot(snapshot, session), false);
});
test('offline sessions expire and ordinary browsers do not trigger Android preparation', () => {
  const now = new Date('2026-10-07T10:00:00.000Z');
  const session = createAndroidOfflineSession(staff, [], now);
  assert.equal(session.expiresAt, '2026-10-14T10:00:00.000Z');
  const provider = readFileSync('src/components/providers/android-offline-provider.tsx', 'utf8');
  assert.match(provider, /if \(!hasAndroidOfflineBridge\(\) \|\| isLoading\) return/);
  assert.match(provider, /auth\.currentUser\?\.uid !== user\.id/);
  const parent = readFileSync('src/lib/parent-offline/repository.ts', 'utf8');
  assert.match(parent, /readParentOfflineBundle/);
  assert.match(parent, /hasChild\(record\) && isParentOfflineFeesSnapshot/);
});
