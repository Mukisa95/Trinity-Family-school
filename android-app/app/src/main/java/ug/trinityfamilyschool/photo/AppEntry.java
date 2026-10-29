package ug.trinityfamilyschool.photo;

import android.content.Context;
import android.content.Intent;

/** All explicit entries reuse the live activity; only cold entries load a document. */
final class AppEntry {
    static Intent intent(Context context) {
        return new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    }
    static String route(Context context, Intent intent) {
        String shortcut = AppShortcuts.route(intent.getStringExtra(AppShortcuts.EXTRA));
        if (shortcut != null) return shortcut;
        String push = NativePush.tapRoute(context, intent);
        if (push != null) return push;
        String offline = intent.getStringExtra("offlineRoute"), online = intent.getStringExtra("onlineRoute");
        if (OfflinePolicy.local(offline)) return OfflinePolicy.onlineRoute(offline, "");
        return OfflinePolicy.supported(online) ? online : null;
    }
    static String source(Intent intent) {
        return AppShortcuts.route(intent.getStringExtra(AppShortcuts.EXTRA)) != null ? "shortcut"
            : intent.hasExtra("pushRoute") ? "push" : intent.hasExtra("offlineRoute") || intent.hasExtra("onlineRoute") ? "widget" : "launcher";
    }
    static void consume(Intent intent) {
        for (String key : new String[]{AppShortcuts.EXTRA,"pushRoute","pushRecipient","pushInstallation","offlineRoute","onlineRoute"}) intent.removeExtra(key);
    }
}
