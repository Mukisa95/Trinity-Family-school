import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { requireStaffClockingAccess } from '@/lib/server/staff-clocking';
import { getOrIssueStaffId } from '@/lib/server/staff-clocking/staff-id';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const requestSchema = z.object({ staffId: z.string(), operation: z.enum(['read', 'issue', 'replace', 'revoke']), revision: z.number().int().min(0) }).strict();
export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    requireStaffClockingAccess(actor, 'record', 'manage_staff_ids');
    const db = getFirestore(getFirebaseAdminApp());
    const [staff, ids] = await Promise.all([db.collection('staff').get(), db.collection('staffClockingStaffIds').get()]);
    const heads = new Map(ids.docs.map(doc => [doc.id, doc.data()]));
    const result = staff.docs.filter(doc => String(doc.data().status || 'active').toLowerCase() === 'active').map(doc => {
      const data = doc.data(), head = heads.get(doc.id);
      return { id: doc.id, name: [data.firstName, data.lastName].filter(Boolean).join(' ').trim() || doc.id, employeeId: data.employeeId || '', status: head ? (head.active ? 'active' : 'revoked') : 'unissued', revision: Number(head?.revision || 0) };
    }).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ success: true, result });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    requireStaffClockingAccess(actor, 'record', 'manage_staff_ids');
    const input = requestSchema.parse(await request.json());
    const result = await getOrIssueStaffId(getFirestore(getFirebaseAdminApp()), actor, input.staffId, input.operation, input.revision);
    return NextResponse.json({ success: true, result });
  } catch (error) { return failure(error); }
}
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to manage staff IDs.';
  return NextResponse.json({ success: false, error: message }, { status: ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'PERMISSION_DENIED' ? 403 : 409 });
}
