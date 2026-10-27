import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { getDashboardStaffDay } from '@/lib/server/staff-clocking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    const result = await getDashboardStaffDay(getFirestore(getFirebaseAdminApp()), actor);
    return NextResponse.json({ success: true, result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load your staff day.';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : ['PERMISSION_DENIED', 'ACCOUNT_INACTIVE'].includes(message) ? 403 : 500;
    return NextResponse.json({ success: false, error: status === 500 ? 'Unable to load your staff day.' : message }, { status });
  }
}
