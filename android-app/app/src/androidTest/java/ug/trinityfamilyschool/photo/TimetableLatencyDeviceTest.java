package ug.trinityfamilyschool.photo;

import android.content.Context;
import android.os.SystemClock;
import android.util.Log;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import org.json.JSONArray;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class TimetableLatencyDeviceTest {
    private String timestamp(long value) {
        java.text.SimpleDateFormat format = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
        format.setTimeZone(java.util.TimeZone.getTimeZone("UTC")); return format.format(new java.util.Date(value));
    }
    private JSONObject session(String account, boolean timetable, long expires) throws Exception {
        return new JSONObject().put("schema",1).put("accountId",account).put("role","Admin")
            .put("issuedAt",timestamp(System.currentTimeMillis()-1000)).put("expiresAt",timestamp(expires))
            .put("pupilIds",new JSONArray()).put("grants",new JSONObject().put("timetable",timetable).put("pupils",true)
                .put("pupilFields",new JSONArray().put("id").put("firstName")));
    }
    private JSONObject snapshot(String account, String subject) throws Exception {
        String now=timestamp(System.currentTimeMillis());
        JSONObject datasets=new JSONObject();
        for(String name:new String[]{"timetables","classes","academicYears","subjects","teachers"})
            datasets.put(name,new JSONObject().put("preparedAt",now).put("data",new JSONArray()));
        datasets.getJSONObject("subjects").getJSONArray("data").put(new JSONObject().put("id","fixture-subject").put("name",subject));
        datasets.put("pupils",new JSONObject().put("preparedAt",now).put("data",new JSONArray().put(new JSONObject().put("id","private-pupil").put("firstName","PrivateFixtureName"))));
        return new JSONObject().put("schema",1).put("accountId",account).put("role","Admin").put("capturedAt",now).put("datasets",datasets);
    }
    @Test public void timetableCacheColdAndWarmLatency() throws Exception {
        Context context=ApplicationProvider.getApplicationContext();
        OfflineStore store=new OfflineStore(context);
        TimetableCache.forgetMemory();
        long start=SystemClock.elapsedRealtime();
        assertNotNull(store.timetableAvailable());
        long cold=SystemClock.elapsedRealtime()-start;
        start=SystemClock.elapsedRealtime();
        for(int i=0;i<20;i++) assertNotNull(new OfflineStore(context).timetableAvailable());
        long warm=SystemClock.elapsedRealtime()-start;
        start=SystemClock.elapsedRealtime(); TimetableSurfaces.refresh(context,store);
        long render=SystemClock.elapsedRealtime()-start;
        Log.i("TrinityTimetableQA","cold_cache_ms="+cold+" warm_20_reads_ms="+warm+" publish_all_surfaces_ms="+render);
        assertTrue("Cold validation stays below two seconds",cold<2000);
        assertTrue("Repeated navigation reuses the validated projection",warm<200);
        assertTrue("Surface publication stays below one second",render<1000);
    }
    @Test public void cacheTracksSaveAccountRevocationAndLogout() throws Exception {
        Context context=ApplicationProvider.getApplicationContext();
        OfflineStore store=new OfflineStore(context,"timetable-cache-fixture.enc");
        try {
            store.clear();store.connect(session("fixture-a",true,System.currentTimeMillis()+60000));
            store.save(snapshot("fixture-a","English"));
            assertFalse(store.timetableAvailable().getJSONObject("snapshot").getJSONObject("datasets").has("pupils"));
            TimetableCache.forgetMemory();
            assertEquals("English",new OfflineStore(context,"timetable-cache-fixture.enc").timetableAvailable().getJSONObject("snapshot").getJSONObject("datasets").getJSONObject("subjects").getJSONArray("data").getJSONObject(0).getString("name"));
            store.save(snapshot("fixture-a","Mathematics"));
            assertEquals("Mathematics",store.timetableAvailable().getJSONObject("snapshot").getJSONObject("datasets").getJSONObject("subjects").getJSONArray("data").getJSONObject(0).getString("name"));
            store.connect(session("fixture-b",true,System.currentTimeMillis()+60000));assertNull(store.timetableAvailable());
            store.save(snapshot("fixture-b","Science"));assertEquals("fixture-b",store.timetableAvailable().getJSONObject("session").getString("accountId"));
            store.connect(session("fixture-b",false,System.currentTimeMillis()+60000));assertNull(store.timetableAvailable());
            store.clear();assertNull(new OfflineStore(context,"timetable-cache-fixture.enc").timetableAvailable());
        } finally {store.clear();}
    }
    @Test public void cachedTimetableStillExpiresWithoutAnotherDiskRead() throws Exception {
        Context context=ApplicationProvider.getApplicationContext();
        OfflineStore store=new OfflineStore(context,"timetable-expiry-fixture.enc");
        try {
            store.clear();store.connect(session("fixture-expiry",true,System.currentTimeMillis()+2500));
            store.save(snapshot("fixture-expiry","English"));assertNotNull(store.timetableAvailable());
            Thread.sleep(2700);assertNull(store.timetableAvailable());
        } finally {store.clear();}
    }
    /** Read-only baseline on the installed snapshot; logs timings, never school data. */
    @Test public void fullSnapshotReadBaseline() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        long start = SystemClock.elapsedRealtime();
        JSONObject first = new OfflineStore(context).available();
        long middle = SystemClock.elapsedRealtime();
        JSONObject second = new OfflineStore(context).available();
        long end = SystemClock.elapsedRealtime();
        assertNotNull(first); assertNotNull(second);
        Log.i("TrinityTimetableQA", "full_read_first_ms=" + (middle-start) + " full_read_second_ms=" + (end-middle) + " total_ms=" + (end-start));
    }
}
