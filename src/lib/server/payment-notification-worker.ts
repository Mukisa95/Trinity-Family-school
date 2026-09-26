import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp, getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { feesPaymentNotificationServerService, type PreparedPaymentNotification } from '@/lib/services/fees-payment-notification.server';
import { PAYMENT_NOTIFICATION_OUTBOX, paymentNotificationEventId } from './payment-notification-outbox';
import type { PaymentRecord, Pupil, FeeStructure } from '@/types';
import 'server-only';

const LEASE_MS = 5 * 60_000;
const RETRY_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const dateValue = (value: any): string => value?.toDate?.()?.toISOString() ?? value;

async function claimEvent(id: string, now: Date) {
  const db = getFirestore(getFirebaseAdminApp());
  const ref = db.collection(PAYMENT_NOTIFICATION_OUTBOX).doc(id);
  const token = randomUUID();
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    if (!data || !['pending', 'processing'].includes(data.status)) return null;
    const due = data.nextAttemptAt?.toDate?.() || data.leaseUntil?.toDate?.();
    if (due && due > now) return null;
    if (Number(data.attempts || 0) >= MAX_ATTEMPTS) {
      transaction.update(ref, { status: 'failed', nextAttemptAt: FieldValue.delete(), leaseToken: null });
      return null;
    }
    const attempts = Number(data.attempts || 0) + 1;
    transaction.update(ref, {
      status: 'processing', attempts, leaseToken: token,
      nextAttemptAt: Timestamp.fromMillis(now.getTime() + LEASE_MS),
      lastAttemptAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return { ref, token, attempts, data };
  });
}

// An expired worker cannot complete or reschedule a newer claim.
async function updateClaim(ref: DocumentReference, token: string, update: Record<string, unknown>) {
  const db = getFirestore(getFirebaseAdminApp());
  return db.runTransaction(async transaction => {
    const current = (await transaction.get(ref)).data();
    if (current?.leaseToken !== token || current.status !== 'processing') throw new Error('Notification lease was replaced.');
    transaction.update(ref, { ...update, updatedAt: FieldValue.serverTimestamp() });
  });
}

export async function processPendingPaymentNotificationEvents(limit = 25, paymentIds?: string[]) {
  const db = getFirestore(getFirebaseAdminApp());
  // Query due time before limiting: future retries cannot starve ready jobs.
  const ids = paymentIds
    ? [...new Set(paymentIds)].map(paymentNotificationEventId)
    : (await db.collection(PAYMENT_NOTIFICATION_OUTBOX)
      .where('nextAttemptAt', '<=', Timestamp.fromMillis(Date.now()))
      .orderBy('nextAttemptAt', 'asc').limit(Math.max(1, Math.min(limit, 100))).get()).docs.map(doc => doc.id);
  const results: Array<{ id: string; status: string }> = [];
  const resolveRecipients = feesPaymentNotificationServerService.createRecipientResolver();
  const reads = new Map<string, Promise<any>>();
  const readOnce = <T,>(key: string, read: () => Promise<T>): Promise<T> => {
    if (!reads.has(key)) reads.set(key, read());
    return reads.get(key)!;
  };
  for (const id of ids) {
    const claimed = await claimEvent(id, new Date());
    if (!claimed) continue;
    try {
      const paymentId = claimed.data.paymentId;
      if (typeof paymentId !== 'string' || paymentNotificationEventId(paymentId) !== id) throw new Error('Invalid payment event identity.');
      // Read saved financial values; never trust a supplied enqueue payload.
      const saved = await db.collection('payments').doc(paymentId).get();
      if (!saved.exists) throw new Error('Confirmed payment is unavailable.');
      const payment = { ...saved.data(), id: paymentId } as PaymentRecord;
      if (payment.reverted) {
        await updateClaim(claimed.ref, claimed.token, { status: 'skipped', nextAttemptAt: FieldValue.delete(), leaseToken: null, lastOutcome: 'payment_reverted' });
        results.push({ id, status: 'skipped' });
        continue;
      }
      payment.paymentDate = dateValue(payment.paymentDate);
      payment.createdAt = dateValue(payment.createdAt);
      let prepared = claimed.data.prepared as PreparedPaymentNotification | undefined;
      if (!prepared) {
        const scope = JSON.stringify([payment.pupilId, payment.feeStructureId, payment.academicYearId, payment.termId]);
        const [pupilDoc, feeDoc, ledger] = await Promise.all([
          readOnce(`pupil:${payment.pupilId}`, () => db.collection('pupils').doc(payment.pupilId).get()),
          readOnce(`fee:${payment.feeStructureId}`, () => db.collection('feeStructures').doc(payment.feeStructureId).get()),
          readOnce(scope, () => db.collection('payments').where('pupilId', '==', payment.pupilId)
            .where('feeStructureId', '==', payment.feeStructureId).where('academicYearId', '==', payment.academicYearId)
            .where('termId', '==', payment.termId).get()),
        ]);
        if (!pupilDoc.exists || !feeDoc.exists) throw new Error('Notification source record is unavailable.');
        const fee = { id: feeDoc.id, name: feeDoc.data()?.name ?? '', amount: feeDoc.data()?.amount } as FeeStructure;
        if (typeof fee.amount !== 'number' || !Number.isFinite(fee.amount)) throw new Error('Notification fee amount is invalid.');
        // Preserve the existing formula; freeze the first preparation on retry.
        const balance = fee.amount - ledger.docs.reduce((sum: number, entry: any) => sum + (entry.data().reverted ? 0 : Number(entry.data().amount || 0)), 0);
        prepared = {
          paymentId, paymentData: payment,
          pupilDetails: {
            id: pupilDoc.id,
            firstName: pupilDoc.data()?.firstName ?? '',
            lastName: pupilDoc.data()?.lastName ?? '',
            familyId: pupilDoc.data()?.familyId,
            parentAccountId: pupilDoc.data()?.parentAccountId ?? null,
            parentAccountActive: pupilDoc.data()?.parentAccountActive === true,
          } as Pupil,
          feeDetails: fee, balance,
        };
        await updateClaim(claimed.ref, claimed.token, { prepared, balanceBasis: 'first_preparation' });
      }
      const sent = await feesPaymentNotificationServerService.sendPaymentNotifications([prepared], {
        deliveredUserIds: claimed.data.deliveredUserIds || [],
        resolveRecipients,
        beforeRecipient: () => updateClaim(claimed.ref, claimed.token, { nextAttemptAt: Timestamp.fromMillis(Date.now() + LEASE_MS) }),
        onRecipientDelivered: userId => updateClaim(claimed.ref, claimed.token, { deliveredUserIds: FieldValue.arrayUnion(userId) }),
      });
      if (!sent) throw new Error('One or more push deliveries failed.');
      await updateClaim(claimed.ref, claimed.token, {
        status: 'completed', nextAttemptAt: FieldValue.delete(), leaseToken: null,
        completedAt: FieldValue.serverTimestamp(), lastError: FieldValue.delete(),
      });
      results.push({ id, status: 'completed' });
    } catch (error) {
      const failed = claimed.attempts >= MAX_ATTEMPTS;
      try {
        await updateClaim(claimed.ref, claimed.token, {
          status: failed ? 'failed' : 'pending', leaseToken: null,
          nextAttemptAt: failed ? FieldValue.delete() : Timestamp.fromMillis(Date.now() + RETRY_MS * 2 ** (claimed.attempts - 1)),
          lastError: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        });
        results.push({ id, status: failed ? 'failed' : 'retrying' });
      } catch {
        results.push({ id, status: 'lease_lost' });
      }
    }
  }
  return results;
}
