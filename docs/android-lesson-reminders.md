# Android lesson reminders (1.8)

The Android application can schedule local lesson reminders from the authorized encrypted timetable already used by its dashboard, notification card and widgets. This adds no Firestore reads, server scheduler or continuously running service. Reminder delivery does not need a network connection. The existing all-class cards, their navigation and progress controls keep their current behavior.

## Controls

Open **Lesson reminders** from the application icon's long-press shortcuts, or choose **Lesson reminder settings** inside native timetable card/widget settings. The trusted native bridge also accepts `openLessonReminderSettings`.

- Reminders start disabled. Users enable them and save their choices.
- Independently select lesson start and end alerts, and advance reminders of 1, 2, 3, 5, 10, 15, 20, 30, 45 or 60 minutes before either boundary. Off disables an advance reminder.
- Filter by timetable, class, subject, teacher and individual timetable period. Each category supports All, multiple selections or None. Filters combine across categories. Optional subjects and teachers match too. All includes future additions; a removed selected ID never silently turns into All.
- Double lessons have one start and end. Select their starting period when filtering periods. Stream-specific lessons follow the profile's consolidated/separate rules.
- Choose reminder days, including weekends; optionally include activities and breaks/lunch. Breaks follow timetable, class and period filters, independently of subject/teacher filters.
- Quiet hours use school time, support crossing midnight and skip alerts rather than accumulating them for later. Equal quiet-hour start and end means quiet all day.
- Choose sound and vibration, vibration only, or silent. Android channel settings provide custom tones, vibration and lock-screen visibility. Channel preferences and Do Not Disturb remain under the user's control.
- Choose a snooze duration of 1, 5, 10, 15 or 30 minutes. Notifications open the timetable and offer Snooze and Settings actions.
- A preview shows the next four reminder times before saving. A test notification checks the selected alert style without enabling lesson scheduling.

## Scheduling and access

Only the next reminder alarm is registered. Events at the same instant share a single notification; large groups show twelve details and link to the complete timetable. A daily maintenance alarm rolls the bounded plan forward, with expiry as an earlier boundary. Plans are cached by timetable file version, account, school date/time zone, lease and settings. Planning and preview run outside UI interaction work; timetable navigation does not invoke reminder planning.

Boot, package replacement, clock/time-zone changes, exact-alarm permission grants, app resume and incoming timetable data recalculate the alarm. Delivery rechecks the current account, timetable grant, lease, settings and event fingerprint. A changed/cancelled lesson, different account, revoked access, expired lease, disabled reminders or quiet hours cannot deliver an old scheduled alert. Logout clears reminder preferences and cancels alerts. Duplicate delivery is suppressed, and alerts more than five minutes late are skipped. Snoozed notifications display lesson times rather than repeating outdated advance-countdown wording.

The schedule follows the latest timetable received by the app. Changes made by the school cannot reach an offline phone until it synchronizes again. Parent accounts continue to follow their existing data grants; this change does not grant access to school-wide timetables.

Android notification permission is required. Precise reminders request user-controlled **Alarms & reminders** special access using `SCHEDULE_EXACT_ALARM`, with an inexact fallback when unavailable. Android battery/idle restrictions, Do Not Disturb, disabled channels and force-stop still govern delivery; precise timing is not an unconditional guarantee. No settings or permissions are silently enabled. The existing persistent timetable notification remains silent.

Official platform references: [alarm scheduling](https://developer.android.com/develop/background-work/services/alarms), [notification permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission), [notification channels](https://developer.android.com/develop/ui/compose/notifications/channels).

## Verification on 7 October 2026

- `:app:testDebugUnitTest`, `:app:assembleDebug` and `:app:assembleDebugAndroidTest` succeeded; 31 unit tests passed, including 11 reminder-planning cases.
- 13 Pixel instrumentation checks passed: 5 reminder checks plus the 8 existing cache, compact card/widget and encrypted-store checks. Reminder cases cover same-time grouping, duplicate suppression, snooze, quiet hours, disabling, account changes, changed lessons, very late events and revoked access.
- An actual AlarmManager alarm delivered a synthetic fixture payload to a registered test receiver, which exercised the production reminder handler and posted the notification. This checks Android alarm delivery and notification publication; it is not an all-day Doze or force-stop guarantee. Tests use a separate encrypted fixture and restore reminder preferences; the installed school cache is not replaced.
- Planning 1,360 events from the installed timetable took 104 ms. Existing cache checks measured 800 ms for cold validation, 14 ms for twenty warm reads, and 86 ms for publishing all surfaces. Timings are device observations, not service-level guarantees.
- Version code 10 / `1.8-lesson-reminders-preview` was installed with an in-place update on the connected Pixel. Native settings opened; class multi-selection and None affected the preview as expected. The accurate-timing permission was left for the user to grant, and lesson reminders remain disabled until settings are saved with Enable on.
- The Pixel disconnected during the remaining optional UI checks after installation and instrumentation had succeeded. No reboot, network toggle or full-day real-school reminder cycle was performed.

APK output: `output/android-offline/trinity-school-lesson-reminders-preview.apk`.
