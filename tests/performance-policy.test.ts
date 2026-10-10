import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInteractionMonitor, parseEffectsPreference, shouldReduceEffects } from '../src/lib/performance/presentation-policy';
import { affectsAndroidSnapshot } from '../src/lib/offline/android-snapshot-changes';
import type { AndroidOfflineSession } from '../src/lib/offline/android-contracts';

test('unknown capability is usable; overrides and accessibility preferences remain authoritative', () => {
  assert.equal(parseEffectsPreference('corrupt'), 'automatic');
  assert.equal(shouldReduceEffects('automatic', {}), false);
  assert.equal(shouldReduceEffects('automatic', { memoryGB: 0, processors: NaN }), false);
  assert.equal(shouldReduceEffects('automatic', { memoryGB: 2 }), true);
  assert.equal(shouldReduceEffects('automatic', { processors: 2 }), true);
  assert.equal(shouldReduceEffects('automatic', { lowRam: true }), true);
  assert.equal(shouldReduceEffects('full', { memoryGB: 1, struggling: true }), false);
  assert.equal(shouldReduceEffects('full', { reducedMotion: true }), true);
  assert.equal(shouldReduceEffects('reduced', {}), true);
});

test('automatic mode ignores startup, duplicate events and isolated slow interactions', () => {
  const record = createInteractionMonitor(0);
  for (let id = 1; id <= 6; id++) assert.equal(record(id, 500, 5_000), false);
  for (let i = 0; i < 8; i++) assert.equal(record(10, 250, 30_000 + i), false);
  for (let id = 11; id <= 13; id++) assert.equal(record(id, 220, 35_000), false);
  assert.equal(record(14, 240, 36_000), true);
});

test('a slow interaction window expires and non-interaction entries cannot select reduced mode', () => {
  const record = createInteractionMonitor(0);
  for (let id = 1; id <= 4; id++) assert.equal(record(id, 220, 30_000), false);
  assert.equal(record(5, 250, 100_000), false);
  assert.equal(record(0, 900, 101_000), false);
  assert.equal(record(6, 100, 102_000), false);
});

test('native refresh follows authorized saved sources, not arbitrary query results or another account', () => {
  const session = { accountId: 'staff/a', role: 'Staff', grants: { pupils: false, timetable: true, dashboard: true, dashboardCounts: ['staff'] } } as AndroidOfflineSession;
  const scope = ['project', session.accountId, session.role].map(encodeURIComponent).join(':');
  assert.equal(affectsAndroidSnapshot(session, `classes:${scope}`, 'project'), true);
  assert.equal(affectsAndroidSnapshot(session, `staff:${scope}`, 'project'), true);
  assert.equal(affectsAndroidSnapshot(session, 'project::pupils::user:staff/a', 'project'), false);
  assert.equal(affectsAndroidSnapshot(session, 'classes:project:another:Staff', 'project'), false);
  assert.equal(affectsAndroidSnapshot(session, 'payments', 'project'), false);
  assert.equal(affectsAndroidSnapshot(session, undefined, 'project'), false);
  const timetableScope = ['project', session.accountId, session.role, 'school'].map(encodeURIComponent).join(':');
  assert.equal(affectsAndroidSnapshot(session, `timetable:${encodeURIComponent(timetableScope)}:year:term:entries:profile`, 'project'), true);
  assert.equal(affectsAndroidSnapshot({ ...session, role: 'Parent' }, `classes:${scope}`, 'project'), false);
});
