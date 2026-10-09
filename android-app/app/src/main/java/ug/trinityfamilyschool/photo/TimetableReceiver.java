package ug.trinityfamilyschool.photo;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.util.concurrent.Executors;

public final class TimetableReceiver extends BroadcastReceiver {
    private static final java.util.concurrent.ExecutorService interactions = Executors.newSingleThreadExecutor();
    @Override public void onReceive(Context context, Intent intent) {
        if(Intent.ACTION_WALLPAPER_CHANGED.equals(intent.getAction()))DeviceColors.changed(context);
        if ("ug.trinity.timetable.HIDE".equals(intent.getAction())) { TimetableUpdates.hideCard(context); return; }
        PendingResult pending = goAsync();
        long received = android.os.SystemClock.elapsedRealtime();
        interactions.execute(() -> { try {
            long started = android.os.SystemClock.elapsedRealtime();
            OfflineStore store = new OfflineStore(context);
            boolean interaction = "ug.trinity.timetable.INTERACT".equals(intent.getAction());
            if (interaction) TimetableInteractions.apply(context, store, intent);
            long applied = android.os.SystemClock.elapsedRealtime();
            if (interaction) TimetableSurfaces.refresh(context, store, intent.getIntExtra("surfaceId", android.appwidget.AppWidgetManager.INVALID_APPWIDGET_ID));
            else if ("ug.trinity.timetable.UPDATE".equals(intent.getAction()) || "ug.trinity.timetable.TICK".equals(intent.getAction())) TimetableSurfaces.refresh(context, store);
            else TimetableUpdates.refresh(context, store);
            if ((context.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0 && interaction) android.util.Log.i("TrinityTimetable", intent.getStringExtra("operation")
                + " queue_ms=" + (started-received) + " apply_ms=" + (applied-started)
                + " publish_ms=" + (android.os.SystemClock.elapsedRealtime()-applied));
        } catch (Exception ignored) { TimetableRefresh.retry(context); }
        finally { pending.finish(); } });
    }
}
