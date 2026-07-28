import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { notificationService } from '@/lib/services/notification-service';
import {
  markInboxNotificationRead,
  subscribeToUserNotificationInbox,
  type NotificationInboxSnapshot,
} from '@/lib/notification-inbox-store';

export interface NotificationBadgeState {
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const emptyInbox: NotificationInboxSnapshot = {
  notifications: [],
  isLoading: false,
  error: null,
};

export const useNotificationBadge = () => {
  const { user } = useAuth();
  const [inbox, setInbox] = useState<NotificationInboxSnapshot>(emptyInbox);

  useEffect(() => {
    if (!user?.id) {
      setInbox(emptyInbox);
      return;
    }
    return subscribeToUserNotificationInbox(user.id, setInbox);
  }, [user?.id]);

  const unreadCount = inbox.notifications.filter(notification =>
    !notification.readBy?.includes(user?.id || ''),
  ).length;

  const markAsRead = useCallback(async (notificationId: string, userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;
    markInboxNotificationRead(targetUserId, notificationId);
    try {
      await notificationService.markAsRead(notificationId, targetUserId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user?.id]);

  const markAllAsRead = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;
    const unreadNotificationIds = inbox.notifications
      .filter(notification => !notification.readBy?.includes(userId))
      .map(notification => notification.id);
    await Promise.all(unreadNotificationIds.map(notificationId => markAsRead(notificationId, userId)));
  }, [inbox.notifications, markAsRead, user?.id]);

  const subscribeToNotifications = useCallback(async () => {
    if (!user?.id) return;
    await notificationService.subscribeUserToPush(user.id);
  }, [user?.id]);

  const unsubscribeFromNotifications = useCallback(async () => {
    if (!user?.id) return;
    await notificationService.unsubscribeUserFromPush(user.id);
  }, [user?.id]);

  const getUserSubscription = useCallback(async () => {
    if (!user?.id) return null;
    return notificationService.getUserPushSubscription(user.id);
  }, [user?.id]);

  return {
    unreadCount,
    isLoading: inbox.isLoading,
    error: inbox.error,
    lastUpdated: inbox.isLoading ? null : new Date(),
    notifications: inbox.notifications,
    // Kept for the existing notifications page. The shared listener is the
    // live source of truth, so this intentionally performs no polling read.
    fetchUnreadCount: async () => undefined,
    markAsRead,
    markAllAsRead,
    subscribeToNotifications,
    unsubscribeFromNotifications,
    getUserSubscription,
    resetNotificationCount: async () => undefined,
  };
};
