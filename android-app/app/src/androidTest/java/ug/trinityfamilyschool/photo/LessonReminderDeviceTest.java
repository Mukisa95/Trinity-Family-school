package ug.trinityfamilyschool.photo;

import android.app.*;
import android.content.*;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class LessonReminderDeviceTest {
    private final Context context = ApplicationProvider.getApplicationContext();
    private String timestamp(long value) { return DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC).format(Instant.ofEpochMilli(value)); }
    private JSONObject session(String account) throws Exception {
        return new JSONObject().put("schema",1).put("accountId",account).put("role","Admin").put("timeZone","Africa/Kampala")
            .put("issuedAt",timestamp(System.currentTimeMillis()-1000)).put("expiresAt",timestamp(System.currentTimeMillis()+60*60_000L))
            .put("pupilIds",new JSONArray()).put("grants",new JSONObject().put("timetable",true));
    }
    private JSONObject snapshot(String account, String subject) throws Exception {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Africa/Kampala")); ZonedDateTime start = now.withSecond(0).withNano(0).minusMinutes(1);
        JSONObject profile = new JSONObject().put("id","qa").put("name","QA timetable").put("academicYearId","year").put("termId","term").put("classIds",new JSONArray().put("p4").put("p5"));
        JSONObject period = new JSONObject().put("id","lesson").put("type","lesson").put("dayOfWeek",now.getDayOfWeek().getValue()).put("startTime",start.toLocalTime().toString()).put("endTime",now.plusMinutes(30).withSecond(0).withNano(0).toLocalTime().toString());
        JSONArray entries = new JSONArray().put(new JSONObject().put("classId","p4").put("periodId","lesson").put("subjectId","english"))
            .put(new JSONObject().put("classId","p5").put("periodId","lesson").put("subjectId","english"));
        JSONObject data = new JSONObject(); String prepared = timestamp(System.currentTimeMillis());
        data.put("timetables",new JSONObject().put("preparedAt",prepared).put("data",new JSONArray().put(new JSONObject().put("complete",true).put("profile",profile).put("periods",new JSONArray().put(period)).put("entries",entries))));
        data.put("academicYears",new JSONObject().put("preparedAt",prepared).put("data",new JSONArray().put(new JSONObject().put("id","year").put("terms",new JSONArray().put(new JSONObject().put("id","term").put("startDate",now.toLocalDate().minusDays(1).toString()).put("endDate",now.toLocalDate().plusDays(7).toString()))))));
        data.put("classes",new JSONObject().put("preparedAt",prepared).put("data",new JSONArray().put(new JSONObject().put("id","p4").put("name","QA Primary Four")).put(new JSONObject().put("id","p5").put("name","QA Primary Five"))));
        data.put("subjects",new JSONObject().put("preparedAt",prepared).put("data",new JSONArray().put(new JSONObject().put("id","english").put("name",subject))));
        data.put("teachers",new JSONObject().put("preparedAt",prepared).put("data",new JSONArray()));
        return new JSONObject().put("schema",1).put("accountId",account).put("role","Admin").put("capturedAt",prepared).put("datasets",data);
    }
    private LessonReminderPlan.Settings settings() throws Exception { return new LessonReminderPlan.Settings(new JSONObject().put("enabled",true).put("starts",true).put("ends",true).put("beforeStart",0).put("alert","silent").put("days",127)); }
    private Intent event(OfflineStore store) throws Exception {
        JSONObject envelope = store.timetableAvailable(); ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Africa/Kampala"));
        List<LessonReminderPlan.Event> events = LessonReminderPlan.events(envelope.getJSONObject("snapshot").getJSONObject("datasets"),settings(),now.minusMinutes(4),System.currentTimeMillis()+60_000L);
        assertEquals(2,events.size()); long at = events.get(0).at;
        return new Intent(LessonReminders.FIRE).putExtra("account","reminder-qa").putExtra("at",at).putExtra("token",LessonReminderPlan.token(LessonReminderPlan.at(events,at)));
    }
    private StatusBarNotification alert(int id) {
        for (StatusBarNotification value : ((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).getActiveNotifications()) if ("lesson-reminder".equals(value.getTag()) && value.getId()==id) return value;
        return null;
    }
    private StatusBarNotification waitForAlert(int id) throws Exception {
        for(int i=0;i<30;i++) { StatusBarNotification notification=alert(id); if(notification!=null)return notification; Thread.sleep(100); } return null;
    }
    private Map<String,?> backup() { return new HashMap<>(LessonReminders.prefs(context).getAll()); }
    private void restore(Map<String,?> values, OfflineStore store) {
        store.clear(); LessonReminders.clear(context); SharedPreferences.Editor edit=LessonReminders.prefs(context).edit();
        for(Map.Entry<String,?> entry:values.entrySet()) {Object value=entry.getValue(); if(value instanceof String)edit.putString(entry.getKey(),(String)value); else if(value instanceof Boolean)edit.putBoolean(entry.getKey(),(Boolean)value); else if(value instanceof Long)edit.putLong(entry.getKey(),(Long)value); else if(value instanceof Integer)edit.putInt(entry.getKey(),(Integer)value);}
        edit.commit(); LessonReminders.reschedule(context,new OfflineStore(context));
    }
    @Test public void offlineDeliveryCombinesClassesDeduplicatesAndRejectsChangedLessons() throws Exception {
        Map<String,?> saved=backup(); OfflineStore store=new OfflineStore(context,"lesson-reminder-qa.enc");
        try {
            assertTrue(LessonReminders.notificationsAllowed(context)); store.clear(); store.connect(session("reminder-qa")); store.save(snapshot("reminder-qa","QA English"));
            LessonReminders.save(context,store,"reminder-qa",settings()); Intent fire=event(store); TimetableCache.forgetMemory();
            LessonReminders.receive(context,new OfflineStore(context,"lesson-reminder-qa.enc"),fire);
            StatusBarNotification posted=waitForAlert(LessonReminders.ALERT_ID); assertNotNull(posted);
            assertEquals("2 lesson reminders",posted.getNotification().extras.getString("android.title"));
            String text=posted.getNotification().extras.getCharSequence("android.bigText").toString(); assertTrue(text.contains("QA Primary Four")); assertTrue(text.contains("QA Primary Five"));
            assertNotNull(posted.getNotification().contentIntent); assertEquals(2,posted.getNotification().actions.length);
            long firstPost=posted.getPostTime(); LessonReminders.receive(context,store,fire); Thread.sleep(100); assertEquals(firstPost,alert(LessonReminders.ALERT_ID).getPostTime());
            ((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel("lesson-reminder",LessonReminders.ALERT_ID);
            store.save(snapshot("reminder-qa","QA Mathematics")); LessonReminders.receive(context,store,fire); Thread.sleep(100); assertNull(alert(LessonReminders.ALERT_ID));
            assertTrue(LessonReminders.prefs(context).getLong("nextAt",0)>System.currentTimeMillis());
        } finally {restore(saved,store);}
    }
    @Test public void snoozeQuietHoursDisablingAndAccountChangesCancelOrRejectAlerts() throws Exception {
        Map<String,?> saved=backup(); OfflineStore store=new OfflineStore(context,"lesson-reminder-qa.enc");
        try {
            store.clear();store.connect(session("reminder-qa"));store.save(snapshot("reminder-qa","QA English")); LessonReminderPlan.Settings options=settings();
            LessonReminders.save(context,store,"reminder-qa",options); Intent fire=event(store);LessonReminders.receive(context,store,fire);assertNotNull(waitForAlert(LessonReminders.ALERT_ID));
            Intent snooze=new Intent(fire).setAction(LessonReminders.SNOOZE);LessonReminders.receive(context,store,snooze);Thread.sleep(100);assertNull(alert(LessonReminders.ALERT_ID));
            Intent snoozed=new Intent(fire).setAction(LessonReminders.SNOOZED).putExtra("snoozeAt",System.currentTimeMillis()-500);LessonReminders.receive(context,store,snoozed);
            assertEquals("Snoozed lesson reminder",waitForAlert(LessonReminders.ALERT_ID).getNotification().extras.getString("android.title"));
            options.quiet=true;options.quietStart="00:00";options.quietEnd="00:00";LessonReminders.save(context,store,"reminder-qa",options);LessonReminders.receive(context,store,fire);Thread.sleep(100);assertNull(alert(LessonReminders.ALERT_ID));
            options.quiet=false;options.enabled=false;LessonReminders.save(context,store,"reminder-qa",options);assertEquals(0,LessonReminders.prefs(context).getLong("nextAt",0));
            options.enabled=true;LessonReminders.save(context,store,"reminder-qa",options);store.connect(session("different-account"));store.save(snapshot("different-account","QA English"));
            LessonReminders.refresh(context,store);assertFalse(LessonReminders.settings(context,"different-account").enabled);assertEquals(0,LessonReminders.prefs(context).getLong("nextAt",0));
            LessonReminders.receive(context,store,fire);assertNull(alert(LessonReminders.ALERT_ID));
        } finally {restore(saved,store);}
    }
    @Test public void alarmManagerDeliversBackgroundPayloadAndChannelsPreserveAlertChoices() throws Exception {
        Map<String,?> saved=backup(); OfflineStore store=new OfflineStore(context,"lesson-reminder-qa.enc"); AtomicReference<Throwable> failure=new AtomicReference<>();CountDownLatch delivered=new CountDownLatch(1);
        String action="ug.trinity.lessons.QA_ALARM"; PendingIntent pending=null;
        BroadcastReceiver receiver=new BroadcastReceiver(){@Override public void onReceive(Context sender,Intent intent){try{LessonReminders.receive(context,store,intent.setAction(LessonReminders.SNOOZED));}catch(Throwable error){failure.set(error);}finally{delivered.countDown();}}};
        try {
            store.clear();store.connect(session("reminder-qa"));store.save(snapshot("reminder-qa","QA English"));LessonReminders.save(context,store,"reminder-qa",settings());
            if(Build.VERSION.SDK_INT>=33)context.registerReceiver(receiver,new IntentFilter(action),Context.RECEIVER_NOT_EXPORTED);else context.registerReceiver(receiver,new IntentFilter(action));
            long when=System.currentTimeMillis()+2000;Intent payload=event(store).setAction(action).setPackage(context.getPackageName()).putExtra("snoozeAt",when);
            pending=PendingIntent.getBroadcast(context,7299,payload,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            LessonReminders.schedule(context,when,pending,LessonReminders.exactAllowed(context));
            assertTrue("Android delivered the scheduled alarm",delivered.await(15,TimeUnit.SECONDS)); if(failure.get()!=null)throw new AssertionError(failure.get());assertNotNull(waitForAlert(LessonReminders.ALERT_ID));
            NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
            assertNotNull(manager.getNotificationChannel(LessonReminders.channel("sound")).getSound());assertTrue(manager.getNotificationChannel(LessonReminders.channel("sound")).shouldVibrate());
            assertNull(manager.getNotificationChannel(LessonReminders.channel("vibrate")).getSound());assertTrue(manager.getNotificationChannel(LessonReminders.channel("vibrate")).shouldVibrate());
            assertNull(manager.getNotificationChannel(LessonReminders.channel("silent")).getSound());assertFalse(manager.getNotificationChannel(LessonReminders.channel("silent")).shouldVibrate());
        } finally {if(pending!=null)((AlarmManager)context.getSystemService(Context.ALARM_SERVICE)).cancel(pending);try{context.unregisterReceiver(receiver);}catch(Exception ignored){}restore(saved,store);}
    }
    @Test public void planningTheInstalledCacheStaysFastWithoutFetchingAnything() throws Exception {
        JSONObject envelope=new OfflineStore(context).timetableAvailable();assertNotNull(envelope);
        LessonReminderPlan.Settings options=settings();options.beforeStart=5;options.beforeEnd=5;
        long began=android.os.SystemClock.elapsedRealtime();
        List<LessonReminderPlan.Event> events=LessonReminderPlan.events(envelope.getJSONObject("snapshot").getJSONObject("datasets"),options,
            ZonedDateTime.now(ZoneId.of(envelope.getJSONObject("session").optString("timeZone","Africa/Kampala"))),OfflineStore.timestamp(envelope.getJSONObject("session").optString("expiresAt"))-1);
        long elapsed=android.os.SystemClock.elapsedRealtime()-began;
        android.util.Log.i("TrinityReminderQA","plan_ms="+elapsed+" event_count="+events.size());
        assertTrue("Reminder planning stays off the slow navigation path",elapsed<2000);
    }
    @Test public void veryLateEventsAndRevokedTimetableAccessDoNotNotify() throws Exception {
        Map<String,?> saved=backup();OfflineStore store=new OfflineStore(context,"lesson-reminder-qa.enc");
        try {
            store.clear();store.connect(session("reminder-qa"));JSONObject snapshot=snapshot("reminder-qa","QA English");
            ZonedDateTime now=ZonedDateTime.now(ZoneId.of("Africa/Kampala"));
            snapshot.getJSONObject("datasets").getJSONObject("timetables").getJSONArray("data").getJSONObject(0).getJSONArray("periods").getJSONObject(0).put("startTime",now.minusMinutes(8).withSecond(0).withNano(0).toLocalTime().toString());
            store.save(snapshot);LessonReminders.save(context,store,"reminder-qa",settings());
            List<LessonReminderPlan.Event> events=LessonReminderPlan.events(snapshot.getJSONObject("datasets"),settings(),now.minusMinutes(20),System.currentTimeMillis()+60_000L);assertEquals(2,events.size());
            Intent fire=new Intent(LessonReminders.FIRE).putExtra("account","reminder-qa").putExtra("at",events.get(0).at).putExtra("token",LessonReminderPlan.token(events));
            LessonReminders.receive(context,store,fire);Thread.sleep(100);assertNull(alert(LessonReminders.ALERT_ID));
            JSONObject revoked=session("reminder-qa");revoked.getJSONObject("grants").put("timetable",false);store.connect(revoked);
            LessonReminders.refresh(context,store);assertEquals(0,LessonReminders.prefs(context).getLong("nextAt",0));LessonReminders.receive(context,store,fire);assertNull(alert(LessonReminders.ALERT_ID));
        } finally {restore(saved,store);}
    }
}
