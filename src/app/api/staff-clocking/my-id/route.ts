import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { getOrIssueStaffId } from '@/lib/server/staff-clocking/staff-id';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: NextRequest, operation: 'read' | 'issue') {
  try {
    const actor = await requireAppUser(request);
    if (!actor.user.staffId) throw new Error('CLOCKING_STAFF_LINK_REQUIRED');
    return NextResponse.json({ success: true, result: await getOrIssueStaffId(getFirestore(getFirebaseAdminApp()), actor, actor.user.staffId, operation) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to open staff ID.';
    return NextResponse.json({ success: false, error: message }, { status: message === 'PERMISSION_DENIED' ? 403 : message.includes('AUTH_REQUIRED') ? 401 : 409 });
  }
}
export const GET = (request: NextRequest) => handle(request, 'read');
export const POST = (request: NextRequest) => handle(request, 'issue');
