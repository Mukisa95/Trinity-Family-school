package ug.trinityfamilyschool.photo;

import org.json.JSONArray;
import org.json.JSONObject;
import java.time.*;
import java.util.*;

/** Clock-injected, view-independent model shared by the card and every widget. */
final class TimetableSchedule {
    static final class Lesson {
        String name, time, teacher; long start, end;
    }
    static final class Frame {
        String className = "All timetables", tableName = "", title = "Timetable unavailable", time = "", teacher = "", next = "Open Trinity School", agenda = "";
        final List<Frame> profiles = new ArrayList<>();
        int progress, remainingMinutes; long end, boundary; boolean active;
    }
    static String name(JSONObject datasets, String dataset, String id) {
        JSONObject container = datasets.optJSONObject(dataset); JSONArray rows = container == null ? null : container.optJSONArray("data");
        if (rows != null) for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.optJSONObject(i);
            if (row != null && id.equals(row.optString("id"))) return row.optString("name", (row.optString("lastName") + " " + row.optString("firstName")).trim());
        }
        return id.isEmpty() ? "" : "Information unavailable";
    }
    static JSONObject table(JSONObject datasets, String id) {
        JSONObject saved = datasets.optJSONObject("timetables"); JSONArray tables = saved == null ? null : saved.optJSONArray("data");
        if (tables != null) for (int i = 0; i < tables.length(); i++) {
            JSONObject value = tables.optJSONObject(i);
            if (value != null && id.equals(value.optJSONObject("profile").optString("id"))) return value;
        }
        return null;
    }
    static Frame build(JSONObject datasets, String tableId, String classId, String streamId, ZonedDateTime now) throws Exception {
        Frame frame = new Frame(); LocalDate today = now.toLocalDate();
        frame.boundary = today.plusDays(1).atStartOfDay(now.getZone()).toInstant().toEpochMilli();
        JSONObject table = table(datasets, tableId);
        if (table == null || !table.optBoolean("complete")) { frame.title = "Timetable unavailable"; frame.next = "Connect to load your timetable"; return frame; }
        JSONObject profile = table.getJSONObject("profile"); frame.tableName = profile.optString("name");
        frame.className = name(datasets, "classes", classId);
        if (!streamId.isEmpty()) {
            JSONObject saved = datasets.optJSONObject("classes"); JSONArray classes = saved == null ? null : saved.optJSONArray("data");
            if (classes != null) for (int i = 0; i < classes.length(); i++) {
                JSONObject row = classes.getJSONObject(i); if (!classId.equals(row.optString("id"))) continue;
                JSONArray streams = row.optJSONArray("streams");
                if (streams != null) for (int j = 0; j < streams.length(); j++) if (streamId.equals(streams.getJSONObject(j).optString("id"))) frame.className += " · " + streams.getJSONObject(j).optString("name", streams.getJSONObject(j).optString("code"));
            }
        }
        Boolean inTerm = TimetableUpdates.withinTerm(datasets, profile, today);
        if (inTerm == null) { frame.title = "Academic dates unavailable"; frame.next = "Connect to load term dates"; return frame; }
        if (!inTerm) { frame.title = "Outside this school term"; frame.next = "Tap to view the timetable"; return frame; }
        JSONArray raw = table.getJSONArray("periods"), entries = table.getJSONArray("entries");
        List<JSONObject> periods = new ArrayList<>();
        for (int i = 0; i < raw.length(); i++) if (raw.getJSONObject(i).optInt("dayOfWeek") == now.getDayOfWeek().getValue()) periods.add(raw.getJSONObject(i));
        periods.sort(Comparator.comparingInt(row -> row.optInt("periodNumber")));
        List<Lesson> lessons = new ArrayList<>();
        for (int i = 0; i < periods.size(); i++) {
            JSONObject period = periods.get(i), entry = null;
            String mode = TimetableUpdates.mode(profile, classId, now.getDayOfWeek().getValue(), period.getString("id"));
            for (int j = 0; j < entries.length(); j++) {
                JSONObject candidate = entries.getJSONObject(j);
                if (classId.equals(candidate.optString("classId")) && period.getString("id").equals(candidate.optString("periodId"))
                    && ("separate".equals(mode) ? !streamId.isEmpty() && streamId.equals(candidate.optString("streamId")) : candidate.optString("streamId").isEmpty())) { entry = candidate; break; }
            }
            int endIndex = i;
            if (entry != null && "lesson".equals(period.optString("type"))) while (endIndex + 1 < periods.size() && endIndex - i + 1 < Math.max(1, entry.optInt("periodSpan", 1)) && "lesson".equals(periods.get(endIndex + 1).optString("type"))) endIndex++;
            Lesson lesson = new Lesson();
            lesson.name = !"lesson".equals(period.optString("type")) ? period.optString("customLabel", period.optString("type"))
                : entry == null ? ("separate".equals(mode) && streamId.isEmpty() ? "Choose a stream" : "Unassigned lesson")
                : "activity".equals(entry.optString("entryType")) ? entry.optString("activityName", "Activity") : name(datasets, "subjects", entry.optString("subjectId"));
            if (entry != null && !entry.optString("optionalSubjectId").isEmpty()) lesson.name += " / " + name(datasets, "subjects", entry.optString("optionalSubjectId"));
            lesson.teacher = entry == null ? "" : name(datasets, "teachers", entry.optString("teacherId"));
            lesson.time = period.getString("startTime") + " – " + periods.get(endIndex).getString("endTime");
            lesson.start = today.atTime(LocalTime.parse(period.getString("startTime"))).atZone(now.getZone()).toInstant().toEpochMilli();
            lesson.end = today.atTime(LocalTime.parse(periods.get(endIndex).getString("endTime"))).atZone(now.getZone()).toInstant().toEpochMilli();
            lessons.add(lesson); i = endIndex;
        }
        long millis = now.toInstant().toEpochMilli(); Lesson current = null, next = null; StringBuilder agenda = new StringBuilder(); int upcoming = 0;
        for (Lesson lesson : lessons) {
            if (lesson.start <= millis && millis < lesson.end) { current = lesson; frame.boundary = Math.min(frame.boundary, lesson.end); }
            if (lesson.start > millis) {
                if (next == null) { next = lesson; frame.boundary = Math.min(frame.boundary, lesson.start); }
                if (upcoming++ < 3) { if (agenda.length() > 0) agenda.append('\n'); agenda.append(lesson.time).append("  ").append(lesson.name); }
            }
        }
        frame.title = current == null ? "No lesson now" : current.name;
        frame.next = next == null ? "No more periods today" : "Next: " + next.name + " · " + next.time;
        frame.agenda = agenda.toString();
        if (current != null) {
            frame.active = true; frame.time = current.time; frame.teacher = current.teacher; frame.end = current.end;
            frame.progress = progress(current.start, current.end, millis);
            frame.remainingMinutes = (int) Math.max(0, (current.end - millis + 59999L) / 60000L);
        }
        return frame;
    }
    static int progress(long start, long end, long now) { return end <= start ? 0 : (int) Math.max(0, Math.min(100, (now - start) * 100 / (end - start))); }

    /** All profiles in the dashboard's current year/term; no class selection. */
    static Frame feed(JSONObject datasets, ZonedDateTime now) throws Exception {
        Frame feed = new Frame();
        feed.boundary = now.toLocalDate().plusDays(1).atStartOfDay(now.getZone()).toInstant().toEpochMilli();
        JSONObject yearsData = datasets.optJSONObject("academicYears"), tablesData = datasets.optJSONObject("timetables");
        JSONArray years = yearsData == null ? null : yearsData.optJSONArray("data"), tables = tablesData == null ? null : tablesData.optJSONArray("data");
        JSONObject year = null, term = null;
        if (years != null) {
            for (int i = 0; i < years.length(); i++) if (containsDate(years.getJSONObject(i), now.toLocalDate())) { year = years.getJSONObject(i); break; }
            if (year == null) for (int i = 0; i < years.length(); i++) if (years.getJSONObject(i).optBoolean("isActive")) { year = years.getJSONObject(i); break; }
            if (year == null && years.length() > 0) year = years.getJSONObject(0);
            JSONArray terms = year == null ? null : year.optJSONArray("terms");
            if (terms != null) {
                for (int i = 0; i < terms.length(); i++) if (containsDate(terms.getJSONObject(i), now.toLocalDate())) { term = terms.getJSONObject(i); break; }
                if (term == null) for (int i = 0; i < terms.length(); i++) if (terms.getJSONObject(i).optBoolean("isCurrent")) { term = terms.getJSONObject(i); break; }
                if (term == null && terms.length() > 0) term = terms.getJSONObject(0);
            }
        }
        StringBuilder details = new StringBuilder();
        if (tables != null && year != null && term != null) for (int i = 0; i < tables.length(); i++) {
            JSONObject table = tables.getJSONObject(i), profile = table.getJSONObject("profile");
            if (!year.optString("id").equals(profile.optString("academicYearId")) || !term.optString("id").equals(profile.optString("termId"))) continue;
            Frame row = profileFrame(datasets, table, now); feed.profiles.add(row);
            feed.boundary = Math.min(feed.boundary, row.boundary);
            if (row.active && (!feed.active || row.end < feed.end)) { feed.end = row.end; feed.progress = row.progress; feed.remainingMinutes = row.remainingMinutes; }
            feed.active |= row.active;
            if (details.length() > 0) details.append("\n\n");
            details.append(row.tableName).append(" · ").append(row.title).append("\n").append(row.time);
            if (!row.agenda.isEmpty()) details.append("\n").append(row.agenda);
            details.append("\n").append(row.next);
        }
        feed.title = feed.profiles.isEmpty() ? "No timetables available" : feed.profiles.size() + (feed.profiles.size() == 1 ? " timetable" : " timetables");
        feed.time = feed.active ? "All classes · next change in " + feed.remainingMinutes + " min" : "All classes";
        feed.next = "Open timetables"; feed.agenda = details.toString();
        return feed;
    }
    private static boolean containsDate(JSONObject value, LocalDate date) {
        try { return !date.isBefore(LocalDate.parse(value.getString("startDate").substring(0, 10))) && !date.isAfter(LocalDate.parse(value.getString("endDate").substring(0, 10))); }
        catch (Exception ignored) { return false; }
    }
    private static Frame profileFrame(JSONObject datasets, JSONObject table, ZonedDateTime now) throws Exception {
        Frame row = new Frame(); JSONObject profile = table.getJSONObject("profile"); row.tableName = profile.optString("name", "Timetable"); row.className = row.tableName;
        row.boundary = now.toLocalDate().plusDays(1).atStartOfDay(now.getZone()).toInstant().toEpochMilli();
        if (!table.optBoolean("complete")) { row.title = "Timetable loading"; return row; }
        if (!Boolean.TRUE.equals(TimetableUpdates.withinTerm(datasets, profile, now.toLocalDate()))) { row.title = "Outside this school term"; return row; }
        List<JSONObject> periods = new ArrayList<>(); JSONArray raw = table.getJSONArray("periods");
        for (int i = 0; i < raw.length(); i++) if (raw.getJSONObject(i).optInt("dayOfWeek") == now.getDayOfWeek().getValue()) periods.add(raw.getJSONObject(i));
        periods.sort(Comparator.comparing(p -> p.optString("startTime")));
        JSONObject shown = null, next = null; String time = now.toLocalTime().toString().substring(0, 5);
        for (JSONObject period : periods) {
            if (time.compareTo(period.getString("startTime")) >= 0 && time.compareTo(period.getString("endTime")) < 0) { shown = period; row.active = true; }
            if (time.compareTo(period.getString("startTime")) < 0 && next == null) next = period;
        }
        if (shown == null) shown = next;
        if (shown == null && !periods.isEmpty()) shown = periods.get(periods.size() - 1);
        if (shown == null) { row.title = "No more periods today"; row.next = "Open timetable"; return row; }
        boolean ended = time.compareTo(shown.getString("endTime")) >= 0;
        row.title = periodName(shown) + (row.active ? "" : ended ? " · ended" : " · upcoming"); row.time = shown.getString("startTime") + " – " + shown.getString("endTime");
        long start = now.toLocalDate().atTime(LocalTime.parse(shown.getString("startTime"))).atZone(now.getZone()).toInstant().toEpochMilli();
        row.end = now.toLocalDate().atTime(LocalTime.parse(shown.getString("endTime"))).atZone(now.getZone()).toInstant().toEpochMilli();
        if (!ended) row.boundary = row.active ? row.end : start;
        row.progress = ended ? 100 : row.active ? progress(start, row.end, now.toInstant().toEpochMilli()) : 0;
        row.remainingMinutes = row.active ? (int) ((row.end - now.toInstant().toEpochMilli() + 59999) / 60000) : 0;
        int shownIndex = periods.indexOf(shown); JSONObject following = shownIndex + 1 < periods.size() ? periods.get(shownIndex + 1) : null;
        row.next = following == null ? "No more periods today" : "Next: " + periodName(following) + " · " + following.getString("startTime");
        if (!"lesson".equals(shown.optString("type"))) return row;
        ZonedDateTime sample = row.active ? now : Instant.ofEpochMilli(start).atZone(now.getZone());
        JSONArray classes = profile.getJSONArray("classIds"), entries = table.getJSONArray("entries"); StringBuilder subjects = new StringBuilder();
        for (int i = 0; i < classes.length(); i++) {
            String classId = classes.getString(i), label = name(datasets, "classes", classId);
            Set<String> streams = new LinkedHashSet<>();
            if ("separate".equals(TimetableUpdates.mode(profile, classId, sample.getDayOfWeek().getValue(), shown.getString("id")))) {
                JSONObject classesData = datasets.optJSONObject("classes"); JSONArray all = classesData == null ? null : classesData.optJSONArray("data");
                if (all != null) for (int j = 0; j < all.length(); j++) if (classId.equals(all.getJSONObject(j).optString("id"))) {
                    JSONArray configured = all.getJSONObject(j).optJSONArray("streams");
                    if (configured != null) for (int k = 0; k < configured.length(); k++) streams.add(configured.getJSONObject(k).getString("id"));
                }
                for (int j = 0; j < entries.length(); j++) { JSONObject entry = entries.getJSONObject(j); if (classId.equals(entry.optString("classId")) && !entry.optString("streamId").isEmpty()) streams.add(entry.optString("streamId")); }
            }
            if (streams.isEmpty()) streams.add("");
            for (String stream : streams) {
                Frame lesson = build(datasets, profile.getString("id"), classId, stream, sample);
                if (subjects.length() > 0) subjects.append('\n');
                subjects.append(stream.isEmpty() ? label : lesson.className).append(" · ").append("Choose a stream".equals(lesson.title) ? "Unassigned lesson" : lesson.title);
            }
        }
        row.agenda = subjects.toString(); return row;
    }
    private static String periodName(JSONObject period) { return "lesson".equals(period.optString("type")) ? "Lesson " + period.optInt("periodNumber") : period.optString("customLabel", period.optString("type")); }
}
