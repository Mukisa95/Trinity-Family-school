package ug.trinityfamilyschool.photo;

import android.appwidget.AppWidgetManager;
import android.content.*;
import android.os.Build;
import android.view.*;
import android.widget.*;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Synthetic views only: never posts a notification, installs a widget or changes school preferences. */
@RunWith(AndroidJUnit4.class)
public class CompactNotificationResizeDeviceTest {
    @Test public void notificationDetailsAndOddWidgetSizesKeepCompactCodesAndAllLessons() throws Exception {
        if (Build.VERSION.SDK_INT < 31) return;
        AtomicReference<Throwable> failure = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            Context base = ApplicationProvider.getApplicationContext(); String file = "presentation-qa-" + UUID.randomUUID();
            Context context = new ContextWrapper(base) {
                @Override public SharedPreferences getSharedPreferences(String name, int mode) {
                    return base.getSharedPreferences("timetable-selection".equals(name) ? file : name, mode);
                }
            };
            try {
                TimetableSchedule.Frame row = new TimetableSchedule.Frame(); row.accountId = "synthetic";
                row.profileId = "table"; row.periodId = "lesson"; row.tableName = "Upper"; row.shortLabel = "L1"; row.title = "Lesson 1"; row.time = "08:00 – 09:00";
                for (int i = 0; i < 7; i++) {
                    TimetableSchedule.Pill pill = new TimetableSchedule.Pill(); pill.id = "pill-" + i;
                    pill.classCode = "P" + (i + 1); pill.subjectCode = "ENG";
                    pill.className = "Private class name"; pill.subjectName = "Private subject name"; pill.teacher = "Private teacher";
                    pill.time = row.time; row.pills.add(pill);
                }
                String key = TimetableInteractions.detailKey(AppWidgetManager.INVALID_APPWIDGET_ID, row, ZonedDateTime.now(ZoneId.of(row.timeZone)));
                TimetableSurfaces.prefs(context).edit().putString(key, "pill-0").commit();
                View notice = TimetableSurfaces.profileView(context, row, false, AppWidgetManager.INVALID_APPWIDGET_ID, false, true).apply(context, new FrameLayout(context));
                assertEquals("P1 · ENG", ((TextView)notice.findViewById(R.id.detail_subject)).getText().toString());
                assertEquals(View.GONE, notice.findViewById(R.id.detail_teacher).getVisibility());
                assertEquals("", ((TextView)notice.findViewById(R.id.detail_teacher)).getText().toString());
                assertFalse(notice.findViewById(R.id.pill_details).getContentDescription().toString().contains("Private"));
                TimetableSurfaces.prefs(context).edit().remove(key).commit();
                View chips = TimetableSurfaces.profileView(context, row, false, AppWidgetManager.INVALID_APPWIDGET_ID, false, true).apply(context, new FrameLayout(context));
                assertEquals(3, ((LinearLayout)chips.findViewById(R.id.pills_container)).getChildCount());
                assertFalse(chips.findViewById(R.id.lesson_pill).getContentDescription().toString().contains("Private"));
                TimetableSchedule.Frame feed = new TimetableSchedule.Frame(); feed.accountId = "synthetic"; feed.profiles.add(row);
                for (int[] size : new int[][]{{177, 65}, {219, 107}, {287, 151}, {413, 257}}) {
                    FrameLayout host = new FrameLayout(context);
                    View view = TimetableSurfaces.widgetForSize(context, 987688, feed, false, size[0], size[1]).apply(context, host);
                    float density = context.getResources().getDisplayMetrics().density;
                    int width = Math.round(size[0] * density), height = Math.round(size[1] * density);
                    view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY)); view.layout(0, 0, width, height);
                    assertEquals(width, view.getMeasuredWidth()); assertEquals(height, view.getMeasuredHeight());
                    assertEquals(View.GONE, view.findViewById(R.id.widget_header).getVisibility()); assertTrue(view.findViewById(R.id.feed_list).getHeight() > 0);
                    int columns = WidgetSizing.columns(size[0], context.getResources().getConfiguration().fontScale);
                    View lessons = TimetableSurfaces.profileView(context, row, false, 987688, columns <= 2, false, columns).apply(context, host);
                    LinearLayout lines = lessons.findViewById(R.id.pills_container); assertEquals((7 + columns - 1) / columns, lines.getChildCount());
                    int count = 0; for (int i = 0; i < lines.getChildCount(); i++) count += ((LinearLayout)lines.getChildAt(i)).getChildCount(); assertEquals(7, count);
                }
            } catch (Throwable error) { failure.set(error); }
            finally { TimetableSurfaces.prefs(context).edit().clear().commit(); }
        });
        if (failure.get() != null) throw new AssertionError(failure.get());
    }
}
