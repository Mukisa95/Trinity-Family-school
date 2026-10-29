"use client";

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/utils/register-service-worker';
import { useAuth } from '@/lib/contexts/auth-context';
import { hasOfflineWorkspace } from '@/lib/offline/workspace-bridge';

/**
 * Service Worker Provider
 * 
 * Automatically registers the service worker when the app loads.
 * This enables push notifications and offline support.
 */
export function ServiceWorkerProvider() {
  const { user, isSignedIdentityReady, isLocked } = useAuth();
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    // Register service worker on mount
    registerServiceWorker()
      .then(registration => {
        if (registration) {
          console.log('✅ Service Worker ready for push notifications');
        }
      })
      .catch(error => {
        console.error('❌ Service Worker registration error:', error);
      });
  }, []); // Run once on mount

  // Ordinary browser sessions need the same prepared public dashboard shell as
  // installed apps. This never copies private data into the service worker.
  useEffect(() => {
    if (!user || !isSignedIdentityReady || isLocked || hasOfflineWorkspace() || !('serviceWorker' in navigator)) return;
    let disposed = false, running = false, lastPrepared = 0;
    const prepare = async () => {
      if (disposed || running || document.visibilityState === 'hidden' || !navigator.onLine
        || window.trinityAndroidConnected === false || Date.now() - lastPrepared < 15 * 60_000) return;
      running = true;
      try {
        const registration = await navigator.serviceWorker.ready;
        if (disposed || !registration.active) return;
        await new Promise<void>((resolve, reject) => {
          const channel = new MessageChannel();
          const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Startup interface preparation timed out.')); }, 60_000);
          channel.port1.onmessage = event => {
            clearTimeout(timer); channel.port1.close();
            if (event.data?.type === 'ANDROID_APP_SHELL_CACHED') resolve(); else reject(new Error('Startup interface is not ready.'));
          };
          registration.active!.postMessage({ type: 'CACHE_ANDROID_APP_SHELL',
            routes: ['/login', user.role === 'Parent' ? '/parent' : '/'], navigation: true }, [channel.port2]);
        });
        lastPrepared = Date.now();
      } catch { /* Keep the last complete interface; retry on the next connection/return. */ }
      finally { running = false; }
    };
    const updated = () => { lastPrepared = 0; void prepare(); };
    const timer = setTimeout(prepare, 1500);
    window.addEventListener('online', prepare); document.addEventListener('visibilitychange', prepare);
    window.addEventListener('trinity-service-worker-updated', updated);
    return () => { disposed = true; clearTimeout(timer); window.removeEventListener('online', prepare);
      document.removeEventListener('visibilitychange', prepare); window.removeEventListener('trinity-service-worker-updated', updated); };
  }, [user?.id, user?.role, isSignedIdentityReady, isLocked]);

  // This component doesn't render anything
  return null;
}

