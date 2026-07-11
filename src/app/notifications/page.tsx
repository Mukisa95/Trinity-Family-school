"use client";

import React, { useState, useEffect } from 'react';
import { useNotifications, useSentNotifications, useReceivedNotifications } from '@/lib/hooks/use-notifications';
import { useSyncContext } from '@/context/SyncContext';
import { useNotificationBadge } from '@/lib/hooks/use-notification-badge';
import { pushNotificationService } from '@/lib/services/push-notifications.service';
import { notificationService } from '@/lib/services/notification-service';
import { NotificationProgress } from '@/components/NotificationProgress';
import { format } from 'date-fns';
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from "@/components/common/glass-page-top-bar";
import { GlassPageRouteSkeleton } from "@/components/common/glass-page-loading";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Bell,
  Plus,
  RefreshCw,
  CheckCircle,
  Trash2,
  Clock,
  AlertCircle,
  Wifi,
  WifiOff,
  Calendar,
  Users,
  MessageSquare,
  Smartphone,
  UserCheck,
  Shield,
  Heart,
  Settings,
  X,
  Upload,
  FileText,
  Download,
  Paperclip
} from 'lucide-react';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
} from '@/components/ui/modern-dialog';
import { NotificationList } from '@/components/notifications/NotificationList';
import { NotificationChatFeed } from '@/components/notifications/NotificationChatFeed';
import { AdvancedRecipientPicker } from '@/components/notifications/AdvancedRecipientPicker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type {
  Notification,
  NotificationType,
  NotificationPriority,
  CreateNotificationData,
  NotificationRecipient
} from '@/types';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { userGroupService } from '@/lib/services/user-groups';
import { deleteDoc, doc, updateDoc, addDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const NOTIFICATION_TYPES: { value: NotificationType; label: string; icon: React.ReactNode }[] = [
  { value: 'reminder', label: 'Reminder', icon: <Clock className="h-4 w-4" /> },
  { value: 'alert', label: 'Alert', icon: <AlertCircle className="h-4 w-4" /> },
  { value: 'announcement', label: 'Announcement', icon: <MessageSquare className="h-4 w-4" /> },
  { value: 'task', label: 'Task', icon: <CheckCircle className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Bell className="h-4 w-4" /> },
  { value: 'fee_reminder', label: 'Fee Reminder', icon: <Calendar className="h-4 w-4" /> },
  { value: 'exam_reminder', label: 'Exam Reminder', icon: <Calendar className="h-4 w-4" /> },
  { value: 'attendance_alert', label: 'Attendance Alert', icon: <Users className="h-4 w-4" /> },
  { value: 'flow', label: 'Flow (Rich Content)', icon: <MessageSquare className="h-4 w-4" /> },
];

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-800 border-gray-200',
  medium: 'bg-blue-100 text-blue-800 border-blue-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  urgent: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
};

export default function NotificationsPage() {
  const { toast } = useToast();
  const {
    notifications,
    isLoading,
    error,
    fetchNotifications,
    addNotification,
    markAsCompleted,
    deleteNotification,
    isSyncing,
    subscribeToPush,
    unsubscribeFromPush,
    isCreating,
    isSubscribingToPush,
    isUnsubscribingFromPush
  } = useNotifications();

  const { data: sentNotifications = [], isLoading: isSentLoading } = useSentNotifications();
  const { data: receivedNotifications = [], isLoading: isReceivedLoading } = useReceivedNotifications();
  const [activeTab, setActiveTab] = useState('inbox');

  const { fetchUnreadCount: refreshBadge, markAllAsRead } = useNotificationBadge();

  const { isOnline, syncNow, isSyncing: isSyncingWithServer } = useSyncContext();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const { user } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'reminder' as NotificationType,
    priority: 'medium' as NotificationPriority,
    scheduledFor: '',
    recipients: [] as NotificationRecipient[],
    enablePush: true,
    pushTitle: '',
    pushBody: '',
    pushUrl: '/notifications',
    // Flow-specific fields
    longMessage: '',
    useMarkdown: false,
    attachments: [] as Array<{
      id: string;
      name: string;
      type: 'pdf' | 'image' | 'document';
      url: string;
      downloadUrl?: string;
      size: number;
      uploadedAt: string;
    }>,
  });

  // User groups and counts
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [userPushSubscription, setUserPushSubscription] = useState<any>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Check push notification support and permission
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Browser push requires the Service Worker, Push Manager, and Notification APIs.
      const isWebPushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      const isPushSupportedValue = isWebPushSupported;
      const pushPermissionValue: NotificationPermission = 'Notification' in window
        ? Notification.permission
        : 'default';

      console.log('📱 Push support check:', {
        isWebPushSupported,
        isPushSupportedValue,
        pushPermissionValue
      });

      setIsPushSupported(isPushSupportedValue);
      setPushPermission(pushPermissionValue);

      // 🔥 CRITICAL FIX: Validate and sync push subscription on app load
      // This prevents the issue where browser unsubscribes but database still shows active
      // 🔔 AUTO-SUBSCRIBE: Automatically subscribe users to push notifications
      if (user?.id) {
        (async () => {
          try {
            console.log('🔄 Validating push subscription on app load...');
            
            // First, validate and sync browser subscription with database
            const validation = await pushNotificationService.validateAndSyncSubscription(user.id);
            
            console.log('📊 Subscription validation result:', validation);
            
            // Then get the current subscription status from database
            const subscription = await notificationService.getUserPushSubscription(user.id);
            setUserPushSubscription(subscription);
            
            // 🔔 AUTO-SUBSCRIBE: If user doesn't have subscription, subscribe them automatically
            // ⚠️ DISABLED: Causing rate limit issues with repeated attempts
            // TODO: Re-enable when push service errors are resolved
            if (false && !subscription && isPushSupportedValue) {
              console.log('🔔 Auto-subscribing user to push notifications...');
              
            // Request permission if not already granted
            if (pushPermissionValue === 'default') {
              const permission = await pushNotificationService.requestPermission();
              setPushPermission(permission);
                
                if (permission === 'granted') {
                  // Subscribe the user
                  try {
                    const newSubscription = await subscribeToPush();
                    setUserPushSubscription(newSubscription);
                    console.log('✅ User auto-subscribed successfully!');
                    
                    toast({
                      title: "Notifications Enabled",
                      description: "You'll now receive push notifications",
                    });
                  } catch (subError) {
                    console.error('❌ Auto-subscribe failed:', subError);
                  }
                }
              } else if (pushPermissionValue === 'granted') {
                // Permission already granted, just subscribe
                try {
                  const newSubscription = await subscribeToPush();
                  setUserPushSubscription(newSubscription);
                  console.log('✅ User auto-subscribed successfully!');
                } catch (subError) {
                  console.error('❌ Auto-subscribe failed:', subError);
                }
              }
            }
          } catch (error) {
            console.error('❌ Error validating push subscription:', error);
          }
        })();
      }
    }
  }, [user?.id, subscribeToPush, toast]);

  // Mark all notifications as read when page loads
  useEffect(() => {
    if (user?.id && receivedNotifications.length > 0) {
      const hasUnread = receivedNotifications.some((n: any) => !n.readBy?.includes(user.id));
      if (hasUnread) {
        markAllAsRead().catch(error => {
          console.error('Error marking notifications as read:', error);
        });
      }
    }
  }, [user?.id, receivedNotifications.length, markAllAsRead]);

  // Load user counts for different groups - defer this to improve initial load
  useEffect(() => {
    // Load user counts immediately for better UX
    const loadUserCounts = async () => {
      console.log('🔄 Loading user counts...');
      try {
        const predefinedRecipients = userGroupService.getPredefinedRecipients();
        console.log('📋 Predefined recipients:', predefinedRecipients);

        const counts: Record<string, number> = {};

        // Load all counts in parallel for faster loading
        const countPromises = predefinedRecipients.map(async (recipient) => {
          try {
            console.log(`🔍 Loading count for ${recipient.name}...`);
            const count = await userGroupService.getUserCountByRecipients([recipient]);
            console.log(`✅ ${recipient.name}: ${count} users`);
            counts[recipient.id] = count;
            return { id: recipient.id, count };
          } catch (error) {
            console.error(`❌ Error loading count for ${recipient.name}:`, error);
            counts[recipient.id] = 0;
            return { id: recipient.id, count: 0 };
          }
        });

        await Promise.all(countPromises);

        console.log('📊 Final user counts:', counts);
        setUserCounts(counts);

      } catch (error) {
        console.error('❌ Error loading user counts:', error);
        // Set default counts to 0 if there's an error
        const predefinedRecipients = userGroupService.getPredefinedRecipients();
        const defaultCounts: Record<string, number> = {};
        predefinedRecipients.forEach(recipient => {
          defaultCounts[recipient.id] = 0;
        });
        setUserCounts(defaultCounts);
      }
    };

    loadUserCounts();
  }, []);

  // File upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: "Only PDF, images, and Word documents are allowed.",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "File size must be less than 10MB.",
      });
      return;
    }

    setIsUploadingFile(true);
    setUploadProgress(0);

    try {
      // Simulate file upload progress
      const uploadInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(uploadInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Create a mock file URL (in a real app, this would upload to Firebase Storage or similar)
      const fileUrl = URL.createObjectURL(file);
      const downloadUrl = fileUrl; // In real app, this would be the permanent download URL

      const attachment = {
        id: `attachment-${Date.now()}`,
        name: file.name,
        type: file.type.includes('pdf') ? 'pdf' as const :
          file.type.includes('image') ? 'image' as const : 'document' as const,
        url: fileUrl,
        downloadUrl: downloadUrl,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

      clearInterval(uploadInterval);
      setUploadProgress(100);

      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, attachment]
      }));

      toast({
        title: "File Uploaded",
        description: `${file.name} has been uploaded successfully.`,
      });

    } catch (error) {
      console.error('File upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to upload file. Please try again.",
      });
    } finally {
      setIsUploadingFile(false);
      setUploadProgress(0);
      // Reset the input
      event.target.value = '';
    }
  };

  // Remove attachment
  const handleRemoveAttachment = (attachmentId: string) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(att => att.id !== attachmentId)
    }));
  };

  // Request push notification permission
  const handleRequestPermission = async () => {
    if (!isPushSupported) {
      toast({
        variant: "destructive",
        title: "Not Supported",
        description: "Push notifications are not supported in this browser",
      });
      return;
    }

    setIsRequestingPermission(true);

    try {
      const permission = await pushNotificationService.requestPermission();
      setPushPermission(permission);

      if (permission === 'granted') {
        toast({
          title: "Permission Granted!",
          description: "You can now receive push notifications",
        });

        // Automatically subscribe the user
        if (user?.id) {
          try {
            const subscription = await subscribeToPush();
            setUserPushSubscription(subscription);
          } catch (error) {
            console.error('Error subscribing after permission granted:', error);
          }
        }
      } else if (permission === 'denied') {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "Push notifications have been blocked. You can enable them in your browser settings.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to request notification permission",
      });
    } finally {
      setIsRequestingPermission(false);
    }
  };

  // Toggle push subscription
  const handlePushSubscriptionToggle = async () => {
    if (pushPermission !== 'granted') {
      await handleRequestPermission();
      return;
    }

    try {
      if (userPushSubscription) {
        await unsubscribeFromPush();
        setUserPushSubscription(null);
        toast({
          title: "Unsubscribed",
          description: "You will no longer receive push notifications",
        });
      } else {
        const subscription = await subscribeToPush();
        setUserPushSubscription(subscription);
        toast({
          title: "Subscribed!",
          description: "You will now receive push notifications",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update push notification subscription",
      });
    }
  };

  const handleMarkCompleted = async (id: string) => {
    try {
      await markAsCompleted(id);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleForceSync = async () => {
    if (!isOnline) {
      toast({
        variant: "destructive",
        title: "Cannot sync while offline",
        description: "Please check your internet connection",
      });
      return;
    }

    try {
      await syncNow();
      await fetchNotifications();
      toast({
        title: "Sync complete",
        description: "Notifications have been synchronized",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: "Failed to sync with server",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || formData.recipients.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in the title and select at least one recipient group",
      });
      return;
    }

    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "User not authenticated",
      });
      return;
    }

    // Note: Sender doesn't need push permission to send push notifications to recipients
    // Recipients will receive push notifications if they have enabled push notifications
    // This is just a courtesy check to let sender know their own status
    if (formData.enablePush && isPushSupported && pushPermission !== 'granted') {
      console.log('ℹ️ Sender does not have push notifications enabled, but recipients with push enabled will still receive notifications');
    }

    try {
      const notificationData: CreateNotificationData = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type,
        priority: formData.priority,
        recipients: formData.recipients,
        createdBy: user.id,
        scheduledFor: formData.scheduledFor ? new Date(formData.scheduledFor).toISOString() : undefined,
        enablePush: formData.enablePush, // Enable push if form has it checked - individual recipient subscriptions will be checked when sending
        pushTitle: formData.pushTitle.trim() || formData.title.trim(),
        pushBody: formData.pushBody.trim() || formData.description.trim(),
        pushUrl: formData.pushUrl.trim() || '/notifications',
        // Add rich content for flow notifications
        richContent: formData.type === 'flow' ? {
          longMessage: formData.longMessage.trim() || undefined,
          attachments: formData.attachments,
          formatting: {
            useMarkdown: formData.useMarkdown,
            allowHtml: false // For security
          }
        } : undefined,
      };

      // Try optimized batch service first, fallback to original if it fails
      try {
        console.log('📤 Sending notification data:', {
          title: notificationData.title,
          recipientsCount: notificationData.recipients.length,
          enablePush: notificationData.enablePush
        });

        const response = await fetch('/api/notifications/send-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(notificationData)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API Error:', response.status, errorText);
          throw new Error(`Failed to send notification: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        console.log('🚀 Notification queued:', result);

        // Show progress indicator for large batches
        if (result.stats.totalRecipients > 50) {
          setActiveNotificationId(result.notificationId);
        }

        // Check push notification status after a few seconds
        if (notificationData.enablePush) {
          setTimeout(async () => {
            try {
              // Fetch the notification to check if push was sent
              const notificationRef = await fetch(`/api/notifications/${result.notificationId}`);
              if (notificationRef.ok) {
                const notificationData = await notificationRef.json();
                console.log('📊 Push notification status:', {
                  notificationId: result.notificationId,
                  status: notificationData.status,
                  deliveryStats: notificationData.deliveryStats,
                  pushSent: notificationData.deliveryStats?.sent || 0,
                  pushFailed: notificationData.deliveryStats?.failed || 0
                });

                // Show status to user
                if (notificationData.deliveryStats?.sent > 0) {
                  console.log(`✅ Push notifications sent to ${notificationData.deliveryStats.sent} users!`);
                } else {
                  console.log('⚠️ No push subscriptions found or push sending failed');
                  console.log('💡 Make sure users have enabled push notifications on /notifications page');
                }
              }
            } catch (error) {
              console.error('Error checking push status:', error);
            }
          }, 3000); // Check after 3 seconds
        }

        // Refresh notification badge and list
        await refreshBadge();
        await fetchNotifications();

        // Show success message
        toast({
          title: "🚀 Notification Queued!",
          description: `Notification queued for ${result.stats.totalRecipients} recipients. ${notificationData.enablePush ? 'Push notifications will be sent shortly.' : ''}`,
        });

      } catch (optimizedError) {
        console.warn('⚠️ Optimized service failed, falling back to original:', optimizedError);

        // Fallback to original notification service
        await addNotification(notificationData);

        // Refresh notification badge and list
        await refreshBadge();
        await fetchNotifications();

        // Show success message
        toast({
          title: "✅ Notification Sent!",
          description: "Notification sent successfully using fallback method.",
        });
      }

      // Reset form
      setFormData({
        title: '',
        description: '',
        type: 'reminder',
        priority: 'medium',
        scheduledFor: '',
        recipients: [],
        enablePush: true,
        pushTitle: '',
        pushBody: '',
        pushUrl: '/notifications',
        // Flow-specific fields
        longMessage: '',
        useMarkdown: false,
        attachments: [],
      });
      setIsDialogOpen(false);

    } catch (error) {
      console.error('Error creating notification:', error);

      // Show error message to user
      toast({
        variant: "destructive",
        title: "Notification Error",
        description: error instanceof Error ? error.message : "Failed to send notification",
      });
    }
  };

  const handleRecipientToggle = (recipient: NotificationRecipient, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({ ...prev, recipients: [...prev.recipients, recipient] }));
    } else {
      setFormData(prev => ({ ...prev, recipients: prev.recipients.filter(r => r.id !== recipient.id) }));
    }
  };

  const toggleNotificationExpanded = (notificationId: string) => {
    setExpandedNotificationId(prev => prev === notificationId ? null : notificationId);
  };

  // Handle resending notification
  const handleResendNotification = async (notification: Notification) => {
    try {
      // Create a new notification with the same data
      const notificationData: CreateNotificationData = {
        title: notification.title,
        description: notification.description || '',
        type: notification.type,
        priority: notification.priority,
        recipients: notification.recipients || [],
        enablePush: true,
        pushTitle: notification.pushNotification?.title || notification.title,
        pushBody: notification.pushNotification?.body || notification.description || '',
        pushUrl: notification.pushNotification?.url || '/notifications',
        richContent: notification.richContent
      };

      await notificationService.createNotification(notificationData);
      
      toast({
        title: "Notification Resent",
        description: "The notification has been sent again to all recipients",
      });
    } catch (error) {
      console.error('Error resending notification:', error);
      toast({
        variant: "destructive",
        title: "Failed to Resend",
        description: "Could not resend the notification. Please try again.",
      });
    }
  };

  // Handle deleting notification with instant real-time updates
  const handleDeleteNotification = async (notification: Notification, deleteType?: 'me' | 'everyone') => {
    try {
      const isSentByMe = notification.createdBy === user?.id;
      
      if (deleteType === 'everyone') {
        // Delete the notification document entirely (only for sent notifications)
        if (isSentByMe) {
          await deleteDoc(doc(db, 'notifications', notification.id));
          
          // Also delete all notification delivery documents
          const deliveriesQuery = query(
            collection(db, 'notificationDeliveries'),
            where('notificationId', '==', notification.id)
          );
          const deliveriesSnapshot = await getDocs(deliveriesQuery);
          const deletePromises = deliveriesSnapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
          
          toast({
            title: "Deleted for Everyone",
            description: "The notification has been deleted for all recipients",
          });
        } else {
          // Received notifications can only be deleted "for me"
          await handleDeleteForMe(notification);
        }
      } else {
        // Delete "for me"
        await handleDeleteForMe(notification);
      }
      
      // No need to manually refresh - real-time listeners will update automatically!
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({
        variant: "destructive",
        title: "Failed to Delete",
        description: "Could not delete the notification. Please try again.",
      });
    }
  };

  // Helper function to delete notification "for me"
  const handleDeleteForMe = async (notification: Notification) => {
    const isSentByMe = notification.createdBy === user?.id;
    
    if (isSentByMe) {
      // For sent notifications: mark as deleted by adding to deletedBy map
      const notificationRef = doc(db, 'notifications', notification.id);
      await updateDoc(notificationRef, {
        [`deletedBy.${user?.id}`]: true,
        updatedAt: serverTimestamp()
      });
    } else {
      // For received notifications: delete the notification delivery document
      const deliveriesQuery = query(
        collection(db, 'notificationDeliveries'),
        where('notificationId', '==', notification.id),
        where('userId', '==', user?.id)
      );
      const deliveriesSnapshot = await getDocs(deliveriesQuery);
      
      // Delete all matching delivery documents (should be only one)
      const deletePromises = deliveriesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    }
    
    toast({
      title: "Notification Deleted",
      description: "The notification has been removed from your view",
    });
  };

  // Handle reminder (resend push notification after duration)
  const handleRemindNotification = async (notification: Notification, duration?: number) => {
    try {
      const durationMinutes = duration || 15;
      const scheduledTime = new Date(Date.now() + durationMinutes * 60 * 1000);
      
      // Create a reminder notification
      const reminderData: CreateNotificationData = {
        title: `Reminder: ${notification.title}`,
        description: notification.description || '',
        type: 'reminder',
        priority: notification.priority,
        recipients: [{ id: user?.id || '', type: 'user', name: user?.username || '' }],
        scheduledFor: scheduledTime.toISOString(),
        enablePush: true,
        pushTitle: `Reminder: ${notification.title}`,
        pushBody: notification.description || '',
        pushUrl: notification.pushNotification?.url || '/notifications',
        richContent: notification.richContent
      };

      await notificationService.createNotification(reminderData);
      
      toast({
        title: "Reminder Set",
        description: `You'll be reminded in ${durationMinutes} minutes`,
      });
    } catch (error) {
      console.error('Error setting reminder:', error);
      toast({
        variant: "destructive",
        title: "Failed to Set Reminder",
        description: "Could not set the reminder. Please try again.",
      });
    }
  };

  const getPriorityColor = (priority: NotificationPriority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'sent': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRecipientIcon = (type: string) => {
    switch (type) {
      case 'all_users': return <Users className="w-4 h-4" />;
      case 'all_admins': return <Shield className="w-4 h-4" />;
      case 'all_staff': return <UserCheck className="w-4 h-4" />;
      case 'all_parents': return <Heart className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const predefinedRecipients = userGroupService.getPredefinedRecipients();

  if (isLoading) {
    return <GlassPageRouteSkeleton variant="list" />;
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <div className="text-destructive mb-4">Error loading notifications</div>
        <Button onClick={() => fetchNotifications()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pb-12">
      <GlassPageTopBar
        title="Notifications"
        subtitle="Manage and schedule system notifications, reminders, and alerts"
        backHref="/dashboard"
        backLabel="Dashboard"
        meta={
          <div className="flex items-center gap-1.5 flex-wrap">
            {isOnline ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200/60 text-[10px] font-bold flex items-center gap-1">
                <Wifi className="h-3 w-3" /> Online
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200/60 text-[10px] font-bold flex items-center gap-1">
                <WifiOff className="h-3 w-3" /> Offline
              </Badge>
            )}
          </div>
        }
        actions={
          <GlassActionDock>
            {isPushSupported && (
              <GlassActionButton
                label="Push"
                icon={
                  (isSubscribingToPush || isUnsubscribingFromPush) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bell className={`h-4 w-4 ${userPushSubscription && pushPermission === 'granted' ? 'animate-pulse' : ''}`} />
                  )
                }
                tone={userPushSubscription && pushPermission === 'granted' ? 'emerald' : 'slate'}
                disabled={isSubscribingToPush || isUnsubscribingFromPush || pushPermission === 'denied'}
                onClick={handlePushSubscriptionToggle}
                title={
                  userPushSubscription && pushPermission === 'granted'
                    ? 'Push notifications enabled - Click to disable'
                    : pushPermission === 'denied'
                      ? 'Push notifications blocked - Enable in browser settings'
                      : 'Push notifications disabled - Click to enable'
                }
              />
            )}
            <GlassActionButton
              label="New"
              icon={<Plus className="h-4 w-4" />}
              tone="blue"
              onClick={() => setIsDialogOpen(true)}
              title="Create notification"
            />
          </GlassActionDock>
        }
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">






      {/* iMessage-style Chat Feed */}
      <div className="mt-6">
        {/* Progress indicator for active notifications */}
        {activeNotificationId && (
          <div className="mb-4">
            <NotificationProgress
              notificationId={activeNotificationId}
              totalRecipients={formData.recipients.length}
              onComplete={() => setActiveNotificationId(null)}
            />
          </div>
        )}

        {/* Chat-style notification feed */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-850">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Messages
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Your sent and received notifications</p>
          </div>
          <div className="px-4 max-h-[600px] overflow-y-auto">
            <NotificationChatFeed
              sentNotifications={sentNotifications}
              receivedNotifications={receivedNotifications}
              currentUserId={user?.id || ''}
              isLoading={isSentLoading || isReceivedLoading}
              expandedId={expandedNotificationId}
              onToggleExpand={toggleNotificationExpanded}
              onResend={handleResendNotification}
              onDelete={handleDeleteNotification}
              onRemind={handleRemindNotification}
            />
          </div>
        </div>
      </div>

      {/* Create Notification Dialog */}
      <ModernDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <ModernDialogContent
          size="xl"
          className="w-[95vw] max-w-4xl"
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        >
          <ModernDialogHeader className="p-2">
            <ModernDialogTitle className="text-sm">Create New Notification</ModernDialogTitle>
            <ModernDialogDescription className="text-[0.65rem]">
              Schedule a new notification or reminder for the system.
            </ModernDialogDescription>
          </ModernDialogHeader>

          {/* Academic Context Banner */}
          <div className="mx-1 sm:mx-2 mt-1 sm:mt-2 p-1 border rounded-md text-[0.6rem] bg-yellow-50 border-yellow-200">
            <div className="flex flex-wrap gap-1 items-center">
              <div className="flex items-center gap-0.5">
                <Bell className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="font-medium">Notification Management</span>
              </div>
              <div>
                <strong>Date:</strong> {format(new Date(), "MMM dd, yyyy")}
              </div>
              <div className="text-[0.5rem] px-1 py-0.5 rounded ml-auto text-yellow-700 bg-yellow-100">
                Create Mode
              </div>
            </div>
          </div>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter notification title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter notification description (optional)"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: NotificationType) =>
                    setFormData(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center space-x-2">
                          {type.icon}
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: NotificationPriority) =>
                    setFormData(prev => ({ ...prev, priority: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledFor">Schedule For (Optional)</Label>
              <Input
                id="scheduledFor"
                type="datetime-local"
                value={formData.scheduledFor}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduledFor: e.target.value }))}
              />
            </div>

            {/* Flow-specific fields */}
            {formData.type === 'flow' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="longMessage">Long Message (up to 3000+ characters)</Label>
                  <Textarea
                    id="longMessage"
                    value={formData.longMessage}
                    onChange={(e) => setFormData(prev => ({ ...prev, longMessage: e.target.value }))}
                    placeholder="Enter your detailed message here. This can be very long and include detailed information..."
                    rows={8}
                    className="resize-vertical"
                    maxLength={5000}
                  />
                  <p className="text-xs text-gray-500">
                    {formData.longMessage.length}/5000 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>File Attachments (PDFs, Images, Documents)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                        onChange={handleFileUpload}
                        disabled={isUploadingFile}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        disabled={isUploadingFile}
                      >
                        {isUploadingFile ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload File
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Upload Progress */}
                  {isUploadingFile && (
                    <div className="space-y-1">
                      <Progress value={uploadProgress} className="w-full" />
                      <p className="text-xs text-gray-500">{uploadProgress}% uploaded</p>
                    </div>
                  )}

                  {/* Attachment List */}
                  {formData.attachments.length > 0 && (
                    <div className="space-y-2">
                      {formData.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                          <div className="flex items-center gap-3">
                            {attachment.type === 'pdf' ? (
                              <FileText className="h-5 w-5 text-red-500" />
                            ) : attachment.type === 'image' ? (
                              <img
                                src={attachment.url}
                                alt={attachment.name}
                                className="h-8 w-8 object-cover rounded"
                              />
                            ) : (
                              <Paperclip className="h-5 w-5 text-blue-500" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{attachment.name}</p>
                              <p className="text-xs text-gray-500">
                                {(attachment.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = attachment.downloadUrl || attachment.url;
                                link.download = attachment.name;
                                link.click();
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveAttachment(attachment.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="useMarkdown"
                      checked={formData.useMarkdown}
                      onCheckedChange={(checked: boolean) =>
                        setFormData(prev => ({ ...prev, useMarkdown: checked }))
                      }
                    />
                    <Label htmlFor="useMarkdown" className="text-sm">
                      Enable Markdown formatting (bold, italic, links, etc.)
                    </Label>
                  </div>
                  <p className="text-xs text-gray-500">
                    When enabled, you can use Markdown syntax like **bold**, *italic*, and [links](url)
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Recipients *</Label>
              <AdvancedRecipientPicker
                selectedRecipients={formData.recipients}
                onRecipientsChange={(recipients) => setFormData(prev => ({ ...prev, recipients }))}
              />
            </div>

            {/* Push Notification Settings */}
            {isPushSupported && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Push Notifications</Label>
                    <p className="text-sm text-gray-500">Send real-time push notifications to devices</p>
                    {pushPermission !== 'granted' && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Push notifications require browser permission to work
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.enablePush}
                      onChange={(e) => setFormData(prev => ({ ...prev, enablePush: e.target.checked }))}
                      className="h-4 w-4"
                      disabled={pushPermission === 'denied'}
                    />
                    {pushPermission === 'denied' && (
                      <span className="text-xs text-red-600">Blocked</span>
                    )}
                  </div>
                </div>

                {pushPermission !== 'granted' && formData.enablePush && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800">Permission Required</p>
                        <p className="text-amber-700">
                          {pushPermission === 'default'
                            ? 'You will be prompted to allow push notifications when you create this notification.'
                            : 'Push notifications are blocked. Please enable them in your browser settings to receive notifications.'
                          }
                        </p>
                        {pushPermission === 'default' && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleRequestPermission}
                            disabled={isRequestingPermission}
                            className="mt-2 h-10 px-6 rounded-full bg-amber-600 hover:bg-amber-700 text-white"
                          >
                            {isRequestingPermission ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Requesting...
                              </>
                            ) : (
                              'Request Permission Now'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {formData.enablePush && pushPermission === 'granted' && (
                  <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                    <div>
                      <Label htmlFor="pushTitle">Push Title (Optional)</Label>
                      <Input
                        id="pushTitle"
                        value={formData.pushTitle}
                        onChange={(e) => setFormData(prev => ({ ...prev, pushTitle: e.target.value }))}
                        placeholder="Leave empty to use main title"
                      />
                    </div>

                    <div>
                      <Label htmlFor="pushBody">Push Message (Optional)</Label>
                      <Textarea
                        id="pushBody"
                        value={formData.pushBody}
                        onChange={(e) => setFormData(prev => ({ ...prev, pushBody: e.target.value }))}
                        placeholder="Leave empty to use description"
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label htmlFor="pushUrl">Click URL</Label>
                      <Input
                        id="pushUrl"
                        value={formData.pushUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, pushUrl: e.target.value }))}
                        placeholder="/notifications"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <ModernDialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              className="h-10 w-10 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isCreating}
              className="h-10 px-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>

      {/* Settings Dialog */}
      <ModernDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <ModernDialogContent size="md">
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Push Notification Settings
            </ModernDialogTitle>
            <ModernDialogDescription>
              Manage your push notification preferences and permissions
            </ModernDialogDescription>
          </ModernDialogHeader>

          <div className="space-y-6 py-4">
            {/* Permission Status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Permission Status</Label>
                  <p className="text-sm text-gray-500">Current browser notification permission</p>
                </div>
                <Badge
                  className={
                    pushPermission === 'granted'
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : pushPermission === 'denied'
                        ? 'bg-red-100 text-red-800 border-red-200'
                        : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                  }
                >
                  {pushPermission === 'granted' ? 'Granted' :
                    pushPermission === 'denied' ? 'Denied' : 'Not Requested'}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Subscription Status:</span>
                <Badge variant="outline" className={userPushSubscription ? 'text-green-600' : 'text-gray-600'}>
                  {userPushSubscription ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>

            {/* Push Notification Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Push Notifications</Label>
                  <p className="text-sm text-gray-500">Receive notifications even when browser is closed</p>
                </div>
                <div className="flex items-center gap-2">
                  {pushPermission === 'default' && (
                    <Button
                      onClick={handleRequestPermission}
                      disabled={isRequestingPermission}
                      size="icon"
                      className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isRequestingPermission ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Bell className="h-4 w-4" />
                      )}
                    </Button>
                  )}

                  {pushPermission === 'granted' && (
                    <Button
                      onClick={handlePushSubscriptionToggle}
                      variant={userPushSubscription ? "destructive" : "default"}
                      disabled={isSubscribingToPush || isUnsubscribingFromPush}
                      size="icon"
                      className={`h-10 w-10 rounded-full ${
                        userPushSubscription 
                          ? 'bg-green-500 hover:bg-green-600 text-white' 
                          : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                      }`}
                    >
                      {(isSubscribingToPush || isUnsubscribingFromPush) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Bell className={`h-4 w-4 ${userPushSubscription ? 'animate-pulse' : ''}`} />
                      )}
                    </Button>
                  )}

                  {pushPermission === 'denied' && (
                    <div className="text-sm text-red-600">
                      <p>Notifications blocked</p>
                      <p className="text-xs">Enable in browser settings</p>
                    </div>
                  )}
                </div>
              </div>

              {pushPermission !== 'granted' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800">Permission Required</p>
                      <p className="text-amber-700">
                        {pushPermission === 'default'
                          ? 'Click "Enable" to allow push notifications from this site.'
                          : 'Push notifications are blocked. Please enable them in your browser settings.'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* How It Works */}
            {userPushSubscription && pushPermission === 'granted' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Smartphone className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 mb-2">How Background Notifications Work</p>
                    <ul className="text-sm text-blue-700 space-y-1.5">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span><strong>Browser Closed:</strong> Notifications still appear via service worker</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span><strong>Signed In:</strong> Works as long as you're logged into the app</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span><strong>Device Specific:</strong> Enable on each device separately</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span><strong>Instant Alerts:</strong> Receive important updates immediately</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Browser Support */}
            {!isPushSupported && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-gray-600 mt-0.5" />
                  <div className="text-sm text-gray-700">
                    <p className="font-medium">Push Notifications Not Supported</p>
                    <p>Your browser doesn't support push notifications. Notifications will only be shown when the app is open.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <ModernDialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsSettingsOpen(false)}
              className="h-10 w-10 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>
      </div>
    </div>
  );
} 
