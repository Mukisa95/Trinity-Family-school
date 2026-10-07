package ug.trinityfamilyschool.photo;

import org.json.JSONObject;
import java.io.File;
import java.util.HashMap;
import java.util.Map;

/** Read-only timetable projection shared by receivers, widgets and bridge instances.
 * Disk remains the existing encrypted envelope. Cold loads validate that envelope once;
 * warm navigation never decrypts or walks the unrelated pupil/dashboard datasets.
 */
final class TimetableCache {
    private static final Object LOCK = new Object();
    private static final Map<String, Entry> entries = new HashMap<>();
    private static final class Entry {
        long modified, bytes;
        JSONObject session, envelope;
        boolean matches(File source) { return source.exists() && modified == source.lastModified() && bytes == source.length(); }
    }
    static JSONObject project(JSONObject value) throws Exception {
        if (value == null || value.optJSONObject("snapshot") == null
            || !value.getJSONObject("session").getJSONObject("grants").optBoolean("timetable")) return null;
        JSONObject original = value.getJSONObject("snapshot"), data = original.getJSONObject("datasets"), slim = new JSONObject();
        for (String name : new String[]{"timetables", "classes", "academicYears", "subjects", "teachers"})
            if (data.has(name)) slim.put(name, data.getJSONObject(name));
        JSONObject snapshot = new JSONObject().put("schema", original.getInt("schema"))
            .put("accountId", original.getString("accountId")).put("role", original.getString("role"))
            .put("capturedAt", original.getString("capturedAt")).put("datasets", slim);
        // Detach the small projection so later bridge writes cannot mutate cached objects.
        return new JSONObject(new JSONObject().put("session", value.getJSONObject("session")).put("snapshot", snapshot).toString());
    }
    static void invalidate(OfflineStore store) {
        synchronized (LOCK) { entries.remove(store.sourceFile().getAbsolutePath()); }
    }
    static void forgetMemory() { synchronized (LOCK) { entries.clear(); } }
    static void publish(OfflineStore store, JSONObject value) throws Exception {
        File source = store.sourceFile();
        publish(store, value, source.lastModified(), source.length());
    }
    private static boolean publish(OfflineStore store, JSONObject value, long modified, long bytes) throws Exception {
        Entry entry = new Entry(); entry.modified = modified; entry.bytes = bytes;
        entry.session = value == null ? null : new JSONObject(value.getJSONObject("session").toString());
        entry.envelope = project(value);
        synchronized (LOCK) {
            File source = store.sourceFile();
            if (!entry.matches(source)) return false; // A save/logout won the race with a cold read.
            entries.put(source.getAbsolutePath(), entry);
            return true;
        }
    }
    static JSONObject available(OfflineStore store) throws Exception {
        File source = store.sourceFile();
        for (int attempt = 0; attempt < 2; attempt++) {
            synchronized (LOCK) {
                Entry entry = entries.get(source.getAbsolutePath());
                if (!source.exists()) { entries.remove(source.getAbsolutePath()); return null; }
                if (entry != null && entry.matches(source)) return OfflineStore.active(entry.session) ? entry.envelope : null;
            }
            long modified = source.lastModified(), bytes = source.length();
            // Never hold the cache lock while acquiring OfflineStore's storage lock.
            JSONObject verified = store.available();
            if (publish(store, verified, modified, bytes)) {
                synchronized (LOCK) {
                    Entry entry = entries.get(source.getAbsolutePath());
                    if (entry != null && entry.matches(source)) return OfflineStore.active(entry.session) ? entry.envelope : null;
                }
            }
        }
        return null;
    }
}
