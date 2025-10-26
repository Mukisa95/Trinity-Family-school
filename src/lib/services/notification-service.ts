import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { pushNotificationService } from './push-notification';
import { userGroupService } from './user-groups';
import type { 
  Notification, 
  CreateNotificationData, 
  NotificationDelivery, 
  PushSubscription as PushSubscriptionType,
  User 
} from '@/types';

class NotificationService {
  // Send a notification to all specified recipients
  async sendNotification(notificationData: CreateNotificationData): Promise<{
    notification: Notification;
    deliveries: NotificationDelivery[];
    stats: {
      totalRecipients: number;
      pushSent: number;
      pushFailed: number;
      inAppSent: number;
    };
  }> {
    try {
      // Create the notification document
      const notification = await this.createNotification(notificationData);

      // Get all target users
      const targetUsers = await userGroupService.getUsersByRecipients(notificationData.recipients);
      
      const deliveries: NotificationDelivery[] = [];
      let pushSent = 0;
      let pushFailed = 0;
      let inAppSent = 0;

      // Send push notifications if enabled
      if (notificationData.enablePush) {
        const pushDeliveries = await this.sendPushNotifications(notification, targetUsers);
        deliveries.push(...pushDeliveries);
        
        pushSent = pushDeliveries.filter(d => d.status === 'sent').length;
        pushFailed = pushDeliveries.filter(d => d.status === 'failed').length;
      }

      // Create in-app notifications for all users
      const inAppDeliveries = await this.createInAppNotifications(notification, targetUsers);
      deliveries.push(...inAppDeliveries);
      inAppSent = inAppDeliveries.length;

      // Update notification with delivery stats
      const updatedNotification = await this.updateNotificationStats(notification.id, {
        total: targetUsers.length,
        sent: pushSent + inAppSent,
        delivered: pushSent, // Push notifications are considered delivered when sent
        failed: pushFailed,
        read: 0
      });

      // Save delivery records to Firestore
      await this.saveDeliveryRecords(deliveries);

      return {
        notification: updatedNotification,
        deliveries,
        stats: {
          totalRecipients: targetUsers.length,
          pushSent,
          pushFailed,
          inAppSent
        }
      };
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  // Create notification document
  private async createNotification(data: CreateNotificationData): Promise<Notification> {
    // Filter out undefined values to avoid Firebase errors
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );

    const notificationData = {
      ...cleanData,
      createdAt: serverTimestamp(),
      status: data.status || 'pending',
      enablePush: data.enablePush || false,
      deliveryStats: {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        read: 0
      },
      targetGroups: data.targetGroups || [],
      actions: data.actions || [],
      metadata: data.metadata || {}
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);

    return {
      id: docRef.id,
      ...data,
      createdAt: new Date().toISOString(),
      status: data.status || 'pending',
      enablePush: data.enablePush || false,
      deliveryStats: {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        read: 0
      },
      targetGroups: data.targetGroups || [],
      actions: data.actions || [],
      metadata: data.metadata || {}
    };
  }

  // Send push notifications to users
  private async sendPushNotifications(
    notification: Notification, 
    users: User[]
  ): Promise<NotificationDelivery[]> {
    const deliveries: NotificationDelivery[] = [];

    console.log(`🔔 [Push Notification] Sending push notifications to ${users.length} users`);

    // Get push subscriptions for all users from database
    const subscriptions: Array<{ userId: string; subscription: any }> = [];
    for (const user of users) {
      try {
        const subscription = await pushNotificationService.getSubscription(user.id);
        if (subscription) {
          subscriptions.push({
            userId: user.id,
            subscription: {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
              }
            }
          });
        }
      } catch (error) {
        console.error(`Error getting subscription for user ${user.id}:`, error);
      }
    }

    console.log(`📱 [Push Notification] Found ${subscriptions.length} subscriptions`);

    if (subscriptions.length === 0) {
      console.log('⚠️ [Push Notification] No subscriptions found, skipping push notifications');
      return deliveries;
    }

    // Prepare push payload
    const pushPayload = {
      title: notification.pushTitle || notification.title,
      body: notification.pushBody || notification.description || '',
      icon: notification.pushIcon || '/icons/icon-192x192.png',
      image: notification.pushImage,
      url: notification.pushUrl || '/notifications',
      tag: `notification-${notification.id}`,
      requireInteraction: notification.priority === 'urgent',
      actions: notification.actions?.map(action => ({
        action: action.action,
        title: action.title,
        icon: action.icon
      })) || []
    };

    console.log('📤 [Push Notification] Payload:', pushPayload);

    // Send push notifications via API endpoint
    for (const { userId, subscription } of subscriptions) {
      try {
        console.log(`📨 [Push Notification] Sending to user ${userId}`);
        
        // Call the API endpoint to send actual push notification
        const response = await fetch('/api/notifications/send-push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscription,
            payload: pushPayload
          })
        });

        const result = await response.json();

        if (response.ok) {
          console.log(`✅ [Push Notification] Sent successfully to user ${userId}`);
          deliveries.push({
            id: `${Date.now()}-${Math.random()}`,
            notificationId: notification.id,
            userId,
            method: 'push',
            status: 'delivered',
            sentAt: new Date().toISOString(),
            retryCount: 0
          });
        } else {
          console.error(`❌ [Push Notification] Failed for user ${userId}:`, result.error);
          deliveries.push({
            id: `${Date.now()}-${Math.random()}`,
            notificationId: notification.id,
            userId,
            method: 'push',
            status: 'failed',
            sentAt: new Date().toISOString(),
            error: result.error,
            retryCount: 0
          });
          
          // Remove subscription if it's expired/invalid
          if (result.shouldRemoveSubscription) {
            console.log(`🗑️ [Push Notification] Removing invalid subscription for user ${userId}`);
            await pushNotificationService.unsubscribe(userId);
          }
        }
      } catch (error) {
        console.error(`❌ [Push Notification] Error sending to user ${userId}:`, error);
        deliveries.push({
          id: `${Date.now()}-${Math.random()}`,
          notificationId: notification.id,
          userId,
          method: 'push',
          status: 'failed',
          sentAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount: 0
        });
      }
    }

    console.log(`✅ [Push Notification] Completed: ${deliveries.filter(d => d.status === 'delivered').length} delivered, ${deliveries.filter(d => d.status === 'failed').length} failed`);

    return deliveries;
  }

  // Create in-app notification records
  private async createInAppNotifications(
    notification: Notification, 
    users: User[]
  ): Promise<NotificationDelivery[]> {
    const deliveries: NotificationDelivery[] = [];

    for (const user of users) {
      const delivery: NotificationDelivery = {
        id: `${Date.now()}-${Math.random()}`,
        notificationId: notification.id,
        userId: user.id,
        method: 'in_app',
        status: 'sent',
        sentAt: new Date().toISOString(),
        retryCount: 0
      };

      deliveries.push(delivery);
    }

    return deliveries;
  }

  // Update notification delivery statistics
  private async updateNotificationStats(
    notificationId: string, 
    stats: Notification['deliveryStats']
  ): Promise<Notification> {
    await updateDoc(doc(db, 'notifications', notificationId), {
      deliveryStats: stats,
      sentAt: serverTimestamp(),
      status: 'completed',
      updatedAt: serverTimestamp()
    });

    // Return updated notification (simplified)
    const q = query(collection(db, 'notifications'), where('__name__', '==', notificationId));
    const querySnapshot = await getDocs(q);
    const notificationDoc = querySnapshot.docs[0];
    
    return {
      id: notificationDoc.id,
      ...notificationDoc.data()
    } as Notification;
  }

  // Save delivery records to Firestore
  private async saveDeliveryRecords(deliveries: NotificationDelivery[]): Promise<void> {
    const savePromises = deliveries.map(delivery => 
      addDoc(collection(db, 'notificationDeliveries'), {
        ...delivery,
        createdAt: serverTimestamp()
      })
    );

    await Promise.all(savePromises);
  }

  // Show local notification popup
  async showLocalNotification(notification: Notification): Promise<void> {
    try {
      // Only show local notification if permission is granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        await pushNotificationService.showLocalNotification(
          notification.title,
          {
            body: notification.description,
            icon: notification.pushIcon || '/icons/icon-192x192.png',
            tag: `notification-${notification.id}`,
            requireInteraction: notification.priority === 'urgent',
            data: {
              notificationId: notification.id,
              url: notification.pushUrl || '/notifications'
            }
          }
        );
      } else {
        console.log('Local notification skipped - permission not granted or not supported');
      }
    } catch (error) {
      console.error('Error showing local notification:', error);
      // Don't throw error - just log it so the notification creation doesn't fail
    }
  }

  // Subscribe user to push notifications
  async subscribeUserToPush(userId: string): Promise<PushSubscriptionType | null> {
    try {
      return await pushNotificationService.subscribe(userId);
    } catch (error) {
      console.error('Error subscribing user to push notifications:', error);
      throw error;
    }
  }

  // Unsubscribe user from push notifications
  async unsubscribeUserFromPush(userId: string): Promise<void> {
    try {
      await pushNotificationService.unsubscribe(userId);
    } catch (error) {
      console.error('Error unsubscribing user from push notifications:', error);
      throw error;
    }
  }

  // Get user's push subscription status
  async getUserPushSubscription(userId: string): Promise<PushSubscriptionType | null> {
    try {
      return await pushNotificationService.getSubscription(userId);
    } catch (error) {
      console.error('Error getting user push subscription:', error);
      return null;
    }
  }

  // Mark notification as read for a user
  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      // Update delivery record
      const q = query(
        collection(db, 'notificationDeliveries'),
        where('notificationId', '==', notificationId),
        where('userId', '==', userId),
        where('method', '==', 'in_app')
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const deliveryDoc = querySnapshot.docs[0];
        await updateDoc(deliveryDoc.ref, {
          status: 'read',
          readAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Get delivery statistics for a notification
  async getNotificationDeliveryStats(notificationId: string): Promise<{
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    read: number;
  }> {
    try {
      const q = query(
        collection(db, 'notificationDeliveries'),
        where('notificationId', '==', notificationId)
      );
      const querySnapshot = await getDocs(q);
      
      const deliveries = querySnapshot.docs.map(doc => doc.data() as NotificationDelivery);
      
      return {
        total: deliveries.length,
        sent: deliveries.filter(d => d.status === 'sent' || d.status === 'delivered' || d.status === 'read').length,
        delivered: deliveries.filter(d => d.status === 'delivered' || d.status === 'read').length,
        failed: deliveries.filter(d => d.status === 'failed').length,
        read: deliveries.filter(d => d.status === 'read').length
      };
    } catch (error) {
      console.error('Error getting notification delivery stats:', error);
      return { total: 0, sent: 0, delivered: 0, failed: 0, read: 0 };
    }
  }

  // Check if push notifications are supported
  static isPushSupported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  // Get push notification permission status
  static getPushPermissionStatus(): NotificationPermission {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  }

  // Get all notifications
  async getAllNotifications(): Promise<Notification[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'notifications'));
      const notifications: Notification[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        notifications.push({
          id: doc.id,
          title: data.title || '',
          description: data.description || '',
          type: data.type || 'announcement',
          priority: data.priority || 'medium',
          status: data.status || 'pending',
          recipients: data.recipients || [],
          createdBy: data.createdBy || '',
          createdAt: data.createdAt || new Date().toISOString(),
          readBy: data.readBy || [],
          enablePush: data.enablePush || false,
          pushTitle: data.pushTitle,
          pushBody: data.pushBody,
          pushUrl: data.pushUrl,
          pushIcon: data.pushIcon,
          scheduledFor: data.scheduledFor,
          deliveryStats: data.deliveryStats,
          richContent: data.richContent,
          targetGroups: data.targetGroups || []
        } as Notification);
      });

      // Sort by creation date (newest first)
      return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error getting all notifications:', error);
      return [];
    }
  }

  // Mark notification as read (alias for markNotificationAsRead)
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    return this.markNotificationAsRead(notificationId, userId);
  }

  // Create and send notification
  async createAndSendNotification(data: CreateNotificationData): Promise<Notification> {
    try {
      // Create notification object with proper defaults
      const notificationData = {
        title: data.title,
        description: data.description || '', // Ensure description is never undefined
        type: data.type,
        priority: data.priority,
        status: 'pending' as const,
        recipients: data.recipients,
        createdBy: data.createdBy,
        createdAt: new Date().toISOString(),
        scheduledFor: data.scheduledFor,
        enablePush: data.enablePush || false,
        pushTitle: data.pushTitle || data.title,
        pushBody: data.pushBody || data.description || '',
        pushUrl: data.pushUrl || '/notifications',
        pushIcon: data.pushIcon || '/icons/icon-192x192.png',
        deliveryStats: {
          total: 0,
          sent: 0,
          delivered: 0,
          failed: 0,
          read: 0
        }
      };

      // Filter out undefined values to prevent Firebase errors
      const cleanedData = Object.fromEntries(
        Object.entries(notificationData).filter(([_, value]) => value !== undefined)
      );

      // Save to Firebase
      const docRef = await addDoc(collection(db, 'notifications'), cleanedData);
      
      const notification: Notification = {
        id: docRef.id,
        ...cleanedData
      } as Notification;

      // Send notifications in background (don't wait for completion)
      if (notification.enablePush && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        // Get target users and send notifications
        this.sendNotificationToUsers(notification).catch(error => {
          console.error('Error sending notifications:', error);
        });
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Helper method to send notifications to users
  private async sendNotificationToUsers(notification: Notification): Promise<void> {
    try {
      // Get target users based on recipients
      const users = await userGroupService.getUsersByRecipients(notification.recipients);
      
      if (users.length === 0) {
        console.log('No users found for notification recipients');
        return;
      }

      // Send push notifications if enabled
      if (notification.enablePush) {
        await this.sendPushNotifications(notification, users);
      }

      // Create in-app notifications
      await this.createInAppNotifications(notification, users);
      
    } catch (error) {
      console.error('Error sending notification to users:', error);
    }
  }
}

export const notificationService = new NotificationService(); 