# Android original interface online and offline

Version: 1.4-same-interface-preview (Android versionCode 6).

The Android activity now always opens the original hosted route, including old
notification/widget shortcuts. Losing or regaining connectivity no longer
navigates to the separate packaged reader or reloads the current document.

After a signed-in session, the worker prepares the original dashboard, pupils,
pupil detail and timetable HTML plus their Next.js assets and dashboard artwork.
An offline restart uses those same files at the same origin. Data continues to
hydrate through the existing identity-scoped PWA caches, with the original
layout, controls, timetable cards and session lock. Parent accounts retain the
existing parent interface and parent shell preparation.

Other sections require connectivity. Supported offline pages are read-only:
editing controls, form submissions, API writes and React Query mutations are
blocked before changes can be queued. The existing native session lease must
match the current user and route grants. Widgets and the ongoing notification
continue to display all timetables together.

Validation:
- Browser: same HTML/styles/runtime after offline reload and a new tab; pupils,
  pupil query IDs and timetable routes; blocked links and RSC navigation;
  reconnect preserves the document and search state; failed-server and previous
  shell fallback; actual React boundary rejects editing and mismatched identities.
- Existing Android cache-export/provider browser suite passes.
- Android unit tests and debug APK build pass.
- Focused TypeScript check encounters existing app-auth.ts TS2367 and a missing
  @simplewebauthn/browser dependency in the shared local node_modules; deployment
  uses the committed package lock.

A device must finish its first online preparation before an offline cold start.
No school records or credentials are stored in HTML caches. Offline records
remain in the existing PWA stores; native timetable data remains encrypted.
