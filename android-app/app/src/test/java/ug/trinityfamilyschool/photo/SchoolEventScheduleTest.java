package ug.trinityfamilyschool.photo;
import org.json.*;
import org.junit.Test;
import java.time.*;
import java.util.*;
import static org.junit.Assert.*;
public class SchoolEventScheduleTest {
    @Test public void examClassesSurviveSavedDataAndReachAllSurfaceFrames() throws Exception {
        JSONObject value=event("batch").put("isExamEvent",true).put("classIds",new JSONArray(List.of("p1","p2","p3","p4","p5","p6")));
        JSONArray classes=new JSONArray(); for(int i=1;i<=6;i++) classes.put(new JSONObject().put("id","p"+i).put("code","P."+i).put("name","Primary "+i));
        JSONObject datasets=data(value).put("classes",new JSONObject().put("data",classes));
        SchoolEventSchedule.Event exam=SchoolEventSchedule.events(datasets,zone).get(0);
        assertEquals("Classes: P.1, P.2, P.3, P.4, P.5, P.6",exam.classes);
        assertEquals(exam.classes,SchoolEventSchedule.frame(exam,Instant.ofEpochMilli(exam.start).atZone(zone)).eventClasses);
        value.put("classNames",new JSONArray(List.of("Saved One","Saved Two","Saved Three","Saved Four","Saved Five","Saved Six")));
        assertEquals("Classes: Saved One, Saved Two, Saved Three, Saved Four, Saved Five, Saved Six",SchoolEventSchedule.events(data(value),zone).get(0).classes);
        value.remove("classIds"); value.put("classNames",new JSONArray(List.of("P.7")));
        assertEquals("Classes: P.7",SchoolEventSchedule.events(data(value),zone).get(0).classes);
        value.remove("classNames");assertEquals("Classes not specified",SchoolEventSchedule.events(data(value),zone).get(0).classes);
        value.put("isExamEvent",false);assertEquals("",SchoolEventSchedule.events(data(value),zone).get(0).classes);
    }
    private final ZoneId zone=ZoneId.of("Africa/Kampala");
    private long at(String date) { return LocalDateTime.parse(date).atZone(zone).toInstant().toEpochMilli(); }
    private JSONObject event(String id) throws Exception { return new JSONObject().put("id",id).put("title","School gathering").put("status","Scheduled").put("startDate","2026-10-16").put("endDate","2026-10-17").put("startTime","09:00").put("endTime","15:00"); }
    private JSONObject data(JSONObject... events) throws Exception { JSONArray rows=new JSONArray(); for(JSONObject e:events) rows.put(e); return new JSONObject().put("events",new JSONObject().put("data",rows)); }
    @Test public void spotlightStartsYesterdayAndEndsAtExactEnd() throws Exception {
        SchoolEventSchedule.Event e=SchoolEventSchedule.events(data(event("a")),zone).get(0);
        assertFalse(SchoolEventSchedule.visible(e,at("2026-10-14T23:59:59"),false));
        assertTrue(SchoolEventSchedule.visible(e,at("2026-10-15T00:00:00"),false));
        assertTrue(SchoolEventSchedule.visible(e,at("2026-10-17T14:59:59"),false));
        assertFalse(SchoolEventSchedule.visible(e,e.end,false));
        assertTrue(SchoolEventSchedule.visible(e,at("2026-10-14T00:00:00"),true));
        assertEquals(e.spotlight,SchoolEventSchedule.boundary(List.of(e),at("2026-10-14T00:00:00"),Long.MAX_VALUE));
        assertEquals(e.end,SchoolEventSchedule.boundary(List.of(e),e.start,Long.MAX_VALUE));
    }
    @Test public void allDayIncludesLastDateAndUsesSchoolZone() throws Exception {
        SchoolEventSchedule.Event e=SchoolEventSchedule.events(data(event("a").put("isAllDay",true)),zone).get(0);
        assertEquals(at("2026-10-16T00:00:00"),e.start); assertEquals(at("2026-10-18T00:00:00"),e.end);
        assertTrue(SchoolEventSchedule.visible(e,at("2026-10-17T23:59:59"),false));
        SchoolEventSchedule.Event dst=SchoolEventSchedule.events(data(event("b").put("startDate","2026-03-08").put("endDate","2026-03-08").put("isAllDay",true)),ZoneId.of("America/New_York")).get(0);
        assertEquals(23*3600000L,dst.end-dst.start);
    }
    @Test public void cancelledDraftRejectedMalformedAndDuplicateDoNotCreateCards() throws Exception {
        assertEquals(1,SchoolEventSchedule.events(data(event("good"),event("good"),event("cancelled").put("status","Cancelled"),event("draft").put("status","Draft"),event("approval").put("requiresApproval",true),event("bad").put("startDate","broken")),zone).size());
        assertTrue(SchoolEventSchedule.events(data(),zone).isEmpty());
    }
    @Test public void editsChangeAlarmTokenAndMissingDataIsSafe() throws Exception {
        SchoolEventSchedule.Event before=SchoolEventSchedule.events(data(event("a")),zone).get(0);
        SchoolEventSchedule.Event after=SchoolEventSchedule.events(data(event("a").put("startTime","10:00").put("sendReminders",false)),zone).get(0);
        assertNotEquals(before.token(),after.token()); assertFalse(after.reminders);
        assertTrue(SchoolEventSchedule.events(new JSONObject(),zone).isEmpty());
        assertEquals("Tomorrow",SchoolEventSchedule.frame(before,Instant.ofEpochMilli(before.spotlight).atZone(zone)).next);
        assertEquals("Ongoing",SchoolEventSchedule.frame(before,Instant.ofEpochMilli(before.start).atZone(zone)).next);
    }
    @Test public void remindersRejectOldDisabledAndEndedDeliveries() throws Exception {
        SchoolEventSchedule.Event e=SchoolEventSchedule.events(data(event("a")),zone).get(0);
        assertTrue(SchoolEventSchedule.reminderDue(e,e.start,e.start+5*60000L,zone));
        assertFalse(SchoolEventSchedule.reminderDue(e,e.start,e.start+16*60000L,zone));
        assertFalse(SchoolEventSchedule.reminderDue(e,e.start+60000L,e.start+60000L,zone));
        e.reminders=false; assertFalse(SchoolEventSchedule.reminderDue(e,e.start,e.start,zone));
        ZoneId dst=ZoneId.of("America/New_York");
        e=SchoolEventSchedule.events(data(event("dst").put("startDate","2026-03-08").put("endDate","2026-03-08")),dst).get(0);
        assertEquals(23*3600000L,e.start-SchoolEventSchedule.reminderAt(e,dst));
    }
    @Test public void eventsOnlyProjectionKeepsAccountAndExcludesPupilData() throws Exception {
        JSONObject session=new JSONObject().put("accountId","a").put("grants",new JSONObject().put("events",true));
        JSONObject datasets=data(event("a")).put("pupils",new JSONObject().put("data",new JSONArray().put("private")));
        JSONObject snapshot=new JSONObject().put("schema",1).put("accountId","a").put("role","Staff").put("capturedAt","2026-10-14T00:00:00Z").put("datasets",datasets);
        JSONObject projected=TimetableCache.project(new JSONObject().put("session",session).put("snapshot",snapshot));
        assertTrue(projected.getJSONObject("snapshot").getJSONObject("datasets").has("events"));
        assertFalse(projected.getJSONObject("snapshot").getJSONObject("datasets").has("pupils"));
        session.getJSONObject("grants").put("events",false);
        assertNull(TimetableCache.project(new JSONObject().put("session",session).put("snapshot",snapshot)));
    }
}
