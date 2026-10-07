package ug.trinityfamilyschool.photo;
import android.Manifest;
import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import org.json.*;
import java.time.*;
import java.util.*;

final class TimetableSurfaces {
    static final int CARD_ID = 7201;
    static SharedPreferences prefs(Context context) { return context.getSharedPreferences("timetable-selection", Context.MODE_PRIVATE); }
    static String prefix(int id) { return id == AppWidgetManager.INVALID_APPWIDGET_ID ? "" : "widget-" + id + "."; }
    static JSONObject selection(Context context, int id) throws JSONException {
        return new JSONObject().put("progress", prefs(context).getBoolean(prefix(id) + "progress", true)).put("notificationCard", prefs(context).getBoolean("card", true));
    }
    static void select(Context context, OfflineStore store, JSONObject value, int widgetId) throws Exception {
        JSONObject envelope = store.available();
        if (envelope == null || !envelope.getJSONObject("session").getJSONObject("grants").optBoolean("timetable")) throw new IllegalStateException("Open Trinity School to load your timetables.");
        SharedPreferences.Editor edit = prefs(context).edit();
        edit.putBoolean(prefix(widgetId) + "progress", value.optBoolean("progress", true));
        edit.apply(); refresh(context, store);
    }
    static void deleteWidget(Context context, int id) {
        SharedPreferences.Editor edit = prefs(context).edit(); for (String key : prefs(context).getAll().keySet()) if (key.startsWith(prefix(id))) edit.remove(key); edit.apply();
    }
    private static PendingIntent open(Context context, int id) {
        return PendingIntent.getActivity(context, 9000 + id, new Intent(context, MainActivity.class).putExtra("offlineRoute", OfflinePolicy.LOCAL_ORIGIN + OfflinePolicy.LOCAL_PATH + "?page=timetable"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private static PendingIntent action(Context context, String action, int code) {
        return PendingIntent.getBroadcast(context, code, new Intent(context, TimetableReceiver.class).setAction("ug.trinity.timetable." + action), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static void hideCard(Context context) { prefs(context).edit().putBoolean("card", false).apply(); ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(CARD_ID); }
    static void clear(Context context) {
        prefs(context).edit().clear().apply();
        ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).cancel(action(context, "UPDATE", 72));
        ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(CARD_ID);
        renderEmptyWidgets(context);
    }
    static void refresh(Context context, OfflineStore store) {
        try {
            JSONObject envelope = store.available();
            if (envelope == null || !envelope.getJSONObject("session").getJSONObject("grants").optBoolean("timetable")) { clear(context); return; }
            JSONObject session = envelope.getJSONObject("session");
            String account = session.getString("accountId");
            if (!prefs(context).getString("account", account).equals(account)) clear(context);
            prefs(context).edit().putString("account", account).apply();
            ZonedDateTime now = ZonedDateTime.now(ZoneId.of(session.optString("timeZone", "Africa/Kampala")));
            TimetableSchedule.Frame frame = feed(context, envelope, AppWidgetManager.INVALID_APPWIDGET_ID, now);
            NotificationManager notifications = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            notifications.createNotificationChannel(new NotificationChannel("timetable", "School timetables", NotificationManager.IMPORTANCE_LOW));
            if (!frame.profiles.isEmpty() && prefs(context).getBoolean("card", true) && (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)) notifications.notify(CARD_ID, card(context, new JSONObject(), frame, 0));
            else notifications.cancel(CARD_ID);
            long next = frame.boundary; boolean progress = frame.active && prefs(context).getBoolean("card", true);
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            for (Class<?> provider : new Class<?>[]{TimetableWidget.class, TimetableProgressWidget.class}) for (int id : manager.getAppWidgetIds(new ComponentName(context, provider))) {
                boolean bar = prefs(context).getBoolean(prefix(id) + "progress", provider == TimetableProgressWidget.class);
                TimetableSchedule.Frame widgetFrame = feed(context, envelope, id, now);
                renderWidget(context, manager, id, widgetFrame, bar); progress |= bar && widgetFrame.active;
            }
            long millis = System.currentTimeMillis(); next = Math.min(next, OfflineStore.timestamp(session.optString("expiresAt")));
            if (progress) next = Math.min(next, (millis / 60000 + 1) * 60000);
            ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, Math.max(millis + 1000, next), action(context, "UPDATE", 72));
        } catch (Exception error) { ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(CARD_ID); renderEmptyWidgets(context); }
    }
    static TimetableSchedule.Frame feed(Context context, JSONObject envelope, int scope, ZonedDateTime now) throws Exception {
        TimetableSchedule.Frame frame = TimetableSchedule.feed(envelope.getJSONObject("snapshot").getJSONObject("datasets"), now, TimetableInteractions.offsets(context, scope, now));
        frame.accountId = envelope.getJSONObject("session").optString("accountId");
        for (TimetableSchedule.Frame row : frame.profiles) row.accountId = frame.accountId;
        return frame;
    }
    private static Intent interaction(Context context, int scope, TimetableSchedule.Frame row, String operation, String pillId) {
        return new Intent(context, TimetableReceiver.class).setAction("ug.trinity.timetable.INTERACT")
            .putExtra("surfaceId", scope).putExtra("accountId", row.accountId).putExtra("profileId", row.profileId)
            .putExtra("periodId", row.periodId).putExtra("operation", operation).putExtra("pillId", pillId);
    }
    private static void click(Context context, RemoteViews view, int id, int scope, TimetableSchedule.Frame row, String operation, String pillId, boolean collection) {
        Intent intent = interaction(context, scope, row, operation, pillId);
        if (collection) view.setOnClickFillInIntent(id, intent);
        else {
            intent.setData(android.net.Uri.parse("trinity-timetable://action/" + scope + "/" + android.net.Uri.encode(row.accountId) + "/" + android.net.Uri.encode(row.profileId) + "/" + android.net.Uri.encode(row.periodId) + "/" + operation + "/" + android.net.Uri.encode(pillId)));
            view.setOnClickPendingIntent(id, PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
    }
    static Notification card(Context context, JSONObject ignored, TimetableSchedule.Frame frame, int contentId) {
        RemoteViews small = new RemoteViews(context.getPackageName(), R.layout.timetable_notification_small);
        small.setTextViewText(R.id.notification_title, "School timetables");
        StringBuilder summary = new StringBuilder();
        for (TimetableSchedule.Frame row : frame.profiles) { if (summary.length() > 0) summary.append(" · "); summary.append(row.shortLabel.isEmpty() ? row.title : row.shortLabel).append(" ").append(row.time); }
        small.setTextViewText(R.id.notification_summary, summary.toString());
        RemoteViews big = new RemoteViews(context.getPackageName(), R.layout.timetable_notification);
        big.removeAllViews(R.id.notification_profiles);
        boolean progress = prefs(context).getBoolean("progress", true);
        for (TimetableSchedule.Frame row : frame.profiles) big.addView(R.id.notification_profiles, profileView(context, row, progress, AppWidgetManager.INVALID_APPWIDGET_ID, false, true));
        NotificationCompat.Builder card = new NotificationCompat.Builder(context, "timetable").setSmallIcon(R.drawable.school_icon).setContentTitle("School timetables")
            .setContentText(frame.title + " · " + frame.time).setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(small).setCustomBigContentView(big)
            .setContentIntent(open(context, contentId)).setOngoing(true).setOnlyAlertOnce(true).setSilent(true)
            .setDeleteIntent(action(context, "HIDE", 73)).setVisibility(NotificationCompat.VISIBILITY_PUBLIC).setShowWhen(false);
        return card.build();
    }
    static void renderWidget(Context context, AppWidgetManager manager, int id, TimetableSchedule.Frame frame, boolean progress) {
        RemoteViews views;
        if (Build.VERSION.SDK_INT >= 31) {
            Map<SizeF, RemoteViews> sizes = new LinkedHashMap<>();
            sizes.put(new SizeF(180, 120), widgetView(context, id, new JSONObject(), frame, progress, R.layout.timetable_widget_compact));
            sizes.put(new SizeF(250, 120), widgetView(context, id, new JSONObject(), frame, progress, R.layout.timetable_widget));
            sizes.put(new SizeF(250, 250), widgetView(context, id, new JSONObject(), frame, progress, R.layout.timetable_widget));
            sizes.put(new SizeF(300, 330), widgetView(context, id, new JSONObject(), frame, progress, R.layout.timetable_widget_large));
            views = new RemoteViews(sizes);
        } else {
            android.os.Bundle options = manager.getAppWidgetOptions(id); int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 250), width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
            views = widgetView(context, id, new JSONObject(), frame, progress, height >= 280 && width >= 300 ? R.layout.timetable_widget_large : width >= 250 ? R.layout.timetable_widget : R.layout.timetable_widget_compact);
        }
        manager.updateAppWidget(id, views);
        if (Build.VERSION.SDK_INT < 31) manager.notifyAppWidgetViewDataChanged(id, R.id.feed_list);
    }
    static RemoteViews profileView(Context context, TimetableSchedule.Frame frame, boolean progress) { return profileView(context, frame, progress, 987600, false, false); }
    static RemoteViews profileView(Context context, TimetableSchedule.Frame frame, boolean progress, int scope, boolean compact, boolean notification) {
        RemoteViews row = new RemoteViews(context.getPackageName(), compact ? R.layout.timetable_feed_row_compact : R.layout.timetable_feed_row);
        row.removeAllViews(R.id.pills_container);
        row.setViewVisibility(R.id.pills_container, View.VISIBLE); row.setViewVisibility(R.id.pill_details, View.GONE);
        row.setViewVisibility(R.id.period_badge, View.VISIBLE); row.setViewVisibility(R.id.period_countdown, View.GONE);
        row.setContentDescription(R.id.current_lesson, frame.tableName + " · " + frame.title);
        row.setTextViewText(R.id.class_label, frame.tableName); row.setTextViewText(R.id.current_lesson, frame.shortLabel.isEmpty() ? frame.title : frame.shortLabel);
        row.setTextViewText(R.id.lesson_time, frame.time); row.setTextViewText(R.id.lesson_agenda, frame.agenda);
        row.setTextViewText(R.id.period_badge, frame.hasPeriod ? frame.countdownEnd > 0 ? "Upcoming" : "Ended" : "");
        row.setInt(R.id.period_badge, "setBackgroundResource", frame.countdownEnd > 0 ? R.drawable.upcoming_background : R.drawable.ended_background);
        row.setTextColor(R.id.period_badge, android.graphics.Color.parseColor(frame.countdownEnd > 0 ? "#B45309" : "#6B7280"));
        if (!frame.hasPeriod) row.setViewVisibility(R.id.period_badge, View.GONE);
        if (frame.countdownEnd > System.currentTimeMillis()) {
            row.setInt(R.id.period_countdown, "setBackgroundResource", frame.active ? R.drawable.badge_background : R.drawable.upcoming_background);
            row.setTextColor(R.id.period_countdown, android.graphics.Color.parseColor(frame.active ? "#047857" : "#B45309"));
            row.setViewVisibility(R.id.period_badge, View.GONE); row.setViewVisibility(R.id.period_countdown, View.VISIBLE);
            row.setChronometer(R.id.period_countdown, android.os.SystemClock.elapsedRealtime() + frame.countdownEnd - System.currentTimeMillis(), frame.active ? "%s left" : "%s to start", true);
            row.setChronometerCountDown(R.id.period_countdown, true);
        }
        row.setProgressBar(R.id.lesson_progress, 100, frame.progress, false); row.setViewVisibility(R.id.lesson_progress, progress && (frame.hasPeriod || frame.active) ? View.VISIBLE : View.GONE);
        row.setTextViewText(R.id.next_lesson, frame.next); row.setViewVisibility(R.id.next_lesson, View.GONE);
        row.setBoolean(R.id.previous_period, "setEnabled", frame.hasPrevious); row.setBoolean(R.id.next_period, "setEnabled", frame.hasNext);
        row.setFloat(R.id.previous_period, "setAlpha", frame.hasPrevious ? 1f : 0.3f); row.setFloat(R.id.next_period, "setAlpha", frame.hasNext ? 1f : 0.3f);
        row.setViewVisibility(R.id.live_reset, frame.live ? View.GONE : View.VISIBLE);
        click(context, row, R.id.previous_period, scope, frame, "PREVIOUS", "", !notification);
        click(context, row, R.id.next_period, scope, frame, "NEXT", "", !notification);
        click(context, row, R.id.live_reset, scope, frame, "LIVE", "", !notification);
        click(context, row, R.id.detail_close, scope, frame, "CLOSE", "", !notification);
        int[] backgrounds = {R.drawable.pill_0,R.drawable.pill_1,R.drawable.pill_2,R.drawable.pill_3,R.drawable.pill_4,R.drawable.pill_5,R.drawable.pill_6,R.drawable.pill_7};
        String[] colors = {"#15803D","#4F46E5","#B45309","#BE185D","#0F766E","#6D28D9","#C2410C","#0E7490"};
        // Short class/subject codes fit five across the dashboard-width card.
        int columns = notification ? Math.max(1, frame.pills.size()) : compact ? 2 : 5;
        RemoteViews line = null; TimetableSchedule.Pill selected = null;
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now(java.time.ZoneId.of(frame.timeZone));
        String detail = prefs(context).getString(TimetableInteractions.detailKey(scope, frame, now), "");
        for (int i = 0; i < frame.pills.size(); i++) {
            TimetableSchedule.Pill pill = frame.pills.get(i);
            if (i % columns == 0) { if (line != null) row.addView(R.id.pills_container, line); line = new RemoteViews(context.getPackageName(), R.layout.timetable_pill_line); line.removeAllViews(R.id.pill_line); }
            RemoteViews chip = new RemoteViews(context.getPackageName(), R.layout.timetable_pill);
            chip.setTextViewText(R.id.lesson_pill, pill.classCode + " · " + pill.subjectCode);
            chip.setInt(R.id.lesson_pill, "setBackgroundResource", backgrounds[pill.color % 8]); chip.setTextColor(R.id.lesson_pill, android.graphics.Color.parseColor(colors[pill.color % 8]));
            chip.setContentDescription(R.id.lesson_pill, pill.className + " · " + pill.subjectName + " · " + pill.time + " · " + pill.teacher);
            click(context, chip, R.id.lesson_pill, scope, frame, "DETAIL", pill.id, !notification);
            line.addView(R.id.pill_line, chip); if (pill.id.equals(detail)) selected = pill;
        }
        if (line != null) row.addView(R.id.pills_container, line);
        if (selected != null) {
            row.setViewVisibility(R.id.pills_container, View.GONE); row.setViewVisibility(R.id.pill_details, View.VISIBLE);
            row.setInt(R.id.pill_details, "setBackgroundResource", backgrounds[selected.color % 8]);
            row.setTextViewText(R.id.detail_subject, selected.classCode + " · " + selected.subjectName);
            row.setTextViewText(R.id.detail_teacher, selected.teacher.isEmpty() ? selected.className : selected.className + " · " + selected.teacher);
            row.setContentDescription(R.id.pill_details, selected.className + " · " + selected.subjectName + " · " + selected.time + " · " + selected.teacher);
        }
        return row;
    }
    static RemoteViews widgetView(Context context, int id, JSONObject ignored, TimetableSchedule.Frame frame, boolean progress, int layout) {
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        views.setOnClickPendingIntent(R.id.widget_title, open(context, id));
        views.setTextViewText(R.id.feed_empty, "Open Trinity School to load timetables"); views.setEmptyView(R.id.feed_list, R.id.feed_empty);
        Intent template = new Intent(context, TimetableReceiver.class).setAction("ug.trinity.timetable.INTERACT")
            .putExtra("surfaceId", id).putExtra("accountId", frame.accountId).setData(android.net.Uri.parse("trinity-timetable://widget/" + id + "/" + android.net.Uri.encode(frame.accountId)));
        views.setPendingIntentTemplate(R.id.feed_list, PendingIntent.getBroadcast(context, id, template, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE));
        if (Build.VERSION.SDK_INT >= 31) {
            RemoteViews.RemoteCollectionItems.Builder rows = new RemoteViews.RemoteCollectionItems.Builder().setHasStableIds(true).setViewTypeCount(2);
            for (int i = 0; i < frame.profiles.size(); i++) rows.addItem(i, profileView(context, frame.profiles.get(i), progress, id, layout == R.layout.timetable_widget_compact, false));
            views.setRemoteAdapter(R.id.feed_list, rows.build());
        } else {
            Intent service = new Intent(context, TimetableFeedService.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id).putExtra("progress", progress).putExtra("compact", layout == R.layout.timetable_widget_compact);
            service.setData(android.net.Uri.parse("trinity-widget://feed/" + id + "/" + progress + "/" + layout)); views.setRemoteAdapter(R.id.feed_list, service);
        }
        return views;
    }
    private static void renderEmptyWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> provider : new Class<?>[]{TimetableWidget.class, TimetableProgressWidget.class}) for (int id : manager.getAppWidgetIds(new ComponentName(context, provider))) renderWidget(context, manager, id, new TimetableSchedule.Frame(), false);
    }
}
