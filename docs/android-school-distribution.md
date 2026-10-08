# Trinity Live school app distribution

Trinity Live is the production Android app for `https://trinityfamilyschool.vercel.app`, which uses the `trinity-family-schools` Firebase project. The current preview's package is retained on the device; the production package is `ug.trinityfamilyschool.live`. Production requires its own initial login and permissions. No preview data is deleted or transferred.

## Website download

`/download` is available without sign-in and is linked from the login page's quick links, the staff account menu and the parent sidebar. `/api/android/download` serves the signed APK as an Android package attachment, including its byte size and SHA-256 header. It checks both the configured website origin and the deployment's public Firebase project ID, so another school deployment cannot receive the Trinity Live APK. The download page shows availability, version, size, offline features and installation instructions. Only explicit development localhost previews bypass the production hostname check; project isolation remains enforced.

The immutable release artifact lives in `android-releases/trinity-live.apk`. Next.js explicitly traces this file into the download function. Release metadata in `src/lib/android/app-release.json` binds name, package, origin, project, version, filename, size and hash. A mismatched/missing artifact returns a 503 rather than sending the wrong package. The endpoint does not read Firestore or include credentials.

## Android school configuration

`config/android-schools/trinity-live.json` supplies the application name, independent package ID, trusted website origin, expected Firebase project and version. Gradle generates the application name and origin; both native bridges remain restricted to that exact HTTPS school origin. Java UI and offline fallback branding use the selected app name. Per-school Android package IDs isolate WebView cookies, encrypted snapshots, widget settings and reminder preferences. The website continues to own its database connection.

The launcher uses the existing PWA's 192/512 PNG crest, with an adaptive icon and a white background. The monochrome small notification icon is retained for Android's system notification requirements. Shortcut and widget picker labels carry the production app identity.

## Build and update

Prepare `JAVA_HOME`, `ANDROID_HOME` and `GRADLE_USER_HOME`, then run:

```powershell
./scripts/build-android-app.ps1 -School trinity-live -Signed -Tasks ':app:testDebugUnitTest',':app:assembleDebug',':app:assembleDebugAndroidTest',':app:assembleRelease'
node scripts/publish-android-apk.cjs trinity-live
```

Permanent signing credentials are kept outside the repository under `%USERPROFILE%/.codex/android-signing/trinity-live/`. Preserve and securely back up that directory: subsequent production updates must use the same key. No signing credentials are shipped in the website, JSON metadata or APK. Increasing the configured version code produces an update for the same production app. Building the same source with another school's configuration produces that school's independent APK.

Trinity Ganda is intentionally not configured or published in this step. Its website origin, Firebase project, PWA icons, app name and unique Android package will be added in its own configuration when that deployment is supplied. Publishing another school replaces the deployment's release metadata with the matching artifact; ensure each website release carries its own configuration and APK.

## Validation on 8 October 2026

- Android: 38 unit tests passed. Nine focused Pixel checks covered collapsed notification rows, short/scrollable widgets, accessibility, encrypted offline storage, reminder delivery, snooze/quiet hours and account changes. The background alarm check needed an isolated rerun after the combined run, and passed on that rerun; the other eight passed together after notification permission was granted.
- The signed, non-debuggable Trinity Live 1.10 release was installed on Pixel 7. Android notification permission remained granted after replacing the test build; the previous preview package remained installed. The actual dashboard loaded, and sending a test notification from the production app's reminder settings posted `Test lesson reminder` on its sound-and-vibration channel.
- Six download endpoint tests checked the actual signed APK's bytes/hash/attachment headers, HEAD response, explicit local development preview, public deployment proxy headers and rejection of other school origins/projects.
- Production signing verification and manifest inspection checked the package, app label, version and non-debuggable status. Launcher identity was inspected in Android App info against the PWA crest.
