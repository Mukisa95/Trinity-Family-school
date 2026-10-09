package ug.trinityfamilyschool.photo;

import android.content.Context;
import androidx.test.core.app.ApplicationProvider;
import androidx.core.graphics.ColorUtils;
import org.junit.Test;
import static org.junit.Assert.*;

public class DeviceColorsDeviceTest {
    private String evaluate(android.webkit.WebView web,String script) throws Exception {
        java.util.concurrent.CountDownLatch reply=new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.atomic.AtomicReference<String> result=new java.util.concurrent.atomic.AtomicReference<>();
        androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().runOnMainSync(()->web.evaluateJavascript(script,value->{result.set(value);reply.countDown();}));
        assertTrue(reply.await(10,java.util.concurrent.TimeUnit.SECONDS));return result.get();
    }
    @Test public void trustedWebViewBridgeProvidesPaletteAndSavesOnlyAppearancePreference() throws Exception {
        Context context=ApplicationProvider.getApplicationContext();android.content.SharedPreferences prefs=AppAppearance.prefs(context);
        java.util.Map<String,?> original=prefs.getAll();
        try(androidx.test.core.app.ActivityScenario<MainActivity> scenario=androidx.test.core.app.ActivityScenario.launch(MainActivity.class)) {
            java.util.concurrent.atomic.AtomicReference<android.webkit.WebView> view=new java.util.concurrent.atomic.AtomicReference<>();
            scenario.onActivity(activity->{try { java.lang.reflect.Field field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);view.set((android.webkit.WebView)field.get(activity)); }catch(Exception error){throw new RuntimeException(error);}});
            long initialDeadline=System.currentTimeMillis()+25000;
            while(!"true".equals(evaluate(view.get(),"location.protocol==='https:' && document.readyState==='complete' && typeof window.TrinityOffline?.onmessage==='function'"))&&System.currentTimeMillis()<initialDeadline)Thread.sleep(100);
            // Exercise the actual trusted website bridge without changing authentication or its service worker.
            evaluate(view.get(),"window.replies={};window.originalQAReply=TrinityOffline.onmessage;TrinityOffline.onmessage=e=>{const r=JSON.parse(e.data);if(r.id.startsWith('10000000-0000-0000-0000-00000000000'))replies[r.id.endsWith('1')?'palette':r.id.endsWith('2')?'enable':'disable']=r;else originalQAReply?.(e)};const input=document.createElement('input');input.id='device-color-qa-input';input.value='Keep this';input.hidden=true;document.body.appendChild(input)");
            evaluate(view.get(),"TrinityOffline.postMessage(JSON.stringify({id:'10000000-0000-0000-0000-000000000001',action:'deviceColors'}))");
            long deadline=System.currentTimeMillis()+10000;
            while(!"true".equals(evaluate(view.get(),"Boolean(window.replies?.palette)"))&&System.currentTimeMillis()<deadline)Thread.sleep(100);
            assertEquals("true",evaluate(view.get(),"replies.palette.success"));
            assertEquals(String.valueOf(android.os.Build.VERSION.SDK_INT>=31),evaluate(view.get(),"replies.palette.palette.supported"));
            evaluate(view.get(),"TrinityOffline.postMessage(JSON.stringify({id:'10000000-0000-0000-0000-000000000002',action:'appearance',deviceColors:true,dark:document.documentElement.classList.contains('dark')}))");
            deadline=System.currentTimeMillis()+10000;
            while(!"true".equals(evaluate(view.get(),"Boolean(replies.enable)"))&&System.currentTimeMillis()<deadline)Thread.sleep(100);
            assertTrue(AppAppearance.deviceColorsEnabled(context));assertEquals("\"Keep this\"",evaluate(view.get(),"document.getElementById('device-color-qa-input').value"));
            evaluate(view.get(),"TrinityOffline.postMessage(JSON.stringify({id:'10000000-0000-0000-0000-000000000003',action:'appearance',deviceColors:false,dark:document.documentElement.classList.contains('dark')}))");
            deadline=System.currentTimeMillis()+10000;
            while(!"true".equals(evaluate(view.get(),"Boolean(replies.disable)"))&&System.currentTimeMillis()<deadline)Thread.sleep(100);
            assertFalse(AppAppearance.deviceColorsEnabled(context));
        }finally {
            android.content.SharedPreferences.Editor edit=prefs.edit();
            if(original.containsKey("deviceColors"))edit.putBoolean("deviceColors",(Boolean)original.get("deviceColors"));else edit.remove("deviceColors");
            if(original.containsKey("preference"))edit.putString("preference",(String)original.get("preference"));else edit.remove("preference");
            edit.commit();TimetableRefresh.request(context);
        }
    }
    @Test public void publicSystemPaletteHasReadablePairedRolesAndCanBeUsedOffline() throws Exception {
        Context context=ApplicationProvider.getApplicationContext();DeviceColors palette=DeviceColors.read(context);
        if(android.os.Build.VERSION.SDK_INT<31){assertNull(palette);assertFalse(DeviceColors.status(context).getBoolean("supported"));return;}
        assertNotNull(palette);assertTrue(DeviceColors.status(context).getBoolean("supported"));
        assertEquals(5,palette.json().getJSONObject("palettes").length());
        for(boolean dark:new boolean[]{false,true}) {
            for(String[] pair:new String[][]{{"foreground","surface"},{"mutedForeground","surface"},{"primary","surface"},{"onPrimary","primary"},{"onPrimaryContainer","primaryContainer"}})
                assertTrue(pair[0]+" needs 4.5:1 text contrast",ColorUtils.calculateContrast(palette.role(pair[0],dark),palette.role(pair[1],dark))>=4.5);
        }
        java.io.File file=new java.io.File(context.getExternalFilesDir(null),"device-colors-qa.json");
        try(java.io.FileOutputStream output=new java.io.FileOutputStream(file)){output.write(palette.json().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}
    }
}
