import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { getStaffClockingSettings, updateStaffClockingSettings } from '@/lib/server/staff-clocking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to update staff clocking settings.';
  const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'PERMISSION_DENIED' || message === 'ACCOUNT_INACTIVE' ? 403 : 400;
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    return NextResponse.json({ success: true, result: await getStaffClockingSettings(getFirestore(getFirebaseAdminApp()), actor) });
  } catch (error) {
    return responseError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    return NextResponse.json({ success: true, result: await updateStaffClockingSettings(getFirestore(getFirebaseAdminApp()), actor, await request.json()) });
  } catch (error) {
    return responseError(error);
  }
}
