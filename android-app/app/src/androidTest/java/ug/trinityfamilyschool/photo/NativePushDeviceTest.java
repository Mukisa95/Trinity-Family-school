package ug.trinityfamilyschool.photo;
import android.app.NotificationManager;
import android.content.Context;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.android.gms.tasks.Tasks;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class NativePushDeviceTest {
    private final Context context=ApplicationProvider.getApplicationContext();
    @Test public void registeredSchoolFirebaseAppObtainsARealMessagingToken() throws Exception {
        assertEquals(BuildConfig.SCHOOL_FIREBASE_PROJECT,FirebaseApp.getInstance().getOptions().getProjectId());
        assertTrue(FirebaseApp.getInstance().getOptions().getApplicationId().contains(":android:"));
        String token=Tasks.await(FirebaseMessaging.getInstance().getToken(),30,TimeUnit.SECONDS);
        assertTrue("Google issued a real FCM token",token!=null&&token.length()>=80);
    }
    @Test public void schoolAlertUsesTheCrestAndHidesPrivateContentOnTheLockScreen() throws Exception {
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        String tag="school-push:qa-native-render";
        try {
            NativePush.post(context,Map.of("title","School QA","body","Private test content","tag","qa-native-render","url","/push-notifications"),"qa-only","qa-only");
            android.service.notification.StatusBarNotification posted=null;
            for(int i=0;i<30&&posted==null;i++){
                for(android.service.notification.StatusBarNotification item:manager.getActiveNotifications())if(tag.equals(item.getTag()))posted=item;
                if(posted==null)Thread.sleep(100);
            }
            assertNotNull(posted);android.app.Notification notification=posted.getNotification();
            assertEquals(NativePush.CHANNEL,notification.getChannelId());assertEquals(R.drawable.school_icon,notification.getSmallIcon().getResId());assertNotNull(notification.getLargeIcon());
            assertEquals(android.app.Notification.VISIBILITY_PRIVATE,notification.visibility);assertNotNull(notification.publicVersion);
            assertEquals("New school notification",notification.publicVersion.extras.getString("android.text"));assertNotNull(notification.contentIntent);
            NativePush.post(context,Map.of("type","FEE_REMINDER_RESOLVED","tag","qa-native-render"),"qa-only","qa-only");
            boolean remains=true;for(int i=0;i<30&&remains;i++){
                remains=false;for(android.service.notification.StatusBarNotification item:manager.getActiveNotifications())if(tag.equals(item.getTag()))remains=true;
                if(remains)Thread.sleep(100);
            }assertFalse("Resolved alerts are removed",remains);
        }finally{manager.cancel(tag,1);}
    }
}
