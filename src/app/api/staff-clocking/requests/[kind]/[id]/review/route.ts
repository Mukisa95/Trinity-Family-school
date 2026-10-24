import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { reviewStaffClockingSelfServiceRequest, staffClockingReviewSchema } from '@/lib/server/staff-clocking';

export const runtime = 'nodejs';
export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const actor = await requireAppUser(request);
    const { kind, id } = await params;
    if (kind !== 'exemption' && kind !== 'correction') throw new Error('CLOCKING_REQUEST_KIND_INVALID');
    const body = staffClockingReviewSchema.parse(await request.json());
    return NextResponse.json({ success: true, result: await reviewStaffClockingSelfServiceRequest(getFirestore(getFirebaseAdminApp()), actor, kind, id, body.approved, body.reviewNote) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to review the request.';
    return NextResponse.json({ success: false, error: message }, { status: ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'PERMISSION_DENIED' ? 403 : 400 });
  }
}
