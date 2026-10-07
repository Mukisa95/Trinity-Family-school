package ug.trinityfamilyschool.photo;

import android.appwidget.AppWidgetManager;
import android.content.*;
import org.json.JSONObject;
import java.time.*;
import java.util.*;

/** Browsing belongs to each widget/card, never to the user's school records. */
final class TimetableInteractions {
    static String prefix(int scope, ZonedDateTime now) { return TimetableSurfaces.prefix(scope) + "browse." + now.toLocalDate() + "."; }
    static Map<String, Integer> offsets(Context context, int scope, ZonedDateTime now) {
        Map<String, Integer> result = new HashMap<>(); String prefix = prefix(scope, now);
        for (Map.Entry<String, ?> value : TimetableSurfaces.prefs(context).getAll().entrySet()) {
            if (value.getKey().startsWith(prefix) && value.getKey().endsWith(".offset") && value.getValue() instanceof Integer)
                result.put(value.getKey().substring(prefix.length(), value.getKey().length()-7), (Integer)value.getValue());
        }
        return result;
    }
    static String detailKey(int scope, TimetableSchedule.Frame row, ZonedDateTime now) { return prefix(scope, now) + row.profileId + ".detail." + row.periodId; }
    static int movedOffset(TimetableSchedule.Frame row, String action) {
        int offset = row.viewIndex - row.baseIndex + ("PREVIOUS".equals(action) ? -1 : "NEXT".equals(action) ? 1 : 0);
        return "LIVE".equals(action) ? 0 : Math.max(-row.baseIndex, Math.min(row.periodCount-1-row.baseIndex, offset));
    }
    static void apply(Context context, OfflineStore store, Intent intent) throws Exception {
        JSONObject envelope = store.available();
        if (envelope == null || !envelope.getJSONObject("session").getJSONObject("grants").optBoolean("timetable")) return;
        JSONObject session = envelope.getJSONObject("session");
        if (!session.optString("accountId").equals(intent.getStringExtra("accountId"))) return;
        int scope = intent.getIntExtra("surfaceId", AppWidgetManager.INVALID_APPWIDGET_ID);
        if (scope != AppWidgetManager.INVALID_APPWIDGET_ID) {
            android.appwidget.AppWidgetProviderInfo info = AppWidgetManager.getInstance(context).getAppWidgetInfo(scope);
            if (info == null || !context.getPackageName().equals(info.provider.getPackageName()) || !(TimetableWidget.class.getName().equals(info.provider.getClassName()) || TimetableProgressWidget.class.getName().equals(info.provider.getClassName()))) return;
        }
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of(session.optString("timeZone", "Africa/Kampala")));
        TimetableSchedule.Frame feed = TimetableSurfaces.feed(context, envelope, scope, now);
        TimetableSchedule.Frame row = null;
        for (TimetableSchedule.Frame candidate : feed.profiles) if (candidate.profileId.equals(intent.getStringExtra("profileId"))) row = candidate;
        if (row == null || !row.hasPeriod) return;
        String action = intent.getStringExtra("operation");
        SharedPreferences.Editor edit = TimetableSurfaces.prefs(context).edit();
        if ("PREVIOUS".equals(action) || "NEXT".equals(action) || "LIVE".equals(action)) {
            for (String key : TimetableSurfaces.prefs(context).getAll().keySet()) if (key.startsWith(prefix(scope, now) + row.profileId + ".detail.")) edit.remove(key);
            edit.putInt(prefix(scope, now) + row.profileId + ".offset", movedOffset(row, action));
        } else if ("DETAIL".equals(action)) {
            if (!row.periodId.equals(intent.getStringExtra("periodId"))) return;
            String id = intent.getStringExtra("pillId"); boolean exists = false;
            for (TimetableSchedule.Pill pill : row.pills) exists |= pill.id.equals(id);
            if (!exists) return;
            edit.putString(detailKey(scope, row, now), id);
        } else if ("CLOSE".equals(action)) edit.remove(detailKey(scope, row, now));
        else return;
        String surfacePrefix = TimetableSurfaces.prefix(scope) + "browse.";
        for (String key : TimetableSurfaces.prefs(context).getAll().keySet()) if (key.startsWith(surfacePrefix) && !key.startsWith(prefix(scope, now))) edit.remove(key);
        edit.apply();
    }
}
