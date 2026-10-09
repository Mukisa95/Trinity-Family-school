package ug.trinityfamilyschool.photo;
import org.junit.Test;
import static org.junit.Assert.*;

public class TimetableRefreshPlanTest {
    @Test public void minuteTickCannotReplaceALessonBoundary() {
        TimetableRefreshPlan plan = new TimetableRefreshPlan(121_000, 900_000, 1_800_000, true, true, true);
        assertEquals(900_000, plan.boundaryAt); assertEquals(180_000, plan.visualAt);
    }
    @Test public void sleepingPhoneRetainsLessonChangeWithoutMinuteWakeups() {
        TimetableRefreshPlan plan = new TimetableRefreshPlan(121_000, 900_000, 1_800_000, true, true, false);
        assertEquals(900_000, plan.boundaryAt); assertEquals(0, plan.visualAt);
    }
    @Test public void hiddenProgressStillUpdatesLessons() {
        TimetableRefreshPlan plan = new TimetableRefreshPlan(121_000, 900_000, 1_800_000, true, false, true);
        assertEquals(900_000, plan.boundaryAt); assertEquals(0, plan.visualAt);
    }
    @Test public void accessExpiryOverridesBothClocks() {
        TimetableRefreshPlan plan = new TimetableRefreshPlan(121_000, 900_000, 150_000, true, true, true);
        assertEquals(150_000, plan.boundaryAt); assertEquals(150_000, plan.visualAt);
    }
    @Test public void imminentlyExpiringAccessIsNotExtendedByRetryFloor() {
        TimetableRefreshPlan plan = new TimetableRefreshPlan(121_000, 120_000, 121_500, true, true, true);
        assertEquals(121_500, plan.boundaryAt); assertEquals(121_500, plan.visualAt);
    }
    @Test public void noSurfacesOrExpiredAccessStopsAllUpdates() {
        for (TimetableRefreshPlan plan : new TimetableRefreshPlan[]{
            new TimetableRefreshPlan(121_000, 900_000, 1_800_000, false, true, true),
            new TimetableRefreshPlan(121_000, 900_000, 121_000, true, true, true)}) {
            assertEquals(0, plan.boundaryAt); assertEquals(0, plan.visualAt);
        }
    }
    @Test public void delayedDeliveryRearmsInTheFuture() {
        TimetableRefreshPlan plan = new TimetableRefreshPlan(901_000, 900_000, 1_800_000, true, true, true);
        assertEquals(902_000, plan.boundaryAt); assertEquals(902_000, plan.visualAt);
    }
}
