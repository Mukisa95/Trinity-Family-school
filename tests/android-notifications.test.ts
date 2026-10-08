import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasAndroidOfflineBridge } from '../src/lib/offline/android-bridge';
import { readAndroidNotificationState, openAndroidNotificationSettings, openAndroidLessonReminders, openAndroidTimetableSettings, restoreAndroidTimetableNotification } from '../src/lib/offline/android-notifications';

async function nativeReply(data: Record<string, unknown> | ((action: string) => Record<string, unknown>), run: (actions: string[]) => Promise<void>) {
  const previous = globalThis.window;
  const actions: string[] = [];
  const bridge = { onmessage: undefined as ((event: { data: string }) => void) | undefined, postMessage(message: string) {
    const request = JSON.parse(message);
    actions.push(request.action);
    assert.deepEqual(Object.keys(request).sort(), request.action === 'selectTimetable' ? ['action', 'id', 'notificationCard'] : ['action', 'id']);
    if (request.action === 'selectTimetable') assert.equal(request.notificationCard, true);
    queueMicrotask(() => bridge.onmessage?.({ data: JSON.stringify({ id: request.id, success: true, ...(typeof data === 'function' ? data(request.action) : data) }) }));
  } };
  globalThis.window = { TrinityOffline: bridge } as unknown as Window & typeof globalThis;
  try { await run(actions); } finally { if (previous === undefined) delete (globalThis as any).window; else globalThis.window = previous; }
}

test('native permission is read without inventing a server push subscription', async () => {
  await nativeReply({ appName: 'Trinity Live', notificationPermission: 'granted', remotePush: false }, async actions => {
    assert.deepEqual(await readAndroidNotificationState(), { appName: 'Trinity Live', permission: 'granted', remotePush: false, pushEnabled: true, pushAccountId: '' });
    assert.deepEqual(actions, ['notificationStatus']);
  });
});
test('Android permission denial is preserved independently of remote push', async () => {
  await nativeReply({ notificationPermission: 'denied', remotePush: false }, async () => {
    assert.equal((await readAndroidNotificationState()).permission, 'denied');
  });
});
test('unrecognised capability values cannot claim notifications are allowed', async () => {
  await nativeReply({ notificationPermission: 'allowed', remotePush: 'true' }, async () => {
    assert.deepEqual(await readAndroidNotificationState(), { appName: 'School app', permission: 'unknown', remotePush: false, pushEnabled: true, pushAccountId: '' });
  });
});
test('settings actions stay local and cannot choose another app or account', async () => {
  await nativeReply({}, async actions => {
    await openAndroidNotificationSettings(); await openAndroidLessonReminders(); await openAndroidTimetableSettings();
    assert.deepEqual(actions, ['openNotificationSettings', 'openLessonReminderSettings', 'openTimetableSettings']);
  });
});
test('older native releases remain detectable when the new status action is rejected', async () => {
  await nativeReply({ success: false, error: 'Unsupported preparation action.' }, async () => {
    await assert.rejects(readAndroidNotificationState(), /Unsupported preparation action/);
    assert.equal(hasAndroidOfflineBridge(), true);
  });
});
test('a normal browser cannot call native notification settings', async () => {
  const previous = globalThis.window;
  globalThis.window = {} as Window & typeof globalThis;
  try { assert.equal(hasAndroidOfflineBridge(), false); await assert.rejects(openAndroidNotificationSettings(), /unavailable/); }
  finally { if (previous === undefined) delete (globalThis as any).window; else globalThis.window = previous; }
});

test('restoring a dismissed timetable card does not send changes to progress or visible tables', async () => {
  await nativeReply({}, async actions => {
    assert.equal(await restoreAndroidTimetableNotification(), 'restored');
    assert.deepEqual(actions, ['selectTimetable']);
  });
});

test('older apps open their existing card controls instead of falsely reporting restoration', async () => {
  await nativeReply(action => action === 'selectTimetable' ? { success: false, error: 'Unsupported preparation action.' } : {}, async actions => {
    assert.equal(await restoreAndroidTimetableNotification(), 'settings');
    assert.deepEqual(actions, ['selectTimetable', 'openTimetableSettings']);
  });
});

test('a missing or unauthorised timetable is reported without attempting another action', async () => {
  await nativeReply({ success: false, error: 'Open Trinity Live to load your timetables.' }, async actions => {
    await assert.rejects(restoreAndroidTimetableNotification(), /load your timetables/);
    assert.deepEqual(actions, ['selectTimetable']);
  });
});
