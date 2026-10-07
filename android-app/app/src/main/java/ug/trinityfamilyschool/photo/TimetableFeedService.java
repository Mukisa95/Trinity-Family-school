package ug.trinityfamilyschool.photo;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import org.json.JSONObject;
import java.time.*;
import java.util.*;
/** Collection adapter for Android 8-11; newer launchers receive direct collection items. */
public final class TimetableFeedService extends RemoteViewsService {
    @Override public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new RemoteViewsFactory() {
            private List<TimetableSchedule.Frame> rows = new ArrayList<>();
            public void onCreate() { onDataSetChanged(); }
            public void onDataSetChanged() {
                rows = new ArrayList<>();
                try {
                    JSONObject envelope = new OfflineStore(TimetableFeedService.this).timetableAvailable();
                    if (envelope != null && envelope.getJSONObject("session").getJSONObject("grants").optBoolean("timetable")) rows = TimetableSurfaces.feed(TimetableFeedService.this, envelope, intent.getIntExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_ID, 0), ZonedDateTime.now(ZoneId.of(envelope.getJSONObject("session").optString("timeZone", "Africa/Kampala")))).profiles;
                } catch (Exception ignored) {}
            }
            public void onDestroy() { rows.clear(); }
            public int getCount() { return rows.size(); }
            public RemoteViews getViewAt(int position) { return position < rows.size() ? TimetableSurfaces.profileView(TimetableFeedService.this, rows.get(position), intent.getBooleanExtra("progress", false), intent.getIntExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_ID, 0), intent.getBooleanExtra("compact", false), false) : null; }
            public RemoteViews getLoadingView() { return null; }
            public int getViewTypeCount() { return 1; }
            public long getItemId(int position) { return position; }
            public boolean hasStableIds() { return true; }
        };
    }
}
