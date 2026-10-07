import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { createAndroidOfflineSession } from '@/lib/offline/android-session-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Read-only: the native app calls this over HTTPS with the current signed ID token. */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAppUser(request);
    const ids = new Set<string>();
    if (user.role === 'Parent') {
      const pupils = getFirestore(getFirebaseAdminApp()).collection('pupils');
      const bound = await pupils.where('parentAccountId', '==', user.id).get();
      bound.docs.forEach(document => ids.add(document.id));
      // Legacy families are allowed only when there is no conflicting account marker.
      if (user.familyId) {
        const family = await pupils.where('familyId', '==', user.familyId).get();
        family.docs.forEach(document => {
          const owner = document.data().parentAccountId;
          if (!owner || owner === user.id) ids.add(document.id);
        });
      } else if (user.pupilId) {
        const child = await pupils.doc(user.pupilId).get();
        if (child.exists && (!child.data()?.parentAccountId || child.data()?.parentAccountId === user.id)) ids.add(child.id);
      }
    }
    return NextResponse.json(createAndroidOfflineSession(user, [...ids]), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = (error as { code?: string })?.code || '';
    const denied = /AUTH|INACTIVE/.test(message) || ['auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/invalid-id-token', 'auth/argument-error'].includes(code);
    return NextResponse.json({ error: denied ? 'Sign in again to prepare offline access.' : 'Offline preparation is temporarily unavailable.' },
      { status: denied ? 401 : 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
