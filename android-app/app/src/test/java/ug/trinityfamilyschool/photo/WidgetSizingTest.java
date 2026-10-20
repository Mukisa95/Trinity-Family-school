package ug.trinityfamilyschool.photo;

import org.junit.Test;
import static org.junit.Assert.*;

public class WidgetSizingTest {
    @Test public void columnsFollowActualWidthsBetweenTheOldPresetSizes() {
        assertEquals(1, WidgetSizing.columns(120, 1));
        assertEquals(2, WidgetSizing.columns(177, 1));
        assertEquals(3, WidgetSizing.columns(219, 1));
        assertEquals(4, WidgetSizing.columns(287, 1));
        assertEquals(5, WidgetSizing.columns(413, 1));
    }
    @Test public void largerSystemTextGetsMoreSpaceRatherThanSmallerFonts() {
        assertEquals(1, WidgetSizing.columns(177, 2));
        assertEquals(2, WidgetSizing.columns(320, 2));
        assertTrue(WidgetSizing.columns(413, 1.5f) < WidgetSizing.columns(413, 1));
    }
    @Test public void missingOrInvalidLauncherDimensionsStillProduceAUsableLayout() {
        assertEquals(1, WidgetSizing.columns(1, 1));
        assertEquals(5, WidgetSizing.columns(4000, 1));
        assertEquals(3, WidgetSizing.columns(Float.NaN, Float.NaN));
        assertEquals(3, WidgetSizing.columns(0, -1));
        assertEquals(3, WidgetSizing.columns(Float.POSITIVE_INFINITY, 1));
    }
}
