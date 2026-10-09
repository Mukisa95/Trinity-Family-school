package ug.trinityfamilyschool.photo;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.widget.*;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class TimetableAppearanceDeviceTest {
    private Context mode(Context base, boolean dark) {
        Configuration configuration=new Configuration(base.getResources().getConfiguration());
        configuration.uiMode=(configuration.uiMode & ~Configuration.UI_MODE_NIGHT_MASK)|(dark?Configuration.UI_MODE_NIGHT_YES:Configuration.UI_MODE_NIGHT_NO);
        return base.createConfigurationContext(configuration);
    }
    private TimetableSchedule.Frame row() {
        TimetableSchedule.Frame row=new TimetableSchedule.Frame();row.accountId="appearance-fixture";row.profileId="appearance";row.periodId="lesson";
        row.tableName="Primary";row.shortLabel="L1";row.title="Lesson 1";row.time="08:00 – 09:00";row.active=true;row.hasPeriod=true;
        row.countdownEnd=System.currentTimeMillis()+3600000;row.progress=40;row.hasNext=true;
        TimetableSchedule.Pill pill=new TimetableSchedule.Pill();pill.id="one";pill.classCode="P4";pill.className="Primary Four";pill.subjectCode="ENG";pill.subjectName="English";pill.teacher="Test teacher";pill.time=row.time;row.pills.add(pill);
        return row;
    }
    private void verifyRow(Context context, RemoteViews remote, boolean dark) {
        View view=remote.apply(context,new FrameLayout(context));remote.reapply(context,view);
        assertEquals(dark?0xffe2e8f0:0xff1f2937,((TextView)view.findViewById(R.id.current_lesson)).getCurrentTextColor());
        assertEquals(dark?0xff86efac:0xff15803d,((TextView)view.findViewById(R.id.lesson_pill)).getCurrentTextColor());
        assertEquals(dark?0xff6ee7b7:0xff047857,((TextView)view.findViewById(R.id.period_badge)).getCurrentTextColor());
        assertTrue(view.findViewById(R.id.next_period).isEnabled());
        assertEquals(40,((ProgressBar)view.findViewById(R.id.lesson_progress)).getProgress());
    }
    @Test public void widgetAndBothNotificationSizesFollowAppPreferenceAndHostTheme() throws Exception {
        Context base=ApplicationProvider.getApplicationContext();android.content.SharedPreferences prefs=AppAppearance.prefs(base);
        boolean had=prefs.contains("preference");String original=AppAppearance.preference(base);
        java.util.concurrent.atomic.AtomicReference<Throwable> failure=new java.util.concurrent.atomic.AtomicReference<>();
        try {
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{
                for(String preference:new String[]{"light","dark","system"}) {
                    prefs.edit().putString("preference",preference).commit();
                    Context light=mode(base,false);TimetableSchedule.Frame row=row();
                    // Reapply the SAME RemoteViews under a changed host configuration, without re-rendering in the app.
                    RemoteViews remote=TimetableSurfaces.profileView(light,row,true,987690,false,false);
                    for(boolean deviceDark:new boolean[]{false,true}) {
                        Context context=mode(base,deviceDark);boolean dark="dark".equals(preference)||("system".equals(preference)&&deviceDark);
                        verifyRow(context,remote,dark);
                        verifyRow(context,TimetableSurfaces.profileView(context,row,true,987690,true,false),dark);
                        TimetableSchedule.Frame feed=new TimetableSchedule.Frame();feed.accountId=row.accountId;feed.profiles.add(row);
                        for(int layout:new int[]{R.layout.timetable_widget_compact,R.layout.timetable_widget,R.layout.timetable_widget_large}) {
                            android.appwidget.AppWidgetHostView host=new android.appwidget.AppWidgetHostView(context);
                            android.appwidget.AppWidgetProviderInfo info=android.appwidget.AppWidgetManager.getInstance(context).getInstalledProviders().stream().filter(provider->provider.provider.equals(new android.content.ComponentName(context,TimetableWidget.class))).findFirst().orElseThrow();
                            host.setAppWidget(987690,info);
                            View widget=TimetableSurfaces.widgetView(context,987690,new JSONObject(),feed,true,layout).apply(context,host);
                            assertEquals(dark?0xff111c2d:0xffffffff,((GradientDrawable)widget.getBackground()).getColor().getDefaultColor());
                            assertEquals(dark?0xffa5b4fc:0xff4f46e5,((TextView)widget.findViewById(R.id.widget_title)).getCurrentTextColor());
                        }
                        android.app.Notification card=TimetableSurfaces.card(context,new JSONObject(),feed,987690);
                        View small=card.contentView.apply(context,new FrameLayout(context));
                        assertEquals(dark?0xffe2e8f0:0xff1f2937,((TextView)small.findViewById(R.id.mini_label)).getCurrentTextColor());
                        assertEquals(dark?0xff111c2d:0xffffffff,((GradientDrawable)small.getBackground()).getColor().getDefaultColor());
                        feed.profiles.add(row);feed.profiles.add(row);
                        View big=TimetableSurfaces.card(context,new JSONObject(),feed,987690).bigContentView.apply(context,new FrameLayout(context));
                        assertEquals(dark?0xffe2e8f0:0xff1f2937,((TextView)big.findViewById(R.id.current_lesson)).getCurrentTextColor());
                        assertEquals(dark?0xff6ee7b7:0xff047857,((TextView)big.findViewById(R.id.period_countdown)).getCurrentTextColor());
                    }
                }
            }catch(Throwable error){failure.set(error);}});
            if(failure.get()!=null)throw new AssertionError(failure.get());
        } finally { if(had)prefs.edit().putString("preference",original).commit();else prefs.edit().remove("preference").commit(); }
    }
}
