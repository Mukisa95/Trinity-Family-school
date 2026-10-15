package ug.trinityfamilyschool.photo;
import android.app.*;
import android.content.*;
import androidx.core.app.NotificationCompat;
import org.json.*;
import java.time.*;
import java.util.*;
/** Local reminders reuse timetable alarm permissions and reboot/periodic recovery. */
final class EventReminders {
    static final String FIRE="ug.trinity.events.FIRE";
    static final int ID=7290;
    static PendingIntent alarm(Context context, Intent intent) { return PendingIntent.getBroadcast(context,ID,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE); }
    static Intent fire(Context context) { return new Intent(context,TimetableReceiver.class).setAction(FIRE); }
    static void clear(Context context) {
        ((AlarmManager)context.getSystemService(Context.ALARM_SERVICE)).cancel(alarm(context,fire(context)));
        ((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel("school-event",ID);
    }
    static List<SchoolEventSchedule.Event> authorized(JSONObject envelope) throws Exception {
        if(envelope==null || !envelope.getJSONObject("session").getJSONObject("grants").optBoolean("events")) return Collections.emptyList();
        return SchoolEventSchedule.events(envelope.getJSONObject("snapshot").getJSONObject("datasets"),ZoneId.of(envelope.getJSONObject("session").optString("timeZone","Africa/Kampala")));
    }
    static synchronized void refresh(Context context, OfflineStore store) {
        try {
            JSONObject envelope=store.timetableAvailable();
            if(envelope==null || !envelope.getJSONObject("session").getJSONObject("grants").optBoolean("events") || !TimetableSurfaces.prefs(context).getBoolean("eventReminders",false) || !LessonReminders.notificationsAllowed(context)) { clear(context); return; }
            long now=System.currentTimeMillis(), expiry=OfflineStore.timestamp(envelope.getJSONObject("session").optString("expiresAt"));
            ZoneId zone=ZoneId.of(envelope.getJSONObject("session").optString("timeZone","Africa/Kampala"));
            List<SchoolEventSchedule.Event> events=authorized(envelope);
            String posted=TimetableSurfaces.prefs(context).getString("eventPostedToken",""); boolean current=false;
            for(SchoolEventSchedule.Event event:events) if(event.reminders && now<event.end && event.token().equals(posted)) current=true;
            if(!posted.isEmpty() && !current) ((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel("school-event",ID);
            SchoolEventSchedule.Event next=null; long at=expiry;
            for(SchoolEventSchedule.Event event:events) if(event.reminders) for(long when:new long[]{SchoolEventSchedule.reminderAt(event,zone),event.start}) if(when>now && when<at) { at=when; next=event; }
            Intent intent=fire(context).putExtra("accountId",envelope.getJSONObject("session").getString("accountId")).putExtra("at",at);
            if(next!=null) intent.putExtra("token",next.token());
            LessonReminders.schedule(context,Math.max(now+1000,at),alarm(context,intent),LessonReminders.exactAllowed(context));
        } catch(Exception error) { clear(context); }
    }
    static synchronized void receive(Context context, OfflineStore store, Intent intent) throws Exception {
        long now=System.currentTimeMillis(),at=intent.getLongExtra("at",0);
        JSONObject envelope=store.timetableAvailable();
        if(envelope==null || !envelope.getJSONObject("session").optString("accountId").equals(intent.getStringExtra("accountId")) || !TimetableSurfaces.prefs(context).getBoolean("eventReminders",false)) { refresh(context,store); return; }
        ZoneId zone=ZoneId.of(envelope.getJSONObject("session").optString("timeZone","Africa/Kampala"));
        List<String> lines=new ArrayList<>();
        if(now>=at && now-at<=15*60000L && LessonReminders.notificationsAllowed(context)) for(SchoolEventSchedule.Event event:authorized(envelope)) {
            if(SchoolEventSchedule.reminderDue(event,at,now,zone)) lines.add((at==event.start ? "Starting now: " : "Tomorrow: ")+event.title+(event.location.isEmpty()?"":" · "+event.location));
        }
        // Validate the scheduled event against current data; edits/deletes invalidate stale alarms.
        boolean valid=false; for(SchoolEventSchedule.Event event:authorized(envelope)) if(event.token().equals(intent.getStringExtra("token"))) valid=true;
        String delivery=intent.getStringExtra("token")+"|"+at;
        if(valid && !lines.isEmpty() && !delivery.equals(TimetableSurfaces.prefs(context).getString("eventDelivered",""))) {
            NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
            manager.createNotificationChannel(new NotificationChannel("school-events","School event reminders",NotificationManager.IMPORTANCE_DEFAULT));
            PendingIntent tap=PendingIntent.getActivity(context,ID,new Intent(context,MainActivity.class).putExtra("onlineRoute",PhotoPolicy.ORIGIN+"/events"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            manager.notify("school-event",ID,new NotificationCompat.Builder(context,"school-events").setSmallIcon(R.drawable.school_icon).setContentTitle("School event reminder").setContentText(lines.get(0)).setStyle(new NotificationCompat.BigTextStyle().bigText(String.join("\n",lines))).setContentIntent(tap).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setAutoCancel(true).setTimeoutAfter(30*60000L).build());
            TimetableSurfaces.prefs(context).edit().putString("eventDelivered",delivery).putString("eventPostedToken",intent.getStringExtra("token")).apply();
        }
        refresh(context,store);
    }
}
