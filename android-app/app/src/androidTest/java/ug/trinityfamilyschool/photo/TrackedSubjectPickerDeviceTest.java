package ug.trinityfamilyschool.photo;

import android.content.Context;
import android.view.*;
import android.widget.*;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Isolated class/subject picker views; does not read or change school preferences. */
@RunWith(AndroidJUnit4.class)
public class TrackedSubjectPickerDeviceTest {
    private JSONObject datasets() throws Exception {
        return new JSONObject()
            .put("classes", new JSONObject().put("data", new JSONArray()
                .put(new JSONObject().put("id", "p4").put("code", "P4").put("name", "Primary Four"))
                .put(new JSONObject().put("id", "p5").put("code", "P5").put("name", "Primary Five"))))
            .put("subjects", new JSONObject().put("data", new JSONArray()
                .put(new JSONObject().put("id", "eng").put("code", "ENG").put("name", "English"))
                .put(new JSONObject().put("id", "math").put("code", "MTC").put("name", "Mathematics"))));
    }

    private void selectClass(TrackedSubjectPicker picker, int index) {
        Spinner spinner = picker.findViewWithTag("tracking-class");
        spinner.setSelection(index);
        spinner.getOnItemSelectedListener().onItemSelected(spinner, null, index, index);
    }

    @Test public void subjectsStayHiddenUntilClassSelectionAndChoicesSurviveClassSwitches() throws Exception {
        AtomicReference<Throwable> failure = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                for (int theme : new int[]{android.R.style.Theme_Material_Light_NoActionBar, android.R.style.Theme_Material_NoActionBar}) {
                    Context context = new ContextThemeWrapper(ApplicationProvider.getApplicationContext(), theme);
                    Map<String, String> available = new LinkedHashMap<>();
                    String p4eng = TrackedSubjects.key("p4", "eng"), p4math = TrackedSubjects.key("p4", "math"), p5eng = TrackedSubjects.key("p5", "eng");
                    available.put(p4eng, "Primary Four · English"); available.put(p4math, "Primary Four · Mathematics"); available.put(p5eng, "Primary Five · English");
                    int[] changes = {0};
                    TrackedSubjectPicker picker = new TrackedSubjectPicker(context, datasets(), available, Set.of(p5eng), () -> changes[0]++);
                    assertNull(picker.findViewWithTag(p4eng)); assertNull(picker.findViewWithTag(p5eng));
                    selectClass(picker, 1);
                    assertNotNull(picker.findViewWithTag(p4eng)); assertNotNull(picker.findViewWithTag(p4math));
                    assertNull(picker.findViewWithTag(p5eng));
                    ((CheckBox)picker.findViewWithTag(p4math)).setChecked(true);
                    assertEquals(Set.of(p4math, p5eng), picker.selectedKeys());
                    selectClass(picker, 2);
                    assertNull(picker.findViewWithTag(p4math));
                    CheckBox saved = picker.findViewWithTag(p5eng); assertTrue(saved.isChecked()); saved.setChecked(false);
                    assertEquals(Set.of(p4math), picker.selectedKeys());
                    selectClass(picker, 1); assertTrue(((CheckBox)picker.findViewWithTag(p4math)).isChecked());
                    assertEquals(2, changes[0]);
                    assertEquals("Selected subjects by class: P4 (1)", ((TextView)picker.findViewWithTag("tracking-summary")).getText().toString());
                    picker.selectedKeys().clear(); assertEquals(Set.of(p4math), picker.selectedKeys());
                    selectClass(picker, 0); assertNull(picker.findViewWithTag(p4math)); assertEquals(Set.of(p4math), picker.selectedKeys());
                    for (int width : new int[]{320, 720}) {
                        float density = context.getResources().getDisplayMetrics().density;
                        picker.measure(View.MeasureSpec.makeMeasureSpec((int)(width * density), View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
                        picker.layout(0, 0, picker.getMeasuredWidth(), picker.getMeasuredHeight());
                        assertTrue(((View)picker.findViewWithTag("tracking-class")).getMeasuredHeight() >= 48 * density - 1);
                    }
                }
            } catch (Throwable error) { failure.set(error); }
        });
        if (failure.get() != null) throw new AssertionError(failure.get());
    }

    @Test public void emptyAndPreviouslySavedUnavailableChoicesRemainUsable() throws Exception {
        AtomicReference<Throwable> failure = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                Context context = new ContextThemeWrapper(ApplicationProvider.getApplicationContext(), android.R.style.Theme_Material_Light_NoActionBar);
                TrackedSubjectPicker empty = new TrackedSubjectPicker(context, datasets(), Collections.emptyMap(), Collections.emptySet(), () -> {});
                assertFalse(((Spinner)empty.findViewWithTag("tracking-class")).isEnabled()); assertTrue(empty.selectedKeys().isEmpty());
                String key = TrackedSubjects.key("old-class", "old-subject");
                TrackedSubjectPicker saved = new TrackedSubjectPicker(context, datasets(), Map.of(key, "Saved subject (not in saved timetables)"), Set.of(key), () -> {});
                selectClass(saved, 1); CheckBox choice = saved.findViewWithTag(key);
                assertTrue(choice.isChecked()); choice.setChecked(false); assertTrue(saved.selectedKeys().isEmpty());
            } catch (Throwable error) { failure.set(error); }
        });
        if (failure.get() != null) throw new AssertionError(failure.get());
    }
}
