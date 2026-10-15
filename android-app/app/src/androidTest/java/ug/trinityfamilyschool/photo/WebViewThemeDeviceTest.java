package ug.trinityfamilyschool.photo;

import android.os.ParcelFileDescriptor;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Checks the real system configuration -> native theme -> WebView media-query path. */
@RunWith(AndroidJUnit4.class)
public class WebViewThemeDeviceTest {
    private WebView web;

    private String shell(String command) throws Exception {
        try (ParcelFileDescriptor descriptor = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
             java.io.InputStream stream = new ParcelFileDescriptor.AutoCloseInputStream(descriptor)) {
            java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[1024];
            int count;
            while ((count = stream.read(buffer)) != -1) output.write(buffer, 0, count);
            return new String(output.toByteArray(), StandardCharsets.UTF_8).trim();
        }
    }

    private String evaluate(String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> web.evaluateJavascript(script, value -> { result.set(value); latch.countDown(); }));
        assertTrue("WebView did not reply", latch.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private void waitFor(String expression) throws Exception {
        long deadline = System.currentTimeMillis() + 25000;
        while (System.currentTimeMillis() < deadline) {
            if ("true".equals(evaluate("Boolean(" + expression + ")"))) return;
            Thread.sleep(150);
        }
        AtomicReference<String> nativeTheme = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            android.util.TypedValue light = new android.util.TypedValue();
            web.getContext().getTheme().resolveAttribute(android.R.attr.isLightTheme, light, true);
            nativeTheme.set("uiMode=" + web.getResources().getConfiguration().uiMode + ", isLightTheme=" + light.data);
        });
        fail("Theme did not update: " + expression + "; " + nativeTheme.get() + "; "
            + evaluate("JSON.stringify({media:media.matches,dark:document.documentElement.classList.contains('dark'),events:events,preference:preference})"));
    }

    private void waitForPaint() throws Exception {
        // A configuration change and its media-query notifications are delivered during
        // rendering. Polling matches before that frame can consume WebView's transition.
        evaluate("window.fixturePainted=false;requestAnimationFrame(()=>requestAnimationFrame(()=>window.fixturePainted=true))");
        waitFor("window.fixturePainted");
    }

    private void loadFixture(ActivityScenario<MainActivity> scenario) throws Exception {
        scenario.onActivity(activity -> {
            try { Field field = MainActivity.class.getDeclaredField("web"); field.setAccessible(true); web = (WebView) field.get(activity); }
            catch (Exception error) { throw new RuntimeException(error); }
        });
        waitFor("location.protocol==='https:' && document.readyState==='complete'");
        CountDownLatch pageLoaded = new CountDownLatch(1);
        scenario.onActivity(activity -> {
            web.stopLoading();
            // The real site's appearance handshake can finish after launch; set the fixture's
            // native preference only once that handshake has completed.
            AppAppearance.prefs(activity).edit().putString("preference", "system").commit();
            DeviceColors.applyNative(activity);
            // Isolate the theme fixture from live-page redirects, cache interception and service workers.
            web.setWebViewClient(new android.webkit.WebViewClient() {
                @Override public void onPageFinished(WebView view, String url) { pageLoaded.countDown(); }
            });
            web.loadDataWithBaseURL("https://theme-fixture.invalid/",
            "<html><head><meta name='color-scheme' content='light dark'><style>body{background:#fff;color:#000}@media(prefers-color-scheme:dark){body{background:#020617;color:#fff}}</style></head>"
            + "<body><input id='input' value='preserve this'><script>window.themeFixture=true;window.preference='system';window.events=0;"
            + "window.media=matchMedia('(prefers-color-scheme:dark)');window.apply=()=>document.documentElement.classList.toggle('dark',preference==='system'?media.matches:preference==='dark');"
            // Use the same listener API as the application's next-themes provider.
            + "media.addListener(()=>{events++;apply()});apply();</script></body></html>", "text/html", "UTF-8", null);
        });
        assertTrue("Theme fixture did not finish loading", pageLoaded.await(20, TimeUnit.SECONDS));
        waitFor("window.themeFixture");
        // Wait for the fixture's first rendered frame, not only its load callback.
        waitForPaint();
    }

    @Test public void followsDeviceAtLaunchAndWhileOpenWithoutLosingManualChoiceOrInput() throws Exception {
        android.content.Context context = androidx.test.core.app.ApplicationProvider.getApplicationContext();
        android.content.SharedPreferences prefs = AppAppearance.prefs(context);
        boolean hadPreference = prefs.contains("preference");
        String savedPreference = AppAppearance.preference(context);
        String original = shell("cmd uimode night");
        String mode = original.contains("yes") ? "yes" : original.contains("no") ? "no" : original.contains("custom") ? "custom" : "auto";
        try {
            // The device-following test must not inherit an installed user's fixed native palette.
            prefs.edit().putString("preference", "system").commit();
            shell("cmd uimode night yes");
            try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
                loadFixture(scenario);
                waitFor("media.matches && document.documentElement.classList.contains('dark')");
                assertEquals("\"rgb(2, 6, 23)\"", evaluate("getComputedStyle(document.body).backgroundColor"));
                evaluate("window.pageToken=crypto.randomUUID()");
                String token = evaluate("pageToken");
                shell("cmd uimode night no");
                waitForPaint();
                waitFor("!media.matches && !document.documentElement.classList.contains('dark') && events>0");
                assertEquals(token, evaluate("pageToken"));
                assertEquals("\"preserve this\"", evaluate("document.getElementById('input').value"));
                evaluate("preference='light';apply()");
                shell("cmd uimode night yes");
                waitForPaint();
                waitFor("media.matches && !document.documentElement.classList.contains('dark')");
                evaluate("preference='dark';apply()");
                shell("cmd uimode night no");
                waitForPaint();
                waitFor("!media.matches && document.documentElement.classList.contains('dark')");
                evaluate("preference='system';apply()");
                waitFor("!document.documentElement.classList.contains('dark')");
                assertEquals(token, evaluate("pageToken"));
            }
            try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
                loadFixture(scenario);
                waitFor("!media.matches && !document.documentElement.classList.contains('dark')");
                assertEquals("\"rgb(255, 255, 255)\"", evaluate("getComputedStyle(document.body).backgroundColor"));
            }
        } finally {
            android.content.SharedPreferences.Editor edit = prefs.edit();
            if (hadPreference) edit.putString("preference", savedPreference); else edit.remove("preference");
            edit.commit();
            shell("cmd uimode night " + mode);
            TimetableRefresh.request(context);
        }
    }
}
