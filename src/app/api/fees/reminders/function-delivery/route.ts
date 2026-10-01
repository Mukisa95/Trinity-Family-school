import {NextRequest, NextResponse} from 'next/server';
import {getFirestore} from 'firebase-admin/firestore';
import {getFirebaseAdminApp} from '@/lib/firebase-admin';
import {verifyFeeReminderFunction} from '@/lib/server/fee-reminder-function-auth';
import {sendCustomFeeNotePush, sendFeeReminderResolutionPush} from '@/lib/server/fee-reminders';
import type {CustomFeeDelivery} from '../../../../../../functions/custom-fee-notes';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const app = getFirebaseAdminApp();
  const projectId = app.options.projectId || process.env.FIREBASE_ADMIN_PROJECT_ID || '';
  if (!await verifyFeeReminderFunction(request.headers.get('authorization'), projectId)) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }
  try {
    const delivery = await request.json() as CustomFeeDelivery;
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(delivery.id || '') || !Number.isSafeInteger(delivery.version)
      || delivery.version < 0 || !['FEE_REMINDER_ALERT', 'FEE_REMINDER_RESOLVED'].includes(delivery.type)
      || typeof delivery.title !== 'string' || typeof delivery.body !== 'string'
      || delivery.title.length > 500 || delivery.body.length > 20000
      || !/^[A-Za-z0-9_-]{1,160}$/.test(delivery.pupilId || '')
      || !Array.isArray(delivery.recipientIds) || !Array.isArray(delivery.collectRecipientIds)
      || [...delivery.recipientIds, ...delivery.collectRecipientIds].some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(id))) {
      return NextResponse.json({error: 'Invalid delivery'}, {status: 400});
    }
    const note = (await getFirestore(app).collection('feeReminders').doc(delivery.id).get()).data();
    if (!note || note.pupilId !== delivery.pupilId || Number(note.notificationVersion || 0) !== delivery.version
      || (delivery.type === 'FEE_REMINDER_ALERT'
        ? !note.customDeliveryPending || note.reminderStatus === 'cancelled'
        : !note.dismissalPending || !['cancelled', 'fulfilled'].includes(note.reminderStatus))) {
      return NextResponse.json({skipped: true});
    }
    if (delivery.type === 'FEE_REMINDER_ALERT') await sendCustomFeeNotePush(delivery);
    else await sendFeeReminderResolutionPush(delivery);
    return NextResponse.json({sent: true});
  } catch {
    return NextResponse.json({error: 'Reminder delivery will retry'}, {status: 503});
  }
}
