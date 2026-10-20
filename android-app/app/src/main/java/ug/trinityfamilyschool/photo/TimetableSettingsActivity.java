package ug.trinityfamilyschool.photo;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.*;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.util.*;
import java.util.concurrent.*;

/** Optional appearance controls for the all-timetables feed. */
public final class TimetableSettingsActivity extends Activity {
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private OfflineStore store; private JSONObject datasets; private String accountId = "";
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private LinearLayout content; private Switch progress, notificationCard, events, eventReminders;
    private boolean eventsAllowed;
    private boolean timetableAllowed;
    private Switch tracking, withTables;
    private Button showAllTables;
    private LinearLayout orderPanel;
    private List<String> order = new ArrayList<>();
    private String timeZone = "Africa/Kampala";
    private TrackedSubjectPicker subjectPicker;
    private final List<String> tableIds = new ArrayList<>();
    private final Map<String, CheckBox> visibility = new LinkedHashMap<>(); private Set<String> hidden;
    private TextView message, timing; private Button apply;
    @Override public void onCreate(Bundle state) {
        boolean dark = AppAppearance.palette(this).dark;
        setTheme(dark ? android.R.style.Theme_Material_NoActionBar : android.R.style.Theme_Material_Light_NoActionBar);
        DeviceColors.applyNative(this);
        super.onCreate(state); setResult(RESULT_CANCELED);
        widgetId = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            android.appwidget.AppWidgetProviderInfo info = AppWidgetManager.getInstance(this).getAppWidgetInfo(widgetId);
            if (info == null || !getPackageName().equals(info.provider.getPackageName()) || !(TimetableWidget.class.getName().equals(info.provider.getClassName()) || TimetableProgressWidget.class.getName().equals(info.provider.getClassName()))) { finish(); return; }
        }
        store = new OfflineStore(this);
        ScrollView scroll = new ScrollView(this); content = new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL);
        int inset = dp(20); SystemBars.install(this, scroll); SystemBars.apply(this, scroll, dark);
        content.setPadding(inset, inset, inset, inset); scroll.addView(content); setContentView(scroll);
        TextView title = label(widgetId == AppWidgetManager.INVALID_APPWIDGET_ID ? "Timetables & events" : "Timetables & events widget"); title.setTextSize(26);
        label(widgetId == AppWidgetManager.INVALID_APPWIDGET_ID ? "Choose timetables for the notification card and widgets using the default selection." : "Choose schedules for this widget.");
        button("Lesson reminder settings").setOnClickListener(view -> startActivity(new Intent(this, LessonReminderSettingsActivity.class)));
        message = label("Loading schedules…");
        io.execute(() -> {
            try {
                JSONObject envelope = store.timetableAvailable();
                if (envelope == null || !TimetableSurfaces.authorized(envelope)) throw new IllegalStateException("Open " + SchoolApp.NAME + " and sign in online to load your timetable.");
                eventsAllowed=envelope.getJSONObject("session").getJSONObject("grants").optBoolean("events");
                timetableAllowed=envelope.getJSONObject("session").getJSONObject("grants").optBoolean("timetable");
                datasets = envelope.getJSONObject("snapshot").getJSONObject("datasets");
                accountId = envelope.getJSONObject("session").getString("accountId");
                timeZone = envelope.getJSONObject("session").optString("timeZone", "Africa/Kampala");
                if (!TimetableSurfaces.prefs(this).getString("account", accountId).equals(accountId)) TimetableSurfaces.clear(this);
                hidden = TimetableSurfaces.hidden(this, widgetId); order = TimetableSurfaces.rowOrder(this, widgetId);
                runOnUiThread(() -> { if (!isDestroyed()) form(); });
            } catch (Exception error) { runOnUiThread(() -> {
                if (isDestroyed()) return; message.setText(error.getMessage());
                Button open = button("Open " + SchoolApp.NAME); open.setOnClickListener(view -> { startActivity(new Intent(this, MainActivity.class)); finish(); });
            }); }
        });
    }
    private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density); }
    private TextView label(String value) { TextView text = new TextView(this); text.setText(value); text.setTextColor(android.graphics.Color.parseColor((getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES ? "#E2E8F0" : "#1F2937")); text.setTextSize(16); text.setPadding(0, dp(8), 0, dp(8)); content.addView(text); return text; }
    private Button button(String title) { Button value = new Button(this); value.setText(title); value.setMinHeight(dp(48)); content.addView(value); return value; }
    private void form() {
        try {
            JSONObject saved = datasets.optJSONObject("timetables"); JSONArray tables = saved == null ? null : saved.optJSONArray("data"); List<String> names = new ArrayList<>();
            if (tables != null) for (int i = 0; i < tables.length(); i++) { JSONObject row = tables.getJSONObject(i); if (!row.optBoolean("complete")) continue; tableIds.add(row.getJSONObject("profile").getString("id")); names.add(row.getJSONObject("profile").optString("name", "Timetable")); }
            if (tableIds.isEmpty() && !eventsAllowed) { message.setText("Connect and open the timetable page to load the class schedules."); Button open = button("Open timetable"); open.setOnClickListener(view -> { startActivity(new Intent(this, MainActivity.class).putExtra("onlineRoute", PhotoPolicy.ORIGIN + "/timetable")); finish(); }); return; }
            message.setVisibility(View.GONE);
            if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID && timetableAllowed) subjectControls();
            label("Timetables to show");
            for (int i = 0; i < tableIds.size(); i++) {
                CheckBox check = new CheckBox(this); check.setText(names.get(i)); check.setMinHeight(dp(48)); check.setChecked(!hidden.contains(tableIds.get(i))); content.addView(check); visibility.put(tableIds.get(i), check);
                check.setOnCheckedChangeListener((button, checked) -> rebuildOrder());
            }
            showAllTables = button("Show all timetables"); showAllTables.setOnClickListener(view -> { for (CheckBox check : visibility.values()) check.setChecked(true); });
            updateTableControls();
            label("Display choices do not change lesson reminder subscriptions.");
            timing = label(""); updateTiming();
            button("Allow accurate timetable timing").setOnClickListener(view -> {
                if (android.os.Build.VERSION.SDK_INT >= 31) startActivity(new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, android.net.Uri.parse("package:" + getPackageName())));
                else Toast.makeText(this, "Accurate timing is available on this phone.", Toast.LENGTH_SHORT).show();
            });
            if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
                notificationCard = new Switch(this); notificationCard.setText("Show notification card"); notificationCard.setMinHeight(dp(48));
                notificationCard.setChecked(TimetableSurfaces.prefs(this).getBoolean("card", true)); content.addView(notificationCard);
            }
            if (eventsAllowed) {
                events=new Switch(this); events.setText("Show all upcoming events"); events.setMinHeight(dp(48));
                events.setChecked(TimetableSurfaces.showEvents(this,widgetId)); content.addView(events);
                events.setOnCheckedChangeListener((button, checked) -> rebuildOrder());
                label("Even when off, events appear from the day before they start until they end. Scroll through events and timetables.");
                if(widgetId==AppWidgetManager.INVALID_APPWIDGET_ID) {
                    eventReminders=new Switch(this); eventReminders.setText("Event reminders: one day before and at the start"); eventReminders.setMinHeight(dp(48));
                    eventReminders.setChecked(TimetableSurfaces.prefs(this).getBoolean("eventReminders",false)); content.addView(eventReminders);
                } else button("Event notification settings").setOnClickListener(view -> startActivity(new Intent(this,TimetableSettingsActivity.class)));
            }
            progress = new Switch(this); progress.setText("Show lesson progress"); progress.setMinHeight(dp(48));
            android.appwidget.AppWidgetProviderInfo info = AppWidgetManager.getInstance(this).getAppWidgetInfo(widgetId);
            boolean defaultProgress = widgetId == AppWidgetManager.INVALID_APPWIDGET_ID || (info != null && TimetableProgressWidget.class.getName().equals(info.provider.getClassName()));
            progress.setChecked(TimetableSurfaces.prefs(this).getBoolean(TimetableSurfaces.prefix(widgetId) + "progress", defaultProgress)); content.addView(progress);
            if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) label("Resize on your home screen. Scroll to see every timetable and class.");
            if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                label("Card order"); label("Move cards up or down to arrange this widget. New cards follow your saved choices.");
                orderPanel = new LinearLayout(this); orderPanel.setOrientation(LinearLayout.VERTICAL); content.addView(orderPanel); rebuildOrder();
            }
            apply = button(widgetId == AppWidgetManager.INVALID_APPWIDGET_ID ? "Update timetable card" : "Add / update widget"); apply.setOnClickListener(view -> apply());
            Button cancel = button("Cancel"); cancel.setOnClickListener(view -> finish());

        } catch (Exception error) { message.setText("Unable to load timetable controls. Reopen the application."); }
    }
    private void apply() {
        try {
            if (tracking != null && tracking.isChecked() && subjectPicker.selectedKeys().isEmpty()) {
                message.setVisibility(View.VISIBLE); message.setText("Choose at least one subject to track."); return;
            }
            if (((notificationCard != null && notificationCard.isChecked()) || (eventReminders != null && eventReminders.isChecked())) && android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 73); return;
            }
            JSONObject selected = new JSONObject();
            Set<String> chosenHidden = new HashSet<>(hidden);
            for (Map.Entry<String, CheckBox> choice : visibility.entrySet()) { if (choice.getValue().isChecked()) chosenHidden.remove(choice.getKey()); else chosenHidden.add(choice.getKey()); }
            selected.put("accountId", accountId).put("hiddenTables", new JSONArray(chosenHidden));
            if (tracking != null) {
                JSONArray chosen = new JSONArray();
                for (String key : subjectPicker.selectedKeys()) chosen.put(key);
                selected.put("tracking", tracking.isChecked()).put("trackedSubjects", chosen);
                selected.put("trackingWithTables", withTables.isChecked());
            }
            if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) selected.put("rowOrder", new JSONArray(order));
            if(events!=null) selected.put("events",events.isChecked());
            if(eventReminders!=null) selected.put("eventReminders",eventReminders.isChecked());
            if (progress != null) selected.put("progress", progress.isChecked());
            if (notificationCard != null) selected.put("notificationCard", notificationCard.isChecked());
            apply.setEnabled(false); message.setVisibility(View.VISIBLE); message.setText("Updating…");
            io.execute(() -> {
                try {
                    TimetableSurfaces.select(this, store, selected, widgetId);
                    runOnUiThread(() -> {
                        if (isDestroyed()) return;
                        done();
                    });
                } catch (Exception error) { runOnUiThread(() -> { if (!isDestroyed()) { apply.setEnabled(true); message.setVisibility(View.VISIBLE); message.setText(error.getMessage()); } }); }
            });
        } catch (Exception error) { message.setText("Could not update timetable appearance."); }
    }
    private void subjectControls() throws JSONException {
        tracking = new Switch(this); tracking.setText("Track selected subjects"); tracking.setMinHeight(dp(48));
        tracking.setChecked(TimetableSurfaces.tracking(this, widgetId)); content.addView(tracking);
        LinearLayout choices = new LinearLayout(this); choices.setOrientation(LinearLayout.VERTICAL); content.addView(choices);
        TextView help = new TextView(this); help.setText("Choose a class, then select its subjects for today. Repeat for any other classes. Compact cards use class and subject codes, without dates or teachers. Times follow your phone's 12/24-hour setting."); help.setPadding(0, dp(8), 0, dp(8)); choices.addView(help);
        withTables = new Switch(this); withTables.setText("Show timetable cards alongside tracked lessons"); withTables.setMinHeight(dp(48)); withTables.setChecked(TimetableSurfaces.trackingWithTables(this, widgetId)); choices.addView(withTables);
        withTables.setOnCheckedChangeListener((button, checked) -> { updateTableControls(); rebuildOrder(); });
        Set<String> saved = TimetableSurfaces.trackedSubjects(this, widgetId);
        Map<String, String> available = TrackedSubjects.choices(datasets);
        for (String id : new TreeSet<>(saved)) if (!available.containsKey(id)) {
            try { JSONArray pair = new JSONArray(id); available.put(id, TimetableSchedule.name(datasets, "classes", pair.getString(0)) + " · " + TimetableSchedule.name(datasets, "subjects", pair.getString(1)) + " (not in saved timetables)"); }
            catch (JSONException ignored) { }
        }
        subjectPicker = new TrackedSubjectPicker(this, datasets, available, saved, this::rebuildOrder);
        choices.addView(subjectPicker);
        choices.setVisibility(tracking.isChecked() ? View.VISIBLE : View.GONE);
        tracking.setOnCheckedChangeListener((button, checked) -> { choices.setVisibility(checked ? View.VISIBLE : View.GONE); updateTableControls(); rebuildOrder(); });
    }
    private void updateTableControls() {
        boolean full = tracking == null || !tracking.isChecked() || withTables.isChecked();
        for (CheckBox check : visibility.values()) { check.setEnabled(full); check.setAlpha(full ? 1f : 0.5f); }
        if (showAllTables != null) showAllTables.setEnabled(full);
    }
    private void rebuildOrder() {
        if (orderPanel == null) return;
        try {
            Map<String, String> cards = new LinkedHashMap<>(), laterEvents = new LinkedHashMap<>();
            java.time.ZonedDateTime now = java.time.ZonedDateTime.now(java.time.ZoneId.of(timeZone));
            if (eventsAllowed) for (SchoolEventSchedule.Event event : SchoolEventSchedule.events(datasets, now.getZone())) {
                if (!SchoolEventSchedule.visible(event, now.toInstant().toEpochMilli(), events != null && events.isChecked())) continue;
                (now.toInstant().toEpochMilli() >= event.spotlight ? cards : laterEvents).put("event:" + event.id, "Event · " + event.title);
            }
            if (timetableAllowed && (tracking == null || !tracking.isChecked() || withTables.isChecked())) for (Map.Entry<String, CheckBox> choice : visibility.entrySet()) {
                if (choice.getValue().isChecked()) cards.put("timetable:" + choice.getKey(), "Timetable · " + choice.getValue().getText());
            }
            if (tracking != null && tracking.isChecked()) {
                Set<String> selected = subjectPicker.selectedKeys();
                for (TimetableSchedule.Frame row : TrackedSubjects.feed(datasets, selected, now, true).profiles) cards.put(WidgetFeedOrder.key(row), "Lesson · " + row.classCode + " · " + row.subjectCode);
            }
            cards.putAll(laterEvents);
            List<String> visible = WidgetFeedOrder.visible(order, cards.keySet()); orderPanel.removeAllViews();
            if (visible.isEmpty()) { TextView empty = new TextView(this); empty.setText("Choose the cards to show above."); orderPanel.addView(empty); }
            for (int i = 0; i < visible.size(); i++) {
                final int index = i; String key = visible.get(i);
                LinearLayout line = new LinearLayout(this); line.setGravity(Gravity.CENTER_VERTICAL);
                TextView title = new TextView(this); title.setText(cards.get(key)); title.setTextSize(14); line.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
                for (int direction : new int[]{-1, 1}) {
                    Button move = new Button(this); move.setText(direction < 0 ? "Up" : "Down"); move.setMinHeight(dp(48)); move.setMinWidth(dp(48));
                    move.setContentDescription("Move " + cards.get(key) + (direction < 0 ? " up" : " down"));
                    move.setEnabled(index + direction >= 0 && index + direction < visible.size());
                    move.setOnClickListener(view -> {
                        Collections.swap(visible, index, index + direction); order = WidgetFeedOrder.remember(order, visible); rebuildOrder();
                        ViewGroup moved = (ViewGroup)orderPanel.getChildAt(index + direction); if (moved != null) moved.getChildAt(direction < 0 ? 1 : 2).requestFocus();
                    });
                    line.addView(move, new LinearLayout.LayoutParams(-2, -2));
                }
                orderPanel.addView(line);
            }
        } catch (Exception error) { message.setVisibility(View.VISIBLE); message.setText("Unable to arrange saved cards. Reopen widget settings."); }
    }
    private void done() { setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)); finish(); }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == 73) {
            if (results.length > 0 && results[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) apply();
            else { message.setVisibility(View.VISIBLE); message.setText("Allow notifications in your phone's app settings to show the card, or turn Show notification card off."); }
        }
    }
    private void updateTiming() {
        if (timing != null) timing.setText(LessonReminders.exactAllowed(this) ? "Accurate timetable timing is allowed." : "Allow accurate timetable timing to reduce Android delays when the app is closed.");
    }
    @Override protected void onResume() {
        super.onResume(); updateTiming(); TimetableRefresh.request(this);
    }
    @Override protected void onDestroy() { io.shutdown(); super.onDestroy(); }
}
