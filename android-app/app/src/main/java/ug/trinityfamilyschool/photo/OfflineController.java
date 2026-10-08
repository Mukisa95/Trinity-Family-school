package ug.trinityfamilyschool.photo;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.SystemClock;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class OfflineController {
    static final int UNLOCK_REQUEST = 72;
    private final Activity activity;
    private final WebView web;
    private final OfflineStore store;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final WebViewAssetLoader assets;
    private JavaScriptReplyProxy pendingUnlock;
    private String unlockId;
    private long unlockedAt;
    private volatile String role = "";
    private boolean unlockOpen;
    private ConnectivityManager.NetworkCallback network;
    private android.content.BroadcastReceiver pushChanges;
    private final android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable relock = this::lock;
    OfflineController(Activity activity, WebView web) {
        this.activity = activity; this.web = web; this.store = new OfflineStore(activity);
        WebViewAssetLoader.AssetsPathHandler packaged = new WebViewAssetLoader.AssetsPathHandler(activity);
        assets = new WebViewAssetLoader.Builder().addPathHandler("/offline/", path -> packaged.handle("offline/" + path)).build();
        network = new ConnectivityManager.NetworkCallback() {
            @Override public void onCapabilitiesChanged(android.net.Network value, NetworkCapabilities capabilities) {
                handler.post(OfflineController.this::publishConnectivity);
            }
            @Override public void onLost(android.net.Network value) { handler.post(OfflineController.this::publishConnectivity); }
        };
        try { ((ConnectivityManager) activity.getSystemService(Context.CONNECTIVITY_SERVICE)).registerDefaultNetworkCallback(network); } catch (Exception ignored) { network = null; }
        pushChanges=new android.content.BroadcastReceiver(){@Override public void onReceive(Context context,Intent intent){
            if(PhotoPolicy.trusted(web.getUrl()))web.evaluateJavascript("window.dispatchEvent(new Event('trinity-android-notifications-change'));"+(intent.getBooleanExtra("parentScope",false)?"window.dispatchEvent(new Event('trinity-parent-scope-changed'));":""),null);
        }};
        androidx.core.content.ContextCompat.registerReceiver(activity,pushChanges,new android.content.IntentFilter(NativePush.EVENT),androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "TrinityOffline", new java.util.HashSet<>(java.util.Arrays.asList(PhotoPolicy.ORIGIN, OfflinePolicy.LOCAL_ORIGIN)), (view, message, origin, mainFrame, reply) -> {
                if (!mainFrame) return;
                if (PhotoPolicy.trusted(origin.toString()) && PhotoPolicy.trusted(view.getUrl())) process(message.getData(), reply, false);
                else if (OfflinePolicy.local(view.getUrl()) && OfflinePolicy.LOCAL_ORIGIN.equals(origin.toString())) process(message.getData(), reply, true);
            });
        }
    }
    WebResourceResponse intercept(WebResourceRequest request) {
        if (!OfflinePolicy.LOCAL_ORIGIN.substring(8).equals(request.getUrl().getHost())) return null;
        WebResourceResponse result = assets.shouldInterceptRequest(request.getUrl());
        if (result != null) return result;
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new java.io.ByteArrayInputStream(new byte[0]));
    }
    boolean connected() {
        ConnectivityManager manager = (ConnectivityManager) activity.getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkCapabilities capabilities = manager.getNetworkCapabilities(manager.getActiveNetwork());
        return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }
    void start() {
        io.execute(() -> {
            try { JSONObject value = store.read(); if (value != null) role = value.getJSONObject("session").optString("role"); } catch (Exception ignored) { }
            activity.runOnUiThread(() -> {
                if (activity.isDestroyed()) return;
                String deepLink = activity.getIntent().getStringExtra("offlineRoute");
                String onlineLink = activity.getIntent().getStringExtra("onlineRoute");
                String pushLink = NativePush.tapRoute(activity, activity.getIntent());
                web.loadUrl(pushLink != null ? pushLink : OfflinePolicy.launchRoute(deepLink, onlineLink, role));
            });
        });
    }
    void publishConnectivity() {
        if (activity.isDestroyed() || !PhotoPolicy.trusted(web.getUrl())) return;
        boolean online = connected();
        web.getSettings().setCacheMode(online ? android.webkit.WebSettings.LOAD_DEFAULT : android.webkit.WebSettings.LOAD_CACHE_ELSE_NETWORK);
        web.evaluateJavascript("if(window.trinityAndroidConnected!==" + online + "){window.trinityAndroidConnected=" + online + ";window.dispatchEvent(new Event('trinity-android-connectivity'))}", null);
    }
    private void reply(JavaScriptReplyProxy reply, String id, boolean success, String error, JSONObject data) {
        activity.runOnUiThread(() -> {
            if (activity.isDestroyed()) return;
            try {
                JSONObject result = data == null ? new JSONObject() : data;
                if (result.has("snapshot") && (!unlocked() || !OfflinePolicy.local(web.getUrl()))) {
                    result = new JSONObject(); result.put("id", id).put("success", false).put("error", "Access remains locked."); reply.postMessage(result.toString()); return;
                }
                result.put("id", id).put("success", success);
                if (error != null) result.put("error", error);
                reply.postMessage(result.toString());
            } catch (Exception ignored) { }
        });
    }
    private void process(String message, JavaScriptReplyProxy reply, boolean local) {
        String id;
        JSONObject input;
        try {
            if (message == null) return;
            if (message.length() > OfflineStore.MAX_BYTES) {
                java.util.regex.Matcher requestId = java.util.regex.Pattern.compile("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}").matcher(message.substring(0, Math.min(512, message.length())));
                if (requestId.find() && PhotoPolicy.validId(requestId.group(1))) reply(reply, requestId.group(1), false, "School information exceeds the offline storage limit.", null);
                return;
            }
            input = new JSONObject(message); id = input.getString("id");
            if (!PhotoPolicy.validId(id)) return;
        } catch (Exception ignored) { return; }
        String action = input.optString("action");
        if ("notificationStatus".equals(action)) {
            try { reply(reply, id, true, null, NativePush.status(activity).put("appName", SchoolApp.NAME)
                .put("notificationPermission", LessonReminders.notificationsAllowed(activity) ? "granted" : "denied")); }
            catch (Exception ignored) { reply(reply, id, false, "Android notification status is unavailable.", null); }
            return;
        }
        if ("registerNativePush".equals(action) || "testNativePush".equals(action)) {
            if (local) { reply(reply,id,false,"Connect and sign in to configure school push.",null); return; }
            new Thread(() -> { try { JSONObject result = "registerNativePush".equals(action)
                ? NativePush.register(activity,input.optString("userId"),input.optString("idToken"),input.optBoolean("enable"))
                : NativePush.test(activity,input.optString("userId"),input.optString("idToken")); reply(reply,id,true,null,result);
                } catch(Exception error){ reply(reply,id,false,"School notifications could not connect. Check your connection and try again.",null); }
            }).start(); return;
        }
        if ("disableNativePush".equals(action)) { NativePush.clear(activity,true); reply(reply,id,true,null,null); return; }
        if ("clearNativePush".equals(action)) { NativePush.clear(activity,false); reply(reply,id,true,null,null); return; }
        if ("clear".equals(action)) NativePush.clear(activity,false);
        if ("openNotificationSettings".equals(action)) {
            activity.startActivity(new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, activity.getPackageName()));
            reply(reply, id, true, null, null); return;
        }
        if (!local && "appearance".equals(action)) {
            // Also colour the inset-owning frame, which covers transparent system bars.
            android.view.ViewGroup content = activity.findViewById(android.R.id.content);
            if (content.getChildCount() > 0) SystemBars.apply(activity, content.getChildAt(0), input.optBoolean("dark"));
            reply(reply, id, true, null, null); return;
        }
        if ("openTimetableSettings".equals(action)) { activity.startActivity(new Intent(activity, TimetableSettingsActivity.class)); reply(reply, id, true, null, null); return; }
        if ("openLessonReminderSettings".equals(action)) { activity.startActivity(new Intent(activity, LessonReminderSettingsActivity.class)); reply(reply, id, true, null, null); return; }
        if (local) {
            if ("unlock".equals(action)) { unlock(id, reply); return; }
            if ("lock".equals(action)) { lock(); reply(reply, id, true, null, null); return; }
            if ("openOnline".equals(action) || "openParent".equals(action)) {
                if (!connected() && !"openParent".equals(action)) { reply(reply, id, false, "Connect to the internet to open the full application.", null); return; }
                reply(reply, id, true, null, null);
                web.loadUrl("openParent".equals(action) ? PhotoPolicy.ORIGIN + "/parent" : OfflinePolicy.onlineRoute(web.getUrl(), role)); return;
            }
            if ("selectTimetable".equals(action)) {
                if (!unlocked()) { reply(reply, id, false, "Unlock to continue.", null); return; }
                io.execute(() -> {
                    try {
                        TimetableUpdates.select(activity, store, input); reply(reply, id, true, null, null);
                        if (input.optBoolean("notificationCard") && android.os.Build.VERSION.SDK_INT >= 33
                            && activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                            activity.runOnUiThread(() -> activity.requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 73));
                        }
                    }
                    catch (Exception error) { reply(reply, id, false, error.getMessage(), null); }
                }); return;
            }
            if (!"status".equals(action)) { reply(reply, id, false, "Unsupported action.", null); return; }
        } else if (!"connect".equals(action) && !"save".equals(action) && !"clear".equals(action) && !"status".equals(action)) {
            reply(reply, id, false, "Unsupported preparation action.", null); return;
        }
        io.execute(() -> {
            try {
                JSONObject output = new JSONObject();
                switch (action) {
                    case "connect":
                        JSONObject session = fetchSession(input.getString("token"));
                        store.connect(session); role = session.optString("role");
                        if (session.getJSONObject("grants").optBoolean("timetable")) activity.runOnUiThread(this::requestNotifications);
                        TimetableUpdates.refresh(activity, store);
                        output.put("session", session); break;
                    case "save": store.save(input.getJSONObject("snapshot")); TimetableUpdates.refresh(activity, store); break;
                    case "clear": store.clear(); role = ""; TimetableUpdates.clear(activity); break;
                    case "status":
                        JSONObject available = store.available();
                        output.put("available", available != null);
                        if (available != null) output.put("session", available.getJSONObject("session"));
                        break;
                    default: throw new IllegalArgumentException("Unsupported offline action.");
                }
                reply(reply, id, true, null, output);
            } catch (Exception error) {
                reply(reply, id, false, error.getMessage() == null ? "Offline access is unavailable." : error.getMessage(), null);
            }
        });
    }
    private JSONObject fetchSession(String token) throws Exception {
        if (token.length() < 20 || token.length() > 16000) throw new IllegalArgumentException("Invalid signed session.");
        HttpURLConnection connection = (HttpURLConnection) new URL(PhotoPolicy.ORIGIN + "/api/offline/session").openConnection();
        connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(12000); connection.setReadTimeout(12000);
        connection.setRequestProperty("Authorization", "Bearer " + token); connection.setRequestProperty("Accept", "application/json");
        try {
            int status = connection.getResponseCode();
            if (status == 401 || status == 403) { store.clear(); TimetableUpdates.clear(activity); throw new IllegalStateException("Sign in again to continue."); }
            if (status != 200) throw new IllegalStateException("Offline preparation is temporarily unavailable.");
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096]; int count;
                while ((count = input.read(buffer)) != -1) { bytes.write(buffer, 0, count); if (bytes.size() > 256000) throw new IllegalStateException("Invalid offline session response."); }
                return new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
            }
        } finally { connection.disconnect(); }
    }
    private boolean unlocked() { return unlockedAt > 0 && SystemClock.elapsedRealtime() - unlockedAt < 300_000L; }
    private void requestNotifications() {
        if (activity.isDestroyed() || android.os.Build.VERSION.SDK_INT < 33 || !TimetableSurfaces.prefs(activity).getBoolean("card", true)) return;
        android.content.SharedPreferences settings = activity.getSharedPreferences("offline-ui", Context.MODE_PRIVATE);
        if (!settings.getBoolean("notificationPrompted", false) && activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            settings.edit().putBoolean("notificationPrompted", true).apply(); activity.requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 73);
        }
    }
    private void unlock(String id, JavaScriptReplyProxy reply) {
        if (unlockOpen) { reply(reply, id, false, "An unlock is already in progress.", null); return; }
        if (unlocked()) { sendSaved(id, reply); return; }
        KeyguardManager keyguard = (KeyguardManager) activity.getSystemService(Context.KEYGUARD_SERVICE);
        if (!keyguard.isDeviceSecure()) { reply(reply, id, false, "Set a PIN, password or pattern on your phone to protect offline school information.", null); return; }
        Intent intent = keyguard.createConfirmDeviceCredentialIntent("" + SchoolApp.NAME, "Unlock " + SchoolApp.NAME);
        if (intent == null) { reply(reply, id, false, "Device unlock is unavailable.", null); return; }
        pendingUnlock = reply; unlockId = id; unlockOpen = true;
        activity.startActivityForResult(intent, UNLOCK_REQUEST);
    }
    void result(int result) {
        JavaScriptReplyProxy reply = pendingUnlock; String id = unlockId;
        pendingUnlock = null; unlockId = null; unlockOpen = false;
        if (reply == null) return;
        if (result != Activity.RESULT_OK || !OfflinePolicy.local(web.getUrl())) { reply(reply, id, false, "Access remains locked.", null); return; }
        unlockedAt = SystemClock.elapsedRealtime(); handler.removeCallbacks(relock); handler.postDelayed(relock, 300_000L); sendSaved(id, reply);
    }
    private void sendSaved(String id, JavaScriptReplyProxy reply) {
        io.execute(() -> {
            try {
                JSONObject value = store.available();
                if (value == null) throw new IllegalStateException("Connect and sign in to continue.");
                reply(reply, id, true, null, value);
            } catch (Exception error) { reply(reply, id, false, error.getMessage(), null); }
        });
    }
    void lock() {
        handler.removeCallbacks(relock);
        unlockedAt = 0;
        if (OfflinePolicy.local(web.getUrl())) web.evaluateJavascript("window.dispatchEvent(new Event('trinity-offline-locked'))", null);
    }
    void resume() {
        handler.post(this::publishConnectivity);
        handler.post(() -> { if (PhotoPolicy.trusted(web.getUrl())) web.evaluateJavascript("window.dispatchEvent(new Event('trinity-android-notifications-change'))", null); });
        io.execute(() -> LessonReminders.refresh(activity, store));
    }
    void pause() { if (!unlockOpen) lock(); }
    void destroy() {
        if(pushChanges!=null){try{activity.unregisterReceiver(pushChanges);}catch(Exception ignored){}pushChanges=null;}
        handler.removeCallbacksAndMessages(null);
        if (network != null) try { ((ConnectivityManager) activity.getSystemService(Context.CONNECTIVITY_SERVICE)).unregisterNetworkCallback(network); } catch (Exception ignored) { }
        io.shutdownNow();
    }
}
