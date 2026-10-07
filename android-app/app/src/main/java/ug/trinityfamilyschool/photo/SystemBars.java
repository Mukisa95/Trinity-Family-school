package ug.trinityfamilyschool.photo;

import android.app.Activity;
import android.graphics.Color;
import android.view.View;
import androidx.core.view.WindowCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/** One owner for safe-area padding; WebView must not apply the same insets twice. */
final class SystemBars {
    static void install(Activity activity, View root) {
        WindowCompat.setDecorFitsSystemWindows(activity.getWindow(), false);
        apply(activity, root, false);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            androidx.core.graphics.Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            int bottom = Math.max(bars.bottom, insets.getInsets(WindowInsetsCompat.Type.ime()).bottom);
            view.setPadding(bars.left, bars.top, bars.right, bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(root);
    }
    static void apply(Activity activity, View root, boolean dark) {
        root.setBackgroundColor(Color.parseColor(dark ? "#020617" : "#F1F7FF"));
        androidx.core.view.WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(activity.getWindow(), root);
        controller.setAppearanceLightStatusBars(!dark);
        controller.setAppearanceLightNavigationBars(!dark);
        if (android.os.Build.VERSION.SDK_INT >= 29) activity.getWindow().setNavigationBarContrastEnforced(false);
    }
}
