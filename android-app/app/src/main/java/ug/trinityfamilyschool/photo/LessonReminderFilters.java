package ug.trinityfamilyschool.photo;

import org.json.*;
import java.util.*;

/** Choices follow timetable -> class -> subject -> teacher -> starting period. */
final class LessonReminderFilters {
    static final List<String> ORDER = Arrays.asList("timetables", "classes", "subjects", "teachers", "periods");
    static LinkedHashMap<String, String> choices(JSONObject data, LessonReminderPlan.Settings selected, String field) {
        LinkedHashMap<String, String> result = new LinkedHashMap<>();
        JSONArray tables = LessonReminderPlan.rows(data, "timetables");
        for (int t = 0; t < tables.length(); t++) {
            JSONObject table = tables.optJSONObject(t); if (table == null) continue;
            JSONObject profile = table.optJSONObject("profile"); if (profile == null) continue;
            String tableId = profile.optString("id");
            if (field.equals("timetables")) { result.put(tableId, profile.optString("name", "Timetable")); continue; }
            if (!LessonReminderPlan.includes(selected.tables, tableId)) continue;
            JSONArray classIds = profile.optJSONArray("classIds"); if (classIds == null) continue;
            Set<String> members = new HashSet<>(); boolean relevant = false;
            for (int c = 0; c < classIds.length(); c++) {
                String id = classIds.optString(c); members.add(id);
                if (field.equals("classes")) result.put(id, TimetableSchedule.name(data, "classes", id));
                relevant |= LessonReminderPlan.includes(selected.classes, id);
            }
            if (field.equals("classes")) continue;
            JSONArray entries = table.optJSONArray("entries"), periods = table.optJSONArray("periods");
            if (entries == null || periods == null) continue;
            Map<String, JSONObject> byPeriod = new LinkedHashMap<>();
            for (int p = 0; p < periods.length(); p++) { JSONObject period = periods.optJSONObject(p); if (period != null) byPeriod.put(period.optString("id"), period); }
            for (int e = 0; e < entries.length(); e++) {
                JSONObject entry = entries.optJSONObject(e); if (entry == null) continue;
                String classId = entry.optString("classId"); JSONObject period = byPeriod.get(entry.optString("periodId"));
                if (period == null || !members.contains(classId) || !LessonReminderPlan.includes(selected.classes, classId)) continue;
                String mode = TimetableUpdates.mode(profile, classId, period.optInt("dayOfWeek"), period.optString("id"));
                if ("separate".equals(mode) ? entry.optString("streamId").isEmpty() : !entry.optString("streamId").isEmpty()) continue;
                if (field.equals("subjects")) { references(result, data, "subjects", entry, "subjectId", "optionalSubjectId"); continue; }
                if (!LessonReminderPlan.includes(selected.subjects, entry.optString("subjectId")) && !LessonReminderPlan.includes(selected.subjects, entry.optString("optionalSubjectId"))) continue;
                if (field.equals("teachers")) { references(result, data, "teachers", entry, "teacherId", "optionalTeacherId"); continue; }
                if (!LessonReminderPlan.includes(selected.teachers, entry.optString("teacherId")) && !LessonReminderPlan.includes(selected.teachers, entry.optString("optionalTeacherId"))) continue;
                if (field.equals("periods")) result.put(tableId + "|" + period.optString("id"), periodLabel(profile, period));
            }
            if (field.equals("periods") && selected.breaks && relevant) for (JSONObject period : byPeriod.values()) {
                if (!"lesson".equals(period.optString("type"))) result.put(tableId + "|" + period.optString("id"), periodLabel(profile, period));
            }
        }
        result.remove(""); return result;
    }
    private static String periodLabel(JSONObject profile, JSONObject period) {
        String[] days = {"", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}; int day = period.optInt("dayOfWeek");
        return profile.optString("name", "Timetable") + " · " + (day >= 1 && day <= 7 ? days[day] : "") + " · " + period.optString("startTime") + "–" + period.optString("endTime") + " · "
            + ("lesson".equals(period.optString("type")) ? "Lesson " + period.optInt("periodNumber") : period.optString("customLabel", period.optString("type")));
    }
    private static void references(Map<String, String> result, JSONObject data, String dataset, JSONObject entry, String... fields) {
        for (String field : fields) { String id = entry.optString(field); if (!id.isEmpty()) result.put(id, TimetableSchedule.name(data, dataset, id)); }
    }
    static Set<String> selected(LessonReminderPlan.Settings value, String field) {
        switch (field) { case "timetables": return value.tables; case "classes": return value.classes; case "subjects": return value.subjects; case "teachers": return value.teachers; default: return value.periods; }
    }
    static void select(LessonReminderPlan.Settings value, String field, Set<String> selected) {
        switch (field) { case "timetables": value.tables = selected; break; case "classes": value.classes = selected; break; case "subjects": value.subjects = selected; break; case "teachers": value.teachers = selected; break; default: value.periods = selected; }
    }
    /** Keep compatible selections. Reset incompatible selections to All within the new scope; explicit None stays None. */
    static void reconcile(JSONObject data, LessonReminderPlan.Settings value, String changed) {
        int index = ORDER.indexOf(changed);
        for (int i = index + 1; i < ORDER.size(); i++) {
            String field = ORDER.get(i); Set<String> current = selected(value, field);
            if (current == null || current.isEmpty()) continue;
            Set<String> remaining = new LinkedHashSet<>(current); remaining.retainAll(choices(data, value, field).keySet());
            select(value, field, remaining.isEmpty() ? null : remaining);
        }
    }
}
