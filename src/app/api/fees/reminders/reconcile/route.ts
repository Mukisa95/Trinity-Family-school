import {NextRequest, NextResponse} from 'next/server';
import {getFirestore} from 'firebase-admin/firestore';
import {getFirebaseAdminApp} from '@/lib/firebase-admin';
import {requireAppUser} from '@/lib/server/app-auth';
import {canReceiveFeeReminders} from '@/lib/fees/fee-reminders';
import {processFeeReminderChange, type FeeReminderChange} from '@/lib/server/fee-reminders';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    // Requests only ask the server to recompute committed data; they cannot
    // supply balances, payment amounts, recipients, or a notification message.
    // Staff who change pupil assignments or uniform charges may not have
    // Fees inbox access. They can request a recalculation of committed data;
    // note visibility and delivery recipients still require Fees access.
    const mutationAccess = actor.user.role !== 'Parent' && actor.user.isActive !== false && (
      actor.user.modulePermissions?.some(module => ['pupils', 'uniforms'].includes(module.module) && ['edit', 'full_access'].includes(module.permission))
      || actor.user.granularPermissions?.some(module => ['pupils', 'uniforms'].includes(module.moduleId)
        && module.pages.some(page => page.canAccess && page.actions.some(action => action.allowed && /^(edit|update|assign|record|collect|create|delete|remove)/.test(action.actionId)))));
    if (!canReceiveFeeReminders(actor.user) && !mutationAccess) return NextResponse.json({error: 'Fees or pupil charge editing access is required.'}, {status: 403});
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({error: 'Invalid fee change.'}, {status: 400});
    const change: FeeReminderChange = {reversal: body.reversal === true};
    for (const key of ['pupilIds', 'feeIds'] as const) if (body[key] !== undefined) {
      if (!Array.isArray(body[key]) || body[key].length > 100 || body[key].some((id: unknown) => !validId(id))) return NextResponse.json({error: 'Invalid change identifiers.'}, {status: 400});
      change[key] = [...new Set(body[key] as string[])];
    }
    if (body.scopes !== undefined) {
      if (!Array.isArray(body.scopes) || body.scopes.length > 100 || body.scopes.some((scope: any) => !scope || ![scope.feeStructureId, scope.academicYearId, scope.termId].every(validId))) return NextResponse.json({error: 'Invalid fee periods.'}, {status: 400});
      change.scopes = body.scopes.map(({feeStructureId, academicYearId, termId}: any) => ({feeStructureId, academicYearId, termId}));
    }
    if (body.source) {
      if (!['feesHolidays', 'uniformTracking'].includes(body.source.collection) || !validId(body.source.id)) return NextResponse.json({error: 'Invalid fee change source.'}, {status: 400});
      const source = await getFirestore(getFirebaseAdminApp()).collection(body.source.collection).doc(body.source.id).get();
      if (validId(source.data()?.pupilId)) change.pupilIds = [...new Set([...(change.pupilIds || []), source.data()!.pupilId])];
    }
    if (!change.pupilIds?.length && !change.feeIds?.length) return NextResponse.json({success: true, skipped: true});
    await processFeeReminderChange(change);
    return NextResponse.json({success: true});
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'ACCOUNT_INACTIVE' ? 403 : error instanceof SyntaxError ? 400 : 503;
    if (status === 503) console.error('Fee reminder change queued for retry:', error);
    return NextResponse.json({error: status === 401 ? 'Sign in is required.' : 'Unable to process the reminder update yet.'}, {status});
  }
}
