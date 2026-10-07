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
            for (int j=0;j<3;j++) {
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
        assertNotNull(card.bigContentView); assertNotNull(card.contentView);
        assertEquals("School timetables",card.extras.getString(android.app.Notification.EXTRA_TITLE));
        java.util.concurrent.atomic.AtomicReference<Throwable> failure=new java.util.concurrent.atomic.AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                View view=card.bigContentView.apply(context,new FrameLayout(context));
                card.bigContentView.reapply(context, view);
                LinearLayout profiles=view.findViewById(R.id.notification_profiles); assertEquals("Refresh replaces the previous rows",2,profiles.getChildCount());
                View row=profiles.getChildAt(0); assertEquals("L2",((TextView)row.findViewById(R.id.current_lesson)).getText().toString());
                assertEquals(View.VISIBLE,row.findViewById(R.id.period_countdown).getVisibility());
                assertTrue(((Chronometer)row.findViewById(R.id.period_countdown)).isCountDown());
                assertTrue(row.findViewById(R.id.previous_period).hasOnClickListeners());
                assertTrue(((ViewGroup)row.findViewById(R.id.pills_container)).getChildAt(0).findViewById(R.id.lesson_pill).hasOnClickListeners());
            } catch(Throwable error) { failure.set(error); }
        });
        if(failure.get()!=null) throw new AssertionError(failure.get());
        if(card.contentIntent!=null)card.contentIntent.cancel();
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
                    View previous=view.findViewById(R.id.previous_period); assertTrue(previous.getWidth()>=48*context.getResources().getDisplayMetrics().density-1);
                    assertEquals("Previous period",previous.getContentDescription().toString());
                    assertEquals(0xff1f2937,((TextView)view.findViewById(R.id.current_lesson)).getCurrentTextColor());
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
                int[] widths={180,300,375},heights={230,300,400};String[] names={"compact","medium","large"};
                for(int i=0;i<layouts.length;i++)for(boolean progress:new boolean[]{false,true}){
                    android.appwidget.AppWidgetHostView host=new android.appwidget.AppWidgetHostView(context);
                    android.appwidget.AppWidgetProviderInfo info=android.appwidget.AppWidgetManager.getInstance(context).getInstalledProviders().stream()
                        .filter(provider->provider.provider.equals(new android.content.ComponentName(context,TimetableWidget.class))).findFirst().orElseThrow();
                    host.setAppWidget(987600,info);
                    View view=TimetableSurfaces.widgetView(context,987600,new JSONObject(),feed,progress,layouts[i]).apply(context,host);
                    android.widget.RemoteViews renderedRow=TimetableSurfaces.profileView(context,frame,progress,987600,i==0,false);
                    View row=renderedRow.apply(context,new FrameLayout(context)); renderedRow.reapply(context,row);
                    assertEquals(i==0 ? 2 : 1,((ViewGroup)row.findViewById(R.id.pills_container)).getChildCount());
                    assertEquals("L2",((TextView)row.findViewById(R.id.current_lesson)).getText().toString());
                    assertEquals(progress?View.VISIBLE:View.GONE,row.findViewById(R.id.lesson_progress).getVisibility());
                    assertEquals(50,((ProgressBar)row.findViewById(R.id.lesson_progress)).getProgress());
                    assertTrue(row.findViewById(R.id.previous_period).isEnabled()); assertEquals(View.GONE,row.findViewById(R.id.live_reset).getVisibility());
                    float density=context.getResources().getDisplayMetrics().density;int width=(int)(widths[i]*density),height=(int)(heights[i]*density);
                    view.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));view.layout(0,0,width,height);
                    ListView list=view.findViewById(R.id.feed_list);assertEquals(2,list.getAdapter().getCount());assertTrue(list.getBottom()<=height);
                    View firstRow=list.getChildAt(0); assertNotNull(firstRow);
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
        android.app.PendingIntent settings=android.app.PendingIntent.getActivity(context,8000+987600,new android.content.Intent(context,TimetableSettingsActivity.class),android.app.PendingIntent.FLAG_NO_CREATE|android.app.PendingIntent.FLAG_IMMUTABLE);
        if(settings!=null)settings.cancel();
    }
}
