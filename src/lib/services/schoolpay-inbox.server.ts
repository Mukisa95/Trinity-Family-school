import 'server-only';

import { createHash } from 'crypto';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import type {
  SchoolPayPaymentPayload,
  SchoolPayWebhookPayload,
} from '@/lib/services/schoolpay-integration.service';
import type { SchoolPayInboxSource, SchoolPayInboxStatus } from '@/types/schoolpay-inbox';

const COLLECTION = 'schoolPayInboundTransactions';

export function getSchoolPayInboxId(receiptNumber: string): string {
  return createHash('sha256').update(receiptNumber.trim()).digest('hex');
}

function parseAmount(amount: string | number | undefined): number {
  if (typeof amount === 'number') return Number.isFinite(amount) ? amount : 0;
  const parsed = Number(`${amount || 0}`.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolvePaymentDate(payment: SchoolPayPaymentPayload): string {
  const raw = payment.transactionCompletionDateAndTime || payment.paymentDateAndTime || new Date().toISOString();
  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function cleanPayment(payment: SchoolPayPaymentPayload): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries({
      amount: parseAmount(payment.amount),
      paymentDateAndTime: payment.paymentDateAndTime,
      schoolpayReceiptNumber: payment.schoolpayReceiptNumber?.trim(),
      settlementBankCode: payment.settlementBankCode,
      sourceChannelTransDetail: payment.sourceChannelTransDetail,
      sourceChannelTransactionId: payment.sourceChannelTransactionId,
      sourcePaymentChannel: payment.sourcePaymentChannel,
      studentClass: payment.studentClass,
      studentName: payment.studentName,
      studentPaymentCode: payment.studentPaymentCode?.trim(),
      studentRegistrationNumber: payment.studentRegistrationNumber?.trim(),
      supplementaryFeeDescription: payment.supplementaryFeeDescription,
      supplementaryFeeId: payment.supplementaryFeeId,
      transactionCompletionDateAndTime: payment.transactionCompletionDateAndTime,
      transactionCompletionStatus: payment.transactionCompletionStatus,
    }).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string | number>;
}

export class SchoolPayInboxService {
  static async recordReceived(
    payload: Pick<SchoolPayWebhookPayload, 'type' | 'payment'>,
    source: SchoolPayInboxSource,
  ): Promise<string> {
    const receiptNumber = `${payload.payment.schoolpayReceiptNumber || ''}`.trim();
    if (!receiptNumber) throw new Error('schoolpayReceiptNumber is required');

    const db = getFirestore(getFirebaseAdminApp());
    const id = getSchoolPayInboxId(receiptNumber);
    const ref = db.collection(COLLECTION).doc(id);
    const existing = await ref.get();
    const now = Timestamp.now();
    const payment = cleanPayment(payload.payment);

    const base = {
      receiptNumber,
      paymentType: payload.type,
      source,
      amount: parseAmount(payload.payment.amount),
      paymentDate: resolvePaymentDate(payload.payment),
      studentName: payload.payment.studentName || '',
      studentPaymentCode: `${payload.payment.studentPaymentCode || ''}`.trim(),
      studentRegistrationNumber: `${payload.payment.studentRegistrationNumber || ''}`.trim(),
      studentClass: payload.payment.studentClass || '',
      sourcePaymentChannel: payload.payment.sourcePaymentChannel || '',
      sourceChannelTransactionId: payload.payment.sourceChannelTransactionId || '',
      supplementaryFeeId: payload.payment.supplementaryFeeId || '',
      supplementaryFeeDescription: payload.payment.supplementaryFeeDescription || '',
      rawPayment: payment,
      updatedAt: now,
      lastReceivedAt: now,
      deliveryCount: FieldValue.increment(1),
    };

    if (existing.exists && ['recorded', 'processing'].includes(existing.data()?.status)) {
      await ref.set(base, { merge: true });
      return id;
    }

    await ref.set({
      ...base,
      status: 'received' satisfies SchoolPayInboxStatus,
      reason: '',
      lastError: '',
      receivedAt: existing.data()?.receivedAt || now,
      attempts: existing.data()?.attempts || 0,
    }, { merge: true });

    return id;
  }

  static async markProcessing(id: string, source: SchoolPayInboxSource): Promise<boolean> {
    const db = getFirestore(getFirebaseAdminApp());
    const ref = db.collection(COLLECTION).doc(id);
    return db.runTransaction(async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new Error('SchoolPay inbox record was not found');

      const data = snap.data() || {};
      if (data.status === 'recorded' || data.status === 'ignored') return false;
      if (data.status === 'processing') {
        const lastAttempt = data.lastAttemptAt?.toMillis?.() || 0;
        // A crashed server may leave a stale claim. Permit recovery after five
        // minutes, but never let concurrent requests allocate the same receipt.
        if (Date.now() - lastAttempt < 5 * 60 * 1000) return false;
      }

      const now = Timestamp.now();
      transaction.set(ref, {
        status: 'processing' satisfies SchoolPayInboxStatus,
        source,
        attempts: FieldValue.increment(1),
        updatedAt: now,
        lastAttemptAt: now,
      }, { merge: true });
      return true;
    });
  }

  static async markResult(id: string, result: {
    success: boolean;
    duplicate?: boolean;
    skipped?: boolean;
    statusCode?: number;
    message: string;
    pupilId?: string;
    localPaymentIds?: string[];
  }): Promise<void> {
    let status: SchoolPayInboxStatus;
    if (result.success && result.skipped) status = 'ignored';
    else if (result.success || result.duplicate) status = 'recorded';
    else if (result.statusCode === 404 || /pupil not found/i.test(result.message)) status = 'unmatched';
    else status = 'failed';

    const now = Timestamp.now();
    await getFirestore(getFirebaseAdminApp()).collection(COLLECTION).doc(id).set({
      status,
      reason: status === 'unmatched'
        ? 'The payment code or registration number did not match one unique pupil in this system.'
        : status === 'failed'
          ? 'The payment was received but could not be recorded because processing failed.'
          : result.message,
      lastError: result.success ? '' : result.message,
      pupilId: result.pupilId || '',
      localPaymentIds: result.localPaymentIds || [],
      updatedAt: now,
      ...(status === 'recorded' ? { recordedAt: now } : {}),
    }, { merge: true });
  }

  static async markUnexpectedFailure(id: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown SchoolPay processing error';
    await this.markResult(id, { success: false, message, localPaymentIds: [] });
  }

  static async get(id: string): Promise<(Record<string, any> & { id: string }) | null> {
    const snap = await getFirestore(getFirebaseAdminApp()).collection(COLLECTION).doc(id).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  static async markAssigned(id: string, actor: { id?: string; name?: string; role?: string }): Promise<void> {
    const now = Timestamp.now();
    await getFirestore(getFirebaseAdminApp()).collection(COLLECTION).doc(id).set({
      assignedAt: now,
      assignedBy: actor,
      updatedAt: now,
    }, { merge: true });
  }
}
