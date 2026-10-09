package ug.trinityfamilyschool.photo;
import org.junit.Test;
import static org.junit.Assert.*;

public class TimetableCountdownTest {
    @Test public void lessThanAMinuteDoesNotShowZeroEarly() {
        assertEquals("1m left", TimetableCountdown.label(120_000, 119_999, true));
        assertEquals("0m left", TimetableCountdown.label(120_000, 120_000, true));
        assertEquals("0m left", TimetableCountdown.label(120_000, 121_000, true));
    }
    @Test public void hourlyCountdownRecomputesAfterADelayedRefresh() {
        assertEquals("2h 1m to start", TimetableCountdown.label(7_201_000, 0, false));
        assertEquals("1h 57m to start", TimetableCountdown.label(7_201_000, 181_000, false));
    }
    @Test public void exactMinuteUsesRemainingTimeWithoutExtraMinute() {
        assertEquals("59m left", TimetableCountdown.label(3_540_000, 0, true));
        assertEquals("1h 0m to start", TimetableCountdown.label(3_600_000, 0, false));
    }
}
