package ug.trinityfamilyschool.photo;

/** A visual tick must never replace the next lesson or access-expiry alarm. */
final class TimetableRefreshPlan {
    final long boundaryAt, visualAt;
    TimetableRefreshPlan(long now, long boundary, long expires, boolean visible, boolean progress, boolean interactive) {
        boolean enabled = visible && expires > now;
        boundaryAt = enabled ? Math.min(expires, Math.max(now + 1000, boundary)) : 0;
        visualAt = enabled && progress && interactive ? Math.min(boundaryAt, (now / 60_000 + 1) * 60_000) : 0;
    }
}
