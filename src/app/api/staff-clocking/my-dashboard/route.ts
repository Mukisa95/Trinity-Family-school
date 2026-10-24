import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { getOwnStaffClockingDashboard } from '@/lib/server/staff-clocking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    return NextResponse.json({ success: true, result: await getOwnStaffClockingDashboard(getFirestore(getFirebaseAdminApp()), actor) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load your clocking dashboard.';
    return NextResponse.json({ success: false, error: message }, { status: ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'PERMISSION_DENIED' ? 403 : 400 });
  }
}
