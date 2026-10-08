# Native school push

Trinity Live 1.12 adds Firebase Cloud Messaging to the existing Android WebView app. The registered Firebase Android app is `1:148171496339:android:0f190dc4f211983f9ba666`, package `ug.trinityfamilyschool.live`, project `trinity-family-schools`. Its public SDK configuration is part of the school build configuration; no Admin credentials are included in the APK.

The website's shared server sender now delivers to both browser endpoints and native Android devices. Existing announcement, reply, scheduled communication, SchoolPay, class attendance and fee reminder recipient rules continue to select the recipients. The Firebase attendance task also supports native recipients. This does not enable any disabled reminder automation or change the users eligible for a message.

## Registration and account boundaries

The signed-in website passes its current Firebase ID token to the trusted school-origin bridge for a single registration request. The server verifies the active app account and derives the owner from that identity. The identity token is never persisted in native storage. Each installation has a random private proof, encrypted with Android Keystore in no-backup storage. The server stores only its hash alongside the FCM token in the existing, server-write-only `pushSubscriptions` collection.

An authenticated registration can bind the current account. The private installation proof can only rotate that binding's FCM token or retire that single installation. Rotation cannot reactivate a retired device or assign another account. WorkManager retries rotation and retirement after network failures. Healthy foreground checks read local registration state without new Firestore queries or registration writes.

Sign-out clears the local recipient binding before network cleanup, cancels native school notifications, deletes the SDK token, and queues retirement of the old installation. A new account receives a new installation proof. Incoming data messages must match the currently bound account and Firebase project before Android displays them. This also protects an offline sign-out from queued messages for a previous account.

## Notification behavior

Visible school messages use high-priority FCM data delivery and the `school-announcements` Android channel, with the school crest and a colour large icon. Lock-screen public content is generic; the message body uses Android's private visibility. A resolved fee reminder removes its corresponding native card. A parent membership change refreshes parent scope only when that specific message arrives.

Taps open the school website in the app, including announcement destinations outside the limited offline routes. External destinations are rejected, and a tap from an old account/installation cannot open its old destination. Website page permissions continue to control what the signed-in account can access.

The notification settings panel shows actual Android permission and this account's native connection. Users can enable/disable school alerts, open Android channel settings, and send a provider test to this installation only. Lesson reminders and timetable cards keep their own settings. FCM requires a network connection for delivery; queued alerts can arrive when connectivity returns. Android force-stop is different from ordinary closing/backgrounding and prevents delivery until the app is opened again.

## Server configuration and deployment

The website service account needs `cloudmessaging.messages.create`; this project grants its messaging sender `roles/firebasecloudmessaging.admin`. The app's Android SDK configuration and the website Admin credentials must identify the same Firebase project. Register a separate Android app and SDK configuration for each future school rather than copying this app identity to another website.

`node scripts/build-native-push-contract.cjs` generates the shared payload/proof contract used by Firebase Functions. Deploy the website/APK using the existing production Android signing key. The production attendance dispatcher runs through GitHub Actions/Vercel and uses the shared website sender. The legacy Firebase attendance planner, settings trigger and task remain disabled by `ENABLE_FIREBASE_ATTENDANCE_REMINDERS`; there is no active `attendanceReminderTask` to deploy in this configuration. Its source supports native delivery if that legacy system is deliberately enabled in a future migration. Do not enable it alongside the production dispatcher.

## Focused validation

On 8 October 2026, 40 Android unit tests passed, including account/project matching and safe tap routes. Five Pixel checks passed: real FCM token acquisition, native notification crest/private lock-screen content/removal, both existing lesson icon checks, and unchanged compact timetable rows. The rendering check was corrected to wait for Android's asynchronous notification posting before its successful rerun. The changed TypeScript files had no typecheck diagnostics; the repository-wide typecheck still reported existing errors elsewhere.

Nine server contract tests cover registration input, school isolation, verified account binding, proof-scoped rotation/deactivation, authoritative recipient metadata, payload size, tap URLs and invalid-token cleanup. Browser subscription lifecycle, scheduled communications, push navigation and parent inbox contracts remain applicable. Live background delivery is checked separately from provider acceptance or local rendering tests.

The website sender passed an FCM dry run after its messaging permission was configured. The signed, non-debuggable 1.12 release (version code 14) was installed on Pixel 7 with notification permission retained. Its APK is 3,156,842 bytes; SHA-256 `355651704d06bb25ec1eb1897ac16781d958238996636059958821770eaa3f18`. Six APK distribution checks also passed.

Release commit `948626fbff6a14f2248c87aa7ef59efc160c55ba` was pushed to `main` and the Trinity website deployment succeeded. Downloading the production APK returned the exact installed release hash. Unauthenticated registration and provider-test requests returned HTTP 401; invalid rotation input returned HTTP 400.

Two real alerts were received on the Pixel: the notification page's **Send push test** arrived after returning to the Android home screen, and a separate single-device test through the shared server sender arrived after `am kill` had closed the background app process (`pidof` was empty before sending). Firebase accepted one message with no failure, Android restarted the process, and the `school-announcements` notification appeared with the crest, colour large icon and private visibility. Tapping that alert reopened Trinity Live's notifications page, where the same account still showed its connection as active. Only the verified Pixel installation was targeted; no school inbox message was created. The existing Firebase scheduler retirement contract also passed.
