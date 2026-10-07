package ug.trinityfamilyschool.photo;

import android.app.Activity;
import android.content.ClipData;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.WindowInsets;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int CAMERA_RESULT = 40, FILE_RESULT = 41;
    private WebView web;
    private OfflineController offline;
    private File exchange;
    private ValueCallback<Uri[]> fileCallback;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Map<String, File> available = new ConcurrentHashMap<>();
    private final Map<String, Long> expires = new ConcurrentHashMap<>();
    private File captureFile;
    private Uri captureUri;
    private String captureId;
    private JavaScriptReplyProxy captureReply;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        exchange = new File(getCacheDir(), "photo-exchange"); exchange.mkdirs();
        // Older exchanges are private cache files, never a permanent pupil store.
        File[] old = exchange.listFiles();
        if (old != null) for (File file : old) if (System.currentTimeMillis() - file.lastModified() > 86_400_000L) file.delete();
        android.widget.LinearLayout frame = new android.widget.LinearLayout(this);
        frame.setOrientation(android.widget.LinearLayout.VERTICAL);
        web = new WebView(this);
        frame.addView(web, new android.widget.LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(frame);
        offline = new OfflineController(this, web);
        frame.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                offline.publishConnectivity();
                if (OfflinePolicy.local(url)) getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
                else getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                String url = request.getUrl().toString();
                if (OfflinePolicy.local(url)) return false;
                if (PhotoPolicy.trusted(url)) {
                    if (!offline.connected() && !OfflinePolicy.supported(url) && !"/login".equals(request.getUrl().getPath())) {
                        android.widget.Toast.makeText(MainActivity.this, "Connect to open this section.", android.widget.Toast.LENGTH_SHORT).show();
                        return true;
                    }
                    return false;
                }
                // Outside sites open outside the privileged WebView.
                if ("https".equals(request.getUrl().getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); } catch (Exception ignored) { }
                }
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse saved = offline.intercept(request);
                return saved != null ? saved : photoResponse(request);
            }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new ServiceWorkerClientCompat() {
                @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) { return photoResponse(request); }
            });
        }
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!PhotoPolicy.trusted(view.getUrl())) { callback.onReceiveValue(null); return true; }
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { startActivityForResult(params.createIntent(), FILE_RESULT); }
                catch (Exception ignored) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "TrinityPhoto", Collections.singleton(PhotoPolicy.ORIGIN), (view, message, origin, mainFrame, reply) -> {
                if (!mainFrame || !PhotoPolicy.trusted(origin.toString()) || !PhotoPolicy.trusted(view.getUrl())) return;
                try {
                    JSONObject input = new JSONObject(message.getData());
                    String id = input.optString("id");
                    if (!PhotoPolicy.validId(id)) return;
                    switch (input.optString("action")) {
                        case "cameras": replyCameras(id, reply); break;
                        case "capture": capture(id, input.optString("cameraId"), reply); break;
                        case "share": share(id, input.optString("dataUrl"), reply); break;
                        default: respond(reply, id, false, "Unsupported photo action.", null);
                    }
                } catch (Exception ignored) { /* Malformed bridge calls have no privileges. */ }
            });
        }
        // A restored camera activity cannot associate its photo with a new pupil.
        // Reloading deliberately discards the old pending request instead.
        offline.start();
    }

    private Map<String, ResolveInfo> cameras() {
        PackageManager pm = getPackageManager();
        Set<String> packages = new HashSet<>();
        List<ResolveInfo> defaults = pm.queryIntentActivities(new Intent(MediaStore.ACTION_IMAGE_CAPTURE), PackageManager.MATCH_DEFAULT_ONLY);
        for (ResolveInfo item : defaults) packages.add(item.activityInfo.packageName);
        Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        for (ResolveInfo item : pm.queryIntentActivities(launcher, 0)) packages.add(item.activityInfo.packageName);
        Map<String, ResolveInfo> result = new LinkedHashMap<>();
        // Explicit package capture intents include third-party cameras on Android 11+.
        for (String pkg : packages) for (ResolveInfo item : pm.queryIntentActivities(new Intent(MediaStore.ACTION_IMAGE_CAPTURE).setPackage(pkg), PackageManager.MATCH_DEFAULT_ONLY)) {
            if (!item.activityInfo.exported || !item.activityInfo.enabled || !item.activityInfo.applicationInfo.enabled) continue;
            ComponentName component = new ComponentName(item.activityInfo.packageName, item.activityInfo.name);
            result.put(component.flattenToString(), item);
        }
        return result;
    }

    private void replyCameras(String id, JavaScriptReplyProxy reply) throws Exception {
        JSONArray list = new JSONArray();
        List<Map.Entry<String, ResolveInfo>> items = new ArrayList<>(cameras().entrySet());
        items.sort((a, b) -> a.getValue().loadLabel(getPackageManager()).toString().compareToIgnoreCase(b.getValue().loadLabel(getPackageManager()).toString()));
        for (Map.Entry<String, ResolveInfo> item : items) list.put(new JSONObject().put("id", item.getKey()).put("label", item.getValue().loadLabel(getPackageManager())));
        respond(reply, id, true, null, new JSONObject().put("apiVersion", 1).put("cameras", list));
    }

    private void capture(String id, String cameraId, JavaScriptReplyProxy reply) {
        if (captureId != null || fileCallback != null) { respond(reply, id, false, "Another photo action is already open.", null); return; }
        try {
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            if (!cameraId.isEmpty()) {
                if (!cameras().containsKey(cameraId)) throw new IllegalArgumentException("That camera is unavailable. Choose another camera or upload its photo.");
                intent.setComponent(ComponentName.unflattenFromString(cameraId));
            }
            if (intent.resolveActivity(getPackageManager()) == null) throw new IllegalStateException("No compatible camera is installed. Take a photo in another app and upload it.");
            captureFile = new File(exchange, UUID.randomUUID() + ".jpg");
            captureUri = FileProvider.getUriForFile(this, getPackageName() + ".files", captureFile);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, captureUri);
            intent.setClipData(ClipData.newRawUri("Capture photo", captureUri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            captureId = id; captureReply = reply;
            startActivityForResult(intent, CAMERA_RESULT);
        } catch (Exception error) {
            clearCapture(true);
            respond(reply, id, false, error.getMessage() == null ? "Could not open the selected camera." : error.getMessage(), null);
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == OfflineController.UNLOCK_REQUEST) { offline.result(result); return; }
        if (request == FILE_RESULT && fileCallback != null) {
            fileCallback.onReceiveValue(PhotoPolicy.trusted(web.getUrl()) ? WebChromeClient.FileChooserParams.parseResult(result, data) : null);
            fileCallback = null;
        }
        if (request != CAMERA_RESULT || captureId == null) return;
        final String id = captureId;
        final JavaScriptReplyProxy reply = captureReply;
        final File file = captureFile;
        if (result != RESULT_OK) {
            clearCapture(true); respond(reply, id, true, null, json("cancelled", true)); return;
        }
        io.execute(() -> {
            String failure = null;
            try {
                // Let a camera's final file write settle. Never use result extras' thumbnail.
                long previous = -1; int stable = 0;
                for (int i = 0; i < 10 && stable < 2; i++) {
                    Thread.sleep(500);
                    long size = file.length(); stable = size > 0 && size == previous ? stable + 1 : 0; previous = size;
                }
                BitmapFactory.Options bounds = new BitmapFactory.Options(); bounds.inJustDecodeBounds = true;
                BitmapFactory.decodeFile(file.getAbsolutePath(), bounds);
                if (stable < 2 || !"image/jpeg".equals(bounds.outMimeType) || !PhotoPolicy.fullSizeJpeg(file.length(), bounds.outWidth, bounds.outHeight)) {
                    failure = "This camera did not return a full-size JPEG. Choose another camera or upload its saved photo.";
                }
            } catch (Exception error) { failure = "The camera photo could not be read. Please try again."; }
            final String error = failure;
            runOnUiThread(() -> {
                if (isDestroyed()) { file.delete(); return; }
                clearCapture(false);
                if (error != null || !PhotoPolicy.trusted(web.getUrl())) { file.delete(); respond(reply, id, false, error == null ? "Photo request expired." : error, null); return; }
                String token = UUID.randomUUID().toString();
                available.put(token, file); expires.put(token, System.currentTimeMillis() + 300_000L);
                respond(reply, id, true, null, json("photoUrl", PhotoPolicy.ORIGIN + "/__native_photo/" + token + ".jpg"));
            });
        });
    }

    private void clearCapture(boolean delete) {
        if (captureUri != null) revokeUriPermission(captureUri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        if (delete && captureFile != null) captureFile.delete();
        captureUri = null; captureFile = null; captureId = null; captureReply = null;
    }

    private WebResourceResponse photoResponse(WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!PhotoPolicy.trusted(uri.toString()) || uri.getPath() == null || !uri.getPath().startsWith("/__native_photo/")) return null;
        String token = uri.getLastPathSegment();
        if (token != null && token.endsWith(".jpg")) token = token.substring(0, token.length() - 4);
        File file = token == null ? null : available.get(token);
        Long expiry = token == null ? null : expires.get(token);
        Map<String, String> headers = new HashMap<>(); headers.put("Cache-Control", "no-store, private"); headers.put("X-Content-Type-Options", "nosniff");
        try {
            if (!"GET".equals(request.getMethod()) || file == null || expiry == null || expiry < System.currentTimeMillis() || uri.getQuery() != null) {
                if (file != null && expiry != null && expiry < System.currentTimeMillis()) { available.remove(token); expires.remove(token); file.delete(); }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, new ByteArrayInputStream(new byte[0]));
            }
            return new WebResourceResponse("image/jpeg", null, 200, "OK", headers, new FileInputStream(file));
        } catch (Exception ignored) { return new WebResourceResponse("text/plain", "UTF-8", 410, "Gone", headers, new ByteArrayInputStream(new byte[0])); }
    }

    private void share(String id, String dataUrl, JavaScriptReplyProxy reply) {
        if (!dataUrl.startsWith("data:image/jpeg;base64,") || dataUrl.length() > PhotoPolicy.MAX_BYTES * 4 / 3 + 100) {
            respond(reply, id, false, "Choose a JPEG smaller than 30 MB to share.", null); return;
        }
        io.execute(() -> {
            try {
                byte[] bytes = Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), Base64.DEFAULT);
                if (bytes.length == 0 || bytes.length > PhotoPolicy.MAX_BYTES) throw new IllegalArgumentException();
                File file = new File(exchange, "edit-" + UUID.randomUUID() + ".jpg");
                try (FileOutputStream output = new FileOutputStream(file)) { output.write(bytes); }
                runOnUiThread(() -> {
                    if (isDestroyed() || !PhotoPolicy.trusted(web.getUrl())) { file.delete(); return; }
                    try {
                        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".files", file);
                        Intent send = new Intent(Intent.ACTION_SEND).setType("image/jpeg").putExtra(Intent.EXTRA_STREAM, uri);
                        send.setClipData(ClipData.newRawUri("Edit photo", uri)); send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(send, "Open photo in an editor"));
                        respond(reply, id, true, null, null);
                    } catch (Exception error) { file.delete(); respond(reply, id, false, "No app could open this photo. Import an edited JPEG instead.", null); }
                });
            } catch (Exception error) { runOnUiThread(() -> respond(reply, id, false, "Unable to prepare the photo for another app.", null)); }
        });
    }

    private static JSONObject json(String key, Object value) {
        JSONObject result = new JSONObject(); try { result.put(key, value); } catch (Exception ignored) { } return result;
    }
    private void respond(JavaScriptReplyProxy reply, String id, boolean ok, String error, JSONObject result) {
        if (isDestroyed() || !PhotoPolicy.trusted(web.getUrl())) return;
        try {
            JSONObject message = result == null ? new JSONObject() : result;
            message.put("id", id).put("ok", ok);
            if (error != null) message.put("error", error);
            reply.postMessage(message.toString());
        } catch (Exception ignored) { /* The original document may have closed. */ }
    }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == 73) new Thread(() -> TimetableUpdates.refresh(this, new OfflineStore(this))).start();
    }
    @Override protected void onPause() { if (offline != null) offline.pause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (offline != null) offline.resume(); }
    @Override protected void onDestroy() {
        if (offline != null) offline.destroy();
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        clearCapture(true); io.shutdownNow();
        for (File file : available.values()) file.delete(); available.clear(); expires.clear();
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
