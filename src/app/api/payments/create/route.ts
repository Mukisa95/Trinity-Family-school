import { after, NextRequest, NextResponse } from 'next/server';
import { PaymentHistoryContext, PaymentsService } from '@/lib/services/payments.service';
import type { PaymentRecord } from '@/types';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';
import { enqueuePaymentNotificationEvents } from '@/lib/server/payment-notification-outbox';
import { processPendingPaymentNotificationEvents } from '@/lib/server/payment-notification-worker';

const PAYMENT_NOTIFICATION_TIMEOUT_MS = 8_000;

type PaymentNotificationTarget = {
  paymentId: string;
  paymentData: PaymentRecord;
};

async function notifyPaymentsCreatedAfterResponse(
  targets: PaymentNotificationTarget[],
  ensureEnqueued = false,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    // New payments create their outbox document atomically with the financial
    // write. Only a replay from before that rollout needs this repair step.
    if (ensureEnqueued) await enqueuePaymentNotificationEvents(targets);
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
 * 1. Creates payment record in database
 * 2. Returns as soon as the financial record and history entry are committed
 * 3. Hands push notifications to a leased worker after the response
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
      const operation = await PaymentsService.createPaymentOperation(operationId, allocations, {
        enqueueNotifications: true,
      });
      const paymentCommittedAt = performance.now();
      const committedPayments = allocations.map((allocation, index) => ({
        id: operation.paymentIds[index],
        ...allocation.paymentData,
        createdAt: new Date(),
        paymentDate: allocation.paymentData.paymentDate || new Date().toISOString(),
      }));
      {
        after(() => notifyPaymentsCreatedAfterResponse(
          committedPayments.map(payment => ({ paymentId: payment.id, paymentData: payment })),
          operation.wasReplay,
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

    // Keep the client-reachable PaymentsService free of Node-only imports.
    const operation = operationId
      ? await PaymentsService.createPaymentOperation(operationId, [{ paymentData, historyContext }], {
          enqueueNotifications: true,
        })
      : null;
    const paymentId = operation?.paymentIds[0] || await PaymentsService.createPayment(paymentData, {
      skipHistoryLog,
      historyContext,
      enqueueNotification: true,
    });
    const paymentCommittedAt = performance.now();

    const committedPayment = {
      id: paymentId,
      ...paymentData,
      createdAt: new Date(),
      paymentDate: paymentData.paymentDate || new Date().toISOString(),
    };
    {
      after(() => notifyPaymentsCreatedAfterResponse([
        { paymentId, paymentData: committedPayment },
      ], operation?.wasReplay === true));
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
