# External photo apps

Both pupil photo controls now support the same two workflows, while the final saved portrait remains a 500 × 500 JPEG with the existing size budget and passport framing.

## Edit in another app

Open **Use another photo editor** in the crop editor. **Open in another editor** sends the uncropped source JPEG to the phone's share chooser. Installed apps that accept images can appear, including compatible versions of Snapseed. The user chooses the destination; the app does not send photos anywhere automatically.

Export the edited photo as a flattened JPEG in the chosen app, return to Trinity, and choose **Import edited photo**. Review the framing and enhancements before saving. Importing replaces the editor's working source, not the saved pupil record. Cancel leaves the saved record intact. Source downloads are available when browser file sharing is unavailable.

Browser sharing requires HTTPS, a user click, and `navigator.canShare({files})` support. A prepared File is shared directly from the click to preserve user activation. There is no reliable automatic return from arbitrary editors. The Android companion uses Android's `ACTION_SEND` chooser instead of Web Share.

## Preferred camera in the Android companion

The existing app is a web/PWA. The project in `android-app/` adds a small Android companion hosting `https://trinityfamilyschool.vercel.app`. This is a separately installed application, not a browser extension or a PWA update. Use the companion's pupil photo control, expand **Choose camera app**, and select a preferred camera. **Take Photo** then invokes that app explicitly and imports its full-size JPEG into the normal editor. The preference is stored only on that device.

The chooser includes exported Android `ACTION_IMAGE_CAPTURE` activities in visible launchable apps, plus system cameras. Android 11+ limits implicit capture intents to system cameras, so selected third-party cameras are invoked by explicit component. Apps that cannot return a full-size image through this contract must be used through **Upload File**, even if they can take photographs within their own interface. Installation alone does not make an app capture-compatible.

The companion requests a FileProvider output URI and never uses the small result thumbnail. It waits for the file write to settle and validates JPEG bounds and a 30 MB source limit. A camera's own final processing is still controlled by that camera; Trinity cannot force an app to produce its separate HDR/editor export. Both workflows then use the existing JPEG enhancement and crop pipeline.

## Build and install

Requirements: JDK 17 or newer supported by Gradle 8.9, Android SDK platform 35, and build tools. In `android-app/`, set `ANDROID_HOME` or create an ignored `local.properties` containing `sdk.dir=<SDK path>`, then run:

```powershell
.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug
```

The test APK is `app/build/outputs/apk/debug/app-debug.apk`. Install it on a test phone and sign in to the school application. Publishing a production APK requires the school's signing key and distribution channel; no signing keys are committed. A Git push publishes the web and native source, but does not install this companion on phones.

## Privacy and checks

Only the exact school HTTPS origin and main frame can call the Android bridge. External links open outside the privileged WebView. FileProvider grants cover only a private cache subfolder. Camera grants are revoked on return; camera URLs are opaque, expire after five minutes, and return `Cache-Control: no-store`. The service worker explicitly excludes them from offline caches. Temporary files are removed on activity destruction or expiry access; old share exchanges are removed at startup after 24 hours. Images are not stored in camera preferences.

Closing the source picker aborts its request; replies are correlated by random IDs and late replies are ignored. Switching pupils closes the editor. Process recreation deliberately discards the old camera request rather than assigning it to a newly opened pupil.

Before wide Android rollout, check capture and cancellation with each intended camera, import after a Snapseed JPEG export, rotation/backgrounding, and the school's sign-in on the target phones. Browser and native unit checks do not replace these device checks. The companion's scope is photo capture/editing; other browser-only integrations, including Web Push, require separate native work if needed.

Validation on 6 October 2026: 15 focused web tests and three Android unit tests passed. Browser checks covered both pupil photo entry points, file sharing from a click, cancellation, JPEG import/save, preferred-camera persistence, stale results, unsupported sharing, mobile layout, existing enhancements/background removal, and cached offline processing. A connected Pixel 7 passed native camera discovery, origin/frame restrictions, and real full-size capture/share tests. The captured JPEG was 4080 × 3072 and 1,994,383 bytes; the operator opened it in Snapseed. This installed Snapseed version handled `ACTION_SEND` images but had no `ACTION_IMAGE_CAPTURE` activity. Focused TypeScript checking still reported the existing unrelated `avatar.tsx` optional-alt error.

The opt-in device checks are in `PhotoDeviceTest`. Build `:app:assembleDebugAndroidTest`, install the app and test APKs, then run individual methods with AndroidJUnitRunner. `trustedMainFrameAndCameraDiscovery` is automatic; `operatorCameraCaptureAndEditorShare` needs an unlocked phone, a manually taken/confirmed photo, and a chosen editor. It never signs in or changes school records.

References: [Android camera intent restrictions](https://developer.android.com/about/versions/11/behavior-changes-11#camera), [full-size capture intents](https://developer.android.com/guide/components/intents-common#Camera), [Web Share file support](https://web.dev/articles/web-share), [Snapseed save/export behavior](https://support.google.com/snapseed/answer/6155519?hl=en).
