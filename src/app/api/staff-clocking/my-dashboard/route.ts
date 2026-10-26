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
    const part = request.nextUrl.searchParams.get('part') || 'all';
    if (!['schedule', 'status', 'history', 'all'].includes(part)) throw new Error('CLOCKING_INVALID_DASHBOARD_PART');
    return NextResponse.json({ success: true, result: await getOwnStaffClockingDashboard(getFirestore(getFirebaseAdminApp()), actor, part as 'schedule' | 'status' | 'history' | 'all') }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load your clocking dashboard.';
    return NextResponse.json({ success: false, error: message }, { status: ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'PERMISSION_DENIED' ? 403 : 400 });
  }
}
