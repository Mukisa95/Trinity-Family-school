package ug.trinityfamilyschool.photo;

import android.content.Context;
import android.content.Intent;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.work.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.FileOutputStream;
import java.util.concurrent.TimeUnit;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class TimetableRefreshDeviceTest {
    private final Context context = ApplicationProvider.getApplicationContext();
    private void ready() throws Exception {
        assertNotNull("Sign in once to prepare the real offline timetable", new OfflineStore(context).timetableAvailable());
    }
    private void restored() { TimetableSurfaces.refresh(context, new OfflineStore(context)); }
    @Test public void lessonAndMinuteAlarmsHaveIndependentIdentitiesAndRecovery() throws Exception {
        ready(); long now = System.currentTimeMillis();
        try {
            TimetableRefresh.schedule(context, new TimetableRefreshPlan(now, now + 3600_000, now + 7200_000, true, true, true));
            assertNotEquals(TimetableRefresh.alarm(context, false), TimetableRefresh.alarm(context, true));
            assertEquals(now + 3600_000, TimetableSurfaces.prefs(context).getLong("nextBoundaryAt", 0));
            assertTrue(TimetableSurfaces.prefs(context).getLong("nextVisualAt", 0) < now + 60_001);
            assertEquals(LessonReminders.exactAllowed(context), TimetableSurfaces.prefs(context).getBoolean("boundaryExact", false));
            assertFalse(WorkManager.getInstance(context).getWorkInfosForUniqueWork(TimetableRefresh.RECOVERY).get(10, TimeUnit.SECONDS).isEmpty());
        } finally { restored(); }
    }
    @Test public void screenOffRetainsBoundaryButStopsVisualAlarm() throws Exception {
        ready(); long now = System.currentTimeMillis();
        try {
            TimetableRefresh.schedule(context, new TimetableRefreshPlan(now, now + 3600_000, now + 7200_000, true, true, false));
            assertEquals(now + 3600_000, TimetableSurfaces.prefs(context).getLong("nextBoundaryAt", 0));
            assertEquals(0, TimetableSurfaces.prefs(context).getLong("nextVisualAt", -1));
        } finally { restored(); }
    }
    @Test public void upcomingWidgetCountdownRefreshesWithProgressHidden() throws Exception {
        ready(); assertTrue(TimetableRefresh.interactive(context));
        android.appwidget.AppWidgetManager widgets = android.appwidget.AppWidgetManager.getInstance(context);
        java.util.Map<String, Boolean> previous = new java.util.HashMap<>();
        java.util.Set<String> present = new java.util.HashSet<>();
        android.content.SharedPreferences prefs = TimetableSurfaces.prefs(context);
        org.json.JSONObject envelope = new OfflineStore(context).timetableAvailable();
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now(java.time.ZoneId.of(envelope.getJSONObject("session").optString("timeZone", "Africa/Kampala")));
        boolean upcoming = TimetableSchedule.feed(envelope.getJSONObject("snapshot").getJSONObject("datasets"), now).profiles.stream().anyMatch(row -> !row.active && row.countdownEnd > System.currentTimeMillis());
        assertTrue("Run with an upcoming cached lesson", upcoming);
        try {
            java.util.List<String> keys = new java.util.ArrayList<>(); keys.add("progress");
            for (Class<?> provider : new Class<?>[]{TimetableWidget.class, TimetableProgressWidget.class})
                for (int id : widgets.getAppWidgetIds(new android.content.ComponentName(context, provider))) keys.add(TimetableSurfaces.prefix(id) + "progress");
            assertTrue("An actual launcher widget is required", keys.size() > 1);
            android.content.SharedPreferences.Editor edit = prefs.edit();
            for (String key : keys) { if (prefs.contains(key)) present.add(key); previous.put(key, prefs.getBoolean(key, true)); edit.putBoolean(key, false); }
            edit.commit(); restored();
            assertTrue("Countdown fallback runs even when progress bars are hidden", prefs.getLong("nextVisualAt", 0) > System.currentTimeMillis());
        } finally {
            android.content.SharedPreferences.Editor edit = prefs.edit();
            for (java.util.Map.Entry<String, Boolean> entry : previous.entrySet()) if (present.contains(entry.getKey())) edit.putBoolean(entry.getKey(), entry.getValue()); else edit.remove(entry.getKey());
            edit.commit(); restored();
        }
    }
    @Test public void transientReadFailureStillArmsRecoveryWithoutChangingChoices() throws Exception {
        ready(); OfflineStore broken = new OfflineStore(context, "timetable-refresh-test.enc");
        boolean progress = TimetableSurfaces.prefs(context).getBoolean("progress", true), card = TimetableSurfaces.prefs(context).getBoolean("card", true);
        java.util.Set<String> hidden = TimetableSurfaces.hidden(context, android.appwidget.AppWidgetManager.INVALID_APPWIDGET_ID);
        try {
            try (FileOutputStream file = new FileOutputStream(broken.sourceFile())) { file.write(new byte[]{1,2,3}); }
            TimetableSurfaces.refresh(context, broken);
            assertTrue(TimetableSurfaces.prefs(context).getBoolean("refreshRetry", false));
            assertTrue(TimetableSurfaces.prefs(context).getLong("nextBoundaryAt", 0) > System.currentTimeMillis());
            assertEquals(progress, TimetableSurfaces.prefs(context).getBoolean("progress", true));
            assertEquals(card, TimetableSurfaces.prefs(context).getBoolean("card", true));
            assertEquals(hidden, TimetableSurfaces.hidden(context, android.appwidget.AppWidgetManager.INVALID_APPWIDGET_ID));
        } finally { broken.clear(); restored(); }
    }
    @Test public void recoveryWorkerRepairsMissingAlarmWithoutOpeningApp() throws Exception {
        ready(); WorkManager work = WorkManager.getInstance(context); String name = "timetable-refresh-device-test";
        try {
            TimetableRefresh.cancel(context); long since = System.currentTimeMillis();
            OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(TimetableRefreshWorker.class).build();
            work.enqueueUniqueWork(name, ExistingWorkPolicy.REPLACE, request).getResult().get(10, TimeUnit.SECONDS);
            long deadline = android.os.SystemClock.elapsedRealtime() + 30_000;
            WorkInfo result;
            do { result = work.getWorkInfoById(request.getId()).get(5, TimeUnit.SECONDS);
                if (result != null && result.getState().isFinished()) break;
                Thread.sleep(100);
            } while (android.os.SystemClock.elapsedRealtime() < deadline);
            assertNotNull(result); assertEquals(WorkInfo.State.SUCCEEDED, result.getState());
            assertTrue(TimetableSurfaces.prefs(context).getLong("lastRefreshAt", 0) >= since);
            assertTrue(TimetableSurfaces.prefs(context).getLong("nextBoundaryAt", 0) > since);
        } finally { work.cancelUniqueWork(name); restored(); }
    }
    @Test public void systemRecoveryEventsResolveToInstalledTimetableReceiver() {
        // These broadcasts are system-protected; verify real resolution rather than spoofing delivery.
        for (String action : new String[]{Intent.ACTION_MY_PACKAGE_REPLACED, Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED, android.app.AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED}) {
            java.util.List<android.content.pm.ResolveInfo> receivers = context.getPackageManager().queryBroadcastReceivers(new Intent(action).setPackage(context.getPackageName()), 0);
            assertTrue(action, receivers.stream().anyMatch(info -> TimetableReceiver.class.getName().equals(info.activityInfo.name)));
        }
    }
}
