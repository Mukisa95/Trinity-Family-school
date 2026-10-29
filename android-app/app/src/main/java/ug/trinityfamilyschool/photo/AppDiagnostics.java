package ug.trinityfamilyschool.photo;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.webkit.WebView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.UUID;

/** Bounded device-local codes and timings. Never accepts records, URLs or tokens. */
final class AppDiagnostics {
    private final Activity activity;
    private final SharedPreferences prefs;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final String activityId = UUID.randomUUID().toString();
    private String documentId = UUID.randomUUID().toString();
    private final long createdAt = SystemClock.uptimeMillis();
    private long resumedAt;
    private boolean firstInteractive, waitingInteractive;
    private long lastBeat;
    private boolean foreground;
    private final Runnable heartbeat = new Runnable() {
        @Override public void run() {
            if (!foreground) return;
            long now = SystemClock.uptimeMillis();
            if (now - lastBeat > 6000) record("native_ui_stall", now - lastBeat - 2000);
            lastBeat = now;
            handler.postDelayed(this, 2000);
        }
    };
    AppDiagnostics(Activity activity) {
        this.activity = activity;
        prefs = activity.getSharedPreferences("app-reliability-v1", Context.MODE_PRIVATE);
        record("native_started", 0);
    }
    synchronized void record(String code, long durationMs) {
        if (!validCode(code)) return;
        try {
            JSONArray previous = new JSONArray(prefs.getString("events", "[]"));
            JSONArray next = new JSONArray();
            for (int i = Math.max(0, previous.length() - 79); i < previous.length(); i++) next.put(previous.getJSONObject(i));
            if ("web_navigation_started".equals(code)) documentId = UUID.randomUUID().toString();
            JSONObject event = new JSONObject().put("at", System.currentTimeMillis()).put("code", code)
                .put("process", TrinityApplication.PROCESS_ID).put("activity", activityId).put("document", documentId);
            if (durationMs > 0) event.put("durationMs", Math.min(durationMs, 3600000));
            next.put(event);
            prefs.edit().putString("events", next.toString()).apply();
        } catch (Exception ignored) { /* A recorder failure cannot interrupt the app. */ }
    }
    static boolean validCode(String code) {
        return code != null && code.matches("(?:auth|app|offline|web|native|network|javascript|unhandled|report)[a-z0-9_./-]{0,90}");
    }
    void created(boolean restored, String source) {
        record(restored ? "native_created/restored" : "native_created/new", 0);
        record("native_entry/" + source, 0);
    }
    void interactive() {
        if (!foreground || !waitingInteractive) return;
        waitingInteractive = false;
        record("native_resume_interactive", Math.max(1, SystemClock.uptimeMillis() - resumedAt));
        if (!firstInteractive) { firstInteractive = true; record("native_startup_interactive", Math.max(1, SystemClock.uptimeMillis() - createdAt)); }
    }
    void resume() {
        resumedAt = SystemClock.uptimeMillis(); waitingInteractive = true;
        foreground = true; lastBeat = SystemClock.uptimeMillis();
        handler.removeCallbacks(heartbeat); handler.postDelayed(heartbeat, 2000);
        record("native_resumed", 0);
    }
    void pause() {
        foreground = false; handler.removeCallbacks(heartbeat); record("native_paused", 0);
    }
    void destroy() { foreground = false; handler.removeCallbacksAndMessages(null); }

    String report(Boolean connected, JSONObject offlineStatus) {
        try {
            android.content.pm.PackageInfo webview = WebView.getCurrentWebViewPackage();
            return new JSONObject().put("schema", 2).put("bugId", "TRI-" + UUID.randomUUID())
                .put("createdAt", System.currentTimeMillis()).put("app", SchoolApp.NAME)
                .put("version", BuildConfig.VERSION_NAME).put("build", BuildConfig.VERSION_CODE)
                .put("process", TrinityApplication.PROCESS_ID).put("activity", activityId).put("document", documentId)
                .put("previousProcessExit", previousProcessExit())
                .put("android", android.os.Build.VERSION.RELEASE)
                .put("webView", webview == null ? "unknown" : webview.packageName + " " + webview.versionName)
                .put("validatedConnection", connected == null ? JSONObject.NULL : connected).put("offline", offlineStatus)
                .put("events", new JSONArray(prefs.getString("events", "[]"))).toString(2);
        } catch (Exception ignored) { return "A diagnostic report could not be created."; }
    }
    private String previousProcessExit() {
        if (android.os.Build.VERSION.SDK_INT < 30) return "unsupported";
        try {
            android.app.ActivityManager manager = (android.app.ActivityManager) activity.getSystemService(Context.ACTIVITY_SERVICE);
            java.util.List<android.app.ApplicationExitInfo> exits = manager.getHistoricalProcessExitReasons(activity.getPackageName(), 0, 1);
            if (exits.isEmpty()) return "unavailable";
            switch (exits.get(0).getReason()) {
                case android.app.ApplicationExitInfo.REASON_LOW_MEMORY: return "low_memory";
                case android.app.ApplicationExitInfo.REASON_CRASH:
                case android.app.ApplicationExitInfo.REASON_CRASH_NATIVE: return "crash";
                case android.app.ApplicationExitInfo.REASON_ANR: return "unresponsive";
                case android.app.ApplicationExitInfo.REASON_USER_REQUESTED: return "user_requested";
                case android.app.ApplicationExitInfo.REASON_SIGNALED: return "signal";
                default: return "other";
            }
        } catch (Exception ignored) { return "unavailable"; }
    }
    void show(String report) { show(report, false); }
    void show(String report, boolean reopen) {
        if (activity.isDestroyed() || activity.isFinishing()) return;
        android.widget.TextView text = new android.widget.TextView(activity);
        text.setText("Copy this report after a sign-out, freeze or reconnect warning. It contains codes and timing, without passwords or school records.\n\n" + report);
        text.setTextIsSelectable(true); text.setPadding(24, 16, 24, 16); text.setTextSize(13);
        android.widget.ScrollView scroll = new android.widget.ScrollView(activity); scroll.addView(text);
        AlertDialog.Builder builder = new AlertDialog.Builder(activity).setTitle("App problem report").setView(scroll)
            .setPositiveButton("Copy report", (dialog, which) -> {
                ClipboardManager clipboard = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(ClipData.newPlainText("School app problem report", report));
                android.widget.Toast.makeText(activity, "Report copied", android.widget.Toast.LENGTH_SHORT).show();
            }).setNegativeButton("Close", null);
        if (reopen) builder.setNeutralButton("Reopen app", (value, which) -> activity.recreate());
        builder.show();
    }
}
