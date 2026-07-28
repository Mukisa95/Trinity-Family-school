"use client";

import React, { useState, useEffect } from 'react';
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
  ChevronRight
} from 'lucide-react';

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

interface SimpleFloatingNotificationProps {
  className?: string;
}

export function SimpleFloatingNotification({ className = '' }: SimpleFloatingNotificationProps) {
  const { unreadCount, notifications } = useNotificationBadge();
  const [recentNotification, setRecentNotification] = useState<Notification | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [lastUnreadCount, setLastUnreadCount] = useState(0);

  useEffect(() => {
    if (isDismissed) return;
    const unreadNotifications = notifications.filter(notification => !notification.readBy?.length);
    setRecentNotification(unreadNotifications[0] || null);
  }, [notifications, isDismissed]);

  // Show notification immediately when unread count changes
  useEffect(() => {
    if (unreadCount > 0 && !isDismissed) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [unreadCount, isDismissed]);

  // Reset dismissed state when new notifications arrive (unread count increases)
  useEffect(() => {
    if (unreadCount > lastUnreadCount && unreadCount > 0) {
      // If we were dismissed but now have new notifications, reset dismissed state
      if (isDismissed) {
        setIsDismissed(false);
        setIsVisible(true);
      }
    }
    setLastUnreadCount(unreadCount);
  }, [unreadCount, lastUnreadCount, isDismissed]);

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
  };

  const handleBubbleClick = () => {
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

  // Only show if there are unread notifications and not dismissed
  if (!isVisible || !recentNotification || unreadCount === 0) {
    return null;
  }

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
