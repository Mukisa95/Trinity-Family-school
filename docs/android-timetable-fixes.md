# Android all-timetable and offline startup fixes

7 October 2026. Android version 1.3.1, code 5.

## Behavior

The notification, every widget and the packaged dashboard show all timetables in the dashboard's current year and term. Each profile shows the current/upcoming/last period and all class/stream lessons together. Double lessons retain their subject across continuation periods. There is no timetable or class selector in native settings. Widget settings only change progress; notification settings enable or hide the card. Smaller widgets scroll through the same complete feed as larger widgets. Plain and Progress variants remain available, with optional configuration on Android 12+. Android 8-11 uses the native collection service.

The hosted app now automatically verifies the account and exports its existing identity-scoped caches. It prepares the same year/term as DashboardLiveTracker, including fallback selection when no academic year has isActive. Temporary session preparation failures retry with a bounded backoff. Parents reuse their existing family repository and parent dashboard.

## Offline failure and live activation

Two causes were identified. The verified session endpoint and web provider had never been published, so installing the earlier APK could not prepare offline access. These changes were published in scoped commit 7b9bfc8, based on origin/main rather than this dirty checkout. Vercel reported a successful deployment; the live /api/offline/session endpoint now responds with an authentication-required JSON 401 instead of a 404 when called without a token.

The first actual Pixel preparation then exposed an oversized payload: the current account's cached pupil collection measured 145,006,125 JSON characters, including 142,540,253 characters of photo data across 715 inline photos. The native storage limit is 12 MiB. Earlier oversized bridge messages were silently ignored, producing timeouts and no snapshot.

Scoped web commit 6fb6426 adds JPEG thumbnails derived only from existing inline cached photos. Originals and their JPEG upload contract are unchanged. Thumbnails are at most 96 by 96 pixels and 8,192 characters each, with a deterministic 5 MiB aggregate limit and four concurrent decoders. Damaged images fall back to the pupil initial; they cannot block the entire export. No remote photos are downloaded. The native bridge now explicitly rejects an oversized payload.

## Verification

- 17 Android JVM tests passed, including all profiles/classes/streams together, progress boundaries, double periods, encrypted-store policy and interrupted refreshes.
- 44 focused web tests passed across Android, parent isolation, timetable streams and class streams. The focused TypeScript check reports only the existing src/lib/server/app-auth.ts:334 TS2367 diagnostic.
- Browser checks exercise the actual provider's automatic connect/export/save with fixture auth/query owners, real IndexedDB/localStorage, photo resizing and damaged-image fallback, parent/staff UI, locking, 375px, landscape and dark mode.
- Five targeted Pixel checks cover real RemoteViews in all six size/progress combinations, all-profile scrollable collection items, notification actions/progress/countdown, encrypted persistence, packaged WebView startup with network blocked, and trusted camera discovery. Collection rendering uses a detached AppWidgetHostView with the actual registered provider information, without pinning fixture widgets.
- Vercel successfully built and deployed both scoped web commits. The separate Windows production build was stopped after the successful hosted build; no successful local production build is claimed.

## Final delivery

Version 1.3.1 (code 5) was installed on the connected Pixel without clearing its data. The signed-in account automatically established the verified session and created a 3,145,514-byte encrypted copy after the thumbnail web deployment. The deployed layout chunk was confirmed as layout-45d6f6a398840d6d.js. All five targeted Pixel checks passed on the final APK.

APK: output/android-offline/trinity-school-all-timetables-preview.apk (2,173,006 bytes).
SHA-256: 9E3D61AA681209C3560E276182B83634EA7FBA7A18F4A9C3165CBC41B4C4EE35.

With the WebView's network blocked, directly opening the packaged dashboard on the Pixel returned local=true, unlock=true, missing=false. The real encrypted snapshot was available without any network request, and the old connect/sign-in prompt was absent. The native notification was posted from real data under notification ID 7201, with the ongoing flag and two actions (Open timetables, Settings). Both complete profile names were found in its content. Test APK and temporary debug port were removed afterwards.

A physical phone network-disconnection/cold-start check was rejected by automatic approval review with no specific reason. Wi-Fi and mobile-data settings were not changed. Device credential entry, actual pupil-page opening after that unlock, and launcher pinning/resizing remain user-side acceptance checks; these are not claimed as automated real-data checks.  Device unlock remains user controlled. This report does not claim that a synthetic fixture is school data, or that Android guarantees uninterruptible notification visibility or exact background alarm timing.
