import { NextRequest, NextResponse } from 'next/server';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';
import type { CreateNotificationData } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await ensureServerFirestoreAuth();
    const notificationData = (await request.json()) as CreateNotificationData;

    if (!notificationData.title?.trim()) {
      return NextResponse.json({ error: 'Notification title is required' }, { status: 400 });
    }

    if (!Array.isArray(notificationData.recipients) || notificationData.recipients.length === 0) {
      return NextResponse.json({ error: 'At least one recipient is required' }, { status: 400 });
    }

    const { optimizedNotificationService } = await import(
      '@/lib/services/optimized-notification.service'
    );
    const result = await optimizedNotificationService.sendNotificationOptimized(notificationData);

    return NextResponse.json({
      success: result.errors.length === 0,
      notificationId: result.notification.id,
      stats: {
        totalRecipients: result.stats.totalRecipients,
        sent: result.stats.pushSent,
        failed: result.stats.pushFailed,
        inAppSent: result.stats.inAppSent,
        processingTimeMs: result.stats.processingTimeMs,
      },
      errors: result.errors,
    });
  } catch (error) {
    console.error('send-batch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to send notification batch',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'Batch Notification Sender' });
}
