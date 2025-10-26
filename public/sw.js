// Service Worker for Push Notifications and Offline Support
const CACHE_NAME = 'trinity-schools-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// Files to cache for offline use
const STATIC_FILES = [
  '/',
  '/offline',
  '/icon-192.png',
  '/icon-512.png',
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

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated and ready for push notifications');
        return self.clients.claim();
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  let notificationData = {
    title: 'New Notification',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'notification',
    data: {},
    requireInteraction: false,
    actions: []
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (error) {
      console.error('Error parsing push data:', error);
      // Continue with default notification data
    }
  }

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
      timestamp: Date.now()
    }
  ).catch((error) => {
    console.error('Error showing notification:', error);
    // Show a fallback notification
    return self.registration.showNotification('Notification Error', {
      body: 'Failed to display notification',
      icon: '/icon-192.png'
    });
  });

  event.waitUntil(notificationPromise);
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  if (event.action) {
    // Handle custom actions
    console.log('Action clicked:', event.action);
    // You can add custom logic here for different actions
  } else {
    // Default click behavior - focus or open the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Check if there's already a window/tab open with the target URL
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          
          // If no window/tab is open, open a new one
          if (clients.openWindow) {
            // Get the URL from notification data or default to root
            const url = event.notification.data?.url || '/';
            return clients.openWindow(url);
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
  // You can add analytics or other logic here
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('Background sync event:', event);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Background sync function
async function doBackgroundSync() {
  try {
    console.log('Performing background sync...');
    
    // Get all clients
    const clients = await self.clients.matchAll();
    
    // Send message to all clients about sync
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

// Message event from main thread
self.addEventListener('message', (event) => {
  console.log('Message received in service worker:', event);
  
  // Handle SKIP_WAITING command
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    // Send acknowledgement if port exists
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true });
    }
    return;
  }
  
  // Handle GET_VERSION command
  if (event.data && event.data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: CACHE_NAME });
    }
    return;
  }
  
  // For any other messages, send a generic acknowledgement
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage({ received: true });
  }
});

// Fetch event - handle offline functionality
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip non-HTTP(S) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Handle API requests differently
  if (event.request.url.includes('/api/') || event.request.url.includes('firebase')) {
    // For API requests, try network first, fallback to cache
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Return offline page or cached response
          return caches.match('/offline');
        })
    );
    return;
  }

  // For static assets, try cache first, fallback to network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(event.request)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the response
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
      .catch(() => {
        // Return offline page if everything fails
        return caches.match('/offline');
      })
  );
});

// Error event
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event);
});

// Unhandled rejection event
self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker unhandled rejection:', event);
});

// Periodic background sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    console.log('Periodic sync event:', event);
    
    if (event.tag === 'content-sync') {
      event.waitUntil(syncContent());
    }
  });
}

// Content sync function
async function syncContent() {
  try {
    console.log('Performing periodic content sync...');
    
    // You can add logic here to sync content periodically
    // For example, sync notifications, updates, etc.
    
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
}

console.log('✅ Service Worker script loaded successfully - Ready for registration'); 