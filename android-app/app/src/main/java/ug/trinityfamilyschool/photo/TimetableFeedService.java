package ug.trinityfamilyschool.photo;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import org.json.JSONObject;
import java.time.*;
import java.util.*;
/** On-demand collection for older Android and tracked feeds of any size. */
public final class TimetableFeedService extends RemoteViewsService {
    @Override public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new RemoteViewsFactory() {
            private List<TrackedWidgetLayout.Row> rows = new ArrayList<>();
            public void onCreate() { onDataSetChanged(); }
            public void onDataSetChanged() {
                rows = new ArrayList<>();
                try {
                    JSONObject envelope = new OfflineStore(TimetableFeedService.this).timetableAvailable();
                    if (envelope != null && TimetableSurfaces.authorized(envelope)) {
                        List<TimetableSchedule.Frame> feed = TimetableSurfaces.feed(TimetableFeedService.this, envelope, intent.getIntExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_ID, 0), ZonedDateTime.now(ZoneId.of(envelope.getJSONObject("session").optString("timeZone", "Africa/Kampala")))).profiles;
                        rows = TrackedWidgetLayout.rows(feed, intent.getFloatExtra("contentWidth", 238), frame -> TimetableSurfaces.trackedWidth(TimetableFeedService.this, frame, false));
                    }
                } catch (Exception ignored) {}
            }
            public void onDestroy() { rows.clear(); }
            public int getCount() { return rows.size(); }
            public RemoteViews getViewAt(int position) { return position >= 0 && position < rows.size() ? TimetableSurfaces.widgetFeedRow(TimetableFeedService.this, rows.get(position), intent.getBooleanExtra("progress", false), intent.getIntExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_ID, 0), intent.getBooleanExtra("compact", false), intent.getIntExtra("columns", intent.getBooleanExtra("compact", false) ? 2 : 5)) : null; }
            public RemoteViews getLoadingView() { return null; }
            public int getViewTypeCount() { return 5; }
            public long getItemId(int position) { return position; }
            public boolean hasStableIds() { return false; }
        };
    }
}
