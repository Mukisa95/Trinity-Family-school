package ug.trinityfamilyschool.photo;

/** Reflow lesson chips to the actual available width while respecting larger system text. */
final class WidgetSizing {
    static int columns(float width, float fontScale) {
        if (!Float.isFinite(width) || width <= 0) width = 250;
        if (!Float.isFinite(fontScale) || fontScale < 1) fontScale = 1;
        return Math.max(1, Math.min(5, (int)((width - 12) / (68 * fontScale))));
    }
}
