import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { listStaffClockingReviewRequests } from '@/lib/server/staff-clocking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const actor = await requireAppUser(request);
    const { kind } = await params;
    if (kind !== 'exemption' && kind !== 'correction') throw new Error('CLOCKING_REQUEST_KIND_INVALID');
    const requests = await listStaffClockingReviewRequests(getFirestore(getFirebaseAdminApp()), actor, kind);
    return NextResponse.json({ success: true, result: { requests } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load review requests.';
    return NextResponse.json({ success: false, error: message }, { status: ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'PERMISSION_DENIED' ? 403 : 400 });
  }
}
