package ug.trinityfamilyschool.photo;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;

/** Native, offline-capable settings; appearance stays separate from lesson alerts. */
public final class LessonReminderSettingsActivity extends Activity {
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private LinearLayout content; private TextView status, preview, message; private Button save;
    private OfflineStore store; private JSONObject envelope, datasets; private String account = "";
    private LessonReminderPlan.Settings draft; private JSONObject restored; private boolean dark, loaded;
    private String restoredAccount = ""; private volatile int previewVersion;
    private final Map<String, Button> filterControls = new LinkedHashMap<>();
    @Override public void onCreate(Bundle state) {
        dark = (getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        setTheme(dark ? android.R.style.Theme_Material_NoActionBar : android.R.style.Theme_Material_Light_NoActionBar);
        super.onCreate(state); store = new OfflineStore(this);
        try { if (state != null) { restored = new JSONObject(state.getString("draft", "{}")); restoredAccount = state.getString("account", ""); } } catch (Exception ignored) { }
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); content = new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL); content.setPadding(dp(16), dp(12), dp(16), dp(24));
        scroll.addView(content); setContentView(scroll); SystemBars.install(this, scroll); SystemBars.apply(this, scroll, dark);
        button("Back").setOnClickListener(view -> finish());
        TextView title = label("Lesson reminders", 25); title.setTypeface(null, android.graphics.Typeface.BOLD);
        label("Choose the lessons and moments you want to hear about. Reminders also work offline while your saved timetable is available.", 14);
        message = label("Loading your timetables…", 14);
        io.execute(() -> {
            try {
                envelope = LessonReminders.authorized(store);
                if (envelope == null) throw new IllegalStateException("Open Trinity School and sign in to load an authorized timetable.");
                datasets = envelope.getJSONObject("snapshot").getJSONObject("datasets"); account = envelope.getJSONObject("session").getString("accountId");
                draft = restored == null || !account.equals(restoredAccount) ? LessonReminders.settings(this, account) : new LessonReminderPlan.Settings(restored);
                runOnUiThread(() -> { if (!isDestroyed()) { form(); loaded = true; updateStatus(); } });
            } catch (Exception error) { runOnUiThread(() -> { if (!isDestroyed()) { message.setText(error.getMessage()); button("Open Trinity School").setOnClickListener(view -> { startActivity(new Intent(this, MainActivity.class)); finish(); }); } }); }
        });
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView label(String value, int size) {
        TextView text = new TextView(this); text.setText(value); text.setTextSize(size); text.setTextColor(Color.parseColor(dark ? "#E2E8F0" : "#1F2937")); text.setPadding(0, dp(6), 0, dp(6)); content.addView(text); return text;
    }
    private void section(String value) { TextView text = label(value, 17); text.setTypeface(null, android.graphics.Typeface.BOLD); text.setPadding(0, dp(20), 0, dp(6)); }
    private Button button(String value) { Button button = new Button(this); button.setText(value); button.setAllCaps(false); button.setMinHeight(dp(48)); content.addView(button, new LinearLayout.LayoutParams(-1, -2)); return button; }
    private Switch toggle(String value, boolean checked, java.util.function.Consumer<Boolean> change) {
        Switch control = new Switch(this); control.setText(value); control.setTextSize(15); control.setMinHeight(dp(48)); control.setPadding(0, dp(4), dp(8), dp(4)); control.setChecked(checked); content.addView(control);
        control.setOnCheckedChangeListener((button, on) -> { change.accept(on); updatePreview(); }); return control;
    }
    private void choice(String title, String[] names, int selected, java.util.function.IntConsumer change) {
        label(title, 14); Spinner spinner = new Spinner(this); spinner.setContentDescription(title); spinner.setMinimumHeight(dp(48));
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, names); adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item); spinner.setAdapter(adapter); spinner.setSelection(selected); content.addView(spinner);
        spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() { public void onNothingSelected(AdapterView<?> parent) { } public void onItemSelected(AdapterView<?> parent, View view, int index, long id) { change.accept(index); updatePreview(); } });
    }
    private void minutes(String title, int current, java.util.function.IntConsumer change) {
        int[] minutes = {0, 1, 2, 3, 5, 10, 15, 20, 30, 45, 60}; String[] names = new String[minutes.length]; int selected = 0;
        for (int i = 0; i < minutes.length; i++) { names[i] = minutes[i] == 0 ? "Off" : minutes[i] + (minutes[i] == 1 ? " minute before" : " minutes before"); if (minutes[i] == current) selected = i; }
        choice(title, names, selected, index -> change.accept(minutes[index]));
    }
    private void form() {
        message.setVisibility(View.GONE);
        toggle("Enable lesson reminders", draft.enabled, value -> draft.enabled = value);
        status = label("", 14);
        button("Notification permission / settings").setOnClickListener(view -> {
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 74);
            else startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
        });
        button("Allow accurate reminder timing").setOnClickListener(view -> {
            if (Build.VERSION.SDK_INT >= 31) startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
            else android.widget.Toast.makeText(this, "Accurate timing is available on this phone.", Toast.LENGTH_SHORT).show();
        });
        section("When to remind me");
        toggle("At lesson start", draft.starts, value -> draft.starts = value);
        toggle("At lesson end", draft.ends, value -> draft.ends = value);
        minutes("Before lesson start", draft.beforeStart, value -> draft.beforeStart = value);
        minutes("Before lesson end", draft.beforeEnd, value -> draft.beforeEnd = value);
        toggle("Include scheduled activities", draft.activities, value -> draft.activities = value);
        toggle("Include breaks and lunch", draft.breaks, value -> draft.breaks = value);
        label("Breaks follow your timetable and class filters. Subject and teacher filters apply to lessons and activities.", 13);
        section("Which lessons"); label("Choices narrow as you select a timetable, class, subject and teacher. All means all matching choices. Incompatible selections below your choice reset to All; None stays None.", 13);
        filter("Timetables", "timetables", () -> draft.tables, value -> draft.tables = value);
        filter("Classes", "classes", () -> draft.classes, value -> draft.classes = value);
        filter("Subjects", "subjects", () -> draft.subjects, value -> draft.subjects = value);
        filter("Teachers", "teachers", () -> draft.teachers, value -> draft.teachers = value);
        filter("Lesson periods", "periods", () -> draft.periods, value -> draft.periods = value);
        label("For a double lesson, choose the period where it starts.", 13);
        section("Days and quiet hours");
        String[] days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"};
        Button schoolDays = button("School days · " + dayNames(draft.days));
        schoolDays.setOnClickListener(view -> {
            boolean[] checked = new boolean[7]; for (int i = 0; i < 7; i++) checked[i] = (draft.days & (1 << i)) != 0;
            new AlertDialog.Builder(this).setTitle("Reminder days").setMultiChoiceItems(days, checked, (dialog, index, on) -> checked[index] = on)
                .setPositiveButton("Apply", (dialog, which) -> { draft.days = 0; for (int i = 0; i < 7; i++) if (checked[i]) draft.days |= 1 << i; schoolDays.setText("School days · " + dayNames(draft.days)); updatePreview(); })
                .setNegativeButton("Cancel", null).show();
        });
        toggle("Use quiet hours", draft.quiet, value -> draft.quiet = value);
        timeButton("Quiet hours start", true); timeButton("Quiet hours end", false);
        label("Reminders inside quiet hours are skipped. Times use the school time zone. Equal start and end means quiet all day.", 13);
        section("Alert style");
        choice("Sound and vibration", new String[]{"Sound & vibration", "Vibration only", "Silent"}, Arrays.asList("sound", "vibrate", "silent").indexOf(draft.alert), index -> draft.alert = new String[]{"sound", "vibrate", "silent"}[index]);
        button("Customize tone, vibration and lock-screen display").setOnClickListener(view -> {
            LessonReminders.channels(this); startActivity(new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()).putExtra(Settings.EXTRA_CHANNEL_ID, LessonReminders.channel(draft.alert)));
        });
        label("Your phone’s Do Not Disturb and notification settings still apply.", 13);
        int[] snooze = {1, 5, 10, 15, 30}; String[] snoozeNames = {"1 minute", "5 minutes", "10 minutes", "15 minutes", "30 minutes"}; int current = 1; for (int i = 0; i < snooze.length; i++) if (snooze[i] == draft.snooze) current = i;
        choice("Snooze duration", snoozeNames, current, index -> draft.snooze = snooze[index]);
        button("Send test notification").setOnClickListener(view -> {
            if (!LessonReminders.notificationsAllowed(this)) { android.widget.Toast.makeText(this, "Allow notifications above, then try again.", Toast.LENGTH_LONG).show(); return; }
            LessonReminders.test(this, draft); android.widget.Toast.makeText(this, "Test notification sent.", Toast.LENGTH_SHORT).show();
        });
        section("Upcoming reminders"); preview = label("", 14); updatePreview();
        label("Preview uses your current choices before saving. Simultaneous lessons share one alert. Very late alerts are skipped.", 13);
        message = label("", 14); message.setVisibility(View.GONE);
        save = button("Save reminder settings"); save.setOnClickListener(view -> save());
    }
    private interface Selection { Set<String> get(); }
    private void filter(String title, String dataset, Selection get, java.util.function.Consumer<Set<String>> put) {
        Button control = button(""); control.setTag(title); filterControls.put(dataset, control); updateFilterCaptions();
        control.setOnClickListener(view -> {
            LinkedHashMap<String, String> available = LessonReminderFilters.choices(datasets, draft, dataset);
            List<String> ids = new ArrayList<>(available.keySet()), labels = new ArrayList<>(available.values());
            if (ids.isEmpty()) { new AlertDialog.Builder(this).setTitle(title).setMessage("No matching choices. Change the filters above this one.").setPositiveButton("OK", null).show(); return; }
            String[] options = new String[labels.size()+1]; options[0] = "All matching " + title.toLowerCase(Locale.US);
            for (int i = 0; i < labels.size(); i++) options[i+1] = labels.get(i);
            boolean[] selected = new boolean[options.length]; selected[0] = get.get() == null;
            for (int i = 0; i < ids.size(); i++) selected[i+1] = get.get() != null && get.get().contains(ids.get(i));
            // Existing selections survive merely opening a dialog; upstream changes reconcile them.
            Set<String> missing = get.get() == null ? new LinkedHashSet<>() : new LinkedHashSet<>(get.get()); missing.removeAll(ids);
            AlertDialog dialog = new AlertDialog.Builder(this).setTitle(title).setMultiChoiceItems(options, selected, (popup, index, on) -> {
                selected[index] = on; ListView list = ((AlertDialog) popup).getListView();
                if (index == 0 && on) for (int j = 1; j < selected.length; j++) { selected[j] = false; list.setItemChecked(j, false); }
                else if (index > 0 && on) { selected[0] = false; list.setItemChecked(0, false); }
            }).setPositiveButton("Apply", (popup, which) -> {
                Set<String> value = new LinkedHashSet<>(missing); for (int i = 0; i < ids.size(); i++) if (selected[i+1]) value.add(ids.get(i));
                put.accept(selected[0] ? null : value); LessonReminderFilters.reconcile(datasets, draft, dataset); updateFilterCaptions(); updatePreview();
            }).setNeutralButton("None", (popup, which) -> { put.accept(new LinkedHashSet<>()); LessonReminderFilters.reconcile(datasets, draft, dataset); updateFilterCaptions(); updatePreview(); }).setNegativeButton("Cancel", null).create(); dialog.show();
        });
    }
    private void updateFilterCaptions() {
        for (Map.Entry<String, Button> control : filterControls.entrySet()) {
            Set<String> selected = LessonReminderFilters.selected(draft, control.getKey()); int available = LessonReminderFilters.choices(datasets, draft, control.getKey()).size();
            control.getValue().setText(control.getValue().getTag() + " · " + (selected == null ? "All" : selected.isEmpty() ? "None" : selected.size() + " selected") + " (" + available + " available)");
        }
    }
    private void timeButton(String title, boolean start) {
        Button button = button(title + " · " + (start ? draft.quietStart : draft.quietEnd));
        button.setOnClickListener(view -> {
            LocalTime value = LocalTime.parse(start ? draft.quietStart : draft.quietEnd);
            new TimePickerDialog(this, (picker, hour, minute) -> { String time = String.format(Locale.US, "%02d:%02d", hour, minute); if (start) draft.quietStart = time; else draft.quietEnd = time; button.setText(title + " · " + time); updatePreview(); }, value.getHour(), value.getMinute(), true).show();
        });
    }
    private void updatePreview() {
        if (preview == null || draft == null) return;
        updateFilterCaptions();
        final LessonReminderPlan.Settings choices;
        try { choices = new LessonReminderPlan.Settings(draft.json()); } catch (Exception ignored) { return; }
        int version = ++previewVersion; updateStatus();
        io.execute(() -> {
        if (version != previewVersion) return;
        try {
            ZonedDateTime now = ZonedDateTime.now(ZoneId.of(envelope.getJSONObject("session").optString("timeZone", "Africa/Kampala")));
            List<LessonReminderPlan.Event> events = LessonReminderPlan.events(datasets, choices, now, OfflineStore.timestamp(envelope.getJSONObject("session").optString("expiresAt"))-1);
            StringBuilder text = new StringBuilder("Days: ").append(dayNames(choices.days));
            text.append("\nSchool time: ").append(now.getZone()).append('\n');
            if (!choices.enabled) text.append("Reminders are off."); else if (events.isEmpty()) text.append("No matching reminders in the next 7 days of the available timetable.");
            else { int count = 0; long previous = -1; for (LessonReminderPlan.Event event : events) { if (event.at == previous) continue; previous = event.at; if (count++ == 4) break;
                List<LessonReminderPlan.Event> batch = LessonReminderPlan.at(events, event.at);
                text.append('\n').append(Instant.ofEpochMilli(event.at).atZone(now.getZone()).format(DateTimeFormatter.ofPattern("EEE d MMM, HH:mm"))).append(" · ").append(batch.size()).append(batch.size() == 1 ? " reminder\n" : " reminders\n").append(event.line()).append('\n');
            } }
            runOnUiThread(() -> { if (!isDestroyed() && version == previewVersion) preview.setText(text); });
        } catch (Exception error) { runOnUiThread(() -> { if (!isDestroyed() && version == previewVersion) preview.setText("Timetable preview is unavailable. Reopen the timetable to refresh it."); }); }
        });
    }
    private String dayNames(int mask) { String[] names = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}; List<String> selected = new ArrayList<>(); for (int i = 0; i < names.length; i++) if ((mask & (1 << i)) != 0) selected.add(names[i]); return selected.isEmpty() ? "None" : String.join(", ", selected); }
    private void updateStatus() {
        if (status == null) return;
        status.setText((LessonReminders.notificationsAllowed(this) ? "Notifications allowed." : "Notifications blocked — allow them above.") + "\n" + (LessonReminders.exactAllowed(this) ? "Accurate reminder timing allowed." : "Accurate timing not allowed — Android may delay reminders."));
    }
    private void save() {
        final LessonReminderPlan.Settings chosen;
        try { chosen = new LessonReminderPlan.Settings(draft.json()); } catch (Exception error) { message.setVisibility(View.VISIBLE); message.setText("Could not read your choices. Reopen reminder settings."); return; }
        save.setEnabled(false); message.setVisibility(View.VISIBLE); message.setText("Saving…");
        io.execute(() -> { try { LessonReminders.save(this, store, account, chosen); runOnUiThread(() -> { if (!isDestroyed()) { save.setEnabled(true); message.setText(chosen.enabled ? "Reminder settings saved." : "Reminders turned off."); updateStatus(); } }); }
            catch (Exception error) { runOnUiThread(() -> { if (!isDestroyed()) { save.setEnabled(true); message.setText(error.getMessage()); } }); } });
    }
    @Override protected void onResume() { super.onResume(); if (loaded) { updateStatus(); io.execute(() -> LessonReminders.reschedule(this, store)); } }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) { super.onRequestPermissionsResult(request, permissions, results); if (request == 74) { updateStatus(); io.execute(() -> LessonReminders.reschedule(this, store)); } }
    @Override protected void onSaveInstanceState(Bundle state) { super.onSaveInstanceState(state); try { if (draft != null) { state.putString("draft", draft.json().toString()); state.putString("account", account); } } catch (Exception ignored) { } }
    @Override protected void onDestroy() { io.shutdown(); super.onDestroy(); }
}
