import admin from 'firebase-admin';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

/**
 * FCM (Firebase Cloud Messaging) Service for Native Push
 * Sends push notifications to Android/iOS devices using Firebase Admin SDK
 * 
 * KEY DIFFERENCE from Web Push:
 * - Web Push: Requires browser/service worker to be running
 * - FCM: Delivered by Google/Apple push servers, works when app is closed ✅
 */
class FCMPushService {
  private static instance: FCMPushService;
  private isInitialized: boolean = false;

  private constructor() {
    this.initializeFirebaseAdmin();
  }

  public static getInstance(): FCMPushService {
    if (!FCMPushService.instance) {
      FCMPushService.instance = new FCMPushService();
    }
    return FCMPushService.instance;
  }

  /**
   * Initialize Firebase Admin SDK (server-side only)
   */
  private initializeFirebaseAdmin(): void {
    // Only initialize on server-side
    if (typeof window !== 'undefined') {
      console.log('⚠️ FCM Push Service should only run on server-side');
      return;
    }

    // Check if already initialized
    if (admin.apps.length > 0) {
      console.log('✅ Firebase Admin already initialized');
      this.isInitialized = true;
      return;
    }

    try {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        console.error('❌ Missing Firebase Admin credentials in environment variables');
        console.error('Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
        return;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

      console.log('✅ Firebase Admin initialized for FCM');
      this.isInitialized = true;

    } catch (error) {
      console.error('❌ Firebase Admin initialization error:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Send push notification to specific user (all their devices)
   */
  public async sendToUser(userId: string, notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
    badge?: number;
  }): Promise<{ success: boolean; sentCount: number; error?: string }> {
    if (!this.isInitialized) {
      return { success: false, sentCount: 0, error: 'FCM not initialized' };
    }

    try {
      console.log(`📤 Sending native push to user ${userId}...`);

      // Get user's FCM tokens from Firestore
      const tokensRef = collection(db, 'nativePushTokens');
      const q = query(
        tokensRef,
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
      const tokenDocs = await getDocs(q);

      if (tokenDocs.empty) {
        console.log(`ℹ️ No active FCM tokens found for user ${userId}`);
        return { success: false, sentCount: 0, error: 'No active tokens' };
      }

      // Get all tokens
      const tokens = tokenDocs.docs.map(doc => doc.data().token);
      console.log(`📋 Found ${tokens.length} active token(s) for user ${userId}`);

      // Prepare FCM message
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          ...notification.data,
          // Ensure all data values are strings (FCM requirement)
          timestamp: new Date().toISOString(),
        },
        tokens: tokens,
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            priority: 'high' as any,
            defaultSound: true,
            defaultVibrateTimings: true,
            notificationCount: notification.badge,
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: notification.badge || 0,
              contentAvailable: true,
            }
          },
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert'
          }
        }
      };

      // Send via FCM
      const response = await admin.messaging().sendEachForMulticast(message);

      console.log(`✅ Native push sent: ${response.successCount} success, ${response.failureCount} failed`);

      // Handle failed tokens (remove invalid ones)
      if (response.failureCount > 0) {
        await this.handleFailedTokens(tokenDocs.docs, response.responses);
      }

      return {
        success: response.successCount > 0,
        sentCount: response.successCount,
        error: response.failureCount > 0 ? `${response.failureCount} failed` : undefined
      };

    } catch (error) {
      console.error('❌ Error sending native push:', error);
      return {
        success: false,
        sentCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send push notification to multiple users
   */
  public async sendToUsers(userIds: string[], notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
    badge?: number;
  }): Promise<{
    totalSent: number;
    totalFailed: number;
    results: Record<string, { success: boolean; count: number }>;
  }> {
    if (!this.isInitialized) {
      console.error('❌ FCM not initialized');
      return {
        totalSent: 0,
        totalFailed: userIds.length,
        results: Object.fromEntries(userIds.map(id => [id, { success: false, count: 0 }]))
      };
    }

    console.log(`📤 Sending native push to ${userIds.length} users...`);

    const results: Record<string, { success: boolean; count: number }> = {};
    let totalSent = 0;
    let totalFailed = 0;

    // Process in batches to avoid overwhelming Firebase
    const batchSize = 500; // FCM allows 500 tokens per request
    
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      
      // Send to each user in the batch
      const batchPromises = batch.map(async (userId) => {
        const result = await this.sendToUser(userId, notification);
        results[userId] = { success: result.success, count: result.sentCount };
        
        if (result.success) {
          totalSent += result.sentCount;
        } else {
          totalFailed++;
        }
      });

      await Promise.all(batchPromises);
    }

    console.log(`✅ Batch native push complete: ${totalSent} sent, ${totalFailed} failed`);

    return { totalSent, totalFailed, results };
  }

  /**
   * Send push notification to all tokens directly (more efficient for large batches)
   */
  public async sendToTokens(tokens: string[], notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
    badge?: number;
  }): Promise<{ successCount: number; failureCount: number }> {
    if (!this.isInitialized) {
      return { successCount: 0, failureCount: tokens.length };
    }

    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    try {
      console.log(`📤 Sending native push to ${tokens.length} token(s)...`);

      // FCM allows max 500 tokens per request
      const batchSize = 500;
      let totalSuccess = 0;
      let totalFailure = 0;

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batchTokens = tokens.slice(i, i + batchSize);

        const message: admin.messaging.MulticastMessage = {
          notification: {
            title: notification.title,
            body: notification.body,
          },
          data: {
            ...notification.data,
            timestamp: new Date().toISOString(),
          },
          tokens: batchTokens,
          android: {
            priority: 'high',
            notification: {
              channelId: 'default',
              priority: 'high' as any,
              defaultSound: true,
              defaultVibrateTimings: true,
              notificationCount: notification.badge,
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: notification.badge || 0,
                contentAvailable: true,
              }
            },
            headers: {
              'apns-priority': '10',
              'apns-push-type': 'alert'
            }
          }
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        totalSuccess += response.successCount;
        totalFailure += response.failureCount;

        console.log(`  Batch ${Math.floor(i / batchSize) + 1}: ${response.successCount} success, ${response.failureCount} failed`);
      }

      console.log(`✅ Total: ${totalSuccess} success, ${totalFailure} failed`);

      return { successCount: totalSuccess, failureCount: totalFailure };

    } catch (error) {
      console.error('❌ Error sending to tokens:', error);
      return { successCount: 0, failureCount: tokens.length };
    }
  }

  /**
   * Remove invalid/expired FCM tokens from database
   */
  private async handleFailedTokens(
    tokenDocs: any[],
    responses: admin.messaging.SendResponse[]
  ): Promise<void> {
    console.log('🧹 Cleaning up invalid FCM tokens...');

    const cleanupPromises: Promise<void>[] = [];

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      if (!response.success && response.error) {
        const error = response.error;
        
        // If token is invalid or not registered, deactivate it
        if (
          error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered' ||
          error.code === 'messaging/invalid-argument'
        ) {
          const tokenDoc = tokenDocs[i];
          if (tokenDoc) {
            console.log(`🗑️ Deactivating invalid token: ${error.code}`);
            
            cleanupPromises.push(
              updateDoc(doc(db, 'nativePushTokens', tokenDoc.id), {
                isActive: false,
                deactivatedAt: serverTimestamp(),
                deactivationReason: error.code
              })
            );
          }
        }
      }
    }

    if (cleanupPromises.length > 0) {
      await Promise.all(cleanupPromises);
      console.log(`✅ Cleaned up ${cleanupPromises.length} invalid token(s)`);
    }
  }

  /**
   * Test if FCM is properly configured
   */
  public async testConfiguration(): Promise<{ success: boolean; message: string }> {
    if (!this.isInitialized) {
      return {
        success: false,
        message: 'Firebase Admin not initialized. Check environment variables.'
      };
    }

    try {
      // Try to get the Firebase app
      const app = admin.app();
      
      return {
        success: true,
        message: `FCM configured successfully for project: ${app.options.projectId}`
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get FCM server key (for debugging)
   */
  public getServerKeyInfo(): { hasCredentials: boolean; projectId?: string } {
    if (!this.isInitialized) {
      return { hasCredentials: false };
    }

    try {
      const app = admin.app();
      return {
        hasCredentials: true,
        projectId: app.options.projectId
      };
    } catch {
      return { hasCredentials: false };
    }
  }
}

export const fcmPushService = FCMPushService.getInstance();

