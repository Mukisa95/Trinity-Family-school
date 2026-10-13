# Android app reliability and local problem reports

Trinity Live 1.23 (version code 25) includes these Android reliability changes. The APK uses the existing school's signing certificate, allowing an in-place update. Publishing and live-download verification status are reported separately in the release chat. Phone acceptance testing is still required.

## Corrections

- Session verification invalidates a signed identity only on confirmed credential failures or invalid application claims. Unclassified SDK/service failures remain retryable while the Firebase identity still matches the saved profile. Missing identities and disabled/revoked accounts still lose access.
- Concurrent focus/visibility checks share one validation operation. A result from an earlier Firebase identity cannot clear a newly switched account.
- Android sign-in retains production's durable localStorage/IndexedDB fallback and reports the selected backend or failure in diagnostics. Failure of both is reported rather than silently presenting a session that will disappear when Android stops the app. Password and passkey login use the same persistent session establishment.
- A failed user-profile read throws an error instead of returning a missing account. Authentication refresh therefore keeps the signed session during a Firestore outage.
- Android offline status distinguishes verified access from snapshot readiness. A fresh verified session is returned while data is preparing. The boundary updates when preparation completes and displays a checking state instead of a blank screen.
- Offline snapshots follow writes to relevant persistent caches and parent repository changes, rather than every successful React Query update. Writes are coalesced, spaced at least 15 seconds apart after the initial save, deferred while hidden, and resumed on return. App-shell preparation follows grant changes and service-worker updates instead of token expiry timestamps.
- Foreground return retries offline preparation when needed, with a 15-minute bound after a successful connection and the existing failure backoff.
- Native main-page load failures offer retry and a problem report. Renderer termination removes and destroys the unusable WebView and offers a deliberate reopen without clearing sign-in storage.

## Capturing a problem

Tap **App help**, then **Copy report**, immediately after the problem (or after reopening if Android stopped the app). Paste that report into the troubleshooting chat and describe the last action. The native button operates outside the webpage, including on login, the privacy screen, and a frozen page. Report generation does not wait behind a session HTTP request.

Each report includes a `TRI-...` identifier, app/build and Android/WebView versions, current validated connection, offline preparation/expiry state, saved dataset presence and capture time, and the last 80 event codes and timings. There is no automatic upload. Reports omit passwords, tokens, account IDs, school records, free-form exception/console messages, and navigation query strings. The website recorder includes a broad page category and a compiled script/line when supplied by a JavaScript error.

Useful codes include `auth_auto_signout_on_exit` (the saved exit preference), `auth_identity_missing` (Firebase did not restore a signed identity), `auth_persistence_failed`, `auth_revalidation_delayed`, `offline_session_http_401`, `offline_access_expired`, `offline_snapshot_failed`, `offline_shell_failed`, `web_thread_stall`, and `web_renderer_killed`/`web_renderer_crashed`. Stall timing is evidence of a delayed event loop, not proof of its cause.

For a deliberate sign-out-on-exit preference, Account Settings offers lock-on-leave/lock-on-close instead. This patch preserves that explicit preference and records when it caused a sign-out.

## Validation entry points

- `node --import tsx --test tests/app-reliability.test.ts tests/android-offline-contract.test.ts tests/parent-offline-contract.test.ts`
- `node scripts/test-app-reliability-browser.cjs` (set `PLAYWRIGHT_MODULE` if using the bundled runtime). Local fixtures cover login-screen report access, older-native fallback, bounded/private reports, persistence, keyboard closing, light/dark mobile layout, and native control ownership.
- `scripts/build-android-app.ps1 -School trinity-live -Tasks ':app:testDebugUnitTest',':app:assembleDebug'`, with installed JDK/SDK/cache paths configured. `OfflineAccessStatusTest` covers first-snapshot preparation, expiry and missing/ready states.

Phone acceptance remains necessary: leave the app, lock/unlock the phone, let Android stop the process, reopen online/offline, exercise supported saved pages, and copy a report after any recurrence. No phone was connected during local validation. Full application freezes cannot be declared resolved from fixture tests alone.

Local validation on 13 October 2026: 18 focused web/session/offline tests passed; 59 Android JVM tests passed and the debug APK compiled. The focused TypeScript check and browser fixture checks passed, including inspected light/dark report screenshots. The repository's older auth-session contract still fails on its existing blanket prohibition of the parent Firestore listener; that failure also occurs with the pre-change auth context. A repository-wide TypeScript run was stopped because it includes large generated/output trees; the focused check covers the changed web runtime modules and their imported dependencies.

The release was adapted onto current production rather than copying the older mixed checkout wholesale. It preserves passkeys, native device unlock, device colours, private account-cache isolation, navigation deferral, abortable batched snapshot projection, and lightweight revision fingerprints. The release's 52 combined web/session/passkey/offline/download tests and focused TypeScript check passed, and the signed release APK compiled. Its package is `ug.trinityfamilyschool.live`, its size is 4,684,601 bytes, and its SHA-256 is `3ce0a140e6a8b95072de1b825aa921962c596f086be711809fa33a7ebcc00bab`. The Ganda APK and registry entry were preserved.

The persistence and renderer handling use the documented [Firebase persistence options](https://firebase.google.com/docs/auth/web/auth-state-persistence) and [Android WebView termination recovery](https://developer.android.com/develop/ui/views/layout/webapps/handle-termination).
