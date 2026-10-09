package ug.trinityfamilyschool.photo;
import org.junit.Test;
import static org.junit.Assert.*;

public class AppearancePaletteTest {
    @Test public void systemTracksBothDeviceModes() {
        assertFalse(new AppearancePalette("system",false).dark);
        assertTrue(new AppearancePalette("system",true).dark);
        assertTrue(new AppearancePalette("system",true).system);
    }
    @Test public void explicitChoicesOverrideTheDevice() {
        assertFalse(new AppearancePalette("light",true).dark);
        assertTrue(new AppearancePalette("dark",false).dark);
        assertFalse(new AppearancePalette("dark",false).system);
    }
    @Test public void unknownLegacyPreferencesFollowTheDevice() {
        assertTrue(new AppearancePalette(null,true).dark);
        assertFalse(AppearancePalette.valid("automatic"));
        for(String preference:new String[]{"light","dark","system"}) assertTrue(AppearancePalette.valid(preference));
    }
    @Test public void darkSubjectLabelsStayReadableAgainstTheDarkSurface() {
        for(String color:AppearancePalette.DARK_PILLS) {
            double foreground=luminance(color),background=luminance("#111C2D");
            assertTrue(color+" needs readable small-text contrast",(foreground+0.05)/(background+0.05)>=4.5);
        }
    }
    private double luminance(String hex) {
        int color=Integer.parseInt(hex.substring(1),16); double[] channels=new double[3];
        for(int i=0;i<3;i++){double value=((color>>(16-i*8))&255)/255.0;channels[i]=value<=0.04045?value/12.92:Math.pow((value+0.055)/1.055,2.4);}
        return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
    }
}
