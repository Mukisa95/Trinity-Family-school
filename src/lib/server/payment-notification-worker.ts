import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { PAYMENT_NOTIFICATION_OUTBOX, paymentNotificationEventId } from './payment-notification-outbox';
import 'server-only';

export async function processPendingPaymentNotificationEvents(limit = 25, paymentIds?: string[]) {
  const db = getFirestore(getFirebaseAdminApp());
  // Payment alerts are retired rather than delivered. This also makes any
  // pre-existing outbox jobs safe after the feature was removed.
  const ids = paymentIds
    ? [...new Set(paymentIds)].map(paymentNotificationEventId)
    : (await db.collection(PAYMENT_NOTIFICATION_OUTBOX)
      .where('nextAttemptAt', '<=', Timestamp.fromMillis(Date.now()))
      .orderBy('nextAttemptAt', 'asc').limit(Math.max(1, Math.min(limit, 100))).get()).docs.map(doc => doc.id);
  const results: Array<{ id: string; status: string }> = [];
  for (const id of ids) {
    const retired = await db.runTransaction(async transaction => {
      const ref = db.collection(PAYMENT_NOTIFICATION_OUTBOX).doc(id);
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      if (!data || !['pending', 'processing'].includes(data.status)) return false;
      transaction.update(ref, {
        status: 'skipped',
        nextAttemptAt: FieldValue.delete(),
        leaseToken: null,
        lastError: FieldValue.delete(),
        lastOutcome: 'notifications_disabled',
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (retired) results.push({ id, status: 'skipped' });
  }
  return results;
}
