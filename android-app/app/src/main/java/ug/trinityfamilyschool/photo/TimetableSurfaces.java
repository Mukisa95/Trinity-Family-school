package ug.trinityfamilyschool.photo;
import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.os.Build;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import org.json.*;
import java.time.*;
import java.util.*;

final class TimetableSurfaces {
    static boolean authorized(JSONObject envelope) {
        JSONObject grants=envelope.optJSONObject("session").optJSONObject("grants");
        return grants.optBoolean("timetable") || grants.optBoolean("events");
    }
    static final int CARD_ID = 7201;
    static SharedPreferences prefs(Context context) { return context.getSharedPreferences("timetable-selection", Context.MODE_PRIVATE); }
    static String prefix(int id) { return id == AppWidgetManager.INVALID_APPWIDGET_ID ? "" : "widget-" + id + "."; }
    static boolean showEvents(Context context,int id) { return prefs(context).getBoolean(prefix(id)+"events",prefs(context).getBoolean("events",false)); }
    static Set<String> trackedSubjects(Context context, int id) { return new HashSet<>(prefs(context).getStringSet(prefix(id) + "trackedSubjects", Collections.emptySet())); }
    static boolean tracking(Context context, int id) { return id != AppWidgetManager.INVALID_APPWIDGET_ID && prefs(context).getBoolean(prefix(id) + "tracking", false); }
    static boolean trackingWithTables(Context context, int id) { return prefs(context).getBoolean(prefix(id) + "trackingWithTables", true); }
    static List<String> rowOrder(Context context, int id) { return WidgetFeedOrder.read(prefs(context).getString(prefix(id) + "rowOrder", "[]")); }
    static Set<String> hidden(Context context, int id) {
        Set<String> global = prefs(context).getStringSet("hiddenTables", Collections.emptySet());
        return new HashSet<>(prefs(context).getStringSet(prefix(id) + "hiddenTables", global));
    }
    static JSONObject selection(Context context, int id) throws JSONException {
        return new JSONObject().put("progress", prefs(context).getBoolean(prefix(id) + "progress", true)).put("notificationCard", prefs(context).getBoolean("card", true));
    }
    static void select(Context context, OfflineStore store, JSONObject value, int widgetId) throws Exception {
        JSONObject envelope = store.timetableAvailable();
        if (envelope == null || !authorized(envelope)) throw new IllegalStateException("Open " + SchoolApp.NAME + " to load your timetables.");
        if (value.has("accountId") && !value.optString("accountId").equals(envelope.getJSONObject("session").optString("accountId"))) throw new IllegalStateException("Your account changed. Reopen timetable settings.");
        SharedPreferences.Editor edit = prefs(context).edit();
        String account = envelope.getJSONObject("session").getString("accountId");
        if (!prefs(context).getString("account", account).equals(account)) { clear(context); edit = prefs(context).edit(); }
        edit.putString("account", account);
        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            if (value.has("trackingWithTables")) edit.putBoolean(prefix(widgetId) + "trackingWithTables", value.optBoolean("trackingWithTables"));
            if (value.has("rowOrder")) edit.putString(prefix(widgetId) + "rowOrder", new JSONArray(WidgetFeedOrder.read(value.getJSONArray("rowOrder").toString())).toString());
        }
        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID && value.has("tracking")) {
            if (!envelope.getJSONObject("session").getJSONObject("grants").optBoolean("timetable")) throw new IllegalStateException("Timetable access is required to track subjects.");
            Set<String> selected = new HashSet<>(); JSONArray choices = value.optJSONArray("trackedSubjects");
            if (choices != null) for (int i = 0; i < choices.length(); i++) selected.add(choices.getString(i));
            if (value.optBoolean("tracking") && selected.isEmpty()) throw new IllegalStateException("Choose at least one subject to track.");
            edit.putBoolean(prefix(widgetId) + "tracking", value.optBoolean("tracking")).putStringSet(prefix(widgetId) + "trackedSubjects", selected);
        }
        if (value.has("progress")) edit.putBoolean(prefix(widgetId) + "progress", value.optBoolean("progress"));
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID && value.has("notificationCard")) edit.putBoolean("card", value.optBoolean("notificationCard"));
        if (value.has("hiddenTables")) { Set<String> hidden = new HashSet<>(); JSONArray ids = value.optJSONArray("hiddenTables"); if (ids != null) for (int i = 0; i < ids.length(); i++) hidden.add(ids.optString(i)); edit.putStringSet(prefix(widgetId) + "hiddenTables", hidden); }
        if (value.has("events")) edit.putBoolean(prefix(widgetId)+"events",value.optBoolean("events"));
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID && value.has("eventReminders")) edit.putBoolean("eventReminders",value.optBoolean("eventReminders"));
        edit.apply(); TimetableUpdates.refresh(context, store);
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
    static synchronized void hideCard(Context context) {
        prefs(context).edit().putBoolean("card", false).apply(); ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(CARD_ID);
        if (!TimetableRefresh.hasWidgets(context) && !prefs(context).getBoolean("eventReminders",false)) TimetableRefresh.cancel(context); else TimetableRefresh.request(context);
    }
    static synchronized void clear(Context context) {
        prefs(context).edit().clear().apply();
        TimetableRefresh.cancel(context);
        EventReminders.clear(context);
        ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(CARD_ID);
        renderEmptyWidgets(context);
    }
    static void refresh(Context context, OfflineStore store) {
        refresh(context, store, null);
    }
    static synchronized void refresh(Context context, OfflineStore store, Integer surfaceId) {
        try {
            JSONObject envelope = store.timetableAvailable();
            if (envelope == null || !authorized(envelope)) { clear(context); return; }
            JSONObject session = envelope.getJSONObject("session");
            String account = session.getString("accountId");
            if (!prefs(context).getString("account", account).equals(account)) clear(context);
            prefs(context).edit().putString("account", account).apply();
            ZonedDateTime now = ZonedDateTime.now(ZoneId.of(session.optString("timeZone", "Africa/Kampala")));
            TimetableSchedule.Frame frame = feed(context, envelope, AppWidgetManager.INVALID_APPWIDGET_ID, now);
            NotificationManager notifications = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            notifications.createNotificationChannel(new NotificationChannel("timetable", "Timetables & events", NotificationManager.IMPORTANCE_LOW));
            boolean cardVisible = !frame.profiles.isEmpty() && prefs(context).getBoolean("card", true) && LessonReminders.notificationsAllowed(context);
            long millis = System.currentTimeMillis();
            long next = frame.boundary; boolean progress = frame.active && cardVisible && prefs(context).getBoolean("progress", true);
            Map<Integer, TimetableSchedule.Frame> widgets = new LinkedHashMap<>(); Map<Integer, Boolean> bars = new HashMap<>();
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            for (Class<?> provider : new Class<?>[]{TimetableWidget.class, TimetableProgressWidget.class}) for (int id : manager.getAppWidgetIds(new ComponentName(context, provider))) {
                boolean bar = prefs(context).getBoolean(prefix(id) + "progress", provider == TimetableProgressWidget.class);
                TimetableSchedule.Frame widgetFrame = feed(context, envelope, id, now);
                next = Math.min(next, widgetFrame.boundary);
                widgets.put(id, widgetFrame); bars.put(id, bar);
                progress |= bar && widgetFrame.active;
                for (TimetableSchedule.Frame row : widgetFrame.profiles) progress |= row.trackedSubject.isEmpty() && row.countdownEnd > millis;
            }
            long expires = OfflineStore.timestamp(session.optString("expiresAt")); millis = System.currentTimeMillis();
            if (expires <= millis) { clear(context); return; }
            TimetableRefresh.schedule(context, new TimetableRefreshPlan(millis, next,
                expires, cardVisible || !widgets.isEmpty() || prefs(context).getBoolean("eventReminders", false), progress, TimetableRefresh.interactive(context)));
            // Arm recovery before publishing. One failed host must not stop the other displays.
            if (surfaceId == null || surfaceId == AppWidgetManager.INVALID_APPWIDGET_ID) try {
                if (cardVisible) notifications.notify(CARD_ID, card(context, new JSONObject(), frame, 0)); else notifications.cancel(CARD_ID);
            } catch (RuntimeException error) { android.util.Log.w("TrinityTimetable", "Notification refresh will retry", error); }
            for (Map.Entry<Integer, TimetableSchedule.Frame> widget : widgets.entrySet()) if (surfaceId == null || surfaceId.equals(widget.getKey())) try {
                renderWidget(context, manager, widget.getKey(), widget.getValue(), bars.get(widget.getKey()));
            } catch (RuntimeException error) { android.util.Log.w("TrinityTimetable", "Widget refresh will retry", error); }
            prefs(context).edit().putLong("lastRefreshAt", System.currentTimeMillis()).apply();
        } catch (Exception error) {
            android.util.Log.w("TrinityTimetable", "Timetable refresh will retry", error);
            try { ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(CARD_ID); renderEmptyWidgets(context); }
            finally { TimetableRefresh.retry(context); }
        }
    }
    static TimetableSchedule.Frame feed(Context context, JSONObject envelope, int scope, ZonedDateTime now) throws Exception {
        JSONObject session=envelope.getJSONObject("session");
        JSONObject datasets = envelope.getJSONObject("snapshot").getJSONObject("datasets");
        boolean track = tracking(context, scope) && session.getJSONObject("grants").optBoolean("timetable") && prefs(context).getString("account", session.optString("accountId")).equals(session.optString("accountId"));
        TimetableSchedule.Frame frame = TimetableSchedule.feed(datasets, now, TimetableInteractions.offsets(context, scope, now));
        TimetableVisibility.apply(frame, hidden(context, scope), now);
        if (track) {
            TimetableSchedule.Frame subjects = TrackedSubjects.feed(datasets, trackedSubjects(context, scope), now, true);
            if (trackingWithTables(context, scope)) {
                frame.profiles.addAll(subjects.profiles); frame.active |= subjects.active; frame.boundary = Math.min(frame.boundary, subjects.boundary);
            } else frame = subjects;
        }
        if (!session.getJSONObject("grants").optBoolean("timetable")) frame.profiles.clear();
        if (session.getJSONObject("grants").optBoolean("events")) {
            List<SchoolEventSchedule.Event> events=SchoolEventSchedule.events(envelope.getJSONObject("snapshot").getJSONObject("datasets"),now.getZone());
            long millis=now.toInstant().toEpochMilli();
            frame.boundary=SchoolEventSchedule.boundary(events,millis,frame.boundary);
            List<TimetableSchedule.Frame> spotlight=new ArrayList<>();
            for(SchoolEventSchedule.Event event:events) if(SchoolEventSchedule.visible(event,millis,showEvents(context,scope))) {
                TimetableSchedule.Frame row=SchoolEventSchedule.frame(event,now);
                if(millis>=event.spotlight) spotlight.add(row); else frame.profiles.add(row);
            }
            frame.profiles.addAll(0,spotlight);
        }
        frame.title=frame.profiles.size()+" schedules"; frame.time="Timetables & events";
        frame.accountId = envelope.getJSONObject("session").optString("accountId");
        for (TimetableSchedule.Frame row : frame.profiles) row.accountId = frame.accountId;
        if (scope != AppWidgetManager.INVALID_APPWIDGET_ID) WidgetFeedOrder.apply(frame, rowOrder(context, scope));
        return frame;
    }
    private static Intent interaction(Context context, int scope, TimetableSchedule.Frame row, String operation, String pillId) {
        return new Intent(context, TimetableReceiver.class).setAction("ug.trinity.timetable.INTERACT").addFlags(Intent.FLAG_RECEIVER_FOREGROUND)
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
        AppearancePalette palette = AppAppearance.palette(context);
        AppAppearance.background(small, R.id.mini_profiles, palette, R.drawable.widget_background, R.drawable.widget_background_light, R.drawable.widget_background_dark);
        small.removeAllViews(R.id.mini_profiles);
        for (int i = 0; i < Math.min(2, frame.profiles.size()); i++) small.addView(R.id.mini_profiles, collapsedProfile(context, frame.profiles.get(i)));
        boolean progress = prefs(context).getBoolean("progress", true);
        NotificationCompat.Builder card = new NotificationCompat.Builder(context, "timetable").setSmallIcon(R.drawable.school_icon).setContentTitle("Timetables & events")
            .setContentText(frame.title + " · " + frame.time).setCustomContentView(small)
            .setContentIntent(open(context, contentId)).setOngoing(true).setOnlyAlertOnce(true).setSilent(true)
            .setDeleteIntent(action(context, "HIDE", 73)).setVisibility(NotificationCompat.VISIBILITY_PUBLIC).setShowWhen(false);
        if (frame.profiles.size() > 2) {
            RemoteViews big = new RemoteViews(context.getPackageName(), R.layout.timetable_notification); big.removeAllViews(R.id.notification_profiles);
            AppAppearance.background(big, R.id.notification_profiles, palette, R.drawable.widget_background, R.drawable.widget_background_light, R.drawable.widget_background_dark);
            for (int i=0;i<Math.min(6,frame.profiles.size());i++) big.addView(R.id.notification_profiles, profileView(context, frame.profiles.get(i), progress, AppWidgetManager.INVALID_APPWIDGET_ID, false, true));
            card.setStyle(new NotificationCompat.DecoratedCustomViewStyle()).setCustomBigContentView(big);
        } else card.setCustomBigContentView(small); // Android may force expansion; keep the same two rows there.
        return card.build();
    }
    static RemoteViews collapsedProfile(Context context, TimetableSchedule.Frame row) {
        if (!row.eventId.isEmpty()) return eventMiniView(context,row);
        RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.timetable_notification_row);
        AppearancePalette palette = AppAppearance.palette(context);
        AppAppearance.text(view, R.id.mini_label, palette, "#1F2937", "#E2E8F0");
        AppAppearance.text(view, R.id.mini_summary, palette, "#4F46E5", "#A5B4FC");
        AppAppearance.navigation(view, palette);
        AppAppearance.progress(view, R.id.mini_progress, palette, "#10B981", "#34D399");
        view.setTextViewText(R.id.mini_label, row.tableName + " · " + (row.shortLabel.isEmpty() ? row.title : row.shortLabel) + " · " + WidgetLessonText.periodRange(row.time, ZonedDateTime.now(ZoneId.of(row.timeZone)), android.text.format.DateFormat.getTimeFormat(context)));
        StringBuilder subjects = new StringBuilder();
        for (TimetableSchedule.Pill pill : row.pills) { if (subjects.length() > 0) subjects.append("  ·  "); subjects.append(pill.classCode).append(" ").append(pill.subjectCode); }
        view.setTextViewText(R.id.mini_summary, subjects.length() == 0 ? row.title : subjects.toString());
        view.setContentDescription(R.id.mini_label, row.tableName + " · " + row.title + " · " + row.time);
        view.setViewVisibility(R.id.mini_summary, context.getResources().getConfiguration().fontScale > 1.2f ? View.GONE : View.VISIBLE);
        view.setProgressBar(R.id.mini_progress, 100, row.progress, false);
        view.setViewVisibility(R.id.mini_progress, prefs(context).getBoolean("progress", true) && (row.hasPeriod || row.active) ? View.VISIBLE : View.GONE);
        view.setBoolean(R.id.previous_period, "setEnabled", row.hasPrevious); view.setBoolean(R.id.next_period, "setEnabled", row.hasNext);
        view.setViewVisibility(R.id.live_reset, row.live ? View.GONE : View.VISIBLE);
        click(context, view, R.id.previous_period, AppWidgetManager.INVALID_APPWIDGET_ID, row, "PREVIOUS", "", false);
        click(context, view, R.id.next_period, AppWidgetManager.INVALID_APPWIDGET_ID, row, "NEXT", "", false);
        click(context, view, R.id.live_reset, AppWidgetManager.INVALID_APPWIDGET_ID, row, "LIVE", "", false);
        view.setOnClickPendingIntent(R.id.mini_label, open(context, 0)); view.setOnClickPendingIntent(R.id.mini_summary, open(context, 0));
        return view;
    }
    static void renderWidget(Context context, AppWidgetManager manager, int id, TimetableSchedule.Frame frame, boolean progress) {
        RemoteViews views = null;
        android.os.Bundle options = manager.getAppWidgetOptions(id);
        if (Build.VERSION.SDK_INT >= 31) {
            ArrayList<SizeF> available = options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
            Map<SizeF, RemoteViews> sizes = new LinkedHashMap<>();
            if (available != null) for (SizeF size : available) {
                if (size == null || !Float.isFinite(size.getWidth()) || !Float.isFinite(size.getHeight()) || size.getWidth() <= 0 || size.getHeight() <= 0 || sizes.size() >= 16) continue;
                sizes.put(size, widgetForSize(context, id, frame, progress, size.getWidth(), size.getHeight()));
            }
            if (!sizes.isEmpty()) views = new RemoteViews(sizes);
        }
        if (views == null) {
            // Older or third-party launchers supply orientation-specific ranges instead.
            int narrow = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
            int wide = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, narrow);
            int shortHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 80);
            int tallHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, shortHeight);
            views = new RemoteViews(widgetForSize(context, id, frame, progress, wide, shortHeight),
                widgetForSize(context, id, frame, progress, narrow, tallHeight));
        }
        manager.updateAppWidget(id, views);
        if (Build.VERSION.SDK_INT < 31 || tracking(context, id)) manager.notifyAppWidgetViewDataChanged(id, R.id.feed_list);
    }
    static RemoteViews widgetForSize(Context context, int id, TimetableSchedule.Frame frame, boolean progress, float width, float height) {
        int columns = WidgetSizing.columns(width, context.getResources().getConfiguration().fontScale);
        RemoteViews view = widgetView(context, id, new JSONObject(), frame, progress, R.layout.timetable_widget, columns);
        int padding = Math.round((height < 80 ? 2 : 6) * context.getResources().getDisplayMetrics().density);
        view.setViewPadding(R.id.widget_root, padding, padding, padding, padding);
        return view;
    }
    static PendingIntent openEvents(Context context) {
        return PendingIntent.getActivity(context,7900,new Intent(context,MainActivity.class).putExtra("onlineRoute",PhotoPolicy.ORIGIN+"/events"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    static RemoteViews eventMiniView(Context context, TimetableSchedule.Frame event) {
        RemoteViews row=new RemoteViews(context.getPackageName(),R.layout.school_event_notification_row);
        AppearancePalette palette=AppAppearance.palette(context);
        AppAppearance.text(row,R.id.event_heading,palette,"#1F2937","#E2E8F0"); AppAppearance.text(row,R.id.event_title,palette,"#4F46E5","#A5B4FC");
        row.setTextViewText(R.id.event_heading,event.next+" · "+event.title); row.setTextViewText(R.id.event_title,event.time);
        row.setViewVisibility(R.id.event_title,context.getResources().getConfiguration().fontScale>1.2f?View.GONE:View.VISIBLE);
        row.setContentDescription(R.id.event_row,event.next+" · "+event.title+" · "+event.time+" · "+event.agenda);
        row.setOnClickPendingIntent(R.id.event_row,openEvents(context)); return row;
    }
    static RemoteViews eventView(Context context, TimetableSchedule.Frame event, int scope, boolean notification) {
        RemoteViews row=new RemoteViews(context.getPackageName(),R.layout.school_event_row);
        AppearancePalette palette=AppAppearance.palette(context);
        for(int id:new int[]{R.id.event_heading,R.id.event_title,R.id.event_time,R.id.event_location}) AppAppearance.text(row,id,palette,"#1F2937","#E2E8F0");
        row.setTextViewText(R.id.event_heading,"Events · "+event.next); row.setTextViewText(R.id.event_title,event.title);
        row.setTextViewText(R.id.event_time,event.time); row.setTextViewText(R.id.event_location,event.agenda);
        row.setViewVisibility(R.id.event_location,event.agenda.isEmpty()?View.GONE:View.VISIBLE);
        if(notification) row.setOnClickPendingIntent(R.id.event_row,openEvents(context));
        else row.setOnClickFillInIntent(R.id.event_row,new Intent().putExtra("operation","EVENT").putExtra("accountId",event.accountId).putExtra("eventId",event.eventId));
        return row;
    }
    static RemoteViews profileView(Context context, TimetableSchedule.Frame frame, boolean progress) { return profileView(context, frame, progress, 987600, false, false); }
    static RemoteViews shortWidget(Context context, int id, TimetableSchedule.Frame frame, boolean progress, int layout) {
        RemoteViews view = widgetView(context, id, new JSONObject(), frame, progress, layout); view.setViewVisibility(R.id.widget_header, View.GONE); return view;
    }
    static RemoteViews profileView(Context context, TimetableSchedule.Frame frame, boolean progress, int scope, boolean compact, boolean notification) {
        return profileView(context, frame, progress, scope, compact, notification, compact ? 2 : 5);
    }
    static RemoteViews profileView(Context context, TimetableSchedule.Frame frame, boolean progress, int scope, boolean compact, boolean notification, int chipColumns) {
        if (!frame.trackedSubject.isEmpty()) return trackedSubjectView(context, frame, progress);
        if (!frame.eventId.isEmpty()) return eventView(context,frame,scope,notification);
        RemoteViews row = new RemoteViews(context.getPackageName(), compact ? R.layout.timetable_feed_row_compact : R.layout.timetable_feed_row);
        AppearancePalette palette = AppAppearance.palette(context);
        AppAppearance.text(row, R.id.current_lesson, palette, "#1F2937", "#E2E8F0");
        AppAppearance.text(row, R.id.detail_subject, palette, "#1F2937", "#E2E8F0");
        AppAppearance.text(row, R.id.detail_teacher, palette, "#4B5563", "#CBD5E1");
        for (int id : new int[]{R.id.class_label,R.id.lesson_time,R.id.lesson_agenda,R.id.next_lesson})
            AppAppearance.text(row,id,palette,"#6B7280","#94A3B8");
        AppAppearance.color(row,R.id.surface_divider,"setBackgroundColor",palette,"#EEF2FF","#334155");
        AppAppearance.color(row,R.id.detail_close,"setColorFilter",palette,"#4F46E5","#A5B4FC");
        AppAppearance.navigation(row,palette);
        AppAppearance.progress(row,R.id.lesson_progress,palette,"#4F46E5","#818CF8");
        row.removeAllViews(R.id.pills_container);
        row.setViewVisibility(R.id.pills_container, View.VISIBLE); row.setViewVisibility(R.id.pill_details, View.GONE);
        row.setViewVisibility(R.id.period_badge, View.VISIBLE); row.setViewVisibility(R.id.period_countdown, View.GONE);
        row.setBoolean(R.id.period_countdown, "setStarted", false);
        row.setContentDescription(R.id.current_lesson, frame.tableName + " · " + frame.title);
        row.setTextViewText(R.id.class_label, frame.tableName); row.setTextViewText(R.id.current_lesson, frame.shortLabel.isEmpty() ? frame.title : frame.shortLabel);
        row.setTextViewText(R.id.lesson_time, WidgetLessonText.periodRange(frame.time, ZonedDateTime.now(ZoneId.of(frame.timeZone)), android.text.format.DateFormat.getTimeFormat(context))); row.setTextViewText(R.id.lesson_agenda, notification ? "" : frame.agenda);
        row.setTextViewText(R.id.period_badge, frame.hasPeriod ? frame.countdownEnd > 0 ? "Upcoming" : "Ended" : "");
        AppAppearance.badge(row,R.id.period_badge,palette,frame.countdownEnd > 0 ? 1 : 0);
        if (!frame.hasPeriod) row.setViewVisibility(R.id.period_badge, View.GONE);
        if (frame.countdownEnd > System.currentTimeMillis()) {
            if (!notification) {
                // ListView can detach/recycle a Chronometer without restarting it. Render a
                // minute badge from the current clock; the independent visual alarm refreshes it.
                row.setTextViewText(R.id.period_badge, TimetableCountdown.label(frame.countdownEnd, System.currentTimeMillis(), frame.active));
                AppAppearance.badge(row,R.id.period_badge,palette,frame.active ? 2 : 1);
            } else {
            AppAppearance.badge(row,R.id.period_countdown,palette,frame.active ? 2 : 1);
            row.setViewVisibility(R.id.period_badge, View.GONE); row.setViewVisibility(R.id.period_countdown, View.VISIBLE);
            row.setChronometerCountDown(R.id.period_countdown, true);
            row.setChronometer(R.id.period_countdown, android.os.SystemClock.elapsedRealtime() + frame.countdownEnd - System.currentTimeMillis(), frame.active ? "%s left" : "%s to start", true);
            }
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
        // Short class/subject codes fit five across the dashboard-width card.
        int columns = notification ? Math.max(1, Math.min(3, frame.pills.size())) : Math.max(1, chipColumns);
        RemoteViews line = null; TimetableSchedule.Pill selected = null;
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now(java.time.ZoneId.of(frame.timeZone));
        String detail = prefs(context).getString(TimetableInteractions.detailKey(scope, frame, now), "");
        for (int i = 0; i < frame.pills.size(); i++) {
            TimetableSchedule.Pill pill = frame.pills.get(i);
            if (i % columns == 0) { if (line != null) row.addView(R.id.pills_container, line); line = new RemoteViews(context.getPackageName(), R.layout.timetable_pill_line); line.removeAllViews(R.id.pill_line); }
            RemoteViews chip = new RemoteViews(context.getPackageName(), R.layout.timetable_pill);
            chip.setTextViewText(R.id.lesson_pill, pill.classCode + " · " + pill.subjectCode);
            chip.setInt(R.id.lesson_pill, "setBackgroundResource", backgrounds[pill.color % 8]);
            AppAppearance.lessonText(chip,R.id.lesson_pill,palette,AppearancePalette.LIGHT_PILLS[pill.color % 8],AppearancePalette.DARK_PILLS[pill.color % 8]);
            chip.setContentDescription(R.id.lesson_pill, notification ? pill.classCode + " · " + pill.subjectCode + " · " + pill.time
                : pill.className + " · " + pill.subjectName + " · " + pill.time + " · " + pill.teacher);
            click(context, chip, R.id.lesson_pill, scope, frame, "DETAIL", pill.id, !notification);
            line.addView(R.id.pill_line, chip); if (pill.id.equals(detail)) selected = pill;
        }
        if (line != null) row.addView(R.id.pills_container, line);
        if (selected != null) {
            row.setViewVisibility(R.id.pills_container, View.GONE); row.setViewVisibility(R.id.pill_details, View.VISIBLE);
            row.setInt(R.id.pill_details, "setBackgroundResource", backgrounds[selected.color % 8]);
            row.setTextViewText(R.id.detail_subject, selected.classCode + " · " + (notification ? selected.subjectCode : selected.subjectName));
            row.setTextViewText(R.id.detail_teacher, notification ? "" : selected.teacher.isEmpty() ? selected.className : selected.className + " · " + selected.teacher);
            row.setViewVisibility(R.id.detail_teacher, notification ? View.GONE : View.VISIBLE);
            row.setContentDescription(R.id.pill_details, notification ? selected.classCode + " · " + selected.subjectCode + " · " + selected.time
                : selected.className + " · " + selected.subjectName + " · " + selected.time + " · " + selected.teacher);
        }
        return row;
    }
    static RemoteViews widgetView(Context context, int id, JSONObject ignored, TimetableSchedule.Frame frame, boolean progress, int layout) {
        return widgetView(context, id, ignored, frame, progress, layout, layout == R.layout.timetable_widget_compact ? 2 : 5);
    }
    static RemoteViews widgetView(Context context, int id, JSONObject ignored, TimetableSchedule.Frame frame, boolean progress, int layout, int columns) {
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        AppearancePalette palette = AppAppearance.palette(context);
        AppAppearance.background(views,R.id.widget_root,palette,R.drawable.widget_background,R.drawable.widget_background_light,R.drawable.widget_background_dark);
        AppAppearance.text(views,R.id.feed_empty,palette,"#6B7280","#94A3B8");
        views.setOnClickPendingIntent(R.id.widget_root, open(context, id));
        views.setTextViewText(R.id.feed_empty, frame.accountId.isEmpty() ? "Open " + SchoolApp.NAME + " to load timetables" : "No schedules shown. Change widget settings."); views.setEmptyView(R.id.feed_list, R.id.feed_empty);
        views.setViewVisibility(R.id.widget_header, View.GONE);
        views.setOnClickPendingIntent(R.id.feed_empty, PendingIntent.getActivity(context, 9100 + id, new Intent(context, TimetableSettingsActivity.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        Intent template = new Intent(context, TimetableReceiver.class).setAction("ug.trinity.timetable.INTERACT").addFlags(Intent.FLAG_RECEIVER_FOREGROUND)
            .putExtra("surfaceId", id).putExtra("accountId", frame.accountId).setData(android.net.Uri.parse("trinity-timetable://widget/" + id + "/" + android.net.Uri.encode(frame.accountId)));
        views.setPendingIntentTemplate(R.id.feed_list, PendingIntent.getBroadcast(context, id, template, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE));
        // Load tracked cards on demand: selecting many class/subject pairs must not
        // duplicate the entire feed into every responsive RemoteViews size parcel.
        if (Build.VERSION.SDK_INT >= 31 && !tracking(context, id)) {
            RemoteViews.RemoteCollectionItems.Builder rows = new RemoteViews.RemoteCollectionItems.Builder().setHasStableIds(false).setViewTypeCount(4);
            for (int i = 0; i < frame.profiles.size(); i++) rows.addItem(i, profileView(context, frame.profiles.get(i), progress, id, columns <= 2, false, columns));
            views.setRemoteAdapter(R.id.feed_list, rows.build());
        } else {
            Intent service = new Intent(context, TimetableFeedService.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id).putExtra("progress", progress).putExtra("compact", columns <= 2).putExtra("columns", columns);
            service.setData(android.net.Uri.parse("trinity-widget://feed/" + id + "/" + progress + "/" + layout + "/" + columns)); views.setRemoteAdapter(R.id.feed_list, service);
        }
        return views;
    }
    static RemoteViews trackedSubjectView(Context context, TimetableSchedule.Frame frame, boolean progress) {
        RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.tracked_subject_row);
        AppearancePalette palette = AppAppearance.palette(context);
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of(frame.timeZone));
        for (int id : new int[]{R.id.tracked_subject, R.id.tracked_time, R.id.tracked_state}) AppAppearance.text(row, id, palette, "#1F2937", "#E2E8F0");
        row.setTextViewText(R.id.tracked_subject, frame.classCode + " · " + frame.subjectCode);
        AppAppearance.badge(row, R.id.tracked_subject, palette, frame.active ? 2 : frame.hasPeriod ? 1 : 0);
        String state = WidgetLessonText.state(frame, now);
        String time = frame.hasPeriod ? WidgetLessonText.range(frame.start, frame.end, frame.timeZone, android.text.format.DateFormat.getTimeFormat(context)) : frame.time;
        row.setTextViewText(R.id.tracked_state, state);
        row.setViewVisibility(R.id.tracked_state, state.isEmpty() ? View.GONE : View.VISIBLE);
        row.setTextViewText(R.id.tracked_time, time);
        AppAppearance.progress(row, R.id.tracked_progress, palette, "#4F46E5", "#818CF8");
        row.setProgressBar(R.id.tracked_progress, 100, frame.progress, false);
        row.setViewVisibility(R.id.tracked_progress, progress && frame.active ? View.VISIBLE : View.GONE);
        row.setContentDescription(R.id.tracked_row, frame.className + " · " + frame.title + " · " + state + " · " + time);
        row.setOnClickFillInIntent(R.id.tracked_row, new Intent().putExtra("operation", "TRACKED").putExtra("accountId", frame.accountId).putExtra("trackedSubject", frame.trackedSubject));
        return row;
    }
    private static void renderEmptyWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> provider : new Class<?>[]{TimetableWidget.class, TimetableProgressWidget.class}) for (int id : manager.getAppWidgetIds(new ComponentName(context, provider))) renderWidget(context, manager, id, new TimetableSchedule.Frame(), false);
    }
}
