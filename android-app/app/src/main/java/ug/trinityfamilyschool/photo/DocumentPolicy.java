package ug.trinityfamilyschool.photo;

import java.util.*;

/** Limits shared by document saving, background jobs and their bridge. */
final class DocumentPolicy {
    static final long MAX_BYTES = 100L * 1024 * 1024, MAX_ACTIVE_BYTES = 200L * 1024 * 1024;
    static final int CHUNK_BYTES = 96 * 1024;
    static final Map<String, String> TYPES = new LinkedHashMap<>();
    static {
        TYPES.put("pdf", "application/pdf"); TYPES.put("png", "image/png"); TYPES.put("jpg", "image/jpeg"); TYPES.put("jpeg", "image/jpeg");
        TYPES.put("csv", "text/csv"); TYPES.put("txt", "text/plain"); TYPES.put("json", "application/json");
        TYPES.put("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        TYPES.put("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        TYPES.put("doc", "application/msword"); TYPES.put("xls", "application/vnd.ms-excel");
        TYPES.put("zip", "application/zip");
    }
    static String fileName(String value) {
        String name = value == null ? "" : value.replaceAll("[\\p{Cntrl}/\\\\:*?\"<>|]", "_").replaceAll("^\\.+", "").trim();
        if (name.isEmpty()) name = "document.pdf";
        int dot = name.lastIndexOf('.');
        if (dot <= 0 || !TYPES.containsKey(name.substring(dot + 1).toLowerCase(Locale.ROOT))) throw new IllegalArgumentException("This file type cannot be saved in Trinity Files.");
        String extension = name.substring(dot).toLowerCase(Locale.ROOT), stem = name.substring(0, dot);
        int end = stem.offsetByCodePoints(0, Math.min(100, stem.codePointCount(0, stem.length())));
        return stem.substring(0, end) + extension;
    }
    static String mime(String name) { return TYPES.get(fileName(name).substring(fileName(name).lastIndexOf('.') + 1)); }
    static void size(long bytes) { if (bytes <= 0 || bytes > MAX_BYTES) throw new IllegalArgumentException("Choose a document smaller than 100 MB."); }
    static void chunk(int expectedSequence, int sequence, long written, int length, long expected) {
        if (sequence != expectedSequence || length <= 0 || length > CHUNK_BYTES || written + length > expected) throw new IllegalArgumentException("The document transfer was incomplete. Try saving it again.");
    }
    static String uniqueName(String name, Set<String> existing) {
        if (!existing.contains(name)) return name;
        int dot = name.lastIndexOf('.');
        for (int i = 2; i < 100000; i++) { String next = name.substring(0, dot) + " (" + i + ")" + name.substring(dot); if (!existing.contains(next)) return next; }
        throw new IllegalStateException("This folder has too many documents with the same name.");
    }
}
