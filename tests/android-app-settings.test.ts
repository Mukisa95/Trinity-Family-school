import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberWidgetOrder, requestAndroidAppSettings } from '../src/lib/offline/android-app-settings';

const originalWindow = globalThis.window;
const settings = () => ({ schema: 1, accountId: 'account-a', timetables: [], widgets: [], card: {}, reminders: {} });
function bridge(reply: Record<string, unknown>, requests: Record<string, unknown>[] = []) {
  const native = {
    onmessage: undefined as undefined | ((event: { data: string }) => void),
    postMessage(raw: string) {
      const request = JSON.parse(raw); requests.push(request);
      queueMicrotask(() => native.onmessage?.({ data: JSON.stringify({ id: request.id, success: true, ...reply }) }));
    },
  };
  globalThis.window = { TrinityOffline: native } as unknown as Window & typeof globalThis;
}
test.after(() => { globalThis.window = originalWindow; });

test('reordering a widget preserves temporarily hidden cards and adds new cards once', () => {
  assert.deepEqual(rememberWidgetOrder(['timetable:a','hidden-event','timetable:b'], ['timetable:b','timetable:a','new-event']), ['timetable:b','hidden-event','timetable:a','new-event']);
});

test('inline settings use the real bridge and bind every command to the signed-in account', async () => {
  const requests: Record<string, unknown>[] = [];
  bridge({ settings: settings() }, requests);
  const value = await requestAndroidAppSettings('saveWidgetSettings', 'account-a', { accountId: 'spoofed', widgetId: 103, settings: { progress: false } });
  assert.equal(value.accountId, 'account-a');
  assert.equal(requests[0].accountId, 'account-a');
  assert.equal(requests[0].widgetId, 103);
  assert.equal(requests[0].action, 'saveWidgetSettings');
});
test('another account reply is rejected before displaying its saved preferences', async () => {
  bridge({ settings: { ...settings(), accountId: 'account-b' } });
  await assert.rejects(requestAndroidAppSettings('readAppSettings', 'account-a'), /account changed/i);
});
test('an older APK receives a clear upgrade state instead of empty controls', async () => {
  for (const reply of [{}, { settings: { ...settings(), schema: 0 } }, { success: false, error: 'Unsupported preparation action.' }]) {
    bridge(reply);
    await assert.rejects(requestAndroidAppSettings('readAppSettings', 'account-a'), /Update the Android app/);
  }
});
test('native validation failures remain actionable and are not shown as successful saves', async () => {
  bridge({ success: false, error: 'This widget is no longer installed.' });
  await assert.rejects(requestAndroidAppSettings('saveWidgetSettings', 'account-a', { widgetId: 999 }), /no longer installed/);
});
test('reminder previews send the draft and changed filter without a save command', async () => {
  const requests: Record<string, unknown>[] = [];
  bridge({ settings: settings() }, requests);
  await requestAndroidAppSettings('previewLessonReminders', 'account-a', { reminderDraft: { tables: ['table-a'], classes: [] }, changedFilter: 'timetables' });
  assert.equal(requests[0].action, 'previewLessonReminders');
  assert.deepEqual(requests[0].reminderDraft, { tables: ['table-a'], classes: [] });
  assert.equal(requests[0].changedFilter, 'timetables');
});
