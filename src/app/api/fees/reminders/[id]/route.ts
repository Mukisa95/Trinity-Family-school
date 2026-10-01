import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/server/app-auth';
import { canManageFeeReminders } from '@/lib/fees/fee-reminders';
import { cancelFeeReminder, updateFeeReminderRecipients, FeeReminderError } from '@/lib/server/fee-reminders';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAppUser(request);
    if (!canManageFeeReminders(actor.user)) return NextResponse.json({ error: 'Permission to manage fee payments is required.' }, { status: 403 });
    const body = await request.json();
    if (!['cancel', 'recipients'].includes(body?.action)) return NextResponse.json({ error: 'Choose a valid reminder action.' }, { status: 400 });
    const { id } = await context.params;
    if (body.action === 'recipients') {
      const note = await updateFeeReminderRecipients(id, body.recipientIds, actor.user);
      return NextResponse.json({ note });
    }
    const result = await cancelFeeReminder(id, actor.user, body.reason ?? '');
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = error instanceof FeeReminderError ? error.status
      : ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
        : message === 'ACCOUNT_INACTIVE' ? 403 : error instanceof SyntaxError ? 400 : 500;
    if (status === 500) console.error('Fee reminder update failed:', error);
    return NextResponse.json({ error: status === 500 ? 'Unable to update this reminder.' : message }, { status });
  }
}
