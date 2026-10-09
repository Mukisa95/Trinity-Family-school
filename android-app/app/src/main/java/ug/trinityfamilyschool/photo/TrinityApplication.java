package ug.trinityfamilyschool.photo;

public final class TrinityApplication extends android.app.Application {
    @Override public void onCreate(){super.onCreate();NativePush.start(this);TimetableRefresh.start(this);}
}
