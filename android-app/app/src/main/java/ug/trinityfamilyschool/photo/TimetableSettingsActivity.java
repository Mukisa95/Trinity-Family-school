package ug.trinityfamilyschool.photo;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.util.*;
import java.util.concurrent.*;

/** Optional appearance controls for the all-timetables feed. */
public final class TimetableSettingsActivity extends Activity {
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private OfflineStore store; private JSONObject datasets, initial;
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private LinearLayout content; private Switch enabled, progress;
    private final List<String> tableIds = new ArrayList<>();
    private TextView message; private Button apply;
    @Override public void onCreate(Bundle state) {
        boolean dark = (getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        setTheme(dark ? android.R.style.Theme_Material_NoActionBar : android.R.style.Theme_Material_Light_NoActionBar);
        super.onCreate(state); setResult(RESULT_CANCELED);
        widgetId = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            android.appwidget.AppWidgetProviderInfo info = AppWidgetManager.getInstance(this).getAppWidgetInfo(widgetId);
            if (info == null || !getPackageName().equals(info.provider.getPackageName()) || !(TimetableWidget.class.getName().equals(info.provider.getClassName()) || TimetableProgressWidget.class.getName().equals(info.provider.getClassName()))) { finish(); return; }
        }
        store = new OfflineStore(this);
        ScrollView scroll = new ScrollView(this); content = new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL);
        int inset = dp(20); scroll.setOnApplyWindowInsetsListener((view, insets) -> { view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets; });
        content.setPadding(inset, inset, inset, inset); scroll.addView(content); setContentView(scroll);
        TextView title = label(widgetId == AppWidgetManager.INVALID_APPWIDGET_ID ? "Timetable card" : "Timetable widget"); title.setTextSize(26);
        label("All timetables and classes appear automatically.");
        message = label("Loading timetable…");
        io.execute(() -> {
            try {
                JSONObject envelope = store.available();
                if (envelope == null || !envelope.getJSONObject("session").getJSONObject("grants").optBoolean("timetable")) throw new IllegalStateException("Open Trinity School and sign in online to load your timetable.");
                datasets = envelope.getJSONObject("snapshot").getJSONObject("datasets"); initial = TimetableSurfaces.selection(this, widgetId);
                runOnUiThread(() -> { if (!isDestroyed()) form(); });
            } catch (Exception error) { runOnUiThread(() -> {
                if (isDestroyed()) return; message.setText(error.getMessage());
                Button open = button("Open Trinity School"); open.setOnClickListener(view -> { startActivity(new Intent(this, MainActivity.class)); finish(); });
            }); }
        });
    }
    private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density); }
    private TextView label(String value) { TextView text = new TextView(this); text.setText(value); text.setTextSize(16); text.setPadding(0, dp(8), 0, dp(8)); content.addView(text); return text; }
    private Button button(String title) { Button value = new Button(this); value.setText(title); value.setMinHeight(dp(48)); content.addView(value); return value; }
    private Spinner spinner(String title) { label(title); Spinner value = new Spinner(this); value.setContentDescription(title); value.setMinimumHeight(dp(48)); content.addView(value, new LinearLayout.LayoutParams(-1, dp(56))); return value; }
    private void items(Spinner view, List<String> values, List<String> ids, String selected) {
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, values); adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item); view.setAdapter(adapter);
        int index = ids.indexOf(selected); if (index >= 0) view.setSelection(index);
    }
    private void form() {
        try {
            JSONObject saved = datasets.optJSONObject("timetables"); JSONArray tables = saved == null ? null : saved.optJSONArray("data"); List<String> names = new ArrayList<>();
            if (tables != null) for (int i = 0; i < tables.length(); i++) { JSONObject row = tables.getJSONObject(i); if (!row.optBoolean("complete")) continue; tableIds.add(row.getJSONObject("profile").getString("id")); names.add(row.getJSONObject("profile").optString("name", "Timetable")); }
            if (tableIds.isEmpty()) { message.setText("Connect and open the timetable page to load the class schedules."); Button open = button("Open timetable"); open.setOnClickListener(view -> { startActivity(new Intent(this, MainActivity.class).putExtra("onlineRoute", PhotoPolicy.ORIGIN + "/timetable")); finish(); }); return; }
            message.setText("");
            if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { enabled = new Switch(this); enabled.setText("Show notification card"); enabled.setChecked(initial.optBoolean("notificationCard", true)); enabled.setMinHeight(dp(48)); content.addView(enabled); }
            else {
                progress = new Switch(this); progress.setText("Show lesson progress"); progress.setMinHeight(dp(48));
                android.appwidget.AppWidgetProviderInfo info = AppWidgetManager.getInstance(this).getAppWidgetInfo(widgetId);
                progress.setChecked(TimetableSurfaces.prefs(this).getBoolean(TimetableSurfaces.prefix(widgetId) + "progress", info != null && TimetableProgressWidget.class.getName().equals(info.provider.getClassName()))); content.addView(progress);
                label("Resize on your home screen. Scroll to see every timetable and class.");
            }
            apply = button(widgetId == AppWidgetManager.INVALID_APPWIDGET_ID ? "Update timetable card" : "Add / update widget"); apply.setOnClickListener(view -> apply());
            Button cancel = button("Cancel"); cancel.setOnClickListener(view -> finish());

        } catch (Exception error) { message.setText("Unable to load timetable controls. Reopen the application."); }
    }
    private void apply() {
        try {
            JSONObject selected = new JSONObject();
            if (enabled != null) selected.put("notificationCard", enabled.isChecked()); if (progress != null) selected.put("progress", progress.isChecked());
            apply.setEnabled(false); message.setText("Updating…");
            io.execute(() -> {
                try {
                    TimetableSurfaces.select(this, store, selected, widgetId);
                    runOnUiThread(() -> {
                        if (isDestroyed()) return;
                        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID && selected.optBoolean("notificationCard") && android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 73);
                        else done();
                    });
                } catch (Exception error) { runOnUiThread(() -> { if (!isDestroyed()) { apply.setEnabled(true); message.setText(error.getMessage()); } }); }
            });
        } catch (Exception error) { message.setText("Could not update timetable appearance."); }
    }
    private void done() { setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)); finish(); }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) { super.onRequestPermissionsResult(request, permissions, results); if (request == 73) { io.execute(() -> TimetableUpdates.refresh(this, store)); done(); } }
    @Override protected void onDestroy() { io.shutdown(); super.onDestroy(); }
}
