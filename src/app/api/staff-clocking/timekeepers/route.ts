import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { listStaffClockingTimekeepers, updateStaffClockingTimekeeper } from '@/lib/server/staff-clocking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: NextRequest, save: boolean) {
  try {
    const actor = await requireAppUser(request);
    const db = getFirestore(getFirebaseAdminApp());
    const result = save ? await updateStaffClockingTimekeeper(db, actor, await request.json()) : await listStaffClockingTimekeepers(db, actor);
    return NextResponse.json({ success: true, result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update timekeeper access.';
    return NextResponse.json({ success: false, error: message }, { status: ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'PERMISSION_DENIED' ? 403 : message === 'CLOCKING_ACCESS_CHANGED_REVIEW_AND_RETRY' ? 409 : 400 });
  }
}

export const GET = (request: NextRequest) => handle(request, false);
export const PUT = (request: NextRequest) => handle(request, true);
