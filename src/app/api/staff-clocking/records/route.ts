import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { listStaffClockingDailyRecords, summarizeStaffClockingRecords } from '@/lib/server/staff-clocking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    const filters = Object.fromEntries(request.nextUrl.searchParams.entries());
    const records = await listStaffClockingDailyRecords(getFirestore(getFirebaseAdminApp()), actor, filters);
    return NextResponse.json({ success: true, result: { records, summary: summarizeStaffClockingRecords(records) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load staff clock records.';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'PERMISSION_DENIED' ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
