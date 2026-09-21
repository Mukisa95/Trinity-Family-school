import { NextRequest, NextResponse } from 'next/server';
import { PaymentHistoryContext, PaymentsService } from '@/lib/services/payments.service';
import type { PaymentRecord } from '@/types';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';
import { isFirestoreQuotaError } from '@/lib/utils/firestore-quota-error';

/**
 * API Route: POST /api/payments/create
 * 
 * Server-side payment creation endpoint that:
 * 1. Creates payment record in database
 * 2. Returns as soon as the financial record and history entry are committed
 *
 * Payment alerts are intentionally not sent. Staff see the up-to-date fee
 * history and balance whenever they open the pupil's fee collection page.
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
      const operation = await PaymentsService.createPaymentOperation(operationId, allocations);
      const paymentCommittedAt = performance.now();

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
      ? await PaymentsService.createPaymentOperation(operationId, [{ paymentData, historyContext }])
      : null;
    const paymentId = operation?.paymentIds[0] || await PaymentsService.createPayment(paymentData, {
      skipHistoryLog,
      historyContext,
    });
    const paymentCommittedAt = performance.now();

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

    if (isFirestoreQuotaError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: 'FIRESTORE_QUOTA_EXHAUSTED',
          retryable: true,
          error: 'The database is temporarily at capacity, so this payment request could not be completed. Please wait and retry the same payment later.',
        },
        {
          status: 503,
          headers: { 'Retry-After': '900' },
        },
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create payment' 
      },
      { status: 500 }
    );
  }
}
