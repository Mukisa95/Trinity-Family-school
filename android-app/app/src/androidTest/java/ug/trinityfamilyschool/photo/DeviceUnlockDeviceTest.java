package ug.trinityfamilyschool.photo;

import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import org.junit.Test;
import static org.junit.Assert.*;
import java.lang.reflect.Field;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Real WebView and system-prompt checks; fixtures do not modify account data or settings. */
public class DeviceUnlockDeviceTest {
    private WebView web;
    private String shell(String command) throws Exception {
        try (android.os.ParcelFileDescriptor descriptor = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
             java.io.InputStream input = new android.os.ParcelFileDescriptor.AutoCloseInputStream(descriptor)) {
            java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[1024]; int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString("UTF-8").trim();
        }
    }
    private String evaluate(String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1); AtomicReference<String> result = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> web.evaluateJavascript(script, value -> { result.set(value); latch.countDown(); }));
        assertTrue(latch.await(10, TimeUnit.SECONDS)); return result.get();
    }
    private void waitFor(String expression, long timeout) throws Exception {
        long end = System.currentTimeMillis() + timeout;
        while (System.currentTimeMillis() < end) {
            if ("true".equals(evaluate("Boolean(" + expression + ")"))) return;
            Thread.sleep(150);
        }
        fail("Device unlock fixture timed out: " + expression);
    }
    private void fixture(ActivityScenario<MainActivity> scenario, String origin, String content) throws Exception {
        scenario.onActivity(activity -> {
            try { Field field = MainActivity.class.getDeclaredField("web"); field.setAccessible(true); web = (WebView) field.get(activity); }
            catch (Exception error) { throw new RuntimeException(error); }
        });
        // Complete the native session restore before taking over this document.
        if (!"true".equals(evaluate("location.pathname==='/__unlock_fixture'")))
            waitFor("location.protocol==='https:' && document.readyState==='complete'", 45000);
        if (PhotoPolicy.ORIGIN.equals(origin)) {
            if (!"true".equals(evaluate("location.origin==='" + origin + "'"))) {
                scenario.onActivity(activity -> web.loadUrl(origin + "/login"));
                waitFor("location.origin==='" + origin + "' && document.readyState==='complete'", 45000);
            }
            // Keep the actual trusted document, including the WebView's real navigation URL.
            // Only transient test variables are added; account storage is untouched.
            evaluate("window.unlockFixture=true;" + content);
            return;
        }
        scenario.onActivity(activity -> {
            web.stopLoading();
            String html = "<html><meta name='viewport' content='width=device-width,initial-scale=1'><body><h1>Device unlock verification</h1><script>window.unlockFixture=true;" + content + "</script></body></html>";
            java.util.function.Supplier<android.webkit.WebResourceResponse> response = () -> new android.webkit.WebResourceResponse("text/html", "UTF-8", new java.io.ByteArrayInputStream(html.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            android.webkit.WebViewClient original = web.getWebViewClient();
            web.setWebViewClient(new android.webkit.WebViewClient() {
                @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) { original.onPageStarted(view, url, favicon); }
                @Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, android.webkit.WebResourceRequest request) {
                    return "/__unlock_fixture".equals(request.getUrl().getPath()) ? response.get() : original.shouldInterceptRequest(view, request);
                }
            });
            web.loadUrl(origin + "/__unlock_fixture");
        });
        waitFor("window.unlockFixture", 15000);
    }
    private String listener() {
        return "window.unlockReply=null;TrinityDeviceUnlock.onmessage=e=>window.unlockReply=JSON.parse(e.data);";
    }
    @Test public void nativeCapabilitiesAndWebAuthenticationAreEnabled() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            fixture(scenario, PhotoPolicy.ORIGIN, listener()+"TrinityDeviceUnlock.postMessage(JSON.stringify({id:crypto.randomUUID(),action:'status'}));");
            waitFor("unlockReply && unlockReply.ok", 10000);
            assertEquals("true", evaluate("unlockReply.supported"));
            scenario.onActivity(activity -> {
                assertTrue("Update Android System WebView to test passkeys", WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION));
                assertEquals(WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP, WebSettingsCompat.getWebAuthenticationSupport(web.getSettings()));
            });
            assertEquals("true", evaluate("typeof PublicKeyCredential!=='undefined' && typeof navigator.credentials.create==='function'"));
        }
    }
    @Test public void otherSchoolsAndFramesCannotRequestNativeUnlock() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            String other = PhotoPolicy.ORIGIN.contains("trinityfamilyganda") ? "https://trinityfamilyschool.vercel.app" : "https://trinityfamilyganda.vercel.app";
            fixture(scenario, other, "");
            assertEquals("false", evaluate("Boolean(window.TrinityDeviceUnlock)"));
            fixture(scenario, PhotoPolicy.ORIGIN, "window.frameReplied=false;const frame=document.createElement('iframe');frame.srcdoc='<script>TrinityDeviceUnlock.onmessage=()=>parent.frameReplied=true;TrinityDeviceUnlock.postMessage(JSON.stringify({id:crypto.randomUUID(),action:\"status\"}));<'+ '/script>';document.body.append(frame);");
            Thread.sleep(800);
            assertEquals("false", evaluate("frameReplied"));
        }
    }
    @Test public void cancelledPromptNeverUnlocksTheSession() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            fixture(scenario, PhotoPolicy.ORIGIN, "window.authId=crypto.randomUUID();window.unlockReply=null;TrinityDeviceUnlock.onmessage=e=>{const reply=JSON.parse(e.data);if(reply.id===authId)window.unlockReply=reply;};");
            evaluate("TrinityDeviceUnlock.postMessage(JSON.stringify({id:authId,action:'authenticate',userId:'unlock-qa'}))");
            Thread.sleep(1200);
            evaluate("TrinityDeviceUnlock.postMessage(JSON.stringify({id:crypto.randomUUID(),action:'cancel'}))");
            // Keep the authentication response separately from the cancellation acknowledgement.
            waitFor("unlockReply", 10000);
            assertEquals("false", evaluate("unlockReply.ok"));
        }
    }
    @Test public void manualFingerprintOrPinUnlocksWithoutAnAccountOrNetworkRequest() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            fixture(scenario, PhotoPolicy.ORIGIN, listener());
            String wifi = shell("settings get global wifi_on"), mobile = shell("settings get global mobile_data");
            String airplane = shell("settings get global airplane_mode_on");
            try {
                shell("cmd connectivity airplane-mode enable");
                shell("svc wifi disable"); shell("svc data disable");
                android.net.ConnectivityManager connectivity = (android.net.ConnectivityManager) InstrumentationRegistry.getInstrumentation().getTargetContext().getSystemService(android.content.Context.CONNECTIVITY_SERVICE);
                long deadline = System.currentTimeMillis() + 10000;
                while (connectivity.getActiveNetwork() != null && System.currentTimeMillis() < deadline) Thread.sleep(100);
                assertNull("The phone must be offline before opening the unlock prompt", connectivity.getActiveNetwork());
                evaluate("TrinityDeviceUnlock.postMessage(JSON.stringify({id:crypto.randomUUID(),action:'authenticate',userId:'unlock-qa'}))");
                android.util.Log.i("TrinityUnlockQA", "Verify using the Android fingerprint, face or PIN prompt on the phone. Wi-Fi and mobile data are off; no school account is changed.");
                waitFor("unlockReply", 120000);
                assertEquals("true", evaluate("unlockReply.ok && unlockReply.userId==='unlock-qa'"));
            } finally {
                shell("cmd connectivity airplane-mode " + ("1".equals(airplane) ? "enable" : "disable"));
                shell("svc wifi " + ("1".equals(wifi) ? "enable" : "disable"));
                shell("svc data " + ("1".equals(mobile) ? "enable" : "disable"));
            }
        }
    }
}
