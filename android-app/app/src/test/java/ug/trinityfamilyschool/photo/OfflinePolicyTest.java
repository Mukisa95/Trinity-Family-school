package ug.trinityfamilyschool.photo;
import org.junit.Test;
import static org.junit.Assert.*;

public class OfflinePolicyTest {
    @Test public void packagedOriginIsExact() {
        assertTrue(OfflinePolicy.local(OfflinePolicy.LOCAL_ORIGIN + OfflinePolicy.LOCAL_PATH));
        assertFalse(OfflinePolicy.local("https://appassets.androidplatform.net.evil.test/offline/index.html"));
        assertFalse(OfflinePolicy.local("https://appassets.androidplatform.net/other.html"));
        assertFalse(OfflinePolicy.local("http://appassets.androidplatform.net/offline/index.html"));
        assertFalse(OfflinePolicy.local("https://someone@appassets.androidplatform.net/offline/index.html"));
    }
    @Test public void timetableAndPupilDeepLinksSurviveOfflineFallback() {
        assertEquals(OfflinePolicy.LOCAL_ORIGIN + OfflinePolicy.LOCAL_PATH + "?page=timetable", OfflinePolicy.savedRoute(PhotoPolicy.ORIGIN + "/timetable"));
        assertEquals(OfflinePolicy.LOCAL_ORIGIN + OfflinePolicy.LOCAL_PATH + "?page=pupils&pupilId=child-1", OfflinePolicy.savedRoute(PhotoPolicy.ORIGIN + "/pupil-detail?id=child-1"));
    }
    @Test public void otherSitesCannotControlSavedRoutes() {
        assertEquals(OfflinePolicy.LOCAL_ORIGIN + OfflinePolicy.LOCAL_PATH, OfflinePolicy.savedRoute("https://evil.test/pupil-detail?id=private"));
        assertFalse(OfflinePolicy.supported("https://evil.test/parent"));
        assertTrue(OfflinePolicy.supported(PhotoPolicy.ORIGIN + "/parent"));
    }
    @Test public void reconnectKeepsPupilAndClassSelection() {
        String local = OfflinePolicy.LOCAL_ORIGIN + OfflinePolicy.LOCAL_PATH;
        assertEquals(PhotoPolicy.ORIGIN + "/pupil-detail?id=child-1", OfflinePolicy.onlineRoute(local + "?page=pupils&pupilId=child-1", "Staff"));
        String remote = PhotoPolicy.ORIGIN + "/timetable?tableId=table-1&classId=class-1&streamId=stream-1";
        assertEquals(remote, OfflinePolicy.onlineRoute(OfflinePolicy.savedRoute(remote), "Staff"));
        assertEquals(PhotoPolicy.ORIGIN + "/parent", OfflinePolicy.onlineRoute(local + "?page=pupils&pupilId=child-1", "Parent"));
        assertEquals(PhotoPolicy.ORIGIN + "/", OfflinePolicy.onlineRoute("https://evil.invalid/?page=pupils", "Staff"));
    }
    @Test public void launchAlwaysUsesOriginalWebsiteForStaffParentsAndLegacyWidgetLinks() {
        assertEquals(PhotoPolicy.ORIGIN + "/", OfflinePolicy.launchRoute(null, null, "Admin"));
        assertEquals(PhotoPolicy.ORIGIN + "/parent", OfflinePolicy.launchRoute(null, null, "Parent"));
        assertEquals(PhotoPolicy.ORIGIN + "/timetable?tableId=&classId=&streamId=", OfflinePolicy.launchRoute(OfflinePolicy.savedRoute(PhotoPolicy.ORIGIN + "/timetable"), null, "Admin"));
        assertEquals(PhotoPolicy.ORIGIN + "/pupil-detail?id=child-1", OfflinePolicy.launchRoute(null, PhotoPolicy.ORIGIN + "/pupil-detail?id=child-1", "Staff"));
        assertEquals(PhotoPolicy.ORIGIN + "/", OfflinePolicy.launchRoute(null, "https://evil.test/pupils", "Admin"));
    }
}
