package ug.trinityfamilyschool.photo;
import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.LocalDate;
/** Shared facade retained for bridge, boot and dataset refresh callers. */
final class TimetableUpdates {
    static void select(Context context, OfflineStore store, JSONObject selection) throws Exception { TimetableSurfaces.select(context, store, selection, android.appwidget.AppWidgetManager.INVALID_APPWIDGET_ID); }
    static void hideCard(Context context) { TimetableSurfaces.hideCard(context); }
    static void clear(Context context) { TimetableSurfaces.clear(context); LessonReminders.clear(context); }
    static void refresh(Context context, OfflineStore store) { TimetableSurfaces.refresh(context, store); LessonReminders.refresh(context, store); }
    static String mode(JSONObject profile, String classId, int day, String periodId) {
        JSONObject layouts = profile.optJSONObject("streamLayouts");
        JSONObject layout = layouts == null ? null : layouts.optJSONObject(classId);
        if (layout == null) return "consolidated";
        JSONObject periods = layout.optJSONObject("periodModes"), days = layout.optJSONObject("dayModes");
        if (periods != null && periods.has(periodId)) return periods.optString(periodId);
        if (days != null && days.has(String.valueOf(day))) return days.optString(String.valueOf(day));
        return layout.optString("defaultMode", "consolidated");
    }
    static Boolean withinTerm(JSONObject datasets, JSONObject profile, LocalDate today) {
        JSONObject saved = datasets.optJSONObject("academicYears");
        JSONArray years = saved == null ? null : saved.optJSONArray("data");
        if (years == null) return null;
        for (int index = 0; index < years.length(); index++) {
            JSONObject year = years.optJSONObject(index);
            if (year == null || !profile.optString("academicYearId").equals(year.optString("id"))) continue;
            JSONArray terms = year.optJSONArray("terms");
            if (terms == null) return null;
            for (int termIndex = 0; termIndex < terms.length(); termIndex++) {
                JSONObject term = terms.optJSONObject(termIndex);
                if (term == null || !profile.optString("termId").equals(term.optString("id"))) continue;
                try {
                    LocalDate start = LocalDate.parse(term.getString("startDate").substring(0, 10));
                    LocalDate end = LocalDate.parse(term.getString("endDate").substring(0, 10));
                    return !today.isBefore(start) && !today.isAfter(end);
                } catch (Exception ignored) { return null; }
            }
        }
        return null;
    }
}
