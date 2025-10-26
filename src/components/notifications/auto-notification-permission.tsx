"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();
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

    console.log('[Auto Notification] Current permission status:', currentPermission);
    
    // Show prompt on EVERY visit if permission is not granted
    // Only show for 'default' (not yet decided) - respect explicit denials
    if (currentPermission === 'default') {
      console.log('[Auto Notification] Permission not granted, will show prompt after delay');
      
      // Show prompt after a short delay so user sees the page first
      const timer = setTimeout(() => {
        setShowPrompt(true);
        console.log('[Auto Notification] Showing notification permission prompt');
      }, 3000); // 3 seconds delay
      
      return () => clearTimeout(timer);
    } else if (currentPermission === 'granted') {
      console.log('[Auto Notification] Permission already granted, ensuring service worker is registered');
      
      // If granted but service worker might not be registered, register it
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.register('/sw.js').then(() => {
          console.log('[Auto Notification] Service worker ensured for granted permission');
        }).catch((error) => {
          console.error('[Auto Notification] Service worker registration error:', error);
        });
      }
    } else if (currentPermission === 'denied') {
      console.log('[Auto Notification] Permission explicitly denied by user, respecting choice');
    }
  }, [user, pathname]); // Re-run on every navigation

  const requestPermission = async () => {
    setIsRequesting(true);
    
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      
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
      } else if (permission === 'denied') {
        console.log('⚠️ Notification permission denied by user');
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
    // Prompt will show again on next visit/navigation if permission still not granted
    console.log('[Auto Notification] User dismissed prompt, will show again on next visit');
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
                This prompt will appear on each visit until enabled
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

