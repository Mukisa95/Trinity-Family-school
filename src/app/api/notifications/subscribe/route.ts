import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/server/app-auth';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';

export const dynamic = 'force-dynamic';

function authErrorResponse(error: unknown, action: 'save' | 'deactivate') {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message)
    ? 401
    : message === 'ACCOUNT_INACTIVE'
      ? 403
      : 500;

  return NextResponse.json(
    {
      error: status === 401
        ? `Sign in to ${action === 'save' ? 'enable' : 'disable'} notifications.`
        : `Failed to ${action} push subscription`,
      details: message,
    },
    { status },
  );
}

/** Save or refresh this signed-in user's browser endpoint. */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    await ensureServerFirestoreAuth();
    const { userId, subscription, device } = await request.json();

    if (userId && userId !== actor.decoded.uid) {
      return NextResponse.json(
        { error: 'A device subscription can only be saved for the signed-in user.' },
        { status: 403 },
      );
    }

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { error: 'subscription.endpoint, subscription.keys.p256dh, and subscription.keys.auth are required.' },
        { status: 400 },
      );
    }

    const { saveSubscription } = await import('@/lib/services/push-notifications.service');
    const docId = await saveSubscription(actor.decoded.uid, subscription, device || {});

    console.log(`Push subscription saved for user ${actor.decoded.uid} (doc: ${docId})`);
    return NextResponse.json({ success: true, subscriptionId: docId });
  } catch (error) {
    console.error('Subscribe error:', error);
    return authErrorResponse(error, 'save');
  }
}

/** Deactivate only the current device endpoint, preserving the user's others. */
export async function DELETE(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    await ensureServerFirestoreAuth();
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint is required.' }, { status: 400 });
    }

    const { deactivateSubscriptionEndpoint } = await import(
      '@/lib/services/push-notifications.service'
    );
    await deactivateSubscriptionEndpoint(actor.decoded.uid, endpoint);

    console.log(`Push endpoint deactivated for user ${actor.decoded.uid}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return authErrorResponse(error, 'deactivate');
  }
}
