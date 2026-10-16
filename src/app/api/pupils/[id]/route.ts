import { CircumferenceError, requireScopedPupil, canReadScopedModule } from '@/lib/server/circumference';
import { circumferenceOf, permitsPupil } from '@/lib/access/circumference';
import {processFeeReminderChangeSafely} from '@/lib/server/fee-reminders';
import { after, NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { updatePupilWithCacheRevision } from '@/lib/server/pupil-cache-revisions.admin';
import { requireAppUser } from '@/lib/server/app-auth';
import {
  sendParentFamilyMembershipNotifications,
  syncParentScopeClaims,
  transitionParentFamilyMembership,
} from '@/lib/server/parent-family-membership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAppUser(request);
    if (actor.user.role !== 'Parent' && !canReadScopedModule(actor, 'pupils')) throw new CircumferenceError();
    const { id: pupilId } = await params;
    console.log('🔍 API: Fetching pupil with ID:', pupilId);

    if (!pupilId) {
      return NextResponse.json(
        { error: 'Pupil ID is required' },
        { status: 400 }
      );
    }

    const pupil = await requireScopedPupil(actor, pupilId);
    return NextResponse.json(pupil, { headers: { 'Cache-Control': 'private, no-store' } });

  } catch (error) {
    console.error('🔍 API: Error fetching pupil:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pupil data' },
      { status: error instanceof CircumferenceError ? error.status : String(error).includes('AUTH') || String(error).includes('INACTIVE') ? 401 : 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAppUser(request);
    const { id: pupilId } = await params;
    const body = await request.json() as Record<string, any>;

    if (!pupilId) {
      return NextResponse.json(
        { error: 'Pupil ID is required' },
        { status: 400 }
      );
    }

    if (actor.user.role !== 'Admin' && actor.user.role !== 'Staff') throw new CircumferenceError();
    await requireScopedPupil(actor, pupilId, body);
    const db = getFirestore(getFirebaseAdminApp());
    if (Object.prototype.hasOwnProperty.call(body, 'familyId')) {
      if (actor.user.role !== 'Admin' && actor.user.role !== 'Staff') {
        return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
      }
      const result = await transitionParentFamilyMembership({
        pupilIds: [pupilId],
        familyId: typeof body.familyId === 'string' && body.familyId.trim() ? body.familyId.trim() : null,
        preferredPupilId: pupilId,
      }, actor.user);
      await syncParentScopeClaims(result.claimUpdates);
      if (result.notifications.length > 0) {
        after(() => sendParentFamilyMembershipNotifications(result.notifications).catch(error => {
          console.error('[Pupil API] Family membership push failed:', error);
        }));
      }
      delete body.familyId;
    }
    delete body.parentAccountId;
    delete body.parentAccountActive;
    if (Object.keys(body).length > 0) {
      await updatePupilWithCacheRevision(db, db.collection('pupils').doc(pupilId), body, async transaction => {
        const [profile, pupil] = await Promise.all([transaction.get(db.collection('system_users').doc(actor.user.id)), transaction.get(db.collection('pupils').doc(pupilId))]);
        const current = profile.exists ? profile.data() as any : actor.user;
        if (current.isActive === false || !pupil.exists || !permitsPupil(circumferenceOf(current), pupil.data() as any) || !permitsPupil(circumferenceOf(current), {...pupil.data(), ...body} as any)) throw new CircumferenceError();
      });
    }

    if (['assignedFees', 'classId', 'section'].some(key => Object.prototype.hasOwnProperty.call(body, key))) await processFeeReminderChangeSafely({pupilIds: [pupilId]});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating pupil:', error);
    return NextResponse.json(
      { error: 'Failed to update pupil' },
      { status: error instanceof CircumferenceError ? error.status : String(error).includes('AUTH') || String(error).includes('INACTIVE') ? 401 : 500 }
    );
  }
}
