package ug.trinityfamilyschool.photo;

import java.net.URI;

/** Shared, testable limits for the origin-restricted photo bridge. */
final class PhotoPolicy {
    static final String ORIGIN = BuildConfig.SCHOOL_ORIGIN;
    static final long MAX_BYTES = 30L * 1024 * 1024;
    static boolean trusted(String value) {
        try {
            URI uri = new URI(value);
            return "https".equals(uri.getScheme()) && URI.create(ORIGIN).getHost().equals(uri.getHost())
                    && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (Exception ignored) { return false; }
    }
    static boolean validId(String value) { return value != null && value.matches("[0-9a-f-]{36}"); }
    static boolean fullSizeJpeg(long length, int width, int height) {
        return length > 0 && length <= MAX_BYTES && width >= 500 && height >= 500;
    }
}
