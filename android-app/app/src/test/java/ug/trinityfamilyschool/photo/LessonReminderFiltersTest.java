package ug.trinityfamilyschool.photo;
import org.json.*;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class LessonReminderFiltersTest {
    private JSONObject data() throws Exception {
        JSONObject data = new JSONObject(); JSONArray tables = new JSONArray();
        for (int i=1;i<=2;i++) {
            JSONArray entries = new JSONArray();
            for (int c=1;c<=2;c++) entries.put(new JSONObject().put("classId","c"+i+c).put("periodId","slot"+c).put("subjectId","s"+c).put("teacherId","t"+i+c));
            tables.put(new JSONObject().put("complete",true).put("profile",new JSONObject().put("id","table"+i).put("name","Timetable "+i).put("classIds",new JSONArray().put("c"+i+"1").put("c"+i+"2")))
                .put("entries",entries).put("periods",new JSONArray().put(new JSONObject().put("id","slot1").put("type","lesson").put("dayOfWeek",1).put("startTime","08:00").put("endTime","09:00"))
                    .put(new JSONObject().put("id","slot2").put("type","lesson").put("dayOfWeek",2).put("startTime","09:00").put("endTime","10:00"))
                    .put(new JSONObject().put("id","break").put("type","break").put("dayOfWeek",1).put("startTime","10:00").put("endTime","10:15"))));
        }
        data.put("timetables",new JSONObject().put("data",tables));
        for(String dataset:new String[]{"classes","subjects","teachers"})data.put(dataset,new JSONObject().put("data",new JSONArray()));
        for(String id:new String[]{"c11","c12","c21","c22","unrelated"})data.getJSONObject("classes").getJSONArray("data").put(new JSONObject().put("id",id).put("name",id));
        for(String id:new String[]{"s1","s2","unused"})data.getJSONObject("subjects").getJSONArray("data").put(new JSONObject().put("id",id).put("name",id));
        for(String id:new String[]{"t11","t12","t21","t22","unrelated"})data.getJSONObject("teachers").getJSONArray("data").put(new JSONObject().put("id",id).put("name",id));
        return data;
    }
    private LessonReminderPlan.Settings settings(){return new LessonReminderPlan.Settings(null);}
    @Test public void tableClassSubjectTeacherSelectionsNarrowEveryFollowingFilter() throws Exception {
        JSONObject data=data();LessonReminderPlan.Settings selected=settings();
        assertEquals(Set.of("c11","c12","c21","c22"),LessonReminderFilters.choices(data,selected,"classes").keySet());
        selected.tables=Set.of("table1");assertEquals(Set.of("c11","c12"),LessonReminderFilters.choices(data,selected,"classes").keySet());
        assertEquals(Set.of("s1","s2"),LessonReminderFilters.choices(data,selected,"subjects").keySet());
        selected.classes=Set.of("c11");assertEquals(Set.of("s1"),LessonReminderFilters.choices(data,selected,"subjects").keySet());
        assertEquals(Set.of("t11"),LessonReminderFilters.choices(data,selected,"teachers").keySet());
        selected.classes=null;selected.subjects=Set.of("s2");assertEquals(Set.of("t12"),LessonReminderFilters.choices(data,selected,"teachers").keySet());
        selected.teachers=Set.of("t12");assertEquals(Set.of("table1|slot2"),LessonReminderFilters.choices(data,selected,"periods").keySet());
    }
    @Test public void changingUpstreamPreservesCompatibleChoicesResetsIncompatibleAndKeepsNone() throws Exception {
        JSONObject data=data();LessonReminderPlan.Settings selected=settings();selected.classes=Set.of("c11","c21");selected.subjects=Set.of("s1");selected.teachers=Set.of("t21");selected.periods=Set.of("table2|slot1");selected.tables=Set.of("table1");
        LessonReminderFilters.reconcile(data,selected,"timetables");assertEquals(Set.of("c11"),selected.classes);assertEquals(Set.of("s1"),selected.subjects);assertNull(selected.teachers);assertNull(selected.periods);
        selected.subjects=Collections.emptySet();selected.tables=Set.of("table2");LessonReminderFilters.reconcile(data,selected,"timetables");assertNull(selected.classes);assertTrue(selected.subjects.isEmpty());assertTrue(LessonReminderFilters.choices(data,selected,"teachers").isEmpty());
    }
    @Test public void explicitNoneUpstreamProducesNoUnrelatedChoices() throws Exception {
        JSONObject data=data();LessonReminderPlan.Settings selected=settings();selected.tables=Collections.emptySet();assertTrue(LessonReminderFilters.choices(data,selected,"classes").isEmpty());assertTrue(LessonReminderFilters.choices(data,selected,"periods").isEmpty());
        selected.tables=null;selected.classes=Collections.emptySet();assertTrue(LessonReminderFilters.choices(data,selected,"subjects").isEmpty());
    }
    @Test public void optionalReferencesAndSeparatedStreamsAreIncludedButObsoleteModesAreNot() throws Exception {
        JSONObject data=data(),table=data.getJSONObject("timetables").getJSONArray("data").getJSONObject(0),entry=table.getJSONArray("entries").getJSONObject(0);
        LessonReminderPlan.Settings selected=settings();selected.tables=Set.of("table1");selected.classes=Set.of("c11");
        table.getJSONObject("profile").put("streamLayouts",new JSONObject().put("c11",new JSONObject().put("defaultMode","separate")));
        assertTrue(LessonReminderFilters.choices(data,selected,"subjects").isEmpty());entry.put("streamId","north").put("optionalSubjectId","s2").put("optionalTeacherId","t12");
        assertEquals(Set.of("s1","s2"),LessonReminderFilters.choices(data,selected,"subjects").keySet());selected.subjects=Set.of("s2");assertEquals(Set.of("t11","t12"),LessonReminderFilters.choices(data,selected,"teachers").keySet());
    }
    @Test public void periodIdsBelongToTheirOwnTimetableAndBreaksFollowTheClassScope() throws Exception {
        JSONObject data=data();LessonReminderPlan.Settings selected=settings();selected.tables=Set.of("table2");selected.classes=Set.of("c22");selected.breaks=true;
        assertEquals(Set.of("table2|slot2","table2|break"),LessonReminderFilters.choices(data,selected,"periods").keySet());selected.classes=Collections.emptySet();assertTrue(LessonReminderFilters.choices(data,selected,"periods").isEmpty());
    }
}
