import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { FEE_REMINDER_COLLECTION, canReadFeeReminders, canManageFeeReminders } from '@/lib/fees/fee-reminders';
import { createFeeReminder, serializeFeeReminder, validateFeeReminderInput, FeeReminderError, listFeeReminderRecipients, reconcileFeeReminders, withLiveCustomFeeDetails } from '@/lib/server/fee-reminders';

export const dynamic = 'force-dynamic';
export const revalidate = false;

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const status = error instanceof FeeReminderError ? error.status
    : ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : message === 'ACCOUNT_INACTIVE' ? 403 : error instanceof SyntaxError ? 400 : 500;
  if (status === 500) console.error('Fee reminder request failed:', error);
  return NextResponse.json({ error: status === 500 ? 'Unable to save or load fee reminders. Please try again.'
    : status === 401 ? 'Sign in is required.' : message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canReadFeeReminders(actor.user)) return NextResponse.json({ error: 'Fees collection access is required.' }, { status: 403 });
    const pupilId = request.nextUrl.searchParams.get('pupilId') || '';
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(pupilId)) throw new FeeReminderError('Choose a valid pupil.');
    if (request.nextUrl.searchParams.get('includeRecipients') === 'true') {
      if (!canManageFeeReminders(actor.user)) return NextResponse.json({ error: 'Permission to manage fee payments is required.' }, { status: 403 });
      return NextResponse.json({ recipients: await listFeeReminderRecipients() });
    }
    // Also repair older notes or a delayed payment trigger when opening Notes.
    try { await reconcileFeeReminders(pupilId); }
    catch (error) { console.error('Fee reminder reconciliation will retry:', error); }
    // Sorting in memory keeps this pupil-scoped read independent of a new composite index.
    const snapshot = await getFirestore(getFirebaseAdminApp()).collection(FEE_REMINDER_COLLECTION)
      .where('pupilId', '==', pupilId).get();
    const notes = snapshot.docs.map(serializeFeeReminder).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    return NextResponse.json({ notes: await withLiveCustomFeeDetails(notes, pupilId) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canManageFeeReminders(actor.user)) return NextResponse.json({ error: 'Permission to record fee payments is required to create reminders.' }, { status: 403 });
    const input = validateFeeReminderInput(await request.json());
    const note = await createFeeReminder(input, actor.user);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
