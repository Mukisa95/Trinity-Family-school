package ug.trinityfamilyschool.photo;

import org.json.JSONArray;
import java.util.*;

/** Stable identities let a widget retain its own order across clock ticks and refreshed data. */
final class WidgetFeedOrder {
    static String key(TimetableSchedule.Frame row) {
        if (!row.trackedSubject.isEmpty()) return "subject:" + row.trackedSubject;
        return row.eventId.isEmpty() ? "timetable:" + row.profileId : "event:" + row.eventId;
    }
    static List<String> read(String json) {
        List<String> result = new ArrayList<>();
        try {
            JSONArray values = new JSONArray(json);
            for (int i = 0; i < values.length(); i++) {
                String value = values.optString(i);
                if (!value.isEmpty() && !result.contains(value)) result.add(value);
            }
        } catch (Exception ignored) { }
        return result;
    }
    static void apply(TimetableSchedule.Frame feed, List<String> saved) {
        Map<String, Integer> ranks = new HashMap<>();
        for (int i = 0; i < saved.size(); i++) ranks.putIfAbsent(saved.get(i), i);
        feed.profiles.sort(Comparator.comparingInt(row -> ranks.getOrDefault(key(row), Integer.MAX_VALUE)));
    }
    static List<String> visible(List<String> saved, Collection<String> available) {
        List<String> result = new ArrayList<>();
        for (String key : saved) if (available.contains(key) && !result.contains(key)) result.add(key);
        for (String key : available) if (!result.contains(key)) result.add(key);
        return result;
    }
    static List<String> remember(List<String> history, List<String> visible) {
        List<String> result = new ArrayList<>(); int next = 0;
        for (String old : history) {
            String key = visible.contains(old) ? visible.get(next++) : old;
            if (!result.contains(key)) result.add(key);
        }
        while (next < visible.size()) { String key = visible.get(next++); if (!result.contains(key)) result.add(key); }
        return result;
    }
}
