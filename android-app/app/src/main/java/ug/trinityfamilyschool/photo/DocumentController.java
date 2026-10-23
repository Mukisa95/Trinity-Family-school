package ug.trinityfamilyschool.photo;

import android.app.Activity;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.provider.DocumentsContract;
import android.webkit.*;
import androidx.webkit.*;
import org.json.*;
import java.io.*;
import java.lang.ref.WeakReference;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

/** Main-frame, school-origin-only document bridge. No storage paths come from JavaScript. */
final class DocumentController {
    static final int FOLDER_RESULT = 84;
    private final WebView web;
    private final WeakReference<Activity> activity;
    private final DocumentWork work;
    private final String script;
    private volatile long page;
    private final AtomicInteger queued = new AtomicInteger();
    private final Map<String, Upload> uploads = new HashMap<>(); // work.io only
    private final Set<String> ownedFiles = new HashSet<>(); // work.io only
    private final List<Runnable> folderWaiters = new ArrayList<>();
    private final List<Runnable> folderCancelled = new ArrayList<>();
    private boolean choosing;
    private boolean visible;
    private final boolean supported;
    private static final class Upload {
        final String id, name, mime, jobId; final long expected; final File file; final OutputStream output;
        int sequence; long written;
        Upload(String id,String name,String jobId,long expected,File file) throws Exception { this.id=id;this.name=name;this.mime=DocumentPolicy.mime(name);this.jobId=jobId;this.expected=expected;this.file=file;output=new FileOutputStream(file); }
    }
    DocumentController(Activity activity,WebView web) {
        this.web=web;this.activity=new WeakReference<>(activity);work=DocumentWork.get(activity);
        String source="";
        try(InputStream input=activity.getResources().openRawResource(R.raw.document_bridge);ByteArrayOutputStream output=new ByteArrayOutputStream()) {byte[] b=new byte[8192];int n;while((n=input.read(b))!=-1)output.write(b,0,n);source=output.toString("UTF-8");}catch(Exception ignored){}
        script=source;
        supported=!script.isEmpty()&&WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER);
        if(supported) {
            WebViewCompat.addWebMessageListener(web,"TrinityDocuments",Collections.singleton(PhotoPolicy.ORIGIN),(view,message,origin,mainFrame,reply)->{
                if(!mainFrame||!PhotoPolicy.trusted(origin.toString())||!PhotoPolicy.trusted(view.getUrl()))return;
                String text=message.getData();if(text==null||text.length()>150000)return;
                JSONObject input=null;try {input=new JSONObject(text);if(!PhotoPolicy.validId(input.optString("id")))return;handle(input,reply);}catch(Exception error){if(input!=null)reply(reply,input.optString("id"),null,error,page);}
            });
            if(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) WebViewCompat.addDocumentStartJavaScript(web,script,Collections.singleton(PhotoPolicy.ORIGIN));
        }
    }
    void installed() { if(PhotoPolicy.trusted(web.getUrl()))web.evaluateJavascript(script,null); }
    boolean supported(){return supported;}
    void pageChanged() {page++;work.cancelOwner(web);}
    void visible(boolean value) {if(visible==value)return;visible=value;work.visible=Math.max(0,work.visible+(value?1:-1));}
    private void reply(JavaScriptReplyProxy reply,String id,JSONObject result,Exception error,long revision) {
        work.main.post(()->{if(page!=revision||!PhotoPolicy.trusted(web.getUrl())||!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))return;try{JSONObject value=result==null?new JSONObject():result;value.put("id",id).put("ok",error==null);if(error!=null)value.put("error",error.getMessage()==null?"Unable to save this document. Try again.":error.getMessage());reply.postMessage(value.toString());}catch(Exception ignored){}});
    }
    private void handle(JSONObject input,JavaScriptReplyProxy response) throws Exception {
        String id=input.getString("id"),action=input.optString("action"),jobId=input.optString("jobId");long revision=page;
        if("prepare".equals(action)) {prepare(()->reply(response,id,null,null,revision),()->reply(response,id,null,new IOException("Choose a folder for Trinity Files to save documents."),revision));return;}
        if("notice".equals(action)){Activity screen=activity.get();if(screen!=null)android.widget.Toast.makeText(screen,input.optString("message","Unable to save the document."),android.widget.Toast.LENGTH_LONG).show();reply(response,id,null,null,revision);return;}
        if("start".equals(action)) {
            String name=DocumentPolicy.fileName(input.optString("fileName"));
            work.start(jobId,input.optString("title",name),web);bindCleanup(jobId);reply(response,id,null,null,revision);return;
        }
        if("progress".equals(action)) {work.progress(jobId,web,input.optInt("progress"),input.optString("message","Creating document"));reply(response,id,null,null,revision);return;}
        if("cancel".equals(action)) {
            if(work.owns(jobId,web)&&!input.optString("error").isEmpty())work.fail(jobId,"Unable to create the document. Open it and try again.");else work.cancel(jobId,web);
            final String cancelledId=jobId;work.io.execute(()->cleanupJob(cancelledId));reply(response,id,null,null,revision);return;
        }
        if("begin".equals(action)) {
            DocumentPolicy.size(input.optLong("bytes"));DocumentPolicy.fileName(input.optString("fileName"));
            if(jobId.isEmpty()){jobId=input.optString("fileId");input.put("jobId",jobId);work.start(jobId,"Saving "+input.optString("fileName"),web);bindCleanup(jobId);}
            else if(!work.owns(jobId,web))throw new IllegalArgumentException("This document job has ended. Try again.");
        }
        if(queued.incrementAndGet()>16){queued.decrementAndGet();reply(response,id,null,new IOException("Please wait for the current file transfer."),revision);return;}
        work.io.execute(()->{
            try {
                if(page!=revision)throw new IOException("The document page closed.");
                JSONObject result=process(input);
                reply(response,id,result,null,revision);
            }catch(Exception error){
                String fileId=input.optString("fileId");Upload upload=removeUpload(fileId);
                if(upload!=null){try{upload.output.close();}catch(Exception ignored){}upload.file.delete();work.main.post(()->work.fail(upload.jobId,"The document could not be saved. Open it and try again."));}
                else {String failedJob=input.optString("jobId",fileId);work.main.post(()->{if(work.owns(failedJob,web))work.fail(failedJob,"The document could not be saved. Open it and try again.");});}
                reply(response,id,null,error,revision);
            }finally{queued.decrementAndGet();}
        });
    }
    private JSONObject process(JSONObject input) throws Exception {
        String action=input.optString("action"),id=input.optString("fileId");
        if("status".equals(action))return new JSONObject().put("supported",true).put("folderConfigured",work.store.folder()!=null);
        if(!PhotoPolicy.validId(id))throw new IllegalArgumentException("Invalid document identifier.");
        if("reuse".equals(action)) {
            if(!ownedFiles.contains(id))throw new IOException("Download the document again to save it.");
            JSONObject data=work.store.metadata(id);File file=work.store.complete(id);
            Uri uri=work.store.save(id,data.getString("fileName"),data.getString("mime"),file);
            work.main.post(()->{Activity screen=activity.get();if(visible&&screen!=null)android.widget.Toast.makeText(screen,"Saved in Trinity Files",android.widget.Toast.LENGTH_SHORT).show();});
            return new JSONObject().put("saved",uri!=null);
        }
        if("begin".equals(action)) {
            long bytes=input.getLong("bytes");DocumentPolicy.size(bytes);
            String job=input.getString("jobId");if(!work.owns(job,web))throw new IOException("This document job has ended.");
            if(uploads.containsKey(id)||uploads.size()>=4)throw new IOException("Wait for the other file transfers to finish.");
            long total=bytes+work.activeBytes;
            if(total>DocumentPolicy.MAX_ACTIVE_BYTES)throw new IOException("Save fewer large documents at a time.");
            String name=DocumentPolicy.fileName(input.getString("fileName"));
            if(work.activeFiles.contains(id))throw new IOException("This file is already being saved.");
            Upload upload=new Upload(id,name,job,bytes,work.store.part(id));uploads.put(id,upload);ownedFiles.add(id);work.activeFiles.add(id);work.activeBytes+=bytes;
            work.store.prune(work.activeFiles);return new JSONObject();
        }
        Upload upload=uploads.get(id);
        if(upload==null||!work.owns(upload.jobId,web))throw new IOException("This file transfer has ended. Try saving again.");
        if("chunk".equals(action)) {
            String encoded=input.getString("data");if(encoded.length()>DocumentPolicy.CHUNK_BYTES*4/3+4||!encoded.matches("[A-Za-z0-9+/]+={0,2}"))throw new IOException("Invalid document chunk.");
            byte[] bytes=android.util.Base64.decode(encoded,android.util.Base64.NO_WRAP);
            DocumentPolicy.chunk(upload.sequence,input.getInt("sequence"),upload.written,bytes.length,upload.expected);
            upload.output.write(bytes);upload.written+=bytes.length;upload.sequence++;return new JSONObject();
        }
        if(!"commit".equals(action)||upload.written!=upload.expected)throw new IOException("The document transfer was incomplete. Try saving again.");
        upload.output.close();
        if("application/pdf".equals(upload.mime))try(InputStream inputFile=new FileInputStream(upload.file)){byte[] header=new byte[5];if(inputFile.read(header)!=5||!Arrays.equals(header,new byte[]{37,80,68,70,45}))throw new IOException("The generated PDF is invalid. Please create it again.");}
        File completed=work.store.complete(id);if(completed.exists())completed.delete();
        if(!upload.file.renameTo(completed))throw new IOException("Unable to finish the document transfer.");
        removeUpload(id);
        if(!work.store.prefs.edit().putString("file-"+id,new JSONObject().put("fileName",upload.name).put("mime",upload.mime).toString()).commit())throw new IOException("Unable to remember this document. Check your phone's free space and try again.");
        boolean saved;Uri uri;
        try{uri=work.store.save(id,upload.name,upload.mime,completed,()->work.owns(upload.jobId,web));saved=true;}catch(Exception error){uri=work.store.readable(id);saved=false;}
        final Uri resultUri=uri;final boolean resultSaved=saved;
        work.main.post(()->{work.finish(upload.jobId,web,upload.name,upload.mime,resultUri,resultSaved);if(resultSaved&&visible){Activity screen=activity.get();if(screen!=null)android.widget.Toast.makeText(screen,"Saved in Trinity Files",android.widget.Toast.LENGTH_SHORT).show();}});
        return new JSONObject().put("saved",saved);
    }
    private void cleanupJob(String job) {
        for(Upload upload:new ArrayList<>(uploads.values()))if(job.equals(upload.jobId)){removeUpload(upload.id);try{upload.output.close();}catch(Exception ignored){}upload.file.delete();}
    }
    private Upload removeUpload(String id){Upload upload=uploads.remove(id);if(upload!=null){work.activeFiles.remove(id);work.activeBytes-=upload.expected;}return upload;}
    private void bindCleanup(String id){DocumentWork.Job job=work.jobs.get(id);if(job!=null)job.cleanup=()->work.io.execute(()->cleanupJob(id));}
    private void prepare(Runnable success,Runnable cancelled) {
        long revision=page;
        work.io.execute(()->{boolean configured=work.store.folder()!=null;work.main.post(()->{
            if(page!=revision){cancelled.run();return;}
            if(configured){permission();success.run();return;}
            Activity screen=activity.get();if(screen==null||screen.isDestroyed()){cancelled.run();return;}
            folderWaiters.add(success);folderCancelled.add(cancelled);if(choosing)return;choosing=true;
            Intent picker=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
            picker.putExtra(DocumentsContract.EXTRA_INITIAL_URI,Uri.parse("content://com.android.externalstorage.documents/document/primary%3ADocuments"));
            android.widget.Toast.makeText(screen,"Choose Documents once. Trinity Files will be created inside it.",android.widget.Toast.LENGTH_LONG).show();
            try{screen.startActivityForResult(picker,FOLDER_RESULT);}catch(Exception error){finishFolder(false);}
        });});
    }
    void folderResult(int result,Intent data) {
        if(!choosing)return;
        work.io.execute(()->{boolean ok=false;try{if(result==Activity.RESULT_OK&&data!=null&&data.getData()!=null){work.store.selectFolder(data.getData(),data.getFlags());ok=true;}}catch(Exception ignored){}
            final boolean accepted=ok;work.main.post(()->finishFolder(accepted));});
    }
    private void finishFolder(boolean ok) {choosing=false;List<Runnable> next=new ArrayList<>(ok?folderWaiters:folderCancelled);folderWaiters.clear();folderCancelled.clear();if(ok)permission();for(Runnable callback:next)callback.run();}
    private void permission() {
        Activity screen=activity.get();if(screen!=null&&Build.VERSION.SDK_INT>=33&&screen.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED&&!work.store.prefs.getBoolean("notificationPrompted",false)){
            work.store.prefs.edit().putBoolean("notificationPrompted",true).apply();screen.requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},73);
        }
    }
    boolean detach() {
        visible(false);activity.clear();finishFolder(false);
        if(!work.active(web)){page++;return false;}
        work.retained.add(web);
        if(web.getParent() instanceof android.view.ViewGroup)((android.view.ViewGroup)web.getParent()).removeView(web);
        if(web.getContext() instanceof MutableContextWrapper)((MutableContextWrapper)web.getContext()).setBaseContext(work.context);
        web.setWebChromeClient(null);
        web.setDownloadListener(null);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return request.isForMainFrame();}
            @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){work.cancelOwner(web);work.retained.remove(web);web.destroy();return true;}
        });
        return true;
    }
    void download(String url,String name) { if(!PhotoPolicy.trusted(web.getUrl()))return;installed();web.evaluateJavascript("window.trinityFiles?.downloadURL("+JSONObject.quote(url)+","+JSONObject.quote(name)+")",null); }
}
