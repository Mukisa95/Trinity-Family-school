package ug.trinityfamilyschool.photo;
import org.junit.Test;
import static org.junit.Assert.*;
public class NativePushPolicyTest {
    @Test public void incomingMessagesRequireCurrentAccountAndSchool(){
        assertTrue(NativePushPolicy.accountMatches("parent-a","school-one","parent-a","school-one"));
        assertFalse(NativePushPolicy.accountMatches("parent-a","school-one","parent-b","school-one"));
        assertFalse(NativePushPolicy.accountMatches("parent-a","school-one","parent-a","school-two"));
        assertFalse(NativePushPolicy.accountMatches("","school-one","","school-one"));
    }
    @Test public void tapsOnlyReachTheSchoolWebsite(){
        assertEquals(PhotoPolicy.ORIGIN+"/pupils?classId=example",NativePushPolicy.route("/pupils?classId=example"));
        for(String unsafe:new String[]{"//evil.test/","/\\evil.test/","https://evil.test","javascript:alert(1)","/path\nheader"})assertEquals(PhotoPolicy.ORIGIN+"/push-notifications",NativePushPolicy.route(unsafe));
    }
}
