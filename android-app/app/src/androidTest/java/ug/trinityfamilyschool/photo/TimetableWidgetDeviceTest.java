package ug.trinityfamilyschool.photo;
import android.content.Context;
import android.view.*;
import android.widget.*;
import android.graphics.*;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.*;
import static org.junit.Assert.*;

/** Renders real RemoteViews with synthetic lessons; does not install a launcher widget. */
@RunWith(AndroidJUnit4.class)
public class TimetableWidgetDeviceTest {
    @Test public void cardShowsAllTimetablesAndSystemCountdown() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        TimetableSchedule.Frame frame = new TimetableSchedule.Frame(); frame.className = "Primary Four"; frame.title = "English"; frame.time = "08:00 – 10:00";
        frame.active = true; frame.progress = 50; frame.remainingMinutes = 60; frame.end = System.currentTimeMillis() + 3600000;
        android.app.Notification card = TimetableSurfaces.card(context, new JSONObject().put("timetableId", "fixture").put("classId", "fixture-class"), frame, 987601);
        assertTrue((card.flags & android.app.Notification.FLAG_ONGOING_EVENT) != 0);
        assertEquals(2, card.actions.length); assertEquals("Open timetables", card.actions[0].title.toString()); assertEquals("Settings", card.actions[1].title.toString());
        assertEquals(50, card.extras.getInt(android.app.Notification.EXTRA_PROGRESS)); assertEquals(100, card.extras.getInt(android.app.Notification.EXTRA_PROGRESS_MAX));
        assertEquals(frame.end, card.when); assertTrue(card.extras.getBoolean(android.app.Notification.EXTRA_SHOW_CHRONOMETER));
        assertEquals("School timetables", card.extras.getString(android.app.Notification.EXTRA_TITLE));
        if (card.contentIntent != null) card.contentIntent.cancel();
    }
    @Test public void allWidgetSizesRenderWithAndWithoutProgress() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        File output = new File(context.getCacheDir(), "widget-qa"); output.mkdirs();
        java.util.concurrent.atomic.AtomicReference<Throwable> failure = new java.util.concurrent.atomic.AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                TimetableSchedule.Frame frame = new TimetableSchedule.Frame(); frame.className = "Primary Four · North"; frame.title = "English"; frame.time = "08:00 – 10:00"; frame.teacher = "Example Teacher";
                frame.active = true; frame.progress = 50; frame.remainingMinutes = 60; frame.next = "Next: Science · 10:15 – 11:00"; frame.agenda = "Primary Four - English\nPrimary Five - Mathematics\n10:15 – 11:00  Science\n11:00 – 12:00  Mathematics\n12:00 – 12:30  Lunch";
                frame.tableName = "Upper Primary"; frame.profiles.add(frame);
                TimetableSchedule.Frame other = new TimetableSchedule.Frame(); other.tableName = "Lower Primary"; other.title = "Lesson 2"; other.agenda = "Primary One - Reading\nPrimary Two - Writing"; frame.profiles.add(other);
                JSONObject selected = new JSONObject().put("timetableId", "fixture").put("classId", "fixture-class");
                int[] layouts = {R.layout.timetable_widget_compact, R.layout.timetable_widget, R.layout.timetable_widget_large};
                int[] widths = {180, 300, 350}, heights = {170, 190, 330}; String[] names = {"compact", "medium", "large"};
                for (int i = 0; i < layouts.length; i++) for (boolean progress : new boolean[]{false, true}) {
                    android.appwidget.AppWidgetHostView host = new android.appwidget.AppWidgetHostView(context);
                    android.appwidget.AppWidgetProviderInfo info = android.appwidget.AppWidgetManager.getInstance(context).getInstalledProviders().stream()
                        .filter(provider -> provider.provider.equals(new android.content.ComponentName(context, TimetableWidget.class))).findFirst().orElseThrow();
                    host.setAppWidget(987600, info);
                    View view = TimetableSurfaces.widgetView(context, 987600, selected, frame, progress, layouts[i]).apply(context, host);
                    View row = TimetableSurfaces.profileView(context, frame, progress).apply(context, new FrameLayout(context));
                    assertEquals("English", ((TextView) row.findViewById(R.id.current_lesson)).getText().toString());
                    assertTrue(((TextView) row.findViewById(R.id.lesson_agenda)).getText().toString().contains("Primary Five"));
                    assertEquals(progress ? View.VISIBLE : View.GONE, row.findViewById(R.id.lesson_progress).getVisibility());
                    assertEquals(50, ((ProgressBar) row.findViewById(R.id.lesson_progress)).getProgress());
                    float density = context.getResources().getDisplayMetrics().density; int width = (int) (widths[i] * density), height = (int) (heights[i] * density);
                    view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY)); view.layout(0, 0, width, height);
                    ListView list = view.findViewById(R.id.feed_list);
                    assertEquals("Both timetables must be in the scrollable feed", 2, list.getAdapter().getCount());
                    assertTrue("Feed fits widget", list.getBottom() <= height);
                    Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888); view.draw(new Canvas(bitmap));
                    try (FileOutputStream file = new FileOutputStream(new File(output, names[i] + (progress ? "-progress.png" : "-plain.png")))) { bitmap.compress(Bitmap.CompressFormat.PNG, 100, file); } bitmap.recycle();
                }
            } catch (Throwable error) { failure.set(error); }
        });
        if (failure.get() != null) throw new AssertionError("RemoteViews rendering failed", failure.get());
        // Only cancel intents reserved for the synthetic high widget ID.
        android.app.PendingIntent click = android.app.PendingIntent.getActivity(context, 9000 + 987600, new android.content.Intent(context, MainActivity.class), android.app.PendingIntent.FLAG_NO_CREATE | android.app.PendingIntent.FLAG_IMMUTABLE);
        if (click != null) click.cancel();
        android.app.PendingIntent settings = android.app.PendingIntent.getActivity(context, 8000 + 987600, new android.content.Intent(context, TimetableSettingsActivity.class), android.app.PendingIntent.FLAG_NO_CREATE | android.app.PendingIntent.FLAG_IMMUTABLE);
        if (settings != null) settings.cancel();
    }
}
