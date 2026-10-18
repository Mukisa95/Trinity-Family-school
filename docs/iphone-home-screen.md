# iPhone Home Screen app

Install from the school website in Safari: Share → Add to Home Screen → Add.
Leave Open as Web App enabled when that option appears. Open the new icon and
sign in online. No paid Apple account is needed. Notifications require iOS 16.4
or later; newer capabilities are detected rather than assumed.

## Included

- Standalone launch, Apple touch icon, safe-area spacing, landscape support,
  dark appearance, larger text and normal text zoom.
- Existing school pages, persistent sign-in and the existing privacy/passkey
  controls. Temporary network failures retain a previously validated identity.
- Server-derived, seven-day offline viewing grants. Installed apps share the
  Android cache preparation scheduler, original Next route cache and read-only
  navigation guard. Private pupil and parent records stay in their existing
  account-scoped stores; the offline workspace saves only compact schedule and readiness
  metadata rather than duplicating photos or parent financial records.
- Saved dashboard, pupils, timetable and calendar/events, according to account
  permissions. Parents retain their separate family workspace. Pages and data
  must finish preparing online before a cold offline launch.
- On iPhone and iPad, account settings show per-section offline readiness, renewal expiry, storage
  protection when supported, notification enrollment and an exportable problem
  report. Revoked access, logout and account changes clear the PWA workspace.
- The dashboard retains its existing appearance on every platform. Installation
  does not add a separate agenda, customization panel or duplicate timetable.
  Timetables and events remain in their existing dashboard cards and pages.
- The existing authenticated Web Push registration and notification routing are
  reused. Permissions are requested from a button tap. Supported systems show a
  new-alert badge, cleared when notifications are opened or the user signs out.

## Platform boundaries

iOS controls storage eviction and background delivery. Push needs connectivity;
Focus settings can delay or suppress an alert. Web apps cannot provide Android
native widgets, exact offline lesson alarms or unlimited background downloads.
Storage protection is a request to iOS,
not a guarantee that saved records will never be removed. The app never forces
a reload when returning from the background or receiving a worker update.

## Local checks

`npm run test:pwa` checks install metadata, platform visibility, real IndexedDB and UI flows with
synthetic records in Chromium and WebKit. The navigation fixture can run with
`OFFLINE_PLATFORM=pwa` and `PLAYWRIGHT_ENGINE=webkit`; it uses the actual Next
production router and service worker. No production account is used.
Set `PLAYWRIGHT_MODULE` to an available Playwright installation if it is not
installed in the checkout; its WebKit engine and Chromium/Edge must be available.
Playwright WebKit's offline-navigation emulator currently fails even with a
literal service-worker response ([upstream issue](https://github.com/microsoft/playwright/issues/42775)).
Warm navigation is checked in WebKit; cold offline launch is checked in Chromium
and remains a required physical-iPhone check.

Before calling the iPhone release device-verified, test on the iPhone 12:
install from each school site; sign in; allow notifications from a tap; wait for
Saved; close and reopen in airplane mode; switch offline pages; lock/unlock;
test logout/account switching, notification delivery and tapping an alert into
an already-open app. Automated WebKit is useful coverage, not an iPhone test.
