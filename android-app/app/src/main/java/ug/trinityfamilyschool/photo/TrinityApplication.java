package ug.trinityfamilyschool.photo;

public final class TrinityApplication extends android.app.Application {
    @Override public void onCreate(){super.onCreate();NativePush.start(this);TimetableRefresh.start(this);}
    @Override public void onConfigurationChanged(android.content.res.Configuration configuration) {
        super.onConfigurationChanged(configuration);
        AppAppearance.deviceChanged(this);
    }
}
