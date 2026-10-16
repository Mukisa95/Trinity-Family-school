package ug.trinityfamilyschool.photo;
import org.json.*;
import org.junit.Test;
import java.time.*;
import static org.junit.Assert.*;

public class TimetableScheduleTest {
    @Test public void todaysTrackingStopsAtDayEndAndDoesNotDisplayNextWeeksLesson() throws Exception {
        JSONObject data = data();
        TimetableSchedule.Frame current = TrackedSubjects.next(data, "p4", "english", time("2026-10-07T09:00:00"), true);
        assertTrue(current.active);
        assertEquals(time("2026-10-07T08:00:00").toInstant().toEpochMilli(), current.start);
        TimetableSchedule.Frame done = TrackedSubjects.next(data, "p4", "english", time("2026-10-07T10:00:00"), true);
        assertFalse(done.hasPeriod); assertEquals("Done today", done.time);
        assertEquals(time("2026-10-08T00:00:00").toInstant().toEpochMilli(), done.boundary);
        TimetableSchedule.Frame none = TrackedSubjects.next(data, "p4", "english", time("2026-10-08T09:00:00"), true);
        assertFalse(none.hasPeriod); assertEquals("No lesson today", none.time);
        assertTrue(TrackedSubjects.next(data, "p4", "english", time("2026-10-08T09:00:00"), false).hasPeriod);
    }
    @Test public void trackedCardsUseSavedCodesAndReadableFallbackCodes() throws Exception {
        JSONObject data = data();
        data.getJSONObject("classes").getJSONArray("data").getJSONObject(0).put("code", "P4");
        data.getJSONObject("subjects").getJSONArray("data").getJSONObject(0).put("code", "ENG");
        TimetableSchedule.Frame row = TrackedSubjects.next(data, "p4", "english", time("2026-10-07T07:00:00"), true);
        assertEquals("P4", row.classCode); assertEquals("ENG", row.subjectCode);
        assertEquals("MAT", TrackedSubjects.code(data, "subjects", "math"));
        assertEquals("?", TrackedSubjects.code(data, "subjects", "missing"));
    }
    @Test public void trackedSubjectKeepsDoubleLessonUntilItsExactEnd() throws Exception {
        TimetableSchedule.Frame row = TrackedSubjects.next(data(), "p4", "english", time("2026-10-07T09:00:00"));
        assertTrue(row.active); assertEquals(50, row.progress);
        assertEquals(time("2026-10-07T10:00:00").toInstant().toEpochMilli(), row.countdownEnd);
        assertEquals(row.countdownEnd, row.boundary);
        assertTrue(row.time.contains("08:00 – 10:00"));
        row = TrackedSubjects.next(data(), "p4", "english", time("2026-10-07T10:00:00"));
        assertFalse(row.active); assertTrue(row.time.contains("14 Oct"));
    }
    @Test public void trackedSubjectsFindTheNextWeekAndRespectTermEnd() throws Exception {
        TimetableSchedule.Frame row = TrackedSubjects.next(data(), "p4", "english", time("2026-10-10T12:00:00"));
        assertEquals(time("2026-10-14T08:00:00").toInstant().toEpochMilli(), row.countdownEnd);
        assertEquals(time("2026-10-11T00:00:00").toInstant().toEpochMilli(), row.boundary);
        row = TrackedSubjects.next(data(), "p4", "english", time("2026-11-30T12:00:00"));
        assertEquals(0, row.countdownEnd); assertFalse(row.hasPeriod);
        assertEquals("No upcoming lesson in saved timetables", row.time);
    }
    @Test public void trackedSubjectsCanStartInAnUpcomingTerm() throws Exception {
        TimetableSchedule.Frame row = TrackedSubjects.next(data(), "p4", "english", time("2026-08-01T12:00:00"));
        assertEquals(time("2026-09-02T08:00:00").toInstant().toEpochMilli(), row.countdownEnd);
    }
    @Test public void trackedSubjectsAreIndependentAcrossClassesAndOptionalSubjects() throws Exception {
        JSONObject data = data(); JSONObject table = data.getJSONObject("timetables").getJSONArray("data").getJSONObject(0);
        table.getJSONArray("entries").getJSONObject(0).put("optionalSubjectId", "science").put("optionalTeacherId", "optional");
        data.getJSONObject("teachers").getJSONArray("data").put(new JSONObject().put("id", "optional").put("name", "Optional Teacher"));
        java.util.Set<String> choices = new java.util.HashSet<>(java.util.Arrays.asList(TrackedSubjects.key("p4", "science"), TrackedSubjects.key("p5", "math")));
        TimetableSchedule.Frame feed = TrackedSubjects.feed(data, choices, time("2026-10-07T07:00:00"));
        assertEquals(2, feed.profiles.size());
        for (TimetableSchedule.Frame row : feed.profiles) assertEquals(time("2026-10-07T08:00:00").toInstant().toEpochMilli(), row.countdownEnd);
        assertEquals(0, TrackedSubjects.next(data, "p5", "science", time("2026-10-07T07:00:00")).countdownEnd);
        assertTrue(TrackedSubjects.choices(data).containsKey(TrackedSubjects.key("p4", "science")));
        assertEquals("Optional Teacher", TrackedSubjects.next(data, "p4", "science", time("2026-10-07T08:30:00")).teacher);
    }
    @Test public void trackedSubjectChoosesValidStreamLayoutAndDescribesStream() throws Exception {
        JSONObject data = data(); JSONObject table = data.getJSONObject("timetables").getJSONArray("data").getJSONObject(0);
        table.getJSONObject("profile").put("streamLayouts", new JSONObject().put("p4", new JSONObject().put("defaultMode", "separate")));
        JSONObject north = new JSONObject(table.getJSONArray("entries").getJSONObject(0).toString()).put("streamId", "north");
        table.getJSONArray("entries").put(north);
        data.getJSONObject("classes").getJSONArray("data").getJSONObject(0).put("streams", new JSONArray().put(new JSONObject().put("id", "north").put("name", "North")));
        TimetableSchedule.Frame row = TrackedSubjects.next(data, "p4", "english", time("2026-10-07T08:30:00"));
        assertTrue(row.active); assertTrue(row.agenda.contains("North"));
        table.getJSONArray("entries").remove(table.getJSONArray("entries").length() - 1);
        assertEquals(0, TrackedSubjects.next(data, "p4", "english", time("2026-10-07T08:30:00")).countdownEnd);
    }
    @Test public void trackedSubjectsDoNotInventLessonsFromIncompleteOrUndatedTables() throws Exception {
        JSONObject data = data(); JSONObject table = data.getJSONObject("timetables").getJSONArray("data").getJSONObject(0);
        table.put("complete", false);
        assertTrue(TrackedSubjects.choices(data).isEmpty());
        assertEquals(0, TrackedSubjects.next(data, "p4", "english", time("2026-10-07T07:00:00")).countdownEnd);
        table.put("complete", true); data.put("academicYears", new JSONObject());
        assertEquals(0, TrackedSubjects.next(data, "p4", "english", time("2026-10-07T07:00:00")).countdownEnd);
    }
    @Test public void trackedSubjectsIgnoreActivitiesAndCoveredContinuationEntries() throws Exception {
        JSONObject data = data(); JSONObject table = data.getJSONObject("timetables").getJSONArray("data").getJSONObject(0);
        table.getJSONArray("entries").put(new JSONObject().put("classId", "p4").put("periodId", "period-1").put("subjectId", "math"));
        assertEquals(0, TrackedSubjects.next(data, "p4", "math", time("2026-10-07T07:00:00")).countdownEnd);
        table.getJSONArray("entries").getJSONObject(0).put("entryType", "activity");
        assertEquals(0, TrackedSubjects.next(data, "p4", "english", time("2026-10-07T07:00:00")).countdownEnd);
    }
    @Test public void trackedSubjectsRetainAllSelectionsWithoutAClassLimit() throws Exception {
        JSONObject data = data(); java.util.Set<String> selected = new java.util.HashSet<>();
        JSONObject table = data.getJSONObject("timetables").getJSONArray("data").getJSONObject(0);
        for (int i = 0; i < 30; i++) {
            String id = "class-" + i; selected.add(TrackedSubjects.key(id, "english"));
            table.getJSONObject("profile").getJSONArray("classIds").put(id);
            data.getJSONObject("classes").getJSONArray("data").put(new JSONObject().put("id", id).put("name", "Class " + i));
            table.getJSONArray("entries").put(new JSONObject().put("classId", id).put("periodId", "period-0").put("subjectId", "english"));
        }
        TimetableSchedule.Frame feed = TrackedSubjects.feed(data, selected, time("2026-10-07T07:00:00"));
        assertEquals(30, feed.profiles.size());
        for (TimetableSchedule.Frame row : feed.profiles) assertTrue(row.hasPeriod);
        selected.add("invalid");
        assertEquals(30, TrackedSubjects.feed(data, selected, time("2026-10-07T07:00:00")).profiles.size());
    }
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
    @Test public void dashboardPillsUseCanonicalClassOrderAndStreamCodes() throws Exception {
        JSONObject datasets = data(); JSONObject table = datasets.getJSONObject("timetables").getJSONArray("data").getJSONObject(0);
        datasets.getJSONObject("classes").getJSONArray("data").getJSONObject(0).put("code", "P4").put("streams", new JSONArray().put(new JSONObject().put("id", "north").put("name", "North").put("code", "North")));
        datasets.getJSONObject("subjects").getJSONArray("data").getJSONObject(0).put("code", "ENG");
        table.getJSONArray("entries").getJSONObject(0).put("streamId", "north");
        TimetableSchedule.Frame row = TimetableSchedule.feed(datasets, time("2026-10-07T08:30:00")).profiles.get(0);
        assertEquals(2, row.pills.size()); assertEquals("P4 N", row.pills.get(0).classCode); assertEquals("ENG", row.pills.get(0).subjectCode);
        assertEquals("Teacher Example", row.pills.get(0).teacher); assertEquals("L1", row.shortLabel);
        // The web card selects entries for this period, including empty continuation slots.
        assertEquals(0, TimetableSchedule.feed(datasets, time("2026-10-07T09:30:00")).profiles.get(0).pills.size());
    }
    @Test public void browsingClampsAndLiveResetReturnsToTheClock() throws Exception {
        JSONObject datasets = data(); ZonedDateTime now = time("2026-10-07T09:30:00");
        TimetableSchedule.Frame row = TimetableSchedule.feed(datasets, now, java.util.Map.of("main", -99)).profiles.get(0);
        assertEquals(0, row.viewIndex); assertEquals(1, row.baseIndex); assertFalse(row.live); assertFalse(row.hasPrevious); assertTrue(row.hasNext);
        assertEquals(0, TimetableInteractions.movedOffset(row, "LIVE")); assertEquals(-1, TimetableInteractions.movedOffset(row, "PREVIOUS"));
        row = TimetableSchedule.feed(datasets, now, java.util.Map.of("main", 99)).profiles.get(0);
        assertEquals(3, row.viewIndex); assertFalse(row.hasNext); assertEquals(2, TimetableInteractions.movedOffset(row, "NEXT"));
        row = TimetableSchedule.feed(datasets, now).profiles.get(0); assertTrue(row.live); assertEquals(50, row.progress);
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
