import { NextRequest, NextResponse } from 'next/server';

// Only import web-push dynamically to prevent build-time errors
let webpush: any = null;

export const dynamic = 'force-dynamic';
export const revalidate = false;

export async function POST(request: NextRequest) {
  try {
    // Dynamic import to prevent build-time execution
    if (!webpush) {
      webpush = (await import('web-push')).default;
    }

    // VAPID configuration - only set when actually handling a request
const vapidKeys = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BL-P0JiVp1NIUsP4Xx2lF8Xw4QBd8fTlfMIgeg_uNGUwVvndQrr1JDf4wOwn0Q-lCvotMdAQ_KxXzVHYIB2AGIQ',
  privateKey: process.env.VAPID_PRIVATE_KEY || '1KBpMVExcpRBCUSYLUYc5ZZQGH3ohLJ4Y1iNBTnKM6A',
  email: process.env.VAPID_EMAIL || 'admin@trinity-family-schools.com'
};

    // Validate VAPID keys before setting them
    if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
      return NextResponse.json(
        { error: 'VAPID keys not configured' },
        { status: 500 }
      );
    }

    console.log('🔑 VAPID Debug:', {
      publicKeyLength: vapidKeys.publicKey.length,
      publicKeyStart: vapidKeys.publicKey.substring(0, 20),
      privateKeyLength: vapidKeys.privateKey.length,
      privateKeyStart: vapidKeys.privateKey.substring(0, 20),
      email: vapidKeys.email
    });

    // Set VAPID details
webpush.setVapidDetails(
      `mailto:${vapidKeys.email}`,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

    const { subscription, payload } = await request.json();

    if (!subscription || !payload) {
      return NextResponse.json(
        { error: 'Missing subscription or payload' },
        { status: 400 }
      );
    }

    // Validate subscription format
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { error: 'Invalid subscription format' },
        { status: 400 }
      );
    }

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/badge-72x72.png',
      image: payload.image,
      url: payload.url || '/notifications',
      tag: payload.tag || 'default',
      requireInteraction: payload.requireInteraction || false,
      actions: payload.actions || [],
      timestamp: Date.now()
    });

    console.log('📤 Sending push notification to:', {
      endpoint: subscription.endpoint.substring(0, 50) + '...',
      p256dhLength: subscription.keys?.p256dh?.length || 0,
      authLength: subscription.keys?.auth?.length || 0
    });

    // Send push notification
    const result = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      },
      notificationPayload,
      {
        TTL: 24 * 60 * 60, // 24 hours
        urgency: 'normal',
        topic: payload.tag || 'default'
      }
    );

    return NextResponse.json({
      success: true,
      statusCode: result.statusCode,
      headers: result.headers
    });

  } catch (error: any) {
    console.error('Push notification error:', error);

    // Handle specific web-push errors
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription is no longer valid
      return NextResponse.json(
        { 
          error: 'Subscription expired or invalid',
          statusCode: error.statusCode,
          shouldRemoveSubscription: true
        },
        { status: 410 }
      );
    }

    if (error.statusCode === 413) {
      return NextResponse.json(
        { error: 'Payload too large' },
        { status: 413 }
      );
    }

    if (error.statusCode === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to send push notification',
        details: error.message,
        statusCode: error.statusCode
      },
      { status: 500 }
    );
  }
}

// Add GET method to prevent build-time execution
export async function GET() {
  return NextResponse.json({ message: 'Push notification endpoint is ready' });
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 