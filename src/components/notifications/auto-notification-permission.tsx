"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/contexts/auth-context';

/**
 * Component that automatically requests notification permissions
 * and shows a friendly prompt if not already granted
 */
export function AutoNotificationPermission() {
  const { user } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // Only run in browser and if user is logged in
    if (typeof window === 'undefined' || !user) return;

    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.log('Notifications not supported in this browser');
      return;
    }

    const currentPermission = Notification.permission;
    setPermissionStatus(currentPermission);

    // Check if we've already asked (using localStorage to avoid being too aggressive)
    const hasAskedBefore = localStorage.getItem('notification-permission-asked');
    const lastAskedTime = localStorage.getItem('notification-permission-asked-time');
    
    // If permission is default and we haven't asked in the last 7 days
    if (currentPermission === 'default') {
      const now = Date.now();
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      
      if (!hasAskedBefore || (lastAskedTime && now - parseInt(lastAskedTime) > sevenDaysInMs)) {
        // Show prompt after a short delay so user sees the page first
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 3000); // 3 seconds delay
        
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  const requestPermission = async () => {
    setIsRequesting(true);
    
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      
      // Mark that we've asked
      localStorage.setItem('notification-permission-asked', 'true');
      localStorage.setItem('notification-permission-asked-time', Date.now().toString());
      
      if (permission === 'granted') {
        console.log('✅ Notification permission granted');
        
        // Try to register service worker and subscribe to push
        try {
          if ('serviceWorker' in navigator && 'PushManager' in window) {
            const registration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;
            console.log('✅ Service worker ready for push notifications');
          }
        } catch (swError) {
          console.error('Service worker registration error:', swError);
          // Don't fail the whole process if SW fails
        }
      }
      
      // Hide prompt after a moment
      setTimeout(() => {
        setShowPrompt(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    // Mark that we've asked so we don't show again immediately
    localStorage.setItem('notification-permission-asked', 'true');
    localStorage.setItem('notification-permission-asked-time', Date.now().toString());
  };

  // Don't show if permission already granted or denied
  if (permissionStatus !== 'default' || !showPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-6 right-6 z-50 max-w-sm"
      >
        <Card className="bg-white shadow-2xl border-2 border-blue-100 overflow-hidden">
          <div className="relative">
            {/* Gradient header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
              <div className="flex items-start gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                  <Bell className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">Stay Updated!</h3>
                  <p className="text-sm text-blue-50">
                    Enable notifications to receive important updates about your school.
                  </p>
                </div>
                <button
                  onClick={dismissPrompt}
                  className="text-white/80 hover:text-white transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Attendance updates</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Important announcements</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Fee reminders</span>
                </li>
              </ul>

              <div className="flex gap-2">
                <Button
                  onClick={requestPermission}
                  disabled={isRequesting}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                >
                  {isRequesting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                      />
                      Requesting...
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Enable Notifications
                    </>
                  )}
                </Button>
                <Button
                  onClick={dismissPrompt}
                  variant="outline"
                  className="px-4"
                >
                  Later
                </Button>
              </div>

              <p className="text-xs text-gray-400 text-center">
                You can change this later in your browser settings
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

