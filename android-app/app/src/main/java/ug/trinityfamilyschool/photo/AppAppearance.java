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
    static boolean deviceColorsEnabled(Context context) { return prefs(context).getBoolean("deviceColors",false); }
    static void saveDeviceColors(Context context,boolean enabled) {
        if(enabled==deviceColorsEnabled(context))return;
        prefs(context).edit().putBoolean("deviceColors",enabled).apply();
        TimetableRefresh.request(context);
    }
    static AppearancePalette palette(Context context) {
        AppearancePalette palette=new AppearancePalette(preference(context), (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
        if(deviceColorsEnabled(context))palette.deviceColors=DeviceColors.read(context);
        return palette;
    }
    static void save(Context context, String preference) {
        if (!AppearancePalette.valid(preference) || preference.equals(preference(context))) return;
        prefs(context).edit().putString("preference", preference).apply();
        TimetableRefresh.request(context);
    }
    static void deviceChanged(Context context) { if ("system".equals(preference(context))) TimetableRefresh.request(context); }
    static void text(RemoteViews view, int id, AppearancePalette palette, String light, String dark) { color(view, id, "setTextColor", palette, light, dark); }
    static void color(RemoteViews view, int id, String method, AppearancePalette palette, String light, String dark) {
        if(palette.deviceColors!=null&&Build.VERSION.SDK_INT>=31) {
            int resource=palette.system?DeviceColors.hostResource(light):palette.deviceColors.reference(palette.dark?dark:light,palette.dark);
            if(resource!=0){view.setColor(id,method,resource);return;}
        }
        int day=palette.deviceColors==null?Color.parseColor(light):palette.deviceColors.replace(light,false);
        int night=palette.deviceColors==null?Color.parseColor(dark):palette.deviceColors.replace(dark,true);
        if (Build.VERSION.SDK_INT >= 31 && palette.system) view.setColorInt(id, method, day, night);
        else view.setInt(id, method, palette.dark?night:day);
    }
    static void background(RemoteViews view, int id, AppearancePalette palette, int automatic, int light, int dark) {
        if(palette.deviceColors!=null) {
            if(automatic==R.drawable.widget_background){automatic=R.drawable.widget_background_device;light=R.drawable.widget_background_device_light;dark=R.drawable.widget_background_device_dark;}
            else if(automatic==R.drawable.nav_background){automatic=R.drawable.nav_background_device;light=R.drawable.nav_background_device_light;dark=R.drawable.nav_background_device_dark;}
        }
        view.setInt(id, "setBackgroundResource", palette.system ? automatic : palette.dark ? dark : light);
    }
    static void progress(RemoteViews view, int id, AppearancePalette palette, String light, String dark) {
        if (Build.VERSION.SDK_INT < 31) return;
        if(palette.deviceColors!=null) {
            view.setColorStateList(id,"setProgressTintList",palette.system?R.color.device_timetable_accent:palette.deviceColors.resource(0,palette.dark?200:600));
            view.setColorStateList(id,"setProgressBackgroundTintList",palette.system?R.color.device_timetable_nav:palette.deviceColors.resource(4,palette.dark?800:100));
            return;
        }
        ColorStateList day = ColorStateList.valueOf(palette.deviceColors==null?Color.parseColor(light):palette.deviceColors.role("primary",false)), night = ColorStateList.valueOf(palette.deviceColors==null?Color.parseColor(dark):palette.deviceColors.role("primary",true));
        ColorStateList dayTrack = ColorStateList.valueOf(palette.deviceColors==null?Color.parseColor("#E5E7EB"):palette.deviceColors.role("muted",false)), nightTrack = ColorStateList.valueOf(palette.deviceColors==null?Color.parseColor("#334155"):palette.deviceColors.role("muted",true));
        if (palette.system) {
            view.setColorStateList(id, "setProgressTintList", day, night);
            view.setColorStateList(id, "setProgressBackgroundTintList", dayTrack, nightTrack);
        } else {
            view.setColorStateList(id, "setProgressTintList", palette.dark ? night : day);
            view.setColorStateList(id, "setProgressBackgroundTintList", palette.dark ? nightTrack : dayTrack);
        }
    }
    static void lessonText(RemoteViews view,int id,AppearancePalette palette,String light,String dark) {
        if(Build.VERSION.SDK_INT>=31&&palette.system)view.setColorInt(id,"setTextColor",Color.parseColor(light),Color.parseColor(dark));
        else view.setTextColor(id,Color.parseColor(palette.color(light,dark)));
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
