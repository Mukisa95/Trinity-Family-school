# Widget subject tracking and launcher shortcuts

Both timetable widget providers hide the shared heading at every size. Individual
lesson, class and event cards retain their own labels.

Long-press a widget and open its launcher's widget configuration. Enable **Track
selected subjects**, then select class/subject pairs. There is no selection count
limit. Each widget saves its own choices; full timetable cards remain the default.
Tracked feeds load cards on demand rather than parceling every selected subject
into every responsive widget size. Subject tracking replaces full timetable cards
for that widget. Existing event
display choices and automatic tomorrow/ongoing event cards still apply. Notification
card settings and lesson reminder subscriptions retain their existing behavior.

`TrackedSubjects` computes the current or next occurrence entirely from authorized
saved timetables. It respects class stream layouts, optional subjects and teachers,
double lessons, weekends, term dates and the school time zone. Cards stay on an
ongoing lesson until its end, then advance. Missing saved data produces an explicit
refresh message. Widgets retain the existing independent boundary alarms, access
expiry, reboot and periodic recovery paths; future tracked lessons do not need
minute redraws. Turning tracking off retains the saved subject choices.

The five app-icon shortcuts are Search, Timetable, Events, Pupil and Exams. Each
school build targets its own Android package and website. Only recognized shortcut
identifiers are mapped to routes. Cold launches and new intents use the same map.
Search opens `/?openSearch=1`; the actual dashboard header opens and focuses the
pupil search, then consumes only that flag. Other query parameters and the fragment
are preserved. Parent accounts retain their existing search/access restrictions.
Exams retains its existing connection requirements.

Android and launcher limits determine how many shortcuts appear in a particular
menu; defining five cannot override the phone's limit. See the official
[shortcut management documentation](https://developer.android.com/develop/ui/compose/system/shortcuts/managing-shortcuts).

Validation uses `TimetableScheduleTest`, `AppShortcutsTest`, Android build/lint,
and `scripts/test-android-shortcut-search.cjs` (real header, synthetic school data).
Browser coverage includes mobile/tablet/desktop, landscape, light/dark, reduced
motion, larger text, search results, flag consumption and parent/normal entry.
Real launcher, widget scrolling and sleep recovery still require a connected phone.

Local verification: both school debug APKs and instrumentation APKs built; all 78
JVM tests passed for each school. The final shared-source Android lint check passed
under Ganda with zero errors (103 warnings). Compiled APK inspection confirmed
subject tracking, all five shortcut targets, and each school's own route origins.
All eight responsive browser cases and normal/parent entry checks passed. Compared
with the unchanged header baseline, focused TypeScript diagnostics fell from 11
to six existing errors, with no new diagnostics. No phone was connected.

The authorized release advances Trinity Live and Ganda to Android 1.26 (code 28),
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
