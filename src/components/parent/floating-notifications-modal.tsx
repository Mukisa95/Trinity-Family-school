"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { notificationService } from '@/lib/services/notification-service';
import type { Notification } from '@/types';

// UI Components
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
  ChevronUp
} from 'lucide-react';

interface FloatingNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FloatingNotificationsModal({ isOpen, onClose }: FloatingNotificationsModalProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set());
  const [viewedNotifications, setViewedNotifications] = useState<Set<string>>(new Set());
  const [isCompact, setIsCompact] = useState(true);

  useEffect(() => {
    if (isOpen && user?.id) {
      loadNotifications();
    }
  }, [isOpen, user?.id]);

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
      // Mark as viewed when collapsing
      setViewedNotifications(prev => new Set([...prev, notificationId]));
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

  const handleClose = () => {
    setExpandedNotifications(new Set());
    onClose();
  };

  const unreadCount = notifications.filter(n => !n.readBy?.includes(user?.id || '')).length;

  // If no notifications or all viewed, show avatar
  if (!isOpen) return null;

  // Show avatar if all notifications have been viewed
  if (viewedNotifications.size >= notifications.length && notifications.length > 0) {
    return (
      <div className="fixed bottom-20 left-4 z-50">
        <Avatar 
          className="h-12 w-12 cursor-pointer shadow-lg border-2 border-white"
          onClick={() => setIsCompact(false)}
        >
          <AvatarImage src="/notifications-avatar.jpg" alt="Notifications" />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
            <Bell className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  // Show compact notifications list
  if (isCompact) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 max-w-md mx-auto">
        <Card className="shadow-2xl border-2 border-blue-200 bg-white dark:bg-gray-800">
          <CardContent className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <Bell className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Notifications
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {unreadCount} unread
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCompact(false)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Compact Notifications List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2 w-1/2" />
                    </div>
                  </div>
                ))
              ) : notifications.length === 0 ? (
                <div className="text-center py-4">
                  <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No notifications</p>
                </div>
              ) : (
                notifications.slice(0, 5).map((notification) => {
                  const isExpanded = expandedNotifications.has(notification.id);
                  const isUnread = !notification.readBy?.includes(user?.id || '');
                  
                  return (
                    <div
                      key={notification.id}
                      className={`p-2 rounded-lg cursor-pointer transition-all duration-200 ${
                        isUnread 
                          ? 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800' 
                          : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                      onClick={() => toggleNotificationExpansion(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-white dark:bg-gray-800 rounded-lg">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                              {notification.title}
                            </h4>
                            {isUnread && (
                              <Badge className="bg-blue-500 text-white text-xs px-1.5 py-0.5">
                                New
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <Badge
                              variant="outline"
                              className={`px-1.5 py-0.5 text-xs ${getPriorityColor(notification.priority)}`}
                            >
                              {notification.priority}
                            </Badge>
                            <span>{formatDate(notification.createdAt)}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                          {notification.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                              {notification.description}
                            </p>
                          )}
                          
                          {/* Flow notification rich content */}
                          {notification.type === 'flow' && notification.richContent && (
                            <div className="space-y-3">
                              {notification.richContent.longMessage && (
                                <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300 max-h-32 overflow-y-auto">
                                  {notification.richContent.longMessage}
                                </div>
                              )}
                              
                              {notification.richContent.attachments && notification.richContent.attachments.length > 0 && (
                                <div className="space-y-2">
                                  <h5 className="font-medium text-sm text-gray-700 dark:text-gray-300">
                                    Attachments ({notification.richContent.attachments.length})
                                  </h5>
                                  <div className="space-y-2">
                                    {notification.richContent.attachments.slice(0, 2).map((attachment, index) => (
                                      <div key={index} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded-lg border">
                                        <div className="p-1.5 bg-gray-100 dark:bg-gray-600 rounded">
                                          {attachment.type === 'image' ? (
                                            <ImageIcon className="w-4 h-4 text-green-600" />
                                          ) : attachment.type === 'pdf' ? (
                                            <FileText className="w-4 h-4 text-red-600" />
                                          ) : (
                                            <Paperclip className="w-4 h-4 text-gray-600" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                                            {attachment.name}
                                          </p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {(attachment.size / 1024 / 1024).toFixed(2)} MB
                                          </p>
                                        </div>
                                        <Button size="sm" variant="outline" className="px-2 text-xs">
                                          <Download className="w-3 h-3 mr-1" />
                                          Get
                                        </Button>
                                      </div>
                                    ))}
                                    {notification.richContent.attachments.length > 2 && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                        +{notification.richContent.attachments.length - 2} more
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* View All Button */}
            {notifications.length > 5 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setIsCompact(false)}
                >
                  View All {notifications.length} Notifications
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show full expanded modal
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-4">
      <div className="w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                All Notifications
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {notifications.length} total, {unreadCount} unread
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCompact(true)}
              className="h-8 w-8 p-0"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Full Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4">
          <div className="space-y-3">
            {notifications.map((notification) => {
              const isExpanded = expandedNotifications.has(notification.id);
              const isUnread = !notification.readBy?.includes(user?.id || '');
              
              return (
                <Card
                  key={notification.id}
                  className={`transition-all duration-300 hover:shadow-lg border-2 ${
                    isExpanded 
                      ? 'border-blue-500 shadow-xl bg-blue-50 dark:bg-blue-950/20' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  } ${isUnread ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-lg">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
                            {notification.title}
                          </h4>
                          {isUnread && (
                            <Badge className="bg-blue-500 text-white text-xs px-2 py-0.5">
                              New
                            </Badge>
                          )}
                        </div>
                        
                        {notification.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                            {notification.description}
                          </p>
                        )}
                        
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
                            className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 self-start sm:self-auto"
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
                        {/* Flow notification rich content */}
                        {notification.type === 'flow' && notification.richContent && (
                          <div className="space-y-4 mb-4">
                            {notification.richContent.longMessage && (
                              <div>
                                <h5 className="font-semibold text-sm mb-2 text-gray-700 dark:text-gray-300">
                                  Full Message
                                </h5>
                                <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300 max-h-48 overflow-y-auto">
                                  {notification.richContent.longMessage}
                                </div>
                              </div>
                            )}
                            
                            {notification.richContent.attachments && notification.richContent.attachments.length > 0 && (
                              <div>
                                <h5 className="font-semibold text-sm mb-3 text-gray-700 dark:text-gray-300">
                                  Attachments
                                </h5>
                                <div className="space-y-2">
                                  {notification.richContent.attachments.map((attachment, index) => (
                                    <div key={index} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border">
                                      <div className="p-2 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-600 dark:to-gray-500 rounded-lg">
                                        {attachment.type === 'image' ? (
                                          <ImageIcon className="w-5 h-5 text-green-600" />
                                        ) : attachment.type === 'pdf' ? (
                                          <FileText className="w-5 h-5 text-red-600" />
                                        ) : (
                                          <Paperclip className="w-5 h-5 text-gray-600" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
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
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border">
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
        </div>
      </div>
    </div>
  );
}
