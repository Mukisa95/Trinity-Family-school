"use client";

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/utils/register-service-worker';

/**
 * Service Worker Provider
 * 
 * Automatically registers the service worker when the app loads.
 * This enables push notifications and offline support.
 */
export function ServiceWorkerProvider() {
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

  // This component doesn't render anything
  return null;
}

