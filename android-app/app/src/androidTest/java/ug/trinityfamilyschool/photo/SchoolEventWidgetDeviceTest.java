package ug.trinityfamilyschool.photo;
import android.content.*;
import android.app.*;
import android.appwidget.*;
import android.view.*;
import android.widget.*;
import android.graphics.*;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.time.*;
import java.io.*;
import static org.junit.Assert.*;
/** Synthetic RemoteViews only; never reads/modifies school records or a launcher widget. */
@RunWith(AndroidJUnit4.class)
public class SchoolEventWidgetDeviceTest {
    private JSONObject event(String id,LocalDate date) throws Exception { return new JSONObject().put("id",id).put("title","Sports day "+id).put("status","Scheduled").put("startDate",date.toString()).put("endDate",date.toString()).put("startTime","09:00").put("endTime","15:00").put("location","School field"); }
    @Test public void localReminderPostsOnceAndCancelledDataInvalidatesIt() throws Exception {
        Context context=ApplicationProvider.getApplicationContext(); org.junit.Assume.assumeTrue(LessonReminders.notificationsAllowed(context));
        OfflineStore store=new OfflineStore(context,"school-event-qa.enc"); SharedPreferences prefs=TimetableSurfaces.prefs(context);
        java.util.Map<String,?> previous=prefs.getAll(); NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        ZonedDateTime now=ZonedDateTime.now(ZoneId.of("Africa/Kampala")),start=now.withSecond(0).withNano(0),end=start.plusHours(1);
        java.time.format.DateTimeFormatter iso=new java.time.format.DateTimeFormatterBuilder().appendInstant(3).toFormatter();
        JSONObject session=new JSONObject().put("schema",1).put("accountId","qa-event-reminder").put("role","Staff").put("timeZone","Africa/Kampala").put("issuedAt",iso.format(Instant.now())).put("expiresAt",iso.format(Instant.now().plusSeconds(3600))).put("pupilIds",new JSONArray()).put("grants",new JSONObject().put("events",true).put("pupilFields",new JSONArray()).put("dashboardCounts",new JSONArray()));
        JSONObject event=event("notification-test",start.toLocalDate()).put("title","Test event reminder").put("startTime",start.toLocalTime().toString()).put("endTime",end.toLocalTime().toString()).put("endDate",end.toLocalDate().toString());
        JSONObject data=new JSONObject().put("events",new JSONObject().put("preparedAt",iso.format(Instant.now())).put("data",new JSONArray().put(event)));
        JSONObject snapshot=new JSONObject().put("schema",1).put("accountId","qa-event-reminder").put("role","Staff").put("capturedAt",iso.format(Instant.now())).put("datasets",data);
        try {
            store.connect(session); store.save(snapshot); prefs.edit().putBoolean("eventReminders",true).remove("eventDelivered").commit();
            SchoolEventSchedule.Event planned=SchoolEventSchedule.events(data,start.getZone()).get(0);
            Intent intent=EventReminders.fire(context).putExtra("accountId","qa-event-reminder").putExtra("at",planned.start).putExtra("token",planned.token());
            EventReminders.receive(context,store,intent);
            assertTrue(java.util.Arrays.stream(manager.getActiveNotifications()).anyMatch(value->"school-event".equals(value.getTag())));
            String delivered=prefs.getString("eventDelivered",""); EventReminders.receive(context,store,intent); assertEquals(delivered,prefs.getString("eventDelivered",""));
            event.put("status","Cancelled"); store.save(snapshot); EventReminders.refresh(context,store);
            assertFalse(java.util.Arrays.stream(manager.getActiveNotifications()).anyMatch(value->"school-event".equals(value.getTag())));
            EventReminders.receive(context,store,intent); assertFalse(java.util.Arrays.stream(manager.getActiveNotifications()).anyMatch(value->"school-event".equals(value.getTag())));
        } finally {
            EventReminders.clear(context); store.clear(); SharedPreferences.Editor edit=prefs.edit();
            for(String key:new String[]{"eventReminders","eventDelivered","eventPostedToken"}) { Object value=previous.get(key); if(value instanceof Boolean)edit.putBoolean(key,(Boolean)value);else if(value instanceof String)edit.putString(key,(String)value);else edit.remove(key); }
            edit.commit();EventReminders.refresh(context,new OfflineStore(context));
        }
    }
    @Test public void automaticCardFullEventFeedAndRemoteViewsRenderAndScroll() throws Exception {
        Context context=ApplicationProvider.getApplicationContext(); ZonedDateTime now=ZonedDateTime.now(ZoneId.of("Africa/Kampala"));
        JSONObject data=new JSONObject().put("events",new JSONObject().put("data",new JSONArray().put(event("tomorrow",now.toLocalDate().plusDays(1))).put(event("later",now.toLocalDate().plusDays(5)))));
        JSONObject envelope=new JSONObject().put("session",new JSONObject().put("accountId","qa-events").put("timeZone","Africa/Kampala").put("grants",new JSONObject().put("events",true))).put("snapshot",new JSONObject().put("datasets",data));
        java.util.concurrent.CountDownLatch tapped=new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.atomic.AtomicReference<Intent> tappedIntent=new java.util.concurrent.atomic.AtomicReference<>();
        BroadcastReceiver receiver=new BroadcastReceiver(){@Override public void onReceive(Context c,Intent input){tappedIntent.set(input);tapped.countDown();}};
        androidx.core.content.ContextCompat.registerReceiver(context,receiver,new IntentFilter("ug.trinity.qa.EVENT_TAP"),androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED);
        PendingIntent tapTemplate=PendingIntent.getBroadcast(context,987651,new Intent("ug.trinity.qa.EVENT_TAP").setPackage(context.getPackageName()),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_MUTABLE);
        int scope=987650; SharedPreferences prefs=TimetableSurfaces.prefs(context); String key=TimetableSurfaces.prefix(scope)+"events";
        boolean had=prefs.contains(key), original=prefs.getBoolean(key,false);
        try {
            prefs.edit().putBoolean(key,false).commit(); TimetableSchedule.Frame automatic=TimetableSurfaces.feed(context,envelope,scope,now);
            assertEquals(1,automatic.profiles.size()); assertEquals("Tomorrow",automatic.profiles.get(0).next);
            prefs.edit().putBoolean(key,true).commit(); TimetableSchedule.Frame full=TimetableSurfaces.feed(context,envelope,scope,now); assertEquals(2,full.profiles.size());
            java.util.concurrent.atomic.AtomicReference<Throwable> failure=new java.util.concurrent.atomic.AtomicReference<>();
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try {
                AppWidgetProviderInfo info=AppWidgetManager.getInstance(context).getInstalledProviders().stream().filter(provider->provider.provider.equals(new ComponentName(context,TimetableWidget.class))).findFirst().orElseThrow();
                for(int layout:new int[]{R.layout.timetable_widget_compact,R.layout.timetable_widget_large}) {
                    AppWidgetHostView host=new AppWidgetHostView(context); host.setAppWidget(scope,info);
                    RemoteViews remote=TimetableSurfaces.widgetView(context,scope,new JSONObject(),full,false,layout); remote.setPendingIntentTemplate(R.id.feed_list,tapTemplate); View view=remote.apply(context,host);
                    float density=context.getResources().getDisplayMetrics().density; int width=Math.round(355*density),height=Math.round(220*density);
                    view.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));view.layout(0,0,width,height);
                    ListView list=view.findViewById(R.id.feed_list); assertEquals(2,list.getAdapter().getCount()); assertNotNull(list.getChildAt(0));
                    assertTrue(((TextView)list.getChildAt(0).findViewById(R.id.event_title)).getText().toString().contains("Sports day"));
                    assertNotNull(list.getOnItemClickListener());
                    list.performItemClick(list.getChildAt(0),0,list.getAdapter().getItemId(0));
                    list.setSelection(1); assertNotNull(list.getAdapter().getView(1,null,list));
                    File folder=new File(context.getExternalFilesDir(null),"school-event-qa");folder.mkdirs();
                    Bitmap bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);view.draw(new Canvas(bitmap));
                    try(FileOutputStream out=new FileOutputStream(new File(folder,"events-"+layout+".png"))){bitmap.compress(Bitmap.CompressFormat.PNG,100,out);}bitmap.recycle();
                }
                Notification notification=TimetableSurfaces.card(context,new JSONObject(),full,987650);
                View small=notification.contentView.apply(context,new FrameLayout(context));
                int width=Math.round(355*context.getResources().getDisplayMetrics().density);small.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(0,View.MeasureSpec.UNSPECIFIED));
                assertTrue("Both event summaries fit the collapsed card",small.getMeasuredHeight()<=48*context.getResources().getDisplayMetrics().density+1);
                assertEquals(2,((LinearLayout)small.findViewById(R.id.mini_profiles)).getChildCount());
                notification.contentView.reapply(context,small);assertEquals(2,((LinearLayout)small.findViewById(R.id.mini_profiles)).getChildCount());
            } catch(Throwable error){failure.set(error);} });
            if(failure.get()!=null) throw new AssertionError(failure.get());
            assertTrue("Event card sends its fill-in intent through the widget collection",tapped.await(5,java.util.concurrent.TimeUnit.SECONDS));
            assertEquals("EVENT",tappedIntent.get().getStringExtra("operation"));assertEquals("tomorrow",tappedIntent.get().getStringExtra("eventId"));assertEquals("qa-events",tappedIntent.get().getStringExtra("accountId"));
        } finally { context.unregisterReceiver(receiver);tapTemplate.cancel();if(had)prefs.edit().putBoolean(key,original).commit();else prefs.edit().remove(key).commit(); }
    }
}
