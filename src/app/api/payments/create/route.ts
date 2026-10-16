import { requireAppUser } from '@/lib/server/app-auth';
import { CircumferenceError, requireScopedPupil } from '@/lib/server/circumference';
import { canManageFeeReminders } from '@/lib/fees/fee-reminders';
import { randomUUID } from 'crypto';
import { doc, type Transaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { circumferenceOf, permitsPupil } from '@/lib/access/circumference';
import type { SystemUser } from '@/types';
import { NextRequest, NextResponse } from 'next/server';
import { PaymentHistoryContext, PaymentsService, validatePaymentOperationInput } from '@/lib/services/payments.service';
import type { PaymentRecord } from '@/types';
import { processRecordedFeePayments } from '@/lib/server/fee-reminders';

import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';

export const maxDuration = 60;

/**
 * API Route: POST /api/payments/create
 *
 * Server-side payment creation endpoint that:
 * Creates the payment record and returns after the financial record and
 * history entry are committed. Fee note updates run after commit and cannot fail the payment.
 */
export async function POST(request: NextRequest) {
  try {
    const requestStartedAt = performance.now();
    const actor = await requireAppUser(request);
    if (!canManageFeeReminders(actor.user)) throw new CircumferenceError('Permission to record fee payments is required.');
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
    const authorize = async (transaction: Transaction) => {
      const profile = await transaction.get(doc(db, 'system_users', actor.user.id));
      const current = profile.exists() ? { ...profile.data(), id: profile.id } as SystemUser : actor.user.role === 'Admin' ? actor.user : null;
      if (!current || current.isActive === false || !canManageFeeReminders(current)) throw new CircumferenceError('Your payment access has changed.');
      const ids = [...new Set((allocations || [{ paymentData }]).map(item => item.paymentData.pupilId))];
      const pupils = await Promise.all(ids.map(id => transaction.get(doc(db, 'pupils', id))));
      if (pupils.some(pupil => !pupil.exists() || !permitsPupil(circumferenceOf(current), pupil.data() as any))) throw new CircumferenceError();
    };

    if (allocations) {
      if (!operationId) {
        throw new Error('A grouped payment request requires an operation ID');
      }
      validatePaymentOperationInput(operationId, allocations);
      await Promise.all([...new Set(allocations.map(allocation => allocation.paymentData.pupilId))].map(id => requireScopedPupil(actor, id)));
      const operation = await PaymentsService.createPaymentOperation(operationId, allocations, { authorize });
      const paymentCommittedAt = performance.now();
      await updateReminderNotesAfterPayment(allocations);

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

    await requireScopedPupil(actor, paymentData.pupilId);
    if (!Number.isFinite(paymentData.amount) || paymentData.amount <= 0) {
      throw new Error('Payment amount must be positive');
    }
    if (operationId) validatePaymentOperationInput(operationId, [{ paymentData, historyContext }]);
    const operation = await PaymentsService.createPaymentOperation(operationId || randomUUID(), [{ paymentData, historyContext }], { authorize, skipHistoryLog });
    const paymentId = operation.paymentIds[0];
    const paymentCommittedAt = performance.now();
    await updateReminderNotesAfterPayment([{paymentData}]);

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
      { status: error instanceof CircumferenceError ? error.status : String(error).includes('AUTH') || String(error).includes('INACTIVE') ? 401 : 500 }
    );
  }
}

async function updateReminderNotesAfterPayment(allocations: Parameters<typeof processRecordedFeePayments>[0]) {
  try { await processRecordedFeePayments(allocations); }
  catch (error) { console.error('Payment committed; reminder update awaits recovery:', error); }
}
