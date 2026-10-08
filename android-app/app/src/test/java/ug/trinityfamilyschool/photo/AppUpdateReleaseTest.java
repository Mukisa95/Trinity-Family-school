package ug.trinityfamilyschool.photo;
import org.json.JSONObject;
import org.junit.Test;
import java.io.File;
import java.nio.file.Files;
import static org.junit.Assert.*;

public class AppUpdateReleaseTest {
    private JSONObject release() throws Exception {return new JSONObject().put("schema",1).put("applicationId","ug.trinityfamilyschool.live")
        .put("firebaseProjectId","trinity-family-schools").put("websiteOrigin","https://school.example").put("downloadUrl","https://school.example/api/android/download")
        .put("versionCode",16).put("versionName","1.14").put("bytes",3000).put("sha256","a".repeat(64)).put("minSdk",26);}
    private AppUpdateRelease parse(JSONObject data) throws Exception {return AppUpdateRelease.parse(data.toString(),"ug.trinityfamilyschool.live","trinity-family-schools","https://school.example",35);}
    @Test public void onlyNewerVersionsAreOffered() throws Exception {AppUpdateRelease value=parse(release());assertTrue(value.newerThan(15));assertFalse(value.newerThan(16));assertFalse(value.newerThan(17));}
    @Test public void anotherSchoolCannotOfferAnUpdate() throws Exception {
        for(String key:new String[]{"applicationId","firebaseProjectId","websiteOrigin"}){JSONObject data=release().put(key,"another-school");assertThrows(Exception.class,()->parse(data));}
    }
    @Test public void updateAddressMustBeTheExactSchoolEndpoint() throws Exception {
        for(String url:new String[]{"http://school.example/api/android/download","https://school.example.evil.test/api/android/download","https://school.example@evil.test/api/android/download","https://school.example/api/android/download?file=other","https://school.example/api/android/download#fragment","https://school.example/api/android/other","https://school.example:8443/api/android/download"}){
            JSONObject data=release().put("downloadUrl",url);assertThrows(Exception.class,()->parse(data));}
    }
    @Test public void incompatibleOrUnboundedReleasesAreRejected() throws Exception {
        for(JSONObject data:new JSONObject[]{release().put("minSdk",36),release().put("bytes",999),release().put("bytes",101L*1024*1024),release().put("sha256","bad"),release().put("versionName","../../file"),release().put("releaseNotes","x".repeat(1001)),release().put("schema",2)})assertThrows(Exception.class,()->parse(data));
    }
    @Test public void signedIdentityRequiresTheSameCompleteSignerSet() throws Exception {
        byte[] a={1,2,3},b={4,5,6},c={7,8,9};
        assertTrue(AppUpdateRelease.sameSigners(new byte[][]{a,b},new byte[][]{b,a}));
        assertFalse(AppUpdateRelease.sameSigners(new byte[][]{a},new byte[][]{c}));
        assertFalse(AppUpdateRelease.sameSigners(new byte[][]{a,b},new byte[][]{a}));
        assertFalse(AppUpdateRelease.sameSigners(new byte[][]{a,a},new byte[][]{a,a}));
        assertFalse(AppUpdateRelease.sameSigners(new byte[0][],new byte[0][]));
    }
    @Test public void alteredAndPartialDownloadsFailIntegrityChecks() throws Exception {
        File file=File.createTempFile("school-update-",".apk");
        try {byte[] content=new byte[3000];content[0]=80;Files.write(file.toPath(),content);
            AppUpdateRelease value=parse(release().put("sha256",AppUpdateRelease.hash(file)));assertTrue(value.matches(file));
            content[20]=1;Files.write(file.toPath(),content);assertFalse(value.matches(file));
            Files.write(file.toPath(),new byte[1500]);assertFalse(value.matches(file));
        }finally{file.delete();}
    }
}
