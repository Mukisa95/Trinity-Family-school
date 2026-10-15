package ug.trinityfamilyschool.photo;
import org.junit.Test;
import static org.junit.Assert.*;

public class AppShortcutsTest {
    @Test public void destinationsStayWithinThisSchoolsOrigin() {
        assertEquals(PhotoPolicy.ORIGIN + "/?openSearch=1", AppShortcuts.route("search"));
        assertEquals(PhotoPolicy.ORIGIN + "/timetable", AppShortcuts.route("timetable"));
        assertEquals(PhotoPolicy.ORIGIN + "/events", AppShortcuts.route("events"));
        assertEquals(PhotoPolicy.ORIGIN + "/pupils", AppShortcuts.route("pupils"));
        assertEquals(PhotoPolicy.ORIGIN + "/exams", AppShortcuts.route("exams"));
        assertNull(AppShortcuts.route(null));
        assertNull(AppShortcuts.route("https://outside.example/exams"));
        assertNull(AppShortcuts.route("../exams"));
    }
}
