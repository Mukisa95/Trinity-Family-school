import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { getStaffClockingBootstrap } from '@/lib/server/staff-clocking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    const result = await getStaffClockingBootstrap(getFirestore(getFirebaseAdminApp()), actor);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load staff clocking.';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'PERMISSION_DENIED' || message === 'ACCOUNT_INACTIVE' ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
