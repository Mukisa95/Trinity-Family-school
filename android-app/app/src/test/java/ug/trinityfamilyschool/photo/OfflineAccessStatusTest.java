package ug.trinityfamilyschool.photo;

import org.json.JSONObject;
import org.junit.Test;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.time.format.DateTimeFormatter;
import java.time.ZoneOffset;
import static org.junit.Assert.*;

public class OfflineAccessStatusTest {
    private JSONObject session(boolean expired) throws Exception {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        DateTimeFormatter iso = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);
        return new JSONObject().put("schema", 1).put("accountId", "fixture-only")
            .put("issuedAt", iso.format(now.minusSeconds(3600)))
            .put("expiresAt", iso.format(expired ? now.minusSeconds(60) : now.plusSeconds(3600)));
    }
    @Test public void verifiedAccessSurvivesFirstSnapshotPreparation() throws Exception {
        JSONObject result = OfflineStore.accessStatus(new JSONObject().put("session", session(false)));
        assertTrue(result.has("session"));
        assertFalse(result.getBoolean("available"));
        assertEquals("data_preparing", result.getString("state"));
    }
    @Test public void expiredAccessCannotBeRestoredBySavedData() throws Exception {
        JSONObject result = OfflineStore.accessStatus(new JSONObject().put("session", session(true)).put("snapshot", new JSONObject()));
        assertFalse(result.has("session"));
        assertFalse(result.getBoolean("available"));
        assertEquals("expired", result.getString("state"));
    }
    @Test public void missingAndPreparedStatesAreDistinct() throws Exception {
        assertEquals("not_prepared", OfflineStore.accessStatus(null).getString("state"));
        JSONObject result = OfflineStore.accessStatus(new JSONObject().put("session", session(false)).put("snapshot", new JSONObject()));
        assertTrue(result.getBoolean("available"));
        assertEquals("ready", result.getString("state"));
    }
}
