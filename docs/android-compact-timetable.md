# Compact native timetable surfaces

Preview versionCode 8, versionName `1.6-compact-timetable-preview`.

The notification and launcher widget now use the dashboard's compact density:
24dp navigation controls, 22dp minimum lesson pills, smaller typography and
gutters, a short widget heading, and one header line on wide cards. Narrow
widgets keep the time beneath the lesson header and wrap the pills. Text can
increase row height with the system font scale. Full subject/class/teacher
descriptions remain available to accessibility services and on pill taps.
The density request deliberately replaces the previous 48dp controls.

Wide widget rows fit five class/subject pills across. Two complete timetable
groups fit a 355 x 170dp widget, including when progress is enabled. Additional
groups remain scrollable. Redundant next-period summary text is hidden; previous,
next, Live, lesson detail, and close interactions remain available. The default
widget is two launcher cells high, with resizing down to 120dp supported.

There is no settings button in any widget layout. Both providers retain
`reconfigurable|configuration_optional` and the existing configuration activity.
On the Pixel's Kvaesitso launcher the verified path is: long-press the widget,
open its three-dot menu, select Widget settings, then Configure widget. That
opens the sole application appearance option, Show lesson progress. The exact
launcher menu differs between launchers; application RemoteViews do not override
the launcher's long-press gesture.

Validation on the connected Pixel:

- Android build and all 20 unit tests passed.
- Three timetable instrumentation checks passed, including notification
  replacement on reapply, every size/progress state, nested collection click
  listeners, both full rows within the 170dp widget, and dark landscape with
  150% text. The existing encrypted account-isolation check also passed.
- The separate camera-bridge check initially timed out waiting for a WebView
  reply; its isolated retry passed. No camera source changes were made.
- Real pinned widget screenshots show both timetable groups; tapping a lesson
  opens its detail, and closing it restores the pills.
- Real notification screenshots show both compact groups. Pill detail, close,
  previous-period browsing, and Live reset were exercised. Browsing offsets were
  reset to zero and details closed afterwards.
- Long-press configuration was opened through the launcher. Existing progress
  preference/default was preserved, school data was retained during in-place
  installation, and the temporary test APK was removed.

APK: `output/android-offline/trinity-school-compact-timetable-preview.apk`

SHA-256: `83ebf32879935944e51ee4e571115a667bbb345b4837522cc8d38435d9f3bc66`

Device screenshots and synthetic widget renders are stored locally in
`output/android-compact-qa/`; they are not committed.
