package ug.trinityfamilyschool.photo;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Covers only the first document's blank frames, then yields to its painted UI. */
final class StartupSurface {
    static final int BACKGROUND = Color.rgb(17, 24, 39);
    private final Activity activity;
    private final View root;
    private final FrameLayout surface;
    private boolean released;

    StartupSurface(Activity activity, View root, FrameLayout container) {
        this.activity = activity;
        this.root = root;
        surface = new FrameLayout(activity);
        surface.setTag("trinity-native-startup");
        surface.setBackgroundColor(BACKGROUND);
        surface.setClickable(true);
        LinearLayout content = new LinearLayout(activity);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams centered = new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER);
        centered.setMargins(dp(24), 0, dp(24), 0);
        surface.addView(content, centered);
        LinearLayout brand = new LinearLayout(activity);
        brand.setGravity(Gravity.CENTER_VERTICAL);
        ImageView logo = new ImageView(activity);
        logo.setImageResource(R.drawable.school_logo);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        logo.setPadding(dp(8), dp(8), dp(8), dp(8));
        logo.setBackground(round(0x1affffff, 16));
        brand.addView(logo, new LinearLayout.LayoutParams(dp(80), dp(80)));
        FrameLayout blocks = new FrameLayout(activity);
        int[] colors = {0xff7dd3fc, 0xffc4b5fd, 0xff6ee7b7};
        int[][] positions = {{0, 0}, {24, 0}, {12, 24}};
        for (int i = 0; i < colors.length; i++) {
            View block = new View(activity);
            block.setBackground(round(colors[i], 4));
            FrameLayout.LayoutParams placement = new FrameLayout.LayoutParams(dp(16), dp(16));
            placement.leftMargin = dp(positions[i][0]); placement.topMargin = dp(positions[i][1]);
            blocks.addView(block, placement);
        }
        LinearLayout.LayoutParams blockLayout = new LinearLayout.LayoutParams(dp(48), dp(48));
        blockLayout.leftMargin = dp(16);
        brand.addView(blocks, blockLayout);
        content.addView(brand);
        TextView title = text(SchoolApp.NAME, 18, Color.WHITE);
        title.setTypeface(null, Typeface.BOLD);
        LinearLayout.LayoutParams titleLayout = new LinearLayout.LayoutParams(-1, -2);
        titleLayout.setMargins(0, dp(20), 0, dp(8));
        content.addView(title, titleLayout);
        content.addView(text("Opening your school workspace…", 14, 0xffcbd5e1));
        TextView motto = text("Strive to Excel", 12, 0xff94a3b8);
        LinearLayout.LayoutParams mottoLayout = new LinearLayout.LayoutParams(-1, -2);
        mottoLayout.topMargin = dp(12);
        content.addView(motto, mottoLayout);
        container.addView(surface, new FrameLayout.LayoutParams(-1, -1));
        root.setBackgroundColor(BACKGROUND);
        androidx.core.view.WindowCompat.getInsetsController(activity.getWindow(), root).setAppearanceLightStatusBars(false);
        androidx.core.view.WindowCompat.getInsetsController(activity.getWindow(), root).setAppearanceLightNavigationBars(false);
    }

    boolean pending() { return !released; }

    void release() {
        if (released) return;
        released = true;
        SystemBars.apply(activity, root, AppAppearance.palette(activity).dark);
        Runnable remove = () -> {
            if (surface.getParent() instanceof ViewGroup) ((ViewGroup) surface.getParent()).removeView(surface);
        };
        if (!android.animation.ValueAnimator.areAnimatorsEnabled()) remove.run();
        else surface.animate().alpha(0f).setDuration(180).withEndAction(remove).start();
    }

    void destroy() { released = true; surface.animate().cancel(); }

    private int dp(int value) { return Math.round(value * activity.getResources().getDisplayMetrics().density); }
    private GradientDrawable round(int color, int radius) {
        GradientDrawable shape = new GradientDrawable(); shape.setColor(color); shape.setCornerRadius(dp(radius)); return shape;
    }
    private TextView text(String value, int size, int color) {
        TextView label = new TextView(activity); label.setText(value); label.setTextSize(size);
        label.setTextColor(color); label.setGravity(Gravity.CENTER); label.setIncludeFontPadding(false); return label;
    }
}
