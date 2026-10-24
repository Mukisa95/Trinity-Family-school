import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { deleteStaffClockingSchedule, updateStaffClockingSchedule } from '@/lib/server/staff-clocking';

export const runtime = 'nodejs';

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to manage the staff clocking schedule.';
  const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'PERMISSION_DENIED' || message === 'ACCOUNT_INACTIVE' ? 403 : message === 'CLOCKING_SCHEDULE_NOT_FOUND' ? 404 : 400;
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAppUser(request);
    const { id } = await params;
    return NextResponse.json({ success: true, result: await updateStaffClockingSchedule(getFirestore(getFirebaseAdminApp()), actor, id, await request.json()) });
  } catch (error) {
    return responseError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAppUser(request);
    const { id } = await params;
    await deleteStaffClockingSchedule(getFirestore(getFirebaseAdminApp()), actor, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return responseError(error);
  }
}
