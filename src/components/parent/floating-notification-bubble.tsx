"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { notificationService } from '@/lib/services/notification-service';
import { useNotificationBadge } from '@/lib/hooks/use-notification-badge';
import type { Notification } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { FloatingNotificationsModal } from './floating-notifications-modal';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Icons
import { 
  Bell, 
  X, 
  Clock, 
  AlertCircle, 
  MessageSquare, 
  Calendar, 
  Users, 
  CheckCircle,
  ChevronRight
} from 'lucide-react';

const TYPE_ICONS = {
  reminder: <Clock className="h-4 w-4" />,
  alert: <AlertCircle className="h-4 w-4" />,
  announcement: <MessageSquare className="h-4 w-4" />,
  task: <CheckCircle className="h-4 w-4" />,
  system: <Bell className="h-4 w-4" />,
  fee_reminder: <Calendar className="h-4 w-4" />,
  exam_reminder: <Calendar className="h-4 w-4" />,
  attendance_alert: <Users className="h-4 w-4" />,
  flow: <MessageSquare className="h-4 w-4" />,
};

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

interface FloatingNotificationBubbleProps {
  className?: string;
}

export function FloatingNotificationBubble({ className = '' }: FloatingNotificationBubbleProps) {
  const { user } = useAuth();
  const { unreadCount, markAsRead } = useNotificationBadge();
  const [recentNotification, setRecentNotification] = useState<Notification | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);

  useEffect(() => {
    if (user?.id && !isDismissed) {
      loadRecentNotification();
    }
  }, [user?.id, unreadCount, isDismissed]);

  const loadRecentNotification = async () => {
    try {
      if (!user?.id) return;
      
      // Get all notifications
      const allNotifications = await notificationService.getAllNotifications();
      
      // Filter notifications for parents (recipients include 'all_parents', 'all_users', or specific parent user ID)
      const parentNotifications = allNotifications.filter(notification => 
        notification.recipients.some(recipient => 
          recipient.id === 'all_parents' || 
          recipient.id === 'all_users' || 
          recipient.id === user.id
        )
      );

      // Get unread notifications only
      const unreadNotifications = parentNotifications.filter(notification => 
        !(notification as any).readBy?.includes(user.id)
      );

      if (unreadNotifications.length > 0) {
        // Sort by creation date (newest first) and get the most recent
        const sortedNotifications = unreadNotifications.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        const mostRecent = sortedNotifications[0];
        setRecentNotification(mostRecent);
        setIsVisible(true);
      } else {
        setRecentNotification(null);
        setIsVisible(false);
      }
    } catch (error) {
      console.error('Error loading recent notification:', error);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
  };

  const handleBubbleClick = () => {
    // Mark as read when clicked
    if (recentNotification && user?.id) {
      markAsRead(recentNotification.id);
    }
    
    // Open the notifications modal when bubble is clicked
    setIsNotificationsModalOpen(true);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  if (!isVisible || !recentNotification) {
    return null;
  }

  // Show compact notification bubble
  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 50 }}
          transition={{ type: "spring", duration: 0.5 }}
          className={`fixed bottom-20 right-4 z-50 max-w-xs ${className}`}
        >
          <Card className="cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-blue-200 bg-white shadow-lg">
            <CardContent className="p-3">
              {/* Header with priority badge and dismiss button */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Badge className={PRIORITY_COLORS[recentNotification.priority]} variant="secondary">
                    {recentNotification.priority.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-gray-500">{formatDate(recentNotification.createdAt)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss();
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              {/* Notification title only */}
              <div onClick={handleBubbleClick} className="space-y-2">
                <h4 className="font-semibold text-sm text-gray-900 line-clamp-2 leading-tight">
                  {recentNotification.title}
                </h4>
                
                {/* Click hint */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2">
                    <Bell className="h-3 w-3 text-blue-500" />
                    <span className="text-xs text-blue-600 font-medium">Click to view</span>
                  </div>
                  <ChevronRight className="h-3 w-3 text-gray-400" />
                </div>
              </div>

              {/* Unread count indicator */}
              {unreadCount > 1 && (
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-semibold border-2 border-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Floating Notifications Modal */}
      <FloatingNotificationsModal 
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
      />
    </>
  );
}
