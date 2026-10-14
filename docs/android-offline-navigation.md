# Android offline page transitions

The offline navigation guard previously used `location.assign()` for available
pages. Each switch replaced the whole document, remounted the application and
restarted connection/session initialization.

The Android shell preparation now saves the public Next route responses alongside
the existing HTML and hashed assets. Offline links and programmatic navigation
use the normal Next router and the saved response for the currently running
build. Saved viewing still uses the existing account, grant and expiry checks.
Only explicitly supported routes are saved; route requests omit credentials and
contain no school records. API responses and mutations are not cached.

Missing, evicted or incompatible route responses leave the current page usable.
Blocked transitions release the navigation progress UI. Existing parent browser
shell behavior remains covered separately.

The network indicator and sync context now respect both browser and Android
connectivity. The indicator cancels stale probes and skips periodic probes while
either source reports offline.

## Local verification

- `npm run test:android-offline-navigation`: production Next fixture, real router
  and service worker; staff/parent routes, detail query IDs, push/replace/back,
  same-page plain links, retained document/header, cold offline launch, native
  offline signal with browser online, no periodic offline probes, unsupported or
  missing routes, mismatched build and online recovery.
- `node --test tests/android-route-response.test.cjs`: long UTF-8 metadata and
  binary Flight records, including records without a newline before the root.
- `node scripts/test-android-app-shell.cjs`: original HTML/assets and styles,
  cold launch, 503 fallback, older shell preservation, blocked writes,
  account/grant isolation, and legacy parent browser launches.
- `node scripts/test-android-offline-browser.cjs`: real provider and local cache
  owners with a fixture bridge; account isolation, locking and timetable data.
- `node scripts/test-offline-banner-session-browser.cjs`: offline banner and
  retained session/revocation behavior.
- 32 focused Android, preparation, parent-offline, navigation and workspace tests
  passed; focused TypeScript check passed.

Browser tests use synthetic accounts and an Android bridge fixture. Real-device
validation remains outstanding. This change is shared web code for both schools;
no APK version or Android signing changes are required. Open the app online after
deployment to download the updated interface before testing offline transitions.
