package ug.trinityfamilyschool.photo;

import android.app.*;
import android.appwidget.AppWidgetManager;
import android.content.*;
import android.os.*;
import androidx.core.content.ContextCompat;
import androidx.work.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** System alarms survive process death; periodic work repairs a broken alarm chain. */
final class TimetableRefresh {
    static final String RECOVERY = "timetable-refresh-recovery";
    private static final ExecutorService io = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean queued = new AtomicBoolean();
    private static Context app;

    static synchronized void start(Context context) {
        if (app != null) return;
        app = context.getApplicationContext();
        IntentFilter filter = new IntentFilter(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_SCREEN_OFF); filter.addAction(Intent.ACTION_USER_PRESENT); filter.addAction(Intent.ACTION_TIME_TICK);
        ContextCompat.registerReceiver(app, new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if (!active(context)) return;
                if (Intent.ACTION_TIME_TICK.equals(intent.getAction()) && (!interactive(context) || TimetableSurfaces.prefs(context).getLong("nextVisualAt", 0) == 0)) return;
                request(context);
            }
        }, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
        if (active(app)) request(app);
    }
    static boolean interactive(Context context) { return ((PowerManager)context.getSystemService(Context.POWER_SERVICE)).isInteractive(); }
    static boolean hasWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        return manager.getAppWidgetIds(new ComponentName(context, TimetableWidget.class)).length > 0
            || manager.getAppWidgetIds(new ComponentName(context, TimetableProgressWidget.class)).length > 0;
    }
    private static boolean active(Context context) {
        return TimetableSurfaces.prefs(context).contains("account") && (TimetableSurfaces.prefs(context).getBoolean("card", true) || hasWidgets(context));
    }
    static void request(Context context) {
        if (!queued.compareAndSet(false, true)) return;
        Context application = context.getApplicationContext();
        io.execute(() -> { try { TimetableSurfaces.refresh(application, new OfflineStore(application)); } finally { queued.set(false); } });
    }
    static PendingIntent alarm(Context context, boolean visual) {
        return PendingIntent.getBroadcast(context, visual ? 74 : 72,
            new Intent(context, TimetableReceiver.class).setAction(visual ? "ug.trinity.timetable.TICK" : "ug.trinity.timetable.UPDATE"),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private static void recovery(Context context) {
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(RECOVERY, ExistingPeriodicWorkPolicy.KEEP,
            new PeriodicWorkRequest.Builder(TimetableRefreshWorker.class, 15, TimeUnit.MINUTES).build());
    }
    static void schedule(Context context, TimetableRefreshPlan plan) {
        if (plan.boundaryAt == 0) { cancel(context); return; }
        recovery(context); // Independent of rendering and alarm delivery.
        AlarmManager alarms = (AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        boolean exact = LessonReminders.exactAllowed(context);
        try { if (exact) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, plan.boundaryAt, alarm(context, false));
            else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, plan.boundaryAt, alarm(context, false)); }
        catch (SecurityException revoked) { exact = false; alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, plan.boundaryAt, alarm(context, false)); }
        if (plan.visualAt > 0) {
            // Minute progress updates do not wake a sleeping phone or consume its idle-alarm quota.
            try { if (exact) alarms.setExact(AlarmManager.RTC, plan.visualAt, alarm(context, true)); else alarms.set(AlarmManager.RTC, plan.visualAt, alarm(context, true)); }
            catch (SecurityException revoked) { alarms.set(AlarmManager.RTC, plan.visualAt, alarm(context, true)); }
        } else alarms.cancel(alarm(context, true));
        TimetableSurfaces.prefs(context).edit().putLong("nextBoundaryAt", plan.boundaryAt).putLong("nextVisualAt", plan.visualAt)
            .putBoolean("boundaryExact", exact).putBoolean("refreshRetry", false).apply();
    }
    static void retry(Context context) {
        if (!active(context)) return;
        recovery(context);
        long at = System.currentTimeMillis() + 5 * 60_000;
        ((AlarmManager)context.getSystemService(Context.ALARM_SERVICE)).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarm(context, false));
        TimetableSurfaces.prefs(context).edit().putLong("nextBoundaryAt", at).putBoolean("refreshRetry", true).apply();
    }
    static void cancel(Context context) {
        AlarmManager alarms = (AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        alarms.cancel(alarm(context, false)); alarms.cancel(alarm(context, true));
        WorkManager.getInstance(context).cancelUniqueWork(RECOVERY);
        TimetableSurfaces.prefs(context).edit().remove("nextBoundaryAt").remove("nextVisualAt").remove("boundaryExact").remove("refreshRetry").apply();
    }
}
