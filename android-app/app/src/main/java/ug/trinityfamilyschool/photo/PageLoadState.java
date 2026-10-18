package ug.trinityfamilyschool.photo;

/** A delayed error or JavaScript reply may only affect its own document load. */
final class PageLoadState {
    private long revision;
    private String url = "";
    private boolean failed;

    void begin(String nextUrl) {
        revision++;
        url = documentUrl(nextUrl);
        failed = false;
    }

    boolean fail(String failedUrl) {
        if (!url.equals(documentUrl(failedUrl))) return false;
        failed = true;
        return true;
    }

    long revision() { return revision; }
    boolean current(long candidate) { return revision == candidate; }
    boolean pending(long candidate) { return current(candidate) && failed; }

    void recovered(long candidate) {
        if (current(candidate)) failed = false;
    }

    private static String documentUrl(String value) {
        if (value == null) return "";
        int fragment = value.indexOf('#');
        return fragment < 0 ? value : value.substring(0, fragment);
    }
}
