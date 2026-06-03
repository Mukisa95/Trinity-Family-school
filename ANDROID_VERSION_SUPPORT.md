# 📱 Android Version Support

## ✅ Supported Android Versions

Your Trinity School Online app now supports:

### **Minimum SDK: 24 (Android 7.0 Nougat)**
- **Released:** August 2016
- **Why this minimum:** Required by Capacitor's Cordova framework dependency
- **Market Coverage:** ~95%+ of active Android devices worldwide

---

## 📊 Device Coverage

| Android Version | API Level | Release Year | Market Share |
|----------------|-----------|--------------|--------------|
| **Android 7.0** | **24** | **2016** | **Minimum** ✅ |
| Android 8.0 | 26 | 2017 | ~90% |
| Android 9.0 | 28 | 2018 | ~85% |
| Android 10 | 29 | 2019 | ~80% |
| Android 11 | 30 | 2020 | ~70% |
| Android 12 | 31 | 2021 | ~60% |
| Android 13 | 33 | 2022 | ~45% |
| Android 14 | 34 | 2023 | ~30% |

**Target SDK: 36 (Android 14+)** - For latest features and optimizations

---

## 🚫 Unsupported Versions

The following older Android versions are **NOT supported**:
- Android 6.0 Marshmallow (API 23) - 2015
- Android 5.1 Lollipop (API 22) - 2015
- Android 5.0 Lollipop (API 21) - 2014
- Android 4.4 KitKat (API 19) - 2013
- And older...

### Why Not Android 5.0 (API 21)?

While we initially attempted to support API 21, the following technical constraints require API 24:

1. **Capacitor Dependencies:**
   - `org.apache.cordova:framework:14.0.1` requires minSdk 24
   - This is a core Capacitor dependency for hybrid app functionality

2. **Modern Android Features:**
   - Better security APIs
   - Improved notification support
   - Enhanced background processing
   - Better Firebase compatibility

3. **Market Reality:**
   - Devices running Android 5.x-6.x represent less than 5% of active devices
   - Most of these devices are 8-10 years old
   - Security updates are no longer provided by Google

---

## 🌍 Regional Device Coverage

Your app will work on:

### East Africa (Kenya, Uganda, Tanzania)
- **Coverage:** 90-95%
- Most users have Android 8.0+ devices
- Common devices: Samsung Galaxy A-series, Infinix, Tecno, Oppo

### Global
- **Coverage:** 95%+
- Modern devices from all manufacturers

---

## 📱 Compatible Devices

### ✅ Will Work:
- Samsung Galaxy S7 and newer (2016+)
- Google Pixel and newer (2016+)
- OnePlus 3T and newer (2016+)
- Huawei P9 and newer (2016+)
- Xiaomi Mi 5 and newer (2016+)
- Infinix Hot 5 and newer (2017+)
- Tecno Spark and newer (2017+)
- Oppo A3s and newer (2018+)
- Most devices purchased after 2016

### ❌ Won't Work:
- Samsung Galaxy S6 (2015)
- Google Nexus 5X/6P (2015)
- Devices older than 2016
- Devices stuck on Android 6.0 or lower

---

## 🔧 Build Configuration

Current settings in `android/variables.gradle`:

```gradle
ext {
    minSdkVersion = 24        // Android 7.0+
    targetSdkVersion = 36     // Android 14+
    compileSdkVersion = 36    // Android 14+
}
```

### What These Mean:

1. **minSdkVersion = 24**
   - App won't install on devices with Android 6.x or older
   - Ensures all required APIs are available

2. **targetSdkVersion = 36**
   - Optimizes for latest Android features
   - Uses modern security and performance improvements

3. **compileSdkVersion = 36**
   - Uses latest Android SDK tools for building
   - Access to newest APIs

---

## 💡 User Experience

### On Unsupported Devices:
When users with Android 6.x or older try to install from Google Play Store:
- ❌ "Your device isn't compatible with this version"
- ℹ️ Clear message that Android 7.0+ is required
- 💡 Suggestion to update Android or use a newer device

### On Supported Devices:
- ✅ Install works perfectly
- ✅ All features available (notifications, offline, etc.)
- ✅ Regular updates via Play Store

---

## 📈 Future-Proofing

Google's requirements for Play Store apps:
- **2024:** Minimum target SDK 34 (Android 14)
- **2025:** Likely minimum target SDK 35+

Your app is configured for:
- ✅ Current compliance
- ✅ Future compliance for 2025+

---

## 🎯 Recommendation

**Keep minSdk at 24 (Android 7.0)**

### Why This is Optimal:

✅ **Broad Compatibility:** Covers 95%+ of active devices
✅ **Modern Features:** Access to essential APIs
✅ **Security:** Devices still receiving security updates
✅ **Maintenance:** Fewer compatibility issues
✅ **Firebase Support:** Full FCM and Firebase compatibility
✅ **Framework Requirements:** Meets Capacitor/Cordova needs

### Why Not Lower?

❌ **Technical Impossible:** Cordova framework requires API 24
❌ **Minimal Benefit:** Only 2-5% additional device coverage
❌ **More Work:** Significantly more compatibility code
❌ **Security Risk:** Old devices have known vulnerabilities
❌ **Limited Support:** Google no longer supports Android 5.x/6.x

---

## 🚀 Testing

Test on these devices for best coverage:

### Priority 1 (Must Test):
- Android 7.0 (API 24) - Minimum supported
- Android 10 (API 29) - Very common
- Android 13 (API 33) - Recent

### Priority 2 (Nice to Test):
- Android 8.1 (API 27) - Common budget devices
- Android 12 (API 31) - Popular mid-range

---

## 📞 Support

If users report device incompatibility:

1. **Check Android Version:**
   - Settings → About Phone → Android Version
   - Must be 7.0 or higher

2. **If Android 7.0+:**
   - Check Play Store compatibility
   - May need to update Google Play Services

3. **If Android 6.x or Lower:**
   - Explain minimum requirement (7.0)
   - Suggest device update or newer phone
   - Explain web app alternative (use browser)

---

## 🌐 Alternative: Web App

Users with older devices can use the web version:
- Visit: https://trinityfamilyschool.vercel.app
- Works on Android 4.4+ (via modern browser)
- Most features available
- No installation required

---

**Updated:** December 21, 2025
**Min SDK:** 24 (Android 7.0 Nougat, 2016)
**Target SDK:** 36 (Android 14+)
**Market Coverage:** 95%+ active devices
