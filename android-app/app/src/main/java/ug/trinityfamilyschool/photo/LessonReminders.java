package ug.trinityfamilyschool.photo;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import org.json.*;
import java.time.*;
import java.util.*;

/** One next reminder alarm, with same-time lessons combined. Independent of card navigation. */
final class LessonReminders {
    static final String FIRE = "ug.trinity.lessons.FIRE", SNOOZE = "ug.trinity.lessons.SNOOZE", SNOOZED = "ug.trinity.lessons.SNOOZED";
    static final int ALERT_ID = 7240, TEST_ID = 7242;
    private static String planKey = "";
    private static List<LessonReminderPlan.Event> cached = Collections.emptyList();
    static SharedPreferences prefs(Context context) { return context.getSharedPreferences("lesson-reminders", Context.MODE_PRIVATE); }
    static LessonReminderPlan.Settings settings(Context context, String account) {
        try { return new LessonReminderPlan.Settings(account.equals(prefs(context).getString("owner", "")) ? new JSONObject(prefs(context).getString("settings", "{}")) : null); }
        catch (Exception ignored) { return new LessonReminderPlan.Settings(null); }
    }
    static boolean notificationsAllowed(Context context) {
        return (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
            && ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).areNotificationsEnabled();
    }
    static boolean exactAllowed(Context context) { return Build.VERSION.SDK_INT < 31 || ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).canScheduleExactAlarms(); }
    static JSONObject authorized(OfflineStore store) throws Exception {
        JSONObject envelope = store.timetableAvailable();
        return envelope != null && envelope.getJSONObject("session").getJSONObject("grants").optBoolean("timetable") ? envelope : null;
    }
    static synchronized void save(Context context, OfflineStore store, String account, LessonReminderPlan.Settings value) throws Exception {
        JSONObject envelope = authorized(store);
        if (envelope == null || !account.equals(envelope.getJSONObject("session").optString("accountId"))) throw new IllegalStateException("Open Trinity School and verify your account before changing reminders.");
        prefs(context).edit().putString("owner", account).putString("settings", value.json().toString()).commit();
        cancel(context, SNOOZED, 7241); cancelNotifications(context); planKey = "";
        refresh(context, store);
    }
    private static Intent intent(Context context, String action) { return new Intent(context, LessonReminderReceiver.class).setAction(action).addFlags(Intent.FLAG_RECEIVER_FOREGROUND); }
    private static PendingIntent pending(Context context, Intent intent, int id) { return PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE); }
    private static void cancel(Context context, String action, int id) { ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).cancel(pending(context, intent(context, action), id)); }
    private static void cancelNotifications(Context context) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        manager.cancel("lesson-reminder", ALERT_ID); manager.cancel("lesson-reminder", TEST_ID);
    }
    static synchronized void clear(Context context) {
        cancel(context, FIRE, 7240); cancel(context, SNOOZED, 7241); cancelNotifications(context);
        prefs(context).edit().clear().apply(); cached = Collections.emptyList(); planKey = "";
    }
    private static void stop(Context context) {
        cancel(context, FIRE, 7240); cancel(context, SNOOZED, 7241); cancelNotifications(context);
        prefs(context).edit().remove("nextAt").remove("nextToken").apply();
    }
    private static ZoneId zone(JSONObject envelope) { return ZoneId.of(envelope.optJSONObject("session").optString("timeZone", "Africa/Kampala")); }
    private static List<LessonReminderPlan.Event> plan(Context context, OfflineStore store, JSONObject envelope, LessonReminderPlan.Settings settings, long now) throws Exception {
        ZonedDateTime time = Instant.ofEpochMilli(now).atZone(zone(envelope));
        long expiry = OfflineStore.timestamp(envelope.getJSONObject("session").optString("expiresAt")) - 1;
        String key = store.sourceFile().getAbsolutePath() + "|" + store.sourceFile().lastModified() + "|" + store.sourceFile().length() + "|" + envelope.getJSONObject("session").optString("accountId") + "|" + expiry + "|" + time.toLocalDate() + "|" + time.getZone() + "|" + settings.json();
        if (!key.equals(planKey)) {
            cached = LessonReminderPlan.events(envelope.getJSONObject("snapshot").getJSONObject("datasets"), settings, time.toLocalDate().atStartOfDay(time.getZone()), expiry);
            planKey = key;
        }
        return cached;
    }
    static synchronized List<LessonReminderPlan.Event> upcoming(Context context, OfflineStore store) throws Exception {
        JSONObject envelope = authorized(store); if (envelope == null) return Collections.emptyList();
        String account = envelope.getJSONObject("session").getString("accountId"); long now = System.currentTimeMillis();
        List<LessonReminderPlan.Event> result = new ArrayList<>();
        for (LessonReminderPlan.Event event : plan(context, store, envelope, settings(context, account), now)) if (event.at > now) result.add(event);
        return result;
    }
    static synchronized void refresh(Context context, OfflineStore store) {
        try {
            JSONObject envelope = authorized(store);
            if (envelope == null) { stop(context); return; }
            String account = envelope.getJSONObject("session").getString("accountId");
            String owner = prefs(context).getString("owner", "");
            if (!owner.isEmpty() && !owner.equals(account)) { clear(context); return; }
            LessonReminderPlan.Settings settings = settings(context, account);
            if (!settings.enabled || !notificationsAllowed(context)) { stop(context); return; }
            channels(context); NotificationChannel channel = ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).getNotificationChannel(channel(settings.alert));
            if (channel.getImportance() == NotificationManager.IMPORTANCE_NONE) { stop(context); return; }
            long now = System.currentTimeMillis(); List<LessonReminderPlan.Event> events = plan(context, store, envelope, settings, now);
            long at = 0; for (LessonReminderPlan.Event event : events) if (event.at > now) { at = event.at; break; }
            // Recheck tomorrow even when filters exclude every lesson this week, or the lease ends first.
            long maintenance = Instant.ofEpochMilli(now).atZone(zone(envelope)).toLocalDate().plusDays(1).atStartOfDay(zone(envelope)).toInstant().toEpochMilli();
            maintenance = Math.min(maintenance, OfflineStore.timestamp(envelope.getJSONObject("session").optString("expiresAt")));
            String token = at == 0 || maintenance < at ? "maintenance" : LessonReminderPlan.token(LessonReminderPlan.at(events, at));
            if ("maintenance".equals(token)) at = maintenance;
            boolean exact = exactAllowed(context) && !"maintenance".equals(token);
            if (at == prefs(context).getLong("nextAt", 0) && token.equals(prefs(context).getString("nextToken", "")) && exact == prefs(context).getBoolean("nextExact", false)) return;
            Intent fire = intent(context, FIRE).putExtra("account", account).putExtra("at", at).putExtra("token", token);
            schedule(context, Math.max(now + 1000, at), pending(context, fire, 7240), exact);
            prefs(context).edit().putLong("nextAt", at).putString("nextToken", token).putBoolean("nextExact", exact).apply();
        } catch (Exception error) { stop(context); }
    }
    static void schedule(Context context, long at, PendingIntent pending, boolean exact) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        try { if (exact) { alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending); return; } } catch (SecurityException ignored) { }
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
    }
    /** Called after boot/package replacement: persisted metadata is not proof an alarm still exists. */
    static synchronized void reschedule(Context context, OfflineStore store) { prefs(context).edit().remove("nextAt").remove("nextToken").apply(); planKey = ""; refresh(context, store); }
    static synchronized void receive(Context context, OfflineStore store, Intent input) throws Exception {
        String action = input.getAction();
        if (!FIRE.equals(action) && !SNOOZE.equals(action) && !SNOOZED.equals(action)) { reschedule(context, store); return; }
        long now = System.currentTimeMillis(), at = input.getLongExtra("at", 0);
        String token = input.getStringExtra("token"), account = input.getStringExtra("account");
        JSONObject envelope = authorized(store);
        if (envelope == null || account == null || !account.equals(envelope.getJSONObject("session").optString("accountId"))) { reschedule(context, store); return; }
        LessonReminderPlan.Settings settings = settings(context, account);
        if (FIRE.equals(action)) prefs(context).edit().remove("nextAt").remove("nextToken").apply();
        if (!settings.enabled || !notificationsAllowed(context)) { stop(context); return; }
        if ("maintenance".equals(token)) { refresh(context, store); return; }
        // Rebuild at the original event time. Current cache/settings must still identify the same lessons.
        List<LessonReminderPlan.Event> events = LessonReminderPlan.at(LessonReminderPlan.events(envelope.getJSONObject("snapshot").getJSONObject("datasets"), settings,
            Instant.ofEpochMilli(at).atZone(zone(envelope)), OfflineStore.timestamp(envelope.getJSONObject("session").optString("expiresAt"))-1), at);
        boolean valid = !events.isEmpty() && LessonReminderPlan.token(events).equals(token);
        if (valid && SNOOZE.equals(action)) {
            long snoozeAt = now + settings.snooze * 60_000L;
            if (snoozeAt < OfflineStore.timestamp(envelope.getJSONObject("session").optString("expiresAt"))) {
                schedule(context, snoozeAt, pending(context, intent(context, SNOOZED).putExtra("account", account).putExtra("at", at).putExtra("token", token).putExtra("snoozeAt", snoozeAt), 7241), exactAllowed(context));
                ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel("lesson-reminder", ALERT_ID);
            }
        } else if (valid && !settings.quietAt(Instant.ofEpochMilli(now).atZone(zone(envelope)))) {
            long expected = SNOOZED.equals(action) ? input.getLongExtra("snoozeAt", 0) : at;
            String delivery = token + "|" + expected;
            if (now >= expected && now - expected <= LessonReminderPlan.LATE_LIMIT && !delivery.equals(prefs(context).getString("delivered", ""))) {
                post(context, settings, account, events, at, token, SNOOZED.equals(action), zone(envelope));
                prefs(context).edit().putString("delivered", delivery).commit();
            }
        }
        refresh(context, store);
    }
    static String channel(String alert) { return "lesson-reminders-" + alert; }
    static void channels(Context context) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        for (String mode : new String[]{"sound", "vibrate", "silent"}) {
            NotificationChannel channel = new NotificationChannel(channel(mode), "Lesson reminders · " + (mode.equals("sound") ? "Sound & vibration" : mode.equals("vibrate") ? "Vibration" : "Silent"), mode.equals("silent") ? NotificationManager.IMPORTANCE_LOW : NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Lesson start, end and advance reminders you choose in Trinity School."); channel.enableVibration(!mode.equals("silent"));
            channel.setSound(mode.equals("sound") ? android.provider.Settings.System.DEFAULT_NOTIFICATION_URI : null, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PRIVATE); manager.createNotificationChannel(channel);
        }
    }
    private static void post(Context context, LessonReminderPlan.Settings settings, String account, List<LessonReminderPlan.Event> events, long at, String token, boolean snoozed, ZoneId zone) {
        channels(context); StringBuilder lines = new StringBuilder();
        // Event times were already resolved in the school's zone; display it explicitly.
        for (int i = 0; i < Math.min(12, events.size()); i++) {
            LessonReminderPlan.Event event = events.get(i); if (i > 0) lines.append('\n');
            lines.append(snoozed ? event.classLabel + " · " + event.subject : event.line()).append("\n").append(event.tableName).append(" · ").append(Instant.ofEpochMilli(event.start).atZone(zone).toLocalTime()).append("–").append(Instant.ofEpochMilli(event.end).atZone(zone).toLocalTime()).append(" ").append(zone.getId());
            if (!event.teacher.isEmpty()) lines.append(" · ").append(event.teacher);
        }
        if (events.size() > 12) lines.append("\n+").append(events.size()-12).append(" more lessons. Open timetable to view all.");
        Intent open = new Intent(context, MainActivity.class).putExtra("onlineRoute", PhotoPolicy.ORIGIN + "/timetable");
        PendingIntent tap = PendingIntent.getActivity(context, 7240, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent options = PendingIntent.getActivity(context, 7243, new Intent(context, LessonReminderSettingsActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String title = snoozed ? "Snoozed lesson reminder" : events.size() == 1 ? "Lesson reminder" : events.size() + " lesson reminders";
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, channel(settings.alert)).setSmallIcon(R.drawable.school_icon).setContentTitle(title)
            .setContentText(snoozed ? events.get(0).classLabel + " · " + events.get(0).subject : events.get(0).line()).setStyle(new NotificationCompat.BigTextStyle().bigText(lines.toString())).setContentIntent(tap)
            .setCategory(NotificationCompat.CATEGORY_REMINDER).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setAutoCancel(true).setTimeoutAfter(30 * 60_000L)
            .addAction(0, "Snooze " + settings.snooze + " min", pending(context, intent(context, SNOOZE).putExtra("account", account).putExtra("at", at).putExtra("token", token), 7245))
            .addAction(0, "Settings", options);
        ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).notify("lesson-reminder", ALERT_ID, notification.build());
    }
    static void test(Context context, LessonReminderPlan.Settings settings) {
        channels(context);
        Notification notification = new NotificationCompat.Builder(context, channel(settings.alert)).setSmallIcon(R.drawable.school_icon).setContentTitle("Test lesson reminder")
            .setContentText("Your selected alert style is working. This is a test, not a scheduled lesson.").setAutoCancel(true).setTimeoutAfter(60_000L)
            .setCategory(NotificationCompat.CATEGORY_REMINDER).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build();
        ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).notify("lesson-reminder", TEST_ID, notification);
    }
}
