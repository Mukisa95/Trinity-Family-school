package ug.trinityfamilyschool.photo;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import androidx.work.*;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONArray;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.TimeUnit;

final class NativePush {
    static final String CHANNEL="school-announcements", EVENT="ug.trinityfamilyschool.photo.NATIVE_PUSH_CHANGE";
    private static final Object LOCK=new Object();
    private static volatile com.google.android.gms.tasks.Task<Void> deletion;
    private static JSONObject state(Context context) throws Exception {return new NativePushStore(context).read();}
    private static void save(Context context,JSONObject value) throws Exception {new NativePushStore(context).write(value);}
    static void start(Context context){
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel channel=new NotificationChannel(CHANNEL,"School announcements",NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Messages and alerts from your school");manager.createNotificationChannel(channel);
        boolean enabled;
        synchronized(LOCK){try{JSONObject value=state(context);save(context,value);enabled=value.optBoolean("enabled",true);}catch(Exception ignored){return;}}
        FirebaseMessaging.getInstance().setAutoInitEnabled(enabled);
        if(enabled)FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token->tokenChanged(context,token));
        enqueue(context);
    }
    static void changed(Context context){changed(context,false);}
    static void changed(Context context,boolean parentScope){context.sendBroadcast(new Intent(EVENT).setPackage(context.getPackageName()).putExtra("parentScope",parentScope));}
    static void enqueue(Context context){WorkManager.getInstance(context).enqueueUniqueWork("native-push-sync",ExistingWorkPolicy.APPEND_OR_REPLACE,
        new OneTimeWorkRequest.Builder(NativePushWorker.class).setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).build());}
    static void tokenChanged(Context context,String token){
        synchronized(LOCK){try{JSONObject value=state(context);if(token.equals(value.optString("token")))return;value.put("token",token);save(context,value);}catch(Exception ignored){return;}}
        enqueue(context);changed(context);
    }
    static JSONObject status(Context context) throws Exception {
        synchronized(LOCK){JSONObject value=state(context);boolean active=value.optBoolean("enabled",true)&&!value.optString("accountId").isEmpty()&&value.optString("token").equals(value.optString("registeredToken"));
            return new JSONObject().put("remotePush",active).put("pushEnabled",value.optBoolean("enabled",true)).put("pushAccountId",value.optString("accountId"));}
    }
    private static JSONObject device(JSONObject value){
        try{return new JSONObject().put("installationId",value.getString("installationId")).put("deviceSecret",value.getString("deviceSecret"))
            .put("applicationId",BuildConfig.APPLICATION_ID).put("projectId",BuildConfig.SCHOOL_FIREBASE_PROJECT).put("token",value.optString("token"));}
        catch(Exception error){throw new IllegalStateException("Push registration is unavailable.");}
    }
    private static JSONObject request(String method,String path,JSONObject input,String idToken) throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URL(PhotoPolicy.ORIGIN+path).openConnection();connection.setRequestMethod("PATCH".equals(method)?"POST":method);
        if("PATCH".equals(method))connection.setRequestProperty("x-native-operation","rotate");
        connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(10000);connection.setReadTimeout(15000);connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type","application/json");if(idToken!=null)connection.setRequestProperty("Authorization","Bearer "+idToken);
        try {byte[] bytes=input.toString().getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(bytes.length);try(java.io.OutputStream out=connection.getOutputStream()){out.write(bytes);}
            int code=connection.getResponseCode();if(code<200||code>=300)throw new PushHttpError(code);
            try(java.io.InputStream stream=connection.getInputStream();java.io.ByteArrayOutputStream reply=new java.io.ByteArrayOutputStream()){
                byte[] buffer=new byte[2048];int length;while((length=stream.read(buffer))!=-1){if(reply.size()+length>16384)throw new java.io.IOException("Invalid push response");reply.write(buffer,0,length);}
                return new JSONObject(reply.toString("UTF-8"));}
        }finally{connection.disconnect();}
    }
    private static final class PushHttpError extends java.io.IOException {final int code;PushHttpError(int code){super("School push service returned "+code);this.code=code;}}
    /** Called on a background executor. Identity tokens are used once and never persisted. */
    static JSONObject register(Context context,String expectedUser,String idToken,boolean enable) throws Exception {
        if(expectedUser.isEmpty()||idToken.isEmpty()||idToken.length()>16000)throw new IllegalArgumentException("Sign in to enable school notifications.");
        JSONObject captured;
        synchronized(LOCK){captured=state(context);if(!captured.optString("accountId").isEmpty()&&!expectedUser.equals(captured.optString("accountId"))){clear(context,false);captured=state(context);}
            if(enable)captured.put("enabled",true);if(!captured.optBoolean("enabled",true))return status(context);captured.put("pendingAccount",expectedUser);save(context,captured);
            if(expectedUser.equals(captured.optString("accountId"))&&captured.optString("token").equals(captured.optString("registeredToken")))return status(context);}
        FirebaseMessaging.getInstance().setAutoInitEnabled(true);
        com.google.android.gms.tasks.Task<Void> deleting=deletion;if(deleting!=null){try{Tasks.await(deleting,20,TimeUnit.SECONDS);}catch(Exception ignored){}if(deletion==deleting)deletion=null;}
        String token=Tasks.await(FirebaseMessaging.getInstance().getToken(),20,TimeUnit.SECONDS);captured.put("token",token);
        JSONObject response=request("POST","/api/notifications/native-subscribe",device(captured).put("userId",expectedUser),idToken);
        if(!response.optBoolean("active")||!expectedUser.equals(response.optString("userId")))throw new IllegalStateException("School notifications could not verify your account.");
        boolean stale;
        synchronized(LOCK){JSONObject current=state(context);stale=!current.getString("installationId").equals(captured.getString("installationId"))||!current.optBoolean("enabled",true);
            if(!stale){current.put("accountId",expectedUser).put("token",token).put("registeredToken",token);current.remove("pendingAccount");save(context,current);}}
        if(stale){try{request("DELETE","/api/notifications/native-subscribe",device(captured),null);}catch(Exception ignored){}return status(context);}
        changed(context);return status(context);
    }
    static JSONObject test(Context context,String user,String idToken) throws Exception {
        JSONObject captured;synchronized(LOCK){captured=state(context);if(!user.equals(captured.optString("accountId")))throw new IllegalStateException("Enable school notifications first.");}
        return request("POST","/api/notifications/native-test",device(captured),idToken);
    }
    /** Clear local account eligibility before any network operation, including when signing out offline. */
    static void clear(Context context,boolean disable){
        synchronized(LOCK){try{JSONObject previous=state(context),next=NativePushStore.fresh();JSONArray retired=previous.optJSONArray("retired");if(retired==null)retired=new JSONArray();
                if(!previous.optString("accountId").isEmpty()||!previous.optString("pendingAccount").isEmpty())retired.put(device(previous));next.put("retired",retired).put("enabled",!disable&&previous.optBoolean("enabled",true));save(context,next);
            }catch(Exception ignored){return;}}
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        for(android.service.notification.StatusBarNotification item:manager.getActiveNotifications())if(item.getTag()!=null&&item.getTag().startsWith("school-push:"))manager.cancel(item.getTag(),item.getId());
        if(disable)FirebaseMessaging.getInstance().setAutoInitEnabled(false);
        deletion=FirebaseMessaging.getInstance().deleteToken();enqueue(context);changed(context);
    }
    static boolean reconcile(Context context){
        try{
            JSONObject captured;synchronized(LOCK){captured=state(context);}
            JSONArray retired=captured.optJSONArray("retired");if(retired!=null)for(int i=0;i<retired.length();i++){
                JSONObject old=retired.getJSONObject(i);try{request("DELETE","/api/notifications/native-subscribe",old,null);}catch(PushHttpError error){if(error.code!=403&&error.code!=410)throw error;}
                synchronized(LOCK){JSONObject current=state(context);JSONArray keep=new JSONArray(),list=current.optJSONArray("retired");if(list!=null)for(int j=0;j<list.length();j++)if(!old.getString("installationId").equals(list.getJSONObject(j).getString("installationId")))keep.put(list.getJSONObject(j));current.put("retired",keep);save(context,current);}
            }
            synchronized(LOCK){captured=state(context);}
            if(captured.optString("accountId").isEmpty()||!captured.optBoolean("enabled",true)||captured.optString("token").isEmpty()||captured.optString("token").equals(captured.optString("registeredToken")))return true;
            try{request("PATCH","/api/notifications/native-subscribe",device(captured),null);}
            catch(PushHttpError error){if(error.code==403||error.code==410){synchronized(LOCK){JSONObject current=state(context);if(current.optString("installationId").equals(captured.optString("installationId"))){current.remove("accountId");current.remove("registeredToken");save(context,current);}}changed(context);return true;}throw error;}
            synchronized(LOCK){JSONObject current=state(context);if(current.optString("installationId").equals(captured.optString("installationId"))){current.put("registeredToken",captured.optString("token"));save(context,current);}}
            changed(context);return true;
        }catch(Exception ignored){return false;}
    }
    static String tapRoute(Context context,Intent intent){
        try{synchronized(LOCK){JSONObject value=state(context);if(value.optBoolean("enabled",true)&&!value.optString("accountId").isEmpty()
            &&value.optString("accountId").equals(intent.getStringExtra("pushRecipient"))&&value.optString("installationId").equals(intent.getStringExtra("pushInstallation")))return NativePushPolicy.route(intent.getStringExtra("pushRoute"));}}
        catch(Exception ignored){}return null;
    }
    static void receive(Context context,Map<String,String> data){
        try{synchronized(LOCK){JSONObject value=state(context);if(!value.optBoolean("enabled",true)||!NativePushPolicy.accountMatches(value.optString("accountId"),BuildConfig.SCHOOL_FIREBASE_PROJECT,data.get("recipientId"),data.get("schoolProjectId")))return;
                post(context,data,value.optString("accountId"),value.getString("installationId"));}}
        catch(Exception ignored){}
    }
    static void post(Context context,Map<String,String> data,String recipient,String installation){
        if(!LessonReminders.notificationsAllowed(context))return;
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        String tag="school-push:"+data.getOrDefault("tag","school-announcement");
        if("FEE_REMINDER_RESOLVED".equals(data.get("type"))){manager.cancel(tag,1);return;}
        Intent open=new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .setData(android.net.Uri.parse("trinity-push://"+BuildConfig.APPLICATION_ID+"/"+android.net.Uri.encode(tag)))
            .putExtra("pushRoute",data.getOrDefault("url","/push-notifications")).putExtra("pushRecipient",recipient).putExtra("pushInstallation",installation);
        PendingIntent pending=PendingIntent.getActivity(context,tag.hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        android.app.Notification publicVersion=new NotificationCompat.Builder(context,CHANNEL).setSmallIcon(R.drawable.school_icon).setContentTitle(SchoolApp.NAME).setContentText("New school notification").build();
        android.app.Notification notification=new NotificationCompat.Builder(context,CHANNEL).setSmallIcon(R.drawable.school_icon).setLargeIcon(SchoolApp.notificationLogo(context))
            .setColor(android.graphics.Color.rgb(0,140,69)).setContentTitle(data.getOrDefault("title",SchoolApp.NAME)).setContentText(data.getOrDefault("body",""))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(data.getOrDefault("body",""))).setContentIntent(pending).setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setPublicVersion(publicVersion).build();
        manager.notify(tag,1,notification);changed(context,"PARENT_SCOPE_CHANGED".equals(data.get("type")));
    }
}
