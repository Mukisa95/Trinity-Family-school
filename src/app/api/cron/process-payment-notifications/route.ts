import { NextRequest, NextResponse } from 'next/server';
import { processPendingPaymentNotificationEvents } from '@/lib/server/payment-notification-worker';

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || supplied !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const results = await processPendingPaymentNotificationEvents();
    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payment notification worker failed.' }, { status: 500 });
  }
}
