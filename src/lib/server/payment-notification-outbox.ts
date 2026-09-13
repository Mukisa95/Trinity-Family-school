import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import type { PaymentRecord } from '@/types';
import 'server-only';

// The existing rules already deny browser access below scheduledNotifications.
// A subcollection keeps internal events out of the scheduled-notification UI.
export const PAYMENT_NOTIFICATION_OUTBOX = 'scheduledNotifications/fee-payment-events/outbox';
export type PaymentNotificationOutboxTarget = { paymentId: string; paymentData: PaymentRecord };
export const paymentNotificationEventId = (paymentId: string) => `payment-${paymentId}`;

// A post-commit handoff, not an atomic payment/outbox transaction.
// Re-enqueue preserves completed recipients, attempts and leases.
export async function enqueuePaymentNotificationEvents(targets: PaymentNotificationOutboxTarget[]) {
  const db = getFirestore(getFirebaseAdminApp());
  const ids = [...new Set(targets.map(target => target.paymentId))];
  for (let offset = 0; offset < ids.length; offset += 25) {
    await Promise.all(ids.slice(offset, offset + 25).map(paymentId => {
      const ref = db.collection(PAYMENT_NOTIFICATION_OUTBOX).doc(paymentNotificationEventId(paymentId));
      return db.runTransaction(async transaction => {
        if ((await transaction.get(ref)).exists) return;
        transaction.set(ref, {
          kind: 'fee_payment', version: 1, paymentId, status: 'pending', attempts: 0,
          nextAttemptAt: Timestamp.fromMillis(Date.now()), leaseToken: null,
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
      });
    }));
  }
}
