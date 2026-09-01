import { createHash, timingSafeEqual } from 'crypto';
import {
  getFirestore as getAdminFirestore,
  type DocumentData as AdminDocumentData,
  type QuerySnapshot as AdminQuerySnapshot,
} from 'firebase-admin/firestore';
import { db } from '../firebase';
import { AcademicYearsService } from './academic-years.service';
import { FeeStructuresService } from './fee-structures.service';
import { FeesHolidayService } from './fees-holiday.service';
import { PaymentsService } from './payments.service';
import type { FeeStructure, Pupil } from '@/types';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import {
  getFeesAccessUserIdsAdmin,
  getServerPushSubscriptionsForUsers,
  sendServerWebPush,
} from '@/lib/server/push-notifications';
import { getNotificationAutomationSettings } from '@/lib/server/notification-automation';
import {
  isNotificationAutomationEnabled,
  resolveAutomatedNotificationRecipientIds,
} from '@/lib/notifications/automation-settings';
import {
  assessExistingSchoolPayPayments,
  type ExistingLocalPaymentMatch,
} from '@/lib/utils/schoolpay-recovery';
import { hasValidFeeAssignment } from '@/lib/utils/fee-assignment-pipeline';
import { calculateFeeBalancesAfterDiscounts } from '@/lib/utils/fee-discount-calculation';

const SCHOOLPAY_GENERAL_FEE_ID = 'schoolpay-general';
const SCHOOLPAY_SYNC_LOGS = 'schoolPaySyncLogs';
const SCHOOLPAY_PAYMENT_MAPPINGS = 'schoolPayPaymentMappings';
const SCHOOLPAY_SUPPLEMENTARY_MAPPINGS = 'schoolPaySupplementaryFeeMappings';
const SCHOOLPAY_RECONCILIATION_STATE = 'schoolPayReconciliationState';
const DEFAULT_SCHOOLPAY_SYNC_BASE_URL = 'https://schoolpay.co.ug/paymentapi';

export type SchoolPayPaymentType = 'SCHOOL_FEES' | 'OTHER_FEES';

export interface SchoolPayPaymentPayload {
  amount: string | number;
  paymentDateAndTime?: string;
  schoolpayReceiptNumber: string;
  settlementBankCode?: string;
  sourceChannelTransDetail?: string;
  sourceChannelTransactionId?: string;
  sourcePaymentChannel?: string;
  studentClass?: string;
  studentName?: string;
  studentPaymentCode?: string;
  studentRegistrationNumber?: string;
  supplementaryFeeDescription?: string;
  supplementaryFeeId?: string;
  transactionCompletionDateAndTime?: string;
  transactionCompletionStatus?: string;
}

export interface SchoolPayWebhookPayload {
  signature: string;
  type: SchoolPayPaymentType;
  payment: SchoolPayPaymentPayload;
}

interface SchoolPaySyncResponse {
  returnCode: number;
  returnMessage?: string;
  transactions?: SchoolPayPaymentPayload[];
  supplementaryFeePayments?: SchoolPayPaymentPayload[];
}

interface AcademicSlot {
  year: any;
  term: any;
  allAcademicYears: any[];
}

interface ProcessingContext {
  source: 'webhook' | 'sync' | 'assignment';
  verifySignature: boolean;
}

export interface ProcessingResult {
  success: boolean;
  duplicate?: boolean;
  skipped?: boolean;
  statusCode?: number;
  message: string;
  paymentType: SchoolPayPaymentType;
  receiptNumber: string;
  pupilId?: string;
  localPaymentIds: string[];
}

export class SchoolPayIntegrationService {
  private static getConfig() {
    return {
      schoolCode: process.env.SCHOOLPAY_SCHOOL_CODE || '',
      apiPassword: process.env.SCHOOLPAY_API_PASSWORD || '',
      syncBaseUrl: process.env.SCHOOLPAY_SYNC_BASE_URL || DEFAULT_SCHOOLPAY_SYNC_BASE_URL,
      requireWebhookSignature: process.env.SCHOOLPAY_REQUIRE_WEBHOOK_SIGNATURE === 'true',
    };
  }

  static isConfigured(): boolean {
    const config = this.getConfig();
    return !!(config.schoolCode && config.apiPassword && config.syncBaseUrl);
  }

  static verifyWebhookSignature(signature: string, receiptNumber: string): boolean {
    const { apiPassword } = this.getConfig();
    if (!apiPassword || !signature || !receiptNumber) return false;

    const expected = createHash('sha256')
      .update(`${apiPassword}${receiptNumber}`)
      .digest('hex');

    const providedBuffer = Buffer.from(signature.trim().toLowerCase(), 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (providedBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(providedBuffer, expectedBuffer);
  }

  static async processWebhookPayload(payload: SchoolPayWebhookPayload): Promise<ProcessingResult> {
    const { requireWebhookSignature } = this.getConfig();

    return this.processPaymentPayload(payload.type, payload.payment, payload.signature, {
      source: 'webhook',
      verifySignature: requireWebhookSignature || !!payload.signature,
    });
  }

  static validateWebhookPayloadSignature(payload: SchoolPayWebhookPayload): {
    valid: boolean;
    required: boolean;
    message?: string;
  } {
    const { requireWebhookSignature } = this.getConfig();
    const receiptNumber = `${payload.payment?.schoolpayReceiptNumber || ''}`.trim();
    const shouldVerify = requireWebhookSignature || !!payload.signature;

    if (!shouldVerify) return { valid: true, required: false };
    if (!payload.signature) return { valid: false, required: true, message: 'Missing signature' };
    if (!this.verifyWebhookSignature(payload.signature, receiptNumber)) {
      return { valid: false, required: true, message: 'Invalid signature' };
    }
    return { valid: true, required: true };
  }

  static async processVerifiedWebhookPayload(payload: SchoolPayWebhookPayload): Promise<ProcessingResult> {
    return this.processPaymentPayload(payload.type, payload.payment, undefined, {
      source: 'webhook',
      verifySignature: false,
    });
  }

  static async processReconciliationPayload(
    paymentType: SchoolPayPaymentType,
    payment: SchoolPayPaymentPayload,
    source: 'sync' | 'assignment' = 'sync',
  ): Promise<ProcessingResult> {
    return this.processPaymentPayload(paymentType, payment, undefined, {
      source,
      verifySignature: false,
    });
  }

  static async syncTransactionsForDate(date: string, options?: { force?: boolean }): Promise<{
    success: boolean;
    date: string;
    processed: number;
    duplicates: number;
    skipped: number;
    failed: number;
    results: ProcessingResult[];
    returnCode?: number;
    returnMessage?: string;
  }> {
    const config = this.getConfig();
    if (!this.isConfigured()) {
      throw new Error('SchoolPay integration is not configured');
    }

    const hash = createHash('md5')
      .update(`${config.schoolCode}${date}${config.apiPassword}`)
      .digest('hex')
      .toUpperCase();

    const url = `${config.syncBaseUrl}/AndroidRS/SyncSchoolTransactions/${encodeURIComponent(
      config.schoolCode
    )}/${date}/${hash}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SchoolPay sync failed (${response.status}): ${text || response.statusText}`);
    }

    const data = (await response.json()) as SchoolPaySyncResponse;
    const schoolFees = (data.transactions || []).map((payment) => ({
      type: 'SCHOOL_FEES' as const,
      payment,
    }));
    const otherFees = (data.supplementaryFeePayments || []).map((payment) => ({
      type: 'OTHER_FEES' as const,
      payment,
    }));
    const allPayments = [...schoolFees, ...otherFees];

    // SchoolPay's date API returns the entire day every time. Remember a
    // content hash so the seven-day safety window normally costs one state
    // read per unchanged date instead of rereading and rewriting every receipt.
    const responseHash = createHash('sha256').update(JSON.stringify(
      allPayments
        .map(item => ({
          type: item.type,
          receipt: `${item.payment.schoolpayReceiptNumber || ''}`.trim(),
          transaction: `${item.payment.sourceChannelTransactionId || ''}`.trim(),
          amount: this.parseAmount(item.payment.amount),
          status: `${item.payment.transactionCompletionStatus || ''}`.trim(),
          code: `${item.payment.studentPaymentCode || ''}`.trim(),
        }))
        .sort((a, b) => `${a.type}:${a.receipt}`.localeCompare(`${b.type}:${b.receipt}`)),
    )).digest('hex');
    const stateRef = getAdminFirestore(getFirebaseAdminApp())
      .collection(SCHOOLPAY_RECONCILIATION_STATE)
      .doc(date);
    const previousState = await stateRef.get();
    if (!options?.force && previousState.exists && previousState.data()?.responseHash === responseHash) {
      return {
        success: true,
        date,
        processed: 0,
        duplicates: allPayments.length,
        skipped: 0,
        failed: 0,
        results: [],
        returnCode: data.returnCode,
        returnMessage: 'SchoolPay day is unchanged since its last completed reconciliation',
      };
    }

    const results: ProcessingResult[] = [];
    for (const item of allPayments) {
      const { SchoolPayInboxService } = await import('./schoolpay-inbox.server');
      const inboxId = await SchoolPayInboxService.recordReceived(item, 'sync');
      const claimed = await SchoolPayInboxService.markProcessing(inboxId, 'sync');
      if (!claimed) {
        const existing = await SchoolPayInboxService.get(inboxId);
        results.push({
          success: existing?.status === 'recorded',
          duplicate: existing?.status === 'recorded',
          skipped: existing?.status === 'processing',
          statusCode: 200,
          message: existing?.status === 'recorded'
            ? 'Payment already recorded'
            : 'Payment is already being processed',
          paymentType: item.type,
          receiptNumber: `${item.payment.schoolpayReceiptNumber || ''}`.trim(),
          pupilId: existing?.pupilId,
          localPaymentIds: existing?.localPaymentIds || [],
        });
        continue;
      }
      try {
        const result = await this.processReconciliationPayload(item.type, item.payment, 'sync');
        await SchoolPayInboxService.markResult(inboxId, result);
        results.push(result);
      } catch (error) {
        await SchoolPayInboxService.markUnexpectedFailure(inboxId, error);
        results.push({
          success: false,
          statusCode: 500,
          message: error instanceof Error ? error.message : 'Unknown SchoolPay processing error',
          paymentType: item.type,
          receiptNumber: `${item.payment.schoolpayReceiptNumber || ''}`.trim(),
          localPaymentIds: [],
        });
      }
    }

    const processed = results.filter((item) => item.success && !item.duplicate && !item.skipped).length;
    const duplicates = results.filter((item) => item.duplicate).length;
    const skipped = results.filter((item) => item.skipped).length;
    const failed = results.filter((item) => !item.success && !item.duplicate && !item.skipped).length;
    const retryableFailures = results.filter(item =>
      !item.success && item.statusCode !== 404 && item.statusCode !== 409
    ).length;

    await this.logSync({
      type: 'sync_batch',
      source: 'sync',
      status: failed > 0 ? 'partial' : 'success',
      date,
      processed,
      duplicates,
      skipped,
      failed,
      returnCode: data.returnCode,
      returnMessage: data.returnMessage,
      receiptNumbers: results.map((item) => item.receiptNumber),
      timestamp: new Date().toISOString(),
    });

    if (retryableFailures === 0) {
      await stateRef.set({
        date,
        responseHash,
        transactionCount: allPayments.length,
        processed,
        duplicates,
        skipped,
        failed,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    return {
      success: failed === 0,
      date,
      processed,
      duplicates,
      skipped,
      failed,
      results,
      returnCode: data.returnCode,
      returnMessage: data.returnMessage,
    };
  }

  static async getSyncLogs(limitCount: number = 100): Promise<any[]> {
    // Diagnostics are read through a protected server route. Use Admin here
    // because this service is also called by webhook/cron execution, whose
    // trusted server identity must not depend on staff-only browser rules.
    const snapshot = await getAdminFirestore(getFirebaseAdminApp())
      .collection(SCHOOLPAY_SYNC_LOGS)
      .orderBy('timestamp', 'desc')
      .limit(Math.max(1, Math.min(limitCount, 500)))
      .get();
    return snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));
  }

  static async logWebhookReceipt(data: Record<string, unknown>): Promise<void> {
    await this.logSync({
      type: 'webhook_receipt',
      source: 'webhook',
      status: 'received',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  private static async processPaymentPayload(
    paymentType: SchoolPayPaymentType,
    rawPayment: SchoolPayPaymentPayload,
    signature: string | undefined,
    context: ProcessingContext
  ): Promise<ProcessingResult> {
    const payment = this.normalizePayment(rawPayment);
    const receiptNumber = payment.schoolpayReceiptNumber;

    if (!receiptNumber) {
      return {
        success: false,
        statusCode: 422,
        message: 'schoolpayReceiptNumber is required',
        paymentType,
        receiptNumber: '',
        localPaymentIds: [],
      };
    }

    if (context.verifySignature) {
      if (!signature) {
        await this.logSync({
          type: 'payment',
          source: context.source,
          status: 'failed',
          paymentType,
          receiptNumber,
          errorMessage: 'Missing signature',
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          statusCode: 401,
          message: 'Missing signature',
          paymentType,
          receiptNumber,
          localPaymentIds: [],
        };
      }

      if (!this.verifyWebhookSignature(signature, receiptNumber)) {
        await this.logSync({
          type: 'payment',
          source: context.source,
          status: 'failed',
          paymentType,
          receiptNumber,
          errorMessage: 'Invalid signature',
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          statusCode: 401,
          message: 'Invalid signature',
          paymentType,
          receiptNumber,
          localPaymentIds: [],
        };
      }
    }

    const completionStatus = (payment.transactionCompletionStatus || '').toLowerCase();
    if (completionStatus && completionStatus !== 'completed') {
      await this.logSync({
        type: 'payment',
        source: context.source,
        status: 'skipped',
        paymentType,
        receiptNumber,
        transactionCompletionStatus: payment.transactionCompletionStatus,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        skipped: true,
        message: `Skipped payment with status ${payment.transactionCompletionStatus}`,
        paymentType,
        receiptNumber,
        localPaymentIds: [],
      };
    }

    const existing = await this.getPaymentMapping(receiptNumber);
    if (existing) {
      await this.logSync({
        type: 'payment',
        source: context.source,
        status: 'duplicate',
        paymentType,
        receiptNumber,
        pupilId: existing.pupilId,
        localPaymentIds: existing.localPaymentIds || [],
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        duplicate: true,
        message: 'Payment already recorded',
        paymentType,
        receiptNumber,
        pupilId: existing.pupilId,
        localPaymentIds: existing.localPaymentIds || [],
      };
    }

    try {
      const localMatch = await this.findExistingLocalPayment(payment);
      if (localMatch?.conflict) {
        await this.logSync({
          type: 'payment',
          source: context.source,
          status: 'failed',
          paymentType,
          receiptNumber,
          localPaymentIds: localMatch.localPaymentIds,
          errorMessage: localMatch.conflict,
          timestamp: new Date().toISOString(),
        });
        return {
          success: false,
          statusCode: 409,
          message: localMatch.conflict,
          paymentType,
          receiptNumber,
          pupilId: localMatch.pupilId,
          localPaymentIds: localMatch.localPaymentIds,
        };
      }

      if (localMatch?.pupilId) {
        await this.repairPaymentMapping(paymentType, payment, localMatch);
        await this.logSync({
          type: 'payment',
          source: context.source,
          status: 'duplicate_repaired',
          paymentType,
          receiptNumber,
          pupilId: localMatch.pupilId,
          localPaymentIds: localMatch.localPaymentIds,
          timestamp: new Date().toISOString(),
        });
        return {
          success: true,
          duplicate: true,
          message: 'Existing local payment found; SchoolPay mapping repaired without adding another payment',
          paymentType,
          receiptNumber,
          pupilId: localMatch.pupilId,
          localPaymentIds: localMatch.localPaymentIds,
        };
      }

      const pupil = await this.findPupil(payment.studentPaymentCode, payment.studentRegistrationNumber);
      if (!pupil) {
        await this.logSync({
          type: 'payment',
          source: context.source,
          status: 'failed',
          paymentType,
          receiptNumber,
          paymentCode: payment.studentPaymentCode,
          registrationNumber: payment.studentRegistrationNumber,
          errorMessage: 'Pupil not found',
          timestamp: new Date().toISOString(),
        });

        // An unresolved payment is still a real, completed SchoolPay receipt.
        // Alert the same finance users immediately so the missing or unknown
        // payment code can be assigned from the SchoolPay feed. This path used
        // to return before the only push call below.
        try {
          await this.sendSchoolPayPushNotification({
            receiptNumber,
            pupilName: payment.studentName,
            amount: this.parseAmount(payment.amount),
            breakdown: [],
            paymentCode: payment.studentPaymentCode,
            mappingRequired: true,
            source: context.source,
          });
        } catch (err) {
          console.warn('[SchoolPay Push] Non-fatal unmatched-payment push error:', err);
        }

        return {
          success: false,
          statusCode: 404,
          message: 'Pupil not found for SchoolPay payment',
          paymentType,
          receiptNumber,
          localPaymentIds: [],
        };
      }

      const paymentDate = this.resolvePaymentDate(payment);
      const slot = await this.resolveAcademicSlot(paymentDate);
      const existingPayments = await PaymentsService.getPaymentsByPupil(pupil.id);

      const recordingResult =
        paymentType === 'OTHER_FEES'
          ? await this.recordSupplementaryFeePayment(payment, pupil, slot)
          : await this.recordSchoolFeesPayment(payment, pupil, slot, existingPayments);

      await this.storePaymentMapping({
        receiptNumber,
        paymentType,
        pupilId: pupil.id,
        studentPaymentCode: payment.studentPaymentCode || '',
        studentRegistrationNumber: payment.studentRegistrationNumber || '',
        localPaymentIds: recordingResult.localPaymentIds,
        amount: this.parseAmount(payment.amount),
        paymentDate,
        sourceChannelTransactionId: payment.sourceChannelTransactionId || '',
        sourcePaymentChannel: payment.sourcePaymentChannel || '',
        source: context.source,
      });

      await this.logSync({
        type: 'payment',
        source: context.source,
        status: 'success',
        paymentType,
        receiptNumber,
        pupilId: pupil.id,
        localPaymentIds: recordingResult.localPaymentIds,
        distributionBreakdown: recordingResult.distributionBreakdown,
        sourceChannelTransactionId: payment.sourceChannelTransactionId || '',
        timestamp: new Date().toISOString(),
      });

      // Vercel may stop background work as soon as the webhook returns. Await
      // delivery, but keep notification failure non-fatal to the payment.
      try {
        await this.sendSchoolPayPushNotification({
          receiptNumber,
          pupilName: payment.studentName || `${pupil.firstName} ${pupil.lastName}`,
          amount: this.parseAmount(payment.amount),
          breakdown: recordingResult.distributionBreakdown,
          source: context.source,
        });
      } catch (err) {
        console.warn('[SchoolPay Push] Non-fatal push error:', err);
      }

      return {
        success: true,
        message: 'Payment recorded successfully',
        paymentType,
        receiptNumber,
        pupilId: pupil.id,
        localPaymentIds: recordingResult.localPaymentIds,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      await this.logSync({
        type: 'payment',
        source: context.source,
        status: 'failed',
        paymentType,
        receiptNumber,
        sourceChannelTransactionId: payment.sourceChannelTransactionId || '',
        errorMessage: message,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        statusCode: 500,
        message,
        paymentType,
        receiptNumber,
        localPaymentIds: [],
      };
    }
  }

  /**
   * Send a single consolidated browser push notification to all fees staff
   * every time a new SchoolPay receipt is recorded.
   *
   * Design choices:
   *  - Only fires for source === 'webhook' (real-time). Sync/backfill payments are silent.
   *  - Uses the receipt number as the notification `tag` so the OS collapses duplicates
   *    if SchoolPay retries the same webhook.
   *  - Awaited at the call site so serverless execution cannot stop it early.
   *  - Uses the shared Admin-SDK sender without an internal HTTP round-trip.
   */
  private static async sendSchoolPayPushNotification(opts: {
    receiptNumber: string;
    pupilName: string;
    amount: number;
    breakdown: Array<{ feeName: string; feeStructureId: string; amount: number }>;
    paymentCode?: string;
    mappingRequired?: boolean;
    source: 'webhook' | 'sync' | 'assignment';
  }): Promise<void> {
    // Only send real-time push for webhook payments, not historical sync backfill
    if (opts.source !== 'webhook') return;

    const automationSettings = await getNotificationAutomationSettings();
    if (!isNotificationAutomationEnabled(automationSettings, 'schoolPay')) return;

    const eligibleUserIds = await getFeesAccessUserIdsAdmin();
    const userIds = resolveAutomatedNotificationRecipientIds(
      automationSettings,
      'schoolPay',
      eligibleUserIds,
    );

    // Resolve recipients
    if (userIds.length === 0) return;

    const subscriptions = await getServerPushSubscriptionsForUsers(userIds);
    if (subscriptions.length === 0) return;

    // Build a human-readable breakdown line, e.g. "Tuition, Meals, Carry Forward"
    const formattedAmount = new Intl.NumberFormat('en-UG').format(opts.amount);
    const seenNames = new Set<string>();
    const categories = opts.breakdown
      .map((b) =>
        b.feeName
          .replace(/ \(SchoolPay\)$/i, '')
          .replace(/ \[.*?\]$/, '') // strip [Term Year] carry-forward suffix
          .trim()
      )
      .filter((name) => {
        if (seenNames.has(name)) return false;
        seenNames.add(name);
        return true;
      })
      .join(', ');

    const body = opts.mappingRequired
      ? `UGX ${formattedAmount} was received${opts.pupilName ? ` for ${opts.pupilName}` : ''}. Payment code ${opts.paymentCode || 'was not supplied'} does not match a pupil. Open SchoolPay Feed to assign it.`
      : `UGX ${formattedAmount} for ${opts.pupilName}${
        categories ? `. Allocated to: ${categories}` : ''
      }.`;

    const payload = {
      title: opts.mappingRequired
        ? '\u26A0\uFE0F SchoolPay Payment Needs Mapping'
        : '\uD83D\uDCB3 SchoolPay Payment Received',
      body,
      icon: '/trinity-logo-192.png',
      badge: '/icons/trinity-badge-72.png',
      url: '/accounts/schoolpay-feed',
      // Receipt number as tag: OS collapses duplicate alerts on SchoolPay retries
      tag: `schoolpay-receipt-${opts.receiptNumber}`,
      requireInteraction: true,
      timestamp: Date.now(),
    };

    const result = await sendServerWebPush(subscriptions, payload, { urgency: 'high' });
    console.log(
      `[SchoolPay Push] ✅ ${result.accepted}/${subscriptions.length} push(es) accepted for receipt ${
        opts.receiptNumber
      }`
    );
  }

  private static normalizePayment(payment: SchoolPayPaymentPayload): SchoolPayPaymentPayload {
    return {
      ...payment,
      schoolpayReceiptNumber: `${payment.schoolpayReceiptNumber || ''}`.trim(),
      studentPaymentCode: `${payment.studentPaymentCode || ''}`.trim(),
      studentRegistrationNumber: `${payment.studentRegistrationNumber || ''}`.trim(),
      supplementaryFeeId: `${payment.supplementaryFeeId || ''}`.trim(),
      supplementaryFeeDescription: `${payment.supplementaryFeeDescription || ''}`.trim(),
      transactionCompletionStatus: `${payment.transactionCompletionStatus || ''}`.trim(),
      sourceChannelTransactionId: `${payment.sourceChannelTransactionId || ''}`.trim(),
      sourcePaymentChannel: `${payment.sourcePaymentChannel || ''}`.trim(),
      studentName: `${payment.studentName || ''}`.trim(),
      sourceChannelTransDetail: `${payment.sourceChannelTransDetail || ''}`.trim(),
    };
  }

  private static parseAmount(amount: string | number | undefined): number {
    if (typeof amount === 'number') return amount;
    const parsed = Number(`${amount || 0}`.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private static resolvePaymentDate(payment: SchoolPayPaymentPayload): string {
    const rawValue =
      payment.transactionCompletionDateAndTime ||
      payment.paymentDateAndTime ||
      new Date().toISOString();

    const normalized = rawValue.includes(' ') ? rawValue.replace(' ', 'T') : rawValue;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  private static async findPupil(
    studentPaymentCode?: string,
    studentRegistrationNumber?: string
  ): Promise<Pupil | null> {
    // Financial matching must always use authoritative server reads. The
    // browser-oriented PupilsService is cache-first and can return a stale
    // Vercel instance snapshot, which previously produced false unmatched
    // payments for codes that already existed in Firestore.
    const db = getAdminFirestore(getFirebaseAdminApp());
    const pupils = db.collection('pupils');
    const matches = new Map<string, Pupil>();
    const addMatches = (snapshots: AdminQuerySnapshot<AdminDocumentData>[]) => {
      for (const snapshot of snapshots) {
        for (const item of snapshot.docs) {
          matches.set(item.id, { id: item.id, ...item.data() } as Pupil);
        }
      }
    };

    const paymentCode = `${studentPaymentCode || ''}`.trim();
    if (paymentCode) {
      const codeValues: Array<string | number> = [paymentCode];
      if (/^\d+$/.test(paymentCode)) codeValues.push(Number(paymentCode));
      const directFields = ['payCode', 'schoolPayCode', 'schoolPayPaymentCode', 'paymentCode'];
      const queries = directFields.flatMap((field) =>
        codeValues.map((value) => pupils.where(field, '==', value).limit(2).get())
      );
      queries.push(
        pupils.where('additionalIdentifiers', 'array-contains', {
          idType: 'SchoolPay Payment Code',
          idValue: paymentCode,
        }).limit(2).get(),
      );
      addMatches(await Promise.all(queries));
      if (matches.size === 1) return Array.from(matches.values())[0];
      if (matches.size > 1) return null;
    }

    const registrationNumber = `${studentRegistrationNumber || ''}`.trim();
    if (!registrationNumber) return null;
    const registrationSnapshots = await Promise.all([
      pupils.where('admissionNumber', '==', registrationNumber).limit(2).get(),
      pupils.where('learnerIdentificationNumber', '==', registrationNumber).limit(2).get(),
    ]);
    addMatches(registrationSnapshots);
    return matches.size === 1 ? Array.from(matches.values())[0] : null;
  }

  private static async findExistingLocalPayment(
    payment: SchoolPayPaymentPayload,
  ): Promise<ExistingLocalPaymentMatch | null> {
    const receiptNumber = `${payment.schoolpayReceiptNumber || ''}`.trim();
    const transactionId = `${payment.sourceChannelTransactionId || ''}`.trim();
    const db = getAdminFirestore(getFirebaseAdminApp());
    const payments = db.collection('payments');
    const lookups: Promise<AdminQuerySnapshot<AdminDocumentData>>[] = [];

    if (receiptNumber) {
      lookups.push(payments.where('schoolPayReceiptNumber', '==', receiptNumber).get());
    }
    if (transactionId) {
      lookups.push(payments.where('schoolPayTransactionId', '==', transactionId).get());
    }
    if (lookups.length === 0) return null;

    const byId = new Map<string, AdminDocumentData>();
    (await Promise.all(lookups)).forEach(snapshot => {
      snapshot.docs.forEach(item => byId.set(item.id, item.data()));
    });
    if (byId.size === 0) return null;

    return assessExistingSchoolPayPayments(
      receiptNumber,
      this.parseAmount(payment.amount),
      Array.from(byId.entries()).map(([id, item]) => ({
        id,
        pupilId: item.pupilId,
        amount: this.parseAmount(item.amount),
      })),
    );
  }

  private static async repairPaymentMapping(
    paymentType: SchoolPayPaymentType,
    payment: SchoolPayPaymentPayload,
    match: ExistingLocalPaymentMatch,
  ): Promise<void> {
    if (!match.pupilId) throw new Error('Cannot repair a SchoolPay mapping without one pupil');
    const receiptNumber = `${payment.schoolpayReceiptNumber || ''}`.trim();
    const now = new Date().toISOString();
    await getAdminFirestore(getFirebaseAdminApp())
      .collection(SCHOOLPAY_PAYMENT_MAPPINGS)
      .doc(receiptNumber)
      .set({
        schoolpayReceiptNumber: receiptNumber,
        paymentType,
        pupilId: match.pupilId,
        studentPaymentCode: `${payment.studentPaymentCode || ''}`.trim(),
        studentRegistrationNumber: `${payment.studentRegistrationNumber || ''}`.trim(),
        localPaymentIds: match.localPaymentIds,
        amount: this.parseAmount(payment.amount),
        paymentDate: this.resolvePaymentDate(payment),
        sourceChannelTransactionId: `${payment.sourceChannelTransactionId || ''}`.trim(),
        sourcePaymentChannel: `${payment.sourcePaymentChannel || ''}`.trim(),
        source: 'recovered_existing',
        recoveredAt: now,
        syncedAt: now,
        createdAt: now,
      }, { merge: true });
  }

  private static async resolveAcademicSlot(paymentDate: string): Promise<AcademicSlot> {
    const allAcademicYears = await AcademicYearsService.getAllAcademicYears();
    const target = new Date(paymentDate);

    let activeYear: any | undefined;
    let term: any | undefined;

    outer: for (const year of allAcademicYears) {
      for (const yearTerm of year.terms || []) {
        const start = new Date(yearTerm.startDate);
        const end = new Date(yearTerm.endDate);
        if (target >= start && target <= end) {
          activeYear = year;
          term = yearTerm;
          break outer;
        }
      }
    }

    if (!term) {
      let best: { year: any; term: any; start: number } | null = null;
      for (const year of allAcademicYears) {
        for (const yearTerm of year.terms || []) {
          const start = new Date(yearTerm.startDate).getTime();
          if (start <= target.getTime() && (!best || start > best.start)) {
            best = { year, term: yearTerm, start };
          }
        }
      }

      if (best) {
        activeYear = best.year;
        term = best.term;
      }
    }

    if (!activeYear || !term) {
      throw new Error(`Could not determine academic term for payment date ${paymentDate}`);
    }

    return { year: activeYear, term, allAcademicYears };
  }

  private static extractTermOrder(name?: string): number | null {
    if (!name) return null;
    const numericMatch = name.match(/(\d+)/);
    if (numericMatch) return parseInt(numericMatch[1], 10);

    const normalized = name.trim().toLowerCase();
    if (normalized.includes('first')) return 1;
    if (normalized.includes('second')) return 2;
    if (normalized.includes('third')) return 3;
    if (normalized.includes('fourth')) return 4;
    return null;
  }

  private static lookupTerm(allAcademicYears: any[], termId: string): any | null {
    for (const year of allAcademicYears) {
      const term = (year.terms || []).find((item: any) => item.id === termId);
      if (term) return term;
    }
    return null;
  }

  private static async getApplicableFeeStructures(
    pupil: Pupil,
    slot: AcademicSlot,
    allFeeStructures?: FeeStructure[],
  ): Promise<FeeStructure[]> {
    const currentTermOrder = this.extractTermOrder(slot.term.name);
    const allFees = allFeeStructures || await FeeStructuresService.getAllFeeStructures();

    return allFees.filter((fee: any) => {
      if (fee.status === 'inactive') return false;
      if (fee.category === 'Discount' || (typeof fee.amount === 'number' && fee.amount < 0)) return false;

      if (fee.isAssignmentFee) {
        const assigned = hasValidFeeAssignment(
          pupil.assignedFees,
          fee.id,
          slot.year.id,
          slot.term.id,
          slot.allAcademicYears,
        );
        if (!assigned) return false;
      }

      if (fee.academicYearId) {
        const feeYear = slot.allAcademicYears.find((year: any) => year.id === fee.academicYearId);
        if (feeYear) {
          const feeStart = new Date(feeYear.startDate);
          const activeStart = new Date(slot.year.startDate);
          if (activeStart < feeStart) return false;
        } else if (fee.academicYearId !== slot.year.id) {
          return false;
        }
      }

      if (fee.termId) {
        const exactMatch = fee.termId === slot.term.id;
        if (!exactMatch) {
          const feeTerm = this.lookupTerm(slot.allAcademicYears, fee.termId);
          const feeTermOrder = feeTerm ? this.extractTermOrder(feeTerm.name) : null;
          const equivalentMatch =
            feeTermOrder !== null &&
            currentTermOrder !== null &&
            feeTermOrder === currentTermOrder;
          if (!equivalentMatch) return false;
        }
      }

      const classFeeType = fee.classFeeType || 'all';
      if (classFeeType === 'specific') {
        const classIds: string[] = Array.isArray(fee.classIds)
          ? fee.classIds
          : fee.classId
            ? [fee.classId]
            : [];
        if (!classIds.includes(pupil.classId)) return false;
      }

      const sectionFeeType = fee.sectionFeeType || 'all';
      if (sectionFeeType === 'specific' && fee.section && fee.section !== pupil.section) return false;

      return true;
    });
  }

  private static buildPaymentNotes(
    payment: SchoolPayPaymentPayload,
    label: string,
    extraParts: string[] = []
  ): string {
    const parts = [
      label,
      `Receipt: ${payment.schoolpayReceiptNumber}`,
      payment.sourceChannelTransactionId ? `Source Txn: ${payment.sourceChannelTransactionId}` : '',
      payment.sourcePaymentChannel ? `Channel: ${payment.sourcePaymentChannel}` : '',
      payment.sourceChannelTransDetail ? `Detail: ${payment.sourceChannelTransDetail}` : '',
      payment.studentPaymentCode ? `Payment Code: ${payment.studentPaymentCode}` : '',
      payment.studentRegistrationNumber ? `Registration No: ${payment.studentRegistrationNumber}` : '',
      payment.studentName ? `Student: ${payment.studentName}` : '',
      ...extraParts,
    ].filter(Boolean);

    return parts.join(' | ');
  }

  private static async recordSchoolFeesPayment(
    payment: SchoolPayPaymentPayload,
    pupil: Pupil,
    slot: AcademicSlot,
    existingPayments: any[]
  ): Promise<{
    localPaymentIds: string[];
    distributionBreakdown: Array<{ feeName: string; feeStructureId: string; amount: number }>;
  }> {
    const allFeeStructures = await FeeStructuresService.getAllFeeStructures();
    const feeStructures = await this.getApplicableFeeStructures(pupil, slot, allFeeStructures);
    const feesHolidays = await FeesHolidayService.getActiveFeesHolidaysByPupil(pupil.id);
    const createdPaymentIds: string[] = [];
    const distributionBreakdown: Array<{ feeName: string; feeStructureId: string; amount: number }> = [];
    let remainingAmount = this.parseAmount(payment.amount);

    const createGenericRecord = async (
      amount: number,
      academicYearId: string,
      termId: string,
      description: string
    ) => {
      const paymentId = await PaymentsService.createPayment({
        pupilId: pupil.id,
        feeStructureId: SCHOOLPAY_GENERAL_FEE_ID,
        academicYearId,
        termId,
        amount,
        paymentDate: this.resolvePaymentDate(payment),
        paidBy: {
          id: 'schoolpay-system',
          name: payment.studentName || pupil.firstName + ' ' + pupil.lastName,
          role: 'Parent/Guardian',
        },
        notes: this.buildPaymentNotes(payment, description),
        paymentMethod: payment.sourcePaymentChannel || 'SchoolPay',
        schoolPayReceiptNumber: payment.schoolpayReceiptNumber,
        schoolPayTransactionId: payment.sourceChannelTransactionId,
        schoolPayPaymentCode: payment.studentPaymentCode,
        source: 'schoolpay',
      } as any);

      createdPaymentIds.push(paymentId);
      distributionBreakdown.push({
        feeName: description,
        feeStructureId: SCHOOLPAY_GENERAL_FEE_ID,
        amount,
      });
    };

    if (feeStructures.length === 0) {
      await createGenericRecord(remainingAmount, slot.year.id, slot.term.id, 'SchoolPay unmatched school fees');
      return { localPaymentIds: createdPaymentIds, distributionBreakdown };
    }

    const feesWithBalance = calculateFeeBalancesAfterDiscounts({
      feeStructures,
      allFeeStructures,
      assignedFees: pupil.assignedFees,
      payments: existingPayments,
      academicYearId: slot.year.id,
      termId: slot.term.id,
      allAcademicYears: slot.allAcademicYears,
      feesHolidays,
    })
      .filter((fee: any) => fee.balance > 0)
      .sort((a: any, b: any) => b.balance - a.balance);

    if (feesWithBalance.length === 0) {
      await createGenericRecord(remainingAmount, slot.year.id, slot.term.id, 'SchoolPay advance / overpayment');
      return { localPaymentIds: createdPaymentIds, distributionBreakdown };
    }

    for (const fee of feesWithBalance) {
      if (remainingAmount <= 0) break;

      const allocatedAmount = Math.min(remainingAmount, fee.balance);
      const paymentId = await PaymentsService.createPayment({
        pupilId: pupil.id,
        feeStructureId: fee.id,
        academicYearId: slot.year.id,
        termId: slot.term.id,
        amount: allocatedAmount,
        paymentDate: this.resolvePaymentDate(payment),
        paidBy: {
          id: 'schoolpay-system',
          name: payment.studentName || pupil.firstName + ' ' + pupil.lastName,
          role: 'Parent/Guardian',
        },
        notes: this.buildPaymentNotes(payment, `${fee.name} (SchoolPay)`),
        paymentMethod: payment.sourcePaymentChannel || 'SchoolPay',
        schoolPayReceiptNumber: payment.schoolpayReceiptNumber,
        schoolPayTransactionId: payment.sourceChannelTransactionId,
        schoolPayPaymentCode: payment.studentPaymentCode,
        source: 'schoolpay',
      } as any);

      createdPaymentIds.push(paymentId);
      distributionBreakdown.push({
        feeName: fee.name,
        feeStructureId: fee.id,
        amount: allocatedAmount,
      });
      remainingAmount -= allocatedAmount;
    }

    if (remainingAmount > 0) {
      const allTermSlots: Array<{
        yearId: string;
        yearName: string;
        yearStart: Date;
        termId: string;
        termName: string;
        termStart: Date;
        termOrder: number;
      }> = [];

      for (const year of slot.allAcademicYears) {
        for (const term of year.terms || []) {
          allTermSlots.push({
            yearId: year.id,
            yearName: year.name,
            yearStart: new Date(year.startDate),
            termId: term.id,
            termName: term.name,
            termStart: new Date(term.startDate),
            termOrder: this.extractTermOrder(term.name) || 0,
          });
        }
      }

      allTermSlots.sort((a, b) => a.termStart.getTime() - b.termStart.getTime());
      const currentIndex = allTermSlots.findIndex((termSlot) => termSlot.termId === slot.term.id);
      const allFees = allFeeStructures;

      for (let index = currentIndex + 1; index < allTermSlots.length && remainingAmount > 0; index += 1) {
        const futureSlot = allTermSlots[index];

        const futureFees = allFees.filter((fee: any) => {
          if (fee.status === 'inactive') return false;
          if (fee.category === 'Discount' || (fee.amount ?? 0) < 0) return false;

          if (fee.isAssignmentFee) {
            const assigned = hasValidFeeAssignment(
              pupil.assignedFees,
              fee.id,
              futureSlot.yearId,
              futureSlot.termId,
              slot.allAcademicYears,
            );
            if (!assigned) return false;
          }

          if (fee.academicYearId) {
            const feeYear = slot.allAcademicYears.find((year: any) => year.id === fee.academicYearId);
            if (feeYear) {
              if (futureSlot.yearStart < new Date(feeYear.startDate)) return false;
            } else if (fee.academicYearId !== futureSlot.yearId) {
              return false;
            }
          }

          if (fee.termId) {
            const termDetails = this.lookupTerm(slot.allAcademicYears, fee.termId);
            const feeOrder = termDetails ? this.extractTermOrder(termDetails.name) : null;
            if (feeOrder !== futureSlot.termOrder) return false;
          }

          const classFeeType = fee.classFeeType || 'all';
          if (classFeeType === 'specific') {
            const classIds: string[] = Array.isArray(fee.classIds)
              ? fee.classIds
              : fee.classId
                ? [fee.classId]
                : [];
            if (!classIds.includes(pupil.classId)) return false;
          }

          if (fee.sectionFeeType === 'specific' && fee.section && fee.section !== pupil.section) return false;

          return true;
        });

        const futureFeesWithBalance = calculateFeeBalancesAfterDiscounts({
          feeStructures: futureFees,
          allFeeStructures,
          assignedFees: pupil.assignedFees,
          payments: existingPayments,
          academicYearId: futureSlot.yearId,
          termId: futureSlot.termId,
          allAcademicYears: slot.allAcademicYears,
          feesHolidays,
        })
          .filter((fee: any) => fee.balance > 0)
          .sort((a: any, b: any) => b.balance - a.balance);

        for (const fee of futureFeesWithBalance) {
          if (remainingAmount <= 0) break;

          const allocatedAmount = Math.min(remainingAmount, fee.balance);
          const paymentId = await PaymentsService.createPayment({
            pupilId: pupil.id,
            feeStructureId: fee.id,
            academicYearId: futureSlot.yearId,
            termId: futureSlot.termId,
            amount: allocatedAmount,
            paymentDate: this.resolvePaymentDate(payment),
            paidBy: {
              id: 'schoolpay-system',
              name: payment.studentName || pupil.firstName + ' ' + pupil.lastName,
              role: 'Parent/Guardian',
            },
            notes: this.buildPaymentNotes(
              payment,
              `${fee.name} (SchoolPay carried forward to ${futureSlot.termName} ${futureSlot.yearName})`
            ),
            paymentMethod: payment.sourcePaymentChannel || 'SchoolPay',
            schoolPayReceiptNumber: payment.schoolpayReceiptNumber,
            schoolPayTransactionId: payment.sourceChannelTransactionId,
            schoolPayPaymentCode: payment.studentPaymentCode,
            source: 'schoolpay',
          } as any);

          createdPaymentIds.push(paymentId);
          distributionBreakdown.push({
            feeName: `${fee.name} [${futureSlot.termName} ${futureSlot.yearName}]`,
            feeStructureId: fee.id,
            amount: allocatedAmount,
          });
          remainingAmount -= allocatedAmount;
        }
      }

      if (remainingAmount > 0) {
        await createGenericRecord(remainingAmount, slot.year.id, slot.term.id, 'SchoolPay excess / unmatched balance');
      }
    }

    return { localPaymentIds: createdPaymentIds, distributionBreakdown };
  }

  private static async recordSupplementaryFeePayment(
    payment: SchoolPayPaymentPayload,
    pupil: Pupil,
    slot: AcademicSlot
  ): Promise<{
    localPaymentIds: string[];
    distributionBreakdown: Array<{ feeName: string; feeStructureId: string; amount: number }>;
  }> {
    const mappedFeeStructureId = await this.getSupplementaryFeeStructureId(payment.supplementaryFeeId);
    const amount = this.parseAmount(payment.amount);
    const createdPaymentIds: string[] = [];
    const distributionBreakdown: Array<{ feeName: string; feeStructureId: string; amount: number }> = [];

    let feeStructureId = SCHOOLPAY_GENERAL_FEE_ID;
    let academicYearId = slot.year.id;
    let termId = slot.term.id;
    let description = payment.supplementaryFeeDescription || 'SchoolPay supplementary fee';
    let needsManualMapping = false;

    if (mappedFeeStructureId) {
      feeStructureId = mappedFeeStructureId;
      const feeStructure = await FeeStructuresService.getFeeStructureById(mappedFeeStructureId);
      if (feeStructure?.academicYearId) academicYearId = feeStructure.academicYearId;
      if (feeStructure?.termId) termId = feeStructure.termId;
      description = feeStructure?.name || description;
    } else {
      needsManualMapping = true;
      description = `SchoolPay unmatched supplementary fee${payment.supplementaryFeeDescription ? `: ${payment.supplementaryFeeDescription}` : ''}`;
    }

    const paymentId = await PaymentsService.createPayment({
      pupilId: pupil.id,
      feeStructureId,
      academicYearId,
      termId,
      amount,
      paymentDate: this.resolvePaymentDate(payment),
      paidBy: {
        id: 'schoolpay-system',
        name: payment.studentName || pupil.firstName + ' ' + pupil.lastName,
        role: 'Parent/Guardian',
      },
      notes: this.buildPaymentNotes(payment, description, [
        payment.supplementaryFeeId ? `Supplementary Fee ID: ${payment.supplementaryFeeId}` : '',
        payment.supplementaryFeeDescription
          ? `Supplementary Fee: ${payment.supplementaryFeeDescription}`
          : '',
      ]),
      paymentMethod: payment.sourcePaymentChannel || 'SchoolPay',
      schoolPayReceiptNumber: payment.schoolpayReceiptNumber,
      schoolPayTransactionId: payment.sourceChannelTransactionId,
      schoolPayPaymentCode: payment.studentPaymentCode,
      schoolPaySupplementaryFeeId: payment.supplementaryFeeId,
      schoolPayNeedsManualMapping: needsManualMapping,
      source: 'schoolpay',
    } as any);

    createdPaymentIds.push(paymentId);
    distributionBreakdown.push({
      feeName: description,
      feeStructureId,
      amount,
    });

    return { localPaymentIds: createdPaymentIds, distributionBreakdown };
  }

  private static async getSupplementaryFeeStructureId(supplementaryFeeId?: string): Promise<string | null> {
    const normalizedId = `${supplementaryFeeId || ''}`.trim();
    if (!normalizedId) return null;

    const mappings = getAdminFirestore(getFirebaseAdminApp())
      .collection(SCHOOLPAY_SUPPLEMENTARY_MAPPINGS);
    const directDoc = await mappings.doc(normalizedId).get();
    if (directDoc.exists) {
      const data = directDoc.data();
      return (data.feeStructureId as string) || null;
    }

    const snapshot = await mappings
      .where('supplementaryFeeId', '==', normalizedId)
      .limit(1)
      .get();
    if (snapshot.empty) return null;

    return (snapshot.docs[0].data().feeStructureId as string) || null;
  }

  private static async getPaymentMapping(receiptNumber: string): Promise<any | null> {
    // The webhook runs as a trusted server process, not as an Admin/Staff
    // browser user. These records are intentionally staff-only in Firestore
    // rules, so use Admin SDK for duplicate protection before allocation.
    const mappingDoc = await getAdminFirestore(getFirebaseAdminApp())
      .collection(SCHOOLPAY_PAYMENT_MAPPINGS)
      .doc(receiptNumber)
      .get();
    return mappingDoc.exists ? mappingDoc.data() : null;
  }

  private static async storePaymentMapping(mapping: {
    receiptNumber: string;
    paymentType: SchoolPayPaymentType;
    pupilId: string;
    studentPaymentCode: string;
    studentRegistrationNumber: string;
    localPaymentIds: string[];
    amount: number;
    paymentDate: string;
    sourceChannelTransactionId: string;
    sourcePaymentChannel: string;
    source: 'webhook' | 'sync' | 'assignment';
  }): Promise<void> {
    await getAdminFirestore(getFirebaseAdminApp())
      .collection(SCHOOLPAY_PAYMENT_MAPPINGS)
      .doc(mapping.receiptNumber)
      .set({
        schoolpayReceiptNumber: mapping.receiptNumber,
        paymentType: mapping.paymentType,
        pupilId: mapping.pupilId,
        studentPaymentCode: mapping.studentPaymentCode,
        studentRegistrationNumber: mapping.studentRegistrationNumber,
        localPaymentIds: mapping.localPaymentIds,
        amount: mapping.amount,
        paymentDate: mapping.paymentDate,
        sourceChannelTransactionId: mapping.sourceChannelTransactionId,
        sourcePaymentChannel: mapping.sourcePaymentChannel,
        source: mapping.source,
        syncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
  }

  private static async logSync(data: Record<string, unknown>): Promise<void> {
    // Logs are server-owned and must not rely on the browser SDK's staff-only
    // rule. Preserve the payment outcome if an operational log is unavailable.
    try {
      await getAdminFirestore(getFirebaseAdminApp())
        .collection(SCHOOLPAY_SYNC_LOGS)
        .add(data);
    } catch (error) {
      console.error('[SchoolPay] Failed to write sync log:', error);
    }
  }
}
