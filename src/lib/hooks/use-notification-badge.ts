import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { notificationService } from '@/lib/services/notification-service';

export interface NotificationBadgeState {
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export const useNotificationBadge = () => {
  const { user } = useAuth();
  const [badgeState, setBadgeState] = useState<NotificationBadgeState>({
    unreadCount: 0,
    isLoading: false,
    error: null,
    lastUpdated: null
  });

  // Fetch unread count
  const fetchUnreadCount = async () => {
    const userId = user?.id;
    if (!userId) {
      return;
    }

    setBadgeState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get all notifications and filter for unread ones
      const allNotifications = await notificationService.getAllNotifications();
      
      const parentNotifications = allNotifications.filter(notification =>
        notification.recipients.some(recipient =>
          recipient.id === 'all_parents' ||
          recipient.id === 'all_users' ||
          recipient.id === userId
        )
      );
      
      const unreadCount = parentNotifications.filter(notification => 
        !(notification as any).readBy?.includes(userId)
      ).length;
      
      setBadgeState(prev => ({
        ...prev,
        unreadCount,
        isLoading: false,
        lastUpdated: new Date()
      }));
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setBadgeState(prev => ({
        ...prev,
        unreadCount: 0, // Force to 0 on error
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch unread count'
      }));
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string, userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    try {
      await notificationService.markAsRead(notificationId, targetUserId);
      // Refresh unread count
      await fetchUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    const userId = user?.id;
    if (!userId) return;

    try {
      // Get all notifications and mark unread ones as read
      const allNotifications = await notificationService.getAllNotifications();
      const parentNotifications = allNotifications.filter(notification =>
        notification.recipients.some(recipient =>
          recipient.id === 'all_parents' ||
          recipient.id === 'all_users' ||
          recipient.id === userId
        )
      );
      
      const unreadNotifications = parentNotifications.filter(n => 
        !(n as any).readBy?.includes(userId)
      );
      
      // Mark each as read
      await Promise.all(
        unreadNotifications.map(n => 
          notificationService.markAsRead(n.id, userId)
        )
      );

      // Refresh unread count
      await fetchUnreadCount();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Subscribe to push notifications
  const subscribeToNotifications = async () => {
    const userId = user?.id;
    if (!userId) return;

    try {
      const subscription = await notificationService.subscribeUserToPush(userId);
      if (subscription) {
        // Refresh unread count after subscription
        await fetchUnreadCount();
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    }
  };

  // Unsubscribe from push notifications
  const unsubscribeFromNotifications = async () => {
    const userId = user?.id;
    if (!userId) return;

    try {
      await notificationService.unsubscribeUserFromPush(userId);
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
    }
  };

  // Get user's push subscription
  const getUserSubscription = async () => {
    const userId = user?.id;
    if (!userId) return null;

    try {
      return await notificationService.getUserPushSubscription(userId);
    } catch (error) {
      console.error('Error getting user subscription:', error);
      return null;
    }
  };

  // Reset notification count
  const resetNotificationCount = async () => {
    const userId = user?.id;
    if (!userId) return;

    try {
      setBadgeState(prev => ({ ...prev, unreadCount: 0 }));
    } catch (error) {
      console.error('Error resetting notification count:', error);
    }
  };

  // Auto-refresh unread count every 30 seconds
  useEffect(() => {
    if (user?.id) {
      fetchUnreadCount();
      
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  // Refresh when user changes
  useEffect(() => {
    if (user?.id) {
      fetchUnreadCount();
    }
  }, [user?.id]);

  return {
    ...badgeState,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    subscribeToNotifications,
    unsubscribeFromNotifications,
    getUserSubscription,
    resetNotificationCount
  };
};
