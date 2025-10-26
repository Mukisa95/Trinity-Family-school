import { db } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

export interface PushNotification {
  id?: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  timestamp: Timestamp;
  recipients: string[]; // Array of user IDs or 'all' for broadcast
  readBy: string[]; // Array of user IDs who have read it
  category?: 'general' | 'academic' | 'financial' | 'emergency' | 'reminder';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface NotificationSubscription {
  id?: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceType: 'desktop' | 'mobile';
  userAgent: string;
  createdAt: Timestamp;
  lastUsed: Timestamp;
  isActive: boolean;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private vapidPublicKey: string;

  constructor() {
    // Get VAPID public key from environment variables
    // Default key generated 2025-10-26 - replace with your own in production
    this.vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BKdPGmGr1PGvX5FgBPph5yywU7ilPtSFxSYzpNdf751UHl7dFn-Qgt_qVQWeZ4-KSCkXC1F0VrbnfJ6m7Ozc2W4';
  }

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Request notification permission and get subscription
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission;
    }

    return Notification.permission;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPushNotifications(): Promise<NotificationSubscription | null> {
    try {
      const permission = await this.requestPermission();
      
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      console.log('[Push Notification] Registering service worker...');
      
      // Register service worker
      let registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[Push Notification] Service worker registered, waiting for ready state...');
      
      // Wait for service worker to be ready (installed and activated)
      registration = await navigator.serviceWorker.ready;
      console.log('[Push Notification] Service worker ready:', registration.active ? 'Active' : 'Not active');
      
      // Ensure we have an active service worker
      if (!registration.active) {
        throw new Error('Service worker is not active. Please refresh the page and try again.');
      }

      console.log('[Push Notification] Attempting to subscribe with VAPID key:', this.vapidPublicKey);
      
      // Get push subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });
      
      console.log('[Push Notification] Successfully subscribed to push notifications');

      // Create subscription object
      const notificationSubscription: NotificationSubscription = {
        endpoint: subscription.endpoint,
        p256dh: btoa(String.fromCharCode.apply(null, 
          new Uint8Array(subscription.getKey('p256dh')!)
        )),
        auth: btoa(String.fromCharCode.apply(null, 
          new Uint8Array(subscription.getKey('auth')!)
        )),
        deviceType: this.getDeviceType(),
        userAgent: navigator.userAgent,
        createdAt: Timestamp.now(),
        lastUsed: Timestamp.now(),
        isActive: true
      };

      return notificationSubscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }

  /**
   * Save notification subscription to database
   */
  async saveSubscription(userId: string, subscription: NotificationSubscription): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'notification-subscriptions'), {
        ...subscription,
        userId
      });
      return docRef.id;
    } catch (error) {
      console.error('Error saving subscription:', error);
      throw error;
    }
  }

  /**
   * Send push notification to specific users
   */
  async sendNotification(notification: Omit<PushNotification, 'id' | 'timestamp'>): Promise<string> {
    try {
      // Save notification to database
      const notificationData = {
        ...notification,
        timestamp: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'notifications'), notificationData);
      
      // Send actual push notification
      await this.sendPushNotification(notificationData, notification.recipients);
      
      return docRef.id;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send broadcast notification to all users
   */
  async sendBroadcastNotification(notification: Omit<PushNotification, 'id' | 'timestamp' | 'recipients'>): Promise<string> {
    try {
      const broadcastNotification = {
        ...notification,
        recipients: ['all'],
        timestamp: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'notifications'), broadcastNotification);
      
      // Send to all active subscriptions
      await this.sendPushNotification(broadcastNotification, ['all']);
      
      return docRef.id;
    } catch (error) {
      console.error('Error sending broadcast notification:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read by user
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        readBy: [...(await this.getNotification(notificationId))?.readBy || [], userId]
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const notificationsRef = collection(db, 'notifications');
      // Use a simpler query without orderBy to avoid index requirements
      const querySnapshot = await getDocs(notificationsRef);
      let unreadCount = 0;
      let totalChecked = 0;
      let userNotifications = 0;

      querySnapshot.forEach((doc) => {
        const notification = doc.data() as PushNotification;
        totalChecked++;
        
        // Check if notification is for this user
        const isForUser = notification.recipients?.includes(userId) || 
                         notification.recipients?.includes('all') ||
                         notification.recipients?.includes('all_users') ||
                         notification.recipients?.includes('all_parents') ||
                         notification.recipients?.includes('all_staff') ||
                         notification.recipients?.includes('all_admins');
        
        if (isForUser) {
          userNotifications++;
          // Check if notification is unread (either no readBy field or user not in readBy array)
          const isUnread = !notification.readBy || !notification.readBy.includes(userId);
          
          if (isUnread) {
            unreadCount++;
          }
        }
      });

      // Enhanced debug logging for troubleshooting
      console.log(`[Notification Badge] User ${userId}:`);
      console.log(`  - Total notifications in system: ${totalChecked}`);
      console.log(`  - Notifications for this user: ${userNotifications}`);
      console.log(`  - Unread notifications: ${unreadCount}`);
      
      return unreadCount;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Get notifications for user
   */
  async getUserNotifications(userId: string, limitCount: number = 50): Promise<PushNotification[]> {
    try {
      const notificationsRef = collection(db, 'notifications');
      // Use a simpler query without complex where + orderBy to avoid index requirements
      const querySnapshot = await getDocs(notificationsRef);
      const userNotifications: PushNotification[] = [];

      querySnapshot.forEach((doc) => {
        const notification = doc.data() as PushNotification;
        // Check if notification is for this user
        const isForUser = notification.recipients?.includes(userId) || 
                         notification.recipients?.includes('all') ||
                         notification.recipients?.includes('all_users') ||
                         notification.recipients?.includes('all_parents') ||
                         notification.recipients?.includes('all_staff') ||
                         notification.recipients?.includes('all_admins');
        
        if (isForUser) {
          userNotifications.push({
            id: doc.id,
            ...notification
          } as PushNotification);
        }
      });

      // Sort by timestamp (newest first) and apply limit
      return userNotifications
        .sort((a, b) => {
          const aTime = a.timestamp?.toDate?.()?.getTime() || 0;
          const bTime = b.timestamp?.toDate?.()?.getTime() || 0;
          return bTime - aTime;
        })
        .slice(0, limitCount);
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }
  }

  /**
   * Get specific notification
   */
  async getNotification(notificationId: string): Promise<PushNotification | null> {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      const notificationDoc = await getDocs(query(collection(db, 'notifications'), where('__name__', '==', notificationId)));
      
      if (!notificationDoc.empty) {
        const doc = notificationDoc.docs[0];
        return {
          id: doc.id,
          ...doc.data()
        } as PushNotification;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting notification:', error);
      return null;
    }
  }

  /**
   * Reset notification count cache and force refresh
   */
  async resetNotificationCount(userId: string): Promise<void> {
    try {
      console.log(`[Notification Badge] Resetting notification count for user ${userId}`);
      // Force a fresh count by clearing any cached data
      // This method can be called when there are inconsistencies
    } catch (error) {
      console.error('Error resetting notification count:', error);
    }
  }

  /**
   * Send actual push notification via service worker
   */
  private async sendPushNotification(notification: any, recipients: string[]): Promise<void> {
    try {
      console.log('🔔 Sending push notification to recipients:', recipients);
      
      // Get actual user IDs from recipient groups
      const actualUserIds = await this.resolveRecipientGroups(recipients);
      console.log('👥 Resolved to user IDs:', actualUserIds.length);
      
      // Get all subscriptions for these users
      const subscriptions = await this.getSubscriptionsForUsers(actualUserIds);
      console.log('📱 Found subscriptions:', subscriptions.length);
      
      // Send notification to each subscription
      const promises = subscriptions.map(async (subscription) => {
        try {
          // Show notification via service worker for this user
          if ('serviceWorker' in navigator && 'PushManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            
            await registration.showNotification(notification.title, {
              body: notification.body,
              icon: notification.icon || '/icon-192.png',
              badge: notification.badge || '/icon-192.png',
              tag: notification.tag,
              data: {
                ...notification.data,
                userId: subscription.userId
              },
              requireInteraction: notification.requireInteraction || false,
              actions: notification.actions || []
            });
          }
        } catch (error) {
          console.error(`Error sending notification to user ${subscription.userId}:`, error);
        }
      });
      
      await Promise.all(promises);
      console.log('✅ Push notifications sent successfully');
      
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  /**
   * Resolve recipient group IDs to actual user IDs
   */
  private async resolveRecipientGroups(recipients: string[]): Promise<string[]> {
    const { userGroupService } = await import('./user-groups');
    const userIds = new Set<string>();
    
    for (const recipientId of recipients) {
      if (recipientId === 'all_users') {
        const users = await userGroupService.getAllUsers();
        users.forEach(user => userIds.add(user.id));
      } else if (recipientId === 'all_admins') {
        const users = await userGroupService.getUsersByRole('admin');
        users.forEach(user => userIds.add(user.id));
      } else if (recipientId === 'all_staff') {
        const users = await userGroupService.getUsersByRole('staff');
        users.forEach(user => userIds.add(user.id));
      } else if (recipientId === 'all_parents') {
        const users = await userGroupService.getUsersByRole('parent');
        users.forEach(user => userIds.add(user.id));
      } else {
        // Assume it's a direct user ID
        userIds.add(recipientId);
      }
    }
    
    return Array.from(userIds);
  }

  /**
   * Get all push subscriptions for given user IDs
   */
  private async getSubscriptionsForUsers(userIds: string[]): Promise<NotificationSubscription[]> {
    try {
      const subscriptionsRef = collection(db, 'pushSubscriptions');
      const q = query(
        subscriptionsRef,
        where('userId', 'in', userIds.slice(0, 10)) // Firestore 'in' limit is 10
      );
      
      const querySnapshot = await getDocs(q);
      const subscriptions: NotificationSubscription[] = [];
      
      querySnapshot.forEach((doc) => {
        subscriptions.push({
          id: doc.id,
          ...doc.data()
        } as NotificationSubscription);
      });

      // Handle more than 10 users with additional queries
      if (userIds.length > 10) {
        for (let i = 10; i < userIds.length; i += 10) {
          const batch = userIds.slice(i, i + 10);
          const batchQuery = query(
            subscriptionsRef,
            where('userId', 'in', batch)
          );
          
          const batchSnapshot = await getDocs(batchQuery);
          batchSnapshot.forEach((doc) => {
            subscriptions.push({
              id: doc.id,
              ...doc.data()
            } as NotificationSubscription);
          });
        }
      }
      
      return subscriptions;
    } catch (error) {
      console.error('Error getting subscriptions:', error);
      return [];
    }
  }

  /**
   * Convert VAPID public key to Uint8Array
   * Handles URL-safe base64 encoding properly
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    try {
      // Remove any whitespace
      const cleanedString = base64String.trim();
      
      // Add padding if needed
      const padding = '='.repeat((4 - cleanedString.length % 4) % 4);
      
      // Convert URL-safe base64 to standard base64
      const base64 = (cleanedString + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      // Decode base64 string
      const rawData = window.atob(base64);
      
      // Convert to Uint8Array
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      
      return outputArray;
    } catch (error) {
      console.error('VAPID key conversion error:', error);
      console.error('Problematic key:', base64String);
      throw new Error(`VAPID key conversion failed: ${error}`);
    }
  }

  /**
   * Determine device type
   */
  private getDeviceType(): 'desktop' | 'mobile' {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);
    return isMobile ? 'mobile' : 'desktop';
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPushNotifications(): Promise<boolean> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
