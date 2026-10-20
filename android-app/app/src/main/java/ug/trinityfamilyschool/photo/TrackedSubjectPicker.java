package ug.trinityfamilyschool.photo;

import android.annotation.SuppressLint;
import android.content.Context;
import android.view.View;
import android.widget.*;
import org.json.*;
import java.util.*;

/** Class-first subject selection. Changing the visible class never clears another class's choices. */
@SuppressLint("ViewConstructor") // Built with saved timetable data by settings; never inflated from XML.
final class TrackedSubjectPicker extends LinearLayout {
    private final Set<String> selected = new LinkedHashSet<>();
    private final Map<String, List<String>> byClass = new LinkedHashMap<>();
    private final Map<String, String> classCodes = new LinkedHashMap<>();
    private final Map<String, String> descriptions;
    private final JSONObject datasets;
    private final LinearLayout subjectList;
    private final TextView summary;
    private final Runnable onChanged;

    TrackedSubjectPicker(Context context, JSONObject datasets, Map<String, String> available,
                         Set<String> saved, Runnable onChanged) throws JSONException {
        super(context);
        this.datasets = datasets; this.descriptions = available; this.onChanged = onChanged;
        setOrientation(VERTICAL);
        for (String key : available.keySet()) {
            JSONArray pair = new JSONArray(key);
            byClass.computeIfAbsent(pair.getString(0), ignored -> new ArrayList<>()).add(key);
            if (saved.contains(key)) selected.add(key);
        }
        TextView label = text("Class"); addView(label);
        Spinner classes = new Spinner(context); classes.setTag("tracking-class");
        classes.setId(View.generateViewId()); label.setLabelFor(classes.getId());
        classes.setContentDescription("Choose class for lesson tracking"); classes.setPrompt("Choose class");
        classes.setMinimumHeight(dp(48));
        List<String> ids = new ArrayList<>(byClass.keySet());
        List<String> names = new ArrayList<>(); names.add("Choose class");
        for (String id : ids) {
            String code = TrackedSubjects.code(datasets, "classes", id);
            String name = TimetableSchedule.name(datasets, "classes", id);
            classCodes.put(id, code);
            names.add(code.equals("?") || code.equals(name) ? name : code + " · " + name);
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<>(context, android.R.layout.simple_spinner_item, names);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        classes.setAdapter(adapter); addView(classes, new LayoutParams(-1, -2));
        summary = text(""); summary.setTag("tracking-summary");
        summary.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE); addView(summary);
        subjectList = new LinearLayout(context); subjectList.setOrientation(VERTICAL); addView(subjectList);
        classes.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                showClass(position == 0 ? null : ids.get(position - 1));
            }
            @Override public void onNothingSelected(AdapterView<?> parent) { showClass(null); }
        });
        updateSummary(); showClass(null);
        classes.setEnabled(!ids.isEmpty());
    }

    Set<String> selectedKeys() { return new LinkedHashSet<>(selected); }

    private void showClass(String classId) {
        subjectList.removeAllViews();
        if (classId == null) {
            subjectList.addView(text(byClass.isEmpty() ? "Connect and open Timetable to load subject choices."
                : "Choose a class to see its subjects. You can then choose another class to add more."));
            return;
        }
        for (String key : byClass.get(classId)) {
            JSONArray pair;
            try { pair = new JSONArray(key); } catch (JSONException ignored) { continue; }
            String subjectId = pair.optString(1);
            String code = TrackedSubjects.code(datasets, "subjects", subjectId);
            String name = TimetableSchedule.name(datasets, "subjects", subjectId);
            CheckBox check = new CheckBox(getContext()); check.setTag(key);
            check.setText(code.equals("?") || code.equals(name) ? name : code + " · " + name);
            check.setContentDescription(descriptions.get(key)); check.setMinHeight(dp(48));
            check.setChecked(selected.contains(key)); subjectList.addView(check);
            check.setOnCheckedChangeListener((button, checked) -> {
                if (checked) selected.add(key); else selected.remove(key);
                updateSummary(); onChanged.run();
            });
        }
    }

    private void updateSummary() {
        List<String> counts = new ArrayList<>();
        for (Map.Entry<String, List<String>> group : byClass.entrySet()) {
            int count = 0; for (String key : group.getValue()) if (selected.contains(key)) count++;
            if (count > 0) counts.add(classCodes.get(group.getKey()) + " (" + count + ")");
        }
        summary.setText(counts.isEmpty() ? "No subjects selected yet." : "Selected subjects by class: " + String.join(", ", counts));
    }

    private TextView text(String value) {
        TextView view = new TextView(getContext()); view.setText(value); view.setTextSize(16);
        view.setPadding(0, dp(8), 0, dp(8)); return view;
    }
    private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density); }
}
