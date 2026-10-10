import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSnapshotFingerprint } from '../src/lib/offline/android-snapshot-fingerprint';
import { exportAndroidCachedSnapshot } from '../src/lib/offline/android-cache-export';
import type { AndroidOfflineSession, AndroidOfflineSnapshot } from '../src/lib/offline/android-contracts';

test('snapshot comparison reuses unchanged pupil data and detects changed or removed datasets', () => {
  const fingerprint = createSnapshotFingerprint();
  let reads = 0;
  const pupils = [{ id: 'pupil', get firstName() { reads++; return 'Example'; } }];
  const snapshot: AndroidOfflineSnapshot = { schema: 1, accountId: 'a', role: 'Admin', capturedAt: 'now', datasets: { pupils: { preparedAt: 'now', data: pupils } } };
  const initial = fingerprint(snapshot);
  assert.equal(reads, 1);
  snapshot.datasets.pupils!.preparedAt = 'later';
  assert.equal(fingerprint(snapshot), initial);
  assert.equal(reads, 1, 'Unchanged pupil records are not serialized again');
  snapshot.datasets.dashboard = { preparedAt: 'later', data: { pupils: 1 } };
  assert.notEqual(fingerprint(snapshot), initial);
  assert.equal(reads, 1);
  delete snapshot.datasets.dashboard;
  assert.equal(fingerprint(snapshot), initial);
  snapshot.datasets.pupils = { preparedAt: 'later', data: [{ id: 'pupil', firstName: 'Changed' }] };
  assert.notEqual(fingerprint(snapshot), initial);
});

test('unrelated saved changes reuse authorized pupil projections, while account changes cannot', async () => {
  const session = { accountId: 'a', role: 'Admin', grants: { pupils: true, dashboard: true, timetable: false, dashboardCounts: ['pupils'] } } as AndroidOfflineSession;
  const previous: AndroidOfflineSnapshot = { schema: 1, accountId: 'a', role: 'Admin', capturedAt: 'now', datasets: { pupils: { preparedAt: 'now', data: [{ id: 'pupil' }] }, dashboard: { preparedAt: 'now', data: { pupils: 1 } } } };
  const snapshot = await exportAndroidCachedSnapshot(session, { previous, pupilsUnchanged: true });
  assert.equal(snapshot?.datasets.pupils, previous.datasets.pupils);
  assert.equal(snapshot?.datasets.dashboard?.data.pupils, 1);
  assert.equal(await exportAndroidCachedSnapshot({ ...session, accountId: 'b' }, { previous, pupilsUnchanged: true }), null);
  assert.equal(await exportAndroidCachedSnapshot(session, { previous, pupilsUnchanged: false }), null, 'An actual pupil write requires a new source snapshot');
});
