package ug.trinityfamilyschool.photo;

import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.core.content.FileProvider;
import org.json.*;
import java.io.*;
import java.util.*;

/** Private staging first, then a complete file in the user's persisted Trinity Files directory. */
final class DocumentStore {
    final Context context;
    final File directory;
    final android.content.SharedPreferences prefs;
    DocumentStore(Context context) {
        this.context = context.getApplicationContext();
        prefs = this.context.getSharedPreferences("trinity-files", Context.MODE_PRIVATE);
        directory = new File(this.context.getFilesDir(), "trinity-documents"); directory.mkdirs();
    }
    private String name(Uri uri) {
        try (Cursor cursor = context.getContentResolver().query(uri, new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
            return cursor != null && cursor.moveToFirst() ? cursor.getString(0) : "";
        } catch (Exception ignored) { return ""; }
    }
    Uri folder() {
        try {
            Uri tree = Uri.parse(prefs.getString("tree", "")), folder = Uri.parse(prefs.getString("folder", ""));
            boolean granted = false;
            for (UriPermission permission : context.getContentResolver().getPersistedUriPermissions()) if (tree.equals(permission.getUri()) && permission.isWritePermission()) granted = true;
            return granted && !name(folder).isEmpty() ? folder : null;
        } catch (Exception ignored) { return null; }
    }
    void selectFolder(Uri tree, int flags) throws Exception {
        int granted = flags & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        if ((granted & Intent.FLAG_GRANT_WRITE_URI_PERMISSION) == 0) throw new IOException("Allow access to the document folder to save files.");
        context.getContentResolver().takePersistableUriPermission(tree, granted);
        Uri parent = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        Uri folder = "Trinity Files".equalsIgnoreCase(name(parent)) ? parent : null;
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(parent));
        if (folder == null) try (Cursor cursor = context.getContentResolver().query(children, new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE}, null, null, null)) {
            while (cursor != null && cursor.moveToNext()) if ("Trinity Files".equalsIgnoreCase(cursor.getString(1)) && DocumentsContract.Document.MIME_TYPE_DIR.equals(cursor.getString(2))) { folder = DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0)); break; }
        }
        if (folder == null) folder = DocumentsContract.createDocument(context.getContentResolver(), parent, DocumentsContract.Document.MIME_TYPE_DIR, "Trinity Files");
        if (folder == null) throw new IOException("Unable to create Trinity Files in this folder. Choose Documents on your phone.");
        if(!prefs.edit().putString("tree", tree.toString()).putString("folder", folder.toString()).commit())throw new IOException("Unable to remember Trinity Files. Check your phone's free space and try again.");
    }
    JSONObject metadata(String id) {
        try { return new JSONObject(prefs.getString("file-" + id, "{}")); } catch (Exception ignored) { return new JSONObject(); }
    }
    Uri save(String id, String fileName, String mime, File source) throws Exception {
        return save(id,fileName,mime,source,()->true);
    }
    Uri save(String id, String fileName, String mime, File source, java.util.function.BooleanSupplier current) throws Exception {
        if(!current.getAsBoolean())throw new IOException("Document saving was cancelled.");
        JSONObject previous = metadata(id);
        if (previous.has("uri")) { Uri uri = Uri.parse(previous.getString("uri")); if (!name(uri).isEmpty()) return uri; }
        Uri folder = folder(); if (folder == null) throw new IOException("Choose the Trinity Files folder again to save this document.");
        Set<String> names = new HashSet<>();
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(folder, DocumentsContract.getDocumentId(folder));
        try (Cursor cursor = context.getContentResolver().query(children, new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) { while (cursor != null && cursor.moveToNext()) names.add(cursor.getString(0)); }
        Uri target = DocumentsContract.createDocument(context.getContentResolver(), folder, mime, DocumentPolicy.uniqueName(fileName, names));
        if (target == null) throw new IOException("Unable to create this file in Trinity Files.");
        try (InputStream input = new FileInputStream(source); OutputStream output = context.getContentResolver().openOutputStream(target, "w")) {
            if (output == null) throw new IOException("Unable to write to Trinity Files.");
            byte[] buffer = new byte[64 * 1024]; int count;
            while ((count = input.read(buffer)) != -1) {if(!current.getAsBoolean())throw new IOException("Document saving was cancelled.");output.write(buffer, 0, count);}
            if(!current.getAsBoolean())throw new IOException("Document saving was cancelled.");
            output.flush();
        } catch (Exception error) { try { DocumentsContract.deleteDocument(context.getContentResolver(), target); } catch (Exception ignored) { } throw error; }
        previous.put("uri", target.toString()).put("fileName", fileName).put("mime", mime).put("createdAt", System.currentTimeMillis());
        if(!prefs.edit().putString("file-" + id, previous.toString()).commit())throw new IOException("Unable to remember the saved file. Check your phone's free space.");
        return target;
    }
    File part(String id) { if (!PhotoPolicy.validId(id)) throw new IllegalArgumentException("Invalid document identifier."); return new File(directory, id + ".part"); }
    File complete(String id) { if (!PhotoPolicy.validId(id)) throw new IllegalArgumentException("Invalid document identifier."); return new File(directory, id + ".document"); }
    Uri readable(String id) {
        JSONObject metadata = metadata(id); String saved = metadata.optString("uri");
        if (!saved.isEmpty() && !name(Uri.parse(saved)).isEmpty()) return Uri.parse(saved);
        File file = complete(id); return file.exists() ? FileProvider.getUriForFile(context, context.getPackageName() + ".files", file) : null;
    }
    void prune(Set<String> active) {
        File[] files = directory.listFiles(); if (files == null) return;
        Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
        long bytes = 0; int count = 0;
        for (File file : files) {
            String id = file.getName().split("\\.")[0]; if (active.contains(id)) continue;
            bytes += file.length(); count++;
            if ((file.getName().endsWith(".part") && file.lastModified() < System.currentTimeMillis() - 3600000) || count > 40 || bytes > DocumentPolicy.MAX_ACTIVE_BYTES) file.delete();
        }
    }
}
