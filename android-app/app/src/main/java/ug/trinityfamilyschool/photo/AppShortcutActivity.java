package ug.trinityfamilyschool.photo;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/** Static shortcuts clear their own disposable task, never the running school app. */
public final class AppShortcutActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        String id = getIntent().getStringExtra(AppShortcuts.EXTRA);
        if (AppShortcuts.route(id) != null) startActivity(new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(AppShortcuts.EXTRA, id));
        finish();
    }
}
