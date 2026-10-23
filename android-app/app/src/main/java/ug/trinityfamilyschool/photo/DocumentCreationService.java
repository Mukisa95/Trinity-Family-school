package ug.trinityfamilyschool.photo;

import android.app.Service;
import android.content.Intent;
import android.os.*;
import androidx.core.app.ServiceCompat;

/** User-started local file processing; no server push subscription is needed. */
public final class DocumentCreationService extends Service {
    private PowerManager.WakeLock wake;
    @Override public void onCreate() {
        super.onCreate(); DocumentWork work=DocumentWork.get(this);work.service=this;
        wake=((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,getPackageName()+":documents");
        wake.setReferenceCounted(false);wake.acquire(31*60*1000L);
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId) {
        DocumentWork work=DocumentWork.get(this);
        try {
            ServiceCompat.startForeground(this,DocumentWork.ONGOING,work.notification(),Build.VERSION.SDK_INT>=29?android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC:0);
            if(wake.isHeld())wake.release();wake.acquire(31*60*1000L);
        } catch(RuntimeException error) {
            for(String id:new java.util.ArrayList<>(work.jobs.keySet()))work.fail(id,"Open the app to restart document creation.");stopSelf();
        }
        if(work.jobs.isEmpty())stopSelf();
        return START_NOT_STICKY;
    }
    @Override public void onTimeout(int startId,int type) {
        DocumentWork work=DocumentWork.get(this);
        for(String id:new java.util.ArrayList<>(work.jobs.keySet()))work.fail(id,"Android stopped background document creation. Open the document and try again.");
        stopSelf();
    }
    @Override public void onDestroy() {
        DocumentWork work=DocumentWork.get(this);work.service=null;
        for(String id:new java.util.ArrayList<>(work.jobs.keySet()))work.fail(id,"Background document creation stopped. Open the document and try again.");
        if(wake!=null&&wake.isHeld())wake.release();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) {return null;}
}
