package ug.trinityfamilyschool.photo;

import org.json.*;
import java.time.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Pure, clock-injected reminder planning. No network, device state, or pupil data. */
final class LessonReminderPlan {
    static final long LATE_LIMIT = 5 * 60_000L;
    static final class Settings {
        boolean enabled, starts = true, ends, activities = true, breaks, quiet;
        int beforeStart = 5, beforeEnd, days = 31, snooze = 5;
        String quietStart = "20:00", quietEnd = "07:00", alert = "sound";
        // null means all; an empty set deliberately means none.
        Set<String> tables, classes, subjects, teachers, periods;
        Settings(JSONObject json) {
            if (json == null) return;
            enabled = json.optBoolean("enabled"); starts = json.optBoolean("starts", true); ends = json.optBoolean("ends");
            activities = json.optBoolean("activities", true); breaks = json.optBoolean("breaks"); quiet = json.optBoolean("quiet");
            beforeStart = minutes(json.optInt("beforeStart", 5)); beforeEnd = minutes(json.optInt("beforeEnd"));
            days = json.optInt("days", 31) & 127; snooze = Math.max(1, Math.min(30, json.optInt("snooze", 5)));
            quietStart = validTime(json.optString("quietStart", "20:00"), "20:00"); quietEnd = validTime(json.optString("quietEnd", "07:00"), "07:00");
            alert = json.optString("alert", "sound"); if (!Arrays.asList("sound", "vibrate", "silent").contains(alert)) alert = "sound";
            tables = ids(json, "tables"); classes = ids(json, "classes"); subjects = ids(json, "subjects"); teachers = ids(json, "teachers"); periods = ids(json, "periods");
        }
        JSONObject json() throws JSONException {
            return new JSONObject().put("enabled", enabled).put("starts", starts).put("ends", ends).put("activities", activities).put("breaks", breaks)
                .put("beforeStart", beforeStart).put("beforeEnd", beforeEnd).put("days", days).put("snooze", snooze).put("quiet", quiet)
                .put("quietStart", quietStart).put("quietEnd", quietEnd).put("alert", alert)
                .put("tables", array(tables)).put("classes", array(classes)).put("subjects", array(subjects)).put("teachers", array(teachers)).put("periods", array(periods));
        }
        private static int minutes(int value) { return Math.max(0, Math.min(60, value)); }
        private static String validTime(String value, String fallback) { try { return LocalTime.parse(value).toString(); } catch (Exception ignored) { return fallback; } }
        private static Set<String> ids(JSONObject json, String key) {
            if (!json.has(key) || json.isNull(key)) return null;
            JSONArray raw = json.optJSONArray(key); Set<String> result = new LinkedHashSet<>();
            if (raw != null) for (int i = 0; i < raw.length(); i++) if (!raw.optString(i).isEmpty()) result.add(raw.optString(i));
            return result;
        }
        private static Object array(Set<String> set) { return set == null ? JSONObject.NULL : new JSONArray(set); }
        boolean quietAt(ZonedDateTime time) {
            if (!quiet) return false;
            LocalTime start = LocalTime.parse(quietStart), end = LocalTime.parse(quietEnd), value = time.toLocalTime();
            if (start.equals(end)) return true;
            return start.isBefore(end) ? !value.isBefore(start) && value.isBefore(end) : !value.isBefore(start) || value.isBefore(end);
        }
    }
    static final class Event {
        long at, start, end;
        String identity, tableId, tableName, classLabel, subject, teacher, kind;
        String line() {
            String verb = "start".equals(kind) ? "starts now" : "end".equals(kind) ? "ended" : "beforeStart".equals(kind) ? "starts in " + ((start-at)/60_000L) + " min" : "ends in " + ((end-at)/60_000L) + " min";
            return (classLabel.isEmpty() ? tableName : classLabel) + " · " + subject + " · " + verb;
        }
    }
    static boolean includes(Set<String> selected, String id) { return selected == null || selected.contains(id); }
    static JSONArray rows(JSONObject data, String key) { JSONObject wrapper = data.optJSONObject(key); JSONArray rows = wrapper == null ? null : wrapper.optJSONArray("data"); return rows == null ? new JSONArray() : rows; }
    static List<Event> events(JSONObject data, Settings settings, ZonedDateTime from, long through) throws Exception {
        List<Event> result = new ArrayList<>(); if (!settings.enabled || through < from.toInstant().toEpochMilli()) return result;
        JSONArray tables = rows(data, "timetables");
        // A bounded rolling horizon covers offline use without unbounded alarm lists.
        for (int day = 0; day < 8; day++) {
            LocalDate date = from.toLocalDate().plusDays(day);
            if ((settings.days & (1 << (date.getDayOfWeek().getValue() - 1))) == 0) continue;
            for (int i = 0; i < tables.length(); i++) {
                JSONObject table = tables.optJSONObject(i); if (table == null || !table.optBoolean("complete")) continue;
                JSONObject profile = table.optJSONObject("profile");
                if (profile == null || !includes(settings.tables, profile.optString("id")) || !Boolean.TRUE.equals(TimetableUpdates.withinTerm(data, profile, date))) continue;
                List<JSONObject> periods = new ArrayList<>(); JSONArray raw = table.optJSONArray("periods"), entries = table.optJSONArray("entries"), classIds = profile.optJSONArray("classIds");
                if (raw == null || entries == null || classIds == null) continue;
                for (int p = 0; p < raw.length(); p++) { JSONObject period = raw.optJSONObject(p); if (period != null && period.optInt("dayOfWeek") == date.getDayOfWeek().getValue()) periods.add(period); }
                periods.sort(Comparator.comparing(p -> p.optString("startTime")));
                Map<String, Integer> covered = new HashMap<>();
                for (int p = 0; p < periods.size(); p++) {
                    JSONObject period = periods.get(p);
                    try {
                        if (!"lesson".equals(period.optString("type"))) {
                            boolean relevant = false; for (int c = 0; c < classIds.length(); c++) relevant |= includes(settings.classes, classIds.optString(c));
                            if (settings.breaks && relevant && includes(settings.periods, profile.optString("id") + "|" + period.optString("id"))) add(result, settings, from, through, date, profile, period, period, null, "", period.optString("customLabel", period.optString("type")), "");
                            continue;
                        }
                        for (int e = 0; e < entries.length(); e++) {
                            JSONObject entry = entries.optJSONObject(e); if (entry == null || !period.optString("id").equals(entry.optString("periodId"))) continue;
                            String classId = entry.optString("classId"), stream = entry.optString("streamId"); boolean member = false;
                            for (int c = 0; c < classIds.length(); c++) member |= classId.equals(classIds.optString(c));
                            if (!member || !includes(settings.classes, classId)) continue;
                            String mode = TimetableUpdates.mode(profile, classId, date.getDayOfWeek().getValue(), period.optString("id"));
                            if ("separate".equals(mode) ? stream.isEmpty() : !stream.isEmpty()) continue;
                            String rowKey = classId + "|" + stream;
                            if (covered.getOrDefault(rowKey, -1) >= p) continue;
                            int last = p;
                            while (last + 1 < periods.size() && last - p + 1 < Math.max(1, entry.optInt("periodSpan", 1))) {
                                JSONObject following = periods.get(last + 1);
                                if (!"lesson".equals(following.optString("type")) || !periods.get(last).optString("endTime").equals(following.optString("startTime"))) break;
                                last++;
                            }
                            covered.put(rowKey, last);
                            if (!includes(settings.periods, profile.optString("id") + "|" + period.optString("id"))) continue;
                            boolean activity = "activity".equals(entry.optString("entryType"));
                            if (activity && !settings.activities) continue;
                            if (!includes(settings.subjects, entry.optString("subjectId")) && !includes(settings.subjects, entry.optString("optionalSubjectId"))) continue;
                            if (!includes(settings.teachers, entry.optString("teacherId")) && !includes(settings.teachers, entry.optString("optionalTeacherId"))) continue;
                            if (!activity && entry.optString("subjectId").isEmpty()) continue;
                            String label = TimetableSchedule.name(data, "classes", classId);
                            JSONObject classRow = TimetableSchedule.find(data, "classes", classId); JSONArray streams = classRow.optJSONArray("streams");
                            if (!stream.isEmpty()) {
                                String streamName = stream;
                                if (streams != null) for (int s = 0; s < streams.length(); s++) if (stream.equals(streams.optJSONObject(s).optString("id"))) streamName = streams.optJSONObject(s).optString("name", stream);
                                label += " · " + streamName;
                            }
                            String subject = activity ? entry.optString("activityName", "Activity") : TimetableSchedule.name(data, "subjects", entry.optString("subjectId"));
                            if (!entry.optString("optionalSubjectId").isEmpty()) subject += " / " + TimetableSchedule.name(data, "subjects", entry.optString("optionalSubjectId"));
                            String teacher = TimetableSchedule.name(data, "teachers", entry.optString("teacherId"));
                            if (!entry.optString("optionalTeacherId").isEmpty()) teacher += (teacher.isEmpty() ? "" : " / ") + TimetableSchedule.name(data, "teachers", entry.optString("optionalTeacherId"));
                            add(result, settings, from, through, date, profile, period, periods.get(last), entry, label, subject, teacher);
                        }
                    } catch (DateTimeException | JSONException ignored) { /* One malformed period cannot suppress the rest. */ }
                }
            }
        }
        result.sort(Comparator.comparingLong((Event event) -> event.at).thenComparing(event -> event.identity));
        Set<String> seen = new HashSet<>(); result.removeIf(event -> !seen.add(event.identity)); return result;
    }
    private static void add(List<Event> result, Settings settings, ZonedDateTime from, long through, LocalDate date, JSONObject profile, JSONObject first, JSONObject last, JSONObject entry, String label, String subject, String teacher) throws Exception {
        long start = date.atTime(LocalTime.parse(first.getString("startTime"))).atZone(from.getZone()).toInstant().toEpochMilli();
        long end = date.atTime(LocalTime.parse(last.getString("endTime"))).atZone(from.getZone()).toInstant().toEpochMilli();
        if (end <= start) return;
        if (settings.starts) event(result, settings, from, through, start, start, end, "start", profile, first, entry, label, subject, teacher);
        if (settings.ends) event(result, settings, from, through, end, start, end, "end", profile, first, entry, label, subject, teacher);
        if (settings.beforeStart > 0) event(result, settings, from, through, start - settings.beforeStart * 60_000L, start, end, "beforeStart", profile, first, entry, label, subject, teacher);
        if (settings.beforeEnd > 0 && start < end - settings.beforeEnd * 60_000L) event(result, settings, from, through, end - settings.beforeEnd * 60_000L, start, end, "beforeEnd", profile, first, entry, label, subject, teacher);
    }
    private static void event(List<Event> result, Settings settings, ZonedDateTime from, long through, long at, long start, long end, String kind, JSONObject profile, JSONObject period, JSONObject entry, String label, String subject, String teacher) throws Exception {
        ZonedDateTime time = Instant.ofEpochMilli(at).atZone(from.getZone());
        if (at < from.toInstant().toEpochMilli() || at > through || settings.quietAt(time) || (settings.days & (1 << (time.getDayOfWeek().getValue()-1))) == 0) return;
        Event event = new Event(); event.at = at; event.start = start; event.end = end; event.kind = kind;
        event.tableId = profile.optString("id"); event.tableName = profile.optString("name", "Timetable"); event.classLabel = label; event.subject = subject; event.teacher = teacher;
        event.identity = digest(event.tableId + "|" + period.optString("id") + "|" + (entry == null ? "break" : entry.optString("classId") + "|" + entry.optString("streamId")) + "|" + at + "|" + start + "|" + end + "|" + kind + "|" + subject + "|" + teacher);
        result.add(event);
    }
    static List<Event> at(List<Event> events, long when) { List<Event> result = new ArrayList<>(); for (Event event : events) if (event.at == when) result.add(event); return result; }
    static String token(List<Event> events) throws Exception { List<String> ids = new ArrayList<>(); for (Event event : events) ids.add(event.identity); Collections.sort(ids); return digest(String.join("|", ids)); }
    static String digest(String value) throws Exception {
        byte[] bytes = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); char[] output = new char[bytes.length * 2];
        char[] hex = "0123456789abcdef".toCharArray();
        for (int i = 0; i < bytes.length; i++) { output[i*2] = hex[(bytes[i] & 255) >>> 4]; output[i*2+1] = hex[bytes[i] & 15]; } return new String(output);
    }
}
