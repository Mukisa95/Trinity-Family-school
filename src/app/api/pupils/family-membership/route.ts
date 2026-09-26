import { after, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAppUser } from '@/lib/server/app-auth';
import {
  sendParentFamilyMembershipNotifications,
  syncParentScopeClaims,
  transitionParentFamilyMembership,
} from '@/lib/server/parent-family-membership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  pupilIds: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
  familyId: z.string().trim().max(160).nullable(),
  preferredPupilId: z.string().trim().max(160).optional(),
  reason: z.enum(['membership_change', 'registration']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (actor.user.role !== 'Admin' && actor.user.role !== 'Staff') {
      return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
    }
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid family membership change.' }, { status: 400 });
    }
    const result = await transitionParentFamilyMembership(parsed.data, actor.user);
    await syncParentScopeClaims(result.claimUpdates);
    if (result.notifications.length > 0) {
      after(() => sendParentFamilyMembershipNotifications(result.notifications).catch(error => {
        console.error('[Family Membership] Push delivery failed:', error);
      }));
    }
    return NextResponse.json({
      success: true,
      pupilIds: result.pupilIds,
      familyId: result.familyId,
      parentAccountId: result.accountId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('AUTH') || message.includes('INACTIVE')) {
      return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
    }
    if (message === 'PUPIL_NOT_FOUND') {
      return NextResponse.json({ error: 'One or more pupils were not found.' }, { status: 404 });
    }
    if (['PUPILS_REQUIRED', 'TOO_MANY_PUPILS', 'FAMILY_TOO_LARGE', 'DETACH_ONE_PUPIL_AT_A_TIME'].includes(message)) {
      return NextResponse.json({ error: 'The requested family membership change is too large or invalid.' }, { status: 400 });
    }
    console.error('[Family Membership] Transition failed:', error);
    return NextResponse.json({ error: 'Could not update family membership.' }, { status: 500 });
  }
}
