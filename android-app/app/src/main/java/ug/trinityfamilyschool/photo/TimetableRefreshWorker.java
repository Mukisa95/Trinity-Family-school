package ug.trinityfamilyschool.photo;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.*;

/** Local-only recovery; no website connection or fresh sign-in is required. */
public final class TimetableRefreshWorker extends Worker {
    public TimetableRefreshWorker(@NonNull Context context, @NonNull WorkerParameters parameters) { super(context, parameters); }
    @NonNull @Override public Result doWork() {
        TimetableSurfaces.refresh(getApplicationContext(), new OfflineStore(getApplicationContext()));
        return Result.success();
    }
}
