'use client';

import { useState, useEffect } from 'react';
import { UnifiedNotificationsService } from '@/lib/services/unified-notifications.service';

export default function TestNotifications() {
  const [status, setStatus] = useState<string>('');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('');
  const [platform, setPlatform] = useState<string>('detecting...');

  const VAPID_PUBLIC_KEY = 'BL-P0JiVp1NIUsP4Xx2lF8Xw4QBd8fTlfMIgeg_uNGUwVvndQrr1JDf4wOwn0Q-lCvotMdAQ_KxXzVHYIB2AGIQ';

  useEffect(() => {
    detectPlatform();
    checkNotificationSupport();
    checkCurrentPermission();
  }, []);

  const detectPlatform = () => {
    const detectedPlatform = UnifiedNotificationsService.getPlatform();
    setPlatform(detectedPlatform);
    
    if (detectedPlatform === 'android') {
      setStatus('🤖 Running on Android WebView - using native notifications');
    } else if (detectedPlatform === 'web') {
      setStatus('🌐 Running on web browser - using web push notifications');
    } else {
      setStatus('❌ Platform not supported for notifications');
    }
  };

  const checkNotificationSupport = () => {
    if (!('Notification' in window)) {
      setStatus('❌ Notifications not supported');
      return;
    }
    
    if (!('serviceWorker' in navigator)) {
      setStatus('❌ Service Worker not supported');
      return;
    }
    
    if (!('PushManager' in window)) {
      setStatus('❌ Push Manager not supported');
      return;
    }
    
    setStatus('✅ All notification features supported');
  };

  const checkCurrentPermission = () => {
    if ('Notification' in window) {
      setPermissionStatus(`Current permission: ${Notification.permission}`);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const requestPermission = async () => {
    try {
      setStatus('Requesting notification permission...');
      const permission = await Notification.requestPermission();
      setPermissionStatus(`Permission: ${permission}`);
      
      if (permission === 'granted') {
        setStatus('✅ Notification permission granted!');
      } else {
        setStatus('❌ Notification permission denied');
      }
    } catch (error) {
      setStatus(`❌ Error requesting permission: ${error}`);
    }
  };

  const showLocalNotification = async () => {
    try {
      if (Notification.permission !== 'granted') {
        await requestPermission();
        if (Notification.permission !== 'granted') {
          return;
        }
      }

      setStatus('Showing local notification...');
      const notification = new Notification('Trinity Schools Test', {
        body: 'This is a test local notification!',
        icon: '/icon-192.png',
        tag: 'test-local'
      });

      notification.onclick = () => {
        setStatus('✅ Local notification clicked!');
        notification.close();
      };

      notification.onshow = () => {
        setStatus('✅ Local notification shown successfully!');
      };

      notification.onerror = (error) => {
        setStatus(`❌ Local notification error: ${error}`);
      };

    } catch (error) {
      setStatus(`❌ Local notification failed: ${error}`);
    }
  };

  const registerServiceWorker = async () => {
    try {
      setStatus('Registering service worker...');
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      setStatus('✅ Service worker registered successfully!');
      return registration;
    } catch (error) {
      setStatus(`❌ Service worker registration failed: ${error}`);
      return null;
    }
  };

  const subscribeToPush = async () => {
    try {
      setStatus('Starting push subscription...');
      
      // Request permission first
      if (Notification.permission !== 'granted') {
        await requestPermission();
        if (Notification.permission !== 'granted') {
          return;
        }
      }

      // Register service worker
      const registration = await registerServiceWorker();
      if (!registration) {
        return;
      }

      setStatus('Subscribing to push notifications...');
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      setSubscription(pushSubscription);
      setStatus('✅ Successfully subscribed to push notifications!');
      
      console.log('Push Subscription:', {
        endpoint: pushSubscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(pushSubscription.getKey('p256dh')!))),
          auth: btoa(String.fromCharCode(...new Uint8Array(pushSubscription.getKey('auth')!)))
        }
      });

    } catch (error) {
      setStatus(`❌ Push subscription failed: ${error}`);
      console.error('Push subscription error:', error);
    }
  };

  const sendTestPush = async () => {
    if (platform === 'android') {
      // For Android, use the unified service directly
      try {
        setStatus('Sending Android notification...');
        const success = await UnifiedNotificationsService.testNotification();
        if (success) {
          setStatus('✅ Android notification sent successfully!');
        } else {
          setStatus('❌ Android notification failed');
        }
      } catch (error) {
        setStatus(`❌ Android notification error: ${error}`);
      }
      return;
    }

    // For web platforms, use push notification
    if (!subscription) {
      setStatus('❌ No push subscription. Subscribe first.');
      return;
    }

    try {
      setStatus('Sending test push notification...');
      
      const response = await fetch('/api/notifications/send-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
              auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
            }
          },
          payload: {
            title: 'Trinity Schools Push Test',
            body: 'This is a test push notification from Trinity Schools!',
            icon: '/icon-192.png',
            url: window.location.href
          }
        })
      });

      if (response.ok) {
        setStatus('✅ Test push notification sent successfully!');
      } else {
        const errorData = await response.json();
        setStatus(`❌ Push send failed: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      setStatus(`❌ Error sending push: ${error}`);
    }
  };

  const testUnifiedNotification = async () => {
    setStatus('Testing unified notification...');
    try {
      const success = await UnifiedNotificationsService.testNotification();
      if (success) {
        setStatus('✅ Unified notification test successful!');
      } else {
        setStatus('❌ Unified notification test failed');
      }
    } catch (error) {
      setStatus(`❌ Unified notification error: ${error}`);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🔔 Push Notification Test</h1>
      
      <div className="grid gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <div className="mb-2 p-3 bg-gray-100 rounded">
            <strong>Platform:</strong> {platform}
            {platform === 'android' && ' 🤖'}
            {platform === 'web' && ' 🌐'}
            {platform === 'unsupported' && ' ❌'}
          </div>
          <p className="mb-2">{status}</p>
          <p className="text-sm text-gray-600">{permissionStatus}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Tests</h2>
          <div className="space-y-4">
            <button 
              onClick={requestPermission}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mr-2"
            >
              1. Request Permission
            </button>
            
            <button 
              onClick={showLocalNotification}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded mr-2"
            >
              2. Show Local Notification
            </button>
            
            <button 
              onClick={subscribeToPush}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded mr-2"
            >
              3. Subscribe to Push
            </button>
            
            <button 
              onClick={sendTestPush}
              disabled={platform === 'web' && !subscription}
              className={`px-4 py-2 rounded mr-2 text-white ${
                (platform === 'android' || subscription)
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              4. Send Test {platform === 'android' ? 'Native' : 'Push'}
            </button>
            
            <button 
              onClick={testUnifiedNotification}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded mr-2"
            >
              🚀 Unified Notification Test
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Debug Info</h2>
          <div className="text-sm space-y-2">
            <p><strong>Platform:</strong> {platform}</p>
            <p><strong>Android Bridge Available:</strong> {typeof window !== 'undefined' && window.Android ? '✅ Yes' : '❌ No'}</p>
            <p><strong>Web Push Support:</strong> {UnifiedNotificationsService.isWebPushSupported() ? '✅ Yes' : '❌ No'}</p>
            <p><strong>Permission Status:</strong> {UnifiedNotificationsService.getPermissionStatus()}</p>
            <p><strong>VAPID Public Key:</strong> {VAPID_PUBLIC_KEY.substring(0, 40)}...</p>
            <p><strong>Browser:</strong> {navigator.userAgent}</p>
            <p><strong>Protocol:</strong> {window.location.protocol}</p>
            <p><strong>Host:</strong> {window.location.host}</p>
            <p><strong>Subscription Status:</strong> {subscription ? '✅ Active' : '❌ Not subscribed'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
