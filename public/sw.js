/**
 * Service Worker for Push Notifications and Offline Support
 *
 * This service worker enables:
 * 1. Push notifications even when browser is closed
 * 2. Background sync for offline support
 * 3. Cache management for faster loading
 *
 * IMPORTANT: Push notifications work as long as:
 * - User is signed into the application
 * - User has granted notification permission
 * - Service worker is registered and active
 * - Browser is running (even if app tab is closed)
 *
 * CACHE STRATEGY:
 * - Uses NETWORK-FIRST for app files to always get latest version
 * - Version number changes with each deployment for cache busting
 */

// ⚠️ IMPORTANT: Increment this version number with EVERY deployment
// This ensures users get the latest version of your app
const SW_VERSION = 'v2.1.77';
const BUILD_TIMESTAMP = '2026-08-01T17:45:20.827Z'; // Update this on each build

const CACHE_NAME = `trinity-schools-${SW_VERSION}`;
const STATIC_CACHE = `static-${SW_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${SW_VERSION}`;

// Files to cache for offline use
const STATIC_FILES = [
  '/',
  '/offline',
  '/trinity-logo-192.png',
  '/trinity-logo-512.png',
  '/manifest.json'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('✅ Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('✅ Caching static files');
        // Try to cache files but don't fail if some are missing
        return cache.addAll(STATIC_FILES).catch((error) => {
          console.warn('⚠️ Some files could not be cached:', error);
          // Continue anyway - push notifications don't require all files to be cached
        });
      })
      .then(() => {
        console.log('✅ Service Worker installed - activating immediately');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up ALL old caches and notify clients
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete ALL caches that don't match the current version
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated and ready for push notifications');
        // Start heartbeat to keep service worker alive longer on mobile
        startHeartbeat();
        return self.clients.claim();
      })
      .then(() => {
        // 🔔 Notify ALL clients that a new SW version is active
        // This allows the client-side code to reload and pick up fresh bundles
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
          const refreshes = clients.map(client => {
            client.postMessage({
              type: 'SW_UPDATED',
              version: SW_VERSION,
              timestamp: Date.now()
            });
            // Older installed PWAs could retain a stale reload flag. Navigating
            // an open client guarantees it loads the newest reconciliation
            // code; a closed PWA receives it on its next ordinary launch.
            if ('navigate' in client) {
              return client.navigate(client.url).catch(() => undefined);
            }
            return Promise.resolve();
          });
          console.log(`✅ Notified ${clients.length} client(s) about SW update to ${SW_VERSION}`);
          return Promise.all(refreshes);
        });
      })
  );
});

/**
 * Heartbeat mechanism to keep service worker alive on mobile
 * This helps prevent OS from killing the service worker too quickly
 */
let heartbeatInterval;

function startHeartbeat() {
  // Clear any existing interval
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  // Send heartbeat every 25 seconds to keep service worker active
  heartbeatInterval = setInterval(() => {
    console.log('💓 Service Worker heartbeat - staying alive for push notifications');

    // Notify all clients that service worker is alive
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SERVICE_WORKER_HEARTBEAT',
          timestamp: Date.now()
        });
      });
    });
  }, 25000); // Every 25 seconds
}

/**
 * Single unified message handler.
 * Having multiple listeners caused "message channel closed before response
 * was received" errors when two handlers both tried to respond on the
 * same MessageChannel port.
 */
self.addEventListener('message', (event) => {
  console.log('Message received in service worker:', event);

  if (!event.data) return;

  // PING — restart heartbeat and reply alive
  if (event.data.type === 'PING') {
    console.log('📡 Received ping from client - restarting heartbeat');
    startHeartbeat();
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        type: 'PONG',
        status: 'alive',
        timestamp: Date.now()
      });
    }
    return;
  }

  // SKIP_WAITING — force activation of a waiting service worker
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true });
    }
    return;
  }

  // GET_VERSION — return current cache name
  if (event.data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: CACHE_NAME });
    }
    return;
  }

  // Generic acknowledgement for any other message type
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage({ received: true });
  }
});

/**
 * Periodic Background Sync - Check for missed notifications
 * This helps deliver notifications even if push events were missed
 * Note: Limited browser support and may still be killed by OS
 */
self.addEventListener('periodicsync', (event) => {
  console.log('🔄 Periodic sync triggered:', event.tag);

  if (event.tag === 'check-notifications') {
    event.waitUntil(checkForMissedNotifications());
  }

  if (event.tag === 'content-sync') {
    event.waitUntil(syncContent());
  }
});

async function checkForMissedNotifications() {
  try {
    console.log('🔍 Checking for missed notifications...');

    // Fetch latest notifications from server
    const response = await fetch('/api/notifications/latest', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`📬 Found ${data.notifications?.length || 0} notifications to check`);

      // Show any unread notifications
      if (data.notifications && data.notifications.length > 0) {
        for (const notification of data.notifications) {
          await self.registration.showNotification(notification.title, {
            body: notification.body || notification.description,
            icon: notification.icon || '/trinity-logo-192.png',
            badge: '/icons/trinity-badge-72.png',
            tag: notification.id,
            data: {
              url: notification.url || '/notifications',
              id: notification.id
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('❌ Error checking for missed notifications:', error);
  }
}

async function syncContent() {
  try {
    console.log('Performing periodic content sync...');
    // Add content sync logic here if needed
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
}

/**
 * Push notification event handler
 *
 * This event fires when a push notification is received from the server.
 * It works even when:
 * - The browser tab is closed
 * - The app is not open
 * - The device is locked (notification appears when unlocked)
 *
 * Requirements:
 * - User must be signed in (subscription tied to user account)
 * - Browser must be running (even in background)
 * - Notification permission must be granted
 */
self.addEventListener('push', (event) => {
  console.log('🔔🔔🔔 PUSH EVENT RECEIVED! 🔔🔔🔔');
  console.log('Push event object:', event);
  console.log('Has data:', !!event.data);

  if (event.data) {
    console.log('Raw data text:', event.data.text());
  }

  let notificationData = {
    title: 'New Notification',
    body: 'You have a new notification',
    icon: '/trinity-logo-192.png',
    badge: '/icons/trinity-badge-72.png',
    tag: 'notification',
    data: { url: '/notifications' },
    requireInteraction: false,
    actions: []
  };

  if (event.data) {
    try {
      const data = event.data.json();
      console.log('📬 Parsed notification data:', data);

      // Merge data properly
      notificationData = {
        ...notificationData,
        ...data,
        data: {
          url: data.url || '/notifications',
          ...data.data
        }
      };

      console.log('📋 Final notification data:', notificationData);
    } catch (error) {
      console.error('❌ Error parsing push data:', error);
      // Continue with default notification data
    }
  }

  console.log('🚀 Attempting to show notification with title:', notificationData.title);

  const notificationPromise = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      requireInteraction: notificationData.requireInteraction,
      actions: notificationData.actions,
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
      silent: false,
      renotify: true
    }
  ).then(() => {
    console.log('✅✅✅ NOTIFICATION DISPLAYED SUCCESSFULLY! ✅✅✅');
    return self.registration.getNotifications();
  }).then((notifications) => {
    console.log('📊 Current notifications count:', notifications.length);
    notifications.forEach((notif, index) => {
      console.log(`Notification ${index + 1}:`, notif.title, notif.tag);
    });
  }).catch((error) => {
    console.error('❌❌❌ ERROR SHOWING NOTIFICATION:', error);
    console.error('Error details:', error.message, error.stack);
    // Show a fallback notification
    return self.registration.showNotification('Notification Error', {
      body: 'Failed to display notification',
      icon: '/trinity-logo-192.png'
    });
  });

  event.waitUntil(notificationPromise);
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  if (event.action) {
    console.log('Action clicked:', event.action);
  } else {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          const requestedUrl = event.notification.data?.url || '/';
          const url = new URL(requestedUrl, self.location.origin);
          if (url.origin !== self.location.origin) return undefined;
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              // Focusing alone leaves an already-open dashboard on its old page.
              // Navigate first so attendance notification query parameters can open
              // the matching class-summary dialog.
              return client.navigate(url.href).then((navigatedClient) =>
                (navigatedClient || client).focus()
              );
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(url.href);
          }
        })
        .catch((error) => {
          console.error('Error handling notification click:', error);
        })
    );
  }
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('Background sync event:', event);
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    console.log('Performing background sync...');
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        message: 'Background sync completed'
      });
    });
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Fetch event - handle offline functionality
// STRATEGY:
// - NEVER cache HTML pages (prevents stale app shell after deployments)
// - NEVER intercept _next/data routes (Next.js client-side data fetching)
// - NEVER intercept _next/static chunks (webpack bundles)
// - NEVER intercept API, Firebase, or googleapis requests
// - CACHE-FIRST only for truly static assets (images, fonts, icons)
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip non-HTTP(S) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  const url = new URL(event.request.url);

  // Completely skip API requests - don't intercept them at all
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Completely skip Firestore/Firebase requests - don't intercept them at all
  if (event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('firebase') ||
    event.request.url.includes('googleapis.com')) {
    return;
  }

  // Skip ALL Next.js internal routes - these MUST always be fresh
  if (url.pathname.startsWith('/_next/')) {
    return;
  }

  // Skip webpack chunk files (hashed filenames)
  if (url.pathname.match(/^\/[a-f0-9]+-[a-f0-9]+\.(js|css)$/i) ||
    url.pathname.match(/^\/[a-z]+-[a-f0-9]+\.(js|css)$/i)) {
    return;
  }

  // NEVER cache HTML pages or page navigation requests
  const isNavigationRequest = event.request.mode === 'navigate';
  const isHTMLRequest = url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    event.request.headers.get('accept')?.includes('text/html');

  if (isNavigationRequest || isHTMLRequest) {
    // NETWORK-ONLY for HTML: Always get fresh HTML from the server
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => {
          return caches.match('/offline').then((offlinePage) => {
            if (offlinePage) {
              return offlinePage;
            }
            return new Response('Offline - Content not available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/html' })
            });
          });
        })
    );
    return;
  }

  // Skip .js, .css, and .json files - let the browser handle them directly
  if (url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.json')) {
    return;
  }

  // CACHE-FIRST: Only for truly static assets (images, fonts, icons, etc.)
  const isStaticAsset =
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.gif') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.eot');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }

          return fetch(event.request)
            .then((response) => {
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }

              const responseToCache = response.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });

              return response;
            });
        })
        .catch((error) => {
          console.warn('Fetch failed for static asset:', error.message);
          return new Response('Offline - Content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        })
    );
  }

  // For anything else not matched above, let the browser handle it naturally
});

// Error event
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event);
});

// Unhandled rejection event
self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker unhandled rejection:', event);
});

console.log('✅ Service Worker script loaded successfully - Ready for registration');
