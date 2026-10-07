package ug.trinityfamilyschool.photo;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** One atomic encrypted envelope; never holds Firebase tokens or passwords. */
final class OfflineStore {
    static final int MAX_BYTES = 12 * 1024 * 1024;
    private static final String KEY_ALIAS = "trinity-offline-v1";
    private final AtomicFile file;
    OfflineStore(Context context) { this(context, "offline-v1.enc"); }
    OfflineStore(Context context, String filename) {
        if (!filename.matches("[a-z0-9-]+\\.enc")) throw new IllegalArgumentException("Invalid store name.");
        file = new AtomicFile(new File(context.getNoBackupFilesDir(), filename));
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(KEY_ALIAS)) return (SecretKey) store.getKey(KEY_ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    synchronized JSONObject read() throws Exception {
        if (!file.getBaseFile().exists()) return null;
        byte[] bytes = file.readFully();
        if (bytes.length < 29 || bytes.length > MAX_BYTES + 64) throw new IllegalStateException("School information could not be opened. Reconnect to refresh.");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Arrays.copyOfRange(bytes, 0, 12)));
        return new JSONObject(new String(cipher.doFinal(Arrays.copyOfRange(bytes, 12, bytes.length)), StandardCharsets.UTF_8));
    }
    private synchronized void write(JSONObject value) throws Exception {
        byte[] plain = value.toString().getBytes(StandardCharsets.UTF_8);
        if (plain.length > MAX_BYTES) throw new IllegalArgumentException("This dataset exceeds the device storage limit.");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] encrypted = cipher.doFinal(plain);
        FileOutputStream stream = null;
        try { stream = file.startWrite(); stream.write(cipher.getIV()); stream.write(encrypted); file.finishWrite(stream); }
        catch (Exception error) { if (stream != null) file.failWrite(stream); throw error; }
    }
    synchronized void clear() { file.delete(); }
    static long timestamp(String value) {
        try {
            if (value == null || !value.matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z")) return 0;
            SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            format.setLenient(false); format.setTimeZone(TimeZone.getTimeZone("UTC"));
            return format.parse(value).getTime();
        } catch (Exception ignored) { return 0; }
    }
    static boolean active(JSONObject session) {
        long now = System.currentTimeMillis();
        return session != null && session.optInt("schema") == 1 && !session.optString("accountId").isEmpty()
            && timestamp(session.optString("issuedAt")) > 0
            && timestamp(session.optString("issuedAt")) <= now + 300_000L && timestamp(session.optString("expiresAt")) > now;
    }
    synchronized void connect(JSONObject session) throws Exception {
        if (!active(session) || session.optJSONObject("grants") == null || session.optJSONArray("pupilIds") == null) throw new IllegalArgumentException("Offline access could not be verified.");
        JSONObject previous;
        try { previous = read(); } catch (Exception ignored) { previous = null; }
        JSONObject value = new JSONObject().put("session", session);
        if (previous != null) {
            JSONObject previousSession = previous.optJSONObject("session");
            if (previousSession != null && previousSession.optJSONObject("grants") != null && previousSession.optJSONArray("pupilIds") != null
                && session.optString("accountId").equals(previousSession.optString("accountId"))
                && session.optString("role").equals(previousSession.optString("role"))
                && session.getJSONObject("grants").toString().equals(previousSession.optJSONObject("grants").toString())
                && session.getJSONArray("pupilIds").toString().equals(previousSession.optJSONArray("pupilIds").toString())
                && previous.optJSONObject("snapshot") != null) value.put("snapshot", previous.getJSONObject("snapshot"));
        }
        write(value);
    }
    private static Set<String> strings(JSONArray array) {
        Set<String> result = new HashSet<>();
        if (array != null) for (int index = 0; index < array.length(); index++) result.add(array.optString(index));
        return result;
    }
    static void validate(JSONObject snapshot, JSONObject session) throws Exception {
        if (!active(session) || snapshot.optInt("schema") != 1 || !session.optString("accountId").equals(snapshot.optString("accountId"))
            || !session.optString("role").equals(snapshot.optString("role")) || timestamp(snapshot.optString("capturedAt")) == 0) throw new IllegalArgumentException("Connect and verify your account to continue.");
        JSONObject data = snapshot.getJSONObject("datasets");
        Set<String> allowed = new HashSet<>(Arrays.asList("pupils", "classes", "academicYears", "dashboard", "timetables", "subjects", "teachers", "parent"));
        Iterator<String> names = data.keys();
        while (names.hasNext()) {
            String name = names.next();
            if (!allowed.contains(name) || data.optJSONObject(name) == null || timestamp(data.getJSONObject(name).optString("preparedAt")) == 0) throw new IllegalArgumentException("Invalid saved dataset.");
        }
        JSONObject grants = session.getJSONObject("grants");
        if ("Parent".equals(session.optString("role"))) {
            if (data.length() != 1 || !data.has("parent")) throw new IllegalArgumentException("Parents cannot save school-wide records.");
            JSONObject parent = data.getJSONObject("parent").getJSONObject("data");
            JSONObject family = parent.getJSONObject("family");
            if (!session.optString("accountId").equals(family.optString("accountId"))) throw new IllegalArgumentException("Invalid parent account.");
            Set<String> allowedIds = strings(session.getJSONArray("pupilIds"));
            Set<String> familyIds = new HashSet<>();
            JSONArray pupils = family.getJSONArray("pupils");
            for (int index = 0; index < pupils.length(); index++) {
                String id = pupils.getJSONObject(index).getString("id");
                if (!allowedIds.contains(id)) throw new IllegalArgumentException("This child is outside your account.");
                familyIds.add(id);
            }
            for (String name : new String[]{"fees", "banking", "attendance", "results"}) {
                JSONArray records = parent.getJSONArray(name);
                for (int index = 0; index < records.length(); index++) {
                    JSONObject record = records.getJSONObject(index);
                    if (!session.optString("accountId").equals(record.optString("accountId")) || !familyIds.contains(record.optString("pupilId"))) throw new IllegalArgumentException("Invalid child dataset.");
                }
            }
        } else {
            if (data.has("parent")) throw new IllegalArgumentException("Invalid parent data.");
            if ((data.has("subjects") || data.has("teachers")) && !grants.optBoolean("timetable")) throw new IllegalArgumentException("Timetable references are not authorized.");
            if ((data.has("classes") || data.has("academicYears")) && !grants.optBoolean("dashboard") && !grants.optBoolean("pupils") && !grants.optBoolean("timetable")) throw new IllegalArgumentException("Reference data is not authorized.");
            for (String name : new String[]{"dashboard", "pupils", "timetables"}) if (data.has(name) && !grants.optBoolean("timetables".equals(name) ? "timetable" : name)) throw new IllegalArgumentException("This section is not authorized.");
            if (data.has("pupils")) {
                Set<String> allowedFields = strings(grants.getJSONArray("pupilFields"));
                JSONArray pupils = data.getJSONObject("pupils").getJSONArray("data");
                for (int index = 0; index < pupils.length(); index++) {
                    JSONObject pupil = pupils.getJSONObject(index); pupil.getString("id");
                    Iterator<String> fields = pupil.keys();
                    while (fields.hasNext()) if (!allowedFields.contains(fields.next())) throw new IllegalArgumentException("A pupil field is not authorized.");
                }
            }
            if (data.has("dashboard")) {
                Set<String> allowedCounts = strings(grants.getJSONArray("dashboardCounts"));
                Iterator<String> counts = data.getJSONObject("dashboard").getJSONObject("data").keys();
                while (counts.hasNext()) if (!allowedCounts.contains(counts.next())) throw new IllegalArgumentException("A dashboard statistic is not authorized.");
            }
        }
    }
    synchronized void save(JSONObject snapshot) throws Exception {
        JSONObject value = read();
        if (value == null) throw new IllegalStateException("Sign in online before saving information.");
        validate(snapshot, value.getJSONObject("session"));
        snapshot = new JSONObject(snapshot.toString());
        retainCompleteTimetables(snapshot, value.optJSONObject("snapshot"));
        validate(snapshot, value.getJSONObject("session"));
        value.put("snapshot", snapshot); write(value);
    }
    static void retainCompleteTimetables(JSONObject next, JSONObject previous) throws Exception {
        if (previous == null || !next.optString("accountId").equals(previous.optString("accountId")) || !next.optString("role").equals(previous.optString("role"))) return;
        JSONObject nextData = next.optJSONObject("datasets"), oldData = previous.optJSONObject("datasets");
        if (nextData == null || oldData == null) return;
        JSONObject incoming = nextData.optJSONObject("timetables"), old = oldData.optJSONObject("timetables");
        if (incoming == null || old == null) return;
        JSONArray tables = incoming.getJSONArray("data"), oldTables = old.getJSONArray("data"); boolean retained = false;
        for (int i = 0; i < tables.length(); i++) {
            JSONObject table = tables.getJSONObject(i); if (table.optBoolean("complete")) continue;
            String id = table.getJSONObject("profile").getString("id");
            for (int j = 0; j < oldTables.length(); j++) {
                JSONObject candidate = oldTables.getJSONObject(j);
                if (candidate.optBoolean("complete") && id.equals(candidate.getJSONObject("profile").getString("id"))) { tables.put(i, new JSONObject(candidate.toString())); retained = true; break; }
            }
        }
        if (retained) incoming.put("preparedAt", old.getString("preparedAt"));
    }
    synchronized JSONObject available() throws Exception {
        JSONObject value = read();
        if (value == null || !active(value.optJSONObject("session")) || value.optJSONObject("snapshot") == null) return null;
        validate(value.getJSONObject("snapshot"), value.getJSONObject("session"));
        return value;
    }
}
