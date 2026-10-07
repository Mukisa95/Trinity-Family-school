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
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) edit.putBoolean("card", value.optBoolean("notificationCard", prefs(context).getBoolean("card", true)));
        else edit.putBoolean(prefix(widgetId) + "progress", value.optBoolean("progress", true));
        edit.apply(); refresh(context, store);
    }
    static void deleteWidget(Context context, int id) {
        SharedPreferences.Editor edit = prefs(context).edit(); for (String field : new String[]{"table", "class", "stream", "account", "progress"}) edit.remove(prefix(id) + field); edit.apply();
    }
    static PendingIntent configure(Context context, int widgetId) {
        return PendingIntent.getActivity(context, 8000 + widgetId, new Intent(context, TimetableSettingsActivity.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
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
            TimetableSchedule.Frame frame = TimetableSchedule.feed(envelope.getJSONObject("snapshot").getJSONObject("datasets"), ZonedDateTime.now(ZoneId.of(session.optString("timeZone", "Africa/Kampala"))));
            NotificationManager notifications = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            notifications.createNotificationChannel(new NotificationChannel("timetable", "School timetables", NotificationManager.IMPORTANCE_LOW));
            if (!frame.profiles.isEmpty() && prefs(context).getBoolean("card", true) && (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)) notifications.notify(CARD_ID, card(context, new JSONObject(), frame, 0));
            else notifications.cancel(CARD_ID);
            long next = frame.boundary; boolean progress = frame.active && prefs(context).getBoolean("card", true);
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            for (Class<?> provider : new Class<?>[]{TimetableWidget.class, TimetableProgressWidget.class}) for (int id : manager.getAppWidgetIds(new ComponentName(context, provider))) {
                boolean bar = prefs(context).getBoolean(prefix(id) + "progress", provider == TimetableProgressWidget.class);
                renderWidget(context, manager, id, frame, bar); progress |= bar && frame.active;
            }
            long millis = System.currentTimeMillis(); next = Math.min(next, OfflineStore.timestamp(session.optString("expiresAt")));
            if (progress) next = Math.min(next, (millis / 60000 + 1) * 60000);
            ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, Math.max(millis + 1000, next), action(context, "UPDATE", 72));
        } catch (Exception error) { ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(CARD_ID); renderEmptyWidgets(context); }
    }
    static Notification card(Context context, JSONObject ignored, TimetableSchedule.Frame frame, int contentId) {
        NotificationCompat.Builder card = new NotificationCompat.Builder(context, "timetable").setSmallIcon(R.drawable.school_icon).setContentTitle("School timetables")
            .setContentText(frame.title + " · " + frame.time).setStyle(new NotificationCompat.BigTextStyle().bigText(frame.agenda))
            .setContentIntent(open(context, contentId)).setOngoing(true).setOnlyAlertOnce(true).setSilent(true)
            .setDeleteIntent(action(context, "HIDE", 73)).setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(0, "Open timetables", open(context, contentId)).addAction(0, "Settings", configure(context, AppWidgetManager.INVALID_APPWIDGET_ID));
        if (frame.active) card.setProgress(100, frame.progress, false).setWhen(frame.end).setUsesChronometer(true).setChronometerCountDown(true);
        else card.setShowWhen(false);
        return card.build();
    }
    static void renderWidget(Context context, AppWidgetManager manager, int id, TimetableSchedule.Frame frame, boolean progress) {
        RemoteViews views;
        if (Build.VERSION.SDK_INT >= 31) {
            Map<SizeF, RemoteViews> sizes = new LinkedHashMap<>();
            sizes.put(new SizeF(110, 160), widgetView(context, id, new JSONObject(), frame, progress, R.layout.timetable_widget_compact));
            sizes.put(new SizeF(250, 170), widgetView(context, id, new JSONObject(), frame, progress, R.layout.timetable_widget));
            sizes.put(new SizeF(300, 280), widgetView(context, id, new JSONObject(), frame, progress, R.layout.timetable_widget_large));
            views = new RemoteViews(sizes);
        } else {
            android.os.Bundle options = manager.getAppWidgetOptions(id); int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 170), width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
            views = widgetView(context, id, new JSONObject(), frame, progress, height >= 280 && width >= 300 ? R.layout.timetable_widget_large : height >= 170 && width >= 250 ? R.layout.timetable_widget : R.layout.timetable_widget_compact);
        }
        manager.updateAppWidget(id, views);
        if (Build.VERSION.SDK_INT < 31) manager.notifyAppWidgetViewDataChanged(id, R.id.feed_list);
    }
    static RemoteViews profileView(Context context, TimetableSchedule.Frame frame, boolean progress) {
        RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.timetable_feed_row);
        row.setTextViewText(R.id.class_label, frame.tableName); row.setTextViewText(R.id.current_lesson, frame.title);
        row.setTextViewText(R.id.lesson_time, frame.time + (frame.active ? " · " + frame.remainingMinutes + " min left" : ""));
        row.setProgressBar(R.id.lesson_progress, 100, frame.progress, false); row.setViewVisibility(R.id.lesson_progress, progress && frame.active ? View.VISIBLE : View.GONE);
        row.setTextViewText(R.id.lesson_agenda, frame.agenda); row.setTextViewText(R.id.next_lesson, frame.next);
        return row;
    }
    static RemoteViews widgetView(Context context, int id, JSONObject ignored, TimetableSchedule.Frame frame, boolean progress, int layout) {
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        views.setOnClickPendingIntent(R.id.widget_title, open(context, id)); views.setOnClickPendingIntent(R.id.widget_settings, configure(context, id));
        views.setTextViewText(R.id.feed_empty, "Open Trinity School to load timetables"); views.setEmptyView(R.id.feed_list, R.id.feed_empty);
        if (Build.VERSION.SDK_INT >= 31) {
            RemoteViews.RemoteCollectionItems.Builder rows = new RemoteViews.RemoteCollectionItems.Builder().setHasStableIds(true).setViewTypeCount(1);
            for (int i = 0; i < frame.profiles.size(); i++) rows.addItem(i, profileView(context, frame.profiles.get(i), progress));
            views.setRemoteAdapter(R.id.feed_list, rows.build());
        } else {
            Intent service = new Intent(context, TimetableFeedService.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id).putExtra("progress", progress);
            service.setData(android.net.Uri.parse("trinity-widget://feed/" + id + "/" + progress)); views.setRemoteAdapter(R.id.feed_list, service);
        }
        return views;
    }
    private static void renderEmptyWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> provider : new Class<?>[]{TimetableWidget.class, TimetableProgressWidget.class}) for (int id : manager.getAppWidgetIds(new ComponentName(context, provider))) renderWidget(context, manager, id, new TimetableSchedule.Frame(), false);
    }
}
