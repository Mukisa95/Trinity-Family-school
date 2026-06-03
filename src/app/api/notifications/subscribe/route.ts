import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── POST /api/notifications/subscribe ───────────────────────────────────────
// Body: { userId: string, subscription: { endpoint, keys: { p256dh, auth } } }
// Saves the browser PushSubscription to Firestore pushSubscriptions collection.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, subscription } = body;

    if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { error: 'userId, subscription.endpoint, subscription.keys.p256dh, and subscription.keys.auth are all required' },
        { status: 400 }
      );
    }

    const { saveSubscription } = await import('@/lib/services/push-notifications.service');
    const docId = await saveSubscription(userId, subscription);

    console.log(`✅ Push subscription saved for user ${userId} (doc: ${docId})`);
    return NextResponse.json({ success: true, subscriptionId: docId });
  } catch (error) {
    console.error('❌ Subscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to save subscription', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/notifications/subscribe ─────────────────────────────────────
// Body: { userId: string }
// Deactivates all push subscriptions for the user.

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const { deactivateUserSubscriptions } = await import('@/lib/services/push-notifications.service');
    await deactivateUserSubscriptions(userId);

    console.log(`✅ Push subscriptions deactivated for user ${userId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate subscriptions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
