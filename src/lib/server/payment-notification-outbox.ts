import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import 'server-only';

// The existing rules already deny browser access below scheduledNotifications.
// A subcollection keeps internal events out of the scheduled-notification UI.
export const PAYMENT_NOTIFICATION_OUTBOX = 'scheduledNotifications/fee-payment-events/outbox';
export type PaymentNotificationOutboxTarget = { paymentId: string };
export const paymentNotificationEventId = (paymentId: string) => `payment-${paymentId}`;

// Create the durable job before the financial write. The worker reads the
// committed payment and cannot send a push for an uncommitted payment.
// create() is idempotent without a Firestore read and never resets a lease,
// completed recipient, or retry state on an operation replay.
export async function enqueuePaymentNotificationEvents(targets: PaymentNotificationOutboxTarget[]) {
  const adminApp = getFirebaseAdminApp();
  const paymentProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (paymentProjectId && adminApp.options.projectId && adminApp.options.projectId !== paymentProjectId) {
    throw new Error('Payment and notification Firebase projects do not match');
  }
  const db = getFirestore(adminApp);
  const ids = [...new Set(targets.map(target => target.paymentId))];
  for (let offset = 0; offset < ids.length; offset += 25) {
    await Promise.all(ids.slice(offset, offset + 25).map(async paymentId => {
      const ref = db.collection(PAYMENT_NOTIFICATION_OUTBOX).doc(paymentNotificationEventId(paymentId));
      try {
        await ref.create({
          kind: 'fee_payment', version: 1, paymentId, status: 'pending', attempts: 0,
          nextAttemptAt: Timestamp.fromMillis(Date.now()), leaseToken: null,
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        // Concurrent retries can prepare the same operation; only one job wins.
        if ((error as { code?: number | string })?.code !== 6
          && (error as { code?: number | string })?.code !== 'already-exists') throw error;
      }
    }));
  }
}
