package ug.trinityfamilyschool.photo;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.webkit.WebView;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.util.*;
import java.util.concurrent.*;

/** App-owned foreground work, independent of the screen's Activity lifecycle. */
final class DocumentWork {
    static final String CHANNEL = "document-creation";
    static final int ONGOING = 8700;
    private static DocumentWork instance;
    static synchronized DocumentWork get(Context context) { if (instance == null) instance = new DocumentWork(context); return instance; }
    final Context context;
    final DocumentStore store;
    final ExecutorService io = Executors.newSingleThreadExecutor();
    final Handler main = new Handler(Looper.getMainLooper());
    final Map<String, Job> jobs = new ConcurrentHashMap<>();
    final Set<String> activeFiles = new HashSet<>(); // io thread only
    long activeBytes; // io thread only
    final Set<WebView> retained = Collections.newSetFromMap(new IdentityHashMap<>());
    DocumentCreationService service;
    int visible;
    static final class Job {
        final String id, title; final WebView owner; final Runnable timeout;
        int progress; String message = "Preparing document"; Runnable cleanup;
        Job(String id, String title, WebView owner, Runnable timeout) { this.id=id; this.title=title; this.owner=owner; this.timeout=timeout; }
    }
    private DocumentWork(Context context) {
        this.context = context.getApplicationContext(); store = new DocumentStore(this.context);
        NotificationManager notifications = (NotificationManager)this.context.getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Document creation", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("PDF progress, saved documents and creation failures"); notifications.createNotificationChannel(channel);
        io.execute(() -> store.prune(Collections.emptySet()));
    }
    void start(String id, String title, WebView owner) {
        if (!PhotoPolicy.validId(id) || jobs.containsKey(id) || jobs.size() >= 4) throw new IllegalStateException("Wait for the current documents to finish, then try again.");
        Runnable timeout = () -> fail(id, "PDF creation took too long. Open the document and try again.");
        jobs.put(id, new Job(id, title.length() > 120 ? title.substring(0,120) : title, owner, timeout));
        try { ContextCompat.startForegroundService(context, new Intent(context, DocumentCreationService.class)); }
        catch (RuntimeException error) { jobs.remove(id); throw new IllegalStateException("Open the app to start document creation."); }
        owner.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        main.postDelayed(timeout, 30 * 60 * 1000L); update();
    }
    boolean owns(String id, WebView owner) { Job job=jobs.get(id); return job != null && job.owner == owner; }
    boolean active(WebView owner) { for(Job job:jobs.values()) if(job.owner==owner)return true; return false; }
    void progress(String id, WebView owner, int progress, String message) {
        Job job=jobs.get(id); if(job==null || job.owner!=owner)return;
        job.progress=Math.max(0,Math.min(99,progress)); job.message=message.length()>140?message.substring(0,140):message; update();
    }
    Notification notification() {
        Job first=jobs.values().stream().findFirst().orElse(null);
        Intent open=new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return new NotificationCompat.Builder(context,CHANNEL).setSmallIcon(R.drawable.school_icon)
            .setContentTitle(jobs.size()>1?"Creating "+jobs.size()+" documents":first==null?"Finishing documents":first.title)
            .setContentText(first==null?"Trinity Files":first.message).setOngoing(true).setOnlyAlertOnce(true).setSilent(true)
            .setProgress(100,first==null?0:first.progress,first==null||first.progress==0)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setContentIntent(PendingIntent.getActivity(context,ONGOING,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE)).build();
    }
    private void update() {
        if(service!=null && !jobs.isEmpty()) ((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).notify(ONGOING,notification());
    }
    void finish(String id, WebView owner, String fileName, String mime, Uri uri, boolean saved) {
        Job job=jobs.get(id); if(job==null||job.owner!=owner)return;
        notifyResult(job.title,saved?"Saved in Trinity Files":"PDF ready. Tap to open; download again to save in Trinity Files.",uri,mime);
        end(id);
    }
    void fail(String id,String message) {
        Job job=jobs.get(id);if(job==null)return;
        try { job.owner.evaluateJavascript("window.dispatchEvent(new CustomEvent('trinity-document-cancel',{detail:"+org.json.JSONObject.quote(id)+"}))",null); } catch(Exception ignored){}
        notifyResult("Document creation stopped",message,null,null);end(id);
    }
    void cancel(String id, WebView owner) { if(owns(id,owner))end(id); }
    void cancelOwner(WebView owner) { for(Job job:new ArrayList<>(jobs.values()))if(job.owner==owner)fail(job.id,"The document page closed. Open it and try again."); }
    private void end(String id) {
        Job job=jobs.remove(id);if(job==null)return;main.removeCallbacks(job.timeout);
        if(job.cleanup!=null)job.cleanup.run();
        if(!active(job.owner))try{job.owner.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT,true);}catch(Exception ignored){}
        if(!active(job.owner)&&retained.contains(job.owner)) main.postDelayed(()->{if(!active(job.owner)&&retained.remove(job.owner))job.owner.destroy();},1000);
        if(jobs.isEmpty()) { main.postDelayed(()->{if(jobs.isEmpty()&&service!=null)service.stopSelf();},250); } else update();
    }
    private void notifyResult(String title,String message,Uri uri,String mime) {
        int id=store.prefs.getInt("notificationId",40000)+1; if(id>1000000)id=40001;
        store.prefs.edit().putInt("notificationId",id).apply();
        Intent open=uri==null?new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT|Intent.FLAG_ACTIVITY_SINGLE_TOP):new Intent(Intent.ACTION_VIEW).setDataAndType(uri,mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);
        if(uri!=null)open.setClipData(ClipData.newRawUri("Document",uri));
        Notification result=new NotificationCompat.Builder(context,CHANNEL).setSmallIcon(R.drawable.school_icon).setContentTitle(title).setContentText(message)
            .setContentIntent(PendingIntent.getActivity(context,id,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE))
            .setAutoCancel(true).setSilent(visible>0).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build();
        try { ((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).notify(id,result); } catch(SecurityException ignored){}
    }
}
