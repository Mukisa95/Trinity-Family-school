import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { getIndividualClockingProfile, getIndividualClockingPlan, getIndividualClockingRecords, getIndividualClockingToday, getIndividualClockingRequests, getIndividualClockingAudit, getIndividualClockingRevisions, mutateIndividualClocking } from '@/lib/server/staff-clocking/staff-details';
import { buildStaffDetailRows, clockingSchoolDate } from '@/lib/staff-clocking/details-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
async function handle(request: NextRequest, params: Promise<{ staffId: string }>, save: boolean) {
  try {
    const actor = await requireAppUser(request), db = getFirestore(getFirebaseAdminApp()), { staffId } = await params;
    const range = { from: request.nextUrl.searchParams.get('from') || clockingSchoolDate(), to: request.nextUrl.searchParams.get('to') || clockingSchoolDate() };
    if (save) return json({ success: true, result: await mutateIndividualClocking(db, actor, staffId, await request.json()) });
    const part = request.nextUrl.searchParams.get('part') || 'profile';
    let result: unknown;
    switch (part) {
      case 'profile': result = await getIndividualClockingProfile(db, actor, staffId); break;
      case 'revisions': result = await getIndividualClockingRevisions(db, actor, staffId); break;
      case 'plan': result = await getIndividualClockingPlan(db, actor, staffId); break;
      case 'history': result = { records: await getIndividualClockingRecords(db, actor, staffId, range), verifiedAt: new Date().toISOString() }; break;
      case 'today': result = await getIndividualClockingToday(db, actor, staffId); break;
      case 'requests': result = { requests: await getIndividualClockingRequests(db, actor, staffId, range) }; break;
      case 'exemptions': result = { requests: await getIndividualClockingRequests(db, actor, staffId, range, true) }; break;
      case 'audit': result = await getIndividualClockingAudit(db, actor, staffId, range, request.nextUrl.searchParams.get('cursor') || undefined); break;
      case 'export': {
        const profile = await getIndividualClockingProfile(db, actor, staffId);
        if (!profile.permissions.export) throw new Error('PERMISSION_DENIED');
        const [records, plan] = await Promise.all([getIndividualClockingRecords(db, actor, staffId, range), getIndividualClockingPlan(db, actor, staffId)]);
        result = { profile, rows: buildStaffDetailRows(range, records, plan), generatedAt: new Date().toISOString() };
        break;
      }
      default: throw new Error('CLOCKING_INVALID_DETAIL_SECTION');
    }
    return json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load staff clocking details.';
    return json({ success: false, error: message }, ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'PERMISSION_DENIED' ? 403 : message === 'CLOCKING_STAFF_NOT_FOUND' ? 404 : 400);
  }
}
export const GET = (request: NextRequest, context: { params: Promise<{ staffId: string }> }) => handle(request, context.params, false);
export const POST = (request: NextRequest, context: { params: Promise<{ staffId: string }> }) => handle(request, context.params, true);
