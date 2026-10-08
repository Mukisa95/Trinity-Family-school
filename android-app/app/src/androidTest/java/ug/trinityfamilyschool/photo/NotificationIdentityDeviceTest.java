package ug.trinityfamilyschool.photo;

import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.service.notification.StatusBarNotification;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class NotificationIdentityDeviceTest {
    private final Context context = ApplicationProvider.getApplicationContext();
    @Test public void smallIconUsesTheCrestAlphaInsteadOfAnOpaqueSquare() {
        Drawable icon = context.getDrawable(R.drawable.school_icon); assertNotNull(icon);
        Bitmap mask = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888);
        icon.setBounds(0, 0, 96, 96); icon.draw(new Canvas(mask));
        assertEquals(0, Color.alpha(mask.getPixel(0, 0)));
        assertEquals(0, Color.alpha(mask.getPixel(95, 95)));
        int visible = 0;
        for (int y=0; y<96; y++) for (int x=0; x<96; x++) if (Color.alpha(mask.getPixel(x,y)) > 128) visible++;
        assertTrue("Crest remains visible", visible > 96*96/5);
        assertTrue("Surroundings remain transparent", visible < 96*96*4/5);
    }
    @Test public void lessonAlertIncludesTheColourCrestAndCorrectSmallIcon() throws Exception {
        assertTrue(LessonReminders.notificationsAllowed(context));
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        try {
            LessonReminders.test(context, new LessonReminderPlan.Settings(null));
            StatusBarNotification posted = null;
            for (int i=0; i<30 && posted==null; i++) {
                for (StatusBarNotification item:manager.getActiveNotifications()) if (item.getId()==LessonReminders.TEST_ID && "lesson-reminder".equals(item.getTag())) posted=item;
                if(posted==null) Thread.sleep(100);
            }
            assertNotNull(posted);
            assertEquals(R.drawable.school_icon, posted.getNotification().getSmallIcon().getResId());
            assertNotNull(posted.getNotification().getLargeIcon());
            assertSame(SchoolApp.notificationLogo(context), SchoolApp.notificationLogo(context));
            assertEquals(128, SchoolApp.notificationLogo(context).getWidth());
            assertEquals("Test lesson reminder", posted.getNotification().extras.getString("android.title"));
        } finally { manager.cancel("lesson-reminder", LessonReminders.TEST_ID); }
    }
}
