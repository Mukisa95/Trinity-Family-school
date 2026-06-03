# 🔔 Push Notifications Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: Service Worker Not Registered ❌

**Symptoms:**
- No notifications at all
- Console shows "Service worker registration failed"
- No `/sw.js` found errors

**Solution:**
1. Check if service worker file exists: `public/sw.js` ✅ (Exists)
2. Register service worker in your app
3. Check browser DevTools → Application → Service Workers

**Test:**
Open browser console and run:
```javascript
navigator.serviceWorker.getRegistration('/sw.js').then(reg => {
  console.log('Service Worker:', reg ? 'Registered ✅' : 'Not registered ❌');
});
```

---

### Issue 2: Notification Permission Not Granted 🚫

**Symptoms:**
- "Permission denied" errors
- Notifications not showing
- Browser blocks notification requests

**Solution:**
1. Go to notifications page: `/notifications`
2. Click "Enable Notifications" button
3. Allow permission when browser prompts
4. Check permission status in browser settings

**Test:**
Open browser console and run:
```javascript
console.log('Notification Permission:', Notification.permission);
// Should show: "granted" ✅
// If shows: "denied" ❌ or "default" ⚠️ - need to request permission
```

---

### Issue 3: VAPID Keys Not Configured 🔑

**Symptoms:**
- "VAPID keys not configured" error
- 500 Internal Server Error
- Push API errors

**Solution:**

**Check if keys are set:**
```bash
# In your .env.local file
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BL-P0JiVp1NIUsP4...
VAPID_PRIVATE_KEY=1KBpMVExcpR...
VAPID_EMAIL=admin@trinity-family-schools.com
```

**Generate new VAPID keys if needed:**
```bash
npx web-push generate-vapid-keys
```

Then add them to:
- `.env.local` (for local development)
- Vercel Environment Variables (for production)

---

### Issue 4: Subscription Not Saved 💾

**Symptoms:**
- Permission granted but notifications still don't work
- No subscription in database
- "No subscription found" errors

**Solution:**
1. Go to: `/notifications`
2. Check if "Subscribed ✅" shows
3. If not, click "Enable Push Notifications"
4. Check Firestore → `notificationSubscriptions` collection

**Manual Test:**
```javascript
// Check if user has an active subscription
navigator.serviceWorker.ready.then(registration => {
  registration.pushManager.getSubscription().then(sub => {
    console.log('Push Subscription:', sub ? 'Active ✅' : 'None ❌');
  });
});
```

---

### Issue 5: API Route Failing 🌐

**Symptoms:**
- "Failed to send notification" errors
- Network errors in console
- API returns 400/500 errors

**Solution:**

**Check API endpoint:**
```
POST /api/notifications/send-push
```

**Expected payload:**
```json
{
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "payload": {
    "title": "Test",
    "body": "Test notification"
  }
}
```

---

### Issue 6: Browser Doesn't Support Push API 🌐

**Symptoms:**
- "Not supported" errors
- Push API undefined
- Service workers not available

**Solution:**
Check browser compatibility:
- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support
- ✅ Safari (iOS 16.4+): Limited support
- ❌ IE: Not supported

**Test:**
```javascript
console.log('Push API:', 'PushManager' in window ? 'Supported ✅' : 'Not supported ❌');
console.log('Service Worker:', 'serviceWorker' in navigator ? 'Supported ✅' : 'Not supported ❌');
console.log('Notifications:', 'Notification' in window ? 'Supported ✅' : 'Not supported ❌');
```

---

## 🔍 Step-by-Step Diagnostic

### Step 1: Check Browser Console
Open DevTools (F12) → Console tab

Look for errors containing:
- "service worker"
- "notification"
- "push"
- "VAPID"
- "subscription"

### Step 2: Check Service Worker Status
DevTools → Application → Service Workers

Should show:
- Status: **activated and is running**
- Source: `/sw.js`

### Step 3: Check Notification Permission
DevTools → Application → Notifications

Should show:
- Permission: **Allowed**

### Step 4: Test Notification Manually

Go to `/notifications` page and:
1. Check "Permission Status" indicator
2. If denied/default: Click "Enable Notifications"
3. Try sending a test notification
4. Check console for errors

---

## 🐛 Debug Mode

### Enable Detailed Logging

Add this to your `.env.local`:
```env
NEXT_PUBLIC_DEBUG_NOTIFICATIONS=true
```

This will enable detailed console logging for:
- Service worker registration
- Permission requests
- Subscription creation
- Notification sending
- Error details

---

## 🚀 Quick Fix Checklist

- [ ] Service worker registered (`/sw.js` accessible)
- [ ] Notification permission granted (check browser settings)
- [ ] VAPID keys configured (in `.env.local` or Vercel)
- [ ] User has active subscription (check Firestore)
- [ ] API route working (`POST /api/notifications/send-push`)
- [ ] Browser supports Push API (Chrome/Firefox/Edge)
- [ ] No CORS errors (check console)
- [ ] HTTPS enabled (required for push notifications)

---

## 💡 Most Common Fixes

### 1. Reset Everything and Start Fresh:
```javascript
// Run in browser console:
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
  console.log('Service workers unregistered');
  window.location.reload();
});
```

### 2. Clear Browser Cache:
- DevTools → Application → Clear Storage → Clear site data

### 3. Re-register Service Worker:
- Go to `/notifications` page
- It should auto-register
- Grant permission when prompted

### 4. Verify VAPID Keys Match:
- Frontend public key must match backend
- Private key must be secret
- Both must be from the same generation

---

## 📞 Still Not Working?

**Please provide:**
1. Error message from browser console
2. Notification permission status (granted/denied/default)
3. Service worker status (check DevTools → Application)
4. Which step in `/notifications` page is failing

This will help diagnose the exact issue!


