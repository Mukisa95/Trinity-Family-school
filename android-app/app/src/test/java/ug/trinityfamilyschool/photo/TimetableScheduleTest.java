package ug.trinityfamilyschool.photo;
import org.json.*;
import org.junit.Test;
import java.time.*;
import static org.junit.Assert.*;

public class TimetableScheduleTest {
    private JSONObject data() throws Exception {
        JSONObject profile = new JSONObject().put("id", "main").put("academicYearId", "year").put("termId", "term").put("classIds", new JSONArray().put("p4").put("p5"));
        JSONArray periods = new JSONArray();
        for (int i = 0; i < 4; i++) periods.put(new JSONObject().put("id", "period-" + i).put("dayOfWeek", 3).put("periodNumber", i + 1).put("type", i == 2 ? "break" : "lesson")
            .put("startTime", new String[]{"08:00", "09:00", "10:00", "10:15"}[i]).put("endTime", new String[]{"09:00", "10:00", "10:15", "11:00"}[i]));
        JSONArray entries = new JSONArray()
            .put(new JSONObject().put("classId", "p4").put("periodId", "period-0").put("subjectId", "english").put("teacherId", "teacher").put("periodSpan", 2))
            .put(new JSONObject().put("classId", "p5").put("periodId", "period-0").put("subjectId", "math").put("periodSpan", 2))
            .put(new JSONObject().put("classId", "p4").put("periodId", "period-3").put("subjectId", "science"));
        return new JSONObject()
            .put("timetables", new JSONObject().put("data", new JSONArray().put(new JSONObject().put("complete", true).put("profile", profile).put("periods", periods).put("entries", entries))))
            .put("academicYears", new JSONObject().put("data", new JSONArray().put(new JSONObject().put("id", "year").put("terms", new JSONArray().put(new JSONObject().put("id", "term").put("startDate", "2026-09-01").put("endDate", "2026-12-01"))))))
            .put("classes", new JSONObject().put("data", new JSONArray().put(new JSONObject().put("id", "p4").put("name", "Primary Four")).put(new JSONObject().put("id", "p5").put("name", "Primary Five"))))
            .put("subjects", new JSONObject().put("data", new JSONArray().put(new JSONObject().put("id", "english").put("name", "English")).put(new JSONObject().put("id", "math").put("name", "Mathematics")).put(new JSONObject().put("id", "science").put("name", "Science"))))
            .put("teachers", new JSONObject().put("data", new JSONArray().put(new JSONObject().put("id", "teacher").put("lastName", "Example").put("firstName", "Teacher"))));
    }
    private ZonedDateTime time(String value) { return LocalDateTime.parse(value).atZone(ZoneId.of("Africa/Kampala")); }
    @Test public void feedShowsEveryProfileClassAndStreamWithoutSelection() throws Exception {
        JSONObject datasets = data(); JSONArray tables = datasets.getJSONObject("timetables").getJSONArray("data");
        tables.getJSONObject(0).getJSONObject("profile").put("name", "Upper Primary");
        JSONObject second = new JSONObject(tables.getJSONObject(0).toString());
        second.getJSONObject("profile").put("id", "lower").put("name", "Lower Primary"); tables.put(second);
        JSONObject historical = new JSONObject(second.toString()); historical.getJSONObject("profile").put("id", "old").put("termId", "old-term"); tables.put(historical);
        TimetableSchedule.Frame feed = TimetableSchedule.feed(datasets, time("2026-10-07T09:30:00"));
        assertEquals(2, feed.profiles.size()); assertTrue(feed.agenda.contains("Upper Primary")); assertTrue(feed.agenda.contains("Lower Primary")); assertFalse(feed.agenda.contains("old-term"));
        assertTrue(feed.profiles.get(0).agenda.contains("Primary Four · English")); assertTrue(feed.profiles.get(0).agenda.contains("Primary Five · Mathematics"));
        assertEquals(50, feed.progress); assertEquals(30, feed.remainingMinutes);
        second.getJSONObject("profile").put("streamLayouts", new JSONObject().put("p4", new JSONObject().put("defaultMode", "separate")));
        second.getJSONArray("entries").getJSONObject(0).put("streamId", "north");
        JSONObject south = new JSONObject(second.getJSONArray("entries").getJSONObject(0).toString()).put("streamId", "south").put("subjectId", "science"); second.getJSONArray("entries").put(south);
        datasets.getJSONObject("classes").getJSONArray("data").getJSONObject(0).put("streams", new JSONArray().put(new JSONObject().put("id", "north").put("name", "North")).put(new JSONObject().put("id", "south").put("name", "South")));
        feed = TimetableSchedule.feed(datasets, time("2026-10-07T09:30:00"));
        assertTrue(feed.agenda.contains("North · English")); assertTrue(feed.agenda.contains("South · Science")); assertFalse(feed.agenda.contains("Choose a stream"));
    }
    @Test public void doubleLessonHasOneProgressClockAndNextPeriod() throws Exception {
        TimetableSchedule.Frame frame = TimetableSchedule.build(data(), "main", "p4", "", time("2026-10-07T09:00:00"));
        assertEquals("English", frame.title); assertEquals("08:00 – 10:00", frame.time); assertEquals(50, frame.progress); assertEquals(60, frame.remainingMinutes);
        assertTrue(frame.next.startsWith("Next: break")); assertTrue(frame.agenda.contains("Science")); assertEquals("Primary Four", frame.className); assertEquals("Example Teacher", frame.teacher);
    }
    @Test public void classAndStreamChangesUseTheirOwnEntries() throws Exception {
        JSONObject datasets = data();
        assertEquals("Mathematics", TimetableSchedule.build(datasets, "main", "p5", "", time("2026-10-07T09:00:00")).title);
        JSONObject table = datasets.getJSONObject("timetables").getJSONArray("data").getJSONObject(0);
        table.getJSONObject("profile").put("streamLayouts", new JSONObject().put("p4", new JSONObject().put("defaultMode", "separate")));
        table.getJSONArray("entries").getJSONObject(0).put("streamId", "north");
        assertEquals("Choose a stream", TimetableSchedule.build(datasets, "main", "p4", "", time("2026-10-07T08:30:00")).title);
        assertEquals("English", TimetableSchedule.build(datasets, "main", "p4", "north", time("2026-10-07T08:30:00")).title);
    }
    @Test public void clockBoundariesAndUnavailableCopiesDoNotInventLessons() throws Exception {
        assertEquals(0, TimetableSchedule.progress(100, 200, 50)); assertEquals(100, TimetableSchedule.progress(100, 200, 250)); assertEquals(0, TimetableSchedule.progress(100, 100, 100));
        assertEquals("break", TimetableSchedule.build(data(), "main", "p4", "", time("2026-10-07T10:00:00")).title);
        assertFalse(TimetableSchedule.build(data(), "main", "p4", "", time("2026-10-07T11:00:00")).active);
        assertEquals("Outside this school term", TimetableSchedule.build(data(), "main", "p4", "", time("2026-12-02T09:00:00")).title);
        JSONObject datasets = data(); datasets.getJSONObject("timetables").getJSONArray("data").getJSONObject(0).put("complete", false);
        assertEquals("Timetable unavailable", TimetableSchedule.build(datasets, "main", "p4", "", time("2026-10-07T09:00:00")).title);
    }
    @Test public void interruptedRefreshKeepsCompleteGroupButDeletionAndNewVersionReplaceIt() throws Exception {
        JSONObject previous = new JSONObject().put("accountId", "staff-a").put("role", "Staff").put("datasets", data());
        previous.getJSONObject("datasets").getJSONObject("timetables").put("preparedAt", "2026-10-07T08:00:00.000Z");
        JSONObject next = new JSONObject(previous.toString());
        JSONObject tables = next.getJSONObject("datasets").getJSONObject("timetables");
        tables.put("preparedAt", "2026-10-07T09:00:00.000Z"); tables.getJSONArray("data").getJSONObject(0).put("complete", false).put("entries", new JSONArray());
        OfflineStore.retainCompleteTimetables(next, previous);
        assertTrue(tables.getJSONArray("data").getJSONObject(0).getBoolean("complete"));
        assertEquals("2026-10-07T08:00:00.000Z", tables.getString("preparedAt"));
        tables.put("data", new JSONArray()); OfflineStore.retainCompleteTimetables(next, previous); assertEquals(0, tables.getJSONArray("data").length());
        JSONObject updated = new JSONObject(previous.toString()); updated.getJSONObject("datasets").getJSONObject("timetables").getJSONArray("data").getJSONObject(0).put("entries", new JSONArray());
        OfflineStore.retainCompleteTimetables(updated, previous); assertEquals(0, updated.getJSONObject("datasets").getJSONObject("timetables").getJSONArray("data").getJSONObject(0).getJSONArray("entries").length());
    }
}
