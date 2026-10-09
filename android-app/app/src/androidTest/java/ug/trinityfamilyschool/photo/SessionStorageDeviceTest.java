package ug.trinityfamilyschool.photo;

import android.content.Context;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Read-only session diagnostics. Never logs identities, credentials, tokens or pupil data. */
public class SessionStorageDeviceTest {
    @Test public void reportWebsiteBootOutcomeWithoutLoggingPrivateData() throws Exception {
        try (androidx.test.core.app.ActivityScenario<MainActivity> scenario=androidx.test.core.app.ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<WebView> view=new AtomicReference<>();
            scenario.onActivity(activity->{try{java.lang.reflect.Field field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);view.set((WebView)field.get(activity));}catch(Exception e){throw new RuntimeException(e);}});
            String result="null";long deadline=System.currentTimeMillis()+45000;
            while(System.currentTimeMillis()<deadline){
                CountDownLatch reply=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();
                InstrumentationRegistry.getInstrumentation().runOnMainSync(()->view.get().evaluateJavascript("JSON.stringify({resolved:performance.getEntriesByName('trinity:auth-resolved').length>0,route:location.pathname,profilePresent:!!localStorage.getItem('trinity_user'),firebaseLocalIdentityPresent:Object.keys(localStorage).some(k=>k.startsWith('firebase:authUser:')&&localStorage.getItem(k)!=='null')})",r->{value.set(r);reply.countDown();}));
                if(reply.await(2,TimeUnit.SECONDS)){result=value.get();if(result!=null&&result.contains("resolved\\\":true"))break;}
                Thread.sleep(250);
            }
            android.util.Log.i("TrinitySessionQA","websiteBoot="+result);
        }
    }
    @Test public void reportPersistentSessionPresenceWithoutReadingTokenValues() throws Exception {
        Context context=ApplicationProvider.getApplicationContext();
        CountDownLatch loaded=new CountDownLatch(1), replied=new CountDownLatch(1);
        AtomicReference<WebView> view=new AtomicReference<>();AtomicReference<String> result=new AtomicReference<>();
        try {
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
                WebView web=new WebView(context);view.set(web);
                web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);
                web.setWebViewClient(new WebViewClient(){@Override public void onPageFinished(WebView w,String url){loaded.countDown();}});
                web.loadDataWithBaseURL(PhotoPolicy.ORIGIN+"/__storage_diagnostics","<html><body>Session storage diagnostic</body></html>","text/html","UTF-8",null);
            });
            assertTrue(loaded.await(20,TimeUnit.SECONDS));
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->view.get().evaluateJavascript(
                "JSON.stringify({profilePresent:!!localStorage.getItem('trinity_user'),firebaseLocalIdentityPresent:Object.keys(localStorage).some(k=>k.startsWith('firebase:authUser:')&&localStorage.getItem(k)!=='null'),autoLockEnabled:localStorage.getItem('trinity_auto_lock')==='true',autoLockAction:localStorage.getItem('trinity_auto_lock_action'),appearancePresent:!!localStorage.getItem('trinity-appearance')})",
                value->{result.set(value);replied.countDown();}));
            assertTrue(replied.await(10,TimeUnit.SECONDS));
            android.util.Log.i("TrinitySessionQA",result.get());
            android.util.Log.i("TrinitySessionQA","nativeOfflineEnvelopePresent="+new OfflineStore(context).sourceFile().exists());
        } finally { InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{if(view.get()!=null)view.get().destroy();}); }
    }
}
