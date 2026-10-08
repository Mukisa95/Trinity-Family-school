package ug.trinityfamilyschool.photo;

import android.content.Context;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public final class NativePushWorker extends Worker {
    public NativePushWorker(Context context,WorkerParameters parameters){super(context,parameters);}
    @Override public Result doWork(){return NativePush.reconcile(getApplicationContext())?Result.success():Result.retry();}
}
