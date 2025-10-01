# 🔔 Push Notifications Setup Guide

This guide will help you set up actual push notifications for both desktop and mobile devices in the Trinity Family Schools application.

## 📋 Prerequisites

- Node.js 18+ installed
- Firebase project with Firestore enabled
- Modern browser that supports Service Workers and Push API

## 🚀 Setup Steps

### 1. Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for push notifications. Generate them using:

```bash
npx web-push generate-vapid-keys
```

This will output:
- **Public Key**: Use this in your frontend
- **Private Key**: Keep this secure, use in your backend

### 2. Environment Variables

Create a `.env.local` file in your project root with:

```env
# Firebase Configuration (you should already have these)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Push Notifications - VAPID Keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key_here
VAPID_PRIVATE_KEY=your_vapid_private_key_here

# Optional: Custom notification settings
NEXT_PUBLIC_NOTIFICATION_ICON=/icon-192.png
NEXT_PUBLIC_NOTIFICATION_BADGE=/icon-192.png
NEXT_PUBLIC_NOTIFICATION_TAG_PREFIX=trinity-schools
```

### 3. Install Dependencies

```bash
npm install web-push
```

### 4. Service Worker Registration

The service worker (`/public/sw.js`) is already configured and will be automatically registered when users visit the notifications page.

### 5. Database Collections

The system will automatically create these Firestore collections:

- `notifications` - Stores all notifications
- `notification-subscriptions` - Stores user push notification subscriptions

## 🧪 Testing Push Notifications

### 1. Enable Notifications

1. Go to `/notifications` page
2. Click "Enable Push Notifications" if permission hasn't been granted
3. Allow notifications when prompted

### 2. Send Test Notification

1. Create a new notification
2. Enable "Send as Push Notification"
3. Select recipients
4. Submit the form

### 3. Verify Delivery

- **Desktop**: Notification should appear in the top-right corner
- **Mobile**: Notification should appear in the notification tray
- **Badge**: The notification count should update in the sidebar

## 🔧 Features Implemented

### ✅ Push Notification Service
- Handles subscription management
- Sends notifications to specific users or broadcast
- Supports different notification types and priorities

### ✅ Service Worker
- Handles push events
- Shows notifications even when app is closed
- Manages notification clicks and actions

### ✅ Notification Badges
- Shows unread count in sidebar
- Updates in real-time
- Works on both desktop and mobile

### ✅ Permission Management
- Requests notification permission
- Handles permission states (granted/denied/default)
- Graceful fallback for unsupported browsers

## 🎯 Notification Types Supported

- **General**: Basic notifications
- **Academic**: Exam reminders, attendance alerts
- **Financial**: Fee reminders
- **Emergency**: Urgent notifications requiring interaction
- **Reminders**: Scheduled notifications

## 📱 Mobile Support

- **iOS**: Limited support (requires app to be in foreground)
- **Android**: Full support with background notifications
- **PWA**: Full support when installed as PWA

## 🚨 Troubleshooting

### Notifications Not Appearing

1. Check browser console for errors
2. Verify VAPID keys are correct
3. Ensure service worker is registered
4. Check notification permissions

### Badge Not Updating

1. Verify user authentication
2. Check Firestore permissions
3. Ensure notification badge hook is working

### Service Worker Issues

1. Clear browser cache
2. Unregister and re-register service worker
3. Check for JavaScript errors

## 🔒 Security Considerations

- VAPID private key should never be exposed to frontend
- User subscriptions are tied to authenticated users
- Notifications are filtered by user permissions
- External links are properly sanitized

## 📈 Performance

- Notifications are cached for offline viewing
- Badge updates are throttled to prevent spam
- Service worker uses efficient caching strategies
- Background sync for offline notifications

## 🎉 What's Next?

The push notification system is now fully functional! Users will receive:

- Real-time notifications for important updates
- Visual badges showing unread counts
- Cross-platform support (desktop + mobile)
- Rich notification content with actions

## 📞 Support

If you encounter any issues:

1. Check the browser console for error messages
2. Verify all environment variables are set correctly
3. Test with a simple notification first
4. Ensure the service worker is properly registered

---

**Note**: Push notifications require HTTPS in production. For local development, localhost is allowed.
