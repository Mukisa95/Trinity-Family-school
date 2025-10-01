import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { recipients, payload } = await request.json();

    if (!payload) {
      return NextResponse.json(
        { error: 'Notification payload is required' },
        { status: 400 }
      );
    }

    console.log('🚀 Sending unified notifications:', {
      recipientsType: recipients?.type || 'all',
      title: payload.title,
      body: payload.body
    });

    const results = {
      webPush: { success: 0, failed: 0, errors: [] },
      fcm: { success: 0, failed: 0, errors: [] },
      total: { success: 0, failed: 0 }
    };

    // Send Web Push Notifications
    try {
      const webPushResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9004'}/api/notifications/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // For testing, we'll need actual subscriptions
          subscription: {
            endpoint: 'test',
            keys: { p256dh: 'test', auth: 'test' }
          },
          payload
        })
      });

      if (webPushResponse.ok) {
        results.webPush.success = 1;
        results.total.success += 1;
        console.log('✅ Web push notification sent');
      } else {
        results.webPush.failed = 1;
        results.total.failed += 1;
        results.webPush.errors.push('Web push failed');
        console.log('❌ Web push notification failed');
      }
    } catch (error) {
      results.webPush.failed = 1;
      results.total.failed += 1;
      results.webPush.errors.push(error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ Web push error:', error);
    }

    // Send FCM Notifications
    try {
      const fcmResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9004'}/api/notifications/send-fcm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: recipients?.userId || null,
          payload
        })
      });

      const fcmData = await fcmResponse.json();
      
      if (fcmResponse.ok) {
        results.fcm.success = fcmData.tokensFound || 0;
        results.total.success += results.fcm.success;
        console.log(`✅ FCM notifications queued for ${fcmData.tokensFound} devices`);
      } else {
        results.fcm.failed = 1;
        results.total.failed += 1;
        results.fcm.errors.push('FCM sending failed');
        console.log('❌ FCM notification failed');
      }
    } catch (error) {
      results.fcm.failed = 1;
      results.total.failed += 1;
      results.fcm.errors.push(error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ FCM error:', error);
    }

    console.log('📊 Unified notification results:', results);

    return NextResponse.json({
      success: true,
      message: `Unified notifications processed: ${results.total.success} success, ${results.total.failed} failed`,
      results
    });

  } catch (error) {
    console.error('❌ Unified notification error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to send unified notifications',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
