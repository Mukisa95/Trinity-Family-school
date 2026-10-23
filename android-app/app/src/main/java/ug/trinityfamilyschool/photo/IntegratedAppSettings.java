package ug.trinityfamilyschool.photo;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import org.json.*;
import java.time.*;
import java.util.*;

/** Account-scoped settings metadata only; never exports the offline record snapshot. */
final class IntegratedAppSettings {
    static JSONObject envelope(OfflineStore store, String account) throws Exception {
        JSONObject saved = store.timetableAvailable();
        if (saved == null || !TimetableSurfaces.authorized(saved)) throw new IllegalStateException("Connect and open Timetable or Events to prepare your saved settings.");
        if (account.isEmpty() || !account.equals(saved.getJSONObject("session").optString("accountId"))) throw new IllegalStateException("Your account changed. Reopen App Settings.");
        return saved;
    }
    static void widget(Activity activity, int id) {
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(activity).getAppWidgetInfo(id);
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID || info == null || !activity.getPackageName().equals(info.provider.getPackageName())
            || !(TimetableWidget.class.getName().equals(info.provider.getClassName()) || TimetableProgressWidget.class.getName().equals(info.provider.getClassName())))
            throw new IllegalArgumentException("This widget is no longer installed.");
    }
    static JSONObject choice(String id, String label) throws JSONException { return new JSONObject().put("id", id).put("label", label); }
    static JSONArray choices(Map<String, String> map) throws JSONException {
        JSONArray rows = new JSONArray(); for (Map.Entry<String, String> entry : map.entrySet()) rows.put(choice(entry.getKey(), entry.getValue())); return rows;
    }
    static JSONObject surface(Activity activity, int id, String label) throws JSONException {
        boolean defaultProgress = id == AppWidgetManager.INVALID_APPWIDGET_ID;
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(activity).getAppWidgetInfo(id);
        if (info != null) defaultProgress = TimetableProgressWidget.class.getName().equals(info.provider.getClassName());
        return new JSONObject().put("id", id).put("label", label)
            .put("progress", TimetableSurfaces.prefs(activity).getBoolean(TimetableSurfaces.prefix(id) + "progress", defaultProgress))
            .put("hiddenTables", new JSONArray(new TreeSet<>(TimetableSurfaces.hidden(activity, id))))
            .put("events", TimetableSurfaces.showEvents(activity, id))
            .put("tracking", TimetableSurfaces.tracking(activity, id)).put("trackingWithTables", TimetableSurfaces.trackingWithTables(activity, id))
            .put("trackedSubjects", new JSONArray(new TreeSet<>(TimetableSurfaces.trackedSubjects(activity, id))))
            .put("rowOrder", new JSONArray(TimetableSurfaces.rowOrder(activity, id)));
    }
    static JSONObject read(Activity activity, OfflineStore store, JSONObject input) throws Exception {
        JSONObject saved = envelope(store, input.optString("accountId")), session = saved.getJSONObject("session"), grants = session.getJSONObject("grants");
        JSONObject data = saved.getJSONObject("snapshot").getJSONObject("datasets");
        boolean tablesAllowed = grants.optBoolean("timetable"), eventsAllowed = grants.optBoolean("events");
        String account = session.getString("accountId"), zone = session.optString("timeZone", "Africa/Kampala");
        // A stale account's preferences are never displayed as this user's choices.
        if (!TimetableSurfaces.prefs(activity).getString("account", account).equals(account)) TimetableSurfaces.clear(activity);
        JSONObject card = surface(activity, AppWidgetManager.INVALID_APPWIDGET_ID, "Notification card")
            .put("notificationCard", TimetableSurfaces.prefs(activity).getBoolean("card", true))
            .put("eventReminders", TimetableSurfaces.prefs(activity).getBoolean("eventReminders", false));
        JSONArray tables = new JSONArray(), widgets = new JSONArray(), subjects = new JSONArray(), events = new JSONArray();
        if (tablesAllowed) for (int i = 0; i < LessonReminderPlan.rows(data, "timetables").length(); i++) {
            JSONObject table = LessonReminderPlan.rows(data, "timetables").optJSONObject(i);
            if (table != null && table.optBoolean("complete") && table.optJSONObject("profile") != null) {
                JSONObject profile = table.getJSONObject("profile"); tables.put(choice(profile.getString("id"), profile.optString("name", "Timetable")));
            }
        }
        AppWidgetManager manager = AppWidgetManager.getInstance(activity);
        for (Class<?> provider : new Class<?>[]{TimetableWidget.class, TimetableProgressWidget.class}) {
            int number = 0;
            for (int id : manager.getAppWidgetIds(new ComponentName(activity, provider))) widgets.put(surface(activity, id, (provider == TimetableWidget.class ? "Timetables" : "Timetables with progress") + " · " + (++number)));
        }
        if (tablesAllowed) for (Map.Entry<String, String> entry : TrackedSubjects.choices(data).entrySet()) {
            JSONArray pair = new JSONArray(entry.getKey());
            subjects.put(choice(entry.getKey(), entry.getValue()).put("classId", pair.getString(0)).put("classLabel", TimetableSchedule.name(data, "classes", pair.getString(0))));
        }
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of(zone));
        if (eventsAllowed) for (SchoolEventSchedule.Event event : SchoolEventSchedule.events(data, now.getZone())) if (event.end > now.toInstant().toEpochMilli())
            events.put(choice("event:" + event.id, event.title).put("spotlight", event.spotlight));
        LessonReminderPlan.Settings reminders = input.optJSONObject("reminderDraft") == null ? LessonReminders.settings(activity, account) : new LessonReminderPlan.Settings(input.getJSONObject("reminderDraft"));
        if (tablesAllowed && LessonReminderFilters.ORDER.contains(input.optString("changedFilter"))) LessonReminderFilters.reconcile(data, reminders, input.getString("changedFilter"));
        JSONObject filters = new JSONObject();
        for (String field : LessonReminderFilters.ORDER) filters.put(field, tablesAllowed ? choices(LessonReminderFilters.choices(data, reminders, field)) : new JSONArray());
        JSONArray upcoming = new JSONArray();
        if (tablesAllowed) {
            long previous = -1;
            for (LessonReminderPlan.Event event : LessonReminderPlan.events(data, reminders, now, OfflineStore.timestamp(session.optString("expiresAt")) - 1)) {
                if (event.at == previous) continue;
                previous = event.at;
                upcoming.put(new JSONObject().put("at", event.at).put("label", event.line()));
                if (upcoming.length() == 4) break;
            }
        }
        return new JSONObject().put("schema", 1).put("accountId", account).put("timeZone", zone).put("expiresAt", session.optString("expiresAt"))
            .put("timetableAllowed", tablesAllowed).put("eventsAllowed", eventsAllowed).put("timetables", tables).put("card", card).put("widgets", widgets)
            .put("subjects", subjects).put("eventCards", events).put("reminders", reminders.json()).put("reminderChoices", filters).put("upcoming", upcoming)
            .put("notificationsAllowed", LessonReminders.notificationsAllowed(activity)).put("exactAllowed", LessonReminders.exactAllowed(activity));
    }
    static JSONObject process(Activity activity, OfflineStore store, String action, JSONObject input) throws Exception {
        JSONObject saved = envelope(store, input.optString("accountId"));
        boolean timetable = saved.getJSONObject("session").getJSONObject("grants").optBoolean("timetable");
        if ("saveLessonReminders".equals(action)) {
            if (!timetable) throw new IllegalStateException("Timetable access is required for lesson reminders.");
            LessonReminderPlan.Settings settings = new LessonReminderPlan.Settings(input.getJSONObject("settings"));
            LessonReminders.save(activity, store, input.getString("accountId"), settings);
        } else if ("saveWidgetSettings".equals(action) || "saveCardSettings".equals(action)) {
            int id = "saveWidgetSettings".equals(action) ? input.getInt("widgetId") : AppWidgetManager.INVALID_APPWIDGET_ID;
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID) widget(activity, id); else if ("saveWidgetSettings".equals(action)) throw new IllegalArgumentException("Choose an installed widget.");
            JSONObject settings = input.getJSONObject("settings"); settings.put("accountId", input.getString("accountId"));
            if (!timetable && (settings.optBoolean("tracking") || settings.has("hiddenTables"))) throw new IllegalStateException("Timetable access is required for these choices.");
            TimetableSurfaces.select(activity, store, settings, id);
        } else if ("testLessonReminders".equals(action)) {
            if (!timetable || !LessonReminders.notificationsAllowed(activity)) throw new IllegalStateException("Allow lesson notifications first.");
            LessonReminders.test(activity, new LessonReminderPlan.Settings(input.getJSONObject("settings")));
        }
        return new JSONObject().put("settings", read(activity, store, input));
    }
}
