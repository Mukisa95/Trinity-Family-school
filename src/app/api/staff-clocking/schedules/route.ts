import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { createStaffClockingSchedule, listStaffClockingSchedules } from '@/lib/server/staff-clocking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to manage staff clocking schedules.';
  const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'PERMISSION_DENIED' || message === 'ACCOUNT_INACTIVE' ? 403 : 400;
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    return NextResponse.json({ success: true, schedules: await listStaffClockingSchedules(getFirestore(getFirebaseAdminApp()), actor) });
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    return NextResponse.json({ success: true, result: await createStaffClockingSchedule(getFirestore(getFirebaseAdminApp()), actor, await request.json()) }, { status: 201 });
  } catch (error) {
    return responseError(error);
  }
}
