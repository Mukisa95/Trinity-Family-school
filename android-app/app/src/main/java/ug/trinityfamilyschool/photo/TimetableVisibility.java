package ug.trinityfamilyschool.photo;
import java.time.ZonedDateTime;
import java.util.Set;

/** Display visibility is independent of reminder subscriptions and school records. */
final class TimetableVisibility {
    static void apply(TimetableSchedule.Frame feed, Set<String> hidden, ZonedDateTime now) {
        feed.profiles.removeIf(row -> hidden.contains(row.profileId));
        feed.active = false; feed.end = 0; feed.progress = 0; feed.remainingMinutes = 0;
        feed.boundary = now.toLocalDate().plusDays(1).atStartOfDay(now.getZone()).toInstant().toEpochMilli();
        StringBuilder agenda = new StringBuilder();
        for (TimetableSchedule.Frame row : feed.profiles) {
            feed.boundary = Math.min(feed.boundary, row.boundary);
            if (row.active && (!feed.active || row.end < feed.end)) { feed.end = row.end; feed.progress = row.progress; feed.remainingMinutes = row.remainingMinutes; }
            feed.active |= row.active;
            if (agenda.length() > 0) agenda.append("\n\n"); agenda.append(row.tableName).append(" · ").append(row.title).append("\n").append(row.agenda);
        }
        feed.title = feed.profiles.isEmpty() ? "No timetables shown" : feed.profiles.size() + (feed.profiles.size() == 1 ? " timetable" : " timetables");
        feed.time = feed.active ? "Next change in " + feed.remainingMinutes + " min" : "School timetables"; feed.agenda = agenda.toString();
    }
}
