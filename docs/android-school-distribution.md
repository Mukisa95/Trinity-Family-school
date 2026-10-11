# School Android app distribution

Trinity Live is the production Android app for `https://trinityfamilyschool.vercel.app`, which uses the `trinity-family-schools` Firebase project. The current preview's package is retained on the device; the production package is `ug.trinityfamilyschool.live`. Production requires its own initial login and permissions. No preview data is deleted or transferred.

## Website download

`/download` is available without sign-in and is linked from the login page's quick links, the staff account menu and the parent sidebar. `/api/android/download` serves the signed APK as an Android package attachment, including its byte size and SHA-256 header. It checks both the configured website origin and the deployment's public Firebase project ID, so another school deployment cannot receive the Trinity Live APK. The download page shows availability, version, size, offline features and installation instructions. Only explicit development localhost previews bypass the production hostname check; project isolation remains enforced.

Signed release artifacts live in `android-releases/`: `trinity-live.apk` and `trinity-ganda.apk`. Next.js explicitly traces the APKs into the download function. The shared `src/lib/android/app-releases.json` registry binds each school's name, package, origin, project, version, filename, size and hash. The website selects by its public Firebase project and verifies the request origin. `app-release.json` remains the legacy Trinity Live metadata for existing tooling. A mismatched/missing artifact returns a 503 rather than sending the wrong package. The endpoint does not read Firestore or include credentials.

## Android school configuration

`config/android-schools/trinity-live.json` supplies the application name, independent package ID, trusted website origin, expected Firebase project and version. Gradle generates the application name and origin; both native bridges remain restricted to that exact HTTPS school origin. Java UI and offline fallback branding use the selected app name. Per-school Android package IDs isolate WebView cookies, encrypted snapshots, widget settings and reminder preferences. The website continues to own its database connection.

The launcher uses the existing PWA's 192/512 PNG crest, with an adaptive icon and a white background. Notifications use the transparent crest as their monochrome small icon; lesson alerts additionally show a cached 128px colour crest. Shortcut and widget picker labels carry the production app identity.

## Build and update

Prepare `JAVA_HOME`, `ANDROID_HOME` and `GRADLE_USER_HOME`, then run:

```powershell
./scripts/build-android-app.ps1 -School trinity-live -Signed -Tasks ':app:testDebugUnitTest',':app:assembleDebug',':app:assembleDebugAndroidTest',':app:assembleRelease'
node scripts/publish-android-apk.cjs trinity-live
```

Permanent signing credentials are kept outside the repository under `%USERPROFILE%/.codex/android-signing/trinity-live/`. Preserve and securely back up that directory: subsequent production updates must use the same key. No signing credentials are shipped in the website, JSON metadata or APK. Increasing the configured version code produces an update for the same production app. Building the same source with another school's configuration produces that school's independent APK.

## Trinity Ganda

`config/android-schools/trinity-ganda.json` builds **Trinity Ganda** (`ug.trinityfamilyganda.live`) for `https://trinityfamilyganda.vercel.app` and the `trinity-family-ganda` Firebase project. Its initial native version is 1.21 / version code 23, using the same current native feature baseline as Trinity Live. The PWA icon bytes were verified against the Ganda website before reusing the shared crest assets.

The Ganda Firebase Android app was registered with explicit user authorization on 11 October 2026. Its app ID is `1:386680805645:android:a0fc711d49a00d16a5b844`; SDK configuration supplies the matching project/sender/API key. Permanent Ganda signing credentials are outside the repository at `%USERPROFILE%/.codex/android-signing/trinity-ganda/`. They are separate from Trinity Live's key and must be retained for Ganda updates.

```powershell
./scripts/build-android-app.ps1 -School trinity-ganda -Signed -Tasks ':app:testDebugUnitTest',':app:assembleRelease'
node scripts/publish-android-apk.cjs trinity-ganda
```

Despite its historical filename, `publish-android-apk.cjs` only prepares the verified APK and metadata **locally**; it does not push or deploy. Preparing Ganda adds its registry entry without replacing Trinity Live's release. Identity collisions with another school's package, project, website or artifact are rejected before copying the APK.

The existing `/download` page and login/account download links display the selected school's name automatically. Ganda users receive `trinity-ganda.apk`; Trinity Family School users continue receiving `trinity-live.apk`. Download and updater endpoints reject mismatched origins/projects, and native push registration checks the selected school's Android package against both public and Admin project identities. Android accounts, cached data, widget preferences and update state stay isolated by package.

Website publication remains a separate action requiring the user's explicit request. Registering the Firebase Android app does not deploy either website. Download/update tests verify actual APK bytes and metadata for both schools; native registration tests use local transaction doubles and send no alerts to real users.

## Android device unlock and passkeys (1.22)

Both school APKs enable WebView's app-scoped WebAuthn integration with Android Credential Manager. Each production website serves `/.well-known/assetlinks.json` for its own package and permanent signing certificate. The local artifact preparation script extracts that certificate directly from the verified APK and rejects a changed signing key. Passkey verification accepts the website origin and only that school's `android:apk-key-hash` origin; the existing server challenge, relying-party ID, account ownership and user-verification checks still apply.

Android privacy unlock is separate from passkey sign-in. Setup requires the signed account's current password and a successful system biometric/PIN prompt. Its account-scoped preference is kept in the app's existing website storage. Reopening the saved session uses Android's biometric/PIN prompt without making a server request, even when the installed WebView cannot offer passkeys. The packaged offline reader uses the same native prompt. Cancelling, navigation or failed verification leaves access locked; no password, fingerprint or face data is passed through the native bridge. Disabling native privacy unlock explicitly turns off the corresponding automatic-lock requirement. Capability checks and app updates do not clear saved privacy preferences.

Passkey sign-in still registers and verifies a real credential on the school's server. It needs a compatible, updated Android System WebView and credential provider. Local privacy unlock does not establish a new server session or bypass account sign-in. Install updates over the existing school package with its permanent signing key; do not uninstall first.

Validation: both signed release builds and 60 Android unit tests passed. The 42 web contracts cover APK distribution, updates, native push, school certificate isolation, cryptographically signed WebAuthn assertions, password-verified local enrollment and offline/cancelled unlock. Focused distribution/settings type checks passed. A broader route-inclusive check still reports the existing unrelated TS2367 in `src/lib/server/app-auth.ts` at its already-narrowed `action === 'read'` branch. Pixel checks exercise both actual release APKs without clearing account storage: native capabilities, other-school/frame restrictions, cancellation, successful authentication with no active network, and automatic/manual theme changes. Theme fixtures wait for rendered frames before polling media-query changes, then restore the user's appearance preference and device mode; offline tests restore connectivity.

## Validation on 8 October 2026

### Android notification identity and permission status (1.11)

The embedded Android WebView does not provide the website's Web Push transport. Native timetable cards and lesson reminders already use Android notification channels, but background school-announcement push is not connected to a native messaging service. The app reports these capabilities separately rather than claiming that notification permission creates a remote push subscription. The website inbox remains available.

The native-origin bridge can report this app's Android notification permission and open its own Android notification settings. Notification pages and the parent inbox offer those settings and the existing lesson-reminder settings. The browser-only automatic permission prompt is suppressed inside the Android app; ordinary browsers retain their Web Push flow. Checking or reopening native settings adds no Firestore reads or push registration calls.

The old small icon had an opaque square background. The replacement uses the PWA crest's transparent surroundings as Android's tinted alpha mask, while full-colour large icons are used on lesson reminders. The compact persistent timetable layout retains its existing row space.

Validation: 38 Android unit tests and three focused Pixel checks passed (transparent small-icon mask, posted lesson alert with the colour crest, and unchanged two-row collapsed timetable layout). Twelve notification-bridge and APK-distribution tests passed, along with the Web Push lifecycle and parent inbox contracts. The signed, non-debuggable 1.11 release (version code 13) was installed on Pixel 7 with notification permission retained and the previous preview package preserved. The published artifact is 2,084,876 bytes with SHA-256 `c32f12852390aaa72a698092150c5f8cdca9d176105544c2614cd0216f448b70`.

### Initial website distribution (1.10)

- Android: 38 unit tests passed. Nine focused Pixel checks covered collapsed notification rows, short/scrollable widgets, accessibility, encrypted offline storage, reminder delivery, snooze/quiet hours and account changes. The background alarm check needed an isolated rerun after the combined run, and passed on that rerun; the other eight passed together after notification permission was granted.
- The signed, non-debuggable Trinity Live 1.10 release was installed on Pixel 7. Android notification permission remained granted after replacing the test build; the previous preview package remained installed. The actual dashboard loaded, and sending a test notification from the production app's reminder settings posted `Test lesson reminder` on its sound-and-vibration channel.
- Six download endpoint tests checked the actual signed APK's bytes/hash/attachment headers, HEAD response, explicit local development preview, public deployment proxy headers and rejection of other school origins/projects.
- Production signing verification and manifest inspection checked the package, app label, version and non-debuggable status. Launcher identity was inspected in Android App info against the PWA crest.
