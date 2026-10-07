# Android timetable controls preview

Version 1.9-timetable-controls-preview (version code 11).

## Notification card

The collapsed card displays the first two visible timetables in canonical order. Each row includes its timetable name, period/time, class/subject summary, previous/next and Live controls, plus an optional thin progress bar. Android permits only 48 dp of collapsed custom content, so these rows use a smaller presentation than the widget. Larger text settings show the primary line without the secondary summary.

With one or two visible timetables the app uses the same compact layout for both states, without a decorated style or additional expanded content. With more than two, expansion exposes all visible timetables using the existing full cards. Android controls the expand button: on the tested Pixel running Android 17, recovered Notification.Builder generates an expanded view even if the app omits one. The app cannot guarantee removal of this system affordance; both states retain the same two timetable rows instead of falling back to Android's generic summary.

## Widget and display settings

Both widget providers request an 80 dp minimum resize height and one target grid row. At this height the header disappears, leaving the existing scrollable timetable collection. A wide widget fits its first complete normal-size timetable with or without progress; additional rows remain reachable by scrolling. Actual grid sizes and resize limits depend on the launcher, width, font size and timetable content. Widget navigation and class-pill interactions keep their existing behavior. Settings remain available through launcher reconfiguration rather than a permanent settings button.

Timetable card settings contain a checkbox for each complete cached timetable. Checked timetables appear; unchecked timetables are hidden. Show all restores the whole feed. These defaults also apply to widgets without their own visibility selection. Configuring an individual widget saves its own selection, independent of the card and other widgets. Display choices never change reminder subscriptions or school records. Account authorization and the offline cache lease remain enforced. Update scheduling considers boundaries of every widget's visible timetable selection.

Show notification card can restore a dismissed card or hide it, requesting Android's notification permission if needed. The existing bridge also honors an explicit notificationCard setting again. Individual widget configuration does not alter this global card toggle. The previously saved hidden-card state is preserved during upgrade.

## Reminder filters

Available choices cascade in this order:

Timetable -> class -> subject -> teacher -> starting lesson period.

Classes come from the selected timetable profiles. Subjects and teachers come from matching entries and their current consolidated/separate stream mode, including optional subjects and teachers. Period identifiers retain their timetable ownership. When an upstream choice changes, compatible downstream selections are retained; wholly incompatible selections reset to All within the new scope. Explicit None remains None. Opening settings alone does not rewrite stored selections. Breaks/lunch follow timetable and class filters, as before. Changes are saved only with Save reminder settings.

## Validation

- Android build, debug APK and instrumentation APK succeeded.
- All 38 unit tests passed, including five cascading-filter and two visibility cases.
- All 15 focused instrumentation checks passed on the connected Pixel: reminders, encrypted offline cache, cache latency, RemoteViews and widget controls.
- Two collapsed rows measured within 48 dp; a three-timetable fixture retained its expanded full layout.
- The live Pixel notification shade displayed both LOWER and UPPER rows in the collapsed card. The native card toggle successfully re-enabled a previously dismissed card; the original hidden state was restored after inspection.
- An 80 dp wide widget kept its first timetable fully visible and scrolled to fully reveal its second, with progress on and off. This uses actual Android RemoteViews and a synthetic widget host, not a manual launcher resize.
- Global hiding applied to the actual cached timetable projection, while an independent widget selection overrode the default; original preferences were restored.
- Native settings were inspected on the device. Changing the selected timetable narrowed class choices from the selected upper timetable's four classes to the lower timetable's three. Class and subject dialogs used the narrowed choices. The draft was discarded without changing saved reminders.
- Measured cache warm 20 reads: 16 ms; publishing all surfaces: 118 ms. Cold cache: 1437 ms. These are device checks, not a guarantee for every launcher or device.
- Version 11 was installed as an upgrade without clearing app data. No web deployment or Firestore change is required by these native changes.

Platform references: [custom notification layout limits](https://developer.android.com/develop/ui/views/notifications/custom-notification), [widget sizing and responsive layouts](https://developer.android.com/develop/ui/views/appwidgets/layouts).
