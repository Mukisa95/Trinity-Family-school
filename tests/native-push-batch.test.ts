import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';

// Exercise the actual batch adapter without contacting recipients or Firebase.
function serviceWithSender(subscriptions: unknown[], send: (devices: unknown[], payload: any) => Promise<unknown>) {
  const source = readFileSync(new URL('../src/lib/services/optimized-notification.service.ts', import.meta.url), 'utf8');
  const module = { exports: {} as any };
  runInNewContext(transformSync(source, { loader: 'ts', format: 'cjs' }).code, {
    module, exports: module.exports, console,
    require: (name: string) => name === '@/lib/server/push-notifications' ? {
      getServerPushSubscriptionsForUsers: async (users: string[]) => {
        assert.deepEqual(Array.from(users), ['selected-parent']); return subscriptions;
      },
      sendServerWebPush: send,
    } : {},
  });
  return module.exports.optimizedNotificationService;
}

const native = { id: 'native-one', userId: 'selected-parent', transport: 'android-fcm', nativeToken: 'native-device-token', endpoint: '', p256dh: '', auth: '' };
const browser = { id: 'browser-one', userId: 'selected-parent', endpoint: 'https://push.example/device', p256dh: 'browser-key', auth: 'browser-auth' };
const announcement = { id: 'announcement-one', title: 'School update', description: 'Selected recipient only', pushUrl: '/push-notifications', pushData: { notificationId: 'announcement-one' } };

test('batch announcements preserve native and browser device contracts and recipient scope', async () => {
  let calls = 0;
  const service = serviceWithSender([native, browser], async (devices, payload) => {
    calls++; assert.equal(devices.length, 2);
    assert.equal((devices[0] as any).transport, 'android-fcm');
    assert.equal((devices[0] as any).nativeToken, native.nativeToken);
    assert.equal((devices[1] as any).p256dh, browser.p256dh);
    assert.equal(payload.url, '/push-notifications');
    assert.equal(payload.data.notificationId, 'announcement-one');
    return { accepted: 2, failed: 0, rejected: 0 };
  });
  const result = await service.sendToWebSubscriptions(announcement, [{ id: 'selected-parent' }]);
  assert.equal(calls, 1); assert.equal(result.sent, 2); assert.equal(result.failed, 0); assert.equal(result.errors.length, 0);
});

test('a native-only announcement reaches the shared sender and retains delivery failures', async () => {
  const service = serviceWithSender([native], async devices => {
    assert.equal((devices[0] as any).transport, 'android-fcm');
    return { accepted: 0, failed: 1, rejected: 0 };
  });
  const result = await service.sendToWebSubscriptions(announcement, [{ id: 'selected-parent' }]);
  assert.equal(result.sent, 0); assert.equal(result.failed, 1); assert.equal(result.errors.length, 0);
});
