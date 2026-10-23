import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterAppSettings } from '../src/lib/app-settings';
import { readAndroidNotificationState, setAndroidTimetableNotification, openAndroidWidgetSettings, setAndroidEventPreference } from '../src/lib/offline/android-notifications';

test('browsers never expose Android timetable, widgets, reminders or update controls, even through search', () => {
  for (const query of ['', 'notification', 'widget', 'timetable', 'fingerprint', 'lesson', 'Android']) {
    assert.ok(filterAppSettings(query, false).every(item => !('androidOnly' in item && item.androidOnly)));
  }
  assert.ok(filterAppSettings('', false).some(item => item.id === 'theme'));
  assert.ok(filterAppSettings('', false).some(item => item.id === 'push'));
});
test('search finds controls by everyday synonyms and across selected sections', () => {
  assert.deepEqual(filterAppSettings('fingerprint', true, 'account').map(item => item.id), ['biometrics']);
  assert.ok(filterAppSettings('calendar', true).some(item => item.id === 'timetable'));
  assert.ok(filterAppSettings('night mode', false).some(item => item.id === 'theme'));
  assert.deepEqual(filterAppSettings('not-a-setting', true), []);
  assert.ok(filterAppSettings('', true, 'security').every(item => item.section === 'security'));
});

async function native(run: (requests: Record<string, unknown>[]) => Promise<void>, reply: (request: Record<string, unknown>) => Record<string, unknown> = () => ({})) {
  const previous = globalThis.window;
  const requests: Record<string, unknown>[] = [];
  const bridge = { onmessage: undefined as ((event: { data: string }) => void) | undefined, postMessage(raw: string) {
    const request = JSON.parse(raw); requests.push(request);
    queueMicrotask(() => bridge.onmessage?.({ data: JSON.stringify({ id: request.id, success: true, ...reply(request) }) }));
  } };
  globalThis.window = { TrinityOffline: bridge, dispatchEvent: () => true } as unknown as Window & typeof globalThis;
  try { await run(requests); } finally { if (previous) globalThis.window = previous; else delete (globalThis as any).window; }
}
test('live timetable off sends only the explicit preference, preserving widget, lesson and visibility choices', async () => {
  await native(async requests => {
    assert.equal(await setAndroidTimetableNotification(false), 'updated');
    assert.equal(await setAndroidTimetableNotification(true), 'updated');
    assert.deepEqual(requests.map(({ id, ...request }) => request), [{ action: 'selectTimetable', notificationCard: false }, { action: 'selectTimetable', notificationCard: true }]);
  });
});
test('older Android apps open native controls without reporting a successful toggle', async () => {
  await native(async requests => {
    assert.equal(await setAndroidTimetableNotification(false), 'settings');
    assert.deepEqual(requests.map(item => item.action), ['selectTimetable', 'openTimetableSettings']);
  }, request => request.action === 'selectTimetable' ? { success: false, error: 'Unsupported preparation action.' } : {});
});
test('preference reads retain false values and old apps never claim a known enabled state', async () => {
  await native(async () => { const state = await readAndroidNotificationState(); assert.equal(state.notificationCard, false); assert.equal(state.liveEvents, false); }, () => ({ notificationCard: false, liveEvents: false }));
  await native(async () => { const state = await readAndroidNotificationState(); assert.equal(state.notificationCard, undefined); assert.equal(state.liveEvents, undefined); });
});
test('widget setup cannot choose an arbitrary app or widget; calendar preferences remain independent', async () => {
  await native(async requests => { await openAndroidWidgetSettings(); assert.deepEqual(Object.keys(requests[0]).sort(), ['action', 'id']); });
  await native(async requests => { await setAndroidEventPreference('events', false); await setAndroidEventPreference('eventReminders', true); assert.deepEqual(requests.map(({ id, ...request }) => request), [{ action: 'selectTimetable', events: false }, { action: 'selectTimetable', eventReminders: true }]); });
});
