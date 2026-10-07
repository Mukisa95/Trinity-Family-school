package ug.trinityfamilyschool.photo;
import android.content.*;
import java.util.concurrent.Executors;

public final class LessonReminderReceiver extends BroadcastReceiver {
    private static final java.util.concurrent.ExecutorService worker = Executors.newSingleThreadExecutor();
    @Override public void onReceive(Context context, Intent intent) {
        PendingResult pending = goAsync();
        worker.execute(() -> { try { LessonReminders.receive(context, new OfflineStore(context), intent); }
            catch (Exception ignored) { LessonReminders.reschedule(context, new OfflineStore(context)); }
            finally { pending.finish(); } });
    }
}
