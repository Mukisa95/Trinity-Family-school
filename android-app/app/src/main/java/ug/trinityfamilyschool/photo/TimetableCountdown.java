package ug.trinityfamilyschool.photo;

/** Collection rows use minute precision because a recycled host Chronometer may stop. */
final class TimetableCountdown {
    static String label(long end, long now, boolean active) {
        long remaining = Math.max(0, end - now);
        long minutes = remaining / 60_000 + (remaining % 60_000 == 0 ? 0 : 1);
        String duration = minutes >= 60 ? minutes / 60 + "h " + minutes % 60 + "m" : minutes + "m";
        return duration + (active ? " left" : " to start");
    }
}
