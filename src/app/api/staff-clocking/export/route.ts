import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { listStaffClockingDailyRecords, requireStaffClockingAccess } from '@/lib/server/staff-clocking';
import { exportStaffClockingCsv } from '@/lib/staff-clocking/export';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    requireStaffClockingAccess(actor, 'records', 'export_records');
    const input = Object.fromEntries(request.nextUrl.searchParams.entries());
    const records = await listStaffClockingDailyRecords(getFirestore(getFirebaseAdminApp()), actor, input);
    return new NextResponse(exportStaffClockingCsv(records), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="staff-clocking-records.csv"', 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to export records.';
    return NextResponse.json({ success: false, error: message }, { status: message === 'PERMISSION_DENIED' ? 403 : 400 });
  }
}
