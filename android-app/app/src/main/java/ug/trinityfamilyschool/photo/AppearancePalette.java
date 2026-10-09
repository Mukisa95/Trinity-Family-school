package ug.trinityfamilyschool.photo;

/** Shared timetable colours, resolved from the saved app preference and device mode. */
final class AppearancePalette {
    final boolean dark;
    final boolean system;
    DeviceColors deviceColors;
    static final String[] LIGHT_PILLS = {"#15803D","#4F46E5","#B45309","#BE185D","#0F766E","#6D28D9","#C2410C","#0E7490"};
    static final String[] DARK_PILLS = {"#86EFAC","#A5B4FC","#FCD34D","#F9A8D4","#5EEAD4","#C4B5FD","#FDBA74","#67E8F9"};
    AppearancePalette(String preference, boolean deviceDark) {
        system = !"light".equals(preference) && !"dark".equals(preference);
        dark = "dark".equals(preference) || (system && deviceDark);
    }
    static boolean valid(String preference) { return "light".equals(preference) || "dark".equals(preference) || "system".equals(preference); }
    String color(String light, String night) { return dark ? night : light; }
}
