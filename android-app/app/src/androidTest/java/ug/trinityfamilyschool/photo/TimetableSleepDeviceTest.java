package ug.trinityfamilyschool.photo;

import android.content.Context;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Run separately with the phone asleep; never opens an activity or changes school data. */
@RunWith(AndroidJUnit4.class)
public class TimetableSleepDeviceTest {
    @Test public void sleepingPhoneDeliversBoundaryAndRearmsFromOfflineCache() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        assertFalse("Run this check with the screen off", TimetableRefresh.interactive(context));
        assertTrue("Allow accurate timetable timing before testing the exact alarm", LessonReminders.exactAllowed(context));
        assertNotNull(new OfflineStore(context).timetableAvailable());
        long at = System.currentTimeMillis() + 10_000;
        try {
            TimetableRefresh.schedule(context, new TimetableRefreshPlan(System.currentTimeMillis(), at, at + 3600_000, true, true, false));
            long deadline = android.os.SystemClock.elapsedRealtime() + 25_000;
            while (TimetableSurfaces.prefs(context).getLong("lastRefreshAt", 0) < at && android.os.SystemClock.elapsedRealtime() < deadline) Thread.sleep(100);
            assertTrue("The alarm refreshed without opening the app", TimetableSurfaces.prefs(context).getLong("lastRefreshAt", 0) >= at);
            assertTrue("A fresh boundary is scheduled", TimetableSurfaces.prefs(context).getLong("nextBoundaryAt", 0) > System.currentTimeMillis());
            assertEquals(0, TimetableSurfaces.prefs(context).getLong("nextVisualAt", -1));
            assertFalse("The display was not woken for progress updates", TimetableRefresh.interactive(context));
        } finally { TimetableSurfaces.refresh(context, new OfflineStore(context)); }
    }
}
