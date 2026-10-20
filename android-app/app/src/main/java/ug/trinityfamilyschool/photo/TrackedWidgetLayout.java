package ug.trinityfamilyschool.photo;

import java.util.*;
import java.util.function.ToDoubleFunction;

/** Presentation only: keep saved feed order and pair only adjacent cards that fit. */
final class TrackedWidgetLayout {
    static final float GAP = 8;
    static final class Row {
        final TimetableSchedule.Frame first, second;
        final float cardWidth;
        Row(TimetableSchedule.Frame first, TimetableSchedule.Frame second, float cardWidth) {
            this.first = first; this.second = second; this.cardWidth = cardWidth;
        }
    }
    static List<Row> rows(List<TimetableSchedule.Frame> feed, float width, ToDoubleFunction<TimetableSchedule.Frame> minimumWidth) {
        if (!Float.isFinite(width) || width <= 0) width = 238;
        List<Row> result = new ArrayList<>();
        float half = (width - GAP) / 2;
        for (int i = 0; i < feed.size(); i++) {
            TimetableSchedule.Frame first = feed.get(i), second = null;
            if (!first.trackedSubject.isEmpty() && i + 1 < feed.size()) {
                TimetableSchedule.Frame next = feed.get(i + 1);
                if (!next.trackedSubject.isEmpty() && minimumWidth.applyAsDouble(first) <= half && minimumWidth.applyAsDouble(next) <= half) {
                    second = next; i++;
                }
            }
            result.add(new Row(first, second, second == null ? width : half));
        }
        return result;
    }
    static void shareProgress(List<TimetableSchedule.Frame> feed) {
        List<TimetableSchedule.Frame> liveTables = new ArrayList<>();
        for (TimetableSchedule.Frame row : feed) if (row.trackedSubject.isEmpty() && row.eventId.isEmpty() && row.active && row.live && row.hasPeriod) liveTables.add(row);
        for (TimetableSchedule.Frame tracked : feed) {
            tracked.sharedProgress = false;
            if (tracked.trackedSubject.isEmpty() || !tracked.active || !tracked.hasPeriod || tracked.profileId.isEmpty()) continue;
            for (TimetableSchedule.Frame table : liveTables) {
                // A different timetable, browsed period, or double-lesson span has its own progress.
                if (tracked.profileId.equals(table.profileId) && tracked.start == table.start && tracked.end == table.end) {
                    tracked.sharedProgress = true; break;
                }
            }
        }
    }
}
