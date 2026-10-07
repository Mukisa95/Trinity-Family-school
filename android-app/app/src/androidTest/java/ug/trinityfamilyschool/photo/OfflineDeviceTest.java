package ug.trinityfamilyschool.photo;

import android.content.Context;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.TimeZone;
import static org.junit.Assert.*;

/** Uses a separate synthetic encrypted file; never signs in or changes school records. */
@RunWith(AndroidJUnit4.class)
public class OfflineDeviceTest {
    private String time(long value) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC")); return format.format(new Date(value));
    }
    @Test public void packagedReaderStartsInWebViewWithoutNetworkOrAccountData() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        java.util.concurrent.atomic.AtomicReference<android.webkit.WebView> reference = new java.util.concurrent.atomic.AtomicReference<>();
        java.util.concurrent.atomic.AtomicInteger remoteRequests = new java.util.concurrent.atomic.AtomicInteger();
        androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            android.webkit.WebView web = new android.webkit.WebView(context);
            reference.set(web);
            web.getSettings().setJavaScriptEnabled(true);
            web.getSettings().setBlockNetworkLoads(true);
            androidx.webkit.WebViewAssetLoader.AssetsPathHandler packaged = new androidx.webkit.WebViewAssetLoader.AssetsPathHandler(context);
            androidx.webkit.WebViewAssetLoader loader = new androidx.webkit.WebViewAssetLoader.Builder()
                .addPathHandler("/offline/", path -> packaged.handle("offline/" + path)).build();
            web.setWebViewClient(new android.webkit.WebViewClient() {
                @Override public android.webkit.WebResourceResponse shouldInterceptRequest(android.webkit.WebView view, android.webkit.WebResourceRequest request) {
                    if (!"appassets.androidplatform.net".equals(request.getUrl().getHost())) remoteRequests.incrementAndGet();
                    return loader.shouldInterceptRequest(request.getUrl());
                }
            });
            androidx.webkit.WebViewCompat.addWebMessageListener(web, "TrinityOffline", java.util.Collections.singleton(OfflinePolicy.LOCAL_ORIGIN), (view, message, origin, mainFrame, reply) -> {
                try {
                    JSONObject request = new JSONObject(message.getData());
                    reply.postMessage(new JSONObject().put("id", request.getString("id")).put("success", true).put("available", false).toString());
                } catch (Exception error) { throw new RuntimeException(error); }
            });
            web.loadUrl(OfflinePolicy.LOCAL_ORIGIN + OfflinePolicy.LOCAL_PATH);
        });
        try {
            long deadline = System.currentTimeMillis() + 15000;
            boolean ready = false;
            while (System.currentTimeMillis() < deadline && !ready) {
                java.util.concurrent.CountDownLatch callback = new java.util.concurrent.CountDownLatch(1);
                java.util.concurrent.atomic.AtomicReference<String> value = new java.util.concurrent.atomic.AtomicReference<>();
                androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> reference.get().evaluateJavascript(
                    "document.body.innerText.includes('Trinity School') && document.body.innerText.includes('Connect and sign in to load your school information')", result -> { value.set(result); callback.countDown(); }));
                assertTrue("WebView callback timed out", callback.await(3, java.util.concurrent.TimeUnit.SECONDS));
                ready = "true".equals(value.get());
                if (!ready) Thread.sleep(100);
            }
            assertTrue("Packaged reader did not reach its unprepared state", ready);
            assertEquals("Packaged reader must not request remote assets", 0, remoteRequests.get());
        } finally {
            androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> reference.get().destroy());
        }
    }
    @Test public void encryptedCopySurvivesReopenAndRejectsPartialOrCrossAccountWrites() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        OfflineStore store = new OfflineStore(context, "offline-device-fixture.enc");
        store.clear();
        String issuedAt = time(System.currentTimeMillis());
        JSONObject session = new JSONObject().put("schema", 1).put("accountId", "fixture-parent").put("role", "Parent")
            .put("issuedAt", issuedAt).put("expiresAt", time(System.currentTimeMillis() + 86400000L))
            .put("pupilIds", new JSONArray().put("fixture-child"))
            .put("grants", new JSONObject().put("pupils", false).put("dashboard", false).put("timetable", false).put("pupilFields", new JSONArray()).put("dashboardCounts", new JSONArray()));
        JSONObject family = new JSONObject().put("schema", 1).put("accountId", "fixture-parent").put("preparedAt", issuedAt)
            .put("pupils", new JSONArray().put(new JSONObject().put("id", "fixture-child").put("firstName", "PrivateFixtureName")));
        JSONObject bundle = new JSONObject().put("family", family);
        for (String name : new String[]{"banking", "attendance", "results", "fees"}) bundle.put(name, new JSONArray());
        JSONObject snapshot = new JSONObject().put("schema", 1).put("accountId", "fixture-parent").put("role", "Parent").put("capturedAt", issuedAt)
            .put("datasets", new JSONObject().put("parent", new JSONObject().put("preparedAt", issuedAt).put("data", bundle)));
        try {
            store.connect(session); store.save(snapshot);
            byte[] encrypted = Files.readAllBytes(new File(context.getNoBackupFilesDir(), "offline-device-fixture.enc").toPath());
            assertFalse(new String(encrypted, StandardCharsets.UTF_8).contains("PrivateFixtureName"));
            OfflineStore reopened = new OfflineStore(context, "offline-device-fixture.enc");
            assertEquals(snapshot.toString(), reopened.available().getJSONObject("snapshot").toString());
            snapshot.put("accountId", "different-parent");
            try { reopened.save(snapshot); fail("Cross-account write must fail"); } catch (IllegalArgumentException expected) { }
            assertEquals("fixture-parent", reopened.available().getJSONObject("snapshot").getString("accountId"));
            session.put("accountId", "different-parent"); reopened.connect(session);
            assertNull(reopened.available());
        } finally { store.clear(); }
    }
}
