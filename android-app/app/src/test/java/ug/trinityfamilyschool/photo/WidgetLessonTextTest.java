package ug.trinityfamilyschool.photo;
import org.junit.Test;
import java.text.SimpleDateFormat;
import java.time.*;
import java.util.Locale;
import static org.junit.Assert.*;

public class WidgetLessonTextTest {
    private ZonedDateTime at(String value) { return LocalDateTime.parse(value).atZone(ZoneId.of("Africa/Kampala")); }
    @Test public void userClockPreferenceHandlesNoonMidnightAndSchoolZone() {
        long start = at("2026-10-16T00:00:00").toInstant().toEpochMilli(), end = at("2026-10-16T12:00:00").toInstant().toEpochMilli();
        SimpleDateFormat twelve = new SimpleDateFormat("h:mm a", Locale.US), twentyFour = new SimpleDateFormat("HH:mm", Locale.US);
        twelve.setTimeZone(java.util.TimeZone.getTimeZone("America/New_York"));
        assertEquals("12:00 AM – 12:00 PM", WidgetLessonText.range(start, end, "Africa/Kampala", twelve));
        assertEquals("00:00 – 12:00", WidgetLessonText.range(start, end, "Africa/Kampala", twentyFour));
        assertEquals("America/New_York", twelve.getTimeZone().getID());
        assertEquals("1:00 PM – 2:00 PM", WidgetLessonText.periodRange("13:00 – 14:00", at("2026-10-16T09:00:00"), twelve));
        assertEquals("No lesson today", WidgetLessonText.periodRange("No lesson today", at("2026-10-16T09:00:00"), twelve));
    }
    @Test public void futureModeUsesRelativeDayLabelsWithoutNumericDates() {
        TimetableSchedule.Frame row = new TimetableSchedule.Frame(); row.hasPeriod = true;
        ZonedDateTime now = at("2026-10-16T09:00:00");
        row.start = now.plusHours(1).toInstant().toEpochMilli(); assertEquals("Next", WidgetLessonText.state(row, now));
        row.active = true; assertEquals("Now", WidgetLessonText.state(row, now));
        row.active = false; row.start = now.plusDays(1).toInstant().toEpochMilli(); assertEquals("Tomorrow", WidgetLessonText.state(row, now));
        row.start = now.plusDays(3).toInstant().toEpochMilli(); assertFalse(WidgetLessonText.state(row, now).matches(".*\\d.*"));
    }
}
