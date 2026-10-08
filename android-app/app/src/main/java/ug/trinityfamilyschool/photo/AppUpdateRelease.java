package ug.trinityfamilyschool.photo;

import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.net.URI;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;

/** Only the installed school's HTTPS release and current signing key may update it. */
final class AppUpdateRelease {
    final long versionCode, bytes;
    final String versionName, sha256, downloadUrl, notes, json;
    private AppUpdateRelease(JSONObject value) throws Exception {
        versionCode=value.getLong("versionCode"); bytes=value.getLong("bytes"); versionName=value.getString("versionName");
        sha256=value.getString("sha256"); downloadUrl=value.getString("downloadUrl"); notes=value.optString("releaseNotes",""); json=value.toString();
    }
    static AppUpdateRelease parse(String json,String applicationId,String project,String origin,int sdk) throws Exception {
        if(json.length()>16384) throw new IllegalArgumentException("Invalid release.");
        JSONObject value=new JSONObject(json);
        if(value.getInt("schema")!=1 || !applicationId.equals(value.getString("applicationId")) || !project.equals(value.getString("firebaseProjectId"))
            || !origin.equals(value.getString("websiteOrigin"))) throw new IllegalArgumentException("This update belongs to another school.");
        URI url=new URI(value.getString("downloadUrl")), site=new URI(origin);
        if(!"https".equals(url.getScheme()) || !site.getRawAuthority().equals(url.getRawAuthority()) || url.getUserInfo()!=null
            || !"/api/android/download".equals(url.getRawPath()) || url.getRawQuery()!=null || url.getRawFragment()!=null) throw new IllegalArgumentException("Invalid update address.");
        if(value.getLong("versionCode")<1 || value.getLong("bytes")<1000 || value.getLong("bytes")>100*1024*1024
            || !value.getString("sha256").matches("[a-f0-9]{64}") || !value.getString("versionName").matches("[A-Za-z0-9][A-Za-z0-9 ._-]{0,31}")
            || value.getInt("minSdk")<26 || value.getInt("minSdk")>sdk || value.optString("releaseNotes","").length()>1000) throw new IllegalArgumentException("This update is not compatible with your phone.");
        return new AppUpdateRelease(value);
    }
    boolean newerThan(long installed){return versionCode>installed;}
    static String hash(File file) throws Exception {
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        try(FileInputStream stream=new FileInputStream(file)){byte[] buffer=new byte[32768];int count;while((count=stream.read(buffer))!=-1)digest.update(buffer,0,count);}
        return hex(digest.digest());
    }
    boolean matches(File file) throws Exception {return file.isFile() && file.length()==bytes && sha256.equals(hash(file));}
    static boolean sameSigners(byte[][] installed,byte[][] candidate) throws Exception {
        if(installed==null || candidate==null || installed.length==0 || installed.length!=candidate.length)return false;
        Set<String> expected=new HashSet<>(),actual=new HashSet<>();
        for(byte[] signer:installed){if(signer==null||signer.length==0)return false;expected.add(hex(MessageDigest.getInstance("SHA-256").digest(signer)));}
        for(byte[] signer:candidate){if(signer==null||signer.length==0)return false;actual.add(hex(MessageDigest.getInstance("SHA-256").digest(signer)));}
        return expected.size()==installed.length && actual.size()==candidate.length && expected.equals(actual);
    }
    private static String hex(byte[] bytes){StringBuilder value=new StringBuilder();for(byte item:bytes)value.append(String.format(java.util.Locale.ROOT,"%02x",item&255));return value.toString();}
}
