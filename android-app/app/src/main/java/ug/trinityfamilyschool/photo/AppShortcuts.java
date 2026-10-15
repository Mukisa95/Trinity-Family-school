package ug.trinityfamilyschool.photo;

/** Only these app-owned destinations may be opened by a launcher shortcut. */
final class AppShortcuts {
    static final String EXTRA = "trinityShortcut";
    static String route(String id) {
        if (id == null) return null;
        switch (id) {
            case "search": return PhotoPolicy.ORIGIN + "/?openSearch=1";
            case "timetable": return PhotoPolicy.ORIGIN + "/timetable";
            case "events": return PhotoPolicy.ORIGIN + "/events";
            case "pupils": return PhotoPolicy.ORIGIN + "/pupils";
            case "exams": return PhotoPolicy.ORIGIN + "/exams";
            default: return null;
        }
    }
}
