import {NextRequest, NextResponse} from 'next/server';
import {requireAppUser} from '@/lib/server/app-auth';
import {canManageFeeReminders} from '@/lib/fees/fee-reminders';
import {setPupilFeeNotesSwitch} from '@/lib/server/fee-notes-switch';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canManageFeeReminders(actor.user)) return NextResponse.json({error: 'Permission to manage fee payments is required.'}, {status: 403});
    const body = await request.json();
    if (!body || typeof body.enabled !== 'boolean' || typeof body.pupilId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(body.pupilId)) return NextResponse.json({error: 'Choose a valid pupil and switch setting.'}, {status: 400});
    return NextResponse.json(await setPupilFeeNotesSwitch(body.pupilId, body.enabled, actor.user));
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'ACCOUNT_INACTIVE' ? 403 : message === 'PUPIL_NOT_FOUND' ? 404 : message === 'SWITCH_BUSY' ? 409 : error instanceof SyntaxError ? 400 : 503;
    if (status === 503) console.error('Fee Notes switch could not finish:', error);
    return NextResponse.json({error: status === 401 ? 'Sign in is required.' : status === 409 ? 'Another user is changing this pupil’s Notes switch. Please try again shortly.' : 'Unable to change Notes. Please try again.'}, {status});
  }
}
