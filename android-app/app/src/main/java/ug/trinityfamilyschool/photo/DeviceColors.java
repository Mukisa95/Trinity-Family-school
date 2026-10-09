package ug.trinityfamilyschool.photo;

import android.content.Context;
import android.os.Build;
import org.json.JSONObject;
import java.util.Locale;

/** Android's public wallpaper palette. No wallpaper files, network access or permissions. */
final class DeviceColors {
    static final String EVENT = "ug.trinity.appearance.CHANGED";
    static final String[] FAMILIES = {"primary","secondary","tertiary","neutral","neutralVariant"};
    private static final String[] SYSTEM = {"accent1","accent2","accent3","neutral1","neutral2"};
    static final int[] TONES = {0,10,50,100,200,300,400,500,600,700,800,900,1000};
    final int[][] colors = new int[5][13];
    final int[][] resources = new int[5][13];

    static DeviceColors read(Context context) {
        if (Build.VERSION.SDK_INT < 31) return null;
        try {
            DeviceColors palette=new DeviceColors();
            for(int family=0;family<SYSTEM.length;family++)for(int tone=0;tone<TONES.length;tone++) {
                int id=context.getResources().getIdentifier("system_"+SYSTEM[family]+"_"+TONES[tone],"color","android");
                if(id==0)return null;
                palette.resources[family][tone]=id;
                palette.colors[family][tone]=context.getResources().getColor(id,context.getTheme());
            }
            return palette;
        } catch(RuntimeException unavailable) { return null; }
    }
    int tone(int family,int shade) { for(int i=0;i<TONES.length;i++)if(TONES[i]==shade)return colors[family][i];throw new IllegalArgumentException("Unknown tone"); }
    int resource(int family,int shade) { for(int i=0;i<TONES.length;i++)if(TONES[i]==shade)return resources[family][i];throw new IllegalArgumentException("Unknown tone"); }
    static int hostResource(String original) {
        switch(original) {
            case "#1F2937": return R.color.device_timetable_foreground;
            case "#6B7280": case "#4B5563": return R.color.device_timetable_muted;
            case "#4F46E5": return R.color.device_timetable_accent;
            case "#EEF2FF": return R.color.device_timetable_edge;
            default: return 0;
        }
    }
    int reference(String original,boolean dark) {
        switch(original) {
            case "#1F2937": case "#E2E8F0": return resource(3,dark?100:900);
            case "#6B7280": case "#94A3B8": case "#4B5563": case "#CBD5E1": return resource(4,dark?200:700);
            case "#4F46E5": case "#A5B4FC": case "#818CF8": return resource(0,dark?200:600);
            case "#EEF2FF": case "#334155": case "#E5E7EB": return resource(4,dark?700:200);
            default: return 0;
        }
    }
    int role(String role,boolean dark) {
        switch(role) {
            case "background": return tone(3,dark?900:10);
            case "surface": return tone(3,dark?900:10);
            case "foreground": return tone(3,dark?100:900);
            case "muted": return tone(4,dark?800:100);
            case "mutedForeground": return tone(4,dark?200:700);
            case "outline": return tone(4,dark?700:200);
            case "primary": return tone(0,dark?200:600);
            case "onPrimary": return tone(0,dark?800:0);
            case "primaryContainer": return tone(0,dark?700:100);
            case "onPrimaryContainer": return tone(0,dark?100:900);
            case "secondary": return tone(1,dark?200:600);
            case "onSecondary": return tone(1,dark?800:0);
            case "secondaryContainer": return tone(1,dark?700:100);
            case "onSecondaryContainer": return tone(1,dark?100:900);
            default: throw new IllegalArgumentException("Unknown role");
        }
    }
    int replace(String original,boolean dark) {
        switch(original) {
            case "#1F2937": case "#E2E8F0": return role("foreground",dark);
            case "#6B7280": case "#94A3B8": case "#4B5563": case "#CBD5E1": return role("mutedForeground",dark);
            case "#4F46E5": case "#A5B4FC": case "#818CF8": return role("primary",dark);
            case "#EEF2FF": case "#334155": case "#E5E7EB": return role("outline",dark);
            default: return android.graphics.Color.parseColor(original); // Semantic lesson/status colours stay meaningful.
        }
    }
    JSONObject json() throws org.json.JSONException {
        JSONObject output=new JSONObject().put("supported",true),palettes=new JSONObject();
        for(int family=0;family<FAMILIES.length;family++) {
            JSONObject tones=new JSONObject();for(int i=0;i<TONES.length;i++)tones.put(String.valueOf(TONES[i]),hex(colors[family][i]));
            palettes.put(FAMILIES[family],tones);
        }
        output.put("palettes",palettes);
        String[] roles={"background","surface","foreground","muted","mutedForeground","outline","primary","onPrimary","primaryContainer","onPrimaryContainer","secondary","onSecondary","secondaryContainer","onSecondaryContainer"};
        for(boolean dark:new boolean[]{false,true}) { JSONObject scheme=new JSONObject();for(String name:roles)scheme.put(name,hex(role(name,dark)));output.put(dark?"dark":"light",scheme); }
        return output;
    }
    static JSONObject status(Context context) throws org.json.JSONException {
        DeviceColors palette=read(context);return palette==null?new JSONObject().put("supported",false):palette.json();
    }
    static String hex(int color) { return String.format(Locale.ROOT,"#%06X",color&0xffffff); }
    static void applyNative(android.app.Activity activity) {
        // Removing the option restores native accents too; keep WebView night detection tied to the device.
        if(activity instanceof MainActivity) {
            android.content.res.Resources.Theme base=activity.getResources().newTheme();
            base.applyStyle(R.style.TrinityTheme,true);activity.getTheme().setTo(base);
        }
        if(AppAppearance.deviceColorsEnabled(activity)&&read(activity)!=null)
            activity.getTheme().applyStyle(AppAppearance.palette(activity).dark?R.style.TrinityDeviceColorsDark:R.style.TrinityDeviceColorsLight,true);
    }
    static void changed(Context context) {
        if(AppAppearance.deviceColorsEnabled(context))TimetableRefresh.request(context);
        context.sendBroadcast(new android.content.Intent(EVENT).setPackage(context.getPackageName()));
    }
}
