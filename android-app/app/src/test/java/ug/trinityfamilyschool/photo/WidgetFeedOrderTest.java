package ug.trinityfamilyschool.photo;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class WidgetFeedOrderTest {
    @Test public void timetableTrackedAndEventCardsFollowUserOrderWithoutDroppingNewCards() {
        TimetableSchedule.Frame feed = new TimetableSchedule.Frame();
        TimetableSchedule.Frame table = new TimetableSchedule.Frame(); table.profileId = "upper";
        TimetableSchedule.Frame lesson = new TimetableSchedule.Frame(); lesson.trackedSubject = TrackedSubjects.key("p4", "eng");
        TimetableSchedule.Frame event = new TimetableSchedule.Frame(); event.eventId = "sports";
        TimetableSchedule.Frame newLesson = new TimetableSchedule.Frame(); newLesson.trackedSubject = TrackedSubjects.key("p5", "eng");
        feed.profiles.addAll(Arrays.asList(event, table, lesson, newLesson));
        WidgetFeedOrder.apply(feed, Arrays.asList(WidgetFeedOrder.key(lesson), WidgetFeedOrder.key(table), WidgetFeedOrder.key(event)));
        assertEquals(Arrays.asList(lesson, table, event, newLesson), feed.profiles);
    }
    @Test public void movingVisibleCardsKeepsHiddenCardsAndSurvivesSavingAndReopening() {
        List<String> history = Arrays.asList("timetable:a", "event:hidden", "subject:x");
        List<String> visible = WidgetFeedOrder.visible(history, Arrays.asList("subject:new", "subject:x", "timetable:a"));
        assertEquals(Arrays.asList("timetable:a", "subject:x", "subject:new"), visible);
        Collections.swap(visible, 0, 2);
        List<String> changed = WidgetFeedOrder.remember(history, visible);
        List<String> restored = WidgetFeedOrder.read(new org.json.JSONArray(changed).toString());
        assertEquals(visible, WidgetFeedOrder.visible(restored, visible));
        assertTrue(restored.contains("event:hidden"));
        assertEquals(Collections.emptyList(), WidgetFeedOrder.read("broken"));
        assertEquals(Collections.singletonList("a"), WidgetFeedOrder.read("[\"a\",\"a\"]"));
    }
}
