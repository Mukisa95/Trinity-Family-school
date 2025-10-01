import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const { token, platform, appVersion, userId } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'FCM token is required' },
        { status: 400 }
      );
    }

    console.log('📱 Registering FCM token:', {
      tokenStart: token.substring(0, 20) + '...',
      platform,
      appVersion,
      userId: userId || 'anonymous'
    });

    // Store FCM token in Firestore
    const fcmTokenData = {
      token,
      platform: platform || 'android',
      appVersion: appVersion || '1.0',
      userId: userId || null,
      registeredAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      status: 'active'
    };

    const docRef = await addDoc(collection(db, 'fcmTokens'), fcmTokenData);

    console.log('✅ FCM token registered successfully:', docRef.id);

    return NextResponse.json({
      success: true,
      message: 'FCM token registered successfully',
      tokenId: docRef.id
    });

  } catch (error) {
    console.error('❌ FCM token registration error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to register FCM token',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
