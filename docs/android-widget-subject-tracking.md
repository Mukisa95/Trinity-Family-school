# Widget subject tracking and launcher shortcuts

## Android 1.29 (code 31)

Tracked class/subject codes and phone-formatted times share a line when the
available width fits their text. Adjacent tracked cards use two equal columns
when both fit at the current system text size; otherwise they remain full width.
Pairing preserves saved card order, independent taps and scrolling, and never
moves cards across a timetable or event. Wider widgets can use inline text in
both columns. Narrow widgets and larger fonts keep wrapping without reducing text.

A live tracked card hides its progress bar when a visible live timetable already
shows progress over the same lesson interval. Tracking alone, hidden/browsed or
different timetables, and double lessons with a different interval keep their own
progress. This is per widget and does not change notification cards or reminder
subscriptions. Native changes require a new installed APK after release.

Device tests cover inline and paired card geometry at multiple text sizes and
light/dark appearances, independent collection actions, and shared-progress
visibility. The suite compiled successfully. No phone was connected, so device
tests and launcher verification have not been executed. Paired columns bind their
own collection actions; the device suite checks both against a collection template.

Both permanently signed 1.29 school releases passed all 101 release JVM tests
and lint with zero errors (108 existing warnings). APK versions, school identities,
permanent signing certificates, shortcut targets, responsive widget resources and
updated native code were verified. All 27 download/update/event/notification
contracts and 11 route-response/hosting-build checks passed. Install the updated
APK from the matching school download page to receive these native changes.

| Android 1.29 app | Bytes | SHA-256 |
| --- | ---: | --- |
| Trinity Ganda | 4724281 | `a3f664634c23a81b5ee4643bc8315a769db74163b681341fd67e5edcd8439927` |
| Trinity Live | 4724273 | `eec75f327525bc8078cd7947000e716994e2c779228ce0a011bb77a58e671c27` |

## Android 1.28 (code 30)

This release adds class-first subject selection, compact teacher-free lesson
notifications (including snoozed reminders), and widget content that adapts to
launcher-reported sizes. Existing tracked subjects and card order are retained.
The release also includes the current startup/offline reliability changes and
an Android 8.0 launch-theme compatibility correction.

Both permanently signed school releases passed all 96 release JVM tests and
Android release lint with zero errors (108 existing warnings). School identities,
signing certificates, shortcut targets, packaged reader names, APK hashes and
embedded feature code were verified. All 27 download/update/event/notification
contracts and 11 route-response/hosting-build checks passed. Device UI tests
compiled during local validation; physical launcher and notification validation
is still required. A website refresh does not install native changes: install
the updated APK from the matching school's download page.

| Android 1.28 app | Bytes | SHA-256 |
| --- | ---: | --- |
| Trinity Ganda | 4720781 | `2db735c05861565d41b7fdd4d4ce1c352e9b4d0a332c69bf0b4dd64974db6345` |
| Trinity Live | 4720721 | `54b6e21ffcf21d5507a9cdf21b9726db0d37806216396e024fdc7f6b5ac4347a` |

## Widget settings and behaviour

Both timetable widget providers hide the shared heading at every size. Individual
lesson, class and event cards retain their own labels.

Long-press a widget and open its launcher's widget configuration. Enable **Track
selected subjects**, choose a class, then select subjects within that class.
Only that class's subjects are shown. Choose another class to add more; existing
selections remain checked when switching classes. A per-class count summarizes
all selected subjects, including those outside the currently visible class.
Saved selections from earlier versions remain intact. There is no selection count
limit. Each widget saves its own choices; full timetable cards remain the default.
Tracked feeds load cards on demand rather than parceling every selected subject
into every responsive widget size. **Show timetable cards alongside tracked
lessons** lets each widget combine the two, or show tracked lessons alone.
**Card order** provides labeled Up/Down controls for arranging individual
tracked, timetable and event cards. Order survives refreshed snapshots and clock
ticks; hidden cards keep their positions for when they are shown again. Newly
available cards follow the saved choices. Notification settings and reminder
subscriptions remain independent.

Tracked cards display class and subject codes, such as `P4 · ENG`, a Now/Next
state and a time range. They omit dates and teachers. Times use Android's system
12/24-hour formatter, while retaining the school's time zone. Normal timetable
card ranges use that formatter too. Only today's lessons appear: an ongoing
lesson remains until its exact end, then advances to the next one today. After
the last lesson the card says **Done today**; a day without that subject says
**No lesson today**. Midnight recomputes the next day's state. Missing saved data
continues to show an explicit refresh message. Saved choices, boundary alarms,
access expiry, reboot and periodic recovery remain in place.

The five app-icon shortcuts are Search, Timetable, Events, Pupil and Exams. Each
school build targets its own package and website. A disposable
`AppShortcutActivity` has an empty task affinity, isolating the static shortcut's
Android-supplied clearing flags. It launches `MainActivity` with
NEW_TASK/CLEAR_TOP/SINGLE_TOP to reuse an existing activity. A ready handshake
queues warm shortcuts until the web listener exists, then sends only a recognized
identifier. The existing Next router changes pages without reloading the WebView.
Cold launches still load their initial destination normally. The packaged recovery
reader also changes its own React state without reloading or unlocking again;
shortcuts arriving while locked wait for the normal unlock and grant checks.

Search opens the dashboard search and preserves an existing search term. The
header consumes only `openSearch=1`, preserving unrelated URL parameters and the
fragment. It signals native Android after the real input receives focus, including
when mobile animations defer mounting. Android waits for window focus and the
active search editor before requesting the keyboard. The reader uses the same
editor signal. Account/parent restrictions remain; Exams requires a connection,
even if Next previously cached that page during the open session.

See Android's [static shortcut task guidance](https://developer.android.com/develop/ui/compose/system/shortcuts/managing-shortcuts)
and [keyboard focus guidance](https://developer.android.com/develop/ui/views/touch-and-input/keyboard-input/visibility).

Android and launcher limits determine how many shortcuts appear in a particular
menu; defining five cannot override the phone's limit. See the official
[shortcut management documentation](https://developer.android.com/develop/ui/compose/system/shortcuts/managing-shortcuts).

## Android 1.27 validation history

Android 1.27 validation covered clock formatting, today's lesson/end/midnight
states, mixed card ordering and saved-code fallback in JVM tests. Synthetic browser
fixtures exercise the real header, Next router, service worker and packaged reader:
warm and cold search, focused-editor bridge messages, safe route identifiers,
normal/parent boundaries, online/offline navigation, preserved document/header
state, unsupported sections and storage failures. Cases cover 375/768/844-landscape/
1280 widths in light/dark, reduced motion and larger text.
`TrackedWidgetDeviceTest` adds isolated synthetic Android feed and RemoteViews
coverage for mixed versus tracked-only modes, per-widget choices/order, grants,
phone-clock formatting and compact text scaling. Instrumentation is compiled,
not executed without a connected phone. Actual launcher task reuse, keyboard
visibility and native widget appearance/scrolling still need device validation.

Lesson reminder alerts, including snoozed and expanded text, use class/stream
and subject codes without teacher names. Times use the phone's 12/24-hour format
in the school's time zone. Teacher subscription filters remain available.

Widget layouts follow the launcher's exact reported sizes on Android 12+ rather
than six app-defined size presets. Older or third-party launchers without exact
sizes use their portrait/landscape ranges. Chips reflow with available width and
system text size, while the scrollable feed fills the chosen height. Both widgets
can shrink to 120dp wide and 48dp high, with no app-defined maximum size. The
launcher still determines its grid and actual resize increments; the app cannot
override that grid to provide arbitrary pixel-by-pixel resizing.

Both school debug APKs and instrumentation APKs built successfully. Each school
passed all 84 JVM tests and Android lint with zero errors (108 warnings). Compiled
APK inspection confirmed school-specific targets and the isolated shortcut task,
plus the new packaged reader handler. All browser checks above passed. Focused web
comparisons found no new issues: six existing TypeScript diagnostics and nine
existing ESLint errors remain unchanged.

The previous release packaged these refinements as Android **1.27 (code 29)**
for both schools, together with the shared website shortcut handler. Install the
updated school APK to receive native shortcut and widget changes. Existing school
identities and permanent signing certificates are preserved.

Signed release checks passed all 84 JVM tests per school and release lint with
zero errors (107 warnings). All 20 download/update/school-isolation/event contracts,
five route-response tests and all browser checks passed after rebasing onto the
current production branch. Physical-device verification remains pending.

| Android 1.27 app | Bytes | SHA-256 |
| --- | ---: | --- |
| Trinity Ganda | 4711529 | `dc32755bcda479731e2e39bb505db3397d04a3a68d622963d21b57527e7bea65` |
| Trinity Live | 4711545 | `fd0c80baa67e9598fdb889868624bb1cdb4e221cf54cff3826ea903b92cf9240` |

## Previous release: Android 1.26

The previous release advanced Trinity Live and Ganda to Android 1.26 (code 28),
with the shared website header change. Each school retains its existing permanent
signing certificate, app identity, website and Firebase project. Native widget and
launcher changes require installing the matching updated APK.

Signed release validation: both school builds passed all 78 JVM tests and release
lint with zero errors (102 warnings). Signature, version, shortcut and school
identity checks passed for both artifacts.

| App | Bytes | SHA-256 |
| --- | ---: | --- |
| Trinity Ganda | 4706333 | `e72a25f23079dcfc5d3793326422a02da5d4151047023c0faecf5a381351a580` |
| Trinity Live | 4706285 | `a74e2ed9c9a8640e3dac4cab875cd60e15d50b658fb6134d8fe6af54322a700a` |
