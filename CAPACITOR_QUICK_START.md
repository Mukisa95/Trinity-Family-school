# 🚀 Capacitor Native Push - Quick Start

## ⚡ **FASTEST PATH TO TESTING**

### **Prerequisites:**
- Android phone with USB debugging enabled
- USB cable
- Android Studio installed

### **5-Minute Setup:**

1. **Get Firebase Admin Credentials:**
   ```bash
   # Go to Firebase Console → Project Settings → Service Accounts
   # Click "Generate new private key" and download JSON
   # Add to .env.local:
   FIREBASE_PROJECT_ID=trinity-family-schools
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@...
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   ```

2. **Download google-services.json:**
   ```bash
   # Firebase Console → Project Settings → Add Android App
   # Package name: com.trinity.school
   # Download google-services.json
   cp ~/Downloads/google-services.json ./android/app/
   ```

3. **Sync and Build:**
   ```bash
   npm run cap:sync:android
   npm run cap:open:android
   ```

4. **In Android Studio:**
   - Wait for Gradle sync
   - Connect phone via USB
   - Click ▶️ Run
   - App installs on phone! 🎉

5. **Test Push:**
   - Open app on phone
   - Log in
   - Subscribe to notifications
   - Close app completely (swipe away)
   - Send notification from admin
   - Push arrives even though app is closed! ✅

---

## 📱 **Available Scripts:**

```bash
# Sync Capacitor files
npm run cap:sync

# Sync Android only
npm run cap:sync:android

# Open Android Studio
npm run cap:open:android

# Build debug APK
npm run cap:build:android

# Build release APK (requires keystore)
npm run cap:build:release

# Run on connected device
npm run cap:run:android
```

---

## 🐛 **Quick Troubleshooting:**

**No FCM token?**
→ Check `google-services.json` is in `android/app/`

**Build fails?**
→ Run: `cd android && ./gradlew clean && ./gradlew build`

**Push not arriving?**
→ Check Firestore `nativePushTokens` collection has your token

**App won't install?**
→ Enable "Install from Unknown Sources" in phone settings

---

## 📖 **Full Documentation:**

See `CAPACITOR_ANDROID_SETUP.md` for complete guide including:
- Production APK signing
- Google Play Store publishing
- iOS setup
- Advanced configuration

---

## ✅ **What's Different:**

### **Before (Web Push):**
- ❌ Only works when browser is running
- ❌ ~70% reliability on mobile
- ❌ No iOS support

### **After (Native Push):**
- ✅ Works when app is completely closed
- ✅ ~99.9% reliability
- ✅ iOS support available
- ✅ Like WhatsApp/Telegram

---

## 🎯 **Key Files:**

- `capacitor.config.ts` - Main configuration
- `android/` - Native Android project
- `src/lib/services/native-push.service.ts` - Client-side FCM
- `src/lib/services/fcm-push.service.ts` - Server-side FCM
- `CAPACITOR_ANDROID_SETUP.md` - Full documentation

---

**Need help?** Check `CAPACITOR_ANDROID_SETUP.md` for detailed troubleshooting.

