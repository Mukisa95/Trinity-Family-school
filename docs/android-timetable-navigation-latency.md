# Responsive timetable navigation

Installed preview: versionCode 9, `1.7-fast-timetable-preview`.

Navigation broadcasts now carry `Intent.FLAG_RECEIVER_FOREGROUND` on both the
notification PendingIntents and widget collection template/fill-in intents.
Android permits the receiver to run at foreground priority with this flag:
https://developer.android.com/reference/android/content/Intent#FLAG_RECEIVER_FOREGROUND
Automatic alarm updates retain their existing background behavior.

One process-wide executor processes received taps in order. Each interaction
reuses a read-only timetable projection shared across OfflineStore instances,
and publishes only the tapped widget or notification. Other widgets keep their
own navigation state. Scheduled updates and newly prepared datasets still
refresh every surface.

The cache contains only the session and timetable/reference datasets; it omits
pupil, parent and dashboard data. Disk storage remains the original encrypted
envelope. After process restart, a cold access decrypts and validates that
envelope once. Warm accesses verify source existence/version and session expiry.
Successful connect/save writes publish a detached updated projection; clear
removes it. Cold reads check that their source version still matches before
publishing, and never hold the cache lock while reading the encrypted store.
Existing account, widget-provider and timetable-grant checks remain in place.

Pixel results:

- Baseline: two complete snapshot reads took 1,333ms. This alone did not
  reproduce the user's reported 18-second delay. Foreground broadcast delivery
  addresses a potential scheduling delay; the remaining changes reduce work
  and remove overlapping tap handlers.
- Cold validated cache load: 1,110ms. Twenty warm reads across fresh store
  instances: 16ms total. Publishing all surfaces: 154ms.
- Real widget taps: cold processing/publication 1,086ms; subsequent previous
  taps 59ms and 66ms, with zero measured executor queue wait. Live reset: 64ms.
- Real notification previous: 95ms; next: 65ms. Screenshots captured after
  250–300ms show the new period. These handler timings exclude Android delivery
  before onReceive and launcher/SystemUI drawing after publication.
- All 20 Android unit tests and eight targeted Pixel instrumentation tests
  passed. These include cache cold/warm latency, save replacement, account
  switch, revoked grant, logout and expiry, encrypted account isolation, and
  every compact widget/notification rendering check.
- Both surfaces were returned to Live, with all browsing offsets zero and
  details closed. Temporary test APK removed. Existing school data, compact
  layouts, widget sizes and progress preferences were preserved.

APK: `output/android-offline/trinity-school-fast-timetable-preview.apk`

SHA-256: `0b9b171ff762b9a52f586b009c314a0bb03708295264e412c36d23147da4589d`

Local screenshots are in `output/android-timetable-latency-qa/`. Diagnostic
timings log only operation names and elapsed milliseconds in debuggable builds.
