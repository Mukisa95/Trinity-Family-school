/**
 * Service Worker Registration Utility
 * 
 * Automatically registers the service worker for push notifications
 * and offline support.
 * 
 * UPDATE STRATEGY:
 * - Uses `controllerchange` event to detect when a new SW takes control
 * - Performs a single, controlled reload to pick up fresh code
 * - Prevents infinite reload loops with sessionStorage flag
 * - Listens for `SW_UPDATED` messages from the service worker
 */

// Flag to track if we've already set up the controllerchange listener
let controllerChangeListenerAdded = false;

/**
 * Set up the controllerchange listener ONCE.
 * This fires when a new service worker takes control of the page.
 * We reload the page to ensure fresh JS bundles and listeners are loaded.
 */
function setupControllerChangeListener(): void {
  if (controllerChangeListenerAdded) return;
  controllerChangeListenerAdded = true;

  const RELOAD_FLAG = 'sw_controller_reload';

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('🔄 New Service Worker took control - checking if reload needed');

    // Prevent infinite reload loops: only reload ONCE per SW update
    const hasReloaded = sessionStorage.getItem(RELOAD_FLAG);
    if (hasReloaded) {
      console.log('✅ Already reloaded for this SW update - skipping');
      // Clear the flag after a short delay so future updates can trigger a reload
      setTimeout(() => {
        sessionStorage.removeItem(RELOAD_FLAG);
      }, 5000);
      return;
    }

    console.log('🔄 Reloading page to activate new app version...');
    sessionStorage.setItem(RELOAD_FLAG, Date.now().toString());
    window.location.reload();
  });

  // Also listen for SW_UPDATED messages from the service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SW_UPDATED') {
      console.log(`✅ Service Worker updated to ${event.data.version}`);
      // The controllerchange event will handle the reload
      // This message is just for logging/confirmation
    }
  });

  console.log('✅ Controller change listener registered');
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // Check if service workers are supported
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('⚠️ Service Worker not supported in this browser');
    return null;
  }

  try {
    console.log('🔄 Registering Service Worker...');

    // Set up the controllerchange listener BEFORE registration
    // This ensures we catch the event even if the SW activates quickly
    setupControllerChangeListener();

    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none' // Always check for updates - browser will compare byte-for-byte
    });

    console.log('✅ Service Worker registered successfully');
    console.log('📍 Scope:', registration.scope);
    console.log('🔧 Active:', !!registration.active);
    console.log('⏳ Installing:', !!registration.installing);
    console.log('⏸️  Waiting:', !!registration.waiting);

    // Listen for new service worker installations
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('🔄 Service Worker update found');

      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          console.log('🔄 Service Worker state:', newWorker.state);

          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('✅ New Service Worker installed - sending SKIP_WAITING');
            // Tell the new SW to activate immediately (don't wait for tabs to close)
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            // The controllerchange listener above will handle the reload
          }
        });
      }
    });

    // If there's already a waiting service worker, activate it immediately
    if (registration.waiting) {
      console.log('⏸️  Service Worker waiting to activate - sending SKIP_WAITING');
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      // The controllerchange listener will handle the reload
    }

    // Check for updates frequently (every 5 minutes)
    setInterval(() => {
      registration.update().catch(err => {
        console.warn('⚠️ Service Worker update check failed:', err);
      });
    }, 5 * 60 * 1000);

    // Also check for updates when the page becomes visible (user returns to app)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('🔄 Page became visible - checking for SW updates');
        registration.update().catch(err => {
          console.warn('⚠️ Service Worker update check failed:', err);
        });
      }
    });

    // 🔥 CRITICAL FOR MOBILE: Keep service worker alive with periodic pings
    startServiceWorkerKeepAlive(registration);

    // Detect missing chunks (404 errors) - log warnings only
    detectMissingChunks();

    return registration;

  } catch (error) {
    console.error('❌ Service Worker registration failed:', error);

    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }

    return null;
  }
}

/**
 * Check if service worker is registered and active
 */
export async function isServiceWorkerActive(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return !!registration?.active;
  } catch (error) {
    console.error('Error checking service worker status:', error);
    return false;
  }
}

/**
 * Unregister service worker (for debugging/cleanup)
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const success = await registration.unregister();
      console.log(success ? '✅ Service Worker unregistered' : '❌ Failed to unregister');
      return success;
    }
    return false;
  } catch (error) {
    console.error('Error unregistering service worker:', error);
    return false;
  }
}

/**
 * Keep service worker alive with periodic pings
 * This is especially important for mobile devices where the OS
 * aggressively kills background processes
 */
function startServiceWorkerKeepAlive(registration: ServiceWorkerRegistration): void {
  console.log('💓 Starting service worker keep-alive mechanism for mobile support');

  // Ping service worker every 20 seconds to keep it alive
  setInterval(() => {
    try {
      if (registration.active) {
        const messageChannel = new MessageChannel();

        // Set up the listener BEFORE postMessage to avoid race conditions.
        // Also close the port after 5 s so Chrome never forcefully closes it,
        // which would throw "message channel closed before response was received".
        let settled = false;
        const cleanup = () => {
          if (!settled) {
            settled = true;
            messageChannel.port1.close();
          }
        };

        messageChannel.port1.onmessage = (event) => {
          if (event.data && event.data.type === 'PONG') {
            console.log('💓 Service Worker is alive:', event.data.status);
          }
          cleanup();
        };

        // Auto-close if SW doesn't reply within 5 seconds
        setTimeout(cleanup, 5000);

        registration.active.postMessage({ type: 'PING' }, [messageChannel.port2]);
      }
    } catch (error) {
      console.warn('⚠️ Failed to ping service worker:', error);
    }
  }, 20000); // Every 20 seconds

  // Also ping when app becomes visible (user returns to app)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && registration.active) {
      console.log('👀 App became visible - pinging service worker');
      try {
        const messageChannel = new MessageChannel();
        let settled = false;
        const cleanup = () => {
          if (!settled) {
            settled = true;
            messageChannel.port1.close();
          }
        };
        messageChannel.port1.onmessage = cleanup;
        setTimeout(cleanup, 5000);
        registration.active.postMessage({ type: 'PING' }, [messageChannel.port2]);
      } catch (error) {
        console.warn('⚠️ Failed to ping service worker on visibility change:', error);
      }
    }
  });
}

/**
 * Detect missing chunks (404 errors) - log warnings only, don't auto-reload
 * Auto-reload was causing infinite loops, so we removed it.
 * Users should manually refresh if they see many 404 errors.
 */
function detectMissingChunks(): void {
  if (typeof window === 'undefined') return;

  let missingChunkCount = 0;
  const MAX_WARNINGS = 3; // Only log first 3 to avoid console spam
  let hasShownHelpMessage = false;

  // Listen for failed resource loads (for logging only)
  window.addEventListener('error', (event) => {
    const target = event.target as HTMLElement;

    // Check if it's a script or link tag that failed to load
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
      const src = (target as HTMLScriptElement).src || (target as HTMLLinkElement).href;

      // Check if it's a webpack chunk file
      if (src && (
        src.includes('_next/') ||
        src.includes('webpack') ||
        /\/[a-f0-9]+-[a-f0-9]+\.(js|css)$/i.test(src) ||
        /\/[a-z]+-[a-f0-9]+\.(js|css)$/i.test(src)
      )) {
        missingChunkCount++;
        if (missingChunkCount <= MAX_WARNINGS) {
          // In development, this is usually a dev server cache issue
          if (process.env.NODE_ENV === 'development') {
            if (!hasShownHelpMessage) {
              console.warn(`⚠️ Missing Next.js chunk detected (dev server cache issue)`);
              console.warn(`💡 Solution: Restart your dev server (Ctrl+C then npm run dev)`);
              console.warn(`   Or clear .next folder: rm -rf .next (or delete .next folder)`);
              hasShownHelpMessage = true;
            }
          } else {
            // In production, force a hard reload to clear cache
            console.warn(`⚠️ Missing chunk detected (${missingChunkCount}):`, src);
            handleChunkLoadError();
          }
        }
      }
    }
  }, true); // Use capture phase to catch errors early

  // Also catch ChunkLoadError from webpack and handle gracefully
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    if (error && (error.name === 'ChunkLoadError' ||
      (error?.message && error.message.includes('Loading chunk')))) {
      if (process.env.NODE_ENV === 'development') {
        if (!hasShownHelpMessage) {
          console.warn(`⚠️ ChunkLoadError detected (dev server cache issue)`);
          console.warn(`💡 Solution: Restart your dev server (Ctrl+C then npm run dev)`);
          console.warn(`   Or clear .next folder: rm -rf .next (or delete .next folder)`);
          hasShownHelpMessage = true;
        }
        // Prevent the error from showing as uncaught
        event.preventDefault();
      } else {
        // Production: Force reload
        handleChunkLoadError();
      }
    }
  });

  // Also catch ChunkLoadError from error events (for synchronous errors)
  const originalErrorHandler = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    if (error && (error.name === 'ChunkLoadError' ||
      (typeof message === 'string' && message.includes('Loading chunk')))) {
      if (process.env.NODE_ENV === 'development') {
        if (!hasShownHelpMessage) {
          console.warn(`⚠️ ChunkLoadError detected (dev server cache issue)`);
          console.warn(`💡 Solution: Restart your dev server (Ctrl+C then npm run dev)`);
          console.warn(`   Or clear .next folder: rm -rf .next (or delete .next folder)`);
          hasShownHelpMessage = true;
        }
        // Suppress the error - we've already logged helpful guidance
        return true;
      } else {
        // Production: Force reload
        handleChunkLoadError();
        return true; // Use simple reload to suppress error
      }
    }
    // Call original error handler for other errors
    if (originalErrorHandler) {
      return originalErrorHandler.call(this, message, source, lineno, colno, error);
    }
    return false;
  };
}

/**
 * Handle chunk load errors with loop protection
 * Refresh the page ONCE if a chunk is missing
 */
function handleChunkLoadError() {
  if (typeof window === 'undefined') return;

  // Key to track reload attempts in session storage
  const RELOAD_KEY = 'app_chunk_reload_count';
  const MAX_RELOADS = 1; // Only try once per session to avoid loops
  const RESET_TIMEOUT = 10000; // Reset counter after 10s if successful

  try {
    const reloadCount = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10);
    const lastReload = parseInt(sessionStorage.getItem(`${RELOAD_KEY}_time`) || '0', 10);
    const now = Date.now();

    // If it's been a while since the last reload, reset the counter
    if (now - lastReload > RESET_TIMEOUT) {
      sessionStorage.setItem(RELOAD_KEY, '0');
    }

    if (reloadCount < MAX_RELOADS) {
      console.log(`🔄 Recovering from ChunkLoadError (Attempt ${reloadCount + 1}/${MAX_RELOADS})...`);

      // Increment counter and update timestamp
      sessionStorage.setItem(RELOAD_KEY, String(reloadCount + 1));
      sessionStorage.setItem(`${RELOAD_KEY}_time`, String(now));

      // Clear Service Worker caches if possible to ensure fresh assets
      const hasCaches = typeof caches !== 'undefined';
      if (hasCaches) {
        caches.keys().then((names) => {
          names.forEach((name) => {
            caches.delete(name);
          });
        }).catch(err => console.error('Error clearing caches:', err))
          .finally(() => {
            // Reload regardless of cache clear success
            window.location.reload();
          });
      } else {
        window.location.reload();
      }
    } else {
      console.error('❌ Max reload attempts reached for ChunkLoadError. Please check your internet connection or try manually refreshing.');
    }
  } catch (err) {
    console.error('Error handling chunk load recovery:', err);
    // Fallback: just try to reload if we can't access storage
    window.location.reload();
  }
}

/**
 * Get service worker registration status
 */
export async function getServiceWorkerStatus(): Promise<{
  supported: boolean;
  registered: boolean;
  active: boolean;
  waiting: boolean;
  installing: boolean;
}> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return {
      supported: false,
      registered: false,
      active: false,
      waiting: false,
      installing: false
    };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();

    return {
      supported: true,
      registered: !!registration,
      active: !!registration?.active,
      waiting: !!registration?.waiting,
      installing: !!registration?.installing
    };
  } catch (error) {
    console.error('Error getting service worker status:', error);
    return {
      supported: true,
      registered: false,
      active: false,
      waiting: false,
      installing: false
    };
  }
}

