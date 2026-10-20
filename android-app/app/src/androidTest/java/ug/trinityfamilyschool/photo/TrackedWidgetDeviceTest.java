package ug.trinityfamilyschool.photo;

import android.content.*;
import android.view.*;
import android.widget.*;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Synthetic records and isolated preferences; never opens the signed-in school's store. */
@RunWith(AndroidJUnit4.class)
public class TrackedWidgetDeviceTest {
    private TimetableSchedule.Frame liveSubject(String key, String classCode) {
        TimetableSchedule.Frame row = new TimetableSchedule.Frame(); row.trackedSubject = key; row.classCode = classCode; row.subjectCode = "ENG";
        row.className = classCode; row.title = "English"; row.hasPeriod = row.active = true;
        row.start = ZonedDateTime.now(ZoneId.of(row.timeZone)).withHour(8).withMinute(0).toInstant().toEpochMilli(); row.end = row.start + 3600000;
        return row;
    }
    private void measure(Context context, View view, float width) {
        int pixels = Math.round(width * context.getResources().getDisplayMetrics().density);
        view.measure(View.MeasureSpec.makeMeasureSpec(pixels, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
        view.layout(0, 0, pixels, view.getMeasuredHeight());
    }
    @Test public void inlineAndPairedCardsFitActualTextAndKeepSeparateCards() {
        Context base = ApplicationProvider.getApplicationContext(); AtomicReference<Throwable> failure = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                for (boolean dark : new boolean[]{false, true}) for (float scale : new float[]{1f, 1.5f, 2f}) {
                    android.content.res.Configuration config = new android.content.res.Configuration(base.getResources().getConfiguration());
                    config.fontScale = scale; config.uiMode = (config.uiMode & ~android.content.res.Configuration.UI_MODE_NIGHT_MASK) | (dark ? android.content.res.Configuration.UI_MODE_NIGHT_YES : android.content.res.Configuration.UI_MODE_NIGHT_NO);
                    Context context = base.createConfigurationContext(config);
                    TimetableSchedule.Frame first = liveSubject("a", "P4"), second = liveSubject("b", "P5");
                    float width = TimetableSurfaces.trackedWidth(context, first, true) + 1;
                    RemoteViews remote = TimetableSurfaces.trackedSubjectView(context, first, true, width);
                    assertEquals(R.layout.tracked_subject_inline, remote.getLayoutId());
                    View inline = remote.apply(context, new FrameLayout(context)); measure(context, inline, width);
                    TextView code = inline.findViewById(R.id.tracked_subject), time = inline.findViewById(R.id.tracked_time), state = inline.findViewById(R.id.tracked_state);
                    assertSame(code.getParent(), time.getParent()); assertEquals(1, time.getLineCount()); assertEquals(1, code.getLineCount());
                    assertTrue(time.getLeft() >= code.getRight()); assertTrue(state.getRight() <= inline.getWidth());
                    assertEquals(R.layout.tracked_subject_row, TimetableSurfaces.trackedSubjectView(context, first, true, width - 2).getLayoutId());
                    float half = Math.max(TimetableSurfaces.trackedWidth(context, first, false), TimetableSurfaces.trackedWidth(context, second, false)) + 1;
                    float full = half * 2 + TrackedWidgetLayout.GAP;
                    List<TrackedWidgetLayout.Row> rows = TrackedWidgetLayout.rows(Arrays.asList(first, second), full, frame -> TimetableSurfaces.trackedWidth(context, frame, false));
                    assertEquals(1, rows.size()); assertSame(second, rows.get(0).second);
                    View pair = TimetableSurfaces.widgetFeedRow(context, rows.get(0), true, 987677, false, 5).apply(context, new FrameLayout(context));
                    measure(context, pair, full);
                    View left = ((FrameLayout)pair.findViewById(R.id.tracked_left)).getChildAt(0), right = ((FrameLayout)pair.findViewById(R.id.tracked_right)).getChildAt(0);
                    assertEquals("P4 · ENG", ((TextView)left.findViewById(R.id.tracked_subject)).getText().toString());
                    assertEquals("P5 · ENG", ((TextView)right.findViewById(R.id.tracked_subject)).getText().toString());
                    assertTrue(right.getWidth() > 0); assertEquals(left.getWidth(), right.getWidth(), 1);
                    assertEquals(1, ((TextView)left.findViewById(R.id.tracked_time)).getLineCount());
                    first.sharedProgress = true;
                    View shared = TimetableSurfaces.trackedSubjectView(context, first, true, width).apply(context, new FrameLayout(context));
                    assertEquals(View.GONE, shared.findViewById(R.id.tracked_progress).getVisibility());
                    first.sharedProgress = false;
                    View independent = TimetableSurfaces.trackedSubjectView(context, first, true, width).apply(context, new FrameLayout(context));
                    assertEquals(View.VISIBLE, independent.findViewById(R.id.tracked_progress).getVisibility());
                }
            } catch (Throwable error) { failure.set(error); }
        });
        if (failure.get() != null) throw new AssertionError(failure.get());
    }
    @Test @androidx.test.filters.SdkSuppress(minSdkVersion = 31)
    public void pairedColumnsSendTheirOwnLessonThroughTheCollectionTemplate() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        String action = context.getPackageName() + ".TRACKED_PAIR_TEST." + UUID.randomUUID();
        java.util.concurrent.CountDownLatch delivered = new java.util.concurrent.CountDownLatch(2);
        List<String> lessons = new java.util.concurrent.CopyOnWriteArrayList<>();
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context ignored, Intent intent) {
                lessons.add(intent.getStringExtra("accountId") + ":" + intent.getStringExtra("trackedSubject")); delivered.countDown();
            }
        };
        if (android.os.Build.VERSION.SDK_INT >= 33) context.registerReceiver(receiver, new IntentFilter(action), Context.RECEIVER_NOT_EXPORTED);
        else context.registerReceiver(receiver, new IntentFilter(action));
        android.app.PendingIntent template = android.app.PendingIntent.getBroadcast(context, 0, new Intent(action).setPackage(context.getPackageName()), android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_MUTABLE);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        try {
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
                try {
                    TimetableSchedule.Frame first = liveSubject("a", "P4"), second = liveSubject("b", "P5"); first.accountId = second.accountId = "fixture";
                    RemoteViews pair = TimetableSurfaces.widgetFeedRow(context, new TrackedWidgetLayout.Row(first, second, 280), true, 987677, false, 5);
                    RemoteViews host = new RemoteViews(context.getPackageName(), R.layout.timetable_widget);
                    host.setPendingIntentTemplate(R.id.feed_list, template);
                    host.setRemoteAdapter(R.id.feed_list, new RemoteViews.RemoteCollectionItems.Builder().setViewTypeCount(1).addItem(0, pair).build());
                    View widget = host.apply(context, new FrameLayout(context));
                    ListView list = widget.findViewById(R.id.feed_list);
                    int size = Math.round(600 * context.getResources().getDisplayMetrics().density);
                    widget.measure(View.MeasureSpec.makeMeasureSpec(size, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(size, View.MeasureSpec.EXACTLY));
                    widget.layout(0, 0, size, size);
                    View actual = list.getChildAt(0);
                    assertNotNull(actual);
                    assertTrue(actual.findViewById(R.id.tracked_left).hasOnClickListeners());
                    assertTrue(actual.findViewById(R.id.tracked_right).hasOnClickListeners());
                    assertTrue(actual.findViewById(R.id.tracked_left).performClick());
                    assertTrue(actual.findViewById(R.id.tracked_right).performClick());
                } catch (Throwable error) { failure.set(error); }
            });
            if (failure.get() != null) throw new AssertionError(failure.get());
            assertTrue(delivered.await(5, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(new HashSet<>(Arrays.asList("fixture:a", "fixture:b")), new HashSet<>(lessons));
        } finally { context.unregisterReceiver(receiver); template.cancel(); }
    }
    private JSONObject envelope() throws Exception {
        JSONObject profile = new JSONObject().put("id", "upper").put("name", "Upper Primary").put("academicYearId", "year").put("termId", "term").put("classIds", new JSONArray().put("p4"));
        JSONObject period = new JSONObject().put("id", "lesson").put("dayOfWeek", 3).put("periodNumber", 1).put("type", "lesson").put("startTime", "08:00").put("endTime", "09:00");
        JSONObject table = new JSONObject().put("complete", true).put("profile", profile).put("periods", new JSONArray().put(period)).put("entries", new JSONArray().put(new JSONObject().put("classId", "p4").put("periodId", "lesson").put("subjectId", "english")));
        JSONObject data = new JSONObject().put("timetables", new JSONObject().put("data", new JSONArray().put(table)))
            .put("academicYears", new JSONObject().put("data", new JSONArray().put(new JSONObject().put("id", "year").put("terms", new JSONArray().put(new JSONObject().put("id", "term").put("startDate", "2026-09-01").put("endDate", "2026-12-01"))))))
            .put("classes", new JSONObject().put("data", new JSONArray().put(new JSONObject().put("id", "p4").put("name", "Primary Four").put("code", "P4"))))
            .put("subjects", new JSONObject().put("data", new JSONArray().put(new JSONObject().put("id", "english").put("name", "English").put("code", "ENG"))));
        return new JSONObject().put("session", new JSONObject().put("accountId", "fixture").put("grants", new JSONObject().put("timetable", true).put("events", false))).put("snapshot", new JSONObject().put("datasets", data));
    }
    @Test public void mixedFeedsRespectPerWidgetOrderAndChoicesWithoutChangingNotificationCards() throws Exception {
        Context base = ApplicationProvider.getApplicationContext();
        String file = "tracked-widget-test-" + UUID.randomUUID();
        Context context = new ContextWrapper(base) {
            @Override public SharedPreferences getSharedPreferences(String name, int mode) { return super.getSharedPreferences(file + name, mode); }
        };
        SharedPreferences prefs = TimetableSurfaces.prefs(context);
        ZonedDateTime now = LocalDateTime.parse("2026-10-07T08:30:00").atZone(ZoneId.of("Africa/Kampala"));
        String subject = TrackedSubjects.key("p4", "english"), prefix = TimetableSurfaces.prefix(987677);
        JSONObject envelope = envelope();
        try {
            prefs.edit().putString("account", "fixture").putBoolean(prefix + "tracking", true).putStringSet(prefix + "trackedSubjects", Set.of(subject))
                .putString(prefix + "rowOrder", new JSONArray().put("subject:" + subject).put("timetable:upper").toString()).commit();
            TimetableSchedule.Frame mixed = TimetableSurfaces.feed(context, envelope, 987677, now);
            assertEquals(2, mixed.profiles.size()); assertEquals(subject, mixed.profiles.get(0).trackedSubject);
            assertEquals("upper", mixed.profiles.get(1).profileId);
            assertTrue(mixed.profiles.get(0).sharedProgress);
            prefs.edit().putStringSet(prefix + "hiddenTables", Set.of("upper")).commit();
            assertFalse(TimetableSurfaces.feed(context, envelope, 987677, now).profiles.get(0).sharedProgress);
            prefs.edit().remove(prefix + "hiddenTables").commit();
            assertEquals(1, TimetableSurfaces.feed(context, envelope, 987678, now).profiles.size());
            assertTrue(TimetableSurfaces.feed(context, envelope, -1, now).profiles.get(0).trackedSubject.isEmpty());
            prefs.edit().putBoolean(prefix + "trackingWithTables", false).commit();
            TimetableSchedule.Frame trackedOnly = TimetableSurfaces.feed(context, envelope, 987677, now);
            assertEquals(1, trackedOnly.profiles.size()); assertFalse(trackedOnly.profiles.get(0).sharedProgress);
            TimetableSchedule.Frame done = TimetableSurfaces.feed(context, envelope, 987677, now.withHour(10));
            assertEquals("Done today", done.profiles.get(0).time);
            assertEquals("No lesson today", TimetableSurfaces.feed(context, envelope, 987677, now.plusDays(1)).profiles.get(0).time);
            envelope.getJSONObject("session").getJSONObject("grants").put("timetable", false);
            assertTrue(TimetableSurfaces.feed(context, envelope, 987677, now).profiles.isEmpty());
            envelope.getJSONObject("session").getJSONObject("grants").put("timetable", true);
            envelope.getJSONObject("session").put("accountId", "another-account");
            assertTrue(TimetableSurfaces.feed(context, envelope, 987677, now).profiles.get(0).trackedSubject.isEmpty());
        } finally { prefs.edit().clear().commit(); base.deleteSharedPreferences(file + "timetable-selection"); }
    }
    @Test public void compactRemoteViewsUseCodesAndPhoneTimeWithoutTeacherOrDateAtLargeTextSizes() throws Exception {
        Context base = ApplicationProvider.getApplicationContext(); AtomicReference<Throwable> failure = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                for (boolean dark : new boolean[]{false, true}) for (float scale : new float[]{1f, 1.5f, 2f}) {
                    android.content.res.Configuration config = new android.content.res.Configuration(base.getResources().getConfiguration());
                    config.fontScale = scale; config.uiMode = (config.uiMode & ~android.content.res.Configuration.UI_MODE_NIGHT_MASK) | (dark ? android.content.res.Configuration.UI_MODE_NIGHT_YES : android.content.res.Configuration.UI_MODE_NIGHT_NO);
                    Context context = base.createConfigurationContext(config);
                    ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Africa/Kampala"));
                    TimetableSchedule.Frame row = new TimetableSchedule.Frame(); row.classCode = "P4"; row.subjectCode = "ENG"; row.className = "Primary Four"; row.title = "English";
                    row.teacher = "Must not be displayed"; row.agenda = "Must not be displayed"; row.hasPeriod = row.active = true;
                    row.start = now.withHour(8).withMinute(0).withSecond(0).withNano(0).toInstant().toEpochMilli(); row.end = row.start + 3600000;
                    RemoteViews remote = TimetableSurfaces.trackedSubjectView(context, row, true);
                    View view = remote.apply(context, new FrameLayout(context)); remote.reapply(context, view);
                    assertEquals("P4 · ENG", ((TextView)view.findViewById(R.id.tracked_subject)).getText().toString());
                    String expected = WidgetLessonText.range(row.start, row.end, row.timeZone, android.text.format.DateFormat.getTimeFormat(context));
                    assertEquals(expected, ((TextView)view.findViewById(R.id.tracked_time)).getText().toString());
                    assertFalse(view.getContentDescription().toString().contains(row.teacher));
                    float density = context.getResources().getDisplayMetrics().density; int width = Math.round(168 * density);
                    view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)); view.layout(0, 0, width, view.getMeasuredHeight());
                    assertTrue(view.getMeasuredHeight() >= 48 * density - 1);
                    TextView code = view.findViewById(R.id.tracked_subject), state = view.findViewById(R.id.tracked_state);
                    assertTrue(code.getWidth() > 0); assertTrue(state.getWidth() > 0);
                    assertTrue(state.getRight() <= width);
                    assertTrue("Normal text fits a one-row widget", scale > 1f || view.getMeasuredHeight() <= 72 * density);
                    assertEquals(View.VISIBLE, view.findViewById(R.id.tracked_progress).getVisibility());
                    row.hasPeriod = row.active = false; row.time = "Done today";
                    View done = TimetableSurfaces.trackedSubjectView(context, row, true).apply(context, new FrameLayout(context));
                    assertEquals("Done today", ((TextView)done.findViewById(R.id.tracked_time)).getText().toString());
                    assertEquals(View.GONE, done.findViewById(R.id.tracked_state).getVisibility()); assertEquals(View.GONE, done.findViewById(R.id.tracked_progress).getVisibility());
                }
            } catch (Throwable error) { failure.set(error); }
        });
        if (failure.get() != null) throw new AssertionError(failure.get());
    }
}
