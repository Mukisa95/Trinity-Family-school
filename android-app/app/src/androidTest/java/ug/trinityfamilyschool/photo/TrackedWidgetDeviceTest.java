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
            assertEquals(1, TimetableSurfaces.feed(context, envelope, 987678, now).profiles.size());
            assertTrue(TimetableSurfaces.feed(context, envelope, -1, now).profiles.get(0).trackedSubject.isEmpty());
            prefs.edit().putBoolean(prefix + "trackingWithTables", false).commit();
            assertEquals(1, TimetableSurfaces.feed(context, envelope, 987677, now).profiles.size());
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
