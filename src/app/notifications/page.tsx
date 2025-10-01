"use client";

import React, { useState, useEffect } from 'react';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { useSyncContext } from '@/context/SyncContext';
import { useNotificationBadge } from '@/lib/hooks/use-notification-badge';
import { pushNotificationService } from '@/lib/services/push-notifications.service';
import { NotificationProgress } from '@/components/NotificationProgress';
import { format } from 'date-fns';
import { PageHeader } from '@/components/common/page-header';
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
import { notificationService } from '@/lib/services/notification-service';

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
  
  const { fetchUnreadCount: refreshBadge } = useNotificationBadge();
  
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
      // Check push notification support
      const isPushSupportedValue = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      const pushPermissionValue = 'Notification' in window ? Notification.permission : 'default';
      
      setIsPushSupported(isPushSupportedValue);
      setPushPermission(pushPermissionValue);
      
      // Check user's push subscription
      if (user?.id) {
        notificationService.getUserPushSubscription(user.id)
          .then(setUserPushSubscription)
          .catch(console.error);
      }
    }
  }, [user?.id]);

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
      const permission = await Notification.requestPermission();
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

    // Check push notification permission if push is enabled
    if (formData.enablePush && isPushSupported && pushPermission !== 'granted') {
      if (pushPermission === 'denied') {
        toast({
          variant: "destructive",
          title: "Push Notifications Blocked",
          description: "Push notifications are blocked. The notification will be created but won't be sent as push notifications.",
        });
      } else if (pushPermission === 'default') {
        // Request permission before creating notification
        try {
          const permission = await Notification.requestPermission();
          setPushPermission(permission);
          
          if (permission === 'denied') {
            toast({
              variant: "destructive",
              title: "Permission Denied",
              description: "Push notifications were denied. The notification will be created but won't be sent as push notifications.",
            });
          } else if (permission === 'granted') {
            toast({
              title: "Permission Granted!",
              description: "Push notifications are now enabled.",
            });
          }
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Permission Error",
            description: "Failed to request notification permission. Continuing without push notifications.",
          });
        }
      }
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
        enablePush: formData.enablePush && pushPermission === 'granted', // Only enable push if permission is granted
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
        
        // Refresh notification badge and list
        await refreshBadge();
        await fetchNotifications();
        
        // Show success message
        toast({
          title: "🚀 Notification Queued!",
          description: `Notification queued for ${result.stats.totalRecipients} recipients. Processing in background.`,
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
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading notifications...</span>
      </div>
    );
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
    <>
      <PageHeader
        title="Notifications"
        description="Manage and schedule system notifications, reminders, and alerts."
        actions={
          <div className="flex items-center gap-4">
                         <div className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-600" />
                )}
            </div>

            <Button
              variant="outline"
              onClick={handleForceSync}
              disabled={!isOnline || isSyncing || isSyncingWithServer}
               size="icon"
               className="h-9 w-9"
            >
              {(isSyncing || isSyncingWithServer) ? (
                 <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                 <RefreshCw className="h-4 w-4" />
              )}
            </Button>

                  <Button 
               variant="outline"
               onClick={() => setIsSettingsOpen(true)}
               size="icon"
               className="h-9 w-9"
             >
               <Settings className="h-4 w-4" />
                  </Button>
             <Button onClick={() => setIsDialogOpen(true)}>
               <Plus className="h-4 w-4" />
                  </Button>
                  </div>
        }
      />

      



      {(!notifications || notifications.length === 0) ? (
        <Card>
          <CardContent className="text-center p-10">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No notifications found</p>
            <Button 
              className="mt-4" 
              onClick={() => setIsDialogOpen(true)}
            >
               <Plus className="mr-2 h-4 w-4" />
              Create your first notification
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Progress indicator for active notifications */}
          {activeNotificationId && (
            <NotificationProgress
              notificationId={activeNotificationId}
              totalRecipients={formData.recipients.length}
              onComplete={() => setActiveNotificationId(null)}
            />
          )}
          
          {notifications.map((notification: Notification) => (
            <Card key={notification.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader 
                className="pb-3"
                onClick={() => toggleNotificationExpanded(notification.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{notification.title}</CardTitle>
                      <Badge className={getPriorityColor(notification.priority)}>
                        {notification.priority}
                      </Badge>
                      <Badge className={getStatusColor(notification.status)}>
                        {notification.status}
                      </Badge>
                      {notification.enablePush && (
                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                          <Smartphone className="w-3 h-3 mr-1" />
                          Push
                        </Badge>
                      )}
                      {notification.type === 'flow' && (
                        <Badge variant="outline" className="text-purple-600 border-purple-200">
                          <FileText className="w-3 h-3 mr-1" />
                          Flow
                        </Badge>
                      )}
                    </div>
                    {notification.description && (
                      <CardDescription className="text-sm">
                        {notification.description}
                      </CardDescription>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {notification.status === 'pending' && (
                      <Button
                         size="icon"
                        variant="outline"
                         onClick={(e) => {
                           e.stopPropagation();
                           handleMarkCompleted(notification.id);
                         }}
                         className="h-8 w-8 text-green-600 hover:text-green-700"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                       size="icon"
                      variant="outline"
                       onClick={(e) => {
                         e.stopPropagation();
                         handleDelete(notification.id);
                       }}
                       className="h-8 w-8 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(notification.createdAt), 'MMM d, yyyy')}
                    </div>
                    {notification.scheduledFor && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {format(new Date(notification.scheduledFor), 'MMM d, HH:mm')}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {notification.deliveryStats?.total || 0} recipients
                    </div>
                  </div>
                  
                  {notification.deliveryStats && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-600">
                        {notification.deliveryStats.sent} sent
                      </span>
                      {notification.deliveryStats.failed > 0 && (
                        <span className="text-red-600">
                          {notification.deliveryStats.failed} failed
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>

              {/* Expanded Content Section */}
              {expandedNotificationId === notification.id && (
                <CardContent className="pt-0 border-t bg-gray-50">
                  <div className="space-y-4">
                    {/* Flow notification rich content */}
                    {notification.type === 'flow' && notification.richContent && (
                      <div className="space-y-3">
                        {notification.richContent.longMessage && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Full Message:</h4>
                            <div className="bg-white p-3 rounded border text-sm whitespace-pre-wrap">
                              {notification.richContent.longMessage}
                            </div>
                          </div>
                        )}
                        
                        {notification.richContent.attachments && notification.richContent.attachments.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Attachments:</h4>
                            <div className="space-y-2">
                              {notification.richContent.attachments.map((attachment, index) => (
                                <div key={index} className="flex items-center gap-3 p-2 bg-white rounded border">
                                  {attachment.type === 'image' ? (
                                    <img src="/api/placeholder/40/40" alt="Attachment" className="w-8 h-8 rounded" />
                                  ) : attachment.type === 'pdf' ? (
                                    <FileText className="w-8 h-8 text-red-500" />
                                  ) : (
                                    <Paperclip className="w-8 h-8 text-gray-500" />
                                  )}
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">{attachment.name}</p>
                                    <p className="text-xs text-gray-500">
                                      {(attachment.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                  </div>
                                  <Button size="icon" variant="outline" className="h-8 w-8">
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Basic notification details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Type:</span> {notification.type}
                      </div>
                      <div>
                        <span className="font-medium">Recipients:</span> {notification.recipients?.length || 0}
                      </div>
                      <div>
                        <span className="font-medium">Created:</span> {new Date(notification.createdAt).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="font-medium">Push Enabled:</span> {notification.enablePush ? 'Yes' : 'No'}
                      </div>
                    </div>

                    {/* Push notification details */}
                    {notification.enablePush && (
                      <div className="border-t pt-3">
                        <h4 className="font-semibold text-sm mb-2">Push Notification Details:</h4>
                        <div className="space-y-2 text-sm">
                          <div><span className="font-medium">Push Title:</span> {notification.pushTitle || notification.title}</div>
                          <div><span className="font-medium">Push Body:</span> {notification.pushBody || notification.description}</div>
                          <div><span className="font-medium">Click URL:</span> {notification.pushUrl || '/notifications'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {predefinedRecipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <Checkbox
                      id={recipient.id}
                      checked={formData.recipients.some(r => r.id === recipient.id)}
                      onCheckedChange={(checked: boolean) => handleRecipientToggle(recipient, checked)}
                    />
                    <div className="flex items-center gap-2 flex-1">
                      {getRecipientIcon(recipient.type)}
                      <div>
                        <Label htmlFor={recipient.id} className="text-sm font-medium cursor-pointer">
                          {recipient.name}
                        </Label>
                        <p className="text-xs text-gray-500">
                          {userCounts[recipient.id] || 0} users
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {formData.recipients.length > 0 && (
                <p className="text-sm text-blue-600">
                  Selected: {formData.recipients.map(r => r.name).join(', ')}
                </p>
              )}
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
                            className="mt-2 bg-amber-600 hover:bg-amber-700"
                          >
                            {isRequestingPermission ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
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
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
               <X className="h-4 w-4" />
            </Button>
            <Button onClick={handleSubmit} disabled={isCreating}>
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
                   <p className="text-sm text-gray-500">Receive notifications on your device</p>
                 </div>
                 <div className="flex items-center gap-2">
                   {pushPermission === 'default' && (
                     <Button 
                       onClick={handleRequestPermission}
                       disabled={isRequestingPermission}
                       size="icon"
                       className="h-8 w-8 bg-blue-600 hover:bg-blue-700"
                     >
                       {isRequestingPermission ? (
                         <Loader2 className="h-3 w-3 animate-spin" />
                       ) : (
                         <Bell className="h-3 w-3" />
                       )}
                     </Button>
                   )}
                   
                   {pushPermission === 'granted' && (
                     <Button 
                       onClick={handlePushSubscriptionToggle}
                       variant={userPushSubscription ? "destructive" : "default"}
                       disabled={isSubscribingToPush || isUnsubscribingFromPush}
                       size="icon"
                       className="h-8 w-8"
                     >
                       {(isSubscribingToPush || isUnsubscribingFromPush) ? (
                         <Loader2 className="h-3 w-3 animate-spin" />
                       ) : (
                         <Bell className="h-3 w-3" />
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
             <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
               <X className="h-4 w-4" />
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>
    </>
  );
} 