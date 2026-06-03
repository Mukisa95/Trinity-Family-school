"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { notificationService } from '@/lib/services/notification-service';
import { pushNotificationService } from '@/lib/services/push-notifications.service';
import type { Notification } from '@/types';

// UI Components
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

// Icons
import { 
  Bell, 
  FileText, 
  Image as ImageIcon, 
  Paperclip, 
  Download,
  Calendar,
  AlertCircle,
  Info,
  CheckCircle,
  X,
  Clock,
  Users,
  Tag,
  ChevronDown,
  ChevronUp,
  BellRing,
  BellOff,
  Smartphone,
  Loader2
} from 'lucide-react';

interface FloatingNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FloatingNotificationsModal({ isOpen, onClose }: FloatingNotificationsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set());
  
  // Push notification states
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showSubscriptionBanner, setShowSubscriptionBanner] = useState(true);

  useEffect(() => {
    if (isOpen && user?.id) {
      loadNotifications();
      checkPushNotificationStatus();
    }
  }, [isOpen, user?.id]);

  // Check push notification support and status
  const checkPushNotificationStatus = async () => {
    if (typeof window === 'undefined') return;
    
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsPushSupported(supported);
    
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
    
    if (supported && user?.id) {
      try {
        // Check if user has active subscription
        const subscription = await notificationService.getUserPushSubscription(user.id);
        setIsSubscribed(!!subscription);
        
        // If not subscribed, show banner
        setShowSubscriptionBanner(!subscription);
      } catch (error) {
        console.error('Error checking push subscription:', error);
      }
    }
  };

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      if (!user?.id) return;

      const allNotifications = await notificationService.getAllNotifications();
      const parentNotifications = allNotifications.filter(notification =>
        notification.recipients.some(recipient =>
          recipient.id === 'all_parents' ||
          recipient.id === 'all_users' ||
          recipient.id === user.id
        )
      );

      parentNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(parentNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNotificationExpansion = async (notificationId: string) => {
    const newExpanded = new Set(expandedNotifications);
    
    if (newExpanded.has(notificationId)) {
      newExpanded.delete(notificationId);
    } else {
      newExpanded.add(notificationId);
      
      // Mark as read when expanding
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && user?.id && !notification.readBy?.includes(user.id)) {
        try {
          await notificationService.markAsRead(notificationId, user.id);
          setNotifications(prev => prev.map(n =>
            n.id === notificationId
              ? { ...n, readBy: [...(n.readBy || []), user.id] }
              : n
          ));
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      }
    }
    
    setExpandedNotifications(newExpanded);
  };

  // Handle push notification subscription toggle
  const handleSubscriptionToggle = async () => {
    if (!user?.id || !isPushSupported) return;
    
    setIsSubscribing(true);
    
    try {
      if (!isSubscribed) {
        // Subscribe
        console.log('🔔 Subscribing parent to push notifications...');
        
        // Request permission if needed
        if (pushPermission === 'default') {
          const permission = await Notification.requestPermission();
          setPushPermission(permission);
          
          if (permission !== 'granted') {
            toast({
              title: "Permission Denied",
              description: "Please allow notifications in your browser settings.",
              variant: "destructive"
            });
            setIsSubscribing(false);
            return;
          }
        } else if (pushPermission === 'denied') {
          toast({
            title: "Notifications Blocked",
            description: "Please enable notifications in your browser settings.",
            variant: "destructive"
          });
          setIsSubscribing(false);
          return;
        }
        
        // Subscribe to push notifications (this saves to database)
        const subscription = await pushNotificationService.subscribe(user.id);
        
        if (!subscription) {
          throw new Error('Failed to create push subscription');
        }
        
        setIsSubscribed(true);
        setShowSubscriptionBanner(false);
        
        toast({
          title: "✅ Notifications Enabled!",
          description: "You'll now receive important push notifications.",
        });
      } else {
        // Unsubscribe
        console.log('🔕 Unsubscribing parent from push notifications...');
        
        await pushNotificationService.unsubscribe(user.id);
        
        setIsSubscribed(false);
        setShowSubscriptionBanner(true);
        
        toast({
          title: "Notifications Disabled",
          description: "You won't receive push notifications anymore.",
        });
      }
    } catch (error) {
      console.error('Error toggling push subscription:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update notification settings",
        variant: "destructive"
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'announcement':
        return <Bell className="h-4 w-4 text-blue-500" />;
      case 'alert':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'reminder':
        return <Calendar className="h-4 w-4 text-green-500" />;
      case 'flow':
        return <FileText className="h-4 w-4 text-purple-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'urgent':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal':
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Recently';
    }
  };

  const unreadCount = notifications.filter(n => !n.readBy?.includes(user?.id || '')).length;

  // If not open, return null
  if (!isOpen) return null;

  // Full-screen modal view
  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header with Push Notification Button */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Notifications</h1>
            <p className="text-sm text-white/90">
              {notifications.length} total, {unreadCount} unread
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Push Notification Subscription Button */}
          {isPushSupported && (
            <Button
              onClick={handleSubscriptionToggle}
              disabled={isSubscribing || pushPermission === 'denied'}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                isSubscribed
                  ? 'bg-white text-blue-600 hover:bg-white/90 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30 border-2 border-white'
              }`}
              title={
                isSubscribed
                  ? 'Push notifications enabled'
                  : pushPermission === 'denied'
                    ? 'Enable in browser settings'
                    : 'Enable push notifications'
              }
            >
              {isSubscribing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isSubscribed ? (
                <BellRing className="h-5 w-5" />
              ) : (
                <BellOff className="h-5 w-5" />
              )}
              <span className="font-semibold hidden sm:inline">
                {isSubscribed ? 'Enabled' : 'Enable Push'}
              </span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-10 w-10 p-0 hover:bg-white/20 text-white"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Subscription Banner for Unsubscribed Users */}
      {isPushSupported && !isSubscribed && showSubscriptionBanner && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-b-2 border-yellow-300 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-yellow-400 rounded-lg flex-shrink-0">
              <Smartphone className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                📱 Never Miss an Update!
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                Enable push notifications to receive important updates about your child's education instantly.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSubscriptionToggle}
                  disabled={isSubscribing}
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {isSubscribing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enabling...
                    </>
                  ) : (
                    <>
                      <BellRing className="h-4 w-4 mr-2" />
                      Enable Now
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setShowSubscriptionBanner(false)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 dark:text-gray-400"
                >
                  Maybe Later
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSubscriptionBanner(false)}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
              <Bell className="h-16 w-16 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Notifications Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              You'll see important updates from the school here.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl mx-auto">
            {notifications.map((notification) => {
              const isExpanded = expandedNotifications.has(notification.id);
              const isUnread = !notification.readBy?.includes(user?.id || '');
              
              return (
                <Card
                  key={notification.id}
                  className={`transition-all duration-300 hover:shadow-lg border-2 ${
                    isExpanded 
                      ? 'border-blue-500 shadow-xl bg-blue-50/50 dark:bg-blue-950/20' 
                      : isUnread
                        ? 'border-blue-300 bg-blue-50/30 dark:bg-blue-950/10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-3 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-xl flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            {notification.title}
                          </h3>
                          {isUnread && (
                            <Badge className="bg-blue-500 text-white text-xs px-2 py-0.5">
                              New
                            </Badge>
                          )}
                        </div>
                        
                        {notification.description && !isExpanded && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2 leading-relaxed">
                            {notification.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-xs px-2 py-1 ${getPriorityColor(notification.priority)}`}
                            >
                              {notification.priority}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <Clock className="h-3 w-3" />
                              {formatDate(notification.createdAt)}
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleNotificationExpansion(notification.id)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                          >
                            {isExpanded ? (
                              <>
                                <span>Show Less</span>
                                <ChevronUp className="h-3 w-3 ml-1" />
                              </>
                            ) : (
                              <>
                                <span>Show More</span>
                                <ChevronDown className="h-3 w-3 ml-1" />
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        {notification.description && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                            {notification.description}
                          </p>
                        )}
                        
                        {/* Flow notification rich content */}
                        {notification.type === 'flow' && notification.richContent && (
                          <div className="space-y-4">
                            {notification.richContent.longMessage && (
                              <div>
                                <h5 className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100">
                                  Full Message
                                </h5>
                                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300 max-h-64 overflow-y-auto">
                                  {notification.richContent.longMessage}
                                </div>
                              </div>
                            )}
                            
                            {notification.richContent.attachments && notification.richContent.attachments.length > 0 && (
                              <div>
                                <h5 className="font-semibold text-sm mb-3 text-gray-900 dark:text-gray-100">
                                  Attachments ({notification.richContent.attachments.length})
                                </h5>
                                <div className="space-y-2">
                                  {notification.richContent.attachments.map((attachment, index) => (
                                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                                      <div className="p-2 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg">
                                        {attachment.type === 'image' ? (
                                          <ImageIcon className="w-5 h-5 text-green-600" />
                                        ) : attachment.type === 'pdf' ? (
                                          <FileText className="w-5 h-5 text-red-600" />
                                        ) : (
                                          <Paperclip className="w-5 h-5 text-gray-600" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                          {attachment.name}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                          {(attachment.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                      </div>
                                      <Button size="sm" variant="outline" className="px-3 text-xs">
                                        <Download className="w-4 h-4 mr-1" />
                                        Download
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Notification Details */}
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border mt-4">
                          <h5 className="font-semibold text-sm mb-3 text-gray-900 dark:text-gray-100">
                            Notification Details
                          </h5>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="flex items-center gap-2">
                              <Tag className="h-3 w-3 text-blue-500" />
                              <span className="text-gray-500 dark:text-gray-400">Type:</span>
                              <span className="font-medium capitalize">{notification.type}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-3 w-3 text-green-500" />
                              <span className="text-gray-500 dark:text-gray-400">Recipients:</span>
                              <span className="font-medium">{notification.recipients?.length || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
