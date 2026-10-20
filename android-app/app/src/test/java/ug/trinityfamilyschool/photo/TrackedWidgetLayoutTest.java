package ug.trinityfamilyschool.photo;

import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class TrackedWidgetLayoutTest {
    private TimetableSchedule.Frame subject(String key) {
        TimetableSchedule.Frame row = new TimetableSchedule.Frame(); row.trackedSubject = key; return row;
    }
    private TimetableSchedule.Frame live(TimetableSchedule.Frame row) {
        row.profileId = "upper"; row.hasPeriod = row.active = true; row.start = 1000; row.end = 2000; return row;
    }
    @Test public void pairsOnlyWhenBothCardsFitAndReflowsBackAtNarrowWidths() {
        List<TimetableSchedule.Frame> feed = Arrays.asList(subject("a"), subject("b"), subject("c"));
        List<TrackedWidgetLayout.Row> wide = TrackedWidgetLayout.rows(feed, 328, row -> 160);
        assertEquals(2, wide.size()); assertSame(feed.get(1), wide.get(0).second);
        assertEquals(160, wide.get(0).cardWidth, 0); assertNull(wide.get(1).second);
        assertEquals(328, wide.get(1).cardWidth, 0);
        List<TrackedWidgetLayout.Row> narrow = TrackedWidgetLayout.rows(feed, 327, row -> 160);
        assertEquals(3, narrow.size()); assertNull(narrow.get(0).second);
        // Enlarged text or a long class/subject code must not be squeezed into a column.
        assertEquals(3, TrackedWidgetLayout.rows(feed, 328, row -> row == feed.get(1) ? 161 : 160).size());
    }
    @Test public void pairingPreservesEveryCardAndNeverCrossesAnEventOrTimetable() {
        TimetableSchedule.Frame table = new TimetableSchedule.Frame(), event = new TimetableSchedule.Frame(); event.eventId = "sports";
        List<TimetableSchedule.Frame> feed = Arrays.asList(subject("a"), table, subject("b"), subject("c"), event, subject("d"));
        List<TrackedWidgetLayout.Row> rows = TrackedWidgetLayout.rows(feed, 500, row -> 150);
        assertEquals(5, rows.size()); assertSame(table, rows.get(1).first); assertNull(rows.get(1).second);
        List<TimetableSchedule.Frame> flattened = new ArrayList<>();
        for (TrackedWidgetLayout.Row row : rows) { flattened.add(row.first); if (row.second != null) flattened.add(row.second); }
        assertEquals(feed, flattened);
        assertTrue(TrackedWidgetLayout.rows(Collections.emptyList(), Float.NaN, row -> 1).isEmpty());
    }
    @Test public void sharesOnlyMatchingVisibleLiveProgressAndRestoresItWhenTableIsRemoved() {
        TimetableSchedule.Frame tracked = live(subject("a")), table = live(new TimetableSchedule.Frame());
        TrackedWidgetLayout.shareProgress(Arrays.asList(tracked, table)); assertTrue(tracked.sharedProgress);
        TrackedWidgetLayout.shareProgress(Collections.singletonList(tracked)); assertFalse(tracked.sharedProgress);
        table.profileId = "lower";
        TrackedWidgetLayout.shareProgress(Arrays.asList(table, tracked)); assertFalse(tracked.sharedProgress);
        table.profileId = "upper"; table.live = false;
        TrackedWidgetLayout.shareProgress(Arrays.asList(table, tracked)); assertFalse(tracked.sharedProgress);
        table.live = true; table.active = false;
        TrackedWidgetLayout.shareProgress(Arrays.asList(table, tracked)); assertFalse(tracked.sharedProgress);
        table.active = true; table.hasPeriod = false;
        TrackedWidgetLayout.shareProgress(Arrays.asList(table, tracked)); assertFalse(tracked.sharedProgress);
    }
    @Test public void doubleLessonsAndUpcomingLessonsRetainTheirIndependentProgress() {
        TimetableSchedule.Frame tracked = live(subject("a")), table = live(new TimetableSchedule.Frame());
        tracked.end = 3000;
        TrackedWidgetLayout.shareProgress(Arrays.asList(table, tracked)); assertFalse(tracked.sharedProgress);
        tracked.end = table.end; tracked.start = 500;
        TrackedWidgetLayout.shareProgress(Arrays.asList(table, tracked)); assertFalse(tracked.sharedProgress);
        tracked.start = table.start; tracked.active = false;
        TrackedWidgetLayout.shareProgress(Arrays.asList(table, tracked)); assertFalse(tracked.sharedProgress);
    }
}
