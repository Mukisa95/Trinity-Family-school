package ug.trinityfamilyschool.photo;

import android.app.NotificationManager;
import android.content.Context;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.view.accessibility.AccessibilityNodeInfo;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Synthetic documents only: real SAF storage, native bridge, background service and notification. */
@RunWith(AndroidJUnit4.class)
public class DocumentFilesDeviceTest {
    private WebView web;
    private byte[] expectedPDF;
    private final Context context = ApplicationProvider.getApplicationContext();
    private String evaluate(String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1); AtomicReference<String> value = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> web.evaluateJavascript(script, result -> {value.set(result);latch.countDown();}));
        assertTrue("WebView did not reply", latch.await(15,TimeUnit.SECONDS));return value.get();
    }
    private void waitFor(String expression) throws Exception {
        long deadline=System.currentTimeMillis()+30000;
        while(System.currentTimeMillis()<deadline){if("true".equals(evaluate("Boolean("+expression+")")))return;Thread.sleep(200);}
        fail("Fixture did not reach "+expression+": "+evaluate("JSON.stringify({state:window.testState,error:window.testError,url:location.href})"));
    }
    private boolean clickText(String needle) {
        AccessibilityNodeInfo root=InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();
        return click(root,needle);
    }
    private boolean click(AccessibilityNodeInfo node,String text){
        if(node==null)return false;
        if(node.getText()!=null&&node.getText().toString().equalsIgnoreCase(text)){
            AccessibilityNodeInfo target=node;
            while(target!=null){if(target.isClickable()&&target.isEnabled())return target.performAction(AccessibilityNodeInfo.ACTION_CLICK);target=target.getParent();}
        }
        for(int i=0;i<node.getChildCount();i++)if(click(node.getChild(i),text))return true;
        return false;
    }
    private void fixture(ActivityScenario<MainActivity> scenario) throws Exception {
        CountDownLatch loaded=new CountDownLatch(1);
        scenario.onActivity(activity->{try{
            Field field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);web=(WebView)field.get(activity);web.stopLoading();
            web.setWebViewClient(new WebViewClient(){@Override public void onPageFinished(WebView view,String url){loaded.countDown();}});
            web.loadDataWithBaseURL(PhotoPolicy.ORIGIN+"/__document_test/","<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><p>Synthetic document check</p>","text/html","UTF-8",null);
        }catch(Exception error){throw new RuntimeException(error);}});
        assertTrue(loaded.await(20,TimeUnit.SECONDS));waitFor("window.trinityFiles");
    }
    private void start(String id,String name) throws Exception {
        evaluate("window.testState='preparing';window.testError='';window.trinityFiles.start({jobId:'"+id+"',title:'Document device check',fileName:'"+name+"'}).then(()=>window.testState='started').catch(error=>window.testError=error.message)");
        long deadline=System.currentTimeMillis()+25000;
        while(System.currentTimeMillis()<deadline){
            if("\"started\"".equals(evaluate("window.testState")))return;
            clickText("Use this folder");Thread.sleep(250);clickText("Allow");Thread.sleep(250);
        }
        waitFor("testState==='started'");
    }
    private void completeAfterDelay(String id,String name) throws Exception {
        String data=android.util.Base64.encodeToString(expectedPDF,android.util.Base64.NO_WRAP);
        evaluate("setTimeout(async()=>{try{const bytes=Uint8Array.from(atob('"+data+"'),c=>c.charCodeAt(0));const blob=new Blob([bytes],{type:'application/pdf'});await trinityFiles.complete('"+id+"',blob,'"+name+"');window.testState='complete';}catch(error){window.testError=error.message;}},2500)");
    }
    private void assertSaved(String id) throws Exception {
        DocumentWork work=DocumentWork.get(context);long deadline=System.currentTimeMillis()+30000;
        while(System.currentTimeMillis()<deadline&&work.jobs.containsKey(id))Thread.sleep(200);
        assertFalse("Background job did not complete",work.jobs.containsKey(id));
        String uri=work.store.metadata(id).optString("uri");assertFalse("Document was not saved to SAF",uri.isEmpty());
        try(java.io.InputStream input=context.getContentResolver().openInputStream(Uri.parse(uri))){
            java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[4096];int count;
            while((count=input.read(buffer))!=-1)output.write(buffer,0,count);
            assertArrayEquals(expectedPDF,output.toByteArray());
        }
        try(android.os.ParcelFileDescriptor file=context.getContentResolver().openFileDescriptor(Uri.parse(uri),"r");android.graphics.pdf.PdfRenderer renderer=new android.graphics.pdf.PdfRenderer(file)){assertEquals(1,renderer.getPageCount());}
        boolean notified=false;
        for(android.service.notification.StatusBarNotification item:((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).getActiveNotifications())
            if(DocumentWork.CHANNEL.equals(item.getNotification().getChannelId())&&"Saved in Trinity Files".contentEquals(item.getNotification().extras.getCharSequence("android.text",""))){assertNotNull(item.getNotification().contentIntent);notified=true;}
        assertTrue("Android completion notification was not posted",notified);
    }
    @Test public void savesAndNotifiesAfterHomeAndActivityDestruction() throws Exception {
        DocumentWork work=DocumentWork.get(context);List<String> ids=new ArrayList<>();
        String originalTree=work.store.prefs.getString("tree",null),originalFolder=work.store.prefs.getString("folder",null);
        android.graphics.pdf.PdfDocument document=new android.graphics.pdf.PdfDocument();
        try(java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream()){
            android.graphics.pdf.PdfDocument.Page page=document.startPage(new android.graphics.pdf.PdfDocument.PageInfo.Builder(595,842,1).create());
            page.getCanvas().drawText("Synthetic Trinity document. No school records.",30,60,new android.graphics.Paint());document.finishPage(page);document.writeTo(output);expectedPDF=output.toByteArray();
        }finally{document.close();}
        try {
            try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
                fixture(scenario);String id=UUID.randomUUID().toString();ids.add(id);start(id,"Trinity QA home.pdf");
                assertFalse(work.jobs.isEmpty());completeAfterDelay(id,"Trinity QA home.pdf");
                InstrumentationRegistry.getInstrumentation().getUiAutomation().performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME);
                assertSaved(id);
            }
            try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
                fixture(scenario);String id=UUID.randomUUID().toString();ids.add(id);start(id,"Trinity QA closed.pdf");completeAfterDelay(id,"Trinity QA closed.pdf");
                scenario.close();assertSaved(id);
            }
        } finally {
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{for(String id:ids)work.cancel(id,web);});
            for(String id:ids){String uri=work.store.metadata(id).optString("uri");if(!uri.isEmpty())DocumentsContract.deleteDocument(context.getContentResolver(),Uri.parse(uri));work.store.complete(id).delete();work.store.part(id).delete();work.store.prefs.edit().remove("file-"+id).commit();}
            android.content.SharedPreferences.Editor prefs=work.store.prefs.edit();if(originalTree==null)prefs.remove("tree");else prefs.putString("tree",originalTree);if(originalFolder==null)prefs.remove("folder");else prefs.putString("folder",originalFolder);prefs.commit();
            NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
            for(android.service.notification.StatusBarNotification item:manager.getActiveNotifications())if(DocumentWork.CHANNEL.equals(item.getNotification().getChannelId()))manager.cancel(item.getId());
        }
    }
}
