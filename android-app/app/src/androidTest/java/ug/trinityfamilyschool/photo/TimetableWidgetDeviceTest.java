package ug.trinityfamilyschool.photo;
import android.content.Context;
import android.view.*;
import android.widget.*;
import android.graphics.*;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.*;
import static org.junit.Assert.*;

/** Real RemoteViews with synthetic school data; does not install a launcher widget. */
@RunWith(AndroidJUnit4.class)
public class TimetableWidgetDeviceTest {
    private TimetableSchedule.Frame fixture() {
        TimetableSchedule.Frame feed = new TimetableSchedule.Frame(); feed.accountId = "qa-fixture";
        for (int i=0; i<2; i++) {
            TimetableSchedule.Frame row = new TimetableSchedule.Frame(); row.accountId=feed.accountId;
            row.profileId="fixture-"+i; row.periodId="lesson"; row.tableName=i==0 ? "Upper Primary" : "Lower Primary";
            row.shortLabel="L2"; row.title="Lesson 2"; row.time="08:00 – 10:00"; row.hasPeriod=true;
            row.active=true; row.progress=50; row.countdownEnd=System.currentTimeMillis()+3600000;
            row.baseIndex=1; row.viewIndex=1; row.periodCount=4; row.hasPrevious=true; row.hasNext=true;
            row.next="Next: L3 · 10:15";
            for (int j=0;j<(i==0 ? 5 : 3);j++) {
                TimetableSchedule.Pill pill=new TimetableSchedule.Pill(); pill.id="pill-"+j; pill.classCode="P"+(i*3+j+1);
                pill.className="Primary "+(i*3+j+1); pill.subjectCode=j==0 ? "ENG" : j==1 ? "MTC" : "SCI";
                pill.subjectName=j==0 ? "English" : j==1 ? "Mathematics" : "Science"; pill.teacher="Example Teacher"; pill.time=row.time; pill.color=j;
                row.pills.add(pill);
            }
            feed.profiles.add(row);
        }
        return feed;
    }
    @Test public void cardShowsEveryProfileAndEmbeddedCountdown() throws Exception {
        Context context=ApplicationProvider.getApplicationContext();
        android.app.Notification card=TimetableSurfaces.card(context,new JSONObject(),fixture(),987601);
        assertTrue((card.flags & android.app.Notification.FLAG_ONGOING_EVENT)!=0);
        assertNotNull(card.contentView); assertNotNull(card.bigContentView);
        assertEquals("Two timetables reuse the collapsed layout if Android forces expansion",card.contentView.getLayoutId(),card.bigContentView.getLayoutId());
        assertEquals("School timetables",card.extras.getString(android.app.Notification.EXTRA_TITLE));
        android.util.Log.i("TrinityTimetableQA", "two_table_system_expansion=" + (android.app.Notification.Builder.recoverBuilder(context, card).createBigContentView() != null));
        java.util.concurrent.atomic.AtomicReference<Throwable> failure=new java.util.concurrent.atomic.AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                View view=card.contentView.apply(context,new FrameLayout(context));
                card.contentView.reapply(context, view);
                LinearLayout profiles=view.findViewById(R.id.mini_profiles); assertEquals("Refresh replaces the previous rows",2,profiles.getChildCount());
                View row=profiles.getChildAt(0); assertTrue(((TextView)row.findViewById(R.id.mini_label)).getText().toString().contains("Upper Primary"));
                assertTrue(((TextView)row.findViewById(R.id.mini_summary)).getText().toString().contains("P1 ENG"));
                assertTrue(row.findViewById(R.id.previous_period).hasOnClickListeners());
                int width=Math.round(355*context.getResources().getDisplayMetrics().density); view.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(0,View.MeasureSpec.UNSPECIFIED));
                assertTrue("Both collapsed rows fit Android's 48dp content limit",view.getMeasuredHeight()<=48*context.getResources().getDisplayMetrics().density+1);
                TimetableSchedule.Frame three=fixture();three.profiles.add(fixture().profiles.get(0));android.app.Notification expanded=TimetableSurfaces.card(context,new JSONObject(),three,987602);assertNotNull(expanded.bigContentView);
                View full=expanded.bigContentView.apply(context,new FrameLayout(context));assertEquals(3,((LinearLayout)full.findViewById(R.id.notification_profiles)).getChildCount());
                assertEquals(View.VISIBLE,full.findViewById(R.id.period_countdown).getVisibility());assertTrue(full.findViewById(R.id.lesson_pill).hasOnClickListeners());
            } catch(Throwable error) { failure.set(error); }
        });
        if(failure.get()!=null) throw new AssertionError(failure.get());
        if(card.contentIntent!=null)card.contentIntent.cancel();
    }
    @Test public void oneRowHeightWidgetKeepsFirstProfileVisibleAndScrollsToTheSecond() throws Exception {
        Context context=ApplicationProvider.getApplicationContext();java.util.concurrent.atomic.AtomicReference<Throwable> failure=new java.util.concurrent.atomic.AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {try{
            for(boolean progress:new boolean[]{false,true}){
                android.appwidget.AppWidgetHostView host=new android.appwidget.AppWidgetHostView(context);
                android.appwidget.AppWidgetProviderInfo info=android.appwidget.AppWidgetManager.getInstance(context).getInstalledProviders().stream().filter(provider->provider.provider.equals(new android.content.ComponentName(context,TimetableWidget.class))).findFirst().orElseThrow();
                assertTrue(info.minResizeHeight<=80*context.getResources().getDisplayMetrics().density+1);host.setAppWidget(987600,info);
                View view=TimetableSurfaces.shortWidget(context,987600,fixture(),progress,R.layout.timetable_widget).apply(context,host);
                float density=context.getResources().getDisplayMetrics().density;int width=Math.round(355*density),height=Math.round(80*density);
                view.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));view.layout(0,0,width,height);
                ListView list=view.findViewById(R.id.feed_list);assertEquals(2,list.getAdapter().getCount());assertEquals(View.GONE,view.findViewById(R.id.widget_header).getVisibility());
                assertNotNull(list.getChildAt(0));assertTrue("First complete profile fits",list.getChildAt(0).getBottom()<=list.getHeight());
                list.scrollListBy(list.getHeight());assertTrue("Overflow content remains scrollable",list.getLastVisiblePosition()==1);
                assertTrue("The second profile can be fully revealed",list.getChildAt(list.getChildCount()-1).getBottom()<=list.getHeight()+1);
            }
        }catch(Throwable error){failure.set(error);}});if(failure.get()!=null)throw new AssertionError(failure.get());
    }
    @Test public void visibilityDefaultsApplyToWidgetsUnlessTheyHaveTheirOwnSelection() throws Exception {
        Context context=ApplicationProvider.getApplicationContext();android.content.SharedPreferences prefs=TimetableSurfaces.prefs(context);
        boolean hadGlobal=prefs.contains("hiddenTables");java.util.Set<String> original=new java.util.HashSet<>(prefs.getStringSet("hiddenTables",java.util.Collections.emptySet()));
        boolean hadCard=prefs.contains("card"),originalCard=prefs.getBoolean("card",true),hadProgress=prefs.contains("progress"),originalProgress=prefs.getBoolean("progress",true);
        String local=TimetableSurfaces.prefix(987660)+"hiddenTables";
        try {
            JSONObject envelope=new OfflineStore(context).timetableAvailable();assertNotNull(envelope);
            java.time.ZonedDateTime now=java.time.ZonedDateTime.now(java.time.ZoneId.of(envelope.getJSONObject("session").optString("timeZone","Africa/Kampala")));
            TimetableSchedule.Frame all=TimetableSchedule.feed(envelope.getJSONObject("snapshot").getJSONObject("datasets"),now);assertTrue(all.profiles.size()>=2);
            prefs.edit().putStringSet("hiddenTables",java.util.Set.of(all.profiles.get(0).profileId)).commit();
            assertEquals(all.profiles.size()-1,TimetableSurfaces.feed(context,envelope,-1,now).profiles.size());
            assertEquals(all.profiles.size()-1,TimetableSurfaces.feed(context,envelope,987660,now).profiles.size());
            prefs.edit().putStringSet(local,java.util.Collections.emptySet()).commit();assertEquals(all.profiles.size(),TimetableSurfaces.feed(context,envelope,987660,now).profiles.size());
            TimetableSurfaces.select(context,new OfflineStore(context),new JSONObject().put("notificationCard",false).put("progress",originalProgress),android.appwidget.AppWidgetManager.INVALID_APPWIDGET_ID);assertFalse(prefs.getBoolean("card",true));
            prefs.edit().putBoolean("progress",false).commit();
            TimetableSurfaces.select(context,new OfflineStore(context),new JSONObject().put("notificationCard",true),android.appwidget.AppWidgetManager.INVALID_APPWIDGET_ID);assertTrue("A dismissed card can be enabled again",prefs.getBoolean("card",false));
            assertFalse("Restoring a dismissed card preserves the chosen progress setting",prefs.getBoolean("progress",true));
        } finally {android.content.SharedPreferences.Editor edit=prefs.edit().remove(local);if(hadGlobal)edit.putStringSet("hiddenTables",original);else edit.remove("hiddenTables");if(hadCard)edit.putBoolean("card",originalCard);else edit.remove("card");if(hadProgress)edit.putBoolean("progress",originalProgress);else edit.remove("progress");edit.commit();TimetableSurfaces.refresh(context,new OfflineStore(context));}
    }
    @Test public void darkLandscapeAndLargeTextKeepAccessibleControls() throws Exception {
        Context base=ApplicationProvider.getApplicationContext();
        java.util.concurrent.atomic.AtomicReference<Throwable> failure=new java.util.concurrent.atomic.AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                android.content.res.Configuration config=new android.content.res.Configuration(base.getResources().getConfiguration());
                config.fontScale=1.5f; config.orientation=android.content.res.Configuration.ORIENTATION_LANDSCAPE;
                config.uiMode=(config.uiMode & ~android.content.res.Configuration.UI_MODE_NIGHT_MASK)|android.content.res.Configuration.UI_MODE_NIGHT_YES;
                Context context=base.createConfigurationContext(config); TimetableSchedule.Frame row=fixture().profiles.get(0);
                for(boolean compact:new boolean[]{true,false}) {
                    View view=TimetableSurfaces.profileView(context,row,true,987600,compact,false).apply(context,new FrameLayout(context));
                    int width=(int)((compact ? 180 : 600)*context.getResources().getDisplayMetrics().density);
                    view.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(0,View.MeasureSpec.UNSPECIFIED));view.layout(0,0,width,view.getMeasuredHeight());
                    View previous=view.findViewById(R.id.previous_period); assertTrue(previous.getWidth()>=24*context.getResources().getDisplayMetrics().density-1);
                    assertEquals("Previous period",previous.getContentDescription().toString());
                    assertEquals(AppAppearance.palette(context).dark ? 0xffe2e8f0 : 0xff1f2937,((TextView)view.findViewById(R.id.current_lesson)).getCurrentTextColor());
                    assertTrue(view.getMeasuredHeight()>0);
                }
            } catch(Throwable error){failure.set(error);}
        });
        if(failure.get()!=null)throw new AssertionError(failure.get());
    }
    @Test public void allWidgetSizesRenderWithAndWithoutProgressAndDetails() throws Exception {
        Context context=ApplicationProvider.getApplicationContext(); File output=new File(context.getCacheDir(),"widget-qa");output.mkdirs();
        java.util.concurrent.atomic.AtomicReference<Throwable> failure=new java.util.concurrent.atomic.AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                TimetableSchedule.Frame feed=fixture(),frame=feed.profiles.get(0);
                int[] layouts={R.layout.timetable_widget_compact,R.layout.timetable_widget,R.layout.timetable_widget_large};
                int[] widths={180,355,375},heights={300,170,400};String[] names={"compact","medium","large"};
                for(int i=0;i<layouts.length;i++)for(boolean progress:new boolean[]{false,true}){
                    android.appwidget.AppWidgetHostView host=new android.appwidget.AppWidgetHostView(context);
                    android.appwidget.AppWidgetProviderInfo info=android.appwidget.AppWidgetManager.getInstance(context).getInstalledProviders().stream()
                        .filter(provider->provider.provider.equals(new android.content.ComponentName(context,TimetableWidget.class))).findFirst().orElseThrow();
                    assertNotNull(info.configure);
                    assertTrue((info.widgetFeatures & android.appwidget.AppWidgetProviderInfo.WIDGET_FEATURE_RECONFIGURABLE)!=0);
                    host.setAppWidget(987600,info);
                    View view=TimetableSurfaces.widgetView(context,987600,new JSONObject(),feed,progress,layouts[i]).apply(context,host);
                    android.widget.RemoteViews renderedRow=TimetableSurfaces.profileView(context,frame,progress,987600,i==0,false);
                    View row=renderedRow.apply(context,new FrameLayout(context)); renderedRow.reapply(context,row);
                    assertEquals(i==0 ? 3 : 1,((ViewGroup)row.findViewById(R.id.pills_container)).getChildCount());
                    assertEquals("L2",((TextView)row.findViewById(R.id.current_lesson)).getText().toString());
                    assertEquals(progress?View.VISIBLE:View.GONE,row.findViewById(R.id.lesson_progress).getVisibility());
                    assertEquals(50,((ProgressBar)row.findViewById(R.id.lesson_progress)).getProgress());
                    assertTrue(row.findViewById(R.id.previous_period).isEnabled()); assertEquals(View.GONE,row.findViewById(R.id.live_reset).getVisibility());
                    float density=context.getResources().getDisplayMetrics().density;int width=(int)(widths[i]*density),height=(int)(heights[i]*density);
                    view.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));view.layout(0,0,width,height);
                    ListView list=view.findViewById(R.id.feed_list);assertEquals(2,list.getAdapter().getCount());assertTrue(list.getBottom()<=height);
                    View firstRow=list.getChildAt(0); assertNotNull(firstRow);
                    assertEquals("No always-visible settings affordance",0,context.getResources().getIdentifier("widget_settings","id",context.getPackageName()));
                    if(i==1) {
                        assertEquals("Both complete timetable groups fit the short wide widget",2,list.getChildCount());
                        assertTrue("Last group is fully visible",list.getChildAt(1).getBottom()<=list.getHeight());
                        assertTrue("Dashboard-sized profile stays compact",firstRow.getHeight()<=70*density);
                    }
                    assertTrue("Collection navigation has a click listener",firstRow.findViewById(R.id.previous_period).hasOnClickListeners());
                    assertTrue("Nested pill must have its own collection click listener",firstRow.findViewById(R.id.lesson_pill).hasOnClickListeners());
                    Bitmap bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);view.draw(new Canvas(bitmap));
                    try(FileOutputStream file=new FileOutputStream(new File(output,names[i]+(progress?"-progress.png":"-plain.png")))){bitmap.compress(Bitmap.CompressFormat.PNG,100,file);}bitmap.recycle();
                }
                frame.live=false;frame.viewIndex=0;frame.hasPrevious=false;
                View preview=TimetableSurfaces.profileView(context,frame,true).apply(context,new FrameLayout(context));
                assertEquals(View.VISIBLE,preview.findViewById(R.id.live_reset).getVisibility()); assertFalse(preview.findViewById(R.id.previous_period).isEnabled());
                String key=TimetableInteractions.detailKey(987600,frame,java.time.ZonedDateTime.now(java.time.ZoneId.of(frame.timeZone)));
                TimetableSurfaces.prefs(context).edit().putString(key,"pill-0").commit();
                try{
                    View detail=TimetableSurfaces.profileView(context,frame,true).apply(context,new FrameLayout(context));
                    assertEquals(View.VISIBLE,detail.findViewById(R.id.pill_details).getVisibility());assertEquals(View.GONE,detail.findViewById(R.id.pills_container).getVisibility());
                    assertEquals("P1 · English",((TextView)detail.findViewById(R.id.detail_subject)).getText().toString());
                }finally{TimetableSurfaces.prefs(context).edit().remove(key).commit();}
            }catch(Throwable error){failure.set(error);}
        });
        if(failure.get()!=null)throw new AssertionError("RemoteViews rendering failed",failure.get());
    }
}
