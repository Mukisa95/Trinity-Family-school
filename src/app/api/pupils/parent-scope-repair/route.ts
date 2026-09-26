import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { planParentAccountScopeRepair } from '@/lib/parent-account-scope-repair';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/**
 * A zero-result parent listener can be a pre-link account created before the
 * pupil account marker rollout. Repair only this authenticated account, once
 * on that exceptional path; normal dashboard loads do not call this endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (actor.user.role !== 'Parent') {
      return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
    }

    const db = getFirestore(getFirebaseAdminApp());
    const linked = await db.runTransaction(async transaction => {
      const pupilId = text(actor.rawUser.pupilId);
      const profileFamilyId = text(actor.rawUser.familyId);
      const anchor = pupilId
        ? await transaction.get(db.collection('pupils').doc(pupilId))
        : null;
      const anchorFamilyId = text(anchor?.data()?.familyId);
      const familyId = profileFamilyId || anchorFamilyId;
      if (profileFamilyId && anchor?.exists && anchorFamilyId !== profileFamilyId) {
        throw new Error('ACCOUNT_SCOPE_CONFLICT');
      }
      if (!familyId && !anchor?.exists) return 0;

      const family = familyId
        ? await transaction.get(db.collection('pupils').where('familyId', '==', familyId))
        : null;
      const pupils = familyId ? family!.docs : [anchor!];
      if (pupils.length > 100) throw new Error('ACCOUNT_SCOPE_CONFLICT');
      if (pupils.length === 0) return 0;

      // Never repair an ambiguous family. In particular, an old duplicate
      // account must not gain access just because its own marker query is empty.
      const accountsByFamily = familyId
        ? await transaction.get(db.collection('system_users').where('familyId', '==', familyId))
        : null;
      const competingFamilyAccount = accountsByFamily?.docs.some(document => (
        document.id !== actor.user.id
        && document.data().role === 'Parent'
        && document.data().isActive !== false
      ));
      let competingAccount = Boolean(competingFamilyAccount);

      const ids = pupils.map(pupil => pupil.id);
      for (let start = 0; start < ids.length; start += 30) {
        const matching = await transaction.get(db.collection('system_users')
          .where('pupilId', 'in', ids.slice(start, start + 30)));
        if (matching.docs.some(document => (
          document.id !== actor.user.id
          && document.data().role === 'Parent'
          && document.data().isActive !== false
        ))) competingAccount = true;
      }

      const toRepair = new Set(planParentAccountScopeRepair(
        actor.user.id,
        pupils.map(pupil => ({
          id: pupil.id,
          parentAccountId: pupil.data()?.parentAccountId,
          parentAccountActive: pupil.data()?.parentAccountActive,
        })),
        competingAccount,
      ));
      for (const pupil of pupils) {
        if (!toRepair.has(pupil.id)) continue;
        transaction.update(pupil.ref, {
          parentAccountId: actor.user.id,
          parentAccountActive: true,
          parentAccountLinkBackfilledAt: FieldValue.serverTimestamp(),
        });
      }
      return toRepair.size;
    });
    return NextResponse.json({ linked });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('AUTH') || message === 'ACCOUNT_INACTIVE') {
      return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
    }
    if (message === 'ACCOUNT_SCOPE_CONFLICT') {
      return NextResponse.json({ error: 'This parent account needs the school to resolve an existing family link.' }, { status: 409 });
    }
    console.error('[Parent Scope Repair] Could not repair account links:', error);
    return NextResponse.json({ error: 'Pupil information could not be synchronized.' }, { status: 500 });
  }
}
