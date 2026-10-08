package ug.trinityfamilyschool.photo;

import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.database.Cursor;
import android.net.*;
import android.os.*;
import android.provider.Settings;
import android.widget.*;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** User-approved, school-scoped APK updates. Android always owns installation consent. */
final class AppUpdater {
    static final String ACTION_INSTALL="ug.trinityfamilyschool.photo.INSTALL_UPDATE", EVENT="ug.trinityfamilyschool.photo.UPDATE_CHANGED";
    private static final Object LOCK=new Object();
    private static final String CHANNEL="app-updates";
    private static final int NOTIFICATION=7511;
    private static final long DAY=86400000L;
    private final Activity activity;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private boolean resumed, probing, checking, hideProgress, launchedInstaller;
    private AlertDialog dialog;
    private String dialogKind="";
    private ProgressBar progress;
    private TextView progressText;
    private final Runnable poll=()->probe(false);
    private final BroadcastReceiver changes=new BroadcastReceiver(){@Override public void onReceive(Context context,Intent intent){probe(false);}};
    AppUpdater(Activity activity){this.activity=activity;ContextCompat.registerReceiver(activity,changes,new IntentFilter(EVENT),ContextCompat.RECEIVER_NOT_EXPORTED);}
    private static SharedPreferences prefs(Context context){return context.getSharedPreferences("app-updates",Context.MODE_PRIVATE);}
    static long downloadId(Context context){return prefs(context).getLong("downloadId",-1);}
    private static DownloadManager downloads(Context context){return (DownloadManager)context.getSystemService(Context.DOWNLOAD_SERVICE);}
    private static long version(PackageInfo info){return Build.VERSION.SDK_INT>=28?info.getLongVersionCode():info.versionCode;}
    private static long installed(Context context) throws Exception{return version(context.getPackageManager().getPackageInfo(context.getPackageName(),0));}
    private static AppUpdateRelease parse(Context context,String json) throws Exception{return AppUpdateRelease.parse(json,context.getPackageName(),BuildConfig.SCHOOL_FIREBASE_PROJECT,PhotoPolicy.ORIGIN,Build.VERSION.SDK_INT);}
    private static File source(Context context,AppUpdateRelease release) throws Exception {
        File directory=context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);if(directory==null)throw new IOException("Download storage unavailable.");
        return new File(directory,"updates/app-"+release.versionCode+".apk");
    }
    private static File staged(Context context,AppUpdateRelease release){return new File(new File(context.getCacheDir(),"app-updates"),"app-"+release.versionCode+".apk");}
    @SuppressWarnings("deprecation") private static byte[][] signers(PackageInfo info){
        Signature[] signatures=Build.VERSION.SDK_INT>=28&&info.signingInfo!=null?info.signingInfo.getApkContentsSigners():info.signatures;
        if(signatures==null)return null;byte[][] bytes=new byte[signatures.length][];for(int i=0;i<signatures.length;i++)bytes[i]=signatures[i].toByteArray();return bytes;
    }
    @SuppressWarnings("deprecation") static void verify(Context context,File file,AppUpdateRelease release) throws Exception {
        if(!release.matches(file))throw new IOException("The downloaded update failed verification. Please download it again.");
        PackageManager manager=context.getPackageManager();int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
        PackageInfo current=manager.getPackageInfo(context.getPackageName(),flags), candidate=manager.getPackageArchiveInfo(file.getAbsolutePath(),flags);
        if(candidate==null || !current.packageName.equals(candidate.packageName) || version(candidate)!=release.versionCode || !release.versionName.equals(candidate.versionName)
            || !release.newerThan(version(current)) || candidate.applicationInfo.minSdkVersion>Build.VERSION.SDK_INT || !AppUpdateRelease.sameSigners(signers(current),signers(candidate)))
            throw new IOException("This update does not match the installed school app.");
    }
    static void complete(Context context){
        synchronized(LOCK){
            SharedPreferences preferences=prefs(context);long id=downloadId(context);if(id<0)return;
            try(Cursor cursor=downloads(context).query(new DownloadManager.Query().setFilterById(id))){
                if(cursor==null||!cursor.moveToFirst())return;
                if(cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))!=DownloadManager.STATUS_SUCCESSFUL)return;
                AppUpdateRelease release=parse(context,preferences.getString("release",""));
                if(!release.newerThan(installed(context))){clear(context);return;}
                File file=staged(context,release);
                if(preferences.getLong("ready",0)==release.versionCode && file.exists())return;
                file.getParentFile().mkdirs();File temporary=new File(file.getParentFile(),"pending-"+release.versionCode+".apk");
                try(InputStream input=new FileInputStream(source(context,release));OutputStream output=new FileOutputStream(temporary)){
                    byte[] bytes=new byte[32768];int count;long total=0;
                    while((count=input.read(bytes))!=-1){total+=count;if(total>release.bytes)throw new IOException("Unexpected update size.");output.write(bytes,0,count);}
                }catch(Exception error){temporary.delete();throw error;}
                try{verify(context,temporary,release);if(!temporary.renameTo(file))throw new IOException("Could not prepare update.");}
                catch(Exception error){temporary.delete();throw error;}
                preferences.edit().putLong("ready",release.versionCode).remove("error").commit();
                readyNotification(context,release);
            }catch(Exception error){preferences.edit().putString("error","The update could not be verified. Download it again.").commit();}
        }
        context.sendBroadcast(new Intent(EVENT).setPackage(context.getPackageName()));
    }
    private static void readyNotification(Context context,AppUpdateRelease release){
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL,"App updates",NotificationManager.IMPORTANCE_LOW));
        Intent intent=new Intent(context,MainActivity.class).setAction(ACTION_INSTALL).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap=PendingIntent.getActivity(context,NOTIFICATION,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        try{manager.notify(NOTIFICATION,new NotificationCompat.Builder(context,CHANNEL).setSmallIcon(R.drawable.school_icon)
            .setContentTitle(BuildConfig.SCHOOL_APP_NAME+" update ready").setContentText("Version "+release.versionName+" · Tap to install")
            .setContentIntent(tap).setAutoCancel(true).build());}catch(SecurityException ignored){/* Opening the app also offers the ready update. */}
    }
    private static void clear(Context context){
        synchronized(LOCK){SharedPreferences preferences=prefs(context);long id=downloadId(context);if(id>=0)downloads(context).remove(id);
            try{AppUpdateRelease release=parse(context,preferences.getString("release",""));File file=staged(context,release);file.delete();new File(file.getParentFile(),"pending-"+release.versionCode+".apk").delete();source(context,release).delete();}catch(Exception ignored){}
            preferences.edit().remove("downloadId").remove("release").remove("ready").remove("error").remove("permissionWaiting").remove("autoInstall").commit();
            ((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(NOTIFICATION);
        }
    }
    void resume(){resumed=true;boolean tap=ACTION_INSTALL.equals(activity.getIntent().getAction());if(tap){activity.getIntent().setAction(Intent.ACTION_MAIN);launchedInstaller=false;prefs(activity).edit().putBoolean("autoInstall",true).apply();}probe(tap);check(false);}
    void pause(){resumed=false;handler.removeCallbacks(poll);dismiss();}
    void destroy(){pause();activity.unregisterReceiver(changes);io.shutdown();}
    void check(boolean manual){
        if(checking)return;
        if(downloadId(activity)>=0){if(manual){hideProgress=false;launchedInstaller=false;probe(true);}return;}
        if(!connected()){if(manual)toast("Connect to the internet to check for updates.");return;}
        if(manual)toast("Checking for app updates…");
        long now=System.currentTimeMillis();SharedPreferences preferences=prefs(activity);
        boolean cached=!manual&&now-preferences.getLong("checked",0)<6*60*60*1000L;
        if(!cached&&!manual&&now-preferences.getLong("attempted",0)<120000L)return;
        checking=true;
        io.execute(()->{
            try{
                String json=cached?preferences.getString("available",""):fetch();AppUpdateRelease release=parse(activity,json);
                if(!cached)preferences.edit().putString("available",json).putLong("checked",now).apply();
                boolean newer=release.newerThan(installed(activity));
                ui(()->{checking=false;if(newer){if(manual||preferences.getLong("laterVersion",0)!=release.versionCode||System.currentTimeMillis()>=preferences.getLong("laterUntil",0))offer(release);}
                    else if(manual)toast("You’re up to date · "+BuildConfig.VERSION_NAME);});
            }catch(Exception error){ui(()->{checking=false;if(manual)toast("Could not check for updates. Please try again when connected.");});}
        });
        if(!cached)preferences.edit().putLong("attempted",now).apply();
    }
    private boolean connected(){ConnectivityManager manager=(ConnectivityManager)activity.getSystemService(Context.CONNECTIVITY_SERVICE);NetworkCapabilities caps=manager.getNetworkCapabilities(manager.getActiveNetwork());return caps!=null&&caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);}
    private String fetch() throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URL(PhotoPolicy.ORIGIN+"/api/android/release").openConnection();
        connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(8000);connection.setReadTimeout(10000);connection.setRequestProperty("Cache-Control","no-cache");
        try{if(connection.getResponseCode()!=200)throw new IOException("Release unavailable.");
            try(InputStream input=connection.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()){
                byte[] bytes=new byte[2048];int count;while((count=input.read(bytes))!=-1){if(output.size()+count>16384)throw new IOException("Invalid release.");output.write(bytes,0,count);}return output.toString(StandardCharsets.UTF_8.name());}
        }finally{connection.disconnect();}
    }
    private void offer(AppUpdateRelease release){
        if(dialog!=null)return;
        dialogKind="offer";
        dialog=new AlertDialog.Builder(activity).setTitle("Update "+BuildConfig.SCHOOL_APP_NAME+"?")
            .setMessage("Version "+release.versionName+" is available ("+String.format(java.util.Locale.ROOT,"%.1f",release.bytes/1048576.0)+" MB)."
                +(release.notes.isEmpty()?"":"\n\n"+release.notes)+"\n\nYour account and settings will be kept.")
            .setPositiveButton("Update",(d,w)->{dismiss();start(release);}).setNegativeButton("Later",(d,w)->later(release))
            .setOnCancelListener(d->later(release)).create();dialog.setOnDismissListener(d->{dialog=null;dialogKind="";});dialog.show();
    }
    private void later(AppUpdateRelease release){prefs(activity).edit().putLong("laterVersion",release.versionCode).putLong("laterUntil",System.currentTimeMillis()+DAY).apply();}
    private void start(AppUpdateRelease release){
        hideProgress=false;launchedInstaller=false;
        io.execute(()->{try{synchronized(LOCK){clear(activity);File target=source(activity,release);target.getParentFile().mkdirs();target.delete();
                DownloadManager.Request request=new DownloadManager.Request(Uri.parse(release.downloadUrl)).setTitle(BuildConfig.SCHOOL_APP_NAME+" update")
                    .setDescription("Downloading version "+release.versionName).setMimeType("application/vnd.android.package-archive")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE).setAllowedOverMetered(true)
                    .setDestinationInExternalFilesDir(activity,Environment.DIRECTORY_DOWNLOADS,"updates/app-"+release.versionCode+".apk");
                long id=downloads(activity).enqueue(request);prefs(activity).edit().putString("release",release.json).putLong("downloadId",id).putBoolean("autoInstall",true).remove("readyUntil").commit();}
            ui(()->probe(true));}catch(Exception error){ui(()->toast("Could not start the download. Please try again."));}});
    }
    private void probe(boolean manual){
        if(!resumed||probing)return;long id=downloadId(activity);if(id<0)return;probing=true;
        io.execute(()->{
            try{
                AppUpdateRelease release=parse(activity,prefs(activity).getString("release",""));
                if(!release.newerThan(installed(activity))){clear(activity);ui(()->{probing=false;dismiss();});return;}
                int status=DownloadManager.STATUS_FAILED;long downloaded=0,total=release.bytes;
                try(Cursor cursor=downloads(activity).query(new DownloadManager.Query().setFilterById(id))){if(cursor!=null&&cursor.moveToFirst()){
                    status=cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));downloaded=cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));}}
                if(status==DownloadManager.STATUS_SUCCESSFUL)complete(activity);
                final int state=status, percent=(int)Math.min(100,Math.max(0,downloaded*100/total));
                ui(()->{probing=false;
                    if(prefs(activity).contains("error")||state==DownloadManager.STATUS_FAILED){failure(release);return;}
                    if(prefs(activity).getLong("ready",0)==release.versionCode){
                        if("progress".equals(dialogKind))dismiss();
                        boolean permission=prefs(activity).getBoolean("permissionWaiting",false)&&activity.getPackageManager().canRequestPackageInstalls();
                        if(permission || prefs(activity).getBoolean("autoInstall",false)){prefs(activity).edit().remove("permissionWaiting").remove("autoInstall").apply();install(release);}
                        else if(!launchedInstaller&&(manual||System.currentTimeMillis()>=prefs(activity).getLong("readyUntil",0)))ready(release);
                    }else{if(!hideProgress&&dialog==null)showProgress(release);if(progress!=null&&"progress".equals(dialogKind)){progress.setProgress(percent);progressText.setText(state==DownloadManager.STATUS_PAUSED?"Waiting for a connection…":"Downloading · "+percent+"%");}
                        handler.removeCallbacks(poll);handler.postDelayed(poll,1500);}
                });
            }catch(Exception error){clear(activity);ui(()->{probing=false;toast("Could not resume this update. Please check for updates again.");});}
        });
    }
    private void showProgress(AppUpdateRelease release){
        LinearLayout layout=new LinearLayout(activity);layout.setOrientation(LinearLayout.VERTICAL);int padding=(int)(24*activity.getResources().getDisplayMetrics().density);layout.setPadding(padding,padding,padding,padding);
        progressText=new TextView(activity);progressText.setText("Downloading…");layout.addView(progressText);
        progress=new ProgressBar(activity,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(100);layout.addView(progress,new LinearLayout.LayoutParams(-1,-2));
        dialogKind="progress";dialog=new AlertDialog.Builder(activity).setTitle("Updating to "+release.versionName).setView(layout)
            .setPositiveButton("Continue in background",(d,w)->hideProgress=true).setNegativeButton("Cancel download",(d,w)->{later(release);io.execute(()->clear(activity));})
            .setOnCancelListener(d->hideProgress=true).create();dialog.setOnDismissListener(d->{dialog=null;dialogKind="";});dialog.show();
    }
    private void ready(AppUpdateRelease release){
        if(dialog!=null)return;dialogKind="ready";
        dialog=new AlertDialog.Builder(activity).setTitle("Update ready").setMessage("Install "+BuildConfig.SCHOOL_APP_NAME+" "+release.versionName+"? Android will ask you to confirm.")
            .setPositiveButton("Install",(d,w)->{dismiss();install(release);}).setNegativeButton("Later",(d,w)->snoozeReady())
            .setOnCancelListener(d->snoozeReady()).create();dialog.setOnDismissListener(d->{dialog=null;dialogKind="";});dialog.show();
    }
    private void snoozeReady(){prefs(activity).edit().putLong("readyUntil",System.currentTimeMillis()+DAY).remove("permissionWaiting").apply();}
    private void failure(AppUpdateRelease release){
        if(dialog!=null){if("failure".equals(dialogKind))return;dismiss();}dialogKind="failure";
        dialog=new AlertDialog.Builder(activity).setTitle("Update download interrupted").setMessage("Your current app is ready to use. Try downloading the update again.")
            .setPositiveButton("Retry",(d,w)->{dismiss();io.execute(()->{clear(activity);ui(()->check(true));});}).setNegativeButton("Later",(d,w)->{later(release);io.execute(()->clear(activity));})
            .setOnCancelListener(d->{later(release);io.execute(()->clear(activity));}).create();dialog.setOnDismissListener(d->{dialog=null;dialogKind="";});dialog.show();
    }
    private void install(AppUpdateRelease release){
        io.execute(()->{try{File file=staged(activity,release);verify(activity,file,release);ui(()->{
                if(!activity.getPackageManager().canRequestPackageInstalls()){
                    dialogKind="permission";dialog=new AlertDialog.Builder(activity).setTitle("Allow app updates")
                        .setMessage("Allow updates from "+BuildConfig.SCHOOL_APP_NAME+" in the next Android screen, then return to install this update.")
                        .setPositiveButton("Open Android settings",(d,w)->{prefs(activity).edit().putBoolean("permissionWaiting",true).apply();activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())));})
                        .setNegativeButton("Later",(d,w)->snoozeReady()).setOnCancelListener(d->snoozeReady()).create();dialog.setOnDismissListener(d->{dialog=null;dialogKind="";});dialog.show();return;
                }
                try{Uri uri=FileProvider.getUriForFile(activity,activity.getPackageName()+".files",file);
                    Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    intent.setClipData(ClipData.newRawUri("App update",uri));launchedInstaller=true;snoozeReady();activity.startActivity(intent);
                }catch(Exception error){toast("Android could not open the installer. You can try again from app updates.");}
            });}catch(Exception error){ui(()->{toast("The update failed verification. Download it again.");io.execute(()->clear(activity));});}});
    }
    private void ui(Runnable action){handler.post(()->{if(resumed&&!activity.isFinishing()&&!activity.isDestroyed())action.run();else{probing=false;checking=false;}});}
    private void dismiss(){if(dialog!=null){AlertDialog previous=dialog;dialog=null;dialogKind="";previous.setOnDismissListener(null);previous.dismiss();}}
    private void toast(String text){Toast.makeText(activity,text,Toast.LENGTH_LONG).show();}
}
