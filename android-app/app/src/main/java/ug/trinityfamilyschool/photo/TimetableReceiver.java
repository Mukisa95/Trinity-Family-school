package ug.trinityfamilyschool.photo;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.util.concurrent.Executors;

public final class TimetableReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if ("ug.trinity.timetable.HIDE".equals(intent.getAction())) { TimetableUpdates.hideCard(context); return; }
        PendingResult pending = goAsync();
        java.util.concurrent.ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.execute(() -> { try {
            OfflineStore store = new OfflineStore(context);
            if ("ug.trinity.timetable.INTERACT".equals(intent.getAction())) TimetableInteractions.apply(context, store, intent);
            TimetableUpdates.refresh(context, store);
        } catch (Exception ignored) { TimetableUpdates.refresh(context, new OfflineStore(context)); }
        finally { pending.finish(); executor.shutdown(); } });
    }
}
