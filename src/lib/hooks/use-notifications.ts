"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
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
  Timestamp,
  documentId,
  onSnapshot
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
const PAGE_SIZE = 100; // Increased to 100 for better UX - loads faster from cache

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

// Fetch sent notifications (created by current user)
// Note: Removed orderBy to avoid requiring composite index. Sorting client-side.
const fetchSentNotifications = async (userId: string): Promise<Notification[]> => {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('createdBy', '==', userId),
      limit(PAGE_SIZE)
    );
    const querySnapshot = await getDocs(q);
    const notifications = querySnapshot.docs.map(convertNotificationData);
    // Sort client-side by createdAt descending
    return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    logFirebaseError(error, 'Fetching sent notifications');
    throw new Error('Failed to fetch sent notifications');
  }
};

// Fetch received notifications (from notificationDeliveries)
// Note: Removed orderBy to avoid requiring composite index. Sorting client-side.
const fetchReceivedNotifications = async (userId: string): Promise<Notification[]> => {
  if (!userId) {
    console.log('ℹ️ Fetching received notifications: No userId provided');
    return [];
  }

  console.log(`📥 Fetching received notifications for userId: ${userId}`);

  try {
    // Query deliveries for this user (no orderBy to avoid index requirement)
    const deliveriesQuery = query(
      collection(db, 'notificationDeliveries'),
      where('userId', '==', userId),
      limit(PAGE_SIZE)
    );

    console.log(`🔍 Querying notificationDeliveries with userId == "${userId}"`);
    const deliveriesSnapshot = await getDocs(deliveriesQuery);
    console.log(`📊 Found ${deliveriesSnapshot.docs.length} delivery records`);

    if (deliveriesSnapshot.empty) {
      console.log(`ℹ️ No notification deliveries found for user ${userId}`);
      return [];
    }

    // Get unique notification IDs
    const notificationIds = [...new Set(deliveriesSnapshot.docs.map(doc => doc.data().notificationId))];
    console.log(`🔔 Found ${notificationIds.length} unique notifications:`, notificationIds);

    // Fetch notification details
    // Firestore 'in' query is limited to 10 or 30 items. 
    // For pagination we might need to be careful, but with page size 20 it's okay-ish.
    // Actually we should fetch by ID individually or use batches if needed.
    // For simplicity, we'll use Promise.all for now as 'in' query has limits.
    // Or better: fetch the notifications collection where documentId IN [...]

    if (notificationIds.length === 0) return [];

    // Chunking for 'in' query (max 10 constraint usually applies to equality, 30 for IN?)
    // Actually 'in' supports up to 30.
    const notifications: Notification[] = [];
    const chunks = [];

    for (let i = 0; i < notificationIds.length; i += 10) {
      chunks.push(notificationIds.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      const notifQuery = query(
        collection(db, COLLECTION_NAME),
        where(documentId(), 'in', chunk)
      );
      const snaps = await getDocs(notifQuery);
      snaps.docs.forEach(doc => notifications.push(convertNotificationData(doc)));
    }

    console.log(`✅ Fetched ${notifications.length} notification details for user ${userId}`);

    // Sort by createdAt desc locally since we lost order by fetching by ID map
    return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  } catch (error) {
    logFirebaseError(error, 'Fetching received notifications');
    // Don't throw, just return empty to avoid breaking UI if index is missing
    console.error("Index likely missing for notificationDeliveries", error);
    return [];
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

export const useSentNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Set up real-time listener for instant sent notification updates
  useEffect(() => {
    if (!user?.id) return;

    console.log(`🎧 REALTIME: Setting up sent notifications listener for user ${user.id}`);

    let isActive = true;
    let unsubscribe: (() => void) | null = null;

    const setupListener = () => {
      if (!isActive) return;

      // Clean up existing listener before setting up a new one
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (e) {
          // Ignore cleanup errors
        }
        unsubscribe = null;
      }

      try {
        // Listen to notifications created by this user
        const sentQuery = query(
          collection(db, 'notifications'),
          where('createdBy', '==', user.id),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE)
        );

        unsubscribe = onSnapshot(
          sentQuery,
          {
            includeMetadataChanges: true
          },
          (sentSnapshot) => {
            if (!isActive) return;

            const fromCache = sentSnapshot.metadata.fromCache;

            console.log(`⚡ REALTIME: Received ${sentSnapshot.docs.length} sent notifications`, {
              fromCache,
              source: fromCache ? '📦 cache' : '☁️ server'
            });

            const notifications = sentSnapshot.docs.map(convertNotificationData);
            
            // Filter out notifications deleted by current user
            const activeNotifications = notifications.filter(notification => {
              const deletedBy = notification.deletedBy || {};
              return !deletedBy[user.id];
            });
            
            // Sort by createdAt desc
            const sortedNotifications = activeNotifications.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            // Update cache instantly
            queryClient.setQueryData(['notifications', 'sent', user.id], sortedNotifications);
            console.log(`✅ REALTIME: Updated cache with ${sortedNotifications.length} sent notifications (filtered ${notifications.length - activeNotifications.length} deleted)`);
          },
          (error: any) => {
            if (!isActive) return;
            // Ignore "already-exists" errors - they're harmless
            if (error.code === 'already-exists') {
              console.warn('⚠️ REALTIME: Listener already exists (harmless), ignoring...');
              return;
            }
            console.error('❌ REALTIME: Sent notifications listener error:', error.message);
          }
        );

        console.log('✅ REALTIME: Sent notifications listener set up successfully');

      } catch (error) {
        console.error('❌ REALTIME: Error setting up sent notifications listener:', error);
      }
    };

    setupListener();

    // Cleanup
    return () => {
      isActive = false;
      if (unsubscribe) {
        unsubscribe();
        console.log('🔌 REALTIME: Cleaned up sent notifications listener');
      }
    };
  }, [user?.id, queryClient]);

  return useQuery({
    queryKey: ['notifications', 'sent', user?.id],
    queryFn: () => fetchSentNotifications(user?.id || ''),
    enabled: !!user?.id,
    // Aggressive caching since real-time listener handles updates
    staleTime: Infinity, // Never stale - real-time updates only
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnMount: false, // Don't refetch on mount - use cache
    refetchOnWindowFocus: false, // Don't refetch on focus - use real-time
    refetchOnReconnect: true, // Only refetch if connection was lost
    initialData: () => {
      // Use cached data immediately if available
      return queryClient.getQueryData(['notifications', 'sent', user?.id]) || [];
    },
    placeholderData: (previousData) => previousData, // Keep showing previous data while fetching
  });
};

export const useReceivedNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Set up real-time listener for instant notification delivery
  useEffect(() => {
    if (!user?.id) return;

    console.log(`🎧 REALTIME: Setting up received notifications listener for user ${user.id}`);

    let isActive = true;
    let unsubscribe: (() => void) | null = null;

    const setupListener = async () => {
      if (!isActive) return;

      // Clean up existing listener before setting up a new one
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (e) {
          // Ignore cleanup errors
        }
        unsubscribe = null;
      }

      try {
        // Listen to notificationDeliveries for this user
        const deliveriesQuery = query(
          collection(db, 'notificationDeliveries'),
          where('userId', '==', user.id),
          orderBy('sentAt', 'desc'),
          limit(PAGE_SIZE)
        );

        unsubscribe = onSnapshot(
          deliveriesQuery,
          {
            includeMetadataChanges: true
          },
          async (deliveriesSnapshot) => {
            if (!isActive) return;

            const fromCache = deliveriesSnapshot.metadata.fromCache;
            
            console.log(`⚡ REALTIME: Received ${deliveriesSnapshot.docs.length} notification deliveries`, {
              fromCache,
              source: fromCache ? '📦 cache' : '☁️ server'
            });

            if (deliveriesSnapshot.empty) {
              console.log(`ℹ️ REALTIME: No notification deliveries found for user ${user.id}`);
              queryClient.setQueryData(['notifications', 'received', user.id], []);
              return;
            }

            // Get unique notification IDs
            const notificationIds = [...new Set(deliveriesSnapshot.docs.map(doc => doc.data().notificationId))];
            console.log(`🔔 REALTIME: Found ${notificationIds.length} unique notifications`);

            // Fetch notification details
            const notifications: Notification[] = [];
            const chunks = [];

            for (let i = 0; i < notificationIds.length; i += 10) {
              chunks.push(notificationIds.slice(i, i + 10));
            }

            for (const chunk of chunks) {
              const notifQuery = query(
                collection(db, 'notifications'),
                where(documentId(), 'in', chunk)
              );
              const snaps = await getDocs(notifQuery);
              snaps.docs.forEach(doc => notifications.push(convertNotificationData(doc)));
            }

            // Sort by createdAt desc
            const sortedNotifications = notifications.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            // Update cache instantly
            queryClient.setQueryData(['notifications', 'received', user.id], sortedNotifications);
            console.log(`✅ REALTIME: Updated cache with ${sortedNotifications.length} received notifications`);
          },
          (error: any) => {
            if (!isActive) return;
            // Ignore "already-exists" errors - they're harmless
            if (error.code === 'already-exists') {
              console.warn('⚠️ REALTIME: Listener already exists (harmless), ignoring...');
              return;
            }
            console.error('❌ REALTIME: Received notifications listener error:', error.message);
          }
        );

        console.log('✅ REALTIME: Received notifications listener set up successfully');

      } catch (error) {
        console.error('❌ REALTIME: Error setting up received notifications listener:', error);
      }
    };

    setupListener();

    // Cleanup
    return () => {
      isActive = false;
      if (unsubscribe) {
        unsubscribe();
        console.log('🔌 REALTIME: Cleaned up received notifications listener');
      }
    };
  }, [user?.id, queryClient]);

  return useQuery({
    queryKey: ['notifications', 'received', user?.id],
    queryFn: () => fetchReceivedNotifications(user?.id || ''),
    enabled: !!user?.id,
    // Aggressive caching since real-time listener handles updates
    staleTime: Infinity, // Never stale - real-time updates only
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnMount: false, // Don't refetch on mount - use cache
    refetchOnWindowFocus: false, // Don't refetch on focus - use real-time
    refetchOnReconnect: true, // Only refetch if connection was lost
    initialData: () => {
      // Use cached data immediately if available
      return queryClient.getQueryData(['notifications', 'received', user?.id]) || [];
    },
    placeholderData: (previousData) => previousData, // Keep showing previous data while fetching
  });
};

export default useNotifications; 