# Web Push Notifications — Implementation Guide

**Stack:** Node.js / Express (Backend) · React (Frontend) · Web Push API · Service Workers

**Covers:** Real-time delivery · Background push (tab closed) · Android delivery · Admin broadcast · Scheduled alerts

---

## Table of Contents

1. [How Web Push Notifications Work](#1-how-web-push-notifications-work)
2. [Setup & Installation](#2-setup--installation)
3. [Complete File Structure](#3-complete-file-structure)
4. [Backend Implementation](#4-backend-implementation)
5. [Frontend Implementation](#5-frontend-implementation)
6. [Android Background Delivery](#6-android-background-delivery)
7. [iOS Support](#7-ios-support)
8. [Browser Support](#8-browser-support)
9. [Troubleshooting & Common Issues](#9-troubleshooting--common-issues)
10. [Security Checklist](#10-security-checklist)
11. [Quick Start Checklist](#11-quick-start-checklist)

---

## 1. How Web Push Notifications Work

Web Push Notifications use two browser technologies — the **Push API** and **Service Workers** — to deliver messages to users even when your application tab is closed. The browser maintains a persistent background connection to the push delivery network, which means notifications can arrive at any time.

### 1.1 Delivery Flow

| Step | What Happens |
|------|-------------|
| 1 | User visits your app and grants notification permission in the browser. |
| 2 | The browser registers a Service Worker — a background script that runs independently of the tab. |
| 3 | The browser generates a unique push subscription (endpoint + encryption keys) for this user on this device. |
| 4 | Your React app sends this subscription to your Express backend, which stores it in your database. |
| 5 | When you want to notify the user, your server calls the web-push library with the stored subscription. |
| 6 | web-push delivers the message to the browser's push service (Google FCM for Chrome, Mozilla's service for Firefox). |
| 7 | The push service wakes up the device's Service Worker and delivers the message — even with the tab closed. |
| 8 | The Service Worker displays the notification in the operating system's notification tray. |

### 1.2 Architecture Diagram

```
React App (Frontend)               Express Server (Backend)
──────────────────────             ──────────────────────────────
usePushNotifications hook  ◄─────► POST /api/push/subscribe
NotificationButton.jsx             POST /api/push/notify/broadcast
service-worker.js                  POST /api/push/notify/user/:id
                                   POST /api/push/notify/event
                                   node-cron (scheduled jobs)

Browser Push Service (FCM / Mozilla)
─────────────────────────────────────
Your Server  →  FCM (Google)  →  Android OS  →  Notification tray
                (web-push handles this automatically — no Firebase SDK needed)
```

### 1.3 Key Technologies

- **Service Worker** — a background JavaScript file that runs independently of your app tab. It receives push events and shows notifications even when the browser is closed.
- **Push API** — the browser API that allows a web application to receive messages pushed from a server.
- **VAPID Keys** — a pair of public/private cryptographic keys that identify your server to the push delivery network and secure the connection.
- **web-push (npm)** — the Node.js library that encrypts and sends push messages to the correct push service (FCM, Mozilla, etc.) on your behalf.
- **node-cron (npm)** — used to schedule automatic push notifications at set times (daily reminders, weekly digests, etc.).

---

## 2. Setup & Installation

### 2.1 Install Dependencies

**Backend**

```bash
npm install web-push node-cron dotenv cors express
```

**Frontend**

No extra packages needed. The implementation uses only native browser APIs (Push API, Service Worker API, Notification API) which are built into all modern browsers.

### 2.2 Generate VAPID Keys (Run Once)

VAPID keys are a security keypair that identifies your server to the push delivery network. Generate them once and store them permanently in your environment variables.

```bash
# Run this once in your terminal
npx web-push generate-vapid-keys

# Output will look like this:
# Public Key:
# BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBwO4CcL...
#
# Private Key:
# UUxI4O8-FbRouAevSmBQ6CO18t...
```

> ⚠️ **Important — Keep Your Private Key Secret**
> Never commit VAPID keys to version control (Git). Never expose the private key to the frontend. Store both keys only in your server-side `.env` file.

### 2.3 Environment Variables

Create a `.env` file in your backend root directory:

```bash
# Backend .env
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_EMAIL=mailto:you@yourdomain.com

# Frontend .env (React)
REACT_APP_API_URL=http://localhost:3001/api
```

### 2.4 Notification Icons (Required)

Create an `icons` folder inside your React app's `public` directory and add two PNG image files:

```
frontend/
└── public/
    └── icons/
        ├── default.png   ← 192×192px  — shown on all notifications
        └── badge.png     ← 72×72px    — small status bar icon on Android
```

Any PNG image works. A coloured circle containing your app logo or initials is sufficient. The icons must be accessible at `/icons/default.png` and `/icons/badge.png`.

---

## 3. Complete File Structure

```
your-project/
├── backend/
│   ├── .env                           ← VAPID keys + secrets
│   ├── app.js                         ← Mount routes, start cron scheduler
│   ├── pushService.js                 ← Core send / save / remove logic
│   ├── pushRoutes.js                  ← All Express API endpoints
│   └── scheduledNotifications.js      ← Cron jobs (daily, weekly, custom)
│
└── frontend/  (your React app)
    ├── public/
    │   ├── service-worker.js          ← MUST be here (served from root URL)
    │   └── icons/
    │       ├── default.png            ← 192×192px notification icon
    │       └── badge.png              ← 72×72px Android badge icon
    └── src/
        ├── hooks/
        │   └── usePushNotifications.js    ← React hook (SW + subscribe logic)
        └── components/
            ├── NotificationButton.jsx     ← Plug-and-play enable/disable button
            └── AdminNotificationPanel.jsx ← Admin UI (broadcast / user / event)
```

> 📌 **Critical File Location**
> The `service-worker.js` file **MUST** be placed inside the `/public` folder of your React app. This ensures it is served from the root URL (`https://yourdomain.com/service-worker.js`). A service worker placed in `/src` will not work because it will not be served at the correct scope.

---

## 4. Backend Implementation

### 4.1 pushService.js — Core Logic

This file is the heart of the notification system. It handles saving subscriptions, removing expired ones, and sending messages to individual users or everyone. All other parts of your application import from this file.

#### Subscription Storage

The service maintains a list of subscriptions. Each record contains the `userId` (so you know who to notify), the `subscription` object (the browser's push endpoint and encryption keys), and a timestamp.

```js
// pushService.js
const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// In-memory store — replace with your database (see Section 4.1.1)
let subscriptions = [];

function saveSubscription(userId, subscription) {
  // Remove existing entry for this browser endpoint (upsert behaviour)
  subscriptions = subscriptions.filter(
    (s) => s.subscription.endpoint !== subscription.endpoint
  );
  subscriptions.push({ userId, subscription, createdAt: new Date() });
}

function removeSubscription(endpoint) {
  subscriptions = subscriptions.filter(
    (s) => s.subscription.endpoint !== endpoint
  );
}

function getSubscriptionsForUser(userId) {
  return subscriptions.filter((s) => s.userId === userId);
}

function getAllSubscriptions() {
  return subscriptions;
}
```

#### 4.1.1 Replacing In-Memory Store with a Database

The in-memory store is for development only — it resets every time the server restarts. Replace each function body with your database calls.

**MongoDB (Mongoose)**

```js
// Save (upsert)
await Subscription.findOneAndUpdate(
  { 'subscription.endpoint': subscription.endpoint },
  { userId, subscription, createdAt: new Date() },
  { upsert: true, new: true }
);

// Get by user
return await Subscription.find({ userId });

// Delete
await Subscription.deleteOne({ 'subscription.endpoint': endpoint });
```

**PostgreSQL**

```js
// Save (upsert)
await db.query(
  `INSERT INTO subscriptions (user_id, endpoint, subscription, created_at)
   VALUES ($1, $2, $3, NOW())
   ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, subscription = $3`,
  [userId, subscription.endpoint, JSON.stringify(subscription)]
);

// Get by user
const { rows } = await db.query(
  'SELECT * FROM subscriptions WHERE user_id = $1', [userId]
);
return rows;

// Delete
await db.query('DELETE FROM subscriptions WHERE endpoint = $1', [endpoint]);
```

#### 4.1.2 Sending Notifications

Three sending functions cover all use cases: one user, all users, or a specific subscription object directly.

```js
// Send to a single subscription — handles expired subscriptions automatically
async function sendToSubscription(sub, payload) {
  try {
    await webpush.sendNotification(
      sub.subscription,
      JSON.stringify(payload),
      {
        urgency: 'high',      // Deliver immediately on Android
        TTL: 60 * 60 * 24,   // Keep queued for 24 hours if offline
      }
    );
    return { success: true };
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired — remove it automatically
      removeSubscription(sub.subscription.endpoint);
    }
    return { success: false };
  }
}

// Send to all subscribed users (broadcast)
async function sendToAll(payload) {
  const all = getAllSubscriptions();
  const results = await Promise.allSettled(
    all.map((sub) => sendToSubscription(sub, payload))
  );
  return { sent: results.filter(r => r.value?.success).length, total: all.length };
}

// Send to all devices of one specific user
async function sendToUser(userId, payload) {
  const userSubs = getSubscriptionsForUser(userId);
  const results = await Promise.allSettled(
    userSubs.map((sub) => sendToSubscription(sub, payload))
  );
  return { sent: results.filter(r => r.value?.success).length };
}
```

---

### 4.2 pushRoutes.js — API Endpoints

Mount this router in your Express app with:

```js
app.use('/api/push', require('./pushRoutes'));
```

| Method | Endpoint | Description | Body / Params |
|--------|----------|-------------|---------------|
| GET | `/api/push/vapid-public-key` | Returns the VAPID public key for the frontend to use when subscribing. | None |
| POST | `/api/push/subscribe` | Saves a new push subscription from a browser. | `{ userId, subscription }` |
| POST | `/api/push/unsubscribe` | Removes a subscription when user revokes permission. | `{ endpoint }` |
| POST | `/api/push/notify/broadcast` | Sends a notification to every subscribed user. | `{ title, body, url?, icon? }` |
| POST | `/api/push/notify/user/:userId` | Sends to all devices belonging to one user. | `{ title, body, url?, icon? }` |
| POST | `/api/push/notify/event` | Sends a context-aware notification based on event type. | `{ event, userId?, title, body, url? }` |

#### Supported Event Types

- `new_message` — triggers a message notification with a link to `/messages`
- `order_update` — triggers an order status notification with a link to `/orders`
- `new_booking` — triggers a booking notification with a link to `/bookings`

You can add as many custom event types as your application needs by extending the `eventPayloads` object in `pushRoutes.js`.

#### Calling Notifications from Your Own Routes

Import `pushService.js` directly into any other route file to trigger notifications from your own business logic:

```js
const push = require('./pushService');

// Inside your messages route:
app.post('/api/messages', async (req, res) => {
  const { senderId, recipientId, message } = req.body;
  // ... save message to database ...

  await push.sendToUser(recipientId, {
    title: '💬 New Message',
    body: message.slice(0, 80),
    icon: '/icons/message.png',
    url: `/messages/${senderId}`,
    timestamp: Date.now(),
  });

  res.status(201).json({ success: true });
});

// Inside your orders route:
app.post('/api/orders/:id/status', async (req, res) => {
  const { userId, status } = req.body;
  // ... update order ...

  await push.sendToUser(userId, {
    title: '📦 Order Update',
    body: `Your order is now: ${status}`,
    url: `/orders/${req.params.id}`,
    timestamp: Date.now(),
  });

  res.json({ success: true });
});
```

---

### 4.3 scheduledNotifications.js — Cron Jobs

Import and call `initScheduledNotifications()` in your `app.js` to start all scheduled jobs.

```js
const cron = require('node-cron');
const push = require('./pushService');

function initScheduledNotifications() {

  // Every day at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    await push.sendToAll({
      title: '☀️ Good Morning!',
      body: "Check in to see what's new today.",
      url: '/dashboard',
      timestamp: Date.now(),
    });
  });

  // Every Monday at 9:00 AM
  cron.schedule('0 9 * * 1', async () => {
    await push.sendToAll({
      title: '📊 Weekly Digest',
      body: "Here's your summary for the week.",
      url: '/digest',
      timestamp: Date.now(),
    });
  });
}

// One-time delayed notification (e.g. user sets a reminder)
function scheduleOnce({ userId, delayMs, payload }) {
  setTimeout(async () => {
    if (userId) await push.sendToUser(userId, payload);
    else        await push.sendToAll(payload);
  }, delayMs);
}
```

#### Cron Expression Reference

| Expression | Meaning |
|------------|---------|
| `0 8 * * *` | Every day at 8:00 AM |
| `0 9 * * 1` | Every Monday at 9:00 AM |
| `0 0 1 * *` | First day of every month at midnight |
| `*/30 * * * *` | Every 30 minutes |
| `0 * * * *` | Every hour on the hour |
| `* * * * *` | Every minute |

---

## 5. Frontend Implementation

### 5.1 service-worker.js (public/)

> 📌 **Placement is Critical**
> This file must be placed inside `public/` in your React app — **NOT** inside `src/`. It must be served from `https://yourdomain.com/service-worker.js`. Placing it anywhere else will break background delivery.

The Service Worker runs permanently in the background. It has three responsibilities: receiving push messages, displaying notifications, and handling clicks to open the correct page.

#### Push Event Handler

This is the most important part of the Service Worker. It fires when a push arrives — even with the tab closed. The `event.waitUntil()` call is critical: it tells Android to keep the Service Worker alive until the notification is displayed.

```js
self.addEventListener('push', (event) => {
  const payload = event.data.json();
  const { title, body, icon, badge, url, data, timestamp } = payload;

  const options = {
    body,
    icon:      icon  || '/icons/default.png',
    badge:     badge || '/icons/badge.png',
    timestamp: timestamp || Date.now(),
    data:      { url: url || '/', ...data },
    actions: [
      { action: 'open',    title: '👁 Open'    },
      { action: 'dismiss', title: '✕ Dismiss' },
    ],
    vibrate: [200, 100, 200],  // vibration pattern on mobile
  };

  // event.waitUntil is CRITICAL — tells Android to keep SW alive
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
```

#### Click Handler

When a user clicks the notification, this handler opens the app (or focuses the existing tab) and navigates to the correct page.

```js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open — focus it and navigate
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
```

---

### 5.2 usePushNotifications.js — React Hook

This hook encapsulates all push notification logic. Import it into any component that needs to manage notification state. It handles everything: checking browser support, registering the Service Worker, requesting permission, subscribing, and sending the subscription to your backend.

```js
import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export function usePushNotifications(userId) {
  const [permission,   setPermission]   = useState(Notification.permission);
  const [subscription, setSubscription] = useState(null);
  const [isSupported,  setIsSupported]  = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState(null);

  // Check support and existing subscription on mount
  useEffect(() => {
    const supported = 'serviceWorker' in navigator &&
                      'PushManager'   in window    &&
                      'Notification'  in window;
    setIsSupported(supported);
    if (supported) {
      navigator.serviceWorker.ready.then(reg =>
        reg.pushManager.getSubscription().then(sub => {
          if (sub) setSubscription(sub);
        })
      );
    }
  }, []);

  const subscribe = useCallback(async () => {
    setIsLoading(true);
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== 'granted') { setIsLoading(false); return; }

    await navigator.serviceWorker.register('/service-worker.js');
    await navigator.serviceWorker.ready;

    const { publicKey } = await fetch(`${API_BASE}/push/vapid-public-key`).then(r => r.json());

    const reg = await navigator.serviceWorker.ready;
    const pushSub = await reg.pushManager.subscribe({
      userVisibleOnly: true,  // Required — push must show a visible notification
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await fetch(`${API_BASE}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscription: pushSub }),
    });

    setSubscription(pushSub);
    setIsLoading(false);
  }, [userId]);

  const unsubscribe = useCallback(async () => {
    await fetch(`${API_BASE}/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
    setSubscription(null);
  }, [subscription]);

  return { isSupported, isSubscribed: !!subscription, permission,
           isLoading, error, subscribe, unsubscribe };
}
```

---

### 5.3 NotificationButton.jsx — React Component

A ready-made button component that handles all notification states. Drop it anywhere in your app where a logged-in user needs to enable or disable notifications.

**Usage**

```jsx
import NotificationButton from './components/NotificationButton';

// In any component where the user is logged in:
function Navbar({ currentUser }) {
  return (
    <nav>
      <NotificationButton userId={currentUser.id} />
    </nav>
  );
}
```

**States Handled Automatically**

| State | What the Button Shows |
|-------|-----------------------|
| Not subscribed | `🔕 Enable Notifications` (blue button) |
| Subscribed | `🔔 Notifications On ✓` (green button — click to disable) |
| Loading | `⏳ Please wait...` (disabled, reduced opacity) |
| Permission denied | `🚫 Notifications blocked` (grey, disabled) + guidance text |
| Browser not supported | `🔕 Notifications not supported` (grey, disabled) |

---

### 5.4 AdminNotificationPanel.jsx — Admin UI

A three-tab admin panel for sending manual push notifications. Protect this component behind your admin authentication guard so only administrators can access it.

**Usage**

```jsx
import AdminNotificationPanel from './components/AdminNotificationPanel';

// In your admin dashboard (protected by auth guard):
function AdminDashboard() {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <AdminNotificationPanel />
    </div>
  );
}
```

**Tabs Available**

| Tab | Function |
|-----|----------|
| 📢 Broadcast | Send a notification to every subscribed user simultaneously. |
| 👤 Single User | Send a notification to one specific user (enter their User ID). |
| ⚡ Event | Send a context-aware notification based on an event type (`new_message`, `order_update`, `new_booking`). Optionally target a specific user or broadcast to all. |

---

## 6. Android Background Delivery

The implementation fully supports Android background push — notifications are delivered even when Chrome is fully closed or the phone is restarted.

### 6.1 How Android Delivery Works

When a user subscribes, Android registers a persistent background connection to Google's Firebase Cloud Messaging (FCM) servers. Your server sends the push to FCM via the `web-push` library, and FCM wakes up the Android OS to display the notification. No Firebase account or SDK is needed — the `web-push` library handles the FCM communication automatically.

```
Your Server  →  FCM (Google)  →  Android OS  →  Notification tray
              (web-push handles        (wakes device even when
               this automatically)     Chrome is fully closed)
```

### 6.2 Android Delivery by Scenario

| Scenario | Notification Delivered? |
|----------|------------------------|
| App tab open and visible | ✅ Yes |
| App tab open but in background | ✅ Yes |
| Chrome minimised | ✅ Yes |
| Chrome fully closed (swiped away) | ✅ Yes |
| Phone screen off / sleeping | ✅ Yes (arrives when screen turns on, or immediately if urgency is `high`) |
| Phone restarted | ✅ Yes (delivered once it reconnects to the internet) |
| No internet connection | ⏳ Queued (FCM delivers it when connection restores, up to TTL limit) |
| User cleared Chrome's browser data | ❌ No — the subscription is destroyed |
| User revoked notification permission | ❌ No |

### 6.3 Priority & TTL Settings

Add `urgency` and `TTL` options to `webpush.sendNotification()` calls to control delivery speed and how long FCM keeps the message queued for offline devices.

```js
await webpush.sendNotification(
  sub.subscription,
  JSON.stringify(payload),
  {
    urgency: 'high',      // 'very-low' | 'low' | 'normal' | 'high'
    TTL: 60 * 60 * 24,   // Seconds FCM keeps it queued if device is offline
                          // 86400 = 24 hours   0 = discard if not immediately deliverable
  }
);
```

| Urgency | Use For | Android Behaviour |
|---------|---------|-------------------|
| `high` | Messages, alerts, urgent events | Delivers immediately even in Doze mode |
| `normal` | General notifications, updates | May be delayed slightly by Android battery optimisation |
| `low` | Non-urgent background info | Delivered only when device is active |
| `very-low` | Silent sync, analytics | May not wake up the device at all |

### 6.4 Critical Rule — Always Show a Notification

> ⚠️ **Never Silently Drop a Push on Android**
>
> Android and Chrome track whether your Service Worker always shows a notification when a push is received. If you add conditional logic and sometimes suppress the notification (e.g. "only show if user is not on the page"), Chrome will eventually unsubscribe your users automatically. If you want to suppress visible notifications, you must still call `showNotification()` — you can use a silent or minimal notification instead.

---

## 7. iOS Support

Push notifications work on iPhones and iPads but with additional requirements compared to Android.

### 7.1 Requirements for iOS

- iOS 16.4 or later (Safari browser).
- The user must add your web app to their Home Screen as a Progressive Web App (PWA).
- Once installed to the Home Screen, push works the same as Android — background delivery, notification tray, even when Safari is closed.
- Regular Safari browser tabs (not installed as PWA) do **NOT** support push notifications on iOS.

### 7.2 Making Your App Installable (PWA)

Add a `manifest.json` file to your `public/` folder:

```json
{
  "name": "Your App Name",
  "short_name": "App",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563EB",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Link it in your `public/index.html`:

```html
<link rel="manifest" href="/manifest.json" />
```

### 7.3 iOS Install Prompt Banner

Show a banner to iOS users who have not yet installed the app to their Home Screen:

```jsx
function IOSInstallBanner() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches;

  if (!isIOS || isInstalled) return null;

  return (
    <div style={{ background: '#1D4ED8', color: '#fff', padding: '12px 16px' }}>
      📲 To receive notifications on iPhone:
      tap <strong>Share</strong> → <strong>Add to Home Screen</strong>
    </div>
  );
}
```

---

## 8. Browser Support

| Browser | Platform | Support | Notes |
|---------|----------|---------|-------|
| Chrome | Desktop + Android | ✅ Full | Best support. Uses Google FCM for delivery. |
| Firefox | Desktop + Android | ✅ Full | Uses Mozilla's push service. |
| Microsoft Edge | Desktop | ✅ Full | Chromium-based. Uses FCM. |
| Samsung Internet | Android | ✅ Full | Good support on Samsung devices. |
| Safari | macOS Ventura+ | ✅ Supported | Requires macOS Ventura (13) or later. |
| Safari | iOS 16.4+ | ⚠️ Partial | Requires PWA installed to Home Screen. |
| Chrome | iOS | ❌ No | iOS forces all browsers to use WebKit — no push support. |
| Opera | Desktop + Android | ✅ Full | Chromium-based. Good support. |

---

## 9. Troubleshooting & Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| Notification permission denied | User clicked 'Block' previously. | Guide user to click the lock icon in the browser address bar → Site Settings → Notifications → Allow. |
| Notifications not showing when tab is closed | `service-worker.js` is not served from the root URL. | Make sure `service-worker.js` is in `/public`, not `/src`. It must be accessible at `https://yourdomain.com/service-worker.js`. |
| `applicationServerKey` error on subscribe | VAPID public key not fetched correctly. | Check that `GET /api/push/vapid-public-key` returns `{ publicKey: '...' }` and that `REACT_APP_API_URL` is set correctly. |
| Subscriptions keep expiring (410 errors) | Normal browser behaviour — endpoints rotate. | The code already handles this automatically by catching 410/404 errors and removing stale subscriptions. |
| Notifications arrive on desktop but not Android | `urgency` is `'normal'` or `'low'`. | Set `urgency: 'high'` in the `webpush.sendNotification()` options for time-sensitive notifications. |
| No notifications on iPhone | App not installed as PWA or iOS < 16.4. | Show the iOS install banner and instruct the user to use Share → Add to Home Screen. Verify iOS version. |
| Server restarts and loses all subscriptions | In-memory store is being used. | Replace the in-memory store in `pushService.js` with a real database (MongoDB or PostgreSQL). See Section 4.1.1. |
| Stale notifications arriving after hours | TTL is set too high. | Reduce TTL for time-sensitive notifications (e.g. `TTL: 300` for 5 minutes). Set `TTL: 0` to discard if not immediately deliverable. |

---

## 10. Security Checklist

- **Never expose your VAPID private key.** It must remain server-side only, stored in `.env`, and never committed to version control or sent to the frontend.
- **Protect admin endpoints.** The `/notify/broadcast` route can send a message to all users. Guard it with your admin authentication middleware.
- **Validate `userId` on subscribe.** Ensure the `userId` in the subscribe request matches the authenticated user's session. Do not allow a user to register under a different user's ID.
- **Use HTTPS in production.** Service Workers and Push API only work over HTTPS. They will not work on plain HTTP connections (localhost is the only exception for development).
- **Set a sensible TTL.** Use a short TTL for time-sensitive notifications (e.g. 300 seconds for chat messages). Long TTLs can result in outdated notifications being delivered much later.
- **Handle expired subscriptions.** The `sendToSubscription()` function already removes subscriptions that return 410 (Gone) or 404 errors. This keeps your database clean and avoids sending to phantom endpoints.

---

## 11. Quick Start Checklist

Follow these steps in order to get push notifications working:

1. Run `npx web-push generate-vapid-keys` and copy the output into your backend `.env` file.
2. Install backend packages: `npm install web-push node-cron dotenv cors express`
3. Add `pushService.js`, `pushRoutes.js`, `scheduledNotifications.js` to your backend.
4. Mount the routes in `app.js`: `app.use('/api/push', require('./pushRoutes'))`
5. Call `initScheduledNotifications()` in `app.js` after mounting routes.
6. Copy `service-worker.js` into your React app's `/public` folder (not `/src`).
7. Add the icon files: `/public/icons/default.png` (192×192) and `/public/icons/badge.png` (72×72).
8. Add `usePushNotifications.js` to `src/hooks/`.
9. Add `NotificationButton.jsx` and `AdminNotificationPanel.jsx` to `src/components/`.
10. Add `REACT_APP_API_URL=http://localhost:3001/api` to your frontend `.env` file.
11. Render `<NotificationButton userId={currentUser.id} />` in your app for logged-in users.
12. Test: click Enable Notifications, check the browser asks for permission, then trigger a test notification via the Admin Panel or API.
13. For iOS: add `manifest.json` to `/public` and link it in `index.html`. Test with an iPhone by adding the app to the Home Screen first.

---

*Generated for verification purposes. Stack: Node.js / Express + React. Web Push API · Service Workers · VAPID · FCM*
