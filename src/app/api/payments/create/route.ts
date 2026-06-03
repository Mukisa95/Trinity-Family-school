import { NextRequest, NextResponse } from 'next/server';
import { PaymentHistoryContext, PaymentsService } from '@/lib/services/payments.service';
import type { PaymentRecord } from '@/types';

/**
 * API Route: POST /api/payments/create
 * 
 * Server-side payment creation endpoint that:
 * 1. Creates payment record in database
 * 2. Triggers fees payment notification service
 * 3. Sends push notifications to parents and staff
 * 
 * This ensures notifications run on the server where Node.js modules are available.
 */
export async function POST(request: NextRequest) {
  try {
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

    // Create payment (this will automatically trigger notification service)
    const paymentId = await PaymentsService.createPayment(paymentData, {
      skipHistoryLog,
      historyContext,
    });

    console.log(`✅ [Payment API] Payment created successfully: ${paymentId}\n`);

    return NextResponse.json({ 
      success: true, 
      paymentId,
      message: 'Payment created and notifications sent successfully'
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
