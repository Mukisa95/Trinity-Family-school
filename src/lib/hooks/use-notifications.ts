"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where,
  limit,
  startAfter,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { notificationService } from '@/lib/services/notification-service';
import type { 
  Notification, 
  CreateNotificationData, 
  UpdateNotificationData,
  NotificationStatus 
} from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/contexts/auth-context';
import { getFirebaseQueryConfig, logFirebaseError } from '@/lib/utils/firebase-error-handler';

const COLLECTION_NAME = 'notifications';
const PAGE_SIZE = 20; // Limit initial load to 20 notifications

// Convert Firestore timestamp to ISO string
const convertTimestamp = (timestamp: any): string => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp?.toDate) {
    return timestamp.toDate().toISOString();
  }
  return timestamp || new Date().toISOString();
};

// Convert notification data from Firestore
const convertNotificationData = (doc: any): Notification => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: convertTimestamp(data.createdAt),
    scheduledFor: data.scheduledFor ? convertTimestamp(data.scheduledFor) : undefined,
    sentAt: data.sentAt ? convertTimestamp(data.sentAt) : undefined,
    completedAt: data.completedAt ? convertTimestamp(data.completedAt) : undefined,
    updatedAt: data.updatedAt ? convertTimestamp(data.updatedAt) : undefined,
    lastDeliveryAttempt: data.lastDeliveryAttempt ? convertTimestamp(data.lastDeliveryAttempt) : undefined,
    // Ensure required fields have defaults
    enablePush: data.enablePush || false,
    deliveryStats: data.deliveryStats || {
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
};

// Fetch recent notifications with pagination
const fetchNotifications = async (): Promise<Notification[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertNotificationData);
  } catch (error) {
    logFirebaseError(error, 'Fetching notifications');
    throw new Error('Failed to fetch notifications');
  }
};

// Fetch notifications by status with limit
const fetchNotificationsByStatus = async (status: NotificationStatus): Promise<Notification[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertNotificationData);
  } catch (error) {
    console.error('Error fetching notifications by status:', error);
    throw new Error('Failed to fetch notifications');
  }
};

// Fetch pending notifications (scheduled for now or past) with limit
const fetchPendingNotifications = async (): Promise<Notification[]> => {
  try {
    const now = new Date();
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', '==', 'pending'),
      where('scheduledFor', '<=', now),
      orderBy('scheduledFor', 'asc'),
      limit(10) // Smaller limit for pending notifications
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertNotificationData);
  } catch (error) {
    console.error('Error fetching pending notifications:', error);
    throw new Error('Failed to fetch pending notifications');
  }
};

// Create and send notification using the notification service
const createAndSendNotification = async (data: CreateNotificationData): Promise<Notification> => {
  try {
    // Use the notification service to create and send the notification
    const result = await notificationService.sendNotification(data);
    return result.notification;
  } catch (error) {
    console.error('Error creating and sending notification:', error);
    throw new Error('Failed to create and send notification');
  }
};

// Update notification
const updateNotification = async ({ id, data }: { id: string; data: UpdateNotificationData }): Promise<void> => {
  try {
    const updateData: any = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    // Convert date strings to Firestore timestamps
    if (data.scheduledFor) {
      updateData.scheduledFor = new Date(data.scheduledFor);
    }
    if (data.sentAt) {
      updateData.sentAt = new Date(data.sentAt);
    }
    if (data.completedAt) {
      updateData.completedAt = new Date(data.completedAt);
    }

    await updateDoc(doc(db, COLLECTION_NAME, id), updateData);
  } catch (error) {
    console.error('Error updating notification:', error);
    throw new Error('Failed to update notification');
  }
};

// Mark notification as completed
const markAsCompleted = async (id: string): Promise<void> => {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, id), {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error marking notification as completed:', error);
    throw new Error('Failed to mark notification as completed');
  }
};

// Mark notification as sent
const markAsSent = async (id: string): Promise<void> => {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, id), {
      sentAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error marking notification as sent:', error);
    throw new Error('Failed to mark notification as sent');
  }
};

// Delete notification
const deleteNotification = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw new Error('Failed to delete notification');
  }
};

// Main hook
export const useNotifications = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch all notifications
  const {
    data: notifications = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    ...getFirebaseQueryConfig(),
  });

  // Create and send notification mutation
  const createNotificationMutation = useMutation({
    mutationFn: createAndSendNotification,
    onSuccess: (notification) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      // Only show local notification if user has explicitly granted permission
      // and the notification was created with push enabled
      if (notification.enablePush && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        notificationService.showLocalNotification(notification).catch(error => {
          console.log('Local notification not shown:', error.message);
        });
      }
      
      toast({
        title: "Notification Sent!",
        description: `Notification "${notification.title}" has been sent successfully`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create and send notification",
      });
    },
  });

  // Update notification mutation
  const updateNotificationMutation = useMutation({
    mutationFn: updateNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: "Success",
        description: "Notification updated successfully",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update notification",
      });
    },
  });

  // Mark as completed mutation
  const markAsCompletedMutation = useMutation({
    mutationFn: markAsCompleted,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: "Success",
        description: "Notification marked as completed",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to mark notification as completed",
      });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: "Success",
        description: "Notification deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete notification",
      });
    },
  });

  // Subscribe to push notifications
  const subscribeToPushMutation = useMutation({
    mutationFn: () => notificationService.subscribeUserToPush(user?.id || ''),
    onSuccess: () => {
      toast({
        title: "Push Notifications Enabled",
        description: "You will now receive push notifications",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to enable push notifications",
      });
    },
  });

  // Unsubscribe from push notifications
  const unsubscribeFromPushMutation = useMutation({
    mutationFn: () => notificationService.unsubscribeUserFromPush(user?.id || ''),
    onSuccess: () => {
      toast({
        title: "Push Notifications Disabled",
        description: "You will no longer receive push notifications",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to disable push notifications",
      });
    },
  });

  return {
    // Data
    notifications,
    isLoading,
    error,
    
    // Actions
    fetchNotifications: refetch,
    addNotification: createNotificationMutation.mutateAsync,
    updateNotification: updateNotificationMutation.mutateAsync,
    markAsCompleted: markAsCompletedMutation.mutateAsync,
    deleteNotification: deleteNotificationMutation.mutateAsync,
    
    // Push notification actions
    subscribeToPush: subscribeToPushMutation.mutateAsync,
    unsubscribeFromPush: unsubscribeFromPushMutation.mutateAsync,
    
    // Mutation states
    isCreating: createNotificationMutation.isPending,
    isUpdating: updateNotificationMutation.isPending,
    isDeleting: deleteNotificationMutation.isPending,
    isSyncing: false, // Will be implemented with sync context
    
    // Push notification states
    isSubscribingToPush: subscribeToPushMutation.isPending,
    isUnsubscribingFromPush: unsubscribeFromPushMutation.isPending,
    
    // Utility functions
    isPushSupported: () => {
      return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    },
    getPushPermissionStatus: () => {
      return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
    },
  };
};

// Hook for pending notifications
export const usePendingNotifications = () => {
  return useQuery({
    queryKey: ['notifications', 'pending'],
    queryFn: fetchPendingNotifications,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes instead of 30 seconds
    ...getFirebaseQueryConfig({
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnMount: true,
    }),
  });
};

// Hook for notifications by status
export const useNotificationsByStatus = (status: NotificationStatus) => {
  return useQuery({
    queryKey: ['notifications', 'status', status],
    queryFn: () => fetchNotificationsByStatus(status),
    enabled: !!status, // Only run if status is provided
    ...getFirebaseQueryConfig({
      staleTime: 3 * 60 * 1000, // 3 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    }),
  });
};

export default useNotifications; 