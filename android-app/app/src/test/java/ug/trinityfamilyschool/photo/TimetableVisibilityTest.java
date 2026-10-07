package ug.trinityfamilyschool.photo;
import org.junit.Test;
import java.time.*;
import java.util.*;
import static org.junit.Assert.*;
public class TimetableVisibilityTest {
    private TimetableSchedule.Frame feed() {
        TimetableSchedule.Frame feed=new TimetableSchedule.Frame();for(int i=0;i<3;i++){TimetableSchedule.Frame row=new TimetableSchedule.Frame();row.profileId="p"+i;row.tableName="Profile "+i;row.active=i<2;row.end=100+i*100;row.boundary=100+i*100;row.progress=i*25;row.remainingMinutes=i+1;feed.profiles.add(row);}return feed;
    }
    @Test public void hidingProfilesRecomputesProgressAndKeepsCanonicalOrder(){TimetableSchedule.Frame feed=feed();TimetableVisibility.apply(feed,Set.of("p0"),ZonedDateTime.now());assertEquals(2,feed.profiles.size());assertEquals("p1",feed.profiles.get(0).profileId);assertTrue(feed.active);assertEquals(200,feed.boundary);assertEquals(25,feed.progress);assertEquals(200,feed.end);assertFalse(feed.agenda.contains("Profile 0"));}
    @Test public void hidingEverythingProducesAnEmptyNonActiveFeed(){TimetableSchedule.Frame feed=feed();TimetableVisibility.apply(feed,Set.of("p0","p1","p2"),ZonedDateTime.now());assertTrue(feed.profiles.isEmpty());assertFalse(feed.active);assertEquals(0,feed.end);assertEquals(0,feed.progress);assertEquals("No timetables shown",feed.title);}
}
