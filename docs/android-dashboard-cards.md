# Android dashboard timetable cards (v1.5)

The Android window now owns system-bar and cutout padding once and consumes
those insets before they reach the WebView. The status and navigation icon
colours follow the original web page theme, including later theme changes.
Hardware cutout clearance remains; the application header starts directly
below that clearance. The original online/offline web interface is retained.

The notification and widgets reuse the dashboard timetable presentation:
white card, indigo outline, coloured class/subject pills, live lesson label,
countdown, current-period progress, and previous/next/Live controls for each
profile. Tap a pill for its full subject, class/stream and teacher, then close
the detail view. Browsing and open details are local to each surface and reset
on Live or when navigating. All profiles/classes are loaded automatically.
Widget appearance settings contain only the progress switch. Narrow widgets
wrap their pills and controls; wide short widgets keep controls beside the
lesson; the widget feed scrolls to the remaining profiles.

Android retains the system notification header and expand/collapse frame.
The expanded notification has the interactive timetable card; the collapsed
notification shows a concise all-profile summary. These are native RemoteViews,
not an embedded web page, so spacing accommodates Android touch targets.

Interactive PendingIntents remain explicit to the non-exported timetable
receiver. Every action validates the current account, timetable grant and
lease, and widget actions validate the installed provider. Timetable data
remains in the existing encrypted native snapshot. Surface updates replace
previous children and explicitly reset badge/detail visibility on reapply.

Validation:
- All 20 Android unit tests pass; debug app and test APKs build successfully.
- All five targeted Pixel checks pass: native notification rendering/reapply,
  all widget sizes and progress states, collection pill click listeners,
  150% text with dark landscape resources, encrypted account isolation and
  trusted photo bridge. The photo fixture now waits for asynchronous startup,
  avoiding a race in which normal initial navigation replaces the fixture.
- Pixel screenshots confirm readable status-bar icons in both theme states,
  and headerTop=0 inside the original WebView (the hardware inset is applied once).
- On the real notification, previous-period browsing, pill details, closing
  details and Live reset were exercised. The pinned launcher widget also opens
  the correct subject/teacher detail via its own collection PendingIntent.
- Existing app data was preserved during installation of versionCode 7,
  versionName 1.5-dashboard-cards-preview. Temporary test APK removed.

APK: output/android-offline/trinity-school-dashboard-cards-preview.apk
SHA-256: 25B959BA66A7FAE4521DB74D24963F3A74B5F79D254FBD515949A56B10DCD344
