package ug.trinityfamilyschool.photo;

import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import java.util.ArrayList;
import java.util.List;

/** Open the configuration belonging to a specific installed home-screen widget. */
final class WidgetSettings {
    static void open(Activity activity) {
        AppWidgetManager manager = AppWidgetManager.getInstance(activity);
        List<Integer> ids = new ArrayList<>(); List<String> labels = new ArrayList<>();
        for (Class<?> provider : new Class<?>[]{TimetableWidget.class, TimetableProgressWidget.class}) {
            int number = 0;
            for (int id : manager.getAppWidgetIds(new ComponentName(activity, provider))) {
                ids.add(id); labels.add((provider == TimetableWidget.class ? "Timetables" : "Timetables with progress") + " · " + (++number));
            }
        }
        AlertDialog.Builder dialog = new AlertDialog.Builder(activity).setTitle("Widget settings").setNegativeButton("Close", null);
        if (ids.isEmpty()) dialog.setMessage("To add a widget, touch and hold an empty space on your home screen, choose Widgets, then " + SchoolApp.NAME + ". After adding it, return here to choose its timetables and lesson progress.");
        else dialog.setItems(labels.toArray(new String[0]), (view, index) -> activity.startActivity(new Intent(activity, TimetableSettingsActivity.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, ids.get(index).intValue())));
        dialog.show();
    }
}
