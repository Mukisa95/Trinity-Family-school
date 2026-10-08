package ug.trinityfamilyschool.photo;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class AppUpdateReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){
        long saved=AppUpdater.downloadId(context);
        if(saved<0 || !DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction()) || intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID,-1)!=saved)return;
        PendingResult pending=goAsync();
        new Thread(()->{try{AppUpdater.complete(context);}finally{pending.finish();}}).start();
    }
}
