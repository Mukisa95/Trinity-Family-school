package ug.trinityfamilyschool.photo;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

public class TimetableWidget extends AppWidgetProvider {
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refresh(context, null);
    }
    private void refresh(Context context, Integer resizedWidget) {
        PendingResult pending = goAsync();
        java.util.concurrent.ExecutorService executor = java.util.concurrent.Executors.newSingleThreadExecutor();
        executor.execute(() -> { try {
            if (resizedWidget == null) TimetableUpdates.refresh(context, new OfflineStore(context));
            else TimetableSurfaces.refresh(context, new OfflineStore(context), resizedWidget);
        } finally { pending.finish(); executor.shutdown(); } });
    }
    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, android.os.Bundle options) { refresh(context, id); }
    @Override public void onDeleted(Context context, int[] ids) { for (int id : ids) TimetableSurfaces.deleteWidget(context, id); onUpdate(context, AppWidgetManager.getInstance(context), new int[0]); }
}
