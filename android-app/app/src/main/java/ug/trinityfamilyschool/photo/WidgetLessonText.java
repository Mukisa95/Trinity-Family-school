package ug.trinityfamilyschool.photo;

import java.text.DateFormat;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Uses Android's supplied system time formatter without changing the school's time zone. */
final class WidgetLessonText {
    static String range(long start, long end, String zone, DateFormat system) {
        DateFormat format = (DateFormat)system.clone();
        format.setTimeZone(TimeZone.getTimeZone(zone));
        return format.format(new Date(start)) + " – " + format.format(new Date(end));
    }
    static String periodRange(String text, ZonedDateTime now, DateFormat system) {
        try {
            String[] parts = text.split("\\s*[–−]\\s*");
            if (parts.length != 2) return text;
            long start = now.toLocalDate().atTime(LocalTime.parse(parts[0])).atZone(now.getZone()).toInstant().toEpochMilli();
            long end = now.toLocalDate().atTime(LocalTime.parse(parts[1])).atZone(now.getZone()).toInstant().toEpochMilli();
            return range(start, end, now.getZone().getId(), system);
        } catch (Exception ignored) { return text; }
    }
    static String state(TimetableSchedule.Frame row, ZonedDateTime now) {
        if (!row.hasPeriod) return "";
        if (row.active) return "Now";
        LocalDate date = Instant.ofEpochMilli(row.start).atZone(now.getZone()).toLocalDate();
        if (date.equals(now.toLocalDate())) return "Next";
        if (date.equals(now.toLocalDate().plusDays(1))) return "Tomorrow";
        return date.format(DateTimeFormatter.ofPattern("EEE", Locale.getDefault()));
    }
}
