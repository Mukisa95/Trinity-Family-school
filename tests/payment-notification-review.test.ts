import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { notificationFixture } from './helpers/payment-notifications-fixture';

test('pending payment alerts are retired without sending a notification', async () => {
  const f = notificationFixture();
  await f.enqueue([f.seed()]);
  await f.process();
  const event = f.documents.get('scheduledNotifications/fee-payment-events/outbox/payment-payment-1');
  assert.equal(f.sent.length, 0);
  assert.equal(event.status, 'skipped');
  assert.equal(event.lastOutcome, 'notifications_disabled');
  assert.equal(event.nextAttemptAt, undefined);
});

test('retiring a payment alert is idempotent', async () => {
  const f = notificationFixture();
  const target = f.seed();
  await f.enqueue([target]);
  await Promise.all([f.process(), f.process()]);
  await f.process();
  const event = f.documents.get('scheduledNotifications/fee-payment-events/outbox/payment-payment-1');
  assert.equal(f.sent.length, 0);
  assert.equal(event.status, 'skipped');
});

test('signed-in payment command does not create or deliver payment alerts', () => {
  assert.equal(fs.existsSync('src/app/api/payments/create/route.ts'), false);
  const source = fs.readFileSync('src/lib/services/payment-command.service.ts', 'utf8');
  assert.doesNotMatch(source, /enqueuePaymentNotificationEvents|processPendingPaymentNotificationEvents|after\(/);
  assert.match(source, /performs no additional authentication or token minting/);
});
