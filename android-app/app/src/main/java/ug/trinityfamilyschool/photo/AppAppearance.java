package ug.trinityfamilyschool.photo;

import android.content.Context;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.widget.RemoteViews;

final class AppAppearance {
    static android.content.SharedPreferences prefs(Context context) { return context.getSharedPreferences("app-appearance", Context.MODE_PRIVATE); }
    static String preference(Context context) { return prefs(context).getString("preference", "system"); }
    static AppearancePalette palette(Context context) {
        return new AppearancePalette(preference(context), (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
    }
    static void save(Context context, String preference) {
        if (!AppearancePalette.valid(preference) || preference.equals(preference(context))) return;
        prefs(context).edit().putString("preference", preference).apply();
        TimetableRefresh.request(context);
    }
    static void deviceChanged(Context context) { if ("system".equals(preference(context))) TimetableRefresh.request(context); }
    static void text(RemoteViews view, int id, AppearancePalette palette, String light, String dark) { color(view, id, "setTextColor", palette, light, dark); }
    static void color(RemoteViews view, int id, String method, AppearancePalette palette, String light, String dark) {
        if (Build.VERSION.SDK_INT >= 31 && palette.system) view.setColorInt(id, method, Color.parseColor(light), Color.parseColor(dark));
        else view.setInt(id, method, Color.parseColor(palette.color(light, dark)));
    }
    static void background(RemoteViews view, int id, AppearancePalette palette, int automatic, int light, int dark) {
        view.setInt(id, "setBackgroundResource", palette.system ? automatic : palette.dark ? dark : light);
    }
    static void progress(RemoteViews view, int id, AppearancePalette palette, String light, String dark) {
        if (Build.VERSION.SDK_INT < 31) return;
        ColorStateList day = ColorStateList.valueOf(Color.parseColor(light)), night = ColorStateList.valueOf(Color.parseColor(dark));
        ColorStateList dayTrack = ColorStateList.valueOf(Color.parseColor("#E5E7EB")), nightTrack = ColorStateList.valueOf(Color.parseColor("#334155"));
        if (palette.system) {
            view.setColorStateList(id, "setProgressTintList", day, night);
            view.setColorStateList(id, "setProgressBackgroundTintList", dayTrack, nightTrack);
        } else {
            view.setColorStateList(id, "setProgressTintList", palette.dark ? night : day);
            view.setColorStateList(id, "setProgressBackgroundTintList", palette.dark ? nightTrack : dayTrack);
        }
    }
    static void navigation(RemoteViews view, AppearancePalette palette) {
        for (int id : new int[]{R.id.previous_period, R.id.next_period, R.id.live_reset})
            background(view, id, palette, R.drawable.nav_background, R.drawable.nav_background_light, R.drawable.nav_background_dark);
        color(view, R.id.previous_period, "setColorFilter", palette, "#4F46E5", "#A5B4FC");
        color(view, R.id.next_period, "setColorFilter", palette, "#4F46E5", "#A5B4FC");
        text(view, R.id.live_reset, palette, "#B45309", "#FCD34D");
    }
    static void badge(RemoteViews view, int id, AppearancePalette palette, int state) {
        int[] automatic = {R.drawable.ended_background,R.drawable.upcoming_background,R.drawable.badge_background};
        int[] light = {R.drawable.ended_background_light,R.drawable.upcoming_background_light,R.drawable.badge_background_light};
        int[] dark = {R.drawable.ended_background_dark,R.drawable.upcoming_background_dark,R.drawable.badge_background_dark};
        background(view,id,palette,automatic[state],light[state],dark[state]);
        text(view,id,palette,state==2?"#047857":state==1?"#B45309":"#6B7280",state==2?"#6EE7B7":state==1?"#FCD34D":"#CBD5E1");
    }
}
