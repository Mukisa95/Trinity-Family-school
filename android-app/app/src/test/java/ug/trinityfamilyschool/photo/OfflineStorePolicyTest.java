package ug.trinityfamilyschool.photo;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import static org.junit.Assert.*;

public class OfflineStorePolicyTest {
    private JSONObject session(boolean parent) throws Exception {
        return new JSONObject().put("schema", 1).put("accountId", "account-a").put("role", parent ? "Parent" : "Staff")
            .put("issuedAt", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'") {{ setTimeZone(java.util.TimeZone.getTimeZone("UTC")); }}.format(new java.util.Date()))
            .put("expiresAt", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'") {{ setTimeZone(java.util.TimeZone.getTimeZone("UTC")); }}.format(new java.util.Date(System.currentTimeMillis() + 86400000L)))
            .put("pupilIds", new JSONArray().put("child-a"))
            .put("grants", new JSONObject().put("pupils", !parent).put("dashboard", !parent).put("timetable", !parent)
                .put("pupilFields", new JSONArray().put("id").put("firstName"))
                .put("dashboardCounts", new JSONArray().put("pupils")));
    }
    private JSONObject snapshot(JSONObject session, JSONObject datasets) throws Exception {
        return new JSONObject().put("schema", 1).put("accountId", session.getString("accountId")).put("role", session.getString("role"))
            .put("capturedAt", session.getString("issuedAt")).put("datasets", datasets);
    }
    private JSONObject dataset(JSONObject session, Object value) throws Exception { return new JSONObject().put("preparedAt", session.getString("issuedAt")).put("data", value); }
    private void rejects(JSONObject snapshot, JSONObject session) throws Exception {
        try { OfflineStore.validate(snapshot, session); fail("Expected rejection"); } catch (IllegalArgumentException expected) { }
    }
    @Test public void accountAndFieldPermissionsAreEnforced() throws Exception {
        JSONObject session = session(false);
        JSONObject pupil = new JSONObject().put("id", "child-a").put("firstName", "Example");
        JSONObject value = snapshot(session, new JSONObject().put("pupils", dataset(session, new JSONArray().put(pupil))));
        OfflineStore.validate(value, session);
        pupil.put("guardians", new JSONArray()); rejects(value, session); pupil.remove("guardians");
        value.put("accountId", "account-b"); rejects(value, session);
    }
    @Test public void parentCannotSaveSchoolRecordsOrAnotherChild() throws Exception {
        JSONObject session = session(true);
        JSONObject family = new JSONObject().put("accountId", "account-a").put("pupils", new JSONArray().put(new JSONObject().put("id", "child-a")));
        JSONObject parent = new JSONObject().put("family", family);
        for (String name : new String[]{"fees", "banking", "attendance", "results"}) parent.put(name, new JSONArray());
        JSONObject datasets = new JSONObject().put("parent", dataset(session, parent));
        JSONObject value = snapshot(session, datasets);
        OfflineStore.validate(value, session);
        family.getJSONArray("pupils").put(new JSONObject().put("id", "child-b")); rejects(value, session);
        family.getJSONArray("pupils").remove(1);
        parent.getJSONArray("fees").put(new JSONObject().put("accountId", "account-b").put("pupilId", "child-a")); rejects(value, session);
        parent.getJSONArray("fees").remove(0);
        datasets.put("pupils", dataset(session, new JSONArray())); rejects(value, session);
    }
    @Test public void expiryAndDashboardGrantsAreEnforced() throws Exception {
        JSONObject session = session(false);
        JSONObject value = snapshot(session, new JSONObject().put("dashboard", dataset(session, new JSONObject().put("pupils", 9))));
        OfflineStore.validate(value, session);
        value.getJSONObject("datasets").getJSONObject("dashboard").getJSONObject("data").put("staff", 4); rejects(value, session);
        session.put("expiresAt", "2020-01-01T00:00:00.000Z"); assertFalse(OfflineStore.active(session));
        assertEquals(0, OfflineStore.timestamp("2026-10-07T00:00:00.000Zextra"));
    }
    @Test public void periodOverridesTakePrecedenceOverDayAndClass() throws Exception {
        JSONObject layout = new JSONObject().put("defaultMode", "consolidated").put("dayModes", new JSONObject().put("1", "separate"))
            .put("periodModes", new JSONObject().put("period-a", "consolidated"));
        JSONObject profile = new JSONObject().put("streamLayouts", new JSONObject().put("class-a", layout));
        assertEquals("consolidated", TimetableUpdates.mode(profile, "class-a", 1, "period-a"));
        assertEquals("separate", TimetableUpdates.mode(profile, "class-a", 1, "period-b"));
        assertEquals("consolidated", TimetableUpdates.mode(profile, "class-a", 2, "period-b"));
    }
    @Test public void anExpiredOrMissingTermCannotShowLiveLessons() throws Exception {
        JSONObject profile = new JSONObject().put("academicYearId", "2026").put("termId", "three");
        JSONObject terms = new JSONObject().put("id", "three").put("startDate", "2026-09-01").put("endDate", "2026-12-01");
        JSONObject datasets = new JSONObject().put("academicYears", new JSONObject().put("data", new JSONArray()
            .put(new JSONObject().put("id", "2026").put("terms", new JSONArray().put(terms)))));
        assertEquals(Boolean.TRUE, TimetableUpdates.withinTerm(datasets, profile, java.time.LocalDate.of(2026, 10, 7)));
        assertEquals(Boolean.FALSE, TimetableUpdates.withinTerm(datasets, profile, java.time.LocalDate.of(2026, 12, 2)));
        assertNull(TimetableUpdates.withinTerm(new JSONObject(), profile, java.time.LocalDate.of(2026, 10, 7)));
    }
}
