# 📱 Trinity Online Android WebView App - Build Instructions

## 🚀 Quick Setup Guide

### Prerequisites
- Android Studio (latest version)
- JDK 8 or higher
- Android SDK (API level 24+)
- Firebase project

### Step 1: Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Add Android app with package name: `com.trinityonline.webviewapp`
4. Download `google-services.json` and replace the placeholder file in `app/` directory
5. Enable Firebase Cloud Messaging in your project

### Step 2: Open in Android Studio
1. Open Android Studio
2. Select "Open an existing Android Studio project"
3. Navigate to the `android-app` folder and select it
4. Wait for Gradle sync to complete

### Step 3: Build and Run
1. Connect an Android device or start an emulator
2. Click the "Run" button (green play icon) in Android Studio
3. Select your device and click "OK"

## 🔧 Configuration

### Web App URL
The app is configured to load: `https://trinityfamilyschool.vercel.app/`

To change this, edit `MainActivity.kt` and update the `WEB_APP_URL` constant.

### Firebase Configuration
- Replace `app/google-services.json` with your actual Firebase configuration
- Update the notification channel settings in `TrinityFirebaseMessagingService.kt` if needed

## 📋 Features Implemented

✅ **WebView with Full Web App Support**
- Loads your Trinity Online web app
- JavaScript enabled
- File upload support (gallery and camera)
- Camera access for photo capture
- Responsive scaling
- Mixed content support (HTTP/HTTPS)

✅ **Pull-to-Refresh**
- Swipe down to refresh the current page
- Visual refresh indicator

✅ **Custom No-Internet Screen**
- Modern error page design
- Custom message: "We can't access the database right now, please check your connection and try again."
- Retry button functionality

✅ **Background Running**
- App stays running when minimized
- Resumes from where user left off
- No unnecessary reloading

✅ **Push Notifications**
- Firebase Cloud Messaging integration
- Notification channel setup
- Click handling to open specific URLs
- Background notification support

✅ **Navigation**
- Proper back button handling
- WebView history navigation
- External links open in same WebView

✅ **Network Monitoring**
- Real-time network state detection
- Automatic retry when connection restored
- Graceful error handling

✅ **Camera Integration**
- Full camera access for photo capture
- Permission handling with user-friendly dialogs
- File provider configuration for secure file sharing
- Support for both camera and gallery selection

## 🎨 Customization

### Colors and Theme
Edit `app/src/main/res/values/colors.xml` to change the app's color scheme.

### App Icon
Replace the launcher icons in `app/src/main/res/mipmap-*` folders.

### App Name
Edit `app/src/main/res/values/strings.xml` to change the app name.

## 📱 Permissions

The app requests these permissions:
- **Internet**: Required for web app access
- **Network State**: For connection monitoring
- **Notifications**: For push notifications
- **Camera**: For file uploads
- **Storage**: For file uploads

## 🔒 Security

- HTTPS enforced for web app
- Mixed content allowed for compatibility
- WebView security settings configured
- ProGuard rules for code protection

## 🚨 Troubleshooting

### Build Errors
1. Ensure all dependencies are synced
2. Check that `google-services.json` is properly configured
3. Verify Android SDK and build tools are installed

### WebView Issues
1. Check internet connectivity
2. Verify the web app URL is accessible
3. Clear app data if needed

### Notification Issues
1. Verify Firebase project setup
2. Check notification permissions
3. Ensure device token is registered

## 📞 Support

For issues related to:
- **Web App**: Check your Vercel deployment
- **Firebase**: Verify project configuration
- **Android Build**: Check Android Studio logs

---

**Note**: This app is designed to work seamlessly with your existing Trinity Schools web application. Make sure your web app is properly configured for mobile WebView usage.
