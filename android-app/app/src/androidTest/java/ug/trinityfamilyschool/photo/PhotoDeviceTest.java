package ug.trinityfamilyschool.photo;

import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.lang.reflect.Field;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Opt-in physical-device checks; no school login or pupil record is needed. */
@RunWith(AndroidJUnit4.class)
public class PhotoDeviceTest {
    private WebView web;
    private String evaluate(String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> web.evaluateJavascript(script, result -> { value.set(result); latch.countDown(); }));
        assertTrue("WebView reply timed out", latch.await(10, TimeUnit.SECONDS));
        return value.get();
    }
    private void waitFor(String expression, int seconds) throws Exception {
        long deadline = System.currentTimeMillis() + seconds * 1000L;
        while (System.currentTimeMillis() < deadline) {
            if ("true".equals(evaluate("Boolean(" + expression + ")"))) return;
            Thread.sleep(250);
        }
        fail("Timed out: " + expression + "; state=" + evaluate("JSON.stringify({text:document.body.innerText,bridge:typeof window.TrinityPhoto,href:location.href,origin:location.origin,error:window.testError})"));
    }
    private void load(ActivityScenario<MainActivity> scenario, String origin) throws Exception {
        // Finish the async encrypted-session startup before taking over the test WebView.
        scenario.onActivity(activity -> {
            try { Field field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);web=(WebView)field.get(activity); }
            catch(Exception error){throw new RuntimeException(error);}
        });
        if (!"true".equals(evaluate("location.pathname==='/__device_photo_test'")))
            waitFor("location.protocol==='https:' && document.readyState==='complete'",25);
        scenario.onActivity(activity -> {
            try {
                Field field = MainActivity.class.getDeclaredField("web"); field.setAccessible(true); web = (WebView) field.get(activity);
                web.stopLoading();
                String html = "<html><meta name='viewport' content='width=device-width,initial-scale=1'><body style='font:18px sans-serif;padding:20px'><h2>Trinity photo test</h2><p id='status'>Checking cameras…</p><img id='photo' style='width:100%;max-height:50vh;object-fit:contain'><script>"
                    + "window.onerror=(message)=>window.testError=message;window.replies=[]; window.cameraResponse=null;"
                    + "if(window.TrinityPhoto){TrinityPhoto.onmessage=async function(event){const r=JSON.parse(event.data);replies.push(r);"
                    + "if(r.cameras){cameraResponse=r;document.getElementById('status').textContent='Camera bridge ready';}"
                    + "if(r.photoUrl){try{const response=await fetch(r.photoUrl,{cache:'no-store'});const blob=await response.blob();window.photoBytes=blob.size;const image=new Image();image.onload=()=>{window.dimensions=[image.naturalWidth,image.naturalHeight];};image.src=URL.createObjectURL(blob);document.getElementById('photo').src=image.src;const reader=new FileReader();reader.onload=()=>{window.photoData=reader.result;document.getElementById('status').textContent='Full-size photo received';};reader.readAsDataURL(blob);}catch(e){document.getElementById('status').textContent=String(e)}}"
                    + "if(r.error)document.getElementById('status').textContent=r.error;};"
                    + "TrinityPhoto.postMessage(JSON.stringify({id:'00000000-0000-0000-0000-000000000001',action:'cameras'}));}"
                    + "</script></body></html>";
                WebViewClient original = web.getWebViewClient();
                // Existing school service workers may own this URL before WebViewClient sees it.
                // Intercept only the fixture URL in both paths; leave real app/photo requests alone.
                if (androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
                    androidx.webkit.ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new androidx.webkit.ServiceWorkerClientCompat() {
                        @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                            if (request.getUrl().toString().equals(origin + "/__device_photo_test")) return new WebResourceResponse("text/html", "UTF-8", new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8)));
                            return original.shouldInterceptRequest(web, request);
                        }
                    });
                }
                web.setWebViewClient(new WebViewClient() {
                    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                        if (request.getUrl().toString().equals(origin + "/__device_photo_test")) return new WebResourceResponse("text/html", "UTF-8", new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8)));
                        return original.shouldInterceptRequest(view, request);
                    }
                });
                web.loadUrl(origin + "/__device_photo_test");
            } catch (Exception error) { throw new RuntimeException(error); }
        });
    }

    @Test public void trustedMainFrameAndCameraDiscovery() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            load(scenario, PhotoPolicy.ORIGIN);
            waitFor("window.cameraResponse", 25);
            assertEquals("1", evaluate("cameraResponse.apiVersion"));
            assertEquals("true", evaluate("cameraResponse.cameras.length>0"));
            evaluate("(()=>{window.iframeReply=false;window.addEventListener('message',e=>{if(e.data==='iframe-reply')window.iframeReply=true});const iframe=document.createElement('iframe');iframe.srcdoc=\"<script>if(window.TrinityPhoto){TrinityPhoto.onmessage=()=>parent.postMessage('iframe-reply','*');TrinityPhoto.postMessage(JSON.stringify({id:'00000000-0000-0000-0000-000000000099',action:'cameras'}));}<\\/script>\";document.body.append(iframe);})()");
            Thread.sleep(1500);
            assertEquals("false", evaluate("window.iframeReply"));
            load(scenario, "https://untrusted.invalid");
            waitFor("location.origin==='https://untrusted.invalid'&&document.readyState==='complete'", 10);
            assertEquals("\"undefined\"", evaluate("typeof window.TrinityPhoto"));
        }
    }

    // Run separately with the operator ready to take and confirm a test photo.
    @Test public void operatorCameraCaptureAndEditorShare() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            load(scenario, PhotoPolicy.ORIGIN);
            waitFor("window.cameraResponse", 25);
            evaluate("TrinityPhoto.postMessage(JSON.stringify({id:'00000000-0000-0000-0000-000000000002',action:'capture',cameraId:cameraResponse.cameras[0].id}))");
            waitFor("window.photoData&&window.dimensions", 180);
            assertEquals("true", evaluate("photoBytes>0&&dimensions[0]>=500&&dimensions[1]>=500"));
            evaluate("TrinityPhoto.postMessage(JSON.stringify({id:'00000000-0000-0000-0000-000000000003',action:'share',dataUrl:photoData}))");
            waitFor("replies.some(r=>r.id==='00000000-0000-0000-0000-000000000003'&&r.ok)", 20);
            // Leave the chooser available briefly so the operator can open Snapseed.
            Thread.sleep(15000);
        }
    }
}
