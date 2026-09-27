import { after, NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { PaymentHistoryContext, PaymentsService, validatePaymentOperationInput } from '@/lib/services/payments.service';
import type { PaymentRecord } from '@/types';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';
import { enqueuePaymentNotificationEvents } from '@/lib/server/payment-notification-outbox';
import { processPendingPaymentNotificationEvents } from '@/lib/server/payment-notification-worker';

const PAYMENT_NOTIFICATION_TIMEOUT_MS = 8_000;

type PaymentNotificationTarget = {
  paymentId: string;
};

function paymentIdsForOperation(operationId: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `pay-${createHash('sha256')
    .update(`fee-payment:${operationId}:${index}`)
    .digest('hex')}`);
}

async function notifyPaymentsCreatedAfterResponse(
  targets: PaymentNotificationTarget[],
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      processPendingPaymentNotificationEvents(25, targets.map(target => target.paymentId)),
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn('[Payment API] Background notification exceeded its delivery budget.', {
            paymentIds: targets.map(target => target.paymentId),
            timeoutMs: PAYMENT_NOTIFICATION_TIMEOUT_MS,
          });
          resolve();
        }, PAYMENT_NOTIFICATION_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.error('[Payment API] Post-commit notification handoff failed:', error);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * API Route: POST /api/payments/create
 *
 * Server-side payment creation endpoint that:
 * 1. Creates an Admin-only notification job before the payment write
 * 2. Creates the payment record in the database
 * 3. Returns as soon as the financial record and history entry are committed
 * 4. Hands push notifications to a leased worker after the response
 * Notifications remain durable and retryable after the response completes.
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
      operationId,
      allocations,
      ...paymentData
    }: {
      historyContext?: PaymentHistoryContext;
      skipHistoryLog?: boolean;
      operationId?: string;
      allocations?: Array<{
        paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>;
        historyContext?: PaymentHistoryContext;
        uniformTracking?: {
          trackingId: string;
          paymentAmount: number;
          paymentDate: string;
        };
      }>;
    } & Omit<PaymentRecord, 'id' | 'createdAt'> = body;

    if (allocations) {
      if (!operationId) {
        throw new Error('A grouped payment request requires an operation ID');
      }
      validatePaymentOperationInput(operationId, allocations);
      const intendedIds = paymentIdsForOperation(operationId, allocations.length);
      await enqueuePaymentNotificationEvents(intendedIds.map(paymentId => ({ paymentId })));
      const operation = await PaymentsService.createPaymentOperation(operationId, allocations, {
        paymentIds: intendedIds,
      });
      // Operations saved by older deployments used random payment IDs.
      if (operation.wasReplay && operation.paymentIds.some((id, index) => id !== intendedIds[index])) {
        await enqueuePaymentNotificationEvents(operation.paymentIds.map(paymentId => ({ paymentId })));
      }
      const paymentCommittedAt = performance.now();
      {
        after(() => notifyPaymentsCreatedAfterResponse(
          operation.paymentIds.map(paymentId => ({ paymentId })),
        ));
      }

      return NextResponse.json({
        success: true,
        operationId,
        paymentIds: operation.paymentIds,
        wasReplay: operation.wasReplay,
        message: operation.wasReplay
          ? 'Payment already recorded'
          : 'Payments recorded successfully',
      }, {
        headers: {
          'Server-Timing': [
            `auth;dur=${(authenticatedAt - requestStartedAt).toFixed(1)}`,
            `payment-commit;dur=${(paymentCommittedAt - authenticatedAt).toFixed(1)}`,
          ].join(', '),
        },
      });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`💳 [Payment API] Creating payment via server-side route`);
    console.log(`   Pupil ID: ${paymentData.pupilId}`);
    console.log(`   Fee ID: ${paymentData.feeStructureId}`);
    console.log(`   Amount: ${paymentData.amount}`);
    console.log(`${'='.repeat(80)}\n`);

    // The Admin SDK can write this job under the existing denied scheduling
    // rules. The worker checks the saved payment before any delivery.
    if (!Number.isFinite(paymentData.amount) || paymentData.amount <= 0) {
      throw new Error('Payment amount must be positive');
    }
    if (operationId) validatePaymentOperationInput(operationId, [{ paymentData, historyContext }]);
    const intendedId = operationId ? paymentIdsForOperation(operationId, 1)[0] : randomUUID();
    await enqueuePaymentNotificationEvents([{ paymentId: intendedId }]);
    const operation = operationId
      ? await PaymentsService.createPaymentOperation(operationId, [{ paymentData, historyContext }], {
          paymentIds: [intendedId],
        })
      : null;
    const paymentId = operation?.paymentIds[0] || await PaymentsService.createPayment(paymentData, {
      skipHistoryLog,
      historyContext,
      paymentId: intendedId,
    });
    if (operation?.wasReplay && paymentId !== intendedId) {
      await enqueuePaymentNotificationEvents([{ paymentId }]);
    }
    const paymentCommittedAt = performance.now();
    {
      after(() => notifyPaymentsCreatedAfterResponse([
        { paymentId },
      ]));
    }

    console.log(`✅ [Payment API] Payment created successfully: ${paymentId}\n`);

    return NextResponse.json({ 
      success: true, 
      paymentId,
      operationId: operation?.operationId,
      wasReplay: operation?.wasReplay || false,
      message: operation?.wasReplay ? 'Payment already recorded' : 'Payment recorded successfully'
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
