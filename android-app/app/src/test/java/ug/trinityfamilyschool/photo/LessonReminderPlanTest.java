package ug.trinityfamilyschool.photo;
import org.json.*;
import org.junit.Test;
import java.time.*;
import java.util.*;
import static org.junit.Assert.*;

public class LessonReminderPlanTest {
    private ZonedDateTime time(String value) { return LocalDateTime.parse(value).atZone(ZoneId.of("Africa/Kampala")); }
    private JSONObject data() throws Exception {
        JSONObject profile = new JSONObject().put("id", "upper").put("name", "Upper primary").put("academicYearId", "year").put("termId", "term").put("classIds", new JSONArray().put("p4").put("p5"));
        JSONArray periods = new JSONArray();
        String[] starts = {"08:00", "09:00", "10:00", "10:15"}, ends = {"09:00", "10:00", "10:15", "11:00"};
        for (int i = 0; i < 4; i++) periods.put(new JSONObject().put("id", "period" + i).put("dayOfWeek", 3).put("type", i == 2 ? "break" : "lesson").put("customLabel", "Break").put("startTime", starts[i]).put("endTime", ends[i]));
        JSONArray entries = new JSONArray().put(new JSONObject().put("classId", "p4").put("periodId", "period0").put("subjectId", "english").put("teacherId", "a").put("periodSpan", 2))
            .put(new JSONObject().put("classId", "p5").put("periodId", "period0").put("subjectId", "math").put("teacherId", "b"))
            .put(new JSONObject().put("classId", "p5").put("periodId", "period3").put("entryType", "activity").put("activityName", "Reading club").put("teacherId", "b"));
        JSONObject data = new JSONObject();
        data.put("timetables", new JSONObject().put("data", new JSONArray().put(new JSONObject().put("complete", true).put("profile", profile).put("periods", periods).put("entries", entries))));
        data.put("academicYears", new JSONObject().put("data", new JSONArray().put(new JSONObject().put("id", "year").put("terms", new JSONArray().put(new JSONObject().put("id", "term").put("startDate", "2026-09-01").put("endDate", "2026-12-01"))))));
        data.put("classes", new JSONObject().put("data", new JSONArray().put(new JSONObject().put("id", "p4").put("name", "Primary Four")).put(new JSONObject().put("id", "p5").put("name", "Primary Five"))));
        data.put("subjects", new JSONObject().put("data", new JSONArray().put(new JSONObject().put("id", "english").put("name", "English")).put(new JSONObject().put("id", "math").put("name", "Mathematics"))));
        data.put("teachers", new JSONObject().put("data", new JSONArray().put(new JSONObject().put("id", "a").put("name", "Teacher A")).put(new JSONObject().put("id", "b").put("name", "Teacher B")))); return data;
    }
    private LessonReminderPlan.Settings settings() throws Exception { return new LessonReminderPlan.Settings(new JSONObject().put("enabled", true).put("starts", true).put("ends", true).put("beforeStart", 5).put("beforeEnd", 5)); }
    private List<LessonReminderPlan.Event> plan(JSONObject data, LessonReminderPlan.Settings settings) throws Exception { return LessonReminderPlan.events(data, settings, time("2026-10-07T07:00:00"), time("2026-10-07T23:59:00").toInstant().toEpochMilli()); }
    @Test public void doubleLessonsHaveOneStartAndOneEndAndNoContinuationAlert() throws Exception {
        List<LessonReminderPlan.Event> events = plan(data(), settings());
        assertEquals(12, events.size());
        List<LessonReminderPlan.Event> starts = LessonReminderPlan.at(events, time("2026-10-07T08:00:00").toInstant().toEpochMilli());
        assertEquals(2, starts.size());
        assertEquals(1, events.stream().filter(event -> event.kind.equals("start") && event.subject.equals("English")).count());
        LessonReminderPlan.Event englishEnd = events.stream().filter(event -> event.kind.equals("end") && event.subject.equals("English")).findFirst().get();
        assertEquals(time("2026-10-07T10:00:00").toInstant().toEpochMilli(), englishEnd.at);
        assertTrue(events.stream().noneMatch(event -> event.subject.equals("English") && event.at == time("2026-10-07T09:00:00").toInstant().toEpochMilli()));
    }
    @Test public void eachFilterIsCombinedWithTheOthersAndNoneDoesNotBecomeAll() throws Exception {
        LessonReminderPlan.Settings settings = settings(); settings.classes = Set.of("p4"); settings.subjects = Set.of("english"); settings.teachers = Set.of("a"); settings.tables = Set.of("upper");
        assertEquals(4, plan(data(), settings).size()); settings.teachers = Set.of("b"); assertTrue(plan(data(), settings).isEmpty());
        settings.teachers = null; settings.classes = Collections.emptySet(); assertTrue(plan(data(), settings).isEmpty());
        LessonReminderPlan.Settings roundTrip = new LessonReminderPlan.Settings(settings.json()); assertNotNull(roundTrip.classes); assertTrue(roundTrip.classes.isEmpty()); assertNull(roundTrip.teachers);
    }
    @Test public void streamsAndOptionalSubjectsAndTeachersAreRespected() throws Exception {
        JSONObject data = data(), table = data.getJSONObject("timetables").getJSONArray("data").getJSONObject(0), profile = table.getJSONObject("profile"), entry = table.getJSONArray("entries").getJSONObject(0);
        profile.put("streamLayouts", new JSONObject().put("p4", new JSONObject().put("defaultMode", "separate")));
        LessonReminderPlan.Settings settings = settings(); settings.classes = Set.of("p4"); assertTrue(plan(data, settings).isEmpty());
        entry.put("streamId", "north").put("optionalSubjectId", "math").put("optionalTeacherId", "b");
        data.getJSONObject("classes").getJSONArray("data").getJSONObject(0).put("streams", new JSONArray().put(new JSONObject().put("id", "north").put("name", "North")));
        settings.subjects = Set.of("math"); settings.teachers = Set.of("b"); List<LessonReminderPlan.Event> events = plan(data, settings);
        assertEquals(4, events.size()); assertEquals("Primary Four · North", events.get(0).classLabel); assertEquals("English / Mathematics", events.get(0).subject);
    }
    @Test public void quietHoursCrossMidnightAndDaysAndNoEventsOutsideTermOrLease() throws Exception {
        LessonReminderPlan.Settings settings = settings(); settings.quiet = true; settings.quietStart = "20:00"; settings.quietEnd = "08:01";
        assertFalse(settings.quietAt(time("2026-10-07T12:00:00"))); assertTrue(settings.quietAt(time("2026-10-07T23:00:00"))); assertTrue(settings.quietAt(time("2026-10-07T07:59:00")));
        assertEquals(8, plan(data(), settings).size()); settings.quietStart = settings.quietEnd; assertTrue(plan(data(), settings).isEmpty());
        settings.quiet = false; settings.days = 0; assertTrue(plan(data(), settings).isEmpty());
        settings.days = 127; assertTrue(LessonReminderPlan.events(data(), settings, time("2026-12-02T07:00:00"), time("2026-12-02T23:00:00").toInstant().toEpochMilli()).isEmpty());
        assertEquals(2, LessonReminderPlan.events(data(), settings, time("2026-10-07T07:00:00"), time("2026-10-07T07:59:00").toInstant().toEpochMilli()).size());
    }
    @Test public void activitiesAndBreaksAreOptionalAndBreaksAreNotDuplicatedPerClass() throws Exception {
        LessonReminderPlan.Settings settings = settings(); settings.activities = false; assertEquals(8, plan(data(), settings).size());
        settings.breaks = true; assertEquals(12, plan(data(), settings).size());
        assertEquals(1, plan(data(), settings).stream().filter(event -> event.kind.equals("start") && event.subject.equals("Break")).count());
        settings.classes = Collections.emptySet(); assertTrue(plan(data(), settings).isEmpty());
    }
    @Test public void incompleteRemovedAndUnassignedTimetablesDoNotInventAlerts() throws Exception {
        JSONObject data = data(), table = data.getJSONObject("timetables").getJSONArray("data").getJSONObject(0);
        table.put("complete", false); assertTrue(plan(data, settings()).isEmpty());
        table.put("complete", true).put("entries", new JSONArray()); assertTrue(plan(data, settings()).isEmpty());
        table.getJSONObject("profile").put("termId", "removed"); assertTrue(plan(data, settings()).isEmpty());
        data.put("timetables", new JSONObject().put("data", new JSONArray())); assertTrue(plan(data, settings()).isEmpty());
    }
    @Test public void identitiesAreStableAcrossInputOrderButChangeWhenALessonChanges() throws Exception {
        JSONObject data = data(); List<LessonReminderPlan.Event> old = plan(data, settings()); String oldToken = LessonReminderPlan.token(old);
        JSONArray entries = data.getJSONObject("timetables").getJSONArray("data").getJSONObject(0).getJSONArray("entries"); JSONObject first = entries.getJSONObject(0); entries.put(0, entries.getJSONObject(1)); entries.put(1, first);
        assertEquals(oldToken, LessonReminderPlan.token(plan(data, settings())));
        first.put("subjectId", "math"); assertNotEquals(oldToken, LessonReminderPlan.token(plan(data, settings())));
    }
    @Test public void disabledAndBoundedSettingsCannotScheduleUnexpectedAlerts() throws Exception {
        assertTrue(plan(data(), new LessonReminderPlan.Settings(null)).isEmpty());
        LessonReminderPlan.Settings settings = new LessonReminderPlan.Settings(new JSONObject().put("beforeStart", 999).put("beforeEnd", -1).put("snooze", 0).put("quietStart", "bogus").put("alert", "bogus"));
        assertEquals(60, settings.beforeStart); assertEquals(0, settings.beforeEnd); assertEquals(1, settings.snooze); assertEquals("20:00", settings.quietStart); assertEquals("sound", settings.alert);
    }
    @Test public void spanCannotCrossABreakOrAGapAndBadPeriodDoesNotBlockOtherLessons() throws Exception {
        JSONObject data = data(), table = data.getJSONObject("timetables").getJSONArray("data").getJSONObject(0);
        table.getJSONArray("entries").getJSONObject(0).put("periodSpan", 20);
        List<LessonReminderPlan.Event> events = plan(data, settings());
        assertEquals(time("2026-10-07T10:00:00").toInstant().toEpochMilli(), events.stream().filter(event -> event.subject.equals("English") && event.kind.equals("end")).findFirst().get().at);
        table.getJSONArray("periods").getJSONObject(0).put("startTime", "bad");
        assertEquals(4, plan(data, settings()).size());
    }
    @Test public void continuationSlotsInsideADoubleLessonDoNotCreateExtraAlerts() throws Exception {
        JSONObject data = data(), table = data.getJSONObject("timetables").getJSONArray("data").getJSONObject(0);
        table.getJSONArray("entries").put(new JSONObject().put("classId", "p4").put("periodId", "period1").put("subjectId", "math"));
        assertEquals(12, plan(data, settings()).size());
        LessonReminderPlan.Settings selected = settings(); selected.classes = Set.of("p4"); selected.subjects = Set.of("math");
        assertTrue(plan(data, selected).isEmpty());
    }
    @Test public void individualPeriodFiltersUseTheProfileAndDoubleLessonStartingSlot() throws Exception {
        LessonReminderPlan.Settings selected = settings(); selected.periods = Set.of("upper|period0"); assertEquals(8, plan(data(), selected).size());
        selected.periods = Set.of("upper|period1"); assertTrue(plan(data(), selected).isEmpty());
        selected.periods = Set.of("other|period0"); assertTrue(plan(data(), selected).isEmpty());
        selected.periods = Set.of("upper|period3"); assertEquals(4, plan(data(), selected).size());
        assertEquals(selected.periods, new LessonReminderPlan.Settings(selected.json()).periods);
    }
}
