package ug.trinityfamilyschool.photo;

import org.json.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

/** Subject choices and the next weekly occurrence, computed entirely from the saved snapshot. */
final class TrackedSubjects {
    static String key(String classId, String subjectId) {
        return new JSONArray().put(classId).put(subjectId).toString();
    }
    static JSONArray rows(JSONObject data, String dataset) {
        JSONObject saved = data.optJSONObject(dataset);
        JSONArray rows = saved == null ? null : saved.optJSONArray("data");
        return rows == null ? new JSONArray() : rows;
    }
    static String code(JSONObject data, String dataset, String id) {
        JSONObject item = TimetableSchedule.find(data, dataset, id);
        String code = item.optString("code").trim();
        if (!code.isEmpty()) return code;
        String name = item.optString("name", "").trim();
        if (name.isEmpty()) return "?";
        String[] words = name.split("\\s+");
        if (words.length == 1) return name.substring(0, Math.min(3, name.length())).toUpperCase(Locale.getDefault());
        StringBuilder initials = new StringBuilder();
        for (String word : words) if (initials.length() < 4 && !word.isEmpty()) initials.append(word.charAt(0));
        return initials.toString().toUpperCase(Locale.getDefault());
    }
    static Map<String, String> choices(JSONObject data) throws JSONException {
        Map<String, String> result = new LinkedHashMap<>();
        JSONArray tables = rows(data, "timetables");
        for (int i = 0; i < tables.length(); i++) {
            JSONObject table = tables.getJSONObject(i);
            if (!table.optBoolean("complete")) continue;
            JSONArray entries = table.optJSONArray("entries");
            if (entries == null) continue;
            for (int j = 0; j < entries.length(); j++) {
                JSONObject entry = entries.getJSONObject(j);
                if ("activity".equals(entry.optString("entryType"))) continue;
                String cls = entry.optString("classId");
                if (cls.isEmpty() || !includes(table.getJSONObject("profile").optJSONArray("classIds"), cls)) continue;
                for (String field : new String[]{"subjectId", "optionalSubjectId"}) {
                    String subject = entry.optString(field);
                    if (!subject.isEmpty()) result.put(key(cls, subject), TimetableSchedule.name(data, "classes", cls) + " · " + TimetableSchedule.name(data, "subjects", subject));
                }
            }
        }
        List<Map.Entry<String, String>> sorted = new ArrayList<>(result.entrySet());
        sorted.sort(Map.Entry.comparingByValue(String.CASE_INSENSITIVE_ORDER)); result.clear();
        for (Map.Entry<String, String> entry : sorted) result.put(entry.getKey(), entry.getValue());
        return result;
    }
    static String classCode(JSONObject data, JSONObject entry) {
        String value = code(data, "classes", entry.optString("classId"));
        String streamId = entry.optString("streamId");
        if (streamId.isEmpty()) return value;
        JSONObject schoolClass = TimetableSchedule.find(data, "classes", entry.optString("classId"));
        JSONArray streams = schoolClass.optJSONArray("streams"); JSONObject stream = new JSONObject();
        if (streams != null) for (int i = 0; i < streams.length(); i++) {
            JSONObject row = streams.optJSONObject(i);
            if (row != null && streamId.equals(row.optString("id"))) { stream = row; break; }
        }
        String streamCode = entry.optString("streamCode", stream.optString("code")).trim();
        if (streamCode.isEmpty()) {
            String name = entry.optString("streamName", stream.optString("name")).trim();
            StringBuilder initials = new StringBuilder();
            for (String word : name.split("\\s+")) if (!word.isEmpty()) initials.append(word.charAt(0));
            streamCode = initials.toString().toUpperCase(Locale.ROOT);
        }
        return value + (streamCode.isEmpty() ? "" : " " + streamCode);
    }
    static String subjectCode(JSONObject data, JSONObject entry) {
        String value = "activity".equals(entry.optString("entryType")) ? entry.optString("activityName", "Activity")
            : code(data, "subjects", entry.optString("subjectId"));
        String optional = entry.optString("optionalSubjectId");
        return value + (optional.isEmpty() ? "" : " / " + code(data, "subjects", optional));
    }
    private static boolean includes(JSONArray values, String id) {
        if (values != null) for (int i = 0; i < values.length(); i++) if (id.equals(values.optString(i))) return true;
        return false;
    }
    private static LocalDate termStart(JSONObject data, JSONObject profile) throws JSONException {
        JSONArray years = rows(data, "academicYears");
        for (int i = 0; i < years.length(); i++) {
            JSONObject year = years.getJSONObject(i);
            if (!profile.optString("academicYearId").equals(year.optString("id"))) continue;
            JSONArray terms = year.optJSONArray("terms");
            if (terms != null) for (int j = 0; j < terms.length(); j++) {
                JSONObject term = terms.getJSONObject(j);
                if (profile.optString("termId").equals(term.optString("id"))) {
                    try { return LocalDate.parse(term.getString("startDate").substring(0, 10)); }
                    catch (Exception ignored) { return null; }
                }
            }
        }
        return null;
    }
    static TimetableSchedule.Frame feed(JSONObject data, Set<String> selected, ZonedDateTime now) throws Exception {
        return feed(data, selected, now, false);
    }
    static TimetableSchedule.Frame feed(JSONObject data, Set<String> selected, ZonedDateTime now, boolean todayOnly) throws Exception {
        TimetableSchedule.Frame feed = new TimetableSchedule.Frame();
        feed.boundary = now.toLocalDate().plusDays(1).atStartOfDay(now.getZone()).toInstant().toEpochMilli();
        for (String key : new TreeSet<>(selected)) {
            JSONArray pair;
            try { pair = new JSONArray(key); if (pair.length() != 2) continue; } catch (JSONException ignored) { continue; }
            TimetableSchedule.Frame row = next(data, pair.getString(0), pair.getString(1), now, todayOnly);
            row.trackedSubject = key;
            feed.profiles.add(row); feed.boundary = Math.min(feed.boundary, row.boundary);
            feed.active |= row.active;
        }
        feed.profiles.sort(Comparator.comparingInt((TimetableSchedule.Frame row) -> row.active ? 0 : 1).thenComparingLong(row -> row.countdownEnd == 0 ? Long.MAX_VALUE : row.countdownEnd));
        return feed;
    }
    static TimetableSchedule.Frame next(JSONObject data, String classId, String subjectId, ZonedDateTime now) throws Exception {
        return next(data, classId, subjectId, now, false);
    }
    static TimetableSchedule.Frame next(JSONObject data, String classId, String subjectId, ZonedDateTime now, boolean todayOnly) throws Exception {
        TimetableSchedule.Frame row = new TimetableSchedule.Frame();
        row.classCode = code(data, "classes", classId); row.subjectCode = code(data, "subjects", subjectId);
        row.title = TimetableSchedule.name(data, "subjects", subjectId);
        row.className = TimetableSchedule.name(data, "classes", classId);
        row.tableName = row.className; row.timeZone = now.getZone().getId();
        row.time = todayOnly ? "No lesson today" : "No upcoming lesson in saved timetables";
        row.boundary = now.toLocalDate().plusDays(1).atStartOfDay(now.getZone()).toInstant().toEpochMilli();
        long millis = now.toInstant().toEpochMilli(), best = Long.MAX_VALUE;
        boolean complete = false, dated = false, finishedToday = false;
        JSONArray tables = rows(data, "timetables");
        for (int t = 0; t < tables.length(); t++) {
            JSONObject table = tables.getJSONObject(t), profile = table.getJSONObject("profile");
            if (!table.optBoolean("complete") || !includes(profile.optJSONArray("classIds"), classId)) continue;
            complete = true;
            LocalDate startOfTerm = termStart(data, profile);
            if (startOfTerm == null) continue;
            dated = true;
            JSONArray raw = table.optJSONArray("periods"), entries = table.optJSONArray("entries");
            if (raw == null || entries == null) continue;
            for (int day = 1; day <= 7; day++) {
                LocalDate from = now.toLocalDate().isBefore(startOfTerm) ? startOfTerm : now.toLocalDate();
                LocalDate date = from.with(TemporalAdjusters.nextOrSame(DayOfWeek.of(day)));
                if (todayOnly && !date.equals(now.toLocalDate())) continue;
                List<JSONObject> periods = new ArrayList<>();
                for (int p = 0; p < raw.length(); p++) if (raw.getJSONObject(p).optInt("dayOfWeek") == day) periods.add(raw.getJSONObject(p));
                periods.sort(Comparator.comparing(p -> p.optString("startTime")));
                Map<String, Integer> covered = new HashMap<>();
                for (int p = 0; p < periods.size(); p++) {
                    JSONObject period = periods.get(p);
                    if (!"lesson".equals(period.optString("type"))) continue;
                    boolean separate = "separate".equals(TimetableUpdates.mode(profile, classId, day, period.optString("id")));
                    for (int e = 0; e < entries.length(); e++) {
                        JSONObject entry = entries.getJSONObject(e); String stream = entry.optString("streamId");
                        if (!classId.equals(entry.optString("classId")) || !period.optString("id").equals(entry.optString("periodId")) || separate == stream.isEmpty()) continue;
                        if (covered.getOrDefault(stream, -1) >= p) continue;
                        int last = p;
                        while (last + 1 < periods.size() && last - p + 1 < Math.max(1, entry.optInt("periodSpan", 1)) && "lesson".equals(periods.get(last + 1).optString("type"))) last++;
                        covered.put(stream, last);
                        if ("activity".equals(entry.optString("entryType")) || !(subjectId.equals(entry.optString("subjectId")) || subjectId.equals(entry.optString("optionalSubjectId")))) continue;
                        try {
                            ZonedDateTime begin = date.atTime(LocalTime.parse(period.getString("startTime"))).atZone(now.getZone());
                            ZonedDateTime finish = date.atTime(LocalTime.parse(periods.get(last).getString("endTime"))).atZone(now.getZone());
                            if (!finish.isAfter(begin)) continue;
                            if (finish.toInstant().toEpochMilli() <= millis) {
                                finishedToday |= finish.toLocalDate().equals(now.toLocalDate()) && Boolean.TRUE.equals(TimetableUpdates.withinTerm(data, profile, date));
                                if (todayOnly) continue;
                                begin = begin.plusWeeks(1); finish = finish.plusWeeks(1);
                            }
                            if (!Boolean.TRUE.equals(TimetableUpdates.withinTerm(data, profile, begin.toLocalDate()))) continue;
                            long start = begin.toInstant().toEpochMilli(), end = finish.toInstant().toEpochMilli();
                            if (start >= best) continue;
                            best = start; row.profileId = profile.optString("id"); row.periodId = period.optString("id");
                            row.active = start <= millis; row.hasPeriod = true; row.start = start; row.end = end;
                            row.countdownEnd = row.active ? end : start;
                            row.boundary = Math.min(now.toLocalDate().plusDays(1).atStartOfDay(now.getZone()).toInstant().toEpochMilli(), row.countdownEnd);
                            row.progress = TimetableSchedule.progress(start, end, millis);
                            row.time = (row.active ? "Now · " : "Next · ") + begin.format(DateTimeFormatter.ofPattern("EEE, d MMM · HH:mm", Locale.getDefault())) + " – " + finish.format(DateTimeFormatter.ofPattern("HH:mm"));
                            boolean optional = !subjectId.equals(entry.optString("subjectId"));
                            row.teacher = TimetableSchedule.name(data, "teachers", entry.optString(optional ? "optionalTeacherId" : "teacherId"));
                            String coTeacher = TimetableSchedule.name(data, "teachers", entry.optString(optional ? "coOptionalTeacherId" : "coTeacherId"));
                            if (!coTeacher.isEmpty()) row.teacher += (row.teacher.isEmpty() ? "" : " / ") + coTeacher;
                            row.agenda = streamName(data, classId, stream);
                            if (!row.teacher.isEmpty()) row.agenda += (row.agenda.isEmpty() ? "" : " · ") + row.teacher;
                            row.agenda += (row.agenda.isEmpty() ? "" : " · ") + profile.optString("name", "Timetable");
                        } catch (DateTimeException ignored) { /* An invalid saved period cannot invent a lesson. */ }
                    }
                }
            }
        }
        if (best == Long.MAX_VALUE && todayOnly && finishedToday) row.time = "Done today";
        if (best == Long.MAX_VALUE && !complete) row.time = "Connect to load this class timetable";
        else if (best == Long.MAX_VALUE && !dated) row.time = "Connect to load term dates";
        return row;
    }
    private static String streamName(JSONObject data, String classId, String streamId) {
        JSONArray streams = TimetableSchedule.find(data, "classes", classId).optJSONArray("streams");
        if (streams != null) for (int i = 0; i < streams.length(); i++) {
            JSONObject stream = streams.optJSONObject(i);
            if (stream != null && streamId.equals(stream.optString("id"))) return stream.optString("name", stream.optString("code"));
        }
        return streamId.isEmpty() ? "" : "Stream " + streamId;
    }
}
