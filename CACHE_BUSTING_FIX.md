# 🎯 Cache Busting Fix - No More Ctrl+F5 Needed!

## Problem Solved ✅

Your application was loading old cached versions because the **service worker** was using an aggressive **cache-first strategy** with static version numbers. Users had to press `Ctrl+F5` to get the latest version.

## What Was Changed

### 1. **Network-First Strategy for App Files** 🌐

Changed the service worker to **always check the network first** for HTML, JS, CSS, and JSON files:

```3:28:public/sw.js
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
const SW_VERSION = 'v2.0.0';
const BUILD_TIMESTAMP = '2025-12-21T00:00:00Z'; // Update this on each build

const CACHE_NAME = `trinity-schools-${SW_VERSION}`;
const STATIC_CACHE = `static-${SW_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${SW_VERSION}`;
```

**How it works:**
- **Network First**: Always tries to fetch the latest version from the server
- **Cache Fallback**: Only uses cache if network fails (offline mode)
- **Auto-Update**: Immediately caches new versions when fetched

### 2. **Automatic Version Bumping** 🔄

Created `scripts/update-sw-version.js` that automatically:
- Increments the service worker version number
- Updates the build timestamp
- Runs before every build

**Updated package.json:**
```json
"prebuild": "node scripts/update-sw-version.js",
"build": "next build"
```

Now every time you run `npm run build`, the version automatically updates!

### 3. **Aggressive Update Detection** 🚀

Updated service worker registration to:
- Check for updates **every 5 minutes** (instead of 1 hour)
- Check for updates when **page becomes visible**
- **Auto-reload** the page when a new version is detected
- **Force activate** new service workers immediately

```typescript
// Check for updates more frequently (every 5 minutes)
setInterval(() => {
  registration.update();
}, 5 * 60 * 1000);

// Check when page becomes visible
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    registration.update();
  }
});
```

### 4. **HTTP Cache Headers** 📄

Added Next.js cache headers to prevent browser caching:

```14:38:next.config.ts
  // Prevent aggressive browser caching - always check for updates
  async headers() {
    return [
      {
        // Apply to all HTML pages
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
        ],
      },
      {
        // Apply to service worker
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ];
  },
```

## How to Deploy Updates Now

### Automatic Way (Recommended) ✨

Just run your normal build and deploy:

```bash
npm run build
npm run deploy
```

The `prebuild` script will automatically:
1. ✅ Update the service worker version
2. ✅ Update the build timestamp
3. ✅ Trigger cache invalidation

### Manual Way (If Needed)

If you need to manually update the version:

```bash
# Update service worker version
node scripts/update-sw-version.js

# Then build and deploy
npm run build
npm run deploy
```

## What Users Will Experience

### First Time After This Fix

Users will need to do **ONE FINAL** hard refresh (`Ctrl+F5`) to get the new service worker. After that, they'll **never need to do it again**!

### After the Fix

1. **Open the app** - Gets latest version automatically
2. **Refresh the page** - Gets latest version automatically
3. **Close and reopen** - Gets latest version automatically

If there's a new version while they're using the app:
- Service worker detects it within 5 minutes
- Page automatically reloads with the new version
- User sees a brief notification (if enabled)

## How to Verify It's Working

### Method 1: Check the Console

Open browser DevTools (F12) and look for:

```
✅ Service Worker registered successfully
🔄 Service Worker update found
✅ New Service Worker installed
🔄 Reloading page in 2 seconds to activate new version...
```

### Method 2: Check Service Worker Version

In DevTools Console, type:

```javascript
navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' })
```

It should show the current version number.

### Method 3: Application Tab

In DevTools:
1. Go to **Application** tab
2. Click **Service Workers**
3. You should see the service worker **Active and running**
4. No service workers should be in "Waiting" status

## Troubleshooting

### If Users Still See Old Version

**Option 1: Force Unregister Old Service Worker (One-Time)**

Add this to your DevTools Console:

```javascript
// Unregister all service workers
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
  location.reload();
});
```

**Option 2: Clear Application Cache**

In DevTools:
1. Application tab → Clear Storage
2. Click "Clear site data"
3. Refresh the page

### If Service Worker Isn't Updating

Check if the service worker version was actually updated:

```bash
# View current service worker version
cat public/sw.js | grep "SW_VERSION"
```

Should show something like: `const SW_VERSION = 'v2.0.1';`

## Benefits

✅ **No more Ctrl+F5** - Users always get the latest version
✅ **Automatic updates** - Happens in the background
✅ **Better UX** - Seamless updates without user intervention
✅ **Offline support** - Still works offline with cached version
✅ **Push notifications** - Still work as before

## Cache Strategy Summary

| Asset Type | Strategy | Why |
|------------|----------|-----|
| HTML, JS, CSS, JSON | **Network First** | Always get latest version |
| Images, Fonts | **Cache First** | Rarely change, faster loading |
| API requests | **Not Cached** | Always fresh data |
| Firebase/Firestore | **Not Cached** | Real-time data |

## Next Steps

1. ✅ Deploy the changes: `npm run build && npm run deploy`
2. 📢 Notify users to do ONE FINAL hard refresh
3. 🎉 Enjoy automatic updates from now on!

---

**Note:** After deploying this fix, users will need to do ONE final hard refresh to get the new service worker. After that, all future updates will be automatic!

