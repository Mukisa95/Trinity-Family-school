package ug.trinityfamilyschool.photo;

import java.net.URI;

/** Pure routing policy: packaged content never takes over unrelated website routes. */
final class OfflinePolicy {
    static final String LOCAL_ORIGIN = "https://appassets.androidplatform.net";
    static final String LOCAL_PATH = "/offline/index.html";
    static boolean local(String value) {
        try {
            URI uri = new URI(value);
            return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())
                && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443) && LOCAL_PATH.equals(uri.getPath());
        } catch (Exception ignored) { return false; }
    }
    static String savedRoute(String value) {
        try {
            URI uri = new URI(value);
            if (!PhotoPolicy.trusted(value)) return LOCAL_ORIGIN + LOCAL_PATH;
            String page = "/timetable".equals(uri.getPath()) ? "timetable"
                : ("/pupils".equals(uri.getPath()) || "/pupil-detail".equals(uri.getPath())) ? "pupils" : "dashboard";
            String pupil = "";
            if ("/pupil-detail".equals(uri.getPath()) && uri.getRawQuery() != null) {
                for (String pair : uri.getRawQuery().split("&")) if (pair.matches("id=[A-Za-z0-9_%.-]{1,200}")) pupil = "&pupilId=" + pair.substring(3);
            }
            String timetable = "";
            if ("timetable".equals(page) && uri.getRawQuery() != null) for (String pair : uri.getRawQuery().split("&")) if (pair.matches("(tableId|classId|streamId)=[A-Za-z0-9_%.-]{1,200}")) timetable += "&" + pair;
            return LOCAL_ORIGIN + LOCAL_PATH + "?page=" + page + pupil + timetable;
        } catch (Exception ignored) { return LOCAL_ORIGIN + LOCAL_PATH; }
    }
    // Connection state never selects a different interface or origin.
    static String launchRoute(String legacyRoute, String onlineRoute, String role) {
        if (legacyRoute != null && local(legacyRoute)) return onlineRoute(legacyRoute, role);
        if (onlineRoute != null && supported(onlineRoute)) return onlineRoute;
        return PhotoPolicy.ORIGIN + ("Parent".equals(role) ? "/parent" : "/");
    }
    static boolean supported(String value) {
        try {
            if (!PhotoPolicy.trusted(value)) return false;
            String path = new URI(value).getPath();
            return "/".equals(path) || "/parent".equals(path) || "/parent/settings".equals(path)
                || "/pupils".equals(path) || "/pupil-detail".equals(path) || "/timetable".equals(path);
        } catch (Exception ignored) { return false; }
    }
    static String onlineRoute(String value, String role) {
        String base = PhotoPolicy.ORIGIN + ("Parent".equals(role) ? "/parent" : "/");
        if (!local(value) || "Parent".equals(role)) return base;
        try {
            URI uri = new URI(value); String page = "", pupil = "", table = "", schoolClass = "", stream = "";
            if (uri.getRawQuery() != null) for (String pair : uri.getRawQuery().split("&")) {
                if (pair.startsWith("page=")) page = pair.substring(5);
                if (pair.matches("pupilId=[A-Za-z0-9_%.-]{1,200}")) pupil = pair.substring(8);
                if (pair.matches("tableId=[A-Za-z0-9_%.-]{1,200}")) table = pair.substring(8);
                if (pair.matches("classId=[A-Za-z0-9_%.-]{1,200}")) schoolClass = pair.substring(8);
                if (pair.matches("streamId=[A-Za-z0-9_%.-]{1,200}")) stream = pair.substring(9);
            }
            if ("pupils".equals(page)) return PhotoPolicy.ORIGIN + (pupil.isEmpty() ? "/pupils" : "/pupil-detail?id=" + pupil);
            if ("timetable".equals(page)) return PhotoPolicy.ORIGIN + "/timetable?tableId=" + table + "&classId=" + schoolClass + "&streamId=" + stream;
        } catch (Exception ignored) { }
        return base;
    }
}
