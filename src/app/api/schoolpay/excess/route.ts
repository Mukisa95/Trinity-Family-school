import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { SchoolPayExcessError, previewSchoolPayExcess, transferSchoolPayExcess } from '@/lib/services/schoolpay-excess.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Could not process the SchoolPay excess.';
  const status = error instanceof SchoolPayExcessError ? error.status
    : ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED', 'ACCOUNT_INACTIVE'].includes(message) ? 401 : 500;
  return NextResponse.json({ error: status === 500 ? 'Could not process the SchoolPay excess. Please retry.' : message }, { status });
}

function validateIds(pupilId: unknown, receipt: unknown): asserts pupilId is string {
  if (typeof pupilId !== 'string' || !pupilId || pupilId.includes('/') || typeof receipt !== 'string'
    || !receipt || receipt.includes('/') || receipt.length > 200) throw new SchoolPayExcessError('A pupil and receipt are required.', 400);
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!GranularPermissionService.canAccessPage(actor.user, 'fees', 'collect')) {
      return NextResponse.json({ error: 'You do not have access to fee collection.' }, { status: 403 });
    }
    const pupilId = request.nextUrl.searchParams.get('pupilId');
    const receipt = request.nextUrl.searchParams.get('receipt');
    validateIds(pupilId, receipt);
    return NextResponse.json(await previewSchoolPayExcess(pupilId, receipt!, actor.user), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!GranularPermissionService.canPerformAction(actor.user, 'fees', 'collect', 'record_payment')
      || !GranularPermissionService.canPerformAction(actor.user, 'fees', 'collect', 'revert_payment')) {
      return NextResponse.json({ error: 'You need permission to record and revert payments to transfer excess.' }, { status: 403 });
    }
    const input = await request.json();
    validateIds(input.pupilId, input.receipt);
    if (typeof input.target !== 'string' || !input.target || typeof input.version !== 'string' || !/^[a-f0-9]{64}$/.test(input.version)
      || typeof input.operationId !== 'string' || !/^[a-zA-Z0-9-]{16,100}$/.test(input.operationId)) {
      throw new SchoolPayExcessError('Reload the transfer options before continuing.', 400);
    }
    const result = await transferSchoolPayExcess(input, { id: actor.user.id,
      name: actor.user.username || actor.user.firstName || 'Fees staff', role: actor.user.role }, actor.user);
    return NextResponse.json({ success: true, ...result });
  } catch (error) { return errorResponse(error); }
}
