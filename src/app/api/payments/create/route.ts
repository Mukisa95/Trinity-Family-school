import { after, NextRequest, NextResponse } from 'next/server';
import { PaymentHistoryContext, PaymentsService } from '@/lib/services/payments.service';
import { PupilsService } from '@/lib/services/pupils.service';
import { FeesService } from '@/lib/services/fees.service';
import { feesPaymentNotificationServerService } from '@/lib/services/fees-payment-notification.server';
import type { PaymentRecord } from '@/types';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';

const PAYMENT_NOTIFICATION_TIMEOUT_MS = 8_000;

async function notifyPaymentCreatedAfterResponse(paymentId: string, paymentData: PaymentRecord) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      notifyPaymentCreated(paymentId, paymentData),
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn('[Payment API] Background notification exceeded its delivery budget.', {
            paymentId,
            timeoutMs: PAYMENT_NOTIFICATION_TIMEOUT_MS,
          });
          resolve();
        }, PAYMENT_NOTIFICATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function notifyPaymentCreated(paymentId: string, paymentData: PaymentRecord): Promise<void> {
  try {
    const [pupil, feeStructure] = await Promise.all([
      PupilsService.getPupilById(paymentData.pupilId),
      FeesService.getFeeStructureById(paymentData.feeStructureId),
    ]);

    if (!pupil || !feeStructure) {
      console.warn('[Payment API] Notification skipped because the pupil or fee was not found.', {
        paymentId,
        pupilId: paymentData.pupilId,
        feeStructureId: paymentData.feeStructureId,
      });
      return;
    }

    const relatedPayments = await PaymentsService.getPaymentsByFee(
      paymentData.feeStructureId,
      paymentData.pupilId,
      paymentData.academicYearId,
      paymentData.termId,
    );
    const balance = feeStructure.amount - relatedPayments.reduce(
      (total, payment) => total + (payment.reverted ? 0 : payment.amount),
      0,
    );

    await feesPaymentNotificationServerService.sendPaymentNotification(
      paymentId,
      paymentData,
      pupil,
      feeStructure,
      balance,
    );
  } catch (error) {
    // A payment must remain successful even if its follow-up notification fails.
    console.error('[Payment API] Notification delivery failed:', error);
  }
}

/**
 * API Route: POST /api/payments/create
 * 
 * Server-side payment creation endpoint that:
 * 1. Creates payment record in database
 * 2. Returns as soon as the financial record and history entry are committed
 * 3. Sends push notifications after the response with a strict delivery budget
 * 
 * This ensures notifications run on the server where Node.js modules are available.
 */
export async function POST(request: NextRequest) {
  try {
    const requestStartedAt = performance.now();
    await ensureServerFirestoreAuth();
    const authenticatedAt = performance.now();
    const body = await request.json();
    const {
      historyContext,
      skipHistoryLog,
      ...paymentData
    }: {
      historyContext?: PaymentHistoryContext;
      skipHistoryLog?: boolean;
    } & Omit<PaymentRecord, 'id' | 'createdAt'> = body;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`💳 [Payment API] Creating payment via server-side route`);
    console.log(`   Pupil ID: ${paymentData.pupilId}`);
    console.log(`   Fee ID: ${paymentData.feeStructureId}`);
    console.log(`   Amount: ${paymentData.amount}`);
    console.log(`${'='.repeat(80)}\n`);

    // Keep the client-reachable PaymentsService free of Node-only imports.
    const paymentId = await PaymentsService.createPayment(paymentData, {
      skipHistoryLog,
      historyContext,
    });
    const paymentCommittedAt = performance.now();

    const committedPayment = {
      id: paymentId,
      ...paymentData,
      createdAt: new Date(),
      paymentDate: paymentData.paymentDate || new Date().toISOString(),
    };
    after(() => notifyPaymentCreatedAfterResponse(paymentId, committedPayment));

    console.log(`✅ [Payment API] Payment created successfully: ${paymentId}\n`);

    return NextResponse.json({ 
      success: true, 
      paymentId,
      message: 'Payment recorded successfully'
    }, {
      headers: {
        'Server-Timing': [
          `auth;dur=${(authenticatedAt - requestStartedAt).toFixed(1)}`,
          `payment-commit;dur=${(paymentCommittedAt - authenticatedAt).toFixed(1)}`,
        ].join(', '),
      },
    });

  } catch (error) {
    console.error('❌ [Payment API] Error creating payment:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create payment' 
      },
      { status: 500 }
    );
  }
}
