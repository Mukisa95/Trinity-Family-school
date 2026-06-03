import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';

/**
 * Native Push Token stored in Firestore
 */
export interface NativePushToken {
  id?: string;
  userId: string;
  token: string;
  platform: 'android' | 'ios' | 'web';
  deviceInfo: {
    platform: string;
    manufacturer: string;
    model: string;
    osVersion: string;
  };
  isActive: boolean;
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
  lastUsed: Timestamp | ReturnType<typeof serverTimestamp>;
  deactivatedAt?: Timestamp | ReturnType<typeof serverTimestamp>;
  deactivationReason?: string;
}

/**
 * Native Push Notification Service for Capacitor
 * Handles native push notifications on Android/iOS using FCM
 * 
 * KEY DIFFERENCE from Web Push:
 * - Web Push: Works only when browser is running
 * - Native Push: Works even when app is completely closed ✅
 */
class NativePushService {
  private static instance: NativePushService;
  private currentUserId: string | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): NativePushService {
    if (!NativePushService.instance) {
      NativePushService.instance = new NativePushService();
    }
    return NativePushService.instance;
  }

  /**
   * Check if we're running in a native Capacitor environment
   */
  public isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Initialize push notifications for native platform
   * This registers the device with FCM and sets up listeners
   */
  public async initialize(userId: string): Promise<void> {
    if (!this.isNativePlatform()) {
      console.log('📱 Not a native platform, skipping native push initialization');
      return;
    }

    if (this.isInitialized && this.currentUserId === userId) {
      console.log('✅ Native push already initialized for this user');
      return;
    }

    this.currentUserId = userId;
    console.log('🚀 Initializing native push notifications for user:', userId);

    try {
      // 1. Check permission status
      let permStatus = await PushNotifications.checkPermissions();
      console.log('📋 Current permission status:', permStatus.receive);

      // 2. Request permission if needed
      if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
        console.log('🔔 Requesting push notification permission...');
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('⚠️ Push notification permission denied');
        throw new Error('Push notification permission denied');
      }

      console.log('✅ Push notification permission granted');

      // 3. Setup listeners BEFORE registering (important!)
      this.setupListeners(userId);

      // 4. Register for push notifications (this will trigger 'registration' listener)
      await PushNotifications.register();
      console.log('📝 Registered for native push notifications');

      this.isInitialized = true;

    } catch (error) {
      console.error('❌ Error initializing native push:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for push notifications
   */
  private setupListeners(userId: string): void {
    console.log('🎧 Setting up native push listeners...');

    // Remove all existing listeners first to avoid duplicates
    PushNotifications.removeAllListeners();

    // Listen for registration success (get FCM token)
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('✅ Native push registration success!');
      console.log('🔑 FCM Token:', token.value);
      
      // Save token to Firestore
      try {
        await this.saveTokenToDatabase(userId, token.value);
      } catch (error) {
        console.error('❌ Failed to save FCM token:', error);
      }
    });

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('❌ Native push registration error:', error);
    });

    // Listen for push notifications received (app is open)
    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('📬 Push notification received (app open):', notification);
        
        // Update badge count if provided
        if (notification.badge) {
          console.log('🔢 Updating badge count:', notification.badge);
        }
        
        // Handle notification received while app is open
        this.handleNotificationReceived(notification);
      }
    );

    // Listen for push notification actions (user tapped notification)
    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('👆 Push notification action performed:', action);
        console.log('📊 Action:', action.actionId);
        console.log('📋 Notification data:', action.notification.data);
        
        // Navigate to notification details or specific page
        this.handleNotificationAction(action);
      }
    );

    console.log('✅ Native push listeners setup complete');
  }

  /**
   * Save FCM token to Firestore
   */
  private async saveTokenToDatabase(userId: string, token: string): Promise<void> {
    try {
      console.log('💾 Saving FCM token to database...');

      // Check if token already exists for this user
      const tokensRef = collection(db, 'nativePushTokens');
      const q = query(
        tokensRef,
        where('userId', '==', userId),
        where('token', '==', token)
      );
      const existingTokens = await getDocs(q);

      if (!existingTokens.empty) {
        console.log('ℹ️ Token already exists, updating lastUsed...');
        const tokenDoc = existingTokens.docs[0];
        await updateDoc(doc(db, 'nativePushTokens', tokenDoc.id), {
          lastUsed: serverTimestamp(),
          isActive: true
        });
        return;
      }

      // Deactivate old tokens for this user on this platform
      const oldTokensQuery = query(
        tokensRef,
        where('userId', '==', userId),
        where('platform', '==', Capacitor.getPlatform())
      );
      const oldTokens = await getDocs(oldTokensQuery);
      
      console.log(`🧹 Deactivating ${oldTokens.docs.length} old token(s)...`);
      for (const tokenDoc of oldTokens.docs) {
        await updateDoc(doc(db, 'nativePushTokens', tokenDoc.id), {
          isActive: false,
          deactivatedAt: serverTimestamp(),
          deactivationReason: 'new_token_registered'
        });
      }

      // Get device info
      const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';
      const deviceInfo = {
        platform: platform,
        manufacturer: 'unknown',
        model: 'unknown',
        osVersion: 'unknown'
      };

      // Save new token
      await addDoc(tokensRef, {
        userId,
        token,
        platform,
        deviceInfo,
        isActive: true,
        createdAt: serverTimestamp(),
        lastUsed: serverTimestamp()
      });

      console.log('✅ FCM token saved to database successfully');

    } catch (error) {
      console.error('❌ Error saving FCM token to database:', error);
      throw error;
    }
  }

  /**
   * Handle notification received while app is open
   * Optional: Show local notification or update UI
   */
  private handleNotificationReceived(notification: PushNotificationSchema): void {
    console.log('📨 Handling received notification:', notification.title);
    
    // Trigger a custom event that the UI can listen to
    window.dispatchEvent(new CustomEvent('native-push-received', {
      detail: notification
    }));
    
    // Note: By default, notifications are NOT shown when app is open
    // If you want to show them, use the code below:
    
    // Optional: Show local notification even when app is open
    // This is useful if you want notifications to appear in the notification tray
    // even when the user is actively using the app
    /*
    PushNotifications.createChannel({
      id: 'default',
      name: 'Default Channel',
      description: 'Default notification channel',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true
    }).then(() => {
      // Channel created, notification will appear
    }).catch(error => {
      console.error('Error creating notification channel:', error);
    });
    */
  }

  /**
   * Handle notification action (user tapped notification)
   */
  private handleNotificationAction(action: ActionPerformed): void {
    console.log('🎯 Handling notification action:', action.notification.title);
    
    const data = action.notification.data;
    
    // Navigate based on notification data
    if (data && data.url) {
      console.log('🔗 Navigating to:', data.url);
      // Use router if available, otherwise fallback to window.location
      if (typeof window !== 'undefined') {
        window.location.href = data.url;
      }
    } else if (data && data.notificationId) {
      // Navigate to specific notification
      console.log('🔗 Navigating to notification:', data.notificationId);
      if (typeof window !== 'undefined') {
        window.location.href = `/notifications?id=${data.notificationId}`;
      }
    } else {
      // Default: navigate to notifications page
      console.log('🔗 Navigating to notifications page');
      if (typeof window !== 'undefined') {
        window.location.href = '/notifications';
      }
    }
  }

  /**
   * Unsubscribe from push notifications
   * This marks the token as inactive in the database
   */
  public async unsubscribe(userId: string): Promise<void> {
    if (!this.isNativePlatform()) {
      console.log('📱 Not a native platform, skipping unsubscribe');
      return;
    }

    try {
      console.log('🔕 Unsubscribing from native push notifications...');

      // Get current token
      const tokensRef = collection(db, 'nativePushTokens');
      const q = query(
        tokensRef,
        where('userId', '==', userId),
        where('isActive', '==', true),
        where('platform', '==', Capacitor.getPlatform())
      );
      const tokens = await getDocs(q);

      // Deactivate all active tokens
      for (const tokenDoc of tokens.docs) {
        await updateDoc(doc(db, 'nativePushTokens', tokenDoc.id), {
          isActive: false,
          deactivatedAt: serverTimestamp(),
          deactivationReason: 'user_unsubscribed'
        });
      }

      console.log('✅ Unsubscribed from native push notifications');

    } catch (error) {
      console.error('❌ Error unsubscribing from native push:', error);
      throw error;
    }
  }

  /**
   * Get current subscription status
   */
  public async getSubscriptionStatus(userId: string): Promise<{
    isSubscribed: boolean;
    token: string | null;
    platform: string | null;
  }> {
    if (!this.isNativePlatform()) {
      return { isSubscribed: false, token: null, platform: null };
    }

    try {
      const tokensRef = collection(db, 'nativePushTokens');
      const q = query(
        tokensRef,
        where('userId', '==', userId),
        where('isActive', '==', true),
        where('platform', '==', Capacitor.getPlatform())
      );
      const tokens = await getDocs(q);

      if (tokens.empty) {
        return { isSubscribed: false, token: null, platform: null };
      }

      const tokenDoc = tokens.docs[0];
      const data = tokenDoc.data();
      return {
        isSubscribed: true,
        token: data.token,
        platform: data.platform
      };

    } catch (error) {
      console.error('❌ Error checking subscription status:', error);
      return { isSubscribed: false, token: null, platform: null };
    }
  }

  /**
   * Get all active tokens for a user (all devices)
   */
  public async getAllActiveTokens(userId: string): Promise<NativePushToken[]> {
    try {
      const tokensRef = collection(db, 'nativePushTokens');
      const q = query(
        tokensRef,
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
      const tokenDocs = await getDocs(q);

      return tokenDocs.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as NativePushToken));

    } catch (error) {
      console.error('❌ Error getting active tokens:', error);
      return [];
    }
  }

  /**
   * Check permission status without requesting
   */
  public async checkPermissions(): Promise<'granted' | 'denied' | 'prompt'> {
    if (!this.isNativePlatform()) {
      return 'denied';
    }

    try {
      const permStatus = await PushNotifications.checkPermissions();
      return permStatus.receive as 'granted' | 'denied' | 'prompt';
    } catch (error) {
      console.error('❌ Error checking permissions:', error);
      return 'denied';
    }
  }

  /**
   * Request permissions explicitly
   */
  public async requestPermissions(): Promise<'granted' | 'denied'> {
    if (!this.isNativePlatform()) {
      return 'denied';
    }

    try {
      const permStatus = await PushNotifications.requestPermissions();
      return permStatus.receive === 'granted' ? 'granted' : 'denied';
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return 'denied';
    }
  }
}

export const nativePushService = NativePushService.getInstance();

